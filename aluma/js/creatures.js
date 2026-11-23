// Procedural creatures for cards 41–1000 (see js/card-worlds.js).
// A creature = a body plan (critter, bird, fish, sea, dragon, bot, sprout, bug, spirit, dino, blob) with the
// species' features, the variant's colours (slightly shifted per species), a face, an accessory, the variant's
// element floating around it and effects that grow with rarity. Everything is seeded by the card id, so a card
// always looks the same. Drawn in a 400×400 box standing on y≈360 (like the hand-drawn originals).

export const INK = '#2b2340';
export const OL = `stroke="${INK}" stroke-opacity=".3" stroke-width="3" stroke-linejoin="round"`;
const OLs = `stroke="${INK}" stroke-opacity=".3" stroke-width="2.5" stroke-linejoin="round"`;

// ---------- colour & random helpers ----------
export function tone(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const t = amt < 0 ? 0 : 255, q = Math.abs(amt);
  const ch = s => Math.round((t - s) * q + s);
  return '#' + ((1 << 24) + (ch(n >> 16) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
}
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
function hue(hex, deg) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const dd = mx - mn; s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h /= 6; }
  h = (h + deg / 360 + 1) % 1;
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const to = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return s === 0 ? hex : '#' + to(f(p, q, h + 1 / 3)) + to(f(p, q, h)) + to(f(p, q, h - 1 / 3));
}
export function rng(seed) { let a = seed * 9973 + 12345; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (R, a) => a[Math.floor(R() * a.length)];
export function palette(main, accent, shift = 0) {
  const m = shift ? hue(main, shift) : main;
  const light = lum(m) > 0.86;
  return { main: m, dark: tone(m, light ? -0.2 : -0.32), deep: tone(m, -0.55), light: tone(m, 0.45), belly: light ? tone(accent, 0.78) : tone(m, 0.7),
    accent, acDark: tone(accent, -0.3), acLight: tone(accent, 0.5), eye: lum(accent) > 0.75 ? '#4a3a7a' : tone(accent, -0.35) };
}

// ---------- small shapes ----------
const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" ${x}/>`;
const C = (cx, cy, r, fill, x = '') => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}" ${x}/>`;
const f1 = n => Math.round(n * 10) / 10;
const rot = (a, x, y) => `transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})"`;
const mir = s => `<g transform="translate(400 0) scale(-1 1)">${s}</g>`;
const both = s => s + mir(s);
const shine = (x, y, rx, ry, a = -30, o = 0.55) => E(x, y, rx, ry, '#fff', `opacity="${o}" ${rot(a, x, y)}`);
export const sparkle = (x, y, r, fill = '#fff', o = 1) => `<path d="M${f1(x)} ${f1(y - r)} Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)} Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z" fill="${fill}" opacity="${o}"/>`;
export const star5 = (cx, cy, R, r, a0 = -90) => { let s = ''; for (let i = 0; i < 10; i++) { const a = (a0 + i * 36) * Math.PI / 180, rr = i % 2 ? r : R; s += `${i ? 'L' : 'M'}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))} `; } return s + 'Z'; };
const heart = (x, y, s) => `M${f1(x)} ${f1(y + 6 * s)} C${f1(x - 14 * s)} ${f1(y - 4 * s)} ${f1(x - 8 * s)} ${f1(y - 14 * s)} ${f1(x)} ${f1(y - 6 * s)} C${f1(x + 8 * s)} ${f1(y - 14 * s)} ${f1(x + 14 * s)} ${f1(y - 4 * s)} ${f1(x)} ${f1(y + 6 * s)}Z`;
const dropP = (x, y, s) => `M${f1(x)} ${f1(y - 16 * s)} Q${f1(x + 11 * s)} ${f1(y)} ${f1(x + 8 * s)} ${f1(y + 6 * s)} Q${f1(x)} ${f1(y + 14 * s)} ${f1(x - 8 * s)} ${f1(y + 6 * s)} Q${f1(x - 11 * s)} ${f1(y)} ${f1(x)} ${f1(y - 16 * s)}Z`;
const leafP = (x, y, s, a = 0) => `<path d="M${f1(x)} ${f1(y - 14 * s)} Q${f1(x + 12 * s)} ${f1(y)} ${f1(x)} ${f1(y + 14 * s)} Q${f1(x - 12 * s)} ${f1(y)} ${f1(x)} ${f1(y - 14 * s)}Z" ${rot(a, x, y)}`;
const ground = (rx = 92, y = 360, o = 0.2) => E(200, y, rx, rx * 0.13, '#1b1430', `opacity="${o}"`);

// ---------- the face ----------
// o.eyes: big | sparkle | happy | wink | sleepy | dot | star · o.mouth: smile | grin | cat | o | tongue | fang
export function face(d, x, y, s, o, p) {
  const g = 64 * s, r = 15 * s;
  const big = (ex, spark) => `${E(ex, y, r, r * 1.18, '#fff', `stroke="${INK}" stroke-opacity=".4" stroke-width="${f1(2.4 * s)}"`)}${E(ex + r * 0.06, y + r * 0.16, r * 0.74, r * 0.86, p.eye)}${C(ex + r * 0.06, y + r * 0.24, r * 0.46, INK)}${C(ex + r * 0.36, y - r * 0.2, r * 0.3, '#fff')}${C(ex - r * 0.24, y + r * 0.5, r * 0.13, '#fff')}${spark ? sparkle(ex - r * 0.3, y - r * 0.05, r * 0.34, '#fff') : ''}`;
  const arc = (ex, up) => `<path d="M${f1(ex - r * 0.75)} ${f1(y + (up ? 3 : -3) * s)} Q${f1(ex)} ${f1(y + (up ? -12 : 10) * s)} ${f1(ex + r * 0.75)} ${f1(y + (up ? 3 : -3) * s)}" fill="none" stroke="${INK}" stroke-width="${f1(4.2 * s)}" stroke-linecap="round"/>`;
  const dot = ex => `${E(ex, y, r * 0.42, r * 0.56, INK)}${C(ex + r * 0.14, y - r * 0.18, r * 0.16, '#fff')}`;
  const starEye = ex => `<path d="${star5(ex, y, r * 0.95, r * 0.45)}" fill="${p.accent}" stroke="${INK}" stroke-opacity=".5" stroke-width="${f1(2 * s)}" stroke-linejoin="round"/>${C(ex - r * 0.2, y - r * 0.25, r * 0.18, '#fff')}`;
  const L = x - g / 2, Rr = x + g / 2;
  let e = { big: big(L) + big(Rr), sparkle: big(L, 1) + big(Rr, 1), happy: arc(L, 1) + arc(Rr, 1), wink: big(L) + arc(Rr, 1), sleepy: arc(L, 0) + arc(Rr, 0), dot: dot(L) + dot(Rr), star: starEye(L) + starEye(Rr) }[o.eyes] || big(L) + big(Rr);
  if (o.lashes) e += [L, Rr].map((ex, i) => `<path d="M${f1(ex + (i ? 1 : -1) * r * 0.8)} ${f1(y - r * 0.7)} l${f1((i ? 1 : -1) * 7 * s)} ${f1(-6 * s)}" stroke="${INK}" stroke-width="${f1(3 * s)}" stroke-linecap="round"/>`).join('');
  const my = y + 36 * s, w = 13 * s;
  const m = {
    smile: `<path d="M${f1(x - w)} ${f1(my)} Q${f1(x)} ${f1(my + w)} ${f1(x + w)} ${f1(my)}" fill="none" stroke="${INK}" stroke-width="${f1(4 * s)}" stroke-linecap="round"/>`,
    grin: `<path d="M${f1(x - w)} ${f1(my - 2 * s)} Q${f1(x)} ${f1(my + w * 1.5)} ${f1(x + w)} ${f1(my - 2 * s)}Z" fill="${INK}"/><path d="M${f1(x - w * 0.55)} ${f1(my + w * 0.6)} Q${f1(x)} ${f1(my + w * 1.15)} ${f1(x + w * 0.55)} ${f1(my + w * 0.6)} Q${f1(x)} ${f1(my + w * 0.35)} ${f1(x - w * 0.55)} ${f1(my + w * 0.6)}Z" fill="#ff7d8e"/>`,
    cat: `<path d="M${f1(x - w)} ${f1(my)} Q${f1(x - w / 2)} ${f1(my + w * 0.8)} ${f1(x)} ${f1(my)} Q${f1(x + w / 2)} ${f1(my + w * 0.8)} ${f1(x + w)} ${f1(my)}" fill="none" stroke="${INK}" stroke-width="${f1(3.6 * s)}" stroke-linecap="round"/>`,
    o: E(x, my + 4 * s, 6 * s, 8 * s, INK) + E(x, my + 7 * s, 3.5 * s, 3 * s, '#ff7d8e'),
    tongue: `<path d="M${f1(x - w)} ${f1(my)} Q${f1(x)} ${f1(my + w)} ${f1(x + w)} ${f1(my)}" fill="none" stroke="${INK}" stroke-width="${f1(4 * s)}" stroke-linecap="round"/><path d="M${f1(x + 1 * s)} ${f1(my + w * 0.45)} q${f1(4 * s)} ${f1(14 * s)} ${f1(11 * s)} ${f1(2 * s)}Z" fill="#ff7d8e" stroke="${INK}" stroke-opacity=".5" stroke-width="${f1(2 * s)}"/>`,
    fang: `<path d="M${f1(x - w)} ${f1(my)} Q${f1(x)} ${f1(my + w)} ${f1(x + w)} ${f1(my)}" fill="none" stroke="${INK}" stroke-width="${f1(4 * s)}" stroke-linecap="round"/><path d="M${f1(x - w * 0.45)} ${f1(my + w * 0.38)} l${f1(3 * s)} ${f1(7 * s)} l${f1(3 * s)} ${f1(-6 * s)}Z" fill="#fff" stroke="${INK}" stroke-width="${f1(1.5 * s)}"/>`,
  }[o.mouth] || '';
  const b = o.blush ? [L - r * 0.4, Rr + r * 0.4].map(bx => E(bx, y + 24 * s, 12 * s, 7 * s, '#ff8fa6', 'opacity=".55"')).join('') : '';
  const gl = o.glasses ? `<g fill-opacity=".18" stroke="${INK}" stroke-width="${f1(3.6 * s)}">${C(L, y, r * 1.55, '#fff')}${C(Rr, y, r * 1.55, '#fff')}</g><path d="M${f1(L + r * 1.55)} ${f1(y)} Q${f1(x)} ${f1(y - 6 * s)} ${f1(Rr - r * 1.55)} ${f1(y)}" stroke="${INK}" stroke-width="${f1(3.6 * s)}" fill="none"/>` : '';
  return e + b + m + gl;
}

// ---------- accessories (on the head circle h = {cx, cy, r}; neck n = {x, y, w}) ----------
function accessory(d, kind, h, n, p) {
  if (!kind || kind === 'none' || kind === 'glasses') return '';
  const { cx, cy, r } = h, top = cy - r, gold = d.lg(['#fff3b0', '#ffd34d', '#e8a92a'], 0, 0, 0, 1);
  switch (kind) {
    case 'crown': return `<g ${rot(-8, cx, top)}><path d="M${cx - 38} ${top + 14} L${cx - 44} ${top - 30} L${cx - 20} ${top - 8} L${cx} ${top - 42} L${cx + 20} ${top - 8} L${cx + 44} ${top - 30} L${cx + 38} ${top + 14}Z" fill="${gold}" ${OL}/>${C(cx, top - 4, 7, '#ff4d8d', OLs)}${C(cx - 24, top + 2, 5, '#4cc9f0')}${C(cx + 24, top + 2, 5, '#7bd389')}${C(cx - 44, top - 30, 5, '#fff3b0')}${C(cx, top - 42, 5, '#fff3b0')}${C(cx + 44, top - 30, 5, '#fff3b0')}</g>`;
    case 'halo': return `<ellipse cx="${cx}" cy="${top - 26}" rx="${r * 0.62}" ry="${r * 0.16}" fill="none" stroke="#ffe27a" stroke-width="12" opacity=".5" filter="${d.glow(5)}"/><ellipse cx="${cx}" cy="${top - 26}" rx="${r * 0.62}" ry="${r * 0.16}" fill="none" stroke="${gold}" stroke-width="7"/>`;
    case 'beanie': return `<path d="M${cx - r * 0.86} ${top + r * 0.5} Q${cx - r * 0.8} ${top - r * 0.28} ${cx} ${top - r * 0.3} Q${cx + r * 0.8} ${top - r * 0.28} ${cx + r * 0.86} ${top + r * 0.5}Z" fill="${d.rg(p.accent)}" ${OL}/><rect x="${cx - r * 0.92}" y="${top + r * 0.34}" width="${r * 1.84}" height="${r * 0.3}" rx="${r * 0.15}" fill="${d.rg(p.acDark)}" ${OL}/>${C(cx, top - r * 0.34, 16, d.rg(p.acLight), OL)}`;
    case 'bow': { const x = cx + r * 0.55, y = top + r * 0.22; return `<path d="M${x} ${y} L${x - 30} ${y - 20} Q${x - 36} ${y} ${x - 30} ${y + 20}Z M${x} ${y} L${x + 30} ${y - 20} Q${x + 36} ${y} ${x + 30} ${y + 20}Z" fill="${d.rg(p.accent)}" ${OL}/>${C(x, y, 9, d.rg(p.acDark), OL)}`; }
    case 'flower': { const x = cx - r * 0.6, y = top + r * 0.24; return [0, 72, 144, 216, 288].map(a => E(x + 14 * Math.cos(a * Math.PI / 180), y + 14 * Math.sin(a * Math.PI / 180), 11, 11, d.rg(p.acLight), OLs)).join('') + C(x, y, 9, '#ffd34d', OLs); }
    case 'leaf': return `<path d="M${cx} ${top + 6} Q${cx - 2} ${top - 24} ${cx + 4} ${top - 34}" stroke="#4f8a3a" stroke-width="5" fill="none" stroke-linecap="round"/>${leafP(cx + 18, top - 34, 1.5, 60)} fill="${d.rg('#7bd389')}" ${OLs}/>${leafP(cx - 12, top - 26, 1.1, -60)} fill="${d.rg('#9be37a')}" ${OLs}/>`;
    case 'star': { const x = cx + r * 0.58, y = top + r * 0.3; return `<path d="${star5(x, y, 20, 9, -80)}" fill="${gold}" ${OLs}/>`; }
    case 'cap': return `<path d="M${cx - r * 0.86} ${top + r * 0.45} Q${cx - r * 0.75} ${top - r * 0.25} ${cx} ${top - r * 0.25} Q${cx + r * 0.75} ${top - r * 0.25} ${cx + r * 0.86} ${top + r * 0.45}Z" fill="${d.rg(p.accent)}" ${OL}/><path d="M${cx + r * 0.2} ${top + r * 0.42} Q${cx + r * 1.2} ${top + r * 0.3} ${cx + r * 1.25} ${top + r * 0.55} Q${cx + r * 0.8} ${top + r * 0.62} ${cx + r * 0.2} ${top + r * 0.58}Z" fill="${d.rg(p.acDark)}" ${OL}/>${C(cx, top - r * 0.24, 7, p.acDark)}`;
    case 'party': return `<path d="M${cx - 28} ${top + 12} L${cx + 6} ${top - 74} L${cx + 34} ${top + 10}Z" fill="${d.rg(p.accent)}" ${OL}/><path d="M${cx - 18} ${top - 14} L${cx + 26} ${top - 20} M${cx - 8} ${top - 40} L${cx + 18} ${top - 44}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>${C(cx + 6, top - 76, 11, '#ffd34d', OLs)}`;
    case 'wizard': return `<path d="M${cx - r * 1.05} ${top + r * 0.42} Q${cx} ${top + r * 0.18} ${cx + r * 1.05} ${top + r * 0.42} Q${cx} ${top + r * 0.62} ${cx - r * 1.05} ${top + r * 0.42}Z" fill="${d.rg('#4b2a8a')}" ${OL}/><path d="M${cx - r * 0.62} ${top + r * 0.38} Q${cx - 10} ${top - r * 0.6} ${cx + 30} ${top - r * 1.15} Q${cx + 14} ${top - r * 0.5} ${cx + r * 0.62} ${top + r * 0.36}Z" fill="${d.rg('#6a3fc1')}" ${OL}/><path d="${star5(cx - 2, top - 2, 13, 6)}" fill="#ffd34d"/>${sparkle(cx + 22, top - 40, 8, '#ffd34d')}`;
    case 'tophat': return `<rect x="${cx - r * 0.85}" y="${top + r * 0.1}" width="${r * 1.7}" height="14" rx="7" fill="${d.rg('#2b2340')}" ${OL}/><rect x="${cx - r * 0.5}" y="${top - r * 0.75}" width="${r}" height="${r * 0.9}" rx="8" fill="${d.rg('#3a3150')}" ${OL}/><rect x="${cx - r * 0.5}" y="${top - r * 0.05}" width="${r}" height="12" fill="${p.accent}"/>`;
    case 'nightcap': return `<path d="M${cx - r * 0.85} ${top + r * 0.45} Q${cx - r * 0.5} ${top - r * 0.6} ${cx + r * 0.4} ${top - r * 0.5} Q${cx + r * 1.2} ${top - r * 0.4} ${cx + r * 1.25} ${top + r * 0.35} Q${cx + r * 0.7} ${top - r * 0.1} ${cx + r * 0.85} ${top + r * 0.45}Z" fill="${d.rg(p.acLight)}" ${OL}/>${C(cx + r * 1.25, top + r * 0.42, 14, '#fff', OL)}<rect x="${cx - r * 0.9}" y="${top + r * 0.32}" width="${r * 1.8}" height="${r * 0.26}" rx="${r * 0.13}" fill="#fff" ${OL}/>`;
    case 'headphones': return `<path d="M${cx - r * 0.98} ${cy} Q${cx - r * 1.05} ${top - r * 0.2} ${cx} ${top - r * 0.22} Q${cx + r * 1.05} ${top - r * 0.2} ${cx + r * 0.98} ${cy}" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${cx - r * 0.98} ${cy} Q${cx - r * 1.05} ${top - r * 0.2} ${cx} ${top - r * 0.22} Q${cx + r * 1.05} ${top - r * 0.2} ${cx + r * 0.98} ${cy}" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round"/>${[-1, 1].map(s => `<rect x="${cx + s * r * 0.98 - 16}" y="${cy - 26}" width="32" height="52" rx="14" fill="${d.rg(p.accent)}" ${OL}/>`).join('')}`;
    case 'helmet': return `<circle cx="${cx}" cy="${cy + 6}" r="${r * 1.24}" fill="#e8f6ff" fill-opacity=".16" stroke="#dff3ff" stroke-width="5" stroke-opacity=".9"/><path d="M${cx - r * 0.75} ${cy - r * 0.6} Q${cx - r * 0.3} ${cy - r * 1.05} ${cx + r * 0.2} ${cy - r * 1.02}" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".75"/>`;
    case 'goggles': return `<path d="M${cx - r * 0.98} ${top + r * 0.42} Q${cx} ${top + r * 0.2} ${cx + r * 0.98} ${top + r * 0.42}" stroke="${INK}" stroke-width="9" fill="none"/>${[-1, 1].map(s => `${C(cx + s * r * 0.36, top + r * 0.32, 20, '#bfe9ff', `stroke="${p.acDark}" stroke-width="7"`)}${shine(cx + s * r * 0.36 - 6, top + r * 0.26, 6, 3)}`).join('')}`;
    case 'band': return `<path d="M${cx - r * 0.97} ${top + r * 0.5} Q${cx} ${top + r * 0.2} ${cx + r * 0.97} ${top + r * 0.5}" stroke="${p.accent}" stroke-width="16" fill="none"/><path d="M${cx - r * 0.97} ${top + r * 0.5} Q${cx} ${top + r * 0.2} ${cx + r * 0.97} ${top + r * 0.5}" stroke="#fff" stroke-width="4" fill="none" stroke-dasharray="2 10" opacity=".8"/>`;
    case 'miner': return `<path d="M${cx - r * 0.95} ${top + r * 0.5} Q${cx - r * 0.85} ${top - r * 0.28} ${cx} ${top - r * 0.28} Q${cx + r * 0.85} ${top - r * 0.28} ${cx + r * 0.95} ${top + r * 0.5}Z" fill="${d.rg('#ffcf3f')}" ${OL}/>${C(cx, top + r * 0.05, 15, '#fff8c2', OL)}<path d="M${cx - 10} ${top} L${cx - 60} ${top - 70} L${cx + 60} ${top - 70} L${cx + 10} ${top}Z" fill="#fff8c2" opacity=".25"/>`;
    case 'knight': return `<path d="M${cx - r * 0.98} ${cy - 4} Q${cx - r * 0.98} ${top - r * 0.22} ${cx} ${top - r * 0.22} Q${cx + r * 0.98} ${top - r * 0.22} ${cx + r * 0.98} ${cy - 4} L${cx + r * 0.8} ${cy - 4} Q${cx + r * 0.7} ${top + r * 0.3} ${cx} ${top + r * 0.3} Q${cx - r * 0.7} ${top + r * 0.3} ${cx - r * 0.8} ${cy - 4}Z" fill="${d.rg('#c9d3e0')}" ${OL}/><path d="M${cx} ${top - r * 0.2} Q${cx + 24} ${top - r * 0.9} ${cx + 52} ${top - r * 0.6} Q${cx + 26} ${top - r * 0.45} ${cx + 8} ${top - r * 0.2}Z" fill="${d.rg(p.accent)}" ${OL}/>`;
    case 'scarf': if (!n) return ''; return `<path d="M${n.x - n.w / 2} ${n.y - 8} Q${n.x} ${n.y + 14} ${n.x + n.w / 2} ${n.y - 8} L${n.x + n.w / 2} ${n.y + 10} Q${n.x} ${n.y + 32} ${n.x - n.w / 2} ${n.y + 10}Z" fill="${d.rg(p.accent)}" ${OL}/><path d="M${n.x + n.w * 0.2} ${n.y + 14} l-8 46 l26 -4 l-2 -40Z" fill="${d.rg(p.acDark)}" ${OL}/>`;
    case 'bowtie': if (!n) return ''; return `<path d="M${n.x} ${n.y + 6} L${n.x - 26} ${n.y - 10} L${n.x - 26} ${n.y + 22}Z M${n.x} ${n.y + 6} L${n.x + 26} ${n.y - 10} L${n.x + 26} ${n.y + 22}Z" fill="${d.rg(p.accent)}" ${OL}/>${C(n.x, n.y + 6, 7, p.acDark)}`;
    default: return '';
  }
}

