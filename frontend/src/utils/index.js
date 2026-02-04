const pageRoutes = {
  Home: '/',
  StudentDashboard: '/student-dashboard',
  InstitutionDashboard: '/institution-dashboard',
  EmployerDashboard: '/employer-dashboard',
  EmployeeDashboard: '/employee-dashboard',
  AdminDashboard: '/admin-dashboard',
};

export function createPageUrl(pageName) {
  return pageRoutes[pageName] || '/';
}

export const pageNameByPath = Object.fromEntries(
  Object.entries(pageRoutes).map(([name, path]) => [path, name])
);
