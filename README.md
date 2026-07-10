# Sistema de Detección de Fraude vía WhatsApp

Sistema que simula un banco alertando proactivamente a sus clientes sobre transacciones sospechosas por WhatsApp, y usa un agente de IA (Claude, con tool use) para interpretar la respuesta del cliente y ejecutar la acción bancaria correspondiente.

## Arquitectura

```
Dashboard (botón) 
   → webhook.js → routes/dashboard.js → controllers/fraudController.js
   → tools/banking.js (crea la transacción)
   → tools/whatsapp.js (envía la plantilla de alerta)

Cliente responde por WhatsApp
   → webhook.js → routes/whatsappWebhook.js (recibe el mensaje)
   → agent.js (interpreta la respuesta con Claude + tool use)
   → tools/banking.js (ejecuta la acción: autorizar / bloquear)
   → tools/logger.js (registra la decisión)
   → tools/whatsapp.js (responde al cliente)
```

## Estructura del proyecto

| Archivo/Carpeta | Responsabilidad |
|---|---|
| `webhook.js` | Bootstrap del servidor Express. Solo levanta la app y monta las rutas. |
| `config.js` | Centraliza y valida las variables de entorno al arrancar. |
| `agent.js` | Agente de IA: interpreta la respuesta del cliente con Claude (tool use) y decide qué acción ejecutar. |
| `routes/whatsappWebhook.js` | Verificación del webhook de Meta y recepción de mensajes entrantes. |
| `routes/dashboard.js` | Endpoints de soporte para la demo (`/dashboard`, `/simular-fraude`, `/debug/logs`). |
| `controllers/fraudController.js` | Lógica de negocio para disparar una alerta de fraude (sin acoplarse a HTTP). |
| `tools/banking.js` | Mock del sistema bancario: cuentas, tarjetas, transacciones. |
| `tools/whatsapp.js` | Envío de mensajes vía WhatsApp Cloud API. |
| `tools/logger.js` | Registro de las decisiones del cliente. |
| `public/dashboard.html` | Panel simple para disparar transacciones sospechosas de prueba. |
| `data/*.json` | "Base de datos" mock en archivos JSON (cuentas, transacciones, logs). |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VERIFY_TOKEN` | Token propio para la verificación del webhook ante Meta. |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp (desde Meta for Developers). |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso a la API de WhatsApp Cloud. |
| `ANTHROPIC_API_KEY` | API key de Anthropic para el agente de IA. |
| `DEBUG_SECRET` | (Opcional) Si se define, protege `/debug/logs` con `?secret=...`. |

## Cómo correr localmente

```bash
npm install
node webhook.js
```

## Limitaciones conocidas (por ser un proyecto de hackathon)

- **Persistencia**: los datos viven en archivos JSON en disco, no en una base de datos real. En Render (free tier), el filesystem puede reiniciarse entre deploys o períodos de inactividad.
- **`/debug/logs`**: pensada solo para la demo. Si se define `DEBUG_SECRET`, queda protegida por un secreto simple en la URL — no es un mecanismo de autenticación robusto.
- **Un solo número de prueba de WhatsApp**: usa el número sandbox de Meta, limitado a destinatarios verificados manualmente.
