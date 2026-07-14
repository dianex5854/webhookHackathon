// riskClassifier.js
//
// Clasifica la severidad de una transacción sospechosa (alta / media / baja)
// usando Claude, en base a la transacción actual y el historial del cliente.
//
// TODO (mañana, con parámetros reales de negocio):
//   - Definir umbrales concretos de monto por nivel de severidad
//   - Definir qué patrones de comportamiento cuentan como "historial atípico"
//     (ej: frecuencia de transacciones, ubicaciones geográficas, tipo de comercio)
//   - Ajustar el system prompt de acuerdo a esas reglas de negocio ya definidas,
//     en vez de dejar que Claude infiera criterios genéricos como ahora.

const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');
const banking = require('./tools/banking');

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

const MODEL = config.anthropic.model;

const tools = [
  {
    name: 'set_severity',
    description: 'Define el nivel de severidad de la transacción sospechosa analizada.',
    input_schema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['alta', 'media', 'baja'],
          description: 'Nivel de severidad del posible fraude.',
        },
        reasoning: {
          type: 'string',
          description: 'Explicación breve de por qué se asignó ese nivel.',
        },
      },
      required: ['severity', 'reasoning'],
    },
  },
];

function formatHistoryForPrompt(history) {
  if (history.length === 0) return 'El cliente no tiene transacciones previas registradas.';

  return history
    .map(
      (t, i) =>
        `${i + 1}. Monto: ${t.amount} — Comercio: ${t.merchant} — Estado: ${t.status} — Fecha: ${t.createdAt}`
    )
    .join('\n');
}

/**
 * Clasifica la severidad de una transacción sospechosa.
 * @param {object} transaction - la transacción recién creada (de banking.createTransaction)
 * @returns {Promise<{severity: 'alta'|'media'|'baja', reasoning: string}>}
 */
async function classifySeverity(transaction) {
  const history = banking.getTransactionHistoryByAccount(transaction.accountId, {
    excludeTransactionId: transaction.transactionId,
  });

  // NOTA: criterios genéricos por ahora — reemplazar mañana por las reglas de
  // negocio reales (umbrales de monto, patrones específicos, etc.)
  const systemPrompt = `Sos un analista de riesgo de fraude bancario. Tu trabajo es clasificar la severidad de una transacción sospechosa en "alta", "media" o "baja", considerando el monto, el comercio, y el historial de transacciones previas del cliente.

Criterios generales (ajustar con reglas de negocio específicas más adelante):
- "alta": montos muy por encima de lo habitual para este cliente, comercios de alto riesgo, o un patrón que se aparta fuertemente del historial.
- "media": algo inusual pero no extremo — amerita confirmación del cliente por WhatsApp.
- "baja": una desviación menor, probablemente explicable.

Usá siempre la herramienta set_severity para responder.`;

  const userMessage = `Transacción a evaluar:
- Monto: ${transaction.amount}
- Comercio: ${transaction.merchant}
- Ubicación: ${transaction.location}

Historial reciente del cliente:
${formatHistoryForPrompt(history)}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: systemPrompt,
    tools,
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');

  if (!toolUse) {
    // Fallback conservador: si Claude no devuelve una clasificación clara,
    // tratamos la transacción como severidad "media" para no perder el caso.
    console.warn('El clasificador no devolvió severidad, se usa "media" por defecto.');
    return { severity: 'media', reasoning: 'No se pudo clasificar automáticamente.' };
  }

  return {
    severity: toolUse.input.severity,
    reasoning: toolUse.input.reasoning,
  };
}

module.exports = { classifySeverity };
