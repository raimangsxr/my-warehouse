import { describe, expect, it } from 'vitest';

import { routes } from './routes';

describe('routes', () => {
  it('defines guest auth routes', () => {
    const guestPaths = routes.filter((route) => route.path === 'login' || route.path === 'signup');
    expect(guestPaths).toHaveLength(2);
    expect(guestPaths.every((route) => route.canActivate?.length)).toBe(true);
  });

  it('defines authenticated app shell with warehouse guard', () => {
    const appRoute = routes.find((route) => route.path === 'app');
    expect(appRoute?.canActivate).toEqual(expect.arrayContaining([expect.any(Function), expect.any(Function)]));
    expect(appRoute?.children?.some((child) => child.path === 'home')).toBe(true);
    expect(appRoute?.children?.some((child) => child.path === 'settings')).toBe(true);
  });

  it('redirects root path to login', () => {
    const rootRoute = routes.find((route) => route.path === '');
    expect(rootRoute?.redirectTo).toBe('login');
  });
});
