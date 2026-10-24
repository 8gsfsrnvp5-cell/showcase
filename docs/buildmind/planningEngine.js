'use strict';

/*
  ==================================================
  BUILDMIND PLANNING ENGINE — CORE V2.1
  ==================================================

  Назначение:
  - объединить активную работу;
  - реальные материалы BuildMind;
  - Road Knowledge Base;
  - Engineering Audit;
  - Planning Rules;
  - сформировать единый инженерный анализ.

  Важно:
  BuildMind не принимает окончательные решения.
  Все выводы требуют проверки ответственным специалистом.
*/

const BUILDMIND_PLANNING_ENGINE_VERSION =
  'planning-engine-core-v2.1';


function getPlanningEngineActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window.BuildMindWorkContexts
      .getActive === 'function'
  ) {
    return (
      window.BuildMindWorkContexts
        .getActive()
    );
  }

  return null;
}


function getPlanningEngineMaterials() {
  if (
    typeof materials !==
    'undefined' &&
    Array.isArray(materials)
  ) {
    return materials;
  }

  return [];
}


function normalizePlanningEngineText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}


function getPlanningEngineContextMaterials(
  context,
  allMaterials
) {
  if (!context) {
    return [];
  }

  const project =
    normalizePlanningEngineText(
      context.project
    );

  const object =
    normalizePlanningEngineText(
      context.object
    );

  const work =
    normalizePlanningEngineText(
      context.work
    );

  return allMaterials.filter(
    function (material) {
      return (
        normalizePlanningEngineText(
          material.project
        ) === project &&

        normalizePlanningEngineText(
          material.object
        ) === object &&

        normalizePlanningEngineText(
          material.work
        ) === work
      );
    }
  );
}


function calculatePlanningEngineMaterialState(
  material
) {
  const need =
    Number(material.need) || 0;

  const stock =
    Number(material.stock) || 0;

  const reserved =
    Number(material.reserved) || 0;

  const confirmed =
    Number(material.confirmed) || 0;

  const free =
    Math.max(
      stock - reserved,
      0
    );

  const available =
    free + confirmed;

  const deficit =
    Math.max(
      need - available,
      0
    );

  return {
    ...material,

    need,
    stock,
    reserved,
    confirmed,
    free,
    available,
    deficit
  };
}


