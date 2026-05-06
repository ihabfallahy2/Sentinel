# Sentinel — Technical Specification

> **Nota:** el código en la rama `feature/sentinel-monorepo` sigue esta estructura de carpetas; la persistencia inicial usa un JSON en disco (`apps/api/src/db/store.ts`) en lugar de `lowdb` hasta alinear dependencias. El stack de API es **Fastify 5**.

## 1. Estructura de repositorios

```
sentinel/                        ← monorepo raíz
├── apps/
│   ├── ui/                      ← Sentinel UI (React + Vite)
│   └── api/                     ← Sentinel API (Node.js + Fastify)
├── packages/
│   └── shared-types/            ← tipos TypeScript compartidos
├── package.json                 ← workspace root (pnpm workspaces)
└── README.md
```

---

## 2. Sentinel UI — Stack técnico

| Librería | Versión | Propósito |
|---|---|---|
| React | 18 | Framework UI |
| Vite | 5 | Bundler |
| TypeScript | 5 | Tipado |
| React Flow (@xyflow/react) | latest | Canvas, nodos arrastrables, dot grid |
| Zustand | 4 | Estado global (canvas layout, proyectos) |
| TailwindCSS | 3 | Estilos |
| shadcn/ui | latest | Componentes UI base |
| Recharts | 2 | Gráficas en metric cards |
| React Query (@tanstack/query) | 5 | Fetching, caché, polling |
| React Router | 6 | Navegación entre proyectos |

### 2.1 Estructura de carpetas UI

```
apps/ui/src/
├── canvas/
│   ├── CanvasBoard.tsx          ← componente principal React Flow
│   ├── nodes/                   ← un archivo por tipo de widget-nodo
│   │   ├── ActionButtonNode.tsx
│   │   ├── LogStreamNode.tsx
│   │   ├── MetricCardNode.tsx
│   │   ├── WorkflowNode.tsx
│   │   ├── DockerControlNode.tsx
│   │   ├── ScriptRunnerNode.tsx
│   │   ├── SystemStatsNode.tsx
│   │   └── ...
│   └── NodePicker.tsx           ← panel para añadir widgets
├── store/
│   ├── canvasStore.ts           ← Zustand: layout del canvas
│   └── projectStore.ts          ← Zustand: proyectos y estado global
├── hooks/
│   ├── useSSE.ts                ← hook para consumir Server-Sent Events
│   ├── useJobStatus.ts          ← polling de estado de jobs
│   └── useDockerStatus.ts
├── api/
│   └── sentinelClient.ts        ← cliente HTTP hacia Sentinel API
├── pages/
│   ├── GlobalBoard.tsx          ← pizarra global (todos los proyectos)
│   └── ProjectBoard.tsx         ← pizarra de un proyecto concreto
└── components/
    ├── StatusDot.tsx             ← indicador de estado (verde/amarillo/rojo)
    ├── LogViewer.tsx
    ├── EnvEditor.tsx
    └── DeployWizard.tsx
```

### 2.2 Canvas — configuración React Flow

```tsx
// CanvasBoard.tsx
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import { BackgroundVariant } from '@xyflow/react'

const nodeTypes = {
  action_button: ActionButtonNode,
  log_stream: LogStreamNode,
  metric_card: MetricCardNode,
  workflow: WorkflowNode,
  docker_control: DockerControlNode,
  script_runner: ScriptRunnerNode,
  system_stats: SystemStatsNode,
  deploy_card: DeployCardNode,
  env_editor: EnvEditorNode,
  rest_explorer: RestExplorerNode,
  job_monitor: JobMonitorNode,
}

export function CanvasBoard({ projectId }: { projectId: string }) {
  const { nodes, edges, onNodesChange, onEdgesChange } = useCanvasStore(projectId)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}
```

### 2.3 StatusDot — indicador de estado en tiempo real

