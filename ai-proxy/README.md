# AI server for the learning-path generator

The learning-path generator (the **Path** page) can build paths with **Claude**. It needs a Claude API key. There are two ways to give it one:

| | For | How |
|---|---|---|
| **School AI server** (recommended) | Every teacher, no setup per teacher | This guide: a small proxy holds the school's key |
| **Personal key** | Trying it out | A teacher pastes their own key on the Path page; it stays only in their browser |

The **built-in generator** (no AI) always works, with no key and no internet.

## Why a proxy?

The site is a static website on GitHub Pages. Anything placed in it is public, so the school's key can't go in the site's code. The proxy is a tiny server that keeps the key secret and passes requests to Claude. It also limits what can be asked:

- only from your site's address;
- only the model the generator uses;
- with a cap on answer length.

## Set it up on Cloudflare Workers (free plan, about 15 minutes)

1. Get a Claude API key at <https://console.anthropic.com> → **API Keys**. Set a monthly spend limit there. Building one path costs roughly $0.10–$0.50, depending on the document's length.
2. Create a free account at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**. Name it e.g. `coolschool-ai` and click **Deploy**.
3. Click **Edit code**, replace everything with the contents of [`worker.js`](worker.js), then click **Deploy**.
4. Go to **Settings → Variables and Secrets** and add:
   - `ANTHROPIC_API_KEY`: your key (type **Secret**)
   - `ALLOWED_ORIGIN`: your site's address without a trailing slash, e.g. `https://coolschooliltamar-bit.github.io`
5. Copy the worker's address, e.g. `https://coolschool-ai.yourname.workers.dev`.
6. On GitHub, edit [`site-config.js`](../site-config.js) and set:
   ```js
   aiProxyUrl: 'https://coolschool-ai.yourname.workers.dev',
   ```

Within a minute or two the Path page shows "Connected to the school's AI server" for every teacher.

## Good to know

- **Who can use it:** only pages on your site's address can call the proxy. A determined person could still send requests that look like they come from your site. The spend limit in the Anthropic Console is your safety net, so set one. When CoolSchool gets a real backend with logins, the proxy should also check that a teacher is signed in.
- **What is sent:** the document's text (PDFs are sent as the file, so Claude can read tables and scanned pages) and the teacher's settings. Nothing about students is sent.
- **Model:** the generator uses Claude Opus 5.5 with structured output, so the answer always has the path's exact shape. If Claude's safety checks decline a document, the request is retried on another model automatically.