function resolvePlanningEngineWork(
  context
) {
  const knowledge =
    window.BuildMindRoadKnowledge;

  if (
    !knowledge ||
    !context
  ) {
    return {
      success: false,

      errorCode:
        'KNOWLEDGE_OR_CONTEXT_NOT_FOUND',

      errorMessage:
        'Не найдена база знаний или активный контекст.'
    };
  }

  const taxonomy =
    (
      window.BuildMindWorkTaxonomy &&
      typeof window
        .BuildMindWorkTaxonomy
        .classify === 'function'
    )
      ? window
          .BuildMindWorkTaxonomy
          .classify(
            context.work
          )
      : null;

  const matcher =
    (
      window.BuildMindWorkMatcher &&
      typeof window
        .BuildMindWorkMatcher
        .find === 'function'
    )
      ? window
          .BuildMindWorkMatcher
          .find(
            context.work
          )
      : null;

  /*
    Основной новый путь:

    реальное название
    → Taxonomy
    → family
    → variant
    → Road Knowledge Family
  */

  if (
    taxonomy &&
    taxonomy.success &&
    taxonomy.family &&
    taxonomy.variant &&
    typeof knowledge
      .resolveFamilyVariant ===
      'function'
  ) {
    const familyWork =
      knowledge.resolveFamilyVariant(
        taxonomy.family.id,
        taxonomy.variant.id
      );

    if (familyWork) {
      return {
        success: true,

        source:
          'taxonomy-family-variant',

        workItem:
          familyWork,

        taxonomy,

        matcher
      };
    }
  }

  /*
    Второй путь:
    обычный Work Matcher.
  */

  if (
    matcher &&
    matcher.success &&
    matcher.matchedWork &&
    typeof knowledge
      .getWorkById ===
      'function'
  ) {
    const matchedWork =
      knowledge.getWorkById(
        matcher.matchedWork.id
      );

    if (matchedWork) {
      return {
        success: true,

        source:
          'work-matcher',

        workItem:
          matchedWork,

        taxonomy,

        matcher
      };
    }
  }

  /*
    Legacy fallback.
  */

  if (
    typeof knowledge
      .findWorkByName ===
      'function'
  ) {
    const legacyWork =
      knowledge.findWorkByName(
        context.work
      );

    if (legacyWork) {
      return {
        success: true,

        source:
          'legacy-name-match',

        workItem:
          legacyWork,

        taxonomy,

        matcher
      };
    }
  }

  /*
    Семейство известно,
    но вариант не определён.
  */

  if (
    taxonomy &&
    taxonomy.success &&
    taxonomy.family &&
    !taxonomy.variant
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VARIANT_REQUIRED',

      errorMessage:
        'Семейство работы определено, но вариант исполнения требует уточнения.',

      taxonomy,

      matcher
    };
  }

  return {
    success: false,

    errorCode:
      'WORK_NOT_RESOLVED',

    errorMessage:
      'Не удалось надёжно определить инженерную модель работы.',

    taxonomy,

    matcher
  };
}
function getPlanningEngineFallbackWorkQuantity(
  contextMaterials
) {
  if (
    !Array.isArray(
      contextMaterials
    ) ||
    contextMaterials.length === 0
  ) {
    return {
      quantity: null,
      unit: '',
      source:
        'not-determined'
    };
  }

  /*
    Core V1:
    пока используем крупнейшую
    потребность среди материалов
    как временный источник объёма.

    Это НЕ финальная логика.

    Позже объём работы будет
    извлекаться из ГПР / ВОР /
    проектной документации.
  */

  const sorted =
    contextMaterials
      .map(
        calculatePlanningEngineMaterialState
      )
      .sort(
        function (first, second) {
          return (
            second.need -
            first.need
          );
        }
      );

  const primary =
    sorted[0];

  if (!primary) {
    return {
      quantity: null,
      unit: '',
      source:
        'not-determined'
    };
  }

   return {
    quantity:
      Number(primary.need) || null,

    unit:
      primary.unit || '',

    source:
      'temporary-material-need',

    sourceLabel:
      'Временная оценка по материальной потребности',

    sourceMaterial:
      primary.name || '',

    confidence: {
      level:
        'low',

      label:
        'Низкая'
    },

    requiresEngineerConfirmation:
      true,

    warning:
      'Объём работы временно определён по крупнейшей материальной потребности, а не непосредственно из проектного документа.'
  };
}

function resolvePlanningEngineWorkQuantity(
  activeContext,
  contextMaterials,
  settings
) {
  const options =
    settings &&
    typeof settings ===
      'object'
      ? settings
      : {};

  /*
    ==============================================
    1. РУЧНОЙ ОБЪЁМ

    Имеет высший приоритет,
    если пользователь передал его явно.
    ==============================================
  */

  if (
    options.workQuantity !==
      undefined &&
    options.workQuantity !==
      null &&
    options.workQuantity !==
      ''
  ) {
    const manualQuantity =
      Number(
        options.workQuantity
      );

    if (
      Number.isFinite(
        manualQuantity
      ) &&
      manualQuantity > 0
    ) {
      return {
        quantity:
          manualQuantity,

        unit:
          options.workUnit ||
          '',

        source:
          'manual-input',

        sourceLabel:
          'Объём задан вручную',

        confidence: {
          level:
            'manual',

          label:
            'Задан пользователем'
        },

        requiresEngineerConfirmation:
          true
      };
    }
  }


  /*
    ==============================================
    2. ОБЪЁМ ИЗ ПРОЕКТНОГО ДОКУМЕНТА
    ==============================================
  */

  const quantityEngine =
    window.BuildMindWorkQuantity;

  let documentSearch =
    null;

  if (
    quantityEngine &&
    typeof quantityEngine.find ===
      'function'
  ) {
    documentSearch =
      quantityEngine.find({
        context:
          activeContext
      });

    if (
      documentSearch &&
      documentSearch.success
    ) {
      return {
        quantity:
          documentSearch.quantity,

        unit:
          documentSearch.unit,

        source:
          'document-analysis',

        sourceLabel:
          documentSearch.sourceLabel ||
          'Проектный документ',

        sourceDocument:
          documentSearch.sourceDocument ||
          '',

        sourcePage:
          documentSearch.sourcePage ||
          null,

        sourceType:
          documentSearch.sourceType ||
          '',

        evidence:
          documentSearch.evidence ||
          '',

        score:
          documentSearch.score,

        confidence:
          documentSearch.confidence,

        requiresEngineerConfirmation:
          true,

        documentSearch: {
          success:
            true,

          decisionStatus:
            documentSearch
              .decisionStatus ||
            'requires-review'
        }
      };
    }
  }


  /*
    ==============================================
    3. ВРЕМЕННЫЙ FALLBACK ПО МАТЕРИАЛАМ

    Документ не дал достаточно
    надёжного результата.

    BuildMind не придумывает число,
    а явно помечает временный источник.
    ==============================================
  */

  const fallback =
    getPlanningEngineFallbackWorkQuantity(
      contextMaterials
    );

  if (
    fallback &&
    fallback.quantity !==
      null
  ) {
    return {
      ...fallback,

      documentSearch:
        documentSearch
          ? {
              success:
                false,

              errorCode:
                documentSearch
                  .errorCode ||
                'WORK_QUANTITY_NOT_FOUND',

              errorMessage:
                documentSearch
                  .errorMessage ||
                'Объём работы в документах не подтверждён.'
            }
          : {
              success:
                false,

              errorCode:
                'WORK_QUANTITY_ENGINE_NOT_AVAILABLE',

              errorMessage:
                'Модуль поиска объёма в документах недоступен.'
            }
    };
  }


  /*
    ==============================================
    4. НЕТ НИ ОДНОГО ДОСТОВЕРНОГО ИСТОЧНИКА
    ==============================================
  */

  return {
    quantity:
      null,

    unit:
      '',

    source:
      'not-determined',

    sourceLabel:
      'Объём не определён',

    confidence: {
      level:
        'none',

      label:
        'Недостаточно данных'
    },

    requiresEngineerConfirmation:
      true,

    documentSearch:
      documentSearch
        ? {
            success:
              false,

            errorCode:
              documentSearch
                .errorCode ||
              'WORK_QUANTITY_NOT_FOUND',

            errorMessage:
              documentSearch
                .errorMessage ||
              'Объём работы в документах не подтверждён.'
          }
        : null
  };
}

