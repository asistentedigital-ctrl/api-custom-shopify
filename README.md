# kommo-shopify-api

API puente entre **Kommo** (Salesbot) y **Shopify**. Kommo llama a este API desde
el paso "Webhook" de un flujo de bot, el API ejecuta la operación correspondiente
contra Shopify y devuelve una respuesta que el bot puede leer.

## Flujo

```
Kommo (Salesbot: paso Webhook)
   -> POST /api/kommo/webhook   (header X-API-KEY)
      -> este API decide la acción (campo "action")
         -> Shopify (pendiente: cliente real en src/services/shopifyClient.ts)
      <- respuesta JSON { ok, data, error }
<- Kommo lee la respuesta y continúa el flujo del bot
```

## Estructura

```
src/
  index.ts              punto de entrada, levanta el servidor
  app.ts                configuración de express (middlewares, rutas)
  config.ts             carga y valida variables de entorno
  logger.ts             logger (pino)
  middleware/
    apiKeyAuth.ts       valida el header X-API-KEY en cada request de Kommo
    errorHandler.ts     404 y manejo de errores no controlados
  routes/
    health.ts           GET /health (usado por Render para healthcheck)
    kommo.ts            POST /api/kommo/webhook, despacha por "action"
  services/
    shopifyClient.ts    placeholder — aquí va la integración real con Shopify
  types/
    kommo.ts            contrato de request/response con Kommo
```

## Contrato del webhook

**Request** (lo que Kommo envía desde el paso Webhook del bot):

```json
{
  "action": "product_search",
  "lead_id": 12345,
  "contact_id": 6789,
  "payload": { "query": "camiseta azul" }
}
```

**Response**:

```json
{ "ok": true, "data": { "products": [] } }
```

o en caso de error:

```json
{ "ok": false, "error": "unknown_action:product_search" }
```

Para agregar una nueva operación (buscar producto, verificar stock, crear orden,
etc.), agrega un nuevo `case` en `src/routes/kommo.ts` y su lógica real en
`src/services/shopifyClient.ts`.

## Desarrollo local

```bash
npm install
cp .env.example .env   # completa KOMMO_API_KEY (y luego las de Shopify)
npm run dev
```

Probar el webhook:

```bash
curl -X POST http://localhost:3000/api/kommo/webhook \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: <el valor de KOMMO_API_KEY>" \
  -d '{"action":"product_search","payload":{"query":"camiseta"}}'
```

## Deploy en Render

1. Sube este proyecto a un repositorio de GitHub/GitLab.
2. En Render: **New > Blueprint**, apunta al repo (usa `render.yaml`) — o crea
   un **Web Service** manual con:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Health check path: `/health`
3. Configura las variables de entorno en Render (no van en el repo):
   - `KOMMO_API_KEY`
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`
     (Client ID/Secret de la app creada en el Dev Dashboard de Shopify; el API
     los intercambia por un access token automáticamente)
4. Render te da una URL pública, ej. `https://kommo-shopify-api.onrender.com`.
   Esa es la URL que se configura en el paso "Webhook" del Salesbot en Kommo:
   - URL: `https://kommo-shopify-api.onrender.com/api/kommo/webhook`
   - Método: `POST`
   - Header: `X-API-KEY: <mismo valor que configuraste en Render>`
   - Body: JSON con `action` y `payload` usando variables del bot.

## Siguiente paso

Implementar `src/services/shopifyClient.ts` con las llamadas reales a la Admin
API de Shopify (REST o GraphQL) para cada `action` que necesite el flujo del bot.