// ---------- shared parts ----------
function wings(d, p, kind, x, y, robot) {
  if (kind === 'bat') { const w = `<path d="M${x - 50} ${y - 20} Q${x - 120} ${y - 90} ${x - 160} ${y - 40} Q${x - 140} ${y - 30} ${x - 140} ${y - 10} Q${x - 120} ${y - 24} ${x - 106} ${y} Q${x - 90} ${y - 16} ${x - 70} ${y + 10}Z" fill="${d.rg(p.dark)}" ${OL}/>`; return w + mir(w); }
  if (kind === 'fairy') { const w = `<path d="M${x - 30} ${y - 10} Q${x - 120} ${y - 120} ${x - 140} ${y - 50} Q${x - 130} ${y} ${x - 36} ${y + 6}Z" fill="${p.acLight}" fill-opacity=".7" ${OL}/><path d="M${x - 32} ${y + 6} Q${x - 110} ${y + 40} ${x - 90} ${y + 70} Q${x - 60} ${y + 70} ${x - 30} ${y + 16}Z" fill="${p.acLight}" fill-opacity=".6" ${OL}/>${sparkle(x - 100, y - 50, 8, '#fff')}`; return w + mir(w); }
  if (kind === 'fins') { const w = `<path d="M${x - 60} ${y} Q${x - 130} ${y - 40} ${x - 150} ${y + 10} Q${x - 120} ${y + 4} ${x - 110} ${y + 30} Q${x - 90} ${y + 14} ${x - 70} ${y + 30}Z" fill="${d.rg(p.accent)}" ${OL}/>`; return w + mir(w); }
  const big = kind === 'big', s = big ? 1 : 0.62;
  const col = robot ? '#c9d3e0' : p.accent;
  const w = `<path d="M${x - 40} ${y - 10} Q${x - 70 - 70 * s} ${y - 130 * s} ${x - 60 - 110 * s} ${y - 70 * s} Q${x - 70 - 70 * s} ${y - 40 * s} ${x - 60 - 90 * s} ${y - 10 * s} Q${x - 60 - 50 * s} ${y - 20 * s} ${x - 50 - 50 * s} ${y + 10 * s} Q${x - 60} ${y - 6} ${x - 44} ${y + 20}Z" fill="${d.rg(col)}" ${OL}/><path d="M${x - 44} ${y - 4} L${x - 60 - 100 * s} ${y - 66 * s} M${x - 46} ${y + 6} L${x - 60 - 80 * s} ${y - 12 * s}" stroke="${tone(col, -0.25)}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`;
  return w + mir(w);
}
function tail(d, p, kind) {
  switch (kind) {
    case 'fluffy': return `<path d="M250 318 C320 330 356 262 330 206 C318 236 300 256 262 282Z" fill="${d.rg(p.main)}" ${OL}/><path d="M330 206 C344 226 344 248 334 262 C322 250 318 228 330 206Z" fill="${p.light}"/>`;
    case 'squirrel': return `<path d="M246 320 C340 330 360 220 320 150 C300 120 260 130 276 170 C300 210 300 250 250 280Z" fill="${d.rg(p.main)}" ${OL}/><path d="M318 160 C330 200 326 240 300 270" stroke="${p.light}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/>`;
    case 'raccoon': return `<path d="M250 320 C330 330 350 270 330 220 C316 250 296 270 256 290Z" fill="${d.rg(p.main)}" ${OL}/>${[0, 1, 2].map(i => `<path d="M${262 + i * 22} ${312 - i * 22} q16 -6 22 -22" stroke="${p.deep}" stroke-width="10" fill="none" stroke-linecap="round"/>`).join('')}`;
    case 'thin': return `<path d="M252 322 C312 330 336 286 318 250" fill="none" stroke="${p.dark}" stroke-width="13" stroke-linecap="round"/>${C(318, 248, 10, p.dark)}`;
    case 'curl': return `<path d="M252 312 C286 316 300 296 288 282 C278 272 266 284 276 292" fill="none" stroke="${p.dark}" stroke-width="9" stroke-linecap="round"/>`;
    default: return '';
  }
}
function ears(d, p, kind, h) {
  const { cx, cy, r } = h;
  switch (kind) {
    case 'cat': return both(`<path d="M${cx - r * 0.82} ${cy - r * 0.38} L${cx - r * 0.78} ${cy - r * 1.18} L${cx - r * 0.18} ${cy - r * 0.8}Z" fill="${d.rg(p.main)}" ${OL}/><path d="M${cx - r * 0.7} ${cy - r * 0.5} L${cx - r * 0.7} ${cy - r * 0.98} L${cx - r * 0.34} ${cy - r * 0.76}Z" fill="${p.acLight}"/>`);
    case 'fox': return both(`<path d="M${cx - r * 0.86} ${cy - r * 0.3} L${cx - r * 0.92} ${cy - r * 1.4} L${cx - r * 0.12} ${cy - r * 0.84}Z" fill="${d.rg(p.main)}" ${OL}/><path d="M${cx - r * 0.74} ${cy - r * 0.46} L${cx - r * 0.82} ${cy - r * 1.16} L${cx - r * 0.32} ${cy - r * 0.82}Z" fill="${p.belly}"/>`);
    case 'round': return both(`${C(cx - r * 0.7, cy - r * 0.72, r * 0.3, d.rg(p.main), OL)}${C(cx - r * 0.7, cy - r * 0.72, r * 0.16, p.acLight)}`);
    case 'bear': return both(`${C(cx - r * 0.72, cy - r * 0.68, r * 0.34, d.rg(p.main), OL)}${C(cx - r * 0.72, cy - r * 0.68, r * 0.19, p.belly)}`);
    case 'bunny': return both(`<ellipse cx="${cx - r * 0.38}" cy="${cy - r * 1.3}" rx="${r * 0.24}" ry="${r * 0.66}" fill="${d.rg(p.main)}" ${OL} ${rot(-12, cx - r * 0.38, cy - r * 1.3)}/><ellipse cx="${cx - r * 0.38}" cy="${cy - r * 1.26}" rx="${r * 0.12}" ry="${r * 0.48}" fill="${p.acLight}" ${rot(-12, cx - r * 0.38, cy - r * 1.3)}/>`);
    case 'mouse': return both(`${C(cx - r * 0.84, cy - r * 0.64, r * 0.46, d.rg(p.main), OL)}${C(cx - r * 0.84, cy - r * 0.64, r * 0.28, p.acLight)}`);
    case 'bat': return both(`<path d="M${cx - r * 0.78} ${cy - r * 0.4} L${cx - r * 1.05} ${cy - r * 1.3} L${cx - r * 0.2} ${cy - r * 0.86}Z" fill="${d.rg(p.dark)}" ${OL}/><path d="M${cx - r * 0.74} ${cy - r * 0.56} L${cx - r * 0.92} ${cy - r * 1.08} L${cx - r * 0.38} ${cy - r * 0.84}Z" fill="${p.acLight}"/>`);
    case 'pig': return both(`<path d="M${cx - r * 0.78} ${cy - r * 0.5} L${cx - r * 0.9} ${cy - r * 1.06} L${cx - r * 0.3} ${cy - r * 0.86}Z" fill="${d.rg(p.main)}" ${OL}/>`);
    case 'floppy': return both(`<ellipse cx="${cx - r * 0.92}" cy="${cy - r * 0.05}" rx="${r * 0.26}" ry="${r * 0.55}" fill="${d.rg(p.dark)}" ${OL} ${rot(18, cx - r * 0.92, cy)}/>`);
    default: return '';
  }
}
function horn(d, p, kind, h) {
  const { cx, cy, r } = h, top = cy - r;
  if (kind === 'unicorn') return `<path d="M${cx - 13} ${top + 14} L${cx} ${top - 56} L${cx + 13} ${top + 14}Z" fill="${d.lg(['#fff3b0', '#ffd34d', '#ffb3e6'], 0, 0, 1, 1)}" ${OL}/><path d="M${cx - 9} ${top - 2} L${cx + 9} ${top - 10} M${cx - 6} ${top - 22} L${cx + 6} ${top - 28}" stroke="#e8a92a" stroke-width="3"/>`;
  if (kind === 'antlers') return both(`<path d="M${cx - r * 0.4} ${top + 10} Q${cx - r * 0.5} ${top - 30} ${cx - r * 0.9} ${top - 56} M${cx - r * 0.52} ${top - 22} Q${cx - r * 0.3} ${top - 40} ${cx - r * 0.36} ${top - 60} M${cx - r * 0.74} ${top - 42} Q${cx - r * 1.05} ${top - 40} ${cx - r * 1.15} ${top - 24}" stroke="#8a5a32" stroke-width="10" fill="none" stroke-linecap="round"/>`);
  if (kind === 'nubs') return both(`<path d="M${cx - r * 0.5} ${top + 16} Q${cx - r * 0.62} ${top - 22} ${cx - r * 0.3} ${top - 26} Q${cx - r * 0.32} ${top} ${cx - r * 0.2} ${top + 12}Z" fill="${d.rg('#f3e6c8')}" ${OL}/>`);
  if (kind === 'antenna') return both(`<path d="M${cx - 18} ${top + 10} Q${cx - 30} ${top - 30} ${cx - 44} ${top - 46}" stroke="${p.dark}" stroke-width="6" fill="none" stroke-linecap="round"/>${C(cx - 44, top - 48, 11, d.rg(p.accent), OL)}`);
  return '';
}
const headPattern = (d, p, kind, h, R) => {
  const { cx, cy, r } = h;
  if (kind === 'spots') return [[-0.45, -0.5, 0.17], [0.5, -0.38, 0.13], [0.22, -0.7, 0.1], [-0.62, 0.05, 0.1]].map(([a, b, s]) => C(cx + a * r, cy + b * r, s * r, p.dark, 'opacity=".55"')).join('');
  if (kind === 'stripes') return [-0.28, 0, 0.28].map((a, i) => `<path d="M${cx + a * r} ${cy - r * 0.98} Q${cx + a * r + 4} ${cy - r * 0.7} ${cx + a * r} ${cy - r * (i === 1 ? 0.5 : 0.62)}" stroke="${p.deep}" stroke-width="9" stroke-linecap="round" fill="none" opacity=".7"/>`).join('') + both(`<path d="M${cx - r} ${cy - 8} l26 6 M${cx - r * 0.98} ${cy + 12} l24 0" stroke="${p.deep}" stroke-width="8" stroke-linecap="round" opacity=".6"/>`);
  return '';
};

