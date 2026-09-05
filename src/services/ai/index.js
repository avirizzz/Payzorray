const { createAnthropic } = require('@ai-sdk/anthropic');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

const MODELS = {
  fast: google('gemini-3.1-flash-lite'),
  strong: google('gemini-3.5-flash-lite'),

};

module.exports = { MODELS, google };
