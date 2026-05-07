# Sentinel Sistema — API Endpoints Specification

All endpoints are prefixed with `/api`. All responses are JSON. All endpoints require authentication (use your existing Sentinel auth middleware).

---

## GET /api/system/metrics

Returns live system metrics: CPU, RAM, disk and uptime.

**Response**
```json
{
  "cpu": {
    "percent": 23.0,
    "cores": 4
  },
  "ram": {
    "used_gb": 14.0,
    "total_gb": 14.6,
    "percent": 95.9
  },
  "disk": {
    "used_gb": 85.9,
    "total_gb": 97.9,
    "percent": 87.7
  },
  "uptime": {
    "seconds": 2001600,
    "human": "23d 4h"
  }
}
```

**How to collect on the server**

```bash
# CPU percent (1s sample)
top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}'

# RAM
free -g | awk '/Mem:/ {print $3, $2}'

# Disk (root partition)
df -h / | awk 'NR==2 {print $3, $2, $5}'

# Uptime in seconds
awk '{print int($1)}' /proc/uptime
```

---

## GET /api/system/services

Returns the status of monitored system services.

**Response**
```json
{
  "services": [
    { "name": "nginx",      "status": "active",   "level": "ok" },
    { "name": "postgresql", "status": "active",   "level": "ok" },
    { "name": "redis",      "status": "active",   "level": "warn", "note": "alto uso de memoria" },
    { "name": "fail2ban",   "status": "active",   "level": "ok" },
    { "name": "smtp",       "status": "inactive", "level": "err" }
  ]
}
```

**`level` values:** `ok` · `warn` · `err`

**How to collect on the server**

```bash
systemctl is-active nginx
# Returns: active | inactive | failed
```

Define the list of services to monitor in a config file on the backend so it can be changed without touching code.

---

## GET /api/system/network

Returns network interface statistics.

**Response**
```json
{
  "public_ip": "185.234.XX.XX",
  "dns_latency_ms": 12,
  "active_connections": 47,
  "open_ports": [22, 80, 443, 5432],
  "rx_today_gb": 2.3,
  "tx_today_gb": 0.9
}
```

**How to collect on the server**

```bash
# Public IP
curl -s https://api.ipify.org

# DNS latency
dig @8.8.8.8 google.com | grep "Query time" | awk '{print $4}'

# Active connections
ss -s | grep estab | awk '{print $4}'

# Open ports
ss -tlnp | awk 'NR>1 {print $4}' | cut -d: -f2 | sort -un

# RX/TX (since boot, calculate daily delta on the backend)
cat /proc/net/dev
```

---

## GET /api/system/cpu-history

Returns CPU usage for the last 12 hours, one data point per hour.

**Response**
```json
{
  "labels": ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"],
  "values": [18, 22, 35, 45, 28, 23, 19, 31, 27, 23, 20, 23]
}
```

Store CPU samples every minute in a lightweight SQLite or flat file on the server. The endpoint averages them per hour and returns the last 12 buckets.

---

## GET /api/system/disk-dirs

Returns the top directories by size.

**Response**
```json
{
  "dirs": [
    { "path": "/var",  "size_gb": 38.2, "percent": 39 },
    { "path": "/home", "size_gb": 27.1, "percent": 28 },
    { "path": "/usr",  "size_gb": 14.4, "percent": 15 },
    { "path": "/opt",  "size_gb": 6.3,  "percent": 6  },
    { "path": "/tmp",  "size_gb": 1.2,  "percent": 1  }
  ]
}
```

**How to collect on the server**

```bash
du -hx --max-depth=2 / 2>/dev/null | sort -rh | head -10
```

This is slow — run it inside the maintenance script and cache the result in a JSON file. The endpoint just reads the cached file.

---

## GET /api/maintenance/runs

Returns the history of past maintenance script executions.

**Response**
```json
{
  "runs": [
    {
      "id": "run_20260507_020000",
      "started_at": "2026-05-07T02:00:00Z",
      "duration_seconds": 222,
      "tasks_total": 5,
      "tasks_ok": 5,
      "status": "ok",
      "backup_file": "backup_20260507_020000.tar.gz",
      "backup_size_mb": 1228,
      "notes": []
    },
    {
      "id": "run_20260423_020000",
      "started_at": "2026-04-23T02:00:00Z",
      "duration_seconds": 238,
      "tasks_total": 5,
      "tasks_ok": 4,
      "status": "warn",
      "backup_file": "backup_20260423_020000.tar.gz",
      "backup_size_mb": 1190,
      "notes": ["Partición /var al 88%"]
    }
  ]
}
```

