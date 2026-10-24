'use strict';

/* ==================================================
   BUILDMIND CHANGESET ENGINE — V1

   Сравнивает неизменяемые снимки двух редакций:
   - работы и объёмы;
   - материалы и количества;
   - даты начала и окончания по ГПР.

   Результат носит рекомендательный характер и
   не меняет утверждённую модель без инженера.
   ================================================== */

const BUILDMIND_CHANGE_SET_VERSION =
  'change-set-v1';

const CHANGE_SET_STORAGE_KEY =
  'buildmind-change-sets-v1';

const CHANGE_SET_LIMIT = 250;

const CHANGE_SET_STATUS_LABELS = {
  pending: 'Ожидает проверки',
  confirmed: 'Подтверждён инженером',
  'needs-review': 'Требует уточнения',
  'needs-baseline': 'Нет исходного снимка'
};

const CHANGE_SET_TYPE_LABELS = {
  added: 'Добавлено',
  removed: 'Исключено',
  modified: 'Изменено'
};

const CHANGE_SET_ENTITY_LABELS = {
  work: 'Работы и ГПР',
  material: 'Материалы'
};


function changeSetId(prefix = 'change-set') {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return (
      `${prefix}-` +
      window.crypto.randomUUID()
    );
  }

  return (
    `${prefix}-` +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


function cloneChangeSetValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}


function emptyChangeSetState() {
  return {
    version:
      BUILDMIND_CHANGE_SET_VERSION,

    changeSets:
      [],

    createdAt:
      '',

    updatedAt:
      ''
  };
}


function loadChangeSetState() {
  try {
    const saved =
      localStorage.getItem(
        CHANGE_SET_STORAGE_KEY
      );

    if (!saved) {
      return emptyChangeSetState();
    }

    const parsed =
      JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return emptyChangeSetState();
    }

    return {
      ...emptyChangeSetState(),
      ...parsed,
      version:
        BUILDMIND_CHANGE_SET_VERSION,
      changeSets:
        Array.isArray(parsed.changeSets)
          ? parsed.changeSets.filter(
              function (item) {
                return (
                  item?.sourceType !==
                  'demo'
                );
              }
            )
          : []
    };
  } catch (error) {
    console.warn(
      'ChangeSet: не удалось прочитать состояние:',
      error
    );

    return emptyChangeSetState();
  }
}


let changeSetState =
  loadChangeSetState();

let demoChangeSetPreview =
  null;


function saveChangeSetState() {
  const now =
    new Date().toISOString();

  if (!changeSetState.createdAt) {
    changeSetState.createdAt =
      now;
  }

  changeSetState.updatedAt =
    now;

  changeSetState.changeSets =
    changeSetState.changeSets.slice(
      0,
      CHANGE_SET_LIMIT
    );

  localStorage.setItem(
    CHANGE_SET_STORAGE_KEY,
    JSON.stringify(changeSetState)
  );

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:change-sets-changed',
      {
        detail:
          cloneChangeSetValue(
            changeSetState
          )
      }
    )
  );
}


function escapeChangeSetHtml(value) {
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
      return symbols[symbol];
    }
  );
}


function normalizeChangeSetText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function normalizeChangeSetUnit(value) {
  const normalized =
    normalizeChangeSetText(value)
      .replace(/\s/g, '');

  const map = {
    шт: 'шт',
    штука: 'шт',
    штуки: 'шт',
    штук: 'шт',
    м: 'м',
    метр: 'м',
    метры: 'м',
    метров: 'м',
    пм: 'п.м.',
    погм: 'п.м.',
    м2: 'м²',
    'м²': 'м²',
    м3: 'м³',
    'м³': 'м³',
    кг: 'кг',
    т: 'т',
    компл: 'компл.'
  };

  return map[normalized] ||
    String(value || '').trim();
}


function changeSetNumber(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed =
    Number(
      String(value)
        .replace(/\s/g, '')
        .replace(',', '.')
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function normalizeChangeSetDate(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  const iso =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const russian =
    text.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})/
    );

  if (!russian) {
    return null;
  }

  const year =
    russian[3].length === 2
      ? Number(russian[3]) + 2000
      : Number(russian[3]);

  return [
    year,
    String(russian[2]).padStart(2, '0'),
    String(russian[1]).padStart(2, '0')
  ].join('-');
}


function getChangeSetExtension(documentItem) {
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
    ? parts.pop().toLowerCase()
    : '';
}


