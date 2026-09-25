# mirenai frontend

Management UI for the **mirenai** DNS server, built per the team frontend standards:
Vue 3 + Vite + Vuetify + Vue Router + Pinia + TypeScript.

It manages policies, upstream resolvers, blocklists, the query log, and runtime settings
via the mirenai HTTP API.

## Prerequisites

- Node.js 20+
- The mirenai API running (default `http://localhost:8000`)

## Environment

Copy `.env.example` to `.env` and adjust as needed. Defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | *(empty)* | API origin. **Leave empty** to route through the `/api` reverse proxy (Vite in dev, nginx in prod). Set an absolute origin only to bypass the proxy. |
| `VITE_APP_NAME` | `mirenai` | Display name. |
| `VITE_APP_ENV` | `development` | Environment label. |

The API client calls `${VITE_API_BASE_URL}/api/...`; the dev proxy and nginx both strip the
`/api` prefix before forwarding to mirenai (whose paths are exact, e.g. `/policies`).

## Commands

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Dev server (port 3030) | `npm run dev` |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| E2E tests | `npm run test:e2e` |
| Build | `npm run build` |
| Docker build | `docker build -t mirenai-frontend:dev .` |
| Docker run | `docker compose up` |

## Project layout

```
src/
  components/   # base/ (reusable UI) + layout/ (app shell)
  plugins/      # vuetify theme
  router/       # split public/private/error routes
  services/     # the only place HTTP calls live (api client + domain modules)
  stores/       # Pinia stores (loading/error contract)
  types/        # api envelopes + domain models
  views/        # route-level pages
tests/          # unit/ component/ e2e/
```

## API integration

See the mirenai frontend-integration spec for the full contract. Notes:

- No auth; CORS is open.
- Errors are mapped on the stable `code` field, not the human message.
- Timestamps are container-local wall-clock (no timezone offset) — do not treat as UTC.
- Blocklist domain lists can be huge and are always paginated.
- `DELETE /queries` clears the whole log and is guarded behind a confirmation.
