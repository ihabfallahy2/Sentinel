# Sentinel — V2 Iteration Brief

Este documento corrige y refina el diseño original tras la primera implementación. Son cambios de concepto, no de stack. El stack y la arquitectura de la API no cambian.

---

## Cambio 1 — Modelo de pizarra: de "repo → canvas" a "canvas libre con proyectos dentro"

### Problema actual
La pizarra está acoplada 1:1 a un repositorio. El usuario añade un repo en la pantalla global y eso genera automáticamente su pizarra.

### Nuevo modelo
La pizarra es un espacio libre con nombre propio. El usuario la crea primero (como crearía un proyecto en Notion), y dentro puede importar uno o varios repositorios, añadir widgets sueltos, o mezclar recursos de distintos repos.

### Cambios concretos

**Pantalla global (`GlobalBoard`)**
- Eliminar el formulario "Añadir proyecto (clone Git)" de la pantalla principal
- El botón principal pasa a ser **"+ Nueva pizarra"** — solo pide un nombre
- La lista muestra pizarras, no repos
- Cada tarjeta de pizarra muestra: nombre, número de proyectos dentro, estado global (online/error/building)

**Dentro de la pizarra (`ProjectBoard`)**
- El click derecho sobre la pizarra (ver Cambio 3) incluye la opción **"Importar repositorio"**
- Al importar, aparece un panel lateral (no un modal bloqueante) con:
  - Campo URL de GitHub
  - Selector de rama
  - Nombre opcional
  - Botón "Clonar y añadir"
- Una vez importado, aparece en la pizarra como una **tarjeta de proyecto** (nodo React Flow)
- Se pueden tener múltiples repos en la misma pizarra

---

## Cambio 2 — Las tarjetas de proyecto usan un panel lateral con tabs (estilo Railway)

### Problema actual
Toda la configuración (deploy, variables de entorno, scripts, docker control, env editor…) está expuesta como nodos separados en la pizarra. Esto satura el canvas y mezcla configuración con operación.

### Nuevo modelo
Inspirado directamente en Railway: la tarjeta del proyecto en el canvas es compacta. Al hacer click sobre ella se abre un **panel lateral deslizante desde la derecha** con tabs. La pizarra sigue siendo visible y usable detrás del panel.

### Estructura del panel lateral

```
┌─────────────────────────────────────────┐
│  ⬡ nombre-proyecto              [× cerrar]│
├──────────────────────────────────────────┤
│ Deployments │ Variables │ Metrics │ Settings │
├──────────────────────────────────────────┤
│                                          │
│  [contenido de la tab activa]            │
│                                          │
└──────────────────────────────────────────┘
```

### Tab: Deployments
- Estado actual del servicio (online / offline / building / error) con indicador de color
- Botones: "Deploy (compose up)", "Pull + deploy", "Stop"
- Selector de commit para rollback + botón "Rollback"
- Historial de deployments: commit, fecha, estado, botón "Ver logs"
- Logs en streaming (SSE) expandibles por deployment

### Tab: Variables
- Lista de variables de entorno con valores enmascarados
- Botones: editar valor, eliminar, añadir nueva variable
- Botón "Raw editor" — textarea con el `.env` completo para edición en bloque
- Botón "Diff con .env.example" — muestra variables nuevas no configuradas
- Botón "Guardar" — escribe el `.env` en el servidor y reinicia si se desea

### Tab: Metrics
- CPU y RAM del host (del servidor Linux, no del contenedor específico)
- Selectores de rango: 1h / 6h / 1d / 7d
- Gráficas con Recharts: CPU load, memoria usada, disco
- Si el proyecto expone una API propia, opción de añadir endpoint de métricas custom

### Tab: Settings
- Repo conectado + botón para cambiar URL o rama
- Selector de rama activa
- Toggle "Auto-deploy on push" (webhook de GitHub → Sentinel API)
- "Wait for CI" toggle
- Sección "Scripts" — lista de scripts disponibles en el repo con botón ejecutar
- Sección "Docker" — start / stop / restart / rebuild
- Zona "Danger": botón "Eliminar proyecto de Sentinel" (con confirmación)

