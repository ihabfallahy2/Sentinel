# Sentinel — Product Requirements Document

> **Estado en repo (2026-05):** implementación MVP del PRD: API con endpoints de despliegue, Docker, env, scripts, workflows SSE, sistema y GitHub; UI con pizarra global, canvas por proyecto, todos los tipos de widget del documento, persistencia/export del canvas y stack Docker con nginx → `/api`. Siguiente paso operativo: desplegar en el servidor homelab y validar con proyectos reales (p. ej. Dynamoss). Detalle: `README.md` y `CURSOR.md`.

## 1. Visión del producto

Sentinel es una plataforma de despliegue y operaciones personal (self-hosted) para homelab. Permite gestionar, desplegar, monitorizar y operar cualquier proyecto alojado en un servidor Linux desde una interfaz visual tipo canvas, sin depender de servicios externos de pago como Railway, Render o Coolify.

El usuario final es el propio desarrollador-administrador del homelab. La interfaz debe ser tan potente como un terminal pero tan clara como un dashboard comercial.

---

## 2. Problema que resuelve

Actualmente el usuario gestiona múltiples proyectos (Dynamoss, Jellyfin, otros) mediante:
- Scripts de shell dispersos (`deploy.sh`, `rollback.sh`, `configure.sh`…)
- Acceso directo por SSH al servidor
- Sin visibilidad del estado de los servicios en tiempo real
- Sin forma de ejecutar operaciones complejas (workflows multi-paso) desde una UI

Sentinel centraliza todo esto en una pizarra visual interactiva por proyecto.

---

## 3. Usuarios y contexto de uso

| Actor | Descripción |
|---|---|
| Admin (usuario principal) | El propio desarrollador, accede desde la red local o VPN |
| Sentinel API | Agente Node.js que vive en el servidor Linux y ejecuta las operaciones reales |

Acceso: red local o VPN. No está pensado para exposición pública directa.

---

## 4. Arquitectura de alto nivel

```
[Sentinel UI]  ←→  [Sentinel API]  ←→  [Docker / Linux / GitHub]
  React+Vite       Node.js/Fastify       Proyectos desplegados
  (browser)        (servidor Linux)
                        ↕
               [Proyectos desplegados]
               dynamoss · jellyfin · cualquier repo
                        ↕ (opcional)
               [APIs propias de cada proyecto]
```

### Componentes principales

**Sentinel UI** — Frontend React. Solo interfaz, sin lógica de negocio. Se comunica exclusivamente con Sentinel API.

**Sentinel API** — Servicio Node.js ligero. Único con acceso real al sistema operativo, Docker y GitHub. Expone REST + SSE para streaming de logs y eventos.

**Proyectos** — Cada repo desplegado es independiente. Sentinel no necesita saber qué hacen por dentro para gestionarlos. Solo necesita su `docker-compose.yml` y su `.env`.

---

## 5. Modelo de datos principal

### Project
```ts
{
  id: string
  name: string                  // nombre del repo
  githubUrl: string             // URL del repo
  branch: string                // rama activa
  status: 'online' | 'offline' | 'building' | 'error'
  lastDeployedAt: Date
  envVars: EnvVar[]
  canvasLayout: CanvasLayout    // posición y config de widgets
  deployHistory: Deployment[]
}
```

### Deployment
```ts
{
  id: string
  projectId: string
  commitSha: string
  commitMessage: string
  status: 'success' | 'failed' | 'building' | 'rolled_back'
  startedAt: Date
  finishedAt: Date
  logs: string[]
}
```

### Widget (en canvas)
```ts
{
  id: string
  type: WidgetType              // ver sección 7
  position: { x: number, y: number }
  size: { w: number, h: number }
  config: Record<string, any>  // específico por tipo
  status: 'idle' | 'running' | 'success' | 'error'
}
```

---

## 6. Flujos principales

