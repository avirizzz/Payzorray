const bus = require('./eventBus');

const RECENT_LIMIT = 8;

let active = null;
const recent = { buyer: [], merchant: [] };

function laneFor(step) {
  return step.llmSchema ? 'ai' : 'code';
}

function extractAmount(result) {
  if (!result || typeof result !== 'object') return null;
  if (typeof result.amount === 'number') return result.amount;
  if (result.product?.price != null) return result.product.price * (result.quantity || 1);
  return null;
}

function publishStepStart({ surface, conversationId, name, args }) {
  bus.emit('step-start', { type: 'step-start', surface, conversationId, name, args, startedAt: Date.now() });
}

function publishTurnStart({ surface, conversationId, message, stepBudget }) {
  active = { surface, conversationId, message, stepBudget, startedAt: Date.now(), steps: [] };
  bus.emit('turn-start', { type: 'turn-start', surface, conversationId, message, stepBudget, startedAt: active.startedAt });
}

function publishStep({ surface, conversationId, step }) {
  const enriched = { type: 'step', surface, conversationId, lane: laneFor(step), amount: extractAmount(step.result), ...step };
  if (active && active.conversationId === conversationId) active.steps.push(enriched);
  bus.emit('step', enriched);
}

function publishTurnEnd({ surface, conversationId, reply, stepsUsed, stepBudget }) {
  const endedAt = Date.now();
  const isActiveTurn = active?.conversationId === conversationId;
  const finished = {
    surface,
    conversationId,
    message: isActiveTurn ? active.message : null,
    reply,
    stepsUsed,
    stepBudget,
    startedAt: isActiveTurn ? active.startedAt : null,
    steps: isActiveTurn ? active.steps : [],
    endedAt
  };
  recent[surface] = [finished, ...(recent[surface] || [])].slice(0, RECENT_LIMIT);
  if (active?.conversationId === conversationId) active = null;
  bus.emit('turn-end', { type: 'turn-end', ...finished });
}

function publishLlmCallStart({ surface, conversationId }) {
  bus.emit('llm-call-start', { type: 'llm-call-start', surface, conversationId, startedAt: Date.now() });
}
function publishLlmCallEnd({ surface, conversationId, startedAt, stepsSoFar }) {
  const endedAt = Date.now();
  bus.emit('llm-call-end', { type: 'llm-call-end', surface, conversationId, startedAt, endedAt, durationMs: endedAt - startedAt, stepsSoFar });
}

function publishPaymentCallStart({ name }) {
  bus.emit('payment-call-start', { type: 'payment-call-start', name, startedAt: Date.now() });
}
function publishPaymentCall({ name, result, startedAt, endedAt }) {
  bus.emit('payment-call', { type: 'payment-call', name, result, startedAt, endedAt, durationMs: endedAt - startedAt });
}

function publishAudit(record) {
  bus.emit('audit', { type: 'audit', ...record });
}

function getSnapshot() {
  return { active, recent };
}

module.exports = {
  publishTurnStart,
  publishStepStart,
  publishStep,
  publishTurnEnd,
  publishAudit,
  publishLlmCallStart,
  publishLlmCallEnd,
  publishPaymentCallStart,
  publishPaymentCall,
  getSnapshot
};
