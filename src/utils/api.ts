// src/utils/api.ts

export const API_BASE_URL = import.meta.env.VITE_API_URL

/**
 * A wrapper around the native `fetch` function that automatically adds
 * the 'Content-Type' and 'x-auth-token' headers for authenticated requests.
 * @param endpoint The API endpoint (e.g., '/settings')
 * @param options The standard fetch options object
 * @returns A Promise that resolves to the Response object
 */
export const api = (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('fexo-token');
  
  const headers = new Headers(options.headers || {});
  
  // Set default content type if not already provided and there's a body
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Add the auth token to the headers if it exists
  if (token) {
    headers.set('x-auth-token', token);
  }
  
  const config: RequestInit = {
    ...options,
    headers,
  };
  
  // --- UPDATED: Construct the full URL. If API_BASE_URL is '', it becomes a relative path. ---
  return fetch(`${API_BASE_URL}/api${endpoint}`, config);
};

export default api;