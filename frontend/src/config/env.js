export const ENV = {
  GATEWAY_URL: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000',
  CLERK_PUBLISHABLE_KEY: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim(),
  CLERK_ADMIN_PUBLISHABLE_KEY: (import.meta.env.VITE_CLERK_ADMIN_PUBLISHABLE_KEY || '').trim(),
};
