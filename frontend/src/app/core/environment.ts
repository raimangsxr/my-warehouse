const defaultApiBaseUrl = '/api/v1';

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return defaultApiBaseUrl;
  }

  const isLocalDev =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '4200';

  return isLocalDev ? 'http://localhost:8000/api/v1' : defaultApiBaseUrl;
}

export const environment = {
  apiBaseUrl: resolveApiBaseUrl(),
};
