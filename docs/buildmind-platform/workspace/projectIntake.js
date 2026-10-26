'use strict';

/* ==================================================
   BUILDMIND PROJECT INTAKE — V2.0

   Первый автоматизированный слой BuildMind:
   - запускает существующие PDF / Excel движки;
   - определяет назначение документов;
   - считает найденные работы и материалы;
   - выделяет сметы / коммерческие / договорные документы;
   - ищет в PDF явные признаки согласований и разрешений;
   - показывает спорные места для инженерной проверки.

   V1 ничего не утверждает автоматически.
   ================================================== */

const BUILDMIND_PROJECT_INTAKE_VERSION =
  'project-intake-v2.0';

const PROJECT_INTAKE_KIND_LABELS = {
  composite:
    'Составной PDF / комплект документов',

  'project-documentation':
    'Проектная / рабочая документация',

  'work-volume':
    'Ведомость объёмов работ',

  schedule:
    'График производства работ',

  specification:
    'Спецификация',

  estimate:
    'Сметная документация',

  'commercial-proposal':
    'Коммерческое предложение',

  agreement:
    'Договор / дополнительное соглашение',

  journal:
    'Журнал / ведомость',

  other:
    'Тип документа требует проверки'
};

const PROJECT_INTAKE_DOCUMENT_ROLE_LABELS = {
  auto: 'Автоопределение',
  agreement: 'Договор',
  'project-documentation': 'Проектная документация',
  'work-volume': 'ВОР — ведомость объёмов работ',
  schedule: 'ГПР — график производства работ',
  specification: 'Спецификация / материалы',
  other: 'Другой документ'
};

const PROJECT_INTAKE_CONFIDENCE_LABELS = {
  high:
    'Высокая',

  medium:
    'Средняя',

  low:
    'Низкая'
};

const PROJECT_INTAKE_APPROVAL_TYPE_LABELS = {
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

let projectIntakeLastResult =
  null;

let projectIntakeAnalysisInProgress =
  false;

let projectIntakeAnalysisController =
  null;

let projectIntakeCancelRequested =
  false;

function createProjectIntakeAbortError() {
  const error = new Error(
    'Анализ остановлен пользователем.'
  );

  error.name = 'AbortError';
  error.code =
    'PROJECT_INTAKE_ANALYSIS_CANCELLED';

  return error;
}

function isProjectIntakeAbortError(
  error
) {
  return Boolean(
    error &&
    (
      error.name === 'AbortError' ||
      error.code ===
        'PROJECT_INTAKE_ANALYSIS_CANCELLED' ||
      error.code ===
        'PDF_ANALYSIS_CANCELLED' ||
      error.code === 'OCR_CANCELLED'
    )
  );
}

function throwIfProjectIntakeCancelled(
  signal
) {
  if (signal?.aborted) {
    throw createProjectIntakeAbortError();
  }
}

function intakeT(
  key
) {
  if (
    window.BuildMindI18n &&
    typeof window
      .BuildMindI18n
      .t === 'function'
  ) {
    return window
      .BuildMindI18n
      .t(key);
  }

  const fallback = {
    'intake.title':
      'Загрузка и анализ проекта',

    'intake.subtitle':
      'Загрузите комплект документов. BuildMind сам определит их назначение и покажет то, что требует проверки.',

    'intake.selectFiles':
      'Загрузить комплект проекта',

    'intake.analyze':
      'Анализировать комплект',

    'intake.analyzing':
      'BuildMind анализирует документы…',

    'intake.empty':
      'Сначала загрузите документы проекта.',

    'intake.ready':
      'Комплект готов к анализу.',

    'intake.complete':
      'Анализ комплекта завершён.',

    'intake.review':
      'Требует вашего внимания'
  };

  return fallback[key] ||
    key;
}

function escapeProjectIntakeHtml(
  value
) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[
        symbol
      ];
    }
  );
}

