<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- App chrome (sidebar, mobile sheet nav) lives in `src/components/layout/AppShell.tsx`, wrapped around `<Outlet />` in `__root.tsx`; nav items are defined once in `layout/nav.ts` so desktop and mobile stay in sync.
- Pages compose `PageHeader` / `PageBody` / `Section` from `layout/Page.tsx` for consistent spacing.
- Risk status always renders via `RiskBadge` (icon + text) so meaning never relies on color alone.
- Demo orders live in `src/data/demo-orders.ts` (dates as offsets from today); all risk scoring, fulfillment staging and summaries come from `src/lib/risk.ts` so every page derives numbers from one source.
- Order search/filter/sort logic lives in `src/lib/order-filters.ts`; Order Risk Monitor filters are URL search params parsed by `parseFilters`. Order tables are shared from `src/components/orders/`; order IDs link to `/orders/$orderId` (with `from` search param for the return path). Factor meanings, recommendations and timeline stages are derived in `src/lib/risk.ts`.
- Analytics reuses `summarize`, `statusDistribution` and `RULE_SIGNALS` from `src/lib/risk.ts`; charts use the dependency-free `components/analytics/Distribution` (bar + text list).
- Intervention state is in-memory React context (`InterventionsProvider` in `__root.tsx`) seeded from `demoInterventions`; pure update/create/dedupe logic lives in `src/lib/interventions.ts`. No persistence yet by design (no backend in scope).
- ML-preparation code lives in `src/ml/` (schema, labels, generator, quality) and is never imported by UI routes, keeping synthetic training data out of the browser bundle and separate from the UI demo orders. Model inputs must come only from `extractFeatures`.
- ML predictions call the external SYNOVA ML API only through `src/lib/ml-api.ts` (categorical vocabularies imported from `src/ml/schema.ts` constants, because the API silently ignores unknown categories), relayed by the `mlProxy` server function which alone picks the destination host, because the API has no CORS headers (feature mapping, validation, typed errors) and only on explicit user action; orders without recorded model inputs (`mlContext`) are refused, never defaulted. ML output never replaces the rule score.
- Auth uses Lovable Cloud: platform pages live under the pathless `src/routes/_authenticated/` layout (client-only `getUser()` gate, renders `AppShell`); `/auth` and `/register` are public. "Explore Demo" uses anonymous guest sessions so no shared demo credentials exist in code. Pure guard/redirect/error/sign-out logic lives in `src/lib/auth.ts` for testability.