```tsx
// components/StatusDot.tsx
type Status = 'idle' | 'running' | 'success' | 'error'

const colors: Record<Status, string> = {
  idle:    'bg-zinc-500',
  running: 'bg-amber-400 animate-pulse',
  success: 'bg-green-400',
  error:   'bg-red-500',
}

export function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${colors[status]}`} />
  )
}
```

### 2.4 Hook SSE

```ts
// hooks/useSSE.ts
export function useSSE(url: string, onMessage: (data: string) => void) {
  useEffect(() => {
    const es = new EventSource(url, {
      headers: { 'x-api-key': getApiKey() }
    })
    es.onmessage = (e) => onMessage(e.data)
    es.onerror   = () => es.close()
    return () => es.close()
  }, [url])
}
```

---

## 3. Sentinel API — Stack técnico

| Librería | Propósito |
|---|---|
| Node.js 20 LTS | Runtime |
| Fastify 4 | HTTP server (más rápido que Express, SSE nativo) |
| TypeScript 5 | Tipado |
| simple-git | Clonar repos, checkout de commits |
| dockerode | Docker API desde Node |
| dotenv / dotenv-diff | Gestión de .env |
| node-pty | Ejecutar scripts con terminal real (output streaming) |
| @octokit/rest | GitHub API |
| lowdb | Persistencia JSON simple (sin BD externa) |
| zod | Validación de inputs |

### 3.1 Estructura de carpetas API

```
apps/api/src/
├── routes/
│   ├── projects.ts              ← CRUD de proyectos
│   ├── deployments.ts           ← deploy, rollback, historial
│   ├── docker.ts                ← control de contenedores
│   ├── scripts.ts               ← ejecución de scripts
│   ├── env.ts                   ← gestión de .env
│   ├── logs.ts                  ← streaming de logs (SSE)
│   ├── system.ts                ← stats del servidor Linux
│   └── widgets.ts               ← canvas layout persistence
├── services/
│   ├── GitService.ts            ← clonar, pull, checkout
│   ├── DockerService.ts         ← compose up/down/build/logs
│   ├── ScriptService.ts         ← ejecutar .sh .py .js con pty
│   ├── EnvService.ts            ← leer, escribir, diff de .env
│   └── SystemService.ts         ← CPU, RAM, disco via systeminformation
├── middleware/
│   └── auth.ts                  ← validación API key
├── db/
│   └── store.ts                 ← lowdb JSON store
└── index.ts                     ← arranque del servidor
```

### 3.2 Endpoints principales

```
GET    /api/projects                         Lista todos los proyectos
POST   /api/projects                         Registra un nuevo proyecto (clona repo)
GET    /api/projects/:id                     Detalle de un proyecto
DELETE /api/projects/:id                     Elimina proyecto

POST   /api/projects/:id/deploy              Inicia deploy
POST   /api/projects/:id/rollback            Rollback a deployment anterior
GET    /api/projects/:id/deployments         Historial de deployments

GET    /api/projects/:id/logs/stream         SSE → logs del contenedor en vivo
GET    /api/projects/:id/status              Estado actual (docker inspect)

POST   /api/projects/:id/docker/start        docker compose start
POST   /api/projects/:id/docker/stop         docker compose stop
POST   /api/projects/:id/docker/restart      docker compose restart
POST   /api/projects/:id/docker/rebuild      docker compose up --build

GET    /api/projects/:id/env                 Leer variables de entorno
PUT    /api/projects/:id/env                 Escribir/actualizar variables
GET    /api/projects/:id/env/diff            Diff con .env.example

POST   /api/projects/:id/scripts/run         Ejecutar script del repo
GET    /api/projects/:id/scripts/run/stream  SSE → output del script en vivo

GET    /api/system/stats                     CPU, RAM, disco, uptime
GET    /api/system/docker/containers         Estado de todos los contenedores

GET    /api/projects/:id/canvas              Layout guardado del canvas
PUT    /api/projects/:id/canvas              Guardar layout del canvas

