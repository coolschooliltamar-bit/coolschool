// Aluma sticker cards – illustrations and card frames, drawn in SVG (spec ז).
// Every character is drawn by its own function (no recoloured copies). Shading uses radial
// gradients for a soft "3D cartoon" look. Frames and effects escalate with rarity:
//   common: clean frame, soft shading · uncommon: decorated frame, patterned background, a few sparkles
//   rare: metallic frame, light rays and glow · epic: chrome-rainbow frame, energy bolts, particles, 3D floor
//   legendary: 3D gold frame, rainbow holographic sheen, halo, layered lights, LEGENDARY ribbon.
// Works in the browser (inline SVG in the app) and in Node (tools/build-cards.mjs exports PNG/SVG files).
import { RARITY, RARITY_ORDER, TOTAL, seriesOf, worldOf, cardById } from './cards.js';
import { drawCreature, worldScene } from './creatures.js';

const INK = '#2b2340';
const OL = `stroke="${INK}" stroke-opacity=".28" stroke-width="3" stroke-linejoin="round"`;
let uid = 0;

function tone(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const ch = s => Math.round((t - s) * p + s);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rng(seed) { let a = seed * 9973 + 12345; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function makeCtx(prefix) {
  const defs = []; let n = 0;
  const id = () => `${prefix}${n++}`;
  return {
    defs,
    id,
    // soft 3D ball shading: highlight top-left, base, darker rim
    rg(base, { hl = 0.5, dk = -0.32, cx = 36, cy = 28 } = {}) { const i = id(); defs.push(`<radialGradient id="${i}" cx="${cx}%" cy="${cy}%" r="78%"><stop offset="0" stop-color="${tone(base, hl)}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${tone(base, dk)}"/></radialGradient>`); return `url(#${i})`; },
    lg(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { const i = id(); defs.push(`<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((s, k) => `<stop offset="${Array.isArray(s) ? s[0] : k / (stops.length - 1)}" stop-color="${Array.isArray(s) ? s[1] : s}"${Array.isArray(s) && s[2] != null ? ` stop-opacity="${s[2]}"` : ''}/>`).join('')}</linearGradient>`); return `url(#${i})`; },
    glow(r = 6) { const i = id(); defs.push(`<filter id="${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r}"/></filter>`); return `url(#${i})`; },
    clip(shape) { const i = id(); defs.push(`<clipPath id="${i}">${shape}</clipPath>`); return `url(#${i})`; },
  };
}

// ---------- face & detail helpers ----------
const eye = (x, y, r = 13) => `<g><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.16}" fill="#fff" ${OL}/><circle cx="${x + r * 0.08}" cy="${y + r * 0.14}" r="${r * 0.64}" fill="${INK}"/><circle cx="${x + r * 0.32}" cy="${y - r * 0.18}" r="${r * 0.26}" fill="#fff"/><circle cx="${x - r * 0.2}" cy="${y + r * 0.38}" r="${r * 0.11}" fill="#fff"/></g>`;
const eyes = (x, y, gap, r) => eye(x - gap / 2, y, r) + eye(x + gap / 2, y, r);
const happyEyes = (x, y, gap, w = 10) => [-1, 1].map(s => `<path d="M${x + s * gap / 2 - w} ${y + 4} Q${x + s * gap / 2} ${y - w} ${x + s * gap / 2 + w} ${y + 4}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`).join('');
const sleepyEyes = (x, y, gap, w = 10) => [-1, 1].map(s => `<path d="M${x + s * gap / 2 - w} ${y - 2} Q${x + s * gap / 2} ${y + w * 0.8} ${x + s * gap / 2 + w} ${y - 2}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
const smile = (x, y, w = 14) => `<path d="M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
const grin = (x, y, w = 15) => `<path d="M${x - w} ${y} Q${x} ${y + w * 1.35} ${x + w} ${y} Z" fill="${INK}"/><path d="M${x - w * 0.55} ${y + w * 0.62} Q${x} ${y + w * 1.12} ${x + w * 0.55} ${y + w * 0.62} Q${x} ${y + w * 0.4} ${x - w * 0.55} ${y + w * 0.62}Z" fill="#ff7d8e"/>`;
const blush = (x, y, gap, r = 9) => [-1, 1].map(s => `<ellipse cx="${x + s * gap / 2}" cy="${y}" rx="${r * 1.3}" ry="${r * 0.75}" fill="#ff8fa6" opacity=".55"/>`).join('');
const shine = (x, y, rx, ry, rot = -30, o = 0.5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`;
const ground = (x = 200, y = 362, rx = 95) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.14}" fill="#1b1430" opacity=".16"/>`;
const sparkle = (x, y, r, fill = '#fff', o = 1) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="${fill}" opacity="${o}"/>`;
const star5 = (cx, cy, R, r, rot = -90) => { let d = ''; for (let i = 0; i < 10; i++) { const a = (rot + i * 36) * Math.PI / 180, rr = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `; } return d + 'Z'; };
const drop = (x, y, s = 1) => `M${x} ${y - 16 * s} Q${x + 11 * s} ${y} ${x + 8 * s} ${y + 6 * s} Q${x} ${y + 14 * s} ${x - 8 * s} ${y + 6 * s} Q${x - 11 * s} ${y} ${x} ${y - 16 * s}Z`;

// ---------- the 40 characters (400×400 box, standing on y≈362) ----------
const ART = {
  1: { bg: ['#fff6dc', '#ffd28a'], draw: d => { // Popi Popcorn
    const stripes = [0, 1, 2, 3].map(i => { const x0 = 128 + i * 40, x1 = x0 + 20, m = x => 138 + (x - 120) * 124 / 160; return `<path d="M${x0} 206 L${x1} 206 L${m(x1)} 348 L${m(x0)} 348Z" fill="#ef4b4b"/>`; }).join('');
    const puffs = [[140, 190, 26], [178, 172, 30], [222, 170, 30], [260, 190, 26], [200, 150, 28], [160, 150, 22], [242, 150, 22], [200, 192, 24]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.rg('#fff1c2')}" ${OL}/><circle cx="${x + r * 0.3}" cy="${y + r * 0.25}" r="${r * 0.3}" fill="#f4d48a" opacity=".7"/>`).join('');
    return `${ground(200, 356, 85)}${puffs}<path d="M120 204 L280 204 L262 350 L138 350 Z" fill="${d.rg('#fbf7ef')}" ${OL}/>${stripes}<rect x="110" y="192" width="180" height="24" rx="10" fill="${d.rg('#ef4b4b')}" ${OL}/>
      <path d="M124 262 Q100 270 104 296" stroke="#f0d9b5" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M276 262 Q302 250 300 228" stroke="#f0d9b5" stroke-width="12" stroke-linecap="round" fill="none"/>
      <rect x="160" y="236" width="80" height="80" rx="30" fill="#fff" opacity=".9"/>${eyes(200, 262, 40, 12)}${grin(200, 288, 13)}${blush(200, 284, 62, 7)}`;
  } },
  2: { bg: ['#fff4e2', '#f7c58d'], draw: d => { // Toasty
    return `${ground(200, 358, 90)}<rect x="158" y="330" width="16" height="26" rx="8" fill="#c48244"/><rect x="226" y="330" width="16" height="26" rx="8" fill="#c48244"/><ellipse cx="164" cy="356" rx="18" ry="8" fill="#7a4b2a"/><ellipse cx="236" cy="356" rx="18" ry="8" fill="#7a4b2a"/>
      <path d="M118 332 L118 190 C116 140 140 116 172 122 C186 98 214 98 228 122 C260 116 284 140 282 190 L282 332 Q282 346 266 346 L134 346 Q118 346 118 332Z" fill="${d.rg('#c98a4b')}" ${OL}/>
      <path d="M134 326 L134 194 C132 152 150 136 176 140 C188 120 212 120 224 140 C250 136 268 152 266 194 L266 326 Q266 332 258 332 L142 332 Q134 332 134 326Z" fill="${d.rg('#f6dca7', { hl: 0.4 })}"/>
      <g transform="rotate(-8 200 160)"><rect x="176" y="146" width="48" height="30" rx="7" fill="${d.rg('#ffe46b')}" ${OL}/>${shine(188, 154, 9, 4, 0, 0.7)}</g>
      <path d="M118 262 Q96 252 94 232" stroke="#c98a4b" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M282 262 Q304 274 300 296" stroke="#c98a4b" stroke-width="13" stroke-linecap="round" fill="none"/>
      ${eyes(200, 238, 56, 14)}${grin(200, 274, 17)}${blush(200, 262, 92, 9)}<circle cx="160" cy="300" r="4" fill="#e3b977"/><circle cx="244" cy="306" r="3" fill="#e3b977"/><circle cx="210" cy="316" r="3.5" fill="#e3b977"/>`;
  } },
  3: { bg: ['#e8f4ff', '#9fd0ff'], draw: d => { // Bloobi
    return `${ground(200, 358, 100)}<path d="M200 106 C272 106 304 180 304 252 C304 322 272 352 242 346 C226 362 212 346 200 354 C188 346 174 362 158 346 C128 352 96 322 96 252 C96 180 128 106 200 106Z" fill="${d.rg('#3f9bff')}" ${OL}/>
      <circle cx="252" cy="300" r="12" fill="#bfe1ff" opacity=".5"/><circle cx="148" cy="306" r="8" fill="#bfe1ff" opacity=".5"/><circle cx="270" cy="250" r="6" fill="#bfe1ff" opacity=".5"/>
      ${shine(156, 158, 26, 12, -35, 0.65)}${shine(178, 136, 7, 4, -35, 0.8)}${eyes(200, 228, 66, 19)}${grin(200, 280, 22)}${blush(200, 268, 118, 10)}
      <path d="M200 106 Q196 84 210 74" stroke="#3f9bff" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  } },
  4: { bg: ['#ecffe8', '#b6e7a8'], draw: d => { // Shelly the turtle in sneakers
    const shoe = (x, y) => `<path d="M${x - 24} ${y} Q${x - 26} ${y - 22} ${x - 4} ${y - 22} L${x + 8} ${y - 22} Q${x + 30} ${y - 16} ${x + 30} ${y} Z" fill="${d.rg('#ff4f5e')}" ${OL}/><rect x="${x - 26}" y="${y - 6}" width="58" height="9" rx="4" fill="#fff"/><path d="M${x - 8} ${y - 18} l12 0 M${x - 8} ${y - 12} l12 0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
    const hex = [[190, 200], [240, 200], [165, 240], [215, 240], [265, 240], [190, 270], [240, 270]].map(([x, y]) => `<path d="M${x - 18} ${y} L${x - 9} ${y - 15} L${x + 9} ${y - 15} L${x + 18} ${y} L${x + 9} ${y + 15} L${x - 9} ${y + 15}Z" fill="#7fd27c" opacity=".55" stroke="#2f8f45" stroke-width="2.5" stroke-opacity=".5"/>`).join('');
    return `${ground(215, 360, 110)}<rect x="138" y="290" width="26" height="54" rx="12" fill="${d.rg('#8fdc7b')}"/><rect x="262" y="290" width="26" height="54" rx="12" fill="${d.rg('#8fdc7b')}"/>${shoe(152, 352)}${shoe(276, 352)}
      <path d="M314 290 Q340 296 342 312 Q324 310 308 304Z" fill="#8fdc7b"/>
      <path d="M118 296 Q118 166 220 162 Q326 166 326 296 Z" fill="${d.rg('#45b25c')}" ${OL}/>${hex}<rect x="110" y="284" width="226" height="22" rx="11" fill="${d.rg('#efcd78')}" ${OL}/>
      <path d="M128 262 Q96 268 86 236 Q80 196 108 186" fill="none" stroke="#8fdc7b" stroke-width="24" stroke-linecap="round"/>
      <circle cx="102" cy="196" r="48" fill="${d.rg('#9be37f')}" ${OL}/>${eyes(98, 190, 36, 11)}${smile(98, 214, 11)}${blush(98, 208, 60, 6)}`;
  } },
  5: { bg: ['#eef5ff', '#b9cdf5'], draw: d => { // Anani the cloud bear
    const drops = [[140, 330], [180, 348], [222, 334], [262, 350], [200, 372]].map(([x, y]) => `<path d="${drop(x, y, 0.9)}" fill="${d.rg('#6fbaff')}"/>`).join('');
    const cloud = [[150, 222, 58], [212, 190, 72], [268, 228, 56], [205, 250, 74], [128, 250, 36], [290, 256, 34]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
    return `${drops}<g fill="${d.rg('#f4f8ff', { dk: -0.12 })}" ${OL}>${[[152, 146], [262, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26"/>`).join('')}</g><circle cx="152" cy="146" r="13" fill="#ffc6d6"/><circle cx="262" cy="140" r="13" fill="#ffc6d6"/>
      <g fill="${d.rg('#f9fbff', { dk: -0.12 })}">${cloud}</g><g fill="none" ${OL}>${cloud}</g><g fill="${d.rg('#f9fbff', { dk: -0.1 })}">${cloud}</g>
      ${eyes(208, 222, 62, 13)}<ellipse cx="208" cy="248" rx="12" ry="8" fill="${INK}"/>${smile(208, 262, 12)}${blush(208, 250, 104, 9)}`;
  } },
  6: { bg: ['#eaf6ff', '#a8d4f2'], draw: d => { // Karchi the penguin with a scarf
    return `${ground(200, 360, 90)}<ellipse cx="172" cy="352" rx="24" ry="10" fill="${d.rg('#ff9a3c')}"/><ellipse cx="228" cy="352" rx="24" ry="10" fill="${d.rg('#ff9a3c')}"/>
      <ellipse cx="200" cy="244" rx="88" ry="112" fill="${d.rg('#2f3f6b')}" ${OL}/><path d="M116 236 Q90 270 104 300 Q120 280 126 254Z" fill="#26345a"/><path d="M284 236 Q312 262 300 296 Q282 278 274 254Z" fill="#26345a"/>
      <ellipse cx="200" cy="270" rx="60" ry="80" fill="${d.rg('#ffffff', { dk: -0.08 })}"/><circle cx="180" cy="196" r="30" fill="#fff"/><circle cx="220" cy="196" r="30" fill="#fff"/>
      ${eyes(200, 196, 44, 12)}<path d="M186 220 Q200 214 214 220 Q200 240 186 220Z" fill="${d.rg('#ffa53c')}"/>${blush(200, 222, 76, 7)}
      <path d="M128 244 Q200 272 272 244 L272 268 Q200 296 128 268Z" fill="${d.rg('#e94357')}" ${OL}/><path d="M236 266 L250 330 L226 334 L220 272Z" fill="${d.rg('#e94357')}" ${OL}/>
      <path d="M150 256 l0 16 M180 264 l0 16 M210 266 l0 16 M240 262 l0 16" stroke="#fff" stroke-width="5" opacity=".8"/><path d="M228 318 l20 -3" stroke="#fff" stroke-width="5"/>`;
  } },
  7: { bg: ['#eefaff', '#a9dbe8'], draw: d => { // Beep the little robot
    return `${ground(200, 362, 86)}<line x1="200" y1="96" x2="200" y2="132" stroke="#8597a8" stroke-width="6"/><circle cx="200" cy="92" r="13" fill="${d.rg('#ffd84d')}"/><circle cx="200" cy="92" r="22" fill="#ffd84d" opacity=".25"/>
      <rect x="176" y="324" width="18" height="30" rx="6" fill="#7f93a6"/><rect x="206" y="324" width="18" height="30" rx="6" fill="#7f93a6"/><rect x="164" y="346" width="36" height="14" rx="7" fill="${d.rg('#58697c')}"/><rect x="200" y="346" width="36" height="14" rx="7" fill="${d.rg('#58697c')}"/>
      <path d="M150 268 Q118 278 116 306" stroke="#9db1c4" stroke-width="12" stroke-linecap="round" fill="none"/><circle cx="116" cy="312" r="10" fill="#7f93a6"/><path d="M250 268 Q280 256 288 230" stroke="#9db1c4" stroke-width="12" stroke-linecap="round" fill="none"/><circle cx="290" cy="224" r="10" fill="#7f93a6"/>
      <rect x="146" y="238" width="108" height="94" rx="20" fill="${d.rg('#88a2bb')}" ${OL}/><rect x="166" y="256" width="68" height="44" rx="10" fill="#e8f1f8" opacity=".85"/><circle cx="184" cy="278" r="8" fill="#ff5d6c"/><circle cx="204" cy="278" r="8" fill="#ffd84d"/><circle cx="224" cy="278" r="8" fill="#4fd38b"/>
      <rect x="186" y="226" width="28" height="16" fill="#7f93a6"/><rect x="132" y="128" width="136" height="104" rx="24" fill="${d.rg('#a8bed3')}" ${OL}/><circle cx="128" cy="180" r="12" fill="${d.rg('#ffd84d')}"/><circle cx="272" cy="180" r="12" fill="${d.rg('#ffd84d')}"/>
      <rect x="150" y="146" width="100" height="68" rx="16" fill="#1d2b3d"/><rect x="170" y="164" width="16" height="22" rx="4" fill="#5ff0ff"/><rect x="214" y="164" width="16" height="22" rx="4" fill="#5ff0ff"/><path d="M182 198 L190 204 L210 204 L218 198" stroke="#5ff0ff" stroke-width="4" fill="none" stroke-linecap="round"/>${shine(160, 140, 14, 5, -10, 0.6)}`;
  } },
  8: { bg: ['#f2ffe9', '#bfeaa8'], draw: d => { // Zizi the three-eyed alien
    return `${ground(200, 358, 95)}<path d="M160 128 Q140 90 120 82" stroke="#5fc456" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="118" cy="80" r="12" fill="${d.rg('#ff7ad1')}"/><path d="M240 128 Q262 92 282 84" stroke="#5fc456" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="284" cy="82" r="12" fill="${d.rg('#ff7ad1')}"/>
      <path d="M128 262 Q96 240 92 212" stroke="#6bd660" stroke-width="16" stroke-linecap="round" fill="none"/><path d="M272 262 Q306 270 312 300" stroke="#6bd660" stroke-width="16" stroke-linecap="round" fill="none"/>
      <path d="M200 118 C272 118 292 190 288 252 C284 322 252 350 200 350 C148 350 116 322 112 252 C108 190 128 118 200 118Z" fill="${d.rg('#74e06a')}" ${OL}/>
      <circle cx="146" cy="300" r="10" fill="#a8f29c" opacity=".7"/><circle cx="262" cy="292" r="13" fill="#a8f29c" opacity=".7"/><circle cx="244" cy="326" r="7" fill="#a8f29c" opacity=".7"/>
      ${eye(156, 214, 15)}${eye(200, 192, 19)}${eye(244, 214, 15)}${grin(200, 262, 18)}${blush(200, 252, 112, 8)}${shine(160, 150, 18, 8, -30, 0.45)}`;
  } },
  9: { bg: ['#fff3ef', '#f4c4b5'], draw: d => { // Momo the polite mushroom
    const dots = [[150, 178, 16], [210, 150, 20], [262, 190, 15], [180, 214, 10], [238, 222, 9], [120, 222, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.rg('#ffffff', { dk: -0.08 })}"/>`).join('');
    return `${ground(200, 358, 80)}<path d="M150 356 Q160 326 176 352 M240 352 Q252 326 262 356" stroke="#5cb85c" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M158 246 Q146 340 174 352 L226 352 Q254 340 242 246Z" fill="${d.rg('#f7ead3')}" ${OL}/>
      <path d="M92 248 Q96 116 200 112 Q304 116 308 248 Q200 276 92 248Z" fill="${d.rg('#ff5a5f')}" ${OL}/>${dots}
      <path d="M186 266 L200 274 L214 266 L214 282 L200 274 L186 282Z" fill="#8a63d2"/>${eyes(200, 300, 38, 10)}${smile(200, 324, 10)}${blush(200, 318, 62, 6)}`;
  } },
  10: { bg: ['#fff0f6', '#ffc6dd'], draw: d => { // Gelidoni
    const cone = d.clip('<path d="M150 230 L250 230 L205 360 Q200 368 195 360Z"/>');
    const sprinkles = [[160, 160, 20, '#4fc3f7'], [236, 150, -30, '#ffd54f'], [180, 132, 60, '#81c784'], [250, 196, 10, '#ba68c8'], [150, 206, -50, '#ff8a65'], [222, 128, 40, '#ffffff']].map(([x, y, r, c]) => `<rect x="${x}" y="${y}" width="16" height="5" rx="2.5" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('');
    return `${ground(200, 364, 50)}<path d="M150 230 L250 230 L205 360 Q200 368 195 360Z" fill="${d.rg('#e3a75d')}" ${OL}/><g clip-path="${cone}" stroke="#b97a35" stroke-width="3" opacity=".7">${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${120 + i * 30}" y1="220" x2="${200 + i * 30}" y2="380"/><line x1="${280 - i * 30}" y1="220" x2="${200 - i * 30}" y2="380"/>`).join('')}</g>
      <path d="M134 236 C118 180 158 118 200 118 C242 118 282 180 266 236 C256 252 242 238 232 252 C222 240 210 256 200 246 C190 256 178 240 168 252 C158 238 144 252 134 236Z" fill="${d.rg('#ff9ec4')}" ${OL}/>${sprinkles}
      <path d="M206 112 Q214 92 230 88" stroke="#5a8f3b" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="204" cy="114" r="14" fill="${d.rg('#e8263f')}"/>${shine(199, 109, 4, 3, 0, 0.8)}
      ${eyes(200, 182, 50, 12)}${grin(200, 210, 14)}${blush(200, 202, 84, 8)}`;
  } },
  11: { bg: ['#fffbe6', '#ffe08a'], draw: d => { // Turbo Snail
    return `<g stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".85"><line x1="300" y1="200" x2="360" y2="200"/><line x1="312" y1="236" x2="372" y2="236"/><line x1="300" y1="272" x2="350" y2="272"/></g>${ground(210, 352, 120)}
      <path d="M86 336 Q96 296 150 304 L300 304 Q332 304 332 332 Q332 348 304 348 L106 348 Q82 348 86 336Z" fill="${d.rg('#f7d36f')}" ${OL}/>
      <path d="M108 322 Q92 242 134 226 Q172 226 166 304Z" fill="${d.rg('#f7d36f')}" ${OL}/>
      <path d="M118 232 Q106 196 104 176" stroke="#e8be52" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M148 230 Q156 196 166 178" stroke="#e8be52" stroke-width="7" fill="none" stroke-linecap="round"/>${eye(104, 172, 11)}${eye(168, 174, 11)}
      <path d="M110 238 Q136 206 166 236 L166 246 L110 246Z" fill="${d.rg('#ff4f4f')}" ${OL}/><rect x="132" y="214" width="8" height="32" fill="#fff" opacity=".9"/>${smile(138, 276, 10)}
      <circle cx="244" cy="244" r="74" fill="${d.rg('#c56be0')}" ${OL}/><path d="M244 244 m-8 0 a8 8 0 1 1 16 0 a20 20 0 1 1 -36 4 a34 34 0 1 1 64 -6 a50 50 0 1 1 -88 10" fill="none" stroke="#f3c6ff" stroke-width="6" stroke-linecap="round"/>${shine(214, 196, 18, 8, -30, 0.5)}`;
  } },
  12: { bg: ['#fff7ea', '#f6d3a7'], draw: d => { // Cactusi
    const flower = [0, 72, 144, 216, 288].map(a => `<ellipse cx="200" cy="104" rx="12" ry="20" fill="${d.rg('#ff7eb3')}" transform="rotate(${a} 200 120)"/>`).join('');
    return `${ground(200, 362, 80)}<path d="M160 160 L160 296 L240 296 L240 160 Q240 118 200 118 Q160 118 160 160Z" fill="${d.rg('#4cbf6b')}" ${OL}/>
      <path d="M160 226 L136 226 Q118 226 118 208 L118 176 Q118 158 132 158 Q146 158 146 176 L146 204 L160 204" fill="${d.rg('#4cbf6b')}" ${OL}/><path d="M240 196 L264 196 Q282 196 282 178 L282 150 Q282 132 268 132 Q254 132 254 150 L254 174 L240 174" fill="${d.rg('#4cbf6b')}" ${OL}/>
      <g stroke="#3a9b54" stroke-width="3" opacity=".6"><line x1="178" y1="132" x2="178" y2="292"/><line x1="222" y1="132" x2="222" y2="292"/></g><g stroke="#e8ffe9" stroke-width="2.5" stroke-linecap="round">${[[150, 180], [250, 160], [170, 250], [232, 262], [128, 186], [272, 150]].map(([x, y]) => `<path d="M${x} ${y} l-6 -4 M${x} ${y} l6 -4"/>`).join('')}</g>
      ${flower}<circle cx="200" cy="120" r="10" fill="${d.rg('#ffd84d')}"/>
      <path d="M134 296 L266 296 L250 362 L150 362Z" fill="${d.rg('#d9774b')}" ${OL}/><rect x="126" y="284" width="148" height="24" rx="9" fill="${d.rg('#e88a5e')}" ${OL}/>
      ${eyes(200, 198, 40, 11)}${smile(200, 228, 12)}${blush(200, 220, 62, 6)}`;
  } },
  13: { bg: ['#fff4e0', '#ffc98a'], draw: d => { // Pizzi
    const pep = [[160, 196, 17], [240, 200, 16], [204, 296, 13], [186, 246, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.rg('#e2493b')}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.2}" r="2.5" fill="#b8322a"/><circle cx="${x + r * 0.3}" cy="${y + r * 0.3}" r="2" fill="#b8322a"/>`).join('');
    return `${ground(200, 366, 50)}<path d="M112 156 Q200 126 288 156 L206 356 Q200 368 194 356Z" fill="${d.rg('#ffcf4d')}" ${OL}/>
      <path d="M236 230 Q240 262 232 270 Q224 262 228 236Z" fill="#ffcf4d"/>${pep}
      <path d="M104 152 Q200 112 296 152 Q302 176 286 178 Q200 146 114 178 Q98 176 104 152Z" fill="${d.rg('#d9934a')}" ${OL}/><circle cx="150" cy="150" r="3" fill="#b06f32"/><circle cx="250" cy="152" r="3" fill="#b06f32"/>
      <path d="M128 200 Q104 220 108 244" stroke="#e7b450" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M270 200 Q296 196 304 174" stroke="#e7b450" stroke-width="10" stroke-linecap="round" fill="none"/>
      ${eyes(200, 214, 44, 12)}${grin(200, 240, 13)}${blush(200, 232, 72, 6)}`;
  } },
  14: { bg: ['#f0fbff', '#bfe3ef'], draw: d => { // Lully the llama in a woolly hat
    const fluff = [[160, 280, 40], [210, 268, 46], [262, 282, 40], [292, 300, 26], [212, 306, 44], [150, 306, 30]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
    return `${ground(215, 362, 105)}${[150, 186, 238, 276].map(x => `<rect x="${x}" y="300" width="20" height="56" rx="9" fill="${d.rg('#f3e8d6')}"/><rect x="${x}" y="344" width="20" height="14" rx="5" fill="#6d5644"/>`).join('')}
      <g fill="${d.rg('#fbf4e8', { dk: -0.14 })}" ${OL}>${fluff}</g><g fill="${d.rg('#fbf4e8', { dk: -0.1 })}">${fluff}</g>
      <path d="M140 284 Q130 210 146 162 L194 162 Q186 222 196 276Z" fill="${d.rg('#fbf4e8', { dk: -0.12 })}" ${OL}/>
      <ellipse cx="146" cy="96" rx="10" ry="26" fill="${d.rg('#f3e8d6')}" transform="rotate(-18 146 96)" ${OL}/><ellipse cx="196" cy="94" rx="10" ry="26" fill="${d.rg('#f3e8d6')}" transform="rotate(16 196 94)" ${OL}/>
      <ellipse cx="170" cy="150" rx="46" ry="40" fill="${d.rg('#fbf4e8', { dk: -0.12 })}" ${OL}/>
      <path d="M128 132 Q132 92 170 90 Q210 92 214 132 Q170 120 128 132Z" fill="${d.rg('#26b5a8')}" ${OL}/><path d="M134 118 Q170 108 208 118" stroke="#fff" stroke-width="5" fill="none"/><circle cx="172" cy="84" r="13" fill="${d.rg('#ff7a8e')}"/>
      ${eyes(170, 148, 32, 9)}<ellipse cx="166" cy="176" rx="22" ry="14" fill="#f3e0c8"/><path d="M160 172 l4 4 l4 -4" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>${smile(166, 182, 7)}${blush(170, 166, 58, 6)}`;
  } },
  15: { bg: ['#f5efff', '#cfb8f5'], draw: d => { // Okta the librarian octopus
    const ten = [['M140 250 Q100 290 120 330 Q132 350 112 360'], ['M168 262 Q150 312 172 342'], ['M200 266 Q204 316 190 352'], ['M232 262 Q252 310 236 344'], ['M262 250 Q300 284 290 326']].map(([p]) => `<path d="${p}" stroke="#9a62e8" stroke-width="24" fill="none" stroke-linecap="round"/><path d="${p}" stroke="#c9a6ff" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="2 14" opacity=".9"/>`).join('');
    return `${ground(200, 362, 100)}${ten}<path d="M262 250 Q300 230 318 206" stroke="#9a62e8" stroke-width="22" fill="none" stroke-linecap="round"/>
      <g transform="rotate(-8 318 196)"><rect x="286" y="160" width="62" height="16" rx="3" fill="${d.rg('#ff6b6b')}"/><rect x="290" y="176" width="58" height="16" rx="3" fill="${d.rg('#4fc3f7')}"/><rect x="284" y="192" width="64" height="16" rx="3" fill="${d.rg('#ffd54f')}"/><path d="M290 168 h50 M294 184 h48 M288 200 h54" stroke="#fff" stroke-width="2" opacity=".7"/></g>
      <path d="M118 220 Q118 106 200 106 Q282 106 282 220 Q282 262 200 266 Q118 262 118 220Z" fill="${d.rg('#a46bf0')}" ${OL}/><circle cx="160" cy="146" r="9" fill="#c9a6ff" opacity=".7"/><circle cx="246" cy="136" r="12" fill="#c9a6ff" opacity=".7"/>
      ${eyes(200, 206, 58, 14)}<g fill="none" stroke="#4a3570" stroke-width="5"><circle cx="171" cy="206" r="23"/><circle cx="229" cy="206" r="23"/><path d="M194 204 Q200 198 206 204"/></g>${smile(200, 240, 12)}${blush(200, 234, 100, 8)}${shine(160, 128, 20, 9, -30, 0.45)}`;
  } },
  16: { bg: ['#f6fff0', '#cdeec0'], draw: d => { // Nansi the strong ant
    return `<path d="M88 124 Q200 36 324 108 Q210 174 88 124Z" fill="${d.rg('#5cc85a')}" ${OL}/><path d="M100 122 Q210 102 312 110" stroke="#3f9e3d" stroke-width="4" fill="none"/>${[130, 170, 210, 250, 290].map((x, i) => `<path d="M${x} ${118 - (i === 2 ? 4 : 0)} l18 ${i % 2 ? -16 : 16}" stroke="#3f9e3d" stroke-width="3"/>`).join('')}
      ${ground(215, 356, 100)}<g stroke="#8d3b28" stroke-width="7" stroke-linecap="round" fill="none"><path d="M182 300 L160 346"/><path d="M198 304 L196 352"/><path d="M220 300 L236 348"/><path d="M250 310 L272 350"/><path d="M270 306 L304 340"/><path d="M178 286 L170 250 L150 130"/><path d="M206 284 L222 240 L232 126"/></g>
      <ellipse cx="268" cy="296" rx="56" ry="42" fill="${d.rg('#c4553b')}" ${OL}/><path d="M244 266 Q250 296 244 326 M270 256 Q278 296 270 336" stroke="#a53f2a" stroke-width="4" fill="none" opacity=".6"/>
      <ellipse cx="200" cy="292" rx="30" ry="26" fill="${d.rg('#c4553b')}" ${OL}/><path d="M138 214 Q124 180 106 172 M160 210 Q164 176 182 164" stroke="#8d3b28" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="106" cy="170" r="7" fill="#8d3b28"/><circle cx="184" cy="162" r="7" fill="#8d3b28"/>
      <circle cx="150" cy="248" r="44" fill="${d.rg('#d4614a')}" ${OL}/>${eyes(150, 244, 34, 11)}<path d="M138 272 Q150 280 162 272" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>${blush(150, 264, 64, 6)}${shine(132, 220, 12, 6, -30, 0.5)}`;
  } },
  17: { bg: ['#fffbe3', '#ffe48a'], draw: d => { // Tziftzufi the chick in an eggshell hat
    return `${ground(200, 360, 90)}<path d="M176 340 l-12 20 M176 340 l0 22 M176 340 l12 20 M224 340 l-12 20 M224 340 l0 22 M224 340 l12 20" stroke="#ff9a2e" stroke-width="6" stroke-linecap="round"/>
      <circle cx="200" cy="248" r="98" fill="${d.rg('#ffd84a')}" ${OL}/><path d="M104 254 Q84 236 92 214 Q112 230 112 250Z" fill="#ffc72e"/><path d="M296 254 Q316 236 308 214 Q288 230 288 250Z" fill="#ffc72e"/>
      <path d="M116 192 Q124 106 200 100 Q276 106 284 192 L264 172 L246 194 L226 170 L206 194 L186 170 L166 194 L146 172 Z" fill="${d.rg('#fffaf0', { dk: -0.12 })}" ${OL}/><circle cx="164" cy="140" r="7" fill="#f0e6d0"/><circle cx="234" cy="128" r="5" fill="#f0e6d0"/>
      ${eyes(200, 230, 62, 14)}<path d="M186 254 L200 244 L214 254 L200 266Z" fill="${d.rg('#ff9a2e')}"/>${blush(200, 260, 110, 10)}${shine(150, 300, 16, 8, 30, 0.35)}`;
  } },
  18: { bg: ['#ecfbff', '#a7e3f7'], draw: d => { // Cubiko the gaming cube
    return `${ground(200, 360, 90)}<rect x="146" y="318" width="24" height="34" fill="#2b6cb0"/><rect x="230" y="318" width="24" height="34" fill="#2b6cb0"/><rect x="138" y="346" width="40" height="12" fill="#1e4e85"/><rect x="222" y="346" width="40" height="12" fill="#1e4e85"/>
      <path d="M110 230 L84 252 L94 262 L120 244Z" fill="#2b6cb0"/><path d="M290 218 L314 168 L328 174 L304 226Z" fill="#2b6cb0"/>
      <polygon points="200,118 292,164 200,210 108,164" fill="${d.rg('#8ee6ff', { cy: 40 })}" ${OL}/><polygon points="108,164 200,210 200,324 108,278" fill="${d.lg(['#4cb6ef', '#2e86c8'])}" ${OL}/><polygon points="200,210 292,164 292,278 200,324" fill="${d.lg(['#3aa0dd', '#226ea8'])}" ${OL}/>
      <g transform="matrix(1 0.5 0 1 0 -77)"><ellipse cx="136" cy="290" rx="11" ry="13" fill="#fff"/><circle cx="138" cy="292" r="7" fill="${INK}"/><ellipse cx="176" cy="290" rx="11" ry="13" fill="#fff"/><circle cx="178" cy="292" r="7" fill="${INK}"/><path d="M140 318 Q156 330 172 318" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/></g>
      <circle cx="320" cy="152" r="26" fill="${d.rg('#ffcc33')}" ${OL}/><path d="${star5(320, 153, 14, 6)}" fill="#fff4b0"/>${sparkle(352, 120, 10)}${sparkle(296, 112, 6)}`;
  } },
  19: { bg: ['#f3fff6', '#bfe8cc'], draw: d => { // Sushi Sami
    return `${ground(200, 358, 100)}<path d="M118 206 L118 318 Q200 362 282 318 L282 206Z" fill="${d.rg('#2d4a3a', { hl: 0.25 })}" ${OL}/><path d="M130 222 L130 300" stroke="#4a7a5f" stroke-width="5" opacity=".6"/>
      <ellipse cx="200" cy="206" rx="82" ry="38" fill="${d.rg('#2d4a3a', { hl: 0.2 })}" ${OL}/><ellipse cx="200" cy="206" rx="70" ry="30" fill="${d.rg('#ffffff', { dk: -0.1 })}"/>
      ${[[166, 200], [176, 218], [232, 196], [226, 220], [196, 186], [210, 224], [150, 212], [248, 210]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" fill="#eef0ea"/>`).join('')}
      <ellipse cx="200" cy="206" rx="28" ry="13" fill="${d.rg('#ff8a5b')}"/><path d="M184 204 Q200 198 216 206" stroke="#ffd0b8" stroke-width="3" fill="none"/><circle cx="222" cy="212" r="5" fill="#7bc96f"/><circle cx="178" cy="210" r="4" fill="#7bc96f"/>
      <rect x="160" y="236" width="80" height="70" rx="22" fill="#3d6250" opacity=".55"/>${eyes(200, 262, 46, 12)}${smile(200, 288, 11)}${blush(200, 282, 72, 7)}
      <path d="M118 270 Q96 280 98 304" stroke="#2d4a3a" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M282 270 Q306 262 310 240" stroke="#2d4a3a" stroke-width="11" stroke-linecap="round" fill="none"/>`;
  } },
  20: { bg: ['#2a2d6e', '#151744'], dark: true, draw: d => { // Yarchi the sleepy moon
    return `${[[70, 90, 8], [330, 70, 10], [320, 300, 7], [86, 300, 6], [290, 160, 5]].map(([x, y, r]) => sparkle(x, y, r, '#fff6c2')).join('')}
      <rect x="110" y="300" width="200" height="56" rx="28" fill="${d.rg('#b8a6ff')}" ${OL}/><path d="M140 312 Q210 300 286 316" stroke="#d6cbff" stroke-width="6" fill="none" opacity=".7"/>
      <path d="M232 92 A124 124 0 1 0 306 310 A98 98 0 1 1 232 92Z" fill="${d.rg('#ffe68a')}" ${OL}/><circle cx="148" cy="186" r="10" fill="#f5d36a" opacity=".6"/><circle cx="168" cy="270" r="13" fill="#f5d36a" opacity=".6"/>
      <path d="M190 104 Q240 52 300 64 Q270 96 262 128Z" fill="${d.rg('#4c5bd4')}" ${OL}/><circle cx="304" cy="62" r="14" fill="${d.rg('#ffffff', { dk: -0.12 })}"/>
      ${sleepyEyes(196, 196, 38, 10)}${smile(200, 232, 10)}${blush(196, 214, 60, 7)}<text x="276" y="196" font-family="Arial, sans-serif" font-weight="800" font-size="30" fill="#fff6c2">Z</text><text x="306" y="166" font-family="Arial, sans-serif" font-weight="800" font-size="22" fill="#fff6c2" opacity=".8">z</text>`;
  } },
  // ---------- uncommon ----------
  21: { bg: ['#fff3e6', '#f9c08e'], draw: d => { // Scout Fox
    return `${ground(200, 360, 100)}<path d="M246 300 Q330 300 330 220 Q330 180 300 172 Q318 232 260 268Z" fill="${d.rg('#ff8a3d')}" ${OL}/><path d="M300 172 Q330 180 330 220 Q314 206 300 200Z" fill="#fff"/>
      <rect x="168" y="318" width="22" height="36" rx="10" fill="#e8742a"/><rect x="212" y="318" width="22" height="36" rx="10" fill="#e8742a"/><ellipse cx="178" cy="354" rx="16" ry="7" fill="#5a3a26"/><ellipse cx="224" cy="354" rx="16" ry="7" fill="#5a3a26"/>
      <ellipse cx="200" cy="286" rx="62" ry="54" fill="${d.rg('#ff8a3d')}" ${OL}/><ellipse cx="200" cy="296" rx="34" ry="38" fill="#fff6ec"/>
      <path d="M176 252 Q200 292 224 252" stroke="#5a3a26" stroke-width="4" fill="none"/><rect x="168" y="270" width="26" height="30" rx="10" fill="${d.rg('#3b4a5a')}"/><rect x="206" y="270" width="26" height="30" rx="10" fill="${d.rg('#3b4a5a')}"/><circle cx="181" cy="296" r="8" fill="#9fd3ff"/><circle cx="219" cy="296" r="8" fill="#9fd3ff"/>
      <g transform="rotate(-14 112 300)"><rect x="86" y="276" width="56" height="44" rx="4" fill="${d.rg('#f6e3b4')}" ${OL}/><path d="M94 306 Q108 286 120 300 T138 288" stroke="#e2493b" stroke-width="3" fill="none" stroke-dasharray="4 4"/><circle cx="136" cy="290" r="4" fill="#e2493b"/></g>
      <path d="M134 168 L120 100 L172 140Z" fill="${d.rg('#ff8a3d')}" ${OL}/><path d="M266 168 L280 100 L228 140Z" fill="${d.rg('#ff8a3d')}" ${OL}/><path d="M140 154 L130 116 L160 140Z" fill="#5a3a26"/><path d="M260 154 L270 116 L240 140Z" fill="#5a3a26"/>
      <path d="M128 192 Q138 132 200 132 Q262 132 272 192 Q262 244 200 248 Q138 244 128 192Z" fill="${d.rg('#ff8a3d')}" ${OL}/><path d="M132 204 Q160 214 182 236 Q200 246 218 236 Q240 214 268 204 Q262 246 200 250 Q138 246 132 204Z" fill="#fff6ec"/>
      <ellipse cx="200" cy="128" rx="84" ry="14" fill="${d.rg('#c9a26b')}" ${OL}/><path d="M146 126 Q150 86 200 84 Q250 86 254 126Z" fill="${d.rg('#d8b47a')}" ${OL}/><rect x="148" y="112" width="104" height="12" fill="#8a5a3c"/>
      ${eyes(200, 188, 54, 12)}<ellipse cx="200" cy="216" rx="10" ry="7" fill="${INK}"/>${smile(200, 226, 9)}${blush(200, 214, 92, 7)}`;
  } },
  22: { bg: ['#fffbe6', '#ffe28f'], draw: d => { // Zumzuma the pilot bee
    const body = d.clip('<ellipse cx="220" cy="252" rx="96" ry="74"/>');
    return `<g opacity=".8"><ellipse cx="236" cy="150" rx="40" ry="70" fill="${d.lg([['0', '#ffffff', 0.9], ['1', '#bfe9ff', 0.6]])}" transform="rotate(-24 236 150)" ${OL}/><ellipse cx="282" cy="166" rx="30" ry="56" fill="${d.lg([['0', '#ffffff', 0.9], ['1', '#bfe9ff', 0.6]])}" transform="rotate(16 282 166)" ${OL}/></g>
      ${ground(215, 360, 100)}<path d="M312 256 Q338 258 340 270 Q326 278 310 272Z" fill="#3b2b20"/><ellipse cx="220" cy="252" rx="96" ry="74" fill="${d.rg('#ffd23f')}" ${OL}/>
      <g clip-path="${body}" fill="#3b2b20"><rect x="200" y="160" width="28" height="200" transform="rotate(10 214 260)"/><rect x="250" y="160" width="26" height="200" transform="rotate(10 263 260)"/><rect x="296" y="160" width="24" height="200" transform="rotate(10 308 260)"/></g>${shine(196, 206, 26, 10, -20, 0.45)}
      <path d="M190 316 l-8 30 M236 322 l2 30" stroke="#3b2b20" stroke-width="7" stroke-linecap="round"/>
      <path d="M118 182 Q104 140 90 132 M150 176 Q160 138 176 128" stroke="#3b2b20" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="88" cy="130" r="7" fill="#3b2b20"/><circle cx="178" cy="126" r="7" fill="#3b2b20"/>
      <path d="M96 260 Q60 270 40 250 Q66 240 92 240Z" fill="#fff" ${OL}/>
      <circle cx="134" cy="226" r="54" fill="${d.rg('#ffd23f')}" ${OL}/><path d="M84 200 Q134 178 184 200" stroke="#8a5a3c" stroke-width="9" fill="none"/>
      <circle cx="114" cy="196" r="15" fill="${d.lg(['#d9f3ff', '#7fc8f8'])}" stroke="#8a5a3c" stroke-width="5"/><circle cx="154" cy="196" r="15" fill="${d.lg(['#d9f3ff', '#7fc8f8'])}" stroke="#8a5a3c" stroke-width="5"/>${shine(110, 191, 5, 3, -30, 0.9)}${shine(150, 191, 5, 3, -30, 0.9)}
      ${eyes(134, 234, 38, 11)}${grin(134, 258, 11)}${blush(134, 252, 70, 7)}`;
  } },
  23: { bg: ['#fff0f6', '#f8bcd6'], draw: d => { // Galgalit the one-wheel robot
    const spokes = [0, 45, 90, 135].map(a => `<line x1="200" y1="300" x2="200" y2="360" stroke="#9aa4b2" stroke-width="4" transform="rotate(${a} 200 330)"/>`).join('');
    return `<g stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".8"><line x1="244" y1="360" x2="296" y2="360"/><line x1="252" y1="344" x2="292" y2="344"/></g>${ground(200, 368, 60)}
      <circle cx="200" cy="330" r="38" fill="${d.rg('#37404d')}" ${OL}/>${spokes}<circle cx="200" cy="330" r="10" fill="${d.rg('#cfd6df')}"/>
      <path d="M178 286 L190 320 M222 286 L210 320" stroke="#9aa4b2" stroke-width="8" stroke-linecap="round"/>
      <path d="M160 200 L66 178" stroke="#ffb3cf" stroke-width="10" stroke-linecap="round"/><circle cx="62" cy="176" r="14" fill="${d.rg('#ffd84d')}"/><path d="M240 200 L334 178" stroke="#ffb3cf" stroke-width="10" stroke-linecap="round"/><circle cx="338" cy="176" r="14" fill="${d.rg('#ffd84d')}"/>
      <rect x="156" y="124" width="88" height="170" rx="44" fill="${d.rg('#ff79a8')}" ${OL}/><rect x="168" y="156" width="64" height="34" rx="17" fill="#1d2433"/><path d="M178 178 Q186 168 194 178 M206 178 Q214 168 222 178" stroke="#61f3ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M200 236 m-12 0 a12 12 0 0 1 12 -10 a12 12 0 0 1 12 10 q0 12 -12 22 q-12 -10 -12 -22Z" fill="#fff" opacity=".9"/><line x1="200" y1="124" x2="200" y2="100" stroke="#9aa4b2" stroke-width="5"/><circle cx="200" cy="96" r="8" fill="${d.rg('#61f3ff')}"/>${shine(176, 150, 8, 18, 0, 0.45)}`;
  } },
  24: { bg: ['#e9fbff', '#9fdbe8'], draw: d => { // Kochavon the starfish conductor
    const notes = [[86, 130, 0.9], [318, 116, 1.1], [300, 220, 0.8]].map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="20" rx="10" ry="7" fill="${INK}" transform="rotate(-20 0 20)"/><path d="M8 18 L8 -14 Q18 -10 22 -2" stroke="${INK}" stroke-width="4" fill="none"/></g>`).join('');
    return `<ellipse cx="200" cy="366" rx="170" ry="30" fill="#f6e2b4" opacity=".9"/>${[[96, 250, 10], [314, 290, 7], [120, 320, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity=".6" stroke="#fff"/>`).join('')}${notes}
      <path d="${star5(200, 236, 132, 62)}" fill="${d.rg('#ff7eb0')}" ${OL} stroke-linejoin="round"/>${[[200, 140], [124, 210], [276, 210], [150, 316], [250, 316], [180, 190], [226, 300]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#ffc2da"/>`).join('')}
      <path d="M296 196 L340 150" stroke="#8a5a3c" stroke-width="5" stroke-linecap="round"/><circle cx="342" cy="148" r="5" fill="#fff"/>${eyes(200, 228, 50, 13)}${grin(200, 258, 14)}${blush(200, 250, 84, 8)}`;
  } },
  25: { bg: ['#1b1e3c', '#0e1028'], dark: true, draw: d => { // Pixel the retro hero (8-bit)
    const P = { k: '#1b1e3c', w: '#ffffff', g: '#48e07a', d: '#2aa857', y: '#ffd84d', p: '#ff6bb0', b: '#3fb8ff', o: '#ff9a3c' };
    const map = ['....kkkkkkkk....', '...kggggggggk...', '..kggwwggwwggk..', '..kgwkwggwkwgk..', '..kgwwwggwwwgk..', '..kggggggggggk..', '..kggpggggpggk..', '...kggkkkkggk...', '....kkggggkk....', '..kkbbbyybbbkk..', '.kgkbbbyybbbkgk.', '.kgkbbbbbbbbkgk.', '..kkbbbbbbbbkk..', '....kbbkkbbk....', '...kooook ooook.', '...kkkkk.kkkkk..'];
    let px = ''; map.forEach((row, y) => [...row].forEach((ch, x) => { if (P[ch] && ch !== ' ') px += `<rect x="${72 + x * 16}" y="${92 + y * 16}" width="16.5" height="16.5" fill="${P[ch]}"/>`; }));
    const heart = (x, y) => `<g fill="#ff5d7a">${[[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]].map(([a, b]) => `<rect x="${x + a * 8}" y="${y + b * 8}" width="8.5" height="8.5"/>`).join('')}</g>`;
    return `<g opacity=".35">${[...Array(10)].map((_, i) => `<rect x="${(i * 41) % 400}" y="${(i * 67) % 400}" width="6" height="6" fill="#7f86ff"/>`).join('')}</g><rect x="60" y="356" width="280" height="14" fill="#48e07a" opacity=".5"/>${px}${heart(36, 70)}${heart(330, 120)}<rect x="330" y="250" width="22" height="22" fill="#ffd84d"/><rect x="336" y="256" width="10" height="10" fill="#fff4b0"/>`;
  } },
  26: { bg: ['#1d2257', '#0d1033'], dark: true, draw: d => { // Donato the donut astronaut
    const helmet = d.clip('<circle cx="200" cy="214" r="118"/>');
    const spr = [[160, 172, 30, '#ffd54f'], [236, 168, -20, '#4fc3f7'], [266, 222, 70, '#ffffff'], [140, 236, -60, '#81c784'], [174, 286, 20, '#ba68c8'], [250, 280, -30, '#ffd54f'], [204, 154, 80, '#ff8a65']].map(([x, y, r, c]) => `<rect x="${x}" y="${y}" width="14" height="5" rx="2.5" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('');
    return `${[[60, 70, 7], [340, 90, 9], [330, 330, 6], [70, 320, 8]].map(([x, y, r]) => sparkle(x, y, r, '#fff')).join('')}<circle cx="336" cy="200" r="22" fill="${d.rg('#ff9a3c')}"/><ellipse cx="336" cy="200" rx="36" ry="8" fill="none" stroke="#ffd2a6" stroke-width="4" transform="rotate(-20 336 200)"/>
      <rect x="150" y="316" width="100" height="40" rx="12" fill="${d.rg('#e6ebf2')}" ${OL}/><circle cx="174" cy="336" r="6" fill="#ff5d6c"/><circle cx="196" cy="336" r="6" fill="#4fd38b"/>
      <circle cx="200" cy="214" r="118" fill="#9fd8ff" opacity=".18"/><g clip-path="${helmet}">
      <circle cx="200" cy="228" r="80" fill="${d.rg('#e0a060')}" ${OL}/><path d="M124 220 Q130 150 200 148 Q270 150 276 220 Q266 236 254 226 Q246 246 232 236 Q218 252 204 240 Q190 254 176 238 Q162 250 150 234 Q136 244 124 220Z" fill="${d.rg('#ff7fb5')}" ${OL}/>${spr}
      <circle cx="200" cy="228" r="22" fill="#141742"/>${eyes(200, 186, 56, 12)}${smile(200, 268, 12)}${blush(200, 196, 98, 7)}</g>
      <circle cx="200" cy="214" r="118" fill="none" stroke="#dff3ff" stroke-width="7" opacity=".9"/><path d="M118 168 Q140 112 196 100" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".55"/><path d="M290 250 Q284 276 268 292" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".4"/>`;
  } },
  27: { bg: ['#f3f9ef', '#c9dfb8'], draw: d => { // Yanshufit the scientist owl
    const scal = [0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<path d="M${168 + c * 22 - (r % 2) * 11} ${262 + r * 22} q11 12 22 0" stroke="#c9a585" stroke-width="3" fill="none"/>`).join('')).join('');
    return `${ground(200, 360, 90)}<path d="M176 342 l-8 16 M184 342 l0 18 M226 342 l8 16 M218 342 l0 18" stroke="#ff9a2e" stroke-width="6" stroke-linecap="round"/>
      <path d="M200 112 C270 112 292 180 290 250 C288 320 252 348 200 348 C148 348 112 320 110 250 C108 180 130 112 200 112Z" fill="${d.rg('#9a6a4b')}" ${OL}/><ellipse cx="200" cy="276" rx="56" ry="64" fill="${d.rg('#f1dcc0')}"/>${scal}
      <path d="M126 140 L120 96 L160 124Z" fill="${d.rg('#7d5238')}"/><path d="M274 140 L280 96 L240 124Z" fill="${d.rg('#7d5238')}"/>
      <circle cx="164" cy="190" r="36" fill="#f5e8d6"/><circle cx="236" cy="190" r="36" fill="#f5e8d6"/>${eyes(200, 190, 72, 18)}<g fill="none" stroke="#3b3b4f" stroke-width="6"><circle cx="164" cy="190" r="34"/><circle cx="236" cy="190" r="34"/><path d="M196 186 Q200 180 204 186"/></g>
      <path d="M190 222 L200 240 L210 222Z" fill="${d.rg('#ff9a2e')}"/>
      <path d="M280 240 Q314 250 318 286" stroke="#8a5a3c" stroke-width="18" stroke-linecap="round" fill="none"/>
      <path d="M306 238 L306 262 L284 302 Q280 312 292 314 L336 314 Q348 312 344 302 L322 262 L322 238Z" fill="#e8f6ff" opacity=".9" ${OL}/><path d="M290 296 L338 296 L344 304 Q346 312 336 312 L292 312 Q282 312 286 304Z" fill="${d.rg('#5cf08f')}"/>
      <circle cx="314" cy="222" r="7" fill="#b8ffd0" stroke="#5cf08f" stroke-width="2"/><circle cx="326" cy="200" r="5" fill="#b8ffd0" stroke="#5cf08f" stroke-width="2"/><circle cx="308" cy="186" r="4" fill="#b8ffd0" stroke="#5cf08f" stroke-width="2"/>`;
  } },
  28: { bg: ['#fff4e8', '#ffd2a4'], draw: d => { // Namri the skateboarding tiger cub
    const stripe = (x, y, r) => `<path d="M${x} ${y} q8 6 0 18" stroke="#3b2b20" stroke-width="6" fill="none" stroke-linecap="round" transform="rotate(${r} ${x} ${y})"/>`;
    return `${ground(200, 366, 120)}<path d="M84 334 Q90 350 110 350 L290 350 Q310 350 316 334" stroke="${d.lg(['#7a4dff', '#ff4f9a'], 0, 0, 1, 0)}" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="130" cy="362" r="11" fill="${d.rg('#ffd84d')}"/><circle cx="270" cy="362" r="11" fill="${d.rg('#ffd84d')}"/>
      <rect x="160" y="290" width="26" height="50" rx="12" fill="${d.rg('#ff9a3c')}"/><rect x="214" y="290" width="26" height="50" rx="12" fill="${d.rg('#ff9a3c')}"/><rect x="158" y="300" width="30" height="16" rx="7" fill="#3fb8ff"/><rect x="212" y="300" width="30" height="16" rx="7" fill="#3fb8ff"/>
      <path d="M150 248 Q110 236 96 210" stroke="#ff9a3c" stroke-width="18" stroke-linecap="round" fill="none"/><path d="M250 248 Q290 238 306 214" stroke="#ff9a3c" stroke-width="18" stroke-linecap="round" fill="none"/>
      <ellipse cx="200" cy="260" rx="60" ry="56" fill="${d.rg('#ff9a3c')}" ${OL}/><ellipse cx="200" cy="272" rx="34" ry="36" fill="#fff4e6"/>${stripe(150, 240, 0)}${stripe(244, 238, 180)}
      <circle cx="146" cy="134" r="22" fill="${d.rg('#ff9a3c')}" ${OL}/><circle cx="254" cy="134" r="22" fill="${d.rg('#ff9a3c')}" ${OL}/><circle cx="146" cy="134" r="10" fill="#ffd3b0"/><circle cx="254" cy="134" r="10" fill="#ffd3b0"/>
      <circle cx="200" cy="176" r="64" fill="${d.rg('#ff9a3c')}" ${OL}/><ellipse cx="200" cy="200" rx="34" ry="24" fill="#fff4e6"/>${stripe(140, 170, -30)}${stripe(258, 170, 210)}
      <path d="M136 156 Q140 104 200 102 Q260 104 264 156 Q200 140 136 156Z" fill="${d.rg('#22c4b0')}" ${OL}/><path d="M176 112 L176 146 M200 104 L200 144 M224 112 L224 146" stroke="#bff6ef" stroke-width="5"/>
      ${eyes(200, 176, 50, 12)}<path d="M192 194 L208 194 L200 202Z" fill="#ff7d8e"/>${smile(200, 208, 9)}${blush(200, 196, 86, 7)}`;
  } },
  29: { bg: ['#0f2a4a', '#081528'], dark: true, draw: d => { // Meduzit the glowing jellyfish
    const ten = [['M140 214 Q124 262 146 296 Q166 330 140 366', '#9ef0ff'], ['M170 222 Q160 276 182 318 Q196 344 180 370', '#c4a6ff'], ['M200 224 Q210 274 196 316 Q186 348 204 372', '#ffb3e6'], ['M230 222 Q248 270 226 310 Q212 340 232 366', '#9ef0ff'], ['M260 214 Q282 256 262 296 Q246 326 268 360', '#c4a6ff']].map(([p, c]) => `<path d="${p}" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".85"/>`).join('');
    return `<circle cx="200" cy="200" r="150" fill="#5fe6ff" opacity=".18" filter="${d.glow(18)}"/>${[[70, 90], [330, 120], [90, 300], [320, 320], [300, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#bdf6ff"/>`).join('')}${ten}
      <path d="M108 212 Q108 106 200 106 Q292 106 292 212 Q272 228 252 212 Q230 230 200 214 Q170 230 148 212 Q128 228 108 212Z" fill="${d.rg('#8ee9ff', { hl: 0.7 })}" opacity=".95" ${OL}/>
      <path d="M136 196 Q140 140 200 132 Q260 140 264 196" stroke="#e6fdff" stroke-width="5" fill="none" opacity=".7"/>${shine(160, 140, 20, 9, -30, 0.6)}
      ${happyEyes(200, 172, 52, 11)}${grin(200, 186, 11)}${blush(200, 184, 92, 8)}`;
  } },
  30: { bg: ['#f3ffe9', '#c4ebab'], draw: d => { // Pirchonit the sunflower fairy
    const petals = [...Array(16)].map((_, i) => `<ellipse cx="200" cy="96" rx="20" ry="46" fill="${d.rg(i % 2 ? '#ffc928' : '#ffd84d')}" transform="rotate(${i * 22.5} 200 196)" ${OL}/>`).join('');
    const seeds = [...Array(26)].map((_, i) => { const a = i * 137.5 * Math.PI / 180, r = 6 * Math.sqrt(i) + 4; return `<circle cx="${(200 + r * Math.cos(a)).toFixed(1)}" cy="${(206 + r * Math.sin(a)).toFixed(1)}" r="3" fill="#5a3a1e" opacity=".55"/>`; }).join('');
    return `<path d="M200 270 Q194 320 204 366" stroke="#4fae46" stroke-width="12" fill="none"/><path d="M200 320 Q156 296 132 312 Q160 338 200 322Z" fill="${d.rg('#5cc85a')}" ${OL}/><path d="M202 340 Q248 318 270 334 Q240 360 202 344Z" fill="${d.rg('#5cc85a')}" ${OL}/>
      <ellipse cx="146" cy="168" rx="26" ry="40" fill="#e9fbff" opacity=".7" transform="rotate(-30 146 168)" ${OL}/><ellipse cx="254" cy="168" rx="26" ry="40" fill="#e9fbff" opacity=".7" transform="rotate(30 254 168)" ${OL}/>
      ${petals}<circle cx="200" cy="196" r="66" fill="${d.rg('#a8703c')}" ${OL}/>${seeds}<path d="M168 150 Q200 120 232 150 Q200 140 168 150Z" fill="${d.rg('#7ed957')}"/>
      ${eyes(200, 192, 46, 12)}${smile(200, 220, 11)}${blush(200, 212, 80, 8)}${sparkle(112, 100, 10, '#fff7b0')}${sparkle(300, 290, 8, '#fff7b0')}${sparkle(310, 110, 6, '#fff7b0')}`;
  } },
  // ---------- rare ----------
  31: { bg: ['#2a1f66', '#120c36'], dark: true, draw: d => { // Cometa the comet cat
    const trail = d.lg([['0', '#ffe066', 0.95], ['.5', '#ff7ad1', 0.6], ['1', '#7a6bff', 0]], 1, 0, 0, 1);
    return `<path d="M246 204 Q160 250 40 372 L74 380 Q170 290 262 232Z" fill="${trail}"/><path d="M254 186 Q150 214 30 300 L48 320 Q160 240 262 210Z" fill="${trail}" opacity=".6"/>
      ${[[120, 300, 9], [80, 340, 7], [170, 262, 8], [60, 286, 5], [150, 330, 5]].map(([x, y, r]) => sparkle(x, y, r, '#fff6c2')).join('')}${[[330, 70, 8], [70, 90, 6], [340, 300, 7]].map(([x, y, r]) => sparkle(x, y, r, '#fff')).join('')}
      <path d="M300 214 Q350 196 344 150 Q334 176 300 186" fill="${d.rg('#b48cff')}" ${OL}/>
      <ellipse cx="258" cy="208" rx="62" ry="38" fill="${d.rg('#b48cff')}" ${OL}/><path d="M212 230 L196 252 M232 238 L226 262 M286 236 L296 258 M304 228 L318 248" stroke="#a07ae8" stroke-width="12" stroke-linecap="round"/>
      <path d="M140 150 L132 100 L172 128Z" fill="${d.rg('#b48cff')}" ${OL}/><path d="M218 136 L236 92 L246 140Z" fill="${d.rg('#b48cff')}" ${OL}/><path d="M146 140 L142 112 L162 128Z" fill="#ffc2e8"/>
      <circle cx="186" cy="176" r="56" fill="${d.rg('#c4a0ff')}" ${OL}/>${eyes(186, 172, 44, 13)}<path d="M180 194 l6 6 l6 -6" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M174 204 q6 8 12 0 q6 8 12 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M150 196 l-26 -4 M150 204 l-26 6 M222 196 l26 -4 M222 204 l26 6" stroke="#fff" stroke-width="2.5" opacity=".8"/>${blush(186, 194, 76, 7)}
      <path d="M156 228 Q186 244 216 228" stroke="#ff4f9a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${star5(186, 246, 12, 5)}" fill="${d.rg('#ffd84d')}"/>`;
  } },
  32: { bg: ['#e7f1ff', '#9cc0ff'], draw: d => { // Turbo-Bot with a jetpack
    const flame = (x) => `<path d="M${x - 16} 300 Q${x} 380 ${x + 16} 300 Z" fill="${d.lg(['#fff7b0', '#ffb347', ['1', '#ff6a3d', 0]])}"/><path d="M${x - 8} 300 Q${x} 344 ${x + 8} 300 Z" fill="#fffbe0"/>`;
    return `${flame(170)}${flame(230)}<rect x="146" y="196" width="44" height="108" rx="20" fill="${d.rg('#7a8aa0')}" ${OL}/><rect x="210" y="196" width="44" height="108" rx="20" fill="${d.rg('#7a8aa0')}" ${OL}/>
      <path d="M144 230 Q96 200 92 150" stroke="#8fa6d6" stroke-width="16" stroke-linecap="round" fill="none"/><circle cx="92" cy="140" r="18" fill="${d.rg('#ffcf4d')}"/><path d="M256 238 Q294 250 306 280" stroke="#8fa6d6" stroke-width="16" stroke-linecap="round" fill="none"/><circle cx="308" cy="288" r="16" fill="${d.rg('#ffcf4d')}"/>
      <rect x="140" y="182" width="120" height="110" rx="48" fill="${d.rg('#f2f7ff')}" ${OL}/><path d="M164 232 Q200 250 236 232 L236 262 Q200 280 164 262Z" fill="#3f7bff" opacity=".85"/><circle cx="200" cy="246" r="9" fill="${d.rg('#61f3ff')}"/>
      <circle cx="200" cy="136" r="62" fill="${d.rg('#f2f7ff')}" ${OL}/><rect x="152" y="112" width="96" height="56" rx="28" fill="#13203a"/><ellipse cx="180" cy="140" rx="9" ry="12" fill="#61f3ff"/><ellipse cx="220" cy="140" rx="9" ry="12" fill="#61f3ff"/><path d="M184 156 Q200 166 216 156" stroke="#61f3ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${shine(170, 96, 18, 7, -20, 0.7)}<path d="M138 120 l-16 -8 M262 120 l16 -8" stroke="#3f7bff" stroke-width="7" stroke-linecap="round"/>`;
  } },
  33: { bg: ['#eef9e6', '#a9d98c'], draw: d => { // Alonit the tree spirit
    const leaves = [[130, 130, 46, '#5cc85a'], [200, 100, 56, '#4fae46'], [270, 128, 46, '#7ed957'], [160, 170, 44, '#ffb347'], [242, 172, 44, '#5cc85a'], [200, 150, 40, '#ffd84d'], [104, 176, 30, '#ff8a5b'], [296, 176, 30, '#4fae46']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.rg(c)}" ${OL}/>`).join('');
    return `${ground(200, 360, 120)}<path d="M150 356 Q120 344 96 356 M250 356 Q284 340 306 356 M180 358 Q170 372 150 376 M222 358 Q236 372 258 376" stroke="#7a4b2e" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M150 360 Q164 270 158 200 L242 200 Q236 270 250 360Z" fill="${d.rg('#8a5a3c')}" ${OL}/><path d="M176 220 Q172 270 182 330 M222 222 Q228 280 218 336" stroke="#6d4329" stroke-width="4" fill="none" opacity=".6"/>
      <path d="M160 236 Q122 226 106 196" stroke="#8a5a3c" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="102" cy="190" r="16" fill="${d.rg('#7ed957')}"/><path d="M240 230 Q282 214 296 186" stroke="#8a5a3c" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="300" cy="180" r="16" fill="${d.rg('#ffb347')}"/>
      ${leaves}${sleepyEyes(200, 250, 44, 11)}${smile(200, 280, 13)}${blush(200, 268, 78, 7)}
      <path d="M148 344 q-6 -22 10 -24 q16 2 10 24Z" fill="${d.rg('#ff5a5f')}"/><rect x="152" y="340" width="10" height="16" fill="#fff3e0"/><path d="M262 346 q-5 -18 8 -20 q13 2 8 20Z" fill="${d.rg('#ffb347')}"/>
      ${[[90, 250], [320, 240], [130, 300], [286, 300]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff7b0"/><circle cx="${x}" cy="${y}" r="12" fill="#fff7b0" opacity=".3"/>`).join('')}`;
  } },
  34: { bg: ['#1c1446', '#0b0826'], dark: true, draw: d => { // Zohara the firefly fairy
    const wing = (rot, rx, ry, cx, cy) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${d.lg([['0', '#d8f6ff', 0.85], ['.5', '#f3c6ff', 0.6], ['1', '#b8fff0', 0.5]], 0, 0, 1, 1)}" transform="rotate(${rot} ${cx} ${cy})" stroke="#ffffff" stroke-opacity=".7" stroke-width="2"/>`;
    return `<circle cx="226" cy="268" r="120" fill="#fff27a" opacity=".22" filter="${d.glow(22)}"/>${[...Array(12)].map((_, i) => { const a = i * 0.9, r = 70 + i * 14; return `<circle cx="${(200 + r * Math.cos(a)).toFixed(0)}" cy="${(220 + r * Math.sin(a) * 0.7).toFixed(0)}" r="${3 + (i % 3)}" fill="#fff6a0" opacity=".85"/>`; }).join('')}
      ${wing(-30, 46, 80, 150, 160)}${wing(30, 46, 80, 262, 156)}${wing(-60, 28, 52, 140, 236)}${wing(60, 28, 52, 270, 232)}
      <ellipse cx="226" cy="276" rx="48" ry="62" fill="${d.rg('#fff27a', { hl: 0.8 })}" ${OL}/><path d="M184 270 Q226 284 268 270 M188 296 Q226 310 264 296" stroke="#ffd23f" stroke-width="5" fill="none"/><ellipse cx="226" cy="276" rx="40" ry="54" fill="#fffbe0" opacity=".35"/>
      <ellipse cx="200" cy="212" rx="30" ry="26" fill="${d.rg('#7d6bff')}" ${OL}/>
      <path d="M178 136 Q166 100 150 92 M222 136 Q236 102 252 94" stroke="#7d6bff" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="148" cy="90" r="9" fill="#fff27a"/><circle cx="254" cy="92" r="9" fill="#fff27a"/><circle cx="148" cy="90" r="18" fill="#fff27a" opacity=".3"/><circle cx="254" cy="92" r="18" fill="#fff27a" opacity=".3"/>
      <circle cx="200" cy="164" r="46" fill="${d.rg('#9c8cff')}" ${OL}/>${eyes(200, 164, 40, 13)}${smile(200, 188, 9)}${blush(200, 182, 70, 7)}`;
  } },
  35: { bg: ['#1a1550', '#09072a'], dark: true, draw: d => { // Galaxy the space whale
    const body = 'M50 236 Q70 140 200 136 Q330 136 342 220 Q348 292 262 304 L150 304 Q88 298 50 236Z';
    const cl = d.clip(`<path d="${body}"/>`);
    return `${[[60, 70, 7], [340, 60, 9], [36, 330, 6], [350, 340, 8], [120, 360, 5]].map(([x, y, r]) => sparkle(x, y, r, '#fff')).join('')}
      ${[[226, 80, 11], [250, 54, 8], [204, 50, 7], [276, 86, 6], [236, 26, 5]].map(([x, y, r]) => sparkle(x, y, r, '#bdf0ff')).join('')}<path d="M232 136 Q226 110 236 92 M240 136 Q250 112 268 104" stroke="#bdf0ff" stroke-width="4" fill="none" opacity=".7"/>
      <path d="M70 238 Q20 190 14 150 Q50 168 72 200 Q66 160 82 132 Q104 180 96 236Z" fill="${d.lg(['#7a5cff', '#2b3bd6'])}" ${OL}/>
      <path d="${body}" fill="${d.lg(['#5b6bff', '#3a2fb8', '#7a3bd6'], 0, 0, 1, 1)}" ${OL}/><g clip-path="${cl}">${[...Array(28)].map((_, i) => `<circle cx="${60 + (i * 53) % 290}" cy="${146 + (i * 37) % 150}" r="${1.5 + (i % 3)}" fill="#fff" opacity="${0.5 + (i % 2) * 0.4}"/>`).join('')}
      <path d="M120 270 Q220 310 330 260 L330 320 L120 320Z" fill="#a9c7ff" opacity=".35"/>${[0, 1, 2, 3].map(i => `<path d="M${150 + i * 40} 282 Q${170 + i * 40} 300 ${190 + i * 40} 282" stroke="#d6e4ff" stroke-width="3" fill="none" opacity=".5"/>`).join('')}</g>
      <path d="M198 262 Q216 300 186 318 Q178 290 182 266Z" fill="${d.lg(['#7a5cff', '#3a2fb8'])}" ${OL}/>${eye(282, 214, 12)}${smile(302, 248, 12)}${blush(296, 236, 20, 8)}${shine(150, 168, 34, 9, -10, 0.25)}`;
  } },
  36: { bg: ['#eafbf6', '#9be3cf'], draw: d => { // Drakoni the bubble-blowing baby dragon
    const bub = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${d.lg([['0', '#ffffff', 0.15], ['.6', '#c8f6ff', 0.25], ['1', '#ffb3f0', 0.45]], 0, 0, 1, 1)}" stroke="${d.lg(['#8ee9ff', '#ff9ef0', '#ffe66b'], 0, 0, 1, 1)}" stroke-width="3"/>${shine(x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.12, -40, 0.9)}`;
    return `${ground(200, 360, 100)}<path d="M266 330 Q330 330 330 290 Q330 262 304 262 Q318 290 290 304 Q270 312 250 306Z" fill="${d.rg('#45c9a8')}" ${OL}/><path d="M318 258 l10 -10 l2 14Z" fill="#ffd3e6"/>
      <path d="M150 216 Q96 170 92 222 Q112 210 120 236 Q132 218 146 240Z" fill="${d.rg('#8a7bff')}" ${OL}/><path d="M256 214 Q302 168 312 218 Q292 208 286 232 Q272 216 262 238Z" fill="${d.rg('#8a7bff')}" ${OL}/>
      <ellipse cx="208" cy="272" rx="70" ry="76" fill="${d.rg('#45c9a8')}" ${OL}/><ellipse cx="208" cy="290" rx="40" ry="54" fill="${d.rg('#fff1c9')}"/>${[262, 282, 302, 322].map(y => `<path d="M178 ${y} Q208 ${y + 8} 238 ${y}" stroke="#e8cf8f" stroke-width="3" fill="none"/>`).join('')}
      <rect x="164" y="330" width="28" height="26" rx="12" fill="${d.rg('#3bb393')}"/><rect x="226" y="330" width="28" height="26" rx="12" fill="${d.rg('#3bb393')}"/>
      ${[[242, 128], [266, 150], [278, 178]].map(([x, y]) => `<path d="M${x} ${y} l18 -6 l-8 16Z" fill="#ffd3e6"/>`).join('')}
      <path d="M150 112 Q140 80 156 72 Q160 96 168 106Z" fill="${d.rg('#fff1c9')}"/><path d="M220 106 Q228 76 246 74 Q236 96 234 112Z" fill="${d.rg('#fff1c9')}"/>
      <circle cx="190" cy="170" r="62" fill="${d.rg('#4fd6b4')}" ${OL}/><ellipse cx="160" cy="198" rx="36" ry="26" fill="${d.rg('#7ee8cd')}" ${OL}/><circle cx="146" cy="194" r="4" fill="${INK}"/><circle cx="162" cy="190" r="4" fill="${INK}"/>
      ${eyes(200, 156, 46, 14)}<circle cx="140" cy="214" r="9" fill="${INK}"/>${blush(196, 186, 92, 8)}
      ${bub(108, 206, 16)}${bub(78, 160, 24)}${bub(110, 112, 14)}${bub(56, 96, 12)}`;
  } },
  // ---------- epic ----------
  37: { bg: ['#1c1a52', '#0a0928'], dark: true, draw: d => { // Volty the lightning bunny
    const bolt = (x, y, s, rot) => `<path d="M${x} ${y} l${10 * s} ${-26 * s} l${-2 * s} ${18 * s} l${12 * s} ${-2 * s} l${-14 * s} ${30 * s} l${2 * s} ${-18 * s}Z" fill="#ffe14d" transform="rotate(${rot} ${x} ${y})"/>`;
    return `<ellipse cx="200" cy="228" rx="150" ry="70" fill="none" stroke="#61f3ff" stroke-width="6" opacity=".8" transform="rotate(-18 200 228)" filter="${d.glow(3)}"/><circle cx="200" cy="210" r="120" fill="#61f3ff" opacity=".16" filter="${d.glow(20)}"/>
      ${bolt(66, 140, 1.4, -10)}${bolt(330, 300, 1.2, 20)}${bolt(84, 320, 1, 30)}${bolt(326, 120, 1, -20)}
      <path d="M154 128 L118 52 L150 64 L126 6 L190 92 L160 86 L184 128Z" fill="${d.rg('#ffe14d', { hl: 0.6 })}" ${OL}/><path d="M232 126 L266 44 L274 74 L318 24 L284 104 L264 94 L254 130Z" fill="${d.rg('#ffe14d', { hl: 0.6 })}" ${OL}/>
      <path d="M156 300 Q116 330 86 324" stroke="#fffbea" stroke-width="26" stroke-linecap="round" fill="none"/><path d="M248 296 Q286 316 312 300" stroke="#fffbea" stroke-width="26" stroke-linecap="round" fill="none"/>
      <ellipse cx="202" cy="262" rx="64" ry="58" fill="${d.rg('#fffbea')}" ${OL} transform="rotate(-8 202 262)"/><circle cx="252" cy="250" r="14" fill="#fff"/>
      <path d="M144 252 Q104 230 96 200" stroke="#fffbea" stroke-width="20" stroke-linecap="round" fill="none"/><path d="M258 236 Q296 210 302 176" stroke="#fffbea" stroke-width="20" stroke-linecap="round" fill="none"/>
      <circle cx="200" cy="176" r="62" fill="${d.rg('#fffbea')}" ${OL}/>${eyes(200, 170, 50, 14)}${grin(200, 200, 15)}<path d="M146 192 l-10 6 l8 2 l-8 8 M254 192 l10 6 l-8 2 l8 8" stroke="#ffd23f" stroke-width="4" fill="none" stroke-linecap="round"/>${blush(200, 190, 92, 8)}`;
  } },
  38: { bg: ['#14164a', '#070820'], dark: true, draw: d => { // Nova, keeper of the stars
    const stars = [[96, 70, 14], [150, 40, 9], [60, 130, 8], [118, 112, 6], [320, 300, 9], [84, 300, 7]].map(([x, y, r]) => `<path d="${star5(x, y, r, r * 0.45)}" fill="${d.rg('#fff3a0')}"/>`).join('');
    return `<circle cx="104" cy="96" r="90" fill="#ffe680" opacity=".22" filter="${d.glow(20)}"/>${stars}<path d="M110 132 Q150 170 180 200" stroke="#ffe680" stroke-width="3" stroke-dasharray="3 9" fill="none" opacity=".8"/>
      <path d="M150 238 Q80 300 100 360 L300 360 Q316 300 250 238Z" fill="${d.lg(['#5b3bd6', '#2a1f7a'])}" ${OL}/>${[[140, 320], [200, 300], [262, 330], [180, 344], [236, 290]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`).join('')}<path d="M140 320 L200 300 L236 290 M200 300 L262 330" stroke="#c9b8ff" stroke-width="1.5" opacity=".7"/>
      <path d="M168 236 L232 236 L240 340 L160 340Z" fill="${d.rg('#2f3fa8')}" ${OL}/><path d="M176 268 L224 268" stroke="#ffe680" stroke-width="6"/><path d="${star5(200, 296, 16, 7)}" fill="${d.rg('#ffe680')}"/>
      <path d="M172 250 Q130 200 118 150" stroke="#e8d9ff" stroke-width="18" stroke-linecap="round" fill="none"/><path d="M228 252 Q268 280 276 316" stroke="#e8d9ff" stroke-width="18" stroke-linecap="round" fill="none"/>
      <path d="M104 146 L132 146 L128 116 L108 116Z" fill="#d8a43a"/><rect x="100" y="112" width="36" height="8" rx="3" fill="#b8862a"/><circle cx="118" cy="130" r="12" fill="#fffbe0"/><circle cx="118" cy="130" r="26" fill="#fff3a0" opacity=".45"/>
      <path d="${star5(200, 168, 84, 44, -90)}" fill="${d.rg('#ffd84d', { hl: 0.6 })}" ${OL} stroke-linejoin="round"/>${eyes(200, 170, 40, 12)}${grin(200, 194, 11)}${blush(200, 188, 68, 6)}${shine(178, 126, 10, 5, -40, 0.7)}`;
  } },
  39: { bg: ['#1f1450', '#0b0726'], dark: true, draw: d => { // Gravito the robot wizard
    const cube = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><polygon points="0,-20 18,-10 0,0 -18,-10" fill="${d.rg(c, { cy: 40 })}"/><polygon points="-18,-10 0,0 0,22 -18,12" fill="${tone(c, -0.25)}"/><polygon points="0,0 18,-10 18,12 0,22" fill="${tone(c, -0.45)}"/></g>`;
    return `<ellipse cx="200" cy="352" rx="96" ry="18" fill="none" stroke="#b48cff" stroke-width="6" opacity=".9" filter="${d.glow(3)}"/><ellipse cx="200" cy="352" rx="70" ry="12" fill="#b48cff" opacity=".35"/>
      ${cube(76, 150, 1.5, '#61f3ff')}${cube(330, 120, 1.3, '#ff79c6')}${cube(64, 270, 1.1, '#ffd84d')}${cube(338, 246, 1.6, '#7ee8a0')}${cube(300, 52, 0.9, '#ffb347')}
      <circle cx="104" cy="210" r="22" fill="#b48cff" opacity=".35" filter="${d.glow(6)}"/><circle cx="300" cy="190" r="22" fill="#b48cff" opacity=".35" filter="${d.glow(6)}"/>
      <path d="M150 242 Q118 226 104 210" stroke="#a7b4d6" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="104" cy="208" r="13" fill="${d.rg('#e6ecff')}"/><path d="M250 236 Q284 214 298 190" stroke="#a7b4d6" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="300" cy="188" r="13" fill="${d.rg('#e6ecff')}"/>
      <path d="M148 216 L252 216 L238 326 Q200 342 162 326Z" fill="${d.rg('#7b5cff')}" ${OL}/><path d="${star5(200, 262, 18, 9)}" fill="${d.rg('#61f3ff', { hl: 0.7 })}"/><circle cx="200" cy="262" r="30" fill="#61f3ff" opacity=".2"/>
      <rect x="146" y="140" width="108" height="80" rx="30" fill="${d.rg('#c9d4f2')}" ${OL}/><rect x="160" y="154" width="80" height="50" rx="20" fill="#13203a"/><ellipse cx="184" cy="178" rx="8" ry="11" fill="#b48cff"/><ellipse cx="216" cy="178" rx="8" ry="11" fill="#b48cff"/><path d="M188 194 Q200 200 212 194" stroke="#b48cff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="200" cy="140" rx="82" ry="14" fill="${d.rg('#3a2fb8')}" ${OL}/><path d="M146 138 Q170 70 230 20 Q240 70 254 138Z" fill="${d.rg('#3a2fb8')}" ${OL}/>${[[188, 112], [214, 84], [222, 124]].map(([x, y]) => `<path d="${star5(x, y, 7, 3)}" fill="#ffe680"/>`).join('')}
      <g transform="translate(200 104)"><circle r="10" fill="none" stroke="#ffe680" stroke-width="4"/>${[0, 60, 120, 180, 240, 300].map(a => `<rect x="-3" y="-15" width="6" height="6" fill="#ffe680" transform="rotate(${a})"/>`).join('')}</g>`;
  } },
  // ---------- legendary ----------
  40: { bg: ['#1b1040', '#080418'], dark: true, draw: d => { // Lumi, the light bird
    const rainbow = ['#ff5f6d', '#ffb347', '#ffe66b', '#7ee8a0', '#5ecbff', '#9b7bff', '#ff7ad1'];
    const wing = side => rainbow.map((c, i) => { const len = 205 - i * 13, a = -58 + i * 15; return `<path d="M200 200 Q${200 + side * 70} ${140 + i * 6} ${(200 + side * len * Math.cos(a * Math.PI / 180) * 1.08).toFixed(0)} ${(200 + len * Math.sin(a * Math.PI / 180)).toFixed(0)} Q${200 + side * 70} ${200 + i * 4} 200 214Z" fill="${d.lg([['0', '#fffbe8'], ['.55', c], ['1', tone(c, -0.15)]], side > 0 ? 0 : 1, 0, side > 0 ? 1 : 0, 0)}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`; }).join('');
    const tail = rainbow.slice(0, 5).map((c, i) => `<path d="M200 262 Q${170 + i * 15} 320 ${140 + i * 30} 378" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="${140 + i * 30}" cy="380" r="9" fill="${d.rg(c, { hl: 0.7 })}"/>`).join('');
    return `<circle cx="200" cy="190" r="190" fill="#ffe8a3" opacity=".3" filter="${d.glow(30)}"/><circle cx="200" cy="170" r="90" fill="#fffbe8" opacity=".35" filter="${d.glow(18)}"/><circle cx="200" cy="140" r="64" fill="none" stroke="${d.lg(['#fff3b0', '#ffd34d', '#fff3b0'], 0, 0, 1, 0)}" stroke-width="7" opacity=".95" filter="${d.glow(1.5)}"/>
      ${wing(-1)}${wing(1)}${tail}
      <path d="M200 128 Q256 156 252 214 Q246 270 200 280 Q154 270 148 214 Q144 156 200 128Z" fill="${d.rg('#fff6d6', { hl: 0.8 })}" ${OL}/><path d="M172 236 Q200 252 228 236 Q224 262 200 268 Q176 262 172 236Z" fill="#ffe9a8" opacity=".8"/>
      ${[[-18, '#ff7ad1'], [0, '#ffe66b'], [18, '#5ecbff']].map(([dx, c]) => `<path d="M200 128 Q${200 + dx} 96 ${200 + dx * 1.6} 72" stroke="#fff6d6" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="${200 + dx * 1.6}" cy="70" r="8" fill="${d.rg(c, { hl: 0.7 })}"/><circle cx="${200 + dx * 1.6}" cy="70" r="16" fill="${c}" opacity=".35"/>`).join('')}
      <circle cx="200" cy="150" r="54" fill="${d.rg('#fffaf0', { hl: 0.8 })}" ${OL}/>${eyes(200, 146, 44, 15)}<path d="M191 170 L209 170 L200 184Z" fill="${d.rg('#ffc94d')}"/>${blush(200, 170, 80, 8)}${shine(178, 116, 12, 6, -30, 0.7)}
      <path d="M182 214 Q200 226 218 214" stroke="#ffd34d" stroke-width="4" fill="none"/><path d="${star5(200, 236, 12, 5)}" fill="${d.rg('#ffd34d', { hl: 0.7 })}"/>`;
  } },
};

// ---------- rarity scenery (inside the art window) ----------
function scenery(d, c, W, H, seed) {
  const art = ART[c.id], r = c.rarity, R = rng(seed);
  const [c1, c2] = art.bg;
  const bgId = d.id();
  d.defs.push(`<radialGradient id="${bgId}" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`);
  let s = `<rect width="${W}" height="${H}" fill="url(#${bgId})"/>`;
  const light = art.dark ? '#ffffff' : '#ffffff';
  if (r === 'uncommon') {
    const pid = d.id();
    d.defs.push(`<pattern id="${pid}" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="8" cy="8" r="4" fill="${light}" opacity=".35"/><path d="M20 26 l6 -6" stroke="${light}" stroke-width="3" opacity=".25" stroke-linecap="round"/></pattern>`);
    s += `<rect width="${W}" height="${H}" fill="url(#${pid})"/>`;
  }
  if (['rare', 'epic', 'legendary'].includes(r)) {
    const n = r === 'rare' ? 12 : 18, cx = W / 2, cy = H * 0.45;
    let rays = '';
    for (let i = 0; i < n; i++) { const a1 = (i / n) * Math.PI * 2, a2 = a1 + Math.PI / n * 0.55, L = W * 1.2; rays += `<path d="M${cx} ${cy} L${(cx + L * Math.cos(a1)).toFixed(0)} ${(cy + L * Math.sin(a1)).toFixed(0)} L${(cx + L * Math.cos(a2)).toFixed(0)} ${(cy + L * Math.sin(a2)).toFixed(0)}Z"/>`; }
    s += `<g fill="#fff" opacity="${r === 'rare' ? 0.12 : 0.1}">${rays}</g><circle cx="${cx}" cy="${cy}" r="${W * 0.36}" fill="#fff" opacity="${art.dark ? 0.1 : 0.32}" filter="${d.glow(26)}"/>`;
  }
  if (r === 'epic' || r === 'legendary') {
    // a glowing 3D floor grid
    const y0 = H * 0.78; let grid = '';
    for (let i = -8; i <= 8; i++) grid += `<line x1="${W / 2 + i * 26}" y1="${y0}" x2="${W / 2 + i * 120}" y2="${H}"/>`;
    for (let k = 0; k < 5; k++) { const y = y0 + (H - y0) * (k / 5) ** 1.6; grid += `<line x1="0" y1="${y.toFixed(0)}" x2="${W}" y2="${y.toFixed(0)}"/>`; }
    s += `<rect y="${y0}" width="${W}" height="${H - y0}" fill="${r === 'epic' ? '#7b5cff' : '#ffcf4d'}" opacity=".18"/><g stroke="${r === 'epic' ? '#9ee8ff' : '#ffe8a3'}" stroke-width="1.5" opacity=".45">${grid}</g>`;
  }
  if (r === 'legendary') {
    const hid = d.id();
    d.defs.push(`<radialGradient id="${hid}" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff2b8" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9ad5" stop-opacity=".18"/><stop offset="1" stop-color="#5a3bd6" stop-opacity="0"/></radialGradient>`);
    s += `<rect width="${W}" height="${H}" fill="url(#${hid})"/>`;
  }
  return s;
}
function particles(d, c, W, H, seed) {
  const r = c.rarity, R = rng(seed + 7);
  const n = { common: 0, uncommon: 4, rare: 9, epic: 18, legendary: 30 }[r];
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (R() * W).toFixed(0), y = (R() * H * 0.9).toFixed(0), size = 4 + R() * (r === 'legendary' ? 13 : r === 'epic' ? 11 : 9);
    const col = r === 'legendary' ? ['#fff6c2', '#ffd34d', '#ff9ad5', '#9ee8ff', '#ffffff'][i % 5] : r === 'epic' ? ['#9ee8ff', '#ffffff', '#ff9ad5', '#fff27a'][i % 4] : '#ffffff';
    s += i % 3 === 0 && r !== 'uncommon' ? `<circle cx="${x}" cy="${y}" r="${(size / 3).toFixed(1)}" fill="${col}" opacity=".85"/>` : sparkle(+x, +y, size, col, 0.9);
  }
  if (r === 'epic') {
    // energy bolts
    const bolts = [[W * 0.1, H * 0.22], [W * 0.88, H * 0.3], [W * 0.84, H * 0.72]].map(([x, y], i) => `<path d="M${x} ${y} l${i % 2 ? -14 : 14} 22 l-10 2 l${i % 2 ? -10 : 10} 24" stroke="#bff6ff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    s += `<g filter="${d.glow(3)}">${bolts}</g>${bolts}`;
  }
  return s;
}

// ---------- the illustration: the originals' hand-drawn art, or a generated creature in its world ----------
function illustration(d, c, W, H) {
  if (c.gen) {
    const w = worldOf(c), R = rng(c.id * 31 + 7);
    const k = Math.min(W, H * 1.05) / 400, ox = (W - 400 * k) / 2, oy = H - 400 * k - H * 0.02;
    return `${worldScene(d, w, W, H, R, c.rarity)}<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(k)})">${drawCreature(d, c)}</g>`;
  }
  const art = ART[c.id]; if (!art) return '';
  const k = Math.min(W, H) / 400 * 0.98, ox = (W - 400 * k) / 2, oy = H - 400 * k - H * 0.01;
  return `${scenery(d, c, W, H, c.id * 31)}<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(k)})">${art.draw(d)}</g>${particles(d, c, W, H, c.id * 31)}`;
}
const f = n => Math.round(n * 100) / 100;

