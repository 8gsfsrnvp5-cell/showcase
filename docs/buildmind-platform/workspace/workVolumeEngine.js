'use strict';

/*
  ==================================================
  BUILDMIND WORK VOLUME ENGINE — DEMO V2.2
  ==================================================

  Читает XLSX / XLS / CSV, ищет таблицы вида
  «работа — единица — количество», сохраняет
  документ / лист / строку и сопоставляет строку ВОР
  с активным контекстом BuildMind.
*/

const BUILDMIND_WORK_VOLUME_ENGINE_VERSION =
  'work-volume-engine-demo-v2.2';

const WORK_VOLUME_SUPPORTED_EXTENSIONS = [
  'xlsx',
  'xls',
  'csv'
];

const WORK_VOLUME_HEADER_RULES = {
    work: [
    'наименование работ и затрат',
    'наименование работ',
    'наименование работы',
    'вид работ',
    'вид работы',
    'перечень работ',
    'описание работ',
    'работа',
    'наименование'
  ],

  unit: [
    'единица измерения',
    'ед. изм.',
    'ед изм',
    'ед.изм.',
    'единица изм.',
    'единица'
  ],

  quantity: [
    'количество по проекту',
    'объем по проекту',
    'объём по проекту',
    'объем работ',
    'объём работ',
    'количество',
    'кол-во',
    'кол во',
    'объем',
    'объём'
  ],

  startDate: [
    'начало',
    'начало работ',
    'дата начала'
  ],

  finishDate: [
    'окончание',
    'окончание работ',
    'дата окончания'
  ]
};


function normalizeWorkVolumeText(
  value
) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\u00a0/g, ' ')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[.:;,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function getWorkVolumeFileExtension(
  file
) {
  const parts =
    String(
      file && file.name
        ? file.name
        : ''
    ).split('.');

  return parts.length > 1
    ? parts.pop().toLowerCase()
    : '';
}


function parseWorkVolumeNumber(
  value
) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const normalized =
    String(value ?? '')
      .replace(/\u00a0/g, '')
      .replace(/\s/g, '')
      .replace(',', '.')
      .trim();

  if (
    !normalized ||
    !/^[+-]?\d+(?:\.\d+)?$/.test(
      normalized
    )
  ) {
    return null;
  }

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function normalizeWorkVolumeUnit(
  value
) {
  const normalized =
    normalizeWorkVolumeText(
      value
    ).replace(/\s+/g, '');

  const units = {
    м: 'м',
    пм: 'п.м.',
    'п.м': 'п.м.',
    'пог.м': 'п.м.',
    погм: 'п.м.',
    м2: 'м²',
    'м²': 'м²',
    м3: 'м³',
    'м³': 'м³',
    км: 'км',
    шт: 'шт',
    штук: 'шт',
    компл: 'компл.',
    комплект: 'компл.',
    комплектов: 'компл.',
    комплекс: 'компл.',
    т: 'т',
    кг: 'кг'
  };

  return units[normalized] || '';
}


function parseWorkVolumeDate(
  value
) {
  if (
    value instanceof Date &&
    Number.isFinite(
      value.getTime()
    )
  ) {
    return value
      .toISOString()
      .slice(0, 10);
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 20000 &&
    value < 80000
  ) {
    const excelEpoch =
      Date.UTC(
        1899,
        11,
        30
      );

    return new Date(
      excelEpoch +
        Math.round(value) *
          86400000
    )
      .toISOString()
      .slice(0, 10);
  }

  const text =
    String(value ?? '')
      .trim();

  if (!text) {
    return null;
  }

  const isoMatch =
    text.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
    );

  if (isoMatch) {
    return [
      isoMatch[1],
      String(isoMatch[2]).padStart(2, '0'),
      String(isoMatch[3]).padStart(2, '0')
    ].join('-');
  }

  const russianMatch =
    text.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})/
    );

  if (russianMatch) {
    const year =
      russianMatch[3].length === 2
        ? Number(russianMatch[3]) + 2000
        : Number(russianMatch[3]);

    return [
      year,
      String(russianMatch[2]).padStart(2, '0'),
      String(russianMatch[1]).padStart(2, '0')
    ].join('-');
  }

  return null;
}


function getWorkVolumeDurationDays(
  startDate,
  finishDate
) {
  if (
    !startDate ||
    !finishDate
  ) {
    return null;
  }

  const start =
    Date.parse(
      startDate + 'T00:00:00Z'
    );

  const finish =
    Date.parse(
      finishDate + 'T00:00:00Z'
    );

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(finish) ||
    finish < start
  ) {
    return null;
  }

  return (
    Math.round(
      (finish - start) /
        86400000
    ) + 1
  );
}


function cleanWorkVolumeWorkName(
  value
) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+/, '')
    .replace(/[-–—\s]+$/, '')
    .trim();
}

const WORK_VOLUME_TABLE_CLASSIFICATION_RULES = {
  workVolume: [
    'ведомость объемов работ',
    'ведомость объёмов работ',
    'ведомость работ',
    'виды и объемы работ',
    'виды и объёмы работ',
    'наименование работ',
    'объем работ',
    'объём работ'
  ],

  mixedWorkMaterialPrice: [
    'материалы и работы',
    'стоимость ед',
    'стоимость',
    'ндс',
    'цены'
  ],

  material: [
    'ведомость материалов',
    'спецификация материалов',
    'материал',
    'материалы'
  ],

  schedule: [
    'гпр',
    'график производства работ',
    'календарный график',
    'начало работ',
    'окончание работ',
    'продолжительность'
  ]
};


