const DRIVE_MEDIA_PREFIX = '/__drive_media__/';
const TOKEN_REQUEST_TYPE = 'drive-media-token-request';
const TOKEN_TIMEOUT_MS = 5000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function getRequestClient(clientId) {
  if (clientId) {
    const client = await self.clients.get(clientId);
    if (client) return client;
  }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clients[0] || null;
}

async function requestAccessToken(clientId) {
  const client = await getRequestClient(clientId);
  if (!client) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeoutId);
      const token = event.data?.token;
      resolve(typeof token === 'string' && token ? token : null);
    };

    client.postMessage({ type: TOKEN_REQUEST_TYPE }, [channel.port2]);
  });
}

async function proxyDriveMedia(request, url, clientId) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const fileId = decodeURIComponent(url.pathname.slice(DRIVE_MEDIA_PREFIX.length));
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return new Response('Invalid Google Drive file ID.', { status: 400 });
  }

  const accessToken = await requestAccessToken(clientId);
  if (!accessToken) {
    return new Response('Google session is unavailable.', { status: 401 });
  }

  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const range = request.headers.get('range');
  if (range) headers.set('Range', range);

  try {
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        method: request.method,
        headers,
      }
    );
    const responseHeaders = new Headers(upstream.headers);
    const requestedMime = url.searchParams.get('mime');
    const upstreamMime = responseHeaders.get('content-type') || '';
    if (requestedMime && (!upstreamMime || upstreamMime.includes('octet-stream'))) {
      responseHeaders.set('Content-Type', requestedMime);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return new Response('Google Drive media request failed.', { status: 502 });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(DRIVE_MEDIA_PREFIX)) {
    return;
  }

  event.respondWith(proxyDriveMedia(event.request, url, event.clientId));
});
