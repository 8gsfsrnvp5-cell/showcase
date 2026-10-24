'use strict';

/*
  ==================================================
  BUILDMIND WORK TAXONOMY — DEMO V1
  ==================================================

  Назначение:
  - определять семейство строительной работы;
  - определять вариант её исполнения;
  - не смешивать технологически разные варианты;
  - не подменять решение инженера.

  Пример:

  Кабельная канализация на эстакаде ДВ-4

  family:
    cable-duct

  variant:
    overpass
*/

const BUILDMIND_WORK_TAXONOMY_VERSION =
  'work-taxonomy-demo-v1';


const BUILDMIND_WORK_FAMILIES = [
  {
    id:
      'cable-duct',

    name:
      'Кабельная канализация',

    requiredRoots: [
      'кабельн',
      'канализац'
    ],

    variants: [

      /*
        ================================
        ПОДЗЕМНОЕ ИСПОЛНЕНИЕ
        ================================
      */

      {
        id:
          'underground',

        name:
          'Подземное исполнение',

        markers: [
          {
            root:
              'подземн',

            score:
              96
          },
          {
            root:
              'транш',

            score:
              90
          },
          {
            root:
              'грунт',

            score:
              82
          }
        ]
      },


      /*
        ================================
        НАДЗЕМНОЕ ИСПОЛНЕНИЕ
        ================================
      */

      {
        id:
          'above-ground',

        name:
          'Надземное исполнение',

        markers: [
          {
            root:
              'надземн',

            score:
              96
          },
          {
            phrase:
              'по опорам',

            score:
              82
          },
          {
            phrase:
              'по поверхности',

            score:
              78
          }
        ]
      },


      /*
        ================================
        ЭСТАКАДНОЕ ИСПОЛНЕНИЕ
        ================================
      */

      {
        id:
          'overpass',

        name:
          'Эстакадное исполнение',

        markers: [
          {
            root:
              'эстакад',

            score:
              98
          }
        ]
      },


      /*
        ================================
        МОСТОВОЕ ИСПОЛНЕНИЕ
        ================================
      */

      {
        id:
          'bridge',

        name:
          'Мостовое исполнение',

        markers: [
          {
            root:
              'мост',

            score:
              98
          },
          {
            root:
              'пролетн',

            score:
              90
          }
        ]
      }
    ]
  }
];


/*
  ==================================================
  НОРМАЛИЗАЦИЯ
  ==================================================
*/

function normalizeWorkTaxonomyText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[.,;:]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function tokenizeWorkTaxonomyText(
  value
) {
  const normalized =
    normalizeWorkTaxonomyText(
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
      'через'
    ]);

  return normalized
    .split(' ')
    .filter(
      function (word) {
        return (
          word.length >= 2 &&
          !stopWords.has(word)
        );
      }
    );
}


