import axios from 'axios';

interface ImportMeta {
  readonly env: {
    readonly VITE_API_URL?: string;
    [key: string]: string | undefined;
  };
}

// Standard Vite env access
const VITE_API_URL = import.meta.env.VITE_API_URL;
const FALLBACK_API_URL = 'https://strat-edge-api.onrender.com';

const api = axios.create({
  baseURL: VITE_API_URL || FALLBACK_API_URL,
});

console.log('--- API CONFIGURATION ---');
console.log('VITE_API_URL:', VITE_API_URL);
console.log('Final BaseURL:', api.defaults.baseURL);
console.log('-------------------------');

// Request Interceptor: Add Auth Token and Trailing Slash
api.interceptors.request.use(
  (config) => {
    const fullUrl = `${config.baseURL || ''}/${config.url}`;
    console.log(`API Request Started: ${config.method?.toUpperCase()} ${fullUrl}`);
    
    // 1. Ensure trailing slash for consistent backend routing (FastAPI preference)
    if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
      config.url += '/';
    }
 else if (config.url && config.url.includes('?')) {
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
        console.error('Failed to parse user from localStorage', e);
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
      console.warn('Unauthorized access detected. Clearing session.');
      localStorage.removeItem('user');
      // window.location.href = '/login'; // Optional: Redirect to login
    }
    return Promise.reject(error);
  }
);

export default api;