### 6.1 Añadir un nuevo proyecto
1. Usuario pulsa "+ New project" en la pizarra global
2. Introduce URL del repo de GitHub
3. Sentinel API clona el repo en el servidor
4. UI muestra wizard: selección de rama, configuración de `.env`, puerto
5. Usuario pulsa "Deploy" → Sentinel API ejecuta `docker-compose up --build`
6. Logs en streaming via SSE aparecen en un widget de log dentro de la pizarra del proyecto
7. Cuando el servicio responde en el healthcheck → estado cambia a `online`

### 6.2 Rollback
1. Usuario abre el widget "Deploy history" del proyecto
2. Selecciona un deployment anterior
3. Pulsa "Rollback to this version" → confirmación obligatoria
4. Sentinel API hace checkout del commit, rebuild y redeploy
5. Estado del widget en tiempo real: amarillo (building) → verde (ok) o rojo (error)

### 6.3 Ejecutar un workflow
1. Usuario pulsa "Run" en un widget de tipo Workflow
2. Los nodos del workflow se ejecutan en secuencia
3. Cada nodo muestra su estado individual (idle → running → ok/error)
4. Si un nodo falla, el workflow puede: parar, continuar, o ejecutar un nodo de compensación (ej: rollback)

### 6.4 Añadir un widget al canvas
1. Usuario pulsa "+ Add" en la pizarra del proyecto
2. Panel lateral muestra tipos de widget disponibles
3. Usuario configura el widget (URL, método, intervalo, script…)
4. Widget aparece en el canvas, arrastrable y redimensionable

---

## 7. Tipos de widget

| Tipo | Descripción |
|---|---|
| `action_button` | Llama un endpoint REST al pulsar. Indicador de estado en esquina. |
| `rest_explorer` | Cliente HTTP configurable (método, headers, body). |
| `job_monitor` | Muestra estado de jobs del proyecto en tiempo real. |
| `metric_card` | KPI o gráfica alimentada por un endpoint periódico. |
| `log_stream` | Logs en vivo del contenedor vía SSE. Filtrable. |
| `workflow` | Secuencia de pasos (REST, script, comando). Con estado por nodo. |
| `script_runner` | Ejecuta un script `.sh`, `.py` o `.js` del servidor. |
| `docker_control` | Start / stop / restart / rebuild del contenedor. |
| `system_stats` | CPU, RAM, disco del servidor Linux. |
| `deploy_card` | Estado del último deploy con historial. |
| `env_editor` | Edita variables de entorno del proyecto con diff visual. |

---

## 8. Requisitos no funcionales

- **Seguridad**: API key obligatoria para todas las llamadas a Sentinel API. Comunicación HTTPS en red local.
- **Persistencia**: Layout del canvas y configuración de proyectos guardados en fichero JSON local (Sentinel API). Sin base de datos externa para no añadir dependencias.
- **Streaming**: Logs y estados en tiempo real via SSE (Server-Sent Events). Sin polling donde sea posible.
- **Resiliencia**: Si Sentinel API no está disponible, la UI muestra estado degradado pero no rompe.
- **Extensibilidad**: Arquitectura de widgets basada en plugins — añadir un nuevo tipo de widget no debe requerir cambios en el core.

---

## 9. Fases de desarrollo

### Fase 1 — MVP
- Sentinel API: clonar repo, gestionar `.env`, docker compose up/down, stream de logs
- Sentinel UI: canvas básico con React Flow, widget `deploy_card`, widget `log_stream`
- Proyecto Dynamoss como caso de prueba

### Fase 2 — Operaciones
- Widgets: `action_button`, `script_runner`, `docker_control`, `system_stats`
- Historial de deployments y rollback
- Autenticación por API key

### Fase 3 — Workflows y métricas
- Widget `workflow` con nodos visuales
- Widgets `metric_card`, `job_monitor`, `rest_explorer`
- Conditional branching en workflows

### Fase 4 — Multi-proyecto
- Pizarra global con todos los proyectos
- GitHub integration (listar repos, seleccionar rama)
- Notificaciones de estado