function planningEngineResourceFound(
  resource,
  contextMaterials
) {
  const searchableNames = [
    resource.name,
    ...(resource.aliases || [])
  ]
    .map(
      normalizePlanningEngineText
    )
    .filter(Boolean);

  return contextMaterials.some(
    function (material) {
      const materialName =
        normalizePlanningEngineText(
          material.name
        );

      return searchableNames.some(
        function (
          searchableName
        ) {
          return (
            materialName.includes(
              searchableName
            ) ||
            searchableName.includes(
              materialName
            )
          );
        }
      );
    }
  );
}


function runPlanningEngineFamilyAudit(
  workItem,
  contextMaterials
) {
  const materialsToCheck =
    Array.isArray(
      workItem.materials
    )
      ? workItem.materials
      : [];

  const missingRequiredMaterials =
    materialsToCheck
      .filter(
        function (resource) {
          return (
            resource.required &&
            !planningEngineResourceFound(
              resource,
              contextMaterials
            )
          );
        }
      )
      .map(
        function (resource) {
          return {
            id:
              resource.id || '',

            name:
              resource.name || '',

            role:
              resource.role || ''
          };
        }
      );

  const typicalMissingChecks =
    (
      workItem.typicalMissing ||
      []
    ).map(
      function (item) {
        return {
          name:
            item.name || '',

          reason:
            item.reason || '',

          found:
            planningEngineResourceFound(
              {
                name:
                  item.name || '',

                aliases:
                  item.aliases || []
              },

              contextMaterials
            )
        };
      }
    );

  return {
    success: true,

    mode:
      'family-variant-audit',

    workId:
      workItem.id,

    familyId:
      workItem.familyId ||
      null,

    variantId:
      workItem.variantId ||
      null,

    missingRequiredMaterials,

    typicalMissingChecks,

    requiresEngineerConfirmation:
      true,

    disclaimer:
      'Проверка комплектности выполнена по предварительной базе знаний BuildMind. ' +
      'Рекомендуется сверить результат с проектной документацией и подтвердить ответственным специалистом.'
  };
}

function runPlanningEngineAudit(
  workItem,
  contextMaterials
) {
  if (!workItem) {
    return null;
  }

  /*
    Новая Family + Variant модель.
  */

  if (
    workItem.knowledgeMode ===
      'family-variant'
  ) {
    return runPlanningEngineFamilyAudit(
      workItem,
      contextMaterials
    );
  }

  /*
    Старые типовые работы
    продолжают использовать
    Engineering Audit.
  */

  const auditEngine =
    window.BuildMindEngineeringAudit;

  if (
    !auditEngine ||
    typeof auditEngine.run !==
      'function'
  ) {
    return null;
  }

  return auditEngine.run({
    workId:
      workItem.id,

    materials:
      contextMaterials
  });
}


