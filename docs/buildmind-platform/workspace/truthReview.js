'use strict';

/* ==================================================
   BUILDMIND TRUTH REVIEW — V1

   Реализация BUILD_MIND_TRUTH_CONTRACT.md для экрана
   анализа: каждое значение ВОР/ГПР/материалов
   получает источник и статус достоверности,
   спорные значения попадают в очередь «Спорные
   моменты / Требует проверки», а решение инженера
   записывается в неизменяемую историю. Исходные
   значения анализа никогда не перезаписываются.
   ================================================== */

const BUILDMIND_TRUTH_REVIEW_VERSION =
  'truth-review-v1';

const TRUTH_REVIEW_STORAGE_KEY =
  'buildmind-truth-review-v1';

const TRUTH_REVIEW_UNKNOWN = 'unknown';

const TRUTH_REVIEW_ROLES = {
  'pto-engineer': 'Инженер ПТО',
  'project-manager': 'Руководитель проекта',
  'project-admin': 'Администратор проекта'
};

const TRUTH_REVIEW_STATUS_LABELS = {
  confirmed: 'Подтверждено',
  extracted: 'Извлечено, не подтверждено',
  calculated: 'Рассчитано',
  'needs-review': 'Требует проверки',
  conflict: 'Конфликт источников',
  'not-found': 'Не найдено',
  unreadable: 'Не прочитано',
  rejected: 'Отклонено',
  'manual-override': 'Изменено вручную'
};

const TRUTH_REVIEW_ACTION_LABELS = {
  'confirm-source': 'Подтверждено значение из источника',
  'choose-source': 'Выбран другой источник',
  'manual-value': 'Введено исправленное значение',
  'keep-unknown': 'Значение оставлено неизвестным',
  reject: 'Вывод отклонён',
  rerecognize: 'Возвращено на повторное распознавание',
  assign: 'Назначен ответственный'
};

const TRUTH_REVIEW_RESOLVING_ACTIONS = [
  'confirm-source',
  'choose-source',
  'manual-value',
  'keep-unknown',
  'reject'
];

// Чем выше, тем важнее статус для сводного значка строки.
const TRUTH_REVIEW_STATUS_SEVERITY = {
  conflict: 9,
  unreadable: 8,
  'needs-review': 7,
  'not-found': 6,
  rejected: 5,
  extracted: 4,
  calculated: 3,
  'manual-override': 2,
  confirmed: 1
};

const TRUTH_REVIEW_FIELD_LABELS = {
  vorQuantity: 'Количество ВОР',
  gprQuantity: 'Количество ГПР',
  startDate: 'Начало по ГПР',
  finishDate: 'Окончание по ГПР',
  quantity: 'Количество материала',
  pages: 'Страницы документа',
  report: 'Отчёт агента',
  document: 'Результат анализа'
};


const TRUTH_REVIEW_NUMERIC_FIELDS = [
  'vorQuantity',
  'gprQuantity',
  'quantity'
];


function truthReviewHash(value) {
  const source = String(value || '');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}


function cloneTruthReview(value) {
  return value == null
    ? null
    : JSON.parse(JSON.stringify(value));
}


function isTruthReviewValueMissing(value, kind) {
  if (value == null || value === TRUTH_REVIEW_UNKNOWN) {
    return true;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }

  if (kind === 'number') {
    return !Number.isFinite(Number(value));
  }

  return false;
}


function normalizeTruthReviewSource(source) {
  const documents = Array.isArray(source?.sourceDocuments)
    ? source.sourceDocuments.filter(Boolean)
    : (source?.sourceFile ? [source.sourceFile] : []);
  const pages = (
    Array.isArray(source?.sourcePages)
      ? source.sourcePages
      : [source?.sourcePage]
  )
    .map(Number)
    .filter(function (page) {
      return Number.isInteger(page) && page > 0;
    });

  return {
    sourceDocuments: Array.from(new Set(documents)),
    sourcePages: Array.from(new Set(pages)).sort(function (first, second) {
      return first - second;
    }),
    sourceSheet: source?.sourceSheet || '',
    sourceRow: source?.sourceRow ?? null,
    sourceCell: source?.sourceCell || '',
    sourceObject: source?.sourceObject || '',
    sourceQuote: source?.sourceQuote || ''
  };
}


