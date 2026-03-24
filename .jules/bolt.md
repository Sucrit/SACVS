## 2024-05-18 - Admin Dashboard Search Optimization
**Learning:** Dense operational screens like the Admin Dashboard perform heavy array mapping and string concatenation on every keystroke when filtering large datasets (e.g., users).
**Action:** Always pre-compute and memoize expensive searchable string combinations into a Map keyed by entity ID when the base dataset loads, rather than rebuilding them on every filter change.

2024-03-24 - [Duplicate Prisma count aggregations]
Learning: Backend dashboard endpoints like `listRiskEventRecords` can accidentally run multiple parallel `prisma.count` queries for specific status/band labels, which wastes DB overhead.
Action: Replace 4-5 static `count` queries with 1 or 2 `prisma.groupBy` queries to gather all enum stats in one pass and parse them locally.
