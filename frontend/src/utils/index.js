const pageRoutes = {
  Home: '/',
  StudentDashboard: '/student-dashboard',
  RegistrarDashboard: '/registrar-dashboard',
  RegistrarIssuingDashboard: '/registrar-issuing-dashboard',
  RegistrarVerificationDashboard: '/registrar-verification-dashboard',
  AdminDashboard: '/admin-dashboard',
  PendingApproval: '/pending-approval',
};

export function createPageUrl(pageName) {
  return pageRoutes[pageName] || '/';
}

export const pageNameByPath = Object.fromEntries(
  Object.entries(pageRoutes).map(([name, path]) => [path, name])
);
