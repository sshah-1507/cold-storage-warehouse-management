require('dotenv').config();
const cron = require('node-cron');
const app = require('./app');
const { checkAndSendExpiryAlerts } = require('./services/alertService');

const PORT = process.env.PORT || 5000;

// Schedule minute-level background expiry alert monitoring (US-04 / NFR-5)
const alertJob = cron.schedule('* * * * *', async () => {
  try {
    const result = await checkAndSendExpiryAlerts();
    if (result && result.processed > 0) {
      console.log(`[Expiry Monitor Cron]: Processed ${result.processed} alerts in ${result.durationMs}ms`);
    }
  } catch (err) {
    console.error('[Expiry Monitor Cron Error]:', err.message);
  }
});

const server = app.listen(PORT, () => {
  console.log(`Cold Storage Warehouse Backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Documentation: http://localhost:${PORT}/docs`);
  console.log(`Background Cron: Expiry check scheduled every minute (NFR-5)`);
});

module.exports = { server, alertJob };
