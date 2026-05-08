import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
});

// Global response error interceptor
api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error || error.message || 'Unknown error';
    const status  = error.response?.status;

    if (status === 401) {
      // Session expired or cookie missing — redirect to login
      const current = window.location.pathname;
      if (current !== '/login' && current !== '/setup') {
        window.location.href = `/login?from=${encodeURIComponent(current)}`;
      }
      return Promise.reject(error);
    }

    toast.error(message);

    // Log 5xx errors to backend error log
    if (status >= 500) {
      api.post('/errors', {
        level:   'error',
        source:  'frontend',
        message: `API ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}: ${message}`,
        url:     window.location.pathname,
      }).catch(() => {});
    }

    return Promise.reject(error);
  }
);

export default api;