function collectWorkVolumeTableText(
  rows,
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  const rowText =
    sourceRows
      .slice(0, 40)
      .flatMap(
        function (row) {
          return Array.isArray(row)
            ? row
            : [];
        }
      )
      .map(
        normalizeWorkVolumeText
      )
      .filter(Boolean)
      .join(' ');

  return normalizeWorkVolumeText(
    [
      settings.sourceDocument || '',
      settings.sourceSheet || '',
      rowText
    ].join(' ')
  );
}


function findWorkVolumeTableEvidence(
  fullText,
  phrases
) {
  const source =
    normalizeWorkVolumeText(
      fullText
    );

  return phrases.filter(
    function (phrase) {
      const normalizedPhrase =
        normalizeWorkVolumeText(
          phrase
        );

      return (
        normalizedPhrase &&
        source.includes(
          normalizedPhrase
        )
      );
    }
  );
}


function classifyWorkVolumeTable(
  rows,
  options
) {
  const fullText =
    collectWorkVolumeTableText(
      rows,
      options
    );

  const workEvidence =
    findWorkVolumeTableEvidence(
      fullText,
      WORK_VOLUME_TABLE_CLASSIFICATION_RULES
        .workVolume
    );

  const mixedEvidence =
    findWorkVolumeTableEvidence(
      fullText,
      WORK_VOLUME_TABLE_CLASSIFICATION_RULES
        .mixedWorkMaterialPrice
    );

  const materialEvidence =
    findWorkVolumeTableEvidence(
      fullText,
      WORK_VOLUME_TABLE_CLASSIFICATION_RULES
        .material
    );

  const scheduleEvidence =
    findWorkVolumeTableEvidence(
      fullText,
      WORK_VOLUME_TABLE_CLASSIFICATION_RULES
        .schedule
    );

  const headerCells =
    (Array.isArray(rows) ? rows : [])
      .slice(0, 40)
      .flatMap(function (row) {
        return Array.isArray(row)
          ? row
          : [];
      })
      .map(
        normalizeWorkVolumeText
      )
      .filter(Boolean);

  const hasStartHeader =
    headerCells.includes(
      'начало'
    ) ||
    headerCells.includes(
      'начало работ'
    );

  const hasFinishHeader =
    headerCells.includes(
      'окончание'
    ) ||
    headerCells.includes(
      'окончание работ'
    );

  const hasCalendarScale =
    headerCells.some(function (cell) {
      return (
        /^(?:январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)$/.test(
          cell
        ) ||
        /^\d+\s*нед/.test(
          cell
        ) ||
        /^20\d{2}\s*г?$/.test(
          cell
        )
      );
    });

  const hasScheduleStructure =
    hasStartHeader &&
    hasFinishHeader &&
    (
      hasCalendarScale ||
      scheduleEvidence.length >= 1
    );

  const hasPriceStructure =
    mixedEvidence.some(
      function (phrase) {
        return (
          phrase === 'стоимость' ||
          phrase === 'стоимость ед' ||
          phrase === 'ндс' ||
          phrase === 'цены'
        );
      }
    );

  const hasMixedPhrase =
    mixedEvidence.includes(
      'материалы и работы'
    );


  /*
    ==============================================
    СМЕШАННАЯ ТАБЛИЦА

    Например:
    "материалы и работы"
    + цена
    + стоимость
    + НДС

    Разбираем строки,
    но автоматически объёмом работы
    их не считаем.
    ==============================================
  */

  if (
    hasMixedPhrase &&
    hasPriceStructure
  ) {
    return {
      id:
        'mixed-work-material-price-table',

      label:
        'Смешанная ведомость материалов и работ',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence:
        Array.from(
          new Set(
            mixedEvidence
          )
        ),

      allowGenericNameHeader:
        true,

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    ГПР / КАЛЕНДАРНАЯ ТАБЛИЦА
    ==============================================
  */

  if (
    scheduleEvidence.length >= 2 ||
    hasScheduleStructure
  ) {
    return {
      id:
        'schedule-table',

      label:
        'График / календарная таблица работ',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence:
        Array.from(
          new Set([
            ...scheduleEvidence,
            ...(hasStartHeader
              ? ['колонка «Начало»']
              : []),
            ...(hasFinishHeader
              ? ['колонка «Окончание»']
              : []),
            ...(hasCalendarScale
              ? ['календарная шкала']
              : [])
          ])
        ),

      allowGenericNameHeader:
        false,

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    ВЕДОМОСТЬ РАБОТ / ОБЪЁМОВ
    ==============================================
  */

  if (
    workEvidence.length >= 1 &&
    !hasPriceStructure
  ) {
    return {
      id:
        'work-volume',

      label:
        'Ведомость работ / объёмов работ',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence:
        workEvidence,

      allowGenericNameHeader:
        true,

      eligibleForAutomaticWorkVolume:
        true
    };
  }


  /*
    ==============================================
    ТАБЛИЦА МАТЕРИАЛОВ
    ==============================================
  */

  if (
    materialEvidence.length >= 1 &&
    workEvidence.length === 0
  ) {
    return {
      id:
        'material-table',

      label:
        'Таблица материалов',

      confidence: {
        level:
          'medium',

        label:
          'Средняя'
      },

      evidence:
        materialEvidence,

      allowGenericNameHeader:
        false,

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  return {
    id:
      'unknown-table',

    label:
      'Тип таблицы не определён',

    confidence: {
      level:
        'low',

      label:
        'Низкая'
    },

    evidence:
      [],

    allowGenericNameHeader:
      false,

    eligibleForAutomaticWorkVolume:
      false
  };
}

function scoreWorkVolumeHeaderCell(
  cellValue,
  aliases
) {
  const normalizedCell =
    normalizeWorkVolumeText(
      cellValue
    );

  if (!normalizedCell) {
    return 0;
  }

  let bestScore = 0;

  aliases.forEach(
    function (alias) {
      const normalizedAlias =
        normalizeWorkVolumeText(
          alias
        );

      if (!normalizedAlias) {
        return;
      }

      if (
        normalizedCell ===
        normalizedAlias
      ) {
        bestScore =
          Math.max(
            bestScore,
            5
          );

        return;
      }

      if (
        normalizedAlias.length >= 5 &&
        normalizedCell.includes(
          normalizedAlias
        )
      ) {
        bestScore =
          Math.max(
            bestScore,
            4
          );
      }
    }
  );

  return bestScore;
}


function mapWorkVolumeHeaderRow(
  row,
  tableClassification
) {
  const cells =
    Array.isArray(row)
      ? row
      : [];

  const result = {
    workColumn:
      null,

    unitColumn:
      null,

    quantityColumn:
      null,

    startDateColumn:
      null,

    finishDateColumn:
      null,

    workScore:
      0,

    unitScore:
      0,

    quantityScore:
      0,

    startDateScore:
      0,

    finishDateScore:
      0,

    score:
      0
  };

  cells.forEach(
    function (
      cellValue,
      columnIndex
    ) {
      let workScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.work
        );

      const normalizedCell =
        normalizeWorkVolumeText(
          cellValue
        );


      /*
        Слово "Наименование" слишком общее.

        Оно разрешается как колонка работы
        только если классификатор уже понял,
        что таблица действительно относится
        к работам или смешанным работам /
        материалам.
      */

      if (
        normalizedCell ===
          'наименование' &&
        !(
          tableClassification &&
          tableClassification
            .allowGenericNameHeader
        )
      ) {
        workScore = 0;
      }


      if (
        workScore >
        result.workScore
      ) {
        result.workScore =
          workScore;

        result.workColumn =
          columnIndex;
      }


      const unitScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.unit
        );

      if (
        unitScore >
        result.unitScore
      ) {
        result.unitScore =
          unitScore;

        result.unitColumn =
          columnIndex;
      }


      const quantityScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.quantity
        );

      if (
        quantityScore >
        result.quantityScore
      ) {
        result.quantityScore =
          quantityScore;

        result.quantityColumn =
          columnIndex;
      }


      const startDateScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES
            .startDate
        );

      if (
        startDateScore >
        result.startDateScore
      ) {
        result.startDateScore =
          startDateScore;

        result.startDateColumn =
          columnIndex;
      }


      const finishDateScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES
            .finishDate
        );

      if (
        finishDateScore >
        result.finishDateScore
      ) {
        result.finishDateScore =
          finishDateScore;

        result.finishDateColumn =
          columnIndex;
      }
    }
  );


  result.score =
    result.workScore +
    result.unitScore +
    result.quantityScore;


  return result;
}


function getWorkVolumeHeaderConfidence(
  score
) {
  if (score >= 14) {
    return {
      level: 'high',
      label: 'Высокая'
    };
  }

  if (score >= 11) {
    return {
      level: 'medium',
      label: 'Средняя'
    };
  }

  return {
    level: 'low',
    label: 'Низкая'
  };
}


function findWorkVolumeHeader(
  rows,
  tableClassification
) {
  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  const scanLimit =
    Math.min(
      sourceRows.length,
      40
    );

  let best =
    null;


  for (
    let rowIndex = 0;
    rowIndex < scanLimit;
    rowIndex += 1
  ) {
    const mapped =
      mapWorkVolumeHeaderRow(
        sourceRows[rowIndex],
        tableClassification
      );

    const complete =
      Boolean(
        mapped.workColumn !==
          null &&
        mapped.unitColumn !==
          null &&
        mapped.quantityColumn !==
          null
      );

    if (!complete) {
      continue;
    }


    if (
      !best ||
      mapped.score >
        best.score
    ) {
      best = {
        ...mapped,

        rowIndex,

        sourceRow:
          rowIndex + 1,

        confidence:
          getWorkVolumeHeaderConfidence(
            mapped.score
          )
      };
    }
  }


  return best;
}


function classifyWorkVolumeCandidate(
  workName
) {
  const taxonomyEngine =
    window.BuildMindWorkTaxonomy;

  if (
    !taxonomyEngine ||
    typeof taxonomyEngine
      .classify !==
      'function'
  ) {
    return null;
  }

  try {
    return taxonomyEngine.classify(
      workName
    );
  } catch (error) {
    console.warn(
      'Work Volume: не удалось применить Work Taxonomy:',
      error
    );

    return null;
  }
}

const WORK_VOLUME_ROW_CLASSIFICATION_RULES = {
  summaryPrefixes: [
    'итого',
    'всего',
    'в том числе',
    'в т ч',
    'итого по разделу',
    'всего по разделу',
    'итого по главе'
  ],

  sectionPrefixes: [
    'раздел ',
    'глава ',
    'подраздел ',
    'этап ',
    'комплекс работ'
  ],

  workPrefixes: [
    'устройство ',
    'монтаж ',
    'демонтаж ',
    'прокладка ',
    'укладка ',
    'установка ',
    'кладка ',
    'бетонирование ',
    'армирование ',
    'сварка ',
    'окраска ',
    'покраска ',
    'штукатурка ',
    'оштукатуривание ',
    'шпатлевание ',
    'шпаклевание ',
    'облицовка ',
    'грунтование ',
    'разработка грунта',
    'обратная засыпка',
    'засыпка ',
    'уплотнение ',
    'бурение ',
    'резка ',
    'сверление ',
    'нанесение ',
    'очистка ',
    'изоляция ',
    'гидроизоляция ',
    'планировка ',
    'разборка ',
    'замена ',
    'ремонт ',
    'работы по '
  ],

  materialPrefixes: [
    'раствор ',
    'бетон ',
    'цемент ',
    'песок ',
    'щебень ',
    'кирпич ',
    'блок ',
    'арматура ',
    'сталь ',
    'труба ',
    'кабель ',
    'провод ',
    'краска ',
    'грунтовка ',
    'герметик ',
    'мастика ',
    'утеплитель ',
    'минеральная вата',
    'минвата ',
    'стекло ',
    'лист ',
    'профиль ',
    'уголок ',
    'хомут ',
    'болт ',
    'гайка ',
    'шайба ',
    'крепеж ',
    'крепёж ',
    'панель ',
    'плита ',
    'доска ',
    'брус ',
    'рубероид ',
    'мембрана ',
    'геотекстиль ',
    'асфальтобетон ',
    'битум '
  ],

  machineryPrefixes: [
    'кран ',
    'автокран ',
    'экскаватор ',
    'бульдозер ',
    'погрузчик ',
    'самосвал ',
    'автосамосвал ',
    'манипулятор ',
    'автовышка ',
    'подъемник ',
    'подъёмник ',
    'компрессор ',
    'виброплита ',
    'каток ',
    'машина ',
    'механизм ',
    'буровая установка',
    'установка буровая'
  ]
};


function workVolumeTextStartsWithAny(
  value,
  phrases
) {
  const normalized =
    normalizeWorkVolumeText(
      value
    );

  return phrases.find(
    function (phrase) {
      return normalized.startsWith(
        normalizeWorkVolumeText(
          phrase
        )
      );
    }
  ) || null;
}


function classifyWorkVolumeRowCandidate(
  candidateData
) {
  const data =
    candidateData &&
    typeof candidateData ===
      'object'
      ? candidateData
      : {};

  const workName =
    cleanWorkVolumeWorkName(
      data.workName
    );

  const normalizedName =
    normalizeWorkVolumeText(
      workName
    );

  const taxonomy =
    data.taxonomy ||
    null;

  const baseResult = {
    rowType:
      'uncertain',

    rowLabel:
      'Тип строки требует проверки',

    confidence: {
      level:
        'low',

      label:
        'Низкая'
    },

    evidence:
      [],

    eligibleForAutomaticWorkVolume:
      false
  };


  if (!normalizedName) {
    return baseResult;
  }


  /*
    ==============================================
    ИТОГОВЫЕ СТРОКИ
    ==============================================
  */

  const summaryMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      WORK_VOLUME_ROW_CLASSIFICATION_RULES
        .summaryPrefixes
    );

  if (summaryMarker) {
    return {
      rowType:
        'summary',

      rowLabel:
        'Итоговая строка',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence: [
        summaryMarker
      ],

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    РАЗДЕЛЫ / ГРУППЫ
    ==============================================
  */

  const sectionMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      WORK_VOLUME_ROW_CLASSIFICATION_RULES
        .sectionPrefixes
    );

  if (sectionMarker) {
    return {
      rowType:
        'section',

      rowLabel:
        'Раздел / группа работ',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence: [
        sectionMarker
      ],

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    СИЛЬНЫЙ ПРИЗНАК ТЕХНИКИ

    Проверяем раньше "установка",
    потому что выражение
    "установка буровая" — это техника,
    а "установка светильников" — работа.
    ==============================================
  */

  const strongMachineryMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      [
        'буровая установка',
        'установка буровая'
      ]
    );

  if (strongMachineryMarker) {
    return {
      rowType:
        'machinery',

      rowLabel:
        'Машина / механизм',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence: [
        strongMachineryMarker
      ],

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    РАБОТА

    Источники:
    - характерное начало строки;
    - успешное совпадение Work Taxonomy.
    ==============================================
  */

  const taxonomyLooksLikeWork =
    Boolean(
      taxonomy &&
      (
        taxonomy.success ===
          true ||
        taxonomy.family ||
        taxonomy.workFamily
      )
    );

  const workMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      WORK_VOLUME_ROW_CLASSIFICATION_RULES
        .workPrefixes
    );

  if (
    workMarker ||
    taxonomyLooksLikeWork
  ) {
    return {
      rowType:
        'work',

      rowLabel:
        'Строительная работа',

      confidence: {
        level:
          workMarker
            ? 'high'
            : 'medium',

        label:
          workMarker
            ? 'Высокая'
            : 'Средняя'
      },

      evidence:
        [
          workMarker
            ? (
                'признак работы: ' +
                workMarker
              )
            : '',

          taxonomyLooksLikeWork
            ? 'совпадение Work Taxonomy'
            : ''
        ].filter(Boolean),

      eligibleForAutomaticWorkVolume:
        true
    };
  }


  /*
    ==============================================
    МАТЕРИАЛ
    ==============================================
  */

  const materialMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      WORK_VOLUME_ROW_CLASSIFICATION_RULES
        .materialPrefixes
    );

  if (materialMarker) {
    return {
      rowType:
        'material',

      rowLabel:
        'Материал / строительный ресурс',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence: [
        materialMarker
      ],

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    ТЕХНИКА / МЕХАНИЗМ
    ==============================================
  */

  const machineryMarker =
    workVolumeTextStartsWithAny(
      normalizedName,
      WORK_VOLUME_ROW_CLASSIFICATION_RULES
        .machineryPrefixes
    );

  if (machineryMarker) {
    return {
      rowType:
        'machinery',

      rowLabel:
        'Машина / механизм',

      confidence: {
        level:
          'high',

        label:
          'Высокая'
      },

      evidence: [
        machineryMarker
      ],

      eligibleForAutomaticWorkVolume:
        false
    };
  }


  /*
    ==============================================
    НЕОПРЕДЕЛЁННАЯ СТРОКА

    Не выдумываем тип.
    Требуется дальнейшая проверка.
    ==============================================
  */

  return baseResult;
}


function getWorkVolumeRowTypeCounts(
  candidates
) {
  const counts = {
    work:
      0,

    material:
      0,

    machinery:
      0,

    section:
      0,

    summary:
      0,

    uncertain:
      0
  };

  (
    Array.isArray(candidates)
      ? candidates
      : []
  ).forEach(
    function (candidate) {
      const rowType =
        candidate &&
        candidate.rowType
          ? candidate.rowType
          : 'uncertain';

      if (
        Object.prototype
          .hasOwnProperty.call(
            counts,
            rowType
          )
      ) {
        counts[rowType] += 1;
      } else {
        counts.uncertain += 1;
      }
    }
  );

  return counts;
}

function analyzeWorkVolumeRows(
  rows,
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  const sourceDocument =
    settings.sourceDocument ||
    '';

    const sourceSheet =
    settings.sourceSheet ||
    '';

  const tableClassification =
    classifyWorkVolumeTable(
      sourceRows,
      {
        sourceDocument,
        sourceSheet
      }
    );

  const header =
    findWorkVolumeHeader(
      sourceRows,
      tableClassification
    );

  if (!header) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_HEADER_NOT_FOUND',

      errorMessage:
        'Не найдены однозначные колонки работы, единицы измерения и объёма.',

      sourceDocument,

      sourceSheet,

      tableClassification,

      candidates: [],
      
      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  for (
    let rowIndex =
      header.rowIndex + 1;

    rowIndex <
      sourceRows.length;

    rowIndex += 1
  ) {
    const row =
      Array.isArray(
        sourceRows[rowIndex]
      )
        ? sourceRows[rowIndex]
        : [];

    const workName =
      cleanWorkVolumeWorkName(
        row[
          header.workColumn
        ]
      );

    const unit =
      normalizeWorkVolumeUnit(
        row[
          header.unitColumn
        ]
      );

    const quantity =
      parseWorkVolumeNumber(
        row[
          header.quantityColumn
        ]
      );

    const startDate =
      header.startDateColumn !== null
        ? parseWorkVolumeDate(
            row[
              header.startDateColumn
            ]
          )
        : null;

    const finishDate =
      header.finishDateColumn !== null
        ? parseWorkVolumeDate(
            row[
              header.finishDateColumn
            ]
          )
        : null;

    if (
      !workName ||
      workName.length < 3 ||
      !unit ||
      quantity === null ||
      quantity <= 0
    ) {
      continue;
    }

        const taxonomy =
      classifyWorkVolumeCandidate(
        workName
      );

    const durationDays =
      getWorkVolumeDurationDays(
        startDate,
        finishDate
      );

    let rowClassification =
      classifyWorkVolumeRowCandidate({
        workName,
        quantity,
        unit,
        taxonomy
      });

    const isScheduleTable =
      tableClassification.id ===
        'schedule-table';

    const isSupplySchedule =
      /график\s+постав|поставк|\bмтр\b|материал/.test(
        String(
          sourceDocument +
          ' ' +
          sourceSheet
        )
          .toLowerCase()
          .replace(/ё/g, 'е')
      );

    if (
      isScheduleTable &&
      startDate &&
      finishDate &&
      rowClassification.rowType ===
        'uncertain'
    ) {
      rowClassification = {
        rowType: 'work',
        rowLabel:
          'Строка графика работ',
        confidence: {
          level: 'medium',
          label: 'Средняя'
        },
        evidence: [
          'валидная пара дат ГПР'
        ],
        eligibleForAutomaticWorkVolume:
          false
      };
    } else if (
      isScheduleTable &&
      !startDate &&
      !finishDate &&
      /:/.test(workName)
    ) {
      rowClassification = {
        rowType: 'section',
        rowLabel:
          'Раздел / объект графика',
        confidence: {
          level: 'medium',
          label: 'Средняя'
        },
        evidence: [
          'строка без дат с заголовочной структурой'
        ],
        eligibleForAutomaticWorkVolume:
          false
      };
    }

    if (isSupplySchedule) {
      rowClassification = {
        rowType: 'material',
        rowLabel:
          'Позиция графика поставок',
        confidence: {
          level: 'medium',
          label: 'Средняя'
        },
        evidence: [
          'лист определён как график поставок МТР'
        ],
        eligibleForAutomaticWorkVolume:
          false
      };
    }

    const scheduleReviewReasons = [];

    if (isScheduleTable) {
      if (
        Boolean(startDate) !==
        Boolean(finishDate)
      ) {
        scheduleReviewReasons.push(
          'Заполнена только одна из дат начала / окончания.'
        );
      }

      if (
        startDate &&
        finishDate &&
        durationDays === null
      ) {
        scheduleReviewReasons.push(
          'Дата окончания раньше даты начала.'
        );
      }

      if (
        Number.isFinite(durationDays) &&
        durationDays > 730
      ) {
        scheduleReviewReasons.push(
          'Продолжительность более двух лет — проверить год и даты.'
        );
      }
    }

    candidates.push({
      workName,

      quantity,

      unit,

      startDate,

      finishDate,

      durationDays:
        durationDays,

      scheduleDataComplete:
        Boolean(
          startDate &&
          finishDate
        ),

      scheduleReviewRequired:
        scheduleReviewReasons.length > 0,

      scheduleReviewReasons,

      sourceType:
        isSupplySchedule
          ? 'supply-schedule'
          : tableClassification.id ===
              'work-volume'
            ? 'work-volume'
            : tableClassification.id,

      tableType:
        tableClassification.id,

      tableLabel:
        tableClassification.label,

      tableConfidence:
        tableClassification.confidence,

      tableEvidence:
        tableClassification.evidence,

      rowType:
        rowClassification.rowType,

      rowLabel:
        rowClassification.rowLabel,

      rowConfidence:
        rowClassification.confidence,

      rowEvidence:
        rowClassification.evidence,

      automaticWorkVolumeAllowed:
        Boolean(
          tableClassification
            .eligibleForAutomaticWorkVolume ===
            true &&
          rowClassification
            .eligibleForAutomaticWorkVolume ===
            true
        ),

      sourceDocument,

      sourceSheet,

      sourceRow:
        rowIndex + 1,

      headerRow:
        header.sourceRow,

      headerConfidence:
        header.confidence,

      taxonomy,

      decisionStatus:
        'requires-review',

      requiresEngineerConfirmation:
        true
    });

    if (
      candidates.length >=
      500
    ) {
      break;
    }
  }
  const rowTypeCounts =
    getWorkVolumeRowTypeCounts(
      candidates
    );

  const automaticWorkVolumeCandidatesCount =
    candidates.filter(
      function (candidate) {
        return (
          candidate
            .automaticWorkVolumeAllowed ===
          true
        );
      }
    ).length;
  
  return {
    success:
      candidates.length > 0,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

        sourceDocument,

    sourceSheet,

    tableClassification,

    rowTypeCounts,

    automaticWorkVolumeCandidatesCount,

    header: {
      sourceRow:
        header.sourceRow,

      workColumn:
        header.workColumn,

      unitColumn:
        header.unitColumn,

      quantityColumn:
        header.quantityColumn,

      startDateColumn:
        header.startDateColumn,

      finishDateColumn:
        header.finishDateColumn,

      score:
        header.score,

      confidence:
        header.confidence
    },

    candidates,

    candidatesCount:
      candidates.length,

    requiresEngineerConfirmation:
      true
  };
}


function getWorkVolumeSheetRows(
  worksheet
) {
  if (
    !window.XLSX ||
    !window.XLSX.utils ||
    typeof window.XLSX.utils
      .sheet_to_json !==
      'function'
  ) {
    throw new Error(
      'XLSX_LIBRARY_NOT_AVAILABLE'
    );
  }

  return window.XLSX.utils
    .sheet_to_json(
      worksheet,
      {
        header: 1,
        raw: true,
        defval: '',
        blankrows: false
      }
    );
}


function analyzeWorkVolumeWorkbook(
  workbook,
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const sourceDocument =
    settings.sourceDocument ||
    '';

  if (
    !workbook ||
    !Array.isArray(
      workbook.SheetNames
    ) ||
    !workbook.Sheets
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_WORKBOOK_INVALID',

      errorMessage:
        'Структура Excel-книги не распознана.',

      sourceDocument,

      sheets: [],

      candidates: [],

      candidatesCount: 0,

      requiresEngineerConfirmation:
        true
    };
  }

  const sheets = [];

  const candidates = [];

  workbook.SheetNames.forEach(
    function (sheetName) {
      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      if (!worksheet) {
        return;
      }

      const rows =
        getWorkVolumeSheetRows(
          worksheet
        );

      const result =
        analyzeWorkVolumeRows(
          rows,
          {
            sourceDocument,

            sourceSheet:
              sheetName
          }
        );

      sheets.push({
        sheetName,

        success:
          result.success,

        errorCode:
          result.errorCode ||
          null,

               header:
          result.header ||
          null,

                tableClassification:
          result.tableClassification ||
          null,

        rowTypeCounts:
          result.rowTypeCounts ||
          null,

        automaticWorkVolumeCandidatesCount:
          result
            .automaticWorkVolumeCandidatesCount ||
          0,

        candidatesCount:
          result.candidatesCount ||
          0
      });

      if (
        Array.isArray(
          result.candidates
        )
      ) {
        candidates.push(
          ...result.candidates
        );
      }
    }
  );

  return {
    success:
      candidates.length > 0,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    sourceDocument,

    sheets,

    candidates,

    candidatesCount:
      candidates.length,

    requiresEngineerConfirmation:
      true
  };
}


async function analyzeWorkVolumeFile(
  file
) {
  if (!file) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_NOT_FOUND',

      errorMessage:
        'Файл для анализа не передан.',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  const extension =
    getWorkVolumeFileExtension(
      file
    );

  if (
    !WORK_VOLUME_SUPPORTED_EXTENSIONS
      .includes(extension)
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_TYPE_NOT_SUPPORTED',

      errorMessage:
        'Поддерживаются XLSX, XLS и CSV.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  if (
    !window.XLSX ||
    typeof window.XLSX.read !==
      'function'
  ) {
    return {
      success: false,

      errorCode:
        'XLSX_LIBRARY_NOT_AVAILABLE',

      errorMessage:
        'Excel-библиотека XLSX не загружена.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  try {
    const arrayBuffer =
      await file.arrayBuffer();

    const workbook =
      window.XLSX.read(
        arrayBuffer,
        {
          type: 'array',
          cellDates: true
        }
      );

    return analyzeWorkVolumeWorkbook(
      workbook,
      {
        sourceDocument:
          file.name ||
          ''
      }
    );
  } catch (error) {
    console.error(
      'Ошибка анализа ВОР / Excel:',
      error
    );

    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_READ_ERROR',

      errorMessage:
        'Не удалось прочитать табличный документ.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }
}


async function analyzeWorkVolumeDocument(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_DOCUMENT_NOT_FOUND',

      errorMessage:
        'Документ для анализа не передан.',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  return analyzeWorkVolumeFile(
    documentItem.file
  );
}


function tokenizeWorkVolumeText(
  value
) {
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

  return normalizeWorkVolumeText(
    value
  )
    .split(
      /[^а-яa-z0-9-]+/iu
    )
    .filter(
      function (word) {
        return (
          word.length >= 3 &&
          !stopWords.has(
            word
          )
        );
      }
    );
}


function getWorkVolumeRoot(
  word
) {
  const normalized =
    normalizeWorkVolumeText(
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

  return ending
    ? normalized.slice(
        0,
        -ending.length
      )
    : normalized;
}


function getWorkVolumeRoots(
  value
) {
  return tokenizeWorkVolumeText(
    value
  ).map(
    getWorkVolumeRoot
  );
}


function workVolumeRootsMatch(
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


function calculateWorkVolumeTextMatch(
  workName,
  candidateWorkName
) {
  const workRoots =
    Array.from(
      new Set(
        getWorkVolumeRoots(
          workName
        )
      )
    );

  const candidateRoots =
    Array.from(
      new Set(
        getWorkVolumeRoots(
          candidateWorkName
        )
      )
    );

  if (
    workRoots.length === 0
  ) {
    return {
      score: 0,
      coverage: 0,
      matchedRoots: []
    };
  }

  const matchedRoots =
    workRoots.filter(
      function (workRoot) {
        return candidateRoots.some(
          function (
            candidateRoot
          ) {
            return workVolumeRootsMatch(
              workRoot,
              candidateRoot
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

    coverage,

    matchedRoots
  };
}


function getWorkVolumeProjectDocuments() {
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


function getWorkVolumeActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window
      .BuildMindWorkContexts
      .getActive ===
      'function'
  ) {
    return window
      .BuildMindWorkContexts
      .getActive();
  }

  return null;
}


async function findBuildMindWorkVolume(
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
    getWorkVolumeActiveContext();

  if (
    !context ||
    !context.work
  ) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.',

      requiresEngineerConfirmation:
        true
    };
  }

  const documents =
    Array.isArray(
      settings.documents
    )
      ? settings.documents
      : getWorkVolumeProjectDocuments();

  const tableDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.file &&

          WORK_VOLUME_SUPPORTED_EXTENSIONS
            .includes(
              getWorkVolumeFileExtension(
                documentItem.file
              )
            )
        );
      }
    );

  if (
    tableDocuments.length ===
    0
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_DOCUMENTS_NOT_FOUND',

      errorMessage:
        'Среди загруженных документов нет XLSX, XLS или CSV.',

      context,

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  const documentsAnalysis = [];

  for (
    let index = 0;
    index <
      tableDocuments.length;
    index += 1
  ) {
    const documentItem =
      tableDocuments[index];

    const result =
      await analyzeWorkVolumeDocument(
        documentItem
      );

    documentsAnalysis.push({
      sourceDocument:
        documentItem.file.name,

      success:
        result.success,

      errorCode:
        result.errorCode ||
        null,

      candidatesCount:
        result.candidatesCount ||
        0
    });

    if (
      !Array.isArray(
        result.candidates
      )
    ) {
      continue;
    }

    result.candidates.forEach(
      function (candidate) {
        const match =
          calculateWorkVolumeTextMatch(
            context.work,
            candidate.workName
          );

        const contextScore =
          Math.round(
            match.coverage *
            100
          );

        candidates.push({
          ...candidate,

          contextScore,

          matchedRoots:
            match.matchedRoots,

          workCoverage:
            match.coverage,

          eligibleForWorkVolume:
            Boolean(
              candidate
                .automaticWorkVolumeAllowed ===
                true &&
              contextScore >= 55
            )
        });
      }
    );
  }

  candidates.sort(
    function (
      first,
      second
    ) {
      return (
        second.contextScore -
        first.contextScore
      );
    }
  );

  const eligibleCandidates =
    candidates.filter(
      function (candidate) {
        return (
          candidate
            .eligibleForWorkVolume ===
          true
        );
      }
    );

  const bestCandidate =
    eligibleCandidates[0];

  if (
    !bestCandidate ||
    bestCandidate.contextScore <
      70
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_NOT_CONFIDENT',

      errorMessage:
        'Надёжная строка ВОР для активной работы не найдена.',

      context,

      documentsAnalysis,

      candidates:
        candidates.slice(
          0,
          20
        ),

      eligibleCandidates:
        eligibleCandidates.slice(
          0,
          20
        ),

      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    context: {
      ...context
    },

    workName:
      bestCandidate.workName,

    quantity:
      bestCandidate.quantity,

    unit:
      bestCandidate.unit,

        sourceType:
      bestCandidate.sourceType,

    tableType:
      bestCandidate.tableType,

    tableLabel:
      bestCandidate.tableLabel,

    tableConfidence:
      bestCandidate.tableConfidence,

    sourceDocument:
      bestCandidate.sourceDocument,

    sourceSheet:
      bestCandidate.sourceSheet,

    sourceRow:
      bestCandidate.sourceRow,

    headerRow:
      bestCandidate.headerRow,

    score:
      bestCandidate.contextScore,

    confidence:
      bestCandidate.contextScore >=
        85
        ? {
            level: 'high',
            label: 'Высокая'
          }
        : {
            level: 'medium',
            label: 'Средняя'
          },

    matchedRoots:
      bestCandidate.matchedRoots,

    workCoverage:
      bestCandidate.workCoverage,

    taxonomy:
      bestCandidate.taxonomy,

    alternatives:
      eligibleCandidates.slice(
        1,
        6
      ),

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      'requires-review',

    disclaimer:
      'Объём извлечён автоматически из табличного документа. ' +
      'Рекомендуется проверить название работы, единицу, количество, ' +
      'лист и строку-источник перед использованием в планировании.'
  };
}


function testBuildMindWorkVolumeRows(
  rows,
  options
) {
  return analyzeWorkVolumeRows(
    rows,
    {
      sourceDocument:
        'DEMO-WORK-VOLUME.xlsx',

      sourceSheet:
        'ВОР',

      ...(options || {})
    }
  );
}


function getBuildMindWorkVolumeSummary() {
  const documents =
    getWorkVolumeProjectDocuments();

  const tableDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.file &&

          WORK_VOLUME_SUPPORTED_EXTENSIONS
            .includes(
              getWorkVolumeFileExtension(
                documentItem.file
              )
            )
        );
      }
    );

  return {
    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    excelLibraryAvailable:
      Boolean(
        window.XLSX &&
        typeof window.XLSX.read ===
          'function'
      ),

    projectDocuments:
      documents.length,

    tableDocuments:
      tableDocuments.length
  };
}


window.BuildMindWorkVolume = {
  version:
    BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

  classifyRows:
    classifyWorkVolumeTable,

  classifyCandidate:
    classifyWorkVolumeRowCandidate,

  analyzeRows:
    analyzeWorkVolumeRows,

  analyzeWorkbook:
    analyzeWorkVolumeWorkbook,

  analyzeFile:
    analyzeWorkVolumeFile,

  analyzeDocument:
    analyzeWorkVolumeDocument,

  find:
    findBuildMindWorkVolume,

  calculateTextMatch:
    calculateWorkVolumeTextMatch,

  testRows:
    testBuildMindWorkVolumeRows,

  getSummary:
    getBuildMindWorkVolumeSummary
};


console.info(
  'BuildMind Work Volume Engine загружен:',
  getBuildMindWorkVolumeSummary()
);
