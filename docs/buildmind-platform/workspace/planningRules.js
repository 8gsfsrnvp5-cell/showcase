'use strict';

/*
  ==================================================
  BUILDMIND PLANNING RULES — DEMO V1
  ==================================================

  Назначение:
  - хранить прозрачные правила расчёта ресурсов;
  - формировать ориентировочные количества;
  - объяснять основание каждого расчёта;
  - указывать уровень уверенности;
  - не принимать инженерное решение за пользователя.

  ВАЖНО:
  Значения текущей DEMO-базы являются
  предварительными инженерными шаблонами.

  Они требуют проверки и подтверждения
  ответственным специалистом.
*/

const BUILDMIND_PLANNING_RULES_VERSION =
  'planning-rules-demo-v1';

const BUILDMIND_RESOURCE_RULES = [

  /*
    ==================================================
    ПОДЗЕМНАЯ КАБЕЛЬНАЯ КАНАЛИЗАЦИЯ
    ==================================================
  */

  {
    id:
      'underground-duct-coupling',

    workId:
      'road-underground-duct',

    resourceType:
      'material',

    resourceName:
      'Муфта соединительная',

    calculationType:
      'per-length',

    inputUnit:
      'м',

    outputUnit:
      'шт',

    /*
      DEMO-коэффициент.

      В дальнейшем заменяем расчётом
      через фактическую длину одной трубы.
    */

    rate:
      0.0833,

    reservePercent:
      5,

    rounding:
      1,

    confidence:
      'medium',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительная оценка по длине трассы. ' +
      'Фактическое количество зависит от длины отдельных труб, ' +
      'схемы соединений и проектных решений.',

    verification:
      'Рекомендуется проверить длину поставляемых труб ' +
      'и количество фактических соединений.'
  },

  {
    id:
      'underground-duct-plugs',

    workId:
      'road-underground-duct',

    resourceType:
      'material',

    resourceName:
      'Заглушка',

    calculationType:
      'fixed-per-work',

    outputUnit:
      'шт',

    quantity:
      2,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительно учитывается защита свободных концов канала.',

    verification:
      'Рекомендуется проверить количество открытых концов, ' +
      'резервных каналов и требования проекта.'
  },

  {
    id:
      'underground-duct-pull-rope',

    workId:
      'road-underground-duct',

    resourceType:
      'material',

    resourceName:
      'Протяжка или трос',

    calculationType:
      'per-length',

    inputUnit:
      'м',

    outputUnit:
      'м',

    rate:
      1,

    reservePercent:
      5,

    rounding:
      10,

    confidence:
      'medium',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительная длина протяжки принимается по длине канала ' +
      'с технологическим запасом.',

    verification:
      'Рекомендуется проверить количество каналов, колодцев ' +
      'и схему последующей протяжки кабеля.'
  },

  {
    id:
      'underground-duct-installers',

    workId:
      'road-underground-duct',

    resourceType:
      'labor',

    resourceName:
      'Монтажник',

    calculationType:
      'crew-fixed',

    outputUnit:
      'чел.',

    quantity:
      3,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительный состав одной монтажной бригады.',

    verification:
      'Фактический состав рекомендуется определить по диаметру труб, ' +
      'условиям трассы, сменности и плановой производительности.'
  },

  {
    id:
      'underground-duct-excavator',

    workId:
      'road-underground-duct',

    resourceType:
      'equipment',

    resourceName:
      'Экскаватор',

    calculationType:
      'equipment-fixed',

    outputUnit:
      'ед.',

    quantity:
      1,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Типовая механизация земляных работ при траншейной прокладке.',

    verification:
      'Рекомендуется проверить способ производства земляных работ, ' +
      'условия участка и фактический объём разработки грунта.'
  },

  /*
    ==================================================
    ДОРОЖНЫЕ ЗНАКИ
    ==================================================
  */

  {
    id:
      'road-sign-clamps',

    workId:
      'road-sign-installation',

    resourceType:
      'material',

    resourceName:
      'Хомут крепления',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      2,

    reservePercent:
      5,

    rounding:
      1,

    confidence:
      'medium',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительно учитывается два крепёжных элемента ' +
      'на один дорожный знак.',

    verification:
      'Рекомендуется проверить тип знака, стойки, ' +
      'фактическую систему крепления и комплектность поставки.'
  },

  {
    id:
      'road-sign-bolts',

    workId:
      'road-sign-installation',

    resourceType:
      'material',

    resourceName:
      'Болт крепёжный',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      4,

    reservePercent:
      10,

    rounding:
      10,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительный расчёт крепежа для демонстрационной модели.',

    verification:
      'Рекомендуется проверить конструкцию крепления, ' +
      'размер болта и фактическое количество точек соединения.'
  },

  {
    id:
      'road-sign-nuts',

    workId:
      'road-sign-installation',

    resourceType:
      'material',

    resourceName:
      'Гайка крепёжная',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      4,

    reservePercent:
      10,

    rounding:
      10,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Количество связано с предварительным количеством болтов.',

    verification:
      'Рекомендуется подтвердить типоразмер и комплектность крепежа.'
  },

  {
    id:
      'road-sign-washers',

    workId:
      'road-sign-installation',

    resourceType:
      'material',

    resourceName:
      'Шайба',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      4,

    reservePercent:
      10,

    rounding:
      10,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительное количество соответствует крепёжным соединениям.',

    verification:
      'Рекомендуется проверить тип шайб и схему крепления.'
  },

  /*
    ==================================================
    ДОРОЖНАЯ КАМЕРА
    ==================================================
  */

  {
    id:
      'traffic-camera-glands',

    workId:
      'road-traffic-camera',

    resourceType:
      'material',

    resourceName:
      'Гермоввод',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      2,

    reservePercent:
      10,

    rounding:
      1,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительно учитываются кабельные вводы питания и связи.',

    verification:
      'Рекомендуется проверить фактическое количество вводимых линий ' +
      'и конструкцию корпуса камеры или шкафа.'
  },

  {
    id:
      'traffic-camera-lift',

    workId:
      'road-traffic-camera',

    resourceType:
      'equipment',

    resourceName:
      'Автовышка',

    calculationType:
      'equipment-fixed',

    outputUnit:
      'ед.',

    quantity:
      1,

    confidence:
      'medium',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Монтаж камеры обычно предполагает выполнение работ на высоте.',

    verification:
      'Рекомендуется проверить высоту установки, доступ к месту работ ' +
      'и возможность применения автовышки.'
  },

  /*
    ==================================================
    СВЕТОФОРНЫЙ ОБЪЕКТ
    ==================================================
  */

  {
    id:
      'traffic-light-anchor-set',

    workId:
      'road-traffic-light',

    resourceType:
      'material',

    resourceName:
      'Анкерный элемент',

    calculationType:
      'per-item',

    inputUnit:
      'шт',

    outputUnit:
      'шт',

    rate:
      4,

    reservePercent:
      5,

    rounding:
      1,

    confidence:
      'low',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Предварительная демонстрационная оценка крепления одной опорной позиции.',

    verification:
      'Рекомендуется проверить фундамент, закладные детали, ' +
      'тип опоры и рабочую документацию.'
  },

  {
    id:
      'traffic-light-lift',

    workId:
      'road-traffic-light',

    resourceType:
      'equipment',

    resourceName:
      'Автовышка',

    calculationType:
      'equipment-fixed',

    outputUnit:
      'ед.',

    quantity:
      1,

    confidence:
      'medium',

    sourceType:
      'buildmind-demo-rule',

    basisDescription:
      'Типовая потребность при монтаже оборудования на высоте.',

    verification:
      'Рекомендуется подтвердить высоту, количество точек монтажа ' +
      'и организацию движения на участке.'
  }
  ,

/*
  ==================================================
  СЕМЕЙСТВО: КАБЕЛЬНАЯ КАНАЛИЗАЦИЯ
  БАЗОВЫЕ ПРАВИЛА
  ==================================================
*/

{
  id:
    'cable-duct-family-pipe',

  familyId:
    'cable-duct',

  resourceType:
    'material',

  resourceName:
    'Труба кабельной канализации',

  resourceAliases: [
    'труба',
    'трубы',
    'труба 76'
  ],

  calculationType:
    'per-length',

  inputUnit:
    'м',

  outputUnit:
    'м',

  rate:
    1,

  reservePercent:
    3,

  rounding:
    10,

  confidence:
    'medium',

  sourceType:
    'buildmind-demo-rule',

  basisDescription:
    'Базовая предварительная оценка длины трубы по длине трассы ' +
    'с небольшим технологическим запасом.',

  verification:
    'Рекомендуется проверить количество каналов, фактическую длину трассы, ' +
    'монтажный запас и проектную спецификацию.'
},

/*
  ==================================================
  КАБЕЛЬНАЯ КАНАЛИЗАЦИЯ — ЭСТАКАДНОЕ ИСПОЛНЕНИЕ
  ==================================================
*/

{
  id:
    'cable-duct-overpass-clamps',

  familyId:
    'cable-duct',

  variantId:
    'overpass',

  resourceType:
    'material',

  resourceName:
    'Хомут крепления',

  resourceAliases: [
    'хомут',
    'хомуты'
  ],

  calculationType:
    'per-length',

  inputUnit:
    'м',

  outputUnit:
    'шт',

  rate:
    0.67,

  reservePercent:
    10,

  rounding:
    10,

  confidence:
    'low',

  sourceType:
    'buildmind-demo-rule',

  assumptions: [
    'Демонстрационное допущение: ориентировочно один хомут на 1,5 м трассы.'
  ],

  basisDescription:
    'Предварительный расчёт крепления по длине эстакадной трассы.',

  verification:
    'Рекомендуется проверить проектный шаг крепления, диаметр трубы, ' +
    'тип хомутов и фактические точки крепления.'
},

{
  id:
    'cable-duct-overpass-brackets',

  familyId:
    'cable-duct',

  variantId:
    'overpass',

  resourceType:
    'material',

  resourceName:
    'Кронштейн или уголок',

  resourceAliases: [
    'кронштейн',
    'уголок',
    'консоль'
  ],

  calculationType:
    'per-length',

  inputUnit:
    'м',

  outputUnit:
    'шт',

  rate:
    0.34,

  reservePercent:
    10,

  rounding:
    10,

  confidence:
    'low',

  sourceType:
    'buildmind-demo-rule',

  assumptions: [
    'Демонстрационное допущение: ориентировочно одна опорная позиция на 3 м трассы.'
  ],

  basisDescription:
    'Предварительная оценка количества опорных элементов по длине трассы.',

  verification:
    'Рекомендуется проверить фактический шаг опор, существующие конструкции, ' +
    'нагрузку и проектные узлы крепления.'
},

{
  id:
    'cable-duct-overpass-lift',

  familyId:
    'cable-duct',

  variantId:
    'overpass',

  resourceType:
    'equipment',

  resourceName:
    'Автовышка',

  calculationType:
    'equipment-fixed',

  outputUnit:
    'ед.',

  quantity:
    1,

  confidence:
    'low',

  sourceType:
    'buildmind-demo-rule',

  basisDescription:
    'Предварительно учитывается потребность в доступе к зоне монтажа на высоте.',

  verification:
    'Рекомендуется проверить высоту эстакады, фактический доступ, ' +
    'схему организации движения и допустимый тип подъёмной техники.'
},

{
  id:
    'cable-duct-overpass-installers',

  familyId:
    'cable-duct',

  variantId:
    'overpass',

  resourceType:
    'labor',

  resourceName:
    'Монтажник',

  calculationType:
    'crew-fixed',

  outputUnit:
    'чел.',

  quantity:
    3,

  confidence:
    'low',

  sourceType:
    'buildmind-demo-rule',

  basisDescription:
    'Предварительный минимальный состав монтажного звена для демонстрационной модели.',

  verification:
    'Рекомендуется уточнить состав бригады по длине захватки, высоте, ' +
    'сменности, производительности и условиям доступа.'
}
];


