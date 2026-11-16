import { CountryDef } from './countries';

export type SpokenLanguageCode =
  | 'en'
  | 'ur'
  | 'hi'
  | 'ru'
  | 'ar'
  | 'tr'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ja'
  | 'zh';

export type CommentaryLanguage = 'auto' | SpokenLanguageCode;

export interface LanguageOption {
  code: CommentaryLanguage;
  label: string;
}

export const COMMENTARY_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'auto', label: 'Auto (Match Countries)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'zh', label: 'Chinese (中文)' },
];

const LOCALIZED_NAMES: Partial<Record<SpokenLanguageCode, Record<string, string>>> = {
  ur: {
    PK: 'پاکستان', IN: 'بھارت', TR: 'ترکی', CN: 'چین', US: 'امریکہ', GB: 'برطانیہ',
    SA: 'سعودی عرب', AE: 'یو اے ای', IR: 'ایران', FR: 'فرانس', DE: 'جرمنی',
    BR: 'برازیل', AR: 'ارجنٹائن', JP: 'جاپان', RU: 'روس', UA: 'یوکرین',
    BD: 'بنگلہ دیش', AF: 'افغانستان', AU: 'آسٹریلیا', CA: 'کینیڈا', ES: 'سپین', IT: 'اٹلی',
    PS: 'فلسطین',
  },
  hi: {
    PK: 'पाकिस्तान', IN: 'भारत', TR: 'तुर्की', CN: 'चीन', US: 'अमेरिका', GB: 'ब्रिटेन',
    SA: 'सऊदी अरब', AE: 'यूएई', IR: 'ईरान', FR: 'फ्रांस', DE: 'जर्मनी',
    BR: 'ब्राज़ील', AR: 'अर्जेंटीना', JP: 'जापान', RU: 'रूस', UA: 'यूक्रेन',
    BD: 'बांग्लादेश', AF: 'अफगानिस्तान', AU: 'ऑस्ट्रेलिया', CA: 'कनाडा', ES: 'स्पेन', IT: 'इटली',
    PS: 'फिलिस्तीन',
  },
  ru: {
    PK: 'Пакистан', IN: 'Индия', TR: 'Турция', CN: 'Китай', US: 'США', GB: 'Британия',
    SA: 'Саудовская Аравия', AE: 'ОАЭ', IR: 'Иран', FR: 'Франция', DE: 'Германия',
    BR: 'Бразилия', AR: 'Аргентина', JP: 'Япония', RU: 'Россия', UA: 'Украина',
    BD: 'Бангладеш', AU: 'Австралия', CA: 'Канада', ES: 'Испания', IT: 'Италия',
    PS: 'Палестина',
  },
  ar: {
    PK: 'باكستان', IN: 'الهند', TR: 'تركيا', CN: 'الصين', US: 'أمريكا', GB: 'بريطانيا',
    SA: 'السعودية', AE: 'الإمارات', IR: 'إيران', FR: 'فرنسا', DE: 'ألمانيا',
    BR: 'البرازيل', AR: 'الأرجنتين', JP: 'اليابان', RU: 'روسيا', UA: 'أوكرانيا',
    EG: 'مصر', QA: 'قطر', ES: 'إسبانيا', IT: 'إيطاليا', PS: 'فلسطين',
  },
  tr: {
    PK: 'Pakistan', IN: 'Hindistan', TR: 'Türkiye', CN: 'Çin', US: 'Amerika', GB: 'İngiltere',
    SA: 'Suudi Arabistan', DE: 'Almanya', FR: 'Fransa', BR: 'Brezilya', RU: 'Rusya',
    JP: 'Japonya', ES: 'İspanya', IT: 'İtalya', PS: 'Filistin',
  },
  es: {
    PK: 'Pakistán', IN: 'India', TR: 'Turquía', CN: 'China', US: 'Estados Unidos', GB: 'Reino Unido',
    FR: 'Francia', DE: 'Alemania', BR: 'Brasil', AR: 'Argentina', MX: 'México',
    JP: 'Japón', RU: 'Rusia', ES: 'España', IT: 'Italia', PS: 'Palestina',
  },
  fr: {
    PK: 'Pakistan', IN: 'Inde', TR: 'Turquie', CN: 'Chine', US: 'États-Unis', GB: 'Royaume-Uni',
    FR: 'France', DE: 'Allemagne', BR: 'Brésil', AR: 'Argentine',
    JP: 'Japon', RU: 'Russie', ES: 'Espagne', IT: 'Italie', PS: 'Palestine',
  },
  de: {
    PK: 'Pakistan', IN: 'Indien', TR: 'Türkei', CN: 'China', US: 'USA', GB: 'Großbritannien',
    FR: 'Frankreich', DE: 'Deutschland', BR: 'Brasilien', AR: 'Argentinien',
    JP: 'Japan', RU: 'Russland', ES: 'Spanien', IT: 'Italien', PS: 'Palästina',
  },
  pt: {
    PK: 'Paquistão', IN: 'Índia', TR: 'Turquia', CN: 'China', US: 'Estados Unidos', GB: 'Reino Unido',
    FR: 'França', DE: 'Alemanha', BR: 'Brasil', PT: 'Portugal', AR: 'Argentina',
    JP: 'Japão', RU: 'Rússia', ES: 'Espanha', IT: 'Itália', PS: 'Palestina',
  },
  ja: {
    PK: 'パキスタン', IN: 'インド', TR: 'トルコ', CN: '中国', US: 'アメリカ', GB: 'イギリス',
    FR: 'フランス', DE: 'ドイツ', BR: 'ブラジル', AR: 'アルゼンチン',
    JP: '日本', RU: 'ロシア', ES: 'スペイン', IT: 'イタリア', PS: 'パレスチナ',
  },
  zh: {
    PK: '巴基斯坦', IN: '印度', TR: '土耳其', CN: '中国', US: '美国', GB: '英国',
    FR: '法国', DE: '德国', BR: '巴西', AR: '阿根廷',
    JP: '日本', RU: '俄罗斯', ES: '西班牙', IT: '意大利', PS: '巴勒斯坦',
  },
};

