/**
 * Контент и бренд салона. То, что владелец меняет сам через Telegram-бота
 * (цены, контакты, часы, фото работ, ссылка записи, мастера), лежит в src/content/site.json.
 * Здесь — структура, тексты и оформление. Для другого салона: этот файл + site.json + фото + 2 SVG.
 */
import data from '../content/site.json';

const digits = (s: string) => s.replace(/\D/g, '');
const SOCIAL_LABELS: Record<string, string> = {
  telegram: 'Telegram', whatsapp: 'WhatsApp', youtube: 'YouTube', max: 'MAX', vk: 'VK', instagram: 'Instagram',
};

type PriceItem = { name: string; price: number; firstVisit?: number };

export const site = {
  name: 'Угол 361',
  nameLatin: 'Ugol361',
  kind: 'барбершоп',

  address: {
    city: 'Москва',
    ...data.address,
    geo: { lat: 55.677458, lon: 37.565434 }, // из карточки организации в Яндекс Картах
  },

  phone: { display: data.phone, href: `tel:+${digits(data.phone)}` },

  hours: data.hours,

  rating: {
    ...data.rating,
    url: 'https://yandex.ru/maps/org/ugol_361/92765387360/reviews/',
  },

  // куда ведёт «Записаться» (меняется через бота)
  booking: { label: 'Записаться', href: data.booking },

  // пустые ссылки на сайте не показываются
  socials: Object.entries(data.socials as Record<string, string>)
    .filter(([, href]) => href)
    .map(([id, href]) => ({ id, label: SOCIAL_LABELS[id] ?? id, href })),

  prices: { ...data.prices, items: data.prices.items as PriceItem[] },

  features: [
    { id: 'dog', label: 'Можно с собакой до 35 см' },
    { id: 'kid', label: 'Детские стрижки' },
    { id: 'gift', label: 'Подарочные сертификаты' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'qr', label: 'Карта, СБП, QR' },
    { id: 'parking', label: 'Парковка' },
  ],

  hero: {
    kicker: 'барбершоп на районе',
    line: 'Москва, Профсоюзная. Вход через цветочный.',
  },

  door: {
    title: 'Заходи через цветочный',
    text: 'Нахимовский, 40. Ищи вывеску «Топ цветы» и красную дверь со столбом. Да, мы за цветами.',
  },

  // Каждая фраза = одна строка манифеста. Слова проявляются по скроллу (фаза 4)
  manifesto: [
    'Стрижём не «как обычно».',
    'Блонд, красный, химия, шторки — это к нам.',
    'Подбираем под лицо, а не под прайс.',
  ],
  manifestoNote: 'И после стрижки покажем, как уложить это дома за пару минут.',

  // Фото работ. Присланные через бота лежат в src/assets/photos/lookbook/
  lookbook: data.lookbook,

  barbers: data.barbers,

  // Только темы из отзывов на Яндексе, без выдуманных цитат
  reviewTopics: [
    'подбирают стрижку под форму лица',
    'объясняют, как укладывать',
    'удобные кресла',
    'интерьер и атмосфера',
    'хорошее оборудование',
  ],
  // Реальные отзывы с Яндекс Карт (дословно, сокращены). Источник: rating.url
  reviews: [
    {
      text: 'Вообще не знал, что хочу, какая причёска мне подойдёт. Мне всё подсказали, выбрали вместе с барбером и объяснили, как за стрижкой ухаживать. Впервые за свою жизнь мне не надо запираться на 2 недели в квартире.',
      author: 'Елисеенко В.', date: '18 августа 2026',
    },
    {
      text: 'К деталям подходит очень въедливо, доводит форму до идеала. Попросил не срезать длину, а просто грамотно убрать объём — сделал всё ровно так, как я и хотел.',
      author: 'Юрий', date: '24 сентября 2026',
    },
    {
      text: 'Всё кайф! Удобная локация в 2 минутах от метро. Крутая атмосфера и чёткие мастера!',
      author: 'Ирина М.', date: '10 августа 2026',
    },
  ],

  route: [
    { id: 'metro', label: 'м. Профсоюзная' },
    { id: 'walk', label: '200 м пешком' },
    { id: 'flowers', label: 'вывеска «Топ цветы»' },
    { id: 'door', label: 'красная дверь' },
  ],
  // виджет открывается сразу на карточке барбершопа
  mapEmbed: 'https://yandex.ru/map-widget/v1/org/ugol_361/92765387360/?ll=37.565434%2C55.677458&z=17',
  mapRoute: 'https://yandex.ru/maps/?rtext=~55.677458%2C37.565434&rtt=pd',
  mapOrg: 'https://yandex.ru/maps/org/ugol_361/92765387360/',

  footer: {
    title: '361°',
    line: 'Обошёл все барбершопы по кругу? Это тот самый плюс один градус.',
  },

  theme: {
    colors: {
      wine: '#451417',
      wineLight: '#561A1F',
      wineDeep: '#2E0F11',
      paper: '#F4F1EC',
      brick: '#ADADA2',
      brickDark: '#807F72',
      ink: '#1E1E1B',
      window: '#E2B12B',
      windowHot: '#F6E04A',
      windowFrame: '#6E382F',
      muralBrown: '#754D42',
      doorRed: '#E3062C',
      plum: '#823A52',
      poleBlue: '#0A33B0',
    },
    fonts: {
      display: "'Oswald Variable', 'Arial Narrow', sans-serif",
      numeral: "'Playfair Display', Georgia, serif",
      body: "'Onest Variable', system-ui, sans-serif",
      graffiti: "'Rubik Spray Paint', 'Oswald Variable', sans-serif",
    },
  },
};

export type Site = typeof site;

// разряды и ₽ — через обычный неразрывный пробел: он есть во всех шрифтах (тонкого нет в Oswald)
export const rub = (n: number) => `${n.toLocaleString('ru-RU').replace(/\s/g, '\u00a0')}\u00a0₽`;
