/* CoolSchool AI proxy – a Cloudflare Worker that forwards the learning-path generator's
 * requests to the Claude API with the school's key, so teachers never need their own key.
 *
 * Settings (Cloudflare dashboard → Worker → Settings → Variables):
 *   ANTHROPIC_API_KEY  (secret)  the school's Claude API key
 *   ALLOWED_ORIGIN               the site's address, e.g. https://coolschooliltamar-bit.github.io
 */
const ALLOWED_MODELS = ['claude-opus-5-5'];
const MAX_TOKENS = 64000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages') return new Response('Not found', { status: 404, headers: cors });

    // Only what the path generator needs: one model, a capped answer length
    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }
    if (!ALLOWED_MODELS.includes(body.model)) return new Response('Model not allowed', { status: 400, headers: cors });
    body.max_tokens = Math.min(Number(body.max_tokens) || 0, MAX_TOKENS);

    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('x-api-key', env.ANTHROPIC_API_KEY);
    headers.set('anthropic-version', request.headers.get('anthropic-version') || '2023-06-01');
    const beta = request.headers.get('anthropic-beta');
    if (beta) headers.set('anthropic-beta', beta);

    const upstream = await fetch('https://api.anthropic.com/v1/messages' + url.search, { method: 'POST', headers, body: JSON.stringify(body) });
    const out = new Headers(upstream.headers);
    Object.entries(cors).forEach(([k, v]) => out.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
