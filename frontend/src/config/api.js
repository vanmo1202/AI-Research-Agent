const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!apiBaseUrl && import.meta.env.PROD) {
  throw new Error('VITE_API_BASE_URL is required for production builds.');
}

export const API_BASE_URL = (apiBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
