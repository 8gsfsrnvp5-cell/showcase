'use strict';

/*
  ==================================================
  BUILDMIND WORK MATCHER — DEMO V1
  ==================================================

  Назначение:
  - сопоставлять реальные названия работ из ГПР
    с типовыми работами Road Knowledge Base;
  - выдавать уровень уверенности;
  - не подменять инженерное решение.

  Все результаты требуют проверки
  ответственным специалистом.
*/

const BUILDMIND_WORK_MATCHER_VERSION =
  'work-matcher-demo-v1';


function normalizeWorkMatcherText(
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


function tokenizeWorkMatcherText(
  value
) {
  const normalized =
    normalizeWorkMatcherText(
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
      'к'
    ]);

  return normalized
    .split(' ')
    .filter(function (word) {
      return (
        word.length >= 2 &&
        !stopWords.has(word)
      );
    });
}


function getWorkMatcherRoot(
  word
) {
  const normalized =
    normalizeWorkMatcherText(
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
    endings.find(function (
      item
    ) {
      return (
        normalized.endsWith(
          item
        ) &&
        normalized.length -
          item.length >=
          4
      );
    });

  if (!ending) {
    return normalized;
  }

  return normalized.slice(
    0,
    -ending.length
  );
}


function getWorkMatcherRoots(
  value
) {
  return tokenizeWorkMatcherText(
    value
  ).map(
    getWorkMatcherRoot
  );
}


/*
  Фраза типового названия внутри названия работы: короткие сокращения
  (ВРУ, ГКЛ, МАФ) — только целым словом, остальные — с начала слова,
  чтобы «вру» не находилось во «вручную».
*/
function findWorkMatcherPhrase(
  text,
  phrase
) {
  if (!phrase) {
    return -1;
  }

  let from = 0;

  while (from <= text.length) {
    const index =
      text.indexOf(
        phrase,
        from
      );

    if (index < 0) {
      return -1;
    }

    const end =
      index + phrase.length;

    const startsWord =
      index === 0 ||
      text[index - 1] === ' ';

    const endsWord =
      end === text.length ||
      text[end] === ' ';

    if (
      startsWord &&
      (
        phrase.length > 4 ||
        endsWord
      )
    ) {
      return index;
    }

    from = index + 1;
  }

  return -1;
}

const WORK_MATCHER_KIND_RANK = {
  exact: 0,
  contains: 1,
  contained: 2,
  roots: 3,
  partial: 4,
  none: 5
};

/*
  Общие слова в начале типового названия («устройство», «монтаж»…)
  почти ничего не говорят о виде работ — конкретность фразы
  считаем без них.
*/
const WORK_MATCHER_GENERIC_WORDS = [
  'устройство',
  'монтаж',
  'установка',
  'прокладка',
  'укладка',
  'выполнение',
  'производство'
];

function getWorkMatcherInformativeLength(
  normalizedPhrase
) {
  const words =
    normalizedPhrase.split(' ');

  while (
    words.length > 1 &&
    WORK_MATCHER_GENERIC_WORDS.includes(
      words[0]
    )
  ) {
    words.shift();
  }

  return words.join(' ').length;
}

/*
  При равном балле: сначала более точный вид совпадения,
  затем более конкретная фраза (длиннее без общих слов),
  затем фраза ближе к началу названия работы.
*/
function compareWorkMatcherEvidence(
  first,
  second
) {
  return (
    (
      WORK_MATCHER_KIND_RANK[first.kind] -
      WORK_MATCHER_KIND_RANK[second.kind]
    ) ||
    (
      second.length -
      first.length
    ) ||
    (
      first.position -
      second.position
    )
  );
}


function calculateWorkMatcherScore(
  query,
  workItem
) {
  const normalizedQuery =
    normalizeWorkMatcherText(
      query
    );

  if (
    !normalizedQuery ||
    !workItem
  ) {
    return {
      score: 0,
      reasons: []
    };
  }

  const searchableValues = [
    workItem.name,
    ...(workItem.aliases || [])
  ];

  let bestScore = 0;
  let bestReasons = [];

  let best = {
    kind: 'none',
    position: Infinity,
    length: 0
  };

  searchableValues.forEach(
    function (candidateValue) {
      const normalizedCandidate =
        normalizeWorkMatcherText(
          candidateValue
        );

      if (!normalizedCandidate) {
        return;
      }

      let score = 0;
      const reasons = [];

      let kind =
        'partial';

      let position =
        Infinity;

      /*
        1. Полное совпадение
      */

      if (
        normalizedQuery ===
        normalizedCandidate
      ) {
        score = 100;

        kind =
          'exact';

        position = 0;

        reasons.push(
          'Точное совпадение с типовым названием или псевдонимом.'
        );
      }

      /*
        2. Типовой alias полностью входит
           в реальное название работы.

        Например:

        "подземная кабельная канализация"

        входит в:

        "прокладка подземной кабельной канализации"
      */

      else if (
        findWorkMatcherPhrase(
          normalizedQuery,
          normalizedCandidate
        ) >= 0
      ) {
        score = 92;

        kind =
          'contains';

        position =
          findWorkMatcherPhrase(
            normalizedQuery,
            normalizedCandidate
          );

        reasons.push(
          'Типовое название или псевдоним полностью входит в название работы.'
        );
      }

      /*
        3. Реальное название входит
           в типовое название.
      */

      else if (
        findWorkMatcherPhrase(
          normalizedCandidate,
          normalizedQuery
        ) >= 0
      ) {
        score = 88;

        kind =
          'contained';

        position = 0;

        reasons.push(
          'Название работы входит в типовое название или псевдоним.'
        );
      }

      /*
        4. Если прямого совпадения нет,
           считаем совпадение по основам слов.
      */

           else {
        const queryRoots =
          getWorkMatcherRoots(
            normalizedQuery
          );

        const candidateRoots =
          getWorkMatcherRoots(
            normalizedCandidate
          );

        function rootsMatch(
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

        /*
          Считаем, сколько основ
          типового названия присутствуют
          в реальном названии работы.

          Это позволяет понимать склонения:

          подземная → подземной
          кабельная → кабельной
          канализация → канализации
        */

        const matchedCandidateRoots =
          candidateRoots.filter(
            function (
              candidateRoot
            ) {
              return queryRoots.some(
                function (
                  queryRoot
                ) {
                  return rootsMatch(
                    queryRoot,
                    candidateRoot
                  );
                }
              );
            }
          );

        const uniqueMatchedRoots =
          Array.from(
            new Set(
              matchedCandidateRoots
            )
          );

        const candidateCoverage =
          uniqueMatchedRoots.length /
          Math.max(
            1,
            candidateRoots.length
          );

        const queryCoverage =
          uniqueMatchedRoots.length /
          Math.max(
            1,
            queryRoots.length
          );

        /*
          Если ВСЕ ключевые основы
          типового названия найдены
          внутри более длинного названия,
          считаем совпадение сильным.

          Например:

          "подземная кабельная канализация"

          ↕ соответствует

          "прокладка подземной
           кабельной канализации"
        */

        if (
          candidateRoots.length >= 2 &&
          candidateCoverage === 1
        ) {
          score = 92;

          kind =
            'roots';

          reasons.push(
            'Все ключевые основы типового названия найдены в названии работы с учётом словоформ.'
          );
        }

        /*
          Частичное совпадение.

          Здесь специально оставляем
          более низкий балл, чтобы
          разные технологии не путались.
        */

        else {
          score =
            Math.round(
              (
                candidateCoverage *
                  0.6 +
                queryCoverage *
                  0.4
              ) *
              60
            );

          if (
            uniqueMatchedRoots.length >
            0
          ) {
            reasons.push(
              `Совпали ключевые основы: ` +
              uniqueMatchedRoots.join(
                ', '
              ) +
              '.'
            );
          }
        }
      }

      const evidence = {
        kind,
        position,
        length:
          getWorkMatcherInformativeLength(
            normalizedCandidate
          )
      };

      if (
        score > bestScore ||
        (
          score > 0 &&
          score === bestScore &&
          compareWorkMatcherEvidence(
            evidence,
            best
          ) < 0
        )
      ) {
        bestScore = score;
        bestReasons = reasons;
        best = evidence;
      }
    }
  );

  return {
    score:
      Math.min(
        Math.round(
          bestScore
        ),
        100
      ),

    reasons:
      bestReasons,

    evidence:
      best
  };
}

function getWorkMatcherConfidence(
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

  if (score >= 60) {
    return {
      level:
        'medium',

      label:
        'Средняя'
    };
  }

  if (score >= 40) {
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


function findBuildMindWorkMatch(
  workName,
  options
) {
  const knowledge =
    window.BuildMindRoadKnowledge;

  if (
    !knowledge ||
    !Array.isArray(
      knowledge.works
    )
  ) {
    return {
      success: false,

      errorCode:
        'KNOWLEDGE_BASE_NOT_FOUND',

      errorMessage:
        'Road Knowledge Base не найдена.'
    };
  }

  const normalizedWorkName =
    normalizeWorkMatcherText(
      workName
    );

  if (!normalizedWorkName) {
    return {
      success: false,

      errorCode:
        'WORK_NAME_REQUIRED',

      errorMessage:
        'Название работы не указано.'
    };
  }

  const taxonomyResult =
    (
      window.BuildMindWorkTaxonomy &&
      typeof window.BuildMindWorkTaxonomy
        .classify === 'function'
    )
      ? window.BuildMindWorkTaxonomy
          .classify(
            workName
          )
      : null;
  
  const candidates =
    (
      options &&
      Array.isArray(
        options.works
      )
        ? options.works
        : knowledge.works
    )
      .map(
        function (workItem) {
          const result =
            calculateWorkMatcherScore(
              workName,
              workItem
            );

          return {
            workItem,
            score:
              result.score,
            reasons:
              result.reasons,

            evidence:
              result.evidence
          };
        }
      )
      .sort(
        function (
          first,
          second
        ) {
          return (
            (
              second.score -
              first.score
            ) ||
            compareWorkMatcherEvidence(
              first.evidence,
              second.evidence
            )
          );
        }
      );

  const bestCandidate =
    candidates[0];

  const confidence =
    getWorkMatcherConfidence(
      bestCandidate
        ? bestCandidate.score
        : 0
    );

  if (
    !bestCandidate ||
    bestCandidate.score < 40
  ) {
    return {
      success: false,

      errorCode:
        'WORK_MATCH_NOT_CONFIDENT',

      errorMessage:
        'Надёжное соответствие работы не найдено.',

      requestedWork:
        workName,
      
            workFamily:
        (
          taxonomyResult &&
          taxonomyResult.success
        )
          ? taxonomyResult.family
          : null,

      variant:
        (
          taxonomyResult &&
          taxonomyResult.success
        )
          ? taxonomyResult.variant
          : null,

      taxonomy:
        taxonomyResult,

      confidence,

      alternatives:
        candidates
          .slice(0, 3)
          .map(
            function (item) {
              return {
                workId:
                  item.workItem.id,

                name:
                  item.workItem.name,

                score:
                  item.score
              };
            }
          ),

      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_MATCHER_VERSION,

    requestedWork:
      workName,

        workFamily:
      (
        taxonomyResult &&
        taxonomyResult.success
      )
        ? taxonomyResult.family
        : null,

    variant:
      (
        taxonomyResult &&
        taxonomyResult.success
      )
        ? taxonomyResult.variant
        : null,

    taxonomy:
      taxonomyResult,

    matchedWork: {
      id:
        bestCandidate
          .workItem.id,

      name:
        bestCandidate
          .workItem.name,

      categoryId:
        bestCandidate
          .workItem.categoryId,

      categoryName:
        bestCandidate
          .workItem.categoryName
    },

    score:
      bestCandidate.score,

    confidence,

    reasons:
      bestCandidate.reasons,

    alternatives:
      candidates
        .slice(1, 4)
        .map(
          function (item) {
            return {
              workId:
                item.workItem.id,

              name:
                item.workItem.name,

              score:
                item.score
            };
          }
        ),

    requiresEngineerConfirmation:
      confidence.level !==
      'high',

    decisionStatus:
      confidence.level ===
      'high'
        ? 'auto-match-reviewable'
        : 'requires-review',

    disclaimer:
      'Соответствие определено автоматически. ' +
      'Рекомендуется проверить тип работы ' +
      'и подтвердить результат ответственным специалистом.'
  };
}


function getWorkMatcherSummary() {
  const knowledge =
    window.BuildMindRoadKnowledge;

  return {
    version:
      BUILDMIND_WORK_MATCHER_VERSION,

    knowledgeWorksCount:
      knowledge &&
      Array.isArray(
        knowledge.works
      )
        ? knowledge.works.length
        : 0
  };
}


window.BuildMindWorkMatcher = {
  version:
    BUILDMIND_WORK_MATCHER_VERSION,

  normalizeText:
    normalizeWorkMatcherText,

  calculateScore:
    calculateWorkMatcherScore,

  find:
    findBuildMindWorkMatch,

  getSummary:
    getWorkMatcherSummary
};


console.info(
  'BuildMind Work Matcher загружен:',
  getWorkMatcherSummary()
);
