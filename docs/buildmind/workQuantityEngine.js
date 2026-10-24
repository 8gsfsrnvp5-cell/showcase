'use strict';

/*
  ==================================================
  BUILDMIND WORK QUANTITY ENGINE — DEMO V1
  ==================================================

  Назначение:
  - находить объём строительной работы
    в уже извлечённом тексте документов;
  - связывать объём с активным контекстом;
  - сохранять документ и страницу-источник;
  - показывать уверенность и основание;
  - не подменять инженерное решение.

  Важно:
  Модуль работает только с уже извлечённым
  текстовым слоем PDF.

  OCR для сканов здесь пока не используется.
*/

const BUILDMIND_WORK_QUANTITY_ENGINE_VERSION =
  'work-quantity-engine-demo-v2';


/*
  ==================================================
  ЕДИНИЦЫ ИЗМЕРЕНИЯ
  ==================================================
*/

const WORK_QUANTITY_UNIT_RULES = [
  {
    pattern:
      /п\.?\s*м\.?/iu,

    unit:
      'п.м.'
  },

  {
    pattern:
      /м²|м2/iu,

    unit:
      'м²'
  },

  {
    pattern:
      /м³|м3/iu,

    unit:
      'м³'
  },

  {
    pattern:
      /км/iu,

    unit:
      'км'
  },

  {
    pattern:
      /м/iu,

    unit:
      'м'
  },

  {
    pattern:
      /шт\.?|штук/iu,

    unit:
      'шт'
  },

  {
    pattern:
      /компл\.?|комплект(?:ов|а)?/iu,

    unit:
      'компл.'
  },

  {
    pattern:
      /т/iu,

    unit:
      'т'
  },

  {
    pattern:
      /кг/iu,

    unit:
      'кг'
  }
];


/*
  ==================================================
  НОРМАЛИЗАЦИЯ
  ==================================================
*/

function normalizeWorkQuantityText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}


function tokenizeWorkQuantityText(
  value
) {
  const normalized =
    normalizeWorkQuantityText(
      value
    );

  if (!normalized) {
    return [];
  }

  const stopWords =
    new Set([
      'на',
      'в',
      'по',
      'для',
      'из',
      'под',
      'над',
      'при',
      'и',
      'или',
      'до',
      'от',
      'к',
      'через',
      'устройство',
      'выполнение',
      'работы',
      'работ'
    ]);

  return normalized
    .split(/[^а-яa-z0-9-]+/iu)
    .filter(
      function (word) {
        return (
          word.length >= 3 &&
          !stopWords.has(word)
        );
      }
    );
}


function getWorkQuantityRoot(
  word
) {
  const normalized =
    normalizeWorkQuantityText(
      word
    );

  if (
    normalized.length <= 4
  ) {
    return normalized;
  }

  const endings = [
    'иями',
    'ями',
    'ами',
    'ого',
    'ему',
    'ому',
    'ыми',
    'ими',
    'ий',
    'ый',
    'ой',
    'ая',
    'яя',
    'ое',
    'ее',
    'ые',
    'ие',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ах',
    'ях',
    'ом',
    'ем',
    'а',
    'я',
    'ы',
    'и',
    'у',
    'ю',
    'е',
    'о'
  ];

  const ending =
    endings.find(
      function (item) {
        return (
          normalized.endsWith(
            item
          ) &&
          normalized.length -
            item.length >=
            4
        );
      }
    );

  if (!ending) {
    return normalized;
  }

  return normalized.slice(
    0,
    -ending.length
  );
}


function getWorkQuantityRoots(
  value
) {
  return tokenizeWorkQuantityText(
    value
  ).map(
    getWorkQuantityRoot
  );
}


function workQuantityRootsMatch(
  firstRoot,
  secondRoot
) {
  if (
    !firstRoot ||
    !secondRoot
  ) {
    return false;
  }

  return (
    firstRoot ===
      secondRoot ||

    (
      firstRoot.length >= 4 &&
      secondRoot.length >= 4 &&

      (
        firstRoot.startsWith(
          secondRoot
        ) ||

        secondRoot.startsWith(
          firstRoot
        )
      )
    )
  );
}