function runPlanningEngineRules(
  workItem,
  workQuantity
) {
  const rulesEngine =
    window.BuildMindPlanningRules;

  if (
    !rulesEngine ||
    !workItem
  ) {
    return null;
  }

  if (
    workQuantity.quantity ===
    null
  ) {
    return {
      success: false,

      errorCode:
        'WORK_QUANTITY_NOT_DETERMINED',

      errorMessage:
        'Объём работы пока не определён.'
    };
  }

  const calculationInput = {
    workQuantity:
      workQuantity.quantity,

    workUnit:
      workQuantity.unit
  };

  /*
    Новый V2-путь.
  */

  if (
    typeof rulesEngine
      .calculateForContext ===
      'function'
  ) {
    return rulesEngine
      .calculateForContext(
        {
          workId:
            workItem.legacyWorkId ||
            (
              workItem.familyId
                ? null
                : workItem.id
            ),

          familyId:
            workItem.familyId ||
            null,

          variantId:
            workItem.variantId ||
            null
        },

        calculationInput
      );
  }

  /*
    Совместимость с V1.
  */

  if (
    typeof rulesEngine
      .calculateForWork ===
      'function'
  ) {
    return rulesEngine
      .calculateForWork(
        workItem.id,
        calculationInput
      );
  }

  return null;
}


function buildPlanningEngineMaterialRisks(
  contextMaterials
) {
  return contextMaterials
    .map(
      calculatePlanningEngineMaterialState
    )
    .filter(
      function (material) {
        return (
          material.deficit > 0
        );
      }
    )
    .map(
      function (material) {
        return {
          type:
            'material-deficit',

          severity:
            'warning',

          materialName:
            material.name,

          deficit:
            material.deficit,

          unit:
            material.unit,

          message:
            'По текущим данным обнаружен дефицит материала.',

          verification:
            'Рекомендуется проверить складские остатки, резерв и подтверждённые поставки.',

          requiresEngineerConfirmation:
            true
        };
      }
    );
}


function buildPlanningEngineScheduleState(
  context
) {
  if (!context) {
    return {
      startDate: null,
      endDate: null,
      safetyDays: 0
    };
  }

  return {
    startDate:
      context.startDate || null,

    endDate:
      context.endDate || null,

    safetyDays:
      Number(
        context.safetyDays || 0
      )
  };
}


function calculatePlanningEngineRiskLevel(
  materialRisks,
  audit,
  planningRules
) {
  const hasMaterialDeficit =
    Array.isArray(
      materialRisks
    ) &&
    materialRisks.length > 0;

  const hasRequiredMissing =
    Boolean(
      audit &&
      audit.success &&
      Array.isArray(
        audit.missingRequiredMaterials
      ) &&
      audit.missingRequiredMaterials
        .length > 0
    );

  const hasAuditWarnings =
    Boolean(
      audit &&
      audit.success &&
      Array.isArray(
        audit.typicalMissingChecks
      ) &&
      audit.typicalMissingChecks.some(
        function (item) {
          return !item.found;
        }
      )
    );

  if (
    hasMaterialDeficit ||
    hasRequiredMissing
  ) {
    return {
      level:
        'high',

      label:
        'Высокое внимание',

      explanation:
        'Выявлены дефициты или отсутствующие обязательные позиции.'
    };
  }

  if (hasAuditWarnings) {
    return {
      level:
        'medium',

      label:
        'Требуется проверка',

      explanation:
        'Выявлены позиции, которые рекомендуется дополнительно проверить.'
    };
  }

  if (
    planningRules &&
    planningRules.success
  ) {
    return {
      level:
        'low',

      label:
        'Критичных отклонений не выявлено',

      explanation:
        'По имеющимся данным существенных отклонений не обнаружено.'
    };
  }

  return {
    level:
      'unknown',

    label:
      'Недостаточно данных',

    explanation:
      'Для полноценной оценки недостаточно исходной информации.'
  };
}


