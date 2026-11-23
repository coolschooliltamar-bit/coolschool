// Aluma sticker cards – 1,000 cards (rewards, spec א/ז).
// Cards 1–40 are "the originals" (hand-drawn, js/cardart.js); cards 41–1000 come from 24 worlds of 40 creatures
// each (js/card-worlds.js), drawn in code (js/creatures.js). Every 100 XP earns a card box. A box holds one card;
// its rarity is drawn with FIXED, PUBLISHED odds that equal each rarity's share of the collection
// (50 / 25 / 15 / 7.5 / 2.5 %). Boxes are only earned by learning – never bought – and they never expire.
// The counts are fixed: 500 / 250 / 150 / 75 / 25 = 1,000 (every world, the originals too: 20 / 10 / 6 / 3 / 1).
import { WORLDS } from './card-worlds.js';
import { planKind } from './creatures.js';

export const RARITY = {
  common:    { he: 'רגיל',  en: 'Common',    count: 500, share: '50%',  odds: 50,  symbol: '●', color: '#7c8aa0' },
  uncommon:  { he: 'מיוחד', en: 'Uncommon',  count: 250, share: '25%',  odds: 25,  symbol: '◆', color: '#2bb673' },
  rare:      { he: 'נדיר',  en: 'Rare',      count: 150, share: '15%',  odds: 15,  symbol: '★', color: '#2f7de1' },
  epic:      { he: 'אפי',   en: 'Epic',      count: 75,  share: '7.5%', odds: 7.5, symbol: '✦', color: '#9b4dff' },
  legendary: { he: 'אגדי',  en: 'Legendary', count: 25,  share: '2.5%', odds: 2.5, symbol: '♛', color: '#f2b705' },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const C = (n, name, en, rarity, kind, bio, emoji) => ({ id: n, no: String(n).padStart(3, '0'), name, en, rarity, kind, bio, emoji, world: 'originals' });

const ORIGINALS = [
  // ---------- Common (20) ----------
  C(1, 'פופי פופקורן', 'Popi Popcorn', 'common', 'מאכל', 'קופץ מהתרגשות מכל שאלה חדשה.', '🍿'),
  C(2, 'טוסטי', 'Toasty', 'common', 'מאכל', 'פרוסת לחם חמימה שתמיד קמה מוקדם.', '🍞'),
  C(3, 'בלובי', 'Bloobi', 'common', 'מפלצת חמודה', 'מפלצת ג׳לי כחולה שמתנדנדת כשהיא צוחקת.', '🫧'),
  C(4, 'שלי הצבה', 'Shelly', 'common', 'חיה', 'צבה עם נעלי ספורט – לאט אבל בטוח.', '🐢'),
  C(5, 'ענני', 'Anani', 'common', 'יצור קסום', 'דובון ענן רך שממטיר טיפות של רעיונות.', '☁️'),
  C(6, 'קרחי', 'Karchi', 'common', 'חיה', 'פינגווין קטן עם צעיף, אוהב החלקה על קרח.', '🐧'),
  C(7, 'ביפ', 'Beep', 'common', 'רובוט', 'רובוט קטן עם אנטנה שמהבהבת כשהוא חושב.', '🤖'),
  C(8, 'זיזי', 'Zizi', 'common', 'חייזר', 'חייזרית ירוקה עם שלוש עיניים סקרניות.', '👽'),
  C(9, 'מומו', 'Momo', 'common', 'יצור יער', 'פטרייה נקודתית ומנומסת מהיער הקסום.', '🍄'),
  C(10, 'גלידוני', 'Gelidoni', 'common', 'מאכל', 'גביע גלידה תותית עם סוכריות צבעוניות.', '🍦'),
  C(11, 'שבלול טורבו', 'Turbo Snail', 'common', 'חיה', 'השבלול הכי מהיר בגינה – עם קסדה!', '🐌'),
  C(12, 'קקטוסי', 'Cactusi', 'common', 'צמח', 'קקטוס חייכן עם פרח ורוד על הראש.', '🌵'),
  C(13, 'פיצי', 'Pizzi', 'common', 'מאכל', 'משולש פיצה שמחלק חיוכים לכולם.', '🍕'),
  C(14, 'לולי הלאמה', 'Lully Llama', 'common', 'חיה', 'לאמה פרוותית עם כובע צמר וחיוך רגוע.', '🦙'),
  C(15, 'אוקטה', 'Okta', 'common', 'חיה', 'תמנונית ספרנית – קוראת שמונה ספרים בבת אחת.', '🐙'),
  C(16, 'ננסי', 'Nansi', 'common', 'חיה', 'נמלה חזקה שמרימה עלה פי עשרה ממנה.', '🐜'),
  C(17, 'צפצופי', 'Tziftzufi', 'common', 'חיה', 'אפרוח צהוב שיצא עכשיו מהביצה, עם קליפה על הראש.', '🐥'),
  C(18, 'קוביקו', 'Cubiko', 'common', 'דמות גיימינג', 'דמות משחק מרובעת שאוספת מטבעות כוכב.', '🎲'),
  C(19, 'סושי סאמי', 'Sushi Sami', 'common', 'מאכל', 'רול סושי קטן ומסודר שאוהב סדר בשולחן.', '🍣'),
  C(20, 'ירחי', 'Yarchi', 'common', 'דמות חלל', 'ירח קטן ומנומנם עם כרית כוכבים.', '🌙'),
  // ---------- Uncommon (10) ----------
  C(21, 'שועלי הסייר', 'Scout Fox', 'uncommon', 'חיה', 'שועל עם מפה ומשקפת – מגלה שבילים חדשים.', '🦊'),
  C(22, 'זמזומה', 'Zumzuma', 'uncommon', 'חיה', 'דבורה טייסת עם משקפי תעופה.', '🐝'),
  C(23, 'גלגלית', 'Galgalit', 'uncommon', 'רובוט', 'רובוטית על גלגל אחד ששומרת על איזון מושלם.', '⚙️'),
  C(24, 'כוכבון', 'Kochavon', 'uncommon', 'חיה', 'כוכב ים ורוד שמנצח על להקת דגים.', '⭐'),
  C(25, 'פיקסל', 'Pixel', 'uncommon', 'דמות גיימינג', 'דמות שלבים מתקופת המשחקים הרטרו.', '👾'),
  C(26, 'דונאטו', 'Donato', 'uncommon', 'דמות חלל', 'סופגנייה אסטרונאוטית בחליפת חלל.', '🍩'),
  C(27, 'ינשופית', 'Yanshufit', 'uncommon', 'חיה', 'ינשופה מדענית עם משקפיים ומבחנה.', '🦉'),
  C(28, 'נמרי', 'Namri', 'uncommon', 'חיה', 'גור נמר על סקייטבורד, עם קסדה וברכיות.', '🐯'),
  C(29, 'מדוזית', 'Meduzit', 'uncommon', 'חיה', 'מדוזה שזוהרת בחושך כמו מנורת לילה.', '🪼'),
  C(30, 'פרחונית', 'Pirchonit', 'uncommon', 'יצור קסום', 'פיה קטנה שגרה בתוך פרח חמנייה.', '🌻'),
  // ---------- Rare (6) ----------
  C(31, 'קומטה', 'Cometa', 'rare', 'דמות חלל', 'חתולת שביט שמשאירה אחריה שובל של נצנצים.', '☄️'),
  C(32, 'טורבו-בוט', 'Turbo-Bot', 'rare', 'רובוט', 'רובוט עם תרמיל סילון שעוזר לכל מי שנתקע.', '🚀'),
  C(33, 'אלונית', 'Alonit', 'rare', 'יצור קסום', 'רוח עץ עתיקה וחכמה, עם עלים שמשנים צבע.', '🌳'),
  C(34, 'זוהרה', 'Zohara', 'rare', 'יצור קסום', 'גחלילית קסומה שמאירה את הדרך הביתה.', '✨'),
  C(35, 'גלקסי', 'Galaxy', 'rare', 'דמות חלל', 'לווייתן חלל ששוחה בין הכוכבים.', '🐋'),
  C(36, 'דרקוני', 'Drakoni', 'rare', 'יצור קסום', 'דרקון תינוק שנושף בועות סבון במקום אש.', '🐉'),
  // ---------- Epic (3) ----------
  C(37, 'וולטי', 'Volty', 'epic', 'יצור קסום', 'ארנבת ברק שמטעינה את כולם באנרגיה טובה.', '⚡'),
  C(38, 'נובה', 'Nova', 'epic', 'דמות חלל', 'שומרת הכוכבים, עם פנס שמדליק כוכבים חדשים.', '🌟'),
  C(39, 'גרביטו', 'Gravito', 'epic', 'רובוט', 'רובוט-קוסם שמרחף ומרים קוביות בכוח הכבידה.', '🔮'),
  // ---------- Legendary (1) ----------
  C(40, 'לומי – ציפור האור', 'Lumi, the Light Bird', 'legendary', 'יצור אגדי', 'ציפור האור של אלומה. נולדת מכל הניצוצות שאספת – הכי נדירה במשחק.', '🕊️'),
];

// the 24 worlds → 960 cards. In every world: variants 1–2 of each species are common (20), variant 3 is
// uncommon (10), variant 4 is rare for species 1–6 (6), epic for 7–9 (3) and legendary for the 10th (1).
const rarityOf = (si, vi) => vi < 2 ? 'common' : vi === 2 ? 'uncommon' : si < 6 ? 'rare' : si < 9 ? 'epic' : 'legendary';
const GENERATED = WORLDS.flatMap((w, wi) => w.species.flatMap(([sname, plan, f, sdesc], si) => w.variants.map(([vname, main, accent, el, vdesc], vi) => {
  const id = 41 + wi * 40 + si * 4 + vi;
  return { id, no: String(id).padStart(3, '0'), name: `${sname.replace(/(?<=[א-ת])-(?=[א-ת])/g, ' ')} ${vname}`, en: '', rarity: rarityOf(si, vi), kind: planKind(plan), bio: `${sdesc} ${vdesc}.`, emoji: w.emoji,
    world: w.id, gen: true, si, vi, sp: { plan, f }, v: { main, accent, el } };
})));
export const CARDS = [...ORIGINALS, ...GENERATED];
export const TOTAL = CARDS.length;
export const SERIES = [{ id: 'originals', name: 'המקוריים', emoji: '✨' }, ...WORLDS.map(w => ({ id: w.id, name: w.name, emoji: w.emoji }))];
export const seriesOf = c => SERIES.find(s => s.id === c.world) || SERIES[0];
export const worldOf = c => WORLDS.find(w => w.id === c.world) || null;
const BY_ID = new Map(CARDS.map(c => [c.id, c]));
export const cardById = id => BY_ID.get(+id);
// how a card is obtained – shown on locked cards and in the catalog
export function unlockText(c) {
  const r = RARITY[c.rarity];
  return `מתיבת קלפים · סיכוי ל${r.he}: ${r.share} (${r.count} קלפים ברמה)`;
}
