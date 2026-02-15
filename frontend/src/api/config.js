/**
 * API base URL for backend requests.
 * Use current page origin so /api is proxied by Vite to the backend.
 * (VITE_API_URL=http://backend:5000 fails - "backend" is a Docker hostname the browser cannot resolve.)
 */
export const API =
  typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_API_URL || '')
