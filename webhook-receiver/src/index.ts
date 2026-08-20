import http from 'http';
import crypto from 'crypto';

const PORT = 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'super-secret';

// In-memory set to track processed event IDs for idempotency
const processedEvents = new Set<string>();

/**
 * Verify HMAC SHA-256 signature in constant time
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhooks/payment') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      // 1. Read signature header
      const signature = req.headers['x-webhook-signature'] as string | undefined;

      // 2. Verify signature
      if (!verifySignature(body, signature)) {
        console.log('[Receiver] ❌ Unauthorized: Invalid signature header');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid signature' }));
        return;
      }

      try {
        const payload = JSON.parse(body);
        const eventId = payload.id;
        const eventType = payload.type;
        const amount = payload.data?.amount;

        // 3. Idempotency Check
        if (processedEvents.has(eventId)) {
          console.log(`\n[Receiver]\nEvent already processed\n→ do not process it again\n→ returning 200 OK (Event ID: ${eventId})\n`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, received: true, duplicate: true }));
          return;
        }

        // Mark event as processed
        processedEvents.add(eventId);

        // 4. Process Event
        console.log(`\n[Receiver]\nWebhook received\n\nEvent ID: ${eventId}\nEvent Type: ${eventType}\nAmount: ${amount}\n`);

        // 5. Return HTTP 200 OK
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, received: true }));
      } catch (err) {
        console.error('[Receiver] ❌ Error parsing JSON body:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Receiver] Webhook Receiver running on http://localhost:${PORT}`);
  console.log(`[Receiver] Listening for POST /webhooks/payment`);
});