POST   /api/widgets/execute                  Ejecutar acción de cualquier widget
```

### 3.3 SSE — streaming de logs

```ts
// routes/logs.ts
fastify.get('/api/projects/:id/logs/stream', async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')

  const container = await dockerService.getContainer(req.params.id)
  const logStream = await container.logs({ follow: true, stdout: true, stderr: true, tail: 100 })

  logStream.on('data', (chunk) => {
    reply.raw.write(`data: ${chunk.toString()}\n\n`)
  })

  req.raw.on('close', () => logStream.destroy())
})
```

### 3.4 Ejecución de scripts con streaming

```ts
// services/ScriptService.ts
import { spawn } from 'node-pty'

export function runScript(scriptPath: string, onData: (data: string) => void) {
  const pty = spawn('bash', [scriptPath], {
    cwd: path.dirname(scriptPath),
    env: process.env,
  })
  pty.onData(onData)
  return new Promise<number>((resolve) => {
    pty.onExit(({ exitCode }) => resolve(exitCode))
  })
}
```

### 3.5 Persistencia con lowdb

```ts
// db/store.ts
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

type DB = {
  projects: Project[]
  deployments: Deployment[]
  canvasLayouts: Record<string, CanvasLayout>
}

const adapter = new JSONFile<DB>('data/sentinel.json')
export const db = new Low(adapter, { projects: [], deployments: {}, canvasLayouts: {} })
```

---

## 4. Autenticación

Sentinel API valida una API key en cada request. La clave se define en el `.env` de la propia API.

```ts
// middleware/auth.ts
fastify.addHook('preHandler', (req, reply, done) => {
  const key = req.headers['x-api-key']
  if (key !== process.env.SENTINEL_API_KEY) {
    reply.code(401).send({ error: 'Unauthorized' })
    return
  }
  done()
})
```

La UI guarda la API key en `localStorage` y la añade a cada request via `sentinelClient.ts`.

---

## 5. Comunicación UI ↔ API

```
Operaciones normales:   REST JSON (Fastify routes)
Logs en vivo:           SSE  (EventSource en el browser)
Estado de widgets:      Polling via React Query (configurable por widget, default 5s)
Workflows:              SSE con eventos tipados { type, nodeId, status, output }
```

---

## 6. Variables de entorno de Sentinel API

```env
SENTINEL_API_KEY=tu_clave_secreta_aqui
SENTINEL_PORT=3500
SENTINEL_DATA_DIR=./data
SENTINEL_PROJECTS_DIR=/opt/sentinel/projects
GITHUB_TOKEN=ghp_...        # opcional, para repos privados
```

---

## 7. Docker Compose de Sentinel

```yaml
# docker-compose.yml en el servidor
version: '3.8'
services:
  sentinel-api:
    build: ./apps/api
    ports:
      - "3500:3500"
    volumes:
      - ./data:/app/data                        # persistencia JSON
      - /opt/sentinel/projects:/opt/sentinel/projects  # proyectos
      - /var/run/docker.sock:/var/run/docker.sock      # acceso a Docker
    environment:
      - SENTINEL_API_KEY=${SENTINEL_API_KEY}
    restart: unless-stopped

  sentinel-ui:
    build: ./apps/ui
    ports:
      - "4000:80"
    environment:
      - VITE_API_URL=http://tu-servidor:3500
      - VITE_API_KEY=${SENTINEL_API_KEY}
    restart: unless-stopped
```

---

## 8. Convenciones de código

- TypeScript estricto en todo el proyecto (`strict: true`)
- Zod para validar todos los inputs en la API
- Nombres de archivos: `PascalCase` para componentes React, `camelCase` para el resto
- Un archivo por tipo de widget-nodo
- Los widgets no hacen fetch directamente — usan hooks del directorio `/hooks`
- Toda comunicación con la API pasa por `sentinelClient.ts` — nunca `fetch` directo en componentes
