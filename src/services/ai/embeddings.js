const { embed, embedMany } = require('ai');
const { google } = require('./index');

const EMBEDDING_MODEL_ID = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

const MAX_PER_CALL = 20;
const DELAY_BETWEEN_CHUNKS_MS = 8000;
const MAX_BACKOFF_RETRIES = 2;
const INITIAL_BACKOFF_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function embeddingModel() {
  return google.embeddingModel(EMBEDDING_MODEL_ID);
}

async function embedChunkWithBackoff(values) {
  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;
  for (;;) {
    try {
      const { embeddings } = await embedMany({
        model: embeddingModel(),
        values,
        maxRetries: 0,
        providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' } }
      });
      return embeddings;
    } catch (err) {
      const isRateLimit = err?.statusCode === 429 || /quota|rate.?limit/i.test(err?.message || '');
      if (!isRateLimit || attempt >= MAX_BACKOFF_RETRIES) throw err;
      attempt += 1;
      console.warn(`  embed rate-limited, retrying in ${backoff / 1000}s (attempt ${attempt}/${MAX_BACKOFF_RETRIES})...`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 60000);
    }
  }
}

async function embedTexts(texts) {
  const chunks = chunk(texts, MAX_PER_CALL);
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    results.push(...(await embedChunkWithBackoff(chunks[i])));
    if (i < chunks.length - 1) await sleep(DELAY_BETWEEN_CHUNKS_MS);
  }
  return results;
}

async function embedQuery(text) {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' } }
  });
  return embedding;
}

module.exports = { embedTexts, embedQuery, EMBEDDING_DIMENSIONS };
