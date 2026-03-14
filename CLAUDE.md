# CLAUDE.md — VioletDen

## Project Overview

Self-hosted smart home dashboard (React + Express + nginx) for organizing web services, devices, and network infrastructure. Provides interactive SSH/Telnet terminal access to network devices with encrypted credential storage.

Supports two deployment modes (both Docker-based, installable as systemd services via `install.sh`):
- **Standalone** — Three-container Docker stack (nginx + frontend + backend) with self-signed TLS or Let's Encrypt via DNS-01
- **Home Assistant** — Single-container deployment embedded as an HA sidebar panel via `panel_custom`

## Architecture

```
┌────────────────┐      ┌──────────────┐      ┌──────────────┐
│     nginx      │─────▶│   frontend   │      │   backend    │
│ :80 → :443     │      │  Vite :5173  │      │ Express :4000│
│ (envsubst tpl) │─────▶│              │─────▶│              │
└────────────────┘      └──────────────┘      │  SQLite DB   │
      │                      │                │  SSH/Telnet  │
      │ /api/, /ws/          │ WebSocket      │  WebSocket   │
      └──────────────────────┴───────────────▶│  Terminal    │
                                              └──────────────┘
```

### Standalone Mode (docker-compose.yml)

Three Docker containers behind an nginx reverse proxy:
- **nginx** — TLS termination (auto-generated self-signed cert), HTTP→HTTPS redirect, `envsubst` template for configurable backend port. Config is `nginx.conf.template` processed by `entrypoint.sh`.
- **frontend** — React 19 SPA served by Vite 8 dev server. Internal only (`expose`, not `ports`).
- **backend** — Express 5 API with SQLite (better-sqlite3), ssh2, ws. Internal only (`expose`, not `ports`).

### Home Assistant Mode (docker-compose.ha.yml)

```
┌──────────────────────────┐      ┌───────────────────────────┐
│   Home Assistant         │      │   VioletDen               │
│   :8123                  │      │   (single container :4000)│
│                          │      │                           │
│  ┌────────────────────┐  │      │  Express serves:          │
│  │ panel_custom       │──┼──────┤  - Built React SPA (dist/)│
│  │ (iframe → :4000)   │  │      │  - REST API (/api/*)      │
│  └────────────────────┘  │      │  - WebSocket (/ws/*)      │
│                          │      │                           │
│  HA token via postMessage┼──────▶ /api/ha-auth validates    │
│                          │      │  against HA_URL/api/      │
└──────────────────────────┘      └───────────────────────────┘
```

Single container (`Dockerfile.ha`) — multi-stage build: Vite builds frontend → Express serves static files + API. No nginx needed. Key env vars: `HA_INTEGRATION=true`, `HA_URL`.

- **Panel component** (`homeassistant/violetden-panel.js`) — Custom element for HA's `panel_custom` system. Creates an iframe to VioletDen, passes HA auth token via `postMessage`.
- **HACS integration** (`custom_components/violetden/`) — Full HA custom integration installable via HACS. Config flow asks for VioletDen URL, validates connectivity, then auto-registers the sidebar panel. The integration serves the panel JS as a static file and registers it via `panel_custom.async_register_panel`.
- **Auth flow** — Panel sends HA access token → frontend calls `POST /api/ha-auth` → backend validates token against `HA_URL/api/` → creates VioletDen session → auto-login (no onboarding/login screen).
- **SPA fallback** — Backend serves `dist/index.html` for non-API routes when `dist/` directory exists.

### Docker Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `certs` | `/certs` | SSL certificates (nginx auto-generates on first run, shared with backend) |
| `data` | `/data` | SQLite DB (`violetden.db`) + encryption key (`.violetden_secret`) |

### Port Configuration

All ports are configurable via `.env`: `HTTP_PORT`, `HTTPS_PORT`, `BACKEND_PORT`. Nginx uses `envsubst` to inject `BACKEND_PORT` into its config template at runtime. Frontend and backend are only accessible through nginx.

## Directory Structure

