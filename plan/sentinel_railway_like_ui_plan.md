# Sentinel — Plan “Railway-like UI” (App Shell + Panel derecho por pizarra)

Este plan define cómo evolucionar Sentinel para que se parezca a Railway en **jerarquía de navegación**, **densidad de información**, y **patrones de UI**, manteniendo el modelo actual:

- **Sidebar izquierda**: nivel **aplicación** (global, persistente).
- **Centro**: contenido de la sección global (home/listas/vistas).
- **Panel derecho**: nivel **pizarra/proyecto** (control del proyecto seleccionado dentro de una pizarra).
- **Canvas**: espacio operacional (widgets pinneables), no “settings”.

Fecha: 2026-05-06

---

## 0) North Star (lo que queremos replicar de Railway)

### 0.1. UX / IA (information architecture)
- **App Shell persistente** (topbar + sidebar izquierda).
- “Home” como lista de **pizarras** (y opcionalmente proyectos).
- Dentro de una pizarra:
  - **Project node** compacto (tarjeta).
  - Panel derecho con tabs: **Deployments / Variables / Metrics / Settings**.
  - Settings con **subnavegación** interna (Source/Build/Deploy/Networking/Danger).

### 0.2. Estética (lo que da aspecto “producto real”)
- Tipografía más pequeña y consistente.
- Separadores suaves y jerarquía clara (títulos vs metadatos).
- Badges de estado (success/building/error/offline) consistentes.
- Acciones primarias visibles y secundarias en “kebab menu”.
- Evitar “blancos” (controles ReactFlow/Minimap/Controls con tema oscuro).

---

## 1) Fase 1 — App Shell (sidebar global + topbar)

### Objetivo
Introducir la estructura global estilo Railway sin romper flujos existentes:
- Sidebar izquierda global (aplicación).
- Topbar (breadcrumb/selector + acciones).
- Área central con rutas.

### Entregables
- Nuevo layout `AppShell` usado por la mayoría de rutas.
- Sidebar con secciones (mínimo viable):
  - **Pizarras** (home)
  - **Proyectos** (lista opcional)
  - **Sistema** (host stats / containers)
  - **Ajustes** (settings global)

### UI (propuesta)
- Sidebar fija (ancho ~56–64px colapsada + tooltips; o 220px expandida).
- Topbar:
  - “Sentinel” + selector simple (ej. Servidor: local / homelab) + (opcional) entorno.
  - Acciones rápidas: docs, feedback, etc. (placeholder).

### Cambios por archivos (orientativo)
- `apps/ui/src/App.tsx`
  - Convertir router a layout nested:
    - `/` → `BoardsHomePage` dentro del shell
    - `/b/:boardId` → `BoardPage` dentro del shell
    - `/settings` → `SettingsPage`
    - `/system` → `SystemPage`
- `apps/ui/src/layout/AppShell.tsx` (nuevo)
- `apps/ui/src/components/Sidebar.tsx` (nuevo)
- `apps/ui/src/components/Topbar.tsx` (nuevo)

### Criterios de aceptación
- Sidebar visible en todas las páginas del “app level”.
- Navegación no recarga página; ruta cambia y se mantiene shell.
- En `/b/:boardId` se mantiene panel derecho contextual.

---

## 2) Fase 2 — Home estilo Railway (Pizarras)

### Objetivo
Hacer que la pantalla inicial se sienta como “Railway Projects”:
- Lista con cards, “New”, sort/filters básicos.

### Entregables
- Home de **Pizarras**:
  - Cards: nombre, estado agregado, nº proyectos, “last activity” (si lo tenemos).
  - Botón “New” (crea pizarra).
  - Alternar vista grid/list (opcional).

### Cambios por archivos
- `apps/ui/src/pages/GlobalBoard.tsx` → renombrar/conceptualizar como `BoardsHomePage.tsx` (o mantener nombre, pero función: home).

### Criterios de aceptación
- Crear pizarra desde botón “New” sin modal bloqueante.
- La lista se actualiza al crear (sin refresh).

---

## 3) Fase 3 — Board page (canvas + panel derecho “Railway-like”)

### 3.1. Project node (tarjeta compacta real)
**Objetivo**: que la tarjeta del proyecto se parezca a Railway (nombre + estado + último evento).

**Acciones**:
- Reemplazar el node actual `deploy_card` por un tipo `project_node`.
- El node NO debe incluir botones de deploy; solo resumen.
- Click izquierdo → abre panel derecho (Deployments).
- Click derecho → menú contextual (acciones rápidas).

**Archivos**:
- `apps/ui/src/canvas/nodeTypes.ts`
- `apps/ui/src/canvas/nodes/ProjectNode.tsx` (nuevo)
- `apps/ui/src/pages/ProjectBoard.tsx` (board canvas)

### 3.2. Panel derecho (tabs)
**Objetivo**: que el panel derecho sea “control center” del proyecto seleccionado.

