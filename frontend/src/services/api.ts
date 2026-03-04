import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Request Interceptor: Add Auth Token and Trailing Slash
api.interceptors.request.use(
  (config) => {
    // 1. Ensure trailing slash for consistent backend routing (FastAPI preference)
    if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
      config.url += '/';
    } else if (config.url && config.url.includes('?')) {
      const [path, query] = config.url.split('?');
      if (!path.endsWith('/')) {
        config.url = `${path}/?${query}`;
      }
    }

    // 2. Add Authorization header
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.access_token) {
          config.headers.Authorization = `Bearer ${user.access_token}`;
        }
      } catch (e) {
        // Silent fail for user parse
      }
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
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
