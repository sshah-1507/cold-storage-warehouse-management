const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

let transporter = null;
let isEtherealTest = false;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    isEtherealTest = false;
  } else {
    // Generate testing account on Ethereal or fallback to json transport
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      isEtherealTest = true;
    } catch (e) {
      // Fallback json transport for offline environments
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      isEtherealTest = true;
    }
  }

  return transporter;
}

/**
 * Checks for near-expiry and expired batches:
 * - Batches with remainingQuantity > 0 and expiryDate <= (today + 7 days)
 * Creates deduplicated Alert records and dispatches email notifications.
 */
async function checkAndSendExpiryAlerts() {
  const client = await pool.connect();
  const startTime = Date.now();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const nearExpiryCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Query batches near expiry or expired
    const candidateBatches = await client.query(
      `SELECT b.id, b."productName", b."supplierId", b."remainingQuantity", b.unit, b."expiryDate", u.email as "supplierEmail", u.name as "supplierName"
       FROM "Batch" b
       JOIN "User" u ON b."supplierId" = u.id
       WHERE b."remainingQuantity" > 0 AND b."expiryDate" <= $1`,
      [nearExpiryCutoff]
    );

    const emailTransport = await getTransporter();

    for (const batch of candidateBatches.rows) {
      const isExpired = batch.expiryDate < today;
      const alertType = isExpired ? 'EXPIRED' : 'NEAR_EXPIRY';
      const message = isExpired
        ? `Batch ${batch.id} (${batch.productName}) of ${batch.remainingQuantity} ${batch.unit} EXPIRED on ${batch.expiryDate}`
        : `Batch ${batch.id} (${batch.productName}) of ${batch.remainingQuantity} ${batch.unit} is near expiry on ${batch.expiryDate}`;

      // Deduplication check: Do not re-create if already alerted today for this batch and type
      const existingAlert = await client.query(
        `SELECT id, "deliveryStatus" FROM "Alert"
         WHERE "batchId" = $1 AND type = $2 AND "createdAt" >= CURRENT_DATE`,
        [batch.id, alertType]
      );

      let alertId;
      if (existingAlert.rows.length === 0) {
        const { randomUUID } = require('crypto');
        alertId = `alert_${randomUUID()}`;
        await client.query(
          `INSERT INTO "Alert" (id, "batchId", type, message, "deliveryStatus", attempts, "lastAttemptAt", "createdAt")
           VALUES ($1, $2, $3, $4, 'PENDING', 0, NOW(), NOW())`,
          [alertId, batch.id, alertType, message]
        );
      } else {
        alertId = existingAlert.rows[0].id;
        if (existingAlert.rows[0].deliveryStatus === 'SENT') {
          continue; // Already delivered today
        }
      }

      // Dispatch notification
      try {
        await emailTransport.sendMail({
          from: '"Cold Storage Alerts" <alerts@warehouse.local>',
          to: batch.supplierEmail || 'manager@example.com',
          subject: `[Warehouse Alert] ${alertType}: ${batch.productName}`,
          text: message,
          html: `<p><strong>${message}</strong></p><p>Please take immediate operational action.</p>`,
        });

        await client.query(
          `UPDATE "Alert" SET "deliveryStatus" = 'SENT', attempts = attempts + 1, "lastAttemptAt" = NOW() WHERE id = $1`,
          [alertId]
        );
      } catch (sendErr) {
        console.error(`Failed to send alert email for alert ${alertId}:`, sendErr.message);
        await client.query(
          `UPDATE "Alert" SET "deliveryStatus" = 'FAILED', attempts = attempts + 1, "lastAttemptAt" = NOW() WHERE id = $1`,
          [alertId]
        );
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      processed: candidateBatches.rows.length,
      durationMs,
      isEtherealTest,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  checkAndSendExpiryAlerts,
  getTransporter,
};
