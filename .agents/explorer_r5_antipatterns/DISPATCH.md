## 2026-08-28T13:37:45Z
You are Explorer R5 auditing Performance, Leaks & Anti-Patterns across GSA HUB Realtime.

Read the authoritative requirements at:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md`

Your working directory is:
`c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\explorer_r5_antipatterns`

Your mission:
Conduct an exhaustive search for the 7 key realtime anti-patterns across the codebase:
1. **Broadcast without filter on large tables**: Subscribing to `*` on tables like `pedidos`, `clientes`, `faturas`, `transacoes`, `logs` without tenant/user `filter: '...'`.
2. **Unstable channel names**: Generating channel names with `Date.now()`, `Math.random()`, or inline unmemoized template strings in render loops, triggering infinite re-subscriptions.
3. **Missing cleanup**: Subscribing without removing channel on unmount (`supabase.removeChannel` missing or unreturned in `useEffect`).
4. **Double subscription**: Same component subscribing to the same table twice (or multiple hooks running overlapping subscriptions).
5. **Unstable onChange callbacks**: Passing unmemoized inline functions to `onChange` / `callback`, forcing channel teardown/rebuild on every render.
6. **Masked polling**: Using `setInterval` / `setTimeout` for continuous polling instead of genuine Realtime CDC.
7. **Realtime in inactive components**: Subscriptions remaining active inside closed modals, collapsed drawers, or hidden tabs.

For each anti-pattern instance found:
- File path and line numbers
- Code excerpt
- Anti-pattern category & severity (🔴 Crítico, 🟡 Alerta)
- Concrete remediation with code snippet

Deliverables:
- Write `analysis.md` in your working directory.
- Write `handoff.md` and send message to parent when complete.