async function ensureChangeSetAnalysis(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return;
  }

  const extension =
    getChangeSetExtension(
      documentItem
    );

  if (
    extension === 'pdf' &&
    !documentItem.analysis?.success &&
    window.BuildMindProjectDocuments &&
    typeof window
      .BuildMindProjectDocuments
      .analyzePdfDocument === 'function'
  ) {
    await window
      .BuildMindProjectDocuments
      .analyzePdfDocument(
        documentItem
      );
  }

  if (
    ['xlsx', 'xls', 'csv']
      .includes(extension) &&
    !documentItem.workVolumeAnalysis &&
    window.BuildMindWorkVolume &&
    typeof window
      .BuildMindWorkVolume
      .analyzeDocument === 'function'
  ) {
    documentItem.workVolumeAnalysis =
      await window
        .BuildMindWorkVolume
        .analyzeDocument(
          documentItem
        );
  }
}


function normalizeChangeSetWork(
  candidate
) {
  const name =
    String(
      candidate?.workName ||
      candidate?.name ||
      ''
    ).trim();

  if (!name) {
    return null;
  }

  return {
    key:
      normalizeChangeSetText(name),
    name,
    quantity:
      changeSetNumber(
        candidate?.quantity
      ),
    unit:
      normalizeChangeSetUnit(
        candidate?.unit
      ),
    startDate:
      normalizeChangeSetDate(
        candidate?.startDate
      ),
    finishDate:
      normalizeChangeSetDate(
        candidate?.finishDate
      ),
    sourceSheet:
      candidate?.sourceSheet ||
      '',
    sourceRow:
      candidate?.sourceRow ||
      candidate?.rowNumber ||
      null
  };
}


function normalizeChangeSetMaterial(
  candidate
) {
  const name =
    String(
      candidate?.name ||
      candidate?.materialName ||
      candidate?.workName ||
      ''
    ).trim();

  if (!name) {
    return null;
  }

  return {
    key:
      normalizeChangeSetText(name),
    name,
    quantity:
      changeSetNumber(
        candidate?.quantity ??
        candidate?.need
      ),
    unit:
      normalizeChangeSetUnit(
        candidate?.unit
      ),
    pageNumber:
      candidate?.pageNumber ||
      null,
    sourceSheet:
      candidate?.sourceSheet ||
      '',
    sourceRow:
      candidate?.sourceRow ||
      candidate?.rowNumber ||
      null
  };
}


function mergeChangeSetRecords(
  records
) {
  const map =
    new Map();

  records
    .filter(Boolean)
    .forEach(
      function (record) {
        if (!record.key) {
          return;
        }

        if (!map.has(record.key)) {
          map.set(
            record.key,
            {
              ...record,
              occurrences: 1
            }
          );

          return;
        }

        const existing =
          map.get(record.key);

        existing.occurrences += 1;

        if (
          existing.unit === record.unit &&
          Number.isFinite(existing.quantity) &&
          Number.isFinite(record.quantity)
        ) {
          existing.quantity +=
            record.quantity;
        }

        if (
          record.startDate &&
          (
            !existing.startDate ||
            record.startDate <
              existing.startDate
          )
        ) {
          existing.startDate =
            record.startDate;
        }

        if (
          record.finishDate &&
          (
            !existing.finishDate ||
            record.finishDate >
              existing.finishDate
          )
        ) {
          existing.finishDate =
            record.finishDate;
        }
      }
    );

  return Array.from(
    map.values()
  );
}


function buildChangeSetSnapshot(
  documentItem,
  metadata = {}
) {
  const tableCandidates =
    Array.isArray(
      documentItem
        ?.workVolumeAnalysis
        ?.candidates
    )
      ? documentItem
          .workVolumeAnalysis
          .candidates
      : [];

  const pdfMaterials =
    Array.isArray(
      documentItem
        ?.analysis
        ?.materialCandidates
    )
      ? documentItem
          .analysis
          .materialCandidates
      : [];

  const works =
    mergeChangeSetRecords(
      tableCandidates
        .filter(
          function (candidate) {
            return (
              candidate.rowType ===
              'work'
            );
          }
        )
        .map(
          normalizeChangeSetWork
        )
    );

  const materials =
    mergeChangeSetRecords([
      ...tableCandidates
        .filter(
          function (candidate) {
            return (
              candidate.rowType ===
              'material'
            );
          }
        )
        .map(
          normalizeChangeSetMaterial
        ),
      ...pdfMaterials.map(
        normalizeChangeSetMaterial
      )
    ]);

  const warnings = [];

  if (
    works.length === 0 &&
    materials.length === 0
  ) {
    warnings.push(
      'В редакции не найдено структурированных работ или материалов. Рекомендуется проверить тип документа и качество извлечения.'
    );
  }

  return {
    version:
      BUILDMIND_CHANGE_SET_VERSION,
    snapshotId:
      changeSetId('snapshot'),
    revisionId:
      metadata.revisionId ||
      '',
    documentId:
      metadata.documentId ||
      '',
    fileName:
      documentItem?.file?.name ||
      metadata.fileName ||
      '',
    capturedAt:
      new Date().toISOString(),
    works,
    materials,
    warnings,
    source: {
      workVolumeVersion:
        documentItem
          ?.workVolumeAnalysis
          ?.version ||
        '',
      pdfAnalysisAvailable:
        Boolean(
          documentItem
            ?.analysis
            ?.success
        )
    },
    requiresEngineerConfirmation:
      true
  };
}


