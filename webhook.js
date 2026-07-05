// Import Express.js
const express = require('express');
const path = require('path');
const banking = require('./tools/banking');
const whatsapp = require('./tools/whatsapp');
const agent = require('./agent');

// Create an Express app
const app = express();
// Middleware to parse JSON bodies
app.use(express.json());
// Servir el dashboard estático (carpeta /public)
app.use(express.static(path.join(__dirname, 'public')));

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// Ruta para ver el dashboard directamente en la raíz
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Route for GET requests (verificación del webhook de Meta)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests (mensajes entrantes de WhatsApp)
app.post('/', (req, res) => {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).end();

  // Procesamiento asíncrono: respondemos 200 a Meta primero (arriba) para evitar
  // timeouts, y recién después el agente interpreta el mensaje y actúa.
  agent.processIncomingMessage(req.body).catch((err) => {
    console.error('Error procesando mensaje con el agente:', err);
  });
});

// ---------- Ruta para el dashboard: simular transacción sospechosa ----------
app.post('/simular-fraude', async (req, res) => {
  try {
    const { phone, amount, merchant, location } = req.body;

    if (!phone || !amount || !merchant) {
      return res.status(400).json({ error: 'Faltan datos: phone, amount y merchant son requeridos' });
    }

    const account = banking.getAccountByPhone(phone);
    if (!account) {
      return res.status(404).json({ error: `No existe una cuenta con el teléfono ${phone}` });
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
    await whatsapp.sendFraudAlertTemplate(phone, { amount, merchant });

    console.log(`Alerta de fraude enviada a ${phone} — transacción ${transaction.transactionId}`);

    res.status(200).json({ success: true, transaction });
  } catch (err) {
    console.error('Error simulando fraude:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