// ---------- body plans: each returns { svg, head, neck, face: {x, y, s, mouth?}, float } ----------
const PLANS = {
  critter(d, p, f) {
    const k = f.k || '', h = { cx: 200, cy: 172, r: 84 }, n = { x: 200, y: 244, w: 104 };
    const bodyC = { panda: '#f6f6f6', cow: '#fbfbfb', gorilla: p.dark, scarecrow: '#7aa2d6' }[k] || (f.robot ? '#b8c4d4' : p.main);
    const headC = { panda: '#f6f6f6', cow: '#fbfbfb', scarecrow: '#f2d49b' }[k] || (f.robot ? '#c9d3e0' : p.main);
    const pp = { ...p, main: headC, dark: k === 'panda' ? '#2b2340' : p.dark };
    let s = '';
    if (f.wings) s += wings(d, p, f.wings, 200, 262, f.robot);
    s += tail(d, { ...p, main: bodyC }, k === 'squirrel' ? 'squirrel' : k === 'raccoon' ? 'raccoon' : f.tail);
    if (k === 'camel') s += E(200, 236, 50, 40, d.rg(p.main), OL);
    s += both(E(166, 350, 27, 14, d.rg(k === 'panda' ? '#2b2340' : tone(bodyC, -0.3)), OL));
    if (k === 'sheep' || k === 'mammoth') s += [0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => C(200 + 70 * Math.cos(a * Math.PI / 180), 292 + 60 * Math.sin(a * Math.PI / 180), 26, d.rg(k === 'sheep' ? '#ffffff' : p.main), OL)).join('');
    s += E(200, 292, 72, 64, d.rg(k === 'sheep' ? '#ffffff' : bodyC), OL);
    if (f.robot) s += `<rect x="168" y="270" width="64" height="44" rx="10" fill="#2b3550" ${OL}/>${C(186, 292, 7, p.accent)}${C(214, 292, 7, '#7bd389')}`;
    else if (k === 'scarecrow') s += `<path d="M168 262 L200 300 L232 262" stroke="#c0392b" stroke-width="6" fill="none"/><rect x="176" y="312" width="22" height="18" fill="#e9c46a" ${OLs}/>`;
    else if (k === 'cow') s += C(174, 300, 16, '#2b2340', 'opacity=".85"') + C(226, 280, 12, '#2b2340', 'opacity=".85"');
    else s += E(200, 304, 46, 40, k === 'gorilla' ? p.light : p.belly, 'opacity=".95"');
    if (k === 'kangaroo') s += `<path d="M172 300 Q200 330 228 300" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += both(E(134, 290, 16, 27, d.rg(k === 'panda' ? '#2b2340' : bodyC), `${OL} ${rot(28, 134, 290)}`));
    if (k === 'lion') s += Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return C(200 + 92 * Math.cos(a), 172 + 88 * Math.sin(a), 30, d.rg(p.accent), OL); }).join('');
    if (k === 'hedgehog') s += Array.from({ length: 11 }, (_, i) => { const a = Math.PI + i / 10 * Math.PI; const x = 200 + 80 * Math.cos(a), y = 176 + 80 * Math.sin(a); return `<path d="M${f1(x - 14 * Math.sin(a))} ${f1(y + 14 * Math.cos(a))} L${f1(200 + 126 * Math.cos(a))} ${f1(176 + 126 * Math.sin(a))} L${f1(x + 14 * Math.sin(a))} ${f1(y - 14 * Math.cos(a))}Z" fill="${d.rg(p.dark)}" ${OLs}/>`; }).join('');
    if (k === 'sphinx') s += both(`<path d="M${200 - 70} 140 L${200 - 104} 270 L${200 - 50} 250Z" fill="${d.lg(['#ffd34d', '#3a86ff', '#ffd34d', '#3a86ff'], 0, 0, 0, 1)}" ${OL}/>`);
    const ek = { panda: 'bear', wolf: 'fox', fennec: 'fox', cow: 'round', horse: 'round', unicorn: 'round', pegasus: 'round', goat: 'floppy', camel: 'round', mammoth: 'floppy', gorilla: 'round', mole: 'none', sloth: 'none' }[k] || f.ears;
    s += ears(d, pp, ek, k === 'fennec' ? { ...h, r: 100 } : h);
    if (['horse', 'unicorn', 'pegasus'].includes(k)) s += `<path d="M206 92 Q160 70 150 110 Q120 100 118 140 Q96 150 110 190 Q130 160 150 150 Q170 112 214 104Z" fill="${d.rg(p.accent)}" ${OL}/>`;
    s += C(h.cx, h.cy, h.r, d.rg(headC), OL);
    if (k === 'gummy') s += shine(160, 120, 26, 12) + shine(170, 270, 14, 7);
    s += headPattern(d, p, f.pat, h);
    if (['horse', 'unicorn', 'pegasus'].includes(k)) s += `<path d="M200 90 Q236 84 250 110 Q226 104 212 116Z" fill="${d.rg(p.accent)}" ${OL}/>`;
    if (k === 'panda') s += both(E(170, 166, 22, 28, '#2b2340', rot(-25, 170, 166)));
    if (k === 'raccoon') s += `<path d="M126 158 Q200 132 274 158 Q270 186 236 184 Q200 168 164 184 Q130 186 126 158Z" fill="${p.deep}" opacity=".85"/>`;
    if (k === 'gorilla' || k === 'sloth') s += `<path d="M136 170 Q140 124 200 132 Q260 124 264 170 Q268 230 200 234 Q132 230 136 170Z" fill="${p.light}"/>`;
    if (k === 'fairy') s += `<path d="M118 160 Q110 84 200 82 Q290 84 282 160 Q270 120 236 112 Q220 136 196 116 Q170 136 150 116 Q126 128 118 160Z" fill="${d.rg(p.accent)}" ${OL}/>`;
    if (k === 'gnome') s += `<path d="M136 196 Q140 290 200 300 Q260 290 264 196 Q240 226 200 222 Q160 226 136 196Z" fill="${d.rg('#ffffff')}" ${OL}/><path d="M112 150 Q150 30 206 6 Q240 70 288 150Z" fill="${d.rg('#e63946')}" ${OL}/>`;
    if (k === 'scarecrow') s += `<path d="M84 128 Q200 96 316 128 Q200 146 84 128Z" fill="${d.rg('#e9c46a')}" ${OL}/><path d="M140 122 Q150 50 200 46 Q250 50 260 122Z" fill="${d.rg('#e9c46a')}" ${OL}/>`;
    if (k === 'mammoth') s += `<path d="M186 196 Q178 260 150 282 Q170 290 196 264 Q214 230 214 196Z" fill="${d.rg(p.main)}" ${OL}/>` + both(`<path d="M160 214 Q130 250 150 280" stroke="#fff8e8" stroke-width="11" fill="none" stroke-linecap="round"/>`);
    let mouth;
    if (k === 'pig') s += E(200, 196, 26, 18, d.rg(tone(p.main, -0.12)), OL) + E(192, 196, 4, 6, p.deep) + E(208, 196, 4, 6, p.deep), mouth = 'smile';
    else if (['horse', 'unicorn', 'pegasus', 'cow', 'camel', 'goat'].includes(k)) s += E(200, 206, 44, 28, d.rg(k === 'cow' ? '#ffc2d1' : p.belly), OL) + E(186, 204, 5, 7, p.deep) + E(214, 204, 5, 7, p.deep), mouth = 'smile';
    else if (k === 'mole') s += C(200, 194, 12, '#ff8fab', OLs);
    else if (k !== 'mammoth' && k !== 'gnome') s += E(200, 196, 30, 21, f.robot ? '#2b3550' : k === 'scarecrow' ? '#f2d49b' : p.belly, 'opacity=".95"') + `<path d="M191 186 Q200 180 209 186 Q200 196 191 186Z" fill="${INK}"/>`;
    if (k === 'goat') s += `<path d="M190 232 Q200 262 210 232Z" fill="${d.rg('#ffffff')}" ${OLs}/>`;
    if (f.robot) s += C(130, 172, 8, '#9aa9bc', OLs) + C(270, 172, 8, '#9aa9bc', OLs);
    return { svg: s, head: h, neck: n, face: { x: 200, y: 158, s: 1, mouth, eyes: k === 'mole' ? 'dot' : undefined } };
  },
  bird(d, p, f) {
    const k = f.k || 'bird', h = { cx: 200, cy: 176, r: 82 }, n = { x: 200, y: 244, w: 100 };
    const body = k === 'penguin' ? p.deep : f.robot ? '#b8c4d4' : p.main;
    const beakC = k === 'toucan' ? p.accent : '#ffb23f';
    let s = '';
    if (k === 'phoenix') s += [-50, -25, 0, 25, 50].map(a => `<path d="M200 300 Q${200 + a * 3} ${380} ${200 + a * 4.2} ${330 + Math.abs(a)} Q${200 + a * 2} ${330} 200 300Z" fill="${d.lg([p.accent, '#ffd34d'], 0, 0, 0, 1)}" ${OLs}/>`).join('');
    if (k === 'griffin' || k === 'ptero') s += wings(d, { ...p, accent: k === 'ptero' ? p.dark : p.light }, k === 'ptero' ? 'bat' : 'big', 200, 250);
    if (k === 'rooster') s += [0, 1, 2].map(i => `<path d="M260 ${290 - i * 14} Q${320 + i * 6} ${240 - i * 30} ${330 - i * 6} ${200 - i * 30} Q${300} ${260 - i * 20} 256 ${300 - i * 10}Z" fill="${d.rg(i === 1 ? p.accent : p.dark)}" ${OLs}/>`).join('');
    else if (!['chick', 'penguin', 'owl'].includes(k)) s += `<path d="M234 316 Q300 352 318 312 Q290 314 262 296Z" fill="${d.rg(p.accent)}" ${OL}/><path d="M228 322 Q284 372 300 340 Q270 336 252 310Z" fill="${d.rg(p.dark)}" ${OL}/>`;
    s += both(`<path d="M178 340 l-4 18 M178 340 l-14 14 M178 340 l6 16" stroke="#ff9f1c" stroke-width="5" stroke-linecap="round"/>`);
    if (k === 'owl') s += both(`<path d="M138 120 L122 66 L176 102Z" fill="${d.rg(p.dark)}" ${OL}/>`);
    if (k === 'rooster') s += [-22, 0, 22].map((x, i) => C(200 + x, 92 - (i === 1 ? 10 : 0), 17, d.rg('#e63946'), OL)).join('');
    if (f.crest || k === 'phoenix' || k === 'griffin') s += [-16, 0, 16].map((x, i) => `<path d="M${200 + x * 0.6} 100 Q${200 + x * 2} ${56 - (i === 1 ? 14 : 0)} ${200 + x * 2.6} ${60 - (i === 1 ? 14 : 0)} Q${200 + x * 1.4} 80 ${200 + x * 0.6 + 8} 102Z" fill="${d.rg(k === 'phoenix' ? '#ffd34d' : p.accent)}" ${OLs}/>`).join('');
    const ry = k === 'chick' ? 96 : 110;
    s += E(200, 248 + (k === 'chick' ? 12 : 0), k === 'chick' ? 96 : 92, ry, d.rg(body), OL);
    if (k === 'penguin') s += `<path d="M140 200 Q150 150 200 168 Q250 150 260 200 Q270 330 200 346 Q130 330 140 200Z" fill="${d.rg('#ffffff')}"/>`;
    else if (k === 'owl') s += E(200, 280, 58, 62, p.belly) + [0, 1, 2].map(i => `<path d="M${180 + i * 0} ${262 + i * 22} q10 8 20 0 q10 8 20 0" stroke="${p.dark}" stroke-width="3" fill="none" opacity=".5"/>`).join('') + both(C(168, 168, 36, p.light, 'opacity=".85"'));
    else s += E(200, 284, 58, 62, f.robot ? '#2b3550' : p.belly, 'opacity=".95"');
    s += both(`<path d="M116 218 Q72 270 104 330 Q132 306 136 252Z" fill="${d.rg(k === 'penguin' ? p.deep : f.robot ? '#9aa9bc' : p.dark)}" ${OL}/>`);
    if (k === 'hummingbird') s += both(`<path d="M120 210 Q40 150 46 230 Q80 240 128 236Z" fill="${p.acLight}" fill-opacity=".6" ${OL}/>`);
    // beaks
    if (k === 'toucan') s += `<path d="M186 192 Q230 180 300 214 Q240 240 190 216Z" fill="${d.lg(['#ffd34d', p.accent, '#ff4d6d'], 0, 0, 1, 0)}" ${OL}/>`;
    else if (k === 'duck') s += `<path d="M168 202 Q200 188 232 202 Q234 222 200 226 Q166 222 168 202Z" fill="${d.rg(beakC)}" ${OL}/>`;
    else if (k === 'hummingbird') s += `<path d="M196 200 L262 230 L198 212Z" fill="${INK}"/>`;
    else s += `<path d="M186 196 Q200 186 214 196 L200 220Z" fill="${d.rg(beakC)}" ${OL}/>`;
    if (k === 'rooster') s += E(200, 232, 9, 14, '#e63946', OLs);
    if (f.robot) s += C(144, 200, 7, '#9aa9bc', OLs) + C(256, 200, 7, '#9aa9bc', OLs);
    return { svg: s, head: h, neck: n, face: { x: 200, y: 166, s: k === 'owl' ? 1.12 : 1, mouth: 'none' } };
  },
  fish(d, p, f) {
    const k = f.k || 'fish'; let s = '', fc;
    if (k === 'whale') {
      s += `<path d="M84 220 Q40 150 60 120 Q80 150 104 150 Q120 120 150 118 Q120 150 116 200Z" fill="${d.rg(p.dark)}" ${OL}/>`;
      s += `<path d="M90 250 Q90 150 210 150 Q340 150 340 250 Q340 330 210 330 Q110 330 90 250Z" fill="${d.rg(p.main)}" ${OL}/><path d="M120 280 Q210 340 330 270 Q320 320 210 326 Q130 320 120 280Z" fill="${p.belly}"/>`;
      s += [0, 1, 2, 3].map(i => `<path d="M${170 + i * 30} ${296 + (i % 2) * 4} l0 22" stroke="${p.dark}" stroke-width="3" opacity=".35"/>`).join('');
      s += `<path d="M240 146 Q236 110 220 96 M240 146 Q244 104 262 92 M240 146 Q240 112 240 86" stroke="#9be7ff" stroke-width="7" fill="none" stroke-linecap="round"/>`;
      fc = { x: 252, y: 226, s: 0.9 };
    } else if (k === 'puffer') {
      s += Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<path d="M${f1(200 + 92 * Math.cos(a - 0.12))} ${f1(220 + 92 * Math.sin(a - 0.12))} L${f1(200 + 124 * Math.cos(a))} ${f1(220 + 124 * Math.sin(a))} L${f1(200 + 92 * Math.cos(a + 0.12))} ${f1(220 + 92 * Math.sin(a + 0.12))}Z" fill="${d.rg(p.accent)}" ${OLs}/>`; }).join('');
      s += C(200, 220, 100, d.rg(p.main), OL) + E(200, 262, 64, 46, p.belly) + both(`<path d="M104 230 Q74 210 80 256 Z" fill="${d.rg(p.accent)}" ${OL}/>`) + headPattern(d, p, 'spots', { cx: 200, cy: 250, r: 100 });
      fc = { x: 200, y: 206, s: 1.1 };
    } else if (k === 'seahorse') {
      s += `<path d="M232 120 Q300 110 300 150 Q262 150 250 160Z" fill="${d.rg(p.main)}" ${OL}/><path d="M170 300 Q140 360 190 360 Q220 356 206 330 Q196 318 184 330" stroke="${p.main}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M180 96 Q250 96 250 160 Q250 210 220 240 Q260 290 214 320 Q170 340 160 290 Q150 240 170 210 Q140 180 150 130 Q156 100 180 96Z" fill="${d.rg(p.main)}" ${OL}/>`;
      s += [0, 1, 2, 3, 4].map(i => `<path d="M${200 - i * 4} ${200 + i * 24} q18 -4 30 4" stroke="${p.dark}" stroke-width="4" fill="none" opacity=".4"/>`).join('') + `<path d="M150 200 Q110 230 140 250 Q150 230 160 226Z" fill="${d.rg(p.accent)}" ${OL}/>` + [0, 1, 2].map(i => `<path d="M${170 + i * 16} 96 l6 -24 l8 22" fill="${p.accent}" ${OLs}/>`).join('');
      fc = { x: 202, y: 150, s: 0.66 };
    } else {
      const shark = k === 'shark', angler = k === 'angler', dolphin = k === 'dolphin';
      const col = shark ? '#8fa6c4' : angler ? p.deep : p.main;
      if (angler) s += `<path d="M230 140 Q250 60 300 80" stroke="${p.dark}" stroke-width="6" fill="none"/>${C(302, 84, 22, '#fff27a', `opacity=".5" filter="${d.glow(8)}"`)}${C(302, 84, 13, d.rg('#fff8a8'), OL)}`;
      s += `<path d="M196 150 Q${shark ? 220 : 216} ${shark ? 60 : 96} ${shark ? 270 : 262} ${shark ? 150 : 146}Z" fill="${d.rg(shark ? col : p.accent)}" ${OL}/>`;
      s += `<path d="M108 222 L40 ${dolphin ? 190 : 160} Q${dolphin ? 70 : 60} 222 40 ${dolphin ? 260 : 284}Z" fill="${d.rg(shark ? col : p.accent)}" ${OL}/>`;
      s += E(208, 222, dolphin ? 124 : 118, dolphin ? 70 : 84, d.rg(col), OL);
      if (dolphin) s += E(318, 236, 30, 16, d.rg(col), OL);
      s += `<path d="M110 236 Q210 ${dolphin ? 300 : 318} ${dolphin ? 340 : 320} 246 Q${dolphin ? 300 : 290} ${dolphin ? 290 : 300} 210 ${dolphin ? 292 : 302} Q140 300 110 236Z" fill="${shark || dolphin ? '#f4f8ff' : p.belly}" opacity=".95"/>`;
      if (!shark && !angler && !dolphin) s += [0, 1, 2].map(i => `<path d="M${150 + i * 34} 170 Q${170 + i * 34} 222 ${150 + i * 34} 274" stroke="${p.accent}" stroke-width="12" fill="none" opacity=".55"/>`).join('');
      if (shark) s += [0, 1, 2].map(i => `<path d="M${168 + i * 12} 206 q-6 16 0 30" stroke="${INK}" stroke-width="3" fill="none" opacity=".35"/>`).join('');
      s += `<path d="M196 262 Q180 300 214 300 Q220 280 212 262Z" fill="${d.rg(shark ? tone(col, -0.2) : p.accent)}" ${OL}/>`;
      fc = { x: 262, y: 206, s: 0.82, mouth: shark || angler ? 'fang' : undefined };
    }
    return { svg: s, head: { cx: fc.x, cy: fc.y + 4, r: 56 }, neck: null, face: fc, float: true };
  },
  sea(d, p, f) {
    const k = f.k; let s = '', fc, h, extra = '';
    if (k === 'octopus') {
      const legs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(i => { const x0 = 200 + i * 26, dir = i < 0 ? -1 : 1; return `<path d="M${x0} 240 Q${x0 + dir * 10} 310 ${x0 + dir * (30 + Math.abs(i) * 12)} 330 Q${x0 + dir * (50 + Math.abs(i) * 12)} 340 ${x0 + dir * (46 + Math.abs(i) * 12)} 316" stroke="${p.main}" stroke-width="26" fill="none" stroke-linecap="round"/>`; }).join('');
      s += `<g ${OL} fill="none">${legs.replace(/stroke="[^"]+" stroke-width="26"/g, `stroke="${INK}" stroke-opacity=".3" stroke-width="32"`)}</g>${legs}` + [-2, -1, 1, 2].map(i => C(200 + i * 34, 300, 4, p.light)).join('');
      if (f.squid) s += `<path d="M120 150 L200 40 L280 150Z" fill="${d.rg(p.main)}" ${OL}/>`;
      s += E(200, 180, 98, 92, d.rg(p.main), OL) + headPattern(d, p, 'spots', { cx: 200, cy: 190, r: 92 });
      fc = { x: 200, y: 186, s: 1 }; h = { cx: 200, cy: 180, r: 92 };
    } else if (k === 'jelly') {
      s += [-60, -30, 0, 30, 60].map((x, i) => `<path d="M${200 + x} 220 q${i % 2 ? 16 : -16} 30 0 60 q${i % 2 ? -16 : 16} 30 0 60" stroke="${p.accent}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".85"/>`).join('');
      s += C(200, 170, 120, p.acLight, `opacity=".35" filter="${d.glow(14)}"`);
      s += `<path d="M90 216 Q90 76 200 76 Q310 76 310 216 Q288 236 266 216 Q244 236 222 216 Q200 236 178 216 Q156 236 134 216 Q112 236 90 216Z" fill="${d.rg(p.main)}" fill-opacity=".9" ${OL}/>` + shine(146, 120, 26, 12);
      fc = { x: 200, y: 160, s: 1 }; h = { cx: 200, cy: 150, r: 100 };
    } else if (k === 'crab') {
      if (f.desert) s += `<path d="M260 280 Q340 250 320 160 Q310 120 270 130" stroke="${p.main}" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M270 130 L250 104 L290 116Z" fill="${p.dark}" ${OL}/>`;
      s += both(`<path d="M140 270 Q100 250 92 210" stroke="${p.main}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M92 210 Q50 190 60 150 Q80 120 110 140 L96 166 L126 170 Q120 206 92 210Z" fill="${d.rg(p.main)}" ${OL}/>` + [0, 1, 2].map(i => `<path d="M${146 - i * 4} ${300 + i * 12} q-36 4 -48 ${24 + i * 4}" stroke="${p.dark}" stroke-width="8" fill="none" stroke-linecap="round"/>`).join(''));
      s += both(`<path d="M176 210 L170 150" stroke="${p.dark}" stroke-width="8" stroke-linecap="round"/>`);
      s += E(200, 270, 108, 70, d.rg(p.main), OL) + shine(160, 240, 30, 12, -15, 0.4);
      s += `<path d="M184 290 Q200 304 216 290" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` + both(E(158, 286, 12, 7, '#ff8fa6', 'opacity=".55"'));
      fc = { x: 200, y: 146, s: 0.9, mouth: 'none' }; h = { cx: 200, cy: 150, r: 50 };
    } else {
      s += both(`<path d="M120 290 Q70 280 64 320 Q100 330 130 316Z" fill="${d.rg(p.belly)}" ${OL}/>`) + both(E(150, 344, 22, 14, d.rg(p.belly), OL));
      s += `<path d="M84 318 Q84 166 200 166 Q316 166 316 318Z" fill="${d.rg(p.main)}" ${OL}/>`;
      s += [[200, 210], [160, 250], [240, 250], [120, 290], [200, 290], [280, 290]].map(([x, y]) => `<path d="M${x - 22} ${y} l11 -19 h22 l11 19 l-11 19 h-22Z" fill="${p.dark}" opacity=".45"/>`).join('');
      s += `<rect x="78" y="306" width="244" height="22" rx="11" fill="${d.rg(p.accent)}" ${OL}/>`;
      s += C(200, 256, 58, d.rg(p.belly), OL);
      fc = { x: 200, y: 248, s: 0.78 }; h = { cx: 200, cy: 256, r: 58 };
    }
    return { svg: s, head: h, neck: null, face: fc, float: k === 'jelly' || k === 'octopus', extra };
  },
  dragon(d, p, f) {
    const h = { cx: 200, cy: 172, r: 84 }, n = { x: 200, y: 244, w: 104 };
    const col = f.robot ? '#b8c4d4' : p.main;
    let s = wings(d, p, f.wings || 'small', 200, 258, f.robot);
    s += `<path d="M250 320 C320 340 350 300 330 260" fill="none" stroke="${col}" stroke-width="22" stroke-linecap="round"/><path d="M330 262 L310 232 L352 236Z" fill="${d.rg(p.accent)}" ${OL}/>`;
    s += both(E(166, 350, 27, 14, d.rg(p.dark), OL)) + E(200, 292, 72, 64, d.rg(col), OL);
    s += `<path d="M160 262 Q200 250 240 262 Q246 320 200 348 Q154 320 160 262Z" fill="${f.robot ? '#2b3550' : p.belly}"/>` + [0, 1, 2, 3].map(i => `<path d="M${170 + i * 2} ${276 + i * 18} Q200 ${282 + i * 18} ${230 - i * 2} ${276 + i * 18}" stroke="${p.dark}" stroke-width="3" fill="none" opacity=".45"/>`).join('');
    s += both(E(134, 290, 16, 27, d.rg(col), `${OL} ${rot(28, 134, 290)}`));
    s += both(`<path d="M150 108 Q132 52 104 44 Q128 80 128 120Z" fill="${d.rg('#fff3d6')}" ${OL}/>`);
    s += [-24, 0, 24].map(x => `<path d="M${200 + x - 10} 92 L${200 + x} 66 L${200 + x + 10} 92Z" fill="${d.rg(p.accent)}" ${OLs}/>`).join('');
    s += C(200, 172, 84, d.rg(col), OL) + E(200, 200, 40, 26, f.robot ? '#2b3550' : p.belly, 'opacity=".9"') + E(188, 194, 4, 6, p.deep) + E(212, 194, 4, 6, p.deep);
    s += both(`<path d="M118 180 L92 166 L104 196Z" fill="${d.rg(p.accent)}" ${OLs}/>`);
    return { svg: s, head: h, neck: n, face: { x: 200, y: 158, s: 1, mouth: 'fang' } };
  },
  bot(d, p, f) {
    const k = f.k || 'box', metal = p.main;
    let s = '', h, fc, float = false;
    const screen = (x, y, w, hh, rr) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${rr}" fill="${d.lg(['#1f2747', '#121833'])}" stroke="${INK}" stroke-opacity=".5" stroke-width="3"/>`;
    const antenna = (x, y) => `<path d="M${x} ${y} L${x} ${y - 34}" stroke="${INK}" stroke-opacity=".6" stroke-width="5"/>${C(x, y - 40, 16, p.accent, `opacity=".5" filter="${d.glow(6)}"`)}${C(x, y - 40, 10, d.rg(p.accent), OLs)}`;
    if (k === 'drone') {
      float = true;
      s += both(`<path d="M150 190 L86 150" stroke="${INK}" stroke-opacity=".5" stroke-width="8"/>${E(86, 140, 54, 9, '#ffffff', 'opacity=".55"')}${C(86, 146, 9, d.rg(p.accent), OLs)}`);
      s += E(200, 210, 96, 74, d.rg(metal), OL) + screen(136, 170, 128, 70, 30) + `<path d="M150 270 L130 310 M250 270 L270 310" stroke="${INK}" stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/>`;
      h = { cx: 200, cy: 206, r: 80 }; fc = { x: 200, y: 200, s: 0.8 };
    } else {
      const mech = k === 'mech';
      if (k === 'wheel') s += C(200, 330, 32, d.rg('#3a3f55'), OL) + C(200, 330, 13, '#9aa9bc');
      else if (k === 'tank') s += `<rect x="112" y="314" width="176" height="46" rx="23" fill="${d.rg('#3a3f55')}" ${OL}/>` + [0, 1, 2, 3, 4].map(i => C(136 + i * 32, 337, 11, '#9aa9bc')).join('');
      else s += both(`<rect x="160" y="${mech ? 312 : 320}" width="${mech ? 34 : 26}" height="${mech ? 40 : 30}" rx="8" fill="${d.rg(tone(metal, -0.2))}" ${OL}/>${E(mech ? 177 : 173, 352, mech ? 30 : 24, 10, d.rg('#3a3f55'), OL)}`);
      s += both(`<path d="M${mech ? 128 : 146} 268 Q${mech ? 96 : 112} 290 ${mech ? 100 : 114} 318" stroke="${tone(metal, -0.2)}" stroke-width="${mech ? 20 : 13}" fill="none" stroke-linecap="round"/>${C(mech ? 100 : 114, 322, mech ? 18 : 13, d.rg(p.accent), OL)}`);
      if (mech) s += both(C(130, 254, 34, d.rg(tone(metal, -0.1)), OL));
      s += `<rect x="${mech ? 132 : 146}" y="244" width="${mech ? 136 : 108}" height="${mech ? 84 : 84}" rx="24" fill="${d.rg(metal)}" ${OL}/>`;
      s += mech ? C(200, 286, 22, p.accent, `opacity=".6" filter="${d.glow(8)}"`) + C(200, 286, 15, d.rg(p.acLight), OLs) : `<rect x="170" y="266" width="60" height="36" rx="9" fill="#2b3550" ${OLs}/>${C(186, 284, 6, p.accent)}${C(200, 284, 6, '#7bd389')}${C(214, 284, 6, '#ffd34d')}`;
      if (k === 'round') { s += antenna(200, 96) + C(200, 170, 84, d.rg(metal), OL) + E(200, 176, 64, 46, d.lg(['#1f2747', '#121833']), `stroke="${INK}" stroke-opacity=".5" stroke-width="3"`); h = { cx: 200, cy: 170, r: 84 }; fc = { x: 200, y: 172, s: 0.82 }; }
      else { s += antenna(200, 100) + both(`<rect x="100" y="148" width="22" height="44" rx="9" fill="${d.rg(p.accent)}" ${OL}/>`) + `<rect x="114" y="98" width="172" height="140" rx="38" fill="${d.rg(metal)}" ${OL}/>` + screen(134, 120, 132, 96, 26); h = { cx: 200, cy: 168, r: 86 }; fc = { x: 200, y: 160, s: 0.84 }; }
      s += shine(150, h.cy - 56, 20, 8, -20, 0.6);
    }
    return { svg: s, head: h, neck: null, face: { ...fc, bot: true }, float };
  },
  sprout(d, p, f) {
    const k = f.k; let s = '', fc, h;
    if (k === 'flower') {
      s += `<path d="M200 230 Q196 300 200 356" stroke="#4f9a3a" stroke-width="12" fill="none" stroke-linecap="round"/>` + both(`<path d="M198 300 Q150 270 128 300 Q160 326 198 312Z" fill="${d.rg('#7bd389')}" ${OL}/>`);
      s += Array.from({ length: 10 }, (_, i) => { const a = i * 36; return E(200 + 74 * Math.cos(a * Math.PI / 180), 166 + 74 * Math.sin(a * Math.PI / 180), 40, 26, d.rg(i % 2 ? p.main : p.light), `${OL} ${rot(a, 200 + 74 * Math.cos(a * Math.PI / 180), 166 + 74 * Math.sin(a * Math.PI / 180))}`); }).join('');
      s += C(200, 166, 64, d.rg(p.accent === '#ffffff' ? '#ffd34d' : tone(p.accent, 0.2)), OL);
      fc = { x: 200, y: 156, s: 0.85 }; h = { cx: 200, cy: 166, r: 64 };
    } else if (k === 'cactus') {
      s += `<path d="M140 300 L260 300 L246 356 L154 356Z" fill="${d.rg('#d9824b')}" ${OL}/><rect x="132" y="290" width="136" height="22" rx="8" fill="${d.rg('#e8955a')}" ${OL}/>`;
      s += `<path d="M150 230 Q110 230 112 190 Q114 160 134 166 Q132 196 150 200Z" fill="${d.rg('#5cb85c')}" ${OL}/><path d="M250 210 Q290 210 290 170 Q290 140 270 146 Q270 180 250 182Z" fill="${d.rg('#5cb85c')}" ${OL}/>`;
      s += `<path d="M144 294 L144 150 Q144 96 200 96 Q256 96 256 150 L256 294Z" fill="${d.rg('#6cc551')}" ${OL}/>` + [[170, 130], [230, 140], [160, 250], [240, 240], [200, 270], [180, 110]].map(([x, y]) => `<path d="M${x} ${y} l-5 -5 M${x} ${y} l5 -5" stroke="#2f6b2f" stroke-width="2.5"/>`).join('');
      s += [0, 72, 144, 216, 288].map(a => E(200 + 15 * Math.cos(a * Math.PI / 180), 90 + 15 * Math.sin(a * Math.PI / 180), 13, 13, d.rg(p.main), OLs)).join('') + C(200, 90, 9, '#ffd34d');
      fc = { x: 200, y: 176, s: 0.85 }; h = { cx: 200, cy: 150, r: 60 };
    } else if (k === 'mushroom') {
      s += `<path d="M150 210 Q140 300 156 350 Q200 362 244 350 Q260 300 250 210Z" fill="${d.rg('#fff3e0')}" ${OL}/>`;
      s += `<path d="M76 214 Q80 70 200 64 Q320 70 324 214 Q200 240 76 214Z" fill="${d.rg(p.main)}" ${OL}/>` + [[140, 140, 20], [210, 104, 16], [262, 160, 18], [180, 180, 12], [110, 196, 9]].map(([x, y, r]) => C(x, y, r, '#fff', 'opacity=".9"')).join('');
      if (f.glow !== false) s += C(200, 140, 130, p.main, `opacity=".18" filter="${d.glow(20)}"`);
      fc = { x: 200, y: 262, s: 0.82 }; h = { cx: 200, cy: 150, r: 110 };
    } else if (k === 'seed') {
      s += `<path d="M200 190 Q200 150 196 128" stroke="#4f9a3a" stroke-width="8" fill="none"/>${leafP(166, 128, 2.6, -60)} fill="${d.rg('#7bd389')}" ${OL}/>${leafP(228, 118, 2.2, 60)} fill="${d.rg('#9be37a')}" ${OL}/>`;
      s += both(E(170, 352, 22, 12, d.rg(p.dark), OL)) + E(200, 268, 92, 88, d.rg(p.main), OL) + E(200, 290, 56, 48, p.belly, 'opacity=".8"');
      fc = { x: 200, y: 252, s: 0.95 }; h = { cx: 200, cy: 250, r: 90 };
    } else if (k === 'cupcake') {
      s += `<path d="M120 250 L280 250 L262 352 L138 352Z" fill="${d.rg(p.acLight)}" ${OL}/>` + [0, 1, 2, 3, 4, 5].map(i => `<path d="M${136 + i * 26} 252 L${146 + i * 22} 350" stroke="${p.accent}" stroke-width="5" opacity=".5"/>`).join('');
      s += E(200, 248, 100, 40, d.rg(p.main), OL) + E(200, 210, 80, 40, d.rg(p.main), OL) + E(200, 172, 54, 32, d.rg(p.main), OL) + C(206, 128, 20, d.rg('#e63946'), OL) + `<path d="M206 110 Q212 92 226 88" stroke="#4f9a3a" stroke-width="4" fill="none"/>`;
      s += [[150, 220, '#ffd34d'], [240, 200, '#4cc9f0'], [190, 180, '#7bd389'], [230, 244, '#ff70a6'], [160, 254, '#b388ff']].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="12" height="5" rx="2.5" fill="${c}" ${rot(i * 40, x, y)}/>`).join('');
      fc = { x: 200, y: 290, s: 0.8 }; h = { cx: 200, cy: 190, r: 80 };
    } else if (k === 'pumpkin') {
      s += `<path d="M200 138 Q196 110 214 96" stroke="#5a7d2a" stroke-width="12" fill="none" stroke-linecap="round"/>${leafP(236, 112, 1.6, 70)} fill="${d.rg('#7bd389')}" ${OLs}/>`;
      s += E(130, 250, 64, 100, d.rg(tone(p.main, -0.08)), OL) + E(270, 250, 64, 100, d.rg(tone(p.main, -0.08)), OL) + E(200, 250, 84, 108, d.rg(p.main), OL);
      fc = { x: 200, y: 236, s: 1 }; h = { cx: 200, cy: 230, r: 100 };
    } else {
      s += `<path d="M160 350 Q170 280 166 220 L234 220 Q230 280 240 350Z" fill="${d.rg('#a0703c')}" ${OL}/>` + both(`<path d="M160 350 Q130 352 120 362 L170 362Z" fill="#8a5a32"/>`);
      s += [[200, 120, 92], [120, 160, 60], [280, 160, 60], [150, 90, 54], [250, 90, 54], [200, 190, 70]].map(([x, y, r]) => C(x, y, r, d.rg(p.main), OL)).join('') + [[150, 120], [250, 140], [200, 70], [120, 180], [280, 190]].map(([x, y]) => C(x, y, 8, p.accent)).join('');
      fc = { x: 200, y: 260, s: 0.8 }; h = { cx: 200, cy: 120, r: 110 };
    }
    return { svg: s, head: h, neck: null, face: fc, crown: f.crown };
  },
  bug(d, p, f) {
    const k = f.k; let s = '', fc, h, float = false;
    if (k === 'bee') {
      float = true;
      s += both(`<ellipse cx="148" cy="150" rx="46" ry="64" fill="#e9f8ff" fill-opacity=".75" ${OL} ${rot(-30, 148, 150)}/>`);
      if (f.glow) s += C(200, 320, 46, '#fff27a', `opacity=".7" filter="${d.glow(14)}"`);
      s += `<path d="M200 330 L192 352 L208 352Z" fill="${INK}"/>`;
      const cid = d.clip(`<ellipse cx="200" cy="246" rx="94" ry="90"/>`);
      s += E(200, 246, 94, 90, d.rg(p.main), OL) + `<g clip-path="${cid}">${[268, 306].map(y => `<rect x="90" y="${y}" width="220" height="20" fill="${INK}" opacity=".75"/>`).join('')}</g>`;
      s += both(`<path d="M176 162 Q166 120 140 108" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>${C(140, 106, 9, d.rg(p.accent))}`);
      fc = { x: 200, y: 214, s: 1 }; h = { cx: 200, cy: 230, r: 90 };
    } else if (k === 'ladybug') {
      s += both([0, 1, 2].map(i => `<path d="M${130} ${250 + i * 30} l-30 ${10 + i * 6}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join(''));
      s += C(200, 156, 66, d.rg('#3a3150'), OL);
      s += E(200, 270, 110, 90, d.rg(p.main), OL) + `<path d="M200 182 L200 358" stroke="${INK}" stroke-width="5" opacity=".7"/>` + [[150, 230, 17], [250, 230, 17], [140, 296, 14], [260, 296, 14], [196, 322, 0]].filter(x => x[2]).map(([x, y, r]) => C(x, y, r, INK, 'opacity=".8"')).join('') + shine(150, 214, 26, 10, -20, 0.4);
      s += both(`<path d="M180 98 Q170 70 150 64" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>${C(150, 62, 8, '#3a3150')}`);
      fc = { x: 200, y: 140, s: 0.9 }; h = { cx: 200, cy: 156, r: 66 };
    } else if (k === 'butterfly') {
      float = true;
      s += both(`<path d="M196 200 Q120 70 70 120 Q40 170 110 220 Q150 236 196 214Z" fill="${d.rg(p.main)}" ${OL}/><path d="M196 226 Q120 230 100 290 Q120 330 170 300 Q196 270 198 236Z" fill="${d.rg(p.accent)}" ${OL}/>${C(116, 156, 16, p.light, 'opacity=".9"')}${C(140, 276, 11, p.acLight)}`);
      s += E(200, 262, 16, 74, d.rg(p.deep), OL) + C(200, 160, 50, d.rg(p.dark), OL);
      s += both(`<path d="M186 116 Q174 76 150 72 Q140 80 152 88" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      fc = { x: 200, y: 154, s: 0.7 }; h = { cx: 200, cy: 160, r: 50 };
    } else if (k === 'spider') {
      s += both([0, 1, 2, 3].map(i => `<path d="M150 ${240 + i * 18} Q${90 - i * 4} ${200 + i * 26} ${70 + i * 6} ${290 + i * 18}" stroke="${p.deep}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join(''));
      s += E(200, 276, 96, 80, d.rg(p.main), OL) + `<path d="M180 250 Q200 230 220 250 Q200 290 180 250Z" fill="${p.accent}" opacity=".8"/>` + C(200, 190, 66, d.rg(p.dark), OL);
      fc = { x: 200, y: 182, s: 0.86 }; h = { cx: 200, cy: 190, r: 66 };
    } else {
      s += `<path d="M90 350 Q100 300 140 300 L300 300 Q340 330 330 352Z" fill="${d.rg(p.belly)}" ${OL}/>`;
      s += C(250, 230, 86, d.rg(p.main), OL) + `<path d="M250 230 m-10 0 a10 10 0 1 1 20 0 a24 24 0 1 1 -44 0 a40 40 0 1 1 76 0 a58 58 0 1 1 -108 0" stroke="${p.dark}" stroke-width="6" fill="none" opacity=".7"/>`;
      s += `<path d="M120 300 Q100 240 130 200 Q150 190 166 210 Q170 260 160 300Z" fill="${d.rg(p.belly)}" ${OL}/>` + `<path d="M126 190 L116 150 M150 186 L154 146" stroke="${tone(p.belly, -0.4)}" stroke-width="5" stroke-linecap="round"/>`;
      fc = { x: 140, y: 222, s: 0.6 }; h = { cx: 140, cy: 220, r: 40 };
    }
    return { svg: s, head: h, neck: null, face: fc, float };
  },
  spirit(d, p, f) {
    const k = f.k; let s = '', fc = { x: 200, y: 210, s: 1 }, h = { cx: 200, cy: 210, r: 90 };
    const glow = (r = 120, c = p.main, y = 210) => C(200, y, r, c, `opacity=".35" filter="${d.glow(18)}"`);
    switch (k) {
      case 'star': s += glow() + `<path d="${star5(200, 214, 140, 70)}" fill="${d.lg([p.light, p.main, p.dark], 0, 0, 0, 1)}" stroke="${tone(p.main, -0.35)}" stroke-width="10" stroke-linejoin="round"/>` + shine(160, 160, 22, 9); fc = { x: 200, y: 214, s: 0.9 }; break;
      case 'crystal': { const b = f.big ? 1.15 : 1; s += glow(130) + `<path d="M200 ${210 - 150 * b} L${200 + 90 * b} ${210 - 50 * b} L${200 + 70 * b} ${210 + 110 * b} L200 ${210 + 150 * b} L${200 - 70 * b} ${210 + 110 * b} L${200 - 90 * b} ${210 - 50 * b}Z" fill="${d.lg([p.light, p.main, p.dark], 0, 0, 1, 1)}" ${OL}/><path d="M200 ${210 - 150 * b} L${200 - 30 * b} ${210 - 40 * b} L200 ${210 + 150 * b} M${200 + 90 * b} ${210 - 50 * b} L${200 - 30 * b} ${210 - 40 * b} L${200 - 90 * b} ${210 - 50 * b}" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/>${shine(170, 140, 12, 30, 20, 0.6)}`; fc = { x: 200, y: 214, s: 0.9 }; break; }
      case 'cloud': s += [[130, 230, 60], [190, 190, 78], [264, 214, 66], [220, 264, 60], [150, 270, 52]].map(([x, y, r]) => C(x, y, r + 3, INK, 'opacity=".12"')).join('') + [[130, 230, 60], [190, 190, 78], [264, 214, 66], [220, 264, 60], [150, 270, 52]].map(([x, y, r]) => C(x, y, r, d.rg(p.main, { hl: 0.6, dk: -0.12 }))).join(''); fc = { x: 200, y: 226, s: 0.95 }; break;
      case 'flame': if (f.candle) { s += `<rect x="150" y="190" width="100" height="160" rx="18" fill="${d.rg(p.belly)}" ${OL}/><path d="M160 196 Q170 230 182 200 Q196 240 210 200" stroke="${p.belly}" stroke-width="10" fill="none"/>` + `<path d="M200 192 L200 176" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` + C(200, 146, 60, '#ffd34d', `opacity=".45" filter="${d.glow(14)}"`) + `<path d="M200 84 C220 124 236 144 226 172 C218 192 182 192 174 172 C164 144 182 124 200 84Z" fill="${d.lg(['#fff27a', '#ff9f1c'], 0, 0, 0, 1)}" ${OLs}/>`; fc = { x: 200, y: 254, s: 0.8 }; h = { cx: 200, cy: 250, r: 60 }; break; }
        s += glow(130, p.accent) + `<path d="M200 60 C250 130 306 170 296 250 C288 320 246 352 200 352 C154 352 112 320 104 250 C96 186 136 150 150 100 C170 130 168 150 180 160 C186 120 190 90 200 60Z" fill="${d.lg([p.accent, p.main, tone(p.main, -0.2)], 0, 0, 0, 1)}" ${OL}/><path d="M200 170 C230 210 250 240 240 280 C232 320 168 320 160 280 C152 240 176 214 200 170Z" fill="${d.lg(['#fff8a8', p.accent], 0, 0, 0, 1)}" opacity=".9"/>`; fc = { x: 200, y: 260, s: 0.9 }; break;
      case 'ghost': s += glow(110, '#ffffff') + `<path d="M110 340 L110 200 Q110 104 200 104 Q290 104 290 200 L290 340 Q268 316 245 340 Q222 364 200 340 Q178 316 155 340 Q132 364 110 340Z" fill="${d.rg(p.main, { hl: 0.6, dk: -0.15 })}" ${OL}/>` + both(`<path d="M112 240 Q80 250 82 280 Q100 270 112 270Z" fill="${d.rg(p.main, { hl: 0.6, dk: -0.15 })}" ${OL}/>`); fc = { x: 200, y: 200, s: 1 }; break;
      case 'note': s += glow(100, p.accent, 250) + `<path d="M246 280 L246 80 Q290 100 304 150 Q290 130 262 126 L262 280Z" fill="${d.rg(p.dark)}" ${OL}/>` + E(200, 282, 74, 60, d.rg(p.main), `${OL} ${rot(-18, 200, 282)}`); fc = { x: 196, y: 272, s: 0.8 }; h = { cx: 200, cy: 282, r: 66 }; break;
      case 'kite': s += `<path d="M200 300 Q230 330 200 350 Q170 370 210 380" stroke="${INK}" stroke-width="3" fill="none" opacity=".6"/>` + [[214, 330], [194, 360]].map(([x, y]) => `<path d="M${x} ${y} l-12 -8 l0 16Z M${x} ${y} l12 -8 l0 16Z" fill="${p.accent}"/>`).join('') + `<path d="M200 60 L310 190 L200 300 L90 190Z" fill="${d.lg([p.main, p.accent], 0, 0, 1, 1)}" ${OL}/><path d="M200 60 L200 300 M90 190 L310 190" stroke="#fff" stroke-width="4" opacity=".7"/>`; fc = { x: 200, y: 168, s: 0.78 }; break;
      case 'drop': s += glow(110, p.acLight) + `<path d="M200 70 Q300 200 290 260 Q280 340 200 344 Q120 340 110 260 Q100 200 200 70Z" fill="${d.lg([p.light, p.main], 0, 0, 0, 1)}" ${OL}/>` + shine(160, 220, 14, 30, 20, 0.6); fc = { x: 200, y: 246, s: 0.95 }; break;
      case 'moon': s += glow(130, '#fff8c2') + C(200, 210, 120, d.rg(p.main, { hl: 0.4, dk: -0.18 }), OL) + [[140, 160, 18], [260, 260, 22], [250, 150, 12], [150, 280, 14]].map(([x, y, r]) => C(x, y, r, tone(p.main, -0.12), 'opacity=".7"')).join(''); fc = { x: 200, y: 206, s: 1, eyes: 'sleepy' }; h = { cx: 200, cy: 210, r: 120 }; break;
      case 'atom': s += [0, 60, 120].map(a => `<ellipse cx="200" cy="210" rx="150" ry="48" fill="none" stroke="${p.accent}" stroke-width="6" ${rot(a, 200, 210)}/>`).join('') + [[350, 210], [125, 80], [125, 340]].map(([x, y]) => C(x, y, 12, d.rg(p.accent), OLs)).join('') + C(200, 210, 76, d.rg(p.main), OL); fc = { x: 200, y: 204, s: 0.85 }; h = { cx: 200, cy: 210, r: 76 }; break;
      case 'dna': s += [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const y = 60 + i * 36, w = 70 * Math.sin(i * 0.8); return `<path d="M${200 - w} ${y} L${200 + w} ${y}" stroke="${i % 2 ? p.accent : p.light}" stroke-width="8" stroke-linecap="round"/>`; }).join('') + `<path d="M200 50 ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `L${f1(200 - 70 * Math.sin(i * 0.8))} ${50 + i * 36}`).join(' ')}" stroke="${p.main}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M200 50 ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `L${f1(200 + 70 * Math.sin(i * 0.8))} ${50 + i * 36}`).join(' ')}" stroke="${p.dark}" stroke-width="14" fill="none" stroke-linecap="round"/>` + C(200, 220, 62, d.rg(p.main), OL); fc = { x: 200, y: 214, s: 0.78 }; h = { cx: 200, cy: 220, r: 62 }; break;
      case 'sun': s += glow(150, '#ffd34d') + Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; return `<path d="M${f1(200 + 96 * Math.cos(a - 0.18))} ${f1(210 + 96 * Math.sin(a - 0.18))} L${f1(200 + 150 * Math.cos(a))} ${f1(210 + 150 * Math.sin(a))} L${f1(200 + 96 * Math.cos(a + 0.18))} ${f1(210 + 96 * Math.sin(a + 0.18))}Z" fill="${d.rg(p.accent)}" ${OLs}/>`; }).join('') + C(200, 210, 100, d.rg(p.main), OL); fc = { x: 200, y: 204, s: 1 }; h = { cx: 200, cy: 210, r: 100 }; break;
      case 'snowflake': s += glow(130, '#dff6ff') + Array.from({ length: 6 }, (_, i) => `<g ${rot(i * 60, 200, 210)}><path d="M200 210 L200 70 M200 120 L170 96 M200 120 L230 96 M200 160 L176 140 M200 160 L224 140" stroke="${p.main}" stroke-width="14" stroke-linecap="round" fill="none"/></g>`).join('') + C(200, 210, 66, d.rg(p.main, { hl: 0.6, dk: -0.1 }), OL); fc = { x: 200, y: 204, s: 0.8 }; h = { cx: 200, cy: 210, r: 66 }; break;
      case 'bolt': s += glow(120, '#fff27a') + `<path d="M226 50 L120 220 L196 220 L160 360 L290 170 L210 170 L250 50Z" fill="${d.lg(['#fff8a8', p.main, tone(p.main, -0.2)], 0, 0, 0, 1)}" ${OL} stroke-linejoin="round"/>`; fc = { x: 206, y: 194, s: 0.72 }; break;
      case 'tornado': s += [0, 1, 2, 3, 4, 5].map(i => E(200 + Math.sin(i) * 14, 100 + i * 46, 130 - i * 18, 26, d.rg(i % 2 ? p.main : p.light, { hl: 0.4, dk: -0.15 }), OLs)).reverse().join(''); fc = { x: 200, y: 140, s: 0.85 }; break;
      case 'rainbow': s += ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((c, i) => `<path d="M${70 + i * 14} 300 A${130 - i * 14} ${130 - i * 14} 0 0 1 ${330 - i * 14} 300" stroke="${c}" stroke-width="15" fill="none"/>`).join('') + [[96, 300, 46], [304, 300, 46]].map(([x, y, r]) => C(x, y, r, d.rg('#ffffff', { hl: 0.6, dk: -0.1 }), OL) + C(x - 34, y + 14, r * 0.6, d.rg('#ffffff', { hl: 0.6, dk: -0.1 })) + C(x + 34, y + 14, r * 0.6, d.rg('#ffffff', { hl: 0.6, dk: -0.1 }))).join(''); fc = { x: 304, y: 296, s: 0.62 }; h = { cx: 304, cy: 300, r: 46 }; break;
      case 'leaf': s += glow(110, p.accent) + `<path d="M200 50 Q330 150 280 280 Q250 350 200 352 Q150 350 120 280 Q70 150 200 50Z" fill="${d.lg([p.light, p.main, p.dark], 0, 0, 1, 1)}" ${OL}/><path d="M200 70 L200 352 M200 150 L150 120 M200 150 L250 120 M200 220 L140 180 M200 220 L260 180" stroke="${p.dark}" stroke-width="4" opacity=".5"/>`; fc = { x: 200, y: 250, s: 0.82 }; break;
      case 'pencil': s += `<path d="M150 110 L250 110 L250 300 L200 362 L150 300Z" fill="${d.rg(p.main)}" ${OL}/><path d="M150 300 L200 362 L250 300Z" fill="#f2d49b" ${OLs}/><path d="M186 344 L200 362 L214 344Z" fill="${INK}"/><rect x="146" y="70" width="108" height="46" rx="12" fill="${d.rg('#ff8fab')}" ${OL}/><rect x="146" y="106" width="108" height="16" fill="#c9d3e0" ${OLs}/>`; fc = { x: 200, y: 196, s: 0.8 }; h = { cx: 200, cy: 150, r: 54 }; break;
    }
    return { svg: s, head: h, neck: null, face: fc, float: true };
  },
  dino(d, p, f) {
    const k = f.k; let s = '', fc, h, n = null;
    if (k === 'longneck') {
      s += `<path d="M280 300 Q350 300 370 250" stroke="${p.main}" stroke-width="26" fill="none" stroke-linecap="round"/>` + [150, 186, 230, 264].map(x => `<rect x="${x - 14}" y="300" width="28" height="56" rx="12" fill="${d.rg(p.dark)}" ${OL}/>`).join('');
      s += E(210, 290, 104, 54, d.rg(p.main), OL) + `<path d="M140 280 Q110 220 140 140" stroke="${INK}" stroke-opacity=".3" stroke-width="46" fill="none" stroke-linecap="round"/><path d="M140 280 Q110 220 140 140" stroke="${p.main}" stroke-width="40" fill="none" stroke-linecap="round"/>` + headPattern(d, p, 'spots', { cx: 230, cy: 300, r: 70 });
      s += E(150, 120, 54, 44, d.rg(p.main), OL); fc = { x: 152, y: 112, s: 0.66 }; h = { cx: 150, cy: 118, r: 50 };
    } else if (k === 'stego') {
      s += [0, 1, 2, 3, 4].map(i => `<path d="M${150 + i * 40} ${230 - Math.sin(i / 4 * Math.PI) * 30} l-22 30 l44 0Z" fill="${d.rg(p.accent)}" ${OL} ${rot(0, 150 + i * 40, 230)}/>`).join('');
      s += `<path d="M300 300 Q360 290 370 250" stroke="${p.main}" stroke-width="24" fill="none" stroke-linecap="round"/>${[0, 1].map(i => `<path d="M${356 + i * 10} ${262 - i * 14} l14 -18 l4 22Z" fill="${p.accent}"/>`).join('')}` + [130, 170, 240, 280].map(x => `<rect x="${x - 15}" y="296" width="30" height="58" rx="12" fill="${d.rg(p.dark)}" ${OL}/>`).join('');
      s += E(210, 280, 120, 66, d.rg(p.main), OL) + E(210, 300, 90, 30, p.belly, 'opacity=".7"') + C(110, 250, 56, d.rg(p.main), OL); fc = { x: 110, y: 244, s: 0.7 }; h = { cx: 110, cy: 250, r: 56 };
    } else if (k === 'egg') {
      s += C(200, 196, 78, d.rg(p.main), OL) + [-30, 0, 30].map(x => `<path d="M${200 + x - 10} 124 L${200 + x} 100 L${200 + x + 10} 124Z" fill="${d.rg(p.accent)}" ${OLs}/>`).join('');
      s += `<path d="M104 250 L130 230 L156 256 L184 226 L212 256 L240 228 L270 254 L296 232 Q310 350 200 356 Q90 350 104 250Z" fill="${d.rg('#fff8ea')}" ${OL}/>` + [[150, 300], [250, 290], [200, 330]].map(([x, y]) => C(x, y, 10, p.acLight)).join('');
      fc = { x: 200, y: 184, s: 0.95 }; h = { cx: 200, cy: 196, r: 78 };
    } else {
      const trex = k === 'trex', tri = k === 'tri';
      s += `<path d="M240 320 C320 340 360 300 350 240" fill="none" stroke="${p.main}" stroke-width="26" stroke-linecap="round"/>`;
      if (k === 'lizard') s += `<path d="M350 240 Q370 200 340 190 Q320 200 334 214" stroke="${p.main}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
      s += both(E(164, 348, 30, 15, d.rg(p.dark), OL)) + E(200, 290, 78, 66, d.rg(p.main), OL) + E(200, 304, 48, 42, p.belly, 'opacity=".95"');
      s += both(trex ? `<path d="M140 272 q-16 6 -14 18" stroke="${p.dark}" stroke-width="10" stroke-linecap="round" fill="none"/>` : E(134, 290, 16, 26, d.rg(p.main), `${OL} ${rot(28, 134, 290)}`));
      if (tri) s += `<path d="M80 190 Q80 60 200 56 Q320 60 320 190Z" fill="${d.rg(p.accent)}" ${OL}/>` + [110, 150, 200, 250, 290].map((x, i) => C(x, 120 - (i % 2) * 20, 9, p.acLight)).join('');
      else s += [-40, -14, 14, 40].map((x, i) => `<path d="M${200 + x - 12} ${96 + Math.abs(x) * 0.3} L${200 + x} ${66 + Math.abs(x) * 0.4} L${200 + x + 12} ${96 + Math.abs(x) * 0.3}Z" fill="${d.rg(p.accent)}" ${OLs}/>`).join('');
      s += C(200, 172, 86, d.rg(p.main), OL) + headPattern(d, p, k === 'lizard' ? 'spots' : '', { cx: 200, cy: 172, r: 86 });
      if (tri) s += both(`<path d="M150 112 Q140 70 120 56 Q146 70 168 104Z" fill="${d.rg('#fff3d6')}" ${OL}/>`) + `<path d="M190 200 L200 170 L210 200Z" fill="${d.rg('#fff3d6')}" ${OLs}/>`;
      s += E(200, 206, 46, 26, p.belly, 'opacity=".9"') + E(186, 198, 4, 6, p.deep) + E(214, 198, 4, 6, p.deep);
      fc = { x: 200, y: 156, s: 1, mouth: trex ? 'fang' : undefined }; h = { cx: 200, cy: 172, r: 86 }; n = { x: 200, y: 246, w: 104 };
    }
    return { svg: s, head: h, neck: n, face: fc };
  },
  blob(d, p, f) {
    const k = f.k; let s = '', fc = { x: 200, y: 250, s: 1 }, h = { cx: 200, cy: 250, r: 100 }, float = false;
    switch (k) {
      case 'slime': case 'jelly':
        s += `<path d="M90 352 Q80 200 200 150 Q320 200 310 352 Q290 362 270 352 Q250 380 230 352 Q200 362 170 352 Q150 376 130 352 Q110 362 90 352Z" fill="${d.rg(p.main)}" fill-opacity="${k === 'jelly' ? 0.82 : 1}" ${OL}/>` + shine(150, 214, 26, 12) + (k === 'jelly' ? C(250, 300, 10, '#fff', 'opacity=".5"') + C(270, 270, 6, '#fff', 'opacity=".5"') : ''); fc = { x: 200, y: 250, s: 1.05 }; h = { cx: 200, cy: 250, r: 100 }; break;
      case 'frog':
        s += both(E(140, 350, 36, 13, d.rg(p.dark), OL)) + E(200, 280, 126, 82, d.rg(p.main), OL) + E(200, 306, 80, 46, p.belly, 'opacity=".9"') + both(C(168, 194, 38, d.rg(p.main), OL)) + both(E(142, 250, 14, 8, '#ff8fa6', 'opacity=".55"'));
        s += `<path d="M150 252 Q200 290 250 252" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`; fc = { x: 200, y: 190, s: 1, mouth: 'none' }; h = { cx: 200, cy: 200, r: 80 }; break;
      case 'snowman':
        s += C(200, 300, 76, d.rg('#ffffff', { hl: 0.4, dk: -0.12 }), OL) + [270, 310].map(y => C(200, y, 7, INK, 'opacity=".75"')).join('') + both(`<path d="M138 270 L80 230 M96 242 L84 220" stroke="#8a5a32" stroke-width="7" stroke-linecap="round"/>`);
        s += C(200, 176, 64, d.rg('#ffffff', { hl: 0.4, dk: -0.12 }), OL) + `<path d="M198 196 L250 204 L198 210Z" fill="#ff8a3d" ${OLs}/>`; fc = { x: 200, y: 168, s: 0.8, mouth: 'none' }; h = { cx: 200, cy: 176, r: 64 }; break;
      case 'rock':
        s += `<path d="M84 350 Q70 260 110 210 Q150 150 220 160 Q300 170 316 250 Q330 320 300 352Z" fill="${d.rg(f.k === 'rock' ? tone(p.main, -0.05) : p.main)}" ${OL}/>` + [[150, 220, 14], [270, 290, 10], [240, 200, 8]].map(([x, y, r]) => C(x, y, r, tone(p.main, -0.2), 'opacity=".5"')).join('') + `<path d="M110 220 Q150 180 190 190" stroke="#7bd389" stroke-width="12" fill="none" stroke-linecap="round" opacity=".8"/>`; fc = { x: 200, y: 260, s: 1 }; break;
      case 'mochi':
        s += both(E(164, 354, 24, 10, d.rg(p.dark), OL)) + E(200, 280, 128, 84, d.rg(p.main, { hl: 0.55, dk: -0.15 }), OL) + shine(140, 230, 30, 12); fc = { x: 200, y: 268, s: 1 }; h = { cx: 200, cy: 270, r: 84 }; break;
      case 'donut':
        float = true; s += C(200, 230, 120, d.rg('#e0a96d'), OL) + `<path d="M84 220 Q90 120 200 112 Q310 120 316 220 Q300 250 280 236 Q260 260 236 240 Q214 260 190 244 Q170 262 148 240 Q120 260 104 236 Q90 246 84 220Z" fill="${d.rg(p.main)}" ${OL}/>` + C(200, 210, 34, '#fff', `opacity="0"`) + C(200, 196, 30, d.rg('#c48a5a'), OL) + [[130, 170, '#ffd34d'], [270, 160, '#4cc9f0'], [160, 140, '#7bd389'], [240, 210, '#ff70a6'], [120, 210, '#b388ff'], [250, 130, '#fff']].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="14" height="5" rx="2.5" fill="${c}" ${rot(i * 50, x, y)}/>`).join(''); fc = { x: 200, y: 280, s: 0.8 }; h = { cx: 200, cy: 196, r: 100 }; break;
      case 'pixel': { const px = 22, grid = ['..XXXXXX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '.XX.XX.XX.']; s += grid.map((row, y) => [...row].map((c, x) => c === 'X' ? `<rect x="${90 + x * px}" y="${150 + y * px}" width="${px}" height="${px}" fill="${(x + y) % 5 === 0 ? p.light : p.main}"/>` : '').join('')).join('') + `<rect x="90" y="150" width="220" height="176" fill="none" stroke="${INK}" stroke-opacity=".15"/>` + [[156, 216], [222, 216]].map(([x, y]) => `<rect x="${x}" y="${y}" width="22" height="22" fill="#fff"/><rect x="${x + 6}" y="${y + 6}" width="12" height="12" fill="${INK}"/>`).join('') + `<rect x="178" y="260" width="44" height="10" fill="${INK}"/>`; fc = null; h = { cx: 200, cy: 230, r: 100 }; break; }
      case 'germ':
        float = true; s += Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<path d="M${f1(200 + 90 * Math.cos(a))} ${f1(230 + 90 * Math.sin(a))} L${f1(200 + 122 * Math.cos(a))} ${f1(230 + 122 * Math.sin(a))}" stroke="${p.dark}" stroke-width="8" stroke-linecap="round"/>${C(200 + 124 * Math.cos(a), 230 + 124 * Math.sin(a), 10, d.rg(p.accent))}`; }).join('') + C(200, 230, 96, d.rg(p.main), OL) + headPattern(d, p, 'spots', { cx: 200, cy: 250, r: 96 }); fc = { x: 200, y: 222, s: 1 }; h = { cx: 200, cy: 230, r: 96 }; break;
      case 'drum':
        s += both(`<path d="M150 150 L110 70" stroke="#c48a5a" stroke-width="9" stroke-linecap="round"/>${C(108, 66, 12, '#f2d49b', OLs)}`) + `<path d="M90 170 L90 320 Q200 370 310 320 L310 170Z" fill="${d.rg(p.main)}" ${OL}/>` + [0, 1, 2, 3, 4].map(i => `<path d="M${100 + i * 50} 188 L${120 + i * 40} 330" stroke="${p.acLight}" stroke-width="5"/>`).join('') + E(200, 170, 110, 34, d.rg('#fff8ea'), OL); fc = { x: 200, y: 246, s: 0.95 }; h = { cx: 200, cy: 170, r: 110 }; break;
      case 'ball':
        s += both(E(166, 352, 24, 11, d.rg('#3a3150'), OL)) + C(200, 236, 104, d.rg(p.main === '#ffffff' ? '#ffffff' : p.main, { hl: 0.5, dk: -0.2 }), OL) + `<path d="M200 186 l30 22 l-12 34 l-36 0 l-12 -34Z" fill="${INK}" opacity=".75"/>` + [[130, 200], [270, 200], [150, 300], [250, 300]].map(([x, y]) => `<path d="M${x - 16} ${y} l16 -12 l16 12 l-6 18 l-20 0Z" fill="${INK}" opacity=".6"/>`).join(''); fc = { x: 200, y: 262, s: 0.85 }; h = { cx: 200, cy: 236, r: 104 }; break;
      case 'shell':
        s += `<path d="M80 300 Q100 150 200 130 Q300 150 320 300 Q200 330 80 300Z" fill="${d.rg(p.main)}" ${OL}/>` + [-2, -1, 0, 1, 2].map(i => `<path d="M200 136 L${200 + i * 50} 304" stroke="${p.dark}" stroke-width="4" opacity=".45"/>`).join('') + `<path d="M76 300 Q200 340 324 300 Q320 350 200 356 Q80 350 76 300Z" fill="${d.rg(p.dark)}" ${OL}/>` + C(200, 316, 22, d.rg('#ffffff'), OLs); fc = { x: 200, y: 218, s: 0.9 }; h = { cx: 200, cy: 220, r: 100 }; break;
      case 'book':
        s += both(E(160, 354, 22, 10, d.rg(p.deep), OL)) + `<rect x="108" y="110" width="184" height="236" rx="14" fill="${d.rg(p.main)}" ${OL}/><rect x="120" y="110" width="172" height="20" fill="#fff8ea" opacity=".9"/><rect x="108" y="110" width="26" height="236" rx="10" fill="${p.dark}"/>` + `<path d="${star5(220, 296, 22, 10)}" fill="${p.accent}"/>`; fc = { x: 212, y: 200, s: 0.9 }; h = { cx: 210, cy: 190, r: 80 }; break;
      case 'globe':
        s += `<path d="M200 330 L200 356 M150 358 L250 358" stroke="#8a5a32" stroke-width="10" stroke-linecap="round"/><path d="M90 220 A112 112 0 0 0 310 220" stroke="#c9a227" stroke-width="7" fill="none"/>` + C(200, 214, 104, d.rg('#4cc9f0'), OL) + `<path d="M140 150 Q170 130 190 160 Q180 190 150 186 Q130 176 140 150Z M220 230 Q260 220 270 260 Q250 290 226 270Z M120 240 Q140 240 150 270 Q130 276 120 240Z" fill="#7bd389" opacity=".9"/>`; fc = { x: 200, y: 208, s: 0.95 }; h = { cx: 200, cy: 214, r: 104 }; break;
    }
    return { svg: s, head: h, neck: null, face: fc, float };
  },
};

// ---------- the variant's element, floating around the creature ----------
function elementIcon(d, el, x, y, s, p, R) {
  switch (el) {
    case 'star': return `<path d="${star5(x, y, 14 * s, 6 * s, -90 + R() * 30)}" fill="#ffe066" ${OLs}/>`;
    case 'moon': return `<path d="M${x + 6 * s} ${y - 14 * s} A14 14 0 1 0 ${x + 6 * s} ${y + 14 * s} A10 10 0 1 1 ${x + 6 * s} ${y - 14 * s}Z" fill="#fff3b0" ${OLs}/>`;
    case 'sparkle': return sparkle(x, y, 14 * s, '#ffffff') + sparkle(x + 12 * s, y - 12 * s, 5 * s, p.acLight);
    case 'bubble': return C(x, y, 11 * s, '#ffffff', `fill-opacity=".18" stroke="#ffffff" stroke-width="2.5" stroke-opacity=".9"`) + C(x - 4 * s, y - 4 * s, 3 * s, '#fff');
    case 'leaf': return `${leafP(x, y, s, R() * 360)} fill="${d.rg('#7bd389')}" ${OLs}/>`;
    case 'flower': return [0, 72, 144, 216, 288].map(a => C(x + 8 * s * Math.cos(a * Math.PI / 180), y + 8 * s * Math.sin(a * Math.PI / 180), 6 * s, p.acLight)).join('') + C(x, y, 5 * s, '#ffd34d');
    case 'drop': return `<path d="${dropP(x, y, 0.8 * s)}" fill="#7fd3ff" ${OLs}/>`;
    case 'sand': return [0, 1, 2].map(i => C(x + (R() - 0.5) * 20 * s, y + (R() - 0.5) * 20 * s, (2 + R() * 3) * s, '#f6d38a')).join('');
    case 'sun': return C(x, y, 9 * s, '#ffd34d', OLs) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M${f1(x + 12 * s * Math.cos(a * Math.PI / 180))} ${f1(y + 12 * s * Math.sin(a * Math.PI / 180))} L${f1(x + 17 * s * Math.cos(a * Math.PI / 180))} ${f1(y + 17 * s * Math.sin(a * Math.PI / 180))}" stroke="#ffb703" stroke-width="3" stroke-linecap="round"/>`).join('');
    case 'snow': return [0, 60, 120].map(a => `<path d="M${x} ${y - 12 * s} L${x} ${y + 12 * s}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" ${rot(a, x, y)}/>`).join('');
    case 'fire': return `<path d="M${x} ${y - 16 * s} C${x + 10 * s} ${y - 4 * s} ${x + 12 * s} ${y + 6 * s} ${x} ${y + 12 * s} C${x - 12 * s} ${y + 6 * s} ${x - 10 * s} ${y - 4 * s} ${x} ${y - 16 * s}Z" fill="${d.lg(['#fff27a', '#ff7b00'], 0, 0, 0, 1)}"/>`;
    case 'candy': return `<path d="M${x - 9 * s} ${y} l-9 -8 l0 16Z M${x + 9 * s} ${y} l9 -8 l0 16Z" fill="${p.acLight}"/>${C(x, y, 9 * s, d.rg(p.accent === '#ffffff' ? '#ff6f91' : p.accent), OLs)}`;
    case 'bolt': return `<path d="M${x + 3 * s} ${y - 16 * s} L${x - 8 * s} ${y + 2 * s} L${x} ${y + 2 * s} L${x - 4 * s} ${y + 16 * s} L${x + 9 * s} ${y - 3 * s} L${x + 1 * s} ${y - 3 * s}Z" fill="#ffe066" ${OLs}/>`;
    case 'pixel': return [[0, 0], [1, 0], [0, 1]].map(([a, b]) => `<rect x="${x + a * 9 * s}" y="${y + b * 9 * s}" width="${8 * s}" height="${8 * s}" fill="${b ? p.acLight : p.accent}"/>`).join('');
    case 'cloud': return [[-8, 2, 8], [0, -4, 10], [9, 2, 8]].map(([a, b, r]) => C(x + a * s, y + b * s, r * s, '#ffffff', 'opacity=".9"')).join('');
    case 'rainbow': return ['#ff595e', '#ffca3a', '#8ac926', '#1982c4'].map((c, i) => `<path d="M${x - (16 - i * 3) * s} ${y + 6 * s} A${(16 - i * 3) * s} ${(16 - i * 3) * s} 0 0 1 ${x + (16 - i * 3) * s} ${y + 6 * s}" stroke="${c}" stroke-width="${3 * s}" fill="none"/>`).join('');
    case 'gem': return `<path d="M${x} ${y - 13 * s} L${x + 11 * s} ${y - 3 * s} L${x} ${y + 14 * s} L${x - 11 * s} ${y - 3 * s}Z" fill="${d.lg([p.acLight, p.accent], 0, 0, 1, 1)}" ${OLs}/>`;
    case 'atom': return `<ellipse cx="${x}" cy="${y}" rx="${16 * s}" ry="${6 * s}" stroke="${p.accent}" stroke-width="2.5" fill="none" ${rot(30, x, y)}/><ellipse cx="${x}" cy="${y}" rx="${16 * s}" ry="${6 * s}" stroke="${p.accent}" stroke-width="2.5" fill="none" ${rot(-30, x, y)}/>${C(x, y, 4 * s, p.accent)}`;
    case 'note': return `<path d="M${x + 4 * s} ${y + 8 * s} L${x + 4 * s} ${y - 14 * s} L${x + 14 * s} ${y - 10 * s}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>${E(x - 2 * s, y + 9 * s, 7 * s, 5.5 * s, p.accent, `${rot(-20, x, y)}`)}`;
    case 'ball': return C(x, y, 10 * s, '#ffffff', OLs) + `<path d="M${x - 4 * s} ${y - 3 * s} l4 -3 l4 3 l-1.5 5 l-5 0Z" fill="${INK}" opacity=".7"/>`;
    case 'gear': return `<g ${rot(R() * 60, x, y)}>${[0, 45, 90, 135].map(a => `<rect x="${x - 3 * s}" y="${y - 14 * s}" width="${6 * s}" height="${28 * s}" rx="1.5" fill="#9aa9bc" ${rot(a, x, y)}/>`).join('')}</g>${C(x, y, 9 * s, '#b8c4d4', OLs)}${C(x, y, 3.5 * s, '#5a6478')}`;
    case 'heart': return `<path d="${heart(x, y, 0.9 * s)}" fill="#ff7aa2" ${OLs}/>`;
    default: return '';
  }
}
function elementFx(d, el, n, p, R) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6 - Math.PI / 2, rr = 150 + R() * 32;
    const x = Math.max(26, Math.min(374, 200 + rr * Math.cos(a))), y = Math.max(30, Math.min(340, 210 + rr * 0.92 * Math.sin(a)));
    s += elementIcon(d, el, f1(x), f1(y), 0.9 + R() * 0.6, p, R);
  }
  return s;
}
const botEyes = (d, x, y, s, style, p) => {
  const g = 64 * s, col = p.accent === '#ffffff' ? '#7df9ff' : tone(p.accent, 0.25);
  const glow = `filter="${d.glow(3)}"`;
  const one = ex => style === 'happy' ? `<path d="M${ex - 12 * s} ${y + 4 * s} Q${ex} ${y - 12 * s} ${ex + 12 * s} ${y + 4 * s}" stroke="${col}" stroke-width="${7 * s}" fill="none" stroke-linecap="round"/>` : style === 'star' ? `<path d="${star5(ex, y, 15 * s, 7 * s)}" fill="${col}"/>` : E(ex, y, 10 * s, 15 * s, col);
  const eyes = one(x - g / 2) + one(x + g / 2);
  return `<g ${glow} opacity=".8">${eyes}</g>${eyes}<path d="M${x - 14 * s} ${y + 30 * s} Q${x} ${y + 42 * s} ${x + 14 * s} ${y + 30 * s}" stroke="${col}" stroke-width="${5 * s}" fill="none" stroke-linecap="round"/>`;
};