```
├── backend/
│   ├── db.js           # SQLite init, config helpers, AES-256-GCM encrypt/decrypt
│   ├── index.js        # Express API (auth, sections, SSH CRUD, certs, settings, WebSocket terminal)
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── main.jsx         # React entry point
│       ├── App.jsx          # Main app: setup-status check → Onboarding or AuthWrapper+Dashboard; HA postMessage auth
│       ├── App.css          # All styles (single CSS file, CSS custom properties)
│       ├── api.js           # Fetch wrapper: auto Bearer token, auto 401 redirect, HA auth helpers
│       ├── AuthWrapper.jsx  # Login screen, token validation on mount via /api/validate-token
│       ├── Onboarding.jsx   # First-run wizard: mandatory creds + preset sections, calls /api/setup
│       ├── SSHPanel.jsx     # SSH/Telnet: saved servers, free connect, xterm.js terminal, saved commands, error boundary
│       ├── SettingsPanel.jsx # Settings overlay: display (show/hide URLs), credentials (with confirm), certs, data mgmt
│       ├── IconPicker.jsx   # Material Icons picker (portal-based dropdown)
│       └── index.css        # Base/reset styles
├── nginx/
│   ├── nginx.conf.template  # Reverse proxy config template (uses ${BACKEND_PORT} envsubst)
│   ├── entrypoint.sh        # Auto-generates self-signed cert + envsubst → nginx.conf
│   └── Dockerfile
├── homeassistant/
│   ├── violetden-panel.js  # HA panel_custom web component (iframe + postMessage auth)
│   └── INSTALL.md          # HA integration setup guide
├── custom_components/violetden/  # HA custom integration (HACS-compatible)
│   ├── manifest.json       # HA integration manifest (domain, version, config_flow)
│   ├── __init__.py         # Integration setup: registers static JS + sidebar panel
│   ├── config_flow.py      # UI config flow: VioletDen URL input with connectivity check
│   ├── const.py            # Constants (domain, defaults)
│   ├── strings.json        # UI strings for config flow
│   ├── translations/en.json
│   └── frontend/violetden-panel.js  # Panel JS (copy of homeassistant/violetden-panel.js)
├── hacs.json               # HACS custom repository metadata
├── docker-compose.yml      # Standalone mode (3 containers)
├── docker-compose.ha.yml   # HA mode (single container)
├── Dockerfile.ha           # Multi-stage build: Vite → Express single container
├── install.sh              # Systemd service installer (Docker-based, reads .env)
├── uninstall.sh            # Service removal (--purge to delete volumes/images)
├── .env.example
└── .gitignore
```

## Key Patterns

### App Bootstrap Flow

1. `App` component calls `GET /api/setup-status` on mount (response includes `ha_mode`)
2. If `ha_mode: true`, sets HA mode in `api.js` and sends `violetden-ready` to parent
3. Listens for `postMessage` with `{ type: 'ha-auth', token }` from HA panel → calls `/api/ha-auth` → auto-login
4. If `setup_complete: false` (and not HA-authed) → render `Onboarding` (no auth required)
5. Onboarding collects username, password (with confirm), and sections → `POST /api/setup` (public, one-time endpoint)
6. If `setup_complete: true` → render `AuthWrapper` → `Dashboard`
7. `AuthWrapper` validates stored token via `GET /api/validate-token` on mount; clears stale tokens

### Authentication

- **Backend**: Bearer token sessions stored in an in-memory `Map`. Tokens are `crypto.randomBytes(32)`, 24h TTL. Rate limiting: 10 login attempts per IP per 15min.
- **Frontend**: `api.js` exports `setToken()`/`getToken()`/`api()`/`haAuth()`/`setHaMode()`/`isHaMode()`. Token stored in `sessionStorage`. All authenticated calls go through `api()` which auto-injects the Bearer header and auto-reloads on 401 (except for `/api/validate-token` and `/api/ha-auth` calls). In HA mode, 401 triggers re-auth via `postMessage` instead of page reload.
- **HA Auth**: `POST /api/ha-auth` accepts `{ ha_token }`, validates against `HA_URL/api/`, creates a VioletDen session. Auto-completes setup on first HA use (no onboarding wizard). Frontend listens for `postMessage` with `{ type: 'ha-auth', token }` from parent panel.
- **Middleware**: `requireAuth` on all endpoints except `POST /api/login`, `GET /api/sections`, `GET /api/validate-token`, `GET /api/setup-status`, `POST /api/setup`, `POST /api/ha-auth`.

### Data Storage

- SQLite via `better-sqlite3` with WAL mode. Tables:
  - `config` — key/value store (sections JSON, admin credentials, dashboard settings like `show_urls`)
  - `ssh_services` — saved servers (passwords AES-256-GCM encrypted)
  - `saved_commands` — per-server saved commands
- Encryption key auto-generated in `DATA_DIR/.violetden_secret` (mode 0600)
- Config helpers: `getConfig(key, fallback)`, `setConfig(key, value)`

### Frontend State

- No state management library — plain React `useState`/`useEffect`
- `App` checks setup status → shows Onboarding (before auth) or AuthWrapper+Dashboard
- Dashboard has view/edit modes with section and link drag-and-drop reordering
- SSHPanel manages terminal lifecycle: `activeTerminal` state with React `key` for auto-disconnect on server switch; both SSH and Telnet saved servers support interactive terminal sessions
- XTerminal wrapped in `TerminalErrorBoundary` (class component) to prevent xterm crashes from killing the UI
- Dashboard `showUrls` state loaded from `/api/dashboard-settings`; controls visibility of link URLs in view mode

### Styling

