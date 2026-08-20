import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = 4000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/events') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const eventMessage = JSON.stringify(payload);

        console.log(`[Server] Broadcasting event to ${wss.clients.size} client(s):`, payload);

        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(eventMessage);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clientsNotified: wss.clients.size }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Server] Client connected from ${clientIp}`);

  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }));

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[Server] Client connection error:', error.message);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] WebSocket & HTTP server running on http://localhost:${PORT} (ws://localhost:${PORT})`);
});
