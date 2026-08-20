import http from 'http';
import crypto from 'crypto';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5001;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:4000/webhooks/payment';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'super-secret';
const MAX_ATTEMPTS = 3;

/**
 * Generate HMAC SHA-256 signature for payload
 */
function generateSignature(payload: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Send webhook HTTP POST request with retries
 */
async function sendWebhookWithRetry(eventPayload: object): Promise<{ success: boolean; status?: number; responseBody?: string }> {
  const bodyString = JSON.stringify(eventPayload);
  const signature = generateSignature(bodyString);

  console.log(`\n[Provider]\nPayment event generated\n\nSending webhook...\nPOST ${WEBHOOK_URL}\nSignature: ${signature}\n`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Provider] Webhook delivery attempt ${attempt}/${MAX_ATTEMPTS}...`);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: bodyString,
      });

      const responseText = await response.text();

      if (response.ok) {
        console.log(`\nResponse:\n${response.status} OK\n\nWebhook delivered successfully\n`);
        return { success: true, status: response.status, responseBody: responseText };
      } else {
        console.log(`[Provider] ⚠️ Receiver returned non-2xx status: ${response.status}`);
      }
    } catch (err: any) {
      console.log(`[Provider] ❌ Connection error on attempt ${attempt}:`, err.message || err);
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[Provider] Retrying in 1 second...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Provider] ❌ Webhook delivery failed after ${MAX_ATTEMPTS} attempts.\n`);
  return { success: false };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/trigger-payment') {
    // Check if custom ID or payload requested via query params or request body
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let customData = {};
      try {
        if (body.trim()) {
          customData = JSON.parse(body);
        }
      } catch {
        // Ignore parse errors, fallback to default event
      }

      // Default sample event
      const eventPayload = {
        id: 'evt_123',
        type: 'payment.success',
        timestamp: new Date().toISOString(),
        data: {
          paymentId: 'pay_123',
          amount: 500,
          currency: 'INR',
        },
        ...customData,
      };

      const result = await sendWebhookWithRetry(eventPayload);

      if (result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Webhook delivered successfully',
          status: result.status,
          response: result.responseBody ? JSON.parse(result.responseBody) : null,
        }));
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Failed to deliver webhook to receiver after 3 attempts',
        }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Provider] Webhook Provider running on http://localhost:${PORT}`);
  console.log(`[Provider] Registered Webhook URL: ${WEBHOOK_URL}`);
  console.log(`[Provider] Trigger endpoint: POST http://localhost:${PORT}/trigger-payment`);
});