function hasTruthReviewSourceFile(source) {
  return source.sourceDocuments.length > 0;
}


function hasTruthReviewSourceLocation(source) {
  return (
    source.sourcePages.length > 0 ||
    Boolean(source.sourceSheet) ||
    source.sourceRow != null ||
    Boolean(source.sourceCell) ||
    Boolean(source.sourceObject)
  );
}


function describeTruthReviewSource(source) {
  const normalized = normalizeTruthReviewSource(source);
  const parts = [];

  if (normalized.sourceDocuments.length > 0) {
    parts.push(normalized.sourceDocuments.join(', '));
  }

  if (normalized.sourcePages.length > 0) {
    parts.push('стр. ' + normalized.sourcePages.join(', '));
  }

  if (normalized.sourceSheet) {
    parts.push('лист ' + normalized.sourceSheet);
  }

  if (normalized.sourceRow != null) {
    parts.push('строка ' + normalized.sourceRow);
  }

  if (normalized.sourceCell) {
    parts.push('ячейка ' + normalized.sourceCell);
  }

  if (normalized.sourceObject) {
    parts.push('объект ' + normalized.sourceObject);
  }

  return parts.join(' · ') || 'Источник не указан';
}


/*
  Значение по разделу 3 контракта. Пустое значение
  хранится как 'unknown', а не как ноль.
*/
function createTruthValueRecord(input) {
  const settings = input && typeof input === 'object' ? input : {};
  const kind = settings.kind || 'text';
  const source = normalizeTruthReviewSource(settings.source || settings);
  const missing = isTruthReviewValueMissing(settings.value, kind);
  const reviewReasons = Array.isArray(settings.reviewReasons)
    ? settings.reviewReasons.filter(Boolean)
    : [];
  let status = 'extracted';

  if (missing) {
    status = 'not-found';
    reviewReasons.unshift('Значение не найдено в источнике. Оно не заменяется нулём.');
  } else if (!hasTruthReviewSourceFile(source)) {
    status = 'needs-review';
    reviewReasons.unshift('Нет ссылки на исходный файл.');
  } else if (!hasTruthReviewSourceLocation(source)) {
    status = 'needs-review';
    reviewReasons.unshift('Не указана страница, лист или строка источника.');
  } else if (reviewReasons.length > 0 || settings.requiresReview === true) {
    status = 'needs-review';
  }

  const now = settings.createdAt || new Date().toISOString();

  return {
    recordId: settings.recordId || '',
    subjectType: settings.subjectType || 'work',
    subjectId: settings.subjectId || '',
    subjectLabel: settings.subjectLabel || '',
    field: settings.field || 'value',
    value: missing
      ? TRUTH_REVIEW_UNKNOWN
      : (kind === 'number' ? Number(settings.value) : settings.value),
    unit: settings.unit || '',
    sourceFile: source.sourceDocuments.join(', '),
    sourcePage: source.sourcePages.length > 0 ? source.sourcePages.join(', ') : '',
    sourceSheet: source.sourceSheet,
    sourceCell: source.sourceCell,
    sourceObject: source.sourceObject,
    sourceQuote: source.sourceQuote,
    sourceRow: source.sourceRow,
    source,
    method: settings.method || 'extracted',
    confidence: settings.confidence || '',
    status,
    reviewReason: reviewReasons.join(' '),
    revisionId: settings.revisionId || '',
    createdAt: now,
    updatedAt: now
  };
}