export function resolveSpokenLanguage(
  setting: CommentaryLanguage,
  rosterCodes: string[]
): SpokenLanguageCode {
  if (setting !== 'auto') return setting;
  const has = (code: string) => rosterCodes.includes(code);
  if (has('PK')) return 'ur';
  if (has('IN')) return 'hi';
  if (has('RU')) return 'ru';
  if (has('SA') || has('AE') || has('EG') || has('QA') || has('PS')) return 'ar';
  if (has('TR')) return 'tr';
  if (has('JP')) return 'ja';
  if (has('CN')) return 'zh';
  if (has('ES') || has('AR') || has('MX')) return 'es';
  if (has('FR')) return 'fr';
  if (has('DE')) return 'de';
  if (has('BR') || has('PT')) return 'pt';
  return 'en';
}

export function getCountrySpokenName(country: CountryDef, lang: SpokenLanguageCode): string {
  return LOCALIZED_NAMES[lang]?.[country.code] || country.name;
}

export function getCountdownSpeech(step: 3 | 2 | 1 | 0, lang: SpokenLanguageCode): { text: string; display: string } {
  const map: Record<SpokenLanguageCode, [string, string, string, string]> = {
    en: ['Three', 'Two', 'One', 'LIGHTS OUT AND AWAY WE GO! Full throttle off the Grand Prix grid!'],
    ur: ['تین', 'دو', 'ایک', 'چلو! فارمولا گرینڈ پری شروع، گاڑیاں فل اسپیڈ میں ٹریک پر دوڑ پڑی ہیں!'],
    hi: ['तीन', 'दो', 'एक', 'चलो! रोमांचक फॉर्मूला रेस शुरू! दर्शक झूम उठे हैं और कारें तेज़ रफ़्तार से दौड़ पड़ी हैं!'],
    ru: ['Три', 'Два', 'Один', 'СТАРТ! Гран-при Формулы начался! Болиды срываются с места на полной скорости!'],
    ar: ['ثلاثة', 'اثنان', 'واحد', 'انطلاق! بدأت جائزة الفورمولا الكبرى وسط هتاف الجماهير!'],
    tr: ['Üç', 'İki', 'Bir', 'VE BAŞLADI! Formula Büyük Yarışı tribünlerin coşkusuyla start aldı!'],
    es: ['Tres', 'Dos', 'Uno', '¡SE APAGAN LAS LUCES Y ARRANCAN! ¡Máxima velocidad en el Gran Premio!'],
    fr: ['Trois', 'Deux', 'Un', 'ET C’EST PARTI! Les voitures s’élancent à pleine puissance sous les acclamations!'],
    de: ['Drei', 'Zwei', 'Eins', 'LICHTER AUS UND LOS GEHT’S! Vollgas auf der Grand-Prix-Strecke!'],
    pt: ['Três', 'Dois', 'Um', 'LUZES APAGADAS E LARGARAM! Aceleração máxima no Grande Prêmio!'],
    ja: ['さん', 'に', 'いち', 'スタート！大歓声の中、フォーミュラカーが一斉に飛び出しました！'],
    zh: ['三', '二', '一', '出发！全场沸腾，方程式赛车全速冲出起跑线！'],
  };
  const idx = step === 3 ? 0 : step === 2 ? 1 : step === 1 ? 2 : 3;
  return { text: map[lang][idx], display: map[lang][idx] };
}

export type RaceEventKind = 'overtake' | 'pitstop' | 'hurdle' | 'halfway' | 'finallap' | 'pace' | 'victory';

const lastPickMap = new Map<string, number>();

function pickNonRepeating(key: string, items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  const prev = lastPickMap.get(key) ?? -1;
  let idx = Math.floor(Math.random() * items.length);
  if (idx === prev) {
    idx = (prev + 1 + Math.floor(Math.random() * (items.length - 1))) % items.length;
  }
  lastPickMap.set(key, idx);
  return items[idx];
}