/*
  ==================================================
  СЛУЖЕБНЫЕ ФУНКЦИИ
  ==================================================
*/

function normalizePlanningRuleNumber(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function roundPlanningRuleQuantity(
  value,
  step
) {
  const numericValue =
    Number(value);

  const numericStep =
    Number(step) || 1;

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return null;
  }

  return (
    Math.ceil(
      numericValue /
      numericStep
    ) *
    numericStep
  );
}

function getPlanningRulesByWorkId(
  workId
) {
  return BUILDMIND_RESOURCE_RULES.filter(
    function (rule) {
      return (
        rule.workId ===
        workId
      );
    }
  );
}

function getPlanningRulesForContext(
  contextDefinition
) {
  const definition =
    contextDefinition &&
    typeof contextDefinition ===
      'object'
      ? contextDefinition
      : {};

  const workId =
    definition.workId || '';

  const familyId =
    definition.familyId || '';

  const variantId =
    definition.variantId || '';

  const rules =
    BUILDMIND_RESOURCE_RULES.filter(
      function (rule) {
        const matchesLegacyWork =
          Boolean(
            workId &&
            rule.workId ===
              workId
          );

        const matchesFamilyBase =
          Boolean(
            familyId &&
            rule.familyId ===
              familyId &&
            !rule.variantId
          );

        const matchesFamilyVariant =
          Boolean(
            familyId &&
            variantId &&
            rule.familyId ===
              familyId &&
            rule.variantId ===
              variantId
          );

        return (
          matchesLegacyWork ||
          matchesFamilyBase ||
          matchesFamilyVariant
        );
      }
    );

  const seenIds =
    new Set();

  return rules.filter(
    function (rule) {
      if (
        seenIds.has(
          rule.id
        )
      ) {
        return false;
      }

      seenIds.add(
        rule.id
      );

      return true;
    }
  );
}

