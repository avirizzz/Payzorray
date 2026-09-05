const { supabase } = require('./index');
const fs = require('fs');
const path = require('path');
const { embedQuery } = require('../services/ai/embeddings');

let mockProducts = [
  { product_id: 'HW-R33-001', name: 'Skyline R33', price: 1999, stock: 5, category: 'Hot Wheels', brand: 'Nissan', tags: ['nissan', 'r33'] },
  { product_id: 'HW-R34-001', name: 'Skyline R34', price: 2299, stock: 4, category: 'Hot Wheels', brand: 'Nissan', tags: ['nissan', 'r34'] }
];

function updateMockProductStock(id, newStock) {
  const p = mockProducts.find(x => x.product_id === id);
  if (p) p.stock = newStock;
}

function calculateHybridScore(semantic, keyword, metadata) {
  return (0.55 * semantic) + (0.25 * keyword) + (0.20 * metadata);
}

async function searchProducts(searchStrings, filters = {}) {
  const isMockMode = !process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co';
  const primarySearchString = searchStrings[0]?.toLowerCase() || '';

  let candidates = [];
  let similarityByProductId = null;

  if (isMockMode) {
    candidates = [...mockProducts];
    if (filters.category) candidates = candidates.filter(p => p.category === filters.category);
    if (filters.brand) candidates = candidates.filter(p => p.brand === filters.brand);
  } else if (primarySearchString) {
    const queryEmbedding = await embedQuery(primarySearchString);
    const { data, error } = await supabase.rpc('match_products', {
      query_embedding: queryEmbedding,
      match_count: 20,
      filter_category: filters.category || null,
      filter_brand: filters.brand || null,
      filter_max_price: filters.max_price ?? null
    });
    if (error) throw error;
    candidates = data || [];
    similarityByProductId = new Map(candidates.map(p => [p.product_id, p.similarity]));
  } else {
    let query = supabase.from('products').select('*');
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.brand) query = query.eq('brand', filters.brand);
    const { data, error } = await query;
    if (error) throw error;
    candidates = data || [];
  }

  const scored = candidates.map(p => {
    const S_semantic = similarityByProductId ? similarityByProductId.get(p.product_id) : 1.0;
    const nameLower = p.name.toLowerCase();
    const tagsLower = p.tags.map(t => t.toLowerCase());
    const hasKeyword = nameLower.includes(primarySearchString) || tagsLower.includes(primarySearchString);
    const S_keyword = hasKeyword ? 1.0 : 0.4;
    let S_meta = 1.0;
    if (filters.max_price && p.price > filters.max_price) S_meta = 0.0;

    const finalScore = calculateHybridScore(S_semantic, S_keyword, S_meta);
    return { ...p, _score: finalScore };
  });

  return scored.sort((a, b) => b._score - a._score).slice(0, 20);
}

const BROWSE_COLUMNS = 'product_id, name, category, brand, model, variant, specifications, description, tags, price, currency, stock, images, product_relationships, compatibility, bundle_relationships, merchant_id, updated_at';

const SORT_COLUMNS = {
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
  name_asc: { column: 'name', ascending: true }
};

async function browseProducts(filters = {}, { sort, limit = 24, offset = 0 } = {}) {
  const isMockMode = !process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co';

  if (isMockMode) {
    let candidates = [...mockProducts];
    if (filters.category) candidates = candidates.filter((p) => p.category === filters.category);
    if (filters.brand) candidates = candidates.filter((p) => p.brand === filters.brand);
    return { data: candidates.slice(offset, offset + limit), total: candidates.length };
  }

  let query = supabase.from('products').select(BROWSE_COLUMNS, { count: 'exact' });
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.manufacturer) query = query.eq('specifications->>manufacturer', filters.manufacturer);
  if (filters.tags?.length) query = query.contains('tags', filters.tags);
  if (filters.min_price != null) query = query.gte('price', filters.min_price);
  if (filters.max_price != null) query = query.lte('price', filters.max_price);

  const sortSpec = SORT_COLUMNS[sort];
  query = sortSpec ? query.order(sortSpec.column, { ascending: sortSpec.ascending }) : query.order('product_id', { ascending: true });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count ?? 0 };
}

async function getCatalogFacets() {
  const isMockMode = !process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co';
  if (isMockMode) return { categories: [], manufacturers: [], tags: [] };

  const { data, error } = await supabase.from('products').select('category, specifications, tags');
  if (error) throw error;

  const categories = new Set();
  const manufacturers = new Set();
  const tags = new Set();
  for (const p of data || []) {
    if (p.category) categories.add(p.category);
    if (p.specifications?.manufacturer) manufacturers.add(p.specifications.manufacturer);
    (p.tags || []).forEach((t) => tags.add(t));
  }

  return {
    categories: [...categories].sort(),
    manufacturers: [...manufacturers].sort(),
    tags: [...tags].sort()
  };
}

async function getProductById(productId) {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co' || !process.env.SUPABASE_URL) {
    return mockProducts.find(p => p.product_id === productId);
  }
  // .maybeSingle(), not .single() — missing row must resolve to null.
  const { data, error } = await supabase
    .from('products')
    .select('product_id, name, category, brand, model, variant, specifications, description, tags, price, currency, stock, images, product_relationships, compatibility, bundle_relationships, merchant_id, updated_at')
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchProductsByMerchantId(merchantId) {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co') {
    return mockProducts.filter((p) => p.merchant_id === merchantId);
  }
  const { data, error } = await supabase
    .from('products')
    .select('product_id, name, category, brand, model, variant, specifications, description, tags, price, currency, stock, images, merchant_id, updated_at')
    .eq('merchant_id', merchantId);
  if (error) throw error;
  return data || [];
}

async function listDistinctMerchantIds() {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'https://placeholder.supabase.co') {
    return [...new Set(mockProducts.map((p) => p.merchant_id))];
  }
  const { data, error } = await supabase.from('products').select('merchant_id');
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.merchant_id))];
}

async function getMultiSourceContext() {
  const policiesPath = path.join(__dirname, 'policies.json');
  if (fs.existsSync(policiesPath)) {
    return JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
  }
  return { merchant: { policies: "Mock Policy" } };
}

module.exports = {
  searchProducts,
  browseProducts,
  getCatalogFacets,
  getProductById,
  getMultiSourceContext,
  updateMockProductStock,
  fetchProductsByMerchantId,
  listDistinctMerchantIds
};
