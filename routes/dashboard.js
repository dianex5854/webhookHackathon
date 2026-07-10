// routes/dashboard.js
// Rutas de soporte para la demo: disparar transacciones sospechosas
// y ver el estado interno de los datos (solo para el hackathon).

const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const fraudController = require('../controllers/fraudController');

const router = express.Router();

router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

router.post('/simular-fraude', async (req, res) => {
  try {
    const result = await fraudController.simulateFraudAlert(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Error simulando fraude:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Ruta de debug: ver el estado actual de los datos.
// Protegida con un query param ?secret=... si DEBUG_SECRET está configurado.
router.get('/debug/logs', (req, res) => {
  if (config.debugSecret && req.query.secret !== config.debugSecret) {
    return res.status(403).json({ error: 'Acceso denegado. Falta ?secret=... válido.' });
  }

  try {
    const dataPath = path.join(__dirname, '..', 'data');
    const logs = JSON.parse(fs.readFileSync(path.join(dataPath, 'logs.json'), 'utf-8'));
    const transactions = JSON.parse(fs.readFileSync(path.join(dataPath, 'transactions.json'), 'utf-8'));
    const accounts = JSON.parse(fs.readFileSync(path.join(dataPath, 'accounts.json'), 'utf-8'));
    res.json({ logs, transactions, accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
