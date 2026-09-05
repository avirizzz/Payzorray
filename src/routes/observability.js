const express = require('express');
const bus = require('../services/observability/eventBus');
const { getSnapshot } = require('../services/observability/publish');

const router = express.Router();

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  res.write(`event: snapshot\ndata: ${JSON.stringify(getSnapshot())}\n\n`);

  const forward = (type) => (payload) => res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
  const onTurnStart = forward('turn-start');
  const onStepStart = forward('step-start');
  const onStep = forward('step');
  const onTurnEnd = forward('turn-end');
  const onAudit = forward('audit');
  const onPaymentCallStart = forward('payment-call-start');
  const onPaymentCall = forward('payment-call');
  const onLlmCallStart = forward('llm-call-start');
  const onLlmCallEnd = forward('llm-call-end');

  bus.on('turn-start', onTurnStart);
  bus.on('step-start', onStepStart);
  bus.on('step', onStep);
  bus.on('turn-end', onTurnEnd);
  bus.on('audit', onAudit);
  bus.on('payment-call-start', onPaymentCallStart);
  bus.on('payment-call', onPaymentCall);
  bus.on('llm-call-start', onLlmCallStart);
  bus.on('llm-call-end', onLlmCallEnd);

  // SSE comment line keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('turn-start', onTurnStart);
    bus.off('step-start', onStepStart);
    bus.off('step', onStep);
    bus.off('turn-end', onTurnEnd);
    bus.off('audit', onAudit);
    bus.off('payment-call-start', onPaymentCallStart);
    bus.off('payment-call', onPaymentCall);
    bus.off('llm-call-start', onLlmCallStart);
    bus.off('llm-call-end', onLlmCallEnd);
  });
});

module.exports = router;
