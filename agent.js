// agent.js
// Agente de IA: interpreta la respuesta del cliente a la alerta de fraude
// y decide qué acción tomar (autorizar transacción o bloquear tarjeta).

const Anthropic = require('@anthropic-ai/sdk');
const banking = require('./tools/banking');
const whatsapp = require('./tools/whatsapp');
const logger = require('./tools/logger');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-5';

// ---------- Herramientas que el agente puede ejecutar ----------

const tools = [
  {
    name: 'authorize_transaction',
    description:
      'Autoriza una transacción cuando el cliente confirma que la reconoce y fue él quien la hizo.',
    input_schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: 'ID de la transacción a autorizar' },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'block_card',
    description:
      'Bloquea la tarjeta cuando el cliente reporta que la transacción es fraudulenta o que no la reconoce.',
    input_schema: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'ID de la tarjeta a bloquear' },
        transactionId: { type: 'string', description: 'ID de la transacción asociada, para marcarla como fraude' },
      },
      required: ['cardId', 'transactionId'],
    },
  },
  {
    name: 'ask_clarification',
    description:
      'Usar cuando la respuesta del cliente es ambigua y no se puede determinar con confianza si autorizar o bloquear. Pide una aclaración en vez de tomar una acción irreversible.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Pregunta breve y clara para el cliente' },
      },
      required: ['question'],
    },
  },
];

// ---------- Extraer el mensaje entrante del payload de Meta ----------

function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const from = message.from; // número del cliente, sin '+'

    let text = null;
    if (message.type === 'text') {
      text = message.text.body;
    } else if (message.type === 'button') {
      text = message.button.text; // "Sí, fui yo" / "No, fue fraude"
    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
      text = message.interactive.button_reply.title;
    }

    return { from, text, raw: message };
  } catch (err) {
    console.error('Error parseando mensaje entrante:', err);
    return null;
  }
}

// ---------- Lógica principal del agente ----------

async function processIncomingMessage(webhookBody) {
  const parsed = parseIncomingMessage(webhookBody);
  if (!parsed || !parsed.text) {
    console.log('Mensaje entrante sin texto interpretable, se ignora.');
    return;
  }

  const { from, text } = parsed;

  // Buscar la transacción pendiente más reciente de este cliente
  const transaction = banking.getLatestTransactionByPhone(from);
  if (!transaction || transaction.status !== 'pending_review') {
    console.log(`No hay transacción pendiente para ${from}. Mensaje ignorado por el agente.`);
    return;
  }

  const card = banking.getCardById(transaction.cardId);

  const systemPrompt = `Sos el agente de fraude de un banco. Tu trabajo es interpretar la respuesta de un cliente a una alerta de transacción sospechosa y decidir qué acción tomar usando las herramientas disponibles.

Contexto de la transacción:
- ID de transacción: ${transaction.transactionId}
- Monto: ${transaction.amount}
- Comercio: ${transaction.merchant}
- ID de tarjeta asociada: ${transaction.cardId}

Reglas:
- Si el cliente confirma que reconoce la transacción (ej: "sí", "fui yo", "sí, la reconozco"), usá authorize_transaction.
- Si el cliente niega la transacción o reporta fraude (ej: "no", "fue fraude", "no fui yo"), usá block_card.
- Si la respuesta es ambigua o no está clara (ej: "no sé", "no me acuerdo", una respuesta que no dice claramente sí o no), usá ask_clarification en vez de asumir.
- Ejecutá una sola herramienta por respuesta.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: systemPrompt,
    tools,
    messages: [{ role: 'user', content: text }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');

  if (!toolUse) {
    console.log('El agente no decidió ejecutar ninguna acción.');
    return;
  }

  console.log(`Agente decidió ejecutar: ${toolUse.name}`, toolUse.input);

  switch (toolUse.name) {
    case 'authorize_transaction': {
      // 1. Dejar registro de que el cliente confirmó esta transacción/comercio como habitual
      logger.logDecision({
        phone: from,
        transactionId: transaction.transactionId,
        merchant: transaction.merchant,
        amount: transaction.amount,
        decision: 'confirmed',
        note: 'El cliente confirmó la transacción. Se registra el comercio como habitual para detección futura.',
      });
      banking.recordMerchantAsKnown(transaction.accountId, transaction.merchant);

      // 2. Indicarle al cliente que debe ingresar al canal para autorizarla formalmente
      await whatsapp.sendTextMessage(
        from,
        `Gracias por confirmar. Para autorizar formalmente esta transacción de ${transaction.amount} en ${transaction.merchant}, ingresá a nuestro canal (app o banca en línea) y completá la autorización desde ahí.`
      );
      break;
    }

    case 'block_card': {
      // 1. Dejar registro de que el cliente reportó fraude
      logger.logDecision({
        phone: from,
        transactionId: transaction.transactionId,
        merchant: transaction.merchant,
        amount: transaction.amount,
        decision: 'reported_fraud',
        note: 'El cliente no reconoció la transacción. Se bloquea la tarjeta y se abre un reclamo.',
      });

      // 2. Bloquear la transacción/tarjeta y abrir el reclamo
      banking.blockCard(toolUse.input.cardId);
      banking.openClaim(transaction.transactionId);

      // 3. Avisarle al cliente
      await whatsapp.sendTextMessage(
        from,
        `Entendido. Vamos a bloquear esta transacción de ${transaction.amount} en ${transaction.merchant} y abrimos un reclamo para investigarla. Te vamos a contactar con más información en breve.`
      );
      break;
    }

    case 'ask_clarification': {
      await whatsapp.sendTextMessage(from, toolUse.input.question);
      break;
    }

    default:
      console.log('Herramienta no reconocida:', toolUse.name);
  }
}

module.exports = {
  processIncomingMessage,
  parseIncomingMessage,
};
