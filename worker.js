addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Parse path seperti /proxy/178.128.80.43-443 jadi { host: '178.128.80.43', port: 443 }
 */
function parseBackend(path) {
  // Contoh path: /proxy/178.128.80.43-443
  const match = path.match(/^\/proxy\/([\d\.]+)-(\d+)$/);
  if (!match) return null;
  return { host: match[1], port: parseInt(match[2], 10) };
}

async function handleRequest(request) {
  const url = new URL(request.url);

  // Hanya support upgrade ke WebSocket
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Only WebSocket proxy supported!", { status: 400 });
  }

  // Parsing backend dari path
  const backend = parseBackend(url.pathname);
  if (!backend) {
    return new Response("Invalid path. Use /proxy/IP-PORT", { status: 404 });
  }

  // Membuka WebSocket ke client
  const [clientWs, serverWs] = Object.values(new WebSocketPair());

  // Relay WebSocket dari client ke backend
  connectBackend(serverWs, backend.host, backend.port);

  return new Response(null, {
    status: 101,
    webSocket: clientWs
  });
}

/**
 * Buka koneksi TCP ke backend dan relay data antar client <-> backend
 */
async function connectBackend(ws, host, port) {
  ws.accept();
  const tcp = await connect(host, port);

  // Relay data dari backend ke client
  tcp.readable.pipeTo(ws.writable).catch(() => { ws.close(); });
  // Relay data dari client ke backend
  ws.readable.pipeTo(tcp.writable).catch(() => { tcp.close(); });
}

/**
 * Membuka koneksi TCP ke backend proxy (Cloudflare Workers API)
 */
function connect(host, port) {
  // Cloudflare Workers API for TCP socket (fetch with "connect" scheme)
  return fetch(`tcp://${host}:${port}`);
}