export function buildRaceCommentary(
  kind: RaceEventKind,
  lang: SpokenLanguageCode,
  leaderName: string,
  rivalName: string,
  kmh: number,
  pct: number,
  zoneName = ''
): string {
  const L = leaderName;
  const R = rivalName || leaderName;
  const Z = zoneName.trim();
  const phase: 'early' | 'mid' | 'late' = pct < 32 ? 'early' : pct < 75 ? 'mid' : 'late';

  if (lang === 'ur') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`ur:ot`, [
          `${L} نے اندرونی لائن سے ${R} کو کراس کر کے پہلی پوزیشن سنبھال لی!`,
          `تیز بریکنگ کے بعد ${L} آگے نکل گیا، ${R} اب دوسرے نمبر پر پیچھے رہ گیا ہے!`,
          `${L} کی زبردست رفتار! سلپ اسٹریم کا پورا فائدہ اٹھا کر ${R} سے برتری چھین لی!`,
          `پہلی پوزیشن بدل گئی! ${L} نے کلین موو کے ساتھ ${R} کو پیچھے چھوڑ دیا!`,
          `${R} نے راستہ روکنے کی کوشش کی مگر ${L} فل تھراٹل کے ساتھ آگے نکل آیا!`,
        ]);
      case 'pitstop':
        return pickNonRepeating(`ur:pit`, [
          `${L} ٹائر تبدیل کرنے کے لیے پٹ لین میں داخل ہو رہا ہے، قیمتی سیکنڈز داؤ پر ہیں!`,
          `تازہ ٹائرز لگ چکے ہیں! ورکشاپ سے نکل کر ${L} دوبارہ ریس ٹریک پر دوڑ پڑا ہے!`,
          `پٹ اسٹاپ اسٹریٹجی! ${L} نے نئی ربڑ گرپ حاصل کر لی، اب رفتار پھر بڑھے گی!`,
        ]);
      case 'halfway':
        return `ریس کا آدھا فاصلہ مکمل! ${L} اس وقت ${kmh} کلومیٹر فی گھنٹہ کی رفتار سے آگے ہے اور ${R} تعاقب جاری رکھے ہوئے ہے!`;
      case 'finallap':
        return `آخری مرحلہ شروع ہو چکا ہے! ${L} اور ${R} کے درمیان فنش لائن تک سیدھا مقابلہ باقی ہے!`;
      case 'victory':
        return pickNonRepeating(`ur:win`, [
          `چیکرڈ فلیگ لہرایا! ${L} نے بہترین رفتار کے ساتھ ${R} کو پچھاڑ کر فارمولا گرینڈ پری جیت لی!`,
          `ریس کا اختتام! ${L} پہلے نمبر پر فنش لائن عبور کر کے چیمپئن بن گیا!`,
          `شاندار اختتام! ${L} نے تمام حریفوں کو پیچھے چھوڑ کر پہلی پوزیشن اپنے نام کر لی!`,
        ]);
      default: {
        if (phase === 'early') {
          return pickNonRepeating(`ur:early`, [
            `ابتدائی لیپ میں تمام گاڑیاں تیز رفتار قافلے کی صورت میں ہیں، ${L} سب سے آگے دوڑ رہا ہے!`,
            `ریس اپنے ابتدائی موڑ پر ہے، ${L} ${kmh} کی سپیڈ پر گرپ مضبوط کر رہا ہے اور ${R} بالکل پیچھے ہے!`,
            `شروع کے میلوں میں ٹائر گرم ہو رہے ہیں، ${L} نے فرنٹ لین پکڑ لی ہے!`,
          ]);
        }
        if (phase === 'late') {
          return pickNonRepeating(`ur:late`, [
            `فنش لائن اب زیادہ دور نہیں! ${L} ${kmh} کی سپیڈ پر لیڈ بچا رہا ہے جبکہ ${R} آخری حملے کی تیاری میں ہے!`,
            `اختتامی سیکنڈز قریب آ رہے ہیں، ${L} اور ${R} کے بیچ فاصلہ تیزی سے کم ہو رہا ہے!`,
            `ٹائر دباؤ کا شکار ہیں مگر ${L} پوری طاقت سے فنش کی طرف بڑھ رہا ہے!`,
          ]);
        }
        return pickNonRepeating(`ur:mid`, [
          Z
            ? `${Z} کے ٹریک پر ${L} ${kmh} کلومیٹر فی گھنٹہ کی رفتار سے آگے نکل رہا ہے!`
            : `ریس کے درمیانی حصے میں ${L} مسلسل تیز لیپ لگا رہا ہے اور ${R} دباؤ بڑھا رہا ہے!`,
          `مضبوط بریکنگ اور شاندار کارنر ایگزٹ کے ساتھ ${L} برتری برقرار رکھے ہوئے ہے!`,
          `${R} مسلسل پیچھے سے فاصلہ کم کر رہا ہے، اگلے موڑ پر اوورٹیک کی کوشش ہو سکتی ہے!`,
        ]);
      }
    }
  }

  if (lang === 'hi') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`hi:ot`, [
          `${L} ने इनसाइड लाइन से निकलते हुए ${R} को पीछे छोड़ दिया और नंबर एक पर आ गए!`,
          `बेहतरीन ब्रेकिंग! ${L} ने ${R} से बढ़त छीनकर ट्रैक पर कमान संभाल ली है!`,
          `स्लिपस्ट्रीम का पूरा फायदा! ${L} ने ${R} को पछाड़कर शानदार ओवरटेक किया!`,
          `पहली पोजीशन बदल गई है—${L} अब ${R} से आगे निकलकर लीड कर रहे हैं!`,
        ]);
      case 'pitstop':
        return pickNonRepeating(`hi:pit`, [
          `${L} नए टायर लगाने के लिए पिट वर्कशॉप में रुक गए हैं!`,
          `तेज़ पिट स्टॉप पूरा! ${L} नई ग्रिप के साथ फिर से रेस में लौट आए हैं!`,
        ]);
      case 'halfway':
        return `आधी दूरी तय हो चुकी है! ${L} इस समय ${kmh} की रफ़्तार से आगे हैं और ${R} कड़ी टक्कर दे रहे हैं!`;
      case 'finallap':
        return `आखिरी चरण शुरू! फिनिश लाइन तक ${L} और ${R} के बीच सीधा मुकाबला तय है!`;
      case 'victory':
        return pickNonRepeating(`hi:win`, [
          `चेकर्ड फ्लैग! ${L} ने ${R} को पछाड़कर ग्रैंड प्रिक्स अपने नाम कर ली है!`,
          `रेस समाप्त! ${L} ने सबसे पहले फिनिश लाइन पार कर जीत हासिल की!`,
        ]);
      default: {
        if (phase === 'early') {
          return pickNonRepeating(`hi:early`, [
            `शुरुआती किलोमीटर में कारें एक साथ रफ़्तार पकड़ रही हैं, ${L} सबसे आगे चल रहे हैं!`,
            `टायर तापमान पकड़ रहे हैं और ${L} ${kmh} की गति से बढ़त बना रहे हैं!`,
          ]);
        }
        if (phase === 'late') {
          return pickNonRepeating(`hi:late`, [
            `फिनिश लाइन करीब है! ${L} आगे हैं लेकिन ${R} लगातार अंतर कम कर रहे हैं!`,
            `अंतिम मोड़ों पर मुकाबला कड़ा है—${L} ${kmh} की रफ़्तार से बढ़त बचाए हुए हैं!`,
          ]);
        }
        return pickNonRepeating(`hi:mid`, [
          Z
            ? `${Z} सेक्टर में ${L} पूरी रफ़्तार से बढ़त बनाए हुए हैं!`
            : `मिड-रेस में ${L} और ${R} के बीच तेज़ रफ़्तार की जंग जारी है!`,
          `${R} ड्राफ्टिंग का फायदा उठाकर ${L} के करीब आ रहे हैं!`,
        ]);
      }
    }
  }

  if (lang === 'ru') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`ru:ot`, [
          `${L} атакует по внутреннему радиусу и проходит ${R} в борьбе за лидерство!`,
          `Отличный слипстрим! ${L} опережает ${R} и выходит на первую позицию!`,
          `Смена лидера! ${L} на позднем торможении оставляет ${R} позади!`,
        ]);
      case 'pitstop':
        return `${L} заезжает на пит-лейн за свежими шинами и сразу возвращается на трассу!`;
      case 'halfway':
        return `Половина дистанции пройдена! ${L} идёт со скоростью ${kmh} км/ч, преследуемый ${R}!`;
      case 'finallap':
        return `Финальный отрезок! До финиша рукой подать—${L} и ${R} идут на пределе!`;
      case 'victory':
        return `Клетчатый флаг! ${L} первым пересекает линию и побеждает перед ${R}!`;
      default:
        return phase === 'early'
          ? `На стартовом отрезке пелотон плотно держит темп, ${L} задаёт скорость!`
          : phase === 'late'
            ? `Решающие километры гонки! ${L} защищает отрыв от атакующего ${R}!`
            : `${Z ? `${Z}: ` : ''}${L} стабильно проходит повороты на ${kmh} км/ч под давлением ${R}!`;
    }
  }

  if (lang === 'ar') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`ar:ot`, [
          `${L} ينقض من المسار الداخلي ويتجاوز ${R} نحو الصدارة!`,
          `تجاوز نظيف في المنعطف! ${L} ينتزع المركز الأول من ${R}!`,
          `${L} يستغل قوة الدفع الخلفي ويتقدم أمام ${R}!`,
        ]);
      case 'pitstop':
        return `${L} يدخل ورشة الصيانة لتبديل الإطارات ويعود سريعاً للمنافسة!`;
      case 'halfway':
        return `منتصف السباق! ${L} يتصدر بسرعة ${kmh} كيلومتراً في الساعة وخلفه ${R}!`;
      case 'finallap':
        return `الأمتار الأخيرة نحو خط النهاية! ${L} يدافع أمام ضغط ${R}!`;
      case 'victory':
        return `العلم الشطرنجي! ${L} يعبر أولاً ويحسم اللقب أمام ${R}!`;
      default:
        return phase === 'early'
          ? `انطلاقة سريعة في اللفات الأولى و${L} يقود المجموعة!`
          : phase === 'late'
            ? `اللحظات الحاسمة من السباق! ${L} و${R} في صراع مباشر حتى النهاية!`
            : `${Z ? `${Z}: ` : ''}${L} يحافظ على وتيرته العالية بسرعة ${kmh} ومطاردة مستمرة من ${R}!`;
    }
  }

  if (lang === 'tr') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`tr:ot`, [
          `${L} iç çizgiden daldı ve ${R}’i geçerek liderliği aldı!`,
          `Harika bir geçiş! ${L} hava koridorunu kullanıp ${R}’in önüne fırladı!`,
          `Lider el değiştirdi! ${L} temiz bir atakla ${R}’i geride bıraktı!`,
        ]);
      case 'pitstop':
        return `${L} taze lastikler için pite girdi, hızlı değişim sonrası tekrar pistte!`;
      case 'halfway':
        return `Yarışın yarısı tamamlandı! ${L} saatte ${kmh} km hızla önde, ${R} takipte!`;
      case 'finallap':
        return `Son bölüme girildi! Finişe kadar ${L} ve ${R} arasında nefes kesen mücadele!`;
      case 'victory':
        return `Damalı bayrak! ${L} bitiş çizgisini ilk sırada geçerek yarışı kazandı!`;
      default:
        return phase === 'early'
          ? `İlk bölümlerde grup birbirine çok yakın, ${L} tempoyu belirliyor!`
          : phase === 'late'
            ? `Artık son düzlüklere geliyoruz! ${L} liderliği korumaya çalışıyor, ${R} farkı kapatıyor!`
            : `${Z ? `${Z} kesiminde ` : ''}${L} yüksek hızını koruyor, ${R} hemen arkasında!`;
    }
  }

  if (lang === 'es') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`es:ot`, [
          `¡${L} se lanza por el interior y supera a ${R} por el primer puesto!`,
          `¡Qué maniobra! ${L} aprovecha el rebufo y deja atrás a ${R}!`,
        ]);
      case 'pitstop':
        return `¡${L} entra en boxes para montar neumáticos nuevos y vuelve al asfalto!`;
      case 'halfway':
        return `¡Mitad de carrera! ${L} rueda a ${kmh} por hora con ${R} presionando atrás!`;
      case 'finallap':
        return `¡Recta final hacia la meta! ¿Aguantará ${L} el ataque de ${R}?`;
      case 'victory':
        return `¡Bandera a cuadros! ¡${L} cruza primero y vence a ${R}!`;
      default:
        return phase === 'early'
          ? `Primeros kilómetros muy compactos con ${L} marcando el ritmo al frente!`
          : phase === 'late'
            ? `¡Últimos kilómetros de tensión pura entre ${L} y ${R}!`
            : `${Z ? `${Z}: ` : ''}${L} mantiene un gran ritmo a ${kmh} con ${R} encima!`;
    }
  }

  if (lang === 'fr') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`fr:ot`, [
          `${L} plonge à l’intérieur et double ${R} pour prendre la tête !`,
          `Superbe aspiration de ${L} qui passe devant ${R} !`,
        ]);
      case 'pitstop':
        return `${L} passe par les stands pour chausser des pneus neufs et repart !`;
      case 'halfway':
        return `Mi-course ! ${L} file à ${kmh} km/h juste devant ${R} !`;
      case 'finallap':
        return `Dernier secteur avant le drapeau à damier entre ${L} et ${R} !`;
      case 'victory':
        return `Victoire de ${L} qui franchit la ligne devant ${R} !`;
      default:
        return phase === 'early'
          ? `Début de course très serré avec ${L} aux commandes !`
          : phase === 'late'
            ? `Fin de course tendue ! ${R} met une pression constante sur ${L} !`
            : `${Z ? `${Z} : ` : ''}${L} tient un rythme soutenu à ${kmh} km/h !`;
    }
  }

  if (lang === 'de') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`de:ot`, [
          `${L} sticht innen hinein und überholt ${R} für Platz eins!`,
          `Starkes Manöver im Windschatten—${L} zieht an ${R} vorbei!`,
        ]);
      case 'pitstop':
        return `${L} kommt zum Reifenwechsel an die Box und fährt direkt wieder heraus!`;
      case 'halfway':
        return `Halbzeit! ${L} fährt mit ${kmh} km/h vorweg, direkt verfolgt von ${R}!`;
      case 'finallap':
        return `Die letzten Kilometer bis ins Ziel—${L} gegen ${R}!`;
      case 'victory':
        return `Zielflagge! ${L} gewinnt vor ${R}!`;
      default:
        return phase === 'early'
          ? `Hohes Tempo in der Anfangsphase—${L} führt das Feld an!`
          : phase === 'late'
            ? `Schlussphase! ${L} verteidigt die Linie gegen den Angriff von ${R}!`
            : `${Z ? `${Z}: ` : ''}${L} hält die Pace bei ${kmh} km/h!`;
    }
  }

  if (lang === 'pt') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`pt:ot`, [
          `${L} mergulha por dentro e passa ${R} para assumir a ponta!`,
          `Belo vácuo de ${L} deixando ${R} para trás!`,
        ]);
      case 'pitstop':
        return `${L} entra nos boxes para trocar pneus e volta rápido para a pista!`;
      case 'halfway':
        return `Metade da prova! ${L} acelera forte com ${R} logo atrás!`;
      case 'finallap':
        return `Reta final até a bandeirada! ${L} tenta segurar ${R}!`;
      case 'victory':
        return `Bandeira quadriculada! ${L} vence diante de ${R}!`;
      default:
        return phase === 'early'
          ? `Início de prova muito disputado com ${L} na liderança!`
          : phase === 'late'
            ? `Voltas finais decisivas entre ${L} e ${R}!`
            : `${Z ? `${Z}: ` : ''}${L} mantém bom ritmo a ${kmh} km/h!`;
    }
  }

  if (lang === 'ja') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`ja:ot`, [
          `${L}がインを突いて${R}をかわし、トップに立ちました！`,
          `スリップストリームから${L}が一気に${R}を抜き去りました！`,
        ]);
      case 'pitstop':
        return `${L}がピットイン！新品タイヤに交換してコースへ戻ります！`;
      case 'halfway':
        return `レース折り返し！${L}が時速${kmh}キロで先頭、${R}が追います！`;
      case 'finallap':
        return `終盤戦突入！チェッカーフラッグまで${L}と${R}の勝負です！`;
      case 'victory':
        return `チェッカーフラッグ！${L}が${R}を抑えて優勝しました！`;
      default:
        return phase === 'early'
          ? `序盤は接戦模様！${L}がトップでペースを握っています！`
          : phase === 'late'
            ? `ゴールが近づいています！${L}が逃げ切るか、${R}が追いつくか！`
            : `${Z ? `${Z}付近で` : ''}${L}が安定した走りでリードを守っています！`;
    }
  }

  if (lang === 'zh') {
    switch (kind) {
      case 'overtake':
        return pickNonRepeating(`zh:ot`, [
          `${L}从内线切入超越${R}，抢占第一！`,
          `漂亮的尾流超车！${L}甩开${R}来到领跑位置！`,
        ]);
      case 'pitstop':
        return `${L}进站更换新轮胎，迅速重返赛道！`;
      case 'halfway':
        return `赛程过半！${L}正以${kmh}公里时速领跑，${R}紧追在后！`;
      case 'finallap':
        return `进入最后冲刺阶段！${L}与${R}向终点发起决战！`;
      case 'victory':
        return `黑白方格旗挥舞！${L}力压${R}率先冲线夺冠！`;
      default:
        return phase === 'early'
          ? `比赛初期车阵紧凑，${L}暂时领跑！`
          : phase === 'late'
            ? `临近终点！${L}全力守住线路，防备${R}的反扑！`
            : `${Z ? `${Z}路段，` : ''}${L}保持高节奏领先，${R}正在缩小差距！`;
    }
  }

  // English default: Genuine, varied F1 broadcast calls by race phase
  switch (kind) {
    case 'overtake':
      return pickNonRepeating('en:ot', [
        `${L} dives up the inside under braking and takes P1 away from ${R}!`,
        `Clean slipstream pass! ${L} sweeps past ${R} into the lead!`,
        `Lead change! ${L} carries huge exit speed to move ahead of ${R}!`,
        `Side-by-side through the corner and ${L} edges clear of ${R} for first place!`,
        `${R} tried to defend the apex, but ${L} blasts through around the outside!`,
      ]);
    case 'pitstop':
      return pickNonRepeating('en:pit', [
        `${L} dives into the pit lane for fresh rubber—every tenth of a second counts!`,
        `Quick workshop turnaround for ${L}, exiting right back into the traffic!`,
        `Fresh tire strategy coming into play as ${L} rejoins on clean grip!`,
      ]);
    case 'halfway':
      return `Halfway mark! ${L} is running ${kmh} kilometers per hour up front with ${R} in pursuit.`;
    case 'finallap':
      return `Final stretch to the line! ${L} has ${R} right in the mirrors for the finish!`;
    case 'victory':
      return pickNonRepeating('en:win', [
        `Checkered flag! ${L} holds off ${R} to take the Grand Prix victory!`,
        `Across the line first—${L} wins the Vortexia Global Battle!`,
        `What a drive! ${L} seals first place ahead of ${R}!`,
      ]);
    default: {
      if (phase === 'early') {
        return pickNonRepeating('en:early', [
          `Early kilometers on the road, cars finding clean air behind ${L} at ${kmh} kilometers per hour.`,
          `Tires are coming up to temperature as ${L} sets the opening pace ahead of ${R}.`,
          `Tight pack through the opening bends—${L} keeps the nose clean out front.`,
        ]);
      }
      if (phase === 'late') {
        return pickNonRepeating('en:late', [
          `Closing stretch now—${L} needs clean exits with ${R} hunting every meter!`,
          `Into the final kilometers, ${L} defends the inside line at ${kmh} kilometers per hour!`,
          `Not much road left! ${L} and ${R} are pushing their remaining grip to the limit!`,
        ]);
      }
      return pickNonRepeating('en:mid', [
        Z
          ? `Sweeping through ${Z}, ${L} keeps strong cornering pace ahead of ${R}.`
          : `Strong mid-race rhythm from ${L} at ${kmh}, while ${R} closes in through the draft.`,
        `${R} is eating into the gap behind ${L}—watch for a move down the next straight.`,
        `Clean driving lines here as ${L} manages tire grip and stays ahead of ${R}.`,
      ]);
    }
  }
}