function getPlanningRuleById(
  ruleId
) {
  return (
    BUILDMIND_RESOURCE_RULES.find(
      function (rule) {
        return (
          rule.id === ruleId
        );
      }
    ) || null
  );
}

function calculatePlanningRule(
  rule,
  input
) {
  if (!rule) {
    return {
      success: false,

      errorCode:
        'RULE_NOT_FOUND',

      errorMessage:
        'Правило расчёта не найдено.'
    };
  }

  const settings =
    input &&
    typeof input === 'object'
      ? input
      : {};

  let baseQuantity = null;

  if (
    rule.calculationType ===
    'per-length' ||
    rule.calculationType ===
    'per-item'
  ) {
    const workQuantity =
      normalizePlanningRuleNumber(
        settings.workQuantity
      );

    if (
      workQuantity === null ||
      workQuantity < 0
    ) {
      return {
        success: false,

        errorCode:
          'WORK_QUANTITY_REQUIRED',

        errorMessage:
          'Для расчёта требуется объём работы.'
      };
    }

    baseQuantity =
      workQuantity *
      Number(rule.rate || 0);
  }

  else if (
    rule.calculationType ===
      'fixed-per-work' ||
    rule.calculationType ===
      'crew-fixed' ||
    rule.calculationType ===
      'equipment-fixed'
  ) {
    baseQuantity =
      Number(rule.quantity || 0);
  }

  else {
    return {
      success: false,

      errorCode:
        'UNKNOWN_CALCULATION_TYPE',

      errorMessage:
        'Тип правила расчёта пока не поддерживается.'
    };
  }

  const reservePercent =
    Number(
      rule.reservePercent || 0
    );

  const quantityWithReserve =
    baseQuantity *
    (
      1 +
      reservePercent / 100
    );

  const finalQuantity =
    roundPlanningRuleQuantity(
      quantityWithReserve,
      rule.rounding || 1
    );

  return {
    success: true,

    ruleId:
      rule.id,

   workId:
  rule.workId || null,

familyId:
  rule.familyId || null,

variantId:
  rule.variantId || null,

    resourceType:
      rule.resourceType,

    resourceName:
      rule.resourceName,

    calculationType:
      rule.calculationType,

    input: {
      workQuantity:
        normalizePlanningRuleNumber(
          settings.workQuantity
        ),

      workUnit:
        settings.workUnit || ''
    },

    rate:
      rule.rate !== undefined
        ? Number(rule.rate)
        : null,

    baseQuantity,

    reservePercent,

    calculatedQuantity:
      finalQuantity,

    outputUnit:
      rule.outputUnit || '',

    confidence:
      rule.confidence || 'low',

    basisDescription:
      rule.basisDescription || '',

    verification:
      rule.verification || '',

    sourceType:
  rule.sourceType ||
  'buildmind-demo-rule',

assumptions:
  Array.isArray(
    rule.assumptions
  )
    ? [...rule.assumptions]
    : [],

requiresEngineerConfirmation:
  true
  };
}