function buildPlanningEngineRecommendations(
  audit,
  materialRisks,
  planningRules
) {
  const recommendations = [];

  if (
    Array.isArray(materialRisks) &&
    materialRisks.length > 0
  ) {
    recommendations.push({
      category:
        'materials',

      text:
        'Рекомендуется проверить материальные дефициты и подтверждённые поставки.'
    });
  }

  if (
    audit &&
    audit.success
  ) {
    const missingRequired =
      audit.missingRequiredMaterials ||
      [];

    if (
      missingRequired.length > 0
    ) {
      recommendations.push({
        category:
          'audit',

        text:
          'Рекомендуется проверить комплектность обязательных ресурсов по выбранной работе.'
      });
    }

    const unresolvedTypical =
      (
        audit.typicalMissingChecks ||
        []
      ).filter(
        function (item) {
          return !item.found;
        }
      );

    if (
      unresolvedTypical.length > 0
    ) {
      recommendations.push({
        category:
          'audit',

        text:
          'Обнаружены типовые позиции, которые часто отсутствуют в проектной документации. Рекомендуется проверить их наличие.'
      });
    }
  }

  if (
    planningRules &&
    planningRules.success &&
    Array.isArray(
      planningRules.results
    )
  ) {
    recommendations.push({
      category:
        'planning',

      text:
        'Сформированы предварительные расчётные оценки ресурсов. Рекомендуется проверить коэффициенты и исходный объём работы.'
    });
  }

  if (
    recommendations.length === 0
  ) {
    recommendations.push({
      category:
        'general',

      text:
        'Рекомендуется подтвердить исходные данные и результаты анализа ответственным специалистом.'
    });
  }

  return recommendations;
}


function runBuildMindPlanningEngine(
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const activeContext =
    settings.context ||
    getPlanningEngineActiveContext();

  if (!activeContext) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.'
    };
  }

  const allMaterials =
    getPlanningEngineMaterials();

  const contextMaterials =
    getPlanningEngineContextMaterials(
      activeContext,
      allMaterials
    );

  const workResolution =
  resolvePlanningEngineWork(
    activeContext
  );

if (
  !workResolution ||
  !workResolution.success
) {
  return {
    success: false,

    errorCode:
      workResolution &&
      workResolution.errorCode
        ? workResolution.errorCode
        : 'WORK_NOT_RESOLVED',

    errorMessage:
      workResolution &&
      workResolution.errorMessage
        ? workResolution.errorMessage
        : 'Активная работа не распознана.',

    context:
      activeContext,

    taxonomy:
      workResolution
        ? workResolution.taxonomy ||
          null
        : null,

    matcher:
      workResolution
        ? workResolution.matcher ||
          null
        : null
  };
}

const workItem =
  workResolution.workItem;

   const workQuantity =
    resolvePlanningEngineWorkQuantity(
      activeContext,
      contextMaterials,
      settings
    );

  const engineeringAudit =
    runPlanningEngineAudit(
      workItem,
      contextMaterials
    );

  const planningRules =
    runPlanningEngineRules(
      workItem,
      workQuantity
    );

  const materialRisks =
    buildPlanningEngineMaterialRisks(
      contextMaterials
    );

  const schedule =
    buildPlanningEngineScheduleState(
      activeContext
    );

  const riskLevel =
    calculatePlanningEngineRiskLevel(
      materialRisks,
      engineeringAudit,
      planningRules
    );

  const recommendations =
    buildPlanningEngineRecommendations(
      engineeringAudit,
      materialRisks,
      planningRules
    );

  return {
    success: true,

    version:
      BUILDMIND_PLANNING_ENGINE_VERSION,

    generatedAt:
      new Date().toISOString(),

    context:
      {
        ...activeContext
      },

  work: {
  id:
    workItem.id,

  name:
    workItem.name,

  category:
    workItem.categoryName || '',

  familyId:
    workItem.familyId ||
    null,

  familyName:
    workItem.familyName ||
    '',

  variantId:
    workItem.variantId ||
    null,

  variantName:
    workItem.variantName ||
    '',

  resolutionSource:
    workResolution.source
},

taxonomy:
  workResolution.taxonomy ||
  null,

matcher:
  workResolution.matcher ||
  null,

    schedule,

    workQuantity,

    materials: {
      total:
        contextMaterials.length,

      items:
        contextMaterials.map(
          calculatePlanningEngineMaterialState
        )
    },

    engineeringAudit,

    planningRules,

    risks: {
      overall:
        riskLevel,

      materials:
        materialRisks
    },

    recommendations,

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      'requires-review',

    disclaimer:
      'BuildMind формирует предварительный аналитический результат. ' +
      'Рекомендуется проверить исходные данные, проектную документацию, ' +
      'применённые расчётные правила и подтвердить выводы ответственным специалистом.'
  };
}


