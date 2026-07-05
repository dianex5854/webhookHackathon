// tools/logger.js
// Logger simple para registrar las decisiones del cliente sobre transacciones.
// Guarda en data/logs.json (histórico) y también imprime en consola para ver en vivo en Render.

const fs = require('fs');
const path = require('path');

const LOGS_PATH = path.join(__dirname, '..', 'data', 'logs.json');

function ensureLogsFile() {
  if (!fs.existsSync(LOGS_PATH)) {
    fs.writeFileSync(LOGS_PATH, JSON.stringify({ logs: [] }, null, 2));
  }
}

function logDecision({ phone, transactionId, merchant, amount, decision, note }) {
  ensureLogsFile();

  const entry = {
    timestamp: new Date().toISOString(),
    phone,
    transactionId,
    merchant,
    amount,
    decision, // 'confirmed' | 'reported_fraud'
    note,
  };

  const data = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
  data.logs.push(entry);
  fs.writeFileSync(LOGS_PATH, JSON.stringify(data, null, 2));

  console.log(`[LOG] ${decision.toUpperCase()} — cliente ${phone} — transacción ${transactionId} (${merchant}, ${amount})`);

  return entry;
}

module.exports = { logDecision };