**Deployments tab (Railway-like)**:
- Sección “Current/Latest” con estado (failed/building/success).
- Timeline de steps (init/build/deploy) si se puede aproximar.
- Botón “View logs” con panel interno (o logs expandibles).
- History lista compacta debajo.

**Variables tab (Railway-like)**:
- Tabla: `KEY | VALUE(mask) | actions`.
- Botón `+ New Variable`.
- Toggle `Raw editor`.
- “Missing vars from .env.example” como banner/notice.

**Metrics tab**:
- Host CPU/RAM/Disk con mini-gráficas (si no, al menos números con sparkline simple).
- Rango (1h/6h/1d/7d) (si no hay histórico, desactivar o mostrar placeholder).

**Settings tab**:
- Subnav interna a la derecha (o izquierda dentro del panel):
  - Source, Build, Deploy, Networking, Config-as-code, Feature flags, Danger (como Railway).
- Source:
  - repo URL
  - branch selector (real) y “disconnect”
  - auto-deploy toggle (placeholder si no hay webhook)
  - wait for CI toggle (placeholder)

**Archivos**:
- `apps/ui/src/components/ProjectPanel.tsx` (o dividir en subcomponentes)
- `apps/ui/src/components/project-panel/*` (nuevo folder recomendado)

### 3.3. Import repo (panel lateral, no modal)
**Objetivo**: importación tipo Railway:
- URL
- Branch selector (dropdown real)
- Nombre opcional
- Botón “Clone and add”

**Backend**:
- Endpoint para listar ramas remotas del repo:
  - `GET /api/github/branches?url=...` o similar.
  - Alternativa: `POST /api/repos/inspect` con URL y respuesta `{ defaultBranch, branches[] }`.

**Archivos**:
- API: `apps/api/src/routes/github.ts` (extender)
- UI: `apps/ui/src/api/sentinelClient.ts` (añadir llamada)
- UI: `apps/ui/src/pages/ProjectBoard.tsx` (import panel)

### Criterios de aceptación (Board page)
- Importar repo y aparece al instante como tarjeta (sin refresh).
- Click en tarjeta abre panel derecho.
- Variables tab permite añadir/editar/eliminar sin tocar raw.
- Settings tab tiene subnav y se siente “Railway-like”.

---

## 4) Fase 4 — Settings globales (nivel aplicación)

### Objetivo
Página de settings a nivel app (no proyecto).

### Entregables
- `/settings` con secciones:
  - **Connection**: API URL, API Key (persistido en localStorage)
  - **GitHub**: token status (si se usa), futuras integraciones
  - **Defaults**: valores por defecto (puerto UI, etc.)
  - **About**: version/build info (si lo añadimos)

### Backend (opcional)
Endpoint `/api/system/info` para version, uptime, etc.

---

## 5) Fase 5 — Pulido visual (dark theme coherente)

### Objetivo
Eliminar blancos y asegurar consistencia dark.

### Lista de ajustes
- Tema de `ReactFlow`:
  - Controls y MiniMap con CSS custom (bg zinc-900, borde zinc-700, iconos zinc-200).
- Botones (primary/secondary/danger) consistentes.
- Tooltips en sidebar colapsada.
- Skeletons / loading states (no “pantalla negra”).

Archivos:
- `apps/ui/src/index.css` (overrides de ReactFlow)
- componentes base `Button`, `Badge`, etc. (si introducimos un mini design system)

---

## 6) Estrategia de entrega (trabajo en ramas)

Regla del repo:
- Crear ramas desde `develop`.
- PRs hacia `develop`.
- Merge `develop` → `main` para releases.

Recomendación de PRs (para review fácil):
1. AppShell + routing
2. BoardsHome “Railway-like”
3. ProjectNode + panel derecho (estructura + navegación)
4. Variables tabla + raw editor
5. Settings subnav + Source/Deploy toggles
6. Branch selector real (API + UI)
7. Pulido visual ReactFlow + theme

---

## 7) Checklist de validación en servidor (smoke test)

### Global (App)
- Sidebar izquierda aparece siempre.
- Home de pizarras lista y crea pizarras sin recargar.
- Settings global guarda API key y afecta llamadas.

### Board
- Crear pizarra → entrar → importar repo con branch default distinta (master) funciona.
- Import aparece en canvas instantáneo.
- Click tarjeta abre panel derecho.
- Variables:
  - añadir variable (UI tabla) → se refleja en raw
  - raw editor toggle no rompe
  - diff con .env.example muestra faltantes
- Deployments:
  - deploy / pull+deploy / stop / rollback
  - logs accesibles por deployment
- Metrics:
  - muestra CPU/RAM/Disk sin errores

---

## 8) Notas técnicas / deuda controlada
- Evitar big-bang refactor: introducir AppShell primero, migrar rutas gradualmente.
- Preferir dividir `ProjectPanel` en subcomponentes para no crecer infinito.
- Para “rama por defecto”: usar `git ls-remote --symref <url> HEAD` en API (ya hay una base).
- Si queremos gráficos reales en Metrics: definir API de histórico (por ahora hay solo instantáneo).

