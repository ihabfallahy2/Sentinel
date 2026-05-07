#!/bin/bash
# =============================================================
#  Sentinel — Script de Mantenimiento Completo
#  Ubuntu / Debian
#  Escribe un JSON de resumen en /var/log/sentinel/runs/
#  Compatible con la API REST de Sentinel
# =============================================================

# ── Configuración ─────────────────────────────────────────────
BACKUP_SRC="/etc /home"
BACKUP_DEST="/backup"
BACKUP_DAYS=7
DISK_ALERT=85
SERVICES="nginx postgresql redis fail2ban smtp"
LOG_FILE="/var/log/mantenimiento.log"
SENTINEL_RUNS_DIR="/var/log/sentinel/runs"
SENTINEL_CACHE_DIR="/var/cache/sentinel"
SMART_DEVICES="/dev/sda /dev/sdb"
CPU_HISTORY_FILE="$SENTINEL_CACHE_DIR/cpu_history.jsonl"
DISK_DIRS_CACHE="$SENTINEL_CACHE_DIR/disk_dirs.json"
# ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; YELLOW='\033[1;33m'
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

RUN_ID="run_$(date '+%Y%m%d_%H%M%S')"
STARTED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
TASKS_TOTAL=10
TASKS_OK=0
NOTES=()
STATUS="ok"

log() { echo -e "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"; }
sep()  { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
warn() { NOTES+=("$1"); STATUS="warn"; log "${YELLOW}⚠ $1${NC}"; }
fail() { NOTES+=("$1"); STATUS="err";  log "${RED}✖ $1${NC}"; }
ok()   { TASKS_OK=$((TASKS_OK+1)); log "${GREEN}✔ $1${NC}"; }

if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}✖ Debe ejecutarse como root.${NC}"; exit 1
fi

mkdir -p "$BACKUP_DEST" "$SENTINEL_RUNS_DIR" "$SENTINEL_CACHE_DIR"
log "${GREEN}▶ Inicio: $RUN_ID${NC}"
sep

# ── 1. ACTUALIZAR PAQUETES ─────────────────────────────────────
log "${CYAN}[1/10] Actualizando paquetes...${NC}"
if apt-get update -qq && apt-get upgrade -y && apt-get dist-upgrade -y \
   && apt-get autoremove -y && apt-get autoclean -y; then
  ok "Paquetes actualizados"
else
  fail "Error al actualizar paquetes"
fi
sep

