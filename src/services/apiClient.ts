import axios from 'axios';
import { authService } from './AuthService';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

// --- Axios instance with cookie-based auth ---
export const authAxios = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Response interceptor: clear stale auth on 401
authAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.clearAuth();
    }
    return Promise.reject(error);
  }
);

// --- Fetch wrapper with cookie-based auth ---
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  if (response.status === 401) {
    authService.clearAuth();
  }

  return response;
}
