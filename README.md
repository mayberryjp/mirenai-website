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
- **Settings > Notifications** (`/settings/notifications`) configures Discord
  discovery alerts through `GET /settings` and changed-field `PUT /settings`.
  The webhook is masked by default and kept only in memory; disabling retains
  it, while clearing an enabled webhook requires disabling in the same save.
  Saves persist configuration, not webhook connectivity or delivery status.
  The backend must expose `discord_notifications_enabled`, `discord_webhook_url`,
  and `discord_query_types`. Query-type toggles come from the returned flag map:
  all types appear equally in one searchable grid with the total count.
  Turning global notifications on selects every returned type; users can then
  deselect individual types before saving. Reopening preserves saved exclusions.
  Only changed flags are sent, and controls remain editable while globally disabled.
  Disabled types do not consume eligibility: a later selected-type query can
  alert once for that client/domain pair. Type changes never replay prior queries
  and do not affect DNS resolution or the newly-seen feed.
  Client **New-domain monitoring** uses `PUT /hosts/{id}` with
  `new_domain_monitoring` and controls both the newly-seen feed and alerts.
  Historical and disabled-period discoveries are not replayed on enable.
- Upstream dialogs support optional DNS over TLS (`use_tls`, default `false`) and
  require `tls_server_name` when enabled for certificate and hostname verification.
  TLS does not fall back to plain DNS. Toggling TLS switches the standard port
  between 53 and 853, preserving custom ports; saves explicitly include the port
  because `PUT /upstreams/{id}` otherwise preserves the existing one. The backend
  must support these per-upstream TLS fields for encrypted forwarding and health checks.
- Timestamps are container-local wall-clock (no timezone offset) — do not treat as UTC.
- Blocklist domain lists can be huge and are always paginated.
- **Settings > Policy Denied** (`/settings/policy-denied`), between Blocklist
  Activity and Spoofed, shows an Apex line chart of the latest 100 hourly `denied`
  counts from `GET /stats/site?limit=100`, matching Blocklist Activity's chart
  design, and locally paginated top policy-denied domains.
  `GET /queries/top-denied?limit=100` returns
  `{ status: "ok", domains: [...], total: number }`, where each domain includes
  `domain`, `count`, `clients: [{ client, count }]`, `first_seen`, and `last_seen`.
  The service also supports an optional exact-IP `client` filter before ranking;
  the API has no offset parameter. Domains and clients rank by denial count
  descending, alphabetically for ties; `total` is the number returned after the limit.
  Counts include explicit and default policy denies across query types, exclude
  blocklist denials, and survive restarts and later policy changes. Timestamps
  are the first/last denial in container-local wall-clock time.
  Counting starts at backend deployment without historical backfill; updates
  follow the query-flush timer (default 5 seconds). Clearing queries clears the
  denial history, and deleting a host clears that host's history.
  API errors remain independent of hourly data.
  The shared Inherit / Allow / Block / Spoof editor uses the existing policy API
  for exact client/domain overrides, without modifying global or wildcard rules.
- `DELETE /queries` clears the whole log and is guarded behind a confirmation.
- In client details, **Allow All** sets an explicit Allow override for the domains
  on the current Domain Queries & Policy Override table page, respecting filters
  and sorting at click time. Other pages are not included; failed saves are shown
  without undoing successful changes.
