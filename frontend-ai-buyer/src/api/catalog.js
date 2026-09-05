import { apiFetch } from './client';

export async function getProduct(productId) {
  const { data, policies } = await apiFetch(`/catalog/products/${encodeURIComponent(productId)}`);
  return { product: data, policies };
}

export async function findVariants(model, excludeProductId) {
  const { data } = await apiFetch(`/catalog/search?query=${encodeURIComponent(model)}`);
  return (data || []).filter((p) => p.model === model && p.product_id !== excludeProductId);
}
