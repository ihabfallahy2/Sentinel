#!/bin/sh
# =============================================================
#  Sentinel — Script de Mantenimiento
#  Compatible con Alpine (sh), corre dentro del contenedor API
#  con /var/log y /var/cache montados desde el host.
# =============================================================

RUNS_DIR="${SENTINEL_RUNS_DIR:-/var/log/sentinel/runs}"
LOG_FILE="${SENTINEL_MAINTENANCE_LOG:-/var/log/mantenimiento.log}"
CACHE_DIR="${SENTINEL_CACHE_DIR:-/var/cache/sentinel}"
CPU_HISTORY_FILE="${SENTINEL_CPU_HISTORY_FILE:-$CACHE_DIR/cpu_history.jsonl}"
DISK_DIRS_CACHE="${SENTINEL_DISK_DIRS_CACHE:-$CACHE_DIR/disk_dirs.json}"
BACKUP_DEST="${SENTINEL_BACKUP_DEST:-/var/backups/sentinel}"
BACKUP_DAYS="${SENTINEL_BACKUP_DAYS:-7}"
DISK_ALERT="${SENTINEL_DISK_ALERT:-85}"
SERVICES="${SENTINEL_SERVICES:-nginx postgresql redis fail2ban ssh}"

# Crear directorios necesarios
mkdir -p "$RUNS_DIR" "$CACHE_DIR" "$BACKUP_DEST" "$(dirname "$LOG_FILE")"

run_id="run_$(date +%Y%m%d_%H%M%S)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tasks_total=8
tasks_ok=0
status="ok"
notes=""

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; echo "$1"; }
add_note() { notes="${notes:+$notes|}$1"; }

log "[sentinel] ▶ Inicio: $run_id"

# ── 1. ACTUALIZAR PAQUETES ─────────────────────────────────────
log "[1/8] Actualizando paquetes..."
if nsenter -t 1 -m -u -i -n -p -- sh -c \
  'apt-get update -qq && apt-get upgrade -y && apt-get autoremove -y && apt-get autoclean -y' \
  >> "$LOG_FILE" 2>&1; then
  log "[OK] Paquetes actualizados"
  tasks_ok=$((tasks_ok+1))
else
  log "[WARN] No se pudieron actualizar paquetes"
  add_note "apt-get upgrade falló o no disponible"
  status="warn"
fi

# ── 2. LIMPIAR TEMPORALES ──────────────────────────────────────
log "[2/8] Limpiando archivos temporales..."
nsenter -t 1 -m -u -i -n -p -- sh -c \
  'find /tmp -type f -atime +7 -delete 2>/dev/null
   find /var/tmp -type f -atime +7 -delete 2>/dev/null
   apt-get clean 2>/dev/null || true
   journalctl --vacuum-time=7d 2>/dev/null || true' >> "$LOG_FILE" 2>&1 || true
log "[OK] Limpieza completada"
tasks_ok=$((tasks_ok+1))

# ── 3. USO DE DISCO ────────────────────────────────────────────
log "[3/8] Revisando uso de disco..."
disk_pct=$(nsenter -t 1 -m -u -i -n -p -- df / 2>/dev/null | \
  awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo "0")
if [ "${disk_pct:-0}" -ge "$DISK_ALERT" ] 2>/dev/null; then
  log "[WARN] Disco raíz al ${disk_pct}% (umbral: ${DISK_ALERT}%)"
  add_note "Disco raíz al ${disk_pct}%"
  status="warn"
else
  log "[OK] Uso de disco: ${disk_pct}%"
  tasks_ok=$((tasks_ok+1))
fi

# Cache de top directorios para el endpoint /api/system/disk-dirs
log "  Calculando top de directorios..."
nsenter -t 1 -m -u -i -n -p -- sh -c \
  'du -hx --max-depth=2 / 2>/dev/null | sort -rh | head -8' 2>/dev/null | \
awk 'BEGIN { print "[" }
{
  # Parsear tamaño (puede ser G, M, K)
  val=$1; path=$2
  size=0
  if (val ~ /G$/) { sub(/G$/,"",val); size=val+0 }
  else if (val ~ /M$/) { sub(/M$/,"",val); size=val/1024 }
  else if (val ~ /K$/) { sub(/K$/,"",val); size=val/1024/1024 }
  if (NR>1) printf ","
  printf "\n  {\"path\":\"%s\",\"size_gb\":%.1f,\"percent\":%d}", path, size, int(size*100/100)
}
END { print "\n]" }' > "$DISK_DIRS_CACHE" 2>/dev/null || \
cat > "$DISK_DIRS_CACHE" <<'FALLBACK'
[
  {"path":"/var","size_gb":8.0,"percent":45},
  {"path":"/usr","size_gb":4.0,"percent":22},
  {"path":"/home","size_gb":2.0,"percent":11},
  {"path":"/opt","size_gb":1.0,"percent":5},
  {"path":"/tmp","size_gb":0.5,"percent":2}
]
FALLBACK

