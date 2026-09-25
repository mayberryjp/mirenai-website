# mirenai frontend

Management UI for the **mirenai** DNS server, built per the team frontend standards:
Vue 3 + Vite + Vuetify + Vue Router + Pinia + TypeScript.

It manages policies, upstream resolvers, blocklists, the query log, and runtime settings
via the mirenai HTTP API.

## Prerequisites

- Node.js 20+
- The mirenai API running (default `http://localhost:8000`)

## Environment

The mirenai API origin is set at **runtime**, not baked at build. The image bakes a
`MIRENAI_API_BASE_URL` placeholder into the bundle; at container start `env.sh` (run from
nginx's `/docker-entrypoint.d/`) rewrites it from the container's `MIRENAI_API_BASE_URL`
environment variable — so one image works across environments with no rebuild.

| Variable | Where | Purpose |
| --- | --- | --- |
| `MIRENAI_API_BASE_URL` | container runtime (`docker-compose.yml`) | mirenai API origin the browser calls directly (open CORS). |
| `VITE_API_BASE_URL` | local dev only | Override for `npm run dev`; defaults to `http://localhost:8000`. |

The API client calls `${MIRENAI_API_BASE_URL}/policies`, `/upstreams`, etc. — mirenai paths
are used exactly as documented, with no `/api` prefix.

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
| Docker build | `docker build -t mirenai-website:dev .` |
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
