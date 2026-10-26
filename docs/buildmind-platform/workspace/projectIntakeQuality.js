'use strict';

/* ==================================================
   BUILDMIND PROJECT INTAKE QUALITY — V1.11
   ================================================== */

const BUILDMIND_PROJECT_INTAKE_QUALITY_VERSION =
  'project-intake-quality-v1.11';

const PROJECT_INTAKE_QUALITY_LARGE_PDF_MIN_PAGES =
  10;

const PROJECT_INTAKE_QUALITY_MIN_READ_PAGES =
  5;

const PROJECT_INTAKE_QUALITY_KIND_RULES = [
  {
    kind: 'commercial-proposal',

    strong: [
      /коммерческ[а-яё]*\s+предложени[а-яё]*/,
      /технико-коммерческ[а-яё]*\s+предложени[а-яё]*/,
      /ценов[а-яё]*\s+предложени[а-яё]*/,
      /(^|[^а-яa-z0-9])ткп([^а-яa-z0-9]|$)/,
      /(^|[^а-яa-z0-9])кп([^а-яa-z0-9]|$)/
    ],

    weak: [
      /стоимост[а-яё]*\s+предложени[а-яё]*/,
      /коммерческ[а-яё]*\s+част[а-яё]*/
    ]
  },

  {
    kind: 'agreement',

    strong: [
      /договор[а-яё]*(?:\s+подряд[а-яё]*)?\s*№/,
      /дополнительн[а-яё]*\s+соглашени[а-яё]*/,
      /доп\.?\s*соглашени[а-яё]*/,
      /(^|[^а-яa-z0-9])дс\s*№?/,
      /приложени[а-яё]*\s+к\s+договор[а-яё]*/,
      /договорн[а-яё]*\s+ведомост[а-яё]*/
    ],

    weak: [
      /стоимост[а-яё]*\s+договор[а-яё]*/,
      /предмет\s+договор[а-яё]*/
    ]
  },

  {
    kind: 'estimate',

    strong: [
      /локальн[а-яё]*\s+смет[а-яё]*/,
      /сметн[а-яё]*\s+документац[а-яё]*/,
      /сметн[а-яё]*\s+расч[её]т[а-яё]*/,
      /(^|[^а-яa-z0-9])смета([^а-яa-z0-9]|$)/
    ],

    weak: [
      /сметн[а-яё]*\s+стоимост[а-яё]*/,
      /шифр\s+расценк[а-яё]*/
    ]
  },

  {
    kind: 'schedule',

    strong: [
      /график\s+производств[а-яё]*\s+работ[а-яё]*/,
      /календарн[а-яё]*\s+график[а-яё]*/,
      /календарн[а-яё]*\s+план[а-яё]*/,
      /(^|[^а-яa-z0-9])гпр([^а-яa-z0-9]|$)/
    ],

    weak: [
      /начал[а-яё]*\s+работ[а-яё]*/,
      /окончани[а-яё]*\s+работ[а-яё]*/,
      /продолжительност[а-яё]*/,
      /срок[а-яё]*\s+выполнени[а-яё]*/
    ]
  },

  {
    kind: 'work-volume',

    strong: [
      /ведомост[а-яё]*\s+объем[а-яё]*\s+работ[а-яё]*/,
      /ведомост[а-яё]*\s+объ[её]м[а-яё]*\s+работ[а-яё]*/,
      /(^|[^а-яa-z0-9])вор([^а-яa-z0-9]|$)/
    ],

    weak: [
      /объем[а-яё]*\s+работ[а-яё]*/,
      /объ[её]м[а-яё]*\s+работ[а-яё]*/,
      /вид[а-яё]*\s+работ[а-яё]*/
    ]
  },

  {
    kind: 'specification',

    strong: [
      /спецификац[а-яё]*\s+материал[а-яё]*/,
      /спецификац[а-яё]*\s+оборудован[а-яё]*/,
      /(^|[^а-яa-z0-9])спецификац[а-яё]*/
    ],

    weak: [
      /наименовани[а-яё]*\s+и\s+техническ[а-яё]*\s+характеристик[а-яё]*/
    ]
  },

  {
    kind: 'project-documentation',

    strong: [
      /рабоч[а-яё]*\s+документац[а-яё]*/,
      /проектн[а-яё]*\s+документац[а-яё]*/,
      /пояснительн[а-яё]*\s+записк[а-яё]*/,
      /рабоч[а-яё]*\s+проект[а-яё]*/
    ],

    weak: [
      /общие\s+указани[а-яё]*/,
      /общие\s+данные/
    ]
  }
];

const PROJECT_INTAKE_QUALITY_APPROVAL_TYPE_LABELS = {
  approval:
    'Согласование',

  permit:
    'Разрешение / допуск',

  'technical-conditions':
    'Технические условия',

  supervision:
    'Технический надзор / представитель',

  notification:
    'Уведомление внешней стороны'
};

const PROJECT_INTAKE_QUALITY_APPROVAL_INTENT_LABELS = {
  prerequisite:
    'До начала / выполнения работ',

  action:
    'Требуется действие',

  conditional:
    'Условное согласование',

  'contractual-requirement':
    'Требование документа — выполнение не подтверждено',

  completed:
    'В документе указано как выполненное'
};

