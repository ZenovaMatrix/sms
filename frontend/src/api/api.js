import axios from 'axios';

// Prioritize environment variable VITE_API_BASE_URL in production, fallback to '/api/v1' for local Vite proxy
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const baseURL = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : (rawBaseUrl.replace(/\/+$/, '') + '/api/v1');

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('edu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler – redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('edu_token');
      localStorage.removeItem('edu_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
