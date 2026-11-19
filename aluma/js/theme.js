// The saved light/dark theme, applied before the page draws (separate file so the CSP can forbid inline scripts).
try { document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('aluma-theme') || '"light"'); } catch (e) { /* ignore */ }