function changeSetValuesEqual(
  first,
  second
) {
  if (
    first === null ||
    first === undefined ||
    second === null ||
    second === undefined
  ) {
    return (
      (first === null || first === undefined) &&
      (second === null || second === undefined)
    );
  }

  if (
    typeof first === 'number' ||
    typeof second === 'number'
  ) {
    return Math.abs(
      Number(first) -
      Number(second)
    ) < 0.000001;
  }

  return String(first) ===
    String(second);
}


function getChangeSetDateShift(
  before,
  after
) {
  if (!before || !after) {
    return null;
  }

  const beforeTime =
    Date.parse(
      before + 'T00:00:00Z'
    );
  const afterTime =
    Date.parse(
      after + 'T00:00:00Z'
    );

  if (
    !Number.isFinite(beforeTime) ||
    !Number.isFinite(afterTime)
  ) {
    return null;
  }

  return Math.round(
    (afterTime - beforeTime) /
    86400000
  );
}


function compareChangeSetEntities(
  entityType,
  beforeItems,
  afterItems
) {
  const fields =
    entityType === 'work'
      ? [
          'quantity',
          'unit',
          'startDate',
          'finishDate'
        ]
      : [
          'quantity',
          'unit'
        ];

  const beforeMap =
    new Map(
      beforeItems.map(
        function (item) {
          return [item.key, item];
        }
      )
    );

  const afterMap =
    new Map(
      afterItems.map(
        function (item) {
          return [item.key, item];
        }
      )
    );

  const keys =
    Array.from(
      new Set([
        ...beforeMap.keys(),
        ...afterMap.keys()
      ])
    ).sort();

  const changes = [];
  let unchanged = 0;

  keys.forEach(
    function (key) {
      const before =
        beforeMap.get(key) ||
        null;
      const after =
        afterMap.get(key) ||
        null;

      if (!before && after) {
        changes.push({
          id:
            changeSetId('change'),
          entityType,
          changeType:
            'added',
          key,
          label:
            after.name,
          before:
            null,
          after:
            cloneChangeSetValue(after),
          changedFields:
            fields.filter(
              function (field) {
                return (
                  after[field] !== null &&
                  after[field] !== ''
                );
              }
            ),
          impact: {}
        });

        return;
      }

      if (before && !after) {
        changes.push({
          id:
            changeSetId('change'),
          entityType,
          changeType:
            'removed',
          key,
          label:
            before.name,
          before:
            cloneChangeSetValue(before),
          after:
            null,
          changedFields:
            fields.filter(
              function (field) {
                return (
                  before[field] !== null &&
                  before[field] !== ''
                );
              }
            ),
          impact: {}
        });

        return;
      }

      const changedFields =
        fields.filter(
          function (field) {
            return !changeSetValuesEqual(
              before[field],
              after[field]
            );
          }
        );

      if (changedFields.length === 0) {
        unchanged += 1;
        return;
      }

      changes.push({
        id:
          changeSetId('change'),
        entityType,
        changeType:
          'modified',
        key,
        label:
          after.name ||
          before.name,
        before:
          cloneChangeSetValue(before),
        after:
          cloneChangeSetValue(after),
        changedFields,
        impact: {
          quantityDelta:
            Number.isFinite(before.quantity) &&
            Number.isFinite(after.quantity)
              ? after.quantity -
                before.quantity
              : null,
          startShiftDays:
            getChangeSetDateShift(
              before.startDate,
              after.startDate
            ),
          finishShiftDays:
            getChangeSetDateShift(
              before.finishDate,
              after.finishDate
            )
        }
      });
    }
  );

  return {
    changes,
    unchanged
  };
}


