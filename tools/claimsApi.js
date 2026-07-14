// tools/claimsApi.js
//
// Para transacciones de severidad ALTA: abre un reclamo formal con los datos
// de la transacción. A diferencia de las severidades media/baja, acá NO se
// notifica nada por WhatsApp — el cliente ve el reclamo y las instrucciones
// directamente dentro de la app del banco (fuera del alcance de este sistema).
//
// TODO: cuando exista una API externa real de reclamos, reemplazar la
// generación del claimNumber acá adentro por la respuesta de esa API.

const banking = require('./banking');

async function openUrgentClaim({ transaction }) {
  // Abrir el reclamo formal (monto, comercio, fecha/hora de la transacción).
  // Todo el resto del proceso (avisar al cliente, mostrarle el número de
  // reclamo y el teléfono a llamar) ocurre dentro de la app del banco.
  const claim = banking.createFormalClaim(transaction);

  console.log(
    `[Reclamo urgente] N° ${claim.claimNumber} abierto — transacción ${transaction.transactionId} ` +
      `(${transaction.amount} en ${transaction.merchant}). Gestión completa dentro de la app del banco.`
  );

  return {
    success: true,
    claimNumber: claim.claimNumber,
  };
}

module.exports = { openUrgentClaim };