function normalizeProjectIntakeText(
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

function getProjectIntakeDocuments() {
  if (
    window.BuildMindProjectDocuments &&
    typeof window
      .BuildMindProjectDocuments
      .getAll === 'function'
  ) {
    return window
      .BuildMindProjectDocuments
      .getAll();
  }

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

function getProjectIntakeExtension(
  documentItem
) {
  if (
    window.BuildMindProjectDocuments &&
    typeof window
      .BuildMindProjectDocuments
      .getExtension === 'function'
  ) {
    return window
      .BuildMindProjectDocuments
      .getExtension(
        documentItem.file
      );
  }

  const parts =
    String(
      documentItem
        ?.file
        ?.name ||
      ''
    ).split('.');

  return parts.length > 1
    ? parts
        .pop()
        .toLowerCase()
    : '';
}

function getProjectIntakeDocumentRole(documentItem, options = {}) {
  const requestedRole = String(
    options.documentRole || documentItem?.documentRole || 'auto'
  );

  return Object.prototype.hasOwnProperty.call(
    PROJECT_INTAKE_DOCUMENT_ROLE_LABELS,
    requestedRole
  ) ? requestedRole : 'auto';
}

function getProjectIntakeDocumentRoleSource(
  documentItem
) {
  return documentItem?.documentRoleSource ===
    'filename'
    ? 'filename'
    : getProjectIntakeDocumentRole(documentItem) !==
        'auto'
      ? 'user'
      : 'auto';
}

function getProjectIntakeDocumentRoleEvidence(
  documentItem
) {
  return getProjectIntakeDocumentRoleSource(
    documentItem
  ) === 'filename'
    ? 'Тип определён по названию файла'
    : 'Назначение файла выбрано пользователем';
}


function getProjectIntakeDocumentRoleLabel(role) {
  return PROJECT_INTAKE_DOCUMENT_ROLE_LABELS[role] ||
    PROJECT_INTAKE_DOCUMENT_ROLE_LABELS.auto;
}

function getProjectIntakeExplicitPageNumbers(documentItem) {
  return (Array.isArray(documentItem?.analysis?.extractedPages)
    ? documentItem.analysis.extractedPages
    : [])
    .map(function (page) { return Number(page?.pageNumber); })
    .filter(function (pageNumber) {
      return Number.isInteger(pageNumber) && pageNumber > 0;
    });
}

function createProjectIntakeExplicitSection(documentItem, role) {
  if (
    role === 'auto' ||
    !Object.prototype.hasOwnProperty.call(
      PROJECT_INTAKE_KIND_LABELS,
      role
    )
  ) {
    return null;
  }

  const pageNumbers = getProjectIntakeExplicitPageNumbers(documentItem);

  return {
    id: 'user-role-' + role,
    kind: role,
    label: getProjectIntakeDocumentRoleLabel(role),
    confidence: 'high',
    source:
      getProjectIntakeDocumentRoleEvidence(
        documentItem
      ),
    pageNumbers,
    anchorPages: pageNumbers.slice(0, 3),
    startPage: pageNumbers[0] || null,
    endPage: pageNumbers[pageNumbers.length - 1] || null,
    userAssigned:
      getProjectIntakeDocumentRoleSource(
        documentItem
      ) === 'user',
    filenameAssigned:
      getProjectIntakeDocumentRoleSource(
        documentItem
      ) === 'filename'
  };
}

function applyProjectIntakeDocumentRole(classification, documentItem, options = {}) {
  const role = getProjectIntakeDocumentRole(documentItem, options);

  if (role === 'auto') {
    return classification;
  }

  return {
    kind: role,
    confidence: 'high',
    source:
      getProjectIntakeDocumentRoleEvidence(
        documentItem
      ),
    requestedRole: role,
    requestedRoleLabel: getProjectIntakeDocumentRoleLabel(role),
    detectedKind: classification?.kind || 'other',
    classificationConflict: Boolean(
      classification?.kind && classification.kind !== role
    )
  };
}

function getProjectIntakePdfText(
  documentItem
) {
  const analysis =
    documentItem
      ?.analysis;

  if (
    !analysis
      ?.success ||
    !Array.isArray(
      analysis
        .extractedPages
    )
  ) {
    return '';
  }

  return analysis
    .extractedPages
    .map(
      function (page) {
        return page.text ||
          '';
      }
    )
    .join(' ');
}

function classifyProjectIntakeByNameAndText(
  fileName,
  text
) {
     if (
    window.BuildMindProjectIntakeQuality &&
    typeof window
      .BuildMindProjectIntakeQuality
      .classifySignals === 'function'
  ) {
    return window
      .BuildMindProjectIntakeQuality
      .classifySignals(
        fileName,
        text
      );
  }
   
  const source =
    normalizeProjectIntakeText(
      `${fileName || ''} ${text || ''}`
    );

  const rules = [
    {
      kind:
        'commercial-proposal',

      patterns: [
        /коммерческ\w* предложени/,
        /технико-коммерческ\w* предложени/,
        /ценов\w* предложени/,
        /стоимость предложени/,
        /коммерческ\w* часть/,
        /(^|[^а-яa-z0-9])ткп([^а-яa-z0-9]|$)/,
        /(^|[^а-яa-z0-9])кп([^а-яa-z0-9]|$)/
      ]
    },

    {
      kind:
        'agreement',

      patterns: [
        /дополнительн\w* соглашени/,
        /доп\.?\s*соглашени/,
        /(^|[^а-яa-z0-9])дс\s*№?/,
        /приложени\w* к договор/,
        /договорн\w* ведомост/
      ]
    },

    {
      kind:
        'estimate',

      patterns: [
        /локальн\w* смет/,
        /сметн\w* документац/,
        /сметн\w* расчет/,
        /сметн\w* расчёт/,
        /сметн\w* стоимость/,
        /(^|[^а-яa-z0-9])смета([^а-яa-z0-9]|$)/
      ]
    },

    {
      kind:
        'work-volume',

      patterns: [
        /ведомост\w* объем\w* работ/,
        /ведомост\w* объём\w* работ/,
        /(^|[^а-яa-z0-9])вор([^а-яa-z0-9]|$)/
      ]
    },

    {
      kind:
        'schedule',

      patterns: [
        /график\w* производств\w* работ/,
        /календарн\w* график/,
        /(^|[^а-яa-z0-9])гпр([^а-яa-z0-9]|$)/
      ]
    },

    {
      kind:
        'specification',

      patterns: [
        /спецификац\w* материал/,
        /спецификац\w* оборудован/,
        /(^|[^а-яa-z0-9])спецификац/
      ]
    },

    {
      kind:
        'project-documentation',

      patterns: [
        /рабоч\w* документац/,
        /проектн\w* документац/,
        /пояснительн\w* записк/,
        /общие указания/,
        /рабоч\w* проект/
      ]
    }
  ];

  let best =
    null;

  rules.forEach(
    function (rule) {
      let score =
        0;

      rule.patterns.forEach(
        function (
          pattern
        ) {
          if (
            pattern.test(
              source
            )
          ) {
            score +=
              4;
          }
        }
      );

      if (
        !best ||
        score >
          best.score
      ) {
        best = {
          kind:
            rule.kind,

          score
        };
      }
    }
  );

  if (
    !best ||
    best.score === 0
  ) {
    return null;
  }

  return {
    kind:
      best.kind,

    confidence:
      best.score >= 8
        ? 'high'
        : 'medium',

    source:
      'Название / содержимое документа'
  };
}

function mapExistingPdfClassification(
  classification
) {
  if (!classification) {
    return null;
  }

  const mapping = {
    composite:
      'composite',

    schedule:
      'schedule',

    specification:
      'specification',

    'work-volume':
      'work-volume',

    estimate:
      'estimate',

    'commercial-proposal':
      'commercial-proposal',

    agreement:
      'agreement',

    'working-documents':
      'project-documentation',

    'explanatory-note':
      'project-documentation',

    'cable-journal':
      'journal'
  };

  const kind =
    mapping[
      classification.id
    ];

  if (!kind) {
    return null;
  }

  const confidenceText =
    String(
      classification
        .confidence ||
      ''
    ).toLowerCase();

  let confidence =
    'low';

  if (
    confidenceText.includes(
      'высок'
    )
  ) {
    confidence =
      'high';
  } else if (
    confidenceText.includes(
      'сред'
    )
  ) {
    confidence =
      'medium';
  }

  return {
    kind,

    confidence,

    source:
      'PDF-анализ BuildMind'
  };
}

function classifyProjectIntakePdf(
  documentItem
) {
  const requestedRole = getProjectIntakeDocumentRole(documentItem);

  if (requestedRole !== 'auto') {
    return applyProjectIntakeDocumentRole(
      { kind: requestedRole, confidence: 'high' },
      documentItem
    );
  }

  const compositeAnalysis =
    documentItem
      ?.analysis
      ?.compositeAnalysis;

  if (
    compositeAnalysis
      ?.isComposite
  ) {
    return {
      kind: 'composite',
      confidence: 'high',
      source:
        'Постраничный анализ выявил несколько самостоятельных разделов'
    };
  }

  const compositeSections =
    Array.isArray(
      compositeAnalysis
        ?.meaningfulSections
    )
      ? compositeAnalysis
          .meaningfulSections
      : [];

  if (
    compositeSections.length === 1 &&
    compositeSections[0].kind
  ) {
    return {
      kind:
        compositeSections[0].kind,
      confidence:
        compositeSections[0]
          .confidence ||
        'medium',
      source:
        'Постраничный анализ структуры PDF'
    };
  }

  const heuristic =
    classifyProjectIntakeByNameAndText(
      documentItem
        .file
        .name,

      getProjectIntakePdfText(
        documentItem
      )
    );

  const existing =
    mapExistingPdfClassification(
      documentItem
        .analysis
        ?.documentClassification
    );

  if (
    heuristic &&
    existing &&
    heuristic.kind ===
      existing.kind
  ) {
    return {
      kind:
        heuristic.kind,

      confidence:
        heuristic.confidence ===
          'high' ||
        existing.confidence ===
          'high'
          ? 'high'
          : 'medium',

      source:
        'Название / содержимое + PDF-анализ BuildMind'
    };
  }

  if (
    heuristic &&
    existing &&
    heuristic.kind !==
      existing.kind
  ) {
    return {
      kind:
        heuristic.confidence ===
          'high'
          ? heuristic.kind
          : existing.kind,

      confidence:
        'medium',

      source:
        'Найдены разные признаки — требуется проверка',

      conflict:
        true
    };
  }

  return (
    heuristic ||
    existing ||
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

function classifyProjectIntakeTable(
  documentItem,
  analysis
) {
  const requestedRole = getProjectIntakeDocumentRole(documentItem);

  if (requestedRole !== 'auto') {
    return applyProjectIntakeDocumentRole(
      { kind: requestedRole, confidence: 'high' },
      documentItem
    );
  }

  if (
    window.BuildMindProjectIntakeQuality &&
    typeof window
      .BuildMindProjectIntakeQuality
      .classifyTable === 'function'
  ) {
    return window
      .BuildMindProjectIntakeQuality
      .classifyTable(
        documentItem,
        analysis
      );
  }
   
  const nameResult =
    classifyProjectIntakeByNameAndText(
      documentItem
        .file
        .name,

      ''
    );

  const sheets =
    Array.isArray(
      analysis?.sheets
    )
      ? analysis.sheets
      : [];

  const ids =
    sheets
      .map(
        function (sheet) {
          return (
            sheet
              ?.tableClassification
              ?.id ||
            ''
          );
        }
      )
      .filter(Boolean);

  let structureResult =
    null;

  if (
    ids.includes(
      'schedule-table'
    )
  ) {
    structureResult = {
      kind:
        'schedule',

      confidence:
        'high',

      source:
        'Структура таблицы'
    };
  } else if (
    ids.includes(
      'work-volume'
    )
  ) {
    structureResult = {
      kind:
        'work-volume',

      confidence:
        'high',

      source:
        'Структура таблицы'
    };
  } else if (
    ids.includes(
      'material-table'
    )
  ) {
    structureResult = {
      kind:
        'specification',

      confidence:
        'medium',

      source:
        'Структура таблицы'
    };
  } else if (
    ids.includes(
      'mixed-work-material-price-table'
    )
  ) {
    structureResult = {
      kind:
        'commercial-proposal',

      confidence:
        'medium',

      source:
        'Таблица работ / материалов со стоимостью'
    };
  }

  if (
    nameResult &&
    structureResult?.kind ===
      'commercial-proposal' &&
    [
      'estimate',
      'commercial-proposal'
    ].includes(
      nameResult.kind
    )
  ) {
    return {
      kind:
        nameResult.kind,

      confidence:
        'high',

      source:
        'Название файла + таблица работ / материалов со стоимостью'
    };
  }

  if (
    nameResult &&
    structureResult &&
    nameResult.kind ===
      structureResult.kind
  ) {
    return {
      kind:
        nameResult.kind,

      confidence:
        nameResult.confidence ===
          'high' ||
        structureResult.confidence ===
          'high'
          ? 'high'
          : 'medium',

      source:
        'Название файла + структура таблицы'
    };
  }

  if (
    nameResult &&
    structureResult &&
    nameResult.kind !==
      structureResult.kind
  ) {
    return {
      kind:
        nameResult.kind,

      confidence:
        'medium',

      source:
        'Название и структура таблицы дают разные признаки',

      conflict:
        true
    };
  }

  return (
    nameResult ||
    structureResult ||
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

function getProjectIntakeApprovalType(
  context
) {
  const text =
    normalizeProjectIntakeText(
      context
    );

  if (
    /техническ\w* услов|(^|[^а-я])ту([^а-я]|$)/.test(
      text
    )
  ) {
    return 'technical-conditions';
  }

  if (
    /технадзор|техническ\w* надзор|вызов\w* представител/.test(
      text
    )
  ) {
    return 'supervision';
  }

  if (
    /разрешени|допуск|ордер/.test(
      text
    )
  ) {
    return 'permit';
  }

  if (
    /уведомить|уведомлени/.test(
      text
    )
  ) {
    return 'notification';
  }

  return 'approval';
}

function detectProjectIntakeOrganization(
  context
) {
  const text =
    normalizeProjectIntakeText(
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
      /заказчик/,
      'Заказчик'
    ],

    [
      /проектн\w* организац|проектн\w* отдел|проектировщик/,
      'Проектная организация'
    ],

    [
      /балансодержател/,
      'Балансодержатель'
    ],

    [
      /эксплуатирующ\w* организац/,
      'Эксплуатирующая организация'
    ],

    [
      /владел\w* сет|владел\w* коммуникац/,
      'Владелец инженерных сетей'
    ]
  ];

  const found =
    organizations.find(
      function (item) {
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

function extractProjectIntakeApprovals(
  documentItem
) {
  if (
    window.BuildMindProjectIntakeQuality &&
    typeof window
      .BuildMindProjectIntakeQuality
      .extractApprovals === 'function'
  ) {
    return window
      .BuildMindProjectIntakeQuality
      .extractApprovals(
        documentItem
      );
  }
   
  const analysis =
    documentItem
      ?.analysis;

  if (
    !analysis
      ?.success ||
    !Array.isArray(
      analysis
        .extractedPages
    )
  ) {
    return [];
  }

  const actionPattern =
    /(согласован\w*|согласовать|согласование|разрешени\w*|техническ\w*\s+услов\w*|технадзор|техническ\w*\s+надзор|допуск\w*|ордер\w*|вызов\w*\s+представител\w*|уведомить|уведомлени\w*)/giu;

  const candidates =
    [];

  analysis
    .extractedPages
    .forEach(
      function (page) {
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
          candidates.length < 40
        ) {
          const start =
            Math.max(
              0,
              match.index -
                170
            );

          const end =
            Math.min(
              text.length,
              match.index +
                match[0].length +
                220
            );

          const context =
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

          if (
            context.length <
            20
          ) {
            continue;
          }

          const type =
            getProjectIntakeApprovalType(
              context
            );

          const organization =
            detectProjectIntakeOrganization(
              context
            );

          const key =
            [
              page.pageNumber,
              type,
              normalizeProjectIntakeText(
                context
              ).slice(
                0,
                120
              )
            ].join('|');

          const duplicate =
            candidates.some(
              function (
                candidate
              ) {
                return (
                  candidate.key ===
                  key
                );
              }
            );

          if (duplicate) {
            continue;
          }

          candidates.push({
            key,

            type,

            typeLabel:
              PROJECT_INTAKE_APPROVAL_TYPE_LABELS[
                type
              ],

            organization,

            confidence:
              organization ===
                'Организация требует уточнения'
                ? 'medium'
                : 'high',

            fileName:
              documentItem
                .file
                .name,

            pageNumber:
              page.pageNumber,

            context,

            sourceType:
              'document',

            requiresEngineerConfirmation:
              true
          });
        }
      }
    );

  return candidates;
}

function mergeProjectIntakePdfCandidates(
  primary,
  secondary
) {
  const result = [];
  const seen = new Set();

  [
    ...(Array.isArray(primary) ? primary : []),
    ...(Array.isArray(secondary) ? secondary : [])
  ].forEach(function (candidate) {
    const name =
      String(
        candidate?.workName ||
        candidate?.name ||
        ''
      )
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ')
        .trim();
    const key = [
      name,
      candidate?.unit || '',
      candidate?.quantity ?? '',
      candidate?.pageNumber || ''
    ].join('|');

    if (!name || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(candidate);
  });

  return result;
}

function normalizeProjectIntakeAggregateText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProjectIntakeAggregateQuantity(
  value
) {
  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? String(numeric)
    : String(value ?? '').trim();
}

function getProjectIntakeAggregateCandidateKey(
  candidate,
  type
) {
  return [
    type,
    normalizeProjectIntakeAggregateText(
      candidate?.workName ||
      candidate?.name
    ),
    normalizeProjectIntakeAggregateText(
      candidate?.unit
    ),
    normalizeProjectIntakeAggregateQuantity(
      candidate?.quantity
    ),
    String(candidate?.startDate || ''),
    String(candidate?.finishDate || '')
  ].join('|');
}

function mergeProjectIntakeAggregateCandidates(
  candidates,
  type
) {
  const result = [];
  const byKey = new Map();

  (Array.isArray(candidates) ? candidates : [])
    .forEach(function (candidate) {
      const key =
        getProjectIntakeAggregateCandidateKey(
          candidate,
          type
        );

      if (!key || /\|\|\|\|\|$/.test(key)) {
        return;
      }

      const sourceDocuments =
        [
          candidate?.fileName,
          candidate?.sourceDocument
        ].filter(Boolean);
      const sourcePages =
        [
          ...(Array.isArray(candidate?.pageNumbers)
            ? candidate.pageNumbers
            : []),
          candidate?.pageNumber
        ]
          .map(Number)
          // Number(null) === 0: отсутствующая страница не становится «стр. 0».
          .filter(function (page) {
            return Number.isInteger(page) && page > 0;
          });

      if (!byKey.has(key)) {
        const normalized = {
          ...candidate,
          sourceDocuments:
            Array.from(
              new Set(sourceDocuments)
            ),
          sourcePages:
            Array.from(
              new Set(sourcePages)
            ).sort(function (first, second) {
              return first - second;
            }),
          occurrenceCount: 1
        };

        byKey.set(key, normalized);
        result.push(normalized);
        return;
      }

      const existing = byKey.get(key);

      existing.sourceDocuments =
        Array.from(
          new Set([
            ...(existing.sourceDocuments || []),
            ...sourceDocuments
          ])
        );

      existing.sourcePages =
        Array.from(
          new Set([
            ...(existing.sourcePages || []),
            ...sourcePages
          ])
        ).sort(function (first, second) {
          return first - second;
        });

      existing.sourceTypes =
        Array.from(
          new Set([
            ...(existing.sourceTypes || []),
            ...(candidate?.sourceTypes || []),
            candidate?.sourceType
          ].filter(Boolean))
        );

      existing.occurrenceCount =
        Number(existing.occurrenceCount || 1) + 1;
    });

  return result;
}

function getProjectIntakeCandidateDocumentNames(
  candidate
) {
  return Array.from(
    new Set([
      candidate?.fileName,
      candidate?.sourceDocument,
      ...(
        Array.isArray(candidate?.sourceDocuments)
          ? candidate.sourceDocuments
          : []
      )
    ].filter(Boolean))
  );
}

function countProjectIntakeWorksByDocumentRole(
  works,
  documents,
  role
) {
  const files =
    new Set(
      (Array.isArray(documents) ? documents : [])
        .filter(function (documentItem) {
          return documentItem?.documentRole === role;
        })
        .map(function (documentItem) {
          return documentItem.fileName;
        })
        .filter(Boolean)
    );

  if (files.size === 0) {
    return 0;
  }

  return (Array.isArray(works) ? works : [])
    .filter(function (candidate) {
      return getProjectIntakeCandidateDocumentNames(
        candidate
      ).some(function (fileName) {
        return files.has(fileName);
      });
    })
    .length;
}


async function analyzeProjectIntakePdf(
  documentItem,
  options = {}
) {
  throwIfProjectIntakeCancelled(
    options.signal
  );

  const api =
    window.BuildMindProjectDocuments;

  const previousAnalysis =
    documentItem.analysis || null;

  const shouldRetryOcr =
    Boolean(
      previousAnalysis?.success &&
      (
        previousAnalysis
          .ocrUnavailableReason ||
        previousAnalysis
          .ocrLimitReason
      ) &&
      Array.isArray(
        previousAnalysis
          .ocrAttemptedPages
      ) &&
      previousAnalysis
        .ocrAttemptedPages
        .length > 0 &&
      (
        !Array.isArray(
          previousAnalysis.ocrPages
        ) ||
        previousAnalysis
          .ocrPages
          .length === 0 ||
        (
          Array.isArray(
            previousAnalysis
              .ocrSkippedPages
          ) &&
          previousAnalysis
            .ocrSkippedPages
            .length > 0
        )
      )
    );

  if (
    !documentItem
      .analysis
      ?.success ||
    shouldRetryOcr
  ) {
    if (
      api &&
      typeof api
        .analyzePdfDocument ===
        'function'
    ) {
      await api
        .analyzePdfDocument(
          documentItem,
          {
            ...options,
            documentRole: getProjectIntakeDocumentRole(documentItem, options)
          }
        );
    } else if (
      typeof inspectPdfDocument ===
        'function'
    ) {
      documentItem.status =
        'analyzing';

      documentItem.analysis =
        await inspectPdfDocument(
          documentItem,
          {
            ...options,
            documentRole: getProjectIntakeDocumentRole(documentItem, options)
          }
        );

      documentItem.status =
        documentItem
          .analysis
          .success
          ? 'analyzed'
          : 'error';
    }
  }

  throwIfProjectIntakeCancelled(
    options.signal
  );

  const compositeAnalysis =
    documentItem
      .analysis
      ?.compositeAnalysis ||
    null;

  const sections =
    Array.isArray(
      compositeAnalysis
        ?.meaningfulSections
    )
      ? compositeAnalysis
          .meaningfulSections
      : [];

  const requestedRole = getProjectIntakeDocumentRole(
    documentItem,
    options
  );

  const explicitSection = createProjectIntakeExplicitSection(
    documentItem,
    requestedRole
  );

  const resolvedSections = explicitSection
    ? [explicitSection]
    : sections;

  const tableSections =
    explicitSection &&
    ['work-volume', 'schedule'].includes(requestedRole)
      ? [explicitSection]
      : sections;

  const pdfTableAnalysis =
    window.BuildMindPdfTable &&
    typeof window
      .BuildMindPdfTable
      .analyzePages === 'function'
      ? window
          .BuildMindPdfTable
          .analyzePages(
            documentItem
              .analysis
              ?.extractedPages || [],
            tableSections,
            {
              sourceDocument:
                documentItem.file.name
            }
          )
      : null;

  const legacyMaterials =
    Array.isArray(
      documentItem
        .analysis
        ?.materialCandidates
    )
      ? documentItem
          .analysis
          .materialCandidates
      : [];

  const pdfMaterials =
    Array.isArray(
      pdfTableAnalysis?.materials
    )
      ? pdfTableAnalysis.materials
      : [];

  return {
    classification:
      classifyProjectIntakePdf(
        documentItem
      ),

    compositeAnalysis,

    sections: resolvedSections,

    ocrPages:
      Array.isArray(
        documentItem
          .analysis
          ?.ocrPages
      )
        ? documentItem
            .analysis
            .ocrPages
        : [],

    ocrFastPages:
      Array.isArray(
        documentItem
          .analysis
          ?.ocrFastPages
      )
        ? documentItem
            .analysis
            .ocrFastPages
        : [],

    ocrDetailPages:
      Array.isArray(
        documentItem
          .analysis
          ?.ocrDetailPages
      )
        ? documentItem
            .analysis
            .ocrDetailPages
        : [],

    ocrLimitReason:
      String(
        documentItem
          .analysis
          ?.ocrLimitReason || ''
      ),

    unreadablePages:
      Array.from(
        new Set(
          [
            ...(
              Array.isArray(
                documentItem
                  .analysis
                  ?.ocrFailedPages
              )
                ? documentItem
                    .analysis
                    .ocrFailedPages
                : []
            ),
            ...(
              Array.isArray(
                documentItem
                  .analysis
                  ?.ocrSkippedPages
              )
                ? documentItem
                    .analysis
                    .ocrSkippedPages
                : []
            )
          ]
        )
      ),

    works:
      Array.isArray(
        pdfTableAnalysis?.works
      )
        ? pdfTableAnalysis.works
        : [],

    materials:
      mergeProjectIntakePdfCandidates(
        pdfMaterials,
        legacyMaterials
      ),

    uncertain:
      Array.isArray(
        pdfTableAnalysis?.uncertain
      )
        ? pdfTableAnalysis.uncertain
        : [],

    pdfTableAnalysis,

    approvals:
      extractProjectIntakeApprovals(
        documentItem
      )
  };
}

async function analyzeProjectIntakeTable(
  documentItem
) {
  const engine =
    window.BuildMindWorkVolume;

  let analysis =
    documentItem
      .workVolumeAnalysis ||
    null;

  if (
    !analysis &&
    engine &&
    typeof engine
      .analyzeDocument ===
      'function'
  ) {
    documentItem.status =
      'analyzing';

    analysis =
      await engine
        .analyzeDocument(
          documentItem
        );

    documentItem.workVolumeAnalysis =
      analysis;

    documentItem.status =
      analysis
        ? 'analyzed'
        : 'error';
  }

  const candidates =
    Array.isArray(
      analysis
        ?.candidates
    )
      ? analysis.candidates
      : [];

  const requestedRole =
    getProjectIntakeDocumentRole(
      documentItem
    );

  const explicitSection =
    createProjectIntakeExplicitSection(
      documentItem,
      requestedRole
    );

  return {
    classification:
      classifyProjectIntakeTable(
        documentItem,
        analysis
      ),

    sections:
      explicitSection
        ? [explicitSection]
        : [],

    works:
      candidates.filter(
        function (item) {
          return (
            item.rowType ===
            'work'
          );
        }
      ),

    materials:
      candidates.filter(
        function (item) {
          return (
            item.rowType ===
            'material'
          );
        }
      ),

    uncertain:
      candidates.filter(
        function (item) {
          return (
            item.rowType ===
            'uncertain'
          );
        }
      ),

    approvals: []
  };
}


async function analyzeProjectIntakeDocument(documentItem, context = {}) {
  const extension = getProjectIntakeExtension(documentItem);
  const role = getProjectIntakeDocumentRole(documentItem, context);

  if (extension === 'pdf') {
    return analyzeProjectIntakePdf(documentItem, {
      ...context,
      documentRole: role
    });
  }

  if (['xlsx', 'xls', 'csv'].includes(extension)) {
    return analyzeProjectIntakeTable(documentItem);
  }

  return createProjectIntakeUnsupportedAnalysis(documentItem);
}

function createProjectIntakeUnsupportedAnalysis(
  documentItem
) {
  return {
    classification: {
      kind:
        'other',

      confidence:
        'low',

      source:
        'Формат пока не поддерживается'
    },

    works: [],

    materials: [],

    uncertain: [],

    approvals: [],

    sourceDocument:
      documentItem?.file?.name ||
      ''
  };
}

function getProjectIntakeAgentOrchestrator() {
  return (
    window.BuildMindAgentOrchestrator ||
    null
  );
}

function getProjectIntakeAgentTaskType(
  extension,
  documentItem
) {
  const role = getProjectIntakeDocumentRole(documentItem);

  if (role !== 'auto') {
    return 'document.' + role;
  }

  if (extension === 'pdf') {
    return 'document.pdf';
  }

  if (['xlsx', 'xls', 'csv'].includes(extension)) {
    return 'document.spreadsheet';
  }

  return 'document.other';
}

function createProjectIntakeAgentTrace(
  report
) {
  if (
    !report ||
    typeof report !== 'object'
  ) {
    return null;
  }

  return {
    schemaVersion:
      report.schemaVersion ||
      null,

    reportId:
      report.reportId ||
      null,

    agentId:
      report.agentId ||
      'unknown-agent',

    taskType:
      report.taskType ||
      'unknown',

    status:
      report.status ||
      'failed',

    confidence:
      report.confidence ||
      'low',

    durationMs:
      Number(report.durationMs) || 0,

    errorCode:
      report.errorCode ||
      null,

    errorMessage:
      report.errorMessage ||
      null
  };
}

function registerProjectIntakeAgents() {
  const orchestrator =
    getProjectIntakeAgentOrchestrator();

  if (
    !orchestrator ||
    typeof orchestrator.register !==
      'function'
  ) {
    return;
  }

  orchestrator.register({
    id:
      'pdf-ocr-agent',

    taskType:
      'document.pdf',

    label:
      'Агент PDF/OCR',

    run:
      function (
        documentItem,
        context
      ) {
        return analyzeProjectIntakeDocument(
          documentItem,
          context
        );
      }
  });

  orchestrator.register({
    id:
      'spreadsheet-agent',

    taskType:
      'document.spreadsheet',

    label:
      'Агент Excel/таблиц',

    run:
      function (documentItem) {
        return analyzeProjectIntakeDocument(
          documentItem,
          {}
        );
      }
  });

  [
    {
      id: 'contract-agent',
      taskType: 'document.agreement',
      role: 'agreement',
      label: 'Агент договора'
    },
    {
      id: 'project-documentation-agent',
      taskType: 'document.project-documentation',
      role: 'project-documentation',
      label: 'Агент проектной документации'
    },
    {
      id: 'work-volume-agent',
      taskType: 'document.work-volume',
      role: 'work-volume',
      label: 'Агент ВОР'
    },
    {
      id: 'schedule-agent',
      taskType: 'document.schedule',
      role: 'schedule',
      label: 'Агент ГПР'
    },
    {
      id: 'specification-agent',
      taskType: 'document.specification',
      role: 'specification',
      label: 'Агент спецификаций'
    }
  ].forEach(function (agent) {
    orchestrator.register({
      id: agent.id,
      taskType: agent.taskType,
      label: agent.label,
      run: function (documentItem, context) {
        return analyzeProjectIntakeDocument(documentItem, {
          ...(context || {}),
          documentRole: agent.role
        });
      }
    });
  });

  orchestrator.register({
    id:
      'unsupported-file-agent',

    taskType:
      'document.other',

    label:
      'Агент других форматов',

    run:
      function (documentItem) {
        return createProjectIntakeUnsupportedAnalysis(
          documentItem
        );
      }
  });

  orchestrator.register({
    id:
      'materials-agent',

    taskType:
      'materials.extract',

    label:
      'Агент материалов',

    run:
      function (input) {
        const analyzed =
          input?.analyzed || {};

        const sourceDocument =
          input?.documentItem?.file?.name ||
          '';

        const materials =
          Array.isArray(
            analyzed.materials
          )
            ? analyzed.materials
                .map(
                  function (candidate) {
                    return {
                      ...candidate,

                      agentSource:
                        sourceDocument
                    };
                  }
                )
            : [];

        return {
          materials,

          materialCount:
            materials.length,

          sourceDocument,

          requiresEngineerConfirmation:
            true
        };
      }
  });

  orchestrator.register({
    id:
      'quantity-calculation-agent',

    taskType:
      'calculation.quantity',

    label:
      'Агент расчёта объёмов',

    run:
      function (input) {
        const engine =
          window.BuildMindWorkQuantity;

        const context =
          input?.context ||
          (
            window.BuildMindWorkContexts &&
            typeof window
              .BuildMindWorkContexts
              .getActive ===
              'function'
              ? window
                  .BuildMindWorkContexts
                  .getActive()
              : null
          );

        if (
          !engine ||
          typeof engine.find !==
            'function'
        ) {
          return {
            success: false,

            errorCode:
              'QUANTITY_ENGINE_NOT_AVAILABLE',

            errorMessage:
              'Локальный движок расчёта объёма не загружен.'
          };
        }

        if (!context) {
          return {
            success: false,

            errorCode:
              'ACTIVE_CONTEXT_NOT_FOUND',

            errorMessage:
              'Для расчёта объёма нужно выбрать контекст работы.'
          };
        }

        return engine.find({
          context,

          documents:
            Array.isArray(
              input?.documents
            )
              ? input.documents
              : input?.documentItem
                ? [input.documentItem]
                : []
        });
      }
  });
}

function getProjectIntakeScheduleReviewItems(
  candidates,
  fileName
) {
  return (
    Array.isArray(candidates)
      ? candidates
      : []
  )
    .filter(function (candidate) {
      return (
        candidate
          ?.scheduleReviewRequired ===
        true
      );
    })
    .map(function (candidate) {
      return {
        reviewType:
          'schedule-anomaly',

        fileName:
          fileName ||
          candidate.sourceDocument ||
          '',

        sourceSheet:
          candidate.sourceSheet ||
          '',

        sourceRow:
          candidate.sourceRow ||
          null,

        workName:
          candidate.workName ||
          '',

        startDate:
          candidate.startDate ||
          null,

        finishDate:
          candidate.finishDate ||
          null,

        durationDays:
          candidate.durationDays ||
          null,

        reasons:
          Array.isArray(
            candidate.scheduleReviewReasons
          )
            ? candidate.scheduleReviewReasons
            : []
      };
    });
}

function createProjectIntakeUi() {
  if (
    document.getElementById(
      'projectIntakeSection'
    )
  ) {
    return;
  }

  const projectDocuments =
    document.getElementById(
      'projectDocumentsSection'
    );

  if (!projectDocuments) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'projectIntakeSection';

  section.className =
    'card project-intake-card';

  section.innerHTML = `
    <div class="project-intake-header">
      <div>
        <span class="project-intake-eyebrow">
          АНАЛИЗ КОМПЛЕКТА · V2.0
        </span>

        <h2>
          ${escapeProjectIntakeHtml(
            intakeT(
              'intake.title'
            )
          )}
        </h2>

        <p class="muted">
          ${escapeProjectIntakeHtml(
            intakeT(
              'intake.subtitle'
            )
          )}
        </p>
      </div>

      <div class="project-intake-actions">
        <button
          type="button"
          id="projectIntakeSelectBtn"
          class="primary"
        >
          ${escapeProjectIntakeHtml(
            intakeT(
              'intake.selectFiles'
            )
          )}
        </button>

        <button
          type="button"
          id="projectIntakeAnalyzeBtn"
          class="secondary-btn"
          disabled
        >
          ${escapeProjectIntakeHtml(
            intakeT(
              'intake.analyze'
            )
            )}
        </button>

        <button
          type="button"
          id="projectIntakeCancelBtn"
          class="project-intake-cancel-btn"
          disabled
          hidden
        >
          Остановить анализ
        </button>
      </div>
    </div>

    <p
      id="projectIntakeStatus"
      class="project-intake-status"
    >
      ${escapeProjectIntakeHtml(
        intakeT(
          'intake.empty'
        )
      )}
    </p>

    <div class="project-intake-summary">
      <div>
        <strong id="projectIntakeDocumentsCount">0</strong>
        <span>Документы</span>
      </div>

      <div>
        <strong id="projectIntakeWorksCount">0</strong>
        <span>Работы по ВОР</span>
      </div>

      <div>
        <strong id="projectIntakeMaterialsCount">0</strong>
        <span>Кандидаты материалов</span>
      </div>

      <div>
        <strong id="projectIntakeCommercialCount">0</strong>
        <span>Сметы / договорные</span>
      </div>

      <div>
        <strong id="projectIntakeApprovalsCount">0</strong>
        <span>Вопросы согласований</span>
      </div>

      <div class="project-intake-summary-review">
        <strong id="projectIntakeReviewCount">0</strong>
        <span>Требует проверки</span>
      </div>
    </div>

    <div class="project-intake-composite-summary">
      <div>
        <strong id="projectIntakeSectionsCount">0</strong>
        <span>Разделы внутри PDF</span>
      </div>

      <div>
        <strong id="projectIntakeWorkVolumeSectionsCount">0</strong>
        <span>Найдено ВОР</span>
      </div>

      <div>
        <strong id="projectIntakeScheduleSectionsCount">0</strong>
        <span>Найдено ГПР</span>
      </div>

      <div>
        <strong id="projectIntakeOcrPagesCount">0</strong>
        <span>Страниц прочитано OCR</span>
      </div>
    </div>

    <div class="project-intake-grid">
      <section>
        <h3>
          Что BuildMind распознал
        </h3>

        <div
          id="projectIntakeDocumentsList"
          class="project-intake-list"
        >
          <div class="project-intake-empty">
            Результаты появятся после загрузки документов.
          </div>
        </div>
      </section>

      <section>
        <h3>
          ${escapeProjectIntakeHtml(
            intakeT(
              'intake.review'
            )
          )}
        </h3>

        <div
          id="projectIntakeReviewList"
          class="project-intake-list"
        >
          <div class="project-intake-empty">
            Пока нет вопросов для проверки.
          </div>
        </div>
      </section>
    </div>

    <div class="project-intake-note">
      BuildMind показывает инженерные гипотезы, источник и уверенность.
      Действующие документы, объёмы и согласования утверждает ответственный специалист.
    </div>
  `;

  projectDocuments
    .parentNode
    .insertBefore(
      section,
      projectDocuments
    );
}

function setProjectIntakeText(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );

  if (element) {
    element.textContent =
      String(
        value ?? ''
      );
  }
}

function renderProjectIntakeDocumentList(
  result
) {
  const container =
    document.getElementById(
      'projectIntakeDocumentsList'
    );

  if (!container) {
    return;
  }

  const documents =
    Array.isArray(
      result
        ?.documents
    )
      ? result.documents
      : [];

  if (
    documents.length === 0
  ) {
    container.innerHTML =
      '<div class="project-intake-empty">' +
      'Документы ещё не анализировались.' +
      '</div>';

    return;
  }

  container.innerHTML =
    documents
      .map(
        function (item) {
          const label =
            PROJECT_INTAKE_KIND_LABELS[
              item.kind
            ] ||
            PROJECT_INTAKE_KIND_LABELS
              .other;

          const confidence =
            PROJECT_INTAKE_CONFIDENCE_LABELS[
              item.confidence
            ] ||
            'Не определена';

          const sections =
            Array.isArray(item.sections)
              ? item.sections
              : [];

          const sectionsHtml =
            sections.length > 0
              ? `
                <div class="project-intake-section-list">
                  ${sections.map(
                    function (section) {
                      const pageRange =
                        section.startPage ===
                          section.endPage
                          ? `стр. ${section.startPage}`
                          : `стр. ${section.startPage}–${section.endPage}`;

                      const sectionConfidence =
                        PROJECT_INTAKE_CONFIDENCE_LABELS[
                          section.confidence
                        ] ||
                        'Требует уточнения';

                      const scheduleDateText =
                        section.kind ===
                          'schedule' &&
                        section.dateRange
                          ? ` · даты ${section.dateRange.startDate} — ${section.dateRange.endDate}` +
                            (
                              section.scheduleStatus ===
                                'expired'
                                ? ' · срок графика прошёл'
                                : section.scheduleStatus ===
                                    'review'
                                  ? ' · даты требуют проверки'
                                : ''
                            )
                          : '';

                      return `
                        <div class="project-intake-section-row">
                          <strong>
                            ${escapeProjectIntakeHtml(
                              section.label ||
                              PROJECT_INTAKE_KIND_LABELS[
                                section.kind
                              ] ||
                              PROJECT_INTAKE_KIND_LABELS.other
                            )}
                          </strong>

                          <span>
                            ${escapeProjectIntakeHtml(
                              pageRange
                            )}
                          </span>

                          <small>
                            ${escapeProjectIntakeHtml(
                              sectionConfidence +
                              scheduleDateText
                            )}
                          </small>
                        </div>
                      `;
                    }
                  ).join('')}
                </div>
              `
              : '';

          const ocrText =
            Array.isArray(item.ocrPages) &&
            item.ocrPages.length > 0
              ? `Локальный OCR: быстрый проход — ${
                  Array.isArray(item.ocrFastPages)
                    ? item.ocrFastPages.length
                    : 0
                } стр.; точное чтение таблиц — ${
                  Array.isArray(item.ocrDetailPages)
                    ? item.ocrDetailPages.length
                    : 0
                } стр.`
              : '';

          const ocrLimitText =
            item.ocrLimitReason
              ? ` ${item.ocrLimitReason}`
              : '';

          const extractedEvidenceText =
            `Извлечено из таблиц: работ — ${
              Array.isArray(item.works)
                ? item.works.length
                : 0
            }, материалов — ${
              Array.isArray(item.materials)
                ? item.materials.length
                : 0
            }.`;

          return `
            <article class="project-intake-item">
              <div>
                <strong>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )}
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    label
                  )}
                </p>

                <small>
                  Основание:
                  ${escapeProjectIntakeHtml(
                    item
                      .classificationSource
                  )}
                </small>

                ${sectionsHtml}

                <small class="project-intake-ocr-note">
                  ${escapeProjectIntakeHtml(
                    extractedEvidenceText
                  )}
                </small>

                ${
                  ocrText
                    ? `<small class="project-intake-ocr-note">${escapeProjectIntakeHtml(
                        ocrText + ocrLimitText
                      )}</small>`
                    : ''
                }
              </div>

              <span
                class="project-intake-confidence
                project-intake-confidence-${escapeProjectIntakeHtml(
                  item.confidence
                )}"
              >
                ${escapeProjectIntakeHtml(
                  confidence
                )}
              </span>
            </article>
          `;
        }
      )
      .join('');
}

function renderProjectIntakeReviewList(
  result
) {
  const container =
    document.getElementById(
      'projectIntakeReviewList'
    );

  if (!container) {
    return;
  }

  const items =
    Array.isArray(
      result
        ?.reviewItems
    )
      ? result.reviewItems
      : [];

  if (
    items.length === 0
  ) {
    container.innerHTML =
      '<div class="project-intake-empty project-intake-empty-ok">' +
      'По текущим правилам анализа явных вопросов не найдено.' +
      '</div>';

    return;
  }

  container.innerHTML =
    items
      .slice(
        0,
        40
      )
      .map(
        function (item) {
          if (
            item.reviewType ===
            'analysis-quality'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Контроль качества
                </span>

                <strong>
                  ${escapeProjectIntakeHtml(
                    item.title ||
                    'Результат требует проверки'
                  )}
                </strong>

                ${
                  item.fileName
                    ? `<p>${escapeProjectIntakeHtml(
                        item.fileName
                      )}</p>`
                    : ''
                }

                <small>
                  ${escapeProjectIntakeHtml(
                    item.message || ''
                  )}
                </small>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'schedule-document-expired'
          ) {
            const pageRange =
              item.startPage ===
                item.endPage
                ? `стр. ${item.startPage}`
                : `стр. ${item.startPage}–${item.endPage}`;

            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Актуальность ГПР
                </span>

                <strong>
                  Найден график с прошедшими датами
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )} ·
                  ${escapeProjectIntakeHtml(
                    pageRange
                  )}
                </p>

                <small>
                  Диапазон дат:
                  ${escapeProjectIntakeHtml(
                    item.startDate || '—'
                  )}
                  —
                  ${escapeProjectIntakeHtml(
                    item.endDate || '—'
                  )}.
                  Дата анализа:
                  ${escapeProjectIntakeHtml(
                    item.analysisDate || '—'
                  )}.
                  Это не автоматическая ошибка проекта:
                  инженер должен подтвердить, актуален ли график.
                </small>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'schedule-date-validation'
          ) {
            const pageRange =
              item.startPage ===
                item.endPage
                ? `стр. ${item.startPage}`
                : `стр. ${item.startPage}–${item.endPage}`;

            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Проверка дат ГПР
                </span>

                <strong>
                  Найдены сомнительные даты после OCR
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )} ·
                  ${escapeProjectIntakeHtml(
                    pageRange
                  )}
                </p>

                <small>
                  Принятые даты:
                  ${escapeProjectIntakeHtml(
                    Array.isArray(
                      item.acceptedDateValues
                    ) &&
                    item.acceptedDateValues.length > 0
                      ? item.acceptedDateValues.join(', ')
                      : '—'
                  )}.
                  Отклонённые значения:
                  ${escapeProjectIntakeHtml(
                    Array.isArray(
                      item.rejectedDateValues
                    ) &&
                    item.rejectedDateValues.length > 0
                      ? item.rejectedDateValues.join(', ')
                      : '—'
                  )}.
                </small>

                <p class="project-intake-review-hint">
                  ${escapeProjectIntakeHtml(
                    Array.isArray(item.reasons)
                      ? item.reasons.join(' ')
                      : 'Инженеру необходимо проверить даты по исходной странице.'
                  )}
                </p>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'ocr-gap'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Непрочитанные страницы
                </span>

                <strong>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )}
                </strong>

                <p>
                  Страницы:
                  ${escapeProjectIntakeHtml(
                    Array.isArray(
                      item.pageNumbers
                    )
                      ? item.pageNumbers.join(', ')
                      : ''
                  )}
                </p>

                <small>
                  ${escapeProjectIntakeHtml(
                    item.reason ||
                    'Текст не удалось распознать.'
                  )}
                  Эти страницы не используются автоматически
                  до ручной проверки.
                </small>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'schedule-anomaly'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Проверка дат ГПР
                </span>

                <strong>
                  ${escapeProjectIntakeHtml(
                    item.workName ||
                    'Строка графика работ'
                  )}
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )}
                  ${
                    item.sourceSheet
                      ? ` · лист ${escapeProjectIntakeHtml(
                          item.sourceSheet
                        )}`
                      : ''
                  }
                  ${
                    item.sourceRow
                      ? ` · строка ${escapeProjectIntakeHtml(
                          item.sourceRow
                        )}`
                      : ''
                  }
                </p>

                <small>
                  Начало: ${escapeProjectIntakeHtml(
                    item.startDate || '—'
                  )} · окончание: ${escapeProjectIntakeHtml(
                    item.finishDate || '—'
                  )} · длительность: ${escapeProjectIntakeHtml(
                    item.durationDays || '—'
                  )} дн.
                </small>

                <p class="project-intake-review-hint">
                  ${escapeProjectIntakeHtml(
                    Array.isArray(item.reasons)
                      ? item.reasons.join(' ')
                      : ''
                  )}
                </p>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'approval'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
  ${escapeProjectIntakeHtml(
    item.priorityLabel ||
    'Согласование / разрешение'
  )}
</span>

                <strong>
                  ${escapeProjectIntakeHtml(
                    item.topicLabel ||
                    item.typeLabel
                  )}
                </strong>

                               <p>
                  ${escapeProjectIntakeHtml(
                    item.organization
                  )}
                </p>

                ${
                  item.intentLabel
                    ? `<p>${escapeProjectIntakeHtml(
                        item.intentLabel
                      )}</p>`
                    : ''
                }

                                <small>
                  Источник:
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )},
                  стр.
                  ${escapeProjectIntakeHtml(
                    Array.isArray(
                      item.pageNumbers
                    )
                      ? item.pageNumbers.join(
                          ', '
                        )
                      : item.pageNumber
                  )}
                  ${
                    Number(
                      item.occurrenceCount || 1
                    ) > 1
                      ? ` · найдено упоминаний: ${escapeProjectIntakeHtml(
                          item.occurrenceCount
                        )}`
                      : ''
                  }
                </small>

                <blockquote>
                  ${escapeProjectIntakeHtml(
                    item.context
                  )}
                </blockquote>

                <p class="project-intake-review-hint">
                  ${
                    item.intent ===
                      'contractual-requirement'
                      ? 'Это требование документа, а не подтверждение выполненного согласования.'
                      : item.intent ===
                          'completed'
                        ? 'В документе указано, что согласование выполнено. Рекомендуется проверить подтверждающий документ и актуальность.'
                        : 'По тексту документа выявлен признак внешней зависимости. Рекомендуется проверить наличие и статус соответствующего согласования.'
                  }
                </p>
              </article>
            `;
          }

          if (
            item.reviewType ===
            'uncertain-rows-group'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Строки таблицы
                </span>

                <strong>
                  Требует проверки: ${escapeProjectIntakeHtml(
                    item.count
                  )} строк
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )}
                </p>

                <small>
                  BuildMind не использует эти строки автоматически.
                  Примеры: ${escapeProjectIntakeHtml(
                    Array.isArray(
                      item.samples
                    )
                      ? item.samples.join(
                          '; '
                        )
                      : ''
                  ) || 'названия строк не извлечены'}.
                </small>
              </article>
            `;
          }
           
          if (
            item.reviewType ===
            'uncertain-row'
          ) {
            return `
              <article class="project-intake-review-item">
                <span class="project-intake-review-badge">
                  Строка таблицы
                </span>

                <strong>
                  ${escapeProjectIntakeHtml(
                    item.name ||
                    'Тип строки не определён'
                  )}
                </strong>

                <p>
                  ${escapeProjectIntakeHtml(
                    item.fileName
                  )}
                </p>

                <small>
                  BuildMind не использует эту строку автоматически,
                  пока инженер не уточнит её назначение.
                </small>
              </article>
            `;
          }

          return `
            <article class="project-intake-review-item">
              <span class="project-intake-review-badge">
                Тип документа
              </span>

              <strong>
                ${escapeProjectIntakeHtml(
                  item.fileName
                )}
              </strong>

              <p>
                Предположительно:
                ${escapeProjectIntakeHtml(
                  PROJECT_INTAKE_KIND_LABELS[
                    item.kind
                  ] ||
                  PROJECT_INTAKE_KIND_LABELS
                    .other
                )}
              </p>

              <small>
                Уверенность недостаточна для автоматического подтверждения.
              </small>
            </article>
          `;
        }
      )
      .join('');
}

