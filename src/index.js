require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const catalogRoutes = require('./routes/catalog');
const commerceRoutes = require('./routes/commerce');
const profileRoutes = require('./routes/profile');
const agentTokenRoutes = require('./routes/agentTokens');
const agentRoutes = require('./routes/agent');
const aiBuyerRoutes = require('./routes/aiBuyer');
const webhookRoutes = require('./routes/webhooks');
const merchantRoutes = require('./routes/merchant');
const observabilityRoutes = require('./routes/observability');

const app = express();

// cors treats ['*'] as a literal origin, not a wildcard.
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const corsOrigin = allowedOriginsEnv ? allowedOriginsEnv.split(',').map(o => o.trim()) : '*';
app.use(cors({ origin: corsOrigin }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        type: 'request',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        timestamp: new Date().toISOString()
      })
    );
  });
  next();
});

// Must mount before express.json() or signature checks break.
app.use('/webhooks', webhookRoutes);

app.use(express.json());

app.use('/car-images', express.static(path.join(__dirname, '..', 'archive')));

app.use('/catalog', catalogRoutes);
app.use('/commerce', commerceRoutes);
app.use('/profile', profileRoutes);
app.use('/agent-tokens', agentTokenRoutes);
app.use('/agent', agentRoutes);
app.use('/ai-buyer', aiBuyerRoutes);
app.use('/merchant', merchantRoutes);
app.use('/observability', observabilityRoutes);

app.use((err, req, res, next) => {
  console.error(
    JSON.stringify({
      level: 'error',
      type: 'unhandled_error',
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    })
  );
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error(
    JSON.stringify({ level: 'error', type: 'unhandled_rejection', message: reason?.message || String(reason), stack: reason?.stack, timestamp: new Date().toISOString() })
  );
});
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ level: 'error', type: 'uncaught_exception', message: error.message, stack: error.stack, timestamp: new Date().toISOString() }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, (err) => {
  if (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
  console.log(`Agentic Commerce Engine running on port ${PORT}`);
});
