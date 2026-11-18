// Cloudflare Worker that keeps the Gemini API key on the server (never in the public site).
// Deploy: create a Worker, paste this file, add a secret named GEMINI_API_KEY, then put the
// Worker's URL in aluma/js/config.js as GEMINI_PROXY_URL.
// Only the two Gemini calls Aluma needs are forwarded, and only for the Aluma site.
const ALLOWED_ORIGIN = 'https://coolschooliltamar-bit.github.io';
const UPSTREAM = 'https://generativelanguage.googleapis.com';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (origin !== ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    const url = new URL(request.url);
    const okPath = (request.method === 'GET' && url.pathname === '/v1beta/models') ||
                   (request.method === 'POST' && /^\/v1beta\/models\/gemini-[\w.-]+:generateContent$/.test(url.pathname));
    if (!okPath) return new Response('Not found', { status: 404, headers: cors });
    const body = request.method === 'POST' ? await request.text() : undefined;
    if (body && body.length > 200000) return new Response('Too large', { status: 413, headers: cors });
    const up = await fetch(`${UPSTREAM}${url.pathname}${url.pathname === '/v1beta/models' ? '?pageSize=200' : ''}`, {
      method: request.method, body, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    });
    return new Response(up.body, { status: up.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