function renderProjectIntake(
  result
) {
  createProjectIntakeUi();

  const documents =
    getProjectIntakeDocuments();

  const analyzeButton =
    document.getElementById(
      'projectIntakeAnalyzeBtn'
    );

  const selectButton =
    document.getElementById(
      'projectIntakeSelectBtn'
    );

  const cancelButton =
    document.getElementById(
      'projectIntakeCancelBtn'
    );

  if (analyzeButton) {
    analyzeButton.disabled =
      projectIntakeAnalysisInProgress ||
      documents.length === 0;
  }

  if (selectButton) {
    selectButton.disabled =
      projectIntakeAnalysisInProgress;
  }

  if (cancelButton) {
    cancelButton.hidden =
      !projectIntakeAnalysisInProgress;
    cancelButton.disabled =
      !projectIntakeAnalysisInProgress ||
      projectIntakeCancelRequested;
    cancelButton.textContent =
      projectIntakeCancelRequested
        ? 'Останавливаем…'
        : 'Остановить анализ';
  }

  if (!result) {
    setProjectIntakeText(
      'projectIntakeDocumentsCount',
      documents.length
    );

    [
      'Works',
      'Materials',
      'Commercial',
      'Approvals',
      'Review',
      'Sections',
      'WorkVolumeSections',
      'ScheduleSections',
      'OcrPages'
    ].forEach(
      function (suffix) {
        setProjectIntakeText(
          `projectIntake${suffix}Count`,
          0
        );
      }
    );

    renderProjectIntakeDocumentList({
      documents: []
    });

    renderProjectIntakeReviewList({
      reviewItems: []
    });

    setProjectIntakeText(
      'projectIntakeStatus',

      documents.length > 0
        ? (
            `${intakeT(
              'intake.ready'
            )} ` +
            'Нажмите «Анализировать сейчас».'
          )
        : intakeT(
            'intake.empty'
          )
    );

    return;
  }

  setProjectIntakeText(
    'projectIntakeDocumentsCount',
    result.documents.length
  );

  setProjectIntakeText(
    'projectIntakeWorksCount',
    result.worksCount
  );

  setProjectIntakeText(
    'projectIntakeMaterialsCount',
    result.materialsCount
  );

  setProjectIntakeText(
    'projectIntakeCommercialCount',
    result
      .commercialDocumentsCount
  );

  setProjectIntakeText(
    'projectIntakeApprovalsCount',
    result.approvals.length
  );

  setProjectIntakeText(
    'projectIntakeReviewCount',
    result.reviewItems.length
  );

  setProjectIntakeText(
    'projectIntakeSectionsCount',
    result.sectionsCount || 0
  );

  setProjectIntakeText(
    'projectIntakeWorkVolumeSectionsCount',
    result.workVolumeSectionsCount || 0
  );

  setProjectIntakeText(
    'projectIntakeScheduleSectionsCount',
    result.scheduleSectionsCount || 0
  );

  setProjectIntakeText(
    'projectIntakeOcrPagesCount',
    result.ocrPagesCount || 0
  );

  renderProjectIntakeDocumentList(
    result
  );

  renderProjectIntakeReviewList(
    result
  );
}

