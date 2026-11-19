// Public configuration. The OAuth Client ID is public by design (it identifies the app).
// NEVER put a client secret or any API key with spending power in this file – the site is public.
export const GOOGLE_CLIENT_ID = '1054746371715-vpsff7knc52n61rmhgrgotf0ag3t90u2.apps.googleusercontent.com';

// Gemini API (spec 04, temporary AI engine). The API KEY is NOT stored here: each tester pastes it in
// Aluma's settings and it stays in their own browser. For everyone, deploy a small proxy that holds
// the key on a server and put its address here, e.g. 'https://aluma-ai.example.workers.dev'.
export const GEMINI_PROXY_URL = 'https://aluma.aluma-school.workers.dev';   // Aluma's Cloudflare Worker (aluma/server)
// Leave empty to pick the newest available "flash" model automatically.
export const GEMINI_MODEL = '';

// Security settings (security-hardening – see aluma-spec/19-security-compliance.md)
export const DEMO_ACCOUNTS = true;        // the demo-account picker with fictional data. MUST be false in a deployment with real students.
export const IDLE_MINUTES = 30;          // Annex C 4.1.7: half an hour for personal/sensitive data
export const MAX_SESSION_HOURS = 8;      // Annex C 4.1.6: a session with personal/sensitive data ends after 8 hours           // real (Google) sessions end after this much inactivity – shared school computers
