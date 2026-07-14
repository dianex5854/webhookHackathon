// controllers/fraudController.js
// Lógica de negocio para disparar una alerta de fraude.
// No conoce Express (req/res) — recibe datos simples y devuelve un resultado.
// Esto permite testearla directo, sin levantar un servidor HTTP.

const banking = require('../tools/banking');
const whatsapp = require('../tools/whatsapp');
const claimsApi = require('../tools/claimsApi');
const riskClassifier = require('../riskClassifier');

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

  // 2. Clasificar la severidad (alta / media / baja) en base al historial del cliente.
  //    TODO: los criterios exactos de negocio todavía no están definidos —
  //    por ahora riskClassifier.js usa criterios genéricos (ver ese archivo).
  const { severity, reasoning } = await riskClassifier.classifySeverity(transaction);
  banking.updateTransactionSeverity(transaction.transactionId, { severity, reasoning });
  console.log(`Severidad clasificada: ${severity.toUpperCase()} — ${reasoning}`);

  let whatsappSent = null; // null = no aplica (severidad alta no manda WhatsApp)
  let whatsappError = null;
  let claimNumber = null;

  if (severity === 'alta') {
    // 3a. Severidad alta: se abre un reclamo formal. Todo el resto del
    //     proceso (avisar al cliente, indicarle el número de reclamo y a
    //     quién llamar) pasa dentro de la app del banco, no por WhatsApp.
    try {
      const result = await claimsApi.openUrgentClaim({ transaction });
      claimNumber = result.claimNumber;
    } catch (err) {
      console.error('Error abriendo el reclamo urgente:', err.message);
    }
  } else {
    // 3b. Severidad media/baja: sigue el flujo actual — plantilla con botones por WhatsApp.
    const dateTime = new Date(transaction.createdAt).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      await whatsapp.sendFraudAlertTemplate(phone, { amount, merchant, dateTime });
      console.log(`Alerta de fraude enviada a ${phone} — transacción ${transaction.transactionId}`);
      whatsappSent = true;
    } catch (err) {
      whatsappSent = false;
      whatsappError = err.message;
      console.error('No se pudo enviar la plantilla de WhatsApp (¿todavía no está aprobada?):', err.message);
    }
  }

  return {
    transaction: { ...transaction, severity, severityReasoning: reasoning },
    severity,
    whatsappSent,
    whatsappError,
    claimNumber,
  };
}

module.exports = { simulateFraudAlert };
