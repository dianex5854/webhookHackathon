// tools/whatsapp.js
// Envío de mensajes vía WhatsApp Cloud API.

const config = require('../config');

const { phoneNumberId: PHONE_NUMBER_ID, accessToken: ACCESS_TOKEN, apiVersion: API_VERSION } = config.whatsapp;

async function sendRequest(body) {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Error enviando mensaje de WhatsApp:', JSON.stringify(data, null, 2));
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
  return data;
}

// Envía la plantilla de alerta de fraude (requiere que ya esté APROBADA por Meta)
//
// NOTA: el nombre real de la plantilla en Meta tiene un guión bajo al final
// ("alerta_fraude_transaccion_") — no es un typo, así quedó guardada al crearla.
// Además la plantilla real tiene 3 variables en el body (monto, fecha y hora,
// comercio), no 2 — hay que mandar los 3 parámetros en ese orden exacto.
async function sendFraudAlertTemplate(toPhone, { amount, merchant, dateTime }) {
  const body = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'template',
    template: {
      name: 'alerta_fraude_transaccion_',
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(amount) },
            { type: 'text', text: dateTime },
            { type: 'text', text: merchant },
          ],
        },
      ],
    },
  };
  return sendRequest(body);
}

// Envía un mensaje de texto libre (solo funciona dentro de la ventana de 24hs post-respuesta del usuario)
async function sendTextMessage(toPhone, text) {
  const body = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'text',
    text: { body: text },
  };
  return sendRequest(body);
}

module.exports = {
  sendFraudAlertTemplate,
  sendTextMessage,
};