/*
  ==================================================
  РАБОТА С ЧИСЛАМИ
  ==================================================
*/

function parseWorkQuantityNumber(
  value
) {
  const normalized =
    String(value || '')
      .replace(/\s/g, '')
      .replace(',', '.');

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function normalizeWorkQuantityUnit(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  const matchedRule =
    WORK_QUANTITY_UNIT_RULES.find(
      function (rule) {
        return rule.pattern.test(
          normalized
        );
      }
    );

  return matchedRule
    ? matchedRule.unit
    : normalized;
}


/*
  ==================================================
  ПРИОРИТЕТ ИСТОЧНИКА
  ==================================================
*/

function getWorkQuantitySourcePriority(
  classificationId
) {
  const priorities = {
    'work-volume':
      100,

    schedule:
      80,

    specification:
      60,

    'working-documents':
      50,

    estimate:
      40,

    'cable-journal':
      30,

    'explanatory-note':
      20,

    unknown:
      10
  };

  return (
    priorities[
      classificationId
    ] || 10
  );
}


/*
  ==================================================
  СОВПАДЕНИЕ РАБОТЫ С ТЕКСТОМ
  ==================================================
*/

function getWorkQuantityContextProfile(
  context
) {
  const profile = {
    workName:
      context && context.work
        ? context.work
        : '',

    familyId:
      null,

    familyName:
      '',

    variantId:
      null,

    variantName:
      '',

    familyRoots:
      [],

    variantRoots:
      [],

    variantMarkers:
      [],

    resourceNames:
      []
  };


  /*
    ==============================================
    TAXONOMY
    ==============================================
  */

  const taxonomyEngine =
    window.BuildMindWorkTaxonomy;

  let taxonomy = null;

  if (
    taxonomyEngine &&
    typeof taxonomyEngine.classify ===
      'function' &&
    profile.workName
  ) {
    taxonomy =
      taxonomyEngine.classify(
        profile.workName
      );
  }


  if (
    taxonomy &&
    taxonomy.success
  ) {
    if (taxonomy.family) {
      profile.familyId =
        taxonomy.family.id ||
        null;

      profile.familyName =
        taxonomy.family.name ||
        '';

      profile.familyRoots =
        Array.from(
          new Set(
            getWorkQuantityRoots(
              profile.familyName
            )
          )
        );
    }


    if (taxonomy.variant) {
      profile.variantId =
        taxonomy.variant.id ||
        null;

      profile.variantName =
        taxonomy.variant.name ||
        '';

      profile.variantRoots =
        Array.from(
          new Set(
            getWorkQuantityRoots(
              profile.variantName
            )
          )
        );
    }
  }


  /*
    ==============================================
    МАРКЕРЫ ВАРИАНТА

    Например для overpass:
    эстакада
    ==============================================
  */

  if (
    taxonomyEngine &&
    Array.isArray(
      taxonomyEngine.families
    ) &&
    profile.familyId &&
    profile.variantId
  ) {
    const family =
      taxonomyEngine.families.find(
        function (item) {
          return (
            item.id ===
            profile.familyId
          );
        }
      );

    const variant =
      family &&
      Array.isArray(
        family.variants
      )
        ? family.variants.find(
            function (item) {
              return (
                item.id ===
                profile.variantId
              );
            }
          )
        : null;


    if (
      variant &&
      Array.isArray(
        variant.markers
      )
    ) {
      profile.variantMarkers =
        variant.markers
          .map(
            function (marker) {
              return (
                marker.phrase ||
                marker.root ||
                ''
              );
            }
          )
          .filter(Boolean);
    }
  }


  /*
    ==============================================
    ROAD KNOWLEDGE

    Получаем характерные ресурсы работы.

    Они нужны не для определения
    объёма работы, а наоборот —
    чтобы распознать ситуацию:

    "Труба 5800 м"

    как количество материала.
    ==============================================
  */

  const knowledge =
    window.BuildMindRoadKnowledge;

  if (
    knowledge &&
    profile.familyId &&
    typeof knowledge
      .resolveFamilyVariant ===
      'function'
  ) {
    const workKnowledge =
      knowledge.resolveFamilyVariant(
        profile.familyId,
        profile.variantId
      );

    if (
      workKnowledge &&
      Array.isArray(
        workKnowledge.materials
      )
    ) {
      profile.resourceNames =
        workKnowledge.materials
          .flatMap(
            function (resource) {
              return [
                resource.name,
                ...(resource.aliases || [])
              ];
            }
          )
          .map(
            normalizeWorkQuantityText
          )
          .filter(Boolean);
    }
  }


  return profile;
}

const WORK_QUANTITY_INTENT_PHRASES = [
  'объем работ',
  'объём работ',
  'объем работы',
  'объём работы',
  'протяженность',
  'протяжённость',
  'общая длина',
  'длина трассы',
  'длина участка',
  'всего',
  'итого'
];


function getWorkQuantityIntentMatches(
  evidence
) {
  const normalized =
    normalizeWorkQuantityText(
      evidence
    );

  return WORK_QUANTITY_INTENT_PHRASES
    .filter(
      function (phrase) {
        return normalized.includes(
          normalizeWorkQuantityText(
            phrase
          )
        );
      }
    );
}


function getWorkQuantityFamilyMatch(
  profile,
  evidence
) {
  const evidenceRoots =
    getWorkQuantityRoots(
      evidence
    );

  const familyRoots =
    Array.isArray(
      profile.familyRoots
    )
      ? profile.familyRoots
      : [];

  if (
    familyRoots.length === 0
  ) {
    return {
      coverage: 0,
      matchedRoots: []
    };
  }

  const matchedRoots =
    familyRoots.filter(
      function (familyRoot) {
        return evidenceRoots.some(
          function (evidenceRoot) {
            return workQuantityRootsMatch(
              familyRoot,
              evidenceRoot
            );
          }
        );
      }
    );

  return {
    coverage:
      matchedRoots.length /
      familyRoots.length,

    matchedRoots
  };
}


function getWorkQuantityVariantMatches(
  profile,
  evidence
) {
  const normalizedEvidence =
    normalizeWorkQuantityText(
      evidence
    );

  const markers =
    Array.isArray(
      profile.variantMarkers
    )
      ? profile.variantMarkers
      : [];

  return markers.filter(
    function (marker) {
      const normalizedMarker =
        normalizeWorkQuantityText(
          marker
        );

      if (!normalizedMarker) {
        return false;
      }

      if (
        normalizedEvidence.includes(
          normalizedMarker
        )
      ) {
        return true;
      }

      const markerRoots =
        getWorkQuantityRoots(
          normalizedMarker
        );

      const evidenceRoots =
        getWorkQuantityRoots(
          normalizedEvidence
        );

      return markerRoots.some(
        function (markerRoot) {
          return evidenceRoots.some(
            function (evidenceRoot) {
              return workQuantityRootsMatch(
                markerRoot,
                evidenceRoot
              );
            }
          );
        }
      );
    }
  );
}

function findWorkQuantityNearbyResource(
  profile,
  evidence,
  rawQuantity
) {
  const normalizedEvidence =
    normalizeWorkQuantityText(
      evidence
    );

  const resources =
    Array.isArray(
      profile.resourceNames
    )
      ? profile.resourceNames
      : [];

  if (
    resources.length === 0
  ) {
    return null;
  }


  /*
    Смотрим прежде всего текст,
    находящийся непосредственно
    перед найденным количеством.
  */

  const quantityText =
    normalizeWorkQuantityText(
      rawQuantity
    );

  const quantityIndex =
    normalizedEvidence.lastIndexOf(
      quantityText
    );

  const localStart =
    quantityIndex >= 0
      ? Math.max(
          0,
          quantityIndex - 90
        )
      : Math.max(
          0,
          normalizedEvidence.length -
            120
        );

  const localEvidence =
    normalizedEvidence.slice(
      localStart,
      quantityIndex >= 0
        ? quantityIndex
        : undefined
    );


  const matchedResource =
    resources.find(
      function (resourceName) {
        return (
          resourceName.length >= 3 &&
          localEvidence.includes(
            resourceName
          )
        );
      }
    );


  return matchedResource || null;
}

function calculateWorkQuantityTextMatch(
  workName,
  text
) {
  const workRoots =
    Array.from(
      new Set(
        getWorkQuantityRoots(
          workName
        )
      )
    );

  const textRoots =
    Array.from(
      new Set(
        getWorkQuantityRoots(
          text
        )
      )
    );

  if (
    workRoots.length === 0
  ) {
    return {
      score: 0,
      matchedRoots: [],
      coverage: 0
    };
  }

  const matchedRoots =
    workRoots.filter(
      function (workRoot) {
        return textRoots.some(
          function (textRoot) {
            return workQuantityRootsMatch(
              workRoot,
              textRoot
            );
          }
        );
      }
    );

  const coverage =
    matchedRoots.length /
    workRoots.length;

  return {
    score:
      Math.round(
        coverage * 100
      ),

    matchedRoots,

    coverage
  };
}


/*
  ==================================================
  КАНДИДАТЫ КОЛИЧЕСТВА
  ==================================================
*/

function extractWorkQuantityCandidatesFromText(
  text
) {
  const sourceText =
    String(text || '');

  const candidates = [];

  /*
    Поддерживаем:

    5420 м
    5 420 м
    5420,5 м
    5420.5 м
    120 шт.
    12 компл.
  */

  const pattern =
    /(\d{1,3}(?:\s\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(п\.?\s*м\.?|м²|м2|м³|м3|км|м|шт\.?|штук|компл\.?|комплект(?:ов|а)?|кг|т)(?=\s|$|[.,;:)])/giu;

  let match = null;

  while (
    (
      match =
        pattern.exec(
          sourceText
        )
    ) !== null
  ) {
    const quantity =
      parseWorkQuantityNumber(
        match[1]
      );

    if (
      quantity === null ||
      quantity <= 0
    ) {
      continue;
    }

    const unit =
      normalizeWorkQuantityUnit(
        match[2]
      );

    candidates.push({
      quantity,
      unit,

      index:
        match.index,

      raw:
        match[0]
    });
  }

  return candidates;
}


/*
  ==================================================
  ОКНО ТЕКСТА ВОКРУГ КОЛИЧЕСТВА
  ==================================================
*/

function getWorkQuantityEvidenceWindow(
  text,
  candidateIndex,
  beforeLength,
  afterLength
) {
  const sourceText =
    String(text || '');

  const before =
    Number(beforeLength) ||
    220;

  const after =
    Number(afterLength) ||
    100;

  const start =
    Math.max(
      0,
      candidateIndex -
        before
    );

  const end =
    Math.min(
      sourceText.length,
      candidateIndex +
        after
    );

  return sourceText
    .slice(
      start,
      end
    )
    .replace(/\s+/g, ' ')
    .trim();
}


/*
  ==================================================
  ОЦЕНКА КАНДИДАТА
  ==================================================
*/

function scoreWorkQuantityCandidate(
  contextProfile,
  candidate,
  pageText,
  sourcePriority
) {
  const evidence =
    getWorkQuantityEvidenceWindow(
      pageText,
      candidate.index,
      260,
      120
    );


  /*
    Совпадение с исходным
    названием активной работы.
  */

  const workMatch =
    calculateWorkQuantityTextMatch(
      contextProfile.workName,
      evidence
    );


  /*
    Совпадение с семейством.
  */

  const familyMatch =
    getWorkQuantityFamilyMatch(
      contextProfile,
      evidence
    );


  /*
    Признаки конкретного исполнения.
  */

  const variantMatches =
    getWorkQuantityVariantMatches(
      contextProfile,
      evidence
    );


  /*
    Слова, характерные именно
    для объёма работы.
  */

  const intentMatches =
    getWorkQuantityIntentMatches(
      evidence
    );


  /*
    Проверяем, не относится ли
    количество к материалу.
  */

  const nearbyResource =
    findWorkQuantityNearbyResource(
      contextProfile,
      evidence,
      candidate.raw
    );


  let score = 0;


  /*
    ==============================================
    1. FAMILY

    Теперь семейство является
    основным смысловым признаком.
    ==============================================
  */

  score +=
    familyMatch.coverage *
    40;


  /*
    ==============================================
    2. ИСХОДНОЕ НАЗВАНИЕ РАБОТЫ
    ==============================================
  */

  score +=
    workMatch.coverage *
    15;


  /*
    ==============================================
    3. ВАРИАНТ ИСПОЛНЕНИЯ
    ==============================================
  */

  if (
    variantMatches.length > 0
  ) {
    score += 15;
  }


  /*
    ==============================================
    4. ПРИЗНАКИ ОБЪЁМА РАБОТЫ
    ==============================================
  */

  if (
    intentMatches.length > 0
  ) {
    score += 15;
  }


  /*
    ==============================================
    5. ТИП ДОКУМЕНТА
    ==============================================
  */

  score +=
    (
      Number(
        sourcePriority
      ) /
      100
    ) *
    10;


  /*
    ==============================================
    6. ПОДХОДЯЩАЯ ЕДИНИЦА
    ==============================================
  */

  if (
    [
      'м',
      'п.м.',
      'м²',
      'м³',
      'км',
      'шт',
      'компл.'
    ].includes(
      candidate.unit
    )
  ) {
    score += 5;
  }


  /*
    ==============================================
    ЗАЩИТА:

    Если непосредственно перед
    числом найден материал,
    это вероятнее количество
    материала, а не объём работы.

    Мы не выбрасываем запись —
    сохраняем её как вспомогательную.
    ==============================================
  */

  let candidateKind =
    'work-quantity-candidate';

  let eligibleForWorkQuantity =
    true;


  if (nearbyResource) {
    score -= 35;

    candidateKind =
      'material-quantity';

    eligibleForWorkQuantity =
      false;
  }


  /*
    Для надёжного объёма работы
    должно быть достаточно
    инженерного контекста.

    Одних двух совпавших слов
    уже недостаточно.
  */

  const strongWorkContext =
    Boolean(
      familyMatch.coverage >= 1 &&
      (
        variantMatches.length > 0 ||
        intentMatches.length > 0 ||
        workMatch.coverage >= 0.75
      )
    );


  if (!strongWorkContext) {
    eligibleForWorkQuantity =
      false;
  }


  return {
    score:
      Math.max(
        0,
        Math.min(
          Math.round(score),
          100
        )
      ),

    evidence,

    workMatch,

    familyMatch,

    variantMatches,

    intentMatches,

    nearbyResource,

    candidateKind,

    eligibleForWorkQuantity,

    strongWorkContext
  };
}


/*
  ==================================================
  УРОВЕНЬ УВЕРЕННОСТИ
  ==================================================
*/

function getWorkQuantityConfidence(
  score
) {
  if (score >= 85) {
    return {
      level:
        'high',

      label:
        'Высокая'
    };
  }

  if (score >= 70) {
    return {
      level:
        'medium',

      label:
        'Средняя'
    };
  }

  if (score >= 55) {
    return {
      level:
        'low',

      label:
        'Низкая'
    };
  }

  return {
    level:
      'none',

    label:
      'Недостаточно данных'
  };
}


/*
  ==================================================
  АНАЛИЗ ОДНОГО ДОКУМЕНТА
  ==================================================
*/

function analyzeWorkQuantityDocument(
  documentItem,
  context
) {
  if (
    !documentItem ||
    !documentItem.analysis ||
    !documentItem.analysis.success ||
    !context
  ) {
    return [];
  }

  const contextProfile =
    getWorkQuantityContextProfile(
      context
    );
  
  const extractedPages =
    Array.isArray(
      documentItem.analysis
        .extractedPages
    )
      ? documentItem.analysis
          .extractedPages
      : [];

  const classification =
    documentItem.analysis
      .documentClassification ||
    {};

  const classificationId =
    classification.id ||
    'unknown';

  const sourcePriority =
    getWorkQuantitySourcePriority(
      classificationId
    );

  const results = [];

  extractedPages.forEach(
    function (pageItem) {
      const pageText =
        String(
          pageItem.text ||
          ''
        );

      const quantityCandidates =
        extractWorkQuantityCandidatesFromText(
          pageText
        );

          quantityCandidates.forEach(
        function (
          quantityCandidate
        ) {
          const scoring =
            scoreWorkQuantityCandidate(
              contextProfile,
              quantityCandidate,
              pageText,
              sourcePriority
            );

          if (
            scoring.score < 45
          ) {
            return;
          }

          results.push({
            quantity:
              quantityCandidate.quantity,

            unit:
              quantityCandidate.unit,

            rawQuantity:
              quantityCandidate.raw,

            score:
              scoring.score,

            candidateKind:
              scoring.candidateKind,

            eligibleForWorkQuantity:
              scoring.eligibleForWorkQuantity,

            strongWorkContext:
              scoring.strongWorkContext,

            familyCoverage:
              scoring.familyMatch.coverage,

            familyMatchedRoots:
              scoring.familyMatch
                .matchedRoots,

            variantMatches:
              scoring.variantMatches,

            intentMatches:
              scoring.intentMatches,

            nearbyResource:
              scoring.nearbyResource,

            confidence:
              getWorkQuantityConfidence(
                scoring.score
              ),

            matchedRoots:
              scoring.workMatch
                .matchedRoots,

            workCoverage:
              scoring.workMatch
                .coverage,

            evidence:
              scoring.evidence,

            sourceDocument:
              documentItem.file
                ? documentItem.file.name
                : (
                    documentItem.analysis
                      .fileName ||
                    ''
                  ),

            sourcePage:
              pageItem.pageNumber,

            sourceType:
              classificationId,

            sourceLabel:
              classification.label ||
              'Тип документа не определён',

            sourcePriority,

            requiresEngineerConfirmation:
              true
          });
         }
      );
    }
  );

  return results;
}


/*
  ==================================================
  ПОЛУЧЕНИЕ ТЕКУЩИХ ДОКУМЕНТОВ
  ==================================================
*/

function getWorkQuantityProjectDocuments() {
  if (
    typeof uploadedProjectDocuments !==
      'undefined' &&
    Array.isArray(
      uploadedProjectDocuments
    )
  ) {
    return uploadedProjectDocuments;
  }

  return [];
}


/*
  ==================================================
  АКТИВНЫЙ КОНТЕКСТ
  ==================================================
*/

function getWorkQuantityActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window
      .BuildMindWorkContexts
      .getActive === 'function'
  ) {
    return window
      .BuildMindWorkContexts
      .getActive();
  }

  return null;
}


