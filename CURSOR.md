# CURSOR.md — Sentinel Development Guide

Este archivo le indica a Cursor cómo está estructurado el proyecto y cómo debe ayudar en el desarrollo.

---

## Estado actual del repositorio (implementación)

- Monorepo **pnpm** con `apps/ui`, `apps/api`, `packages/shared-types` (ver `README.md`).
- API **Fastify 5**: rutas del PRD (proyectos, deployments, rollback, docker, env, scripts, workflows SSE, system, GitHub, widgets, canvas persistido). Auth `x-api-key` / `apiKey` (SSE).
- Servicios: **GitService** (clone depth 40, pull, checkout), **DockerService** (compose), **EnvService**, **ScriptService** (bash/python/node), **SystemService** (systeminformation + `docker ps` JSON).
- Persistencia JSON (`store.ts`): proyectos, deployments, layouts de canvas.
- UI: **Vite + React 18 + React Flow + Tailwind**, **React Router** (`/` global, `/p/:id` proyecto), **TanStack Query**, **Sonner**. Nodos widget en `src/canvas/nodes/` + plantilla por defecto en `buildDefaultNodes.ts`. Auto-guardado de canvas y export/import JSON.
- Docker UI: nginx proxifica `/api` al contenedor API (mismo origen; `VITE_API_URL` vacío en build por defecto).
- **No** incluido a propósito (opcional más adelante): shadcn/ui, Recharts, node-pty, `dockerode`, notificaciones push complejas; validar **Dynamoss** en tu servidor es el siguiente paso operativo, no de código base.

---

## Qué es Sentinel

Sentinel es una plataforma de despliegue y operaciones personal (self-hosted) para homelab. Funciona como un Railway/Coolify privado con una interfaz visual tipo canvas donde el usuario puede:

- Desplegar cualquier repo de GitHub en su servidor Linux
- Gestionar variables de entorno por proyecto
- Ejecutar scripts, comandos Docker y endpoints REST desde widgets arrastrables
- Ver logs en tiempo real y el estado de servicios
- Construir workflows visuales multi-paso con estado por nodo

---

## Estructura del monorepo

```
sentinel/
├── apps/
│   ├── ui/          ← React + Vite (frontend)
│   └── api/         ← Node.js + Fastify (backend / agente Linux)
├── packages/
│   └── shared-types/ ← tipos TypeScript compartidos UI ↔ API
├── package.json      ← pnpm workspaces
├── plan/             ← PRD, spec técnica, diagramas
└── CURSOR.md         ← este archivo
```

---

## Stack UI (`apps/ui`)

- React 18 + Vite 5 + TypeScript strict
- `@xyflow/react` — canvas con dot grid, nodos arrastrables, zoom/pan
- `@tanstack/react-query` — fetching, caché y polling
- `tailwindcss` — estilos (sin shadcn en este repo)
- `sonner` — toasts

### Reglas UI

- Toda comunicación con la API pasa por `src/api/sentinelClient.ts` — nunca `fetch` directo en componentes
- Los widgets son nodos de React Flow en `src/canvas/nodes/`
- Un archivo por tipo de widget
- Los hooks de datos viven en `src/hooks/` — los componentes los consumen, no los crean
- Canvas: estado con `useNodesState` / `useEdgesState` dentro de `ReactFlowProvider` (`pages/ProjectBoard.tsx`)

---

## Stack API (`apps/api`)

- Node.js 20 LTS + **Fastify 5** + TypeScript strict
- `simple-git` — clone, pull, checkout
- `@octokit/rest` — listado de repos (`GITHUB_TOKEN`)
- Scripts: `child_process` (bash / python3 / node) en lugar de `node-pty`
- Docker: CLI `docker compose` / `docker ps` (no `dockerode` en este repo)
- Persistencia JSON en disco (`store.ts`; equivalente a `lowdb` en la spec)
- `zod` — validación de todos los inputs *(en rutas nuevas)*

### Reglas API

- Toda la lógica de negocio vive en `src/services/` — las rutas solo validan y delegan
- Validación de inputs con zod en cada ruta antes de pasarlos al service
- SSE para streaming: logs de Docker, output de scripts, eventos de workflow
- API key obligatoria en cada request (header `x-api-key`)
- Sin base de datos externa — JSON local

---

## Tipos de widget

Cada widget es un nodo de React Flow. Todos comparten esta interfaz base:

```ts
// packages/shared-types/src/widget.ts
export type WidgetStatus = 'idle' | 'running' | 'success' | 'error'

export interface BaseWidget {
  id: string
  type: WidgetType
  position: { x: number; y: number }
  config: Record<string, unknown>
  status: WidgetStatus
}

export type WidgetType =
  | 'action_button'   // llama endpoint REST al pulsar
  | 'rest_explorer'   // cliente HTTP configurable
  | 'job_monitor'     // estado de jobs en tiempo real
  | 'metric_card'     // KPI o gráfica periódica
  | 'log_stream'      // logs Docker en vivo via SSE
  | 'workflow'        // secuencia de pasos con estado por nodo
  | 'script_runner'   // ejecuta script .sh/.py/.js del servidor
  | 'docker_control'  // start/stop/restart/rebuild del contenedor
  | 'system_stats'    // CPU, RAM, disco del servidor Linux
  | 'deploy_card'     // estado del último deploy + historial
  | 'env_editor'      // edita variables de entorno con diff visual
```

