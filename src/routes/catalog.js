const express = require('express');
const router = express.Router();

const { searchProducts, browseProducts, getCatalogFacets, getProductById, getMultiSourceContext } = require('../db/retrieval');
const { rewriteQuery } = require('../services/ai/rewriter');
const { narrateSearchResults } = require('../services/ai/narrate');
const { isValidProduct } = require('../services/core/constraints');

router.get('/search', async (req, res) => {
  try {
    const { category, brand, max_price, query } = req.query;
    
    let searchStrings = [query].filter(Boolean);
    let filters = { category, brand, max_price: max_price ? Number(max_price) : undefined };

    if (query && !category && !brand) {
      const rewritten = await rewriteQuery(query);
      searchStrings = rewritten.search_strings || searchStrings;

      if (rewritten.intent?.hard_constraints?.max_price) {
         filters.max_price = Number(rewritten.intent.hard_constraints.max_price);
      }
    }

    const candidates = await searchProducts(searchStrings, filters);
    
    const validCandidates = candidates.filter(p => isValidProduct(p, { max_price: filters.max_price }));

    let narration = null;
    if (req.query.narrate && query) {
      narration = await narrateSearchResults(query, validCandidates.slice(0, 4));
    }

    res.json({ data: validCandidates, narration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/browse', async (req, res) => {
  try {
    const { category, manufacturer, tags, min_price, max_price, sort, limit, offset } = req.query;

    const filters = {
      category: category || undefined,
      manufacturer: manufacturer || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      min_price: min_price ? Number(min_price) : undefined,
      max_price: max_price ? Number(max_price) : undefined
    };

    const { data, total } = await browseProducts(filters, {
      sort,
      limit: limit ? Math.min(Number(limit), 100) : 24,
      offset: offset ? Number(offset) : 0
    });

    res.json({ data, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/facets', async (req, res) => {
  try {
    const facets = await getCatalogFacets();
    res.json({ data: facets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    const context = await getMultiSourceContext();
    
    res.json({ 
      data: product,
      freshness: new Date().toISOString(),
      policies: context.merchant.policies
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
