# Minimal Standalone Webhook Example

A minimal, real-working example of Webhook event delivery using Node.js and TypeScript.

It demonstrates real HTTP communication between an **External Provider** (Simulated SaaS like Stripe/Razorpay) and **Our SaaS Receiver**.

---

## Architecture

```text
Our SaaS (Receiver)
   |
   | 1. Provides Webhook URL: http://localhost:4000/webhooks/payment
   v
External Provider
   |
   | 2. Stores Webhook URL & WEBHOOK_SECRET
   |
   | 3. Event Occurs (e.g. Payment Success)
   v
HTTP POST http://localhost:4000/webhooks/payment
Headers: X-Webhook-Signature: <HMAC SHA-256>
   |
   v
Our SaaS (Receiver)
   |
   | 4. Verify Signature (HMAC SHA-256)
   | 5. Check Idempotency (Event ID deduplication)
   | 6. Process Event
   v
HTTP 200 OK
```

---

## Key Features

1. **Real HTTP Communication**: Webhook provider and receiver communicate over real HTTP requests.
2. **HMAC SHA-256 Signature Security**: Provider signs the payload using `WEBHOOK_SECRET=super-secret` and sends header `X-Webhook-Signature`. Receiver independently computes and verifies the signature in constant time using Node.js `crypto`.
3. **Idempotency Handling**: Receiver maintains an in-memory set of processed event IDs (`evt_123`). Duplicate events return `200 OK` without re-processing.
4. **Automated Retries**: Provider retries delivery up to **3 attempts** if the receiver returns a non-2xx status code or connection failure.

---

## Project Structure

```text
webhook-demo/
│
├── webhook-receiver/      # Our SaaS (Port 4000)
│   ├── src/
│   │   └── index.ts       # POST /webhooks/payment (Verify signature, Idempotency, Process)
│   ├── package.json
│   └── tsconfig.json
│
├── webhook-provider/      # External Provider (Port 5000)
│   ├── src/
│   │   └── index.ts       # POST /trigger-payment (Generate event, Sign, HTTP POST, Retry)
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## Quick Start & Testing

### Step 1: Start Receiver (Terminal 1)

```bash
cd webhook-receiver
npm install
npm run dev
```

*Receiver will listen on `http://localhost:4000`*

---

### Step 2: Start Provider (Terminal 2)

```bash
cd webhook-provider
npm install
npm run dev
```

*Provider will listen on `http://localhost:5000`*

---

### Step 3: Trigger an Event (Terminal 3)

Run the following command to trigger a payment event from the Provider:

```bash
curl -X POST http://localhost:5000/trigger-payment
```

#### Expected Log Output in Terminal 1 (Receiver):
```text
[Receiver]
Webhook received

Event ID: evt_123
Event Type: payment.success
Amount: 500
```

#### Expected Log Output in Terminal 2 (Provider):
```text
[Provider]
Payment event generated

Sending webhook...
POST http://localhost:4000/webhooks/payment

Response:
200 OK

Webhook delivered successfully
```

---

## Testing Security & Idempotency

### 1. Test Idempotency (Duplicate Event)
Run the trigger command again:
```bash
curl -X POST http://localhost:5000/trigger-payment
```
#### Output in Receiver:
```text
[Receiver]
Event already processed
→ do not process it again
→ returning 200 OK (Event ID: evt_123)
```

---

### 2. Test Invalid Signature (Security)
Send a direct request to the receiver with a forged or invalid signature:
```bash
curl -X POST http://localhost:4000/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: invalid-signature-hash" \
  -d '{"id":"evt_999","type":"payment.success"}'
```
#### Output:
```json
{"error":"Unauthorized: Invalid signature"}
```
*HTTP Status: `401 Unauthorized`*

---

### 3. Test Retries
Stop the receiver server (Terminal 1) and run:
```bash
curl -X POST http://localhost:5000/trigger-payment
```
#### Output in Provider:
```text
[Provider] Webhook delivery attempt 1/3...
[Provider] ❌ Connection error on attempt 1: fetch failed
[Provider] Retrying in 1 second...
[Provider] Webhook delivery attempt 2/3...
...
[Provider] ❌ Webhook delivery failed after 3 attempts.
```