---

## Endpoints de la API

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
DELETE /api/projects/:id

POST   /api/projects/:id/deploy
POST   /api/projects/:id/rollback
GET    /api/projects/:id/deployments

GET    /api/projects/:id/logs/stream          ← SSE
GET    /api/projects/:id/status

POST   /api/projects/:id/docker/start
POST   /api/projects/:id/docker/stop
POST   /api/projects/:id/docker/restart
POST   /api/projects/:id/docker/rebuild

GET    /api/projects/:id/env
PUT    /api/projects/:id/env
GET    /api/projects/:id/env/diff

POST   /api/projects/:id/scripts/run
GET    /api/projects/:id/scripts/run/stream   ← SSE

GET    /api/system/stats
GET    /api/system/docker/containers

GET    /api/projects/:id/canvas
PUT    /api/projects/:id/canvas
```

---

## Comunicación UI ↔ API

| Canal | Cuándo |
|---|---|
| REST JSON | Operaciones normales (deploy, rollback, config) |
| SSE (`EventSource`) | Logs en vivo, output de scripts, eventos de workflow |
| Polling (React Query) | Estado de widgets — configurable, default 5s |

Streams: logs compose y scripts vía SSE; workflows SSE desde `POST .../workflows/run`. Hook de logs: `src/hooks/useLogStream.ts`.

---

## Variables de entorno

### Sentinel API (`.env`)

```
SENTINEL_API_KEY=cambia_esto
SENTINEL_PORT=3500
SENTINEL_DATA_DIR=./data
SENTINEL_PROJECTS_DIR=/opt/sentinel/projects
GITHUB_TOKEN=ghp_...
```

### Sentinel UI (`.env`)

```
VITE_API_URL=http://tu-servidor:3500
VITE_API_KEY=cambia_esto
```

---

## Fases de desarrollo (orden recomendado)

Resumen: **fases 1–4 cubiertas en MVP** salvo matices abajo. La validación en producción (p. ej. Dynamoss) es el siguiente paso en tu servidor.

### Fase 1 — MVP funcional

1. Monorepo + shared-types — **hecho**
2. API Fastify + auth + JSON store — **hecho**
3. `GitService` — **hecho** (clone, pull en deploy, checkout rollback)
4. `DockerService` — **hecho** (up/start/stop/restart/rebuild, logs SSE)
5. UI React Flow — **hecho**
6. Widgets `deploy_card`, `log_stream` — **hecho**
7. Caso Dynamoss — **pendiente en tu homelab** (probar contra repo real)

### Fase 2 — Operaciones

8–13. Widgets operativos, scripts (`child_process`, SSE), deployments + rollback en UI, env + `env_editor` — **hecho** (sin `node-pty`)

### Fase 3 — Workflows y métricas

14–15. Workflows SSE con eventos por paso — **hecho**
16. Ramificación condicional / compensación automática — **no** (el motor para al fallar un paso; ampliable)
17. `metric_card`, `job_monitor`, `rest_explorer` — **hecho** (métricas vía stats del host en MVP)

### Fase 4 — Multi-proyecto y pulido

18. Pizarra global — **hecho** (`/`)
19. GitHub list repos — **hecho** con token
20. Toasts + indicadores de estado — **hecho** (Sonner + dots)
21. Export/import canvas — **hecho**

---

## Convenciones de código

- TypeScript `strict: true` en todo el proyecto
- `zod` para validar inputs en API — nunca confiar en datos sin validar
- Nombres: `PascalCase` para componentes React, `camelCase` para el resto
- Los widgets no hacen `fetch` directo — usan TanStack Query / mutaciones vía `sentinelClient.ts`
- Toda llamada a la API pasa por `sentinelClient.ts`
- La lógica vive en `apps/api/src/services/` — las rutas validan (zod) y delegan
- Sin base de datos externa — JSON local es suficiente para este caso de uso

---

## Proyecto existente de referencia: Dynamoss

Dynamoss es un backend Java (Spring Boot) ya desplegado en el homelab. Es el primer proyecto que Sentinel debe ser capaz de gestionar. Tiene:

- Scripts de deploy: `deploy.sh`, `rollback.sh`, `configure.sh`, `update-env.sh`
- `docker-compose.yml` propio
- API REST documentada con Swagger (`/api-docs`)
- Jobs scheduled propios
- Base de datos MongoDB

Sentinel debe poder: ver su estado, desplegar nuevas versiones, hacer rollback, ver logs en vivo, ejecutar sus scripts y llamar a sus endpoints REST desde widgets de la pizarra.