async function runBuildMindProjectIntake() {
  if (
    projectIntakeAnalysisInProgress
  ) {
    return projectIntakeLastResult;
  }

  createProjectIntakeUi();

  const documents =
    getProjectIntakeDocuments();

  if (
    documents.length === 0
  ) {
    setProjectIntakeText(
      'projectIntakeStatus',
      intakeT(
        'intake.empty'
      )
    );

    renderProjectIntake(
      null
    );

    return {
      success: false,

      errorCode:
        'PROJECT_INTAKE_DOCUMENTS_NOT_FOUND'
    };
  }

  const analyzeButton =
    document.getElementById(
      'projectIntakeAnalyzeBtn'
    );

  const selectButton =
    document.getElementById(
      'projectIntakeSelectBtn'
    );

  const cancelButton =
    document.getElementById(
      'projectIntakeCancelBtn'
    );

  const analysisController =
    new AbortController();

  projectIntakeAnalysisController =
    analysisController;

  projectIntakeCancelRequested =
    false;

  projectIntakeAnalysisInProgress =
    true;

  if (
    window.BuildMindProjectDocuments &&
    typeof window.BuildMindProjectDocuments
      .setBusy === 'function'
  ) {
    window.BuildMindProjectDocuments
      .setBusy(true);
  }

  if (analyzeButton) {
    analyzeButton.disabled =
      true;

    analyzeButton.textContent =
      'Анализ…';
  }

  if (selectButton) {
    selectButton.disabled = true;
  }

  if (cancelButton) {
    cancelButton.hidden = false;
    cancelButton.disabled = false;
    cancelButton.textContent =
      'Остановить анализ';
  }

  setProjectIntakeText(
    'projectIntakeStatus',
    intakeT(
      'intake.analyzing'
    )
  );

  const result = {
    success:
      true,

    version:
      BUILDMIND_PROJECT_INTAKE_VERSION,

    createdAt:
      new Date()
        .toISOString(),

    documents:
      [],

    sectionsCount:
      0,

    workVolumeSectionsCount:
      0,

    scheduleSectionsCount:
      0,

    ocrPagesCount:
      0,

    unreadablePagesCount:
      0,

    partial:
      false,

    worksCount:
      0,

    allExtractedWorksCount:
      0,

    workVolumeRowsCount:
      0,

    scheduleRowsCount:
      0,

    rawWorkVolumeRowsCount:
      0,

    rawScheduleRowsCount:
      0,

    works: [],

    materialsCount:
      0,

    materials: [],

    commercialDocumentsCount:
      0,

    approvals:
      [],

    uncertainRows:
      [],

    reviewItems:
      [],

    agentReports:
      [],

    agentSummary:
      null,

    duplicates: {
      works: 0,
      materials: 0,
      approvals: 0
    }
  };

  try {
    for (
      let index = 0;
      index <
        documents.length;
      index += 1
    ) {
      throwIfProjectIntakeCancelled(
        analysisController.signal
      );

      const documentItem =
        documents[
          index
        ];

      const extension =
        getProjectIntakeExtension(
          documentItem
        );

      setProjectIntakeText(
        'projectIntakeStatus',

        `Анализируется ` +
        `${index + 1} из ` +
        `${documents.length}: ` +
        documentItem
          .file
          .name
      );

      let analyzed;

      const documentAgentReports =
        [];

      const orchestrator =
        getProjectIntakeAgentOrchestrator();

      const agentTaskType =
        getProjectIntakeAgentTaskType(
          extension,
          documentItem
        );

      if (
        orchestrator &&
        typeof orchestrator.run ===
          'function'
      ) {
        const primaryAgentReport =
          await orchestrator.run(
            agentTaskType,
            documentItem,
            {
              signal:
                analysisController.signal
            }
          );

        documentAgentReports.push(
          primaryAgentReport
        );

        analyzed =
          (
            primaryAgentReport &&
            [
              'completed',
              'partial'
            ].includes(
              primaryAgentReport.status
            ) &&
            primaryAgentReport.payload &&
            typeof primaryAgentReport.payload ===
              'object'
          )
            ? primaryAgentReport.payload
            : {
                ...createProjectIntakeUnsupportedAnalysis(
                  documentItem
                ),

                agentErrorCode:
                  primaryAgentReport?.errorCode ||
                  'AGENT_EXECUTION_FAILED',

                agentErrorMessage:
                  primaryAgentReport?.errorMessage ||
                  'Специализированный агент не вернул результат.'
              };

        if (
          primaryAgentReport &&
          primaryAgentReport.status ===
            'cancelled'
        ) {
          throwIfProjectIntakeCancelled(
            analysisController.signal
          );
        }

        if (
          primaryAgentReport &&
          [
            'completed',
            'partial'
          ].includes(
            primaryAgentReport.status
          )
        ) {
          const materialsAgentReport =
            await orchestrator.run(
              'materials.extract',
              {
                documentItem,

                analyzed
              },
              {
                signal:
                  analysisController.signal
              }
            );

          documentAgentReports.push(
            materialsAgentReport
          );

          if (
            materialsAgentReport &&
            materialsAgentReport.status ===
              'completed' &&
            materialsAgentReport.payload &&
            Array.isArray(
              materialsAgentReport.payload.materials
            )
          ) {
            analyzed = {
              ...analyzed,

              materials:
                materialsAgentReport
                  .payload
                  .materials
            };
          }
        }
      } else if (
        extension ===
        'pdf'
      ) {
        analyzed =
          await analyzeProjectIntakePdf(
            documentItem,
            {
              signal:
                analysisController.signal
            }
          );
      } else if (
        [
          'xlsx',
          'xls',
          'csv'
        ].includes(
          extension
        )
      ) {
        analyzed =
          await analyzeProjectIntakeTable(
            documentItem
          );
      } else {
        analyzed =
          createProjectIntakeUnsupportedAnalysis(
            documentItem
          );
      }

      const agentTraces =
        documentAgentReports
          .map(
            createProjectIntakeAgentTrace
          )
          .filter(
            Boolean
          );

      documentItem.agentReports =
        agentTraces;

      throwIfProjectIntakeCancelled(
        analysisController.signal
      );

      const classification =
        analyzed
          .classification;

      const sections =
        Array.isArray(
          analyzed.sections
        )
          ? analyzed.sections
          : [];

      const ocrPages =
        Array.isArray(
          analyzed.ocrPages
        )
          ? analyzed.ocrPages
          : [];

      const unreadablePages =
        Array.isArray(
          analyzed.unreadablePages
        )
          ? analyzed.unreadablePages
          : [];

      const documentResult = {
        documentId:
          documentItem.id,

        fileName:
          documentItem
            .file
            .name,

        extension,

        documentRole:
          getProjectIntakeDocumentRole(documentItem),

        documentRoleSource:
          getProjectIntakeDocumentRoleSource(documentItem),

        kind:
          classification.kind,

        confidence:
          classification
            .confidence,

        classificationSource:
          classification
            .source,

        sections,

        isComposite:
          analyzed
            .compositeAnalysis
            ?.isComposite === true,

        totalPages:
          Number(
            documentItem
              .analysis
              ?.totalPages
          ) || 0,

        extractedPagesCount:
          Array.isArray(
            documentItem
              .analysis
              ?.extractedPages
          )
            ? documentItem
                .analysis
                .extractedPages
                .length
            : 0,

        pagesWithText:
          Number(
            documentItem
              .analysis
              ?.pagesWithText
          ) || 0,

        ocrPages,

        ocrFastPages:
          Array.isArray(analyzed.ocrFastPages)
            ? analyzed.ocrFastPages
            : [],

        ocrDetailPages:
          Array.isArray(analyzed.ocrDetailPages)
            ? analyzed.ocrDetailPages
            : [],

        ocrLimitReason:
          analyzed.ocrLimitReason || '',

        unreadablePages,

        works:
          Array.isArray(analyzed.works)
            ? analyzed.works
            : [],

        materials:
          Array.isArray(analyzed.materials)
            ? analyzed.materials
            : [],

        pdfTableAnalysis:
          analyzed.pdfTableAnalysis || null,

        agentReports:
          Array.isArray(
            documentItem.agentReports
          )
            ? documentItem.agentReports
            : [],

        agentIds:
          Array.isArray(
            documentItem.agentReports
          )
            ? documentItem.agentReports.map(
                function (report) {
                  return report.agentId;
                }
              )
            : [],

        requiresReview:
          classification
            .confidence !==
              'high' ||
          classification.kind ===
            'other' ||
          classification
            .conflict ===
            true
      };

      result
        .documents
        .push(
          documentResult
        );

      result.agentReports.push(
        ...(
          Array.isArray(
            documentItem.agentReports
          )
            ? documentItem.agentReports
            : []
        )
      );

      result.sectionsCount +=
        sections.length;

      result.workVolumeSectionsCount +=
        sections.filter(
          function (section) {
            return (
              section.kind ===
                'work-volume' ||
              (
                Array.isArray(
                  section.secondaryKinds
                ) &&
                section.secondaryKinds
                  .includes(
                    'work-volume'
                  )
              )
            );
          }
        ).length;

      result.scheduleSectionsCount +=
        sections.filter(
          function (section) {
            return section.kind ===
              'schedule';
          }
        ).length;

      result.ocrPagesCount +=
        ocrPages.length;

      result.unreadablePagesCount +=
        unreadablePages.length;

      sections
        .filter(
          function (section) {
            return (
              section.kind ===
                'schedule' &&
              section.scheduleStatus ===
                'expired'
            );
          }
        )
        .forEach(
          function (section) {
            result.reviewItems.push({
              reviewType:
                'schedule-document-expired',
              fileName:
                documentItem.file.name,
              startPage:
                section.startPage,
              endPage:
                section.endPage,
              startDate:
                section
                  .dateRange
                  ?.startDate || null,
              endDate:
                section
                  .dateRange
                  ?.endDate || null,
              analysisDate:
                section.analysisDate || null
            });
          }
        );

      sections
        .filter(
          function (section) {
            return (
              section.kind ===
                'schedule' &&
              section
                .dateValidation
                ?.status ===
                'review'
            );
          }
        )
        .forEach(
          function (section) {
            result.reviewItems.push({
              reviewType:
                'schedule-date-validation',
              fileName:
                documentItem.file.name,
              startPage:
                section.startPage,
              endPage:
                section.endPage,
              acceptedDateValues:
                section.dateValues || [],
              rejectedDateValues:
                section.rejectedDateValues || [],
              reasons:
                section
                  .dateValidation
                  ?.reasons || []
            });
          }
        );

      if (unreadablePages.length > 0) {
        result.reviewItems.push({
          reviewType: 'ocr-gap',
          fileName:
            documentItem.file.name,
          pageNumbers:
            unreadablePages,
          reason:
            documentItem
              .analysis
              ?.ocrUnavailableReason ||
            documentItem
              .analysis
              ?.ocrLimitReason ||
            'Текст страницы не удалось распознать.'
        });
      }

      result.works.push(
        ...analyzed.works.map(
          function (candidate) {
            return {
              ...candidate,
              fileName:
                documentItem.file.name
            };
          }
        )
      );

      result.materials.push(
        ...analyzed.materials.map(
          function (candidate) {
            return {
              ...candidate,
              fileName:
                documentItem.file.name
            };
          }
        )
      );

      result.worksCount =
        result.works.length;

      result.materialsCount =
        result.materials.length;

      result.reviewItems.push(
        ...getProjectIntakeScheduleReviewItems(
          analyzed.works,
          documentItem.file.name
        )
      );

      result
        .approvals
        .push(
          ...analyzed
            .approvals
        );

      result
        .uncertainRows
        .push(
          ...analyzed
            .uncertain
            .map(
              function (
                candidate
              ) {
                return {
                  ...candidate,

                  fileName:
                    documentItem
                      .file
                      .name
                };
              }
            )
        );

      const hasCommercialSection =
        sections.filter(
          function (section) {
            return [
              'estimate',
              'commercial-proposal',
              'agreement'
            ].includes(
              section.kind
            );
          }
        ).length > 0;

      if (hasCommercialSection) {
        result
          .commercialDocumentsCount +=
          1;
      } else if (
        [
          'estimate',
          'commercial-proposal',
          'agreement'
        ].includes(
          classification.kind
        )
      ) {
        result
          .commercialDocumentsCount +=
          1;
      }

      if (
        documentResult
          .requiresReview
      ) {
        result
          .reviewItems
          .push({
            reviewType:
              'document-kind',

            fileName:
              documentResult
                .fileName,

            kind:
              documentResult
                .kind,

            confidence:
              documentResult
                .confidence
          });
      }
    }

    const rawWorksCount =
      result.works.length;
    const rawMaterialsCount =
      result.materials.length;
    const rawApprovalsCount =
      result.approvals.length;
    const rawWorkVolumeRowsCount =
      countProjectIntakeWorksByDocumentRole(
        result.works,
        result.documents,
        'work-volume'
      );
    const rawScheduleRowsCount =
      countProjectIntakeWorksByDocumentRole(
        result.works,
        result.documents,
        'schedule'
      );

    result.rawWorkVolumeRowsCount =
      rawWorkVolumeRowsCount;
    result.rawScheduleRowsCount =
      rawScheduleRowsCount;

    result.works =
      mergeProjectIntakeAggregateCandidates(
        result.works,
        'work'
      );

    result.materials =
      mergeProjectIntakeAggregateCandidates(
        result.materials,
        'material'
      );

    if (
      window.BuildMindProjectIntakeQuality &&
      typeof window
        .BuildMindProjectIntakeQuality
        .groupApprovals === 'function'
    ) {
      result.approvals =
        window.BuildMindProjectIntakeQuality
          .groupApprovals(result.approvals);
    }

    result.allExtractedWorksCount =
      result.works.length;
    result.workVolumeRowsCount =
      countProjectIntakeWorksByDocumentRole(
        result.works,
        result.documents,
        'work-volume'
      );
    result.scheduleRowsCount =
      countProjectIntakeWorksByDocumentRole(
        result.works,
        result.documents,
        'schedule'
      );
    result.worksCount =
      result.workVolumeRowsCount ||
      result.scheduleRowsCount ||
      result.allExtractedWorksCount;
    result.materialsCount =
      result.materials.length;
    result.duplicates = {
      works:
        Math.max(
          rawWorksCount -
            result.allExtractedWorksCount,
          0
        ),
      materials:
        Math.max(
          rawMaterialsCount - result.materialsCount,
          0
        ),
      approvals:
        Math.max(
          rawApprovalsCount - result.approvals.length,
          0
        )
    };

    result
      .approvals
      .forEach(
        function (
          candidate
        ) {
          result
            .reviewItems
            .push({
              ...candidate,

              reviewType:
                'approval'
            });
        }
      );

        if (
      window.BuildMindProjectIntakeQuality &&
      typeof window
        .BuildMindProjectIntakeQuality
        .groupUncertainRows === 'function'
    ) {
      result.reviewItems.push(
        ...window
          .BuildMindProjectIntakeQuality
          .groupUncertainRows(
            result.uncertainRows
          )
      );
    } else {
      result
        .uncertainRows
        .slice(
          0,
          30
        )
        .forEach(
          function (
            candidate
          ) {
            result
              .reviewItems
              .push({
                reviewType:
                  'uncertain-row',

                fileName:
                  candidate
                    .fileName,

                name:
                  candidate
                    .workName ||
                  ''
              });
          }
        );
    }

    const orchestratorForSummary =
      getProjectIntakeAgentOrchestrator();

    const activeWorkContext =
      window.BuildMindWorkContexts &&
      typeof window.BuildMindWorkContexts.getActive ===
        'function'
        ? window.BuildMindWorkContexts.getActive()
        : null;

    if (
      activeWorkContext &&
      orchestratorForSummary &&
      typeof orchestratorForSummary.run === 'function'
    ) {
      const quantityReport =
        await orchestratorForSummary.run(
          'calculation.quantity',
          {
            context: activeWorkContext,
            documents
          },
          {
            signal: analysisController.signal
          }
        );

      result.agentReports.push(quantityReport);
    }

    const agentContracts =
      window.BuildMindAgentContracts;

    if (
      agentContracts &&
      typeof agentContracts.createReport === 'function'
    ) {
      result.agentReports.push(
        agentContracts.createReport({
          agentId: 'director-agent',
          taskType: 'project.aggregate',
          status: 'completed',
          source: 'local-agent-orchestrator',
          confidence: 'medium',
          facts: [
            'Все загруженные файлы обработаны независимо.',
            'Сводка собрана главным агентом.'
          ],
          evidence: result.documents.map(function (item) {
            return {
              sourceFile: item.fileName,
              fileName: item.fileName,
              kind: item.kind,
              sourcePages: item.ocrPages
            };
          }),
          payload: {
            documentsCount: result.documents.length,
            worksCount: result.worksCount,
            materialsCount: result.materialsCount
          }
        })
      );
    }

    result.agentSummary =
      orchestratorForSummary &&
      typeof orchestratorForSummary.aggregate ===
        'function'
        ? orchestratorForSummary.aggregate(
            result.agentReports
          )
        : null;

    const qualityEvaluation =
      window.BuildMindProjectIntakeQuality &&
      typeof window
        .BuildMindProjectIntakeQuality
        .evaluateResult === 'function'
        ? window
            .BuildMindProjectIntakeQuality
            .evaluateResult(result)
        : {
            status:
              result.unreadablePagesCount > 0
                ? 'blocked'
                : 'complete',
            issues: []
          };

    result.qualityStatus =
      qualityEvaluation.status;

    result.qualityIssues =
      Array.isArray(
        qualityEvaluation.issues
      )
        ? qualityEvaluation.issues
        : [];

    result.reviewItems.unshift(
      ...result.qualityIssues.map(
        function (issue) {
          return {
            ...issue,
            reviewType:
              'analysis-quality'
          };
        }
      )
    );

    projectIntakeLastResult =
      result;

    result.partial =
      result.unreadablePagesCount > 0 ||
      result.qualityStatus === 'blocked';

    renderProjectIntake(
      result
    );

    setProjectIntakeText(
      'projectIntakeStatus',

      result.unreadablePagesCount > 0
        ? (
            'Анализ завершён не полностью: ' +
            `не прочитано страниц — ${result.unreadablePagesCount}. ` +
            'Проверьте сообщение OCR и запустите анализ повторно.'
          )
        : result.qualityStatus ===
            'blocked'
          ? (
              result.qualityIssues.some(
                function (issue) {
                  return issue.code ===
                    'downstream-extraction-empty';
                }
              )
                ? (
                    'Анализ не завершён: страницы прочитаны, ' +
                    'но строки работ и материалы не извлечены. ' +
                    'Проверьте разделы ГПР/ВОР и страницы-источники. ' +
                    'Результат не считается готовым.'
                  )
                : (
                    'Анализ не прошёл контроль качества. ' +
                    'BuildMind не выдаёт ложный итог: проверьте блок справа.'
                  )
            )
          : result.qualityStatus ===
              'review'
            ? (
                'Анализ выполнен, но отдельные результаты требуют инженерной проверки.'
              )
        : (
            `${intakeT(
              'intake.complete'
            )} ` +
            'Автоматически найденные выводы требуют инженерной проверки.'
          )
    );

    if (
      window.BuildMindProjectDocuments &&
      typeof window
        .BuildMindProjectDocuments
        .render ===
        'function'
    ) {
      window
        .BuildMindProjectDocuments
        .render();
    }

    window.dispatchEvent(
      new CustomEvent(
        'buildmind:project-intake-completed',
        {
          detail:
            result
        }
      )
    );

    return result;
  } catch (error) {
    if (isProjectIntakeAbortError(error)) {
      setProjectIntakeText(
        'projectIntakeStatus',
        'Анализ остановлен. Загруженные документы сохранены в текущей вкладке — можно запустить анализ повторно.'
      );

      return {
        success: false,
        cancelled: true,
        errorCode:
          'PROJECT_INTAKE_ANALYSIS_CANCELLED'
      };
    }

    console.error(
      'BuildMind Project Intake: ошибка анализа:',
      error
    );

    setProjectIntakeText(
      'projectIntakeStatus',

      'Во время анализа произошла ошибка. Проверьте Console.'
    );

    return {
      success:
        false,

      errorCode:
        'PROJECT_INTAKE_ANALYSIS_ERROR',

      error
    };
  } finally {
    projectIntakeAnalysisInProgress =
      false;

    projectIntakeCancelRequested =
      false;

    if (
      projectIntakeAnalysisController ===
      analysisController
    ) {
      projectIntakeAnalysisController =
        null;
    }

    if (
      window.BuildMindProjectDocuments &&
      typeof window.BuildMindProjectDocuments
        .setBusy === 'function'
    ) {
      window.BuildMindProjectDocuments
        .setBusy(false);
    }

    if (analyzeButton) {
      analyzeButton.disabled =
        getProjectIntakeDocuments()
          .length === 0;

      analyzeButton.textContent =
        intakeT(
          'intake.analyze'
        );
    }

    if (selectButton) {
      selectButton.disabled = false;
    }

    if (cancelButton) {
      cancelButton.hidden = true;
      cancelButton.disabled = true;
      cancelButton.textContent =
        'Остановить анализ';
    }
  }
}

