// routes/whatsappWebhook.js
// Rutas exclusivas del webhook de Meta: verificación (GET) y mensajes entrantes (POST).

const express = require('express');
const config = require('../config');
const agent = require('../agent');

const router = express.Router();

// Verificación del webhook (Meta la llama una sola vez, al configurarlo en el panel)
router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === config.verifyToken) {
    console.log('WEBHOOK VERIFIED');
    return res.status(200).send(challenge);
  }

  res.status(403).end();
});

// Mensajes entrantes de WhatsApp
router.post('/', (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  // Respondemos 200 a Meta primero para evitar timeouts; el agente procesa después, async.
  res.status(200).end();

  agent.processIncomingMessage(req.body).catch((err) => {
    console.error('Error procesando mensaje con el agente:', err);
  });
});

module.exports = router;
