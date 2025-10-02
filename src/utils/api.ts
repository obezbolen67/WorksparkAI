// src/utils/api.ts

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://worksparkaiserver-215678188656.europe-west1.run.app';
console.log(API_BASE_URL)

/**
 * A wrapper around the native `fetch` function that automatically adds
 * the 'Content-Type' and 'x-auth-token' headers for authenticated JSON requests.
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

  return fetch(`${API_BASE_URL}/api${endpoint}`, config);
};

/**
 * A dedicated function for uploading a single file using FormData.
 * @param file The file object to upload.
 * @returns A Promise that resolves to the JSON response from the server.
 */
export const uploadFile = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file); // 'file' must match the key in multer's upload.single('file')

  const token = localStorage.getItem('fexo-token');
  const headers = new Headers();
  if (token) {
    headers.set('x-auth-token', token);
  }

  const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: 'POST',
    headers: headers, // NOTE: Do NOT set Content-Type, the browser does it for FormData
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Failed to upload file');
  }

  return response.json();
};

export default api;