function compareChangeSetSnapshots(
  beforeSnapshot,
  afterSnapshot
) {
  const before =
    beforeSnapshot ||
    {
      works: [],
      materials: []
    };
  const after =
    afterSnapshot ||
    {
      works: [],
      materials: []
    };

  const workResult =
    compareChangeSetEntities(
      'work',
      Array.isArray(before.works)
        ? before.works
        : [],
      Array.isArray(after.works)
        ? after.works
        : []
    );

  const materialResult =
    compareChangeSetEntities(
      'material',
      Array.isArray(before.materials)
        ? before.materials
        : [],
      Array.isArray(after.materials)
        ? after.materials
        : []
    );

  const changes = [
    ...workResult.changes,
    ...materialResult.changes
  ];

  const summary = {
    total:
      changes.length,
    added:
      changes.filter(
        function (item) {
          return item.changeType ===
            'added';
        }
      ).length,
    removed:
      changes.filter(
        function (item) {
          return item.changeType ===
            'removed';
        }
      ).length,
    modified:
      changes.filter(
        function (item) {
          return item.changeType ===
            'modified';
        }
      ).length,
    workChanges:
      changes.filter(
        function (item) {
          return item.entityType ===
            'work';
        }
      ).length,
    materialChanges:
      changes.filter(
        function (item) {
          return item.entityType ===
            'material';
        }
      ).length,
    quantityChanges:
      changes.filter(
        function (item) {
          return item.changedFields
            .includes('quantity');
        }
      ).length,
    dateChanges:
      changes.filter(
        function (item) {
          return (
            item.changedFields
              .includes('startDate') ||
            item.changedFields
              .includes('finishDate')
          );
        }
      ).length,
    unchanged:
      workResult.unchanged +
      materialResult.unchanged
  };

  return {
    changes,
    summary
  };
}


function createStoredChangeSet(options) {
  const shouldPersist =
    options.persist !== false;

  const duplicate =
    shouldPersist
      ? changeSetState.changeSets.find(
          function (item) {
            return (
              options.newRevisionId &&
              item.newRevisionId ===
                options.newRevisionId
            );
          }
        )
      : null;

  if (duplicate) {
    return duplicate;
  }

  const hasBaseline =
    Boolean(
      options.beforeSnapshot
    );

  const comparison =
    hasBaseline
      ? compareChangeSetSnapshots(
          options.beforeSnapshot,
          options.afterSnapshot
        )
      : {
          changes: [],
          summary: {
            total: 0,
            added: 0,
            removed: 0,
            modified: 0,
            workChanges: 0,
            materialChanges: 0,
            quantityChanges: 0,
            dateChanges: 0,
            unchanged: 0
          }
        };

  const warnings = [
    ...(
      options.beforeSnapshot
        ?.warnings ||
      []
    ),
    ...(
      options.afterSnapshot
        ?.warnings ||
      []
    )
  ];

  if (!hasBaseline) {
    warnings.unshift(
      'Предыдущая редакция не содержит снимка анализа. Для точного сравнения требуется повторно выбрать исходный файл или принять новую редакцию как будущую базовую точку.'
    );
  }

  const now =
    new Date().toISOString();

  const changeSet = {
    id:
      options.id ||
      changeSetId(),
    version:
      BUILDMIND_CHANGE_SET_VERSION,
    sourceType:
      options.sourceType ||
      'document-revision',
    documentId:
      options.documentId ||
      '',
    logicalTitle:
      options.logicalTitle ||
      'Документ без названия',
    kind:
      options.kind ||
      'other',
    previousRevisionId:
      options.previousRevisionId ||
      '',
    previousRevisionLabel:
      options.previousRevisionLabel ||
      'Предыдущая редакция',
    newRevisionId:
      options.newRevisionId ||
      '',
    newRevisionLabel:
      options.newRevisionLabel ||
      'Новая редакция',
    relationType:
      options.relationType ||
      'replaces',
    projectNodeIds:
      Array.isArray(
        options.projectNodeIds
      )
        ? [...options.projectNodeIds]
        : [],
    createdAt:
      now,
    updatedAt:
      now,
    status:
      hasBaseline
        ? 'pending'
        : 'needs-baseline',
    decisionComment:
      '',
    decidedAt:
      null,
    decidedByRole:
      '',
    summary:
      comparison.summary,
    changes:
      comparison.changes,
    warnings:
      Array.from(
        new Set(
          warnings.filter(Boolean)
        )
      ),
    requiresEngineerConfirmation:
      true
  };

  if (!shouldPersist) {
    return changeSet;
  }

  changeSetState.changeSets.unshift(
    changeSet
  );

  saveChangeSetState();
  renderChangeSetUi();

  return changeSet;
}


