import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Request Interceptor: Add Auth Token and Trailing Slash
api.interceptors.request.use(
  (config) => {
    // 1. Ensure trailing slash for consistent backend routing (ONLY if not a file or query)
    if (config.url && !config.url.endsWith('/') && !config.url.includes('?') && !config.url.includes('.')) {
      config.url += '/';
    }

    // 2. Add Authorization header
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.access_token) {
          config.headers.Authorization = `Bearer ${user.access_token}`;
        }
      } catch (e) {}
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Global Errors (like 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Covers an expired session and the 2FA guards (MFA_REQUIRED /
      // MFA_ENROLMENT_REQUIRED) - either way the user has to sign in again.
      localStorage.removeItem('user');
      const onLoginPage = window.location.pathname.startsWith('/login');
      const isAuthCall = (error.config?.url || '').includes('auth/');
      if (!onLoginPage && !isAuthCall) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
