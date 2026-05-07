# Sentinel — Sistema Screen: UI Implementation Guide

## Overview

Replace the current `Sistema` screen with a full monitoring dashboard. The design follows the existing Sentinel dark aesthetic: dark backgrounds, card-based layout, monospace for values, and semantic color badges.

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header: title + status badge + last run + "Run now" btn│
├──────────┬──────────┬──────────┬───────────────────────┤
│ CPU card │ RAM card │Disk card │    Uptime card         │
├──────────┴──────────┴──────────┴───────────────────────┤
│  Tab bar: Resumen | Ejecuciones | Logs | Seguridad      │
├─────────────────────────────────────────────────────────┤
│  Tab content (see each tab below)                       │
└─────────────────────────────────────────────────────────┘
```

---

## Metric Cards (top row)

Four cards in a 4-column grid. Each card shows:
- Small uppercase label (11px, muted)
- Large value (22px, weight 500)
- Thin progress bar colored by threshold
- Subtitle with context

### Thresholds for bar colors
| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| CPU    | < 60% | 60–80% | > 80% |
| RAM    | < 70% | 70–90% | > 90% |
| Disk   | < 70% | 70–85% | > 85% |

CPU value animates every 3 seconds with live polling. Uptime card shows a live clock (updates every second).

---

## Tab: Resumen

Two rows of 2-column grids.

### Row 1
**Servicios card** — list of system services with status dot + badge:
- Green dot + `activo` badge (success colors)
- Yellow dot + `alto uso` badge (warning colors)  
- Red dot + `inactivo` badge (danger colors)

Services to monitor: `nginx`, `postgresql`, `redis`, `fail2ban`, `smtp` (or whatever is relevant to the server).

**CPU últimas 12h card** — Chart.js line chart, 12 data points (one per hour), filled area, no legend. Y-axis 0–100 with `%` suffix. X-axis shows hours in `H:00` format.

### Row 2
**Top dirs card** — list of top 5 directories by size. Each row has:
- Monospace dir name (left) + size string (right)
- Thin progress bar showing % of total disk

**Red card** — key/value rows showing:
- Public IP
- DNS latency (ms) with badge
- Active connections (count)
- Open ports (comma-separated)
- RX / TX today (GB)

---

## Tab: Ejecuciones

Single full-width card with a list of past maintenance runs.

Each row contains (left to right):
- Status badge (`Completado` / `Advertencias` / `Error`)
- Date + time (`DD mmm · HH:MM`)
- Duration with clock icon
- Tasks completed (`N/N`)
- Backup filename in monospace (right-aligned)

Data comes from `GET /api/maintenance/runs`.

---

## Tab: Logs

Single full-width card with:
- Header row: title left, filter select (`Todos / Errores / Advertencias / OK`) + refresh button right
- Scrollable list (max-height ~320px) of log lines

Each log line:
- Monospace timestamp (left, min-width 80px, muted)
- Level icon (circle-check / alert-triangle / alert-circle / info-circle)
- Message text
- Background tinted by level (danger / warning / success / transparent)

Filter is client-side — all logs are fetched at once, filtered in JS.

Data comes from `GET /api/logs?level=all`.

---

## Tab: Seguridad

Two cards in a 2-column grid, then one full-width card.

**Estado de seguridad card** — key/value rows:
- Security updates status
- fail2ban blocked IPs count
- Sudo users count
- Unexpected SUID files
- UFW firewall status

**Intentos SSH card** — Chart.js bar chart, 24 bars (one per hour), red color, no legend. Shows failed SSH login attempts per hour.

**S.M.A.R.T. card** (full width) — one row per disk device:
- Device name + capacity + type (left)
- SMART result badge: `PASSED` (success) or `FAILED` (danger) + wear/temp info

Data comes from `GET /api/security/status` and `GET /api/security/ssh-attempts`.

---

## Polling Strategy

| Data | Interval |
|------|----------|
| CPU, RAM, Disk, Uptime | every 5 seconds |
| Services | every 30 seconds |
| Network stats | every 30 seconds |
| Logs | on tab open + manual refresh |
| Maintenance runs | on tab open |
| Security status | on tab open |

Use `setInterval` for live metrics. For tabs, fetch on first open and cache until manual refresh.

---

## "Run Now" Button

Calls `POST /api/maintenance/run`. While running:
- Button becomes disabled with a spinner icon
- A toast/notification appears: "Mantenimiento en curso…"
- On completion, refresh the Ejecuciones tab and Logs tab automatically

---

## Color & Badge Reference

```
badge-ok    → background: success-bg,  color: success-text
badge-warn  → background: warning-bg,  color: warning-text
badge-err   → background: danger-bg,   color: danger-text
badge-info  → background: info-bg,     color: info-text

dot-ok   → #1D9E75
dot-warn → #BA7517
dot-err  → #E24B4A
```

Use your existing Sentinel CSS variables for all colors so dark/light mode is inherited automatically.