// ---------- a creature card's illustration (400×400, standing on y≈360) ----------
const ACC_POOL = ['none', 'none', 'none', 'bow', 'flower', 'beanie', 'scarf', 'bowtie', 'cap', 'party', 'leaf', 'star', 'glasses'];
const PLAN_KIND = { critter: 'חיה', bird: 'ציפור', fish: 'יצור ים', sea: 'יצור ים', dragon: 'דרקון', bot: 'רובוט', sprout: 'צמח', bug: 'חרק', spirit: 'יצור קסום', dino: 'דינוזאור', blob: 'יצור חמוד' };
export const planKind = plan => PLAN_KIND[plan] || 'יצור';
export function drawCreature(d, c) {
  const R = rng(c.id * 7919 + 17);
  const lvl = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }[c.rarity];
  const p = palette(c.v.main, c.v.accent, ((c.si * 7) % 5 - 2) * 7);
  const f = c.sp.f;
  const plan = PLANS[c.sp.plan](d, p, f, R);
  const eyes = plan.face && plan.face.eyes || (lvl >= 2 ? pick(R, ['sparkle', 'sparkle', 'big', 'star']) : pick(R, ['big', 'big', 'happy', 'wink', 'dot', 'sparkle', 'sleepy']));
  const mouth = plan.face && plan.face.mouth !== undefined ? plan.face.mouth : pick(R, ['smile', 'grin', 'cat', 'tongue', 'smile', 'o', 'grin']);
  let acc = f.acc || (lvl === 4 ? 'crown' : lvl === 3 && R() < 0.4 ? pick(R, ['crown', 'headphones', 'star']) : pick(R, ACC_POOL));
  if (plan.crown) acc = 'crown';
  if (f.horn && !['bow', 'flower', 'scarf', 'bowtie', 'glasses', 'star', 'none'].includes(acc)) acc = f.acc && f.acc !== 'crown' ? 'none' : lvl === 4 ? 'none' : pick(R, ['scarf', 'bowtie', 'bow']);
  if (['sprout', 'spirit', 'fish', 'bug'].includes(c.sp.plan) && ['scarf', 'bowtie'].includes(acc)) acc = 'none';
  if (c.sp.plan === 'bot' && !['crown', 'headphones', 'goggles', 'band', 'party'].includes(acc)) acc = lvl >= 3 ? 'crown' : 'none';
  if (['tree', 'mushroom', 'cupcake', 'pumpkin'].includes(f.k) && acc !== 'crown') acc = 'none';
  let fc = '';
  if (plan.face) fc = plan.face.bot ? botEyes(d, plan.face.x, plan.face.y, plan.face.s, eyes === 'happy' || eyes === 'star' ? eyes : 'oval', p)
    : face(d, plan.face.x, plan.face.y, plan.face.s, { eyes, mouth: mouth === 'none' ? '' : mouth, blush: R() < 0.8, glasses: acc === 'glasses', lashes: R() < 0.25 }, p);
  const head = plan.head;
  const hornSvg = f.horn && head ? horn(d, p, f.horn, head) : '';
  const accSvg = accessory(d, acc, head, plan.neck, p) + (lvl === 4 && acc !== 'halo' ? accessory(d, 'halo', { ...head, cy: head.cy - (acc === 'crown' ? 40 : 0) }, null, p) : '');
  const nEl = [1, 3, 5, 7, 9][lvl];
  const aura = lvl >= 2 ? C(200, 236, 150, lvl === 4 ? '#ffe27a' : p.acLight, `opacity="${lvl === 2 ? 0.28 : 0.4}" filter="${d.glow(26)}"`) : '';
  const ring = lvl >= 3 ? `<ellipse cx="200" cy="350" rx="130" ry="22" fill="none" stroke="${lvl === 4 ? '#ffe27a' : p.acLight}" stroke-width="5" opacity=".7" filter="${d.glow(3)}"/>` : '';
  const scale = 0.94 + R() * 0.08, lift = plan.float ? -14 : 0;
  return `${aura}${ring}${ground(plan.float ? 70 : 96, 360, plan.float ? 0.12 : 0.2)}<g transform="translate(200 ${360 + lift}) scale(${f1(scale * 100) / 100}) translate(-200 -360)">${plan.svg}${hornSvg}${fc}${accSvg}</g>${elementFx(d, c.v.el, nEl, p, R)}`;
}