/*
  ==================================================
  ГЛАВНЫЙ ПОИСК
  ==================================================
*/

function findBuildMindWorkQuantity(
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const context =
    settings.context ||
    getWorkQuantityActiveContext();

  if (!context) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.'
    };
  }

  const documents =
    Array.isArray(
      settings.documents
    )
      ? settings.documents
      : getWorkQuantityProjectDocuments();

  const analyzedDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.analysis &&
          documentItem.analysis
            .success
        );
      }
    );

  if (
    analyzedDocuments.length ===
    0
  ) {
    return {
      success: false,

      errorCode:
        'ANALYZED_DOCUMENTS_NOT_FOUND',

      errorMessage:
        'Нет проанализированных документов с извлечённым текстом.',

      context,

      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  analyzedDocuments.forEach(
    function (
      documentItem
    ) {
      candidates.push(
        ...analyzeWorkQuantityDocument(
          documentItem,
          context
        )
      );
    }
  );

  candidates.sort(
    function (
      first,
      second
    ) {
      if (
        second.score !==
        first.score
      ) {
        return (
          second.score -
          first.score
        );
      }

      return (
        second.sourcePriority -
        first.sourcePriority
      );
    }
  );

 const eligibleCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate
          .eligibleForWorkQuantity ===
        true
      );
    }
  );