function handleProjectIntakeDocumentsChanged() {
  const documents =
    getProjectIntakeDocuments();

  projectIntakeLastResult = null;

  renderProjectIntake(
    null
  );

  if (
    documents.length === 0
  ) {
    setProjectIntakeText(
      'projectIntakeStatus',
      intakeT('intake.empty')
    );

    return;
  }

  setProjectIntakeText(
    'projectIntakeStatus',
    `Загружено документов: ${documents.length}. ` +
      'Нажмите «Анализировать комплект». Анализ не запускается автоматически.'
  );
}

function cancelBuildMindProjectIntake() {
  if (
    !projectIntakeAnalysisInProgress ||
    !projectIntakeAnalysisController ||
    projectIntakeCancelRequested
  ) {
    return;
  }

  projectIntakeCancelRequested = true;

  const cancelButton =
    document.getElementById(
      'projectIntakeCancelBtn'
    );

  if (cancelButton) {
    cancelButton.disabled = true;
    cancelButton.textContent =
      'Останавливаем…';
  }

  setProjectIntakeText(
    'projectIntakeStatus',
    'Останавливаем анализ и освобождаем ресурсы браузера…'
  );

  projectIntakeAnalysisController.abort();
}

function bindProjectIntakeControls() {
  const selectButton =
    document.getElementById(
      'projectIntakeSelectBtn'
    );

  const analyzeButton =
    document.getElementById(
      'projectIntakeAnalyzeBtn'
    );

  const cancelButton =
    document.getElementById(
      'projectIntakeCancelBtn'
    );

  if (selectButton) {
    selectButton.addEventListener(
      'click',

      function () {
        if (
          window.BuildMindProjectDocuments &&
          typeof window
            .BuildMindProjectDocuments
            .chooseFiles ===
            'function'
        ) {
          window
            .BuildMindProjectDocuments
            .chooseFiles();
        } else {
          document
            .getElementById(
              'projectDocumentsInput'
            )
            ?.click();
        }
      }
    );
  }

  if (analyzeButton) {
    analyzeButton.addEventListener(
      'click',
      runBuildMindProjectIntake
    );
  }

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      cancelBuildMindProjectIntake
    );
  }
}

