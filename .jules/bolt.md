## 2024-05-18 - Admin Dashboard Search Optimization
**Learning:** Dense operational screens like the Admin Dashboard perform heavy array mapping and string concatenation on every keystroke when filtering large datasets (e.g., users).
**Action:** Always pre-compute and memoize expensive searchable string combinations into a Map keyed by entity ID when the base dataset loads, rather than rebuilding them on every filter change.
