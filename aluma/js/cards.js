// Aluma sticker cards – the 40-card collection (rewards, spec א/ז).
// Cards are EARNED, never bought or drawn at random: every card has a fixed, visible unlock rule
// (an XP threshold or an achievement). Rarity only says how special the design is and how far
// along the semester it unlocks. The counts are fixed: 20 / 10 / 6 / 3 / 1 = 40.

export const RARITY = {
  common:    { he: 'רגיל',  en: 'Common',    count: 20, share: '50%',  symbol: '●', color: '#7c8aa0' },
  uncommon:  { he: 'מיוחד', en: 'Uncommon',  count: 10, share: '25%',  symbol: '◆', color: '#2bb673' },
  rare:      { he: 'נדיר',  en: 'Rare',      count: 6,  share: '15%',  symbol: '★', color: '#2f7de1' },
  epic:      { he: 'אפי',   en: 'Epic',      count: 3,  share: '7.5%', symbol: '✦', color: '#9b4dff' },
  legendary: { he: 'אגדי',  en: 'Legendary', count: 1,  share: '2.5%', symbol: '♛', color: '#f2b705' },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// achievements that unlock the rare cards (see game.js ACHIEVEMENTS)
const C = (n, name, en, rarity, kind, bio, unlock, emoji) => ({ id: n, no: String(n).padStart(2, '0'), name, en, rarity, kind, bio, unlock, emoji });

export const CARDS = [
  // ---------- Common (20) – unlock every 20 XP ----------
  C(1, 'פופי פופקורן', 'Popi Popcorn', 'common', 'מאכל', 'קופץ מהתרגשות מכל שאלה חדשה.', { xp: 20 }, '🍿'),
  C(2, 'טוסטי', 'Toasty', 'common', 'מאכל', 'פרוסת לחם חמימה שתמיד קמה מוקדם.', { xp: 40 }, '🍞'),
  C(3, 'בלובי', 'Bloobi', 'common', 'מפלצת חמודה', 'מפלצת ג׳לי כחולה שמתנדנדת כשהיא צוחקת.', { xp: 60 }, '🫧'),
  C(4, 'שלי הצבה', 'Shelly', 'common', 'חיה', 'צבה עם נעלי ספורט – לאט אבל בטוח.', { xp: 80 }, '🐢'),
  C(5, 'ענני', 'Anani', 'common', 'יצור קסום', 'דובון ענן רך שממטיר טיפות של רעיונות.', { xp: 100 }, '☁️'),
  C(6, 'קרחי', 'Karchi', 'common', 'חיה', 'פינגווין קטן עם צעיף, אוהב החלקה על קרח.', { xp: 120 }, '🐧'),
  C(7, 'ביפ', 'Beep', 'common', 'רובוט', 'רובוט קטן עם אנטנה שמהבהבת כשהוא חושב.', { xp: 140 }, '🤖'),
  C(8, 'זיזי', 'Zizi', 'common', 'חייזר', 'חייזרית ירוקה עם שלוש עיניים סקרניות.', { xp: 160 }, '👽'),
  C(9, 'מומו', 'Momo', 'common', 'יצור יער', 'פטרייה נקודתית ומנומסת מהיער הקסום.', { xp: 180 }, '🍄'),
  C(10, 'גלידוני', 'Gelidoni', 'common', 'מאכל', 'גביע גלידה תותית עם סוכריות צבעוניות.', { xp: 200 }, '🍦'),
  C(11, 'שבלול טורבו', 'Turbo Snail', 'common', 'חיה', 'השבלול הכי מהיר בגינה – עם קסדה!', { xp: 220 }, '🐌'),
  C(12, 'קקטוסי', 'Cactusi', 'common', 'צמח', 'קקטוס חייכן עם פרח ורוד על הראש.', { xp: 240 }, '🌵'),
  C(13, 'פיצי', 'Pizzi', 'common', 'מאכל', 'משולש פיצה שמחלק חיוכים לכולם.', { xp: 260 }, '🍕'),
  C(14, 'לולי הלאמה', 'Lully Llama', 'common', 'חיה', 'לאמה פרוותית עם כובע צמר וחיוך רגוע.', { xp: 280 }, '🦙'),
  C(15, 'אוקטה', 'Okta', 'common', 'חיה', 'תמנונית ספרנית – קוראת שמונה ספרים בבת אחת.', { xp: 300 }, '🐙'),
  C(16, 'ננסי', 'Nansi', 'common', 'חיה', 'נמלה חזקה שמרימה עלה פי עשרה ממנה.', { xp: 320 }, '🐜'),
  C(17, 'צפצופי', 'Tziftzufi', 'common', 'חיה', 'אפרוח צהוב שיצא עכשיו מהביצה, עם קליפה על הראש.', { xp: 340 }, '🐥'),
  C(18, 'קוביקו', 'Cubiko', 'common', 'דמות גיימינג', 'דמות משחק מרובעת שאוספת מטבעות כוכב.', { xp: 360 }, '🎲'),
  C(19, 'סושי סאמי', 'Sushi Sami', 'common', 'מאכל', 'רול סושי קטן ומסודר שאוהב סדר בשולחן.', { xp: 380 }, '🍣'),
  C(20, 'ירחי', 'Yarchi', 'common', 'דמות חלל', 'ירח קטן ומנומנם עם כרית כוכבים.', { xp: 400 }, '🌙'),
  // ---------- Uncommon (10) – unlock every 30 XP from 430 ----------
  C(21, 'שועלי הסייר', 'Scout Fox', 'uncommon', 'חיה', 'שועל עם מפה ומשקפת – מגלה שבילים חדשים.', { xp: 430 }, '🦊'),
  C(22, 'זמזומה', 'Zumzuma', 'uncommon', 'חיה', 'דבורה טייסת עם משקפי תעופה.', { xp: 460 }, '🐝'),
  C(23, 'גלגלית', 'Galgalit', 'uncommon', 'רובוט', 'רובוטית על גלגל אחד ששומרת על איזון מושלם.', { xp: 490 }, '⚙️'),
  C(24, 'כוכבון', 'Kochavon', 'uncommon', 'חיה', 'כוכב ים ורוד שמנצח על להקת דגים.', { xp: 520 }, '⭐'),
  C(25, 'פיקסל', 'Pixel', 'uncommon', 'דמות גיימינג', 'דמות שלבים מתקופת המשחקים הרטרו.', { xp: 550 }, '👾'),
  C(26, 'דונאטו', 'Donato', 'uncommon', 'דמות חלל', 'סופגנייה אסטרונאוטית בחליפת חלל.', { xp: 580 }, '🍩'),
  C(27, 'ינשופית', 'Yanshufit', 'uncommon', 'חיה', 'ינשופה מדענית עם משקפיים ומבחנה.', { xp: 610 }, '🦉'),
  C(28, 'נמרי', 'Namri', 'uncommon', 'חיה', 'גור נמר על סקייטבורד, עם קסדה וברכיות.', { xp: 640 }, '🐯'),
  C(29, 'מדוזית', 'Meduzit', 'uncommon', 'חיה', 'מדוזה שזוהרת בחושך כמו מנורת לילה.', { xp: 670 }, '🪼'),
  C(30, 'פרחונית', 'Pirchonit', 'uncommon', 'יצור קסום', 'פיה קטנה שגרה בתוך פרח חמנייה.', { xp: 700 }, '🌻'),
  // ---------- Rare (6) – unlock by achievements ----------
  C(31, 'קומטה', 'Cometa', 'rare', 'דמות חלל', 'חתולת שביט שמשאירה אחריה שובל של נצנצים.', { ach: 'ontime3' }, '☄️'),
  C(32, 'טורבו-בוט', 'Turbo-Bot', 'rare', 'רובוט', 'רובוט עם תרמיל סילון שעוזר לכל מי שנתקע.', { ach: 'exam85' }, '🚀'),
  C(33, 'אלונית', 'Alonit', 'rare', 'יצור קסום', 'רוח עץ עתיקה וחכמה, עם עלים שמשנים צבע.', { ach: 'unit_done' }, '🌳'),
  C(34, 'זוהרה', 'Zohara', 'rare', 'יצור קסום', 'גחלילית קסומה שמאירה את הדרך הביתה.', { ach: 'streak3' }, '✨'),
  C(35, 'גלקסי', 'Galaxy', 'rare', 'דמות חלל', 'לווייתן חלל ששוחה בין הכוכבים.', { ach: 'cards30' }, '🐋'),
  C(36, 'דרקוני', 'Drakoni', 'rare', 'יצור קסום', 'דרקון תינוק שנושף בועות סבון במקום אש.', { ach: 'project_sent' }, '🐉'),
  // ---------- Epic (3) ----------
  C(37, 'וולטי', 'Volty', 'epic', 'יצור קסום', 'ארנבת ברק שמטעינה את כולם באנרגיה טובה.', { xp: 760 }, '⚡'),
  C(38, 'נובה', 'Nova', 'epic', 'דמות חלל', 'שומרת הכוכבים, עם פנס שמדליק כוכבים חדשים.', { xp: 830 }, '🌟'),
  C(39, 'גרביטו', 'Gravito', 'epic', 'רובוט', 'רובוט-קוסם שמרחף ומרים קוביות בכוח הכבידה.', { xp: 900 }, '🔮'),
  // ---------- Legendary (1) ----------
  C(40, 'לומי – ציפור האור', 'Lumi, the Light Bird', 'legendary', 'יצור אגדי', 'ציפור האור של אלומה. נולדת מכל הניצוצות שאספת – הכי נדירה במשחק.', { xp: 960 }, '🕊️'),
];

export const cardById = id => CARDS.find(c => c.id === +id);
export function unlockText(c, achName = a => a) {
  return c.unlock.xp != null ? `נפתח ב-${c.unlock.xp} XP` : `נפתח בהישג: ${achName(c.unlock.ach)}`;
}
