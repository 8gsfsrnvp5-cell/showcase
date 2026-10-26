'use strict';

/* ==================================================
   BUILDMIND PDF TABLE ENGINE — V1.3

   Преобразует OCR-слова с координатами в строки,
   извлекает только явно присутствующие позиции ВОР
   и строки ГПР и сохраняет страницу-источник.
   ================================================== */

const BUILDMIND_PDF_TABLE_ENGINE_VERSION =
  'pdf-table-engine-v1.4';

const PDF_TABLE_UNIT_SOURCE =
  '(?:п\\.?\\s*м\\.?|пог\\.?\\s*м\\.?|м[23²³]?|км|шт\\.?|штук|компл\\.?|комплект(?:ов)?|кг|т|л|рул\\.?|рулон)';

const PDF_TABLE_VOLUME_ROW_PATTERN =
  new RegExp(
    '^(?:\\s*(?:№?\\s*)?\\d+(?:[.\\-]\\d+)*[.)]?\\s+)?' +
    '(.{3,240}?)\\s+(' +
    PDF_TABLE_UNIT_SOURCE +
    ')\\s+([+-]?(?:(?:\\d{1,3}(?:\\s\\d{3})+)|\\d+)(?:[.,]\\d+)?)' +
    '(?=\\s|$|[;:])',
    'iu'
  );

const PDF_TABLE_DATE_PATTERN =
  /(?:^|[^\d])(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?!\d)/g;

const PDF_TABLE_WORK_PREFIXES = [
  'устройство ',
  'монтаж ',
  'демонтаж ',
  'прокладка ',
  'укладка ',
  'установка ',
  'разработка грунта',
  'обратная засыпка',
  'засыпка ',
  'уплотнение ',
  'фрезерование ',
  'разборка ',
  'восстановление ',
  'нанесение ',
  'ремонт ',
  'планировка ',
  'перевозка '
];

const PDF_TABLE_MATERIAL_PREFIXES = [
  'бетон ',
  'цемент ',
  'песок ',
  'щебень ',
  'асфальтобетон ',
  'битум ',
  'геотекстиль ',
  'арматура ',
  'сталь ',
  'труба ',
  'кабель ',
  'краска ',
  'грунтовка ',
  'бордюр ',
  'бортовой камень '
];

function normalizePdfTableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPdfTableName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[|\[\]{}()]+\s*/, '')
    .replace(
      /^\s*(?:№?\s*)?\d+(?:[.\-]\d+)*[.)]?\s+/,
      ''
    )
    .replace(/^[|\[\]{}()\-–—;:,\s]+/, '')
    .replace(/[|\[\]{}()\-–—;:,\s]+$/, '')
    .trim();
}

