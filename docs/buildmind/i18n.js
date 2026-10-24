'use strict';

/* ==================================================
   BUILDMIND I18N FOUNDATION — V1
   Отделяет язык интерфейса от бизнес-логики.
   Сейчас UI остаётся русским, но новые модули уже
   готовы к ru / en / ar и RTL для арабского.
   ================================================== */

const BUILDMIND_I18N_VERSION = 'buildmind-i18n-v1';
const BUILDMIND_I18N_STORAGE_KEY = 'buildmind-ui-locale-v1';

const BUILDMIND_I18N_DICTIONARIES = {
  ru: {
    'intake.title': 'Загрузка и анализ проекта',
    'intake.subtitle': 'Загрузите комплект документов. BuildMind сам определит их назначение, соберёт найденные работы и материалы и покажет только то, что требует проверки.',
    'intake.selectFiles': 'Загрузить комплект проекта',
    'intake.analyze': 'Анализировать комплект',
    'intake.analyzing': 'BuildMind анализирует документы…',
    'intake.empty': 'Сначала загрузите документы проекта.',
    'intake.ready': 'Комплект готов к анализу.',
    'intake.complete': 'Анализ комплекта завершён.',
    'intake.review': 'Требует вашего внимания'
  },

  en: {
    'intake.title': 'Project intake and analysis',
    'intake.subtitle': 'Upload the project package. BuildMind will classify the documents, collect detected works and materials, and surface only items that need review.',
    'intake.selectFiles': 'Upload project package',
    'intake.analyze': 'Analyze package',
    'intake.analyzing': 'BuildMind is analyzing the documents…',
    'intake.empty': 'Upload project documents first.',
    'intake.ready': 'The package is ready for analysis.',
    'intake.complete': 'Package analysis is complete.',
    'intake.review': 'Needs your attention'
  },

  ar: {
    'intake.title': 'تحميل المشروع وتحليله',
    'intake.subtitle': 'حمّل حزمة مستندات المشروع. سيصنّف BuildMind المستندات ويجمع الأعمال والمواد المكتشفة ويعرض فقط ما يحتاج إلى مراجعة.',
    'intake.selectFiles': 'تحميل حزمة المشروع',
    'intake.analyze': 'تحليل الحزمة',
    'intake.analyzing': 'يقوم BuildMind بتحليل المستندات…',
    'intake.empty': 'قم أولاً بتحميل مستندات المشروع.',
    'intake.ready': 'الحزمة جاهزة للتحليل.',
    'intake.complete': 'اكتمل تحليل الحزمة.',
    'intake.review': 'يحتاج إلى انتباهك'
  }
};

function normalizeBuildMindLocale(locale) {
  const normalized =
    String(locale || '')
      .trim()
      .toLowerCase()
      .split('-')[0];

  return Object.prototype.hasOwnProperty.call(
    BUILDMIND_I18N_DICTIONARIES,
    normalized
  )
    ? normalized
    : 'ru';
}

function loadBuildMindLocale() {
  try {
    return normalizeBuildMindLocale(
      localStorage.getItem(
        BUILDMIND_I18N_STORAGE_KEY
      ) || 'ru'
    );
  } catch (error) {
    return 'ru';
  }
}

let buildMindLocale =
  loadBuildMindLocale();

function getBuildMindDirection(
  locale = buildMindLocale
) {
  return normalizeBuildMindLocale(
    locale
  ) === 'ar'
    ? 'rtl'
    : 'ltr';
}

function applyBuildMindLocaleToDocument() {
  if (!document.documentElement) {
    return;
  }

  document.documentElement.lang =
    buildMindLocale;

  document.documentElement.dir =
    getBuildMindDirection(
      buildMindLocale
    );
}

function translateBuildMind(
  key,
  variables
) {
  const dictionary =
    BUILDMIND_I18N_DICTIONARIES[
      buildMindLocale
    ] ||
    BUILDMIND_I18N_DICTIONARIES.ru;

  const fallback =
    BUILDMIND_I18N_DICTIONARIES.ru;

  let value =
    dictionary[key] ||
    fallback[key] ||
    key;

  const vars =
    variables &&
    typeof variables === 'object'
      ? variables
      : {};

  Object.keys(
    vars
  ).forEach(
    function (name) {
      value =
        value.replaceAll(
          `{${name}}`,
          String(
            vars[name]
          )
        );
    }
  );

  return value;
}

function setBuildMindLocale(
  locale
) {
  buildMindLocale =
    normalizeBuildMindLocale(
      locale
    );

  try {
    localStorage.setItem(
      BUILDMIND_I18N_STORAGE_KEY,
      buildMindLocale
    );
  } catch (error) {
    console.warn(
      'BuildMind: не удалось сохранить язык интерфейса.',
      error
    );
  }

  applyBuildMindLocaleToDocument();

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:locale-changed',
      {
        detail: {
          locale:
            buildMindLocale,

          direction:
            getBuildMindDirection(
              buildMindLocale
            )
        }
      }
    )
  );

  return buildMindLocale;
}

window.BuildMindI18n = {
  version:
    BUILDMIND_I18N_VERSION,

  t:
    translateBuildMind,

  getLocale:
    function () {
      return buildMindLocale;
    },

  getDirection:
    getBuildMindDirection,

  setLocale:
    setBuildMindLocale,

  supportedLocales: [
    'ru',
    'en',
    'ar'
  ]
};

applyBuildMindLocaleToDocument();

console.info(
  'BuildMind I18n загружен:',
  BUILDMIND_I18N_VERSION,
  buildMindLocale
);
