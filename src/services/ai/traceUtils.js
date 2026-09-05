
function classifyOutcome(result) {
  if (result && typeof result === 'object') {
    if (result.error) return 'denied';
    if (result.eligible === false) return 'denied';
  }
  return 'ok';
}

const LLM_CALL_SCHEMAS = {
  get_low_readiness_products: {
    label: 'Catalog readiness grading -- generateObject, batched ~25 products/call',
    fields: [
      { field: 'product_id', type: 'string' },
      { field: 'score', type: 'number, 0-100' },
      { field: 'verdict', type: 'string (one sentence)' },
      { field: 'issues', type: 'string[]' }
    ]
  }
};

function recordTraceStep(trace, name, args, startedAt, result) {
  if (!trace) return;
  const endedAt = Date.now();
  trace.push({
    name,
    args,
    result,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    outcome: classifyOutcome(result),
    llmSchema: LLM_CALL_SCHEMAS[name] || null
  });
}

module.exports = { classifyOutcome, recordTraceStep, LLM_CALL_SCHEMAS };