- Single CSS file (`App.css`) with CSS custom properties for the violet/dark theme
- Prefix conventions: `--v100`–`--v900` for violet shades, `--bg-*` for backgrounds
- Glass morphism via `backdrop-filter: blur()` + semi-transparent backgrounds
- Material Icons loaded from Google CDN (class `material-icons`)
- IconPicker uses `createPortal` to render dropdown into `document.body` to escape `overflow: hidden`
- xterm.js CSS imported from `@xterm/xterm/css/xterm.css`; custom theme overrides in Terminal config

### API Convention

- All endpoints under `/api/`
- Public: `POST /api/login`, `GET /api/sections`, `GET /api/validate-token`, `GET /api/setup-status`, `POST /api/setup`, `POST /api/ha-auth`
- Protected: everything else (Bearer token required)
- Request/response: JSON (`Content-Type: application/json`)
- Error shape: `{ error: "message" }` or `{ success: false, error: "message" }`
- Success shape: `{ success: true, ... }` or direct data
- WebSocket: `/ws/terminal?token=<token>` for interactive SSH/Telnet sessions

## Development

```bash
# Backend (Terminal 1)
cd backend && npm install && node index.js

# Frontend (Terminal 2)
cd frontend && npm install && npm run dev
```

Vite proxies `/api` and `/ws` (with WebSocket upgrade) to `http://localhost:4000` (configured in `vite.config.js`).

### Docker

```bash
# Standard build (standalone mode)
docker compose up --build

# Home Assistant mode (single container)
docker compose -f docker-compose.ha.yml up --build

# If build hangs on "resolving provenance"
BUILDX_NO_DEFAULT_ATTESTATIONS=1 docker compose build && docker compose up
```

### Linux Service (systemd)

`install.sh` and `uninstall.sh` wrap Docker Compose as a systemd service. No local Node.js install needed — everything runs in Docker.

```bash
sudo ./install.sh          # Standard 3-container stack
sudo ./install.sh --ha     # Same stack + HA integration (auto-detects HA network)
sudo ./uninstall.sh        # Remove service (keeps data)
sudo ./uninstall.sh --purge # Remove everything
```

The installer always uses the full 3-container stack (`docker-compose.yml`). The `--ha` flag auto-detects the HA Docker container/network, generates `docker-compose.ha.network.yml` (override that attaches the backend to HA's network and injects `HA_INTEGRATION`/`HA_URL` env vars), sets `.env` values, and prints HACS install instructions. The systemd service runs `docker compose up/down` for start/stop — no `EnvironmentFile` needed since Docker Compose reads `.env` from the `WorkingDirectory` automatically.

## Common Tasks

### Adding a new API endpoint

1. Add route in `backend/index.js`
2. Add `requireAuth` middleware if the endpoint needs authentication
3. If public, add the path to the exclusion list in `requireAuth`
4. Use `api()` from `frontend/src/api.js` to call it from the frontend

### Adding a new Settings tab

1. Create a new tab component in `frontend/src/SettingsPanel.jsx`
2. Add the tab button to the `settings-tabs` array
3. Add conditional render in `settings-body`


1. Create component in `frontend/src/`
2. Import and render in `App.jsx` (no router — all panels are inline or overlay)
3. Add styles to `App.css`

### Testing

**Always run all tests after significant changes or before submitting a pull request.**

Run backend tests:
```bash
cd backend
npx jest
```

Run frontend tests:
```bash
cd frontend
npx jest
```

Test locations:
- Backend: `backend/__tests__/` — Jest with Node environment, supertest for API endpoints
- Frontend: `frontend/src/__tests__/` — Jest with jsdom, React Testing Library

Key testing rules:
- **Run tests after every significant change** — new features, bugfixes, refactors, API changes
- **Add tests for new functionality** — every new API endpoint needs at least a happy-path and error-case test; every new component needs render and interaction tests
- **Update tests when modifying existing behavior** — if you change an endpoint's response shape or a component's UI, update the corresponding tests
- **All tests must pass before merging** — do not merge with failing tests
- Frontend mocks: `viteEnv` and `SSHPanel` are mocked in tests; CSS modules use `identity-obj-proxy`
- Backend tests share a single in-process SQLite DB; use `beforeEach` to clean up test state

## Security Notes

- SSH passwords encrypted at rest with AES-256-GCM (never stored in plaintext)
- Admin credentials stored in SQLite `config` table (not env vars at runtime)
- Certificate generation uses `execFile` (no shell injection) for openssl
- Domain input sanitized (alphanumeric, dots, hyphens only) before cert generation
- CORS configurable via `CORS_ORIGINS` env var (comma-separated origins)
- Onboarding uses a one-time public endpoint (`/api/setup`); blocked once credentials exist in DB
- Token validation on mount catches stale sessions after backend restarts
- SSL: self-signed certs auto-generated on first run; optional Let's Encrypt via DNS-01 (acme.sh) for trusted certs behind firewall
