#!/bin/sh
# =============================================================
#  Sentinel — Script de Mantenimiento
#  Adaptado a entorno donde el contenedor API corre como PID 1
#  (sin systemd en host). Servicios detectados via Docker socket.
# =============================================================

RUNS_DIR="${SENTINEL_RUNS_DIR:-/var/log/sentinel/runs}"
LOG_FILE="${SENTINEL_MAINTENANCE_LOG:-/var/log/mantenimiento.log}"
CACHE_DIR="${SENTINEL_CACHE_DIR:-/var/cache/sentinel}"
CPU_HISTORY_FILE="${SENTINEL_CPU_HISTORY_FILE:-$CACHE_DIR/cpu_history.jsonl}"
DISK_DIRS_CACHE="${SENTINEL_DISK_DIRS_CACHE:-$CACHE_DIR/disk_dirs.json}"
BACKUP_DEST="${SENTINEL_BACKUP_DEST:-/var/backups/sentinel}"
BACKUP_DAYS="${SENTINEL_BACKUP_DAYS:-7}"
DISK_ALERT="${SENTINEL_DISK_ALERT:-85}"
DOCKER_SOCK="/var/run/docker.sock"

mkdir -p "$RUNS_DIR" "$CACHE_DIR" "$BACKUP_DEST" "$(dirname "$LOG_FILE")"

run_id="run_$(date +%Y%m%d_%H%M%S)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tasks_total=7
tasks_ok=0
status="ok"
notes=""