function getBuildMindPlanningReadableResult(
  result
) {
  if (
    !result ||
    !result.success
  ) {
    return (
      result &&
      result.errorMessage
        ? result.errorMessage
        : 'Не удалось выполнить анализ.'
    );
  }

  const lines = [];

  lines.push(
    'BUILDMIND — ПРЕДВАРИТЕЛЬНЫЙ ИНЖЕНЕРНЫЙ АНАЛИЗ'
  );

  lines.push('');

  lines.push(
    `Работа: ${result.work.name}`
  );

 lines.push(
  `Категория: ${result.work.category}`
);

if (
  result.work.familyName
) {
  lines.push(
    `Семейство: ${result.work.familyName}`
  );
}

if (
  result.work.variantName
) {
  lines.push(
    `Исполнение: ${result.work.variantName}`
  );
}

  lines.push(
    'Объём работы: ' +
    (
      result.workQuantity &&
      result.workQuantity.quantity !==
        null
        ? (
            `${result.workQuantity.quantity} ` +
            `${result.workQuantity.unit || ''}`
          )
        : 'не определён'
    )
  );


  if (
    result.workQuantity &&
    result.workQuantity.sourceLabel
  ) {
    lines.push(
      `Источник объёма: ` +
      `${result.workQuantity.sourceLabel}`
    );
  }


  if (
    result.workQuantity &&
    result.workQuantity.sourceDocument
  ) {
    lines.push(
      `Документ: ` +
      `${result.workQuantity.sourceDocument}`
    );
  }


  if (
    result.workQuantity &&
    result.workQuantity.sourcePage
  ) {
    lines.push(
      `Страница источника: ` +
      `${result.workQuantity.sourcePage}`
    );
  }


  if (
    result.workQuantity &&
    result.workQuantity.confidence &&
    result.workQuantity.confidence.label
  ) {
    lines.push(
      `Уверенность объёма: ` +
      `${result.workQuantity.confidence.label}`
    );
  }


  if (
    result.workQuantity &&
    result.workQuantity.warning
  ) {
    lines.push(
      `Важно: ` +
      `${result.workQuantity.warning}`
    );
  }

  lines.push('');
  
lines.push('');

  lines.push(
    `Статус анализа: ${result.risks.overall.label}`
  );

  lines.push(
    result.risks.overall.explanation
  );

  lines.push('');

  lines.push(
    'Материалы текущего контекста:'
  );

  if (
    result.materials.items.length ===
    0
  ) {
    lines.push(
      '— Материалы пока не найдены.'
    );
  } else {
    result.materials.items.forEach(
      function (material) {
        lines.push(
          `• ${material.name}: ` +
          `потребность ${material.need} ${material.unit}, ` +
          `доступно ${material.available} ${material.unit}, ` +
          `дефицит ${material.deficit} ${material.unit}`
        );
      }
    );
  }

  lines.push('');

  if (
    result.planningRules &&
    result.planningRules.success
  ) {
    lines.push(
      'Предварительные расчётные ресурсы:'
    );

    result.planningRules.results
      .forEach(
        function (resource) {
          if (!resource.success) {
            return;
          }

          lines.push(
            `• ${resource.resourceName}: ` +
            `${resource.calculatedQuantity} ` +
            `${resource.outputUnit} ` +
            `(уверенность: ${resource.confidence})`
          );
        }
      );

    lines.push('');
  }

  lines.push(
    'Рекомендации для проверки:'
  );

  result.recommendations.forEach(
    function (recommendation) {
      lines.push(
        `• ${recommendation.text}`
      );
    }
  );

  lines.push('');

  lines.push(
    'Статус решения: требует проверки ответственным специалистом.'
  );

  return lines.join('\n');
}


window.BuildMindPlanningEngine = {
  version:
    BUILDMIND_PLANNING_ENGINE_VERSION,

  run:
    runBuildMindPlanningEngine,

  toText:
    getBuildMindPlanningReadableResult
};


console.info(
  'BuildMind Planning Engine загружен:',
  {
    version:
      BUILDMIND_PLANNING_ENGINE_VERSION
  }
);
