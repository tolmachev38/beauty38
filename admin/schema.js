/* admin/schema.js — описание всех редактируемых полей.
   Типы полей: text, textarea, html, number, range, toggle, select, color, image, imagePath,
   audio, list, strings, sheet, button, table, days. */
(function (root) {
  'use strict';

  var HREF_HELP = 'Куда ведёт: #якорь раздела (#contacts), tel:+7…, https://…, или подстановка {{phoneHref}}, {{telegramHref}}, {{whatsappHref}}';
  var BG_OPTS = [['dark', 'Тёмный'], ['ink2', 'Тёмный изумруд'], ['ink3', 'Глубокий изумруд'], ['light', 'Светлый шалфей'], ['cream', 'Светлый молочный']];
  var BTN = [
    { k: 'label', t: 'text', label: 'Текст кнопки' },
    { k: 'sheet', t: 'sheet', label: 'Открыть процедуру', help: 'Если выбрана процедура — кнопка открывает её мини-страницу, ссылка ниже не используется.' },
    { k: 'href', t: 'text', label: 'Ссылка', help: HREF_HELP },
    { k: 'style', t: 'select', label: 'Вид', options: [['fill', 'Заливка (главная)'], ['line', 'Контур']] },
    { k: 'arrow', t: 'toggle', label: 'Стрелка →' },
    { k: 'newTab', t: 'toggle', label: 'Открывать в новой вкладке' }
  ];
  var BTN_ITEM = { k: '', t: 'button' };
  var LINK = [{ k: 'label', t: 'text', label: 'Текст' }, { k: 'href', t: 'text', label: 'Ссылка', help: HREF_HELP }];
  var GAL_ITEM = [
    { k: '$img', t: 'imageInline', label: 'Фото' },
    { k: 'caption', t: 'text', label: 'Подпись на фото' },
    { k: 'wide', t: 'toggle', label: 'Широкая карточка' }
  ];
  function head(extra) {
    return [
      { k: 'eyebrow', t: 'text', label: 'Надзаголовок', help: 'Мелкая строка над заголовком.' },
      { k: 'title', t: 'html', label: 'Заголовок (H2)', help: 'Курсив: выделите слово и нажмите «К».' },
      { k: 'lead', t: 'html', label: 'Вводный абзац' }
    ].concat(extra || []);
  }

  var SECTIONS = {
    hero: {
      name: 'Первый экран', icon: '◐', single: true,
      fields: [
        { k: 'kicker', t: 'text', label: 'Ключевая строка (входит в H1)', help: 'Главный запрос для поиска и нейросетей. Видна мелко над названием.', counter: 60 },
        { k: 'line1', t: 'text', label: 'Заголовок H1 — строка 1' },
        { k: 'line2', t: 'text', label: 'Заголовок H1 — строка 2 (курсив)' },
        { k: 'sub', t: 'html', label: 'Подзаголовок' },
        { k: 'image', t: 'image', label: 'Фоновое фото (компьютер)', opts: { max: 2400 } },
        { k: 'imageMobile', t: 'image', label: 'Фоновое фото (телефон, вертикальное)', opts: { max: 1400 }, noAlt: true },
        { k: 'seal', t: 'image', label: 'Знак над заголовком', opts: { max: 600, keepPng: true }, noAlt: true },
        { k: 'buttons', t: 'list', label: 'Кнопки', item: BTN_ITEM, title: 'label' },
        { k: 'facts', t: 'list', label: 'Факты внизу экрана', title: 'big', item: [{ k: 'big', t: 'html', label: 'Крупно' }, { k: 'small', t: 'html', label: 'Подпись' }] },
        { k: 'scrollHint', t: 'text', label: 'Подсказка справа («Листайте»)' }
      ]
    },
    marquee: {
      name: 'Бегущая строка', icon: '⇢',
      fields: [{ k: 'items', t: 'strings', label: 'Слова в строке', plain: true }]
    },
    about: {
      name: 'О студии (текст + фото)', icon: '❖', bg: 'light',
      fields: [
        { k: 'image', t: 'image', label: 'Фото' },
        { k: 'caption', t: 'text', label: 'Подпись под фото' }
      ].concat(head([
        { k: 'body', t: 'html', label: 'Основной текст' },
        { k: 'ticks', t: 'strings', label: 'Список со штрихами' },
        { k: 'link', t: 'group', label: 'Ссылка внизу', fields: LINK }
      ]))
    },
    headspa: {
      name: 'Head SPA', icon: '✺', single: true,
      fields: [
        { k: 'eyebrow', t: 'text', label: 'Надзаголовок' },
        { k: 'titleEn', t: 'text', label: 'Строка над заголовком (латиницей)' },
        { k: 'title', t: 'html', label: 'Заголовок (H2)' },
        { k: 'lead', t: 'html', label: 'Вводный абзац' },
        { k: 'galleryNote', t: 'text', label: 'Подпись к фотоленте' },
        { k: 'gallery', t: 'list', label: 'Фотолента', item: GAL_ITEM, title: 'caption', thumb: true },
        { k: 'splitImage', t: 'image', label: 'Фото рядом с текстом' },
        { k: 'splitEyebrow', t: 'text', label: 'Надзаголовок блока «Что происходит с телом»' },
        { k: 'splitTitle', t: 'html', label: 'Заголовок блока (H3)' },
        { k: 'splitBody', t: 'html', label: 'Текст блока' },
        { k: 'splitTicks', t: 'strings', label: 'Список' },
        { k: 'quote', t: 'group', label: 'Цитата', fields: [{ k: 'text', t: 'html', label: 'Текст' }, { k: 'cite', t: 'text', label: 'Автор' }] },
        { k: 'stagesEyebrow', t: 'text', label: 'Надзаголовок этапов' },
        { k: 'stagesTitle', t: 'html', label: 'Заголовок этапов (H3)' },
        { k: 'stages', t: 'list', label: 'Этапы ритуала', title: 'title', item: [{ k: 'title', t: 'text', label: 'Название' }, { k: 'text', t: 'html', label: 'Описание' }] },
        { k: 'bottomText', t: 'html', label: 'Текст внизу раздела' },
        { k: 'bottomButton', t: 'button', label: 'Кнопка внизу' }
      ]
    },
    doctor: {
      name: 'Экспертиза / врач', icon: '✚', single: true,
      fields: head([
        { k: 'body', t: 'html', label: 'Основной текст' },
        { k: 'principles', t: 'list', label: 'Принципы (нумерация автоматически)', title: 'title', item: [{ k: 'title', t: 'text', label: 'Заголовок' }, { k: 'text', t: 'html', label: 'Текст' }] },
        { k: 'images', t: 'list', label: 'Две фотографии', item: [{ k: '$img', t: 'imageInline', label: 'Фото' }], thumb: true, max: 2 },
        { k: 'credTitle', t: 'html', label: 'Плашка: заголовок' },
        { k: 'credText', t: 'html', label: 'Плашка: текст' },
        { k: 'quote', t: 'group', label: 'Цитата', fields: [{ k: 'text', t: 'html', label: 'Текст' }, { k: 'cite', t: 'text', label: 'Подпись' }] }
      ])
    },
    programs: {
      name: 'Список программ с ценами', icon: '☰', bg: 'light',
      fields: head([
        { k: 'hint', t: 'html', label: 'Подсказка под вводным абзацем' },
        { k: 'items', t: 'list', label: 'Программы', title: 'name', item: [
          { k: 'name', t: 'text', label: 'Название' },
          { k: 'badge', t: 'text', label: 'Бейдж (необязательно)' },
          { k: 'sub', t: 'text', label: 'Короткое описание' },
          { k: 'dur', t: 'text', label: 'Длительность', half: true },
          { k: 'price', t: 'text', label: 'Цена', half: true, help: 'Например «4 490 ₽» или «от 2 990 ₽» — попадает в разметку для поисковиков.' },
          { k: 'sheet', t: 'sheet', label: 'Мини-страница программы' }
        ] },
        { k: 'button', t: 'button', label: 'Кнопка под списком' },
        { k: 'note', t: 'html', label: 'Текст рядом с кнопкой' }
      ])
    },
    tiles: {
      name: 'Плитки услуг', icon: '▦', bg: 'dark',
      fields: head([
        { k: 'hint', t: 'html', label: 'Подсказка под вводным абзацем' },
        { k: 'cols', t: 'select', label: 'Колонок на компьютере', options: [[2, '2'], [3, '3']], num: true },
        { k: 'items', t: 'list', label: 'Плитки', title: 'title', item: [
          { k: 'title', t: 'html', label: 'Название' },
          { k: 'price', t: 'text', label: 'Цена', half: true, help: '«2 490 ₽», «от 2 990 ₽», «Уточняйте» или пусто.' },
          { k: 'dur', t: 'text', label: 'Длительность / подзаголовок', half: true },
          { k: 'lead', t: 'html', label: 'Короткое описание' },
          { k: 'sheet', t: 'sheet', label: 'Мини-страница (по клику)' },
          { k: 'more', t: 'text', label: 'Текст ссылки «Подробно»' }
        ] },
        { k: 'note', t: 'html', label: 'Примечание под плитками' },
        { k: 'images', t: 'list', label: 'Фото под плитками (до 2)', item: [{ k: '$img', t: 'imageInline', label: 'Фото' }], thumb: true, max: 2 },
        { k: 'mist', t: 'toggle', label: 'Мягкая дымка на фоне (для тёмных фонов)' }
      ])
    },
    band: {
      name: 'Баннер с фото', icon: '▬',
      fields: [
        { k: 'image', t: 'image', label: 'Фоновое фото' },
        { k: 'eyebrow', t: 'text', label: 'Надзаголовок' },
        { k: 'title', t: 'html', label: 'Заголовок (H2)' },
        { k: 'lead', t: 'html', label: 'Текст' },
        { k: 'button', t: 'button', label: 'Кнопка' }
      ]
    },
    laser: {
      name: 'Прайс-таблица (эпиляция)', icon: '▤', bg: 'ink3',
      fields: [
        { k: 'image', t: 'image', label: 'Фото рядом с текстом' }
      ].concat(head([
        { k: 'ticks', t: 'strings', label: 'Список со штрихами' },
        { k: 'priceTitle', t: 'text', label: 'Заголовок прайса' },
        { k: 'tabs', t: 'list', label: 'Вкладки прайса', title: 'label', item: [
          { k: 'label', t: 'text', label: 'Название вкладки' },
          { k: 'caption', t: 'text', label: 'Подпись таблицы' },
          { k: '$table', t: 'table', label: 'Таблица цен' },
          { k: 'note', t: 'html', label: 'Примечание под таблицей' }
        ] },
        { k: 'note', t: 'html', label: 'Общее примечание', help: '{{phoneLink}} — телефон-ссылка.' },
        { k: 'button', t: 'button', label: 'Кнопка' },
        { k: 'images', t: 'list', label: 'Три фото внизу', item: [{ k: '$img', t: 'imageInline', label: 'Фото' }], thumb: true, max: 6 }
      ]))
    },
    brands: {
      name: 'Бренды', icon: '✦', bg: 'ink2',
      fields: [
        { k: 'eyebrow', t: 'text', label: 'Надзаголовок' },
        { k: 'title', t: 'html', label: 'Заголовок (H2)' },
        { k: 'body', t: 'html', label: 'Текст' },
        { k: 'items', t: 'list', label: 'Бренды', title: 'name', item: [{ k: 'name', t: 'text', label: 'Название' }, { k: 'sub', t: 'html', label: 'Подпись' }] },
        { k: 'image', t: 'image', label: 'Широкое фото внизу' }
      ]
    },
    gallery: {
      name: 'Фотогалерея', icon: '▣', bg: 'dark',
      fields: head([
        { k: 'note', t: 'text', label: 'Подпись к ленте' },
        { k: 'photos', t: 'list', label: 'Фотографии', item: GAL_ITEM, title: 'caption', thumb: true },
        { k: 'footnote', t: 'html', label: 'Текст под лентой' }
      ])
    },
    timeline: {
      name: 'Шаги / как проходит визит', icon: '⋯', bg: 'light',
      fields: head([
        { k: 'note', t: 'text', label: 'Подпись к ленте' },
        { k: 'steps', t: 'list', label: 'Шаги', title: 'title', item: [{ k: 'time', t: 'text', label: 'Время / метка' }, { k: 'title', t: 'text', label: 'Заголовок' }, { k: 'text', t: 'html', label: 'Текст' }] }
      ])
    },
    gift: {
      name: 'Сертификаты', icon: '✉', bg: 'ink3',
      fields: [
        { k: 'eyebrow', t: 'text', label: 'Надзаголовок' },
        { k: 'title', t: 'html', label: 'Заголовок (H2)' },
        { k: 'body', t: 'html', label: 'Текст' },
        { k: 'ticks', t: 'strings', label: 'Список' },
        { k: 'buttons', t: 'list', label: 'Кнопки', item: BTN_ITEM, title: 'label' },
        { k: 'image', t: 'image', label: 'Фото' }
      ]
    },
    faq: {
      name: 'Вопросы и ответы', icon: '?', bg: 'ink3',
      fields: head([
        { k: 'items', t: 'list', label: 'Вопросы (попадают в разметку FAQ для поиска и нейросетей)', title: 'q', item: [
          { k: 'q', t: 'text', label: 'Вопрос' },
          { k: 'a', t: 'html', label: 'Ответ', help: 'Начинайте с прямого ответа в первом предложении — так его берут нейросети. Абзацы: <p>…</p>.' }
        ] }
      ])
    },
    geo: {
      name: 'Как добраться', icon: '⌖', bg: 'light',
      fields: head([
        { k: 'factsTitle', t: 'text', label: 'Заголовок колонки фактов' },
        { k: 'facts', t: 'list', label: 'Коротко о студии (факты)', title: 'label', item: [{ k: 'label', t: 'text', label: 'Что', half: true }, { k: 'value', t: 'html', label: 'Значение' }] },
        { k: 'groups', t: 'list', label: 'Откуда едут (группы)', title: 'title', item: [
          { k: 'title', t: 'text', label: 'Название группы' },
          { k: 'items', t: 'list', label: 'Места', title: 'name', item: [{ k: 'name', t: 'text', label: 'Место' }, { k: 'km', t: 'text', label: 'Км', half: true }, { k: 'min', t: 'text', label: 'Минут', half: true }] }
        ] },
        { k: 'note', t: 'html', label: 'Примечание' }
      ])
    },
    contacts: {
      name: 'Контакты', icon: '☏', single: true,
      fields: head([
        { k: 'rows', t: 'list', label: 'Строки контактов', title: 'label', help: 'Подстановки: {{phone}}, {{phoneHref}}, {{phone2}}, {{city}}, {{street}}, {{hours}}, {{telegramHref}}, {{whatsappHref}}, {{maxHref}}, {{twogisHref}}.', item: [
          { k: 'label', t: 'text', label: 'Подпись' }, { k: 'html', t: 'html', label: 'Значение' }, { k: 'small', t: 'html', label: 'Мелкий текст' }
        ] },
        { k: 'mapTitle', t: 'html', label: 'Карточка: адрес' },
        { k: 'mapText', t: 'html', label: 'Карточка: как найти' },
        { k: 'mapButtons', t: 'list', label: 'Кнопки карт', item: BTN_ITEM, title: 'label' },
        { k: 'buttons', t: 'list', label: 'Кнопки связи', item: BTN_ITEM, title: 'label' }
      ])
    },
    text: {
      name: 'Текстовый блок', icon: '¶', bg: 'dark',
      fields: head([
        { k: 'body', t: 'html', label: 'Текст', help: 'Абзацы: <p>…</p>.' },
        { k: 'ticks', t: 'strings', label: 'Список' },
        { k: 'image', t: 'image', label: 'Фото (необязательно)' },
        { k: 'imageRight', t: 'toggle', label: 'Фото справа' },
        { k: 'buttons', t: 'list', label: 'Кнопки', item: BTN_ITEM, title: 'label' },
        { k: 'mist', t: 'toggle', label: 'Мягкая дымка на фоне' }
      ])
    }
  };
  Object.keys(SECTIONS).forEach(function (k) { SECTIONS[k].bgOptions = BG_OPTS; });

  /* шаблоны новых разделов */
  var TEMPLATES = {
    text: { type: 'text', bg: 'dark', eyebrow: 'Новый раздел', title: 'Заголовок <em>раздела</em>', lead: 'Короткий вводный абзац.', body: '<p>Текст раздела.</p>', ticks: [], buttons: [], image: null },
    tiles: { type: 'tiles', bg: 'light', cols: 3, eyebrow: 'Услуги', title: 'Новые услуги', lead: '', hint: '', items: [{ title: 'Услуга', price: '', dur: '', lead: 'Описание', sheet: '', more: 'Подробно' }], note: '', images: [] },
    programs: { type: 'programs', bg: 'light', eyebrow: 'Программы', title: 'Новые программы', lead: '', hint: '', items: [{ name: 'Программа', badge: '', sub: '', dur: '60 мин', price: '1 000 ₽', sheet: '' }], button: { label: 'Записаться', href: '#contacts', style: 'fill', arrow: true }, note: '' },
    gallery: { type: 'gallery', bg: 'dark', eyebrow: 'Фото', title: 'Новая галерея', lead: '', note: 'Листайте вбок.', photos: [], footnote: '' },
    faq: { type: 'faq', bg: 'ink3', eyebrow: 'Вопросы', title: 'Вопросы и ответы', lead: '', items: [{ q: 'Вопрос?', a: '<p>Ответ.</p>' }] },
    timeline: { type: 'timeline', bg: 'light', eyebrow: 'Шаги', title: 'Как это проходит', lead: '', note: '', steps: [{ time: 'Шаг 1', title: 'Заголовок', text: 'Текст' }] },
    band: { type: 'band', eyebrow: 'Баннер', title: 'Заголовок баннера', lead: 'Текст', image: null, button: { label: 'Подробнее', href: '#contacts', style: 'fill', arrow: true } },
    about: { type: 'about', bg: 'light', image: null, caption: '', eyebrow: 'О нас', title: 'Заголовок', lead: '', body: '', ticks: [], link: { label: '', href: '' } },
    brands: { type: 'brands', bg: 'ink2', eyebrow: 'Бренды', title: 'С чем мы работаем', body: '', items: [{ name: 'Бренд', sub: 'Описание' }], image: null },
    gift: { type: 'gift', bg: 'ink3', eyebrow: 'Предложение', title: 'Заголовок', body: '', ticks: [], buttons: [], image: null },
    geo: { type: 'geo', bg: 'light', eyebrow: 'Как добраться', title: 'Откуда к нам <em>приезжают</em>', lead: '', factsTitle: 'Коротко', facts: [], groups: [], note: '' },
    laser: { type: 'laser', bg: 'ink3', image: null, eyebrow: 'Прайс', title: 'Цены', lead: '', ticks: [], priceTitle: 'Стоимость', tabs: [{ label: 'Цены', caption: 'Цены, ₽', columns: ['Услуга', 'Цена'], rows: [{ name: 'Услуга', sub: '', values: ['1 000'], old: [''], best: false }], note: '' }], note: '', button: null, images: [] },
    marquee: { type: 'marquee', items: ['Слово', 'Ещё слово'] }
  };

  /* мини-страница процедуры */
  var SHEET = [
    { k: 'id', t: 'text', label: 'ID (адрес мини-страницы)', help: 'Латиница, начинается с «s-». Ссылка вида beauty38.ru/#s-lite открывает эту процедуру.', mono: true },
    { k: 'eyebrow', t: 'text', label: 'Надзаголовок', help: 'Например «SPA-программа · 60 минут».' },
    { k: 'title', t: 'html', label: 'Название' },
    { k: 'lead', t: 'html', label: 'Вводный абзац', help: 'Используется и как описание услуги для поисковиков.' },
    { k: 'image', t: 'imagePath', label: 'Фото в шапке панели' },
    { k: 'meta', t: 'list', label: 'Ключевые параметры (плашки)', title: 'label', item: [{ k: 'label', t: 'text', label: 'Подпись', half: true }, { k: 'value', t: 'html', label: 'Значение', half: true }] },
    { k: 'blocks', t: 'list', label: 'Блоки текста', title: 'title', item: [
      { k: 'title', t: 'text', label: 'Заголовок блока' },
      { k: 'kind', t: 'select', label: 'Вид', options: [['list', 'Список со штрихами'], ['steps', 'Нумерованные шаги'], ['text', 'Абзацы']], half: true },
      { k: 'warn', t: 'toggle', label: 'Выделить как предупреждение (противопоказания)', half: true },
      { k: 'items', t: 'strings', label: 'Пункты / абзацы' },
      { k: 'after', t: 'strings', label: 'Абзац после списка (необязательно)' }
    ] }
  ];

  var CONTACTS = [
    { group: 'Телефоны' },
    { k: 'phone', t: 'text', label: 'Основной телефон', help: 'Везде на сайте, где стоит {{phone}} / {{phoneHref}}, подставится этот номер.' },
    { k: 'phone2', t: 'text', label: 'Второй телефон' },
    { group: 'Адрес' },
    { k: 'city', t: 'text', label: 'Город', half: true },
    { k: 'street', t: 'text', label: 'Улица и дом', half: true },
    { k: 'addressNote', t: 'text', label: 'Уточнение (этаж, вход)' },
    { k: 'region', t: 'text', label: 'Регион', half: true },
    { k: 'postalCode', t: 'text', label: 'Индекс', half: true },
    { k: 'district', t: 'text', label: 'Округ', half: true },
    { k: 'microdistrict', t: 'text', label: 'Микрорайон', half: true },
    { k: 'lat', t: 'number', label: 'Широта', half: true, step: 'any' },
    { k: 'lon', t: 'number', label: 'Долгота', half: true, step: 'any' },
    { group: 'Режим работы' },
    { k: 'hours', t: 'text', label: 'Как написать на сайте', help: 'Например «Ежедневно, 09:00 — 22:00».' },
    { k: 'opens', t: 'text', label: 'Открытие (ЧЧ:ММ)', half: true, help: 'Для поисковиков.' },
    { k: 'closes', t: 'text', label: 'Закрытие (ЧЧ:ММ)', half: true },
    { k: 'days', t: 'days', label: 'Рабочие дни' },
    { group: 'Мессенджеры и карты' },
    { k: 'telegram', t: 'text', label: 'Telegram (ссылка)' },
    { k: 'whatsapp', t: 'text', label: 'WhatsApp (ссылка wa.me/…)' },
    { k: 'max', t: 'text', label: 'MAX (ссылка)' },
    { k: 'vk', t: 'text', label: 'ВКонтакте (ссылка)' },
    { k: 'instagram', t: 'text', label: 'Instagram (ссылка)' },
    { k: 'twogis', t: 'text', label: '2ГИС (ссылка на карточку)' },
    { k: 'yandexMaps', t: 'text', label: 'Яндекс Карты (ссылка)' },
    { k: 'allLinks', t: 'text', label: 'Страница «все ссылки / онлайн-запись»' },
    { group: 'Рейтинг (выводится в тексте и для нейросетей)' },
    { k: 'rating', t: 'text', label: 'Оценка', half: true },
    { k: 'ratingSource', t: 'text', label: 'Где', half: true },
    { k: 'ratingCount', t: 'text', label: 'Число оценок', half: true },
    { k: 'reviewCount', t: 'text', label: 'Число отзывов', half: true },
    { k: 'ratingChecked', t: 'text', label: 'Когда проверено', help: 'Например «ноябрь 2026». Не забудьте обновить цифры в первом экране, FAQ и контактах.' }
  ];
  var ORG = [
    { k: 'legalForm', t: 'text', label: 'Форма', half: true },
    { k: 'legalName', t: 'text', label: 'Название в реквизитах', half: true },
    { k: 'inn', t: 'text', label: 'ИНН', half: true, mono: true },
    { k: 'ogrnip', t: 'text', label: 'ОГРНИП', half: true, mono: true },
    { k: 'innCopied', t: 'text', label: 'Подсказка после копирования реквизитов' },
    { k: 'founder', t: 'text', label: 'Владелец (для разметки Person)', half: true },
    { k: 'founderTitle', t: 'text', label: 'Должность владельца', half: true },
    { k: 'payment', t: 'text', label: 'Способы оплаты', half: true },
    { k: 'priceRange', t: 'text', label: 'Диапазон цен', half: true },
    { k: 'madeBy', t: 'group', label: 'Подпись разработчика', fields: LINK }
  ];
  var BRAND = [
    { k: 'name', t: 'text', label: 'Название студии', help: 'Используется в заголовках, разметке, llms.txt.' },
    { k: 'alternateNames', t: 'strings', label: 'Другие названия (как ищут)', plain: true },
    { k: 'headerTop', t: 'text', label: 'Шапка: крупная строка', half: true },
    { k: 'headerSub', t: 'text', label: 'Шапка: мелкая строка', half: true },
    { k: 'logo', t: 'image', label: 'Логотип (шапка, заставка, 404)', opts: { max: 600, keepPng: true } },
    { k: 'footerLogo', t: 'image', label: 'Логотип в подвале', opts: { max: 800, keepPng: true } }
  ];
  var SEO = [
    { group: 'Сниппет в поиске' },
    { k: 'title', t: 'text', label: 'Title — заголовок вкладки и выдачи', counter: 70, help: 'Главный запрос + город + бренд. Яндекс показывает ~70–80 символов, Google ~60.' },
    { k: 'description', t: 'textarea', label: 'Description — описание в выдаче', counter: 170, help: '140–170 символов: услуги, цена «от», адрес, рейтинг.' },
    { k: 'keywords', t: 'textarea', label: 'Keywords (почти не влияет, но не мешает)' },
    { k: 'robots', t: 'text', label: 'Meta robots', mono: true },
    { group: 'Соцсети и мессенджеры (превью ссылки)' },
    { k: 'ogTitle', t: 'text', label: 'Заголовок превью' },
    { k: 'ogDescription', t: 'textarea', label: 'Описание превью' },
    { k: 'ogImage', t: 'ogImage', label: 'Картинка превью 1200×630' },
    { group: 'Нейропоиск (Алиса, Нейро, ChatGPT, Perplexity, GigaChat)' },
    { k: 'llmsSummary', t: 'textarea', label: 'Кто вы — в 2–4 предложениях', help: 'Первая строка llms.txt и описание организации в разметке. Пишите фактами: что, где, для кого, чем отличается.' },
    { k: 'areaServed', t: 'strings', label: 'Откуда приезжают (районы и посёлки)', plain: true },
    { k: 'knowsAbout', t: 'strings', label: 'Темы экспертизы (knowsAbout)', plain: true },
    { k: 'allowAiBots', t: 'toggle', label: 'Разрешить нейросетям читать сайт (robots.txt)' },
    { group: 'Вебмастера' },
    { k: 'yandexVerification', t: 'text', label: 'Яндекс.Вебмастер — код подтверждения', mono: true, help: 'Только значение content из мета-тега.' },
    { k: 'googleVerification', t: 'text', label: 'Google Search Console — код', mono: true },
    { k: 'bingVerification', t: 'text', label: 'Bing Webmaster — код (нужен для ChatGPT-поиска)', mono: true },
    { k: 'indexNowKey', t: 'text', label: 'Ключ IndexNow', mono: true, help: 'После публикации админка сама сообщает Яндексу и Bing, что страница обновилась.' }
  ];
  var MUSIC = [
    { k: 'enabled', t: 'toggle', label: 'Музыка на сайте включена' },
    { k: 'src', t: 'audio', label: 'Трек (mp3)' },
    { k: 'artist', t: 'text', label: 'Исполнитель', half: true },
    { k: 'title', t: 'text', label: 'Название трека', half: true },
    { k: 'autoplay', t: 'toggle', label: 'Запускать автоматически', help: 'Браузеры не дают включить звук без действия посетителя: музыка стартует сразу, если браузер разрешил, иначе — с первым касанием, кликом или клавишей.' },
    { k: 'volume', t: 'range', label: 'Громкость', min: 0, max: 1, step: 0.05 },
    { k: 'fadeMs', t: 'number', label: 'Плавное нарастание, мс', half: true },
    { k: 'loop', t: 'toggle', label: 'Повторять по кругу', half: true },
    { k: 'rememberPause', t: 'toggle', label: 'Если посетитель выключил — не включать снова до конца визита' },
    { k: 'pauseOnHide', t: 'toggle', label: 'Ставить на паузу, когда вкладка свёрнута' },
    { k: 'showButton', t: 'toggle', label: 'Показывать кнопку музыки' },
    { k: 'position', t: 'select', label: 'Где кнопка', options: [['left', 'Слева внизу'], ['right', 'Справа внизу']] }
  ];
  var SETTINGS = [
    { k: 'domain', t: 'text', label: 'Домен сайта', mono: true, help: 'Например beauty38.ru (кириллический тоже можно — переведётся в punycode). Из него строятся canonical, sitemap, разметка, llms.txt и файл CNAME.' },
    { k: 'themeColor', t: 'color', label: 'Цвет панели браузера на телефоне' },
    { k: 'progressBar', t: 'toggle', label: 'Полоса прогресса чтения вверху' },
    { k: 'showUpdated', t: 'toggle', label: 'Писать в подвале «Информация актуальна на …»' },
    { k: 'splash', t: 'group', label: 'Заставка при загрузке', fields: [
      { k: 'enabled', t: 'toggle', label: 'Показывать заставку' },
      { k: 'name', t: 'html', label: 'Название' },
      { k: 'sub', t: 'text', label: 'Подпись' },
      { k: 'minMs', t: 'number', label: 'Минимум показа, мс' }
    ] },
    { k: 'fab', t: 'group', label: 'Плавающая кнопка на телефоне', fields: [
      { k: 'enabled', t: 'toggle', label: 'Показывать' },
      { k: 'label', t: 'text', label: 'Текст' },
      { k: 'href', t: 'text', label: 'Ссылка', help: HREF_HELP }
    ] }
  ];
  var NAV = [
    { k: 'main', t: 'list', label: 'Меню в шапке (компьютер)', item: LINK, title: 'label' },
    { k: 'cta', t: 'group', label: 'Кнопка в шапке', fields: LINK },
    { k: 'mobile', t: 'list', label: 'Мобильное меню', item: LINK, title: 'label' },
    { k: 'mobileNote', t: 'html', label: 'Текст внизу мобильного меню' }
  ];
  var FOOTER = [
    { k: 'text', t: 'html', label: 'Текст под логотипом' },
    { k: 'socials', t: 'list', label: 'Кнопки соцсетей', title: 'label', item: [{ k: 'label', t: 'text', label: 'Текст' }, { k: 'href', t: 'text', label: 'Ссылка' }, { k: 'nofollow', t: 'toggle', label: 'nofollow' }] },
    { k: 'columns', t: 'list', label: 'Колонки ссылок', title: 'title', item: [{ k: 'title', t: 'text', label: 'Заголовок' }, { k: 'links', t: 'list', label: 'Ссылки', item: LINK, title: 'label' }] },
    { k: 'contactsTitle', t: 'text', label: 'Заголовок колонки контактов', half: true },
    { k: 'ctaLabel', t: 'text', label: 'Кнопка в колонке контактов', half: true },
    { k: 'ctaHref', t: 'text', label: 'Ссылка кнопки' },
    { k: 'copyright', t: 'html', label: 'Копирайт', help: '{{year}} — год.' },
    { k: 'offer', t: 'html', label: 'Строка про оферту' },
    { k: 'disclaimer', t: 'html', label: 'Медицинский дисклеймер' },
    { k: 'note', t: 'html', label: 'Сноска (Instagram/Meta и т.п.)' }
  ];
  var SHEET_PANEL = [
    { k: 'text', t: 'html', label: 'Текст внизу панели процедуры' },
    { k: 'buttons', t: 'list', label: 'Кнопки', item: BTN_ITEM, title: 'label' }
  ];
  var UI = [
    { k: 'railHint', t: 'text', label: 'Подсказка под лентами на телефоне', half: true },
    { k: 'close', t: 'text', label: 'Кнопка закрытия панели процедуры', half: true },
    { k: 'menu', t: 'text', label: 'Подпись кнопки меню (для экранных читалок)', half: true },
    { k: 'skip', t: 'text', label: 'Ссылка «К основному содержанию»', half: true },
    { k: 'updatedPrefix', t: 'text', label: 'Текст перед датой обновления в подвале' },
    { k: 'e404title', t: 'html', label: 'Страница 404: заголовок' },
    { k: 'e404text', t: 'html', label: 'Страница 404: текст' },
    { k: 'e404btn', t: 'text', label: 'Страница 404: кнопка' }
  ];
  var CODE = [
    { k: 'head', t: 'code', label: 'Код в <head>', help: 'Счётчики (Яндекс Метрика, Google Analytics), пиксели, мета-теги. Вставляется как есть.' },
    { k: 'bodyEnd', t: 'code', label: 'Код перед </body>', help: 'Виджеты, онлайн-запись, чаты.' }
  ];
  var COLOR_LABELS = {
    'e-950': 'Фон сайта (самый тёмный)', 'e-900': 'Тёмный изумруд', 'e-850': 'Глубокий изумруд', 'e-800': 'Изумруд 800', 'e-700': 'Изумруд 700',
    'e-600': 'Кнопки и акценты', 'e-500': 'Изумруд 500', 'e-400': 'Изумруд 400', 'e-300': 'Надзаголовки', 'e-200': 'Светлый акцент', 'e-100': 'Цены и светлый текст',
    'e-050': 'Почти белый', paper: 'Светлый фон (молочный)', sage: 'Светлый фон (шалфей)', 'sage-2': 'Шалфей темнее', brass: 'Латунь — линии', 'brass-2': 'Латунь светлая'
  };

  root.AdminSchema = {
    SECTIONS: SECTIONS, TEMPLATES: TEMPLATES, SHEET: SHEET, CONTACTS: CONTACTS, ORG: ORG, BRAND: BRAND, SEO: SEO, MUSIC: MUSIC,
    SETTINGS: SETTINGS, NAV: NAV, FOOTER: FOOTER, SHEET_PANEL: SHEET_PANEL, CODE: CODE, UI: UI, COLOR_LABELS: COLOR_LABELS, BTN: BTN, BG_OPTS: BG_OPTS,
    TOKENS: ['{{phone}}', '{{phoneHref}}', '{{phoneLink}}', '{{phone2}}', '{{phone2Href}}', '{{telegramHref}}', '{{whatsappHref}}', '{{maxHref}}', '{{twogisHref}}', '{{yandexMapsHref}}', '{{city}}', '{{street}}', '{{address}}', '{{hours}}', '{{year}}', '{{brand}}']
  };
})(window);