async function captureDocumentRevisionChangeSet(
  options
) {
  const uploadedDocument =
    options?.uploadedDocument;
  const registryDocument =
    options?.registryDocument;
  const revision =
    options?.revision;
  const previousRevision =
    options?.previousRevision ||
    null;

  if (
    !uploadedDocument ||
    !registryDocument ||
    !revision
  ) {
    return {
      snapshot: null,
      changeSet: null,
      changeSetId: null
    };
  }

  await ensureChangeSetAnalysis(
    uploadedDocument
  );

  const snapshot =
    buildChangeSetSnapshot(
      uploadedDocument,
      {
        documentId:
          registryDocument.documentId,
        revisionId:
          revision.revisionId,
        fileName:
          revision.fileName
      }
    );

  revision.analysisSnapshot =
    cloneChangeSetValue(snapshot);

  if (!previousRevision) {
    return {
      snapshot,
      changeSet: null,
      changeSetId: null
    };
  }

  const changeSet =
    createStoredChangeSet({
      documentId:
        registryDocument.documentId,
      logicalTitle:
        registryDocument.logicalTitle,
      kind:
        registryDocument.kind,
      previousRevisionId:
        previousRevision.revisionId,
      previousRevisionLabel:
        previousRevision.revisionLabel,
      newRevisionId:
        revision.revisionId,
      newRevisionLabel:
        revision.revisionLabel,
      relationType:
        revision.relationType,
      projectNodeIds:
        revision.projectNodeIds,
      beforeSnapshot:
        previousRevision
          .analysisSnapshot ||
        null,
      afterSnapshot:
        snapshot
    });

  revision.changeSetId =
    changeSet.id;

  return {
    snapshot,
    changeSet,
    changeSetId:
      changeSet.id
  };
}


function formatChangeSetNumber(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat(
    'ru-RU',
    {
      maximumFractionDigits: 3
    }
  ).format(value);
}


function formatChangeSetValue(
  record,
  field
) {
  if (!record) {
    return '—';
  }

  if (field === 'quantity') {
    const number =
      formatChangeSetNumber(
        record.quantity
      );

    return [
      number,
      record.unit || ''
    ].filter(Boolean).join(' ');
  }

  if (field === 'unit') {
    return record.unit ||
      '—';
  }

  if (
    field === 'startDate' ||
    field === 'finishDate'
  ) {
    return record[field] ||
      '—';
  }

  return String(
    record[field] ?? '—'
  );
}


function getChangeSetFieldLabel(field) {
  const labels = {
    quantity: 'Количество / объём',
    unit: 'Единица',
    startDate: 'Начало',
    finishDate: 'Окончание'
  };

  return labels[field] ||
    field;
}


function renderChangeSetFields(change) {
  const fields =
    change.changedFields ||
    [];

  if (change.changeType === 'added') {
    return (
      '<span>Новое значение: ' +
      escapeChangeSetHtml(
        formatChangeSetValue(
          change.after,
          'quantity'
        )
      ) +
      '</span>' +
      (
        change.after?.startDate ||
        change.after?.finishDate
          ? '<span>Срок: ' +
            escapeChangeSetHtml(
              change.after.startDate ||
              '—'
            ) +
            ' → ' +
            escapeChangeSetHtml(
              change.after.finishDate ||
              '—'
            ) +
            '</span>'
          : ''
      )
    );
  }

  if (change.changeType === 'removed') {
    return (
      '<span>Было предусмотрено: ' +
      escapeChangeSetHtml(
        formatChangeSetValue(
          change.before,
          'quantity'
        )
      ) +
      '</span>'
    );
  }

  return fields
    .map(
      function (field) {
        return (
          '<span><b>' +
          escapeChangeSetHtml(
            getChangeSetFieldLabel(field)
          ) +
          ':</b> ' +
          escapeChangeSetHtml(
            formatChangeSetValue(
              change.before,
              field
            )
          ) +
          ' → ' +
          escapeChangeSetHtml(
            formatChangeSetValue(
              change.after,
              field
            )
          ) +
          '</span>'
        );
      }
    )
    .join('');
}


