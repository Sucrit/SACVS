1. **Analyze performance bottleneck**:
The `AdminDashboard` component renders a large report and queries for "RiskCardDeltas" inside a `useEffect` on the frontend side. It fetches up to `1000` rows using `RiskService.list()` just to calculate standard counter deltas (`pendingReview`, `highRisk`, `criticalRisk`, `confirmedAbuse`). This leads to a huge payload being sent to the client and expensive processing in the browser.
2. **Implement server-side delta counts**:
Add a new endpoint `GET /risk-events/summary-deltas` to the backend `security-service` (`backend/services/security-service/src/routes/risk.routes.ts`).
Implement `getRiskSummaryDeltas` in `RiskController` which queries the database efficiently using `prisma.riskEventRecord.groupBy` or multiple `.count()` queries bounded by date ranges.
3. **Update Frontend Service**:
Add a new method `getSummaryDeltas` to `frontend/src/services/risk.service.ts` to call this new endpoint.
4. **Update Frontend Component**:
Modify `frontend/src/pages/Admin/useAdminDashboardState.ts` and `frontend/src/pages/Admin/AdminDashboard.tsx`. Replace the expensive `RiskService.list({ page: 1, pageSize: Math.max(riskTotal, 1000) })` logic with a direct call to `RiskService.getSummaryDeltas()`.