function parsePdfTableNumber(value) {
  const source =
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  if (
    !/^[+-]?(?:(?:\d{1,3}(?: \d{3})+)|\d+)(?:[.,]\d+)?$/.test(
      source
    )
  ) {
    return null;
  }

  const normalized =
    source
      .replace(/\s+/g, '')
      .replace(',', '.');

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

function parsePdfTableNumberPrefix(value) {
  const source =
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const match =
    source.match(
      /^[+-]?(?:(?:\d{1,3}(?: \d{3})+)|\d+)(?:[.,]\d+)?/
    );

  return match
    ? parsePdfTableNumber(match[0])
    : null;
}

function normalizePdfTableUnit(value) {
  const normalized =
    normalizePdfTableText(value)
      .replace(/\s+/g, '')
      .replace(/[|\[\]{}()]/g, '')
      .replace(/[.,;:]+$/, '')
      .toLowerCase();

  const units = {
    м: 'м',
    м2: 'м²',
    'м²': 'м²',
    м3: 'м³',
    'м³': 'м³',
    км: 'км',
    пм: 'п.м.',
    'п.м': 'п.м.',
    погм: 'п.м.',
    'пог.м': 'п.м.',
    шт: 'шт',
    штук: 'шт',
    компл: 'компл.',
    комплект: 'компл.',
    комплектов: 'компл.',
    комплекс: 'компл.',
    комплекса: 'компл.',
    кг: 'кг',
    т: 'т',
    л: 'л',
    рул: 'рул.',
    рулон: 'рул.'
  };

  if (units[normalized]) {
    return units[normalized];
  }

  if (/^[mм]$/.test(normalized)) {
    return 'м';
  }

  if (/^[mм][2²]$/.test(normalized)) {
    return 'м²';
  }

  if (/^[mм][3³]$/.test(normalized)) {
    return 'м³';
  }

  // На русских сканах Tesseract часто принимает «шт»
  // за пары латинских символов wr/wt/mr/mt/ut.
  if (/^(?:wr|wt|mr|mt|ut)$/.test(normalized)) {
    return 'шт';
  }

  if (/^(?:komпл|kompl|компл|комплекс)$/.test(normalized)) {
    return 'компл.';
  }

  return '';
}

function toPdfTableIsoDate(
  day,
  month,
  year
) {
  let numericYear =
    Number(year);

  if (numericYear < 100) {
    numericYear += 2000;
  }

  const numericMonth =
    Number(month);
  const numericDay =
    Number(day);
  const date =
    new Date(
      Date.UTC(
        numericYear,
        numericMonth - 1,
        numericDay
      )
    );

  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function extractPdfTableDates(value) {
  const text =
    String(value || '');
  const dates = [];

  PDF_TABLE_DATE_PATTERN.lastIndex = 0;

  let match = null;

  while (
    (
      match =
        PDF_TABLE_DATE_PATTERN.exec(text)
    ) !== null
  ) {
    const date =
      toPdfTableIsoDate(
        match[1],
        match[2],
        match[3]
      );

    if (date) {
      dates.push({
        value: date,
        index:
          match.index +
          match[0].indexOf(match[1])
      });
    }
  }

  return dates;
}

function getPdfTableDateYear(value) {
  const match =
    /^(\d{4})-\d{2}-\d{2}$/.exec(
      String(value || '')
    );

  return match
    ? Number(match[1])
    : null;
}

function replacePdfTableDateYear(
  value,
  year
) {
  return String(year) +
    String(value || '').slice(4);
}

function getPdfTableScheduleReferenceYear(
  candidates,
  options = {}
) {
  const fileYears =
    (
      String(options.sourceDocument || '')
        .match(/(?:19|20)\d{2}/g) || []
    )
      .map(Number)
      .filter(function (year) {
        return year >= 2000 && year <= 2100;
      });

  return fileYears.length > 0
    ? fileYears[fileYears.length - 1]
    : null;
}

function isPdfTableOcrYearVariant(
  year,
  referenceYear
) {
  const source =
    String(year || '');
  const reference =
    String(referenceYear || '');

  return (
    /^20\d{2}$/.test(source) &&
    /^20\d{2}$/.test(reference) &&
    source !== reference &&
    source.slice(0, 2) === '20' &&
    reference.slice(0, 2) === '20' &&
    source.charAt(3) === reference.charAt(3) &&
    reference.charAt(2) === '2' &&
    ['0', '3'].includes(source.charAt(2))
  );
}

function normalizePdfTableScheduleYears(
  candidates,
  options = {}
) {
  const referenceYear =
    getPdfTableScheduleReferenceYear(
      candidates,
      options
    );

  if (!referenceYear) {
    return Array.isArray(candidates)
      ? candidates
      : [];
  }

  return (
    Array.isArray(candidates)
      ? candidates
      : []
  ).map(function (candidate) {
    if (
      candidate?.sourceType !==
      'pdf-schedule'
    ) {
      return candidate;
    }

    const corrections = [];
    const normalized = {
      ...candidate
    };

    [
      ['startDate', 'start'],
      ['finishDate', 'finish']
    ].forEach(function (setting) {
      const field = setting[0];
      const year =
        getPdfTableDateYear(
          candidate[field]
        );

      if (
        isPdfTableOcrYearVariant(
          year,
          referenceYear
        )
      ) {
        const corrected =
          replacePdfTableDateYear(
            candidate[field],
            referenceYear
          );

        corrections.push({
          field: setting[1],
          from: candidate[field],
          to: corrected
        });

        normalized[field] = corrected;
      }
    });

    if (corrections.length === 0) {
      return candidate;
    }

    return {
      ...normalized,
      originalStartDate:
        candidate.startDate,
      originalFinishDate:
        candidate.finishDate,
      dateCorrections: corrections,
      scheduleReviewRequired: true,
      scheduleReviewReasons: [
        ...(
          Array.isArray(
            candidate.scheduleReviewReasons
          )
            ? candidate.scheduleReviewReasons
            : []
        ),
        'Исправлена только типовая OCR-подмена года; требуется подтверждение инженером.'
      ],
      evidence:
        String(candidate.evidence || '') +
        ' · год OCR нормализован'
    };
  });
}

function isPdfTableHeadingOrTotal(value) {
  const text =
    normalizePdfTableText(value);

  return (
    !text ||
    text.length < 3 ||
    /^(?:наименование|единиц|ед\s*изм|количеств|объем|обьем|начало|окончание|продолжительност)/
      .test(text) ||
    /^(?:итого|всего|в том числе|ндс|раздел|глава)(?:\s|$)/
      .test(text) ||
    /(?:подпись|согласовано|утверждаю|заказчик|подрядчик)\s*$/
      .test(text)
  );
}

function startsWithPdfTablePhrase(
  value,
  phrases
) {
  const text =
    normalizePdfTableText(value);

  return phrases.some(function (phrase) {
    return text.startsWith(phrase);
  });
}

function classifyPdfTableRow(
  name,
  context = {}
) {
  if (
    startsWithPdfTablePhrase(
      name,
      PDF_TABLE_MATERIAL_PREFIXES
    )
  ) {
    return {
      rowType: 'material',
      confidence: 'high',
      evidence:
        'характерное название материала'
    };
  }

  if (
    startsWithPdfTablePhrase(
      name,
      PDF_TABLE_WORK_PREFIXES
    )
  ) {
    return {
      rowType: 'work',
      confidence: 'high',
      evidence:
        'характерное название работы'
    };
  }

  if (context.workTable === true) {
    return {
      rowType: 'work',
      confidence: 'medium',
      evidence:
        'строка внутри подтверждённой ведомости работ'
    };
  }

  return {
    rowType: 'uncertain',
    confidence: 'low',
    evidence:
      'тип строки не подтверждён'
  };
}

function buildPdfTableRowsFromLayoutWords(
  layoutWords
) {
  const words =
    (
      Array.isArray(layoutWords)
        ? layoutWords
        : []
    )
      .map(function (word) {
        const bbox =
          word?.bbox || {};
        const x0 = Number(bbox.x0);
        const y0 = Number(bbox.y0);
        const x1 = Number(bbox.x1);
        const y1 = Number(bbox.y1);
        const text =
          String(word?.text || '')
            .replace(/\s+/g, ' ')
            .trim();

        if (
          !text ||
          ![x0, y0, x1, y1]
            .every(Number.isFinite) ||
          x1 <= x0 ||
          y1 <= y0
        ) {
          return null;
        }

        return {
          text,
          x0,
          y0,
          x1,
          y1,
          height: y1 - y0,
          centerY:
            (y0 + y1) / 2
        };
      })
      .filter(Boolean)
      .sort(function (first, second) {
        return (
          first.centerY - second.centerY ||
          first.x0 - second.x0
        );
      });

  const groups = [];

  words.forEach(function (word) {
    const tolerance =
      Math.max(
        5,
        word.height * 0.65
      );
    const group =
      groups.find(function (item) {
        return Math.abs(
          item.centerY - word.centerY
        ) <= tolerance;
      });

    if (group) {
      group.words.push(word);
      group.centerY =
        group.words.reduce(
          function (sum, item) {
            return sum + item.centerY;
          },
          0
        ) / group.words.length;
      return;
    }

    groups.push({
      centerY: word.centerY,
      words: [word]
    });
  });

  return groups
    .sort(function (first, second) {
      return first.centerY - second.centerY;
    })
    .map(function (group, index) {
      const lineWords =
        group.words.sort(function (
          first,
          second
        ) {
          return first.x0 - second.x0;
        });

      let text = '';
      let previous = null;
      let currentCell = '';
      const cells = [];

      lineWords.forEach(function (word) {
        if (previous) {
          const gap =
            word.x0 - previous.x1;
          const largeGap =
            Math.max(
              18,
              Math.max(
                word.height,
                previous.height
              ) * 1.8
            );

          text +=
            gap > largeGap
              ? '\t'
              : ' ';

          if (gap > largeGap) {
            if (currentCell.trim()) {
              cells.push(
                currentCell.trim()
              );
            }

            currentCell = '';
          } else {
            currentCell += ' ';
          }
        }

        text += word.text;
        currentCell += word.text;
        previous = word;
      });

      if (currentCell.trim()) {
        cells.push(
          currentCell.trim()
        );
      }

      return {
        text:
          text.replace(/\s+/g, ' ').trim(),
        sourceRow: index + 1,
        sourceMethod: 'layout',
        cells
      };
    })
    .filter(function (row) {
      return row.text;
    });
}

function getPdfTablePageRows(page) {
  const layoutRows =
    buildPdfTableRowsFromLayoutWords(
      page?.layoutWords
    );
  const textRows =
    String(page?.text || '')
      .split(/\r?\n/)
      .map(function (line, index) {
        return {
          text:
            line.replace(/\s+/g, ' ').trim(),
          sourceRow: index + 1,
          sourceMethod: 'text'
        };
      })
      .filter(function (row) {
        return row.text;
      });
  const seen = new Set();

  return [
    ...layoutRows,
    ...textRows
  ].filter(function (row) {
    const key =
      normalizePdfTableText(row.text);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getPdfTableLayoutWords(
  layoutWords
) {
  return (
    Array.isArray(layoutWords)
      ? layoutWords
      : []
  )
    .map(function (word) {
      const bbox =
        word?.bbox || {};
      const x0 = Number(bbox.x0);
      const y0 = Number(bbox.y0);
      const x1 = Number(bbox.x1);
      const y1 = Number(bbox.y1);
      const text =
        String(word?.text || '')
          .replace(/\s+/g, ' ')
          .trim();

      if (
        !text ||
        ![x0, y0, x1, y1]
          .every(Number.isFinite) ||
        x1 <= x0 ||
        y1 <= y0
      ) {
        return null;
      }

      return {
        text,
        x0,
        y0,
        x1,
        y1,
        height: y1 - y0,
        centerY:
          (y0 + y1) / 2
      };
    })
    .filter(Boolean)
    .sort(function (first, second) {
      return first.centerY - second.centerY ||
        first.x0 - second.x0;
    });
}

function groupPdfTableLayoutWordsByLine(
  words
) {
  const groups = [];

  (Array.isArray(words) ? words : [])
    .forEach(function (word) {
      const tolerance =
        Math.max(
          7,
          Number(word?.height || 0) * 0.85
        );
      const group =
        groups.find(function (item) {
          return Math.abs(
            item.centerY - word.centerY
          ) <= tolerance;
        });

      if (!group) {
        groups.push({
          centerY: word.centerY,
          words: [word]
        });
        return;
      }

      group.words.push(word);
      group.centerY =
        group.words.reduce(
          function (sum, item) {
            return sum + item.centerY;
          },
          0
        ) / group.words.length;
    });

  return groups
    .sort(function (first, second) {
      return first.centerY - second.centerY;
    });
}

function getPdfTableGridBoundaries(
  context
) {
  return context?.schedule
    ? [0, 0.07, 0.57, 0.65, 0.77, 0.89, 1.001]
    : [0, 0.07, 0.58, 0.66, 0.75, 0.87, 1.001];
}

function buildPdfTableGridRows(
  layoutWords,
  context = {}
) {
  const words =
    getPdfTableLayoutWords(
      layoutWords
    );

  if (words.length < 6) {
    return [];
  }

  const minX =
    Math.min(
      ...words.map(function (word) {
        return word.x0;
      })
    );
  const maxX =
    Math.max(
      ...words.map(function (word) {
        return word.x1;
      })
    );
  const width =
    maxX - minX;

  if (!Number.isFinite(width) || width < 120) {
    return [];
  }

  const boundaries =
    getPdfTableGridBoundaries(context)
      .map(function (ratio) {
        return minX + width * ratio;
      });

  return groupPdfTableLayoutWordsByLine(
    words
  ).map(function (group, index) {
    const cells =
      boundaries
        .slice(0, -1)
        .map(function (_, cellIndex) {
          const left =
            boundaries[cellIndex];
          const right =
            boundaries[cellIndex + 1];

          return group.words
            .filter(function (word) {
              const centerX =
                (word.x0 + word.x1) / 2;

              return centerX >= left &&
                centerX < right;
            })
            .sort(function (first, second) {
              return first.x0 - second.x0;
            })
            .map(function (word) {
              return word.text;
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        });

    return {
      cells,
      text:
        cells
          .filter(Boolean)
          .join(' | '),
      sourceRow: index + 1,
      sourceMethod: 'structured-grid'
    };
  }).filter(function (row) {
    return row.text;
  });
}

function hasPdfTableGridWorkName(
  value
) {
  const workName =
    cleanPdfTableName(value);
  const normalized =
    normalizePdfTableText(workName);

  return Boolean(
    workName &&
    workName.length >= 3 &&
    workName.length <= 240 &&
    /[а-яёa-z]/iu.test(workName) &&
    !isPdfTableHeadingOrTotal(normalized)
  );
}

function extractPdfTableWorkCode(cells) {
  const source =
    (Array.isArray(cells) ? cells : [])
      .slice(0, 2)
      .join(' ')
      .replace(/[|\[\]{}()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const match =
    source.match(
      /(?:^|\s)(\d{1,3}(?:[.,]\d{1,3}){0,3})(?=\s|$)/
    );

  return match
    ? match[1].replace(/,/g, '.')
    : '';
}

function parsePdfTableGridUnitAndQuantity(
  unitCell,
  quantityCell
) {
  const rawUnit =
    String(unitCell || '')
      .replace(/[|\[\]{}()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const rawQuantity =
    String(quantityCell || '')
      .replace(/[|\[\]{}()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const unitMatch =
    rawUnit.match(
      /^([^\s]+?)(?:\s+(\d{1,3}))?$/u
    );
  const unit =
    normalizePdfTableUnit(
      unitMatch?.[1] || rawUnit
    );
  const carriedDigits =
    unit && unitMatch?.[2]
      ? unitMatch[2]
      : '';
  let quantity =
    parsePdfTableNumberPrefix(
      rawQuantity
    );

  if (carriedDigits && rawQuantity) {
    const combined =
      parsePdfTableNumberPrefix(
        carriedDigits + ' ' + rawQuantity
      );

    if (combined !== null) {
      quantity = combined;
    }
  }

  return {
    unit,
    quantity,
    unitReviewRequired: !unit
  };
}

function inferPdfTableUnitFromWorkName(value) {
  const name =
    normalizePdfTableText(value);

  if (
    /(?:перевозк|отход|утилизац)/.test(name) &&
    /(?:грунт|мусор)/.test(name)
  ) {
    return 'т';
  }

  if (
    /(?:протяжк|прокладк|демонтаж|вытянуть)/.test(name) &&
    /кабел/.test(name)
  ) {
    return 'м';
  }

  return '';
}

function extractPdfTableGridDate(value) {
  const source =
    String(value || '');
  const extracted =
    extractPdfTableDates(source)[0]
      ?.value || '';

  if (extracted) {
    return extracted;
  }

  const digits =
    source.replace(/\D/g, '');

  if (digits.length !== 8) {
    return '';
  }

  return toPdfTableIsoDate(
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4)
  ) || '';
}

function parsePdfTableGridVolumeRow(
  row,
  context = {}
) {
  const cells =
    Array.isArray(row?.cells)
      ? row.cells
      : [];
  const workName =
    cleanPdfTableName(cells[1] || '');
  const workCode =
    extractPdfTableWorkCode(cells);
  const parsedMeasure =
    parsePdfTableGridUnitAndQuantity(
      cells[2] || '',
      cells[3] || ''
    );
  const inferredUnit =
    parsedMeasure.unit
      ? ''
      : inferPdfTableUnitFromWorkName(
          workName
        );
  const unit =
    parsedMeasure.unit || inferredUnit;
  const quantity = parsedMeasure.quantity;

  if (
    !hasPdfTableGridWorkName(workName) ||
    (/^\d+$/.test(workCode) && !unit) ||
    quantity === null ||
    quantity <= 0
  ) {
    return null;
  }

  return {
    workCode,
    workName,
    unit,
    quantity,
    ...classifyPdfTableRow(
      workName,
      context
    ),
    confidence:
      unit ? 'high' : 'medium',
    measureReviewRequired:
      parsedMeasure.unitReviewRequired,
    unitInferredFromWorkName:
      Boolean(inferredUnit),
    evidence:
      unit && !inferredUnit
        ? 'строка ВОР по координатной сетке таблицы'
        : 'строка ВОР: единица измерения восстановлена или требует проверки'
  };
}

function parsePdfTableGridScheduleRow(
  row
) {
  const cells =
    Array.isArray(row?.cells)
      ? row.cells
      : [];
  const workName =
    cleanPdfTableName(cells[1] || '');
  const workCode =
    extractPdfTableWorkCode(cells);
  const parsedMeasure =
    parsePdfTableGridUnitAndQuantity(
      cells[2] || '',
      cells[3] || ''
    );
  const inferredUnit =
    parsedMeasure.unit
      ? ''
      : inferPdfTableUnitFromWorkName(
          workName
        );
  const unit =
    parsedMeasure.unit || inferredUnit;
  const quantity = parsedMeasure.quantity;
  const startDate =
    extractPdfTableGridDate(
      cells[4] || ''
    );
  const finishDate =
    extractPdfTableGridDate(
      cells[5] || ''
    );

  if (
    !hasPdfTableGridWorkName(workName) ||
    (/^\d+$/.test(workCode) && !unit) ||
    quantity === null ||
    quantity <= 0 ||
    (!startDate && !finishDate)
  ) {
    return null;
  }

  return {
    workCode,
    workName,
    unit,
    quantity,
    startDate,
    finishDate,
    rowType: 'work',
    confidence:
      unit && !inferredUnit &&
        startDate && finishDate
        ? 'high'
        : 'medium',
    measureReviewRequired:
      parsedMeasure.unitReviewRequired,
    unitInferredFromWorkName:
      Boolean(inferredUnit),
    scheduleReviewRequired:
      !startDate || !finishDate,
    scheduleReviewReasons:
      !startDate || !finishDate
        ? ['В строке ГПР распознана только одна из двух дат.']
        : [],
    evidence:
      unit && !inferredUnit &&
        startDate && finishDate
        ? 'строка ГПР по координатной сетке таблицы'
        : 'строка ГПР требует проверки единицы измерения или даты'
  };
}

function extractPdfTableStructuredGridCandidates(
  page,
  context,
  sourceDocument
) {
  const rows =
    buildPdfTableGridRows(
      page?.layoutWords,
      context
    );
  const seen = new Set();
  let scheduleDefaults = null;

  return rows.reduce(function (
    result,
    row
  ) {
      if (context?.schedule) {
        const cells =
          Array.isArray(row?.cells)
            ? row.cells
            : [];
        const rowCode =
          extractPdfTableWorkCode(cells);
        const rowStart =
          extractPdfTableGridDate(
            cells[4] || ''
          );
        const rowFinish =
          extractPdfTableGridDate(
            cells[5] || ''
          );

        if (
          rowCode &&
          (rowStart || rowFinish) &&
          rowCode.split('.').length <= 2
        ) {
          scheduleDefaults = {
            workCode: rowCode,
            startDate: rowStart,
            finishDate: rowFinish
          };
        }
      }

      let parsed =
        context?.schedule
          ? parsePdfTableGridScheduleRow(row)
          : context?.workTable
            ? parsePdfTableGridVolumeRow(
                row,
                context
              )
            : null;

      if (!parsed) {
        return result;
      }

      if (
        context?.schedule &&
        scheduleDefaults?.workCode &&
        parsed.workCode &&
        parsed.workCode.startsWith(
          scheduleDefaults.workCode + '.'
        ) &&
        (!parsed.startDate || !parsed.finishDate)
      ) {
        const inheritedStart =
          parsed.startDate ||
          scheduleDefaults.startDate || '';
        const inheritedFinish =
          parsed.finishDate ||
          scheduleDefaults.finishDate || '';

        parsed = {
          ...parsed,
          startDate: inheritedStart,
          finishDate: inheritedFinish,
          confidence: 'medium',
          scheduleReviewRequired: true,
          scheduleReviewReasons: [
            ...(
              Array.isArray(
                parsed.scheduleReviewReasons
              )
                ? parsed.scheduleReviewReasons
                : []
            ),
            'Одна дата восстановлена из диапазона родительского раздела ГПР.'
          ],
          evidence:
            String(parsed.evidence || '') +
            ' · дата из родительского раздела'
        };
      }

      const candidate = {
        ...parsed,
        pageNumber:
          Number(page?.pageNumber) || null,
        pageNumbers: [
          Number(page?.pageNumber) || null
        ].filter(Boolean),
        sourceDocument,
        sourceRow:
          row.sourceRow || null,
        sourceText:
          String(row.text || '')
            .slice(0, 320),
        sourceType:
          context?.schedule
            ? 'pdf-schedule'
            : 'pdf-work-volume',
        sectionId:
          context?.section?.id || null,
        sectionKind:
          context?.section?.kind || null,
        requiresEngineerConfirmation: true,
        decisionStatus: 'requires-review'
      };
      const key =
        getPdfTableCandidateKey(candidate);

      if (seen.has(key)) {
        return result;
      }

      seen.add(key);
      result.push(candidate);
      return result;
    }, []);
}

function parsePdfTableVolumeRow(
  value,
  context = {}
) {
  const source =
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  const match =
    source.match(
      PDF_TABLE_VOLUME_ROW_PATTERN
    );

  if (!match) {
    return null;
  }

  const workName =
    cleanPdfTableName(match[1]);
  const unit =
    normalizePdfTableUnit(match[2]);
  const quantity =
    parsePdfTableNumber(match[3]);

  if (
    !workName ||
    workName.length < 3 ||
    workName.length > 240 ||
    !unit ||
    quantity === null ||
    quantity <= 0 ||
    isPdfTableHeadingOrTotal(workName)
  ) {
    return null;
  }

  return {
    workName,
    unit,
    quantity,
    ...classifyPdfTableRow(
      workName,
      context
    )
  };
}

function parsePdfTableLayoutVolumeRow(
  row,
  context = {}
) {
  const cells =
    (
      Array.isArray(row?.cells)
        ? row.cells
        : []
    )
      .map(function (cell) {
        return String(cell || '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(Boolean);

  if (cells.length < 3) {
    return null;
  }

  for (
    let unitIndex = 1;
    unitIndex < cells.length - 1;
    unitIndex += 1
  ) {
    const unit =
      normalizePdfTableUnit(
        cells[unitIndex]
      );

    if (!unit) {
      continue;
    }

    const quantity =
      parsePdfTableNumber(
        cells[unitIndex + 1]
      );
    const workName =
      cleanPdfTableName(
        cells
          .slice(0, unitIndex)
          .join(' ')
      );

    if (
      quantity === null ||
      quantity <= 0 ||
      !workName ||
      workName.length < 3 ||
      workName.length > 240 ||
      isPdfTableHeadingOrTotal(
        workName
      )
    ) {
      continue;
    }

    return {
      workName,
      unit,
      quantity,
      ...classifyPdfTableRow(
        workName,
        context
      )
    };
  }

  return null;
}

function parsePdfTableScheduleRow(value) {
  const source =
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  const dates =
    extractPdfTableDates(source);

  if (dates.length < 2) {
    return null;
  }

  const workName =
    cleanPdfTableName(
      source.slice(
        0,
        dates[0].index
      )
    );

  if (
    !workName ||
    workName.length < 3 ||
    isPdfTableHeadingOrTotal(workName)
  ) {
    return null;
  }

  return {
    workName,
    unit: '',
    quantity: null,
    startDate: dates[0].value,
    finishDate: dates[1].value,
    rowType: 'work',
    confidence: 'medium',
    evidence:
      'строка подтверждённого ГПР с парой дат'
  };
}

function getPdfTableSectionContext(
  section,
  pages
) {
  const pageNumbers =
    new Set(
      Array.isArray(section?.pageNumbers)
        ? section.pageNumbers
        : []
    );
  const text =
    normalizePdfTableText(
      pages
        .filter(function (page) {
          return pageNumbers.has(
            Number(page?.pageNumber)
          );
        })
        .map(function (page) {
          return page?.text || '';
        })
        .join(' ')
    );
  const workTable =
    section?.kind === 'work-volume' ||
    (
      Array.isArray(
        section?.secondaryKinds
      ) &&
      section.secondaryKinds.includes(
        'work-volume'
      )
    ) ||
    /ведомост[а-я]*\s+(?:объем|обьем)[а-я]*(?:\s+и\s+стоимост[а-я]*)?\s+работ[а-я]*/
      .test(text) ||
    (
      /наименовани[а-я]*\s+работ[а-я]*/
        .test(text) &&
      /ед\s*изм|единиц[а-я]*\s+измерени[а-я]*/
        .test(text) &&
      /количеств[а-я]*|объем[а-я]*|обьем[а-я]*/
        .test(text)
    );

  return {
    section,
    pageNumbers,
    schedule:
      section?.kind === 'schedule',
    workTable
  };
}

function getPdfTableCandidateKey(
  candidate
) {
  return [
    candidate?.workCode || '',
    normalizePdfTableText(
      candidate?.workName
    ),
    candidate?.unit || '',
    candidate?.quantity ?? '',
    candidate?.startDate || '',
    candidate?.finishDate || '',
    candidate?.pageNumber || ''
  ].join('|');
}

function extractPdfTablePageCandidates(
  page,
  context,
  sourceDocument
) {
  const structuredCandidates =
    extractPdfTableStructuredGridCandidates(
      page,
      context,
      sourceDocument
    );

  if (structuredCandidates.length > 0) {
    return structuredCandidates;
  }

  const rows =
    getPdfTablePageRows(page);
  const candidates = [];
  const seen = new Set();
  let consumedThrough = -1;

  rows.forEach(function (_, startIndex) {
    if (startIndex <= consumedThrough) {
      return;
    }

    for (
      let span = 1;
      span <= 4 &&
      startIndex + span <= rows.length;
      span += 1
    ) {
      const sourceText =
        rows
          .slice(
            startIndex,
            startIndex + span
          )
          .map(function (row) {
            return row.text;
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

      if (
        !sourceText ||
        sourceText.length > 360
      ) {
        continue;
      }

      let parsed = null;

      if (context.schedule) {
        parsed =
          parsePdfTableScheduleRow(
            sourceText
          );
      }

      if (
        !parsed &&
        context.workTable
      ) {
        if (
          span === 1 &&
          rows[startIndex]
            ?.sourceMethod === 'layout'
        ) {
          parsed =
            parsePdfTableLayoutVolumeRow(
              rows[startIndex],
              context
            );
        }

        if (!parsed) {
          parsed =
            parsePdfTableVolumeRow(
              sourceText,
              context
            );
        }
      }

      if (!parsed) {
        continue;
      }

      const candidate = {
        ...parsed,
        pageNumber:
          Number(page?.pageNumber) || null,
        pageNumbers: [
          Number(page?.pageNumber) || null
        ].filter(Boolean),
        sourceDocument,
        sourceRow:
          rows[startIndex]
            ?.sourceRow ||
          startIndex + 1,
        sourceText:
          sourceText.slice(0, 320),
        sourceType:
          context.schedule
            ? 'pdf-schedule'
            : 'pdf-work-volume',
        sectionId:
          context.section?.id || null,
        sectionKind:
          context.section?.kind || null,
        requiresEngineerConfirmation:
          true,
        decisionStatus:
          'requires-review'
      };
      const key =
        getPdfTableCandidateKey(
          candidate
        );

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(candidate);

      // Одна физическая строка таблицы может быть перенесена
      // на несколько OCR-строк. Берём первое (самое короткое)
      // успешное окно и не склеиваем его с соседней позицией.
      consumedThrough =
        startIndex + span - 1;
      break;
    }
  });

  return candidates;
}

function deduplicatePdfTableCandidates(
  candidates
) {
  const seen = new Set();

  return (
    Array.isArray(candidates)
      ? candidates
      : []
  ).filter(function (candidate) {
    const key =
      getPdfTableCandidateKey(
        candidate
      );

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function mergePdfTableWorks(candidates) {
  const source =
    deduplicatePdfTableCandidates(
      candidates
    );

  // Строка координатной таблицы ГПР уже содержит и объём,
  // и даты. Прежняя логика дважды включала такую строку:
  // сначала как ВОР, затем как ГПР. Здесь каждая физическая
  // строка остаётся одной записью; междокументное сопоставление
  // выполняется позже по коду, названию и источнику.
  return source
    .filter(function (item) {
      return item.rowType === 'work';
    })
    .map(function (item) {
      return {
        ...item,
        sourceTypes:
          Array.from(
            new Set([
              ...(
                Array.isArray(item.sourceTypes)
                  ? item.sourceTypes
                  : []
              ),
              item.sourceType
            ].filter(Boolean))
          )
      };
    });
}

function analyzePdfTablePages(
  pages,
  sections,
  options = {}
) {
  const sourcePages =
    Array.isArray(pages)
      ? pages
      : [];
  const sourceSections =
    Array.isArray(sections)
      ? sections
      : [];
  const sourceDocument =
    String(options.sourceDocument || '');
  const contexts =
    sourceSections
      .map(function (section) {
        return getPdfTableSectionContext(
          section,
          sourcePages
        );
      })
      .filter(function (context) {
        return (
          context.schedule ||
          context.workTable
        );
      });
  const contextSections =
    contexts.map(function (context) {
      return {
        sectionId:
          context.section?.id || null,
        sectionKind:
          context.section?.kind || null,
        schedule:
          context.schedule,
        workTable:
          context.workTable,
        pageNumbers:
          Array.from(
            context.pageNumbers
          ).sort(function (first, second) {
            return first - second;
          })
      };
    });
  const pagesConsidered =
    Array.from(
      new Set(
        contextSections.flatMap(
          function (context) {
            return context.pageNumbers;
          }
        )
      )
    ).sort(function (first, second) {
      return first - second;
    });
  const candidates = [];

  contexts.forEach(function (context) {
    sourcePages
      .filter(function (page) {
        return context.pageNumbers.has(
          Number(page?.pageNumber)
        );
      })
      .forEach(function (page) {
        candidates.push(
          ...extractPdfTablePageCandidates(
            page,
            context,
            sourceDocument
          )
        );
      });
  });

  const uniqueCandidates =
    deduplicatePdfTableCandidates(
      candidates
    );
  const normalizedCandidates =
    normalizePdfTableScheduleYears(
      uniqueCandidates,
      {
        sourceDocument
      }
    );
  const works =
    mergePdfTableWorks(
      normalizedCandidates
    );
  const materials =
    normalizedCandidates.filter(function (item) {
      return item.rowType === 'material';
    });
  const uncertain =
    normalizedCandidates.filter(function (item) {
      return item.rowType === 'uncertain';
    });

  return {
    success:
      works.length > 0 ||
      materials.length > 0,
    version:
      BUILDMIND_PDF_TABLE_ENGINE_VERSION,
    sourceDocument,
    sectionsReceived:
      sourceSections.length,
    contextsAnalyzed:
      contextSections.length,
    contextSections,
    pagesConsidered,
    candidateRowsCount:
      normalizedCandidates.length,
    works,
    materials,
    uncertain,
    candidates:
      normalizedCandidates,
    pagesAnalyzed:
      Array.from(
        new Set(
          uniqueCandidates
            .map(function (item) {
              return item.pageNumber;
            })
            .filter(Boolean)
        )
      ).sort(function (first, second) {
        return first - second;
      }),
    requiresEngineerConfirmation:
      true
  };
}

const BuildMindPdfTableApi = {
  version:
    BUILDMIND_PDF_TABLE_ENGINE_VERSION,
  buildRowsFromLayoutWords:
    buildPdfTableRowsFromLayoutWords,
  buildGridRows:
    buildPdfTableGridRows,
  parseVolumeRow:
    parsePdfTableVolumeRow,
  parseLayoutVolumeRow:
    parsePdfTableLayoutVolumeRow,
  parseScheduleRow:
    parsePdfTableScheduleRow,
  normalizeScheduleYears:
    normalizePdfTableScheduleYears,
  analyzePages:
    analyzePdfTablePages
};

if (typeof window !== 'undefined') {
  window.BuildMindPdfTable =
    BuildMindPdfTableApi;
}

if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports =
    BuildMindPdfTableApi;
}