### Qué queda en el canvas (nodos libres, opcionales)
Solo los widgets operacionales que el usuario quiere tener a la vista en todo momento:

| Widget | Descripción |
|---|---|
| `action_button` | Atajo a un endpoint REST específico |
| `metric_card` | KPI concreto de un endpoint |
| `log_stream` | Logs en vivo del contenedor |
| `workflow` | Secuencia de pasos multi-proyecto |
| `script_runner` | Atajo a un script concreto |
| `system_stats` | Métricas del host siempre visibles |
| `job_monitor` | Estado de jobs en tiempo real |

El usuario elige qué poner en la pizarra. La configuración siempre vive en el panel lateral del proyecto.

---

## Cambio 3 — Click derecho contextual en la pizarra y en las tarjetas

Implementar un menú contextual custom (sin el menú del navegador) usando `onContextMenu` con `preventDefault()`.

### Click derecho sobre la pizarra (fondo vacío)

```
┌─────────────────────────┐
│  + Importar repositorio │
│  + Añadir widget        │  → submenu con tipos de widget
│  ─────────────────────  │
│  ⟲ Ajustar vista        │
│  □  Seleccionar todo    │
│  ─────────────────────  │
│  ↑ Exportar canvas      │
│  ↓ Importar canvas      │
└─────────────────────────┘
```

### Click derecho sobre una tarjeta de proyecto

```
┌──────────────────────────────┐
│  ▶  Deploy                   │
│  ↺  Pull + deploy            │
│  ⏹  Stop                     │
│  ─────────────────────────   │
│  ⚙  Abrir configuración      │  → abre panel lateral en tab Settings
│  📋 Ver variables            │  → abre panel lateral en tab Variables
│  📊 Ver métricas             │  → abre panel lateral en tab Metrics
│  ─────────────────────────   │
│  ✎  Renombrar                │
│  ⧉  Duplicar tarjeta         │
│  ─────────────────────────   │
│  🗑  Eliminar del canvas      │
└──────────────────────────────┘
```

### Click derecho sobre un widget (action_button, log_stream, etc.)

```
┌──────────────────────────┐
│  ▶  Ejecutar / Activar   │
│  ✎  Configurar widget    │
│  ─────────────────────   │
│  ⧉  Duplicar             │
│  🗑  Eliminar            │
└──────────────────────────┘
```

### Implementación

```tsx
// Interceptar click derecho en React Flow
<ReactFlow
  onPaneContextMenu={(e) => {
    e.preventDefault()
    showContextMenu({ type: 'pane', x: e.clientX, y: e.clientY })
  }}
  onNodeContextMenu={(e, node) => {
    e.preventDefault()
    showContextMenu({ type: 'node', node, x: e.clientX, y: e.clientY })
  }}
/>

// Componente ContextMenu posicionado con position: fixed
// Se cierra al hacer click fuera o al pulsar Escape
// Animación de entrada: opacity 0→1 + scale 0.95→1 (10ms)
```

---

## Resumen de cambios por archivo

| Archivo | Cambio |
|---|---|
| `GlobalBoard.tsx` | Quitar form de repo, añadir "Nueva pizarra", listar pizarras |
| `ProjectBoard.tsx` | Añadir panel lateral con tabs, gestionar estado del panel |
| `ProjectPanel.tsx` | Nuevo componente — panel lateral completo con 4 tabs |
| `ContextMenu.tsx` | Nuevo componente — menú contextual posicionado |
| `canvasStore.ts` | Modelo: pizarra tiene nombre propio + lista de proyectos |
| `CanvasBoard.tsx` | Añadir `onPaneContextMenu` + `onNodeContextMenu` |
| `nodes/ProjectNode.tsx` | Tarjeta compacta — solo nombre, status dot, repo URL |

## Lo que NO cambia
- Stack tecnológico
- Sentinel API y sus endpoints
- Tipos de widget operacionales
- Sistema de SSE para logs y streaming
- Persistencia con lowdb