export function buildFighterCommentary(
  kind: 'fight' | 'eliminate' | 'combo' | 'pace' | 'ko' | 'victory',
  lang: SpokenLanguageCode,
  roundNum: number,
  winnerName = '',
  loserName = '',
  remainingCount = 2
): string {
  const W = winnerName || 'Fighter';
  const L = loserName || 'opponent';

  if (lang === 'ur') {
    switch (kind) {
      case 'fight':
        return `راؤنڈ ${roundNum} شروع! سب فائٹرز آمنے سامنے آ گئے ہیں، زبردست مقابلے کے لیے تیار ہو جائیں!`;
      case 'eliminate':
        return pickNonRepeating('ur:felim', [
          `زبردست وار! ${W} نے ${L} کو ناک آؤٹ کر دیا—اب رنگ میں ${remainingCount} فائٹرز باقی ہیں اور مقابلہ مزید سخت ہو گا!`,
          `${W} نے طاقتور کِک سے ${L} کو باہر کر دیا! اب دیکھتے ہیں باقی کھلاڑی کیسے حملہ کرتے ہیں!`,
          `${L} زمین پر گر گئے اور آؤٹ ہو گئے! ${W} اب اگلے شکار کی طرف بڑھ رہے ہیں!`,
          `تگڑا فنش! ${W} نے ${L} کو شکست دے دی، اب میدان میں ${remainingCount} ممالک رہ گئے ہیں!`,
        ]);
      case 'combo':
        return pickNonRepeating('ur:fcombo', [
          `${W} نے ${L} پر مسلسل کومبو جڑ دیا! اگر یہی رفتار رہی تو جلد ہی ایک اور ناک آؤٹ ہو سکتا ہے!`,
          `بھاری وار! ${W} اس وقت ${L} پر مکمل حاوی ہیں، بچنا مشکل لگ رہا ہے!`,
          `${W} کا زبردست لانچر اٹیک! ${L} دفاع کرنے کی کوشش میں پیچھے ہٹ رہے ہیں!`,
        ]);
      case 'pace':
        return pickNonRepeating('ur:fpace', [
          `${W} اس وقت رنگ میں تیز حملے کر رہے ہیں اور ${L} پر دباؤ بڑھا رہے ہیں—اب اگلا موو فیصلہ کن ہو سکتا ہے!`,
          `زبردست ٹکر جاری ہے! ${W} اور ${L} آمنے سامنے ہیں، اب ہر کِک پر پانسہ پلٹ سکتا ہے!`,
          `رنگ میں ${remainingCount} فائٹرز باقی ہیں اور ${W} مسلسل اگلی برتری کی تلاش میں ہیں!`,
        ]);
      case 'ko':
        return pickNonRepeating('ur:fko', [
          `ناک آؤٹ! ${W} کا زبردست فائنل وار، راؤنڈ اپنے نام کر لیا!`,
          `کمال کا فائنل کِک! ${W} نے آخری حریف کو بھی گرا کر راؤنڈ جیت لیا!`,
          `${W} نے مقابلہ ختم کر دیا اور زبردست فتح سمیٹی!`,
        ]);
      case 'victory':
        return `شاندار فتح! ${W} نے ${L} سمیت سب کو شکست دے کر ٹورنامنٹ کا ٹائٹل جیت لیا!`;
    }
  }

  if (lang === 'hi') {
    switch (kind) {
      case 'fight':
        return `राउंड ${roundNum} शुरू! सभी फाइटर्स एक साथ रिंग में भिड़ने को तैयार हैं!`;
      case 'eliminate':
        return pickNonRepeating('hi:felim', [
          `ज़बरदस्त वार! ${W} ने ${L} को नॉकआउट कर दिया—अब सिर्फ ${remainingCount} फाइटर्स बचे हैं!`,
          `${W} की करारी किक से ${L} बाहर! अब मुकाबला और तेज़ होने वाला है!`,
          `${L} ढेर हो गए! ${W} ने उन्हें बाहर कर अगले विरोधी पर निशाना साध लिया है!`,
        ]);
      case 'combo':
        return pickNonRepeating('hi:fcombo', [
          `${W} ने ${L} पर ताबड़तोड़ कॉम्बो लगा दिया है—जल्द ही नॉकआउट हो सकता है!`,
          `शानदार हमला! ${W} इस समय ${L} पर पूरी तरह भारी पड़ रहे हैं!`,
        ]);
      case 'pace':
        return pickNonRepeating('hi:fpace', [
          `${W} रिंग के बीच में ${L} पर दबाव बना रहे हैं, अगली किक बहुत बड़ा फर्क डाल सकती है!`,
          `रिंग में ${remainingCount} देश बाकी हैं और ${W} लगातार आक्रमण कर रहे हैं!`,
        ]);
      case 'ko':
        return pickNonRepeating('hi:fko', [
          `नॉकआउट! ${W} ने राउंड अपने नाम किया!`,
          `ज़बरदस्त किक! ${W} ने बाज़ी जीत ली!`,
        ]);
      case 'victory':
        return `शानदार जीत! ${W} इस मुकाबले के चैंपियन बने!`;
    }
  }

  if (lang === 'ru') {
    if (kind === 'fight') return `Раунд ${roundNum}! В бой!`;
    if (kind === 'eliminate') return `Мощный удар! ${W} отправляет ${L} в нокаут—осталось ${remainingCount} бойцов!`;
    if (kind === 'combo') return `Серия атак от ${W} против ${L}! Следующий удар может стать решающим!`;
    if (kind === 'pace') return `${W} давит на ${L}, на арене остаётся ${remainingCount} стран!`;
    if (kind === 'ko') return `Нокаут! ${W} забирает раунд!`;
    return `Победа! ${W} становится чемпионом!`;
  }
  if (lang === 'ar') {
    if (kind === 'fight') return `الجولة ${roundNum}! ابدأ!`;
    if (kind === 'eliminate') return `ضربة قاضية! ${W} يقصي ${L}—تبقى ${remainingCount} مقاتلين في الحلبة!`;
    if (kind === 'combo') return `هجوم متتالي من ${W} على ${L}! المواجهة تشتعل الآن!`;
    if (kind === 'pace') return `${W} يضغط بقوة على ${L} وسط الحلبة!`;
    if (kind === 'ko') return `ضربة قاضية! ${W} يحسم الجولة!`;
    return `انتصار ساحق! ${W} بطل المواجهة!`;
  }
  if (lang === 'tr') {
    if (kind === 'fight') return `Raunt ${roundNum}! Dövüş!`;
    if (kind === 'eliminate') return `Nakavt! ${W}, ${L}’i ringden eledi—geriye ${remainingCount} dövüşçü kaldı!`;
    if (kind === 'combo') return `${W}, ${L}’e sert bir kombo indirdi—sıradaki darbe belirleyici olabilir!`;
    if (kind === 'pace') return `${W}, ${L} karşısında baskıyı artırıyor!`;
    if (kind === 'ko') return `Nakavt! ${W} raundu kazandı!`;
    return `Zafer! ${W} şampiyon oldu!`;
  }
  if (lang === 'ja') {
    if (kind === 'fight') return `ラウンド ${roundNum}！ファイト！`;
    if (kind === 'eliminate') return `ノックアウト！${W}が${L}を撃破！残り${remainingCount}名！`;
    if (kind === 'combo') return `${W}が${L}に連続コンボ！次の一撃が勝負を分けます！`;
    if (kind === 'pace') return `${W}が${L}を激しく攻め立てています！`;
    if (kind === 'ko') return `ノックアウト！${W}の勝利！`;
    return `優勝は${W}！`;
  }
  if (lang === 'zh') {
    if (kind === 'fight') return `第${roundNum}回合！开始！`;
    if (kind === 'eliminate') return `击倒！${W}淘汰了${L}，场上还剩${remainingCount}名选手！`;
    if (kind === 'combo') return `${W}对${L}打出连续重击，局势正在迅速变化！`;
    if (kind === 'pace') return `${W}持续向${L}施压，接下来的交锋将非常关键！`;
    if (kind === 'ko') return `击倒！${W}拿下这一局！`;
    return `冠军诞生！${W}赢得最终胜利！`;
  }

  // English default: Real-time, vivid play-by-play announcing who hit/KO'd whom and what comes next!
  switch (kind) {
    case 'fight':
      return `Round ${roundNum} is underway! All fighters drop into the ring together—ready, fight!`;
    case 'eliminate':
      return pickNonRepeating('en:felim', [
        `Knockout! ${W} just knocked out ${L}—only ${remainingCount} fighters left, the pace is heating up!`,
        `${W} takes down ${L} with a clean strike! Watch how ${W} turns on the next rival now!`,
        `Down goes ${L}! ${W} gets the elimination, leaving ${remainingCount} contenders battling for survival!`,
        `${W} finishes off ${L} cleanly—now every remaining fighter has to watch their guard!`,
      ]);
    case 'combo':
      return pickNonRepeating('en:fcombo', [
        `Big combo from ${W} onto ${L}! If ${L} doesn't block soon, this could end fast!`,
        `${W} lands a heavy launcher on ${L}—expect an all-out counterattack next!`,
        `Furious pressure! ${W} is chaining strikes on ${L} right in the center of the ring!`,
      ]);
    case 'pace':
      return pickNonRepeating('en:fpace', [
        `${W} is controlling the ring and pressing ${L} hard—the next clean kick could change everything!`,
        `Nonstop action with ${remainingCount} left standing! ${W} and ${L} are trading heavy shots!`,
        `${W} pushes forward against ${L}—watch for a Rage Art or spinning kick any second now!`,
      ]);
    case 'ko':
      return pickNonRepeating('en:fko', [
        `Knockout! ${W} takes the round with a decisive finish!`,
        `Clean strike finishes it—${W} claims the round!`,
        `Down goes the last opponent! ${W} wins the round!`,
      ]);
    case 'victory':
      return `Victory! ${W} defeats ${L} and stands tall as the Vortexia Global Battle Champion!`;
  }
}