function loadTruthReviewState() {
  try {
    const saved = localStorage.getItem(TRUTH_REVIEW_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    if (
      parsed &&
      parsed.version === BUILDMIND_TRUTH_REVIEW_VERSION &&
      parsed.decisions &&
      typeof parsed.decisions === 'object'
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn('BuildMind Truth Review: журнал решений не прочитан:', error);
  }

  return {
    version: BUILDMIND_TRUTH_REVIEW_VERSION,
    decisions: {}
  };
}


function saveTruthReviewState(state) {
  try {
    localStorage.setItem(TRUTH_REVIEW_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('BuildMind Truth Review: журнал решений не сохранён:', error);
    return false;
  }
}


function getTruthReviewHistory(disputeId) {
  const state = loadTruthReviewState();
  const history = state.decisions[String(disputeId || '')];

  return Array.isArray(history) ? cloneTruthReview(history) : [];
}


function getTruthReviewWorkLabel(row) {
  return [row?.workCode, row?.workName].filter(Boolean).join(' ') || 'Строка без наименования';
}


function createTruthReviewRowRecords(row) {
  const subjectId = row.rowId;
  const subjectLabel = getTruthReviewWorkLabel(row);
  const vorSource = row.vorSource || row;
  const gprSource = row.gprSource || row;
  const reasons = Array.isArray(row.reviewReasons) ? row.reviewReasons : [];
  const records = [];

  function add(field, kind, value, source, method, extraReasons) {
    records.push(
      createTruthValueRecord({
        recordId: subjectId + ':' + field,
        subjectType: 'work',
        subjectId,
        subjectLabel,
        field,
        kind,
        value,
        unit: kind === 'number' ? row.unit : '',
        source,
        method,
        confidence: row.confidence || '',
        reviewReasons: extraReasons
      })
    );
  }

  if (row.status !== 'schedule-only') {
    add('vorQuantity', 'number', row.vorQuantity, vorSource, 'extracted', []);
  }

  if (row.status !== 'volume-only') {
    // Количество в ГПР необязательно: отсутствие не делает строку спорной.
    if (!isTruthReviewValueMissing(row.gprQuantity, 'number')) {
      add('gprQuantity', 'number', row.gprQuantity, gprSource, 'extracted', reasons);
    }

    add('startDate', 'date', row.startDate, gprSource, 'extracted', reasons);
    add('finishDate', 'date', row.finishDate, gprSource, 'extracted', reasons);
  }

  return records;
}


function createTruthReviewDisputeId(parts) {
  return 'dispute-' + truthReviewHash(JSON.stringify(parts));
}


function getTruthReviewRisk(status) {
  if (status === 'conflict' || status === 'unreadable') {
    return 'high';
  }

  return 'medium';
}


function createTruthReviewDisputeFromRecord(record) {
  const checkHints = {
    'not-found': 'Найти значение в исходном документе или оставить его неизвестным.',
    'needs-review': 'Открыть исходную страницу и подтвердить или исправить значение.',
    extracted: 'Сверить значение с исходной страницей и подтвердить, исправить или отклонить.'
  };

  return {
    disputeId: createTruthReviewDisputeId([
      record.subjectType,
      record.subjectLabel,
      record.field,
      record.unit,
      record.value,
      record.sourceFile,
      record.sourcePage,
      record.sourceSheet,
      record.sourceRow
    ]),
    // «confirmation» — бесспорное извлечённое значение, ожидающее
    // подтверждения инженером; в очередь спорных моментов не входит.
    disputeType: record.status === 'extracted' ? 'confirmation' : 'value',
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    subjectLabel: record.subjectLabel,
    field: record.field,
    fieldLabel: TRUTH_REVIEW_FIELD_LABELS[record.field] || record.field,
    recordIds: [record.recordId],
    values: [
      {
        label: 'Анализ документа',
        value: record.value,
        unit: record.unit,
        source: record.source,
        sourceLabel: describeTruthReviewSource(record.source)
      }
    ],
    originalStatus: record.status,
    reason: record.reviewReason,
    risk: record.status === 'extracted' ? 'low' : getTruthReviewRisk(record.status),
    checkHint: checkHints[record.status] || checkHints['needs-review']
  };
}


function createTruthReviewConflict(row, vorRecord, gprRecord) {
  return {
    disputeId: createTruthReviewDisputeId([
      'conflict',
      vorRecord.subjectLabel,
      row.unit,
      vorRecord.value,
      vorRecord.sourceFile,
      vorRecord.sourcePage,
      gprRecord.value,
      gprRecord.sourceFile,
      gprRecord.sourcePage
    ]),
    disputeType: 'conflict',
    subjectType: 'work',
    subjectId: row.rowId,
    subjectLabel: vorRecord.subjectLabel,
    field: 'quantity',
    fieldLabel: 'Количество работы',
    recordIds: [vorRecord.recordId, gprRecord.recordId],
    values: [
      {
        label: 'ВОР',
        value: vorRecord.value,
        unit: vorRecord.unit,
        source: vorRecord.source,
        sourceLabel: describeTruthReviewSource(vorRecord.source)
      },
      {
        label: 'ГПР',
        value: gprRecord.value,
        unit: gprRecord.unit,
        source: gprRecord.source,
        sourceLabel: describeTruthReviewSource(gprRecord.source)
      }
    ],
    originalStatus: 'conflict',
    reason: 'ВОР и ГПР дают разное количество для одной работы.',
    risk: 'high',
    checkHint: 'Сверить ВОР и ГПР, выбрать действующий источник или ввести подтверждённое значение.'
  };
}


function getTruthReviewItemStatus(item) {
  if (item.reviewType === 'ocr-gap') {
    return 'unreadable';
  }

  return 'needs-review';
}


function createTruthReviewDisputeFromReviewItem(item) {
  const status = getTruthReviewItemStatus(item);
  const source = normalizeTruthReviewSource({
    sourceFile: item.fileName,
    sourcePages: item.pageNumbers,
    sourceRow: item.sourceRow
  });
  const reasons = [item.reason]
    .concat(Array.isArray(item.reasons) ? item.reasons : [])
    .filter(Boolean);

  return {
    disputeId: createTruthReviewDisputeId([
      'review-item',
      item.reviewType,
      item.code,
      item.fileName,
      item.workName,
      item.sourceRow,
      source.sourcePages
    ]),
    disputeType: 'review-item',
    subjectType: 'document',
    subjectId: item.fileName || '',
    subjectLabel: item.workName || item.fileName || 'Результат анализа',
    field: item.reviewType === 'ocr-gap' ? 'pages' : 'document',
    fieldLabel: TRUTH_REVIEW_FIELD_LABELS[
      item.reviewType === 'ocr-gap' ? 'pages' : 'document'
    ],
    recordIds: [],
    values: [
      {
        label: 'Анализ документа',
        value: item.startDate || item.finishDate
          ? [item.startDate || '—', item.finishDate || '—'].join(' — ')
          : TRUTH_REVIEW_UNKNOWN,
        unit: '',
        source,
        sourceLabel: describeTruthReviewSource(source)
      }
    ],
    originalStatus: status,
    reason: reasons.join(' ') || 'Результат анализа требует инженерной проверки.',
    risk: getTruthReviewRisk(status),
    checkHint: status === 'unreadable'
      ? 'Проверить страницы вручную или вернуть документ на повторное распознавание.'
      : 'Открыть исходную страницу и принять решение.'
  };
}


function createTruthReviewDisputeFromAgentReport(report) {
  const flags = Array.isArray(report.qualityFlags) ? report.qualityFlags : [];

  return {
    disputeId: createTruthReviewDisputeId([
      'agent-report',
      report.agentId,
      report.taskType,
      report.sourceFile,
      flags
    ]),
    disputeType: 'agent-report',
    subjectType: 'agent',
    subjectId: report.agentId || '',
    subjectLabel: (report.label || report.agentId || 'Агент') +
      (report.sourceFile ? ' · ' + report.sourceFile : ''),
    field: 'report',
    fieldLabel: TRUTH_REVIEW_FIELD_LABELS.report,
    recordIds: [],
    values: [
      {
        label: 'Отчёт агента',
        value: TRUTH_REVIEW_UNKNOWN,
        unit: '',
        source: normalizeTruthReviewSource({ sourceFile: report.sourceFile }),
        sourceLabel: report.sourceFile || 'Источник не указан'
      }
    ],
    originalStatus: 'needs-review',
    reason: 'Отчёт агента не прошёл проверку доказательств: ' +
      (flags.join(', ') || report.truthStatus || report.status) + '.',
    risk: 'high',
    checkHint: 'Не использовать выводы агента, пока инженер не проверит источники.'
  };
}


function isTruthReviewAgentReportDisputed(report) {
  return (
    (Array.isArray(report?.qualityFlags) && report.qualityFlags.length > 0) ||
    ['failed', 'blocked'].includes(report?.status)
  );
}


function getTruthReviewDecisionState(dispute, history) {
  const statusEntries = history.filter(function (entry) {
    return entry.action !== 'assign';
  });
  const assignEntries = history.filter(function (entry) {
    return entry.action === 'assign';
  });
  const lastDecision = statusEntries[statusEntries.length - 1] || null;
  const lastAssign = assignEntries[assignEntries.length - 1] || null;
  const firstValue = dispute.values[0] || {};

  return {
    status: lastDecision ? lastDecision.status : dispute.originalStatus,
    value: lastDecision ? lastDecision.newValue : firstValue.value,
    unit: lastDecision ? (lastDecision.unit || firstValue.unit || '') : (firstValue.unit || ''),
    resolved: Boolean(
      lastDecision &&
      TRUTH_REVIEW_RESOLVING_ACTIONS.includes(lastDecision.action)
    ),
    decision: lastDecision,
    responsible: lastAssign?.responsible || lastDecision?.responsible || '',
    dueDate: lastAssign?.dueDate || lastDecision?.dueDate || ''
  };
}


function pickTruthReviewWorstStatus(statuses) {
  return statuses.reduce(function (worst, status) {
    return (TRUTH_REVIEW_STATUS_SEVERITY[status] || 0) >
      (TRUTH_REVIEW_STATUS_SEVERITY[worst] || 0)
      ? status
      : worst;
  }, '');
}


function buildTruthReviewModel(snapshot) {
  const rows = Array.isArray(snapshot?.combinedRows) ? snapshot.combinedRows : [];
  const materials = Array.isArray(snapshot?.materials) ? snapshot.materials : [];
  const reviewItems = Array.isArray(snapshot?.reviewItems) ? snapshot.reviewItems : [];
  const agentReports = Array.isArray(snapshot?.agentReports) ? snapshot.agentReports : [];
  const state = loadTruthReviewState();
  const records = [];
  const disputes = [];
  const confirmations = [];
  const seenDisputes = new Set();

  function pushDispute(dispute) {
    if (seenDisputes.has(dispute.disputeId)) {
      return;
    }

    seenDisputes.add(dispute.disputeId);
    disputes.push(dispute);
  }

  rows.forEach(function (row) {
    const rowRecords = createTruthReviewRowRecords(row);
    const vorRecord = rowRecords.find(function (record) {
      return record.field === 'vorQuantity';
    });
    const gprRecord = rowRecords.find(function (record) {
      return record.field === 'gprQuantity';
    });

    if (
      vorRecord &&
      gprRecord &&
      typeof vorRecord.value === 'number' &&
      typeof gprRecord.value === 'number' &&
      Math.abs(vorRecord.value - gprRecord.value) >
        1e-9 * Math.max(1, Math.abs(vorRecord.value), Math.abs(gprRecord.value))
    ) {
      vorRecord.status = 'conflict';
      gprRecord.status = 'conflict';
      pushDispute(createTruthReviewConflict(row, vorRecord, gprRecord));
    }

    rowRecords.forEach(function (record) {
      records.push(record);

      if (['not-found', 'needs-review'].includes(record.status)) {
        pushDispute(createTruthReviewDisputeFromRecord(record));
      } else if (record.status === 'extracted') {
        confirmations.push(createTruthReviewDisputeFromRecord(record));
      }
    });
  });

  materials.forEach(function (material, index) {
    const record = createTruthValueRecord({
      recordId: 'material-' + index + ':quantity',
      subjectType: 'material',
      subjectId: 'material-' + index,
      subjectLabel: material.workName || 'Материал без наименования',
      field: 'quantity',
      kind: 'number',
      value: material.quantity,
      unit: material.unit,
      source: material,
      confidence: material.confidence || '',
      reviewReasons: material.measureReviewRequired
        ? ['Проверить единицу измерения или количество.']
        : []
    });

    records.push(record);

    if (['not-found', 'needs-review'].includes(record.status)) {
      pushDispute(createTruthReviewDisputeFromRecord(record));
    } else if (record.status === 'extracted') {
      confirmations.push(createTruthReviewDisputeFromRecord(record));
    }
  });

  reviewItems.forEach(function (item) {
    pushDispute(createTruthReviewDisputeFromReviewItem(item));
  });

  agentReports
    .filter(isTruthReviewAgentReportDisputed)
    .forEach(function (report) {
      pushDispute(createTruthReviewDisputeFromAgentReport(report));
    });

  const recordStatus = {};

  disputes.concat(confirmations).forEach(function (dispute) {
    const history = Array.isArray(state.decisions[dispute.disputeId])
      ? state.decisions[dispute.disputeId]
      : [];
    const decisionState = getTruthReviewDecisionState(dispute, history);

    dispute.history = cloneTruthReview(history);
    dispute.status = decisionState.status;
    dispute.currentValue = decisionState.value;
    dispute.currentUnit = decisionState.unit;
    dispute.resolved = decisionState.resolved;
    dispute.decision = decisionState.decision;
    dispute.responsible = decisionState.responsible;
    dispute.dueDate = decisionState.dueDate;

    dispute.recordIds.forEach(function (recordId) {
      recordStatus[recordId] = decisionState.status;
    });
  });

  records.forEach(function (record) {
    if (recordStatus[record.recordId]) {
      record.status = recordStatus[record.recordId];
    }
  });

  const subjectStatus = {};

  records.forEach(function (record) {
    subjectStatus[record.subjectId] = pickTruthReviewWorstStatus([
      subjectStatus[record.subjectId] || '',
      record.status
    ]);
  });

  const statusCounts = {};

  records.forEach(function (record) {
    statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
  });

  const openDisputes = disputes.filter(function (dispute) {
    return !dispute.resolved;
  });
  const pendingConfirmations = confirmations.filter(function (item) {
    return !item.resolved;
  });

  return {
    version: BUILDMIND_TRUTH_REVIEW_VERSION,
    records,
    disputes,
    openDisputes,
    confirmations,
    pendingConfirmations,
    subjectStatus,
    statusCounts,
    summary: {
      recordsCount: records.length,
      confirmedCount: statusCounts.confirmed || 0,
      disputesCount: disputes.length,
      openDisputesCount: openDisputes.length,
      resolvedDisputesCount: disputes.length - openDisputes.length,
      pendingConfirmationCount: pendingConfirmations.length,
      confirmedByEngineerCount: confirmations.length - pendingConfirmations.length,
      conflictCount: disputes.filter(function (dispute) {
        return dispute.originalStatus === 'conflict' && !dispute.resolved;
      }).length
    }
  };
}


function failTruthReviewDecision(code, message) {
  return {
    success: false,
    errorCode: code,
    message
  };
}


function applyTruthReviewDecision(snapshot, disputeId, input) {
  const decision = input && typeof input === 'object' ? input : {};
  const action = String(decision.action || '');
  const model = buildTruthReviewModel(snapshot);
  const dispute = model.disputes.concat(model.confirmations).find(function (item) {
    return item.disputeId === disputeId;
  });

  if (!dispute) {
    return failTruthReviewDecision('DISPUTE_NOT_FOUND', 'Спорная запись не найдена. Повторите анализ комплекта.');
  }

  if (!TRUTH_REVIEW_ACTION_LABELS[action]) {
    return failTruthReviewDecision('UNKNOWN_ACTION', 'Неизвестное действие проверки.');
  }

  const role = String(decision.role || '');
  const user = String(decision.user || '').trim();
  const reason = String(decision.reason || '').trim();

  if (!TRUTH_REVIEW_ROLES[role]) {
    return failTruthReviewDecision('ROLE_NOT_ALLOWED', 'Решение может принять только инженер ПТО, руководитель проекта или администратор проекта.');
  }

  if (!user) {
    return failTruthReviewDecision('USER_REQUIRED', 'Укажите ФИО ответственного пользователя.');
  }

  if (action !== 'assign' && !reason) {
    return failTruthReviewDecision('REASON_REQUIRED', 'Укажите основание решения.');
  }

  const previousValue = dispute.currentValue;
  const previousStatus = dispute.status;
  let newValue = previousValue;
  let unit = dispute.currentUnit || '';
  let status = previousStatus;
  let sourceIndex = null;

  if (action === 'confirm-source' || action === 'choose-source') {
    sourceIndex = action === 'confirm-source' && decision.sourceIndex == null
      ? 0
      : Number(decision.sourceIndex);

    const chosen = dispute.values[sourceIndex];

    if (!Number.isInteger(sourceIndex) || !chosen) {
      return failTruthReviewDecision('SOURCE_REQUIRED', 'Выберите источник значения.');
    }

    if (
      isTruthReviewValueMissing(chosen.value) ||
      chosen.source.sourceDocuments.length === 0
    ) {
      return failTruthReviewDecision('SOURCE_HAS_NO_VALUE', 'В выбранном источнике нет значения с указанием документа. Введите значение вручную или оставьте его неизвестным.');
    }

    newValue = chosen.value;
    unit = chosen.unit || unit;
    status = 'confirmed';
  }

  if (action === 'manual-value') {
    const rawValue = decision.newValue;

    if (isTruthReviewValueMissing(rawValue)) {
      return failTruthReviewDecision('VALUE_REQUIRED', 'Введите исправленное значение.');
    }

    if (!String(decision.documentRef || '').trim()) {
      return failTruthReviewDecision('DOCUMENT_REQUIRED', 'Укажите документ или фотографию, подтверждающие значение.');
    }

    const numeric = Number(String(rawValue).replace(',', '.'));

    newValue = TRUTH_REVIEW_NUMERIC_FIELDS.includes(dispute.field)
      ? numeric
      : String(rawValue).trim();

    if (typeof newValue === 'number' && !Number.isFinite(newValue)) {
      return failTruthReviewDecision('VALUE_NOT_NUMBER', 'Значение должно быть числом.');
    }

    unit = String(decision.unit || '').trim() || unit;
    status = 'manual-override';
  }

  if (action === 'keep-unknown') {
    newValue = TRUTH_REVIEW_UNKNOWN;
    status = 'not-found';
  }

  if (action === 'reject') {
    status = 'rejected';
  }

  if (action === 'rerecognize') {
    status = 'needs-review';
  }

  const decidedAt = decision.decidedAt || new Date().toISOString();
  const entry = {
    entryId: 'decision-' + truthReviewHash(disputeId + decidedAt + action + Math.random()),
    disputeId,
    action,
    actionLabel: TRUTH_REVIEW_ACTION_LABELS[action],
    subjectLabel: dispute.subjectLabel,
    field: dispute.field,
    originalValues: cloneTruthReview(dispute.values),
    previousValue: action === 'assign' ? undefined : previousValue,
    previousStatus,
    newValue: action === 'assign' ? undefined : newValue,
    unit,
    status: action === 'assign' ? previousStatus : status,
    sourceIndex,
    reason,
    user,
    role,
    roleLabel: TRUTH_REVIEW_ROLES[role],
    documentRef: String(decision.documentRef || '').trim(),
    comment: String(decision.comment || '').trim(),
    responsible: String(decision.responsible || '').trim(),
    dueDate: String(decision.dueDate || '').trim(),
    decidedAt
  };

  const state = loadTruthReviewState();
  const history = Array.isArray(state.decisions[disputeId])
    ? state.decisions[disputeId]
    : [];

  state.decisions[disputeId] = history.concat([entry]);

  if (!saveTruthReviewState(state)) {
    return failTruthReviewDecision('STORAGE_FAILED', 'Решение не сохранено: хранилище браузера недоступно.');
  }

  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('buildmind:truth-review-changed', {
        detail: cloneTruthReview(entry)
      })
    );
  }

  return {
    success: true,
    entry: cloneTruthReview(entry),
    message: TRUTH_REVIEW_ACTION_LABELS[action] + '. Решение записано в историю.'
  };
}


function clearTruthReviewState() {
  try {
    localStorage.removeItem(TRUTH_REVIEW_STORAGE_KEY);
  } catch (error) {
    console.warn('BuildMind Truth Review: журнал решений не очищен:', error);
  }
}


window.BuildMindTruthReview = {
  version: BUILDMIND_TRUTH_REVIEW_VERSION,
  storageKey: TRUTH_REVIEW_STORAGE_KEY,
  unknown: TRUTH_REVIEW_UNKNOWN,
  roles: TRUTH_REVIEW_ROLES,
  statusLabels: TRUTH_REVIEW_STATUS_LABELS,
  actionLabels: TRUTH_REVIEW_ACTION_LABELS,
  createValueRecord: createTruthValueRecord,
  describeSource: describeTruthReviewSource,
  buildModel: buildTruthReviewModel,
  applyDecision: applyTruthReviewDecision,
  getHistory: getTruthReviewHistory,
  clear: clearTruthReviewState
};


console.info(
  'BuildMind Truth Review загружен:',
  BUILDMIND_TRUTH_REVIEW_VERSION
);