function calculatePlanningRulesForWork(
  workId,
  options
) {
  const rules =
    getPlanningRulesByWorkId(
      workId
    );

  const results =
    rules.map(
      function (rule) {
        return calculatePlanningRule(
          rule,
          options
        );
      }
    );

  return {
    success: true,

    version:
      BUILDMIND_PLANNING_RULES_VERSION,

    workId,

    rulesFound:
      rules.length,

    results,

    requiresEngineerConfirmation:
      true,

    disclaimer:
      'Результаты являются предварительными расчётными оценками. ' +
      'Рекомендуется проверить исходные данные, проектную документацию ' +
      'и подтвердить выводы ответственным специалистом.'
  };
}

function calculatePlanningRulesForContext(
  contextDefinition,
  options
) {
  const definition =
    contextDefinition &&
    typeof contextDefinition ===
      'object'
      ? contextDefinition
      : {};

  const rules =
    getPlanningRulesForContext(
      definition
    );

  const results =
    rules.map(
      function (rule) {
        return calculatePlanningRule(
          rule,
          options
        );
      }
    );

  return {
    success: true,

    version:
      BUILDMIND_PLANNING_RULES_VERSION,

    workId:
      definition.workId || null,

    familyId:
      definition.familyId || null,

    variantId:
      definition.variantId || null,

    rulesFound:
      rules.length,

    results,

    requiresEngineerConfirmation:
      true,

    disclaimer:
      'Результаты являются предварительными расчётными оценками. ' +
      'Рекомендуется проверить исходные данные, проектную документацию, ' +
      'применённые допущения и подтвердить выводы ответственным специалистом.'
  };
}