export function buildArenaCommentary(
  kind: 'out' | 'victory',
  lang: SpokenLanguageCode,
  countryName: string
): string {
  if (lang === 'ur') {
    return kind === 'out'
      ? pickNonRepeating('ur:aout', [
          `${countryName} رنگ سے باہر ہو گیا!`,
          `${countryName} ٹورنامنٹ سے ایلیمینیٹ!`,
          `${countryName} کی ہار، رنگ میں باقی ملکوں کا مقابلہ تیز!`,
        ])
      : `شاندار جیت! ${countryName} اس راؤنڈ کا فاتح بن گیا!`;
  }
  if (lang === 'hi') {
    return kind === 'out'
      ? pickNonRepeating('hi:aout', [
          `${countryName} रिंग से बाहर हो गया!`,
          `${countryName} इस राउंड से एलिमिनेट हो गया!`,
        ])
      : `शानदार जीत! ${countryName} विजेता बन गया!`;
  }
  if (lang === 'ar') {
    return kind === 'out' ? `خروج ${countryName} من الحلبة!` : `انتصار عظيم! ${countryName} الفائز!`;
  }
  if (lang === 'tr') {
    return kind === 'out' ? `${countryName} elendi!` : `Muhteşem zafer! ${countryName} kazandı!`;
  }
  if (lang === 'ru') {
    return kind === 'out' ? `${countryName} выбывает из круга!` : `Победа! ${countryName} чемпион!`;
  }
  if (lang === 'es') {
    return kind === 'out' ? `¡${countryName} queda eliminado!` : `¡Victoria para ${countryName}!`;
  }
  if (lang === 'fr') {
    return kind === 'out' ? `${countryName} est éliminé !` : `Victoire de ${countryName} !`;
  }
  if (lang === 'de') {
    return kind === 'out' ? `${countryName} ist ausgeschieden!` : `Sieg für ${countryName}!`;
  }
  if (lang === 'pt') {
    return kind === 'out' ? `${countryName} foi eliminado!` : `Vitória de ${countryName}!`;
  }
  if (lang === 'ja') {
    return kind === 'out' ? `${countryName}が脱落しました！` : `優勝は${countryName}！`;
  }
  if (lang === 'zh') {
    return kind === 'out' ? `${countryName}被淘汰出局！` : `冠军是${countryName}！`;
  }
  return kind === 'out'
    ? pickNonRepeating('en:aout', [
        `${countryName} is eliminated!`,
        `${countryName} gets knocked out of the ring!`,
        `Out goes ${countryName}!`,
      ])
    : `Victory! ${countryName} wins!`;
}

export interface CustomCommentaryConfig {
  enableCountdown: boolean;
  enableEvents: boolean;
  enableVictory: boolean;
  customIntroLine: string;
  customEventLine: string;
  customVictoryLine: string;
}

export const DEFAULT_CUSTOM_COMMENTARY: CustomCommentaryConfig = {
  enableCountdown: true,
  enableEvents: true,
  enableVictory: true,
  customIntroLine: '',
  customEventLine: '',
  customVictoryLine: '',
};


