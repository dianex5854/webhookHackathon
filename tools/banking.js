// tools/banking.js
// Mock del sistema bancario para el hackathon.
// Lee/escribe en archivos JSON locales (data/accounts.json y data/transactions.json).

const fs = require('fs');
const path = require('path');

const ACCOUNTS_PATH = path.join(__dirname, '..', 'data', 'accounts.json');
const TRANSACTIONS_PATH = path.join(__dirname, '..', 'data', 'transactions.json');

// ---------- Helpers internos de lectura/escritura ----------

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- Cuentas ----------

function getAccountByPhone(phone) {
  const { accounts } = readJSON(ACCOUNTS_PATH);
  return accounts.find((acc) => acc.phone === phone) || null;
}

function getCardById(cardId) {
  const { accounts } = readJSON(ACCOUNTS_PATH);
  for (const acc of accounts) {
    const card = acc.cards.find((c) => c.cardId === cardId);
    if (card) return { ...card, accountId: acc.accountId, clientName: acc.clientName };
  }
  return null;
}

// ---------- Transacciones ----------

function createTransaction({ accountId, cardId, amount, merchant, location }) {
  const data = readJSON(TRANSACTIONS_PATH);
  const newTransaction = {
    transactionId: `txn_${Date.now()}`,
    accountId,
    cardId,
    amount,
    merchant,
    location: location || 'No especificada',
    status: 'pending_review', // pending_review | authorized | blocked
    createdAt: new Date().toISOString(),
  };
  data.transactions.push(newTransaction);
  writeJSON(TRANSACTIONS_PATH, data);
  return newTransaction;
}

function getTransactionById(transactionId) {
  const { transactions } = readJSON(TRANSACTIONS_PATH);
  return transactions.find((t) => t.transactionId === transactionId) || null;
}

function getLatestTransactionByPhone(phone) {
  const account = getAccountByPhone(phone);
  if (!account) return null;
  const { transactions } = readJSON(TRANSACTIONS_PATH);
  const accountTxns = transactions
    .filter((t) => t.accountId === account.accountId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return accountTxns[0] || null;
}

function updateTransactionStatus(transactionId, status) {
  const data = readJSON(TRANSACTIONS_PATH);
  const txn = data.transactions.find((t) => t.transactionId === transactionId);
  if (!txn) return null;
  txn.status = status;
  writeJSON(TRANSACTIONS_PATH, data);
  return txn;
}

// ---------- Acciones que dispara el agente de IA ----------

function authorizeTransaction(transactionId) {
  return updateTransactionStatus(transactionId, 'authorized');
}

function blockCard(cardId) {
  const data = readJSON(ACCOUNTS_PATH);
  for (const acc of data.accounts) {
    const card = acc.cards.find((c) => c.cardId === cardId);
    if (card) {
      card.status = 'blocked';
      writeJSON(ACCOUNTS_PATH, data);
      return card;
    }
  }
  return null;
}

function markTransactionAsFraud(transactionId) {
  return updateTransactionStatus(transactionId, 'blocked');
}

// ---------- Detección simple de fraude (regla mock) ----------

function isSuspicious(transaction) {
  // Regla simple para la demo: monto alto o comercio fuera de lo común
  const HIGH_AMOUNT_THRESHOLD = 100000;
  const unusualMerchants = ['Casino Online XYZ', 'Tienda Desconocida'];
  return (
    transaction.amount >= HIGH_AMOUNT_THRESHOLD ||
    unusualMerchants.includes(transaction.merchant)
  );
}

function recordMerchantAsKnown(accountId, merchant) {
  const data = readJSON(ACCOUNTS_PATH);
  const account = data.accounts.find((acc) => acc.accountId === accountId);
  if (!account) return null;

  if (!account.knownMerchants) account.knownMerchants = [];
  if (!account.knownMerchants.includes(merchant)) {
    account.knownMerchants.push(merchant);
  }

  writeJSON(ACCOUNTS_PATH, data);
  return account.knownMerchants;
}

function openClaim(transactionId) {
  const data = readJSON(TRANSACTIONS_PATH);
  const txn = data.transactions.find((t) => t.transactionId === transactionId);
  if (!txn) return null;

  txn.status = 'blocked';
  txn.claimOpened = true;
  txn.claimOpenedAt = new Date().toISOString();
  writeJSON(TRANSACTIONS_PATH, data);
  return txn;
}

module.exports = {
  getAccountByPhone,
  getCardById,
  createTransaction,
  getTransactionById,
  getLatestTransactionByPhone,
  updateTransactionStatus,
  authorizeTransaction,
  blockCard,
  markTransactionAsFraud,
  isSuspicious,
  recordMerchantAsKnown,
  openClaim,
};
