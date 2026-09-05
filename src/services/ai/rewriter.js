const { generateObject } = require('ai');
const { MODELS } = require('./index');
const { z } = require('zod');
const { IntentSchema } = require('../../schemas');

async function rewriteQuery(userNLQuery) {
  const model = MODELS.fast;

  const RewriterSchema = z.object({
    intent: IntentSchema,
    search_strings: z.array(z.string()).min(1).max(3)
  });

  const { object } = await generateObject({
    model,
    schema: RewriterSchema,
    maxRetries: 0,
    prompt: `You are an AI commerce query rewriter. 
Analyze the user query: "${userNLQuery}"
Extract the structured intent, hard constraints, and soft preferences.
Also provide 1-3 optimized search strings for a hybrid vector/keyword search engine.
Ensure constraints like max_price are numeric.`
  });

  return object;
}

module.exports = { rewriteQuery };