function initializeBuildMindProjectIntake() {
  createProjectIntakeUi();

  bindProjectIntakeControls();

  window.addEventListener(
    'buildmind:project-documents-changed',
    handleProjectIntakeDocumentsChanged
  );

  window.addEventListener(
    'buildmind:pdf-analysis-progress',

    function (event) {
      const detail =
        event?.detail;

      if (
        !detail?.message ||
        !projectIntakeAnalysisInProgress
      ) {
        return;
      }

      setProjectIntakeText(
        'projectIntakeStatus',
        detail.message
      );
    }
  );

  window.addEventListener(
    'buildmind:locale-changed',

    function () {
      const oldSection =
        document.getElementById(
          'projectIntakeSection'
        );

      if (oldSection) {
        oldSection.remove();
      }

      createProjectIntakeUi();

      bindProjectIntakeControls();

      renderProjectIntake(
        projectIntakeLastResult
      );
    }
  );

  renderProjectIntake(
    null
  );
}

window.BuildMindProjectIntake = {
  version:
    BUILDMIND_PROJECT_INTAKE_VERSION,

  run:
    runBuildMindProjectIntake,

  refresh:
    function () {
      renderProjectIntake(
        projectIntakeLastResult
      );
    },

  getLastResult:
    function () {
      return projectIntakeLastResult;
    }
};

registerProjectIntakeAgents();

initializeBuildMindProjectIntake();

console.info(
  'BuildMind Project Intake загружен:',
  BUILDMIND_PROJECT_INTAKE_VERSION
);