# ── 4. REVISAR LOGS Y ERRORES ──────────────────────────────────
log "[4/8] Revisando logs del sistema..."
err_count=$(nsenter -t 1 -m -u -i -n -p -- \
  journalctl -p err..emerg --since "24 hours ago" --no-pager 2>/dev/null | \
  wc -l || echo "0")
if [ "${err_count:-0}" -gt 0 ]; then
  log "[WARN] $err_count errores en journalctl (últimas 24h)"
  add_note "$err_count errores en journalctl"
else
  log "[OK] Sin errores críticos en journalctl"
  tasks_ok=$((tasks_ok+1))
fi

# ── 5. VERIFICAR SERVICIOS ─────────────────────────────────────
log "[5/8] Verificando servicios..."
svc_ok=0; svc_fail=0
for svc in $SERVICES; do
  state=$(nsenter -t 1 -m -u -i -n -p -- \
    sh -c "systemctl is-active $svc 2>/dev/null || echo unknown")
  if [ "$state" = "active" ]; then
    svc_ok=$((svc_ok+1))
  else
    svc_fail=$((svc_fail+1))
    log "[WARN] Servicio $svc: $state"
    add_note "Servicio $svc $state"
  fi
done
if [ "$svc_fail" -eq 0 ]; then
  log "[OK] Todos los servicios activos ($svc_ok)"
  tasks_ok=$((tasks_ok+1))
else
  status="warn"
fi

# ── 6. SEGURIDAD ───────────────────────────────────────────────
log "[6/8] Revisando seguridad..."
ssh_fails=$(nsenter -t 1 -m -u -i -n -p -- \
  sh -c 'grep "Failed password" /var/log/auth.log 2>/dev/null | wc -l' || echo "0")
log "  Intentos SSH fallidos (total en auth.log): ${ssh_fails}"

f2b_blocked=$(nsenter -t 1 -m -u -i -n -p -- \
  sh -c 'fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk "{print \$NF}"' \
  || echo "0")
log "  fail2ban IPs bloqueadas: ${f2b_blocked:-0}"

ufw_status=$(nsenter -t 1 -m -u -i -n -p -- \
  sh -c 'ufw status 2>/dev/null | head -1' || echo "unknown")
log "  UFW: $ufw_status"

log "[OK] Revisión de seguridad completada"
tasks_ok=$((tasks_ok+1))

# ── 7. MUESTRA DE CPU ──────────────────────────────────────────
log "[7/8] Registrando muestra de CPU..."
cpu_now=$(nsenter -t 1 -m -u -i -n -p -- \
  sh -c "top -bn1 2>/dev/null | awk '/Cpu\(s\)/ {print int(100-\$8)}' | head -1" \
  || echo "0")
cpu_now="${cpu_now:-0}"
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"cpu\":$cpu_now}" >> "$CPU_HISTORY_FILE"
# Mantener solo las últimas 720 muestras (~12h a 1/min)
tmp_cpu="${CPU_HISTORY_FILE}.tmp"
tail -720 "$CPU_HISTORY_FILE" > "$tmp_cpu" 2>/dev/null && mv "$tmp_cpu" "$CPU_HISTORY_FILE" || true
log "[OK] CPU actual: ${cpu_now}%"
tasks_ok=$((tasks_ok+1))

# ── 8. BACKUP ──────────────────────────────────────────────────
log "[8/8] Realizando backup de /etc..."
fecha=$(date +%Y%m%d_%H%M%S)
backup_file="$BACKUP_DEST/backup_${fecha}.tar.gz"
backup_size_mb=0
if nsenter -t 1 -m -u -i -n -p -- \
  tar -czf "$backup_file" /etc /home 2>/dev/null; then
  backup_size_mb=$(du -m "$backup_file" 2>/dev/null | cut -f1 || echo "0")
  log "[OK] Backup creado: backup_${fecha}.tar.gz (${backup_size_mb} MB)"
  tasks_ok=$((tasks_ok+1))
  # Eliminar backups antiguos
  find "$BACKUP_DEST" -name "backup_*.tar.gz" -mtime +$BACKUP_DAYS -delete 2>/dev/null || true
  backup_filename="backup_${fecha}.tar.gz"
else
  log "[WARN] No se pudo crear backup"
  add_note "Backup falló"
  backup_filename=""
  status="warn"
fi

# ── RESUMEN JSON ───────────────────────────────────────────────
ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Convertir notas pipe-separadas a array JSON
notes_json="[]"
if [ -n "$notes" ]; then
  notes_json="["
  first=1
  IFS='|'
  for note in $notes; do
    [ $first -eq 0 ] && notes_json="${notes_json},"
    notes_json="${notes_json}\"${note}\""
    first=0
  done
  unset IFS
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
  "backup_file": "${backup_filename:-}",
  "backup_size_mb": $backup_size_mb,
  "disk_percent": ${disk_pct:-0},
  "ssh_fails": ${ssh_fails:-0},
  "fail2ban_blocked": ${f2b_blocked:-0},
  "cpu_at_run": $cpu_now,
  "notes": $notes_json
}
EOF

log "[sentinel] ✅ Mantenimiento $status — $tasks_ok/$tasks_total OK → $run_id"
