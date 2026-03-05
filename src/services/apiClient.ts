import axios from 'axios';
import { authService } from './AuthService';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// --- Axios instance with auth ---
export const authAxios = axios.create({
  baseURL: API_BASE,
});

// Request interceptor: inject Bearer token
authAxios.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: clear stale token on 401
authAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.clearAuth();
    }
    return Promise.reject(error);
  }
);

// --- Fetch wrapper with auth ---
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = authService.getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    authService.clearAuth();
  }

  return response;
}