function getWorkTaxonomyRoot(
  word
) {
  const normalized =
    normalizeWorkTaxonomyText(
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


function getWorkTaxonomyRoots(
  value
) {
  return tokenizeWorkTaxonomyText(
    value
  ).map(
    getWorkTaxonomyRoot
  );
}


function workTaxonomyRootMatches(
  firstRoot,
  secondRoot
) {
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


function containsWorkTaxonomyRoot(
  roots,
  expectedRoot
) {
  return roots.some(
    function (root) {
      return workTaxonomyRootMatches(
        root,
        expectedRoot
      );
    }
  );
}


/*
  ==================================================
  УРОВЕНЬ УВЕРЕННОСТИ
  ==================================================
*/

function getWorkTaxonomyConfidence(
  score
) {
  if (score >= 90) {
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

  if (score >= 50) {
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
  ПОИСК СЕМЕЙСТВА
  ==================================================
*/

function scoreWorkTaxonomyFamily(
  family,
  roots
) {
  const matchedRoots =
    family.requiredRoots.filter(
      function (
        requiredRoot
      ) {
        return (
          containsWorkTaxonomyRoot(
            roots,
            requiredRoot
          )
        );
      }
    );

  if (
    matchedRoots.length !==
    family.requiredRoots.length
  ) {
    return {
      score: 0,
      matchedRoots
    };
  }

  return {
    score: 96,
    matchedRoots
  };
}


/*
  ==================================================
  ПОИСК ВАРИАНТА ИСПОЛНЕНИЯ
  ==================================================
*/

function scoreWorkTaxonomyVariant(
  variant,
  normalizedText,
  roots
) {
  let bestScore = 0;

  const reasons = [];

  variant.markers.forEach(
    function (marker) {
      let matched = false;

      if (marker.phrase) {
        matched =
          normalizedText.includes(
            normalizeWorkTaxonomyText(
              marker.phrase
            )
          );
      }

      if (
        !matched &&
        marker.root
      ) {
        matched =
          containsWorkTaxonomyRoot(
            roots,
            marker.root
          );
      }

      if (matched) {
        bestScore =
          Math.max(
            bestScore,
            marker.score
          );

        reasons.push(
          marker.phrase ||
          marker.root
        );
      }
    }
  );

  return {
    score:
      bestScore,

    reasons
  };
}


/*
  ==================================================
  ГЛАВНАЯ КЛАССИФИКАЦИЯ
  ==================================================
*/

function classifyBuildMindWorkTaxonomy(
  workName
) {
  const normalizedText =
    normalizeWorkTaxonomyText(
      workName
    );

  const roots =
    getWorkTaxonomyRoots(
      workName
    );

  if (!normalizedText) {
    return {
      success: false,

      errorCode:
        'WORK_NAME_REQUIRED',

      errorMessage:
        'Название работы не указано.'
    };
  }


  /*
    Сначала определяем семейство.
  */

  const familyCandidates =
    BUILDMIND_WORK_FAMILIES
      .map(
        function (family) {
          const result =
            scoreWorkTaxonomyFamily(
              family,
              roots
            );

          return {
            family,

            score:
              result.score,

            matchedRoots:
              result.matchedRoots
          };
        }
      )
      .sort(
        function (
          first,
          second
        ) {
          return (
            second.score -
            first.score
          );
        }
      );


  const bestFamilyCandidate =
    familyCandidates[0];


  if (
    !bestFamilyCandidate ||
    bestFamilyCandidate.score < 50
  ) {
    return {
      success: false,

      errorCode:
        'WORK_FAMILY_NOT_FOUND',

      errorMessage:
        'Семейство работы пока не определено.',

      requestedWork:
        workName,

      requiresEngineerConfirmation:
        true
    };
  }


  const family =
    bestFamilyCandidate.family;


  /*
    Затем определяем вариант
    внутри найденного семейства.
  */

  const variantCandidates =
    family.variants
      .map(
        function (variant) {
          const result =
            scoreWorkTaxonomyVariant(
              variant,
              normalizedText,
              roots
            );

          return {
            variant,

            score:
              result.score,

            reasons:
              result.reasons
          };
        }
      )
      .sort(
        function (
          first,
          second
        ) {
          return (
            second.score -
            first.score
          );
        }
      );


  const bestVariantCandidate =
    variantCandidates[0];

  const secondVariantCandidate =
    variantCandidates[1];


  const bestVariantScore =
    bestVariantCandidate
      ? bestVariantCandidate.score
      : 0;


  const secondVariantScore =
    secondVariantCandidate
      ? secondVariantCandidate.score
      : 0;


  /*
    Если название одновременно
    похоже на два разных варианта,
    BuildMind не выбирает сам.
  */

  const variantIsAmbiguous =
    (
      bestVariantScore > 0 &&
      secondVariantScore > 0 &&
      bestVariantScore -
        secondVariantScore < 15
    );


  let variant = null;

  let variantConfidence =
    getWorkTaxonomyConfidence(
      0
    );

  let decisionStatus =
    'family-detected-variant-required';


  const reasons = [
    'Определено семейство работы по ключевым основам: ' +
    bestFamilyCandidate
      .matchedRoots
      .join(', ') +
    '.'
  ];


  if (
    bestVariantScore >= 50 &&
    !variantIsAmbiguous
  ) {
    variant = {
      id:
        bestVariantCandidate
          .variant.id,

      name:
        bestVariantCandidate
          .variant.name
    };


    variantConfidence =
      getWorkTaxonomyConfidence(
        bestVariantScore
      );


    decisionStatus =
      'family-and-variant-detected';


    reasons.push(
      'Вариант исполнения определён по признакам: ' +
      bestVariantCandidate
        .reasons
        .join(', ') +
      '.'
    );
  }

  else if (
    variantIsAmbiguous
  ) {
    decisionStatus =
      'variant-ambiguous';

    reasons.push(
      'Обнаружены признаки нескольких вариантов исполнения. ' +
      'Требуется инженерное уточнение.'
    );
  }

  else {
    reasons.push(
      'Вариант исполнения по названию работы не определён.'
    );
  }


  return {
    success: true,

    version:
      BUILDMIND_WORK_TAXONOMY_VERSION,

    requestedWork:
      workName,

    family: {
      id:
        family.id,

      name:
        family.name
    },

    familyConfidence:
      getWorkTaxonomyConfidence(
        bestFamilyCandidate.score
      ),

    variant,

    variantConfidence,

    alternatives:
      variantCandidates
        .filter(
          function (item) {
            return (
              item.score > 0
            );
          }
        )
        .slice(0, 3)
        .map(
          function (item) {
            return {
              variantId:
                item.variant.id,

              name:
                item.variant.name,

              score:
                item.score
            };
          }
        ),

    reasons,

    /*
      Даже высокая уверенность
      пока требует подтверждения человека.
    */

    requiresEngineerConfirmation:
      true,

    decisionStatus,

    disclaimer:
      'Классификация сформирована автоматически. ' +
      'Рекомендуется проверить семейство и вариант исполнения ' +
      'по проектной документации и подтвердить результат ' +
      'ответственным специалистом.'
  };
}


/*
  ==================================================
  СВОДКА
  ==================================================
*/

function getBuildMindWorkTaxonomySummary() {
  return {
    version:
      BUILDMIND_WORK_TAXONOMY_VERSION,

    familiesCount:
      BUILDMIND_WORK_FAMILIES.length,

    variantsCount:
      BUILDMIND_WORK_FAMILIES
        .reduce(
          function (
            total,
            family
          ) {
            return (
              total +
              family.variants.length
            );
          },
          0
        )
  };
}


/*
  ==================================================
  PUBLIC API
  ==================================================
*/

window.BuildMindWorkTaxonomy = {
  version:
    BUILDMIND_WORK_TAXONOMY_VERSION,

  families:
    BUILDMIND_WORK_FAMILIES,

  normalizeText:
    normalizeWorkTaxonomyText,

  classify:
    classifyBuildMindWorkTaxonomy,

  getSummary:
    getBuildMindWorkTaxonomySummary
};


console.info(
  'BuildMind Work Taxonomy загружена:',
  getBuildMindWorkTaxonomySummary()
);