function renderChangeSetChange(change) {
  return `
    <li class="change-set-change change-set-${escapeChangeSetHtml(
      change.changeType
    )}">
      <div class="change-set-change-main">
        <span class="change-set-type-badge">
          ${escapeChangeSetHtml(
            CHANGE_SET_TYPE_LABELS[
              change.changeType
            ] || change.changeType
          )}
        </span>
        <strong>${escapeChangeSetHtml(
          change.label
        )}</strong>
      </div>
      <div class="change-set-fields">
        ${renderChangeSetFields(change)}
      </div>
    </li>
  `;
}


function renderChangeSetCard(changeSet) {
  const groups =
    ['work', 'material']
      .map(
        function (entityType) {
          const items =
            changeSet.changes.filter(
              function (change) {
                return (
                  change.entityType ===
                  entityType
                );
              }
            );

          if (items.length === 0) {
            return '';
          }

          return `
            <section class="change-set-group">
              <h4>${escapeChangeSetHtml(
                CHANGE_SET_ENTITY_LABELS[
                  entityType
                ]
              )} (${items.length})</h4>
              <ul class="change-set-changes">
                ${items.map(
                  renderChangeSetChange
                ).join('')}
              </ul>
            </section>
          `;
        }
      )
      .join('');

  const warnings =
    changeSet.warnings.length > 0
      ? `
        <div class="change-set-warnings">
          <strong>Требует внимания</strong>
          <ul>
            ${changeSet.warnings.map(
              function (warning) {
                return `<li>${escapeChangeSetHtml(
                  warning
                )}</li>`;
              }
            ).join('')}
          </ul>
        </div>
      `
      : '';

  const actions =
    changeSet.sourceType !== 'demo' &&
    ['pending', 'needs-review']
      .includes(changeSet.status)
      ? `
        <div class="change-set-actions">
          <button
            type="button"
            class="primary"
            data-change-set-action="confirm"
            data-change-set-id="${escapeChangeSetHtml(
              changeSet.id
            )}"
          >
            Подтвердить анализ
          </button>
          <button
            type="button"
            class="secondary"
            data-change-set-action="clarify"
            data-change-set-id="${escapeChangeSetHtml(
              changeSet.id
            )}"
          >
            Требует уточнения
          </button>
        </div>
      `
      : '';

  const decision =
    changeSet.decisionComment
      ? `
        <p class="change-set-decision">
          <strong>Комментарий инженера:</strong>
          ${escapeChangeSetHtml(
            changeSet.decisionComment
          )}
        </p>
      `
      : '';

  return `
    <article class="change-set-card-item">
      <div class="change-set-card-header">
        <div>
          <span class="change-set-eyebrow">
            ${changeSet.sourceType === 'demo'
              ? 'ДЕМОНСТРАЦИОННЫЙ ПАКЕТ'
              : 'ПАКЕТ ИЗМЕНЕНИЙ'}
          </span>
          <h3>${escapeChangeSetHtml(
            changeSet.logicalTitle
          )}</h3>
          <p>
            ${escapeChangeSetHtml(
              changeSet.previousRevisionLabel
            )}
            →
            ${escapeChangeSetHtml(
              changeSet.newRevisionLabel
            )}
          </p>
        </div>
        <span class="change-set-status change-set-status-${escapeChangeSetHtml(
          changeSet.status
        )}">
          ${escapeChangeSetHtml(
            CHANGE_SET_STATUS_LABELS[
              changeSet.status
            ] || changeSet.status
          )}
        </span>
      </div>

      <div class="change-set-summary">
        <div><strong>${changeSet.summary.total}</strong><span>Всего</span></div>
        <div><strong>${changeSet.summary.added}</strong><span>Добавлено</span></div>
        <div><strong>${changeSet.summary.modified}</strong><span>Изменено</span></div>
        <div><strong>${changeSet.summary.removed}</strong><span>Исключено</span></div>
        <div><strong>${changeSet.summary.dateChanges}</strong><span>Даты</span></div>
      </div>

      ${warnings}
      ${groups || '<p class="change-set-empty">Различия не сформированы.</p>'}
      ${decision}
      ${actions}

      <p class="change-set-disclaimer">
        ${
          changeSet.sourceType === 'demo'
            ? (
                'Это временный пример. Он не сохраняется ' +
                'и не входит в данные живого проекта.'
              )
            : (
                'Предварительный анализ. Применение к утверждённым объёмам, ' +
                'ГПР и закупкам требует решения инженера.'
              )
        }
      </p>
    </article>
  `;
}


