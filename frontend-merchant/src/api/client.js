const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  return /^https?:\/\//.test(imagePath) ? imagePath : `${API_BASE_URL}${imagePath}`;
}

export function getPlaceholderImageUrl(name) {
  const text = encodeURIComponent(name || 'Product');
  return `https://placehold.co/400x300/012652/FFFFFF?text=${text}`;
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}