// ---------- full card 600×840: full-bleed art, a name plate, rarity gems and a frame that grows with rarity ----------
const FONT = `'Heebo', 'Noto Sans Hebrew', 'Arial Hebrew', Arial, sans-serif`;
const FRAME = {
  common:    { stops: ['#eef2f8', '#b8c3d4', '#f4f7fb', '#9eabc0'], ink: '#2b2340', plate: ['#ffffff', '#eef1f7'], line: '#9aa6b8', gem: '#7c8aa0' },
  uncommon:  { stops: ['#c9ffe4', '#2bb673', '#e6fff2', '#178a55'], ink: '#0f3d2a', plate: ['#f3fff8', '#d8f7e7'], line: '#2bb673', gem: '#2bb673' },
  rare:      { stops: ['#e1efff', '#4f86e8', '#f4f9ff', '#2a56b0', '#bcd6ff'], ink: '#ffffff', plate: ['#1d3f8f', '#0f2560'], line: '#9cc4ff', gem: '#2f7de1' },
  epic:      { stops: ['#ff7ad9', '#a259ff', '#5b8cff', '#5ef0ff', '#b06bff', '#ff6bd5'], ink: '#ffffff', plate: ['#3a1a7a', '#1a0b44'], line: '#e2c6ff', gem: '#9b4dff' },
  legendary: { stops: ['#fff3b0', '#e8a92a', '#fff8d6', '#b8761a', '#ffe27a', '#9a5e10'], ink: '#fff3c4', plate: ['#3a1d06', '#1e0d02'], line: '#ffe27a', gem: '#f2b705' },
};
export function cardSVG(c, { fontCSS = '', w = 600 } = {}) {
  const r = c.rarity, R = RARITY[r], F = FRAME[r], lvl = RARITY_ORDER.indexOf(r);
  const d = makeCtx(`k${c.id}x${uid++}x`);
  const W = 600, H = 840, pad = 16, aw = W - pad * 2, ah = 600, ay = pad;
  const series = seriesOf(c);
  const frameFill = d.lg(F.stops, 0, 0, 1, 1);
  const artClip = d.clip(`<rect x="${pad}" y="${ay}" width="${aw}" height="${ah + 40}" rx="26"/>`);
  // foil: a soft diagonal sheen for rare+, a rainbow one for legendary
  const foil = lvl >= 2 ? `<rect class="foil" x="${pad}" y="${ay}" width="${aw}" height="${ah}" fill="${d.lg(lvl === 4 ? [['0', '#ff5f6d', 0], ['.25', '#ffb347', 0.18], ['.4', '#7ee8a0', 0], ['.55', '#5ecbff', 0.18], ['.7', '#9b7bff', 0], ['.85', '#ff7ad1', 0.18], ['1', '#ffe66b', 0]] : [['0', '#fff', 0], ['.42', '#fff', 0], ['.5', '#fff', lvl === 3 ? 0.28 : 0.2], ['.58', '#fff', 0], ['1', '#fff', 0]], 0, 0, 1, 1)}"/>` : '';
  const corners = lvl >= 3 ? [[pad + 10, pad + 10, 0], [W - pad - 10, pad + 10, 90], [W - pad - 10, H - pad - 10, 180], [pad + 10, H - pad - 10, 270]].map(([x, y, a]) => `<path d="M${x} ${y + 34} L${x} ${y} L${x + 34} ${y}" stroke="${F.line}" stroke-width="5" fill="none" stroke-linecap="round" transform="rotate(${a} ${x} ${y})"/>${sparkle(x + (a === 90 || a === 180 ? -16 : 16), y + (a >= 180 ? -16 : 16), 8, F.line)}`).join('') : '';
  const nameSize = c.name.length > 16 ? 36 : c.name.length > 12 ? 42 : 48;
  const py = ay + ah - 6;     // plate top
  const gems = RARITY_ORDER.map((_, i) => { const x = W / 2 + (i - 2) * 30; return i <= lvl ? `<path d="M${x} ${py + 172} l11 11 l-11 11 l-11 -11Z" fill="${lvl === 4 ? d.lg(['#fff3b0', '#ffd34d', '#e8a92a'], 0, 0, 0, 1) : F.gem}" stroke="#fff" stroke-width="2"/>` : `<path d="M${x} ${py + 172} l11 11 l-11 11 l-11 -11Z" fill="none" stroke="${F.ink}" stroke-opacity=".35" stroke-width="2"/>`; }).join('');
  const body = `<rect width="${W}" height="${H}" rx="38" fill="${frameFill}"/>
    ${lvl >= 3 ? `<rect width="${W}" height="${H}" rx="38" fill="${d.lg([['0', '#fff', 0], ['.45', '#fff', 0.45], ['.52', '#fff', 0], ['.66', '#fff', 0.3], ['1', '#fff', 0]], 0, 0, 1, 1)}"/>` : ''}
    <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="33" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="2.5"/>
    <g clip-path="${artClip}"><g transform="translate(${pad} ${ay})">${illustration(d, c, aw, ah + 40)}</g>${foil}
      <rect x="${pad}" y="${ay}" width="${aw}" height="${ah * 0.3}" fill="${d.lg([['0', '#fff', 0.22], ['1', '#fff', 0]])}"/></g>
    <rect x="${pad}" y="${ay}" width="${aw}" height="${ah + 40}" rx="26" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>
    <g>
      <rect x="${pad + 14}" y="${ay + 14}" width="128" height="44" rx="22" fill="#0b0620" fill-opacity=".45"/>
      <text x="${pad + 78}" y="${ay + 44}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="24" fill="#fff" direction="ltr">#${c.no}</text>
      <rect x="${W - pad - 168}" y="${ay + 14}" width="154" height="44" rx="22" fill="${lvl === 4 ? d.lg(['#fff3b0', '#e8a92a'], 0, 0, 1, 0) : R.color}" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
      <text x="${W - pad - 91}" y="${ay + 44}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-weight="800" font-size="24" fill="${lvl === 4 ? '#4a2a00' : '#fff'}">${R.symbol} ${R.he}</text>
    </g>
    <path d="M${pad} ${py + 24} Q${pad} ${py} ${pad + 24} ${py} L${W / 2 - 70} ${py} Q${W / 2 - 52} ${py} ${W / 2 - 40} ${py - 12} Q${W / 2} ${py - 30} ${W / 2 + 40} ${py - 12} Q${W / 2 + 52} ${py} ${W / 2 + 70} ${py} L${W - pad - 24} ${py} Q${W - pad} ${py} ${W - pad} ${py + 24} L${W - pad} ${H - pad - 24} Q${W - pad} ${H - pad} ${W - pad - 24} ${H - pad} L${pad + 24} ${H - pad} Q${pad} ${H - pad} ${pad} ${H - pad - 24}Z" fill="${d.lg(F.plate)}" stroke="${F.line}" stroke-width="3"/>
    <circle cx="${W / 2}" cy="${py - 4}" r="26" fill="${d.lg(F.plate)}" stroke="${F.line}" stroke-width="3"/>
    <text x="${W / 2}" y="${py + 7}" text-anchor="middle" font-size="28">${series.emoji}</text>
    <text x="${W / 2}" y="${py + 82}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-weight="900" font-size="${nameSize}" fill="${F.ink}">${c.name}</text>
    <text x="${W / 2}" y="${py + 128}" text-anchor="middle" direction="rtl" font-family="${FONT}" font-weight="600" font-size="23" fill="${F.ink}" opacity=".78">${series.name} · ${c.kind}</text>
    ${gems}
    <text x="${W - pad - 30}" y="${py + 192}" text-anchor="end" font-family="${FONT}" font-weight="800" font-size="20" fill="${F.ink}" opacity=".7" direction="ltr">${c.no}/${TOTAL}</text>
    ${corners}`;
  const h = Math.round(w * H / W);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" direction="ltr" style="direction:ltr" role="img" aria-label="${c.name} – ${R.he} – ${c.no}/${TOTAL}">${fontCSS ? `<style>${fontCSS}</style>` : ''}<defs>${d.defs.join('')}</defs>${body}</svg>`;
}

// ---------- in-app: the character on its background (avatar / small tiles) ----------
export function cardArt(c, { mini = true } = {}) {
  if (!c || (!c.gen && !ART[c.id])) return '';
  const d = makeCtx(`m${c.id}x${uid++}x`);
  const W = 400, H = 400;
  if (c.gen) { const R = rng(c.id * 31 + 7); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${(() => { const s = worldScene(d, worldOf(c), W, H, R, mini ? 'common' : c.rarity) + `<g transform="translate(20 30) scale(.9)">${drawCreature(d, c)}</g>`; return `<defs>${d.defs.join('')}</defs>${s}`; })()}</svg>`; }
  const art = ART[c.id];
  const bg = scenery(d, c, W, H, c.id * 31), fx = mini && c.rarity === 'common' ? '' : particles(d, c, W, H, c.id * 31);
  const body = art.draw(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${d.defs.join('')}</defs>${bg}<g transform="translate(20 22) scale(.9)">${body}</g>${fx}</svg>`;
}
export const hasArt = id => !!ART[id] || !!(cardById(id) || {}).gen;