const bestCandidate =
  eligibleCandidates[0];

  if (
    !bestCandidate ||
    bestCandidate.score < 55
  ) {
    return {
      success: false,

      errorCode:
        'WORK_QUANTITY_NOT_CONFIDENT',

      errorMessage:
        'Надёжный объём работы в документах пока не найден.',

      context,

      candidates:
        candidates.slice(
          0,
          10
        ),

eligibleCandidates:
  eligibleCandidates.slice(
    0,
    10
  ),
      
      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

    context: {
      ...context
    },

    quantity:
      bestCandidate.quantity,

    unit:
      bestCandidate.unit,

    sourceDocument:
      bestCandidate.sourceDocument,

    sourcePage:
      bestCandidate.sourcePage,

    sourceType:
      bestCandidate.sourceType,

    sourceLabel:
      bestCandidate.sourceLabel,

    evidence:
      bestCandidate.evidence,

    score:
      bestCandidate.score,

    confidence:
      bestCandidate.confidence,

    matchedRoots:
      bestCandidate.matchedRoots,

    workCoverage:
      bestCandidate.workCoverage,

    alternatives:
      candidates
        .slice(1, 6),

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      bestCandidate.confidence
        .level === 'high'
          ? 'candidate-high-confidence'
          : 'requires-review',

    disclaimer:
      'Объём найден автоматически в извлечённом тексте документа. ' +
      'Рекомендуется проверить название работы, единицу измерения, ' +
      'значение объёма и страницу-источник перед использованием в планировании.'
  };
}


