import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:4000';

console.log(`[Client] Connecting to ${SERVER_URL}...`);

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('[Client] Status: Connected');
});

ws.on('message', (data: WebSocket.Data) => {
  console.log(`[Client] Received message: ${data.toString()}`);
});

ws.on('close', (code, reason) => {
  console.log(`[Client] Status: Connection closed (code: ${code}, reason: ${reason.toString() || 'none'})`);
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('[Client] Connection error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n[Client] Closing connection and exiting...');
  ws.close();
  process.exit(0);
});
