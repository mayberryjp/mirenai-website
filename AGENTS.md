# mirenai-website — AI agent guide

Management UI (Vue 3 + Vuetify 3 + Pinia + vue-router, TypeScript, Vite) for the
mirenai DNS server. See [README.md](README.md) for setup, the full command table,
env vars, and project layout — this file covers only what guides code changes.

## Commands

Full list in [README.md](README.md#commands). After any change, run and keep clean:

- `npm run typecheck` (vue-tsc) and `npm run lint` (eslint) — both must pass.
- Tests: `npm run test:unit` (vitest), `npm run test:e2e` (playwright).
- Dev server: `npm run dev` (port 3030, strict). Auto-fix lint: `npm run lint:fix`.

## Architecture & layering

- **HTTP lives only in `src/services/*.ts`.** Components and stores never call
  axios directly. Each service wraps the shared instance in
  [src/services/api.ts](src/services/api.ts) and unwraps the response envelope,
  returning domain data (not the raw `{ status: "ok", ... }`). Pattern:
  [src/services/policies.ts](src/services/policies.ts).
- **Stores** (`src/stores/*.ts`) are Pinia *setup* stores exposing a
  `{ items…, total, loading, error, load(), … }` contract. `load()` toggles
  `loading` and traps `error`; write actions (`create/update/remove`) let errors
  propagate (so dialogs can surface 409/422 detail), then re-`load()`. Pattern:
  [src/stores/policies.ts](src/stores/policies.ts).
- **Views** (`src/views/`) are route-level pages; **components** split into
  `base/` (reusable) + feature folders. Routes are split into
  [privateRoutes](src/router/routes/privateRoutes.ts) + `errorRoutes`; settings
  tabs are nested child routes (e.g. `/settings/upstreams`), not internal state.
- **Types**: response envelopes in [src/types/api.ts](src/types/api.ts), domain
  models in [src/types/domain.ts](src/types/domain.ts).
- Path alias: `@` → `src`. Vuetify/ApexCharts are registered globally in
  [src/main.ts](src/main.ts) (`<apexchart>` needs no import).

## Conventions (differ from defaults — follow them)

- **TypeScript, strictly.** SFCs use `<script setup lang="ts">`; props via
  `withDefaults(defineProps<{…}>(), {…})`. ESLint `@typescript-eslint/no-explicit-any`
  is an **error** — never use `any`.
- **Error handling branches on the stable `code` field, not the message.**
  Normalize with `getApiError` / `apiErrorMessage` from
  [src/services/errors.ts](src/services/errors.ts).
- **Timestamps are container-local wall-clock with no offset — do NOT treat as
  UTC or convert timezones.** Format the raw parts (see `formatDateTime` in the
  dashboard tables).
- **All data tables share one look** ("app-table"): outer
  `<v-sheet rounded="lg" color="#090c10">`, `<v-data-table density="compact"
  class="app-table">`, title `text-h6 text-sm-h5 text-md-h4` in `#b1b8c0`. Generic
  table CSS is global in
  [src/assets/styles/app-table.css](src/assets/styles/app-table.css) — put shared
  table styling there, not per-component.
- Style: double quotes, semicolons, 2-space indent. Comment only what the code
  can't show, in one line.

## Gotchas

- **Renaming or adding a runtime env var key is a BREAKING change.** The API
  origin (`MIRENAI_API_BASE_URL`) is baked as a placeholder and rewritten at
  container start by `env.sh`; the deployment `docker-compose.yml` / `.env` lives
  **outside this repo**. If you change the key, loudly flag it as a deploy action
  item the user must apply themselves.
- **The backend often lags the frontend.** Some endpoints (e.g. `/stats/runtime`,
  `/stats/new-domains`, `/upstreams/{id}/check`) may 404/405. When a feature needs
  a new route, wire the service + types correctly and flag the backend dependency
  to the user instead of assuming it exists.
- **Do only what is asked** — no unrequested "while I'm here" refactors, extra
  columns, or features. Stay within this workspace; don't edit sibling repos.
