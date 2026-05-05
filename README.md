# Sentinel

**Sentinel** es una plataforma **self-hosted** para desplegar y operar proyectos en un **homelab** (Linux + Docker), con una interfaz tipo **canvas** (React Flow). Sustituye el enfoque anterior centrado en Java/Spring y monitoreo batch de repositorios públicos: el producto objetivo está definido en `plan/sentinel_prd.md` y la especificación técnica en `plan/sentinel_tech.md`.

Diagramas de arquitectura: `plan/sentinel_diagrams.html`.

---

## Qué incluye esta rama (`feature/sentinel-monorepo`)

| Área | Estado |
|------|--------|
| Monorepo **pnpm** (`apps/ui`, `apps/api`, `packages/shared-types`) | Listo |
| API **Fastify 5**: `GET /health`, `GET /api/projects`, API key `x-api-key` | Listo (MVP) |
| Persistencia JSON en `SENTINEL_DATA_DIR` | Listo (MVP) |
| UI **Vite + React + React Flow + Tailwind + Zustand**, proxy `/api` en dev | Listo (MVP) |
| `POST /api/projects` (clone Git), `GET/DELETE /api/projects/:id` | Listo (MVP) |
| `POST /api/projects/:id/deploy` (`docker compose up -d --build`) | Listo (requiere Docker en el host) |
| SSE `GET /api/projects/:id/logs/stream` (`docker compose logs -f`) | Listo |
| Widgets canvas `deploy_card` y `log_stream` | Listo (primer proyecto) |
| Caso Dynamoss, más widgets, GitHub privado avanzado | Pendiente (ver `CURSOR.md`) |

Guía de desarrollo para el asistente y convenciones: **`CURSOR.md`**.

---

## Requisitos

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9](https://pnpm.io/) (`corepack enable` recomendado)
- (Opcional) Docker para `docker compose up`

---

## Configuración rápida

```bash
cp .env.example .env
```

Rellena la misma clave en `SENTINEL_API_KEY` (API) y `VITE_API_KEY` (UI). Para desarrollo local, la UI puede usar `VITE_API_URL=http://localhost:3500` o dejarla vacía y usar el proxy de Vite hacia el puerto 3500.

**API** (desde la raíz del repo):

```bash
# PowerShell
$env:SENTINEL_API_KEY="dev"; $env:SENTINEL_DATA_DIR="./data"; pnpm dev:api
```

**UI**:

```bash
$env:VITE_API_KEY="dev"; pnpm dev:ui
```

Abre la UI (por defecto `http://localhost:5173`). Puedes **añadir un repo** (necesitas `git` en el PATH). **Deploy** y **logs en vivo** llaman a `docker compose` en el directorio clonado: hace falta **Docker Engine + plugin Compose** en la máquina donde corre la API (en Windows, suele funcionar si `docker` está en el PATH).

---

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev:api` | API en modo desarrollo (tsx watch) |
| `pnpm dev:ui` | UI con Vite |
| `pnpm build` | Compila `shared-types`, API y UI |

---

## Docker

Desde la raíz (ajusta variables en `.env` o en el entorno):

```bash
docker compose up --build
```

- API: puerto **3500**
- UI (nginx): puerto **4000**

La imagen de la UI recibe `VITE_API_URL` y `VITE_API_KEY` en **tiempo de build** (args en `docker-compose.yml`).

---

## Documentación del producto

- **PRD**: `plan/sentinel_prd.md`
- **Especificación técnica**: `plan/sentinel_tech.md`
- **Guía Cursor / fases**: `CURSOR.md`

---

## Contribuir

Las fases y el alcance siguen el PRD. Las PRs pequeñas alineadas con `CURSOR.md` (servicios en `apps/api/src/services/`, cliente HTTP único en la UI, tipos compartidos en `packages/shared-types`) son las más fáciles de revisar.