/*
  ==================================================
  ТЕСТ НА ПЕРЕДАННЫХ СТРАНИЦАХ

  Нужен для безопасной проверки алгоритма
  до интеграции с Planning Engine.
  ==================================================
*/

function testBuildMindWorkQuantityPages(
  workName,
  pages,
  documentType
) {
  const fakeDocument = {
    file: {
      name:
        'DEMO-WORK-QUANTITY.pdf'
    },

    analysis: {
      success: true,

      documentClassification: {
        id:
          documentType ||
          'work-volume',

        label:
          'Тестовый документ'
      },

      extractedPages:
        Array.isArray(pages)
          ? pages
          : []
    }
  };

  return findBuildMindWorkQuantity({
    context: {
      id:
        'quantity-test',

      project:
        'Тест',

      object:
        'Тест',

      work:
        workName
    },

    documents: [
      fakeDocument
    ]
  });
}


/*
  ==================================================
  СВОДКА
  ==================================================
*/

function getBuildMindWorkQuantitySummary() {
  const documents =
    getWorkQuantityProjectDocuments();

  const analyzedCount =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.analysis &&
          documentItem.analysis
            .success
        );
      }
    ).length;

  return {
    version:
      BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

    projectDocuments:
      documents.length,

    analyzedDocuments:
      analyzedCount
  };
}


/*
  ==================================================
  PUBLIC API
  ==================================================
*/

window.BuildMindWorkQuantity = {
  version:
    BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

  find:
    findBuildMindWorkQuantity,

  analyzeDocument:
    analyzeWorkQuantityDocument,

  calculateTextMatch:
    calculateWorkQuantityTextMatch,

  extractCandidates:
    extractWorkQuantityCandidatesFromText,

  testPages:
    testBuildMindWorkQuantityPages,

  getSummary:
    getBuildMindWorkQuantitySummary
};


console.info(
  'BuildMind Work Quantity Engine загружен:',
  getBuildMindWorkQuantitySummary()
);