function createChangeSetUi() {
  if (
    document.getElementById(
      'changeSetSection'
    )
  ) {
    return;
  }

  const layout =
    document.querySelector(
      '.layout'
    );

  if (!layout) {
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.id =
    'changeSetSection';
  section.className =
    'card change-set-section';
  section.innerHTML = `
    <div class="change-set-section-header">
      <div>
        <span class="change-set-eyebrow">
          CHANGESET V1
        </span>
        <h2>Пакеты изменений проекта</h2>
        <p class="muted">
          Сравнение работ, объёмов, материалов и дат между
          действующей и новой редакциями. Ничего не применяется
          без решения инженера.
        </p>
      </div>
      <button
        type="button"
        id="createChangeSetDemoBtn"
        class="secondary"
        aria-pressed="false"
      >
        Показать пример сравнения
      </button>
    </div>

    <div class="change-set-overview">
      <div><strong id="changeSetTotalCount">0</strong><span>Пакетов</span></div>
      <div><strong id="changeSetPendingCount">0</strong><span>На проверке</span></div>
      <div><strong id="changeSetChangesCount">0</strong><span>Изменений</span></div>
    </div>

    <p id="changeSetMessage" class="change-set-message">
      Новая редакция создаст пакет автоматически после регистрации в реестре документов.
    </p>

    <div id="changeSetList" class="change-set-list"></div>
  `;

  layout.appendChild(section);

  document.getElementById(
    'createChangeSetDemoBtn'
  )?.addEventListener(
    'click',
    function () {
      if (demoChangeSetPreview) {
        demoChangeSetPreview =
          null;
      } else {
        createDemoChangeSet();
      }

      renderChangeSetUi();
    }
  );

  section.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-change-set-action]'
        );

      if (!button) {
        return;
      }

      const id =
        button.dataset
          .changeSetId;
      const action =
        button.dataset
          .changeSetAction;

      if (action === 'confirm') {
        if (
          !confirm(
            'Подтвердить результаты сравнения?\n\nЭто зафиксирует решение инженера, но пока не изменит утверждённые объёмы, ГПР или закупки.'
          )
        ) {
          return;
        }

        setChangeSetDecision(
          id,
          'confirmed',
          'Анализ подтверждён инженером.'
        );
      }

      if (action === 'clarify') {
        const comment =
          prompt(
            'Что требуется уточнить?',
            'Проверить исходные объёмы и даты'
          );

        if (comment === null) {
          return;
        }

        setChangeSetDecision(
          id,
          'needs-review',
          comment.trim() ||
          'Требуется дополнительная проверка.'
        );
      }
    }
  );
}


function renderChangeSetUi() {
  createChangeSetUi();

  const list =
    document.getElementById(
      'changeSetList'
    );

  if (!list) {
    return;
  }

  const liveSets =
    changeSetState.changeSets;

  const sets =
    demoChangeSetPreview
      ? [
          demoChangeSetPreview,
          ...liveSets
        ]
      : liveSets;

  const demoButton =
    document.getElementById(
      'createChangeSetDemoBtn'
    );

  if (demoButton) {
    demoButton.textContent =
      demoChangeSetPreview
        ? 'Закрыть пример'
        : 'Показать пример сравнения';

    demoButton.setAttribute(
      'aria-pressed',
      demoChangeSetPreview
        ? 'true'
        : 'false'
    );
  }

  const counters = {
    changeSetTotalCount:
      liveSets.length,
    changeSetPendingCount:
      liveSets.filter(
        function (item) {
          return [
            'pending',
            'needs-review',
            'needs-baseline'
          ].includes(item.status);
        }
      ).length,
    changeSetChangesCount:
      liveSets.reduce(
        function (total, item) {
          return total +
            Number(
              item.summary?.total ||
              0
            );
        },
        0
      )
  };

  Object.entries(counters)
    .forEach(
      function ([id, value]) {
        const element =
          document.getElementById(id);

        if (element) {
          element.textContent =
            String(value);
        }
      }
    );

  if (sets.length === 0) {
    list.innerHTML = `
      <div class="change-set-empty">
        Пакетов изменений пока нет. Зарегистрируйте исходную редакцию,
        сделайте её действующей, затем зарегистрируйте новую редакцию.
        Демонстрационный пример открывается отдельно и не сохраняется.
      </div>
    `;
    return;
  }

  list.innerHTML =
    sets.map(
      renderChangeSetCard
    ).join('');
}


