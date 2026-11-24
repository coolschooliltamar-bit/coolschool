// Public configuration. The OAuth Client ID is public by design (it identifies the app).
// NEVER put a client secret or any API key with spending power in this file – the site is public.
export const GOOGLE_CLIENT_ID = '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com';

// Gemini API (spec 04, temporary AI engine). The API KEY is NOT stored here: each tester pastes it in
// Aluma's settings and it stays in their own browser. For everyone, deploy a small proxy that holds
// the key on a server and put its address here, e.g. 'https://aluma-ai.example.workers.dev'.
export const GEMINI_PROXY_URL = 'https://aluma.aluma-school.workers.dev';   // Aluma's Cloudflare Worker (aluma/server)
// Leave empty to pick the newest available "flash" model automatically.
export const GEMINI_MODEL = '';
// Warm phrasing (js/warm.js): after a fast answer, Gemini rewords it to sound more human. The numbers come
// from the data and are checked; if Gemini is slow or the wording fails a check, the plain answer stays.
// true = on. Set to false to turn it off at once.
export const WARM_PHRASING = true;