// ---------- the world behind the creature (W×H) ----------
export function worldScene(d, w, W, H, R, rarity) {
  const [s0, s1] = w.sky;
  let s = `<rect width="${W}" height="${H}" fill="${d.lg([s0, s1])}"/>`;
  const gy = H * 0.8;
  const hills = (y, col, amp = 30, o = 1) => `<path d="M0 ${y} ${Array.from({ length: 7 }, (_, i) => `Q${f1(W * (i + 0.5) / 6)} ${f1(y - amp * (0.5 + R()))} ${f1(W * (i + 1) / 6)} ${f1(y)}`).join(' ')} L${W} ${H} L0 ${H}Z" fill="${col}" opacity="${o}"/>`;
  const stars = (n, col = '#fff', maxY = H * 0.7) => Array.from({ length: n }, () => C(R() * W, R() * maxY, 0.8 + R() * 2.2, col, `opacity="${f1(0.4 + R() * 0.6)}"`)).join('');
  const cloud = (x, y, k = 1, col = '#ffffff', o = 0.9) => [[-30, 6, 24], [0, -6, 32], [32, 4, 26], [10, 14, 24]].map(([a, b, r]) => C(x + a * k, y + b * k, r * k, col, `opacity="${o}"`)).join('');
  const pine = (x, y, h, col) => `<path d="M${x} ${y - h} L${x + h * 0.36} ${y - h * 0.4} L${x + h * 0.2} ${y - h * 0.4} L${x + h * 0.44} ${y} L${x - h * 0.44} ${y} L${x - h * 0.2} ${y - h * 0.4} L${x - h * 0.36} ${y - h * 0.4}Z" fill="${col}"/>`;
  switch (w.scene) {
    case 'space': s += C(W * 0.25, H * 0.3, W * 0.35, '#7b2ff7', `opacity=".35" filter="${d.glow(40)}"`) + C(W * 0.8, H * 0.6, W * 0.3, '#00c2ff', `opacity=".25" filter="${d.glow(40)}"`) + stars(70) + C(W * 0.86, H * 0.36, W * 0.08, d.rg('#ff9f6b'), '') + `<ellipse cx="${W * 0.86}" cy="${H * 0.36}" rx="${W * 0.15}" ry="${W * 0.032}" fill="none" stroke="#ffd6a5" stroke-width="5" opacity=".8" ${rot(-18, W * 0.86, H * 0.36)}/>` + C(W * 0.1, H * 0.3, W * 0.035, d.rg('#b9c4e8')) + hills(gy + 20, '#2a1f5c', 20) + `<path d="M0 ${gy + 20} L${W} ${gy + 20}" stroke="#8a7cff" stroke-width="2" opacity=".4"/>`; break;
    case 'ocean': s += Array.from({ length: 6 }, (_, i) => `<path d="M${W * (0.1 + i * 0.16)} 0 L${W * (0.18 + i * 0.16)} 0 L${W * (0.05 + i * 0.2)} ${H} L${W * (0 + i * 0.2)} ${H}Z" fill="#fff" opacity=".07"/>`).join('') + Array.from({ length: 5 }, (_, i) => { const x = W * (0.06 + i * 0.22 + R() * 0.05); return `<path d="M${x} ${H} Q${x - 20} ${H * 0.8} ${x + 6} ${H * 0.68} Q${x + 26} ${H * 0.58} ${x} ${H * 0.5}" stroke="${i % 2 ? '#2a9d8f' : '#52b788'}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".8"/>`; }).join('') + hills(gy + 30, '#f4d58d', 16) + Array.from({ length: 12 }, () => C(R() * W, R() * H * 0.8, 3 + R() * 7, 'none', 'stroke="#fff" stroke-width="2" opacity=".5"')).join(''); break;
    case 'deepsea': s += C(W * 0.5, -H * 0.1, W * 0.5, '#4cc9f0', `opacity=".18" filter="${d.glow(40)}"`) + Array.from({ length: 30 }, () => C(R() * W, R() * H, 1 + R() * 2.5, R() < 0.5 ? '#7df9ff' : '#f72585', `opacity="${f1(0.3 + R() * 0.6)}"`)).join('') + hills(gy + 30, '#0a2a4a', 34) + Array.from({ length: 4 }, (_, i) => `<path d="M${W * (0.1 + i * 0.27)} ${H} Q${W * (0.06 + i * 0.27)} ${H * 0.82} ${W * (0.12 + i * 0.27)} ${H * 0.7}" stroke="#1b4965" stroke-width="12" fill="none" stroke-linecap="round"/>`).join(''); break;
    case 'jungle': s += C(W * 0.7, H * 0.2, W * 0.14, '#fff6b0', `opacity=".7" filter="${d.glow(20)}"`) + hills(gy - 40, '#4a9e5c', 40, 0.7) + hills(gy + 10, '#2f7d46', 30) + [[0, 0, 40], [W, 0, 140], [0, H * 0.55, -30], [W, H * 0.6, 200]].map(([x, y, a]) => `<g ${rot(a, x, y)}>${leafP(x + 40, y + 10, 5, 90)} fill="#1f6b3a" opacity=".9"/>${leafP(x + 10, y + 50, 4, 60)} fill="#2a8a4a" opacity=".9"/></g>`).join('') + Array.from({ length: 3 }, (_, i) => `<path d="M${W * (0.25 + i * 0.25)} 0 Q${W * (0.22 + i * 0.25)} ${H * 0.2} ${W * (0.27 + i * 0.25)} ${H * (0.18 + R() * 0.15)}" stroke="#3d8b40" stroke-width="5" fill="none"/>`).join(''); break;
    case 'desert': s += C(W * 0.75, H * 0.22, W * 0.12, '#fff3b0', `filter="${d.glow(6)}"`) + C(W * 0.75, H * 0.22, W * 0.2, '#ffe066', `opacity=".35" filter="${d.glow(30)}"`) + hills(gy - 50, '#f0b86e', 40, 0.8) + hills(gy - 10, '#e9a254', 30) + hills(gy + 30, '#d98c3e', 20) + [[W * 0.12, gy - 10], [W * 0.88, gy + 5]].map(([x, y]) => `<path d="M${x - 8} ${y} L${x - 8} ${y - 70} Q${x} ${y - 80} ${x + 8} ${y - 70} L${x + 8} ${y}Z M${x - 8} ${y - 40} Q${x - 26} ${y - 40} ${x - 26} ${y - 56} M${x + 8} ${y - 30} Q${x + 24} ${y - 30} ${x + 24} ${y - 50}" fill="#3f7d3a" stroke="#3f7d3a" stroke-width="8" stroke-linecap="round"/>`).join(''); break;
    case 'arctic': s += ['#7cf5c9', '#b388ff', '#7df9ff'].map((c, i) => `<path d="M-20 ${H * (0.18 + i * 0.08)} Q${W * 0.3} ${H * (0.05 + i * 0.1)} ${W * 0.55} ${H * (0.2 + i * 0.05)} T${W + 20} ${H * (0.12 + i * 0.08)}" stroke="${c}" stroke-width="${26 - i * 6}" fill="none" opacity=".35" filter="${d.glow(8)}"/>`).join('') + hills(gy - 30, '#e8f4ff', 50) + hills(gy + 20, '#ffffff', 26) + Array.from({ length: 30 }, () => C(R() * W, R() * H, 1.5 + R() * 2.5, '#fff', 'opacity=".8"')).join(''); break;
    case 'volcano': s += C(W * 0.5, H * 0.32, W * 0.25, '#ff6b35', `opacity=".45" filter="${d.glow(30)}"`) + `<path d="M${W * 0.08} ${gy} L${W * 0.42} ${H * 0.3} L${W * 0.58} ${H * 0.3} L${W * 0.92} ${gy}Z" fill="#3b1f2b"/><path d="M${W * 0.42} ${H * 0.3} L${W * 0.58} ${H * 0.3} L${W * 0.55} ${H * 0.36} L${W * 0.5} ${H * 0.5} L${W * 0.46} ${H * 0.36}Z" fill="#ff7b00"/>` + hills(gy + 20, '#2a1520', 20) + Array.from({ length: 18 }, () => C(R() * W, R() * H * 0.7, 1.5 + R() * 3, R() < 0.5 ? '#ffd23f' : '#ff7b00', `opacity="${f1(0.4 + R() * 0.6)}"`)).join(''); break;
    case 'candy': s += cloud(W * 0.2, H * 0.15, 1) + cloud(W * 0.8, H * 0.22, 0.8) + [[W * 0.12, gy - 10, '#ff8fab'], [W * 0.88, gy - 20, '#7ee8c6'], [W * 0.3, gy - 30, '#b388ff']].map(([x, y, c]) => `<rect x="${x - 4}" y="${y - 90}" width="8" height="90" fill="#fff" ${OLs}/>${C(x, y - 100, 30, c, OLs)}<path d="M${x - 20} ${y - 100} Q${x} ${y - 124} ${x + 20} ${y - 100} Q${x} ${y - 80} ${x - 10} ${y - 100}" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/>`).join('') + hills(gy + 10, '#ffc2dd', 26) + Array.from({ length: 16 }, () => `<rect x="${f1(R() * W)}" y="${f1(gy + 20 + R() * (H - gy - 30))}" width="10" height="4" rx="2" fill="${pick(R, ['#ffd34d', '#4cc9f0', '#7bd389', '#ff70a6'])}"/>`).join(''); break;
    case 'city': s += stars(30) + C(W * 0.8, H * 0.15, W * 0.07, '#fff3b0') + Array.from({ length: 9 }, (_, i) => { const bw = W / 9, bh = H * (0.25 + R() * 0.3), x = i * bw; return `<rect x="${f1(x)}" y="${f1(gy - bh)}" width="${f1(bw - 4)}" height="${f1(bh + 20)}" fill="${i % 2 ? '#26124f' : '#321a66'}"/>` + Array.from({ length: 6 }, () => `<rect x="${f1(x + 6 + R() * (bw - 20))}" y="${f1(gy - bh + 10 + R() * (bh - 20))}" width="7" height="9" fill="${pick(R, ['#ff4ecd', '#39f3ff', '#ffd23f'])}" opacity=".85"/>`).join(''); }).join('') + `<rect x="0" y="${gy}" width="${W}" height="${H - gy}" fill="#150a33"/><path d="M0 ${gy} L${W} ${gy}" stroke="#ff4ecd" stroke-width="4" filter="${d.glow(4)}"/>`; break;
    case 'sky': case 'dream': s += (w.scene === 'dream' ? stars(26, '#fff') + `<path d="M${W * 0.86} ${H * 0.1} A${W * 0.07} ${W * 0.07} 0 1 0 ${W * 0.86} ${H * 0.26} A${W * 0.05} ${W * 0.05} 0 1 1 ${W * 0.86} ${H * 0.1}Z" fill="#fff8c2"/>` : '') + ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((c, i) => `<path d="M${-W * 0.1 + i * 12} ${H * 0.85} A${W * 0.6 - i * 12} ${W * 0.6 - i * 12} 0 0 1 ${W * 1.1 - i * 12} ${H * 0.85}" stroke="${c}" stroke-width="12" fill="none" opacity=".28"/>`).join('') + cloud(W * 0.15, H * 0.2, 1.1) + cloud(W * 0.75, H * 0.12, 0.9) + cloud(W * 0.1, gy + 10, 1.6) + cloud(W * 0.5, gy + 30, 1.8) + cloud(W * 0.92, gy + 10, 1.5); break;
    case 'night': s += stars(50) + C(W * 0.78, H * 0.16, W * 0.09, '#fff8d6', `filter="${d.glow(3)}"`) + C(W * 0.78, H * 0.16, W * 0.16, '#fff8d6', `opacity=".25" filter="${d.glow(24)}"`) + Array.from({ length: 7 }, (_, i) => pine(W * (i / 6), gy + 20, H * (0.3 + R() * 0.15), '#14264f')).join('') + hills(gy + 20, '#0f1d3d', 14) + Array.from({ length: 12 }, () => C(R() * W, H * 0.4 + R() * H * 0.5, 3, '#e9ff70', `opacity=".9" filter="${d.glow(2)}"`)).join(''); break;
    case 'meadow': case 'farm': s += C(W * 0.18, H * 0.16, W * 0.08, '#ffe066', `filter="${d.glow(4)}"`) + cloud(W * 0.7, H * 0.14, 0.9) + hills(gy - 40, '#a7e08a', 40, 0.8) + (w.scene === 'farm' ? `<g transform="translate(${W * 0.72} ${gy - 120})"><path d="M0 60 L50 0 L100 60Z" fill="#9b2226"/><rect x="8" y="60" width="84" height="70" fill="#c1121f"/><rect x="36" y="88" width="28" height="42" fill="#fff"/><path d="M36 88 L64 130 M64 88 L36 130" stroke="#c1121f" stroke-width="4"/></g>` + Array.from({ length: 8 }, (_, i) => `<rect x="${i * W / 8}" y="${gy - 4}" width="6" height="34" fill="#e9d8a6"/>`).join('') + `<rect x="0" y="${gy + 4}" width="${W}" height="6" fill="#e9d8a6"/>` : '') + hills(gy + 10, '#7bc950', 26) + Array.from({ length: 22 }, () => { const x = R() * W, y = gy + 20 + R() * (H - gy - 26); return C(x, y, 4, pick(R, ['#ff70a6', '#ffd23f', '#ffffff', '#b388ff'])) + C(x, y, 1.6, '#ffd34d'); }).join(''); break;
    case 'cave': s += Array.from({ length: 24 }, () => C(R() * W, R() * H, 1 + R() * 2, '#e0aaff', `opacity="${f1(0.3 + R() * 0.5)}"`)).join('') + [[W * 0.08, gy + 10, 1.4], [W * 0.92, gy, 1.2], [W * 0.2, gy + 30, 0.8], [W * 0.78, gy + 34, 0.9]].map(([x, y, k], i) => { const c = pick(R, ['#b072ff', '#3a86ff', '#2ec4b6', '#ef476f']); return C(x, y - 40 * k, 50 * k, c, `opacity=".35" filter="${d.glow(14)}"`) + [-24, 0, 24].map((o, j) => `<path d="M${x + o * k - 14 * k} ${y} L${x + o * k} ${y - (70 + j * 20 - Math.abs(o)) * k} L${x + o * k + 14 * k} ${y}Z" fill="${d.lg([tone(c, 0.5), c], 0, 0, 1, 1)}" ${OLs}/>`).join(''); }).join('') + hills(gy + 30, '#2a1550', 20) + `<path d="M0 0 L${W} 0 L${W} ${H * 0.08} ${Array.from({ length: 8 }, (_, i) => `L${f1(W * (1 - (i + 0.5) / 8))} ${f1(H * (0.1 + R() * 0.08))} L${f1(W * (1 - (i + 1) / 8))} ${f1(H * 0.06)}`).join(' ')}Z" fill="#12082a"/>`; break;
    case 'castle': s += stars(30) + C(W * 0.5, H * 0.75, W * 0.6, '#ff9e7a', `opacity=".3" filter="${d.glow(40)}"`) + `<g fill="#3b2a6b" transform="translate(${W * 0.5} ${gy - 20})">${[[-120, 120, 40], [-60, 170, 46], [0, 210, 56], [60, 170, 46], [120, 120, 40]].map(([x, h, w2]) => `<rect x="${x - w2 / 2}" y="${-h}" width="${w2}" height="${h + 40}"/><path d="M${x - w2 / 2 - 6} ${-h} L${x} ${-h - 46} L${x + w2 / 2 + 6} ${-h}Z" fill="#5a3f9e"/><path d="M${x} ${-h - 46} l0 -20 l18 6 l-18 6" fill="${w.id === 'kingdom' ? '#ffd166' : '#ef476f'}" stroke="#3b2a6b" stroke-width="2"/><rect x="${x - 5}" y="${-h + 24}" width="10" height="16" rx="5" fill="#ffd166" opacity=".9"/>`).join('')}</g>` + hills(gy + 20, '#2b1d5c', 18); break;
    case 'lab': case 'factory': { const fac = w.scene === 'factory'; s += Array.from({ length: 6 }, (_, i) => `<path d="M0 ${H * (0.1 + i * 0.14)} L${W} ${H * (0.1 + i * 0.14)}" stroke="#ffffff" stroke-width="2" opacity=".2"/>`).join('') + (fac ? [[W * 0.15, H * 0.25, 60], [W * 0.85, H * 0.35, 80], [W * 0.6, H * 0.1, 40]].map(([x, y, r]) => `<g opacity=".35">${Array.from({ length: 8 }, (_, i) => `<rect x="${x - 10}" y="${y - r - 12}" width="20" height="${2 * r + 24}" rx="4" fill="#5a6478" ${rot(i * 22.5, x, y)}/>`).join('')}${C(x, y, r, '#5a6478')}${C(x, y, r * 0.4, '#cfd8e3')}</g>`).join('') + `<path d="M0 ${H * 0.55} L${W} ${H * 0.55}" stroke="#5a6478" stroke-width="16" opacity=".4"/>` : `<rect x="${W * 0.05}" y="${H * 0.18}" width="${W * 0.9}" height="10" fill="#9a8c98" opacity=".6"/>` + Array.from({ length: 7 }, (_, i) => { const x = W * (0.1 + i * 0.13), c = pick(R, ['#56cfe1', '#ff5d8f', '#b5e48c', '#ffd166']); return `<path d="M${x - 8} ${H * 0.1} L${x - 8} ${H * 0.13} L${x - 16} ${H * 0.18} L${x + 16} ${H * 0.18} L${x + 8} ${H * 0.13} L${x + 8} ${H * 0.1}Z" fill="${c}" opacity=".8" ${OLs}/>`; }).join('')) + `<rect x="0" y="${gy}" width="${W}" height="${H - gy}" fill="${fac ? '#5a6478' : '#dfe7f2'}"/>` + Array.from({ length: 10 }, (_, i) => `<path d="M${i * W / 10} ${gy} L${i * W / 10 - 30} ${H}" stroke="${fac ? '#3a4255' : '#b9c7da'}" stroke-width="2"/>`).join('') + (fac ? `<rect x="0" y="${gy - 8}" width="${W}" height="14" fill="#ffb703" opacity=".8"/>` + Array.from({ length: 12 }, (_, i) => `<path d="M${i * W / 12} ${gy - 8} l14 0 l-12 14 l-14 0Z" fill="#2b2340" opacity=".7"/>`).join('') : ''); break; }
    case 'stage': s += [0.2, 0.5, 0.8].map((x, i) => `<path d="M${W * x - 20} 0 L${W * x + 20} 0 L${W * x + 120} ${gy} L${W * x - 120} ${gy}Z" fill="${['#ff4ecd', '#ffd23f', '#39f3ff'][i]}" opacity=".16"/>`).join('') + `<path d="M0 0 L${W * 0.14} 0 Q${W * 0.1} ${H * 0.4} ${W * 0.16} ${H} L0 ${H}Z" fill="#9d0208"/><path d="M${W} 0 L${W * 0.86} 0 Q${W * 0.9} ${H * 0.4} ${W * 0.84} ${H} L${W} ${H}Z" fill="#9d0208"/><rect x="0" y="0" width="${W}" height="${H * 0.06}" fill="#6a040f"/>` + `<rect x="0" y="${gy}" width="${W}" height="${H - gy}" fill="#3c1642"/>` + `<path d="M0 ${gy} L${W} ${gy}" stroke="#ffd23f" stroke-width="4"/>` + stars(20, '#ffd23f'); break;
    case 'sports': s += cloud(W * 0.8, H * 0.12, 0.8) + `<path d="M0 ${H * 0.28} Q${W * 0.5} ${H * 0.18} ${W} ${H * 0.28} L${W} ${H * 0.55} L0 ${H * 0.55}Z" fill="#5c677d"/>` + Array.from({ length: 80 }, () => C(R() * W, H * (0.3 + R() * 0.22), 3, pick(R, ['#ff595e', '#ffca3a', '#1982c4', '#ffffff', '#8ac926']), 'opacity=".8"')).join('') + [W * 0.1, W * 0.9].map(x => `<rect x="${x - 3}" y="${H * 0.05}" width="6" height="${H * 0.25}" fill="#adb5bd"/><rect x="${x - 22}" y="${H * 0.03}" width="44" height="18" rx="4" fill="#fff" ${OLs}/>${C(x, H * 0.05, 40, '#fff', `opacity=".35" filter="${d.glow(12)}"`)}`).join('') + `<rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="#55a630"/>` + Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${H * (0.55 + i * 0.09)}" width="${W}" height="${H * 0.045}" fill="#80b918" opacity=".6"/>`).join('') + `<path d="M0 ${H * 0.72} L${W} ${H * 0.72}" stroke="#fff" stroke-width="5" opacity=".9"/>`; break;
    case 'prehistoric': s += C(W * 0.8, H * 0.2, W * 0.1, '#fff3b0', `filter="${d.glow(6)}"`) + `<path d="M${W * 0.0} ${gy - 30} L${W * 0.22} ${H * 0.36} L${W * 0.3} ${H * 0.36} L${W * 0.5} ${gy - 30}Z" fill="#8d6e63" opacity=".7"/>` + C(W * 0.26, H * 0.3, 20, '#bcaaa4', `opacity=".6" filter="${d.glow(8)}"`) + hills(gy - 20, '#8bc34a', 30, 0.8) + [[W * 0.1, gy + 10], [W * 0.9, gy]].map(([x, y]) => `<path d="M${x} ${y} Q${x - 6} ${y - 60} ${x + 4} ${y - 110}" stroke="#795548" stroke-width="10" fill="none"/>` + [-60, -20, 20, 60].map(a => `${leafP(x + 4 + 30 * Math.sin(a * Math.PI / 180), y - 110 - 20 * Math.cos(a * Math.PI / 180), 2.4, a)} fill="#2e7d32"/>`).join('')).join('') + hills(gy + 20, '#689f38', 18); break;
    case 'autumn': s += C(W * 0.82, H * 0.16, W * 0.08, '#fff1c2', `filter="${d.glow(5)}"`) + [[W * 0.12, gy, 90, '#e76f51'], [W * 0.88, gy - 10, 110, '#f4a261'], [W * 0.5, gy - 60, 70, '#e9c46a']].map(([x, y, r, c]) => `<rect x="${x - 8}" y="${y - r}" width="16" height="${r + 20}" fill="#6d4c41"/>${C(x, y - r - 10, r * 0.7, c)}${C(x - r * 0.4, y - r * 0.8, r * 0.5, tone(c, -0.1))}${C(x + r * 0.4, y - r * 0.8, r * 0.5, tone(c, 0.1))}`).join('') + hills(gy + 10, '#bc6c25', 20) + Array.from({ length: 14 }, () => `${leafP(R() * W, R() * H, 0.8, R() * 360)} fill="${pick(R, ['#e76f51', '#f4a261', '#e9c46a', '#d62828'])}" opacity=".85"/>`).join(''); break;
    case 'storm': s += Array.from({ length: 30 }, () => { const x = R() * W, y = R() * H; return `<path d="M${f1(x)} ${f1(y)} l-6 16" stroke="#dff3ff" stroke-width="2" opacity=".6"/>`; }).join('') + cloud(W * 0.2, H * 0.08, 1.8, '#41587a', 1) + cloud(W * 0.7, H * 0.06, 2, '#3a4d6b', 1) + `<path d="M${W * 0.82} ${H * 0.16} L${W * 0.76} ${H * 0.32} L${W * 0.8} ${H * 0.32} L${W * 0.74} ${H * 0.48}" stroke="#fff27a" stroke-width="6" fill="none" stroke-linejoin="round" filter="${d.glow(3)}"/>` + hills(gy + 10, '#5a7d6a', 18) + E(W * 0.3, gy + 40, 70, 12, '#9ec5e8', 'opacity=".6"'); break;
    case 'library': s += Array.from({ length: 4 }, (_, row) => { const y = H * (0.08 + row * 0.18); return `<rect x="0" y="${y + H * 0.15}" width="${W}" height="10" fill="#6d4c41"/>` + Array.from({ length: 22 }, (_, i) => { const bw = 12 + R() * 10, bh = H * (0.1 + R() * 0.05); return `<rect x="${f1(i * W / 22)}" y="${f1(y + H * 0.15 - bh)}" width="${f1(bw)}" height="${f1(bh)}" fill="${pick(R, ['#8d6346', '#3d5a80', '#c77dff', '#06d6a0', '#e63946', '#ffd166'])}" opacity=".85"/>`; }).join(''); }).join('') + C(W * 0.5, H * 0.4, W * 0.4, '#fff1c2', `opacity=".35" filter="${d.glow(40)}"`) + `<rect x="0" y="${gy}" width="${W}" height="${H - gy}" fill="#8d6346"/>`; break;
  }
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
    const n = rarity === 'rare' ? 12 : 18, cx = W / 2, cy = H * 0.46; let rays = '';
    for (let i = 0; i < n; i++) { const a1 = (i / n) * Math.PI * 2, a2 = a1 + Math.PI / n * 0.55, L = W * 1.3; rays += `<path d="M${f1(cx)} ${f1(cy)} L${f1(cx + L * Math.cos(a1))} ${f1(cy + L * Math.sin(a1))} L${f1(cx + L * Math.cos(a2))} ${f1(cy + L * Math.sin(a2))}Z"/>`; }
    s += `<g fill="${rarity === 'legendary' ? '#ffe27a' : '#ffffff'}" opacity="${rarity === 'legendary' ? 0.2 : 0.11}">${rays}</g>`;
  }
  s += `<rect width="${W}" height="${H}" fill="url(#${(() => { const i = d.id(); d.defs.push(`<radialGradient id="${i}" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b0620" stop-opacity=".35"/></radialGradient>`); return i; })()})"/>`;
  return s;
}