function setChangeSetDecision(
  id,
  status,
  comment
) {
  const changeSet =
    changeSetState.changeSets.find(
      function (item) {
        return item.id === id;
      }
    );

  if (!changeSet) {
    return false;
  }

  changeSet.status =
    status;
  changeSet.decisionComment =
    String(comment || '').trim();
  changeSet.decidedAt =
    new Date().toISOString();
  changeSet.decidedByRole =
    'engineer';
  changeSet.updatedAt =
    changeSet.decidedAt;

  saveChangeSetState();
  renderChangeSetUi();

  return true;
}


function demoChangeSetSnapshot(
  revisionId,
  works,
  materials
) {
  return {
    version:
      BUILDMIND_CHANGE_SET_VERSION,
    snapshotId:
      changeSetId('snapshot'),
    revisionId,
    documentId:
      'demo-document-cable-duct',
    fileName:
      `${revisionId}.xlsx`,
    capturedAt:
      new Date().toISOString(),
    works:
      works.map(
        function (item) {
          return {
            ...item,
            key:
              normalizeChangeSetText(
                item.name
              )
          };
        }
      ),
    materials:
      materials.map(
        function (item) {
          return {
            ...item,
            key:
              normalizeChangeSetText(
                item.name
              )
          };
        }
      ),
    warnings: [],
    requiresEngineerConfirmation:
      true
  };
}


function createDemoChangeSet() {
  if (demoChangeSetPreview) {
    return demoChangeSetPreview;
  }

  const before =
    demoChangeSetSnapshot(
      'R1',
      [
        {
          name:
            'Строительство кабельной канализации',
          quantity: 1000,
          unit: 'м',
          startDate: '2026-09-01',
          finishDate: '2026-09-30'
        },
        {
          name:
            'Монтаж кабельных колодцев',
          quantity: 10,
          unit: 'шт',
          startDate: '2026-09-10',
          finishDate: '2026-09-25'
        }
      ],
      [
        {
          name: 'Труба ПНД 110',
          quantity: 1000,
          unit: 'м'
        },
        {
          name: 'Хомут крепёжный',
          quantity: 670,
          unit: 'шт'
        }
      ]
    );

  const after =
    demoChangeSetSnapshot(
      'R2',
      [
        {
          name:
            'Строительство кабельной канализации',
          quantity: 1200,
          unit: 'м',
          startDate: '2026-09-05',
          finishDate: '2026-10-10'
        },
        {
          name:
            'Монтаж опорных конструкций',
          quantity: 20,
          unit: 'шт',
          startDate: '2026-09-18',
          finishDate: '2026-10-05'
        }
      ],
      [
        {
          name: 'Труба ПНД 110',
          quantity: 1200,
          unit: 'м'
        },
        {
          name: 'Хомут крепёжный',
          quantity: 804,
          unit: 'шт'
        },
        {
          name: 'Гайка М10',
          quantity: 1608,
          unit: 'шт'
        }
      ]
    );

  demoChangeSetPreview =
    createStoredChangeSet({
    id:
      'change-set-demo-cable-duct-v1',
    persist:
      false,
    sourceType:
      'demo',
    documentId:
      'demo-document-cable-duct',
    logicalTitle:
      'Дополнительная ВОР: кабельная канализация',
    kind:
      'work-volume',
    previousRevisionId:
      'demo-revision-r1',
    previousRevisionLabel:
      'Редакция R1',
    newRevisionId:
      'demo-revision-r2',
    newRevisionLabel:
      'Редакция R2',
    relationType:
      'amends',
    projectNodeIds:
      [],
    beforeSnapshot:
      before,
    afterSnapshot:
      after
  });

  return demoChangeSetPreview;
}


window.BuildMindChangeSet = {
  version:
    BUILDMIND_CHANGE_SET_VERSION,

  getState:
    function () {
      return cloneChangeSetValue(
        changeSetState
      );
    },

  getAll:
    function () {
      return cloneChangeSetValue(
        changeSetState.changeSets
      );
    },

  buildSnapshot:
    buildChangeSetSnapshot,

  compareSnapshots:
    compareChangeSetSnapshots,

  captureRevision:
    captureDocumentRevisionChangeSet,

  createDemo:
    createDemoChangeSet,

  getDemoPreview:
    function () {
      return cloneChangeSetValue(
        demoChangeSetPreview
      );
    },

  closeDemo:
    function () {
      demoChangeSetPreview =
        null;

      renderChangeSetUi();
    },

  setDecision:
    setChangeSetDecision,

  refresh:
    renderChangeSetUi
};


createChangeSetUi();
renderChangeSetUi();


console.info(
  'BuildMind ChangeSet загружен:',
  BUILDMIND_CHANGE_SET_VERSION
);
