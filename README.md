# Sentinel

**Sentinel** es una plataforma **self-hosted** para desplegar y operar proyectos en un **homelab** (Linux + Docker), con una interfaz tipo **canvas** (React Flow). El alcance del producto está en `plan/sentinel_prd.md` y la especificación técnica en `plan/sentinel_tech.md`. Diagramas: `plan/sentinel_diagrams.html`.

---

## Funcionalidad (alineada al plan)

| Área | Estado |
|------|--------|
| Monorepo **pnpm** (`apps/ui`, `apps/api`, `packages/shared-types`) | Listo |
| API **Fastify 5**, API key (`x-api-key` o `apiKey` en query para SSE) | Listo |
| Proyectos: clone Git (`simple-git`, depth 40), CRUD, `pull` opcional en deploy | Listo |
| Deploy / rollback, historial **deployments** en JSON | Listo |
| Docker Compose: up, start/stop/restart/rebuild, logs SSE, `docker ps` estado | Listo |
| `.env` lectura/escritura y diff con `.env.example` | Listo |
| Scripts `.sh/.py/.js` (sync + SSE stream) | Listo |
| **Workflows** secuenciales (REST / script / docker) vía SSE | Listo |
| Sistema: CPU/RAM/disco (`systeminformation`), listado contenedores `docker ps` | Listo |
| GitHub: `GET /api/github/repos` con `GITHUB_TOKEN` | Listo |
| `POST /api/widgets/execute` (REST, docker, script desde la API) | Listo |
| Canvas persistido por proyecto + export/import JSON | Listo |
| UI: **React Router**, **TanStack Query**, **Sonner**, nodos para todos los widgets del PRD | Listo (MVP) |
| **Docker Compose stack**: UI nginx proxifica `/api` → API (mismo origen) | Listo |
| shadcn/ui, Recharts, node-pty, plugin widgets “terceros” | No incluidos (opcional / futuro) |

Guía para el asistente: **`CURSOR.md`**.

---

## Requisitos

- Node.js 20+, pnpm 9 (`corepack enable`)
- En el host de la API: **git**, **Docker** + **Compose v2**
- Opcional: `GITHUB_TOKEN` para listar repos en la pizarra global

---

## Desarrollo local

```bash
cp .env.example .env
```

Misma clave en `SENTINEL_API_KEY` y `VITE_API_KEY`. Para la UI, `VITE_API_URL=http://localhost:3500` o vacío usando el proxy de Vite (`/api` → `3500`).

```powershell
$env:SENTINEL_API_KEY="dev"; $env:SENTINEL_DATA_DIR="./data"; $env:SENTINEL_PROJECTS_DIR="./projects"; pnpm dev:api
$env:VITE_API_KEY="dev"; pnpm dev:ui
```

- **Global**: `http://localhost:5173/` — alta de proyectos, enlaces al canvas.
- **Proyecto**: `http://localhost:5173/p/<uuid>` — canvas con widgets (se guarda solo en el JSON de datos).

---

## Docker en servidor

```bash
docker compose up --build
```

- API: **3500**
- UI: **4000** (nginx; **`VITE_API_URL` vacío por defecto** para que el navegador llame a `/api` del mismo host).

Variables importantes: `SENTINEL_API_KEY`, `SENTINEL_DATA_DIR`, `SENTINEL_PROJECTS_DIR`, volúmenes en `docker-compose.yml`, y opcionalmente `GITHUB_TOKEN` en el servicio API.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev:api` | API (tsx watch) |
| `pnpm dev:ui` | UI (Vite) |
| `pnpm build` | Compila tipos, API y UI |

---

## Documentación

- `plan/sentinel_prd.md` — PRD  
- `plan/sentinel_tech.md` — especificación  
- `CURSOR.md` — convenciones y fases

---

## Contribuir

Mantén la lógica en `apps/api/src/services/`, la UI hablando solo con `apps/ui/src/api/sentinelClient.ts`, y los contratos en `packages/shared-types`.
