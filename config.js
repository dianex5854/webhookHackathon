// config.js
// Centraliza y valida las variables de entorno al arrancar la app.
// Si falta algo crítico, el servidor falla acá con un mensaje claro,
// en vez de fallar después con un error confuso en medio de un request real.

const REQUIRED_VARS = [
  'VERIFY_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY',
];

function validateConfig() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Faltan variables de entorno requeridas:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nConfiguralas en Render (Environment) antes de desplegar.\n');
    process.exit(1);
  }
}

validateConfig();

module.exports = {
  port: process.env.PORT || 3000,
  verifyToken: process.env.VERIFY_TOKEN,
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    apiVersion: 'v21.0',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-5',
  },
  // Secret opcional para proteger /debug/logs. Si no está seteada,
  // la ruta queda abierta (aceptable solo durante el hackathon).
  debugSecret: process.env.DEBUG_SECRET || null,
};
