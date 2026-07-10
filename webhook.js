// webhook.js
// Punto de entrada de la app. Su única responsabilidad es levantar el
// servidor Express y montar las rutas — la lógica de negocio vive en
// controllers/ y las rutas están organizadas en routes/.

const express = require('express');
const path = require('path');
const config = require('./config'); // valida env vars al importarse

const whatsappWebhookRoutes = require('./routes/whatsappWebhook');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', whatsappWebhookRoutes);
app.use('/', dashboardRoutes);

app.listen(config.port, () => {
  console.log(`\nListening on port ${config.port}\n`);
});