**`status` values:** `ok` · `warn` · `err`

The maintenance script writes a JSON summary file after each run. The endpoint reads all summary files from `/var/log/sentinel/runs/` and returns them sorted by date descending.

---

## POST /api/maintenance/run

Triggers an immediate maintenance run.

**Request body:** none

**Response (202 Accepted)**
```json
{
  "run_id": "run_20260507_143200",
  "message": "Mantenimiento iniciado",
  "started_at": "2026-05-07T14:32:00Z"
}
```

The backend spawns the maintenance script as a background process (`subprocess` in Python / `child_process` in Node). It does not wait for it to finish. The frontend polls `GET /api/maintenance/runs` every 5 seconds until the new `run_id` appears with a final status.

---

## GET /api/logs

Returns system log lines, optionally filtered by level.

**Query params**
| Param | Values | Default |
|-------|--------|---------|
| `level` | `all`, `err`, `warn`, `ok`, `info` | `all` |
| `limit` | integer | `100` |

**Response**
```json
{
  "logs": [
    {
      "time": "02:03:41",
      "level": "ok",
      "message": "Mantenimiento completado sin errores críticos"
    },
    {
      "time": "02:00:58",
      "level": "err",
      "message": "Servicio smtp inactivo — no se pudo iniciar"
    }
  ]
}
```

**`level` values:** `ok` · `warn` · `err` · `info`

Source: parse `/var/log/mantenimiento.log` + `journalctl -p err..warning --no-pager --since "24 hours ago"`. Merge and sort by timestamp descending.

---

## GET /api/security/status

Returns the overall security posture.

**Response**
```json
{
  "security_updates_pending": 0,
  "fail2ban_blocked_ips": 14,
  "sudo_users": ["root", "adminuser"],
  "sudo_users_count": 2,
  "unexpected_suid_files": [],
  "ufw_active": true,
  "disks": [
    {
      "device": "/dev/sda",
      "capacity": "500 GB",
      "type": "SSD",
      "smart_status": "PASSED",
      "wear_percent": 12,
      "temperature_c": null
    },
    {
      "device": "/dev/sdb",
      "capacity": "2 TB",
      "type": "HDD",
      "smart_status": "PASSED",
      "wear_percent": null,
      "temperature_c": 42
    }
  ]
}
```

**How to collect on the server**

```bash
# Pending security updates
apt-get -s upgrade | grep -i security | wc -l

# fail2ban blocked IPs
fail2ban-client status sshd | grep "Currently banned" | awk '{print $NF}'

# Sudo users
grep -Po '^sudo.+:\K.*$' /etc/group | tr ',' '\n'

# Unexpected SUID files
find / -perm -4000 -not -path "/usr/*" -not -path "/bin/*" 2>/dev/null

# UFW status
ufw status | grep -i active

# SMART (requires smartmontools)
smartctl -H /dev/sda | grep "test result"
smartctl -A /dev/sda | grep -E "Wear|Temperature"
```

---

## GET /api/security/ssh-attempts

Returns failed SSH login attempts grouped by hour for the last 24 hours.

**Response**
```json
{
  "labels": ["00:00","01:00","02:00","...","23:00"],
  "values": [2, 0, 3, 1, 0, 4, 8, 18, 12, 6, 3, 1, 0, 2, 5, 14, 11, 3, 0, 1, 2, 4, 7, 9]
}
```

**How to collect on the server**

```bash
grep "Failed password" /var/log/auth.log | \
  awk '{print $3}' | cut -d: -f1 | sort | uniq -c
```

Parse and bucket by hour on the backend.

---

## Suggested Backend Stack

This API can be implemented in whatever language Sentinel's backend uses. A minimal example in **Python (FastAPI)** or **Node.js (Express)** works well. Key points:

- Run heavy commands (`du`, `smartctl`, `du`) in async subprocesses, not blocking the request.
- Cache slow results (`disk-dirs`, `security/status`) in memory or a file, refreshed every 5 minutes by a background task.
- The maintenance script writes its own JSON run summary — the API just reads files, no DB needed for runs.
- Store CPU samples in a simple append-only file or SQLite for the history chart.