# ── 2. LIMPIAR TEMPORALES Y CACHÉ ─────────────────────────────
log "${CYAN}[2/10] Limpiando archivos temporales...${NC}"
find /tmp -type f -atime +7 -delete 2>/dev/null
find /var/tmp -type f -atime +7 -delete 2>/dev/null
apt-get clean
journalctl --vacuum-time=7d 2>/dev/null
find /home/*/.cache/thumbnails -type f -delete 2>/dev/null
ok "Limpieza de temporales y caché completada"
sep

# ── 3. REVISAR USO DE DISCO ────────────────────────────────────
log "${CYAN}[3/10] Revisando uso de disco...${NC}"
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [[ $DISK_PCT -ge $DISK_ALERT ]]; then
  warn "Disco raíz al ${DISK_PCT}% (umbral: ${DISK_ALERT}%)"
else
  ok "Uso de disco: ${DISK_PCT}%"
fi

# Cache del top de directorios (usado por el endpoint /api/system/disk-dirs)
log "  Calculando top de directorios (puede tardar)..."
du -hx --max-depth=2 / 2>/dev/null | sort -rh | head -10 | \
awk 'BEGIN{print "["} {
  split($1, a, "G"); pct=int(a[1]*100/total)+1
  printf "  {\"path\":\"%s\",\"size_gb\":%s,\"percent\":%d}", $2, a[1], pct
  if (NR<10) printf ","
  printf "\n"
} END{print "]"}' > "$DISK_DIRS_CACHE"
sep

# ── 4. REVISAR LOGS Y ERRORES ──────────────────────────────────
log "${CYAN}[4/10] Revisando logs del sistema...${NC}"
ERR_COUNT=$(journalctl -p err..emerg --since "24 hours ago" --no-pager 2>/dev/null | wc -l)
if [[ $ERR_COUNT -gt 0 ]]; then
  warn "Se encontraron $ERR_COUNT errores en journalctl (últimas 24h)"
else
  ok "Sin errores críticos en journalctl"
fi
sep

# ── 5. VERIFICAR SERVICIOS ─────────────────────────────────────
log "${CYAN}[5/10] Verificando servicios...${NC}"
SVC_FAILED=()
for SVC in $SERVICES; do
  STATE=$(systemctl is-active "$SVC" 2>/dev/null)
  if [[ "$STATE" != "active" ]]; then
    SVC_FAILED+=("$SVC ($STATE)")
    warn "Servicio $SVC está $STATE"
  fi
done
[[ ${#SVC_FAILED[@]} -eq 0 ]] && ok "Todos los servicios activos"
sep

# ── 6. SEGURIDAD: FAIL2BAN Y SSH ──────────────────────────────
log "${CYAN}[6/10] Revisando seguridad SSH y fail2ban...${NC}"
SSH_FAILS=$(grep "Failed password" /var/log/auth.log 2>/dev/null | \
  grep "$(date '+%b %e')" | wc -l)
[[ $SSH_FAILS -gt 50 ]] && warn "$SSH_FAILS intentos SSH fallidos hoy" \
                         || log "  Intentos SSH fallidos hoy: $SSH_FAILS"

F2B_BLOCKED=0
if systemctl is-active fail2ban &>/dev/null; then
  F2B_BLOCKED=$(fail2ban-client status sshd 2>/dev/null | \
    grep "Currently banned" | awk '{print $NF}' || echo 0)
  log "  fail2ban IPs bloqueadas: $F2B_BLOCKED"
fi

# SUID inesperados
SUID_UNEXPECTED=$(find / -perm -4000 \
  -not -path "/usr/*" -not -path "/bin/*" \
  -not -path "/sbin/*" 2>/dev/null | wc -l)
[[ $SUID_UNEXPECTED -gt 0 ]] && warn "$SUID_UNEXPECTED archivos SUID inesperados"

ok "Revisión de seguridad completada"
sep

# ── 7. SALUD DE DISCOS (S.M.A.R.T.) ──────────────────────────
log "${CYAN}[7/10] Comprobando salud S.M.A.R.T. de discos...${NC}"
if command -v smartctl &>/dev/null; then
  for DEV in $SMART_DEVICES; do
    [[ ! -b $DEV ]] && continue
    SMART_RES=$(smartctl -H "$DEV" 2>/dev/null | grep "test result")
    if echo "$SMART_RES" | grep -qi "PASSED"; then
      TEMP=$(smartctl -A "$DEV" 2>/dev/null | \
        awk '/Temperature_Celsius/{print $10}')
      [[ -n $TEMP && $TEMP -gt 45 ]] && \
        warn "$DEV temperatura alta: ${TEMP}°C" || \
        log "  $DEV: PASSED${TEMP:+ · ${TEMP}°C}"
    else
      fail "$DEV: SMART FAILED — revisar inmediatamente"
    fi
  done
  ok "Revisión S.M.A.R.T. completada"
else
  warn "smartmontools no instalado — omitiendo S.M.A.R.T."
fi
sep

# ── 8. RED: CONECTIVIDAD Y PUERTOS ────────────────────────────
log "${CYAN}[8/10] Verificando red...${NC}"
if ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
  DNS_MS=$(dig @8.8.8.8 google.com 2>/dev/null | \
    grep "Query time" | awk '{print $4}')
  log "  Conectividad OK · Latencia DNS: ${DNS_MS}ms"
  ok "Red operativa"
else
  fail "Sin conectividad a internet"
fi
OPEN_PORTS=$(ss -tlnp 2>/dev/null | awk 'NR>1 {print $4}' | \
  cut -d: -f2 | sort -un | tr '\n' ',' | sed 's/,$//')
log "  Puertos abiertos: $OPEN_PORTS"
sep

# ── 9. SAMPLE CPU (para historial) ────────────────────────────
log "${CYAN}[9/10] Registrando muestra de CPU...${NC}"
CPU_NOW=$(top -bn1 2>/dev/null | grep "Cpu(s)" | \
  awk '{print 100 - $8}' | cut -d. -f1)
echo "{\"ts\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\",\"cpu\":${CPU_NOW:-0}}" \
  >> "$CPU_HISTORY_FILE"
# Mantener solo las últimas 720 líneas (12h a 1 muestra/min)
tail -720 "$CPU_HISTORY_FILE" > "${CPU_HISTORY_FILE}.tmp" && \
  mv "${CPU_HISTORY_FILE}.tmp" "$CPU_HISTORY_FILE"
ok "Muestra de CPU registrada: ${CPU_NOW}%"
sep

# ── 10. BACKUP ─────────────────────────────────────────────────
log "${CYAN}[10/10] Realizando backup...${NC}"
FECHA=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DEST/backup_${FECHA}.tar.gz"
if tar -czf "$BACKUP_FILE" $BACKUP_SRC 2>/dev/null; then
  BACKUP_SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
  ok "Backup creado: backup_${FECHA}.tar.gz (${BACKUP_SIZE_MB} MB)"
else
  fail "Error al crear el backup"
  BACKUP_FILE=""
  BACKUP_SIZE_MB=0
fi
find "$BACKUP_DEST" -name "backup_*.tar.gz" -mtime +$BACKUP_DAYS -delete
sep

# ── RESUMEN FINAL + JSON para la API ──────────────────────────
ENDED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
STARTED_TS=$(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s)
ENDED_TS=$(date +%s)
DURATION=$((ENDED_TS - STARTED_TS))

[[ $TASKS_OK -lt $TASKS_TOTAL && "$STATUS" == "ok" ]] && STATUS="warn"

# Serializar notas como array JSON
NOTES_JSON="[]"
if [[ ${#NOTES[@]} -gt 0 ]]; then
  NOTES_JSON="["
  for i in "${!NOTES[@]}"; do
    NOTES_JSON+="\"${NOTES[$i]}\""
    [[ $i -lt $((${#NOTES[@]}-1)) ]] && NOTES_JSON+=","
  done
  NOTES_JSON+="]"
fi

BACKUP_FILENAME=""
[[ -n $BACKUP_FILE ]] && BACKUP_FILENAME="backup_${FECHA}.tar.gz"

cat > "$SENTINEL_RUNS_DIR/${RUN_ID}.json" <<EOF
{
  "id": "$RUN_ID",
  "started_at": "$STARTED_AT",
  "ended_at": "$ENDED_AT",
  "duration_seconds": $DURATION,
  "tasks_total": $TASKS_TOTAL,
  "tasks_ok": $TASKS_OK,
  "status": "$STATUS",
  "backup_file": "$BACKUP_FILENAME",
  "backup_size_mb": $BACKUP_SIZE_MB,
  "open_ports": "$OPEN_PORTS",
  "disk_percent": $DISK_PCT,
  "ssh_fails_today": $SSH_FAILS,
  "fail2ban_blocked": $F2B_BLOCKED,
  "cpu_at_run": ${CPU_NOW:-0},
  "notes": $NOTES_JSON
}
EOF

log "${GREEN}✅ Mantenimiento $STATUS — $TASKS_OK/$TASKS_TOTAL tareas OK${NC}"
log "   Duración: ${DURATION}s · Resumen: $SENTINEL_RUNS_DIR/${RUN_ID}.json"
sep
