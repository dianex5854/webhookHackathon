// controllers/fraudController.js
// Lógica de negocio para disparar una alerta de fraude.
// No conoce Express (req/res) — recibe datos simples y devuelve un resultado.
// Esto permite testearla directo, sin levantar un servidor HTTP.

const banking = require('../tools/banking');
const whatsapp = require('../tools/whatsapp');

async function simulateFraudAlert({ phone, amount, merchant, location }) {
  if (!phone || !amount || !merchant) {
    const error = new Error('Faltan datos: phone, amount y merchant son requeridos');
    error.statusCode = 400;
    throw error;
  }

  const account = banking.getAccountByPhone(phone);
  if (!account) {
    const error = new Error(`No existe una cuenta con el teléfono ${phone}`);
    error.statusCode = 404;
    throw error;
  }

  const card = account.cards[0]; // simplificación para el hackathon: primera tarjeta de la cuenta

  // 1. Crear la transacción en el mock bancario
  const transaction = banking.createTransaction({
    accountId: account.accountId,
    cardId: card.cardId,
    amount,
    merchant,
    location,
  });

  // 2. Enviar la alerta por WhatsApp (plantilla aprobada por Meta)
  //    Si la plantilla todavía no fue aprobada, esto puede fallar — pero la
  //    transacción ya quedó creada, así que igual se puede probar el agente
  //    respondiendo manualmente desde WhatsApp.
  let whatsappSent = true;
  let whatsappError = null;
  try {
    await whatsapp.sendFraudAlertTemplate(phone, { amount, merchant });
    console.log(`Alerta de fraude enviada a ${phone} — transacción ${transaction.transactionId}`);
  } catch (err) {
    whatsappSent = false;
    whatsappError = err.message;
    console.error('No se pudo enviar la plantilla de WhatsApp (¿todavía no está aprobada?):', err.message);
  }

  return { transaction, whatsappSent, whatsappError };
}

module.exports = { simulateFraudAlert };