log()      { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"; }
add_note() { notes="${notes:+$notes|}$1"; }

log "[sentinel] ▶ Inicio: $run_id"

# ── 1. LIMPIAR TEMPORALES Y CACHÉ ─────────────────────────────
log "[1/7] Limpiando archivos temporales..."
find /tmp -type f -atime +7 -delete 2>/dev/null || true
find /var/tmp -type f -atime +7 -delete 2>/dev/null || true
# Rotar logs de mantenimiento si supera 10MB
log_size=$(du -k "$LOG_FILE" 2>/dev/null | cut -f1 || echo "0")
if [ "${log_size:-0}" -gt 10240 ]; then
  mv "$LOG_FILE" "${LOG_FILE}.1"
  log "[INFO] Log de mantenimiento rotado (era ${log_size}KB)"
fi
log "[OK] Limpieza completada"
tasks_ok=$((tasks_ok+1))

# ── 2. USO DE DISCO ────────────────────────────────────────────
log "[2/7] Revisando uso de disco..."
disk_pct=$(df / | awk 'NR==2{gsub(/%/,"",$5);print $5}' 2>/dev/null || echo "0")
disk_pct="${disk_pct:-0}"
if [ "$disk_pct" -ge "$DISK_ALERT" ] 2>/dev/null; then
  log "[WARN] Disco raíz al ${disk_pct}% (umbral: ${DISK_ALERT}%)"
  add_note "Disco raíz al ${disk_pct}%"
  status="warn"
else
  log "[OK] Uso de disco: ${disk_pct}%"
  tasks_ok=$((tasks_ok+1))
fi

# Cache top directorios
log "  Calculando top de directorios..."
raw=$(du -hx --max-depth=2 / 2>/dev/null | sort -rh | head -8 || true)
if [ -n "$raw" ]; then
  printf '%s\n' "$raw" | awk '
  BEGIN { print "["; first=1 }
  {
    val=$1; path=$2
    size=0
    if (val ~ /G$/) { sub(/G$/,"",val); size=val+0 }
    else if (val ~ /M$/) { sub(/M$/,"",val); size=val/1024 }
    else if (val ~ /K$/) { sub(/K$/,"",val); size=val/1024/1024 }
    if (!first) printf ","
    printf "\n  {\"path\":\"%s\",\"size_gb\":%.1f}", path, size
    first=0
  }
  END { print "\n]" }' > "$DISK_DIRS_CACHE"
  log "[OK] Top dirs actualizado"
else
  log "[WARN] No se pudo calcular top de directorios"
fi

# ── 3. REVISAR LOGS DEL SISTEMA ───────────────────────────────
log "[3/7] Revisando logs del sistema..."
# Errores en syslog de las últimas 24h
err_count=$(grep -c " ERROR \| FATAL \| panic\|kernel:" /var/log/syslog 2>/dev/null || echo "0")
ssh_invalid=$(grep -c "Invalid user\|Connection closed by invalid" /var/log/auth.log 2>/dev/null || echo "0")
ssh_accepted=$(grep -c "Accepted publickey\|Accepted password" /var/log/auth.log 2>/dev/null || echo "0")
log "  Errores en syslog: $err_count"
log "  Intentos SSH con usuario inválido: $ssh_invalid"
log "  Accesos SSH aceptados: $ssh_accepted"
if [ "${ssh_invalid:-0}" -gt 50 ] 2>/dev/null; then
  add_note "$ssh_invalid intentos SSH con usuario inválido"
  status="warn"
fi
log "[OK] Revisión de logs completada"
tasks_ok=$((tasks_ok+1))

# ── 4. SERVICIOS VIA DOCKER SOCKET ────────────────────────────
log "[4/7] Verificando contenedores Docker..."
svc_ok=0; svc_warn=0
if [ -S "$DOCKER_SOCK" ] && command -v curl >/dev/null 2>&1; then
  # Listar contenedores via Docker socket (sin docker CLI)
  containers=$(curl -sf --unix-socket "$DOCKER_SOCK" \
    "http://localhost/containers/json?all=true" 2>/dev/null || echo "[]")

  if [ -n "$containers" ] && [ "$containers" != "[]" ]; then
    # Parsear con awk: extraer Names y State
    running=$(echo "$containers" | grep -o '"Status":"[^"]*"' | grep -c "Up" || echo "0")
    stopped=$(echo "$containers" | grep -o '"Status":"[^"]*"' | grep -cv "Up" || echo "0")
    total_c=$(echo "$containers" | grep -o '"Status":"[^"]*"' | wc -l || echo "0")
    log "  Contenedores: $running corriendo, $stopped detenidos (total: $total_c)"

    if [ "${stopped:-0}" -gt 0 ] 2>/dev/null; then
      # Listar los detenidos
      stopped_names=$(echo "$containers" | \
        grep -o '"Names":\["[^"]*"\],"Image":"[^"]*","ImageID":"[^"]*","Command":"[^"]*","Created":[0-9]*,"Ports":[^,]*,"Labels":[^,]*,"State":"[^"]*","Status":"[^U][^p][^"]*"' | \
        grep -o '"Names":\["[^"]*"' | sed 's|"Names":\["/||;s|"||g' || true)
      [ -n "$stopped_names" ] && log "[WARN] Contenedores detenidos: $stopped_names"
      add_note "$stopped contenedores detenidos"
      status="warn"
      svc_warn=$((svc_warn+stopped))
    fi
    svc_ok=$((svc_ok+running))
    tasks_ok=$((tasks_ok+1))
  else
    log "[WARN] No se pudo obtener lista de contenedores"
    add_note "Docker socket no respondió"
  fi
else
  log "[WARN] Docker socket no disponible o curl no encontrado"
  add_note "Docker socket no accesible"
  status="warn"
fi

# ── 5. SEGURIDAD ───────────────────────────────────────────────
log "[5/7] Revisando seguridad..."

# Lectura directa desde mount (auth.log del host)
ssh_fails=$(grep -c "Failed password\|Invalid user\|authentication failure" \
  /var/log/auth.log 2>/dev/null || echo "0")
log "  Eventos de seguridad SSH: $ssh_fails"

# UFW via archivo de estado
ufw_active=$(grep -l "ufw" /var/log/syslog 2>/dev/null | wc -l || echo "0")
ufw_status="unknown"
if [ -f /etc/ufw/ufw.conf ]; then
  ufw_status=$(grep "^ENABLED=" /etc/ufw/ufw.conf 2>/dev/null | cut -d= -f2 || echo "unknown")
  log "  UFW habilitado: $ufw_status"
fi

# Sudo users
sudo_users=$(grep "^sudo:" /etc/group 2>/dev/null | cut -d: -f4 || echo "unknown")
log "  Usuarios con sudo: ${sudo_users:-ninguno}"

# Archivos SUID fuera de rutas estándar
suid_count=$(find /home /opt /tmp /var/tmp -perm -4000 2>/dev/null | wc -l || echo "0")
if [ "${suid_count:-0}" -gt 0 ] 2>/dev/null; then
  log "[WARN] $suid_count archivos SUID en rutas no estándar"
  add_note "$suid_count archivos SUID inesperados"
fi

log "[OK] Revisión de seguridad completada"
tasks_ok=$((tasks_ok+1))

# ── 6. MUESTRA DE CPU ──────────────────────────────────────────
log "[6/7] Registrando muestra de CPU..."
# Leer /proc/stat directamente (accesible via mount del host)
cpu_now=$(awk 'NR==1{
  idle=$5; total=0;
  for(i=2;i<=NF;i++) total+=$i;
  if(total>0) print int((1-idle/total)*100); else print 0
}' /proc/stat 2>/dev/null || echo "0")
cpu_now="${cpu_now:-0}"
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"cpu\":$cpu_now}" >> "$CPU_HISTORY_FILE"
tmp_cpu="${CPU_HISTORY_FILE}.tmp"
tail -720 "$CPU_HISTORY_FILE" > "$tmp_cpu" 2>/dev/null && mv "$tmp_cpu" "$CPU_HISTORY_FILE" || true
log "[OK] CPU actual: ${cpu_now}%"
tasks_ok=$((tasks_ok+1))

# ── 8. BACKUP ──────────────────────────────────────────────────
log "[7/7] Realizando backup de /etc..."
fecha=$(date +%Y%m%d_%H%M%S)
backup_file="$BACKUP_DEST/backup_${fecha}.tar.gz"
backup_size_mb=0
backup_filename=""
if tar -czf "$backup_file" /etc 2>/dev/null; then
  backup_size_mb=$(du -m "$backup_file" 2>/dev/null | cut -f1 || echo "0")
  backup_size_mb="${backup_size_mb:-0}"
  log "[OK] Backup creado: backup_${fecha}.tar.gz (${backup_size_mb} MB)"
  tasks_ok=$((tasks_ok+1))
  find "$BACKUP_DEST" -name "backup_*.tar.gz" -mtime +"$BACKUP_DAYS" -delete 2>/dev/null || true
  backup_filename="backup_${fecha}.tar.gz"
else
  log "[WARN] No se pudo crear backup"
  add_note "Backup falló"
  status="warn"
fi

# ── RESUMEN JSON ───────────────────────────────────────────────
ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

notes_json="[]"
if [ -n "$notes" ]; then
  notes_json="["
  first=1
  OLD_IFS="$IFS"; IFS='|'
  for note in $notes; do
    [ $first -eq 0 ] && notes_json="${notes_json},"
    notes_json="${notes_json}\"${note}\""
    first=0
  done
  IFS="$OLD_IFS"
  notes_json="${notes_json}]"
fi

[ "$tasks_ok" -lt "$tasks_total" ] && [ "$status" = "ok" ] && status="warn"

cat > "$RUNS_DIR/$run_id.json" <<EOF
{
  "id": "$run_id",
  "started_at": "$started_at",
  "ended_at": "$ended_at",
  "duration_seconds": 0,
  "tasks_total": $tasks_total,
  "tasks_ok": $tasks_ok,
  "status": "$status",
  "backup_file": "$backup_filename",
  "backup_size_mb": $backup_size_mb,
  "disk_percent": $disk_pct,
  "ssh_fails": ${ssh_fails:-0},
  "cpu_at_run": $cpu_now,
  "notes": $notes_json
}
EOF

log "[sentinel] ✅ Mantenimiento $status — $tasks_ok/$tasks_total OK → $run_id"
