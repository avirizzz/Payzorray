const SEARCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000;

function isConfigured() {
  return !!process.env.TAVILY_API_KEY;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown source';
  }
}

const cache = new Map();

function cacheKey(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function searchWeb(query, { maxResults = 4 } = {}) {
  if (!isConfigured()) {
    throw new Error('Web search is not configured (TAVILY_API_KEY missing) -- cannot search the web right now.');
  }

  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.results;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_images: true,
        max_results: maxResults
      })
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Web search timed out.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const images = Array.isArray(data.images) ? data.images : [];

  const results = (data.results || []).slice(0, maxResults).map((r, i) => ({
    title: r.title,
    url: r.url,
    source: hostnameOf(r.url),
    snippet: (r.content || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    image: images[i] || null,
    purchasable: false
  }));

  cache.set(key, { results, at: Date.now() });
  return results;
}

module.exports = { searchWeb, isConfigured };