function getPlanningRulesSummary() {
  const workIds =
    Array.from(
      new Set(
        BUILDMIND_RESOURCE_RULES
          .map(
            function (rule) {
              return rule.workId;
            }
          )
          .filter(Boolean)
      )
    );

  const familyIds =
    Array.from(
      new Set(
        BUILDMIND_RESOURCE_RULES
          .map(
            function (rule) {
              return rule.familyId;
            }
          )
          .filter(Boolean)
      )
    );

  const variantKeys =
    Array.from(
      new Set(
        BUILDMIND_RESOURCE_RULES
          .filter(
            function (rule) {
              return (
                rule.familyId &&
                rule.variantId
              );
            }
          )
          .map(
            function (rule) {
              return (
                rule.familyId +
                ':' +
                rule.variantId
              );
            }
          )
      )
    );

  const byType = {};

  BUILDMIND_RESOURCE_RULES.forEach(
    function (rule) {
      const type =
        rule.resourceType ||
        'unknown';

      byType[type] =
        (byType[type] || 0) + 1;
    }
  );

  return {
    version:
      BUILDMIND_PLANNING_RULES_VERSION,

    rulesCount:
      BUILDMIND_RESOURCE_RULES.length,

    worksCount:
      workIds.length,

    familiesCount:
      familyIds.length,

    variantsCount:
      variantKeys.length,

    byType
  };
}


/*
  ==================================================
  PUBLIC API
  ==================================================
*/

window.BuildMindPlanningRules = {
  version:
    BUILDMIND_PLANNING_RULES_VERSION,

  rules:
    BUILDMIND_RESOURCE_RULES,

  getById:
    getPlanningRuleById,

  getByWorkId:
    getPlanningRulesByWorkId,

  getForContext:
    getPlanningRulesForContext,

  calculate:
    calculatePlanningRule,

  calculateForWork:
    calculatePlanningRulesForWork,

  calculateForContext:
    calculatePlanningRulesForContext,

  getSummary:
    getPlanningRulesSummary
};

console.info(
  'BuildMind Planning Rules загружены:',
  getPlanningRulesSummary()
);
