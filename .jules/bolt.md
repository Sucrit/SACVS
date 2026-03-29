## 2024-05-18 - Admin Dashboard Search Optimization
**Learning:** Dense operational screens like the Admin Dashboard perform heavy array mapping and string concatenation on every keystroke when filtering large datasets (e.g., users).
**Action:** Always pre-compute and memoize expensive searchable string combinations into a Map keyed by entity ID when the base dataset loads, rather than rebuilding them on every filter change.

2024-10-06 - Admin Dashboard React Render Performance
Learning: Dense operational screens like AdminOverviewSection contain large arrays (e.g., users, credentialRequests, riskEvents). Scanning these arrays to compute dashboard counts and sparkline metrics directly in the component body blocks the main thread on every render, making the UI sluggish on unrelated state updates.
Action: Always wrap O(N) array transformations and derived metric calculations in `useMemo` hooks with tight dependencies before rendering them in dashboard shells.
