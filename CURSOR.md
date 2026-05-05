# CURSOR.md — Sentinel Development Guide

Este archivo le indica a Cursor cómo está estructurado el proyecto y cómo debe ayudar en el desarrollo.

---

## Estado actual del repositorio (implementación)

- Monorepo **pnpm** con `apps/ui`, `apps/api`, `packages/shared-types` (ver `README.md`).
- API: **Fastify 5** + CORS, `GET /health`, `GET /api/projects`, autenticación por `x-api-key`.
- Persistencia: fichero JSON en `SENTINEL_DATA_DIR` (`apps/api/src/db/store.ts`); mismo objetivo que `lowdb` en la spec.
- UI: **Vite 5** + React 18 + **React Flow** (`@xyflow/react`) + Tailwind + Zustand; proxy `/api` en desarrollo.
- Pendiente respecto al plan en `plan/`: servicios Git/Docker, SSE, widgets concretos, React Query, shadcn/ui, etc.

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
- `zustand` — estado global del canvas y proyectos
- `@tanstack/react-query` — fetching, caché y polling *(pendiente de añadir)*
- `tailwindcss` + `shadcn/ui` — sistema de diseño oscuro *(shadcn pendiente)*
- `recharts` — gráficas en metric cards *(pendiente)*

### Reglas UI

- Toda comunicación con la API pasa por `src/api/sentinelClient.ts` — nunca `fetch` directo en componentes
- Los widgets son nodos de React Flow en `src/canvas/nodes/`
- Un archivo por tipo de widget
- Los hooks de datos viven en `src/hooks/` — los componentes los consumen, no los crean
- Estado del canvas en `src/store/canvasStore.ts` (Zustand)
- Estado de proyectos en `src/store/projectStore.ts` (Zustand) *(pendiente)*

---

## Stack API (`apps/api`)

- Node.js 20 LTS + **Fastify 5** + TypeScript strict
- `simple-git` — operaciones Git (clone, pull, checkout) *(pendiente)*
- `dockerode` — Docker Engine API *(pendiente)*
- `node-pty` — ejecución de scripts con output en streaming real *(pendiente)*
- `@octokit/rest` — GitHub API *(pendiente)*
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

Hook de SSE disponible en `src/hooks/useSSE.ts` *(pendiente)*.

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

### Fase 1 — MVP funcional

1. Monorepo base con pnpm workspaces + shared-types — **hecho (base)**
2. Sentinel API: estructura Fastify + auth middleware + store JSON — **hecho (base)**
3. `GitService` — clone y pull
4. `DockerService` — compose up/down + stream de logs via SSE
5. Sentinel UI: canvas base con React Flow + dot grid background — **hecho (base)**
6. Widget `deploy_card` + widget `log_stream`
7. Deploy de Dynamoss como caso de prueba real

### Fase 2 — Operaciones

8. Widgets `action_button`, `docker_control`, `system_stats`
9. `ScriptService` — ejecución de scripts con node-pty + SSE
10. Widget `script_runner`
11. Historial de deployments y rollback UI
12. `EnvService` — lectura, escritura y diff de .env
13. Widget `env_editor`

### Fase 3 — Workflows y métricas

14. Motor de workflows en Sentinel API (SSE con eventos tipados por nodo)
15. Widget `workflow` con nodos visuales y estado individual
16. Conditional branching (si nodo falla → ejecutar compensación)
17. Widgets `metric_card`, `job_monitor`, `rest_explorer`

### Fase 4 — Multi-proyecto y pulido

18. Pizarra global con todos los proyectos
19. GitHub integration — listar repos, seleccionar rama desde UI
20. Notificaciones de estado (toast + indicadores en pizarra global)
21. Export/import de canvas layouts

---

## Convenciones de código

- TypeScript `strict: true` en todo el proyecto
- `zod` para validar inputs en API — nunca confiar en datos sin validar
- Nombres: `PascalCase` para componentes React, `camelCase` para el resto
- Los widgets no hacen `fetch` directo — usan hooks de `src/hooks/`
- Toda llamada a la API pasa por `sentinelClient.ts`
- Los services de la API son clases con métodos async — las rutas solo orquestan
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