const PROJECT_INTAKE_QUALITY_APPROVAL_PRIORITY_LABELS = {
  high:
    'Высокий приоритет',

  medium:
    'Средний приоритет',

  low:
    'Низкий приоритет'
};

function normalizeProjectIntakeQualityText(
  value
) {
  return String(
    value || ''
  )
    .toLowerCase()
    .replace(
      /ё/g,
      'е'
    )
    .replace(
      /[–—]/g,
      '-'
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function countProjectIntakeQualityMatches(
  patterns,
  text
) {
  return patterns.reduce(
    function (
      score,
      pattern
    ) {
      return (
        score +
        (
          pattern.test(
            text
          )
            ? 1
            : 0
        )
      );
    },
    0
  );
}

function isProjectIntakeQualityScheduleReferenceOnly(
  fileText,
  bodyText
) {
  const fileSource =
    normalizeProjectIntakeQualityText(
      fileText
    );
  const bodySource =
    normalizeProjectIntakeQualityText(
      bodyText
    );

  const fileIsSchedule =
    /график\s+производств[а-яё]*\s+работ[а-яё]*|календарн[а-яё]*\s+(?:график|план)[а-яё]*|(^|[^а-яa-z0-9])гпр([^а-яa-z0-9]|$)/
      .test(fileSource);

  const hasScheduleName =
    /график\s+производств[а-яё]*\s+работ[а-яё]*|календарн[а-яё]*\s+(?:график|план)[а-яё]*|(^|[^а-яa-z0-9])гпр([^а-яa-z0-9]|$)/
      .test(bodySource);

  const hasScheduleStructure =
    /наименовани[а-яё]*\s+работ[а-яё]*/
      .test(bodySource) &&
    /(?:начало|дата\s+начала)/
      .test(bodySource) &&
    /(?:окончание|дата\s+окончания)/
      .test(bodySource);

  const clauseMatches =
    bodySource.match(
      /(^|\s)\d{1,2}\.\d{1,2}\.?\s/g
    ) || [];

  const hasContractLanguage =
    (
      /договор|заказчик|подрядчик|сторон[а-яё]*/
        .test(bodySource) &&
      /обязан[а-яё]*|обязу[а-яё]*|должен|представить|предоставить|разработать|согласовать|утвердить|согласно|в\s+соответствии\s+с/
        .test(bodySource)
    ) ||
    clauseMatches.length >= 3;

  return (
    hasScheduleName &&
    hasContractLanguage &&
    !hasScheduleStructure &&
    !fileIsSchedule
  );
}

function classifyProjectIntakeQualitySignals(
  fileName,
  text
) {
  const fileText =
    normalizeProjectIntakeQualityText(
      fileName
    );

  const bodyText =
    normalizeProjectIntakeQualityText(
      text
    );

  const leadText =
    bodyText.slice(
      0,
      2000
    );

  const scheduleReferenceOnly =
    isProjectIntakeQualityScheduleReferenceOnly(
      fileText,
      bodyText
    );

  const results =
    PROJECT_INTAKE_QUALITY_KIND_RULES
      .map(
        function (
          rule
        ) {
          const strongFile =
            countProjectIntakeQualityMatches(
              rule.strong,
              fileText
            );

          const weakFile =
            countProjectIntakeQualityMatches(
              rule.weak,
              fileText
            );

          const strongBody =
            countProjectIntakeQualityMatches(
              rule.strong,
              bodyText
            );

          const weakBody =
            countProjectIntakeQualityMatches(
              rule.weak,
              bodyText
            );

          const strongLead =
            countProjectIntakeQualityMatches(
              rule.strong,
              leadText
            );

          const weakLead =
            countProjectIntakeQualityMatches(
              rule.weak,
              leadText
            );

          const fileScore =
            strongFile * 12 +
            weakFile * 5;

          const textScore =
            strongBody * 6 +
            weakBody * 2;

          const leadScore =
            strongLead * 14 +
            weakLead * 4;

          const suppressSchedule =
            rule.kind === 'schedule' &&
            scheduleReferenceOnly &&
            strongFile === 0;

          const adjustedTextScore =
            suppressSchedule
              ? 0
              : textScore;

          const adjustedLeadScore =
            suppressSchedule
              ? 0
              : leadScore;

          return {
            kind:
              rule.kind,

            fileScore,

            textScore:
              adjustedTextScore,

            leadScore:
              adjustedLeadScore,

            score:
              fileScore +
              adjustedTextScore +
              adjustedLeadScore,

            strongFileSignal:
              strongFile > 0,

            strongLeadSignal:
              strongLead > 0 &&
              !suppressSchedule
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

  const best =
    results[0];

  const second =
    results[1];

  if (
    !best ||
    best.score === 0
  ) {
    return null;
  }

  const clearLead =
    !second ||
    best.score >=
      second.score + 5;

  const confidence =
    best.strongFileSignal ||
    best.strongLeadSignal ||
    (
      best.score >= 12 &&
      clearLead
    )
      ? 'high'
      : 'medium';

  const sources = [];

  if (
    best.fileScore > 0
  ) {
    sources.push(
      'название файла'
    );
  }

  if (
    best.textScore > 0
  ) {
    sources.push(
      'содержимое / структура'
    );
  }

  if (
    best.leadScore > 0
  ) {
    sources.push(
      'титульная / начальная часть'
    );
  }

  return {
    kind:
      best.kind,

    confidence,

    score:
      best.score,

    fileScore:
      best.fileScore,

    textScore:
      best.textScore,

    leadScore:
      best.leadScore,

    strongFileSignal:
      best.strongFileSignal,

    source:
      sources.join(
        ' + '
      ) ||
      'Смысловые признаки документа'
  };
}

function getProjectIntakeQualityTableStructure(
  analysis
) {
  const sheets =
    Array.isArray(
      analysis?.sheets
    )
      ? analysis.sheets
      : [];

  const ids =
    sheets
      .map(
        function (
          sheet
        ) {
          return (
            sheet
              ?.tableClassification
              ?.id ||
            ''
          );
        }
      )
      .filter(
        Boolean
      );

  if (
    ids.includes(
      'schedule-table'
    )
  ) {
    return {
      kind:
        'schedule',

      confidence:
        'high',

      source:
        'Структура таблицы'
    };
  }

  if (
    ids.includes(
      'work-volume'
    )
  ) {
    return {
      kind:
        'work-volume',

      confidence:
        'high',

      source:
        'Структура таблицы'
    };
  }

  if (
    ids.includes(
      'material-table'
    )
  ) {
    return {
      kind:
        'specification',

      confidence:
        'medium',

      source:
        'Структура таблицы'
    };
  }

  if (
    ids.includes(
      'mixed-work-material-price-table'
    )
  ) {
    return {
      kind:
        'commercial-proposal',

      confidence:
        'medium',

      source:
        'Таблица работ / материалов со стоимостью'
    };
  }

  return null;
}

function classifyProjectIntakeQualityTable(
  documentItem,
  analysis
) {
  const sheets =
    Array.isArray(
      analysis?.sheets
    )
      ? analysis.sheets
      : [];

  const sheetSignals =
    sheets
      .map(
        function (
          sheet
        ) {
          const classification =
            sheet
              ?.tableClassification;

          const evidence =
            Array.isArray(
              classification
                ?.evidence
            )
              ? classification
                  .evidence
                  .join(' ')
              : '';

          return [
            sheet
              ?.sheetName ||
              '',

            classification
              ?.label ||
              '',

            evidence
          ].join(
            ' '
          );
        }
      )
      .join(
        ' '
      );

  const semantic =
    classifyProjectIntakeQualitySignals(
      documentItem
        ?.file
        ?.name ||
        '',

      sheetSignals
    );

  const structure =
    getProjectIntakeQualityTableStructure(
      analysis
    );

  if (
    semantic
      ?.strongFileSignal
  ) {
    return {
      kind:
        semantic.kind,

      confidence:
        'high',

      source:
        structure &&
        structure.kind !==
          semantic.kind
          ? 'Явное назначение в названии файла; структура таблицы используется как дополнительный сигнал'
          : structure
            ? 'Название файла + структура таблицы'
            : 'Название файла',

      structureConflict:
        Boolean(
          structure &&
          structure.kind !==
            semantic.kind
        )
    };
  }

  if (
    semantic &&
    structure?.kind ===
      'commercial-proposal' &&
    [
      'estimate',
      'commercial-proposal'
    ].includes(
      semantic.kind
    )
  ) {
    return {
      kind:
        semantic.kind,

      confidence:
        semantic.confidence ===
          'high'
          ? 'high'
          : 'medium',

      source:
        'Смысловые признаки + таблица работ / материалов со стоимостью'
    };
  }

  if (
    semantic &&
    structure &&
    semantic.kind ===
      structure.kind
  ) {
    return {
      kind:
        semantic.kind,

      confidence:
        semantic.confidence ===
          'high' ||
        structure.confidence ===
          'high'
          ? 'high'
          : 'medium',

      source:
        'Смысловые признаки + структура таблицы'
    };
  }

  if (
    semantic &&
    structure &&
    semantic.kind !==
      structure.kind
  ) {
    return {
      kind:
        structure.kind,

      confidence:
        'medium',

      source:
        'Смысловые признаки и структура таблицы дают разные результаты — требуется проверка',

      conflict:
        true
    };
  }

  return (
    semantic ||
    structure ||
    {
      kind:
        'other',

      confidence:
        'low',

      source:
        'Недостаточно признаков'
    }
  );
}

function isProjectIntakeQualityStampContext(
  context
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );

  const markers = [
    /(^|\s)изм\.?($|\s)/,
    /кол\.?\s*уч\.?/,
    /№\s*док/,
    /(^|\s)лист($|\s)/,
    /(^|\s)подп\.?($|\s)/,
    /(^|\s)дата($|\s)/,
    /разраб\.?/,
    /проверил/,
    /н\.?\s*контр\.?/,
    /инв\.?\s*№/
  ];

  const score =
    markers.reduce(
      function (
        sum,
        pattern
      ) {
        return (
          sum +
          (
            pattern.test(
              text
            )
              ? 1
              : 0
          )
        );
      },
      0
    );

  const hasRealAction =
    /до\s+начала|перед\s+началом|до\s+производства\s+работ|получить\s+(?:согласован|разрешен|допуск)|согласовать\s+с|необходимо\s+согласовать|следует\s+согласовать|требуется\s+согласовать|по\s+согласованию\s+с|вызвать\s+представител|уведомить/.test(
      text
    );

  return (
    score >= 3 &&
    !hasRealAction
  );
}

function getProjectIntakeQualitySentenceContext(
  text,
  matchIndex,
  matchLength
) {
  const source =
    String(text || '');

  const boundaryPattern =
    /[.!?;\n\r]/;

  let start =
    Math.max(
      0,
      Number(matchIndex) || 0
    );

  while (
    start > 0 &&
    !boundaryPattern.test(
      source[start - 1]
    )
  ) {
    start -= 1;
  }

  let end =
    Math.min(
      source.length,
      (Number(matchIndex) || 0) +
        (Number(matchLength) || 0)
    );

  while (
    end < source.length &&
    !boundaryPattern.test(
      source[end]
    )
  ) {
    end += 1;
  }

  if (
    end < source.length
  ) {
    end += 1;
  }

  const sentence =
    source
      .slice(
        start,
        end
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  if (
    sentence.length >= 20
  ) {
    return sentence;
  }

  return source
    .slice(
      Math.max(
        0,
        (Number(matchIndex) || 0) - 90
      ),
      Math.min(
        source.length,
        (Number(matchIndex) || 0) +
          (Number(matchLength) || 0) +
          120
      )
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function getProjectIntakeQualityApprovalType(
  context
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );

  if (
    /техническ[а-яё]*\s+услови[а-яё]*|(^|[^а-я])ту([^а-я]|$)/.test(
      text
    )
  ) {
    return 'technical-conditions';
  }

  if (
    /технадзор|техническ[а-яё]*\s+надзор|вызов[а-яё]*\s+представител[а-яё]*/.test(
      text
    )
  ) {
    return 'supervision';
  }

  if (
    /разрешени[а-яё]*|допуск(?:а|у|ом|е|и)?(?=[^а-яё]|$)|ордер(?:а|у|ом|е|ы|ов)?(?=[^а-яё]|$)/.test(
      text
    )
  ) {
    return 'permit';
  }

  if (
    /уведомить|уведомлени[а-яё]*/.test(
      text
    )
  ) {
    return 'notification';
  }

  return 'approval';
}

function getProjectIntakeQualityApprovalTopic(
  context,
  type
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );
  const topics = [
    {
      id: 'schedule',
      label: 'График производства работ',
      pattern:
        /гпр|график[а-яё]*\s+производств[а-яё]*\s+работ[а-яё]*|календарн[а-яё]*\s+(?:график|план)[а-яё]*/
    },
    {
      id: 'project-documentation',
      label: 'Проектная / рабочая документация',
      pattern:
        /проектн[а-яё]*\s+документац[а-яё]*|рабоч[а-яё]*\s+документац[а-яё]*|проектн[а-яё]*\s+решени[а-яё]*/
    },
    {
      id: 'scheme',
      label: 'Схема производства работ',
      pattern:
        /схем[а-яё]*\s+(?:производств[а-яё]*\s+работ[а-яё]*|организац[а-яё]*\s+движени[а-яё]*|размещени[а-яё]*|работ[а-яё]*)/
    },
    {
      id: 'materials',
      label: 'Материалы / замены материалов',
      pattern:
        /материал[а-яё]*|замен[а-яё]*\s+материал[а-яё]*/
    },
    {
      id: 'work-permit',
      label: 'Разрешение / допуск к работам',
      pattern:
        /разрешени[а-яё]*\s+на\s+(?:производств[а-яё]*\s+)?работ[а-яё]*|допуск[а-яё]*\s+к\s+работ[а-яё]*|ордер[а-яё]*\s+на\s+работ[а-яё]*/
    },
    {
      id: 'technical-conditions',
      label: 'Технические условия',
      pattern:
        /техническ[а-яё]*\s+услови[а-яё]*|(^|[^а-яa-z])ту([^а-яa-z]|$)/
    },
    {
      id: 'supervision',
      label: 'Технический надзор / представитель',
      pattern:
        /технадзор|техническ[а-яё]*\s+надзор|представител[а-яё]*/
    },
    {
      id: 'notification',
      label: 'Уведомление',
      pattern:
        /уведомить|уведомлени[а-яё]*/
    }
  ];
  const found =
    topics.find(function (topic) {
      return topic.pattern.test(text);
    });

  if (found) {
    return {
      id: found.id,
      label: found.label
    };
  }

  return {
    id:
      type || 'approval',
    label:
      PROJECT_INTAKE_QUALITY_APPROVAL_TYPE_LABELS[
        type
      ] || 'Согласование'
  };
}

function detectProjectIntakeQualityOrganization(
  context
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );

  const organizations = [
    [
      /(^|[^а-яa-z])ржд([^а-яa-z]|$)/,
      'РЖД'
    ],

    [
      /гормост/,
      'Гормост'
    ],

    [
      /гормос/,
      'Гормост / организация требует уточнения'
    ],

    [
      /моссвет/,
      'Моссвет'
    ],

    [
      /мосводоканал/,
      'Мосводоканал'
    ],

    [
      /заказчик[а-яё]*/,
      'Заказчик'
    ],

    [
      /проектн[а-яё]*\s+организац[а-яё]*|проектн[а-яё]*\s+отдел[а-яё]*|проектировщик[а-яё]*/,
      'Проектная организация'
    ],

    [
      /балансодержател[а-яё]*/,
      'Балансодержатель'
    ],

    [
      /эксплуатирующ[а-яё]*\s+организац[а-яё]*/,
      'Эксплуатирующая организация'
    ],

    [
      /владел[а-яё]*\s+сет[а-яё]*|владел[а-яё]*\s+коммуникац[а-яё]*/,
      'Владелец инженерных сетей'
    ]
  ];

  const found =
    organizations.find(
      function (
        item
      ) {
        return item[0]
          .test(
            text
          );
      }
    );

  return found
    ? found[1]
    : 'Организация требует уточнения';
}

function getProjectIntakeQualityApprovalIntent(
  context
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );

  if (
    /до\s+начала|перед\s+началом|до\s+производства\s+работ|до\s+выполнения\s+работ|до\s+начала\s+строительств|получить\s+(?:согласован|разрешен|допуск|техническ)/.test(
      text
    )
  ) {
    return {
      intent:
        'prerequisite',

      priority:
        'high',

      requiresReview:
        true
    };
  }

  if (
    /при\s+замене|в\s+случае|по\s+согласованию|при\s+согласовании/.test(
      text
    )
  ) {
    return {
      intent:
        'conditional',

      priority:
        'medium',

      requiresReview:
        true
    };
  }

  if (
    /обязан[а-яё]*|обязу[а-яё]*|должен|необходимо|требуется|следует|подлежит/.test(
      text
    ) &&
    /согласован[а-яё]*|согласовать|согласование|разрешени[а-яё]*|допуск(?:а|у|ом|е|и)?(?=[^а-яё]|$)|ордер(?:а|у|ом|е|ы|ов)?(?=[^а-яё]|$)|техническ[а-яё]*\s+услови[а-яё]*|уведомить|уведомлени[а-яё]*/.test(
      text
    )
  ) {
    return {
      intent:
        'contractual-requirement',

      priority:
        'medium',

      requiresReview:
        true
    };
  }

  if (
    /(?:согласован(?:о|а|ы)?|утвержден(?:о|а|ы)?)(?=[^а-яё]|$)(?:\s+(?:заказчик[а-яё]*|подрядчик[а-яё]*|сторон[а-яё]*|проектн[а-яё]*\s+организац[а-яё]*))?|(?:разрешени[а-яё]*|допуск(?:а|у|ом|е|и)?|ордер(?:а|у|ом|е|ы|ов)?|уведомлени[а-яё]*|техническ[а-яё]*\s+услови[а-яё]*).{0,120}(?:получен[а-яё]*|выдан[а-яё]*|направлен[а-яё]*|согласован[а-яё]*|утвержден[а-яё]*)/.test(
      text
    )
  ) {
    return {
      intent:
        'completed',

      priority:
        'low',

      requiresReview:
        true
    };
  }

  if (
    /согласовать|необходимо\s+согласован|следует\s+согласован|требуется\s+согласован|разрешени[а-яё]*|допуск(?:а|у|ом|е|и)?(?=[^а-яё]|$)|ордер(?:а|у|ом|е|ы|ов)?(?=[^а-яё]|$)|вызов[а-яё]*\s+представител[а-яё]*|уведомить/.test(
      text
    )
  ) {
    return {
      intent:
        'action',

      priority:
        'medium',

      requiresReview:
        true
    };
  }

  return {
    intent:
      'informational',

    priority:
      'low',

    requiresReview:
      false
  };
}

function isProjectIntakeQualityInternalContractApproval(
  context
) {
  const text =
    normalizeProjectIntakeQualityText(
      context
    );

  const internalContractObject =
    /услови[а-яё]*\s+(?:настоящ[а-яё]*\s+)?договор[а-яё]*|текст\s+договор[а-яё]*|редакци[а-яё]*\s+договор[а-яё]*|настоящ[а-яё]*\s+договор[а-яё]*/
      .test(text);

  const hasTechnicalObject =
    /гпр|график[а-яё]*\s+производств[а-яё]*\s+работ[а-яё]*|проектн[а-яё]*\s+документац[а-яё]*|схем[а-яё]*|материал[а-яё]*|технолог[а-яё]*|разрешени[а-яё]*|допуск[а-яё]*/
      .test(text);

  return (
    internalContractObject &&
    /сторон[а-яё]*|заказчик[а-яё]*|подрядчик[а-яё]*/
      .test(text) &&
    !hasTechnicalObject
  );
}

function getProjectIntakeQualityApprovalSignature(
  context
) {
  const stopWords =
    new Set([
      'и',
      'в',
      'во',
      'на',
      'по',
      'с',
      'со',
      'для',
      'при',
      'до',
      'от',
      'к',
      'из',
      'а',
      'или',
      'что',
      'данного',
      'данной',
      'работ',
      'работы',
      'повторно',
      'указывает',
      'указано',
      'сообщает',
      'отмечает'
    ]);

  return normalizeProjectIntakeQualityText(
    context
  )
    .replace(
      /[^а-яёa-z0-9\s]/g,
      ' '
    )
    .split(
      ' '
    )
    .filter(
      function (
        word
      ) {
        return (
          word.length >= 4 &&
          !stopWords.has(
            word
          )
        );
      }
    )
    .slice(
      0,
      14
    )
    .join(
      ' '
    );
}

function groupProjectIntakeQualityApprovals(
  candidates
) {
  const groups = [];

  (
    Array.isArray(candidates)
      ? candidates
      : []
  ).forEach(function (candidate) {
    const signature =
      getProjectIntakeQualityApprovalSignature(
        candidate.context
      );
    const topic =
      candidate.topic ||
      candidate.type ||
      'approval';
    const sourceFile =
      String(candidate.fileName || '');

    const existing =
      groups.find(function (group) {
        const sameExactMeaning =
          Boolean(signature) &&
          group.signature === signature &&
          group.type === candidate.type &&
          group.organization === candidate.organization &&
          group.intent === candidate.intent &&
          group.topic === topic;

        const sameNearbyOccurrence =
          sourceFile &&
          group.fileName === sourceFile &&
          Number.isFinite(group.matchIndex) &&
          Number.isFinite(candidate.matchIndex) &&
          group.pageNumber === candidate.pageNumber &&
          Math.abs(
            group.matchIndex -
            candidate.matchIndex
          ) <= 140;

        // Несколько формулировок одного вопроса в пределах
        // одного документа — это доказательства одной задачи,
        // а не отдельные карточки директору. Тип, организация,
        // намерение и тема должны совпасть полностью.
        const sameDocumentQuestion =
          sourceFile &&
          group.fileName === sourceFile &&
          group.type === candidate.type &&
          group.organization === candidate.organization &&
          group.intent === candidate.intent &&
          group.topic === topic;

        return (
          sameExactMeaning ||
          sameNearbyOccurrence ||
          sameDocumentQuestion
        );
      });

    if (existing) {
      if (
        !existing.pageNumbers.includes(
          candidate.pageNumber
        )
      ) {
        existing.pageNumbers.push(
          candidate.pageNumber
        );
      }

      existing.sourceFiles =
        Array.from(
          new Set([
            ...(existing.sourceFiles || []),
            sourceFile
          ].filter(Boolean))
        );

      existing.sourceEvidence =
        [
          ...(existing.sourceEvidence || []),
          {
            fileName: sourceFile,
            pageNumber:
              candidate.pageNumber || null
          }
        ];

      existing.evidenceContexts =
        Array.from(
          new Set([
            ...(existing.evidenceContexts || []),
            String(candidate.context || '')
          ].filter(Boolean))
        );

      existing.occurrenceCount += 1;
      return;
    }

    groups.push({
      ...candidate,
      signature,
      topic,
      sourceFiles:
        sourceFile ? [sourceFile] : [],
      sourceEvidence: [
        {
          fileName: sourceFile,
          pageNumber:
            candidate.pageNumber || null
        }
      ],
      evidenceContexts: [
        String(candidate.context || '')
      ].filter(Boolean),
      pageNumbers: [
        candidate.pageNumber
      ].filter(Boolean),
      occurrenceCount: 1
    });
  });

  groups.forEach(function (group) {
    group.pageNumbers.sort(function (first, second) {
      return first - second;
    });

    group.pageNumber =
      group.pageNumbers[0] || null;
  });

  return groups;
}

function extractProjectIntakeQualityApprovals(
  documentItem
) {
  const pages =
    documentItem
      ?.analysis
      ?.extractedPages;

  if (
    !documentItem
      ?.analysis
      ?.success ||
    !Array.isArray(
      pages
    )
  ) {
    return [];
  }

  const actionPattern =
    /(согласован[а-яё]*|согласовать|согласование|утвержден[а-яё]*|разрешени[а-яё]*|техническ[а-яё]*\s+услови[а-яё]*|технадзор|техническ[а-яё]*\s+надзор|допуск(?:а|у|ом|е|и)?(?=[^а-яё]|$)|ордер(?:а|у|ом|е|ы|ов)?(?=[^а-яё]|$)|вызов[а-яё]*\s+представител[а-яё]*|уведомить|уведомлени[а-яё]*)/giu;

  const candidates = [];

  pages.forEach(
    function (
      page
    ) {
      const text =
        String(
          page.text ||
          ''
        );

      actionPattern.lastIndex =
        0;

      let match =
        null;

      while (
        (
          match =
            actionPattern.exec(
              text
            )
        ) !== null &&
        candidates.length < 80
      ) {
        const start =
          Math.max(
            0,
            match.index -
              190
          );

        const end =
          Math.min(
            text.length,
            match.index +
              match[0].length +
              250
          );

        const wideContext =
          text
            .slice(
              start,
              end
            )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();

        const context =
          getProjectIntakeQualitySentenceContext(
            text,
            match.index,
            match[0].length
          );

        if (
          context.length < 20 ||
          isProjectIntakeQualityStampContext(
            wideContext
          ) ||
          isProjectIntakeQualityInternalContractApproval(
            context
          )
        ) {
          continue;
        }

        const intentResult =
          getProjectIntakeQualityApprovalIntent(
            context
          );

        if (
          !intentResult
            .requiresReview
        ) {
          continue;
        }

        const type =
          getProjectIntakeQualityApprovalType(
            context
          );

        const topic =
          getProjectIntakeQualityApprovalTopic(
            context,
            type
          );

        const organization =
          detectProjectIntakeQualityOrganization(
            context
          );

        const key =
          [
            documentItem
              ?.file
              ?.name ||
              '',

            page.pageNumber,

            type,

            intentResult.intent,

            normalizeProjectIntakeQualityText(
              context
            ).slice(
              0,
              160
            )
          ].join(
            '|'
          );

        const duplicate =
          candidates.some(
            function (
              item
            ) {
              return (
                item.key ===
                key
              );
            }
          );

        if (
          duplicate
        ) {
          continue;
        }

        candidates.push({
          key,

          type,

          typeLabel:
            PROJECT_INTAKE_QUALITY_APPROVAL_TYPE_LABELS[
              type
            ],

          topic:
            topic.id,

          topicLabel:
            topic.label,

          intent:
            intentResult.intent,

          intentLabel:
            PROJECT_INTAKE_QUALITY_APPROVAL_INTENT_LABELS[
              intentResult.intent
            ],

          priority:
            intentResult.priority,

          priorityLabel:
            PROJECT_INTAKE_QUALITY_APPROVAL_PRIORITY_LABELS[
              intentResult.priority
            ],

          organization,

          confidence:
            organization ===
              'Организация требует уточнения'
              ? 'medium'
              : 'high',

          fileName:
            documentItem
              ?.file
              ?.name ||
              '',

          pageNumber:
            page.pageNumber,

          context,

          matchIndex:
            match.index,

          matchedText:
            match[0],

          sourceType:
            'document',

          requiresEngineerConfirmation:
            true
        });
      }
    }
  );

  return (
    groupProjectIntakeQualityApprovals(
      candidates
    )
  );
}

function groupProjectIntakeQualityUncertainRows(
  rows
) {
  const byFile =
    new Map();

  (
    Array.isArray(
      rows
    )
      ? rows
      : []
  ).forEach(
    function (
      candidate
    ) {
      const fileName =
        candidate
          ?.fileName ||
        'Неизвестный файл';

      if (
        !byFile.has(
          fileName
        )
      ) {
        byFile.set(
          fileName,
          []
        );
      }

      byFile
        .get(
          fileName
        )
        .push(
          candidate
        );
    }
  );

  return Array
    .from(
      byFile.entries()
    )
    .map(
      function (
        entry
      ) {
        const fileName =
          entry[0];

        const candidates =
          entry[1];

        return {
          reviewType:
            'uncertain-rows-group',

          fileName,

          count:
            candidates.length,

          samples:
            candidates
              .map(
                function (
                  candidate
                ) {
                  return (
                    candidate
                      ?.workName ||
                    candidate
                      ?.name ||
                    ''
                  );
                }
              )
              .filter(
                Boolean
              )
              .slice(
                0,
                3
              )
        };
      }
    );
}

function evaluateProjectIntakeQualityResult(
  result
) {
  const documents =
    Array.isArray(result?.documents)
      ? result.documents
      : [];
  const approvals =
    Array.isArray(result?.approvals)
      ? result.approvals
      : [];
  const issues = [];

  documents.forEach(function (documentItem) {
    const sections =
      Array.isArray(documentItem?.sections)
        ? documentItem.sections
        : [];
    const works =
      Array.isArray(documentItem?.works)
        ? documentItem.works
        : [];
    const materials =
      Array.isArray(documentItem?.materials)
        ? documentItem.materials
        : [];
    const ocrPages =
      Array.isArray(documentItem?.ocrPages)
        ? documentItem.ocrPages
        : [];
    const extractedPagesCount =
      Math.max(
        0,
        Number(
          documentItem?.extractedPagesCount
        ) || 0
      );
    const pagesWithText =
      Math.max(
        0,
        Number(documentItem?.pagesWithText) || 0
      );
    const totalPages =
      Math.max(
        1,
        Number(documentItem?.totalPages) || 1
      );
    const readPagesCount =
      Math.max(
        ocrPages.length,
        extractedPagesCount,
        pagesWithText
      );
    const minimumReadablePages =
      Math.min(
        totalPages,
        PROJECT_INTAKE_QUALITY_MIN_READ_PAGES
      );
    const largeReadablePdf =
      totalPages >=
        PROJECT_INTAKE_QUALITY_LARGE_PDF_MIN_PAGES &&
      readPagesCount >= minimumReadablePages;
    const documentRole =
      String(documentItem?.documentRole || '');

    const expectedNoDownstream =
      [
        'agreement',
        'project-documentation',
        'other'
      ].includes(documentRole);
    const maximumReasonableSections =
      Math.max(
        6,
        Math.ceil(totalPages / 4)
      );
    const hasWorkVolume =
      sections.some(function (section) {
        return section?.kind === 'work-volume' ||
          (
            Array.isArray(
              section?.secondaryKinds
            ) &&
            section.secondaryKinds.includes(
              'work-volume'
            )
          ) ||
          (
            section?.kind ===
              'commercial-proposal' &&
            /ведомост[а-яё]*\s+(?:объем|обьем)[а-яё]*.*работ[а-яё]*/
              .test(
                normalizeProjectIntakeQualityText(
                  section?.textSample || ''
                )
              )
          );
      });
    const hasSchedule =
      sections.some(function (section) {
        return section?.kind === 'schedule';
      });
    const isSupplyOnlySchedule =
      hasSchedule &&
      works.length === 0 &&
      materials.length > 0 &&
      materials.every(function (candidate) {
        return (
          candidate?.sourceType ===
            'supply-schedule' ||
          (
            Array.isArray(
              candidate?.sourceTypes
            ) &&
            candidate.sourceTypes.includes(
              'supply-schedule'
            )
          )
        );
      });
    const scheduleWorks =
      works.filter(function (candidate) {
        const sourceTypes =
          Array.isArray(candidate?.sourceTypes)
            ? candidate.sourceTypes
            : [];

        return (
          candidate?.sourceType ===
            'pdf-schedule' ||
          candidate?.sourceType ===
            'schedule-table' ||
          sourceTypes.includes(
            'pdf-schedule'
          ) ||
          sourceTypes.includes(
            'schedule-table'
          ) ||
          (
            candidate?.startDate &&
            candidate?.finishDate
          )
        );
      });

    if (
      sections.length >
      maximumReasonableSections
    ) {
      issues.push({
        code: 'section-fragmentation',
        severity: 'blocked',
        fileName:
          documentItem.fileName || '',
        title:
          'Слишком много переключений типа документа',
        message:
          `Найдено разделов: ${sections.length}. ` +
          'Результат не считается завершённым до повторной проверки границ.'
      });
    }

    if (
      hasWorkVolume &&
      works.filter(function (candidate) {
        return candidate?.quantity !== null;
      }).length === 0
    ) {
      issues.push({
        code: 'work-volume-empty',
        severity: 'blocked',
        fileName:
          documentItem.fileName || '',
        title:
          'ВОР найден, но работы не извлечены',
        message:
          'BuildMind не имеет права показывать завершённый анализ, пока строки ВОР не прочитаны.'
      });
    }

    if (
      hasSchedule &&
      !isSupplyOnlySchedule &&
      scheduleWorks.length === 0
    ) {
      issues.push({
        code: 'schedule-rows-empty',
        severity: 'blocked',
        fileName:
          documentItem.fileName || '',
        title:
          'ГПР найден, но строки графика не извлечены',
        message:
          'Анализ не завершён: BuildMind не извлёк названия работ и даты из найденного ГПР.'
      });
    }

    if (
      largeReadablePdf &&
      !expectedNoDownstream &&
      !hasWorkVolume &&
      !hasSchedule &&
      works.length === 0 &&
      materials.length === 0
    ) {
      const tablePagesConsidered =
        Array.isArray(
          documentItem
            ?.pdfTableAnalysis
            ?.pagesConsidered
        )
          ? documentItem
              .pdfTableAnalysis
              .pagesConsidered
          : [];

      issues.push({
        code:
          'downstream-extraction-empty',
        severity: 'blocked',
        fileName:
          documentItem.fileName || '',
        title:
          'Страницы прочитаны, но инженерные данные не извлечены',
        message:
          'Анализ не завершён: страницы прочитаны, но строки работ и материалы не извлечены. Проверьте границы ГПР/ВОР и передачу страниц в табличный анализатор.',
        totalPages,
        readPagesCount,
        sectionKinds:
          sections.map(function (section) {
            return section?.kind || 'other';
          }),
        tableContextsAnalyzed:
          Number(
            documentItem
              ?.pdfTableAnalysis
              ?.contextsAnalyzed
          ) || 0,
        tablePagesConsidered
      });
    }
  });

  const approvalLimit =
    Math.max(
      12,
      documents.length * 8
    );

  if (approvals.length > approvalLimit) {
    issues.push({
      code: 'approval-overflow',
      severity: 'blocked',
      fileName: '',
      title:
        'Найдено слишком много вопросов согласования',
      message:
        `После объединения осталось ${approvals.length}. ` +
        'Результат требует дополнительной фильтрации повторов.'
    });
  }

  const unreadablePagesCount =
    Number(result?.unreadablePagesCount) || 0;
  const hasExtractedDownstream =
    documents.some(function (documentItem) {
      return (
        (Array.isArray(documentItem?.works) &&
          documentItem.works.length > 0) ||
        (Array.isArray(documentItem?.materials) &&
          documentItem.materials.length > 0)
      );
    });

  if (unreadablePagesCount > 0) {
    issues.push({
      code: 'unreadable-pages',
      severity:
        hasExtractedDownstream
          ? 'review'
          : 'blocked',
      fileName: '',
      title:
        'Есть непрочитанные страницы',
      message:
        `Не прочитано страниц: ${unreadablePagesCount}.` +
        (
          hasExtractedDownstream
            ? ' Остальные извлечённые данные доступны для инженерной проверки.'
            : ''
        )
    });
  }

  const status =
    issues.some(function (issue) {
      return issue.severity === 'blocked';
    })
      ? 'blocked'
      : issues.length > 0
        ? 'review'
        : 'complete';

  return {
    status,
    issues
  };
}

window.BuildMindProjectIntakeQuality = {
  version:
    BUILDMIND_PROJECT_INTAKE_QUALITY_VERSION,

  classifySignals:
    classifyProjectIntakeQualitySignals,

  classifyTable:
    classifyProjectIntakeQualityTable,

  extractApprovals:
    extractProjectIntakeQualityApprovals,

  groupApprovals:
    groupProjectIntakeQualityApprovals,

  groupUncertainRows:
    groupProjectIntakeQualityUncertainRows,

  evaluateResult:
    evaluateProjectIntakeQualityResult,

  isStampContext:
    isProjectIntakeQualityStampContext
};

console.info(
  'BuildMind Project Intake Quality загружен:',
  BUILDMIND_PROJECT_INTAKE_QUALITY_VERSION
);
