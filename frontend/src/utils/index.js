const pageRoutes = {
  Home: '/',
  StudentDashboard: '/student-dashboard',
  InstitutionDashboard: '/institution-dashboard',
  RegistrarDashboard: '/registrar-dashboard',
  RegistrarVerificationDashboard: '/registrar-verification-dashboard',
  AdminDashboard: '/admin-dashboard',
};

export function createPageUrl(pageName) {
  return pageRoutes[pageName] || '/';
}

export const pageNameByPath = Object.fromEntries(
  Object.entries(pageRoutes).map(([name, path]) => [path, name])
);
