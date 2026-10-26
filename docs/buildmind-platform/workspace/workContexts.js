'use strict';

/*
  ==================================================
  BUILDMIND WORK CONTEXTS — DEMO V1
  ==================================================
*/

const WORK_CONTEXTS_STORAGE_KEY =
  'buildmindWorkContexts-v2-clean';

const ACTIVE_CONTEXT_STORAGE_KEY =
  'buildmindActiveContextId-v2-clean';

const defaultWorkContexts = [];

let workContexts = [];

let activeContextId =
  localStorage.getItem(
    ACTIVE_CONTEXT_STORAGE_KEY
  ) || '';

function cloneDefaultWorkContexts() {
  return defaultWorkContexts.map(
    function (item) {
      return {
        ...item
      };
    }
  );
}

function saveWorkContexts() {
  localStorage.setItem(
    WORK_CONTEXTS_STORAGE_KEY,
    JSON.stringify(workContexts)
  );
}

function loadWorkContexts() {
  const savedContexts =
    localStorage.getItem(
      WORK_CONTEXTS_STORAGE_KEY
    );

  if (savedContexts === null) {
    workContexts =
      cloneDefaultWorkContexts();

    saveWorkContexts();
    return;
  }

  try {
    const parsedContexts =
      JSON.parse(savedContexts);

    if (
      !Array.isArray(parsedContexts)
    ) {
      throw new Error(
        'Контексты должны быть массивом.'
      );
    }

    workContexts =
      parsedContexts.map(
        function (context) {
          const defaultContext =
            defaultWorkContexts.find(
              function (item) {
                return (
                  item.id === context.id
                );
              }
            );

          return {
            ...context,

            endDate:
              context.endDate ||
              (
                defaultContext
                  ? defaultContext.endDate
                  : ''
              ),

            safetyDays:
              Number.isFinite(
                Number(
                  context.safetyDays
                )
              )
                ? Number(
                    context.safetyDays
                  )
                : 0
          };
        }
      );

    saveWorkContexts();
  } catch (error) {
    console.warn(
      'Не удалось прочитать контексты работ:',
      error
    );

    workContexts =
      cloneDefaultWorkContexts();

    saveWorkContexts();
  }
}

function setElementText(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.textContent =
      value || '—';
  }
}

function setInputValue(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.value =
      value || '';
  }
}

function selectWorkContext(
  project,
  object,
  work,
  startDate,
  endDate,
  safetyDays
) {
  setElementText(
    'currentProject',
    project
  );

  setElementText(
    'currentObject',
    object
  );

  setElementText(
    'currentWork',
    work
  );

  setElementText(
    'currentStartDate',
    startDate
  );

  setElementText(
    'currentEndDate',
    endDate
  );

  const normalizedSafetyDays =
    Number.isFinite(
      Number(safetyDays)
    )
      ? Number(safetyDays)
      : 0;

  setElementText(
    'currentSafetyDays',
    `${normalizedSafetyDays} дн.`
  );

  setInputValue(
    'newProject',
    project
  );

  setInputValue(
    'newObject',
    object
  );

  setInputValue(
    'newWork',
    work
  );

  setInputValue(
    'workName',
    work
  );

  setInputValue(
    'workStartDate',
    startDate
  );

  setInputValue(
    'safetyDays',
    String(normalizedSafetyDays)
  );

  setInputValue(
    'activeContextSafetyDaysInput',
    String(normalizedSafetyDays)
  );

  setElementText(
    'activeContextSafetyMessage',
    'Запас вычитается из даты начала работы при расчёте даты потребности.'
  );

  if (
    typeof window.render ===
    'function'
  ) {
    window.render();
  } else if (
    typeof render ===
    'function'
  ) {
    render();
  }
}

function clearCurrentWorkContext() {
  setElementText(
    'currentProject',
    '—'
  );

  setElementText(
    'currentObject',
    '—'
  );

  setElementText(
    'currentWork',
    '—'
  );

  setElementText(
    'currentStartDate',
    '—'
  );

  setElementText(
    'currentEndDate',
    '—'
  );

  setElementText(
    'currentSafetyDays',
    '—'
  );


  setInputValue(
    'newProject',
    ''
  );

  setInputValue(
    'newObject',
    ''
  );

  setInputValue(
    'newWork',
    ''
  );


  /*
    Временные технические поля.
    В чистом проекте они тоже
    не должны содержать старую работу.
  */

  setInputValue(
    'workName',
    ''
  );

  setInputValue(
    'workStartDate',
    ''
  );

  setInputValue(
    'safetyDays',
    '0'
  );

  setInputValue(
    'activeContextSafetyDaysInput',
    '2'
  );

  setElementText(
    'activeContextSafetyMessage',
    'Сначала выберите рабочий контекст.'
  );
}

function renderWorkContexts() {
  const list =
    document.getElementById(
      'contextsList'
    );

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (workContexts.length === 0) {
    const emptyMessage =
      document.createElement('div');

    emptyMessage.className =
      'empty-contexts';

    emptyMessage.textContent =
      'Контексты пока не добавлены. ' +
      'Нажмите «+ Добавить контекст».';

    list.appendChild(
      emptyMessage
    );

    return;
  }

  workContexts.forEach(
    function (context) {
      const row =
        document.createElement('div');

      row.className =
        'context-row' +
        (
          context.id ===
          activeContextId
            ? ' active'
            : ''
        );

      const selectButton =
        document.createElement(
          'button'
        );

      selectButton.type =
        'button';

      selectButton.className =
        'context-select';

      const contextLabel =
        document.createElement(
          'strong'
        );

      contextLabel.textContent =
        `${context.project} / ` +
        `${context.object} / ` +
        `${context.work}`;

      const contextMeta =
        document.createElement(
          'small'
        );

      contextMeta.textContent =
        `${context.startDate || '—'} — ` +
        `${context.endDate || '—'}` +
        (
          context.sourceType ===
            'analysis-gpr'
            ? ' · из ГПР' +
              (
                context.requiresReview
                  ? ' · проверить'
                  : ''
              ) +
              (
                context.riskEligible ===
                  false
                  ? ' · не участвует в риске'
                  : ''
              )
            : ''
        );

      selectButton.appendChild(
        contextLabel
      );

      selectButton.appendChild(
        contextMeta
      );

      selectButton.addEventListener(
        'click',
        function () {
          selectWorkContextById(
            context.id
          );
        }
      );

      const deleteButton =
        document.createElement(
          'button'
        );

      deleteButton.type =
        'button';

      deleteButton.className =
        'context-delete';

      deleteButton.textContent =
        '×';

      deleteButton.title =
        'Удалить контекст';

      deleteButton.addEventListener(
        'click',
        function () {
          deleteWorkContext(
            context.id
          );
        }
      );

      row.appendChild(
        selectButton
      );

      row.appendChild(
        deleteButton
      );

      list.appendChild(row);
    }
  );
}

function selectWorkContextById(
  contextId
) {
  const selectedContext =
    workContexts.find(
      function (context) {
        return (
          context.id === contextId
        );
      }
    );

  if (!selectedContext) {
    return;
  }

  activeContextId =
    selectedContext.id;

  localStorage.setItem(
    ACTIVE_CONTEXT_STORAGE_KEY,
    activeContextId
  );

  selectWorkContext(
    selectedContext.project,
    selectedContext.object,
    selectedContext.work,
    selectedContext.startDate,
    selectedContext.endDate,
    selectedContext.safetyDays
  );

  renderWorkContexts();
}

function openContextForm() {
  const form =
    document.getElementById(
      'contextForm'
    );

  const projectNameInput =
    document.getElementById(
      'projectName'
    );

  const objectNameInput =
    document.getElementById(
      'objectName'
    );

  setInputValue(
    'contextProject',
    projectNameInput
      ? projectNameInput.value.trim()
      : ''
  );

  setInputValue(
    'contextObject',
    objectNameInput
      ? objectNameInput.value.trim()
      : ''
  );

  if (form) {
    form.classList.remove(
      'hidden'
    );
  }

  const workInput =
    document.getElementById(
      'contextWork'
    );

  if (workInput) {
    workInput.focus();
  }
}

function clearContextForm() {
  setInputValue(
    'contextProject',
    ''
  );

  setInputValue(
    'contextObject',
    ''
  );

  setInputValue(
    'contextWork',
    ''
  );

  setInputValue(
    'contextStartDate',
    ''
  );

  setInputValue(
    'contextEndDate',
    ''
  );

  setInputValue(
    'contextSafetyDays',
    '2'
  );
}

function closeContextForm() {
  const form =
    document.getElementById(
      'contextForm'
    );

  if (form) {
    form.classList.add(
      'hidden'
    );
  }

  clearContextForm();
}

function addWorkContext() {
  const projectInput =
    document.getElementById(
      'contextProject'
    );

  const objectInput =
    document.getElementById(
      'contextObject'
    );

  const workInput =
    document.getElementById(
      'contextWork'
    );

  const startDateInput =
    document.getElementById(
      'contextStartDate'
    );

  const endDateInput =
    document.getElementById(
      'contextEndDate'
    );

  const safetyDaysInput =
    document.getElementById(
      'contextSafetyDays'
    );

  const project =
    projectInput
      ? projectInput.value.trim()
      : '';

  const object =
    objectInput
      ? objectInput.value.trim()
      : '';

  const work =
    workInput
      ? workInput.value.trim()
      : '';

  const startDate =
    startDateInput
      ? startDateInput.value
      : '';

  const endDate =
    endDateInput
      ? endDateInput.value
      : '';

  const safetyDays =
    Number(
      safetyDaysInput
        ? safetyDaysInput.value
        : 0
    );

  if (
    !project ||
    !object ||
    !work ||
    !startDate ||
    !endDate
  ) {
    alert(
      'Заполните проект, объект, работу, начало и окончание работы по ГПР.'
    );

    return;
  }

  if (endDate < startDate) {
    alert(
      'Дата окончания работы не может быть раньше даты начала.'
    );

    return;
  }

  if (
    !Number.isFinite(
      safetyDays
    ) ||
    safetyDays < 0
  ) {
    alert(
      'Страховой запас должен быть числом не меньше нуля.'
    );

    return;
  }

  const duplicateContext =
    workContexts.some(
      function (context) {
        return (
          context.project
            .toLowerCase() ===
            project.toLowerCase() &&

          context.object
            .toLowerCase() ===
            object.toLowerCase() &&

          context.work
            .toLowerCase() ===
            work.toLowerCase()
        );
      }
    );

  if (duplicateContext) {
    alert(
      'Такая работа уже существует в выбранном проекте и объекте.'
    );

    return;
  }

  const newContext = {
    id:
      'context-' +
      Date.now(),

    project,
    object,
    work,
    startDate,
    endDate,
    safetyDays
  };

  workContexts.push(
    newContext
  );

  saveWorkContexts();
  closeContextForm();

  selectWorkContextById(
    newContext.id
  );
}


function updateWorkContextSafetyDays(
  contextId,
  value
) {
  const context =
    workContexts.find(
      function (item) {
        return item.id === contextId;
      }
    );
  const safetyDays =
    Number(value);

  if (!context) {
    return {
      success: false,
      reason:
        'context-not-found'
    };
  }

  if (
    !Number.isFinite(safetyDays) ||
    safetyDays < 0
  ) {
    return {
      success: false,
      reason:
        'invalid-safety-days'
    };
  }

  if (
    Number(context.safetyDays || 0) ===
    safetyDays
  ) {
    return {
      success: true,
      reason: 'no-changes',
      context: {
        ...context
      }
    };
  }

  context.safetyDays =
    safetyDays;
  context.safetyDaysSource =
    'manual';
  context.updatedAt =
    new Date().toISOString();

  saveWorkContexts();

  if (context.id === activeContextId) {
    selectWorkContextById(
      context.id
    );
  } else {
    renderWorkContexts();
  }

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:work-contexts-changed',
      {
        detail: {
          action:
            'safety-days-updated',
          contextId:
            context.id,
          safetyDays
        }
      }
    )
  );

  return {
    success: true,
    reason: 'updated',
    context: {
      ...context
    }
  };
}


function saveActiveContextSafetyDays() {
  const input =
    document.getElementById(
      'activeContextSafetyDaysInput'
    );
  const message =
    document.getElementById(
      'activeContextSafetyMessage'
    );

  if (!activeContextId) {
    if (message) {
      message.textContent =
        'Сначала выберите рабочий контекст.';
    }
    return;
  }

  const result =
    updateWorkContextSafetyDays(
      activeContextId,
      input?.value
    );

  if (message) {
    message.textContent =
      result.success
        ? 'Страховой запас сохранён и учтён в расчёте риска.'
        : 'Введите число дней не меньше нуля.';
  }
}


function normalizeAnalysisContextValue(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function analysisContextHash(value) {
  const source = String(value || '');
  let hash = 2166136261;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0)
    .toString(16)
    .padStart(8, '0');
}


function importWorkContextsFromAnalysis(
  snapshot,
  options = {}
) {
  const project =
    String(options.project || '')
      .trim();
  const object =
    String(options.object || '')
      .trim();
  const defaultSafetyDays =
    Number.isFinite(
      Number(options.safetyDays)
    )
      ? Math.max(
          Number(options.safetyDays),
          0
        )
      : 2;

  if (!project || !object) {
    return {
      success: false,
      reason: 'missing-project-context',
      added: 0,
      updated: 0,
      skipped: 0,
      invalid: 0,
      reviewSkipped: 0,
      totalRows: 0
    };
  }

  const rows =
    Array.isArray(snapshot?.combinedRows)
      ? snapshot.combinedRows
      : Array.isArray(snapshot?.scheduleRows)
        ? snapshot.scheduleRows
        : [];

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  let reviewSkipped = 0;
  const addedIds = [];

  rows.forEach(
    function (row) {
      const work =
        String(
          row?.workName ||
          row?.name ||
          ''
        ).trim();
      const startDate =
        String(row?.startDate || '')
          .trim();
      const endDate =
        String(
          row?.finishDate ||
          row?.endDate ||
          ''
        ).trim();
      const reviewReasons =
        Array.isArray(row?.reviewReasons)
          ? row.reviewReasons
          : [];
      const requiresDateReview =
        Boolean(row?.requiresReview) &&
        (
          reviewReasons.length === 0 ||
          reviewReasons.some(
            function (reason) {
              return /дат|год|начал|оконч|срок/iu
                .test(
                  String(reason || '')
                );
            }
          )
        );

      const contextKey = [
        project,
        object,
        work
      ]
        .map(
          normalizeAnalysisContextValue
        )
        .join('|');

      const existing =
        work
          ? workContexts.find(
              function (context) {
                return [
                  context.project,
                  context.object,
                  context.work
                ]
                  .map(
                    normalizeAnalysisContextValue
                  )
                  .join('|') ===
                    contextKey;
              }
            )
          : null;

      if (requiresDateReview) {
        if (
          existing?.sourceType ===
          'analysis-gpr'
        ) {
          const sameReasons =
            JSON.stringify(
              existing.reviewReasons || []
            ) ===
            JSON.stringify(reviewReasons);

          if (
            existing.riskEligible !==
              false ||
            existing.requiresReview !==
              true ||
            !sameReasons
          ) {
            existing.riskEligible =
              false;
            existing.requiresReview =
              true;
            existing.reviewReasons =
              [...reviewReasons];
            existing.updatedAt =
              new Date().toISOString();
            updated += 1;
          } else {
            skipped += 1;
          }
        }

        reviewSkipped += 1;
        return;
      }

      if (
        !work ||
        !startDate ||
        !endDate ||
        endDate < startDate
      ) {
        if (
          existing?.sourceType ===
          'analysis-gpr'
        ) {
          const invalidReason =
            'В новой редакции ГПР нет корректного диапазона дат.';
          const alreadyBlocked =
            existing.riskEligible ===
              false &&
            existing.requiresReview ===
              true &&
            existing.reviewReasons?.[0] ===
              invalidReason;

          if (!alreadyBlocked) {
            existing.riskEligible =
              false;
            existing.requiresReview =
              true;
            existing.reviewReasons = [
              invalidReason
            ];
            existing.updatedAt =
              new Date().toISOString();
            updated += 1;
          } else {
            skipped += 1;
          }
        }

        invalid += 1;
        return;
      }

      if (existing) {
        if (
          existing.sourceType ===
            'analysis-gpr' &&
          (
            existing.startDate !==
              startDate ||
            existing.endDate !==
              endDate ||
            existing.requiresReview !==
              Boolean(row.requiresReview) ||
            existing.riskEligible !==
              true
          )
        ) {
          existing.startDate =
            startDate;
          existing.endDate =
            endDate;
          existing.requiresReview =
            Boolean(row.requiresReview);
          existing.riskEligible =
            true;
          existing.reviewReasons =
            Array.isArray(
              row.reviewReasons
            )
              ? [...row.reviewReasons]
              : [];
          existing.sourceDocuments =
            Array.isArray(
              row.sourceDocuments
            )
              ? [...row.sourceDocuments]
              : [];
          existing.sourcePages =
            Array.isArray(
              row.sourcePages
            )
              ? [...row.sourcePages]
              : [];
          existing.updatedAt =
            new Date().toISOString();
          updated += 1;
        } else {
          skipped += 1;
        }

        return;
      }

      let id =
        'context-analysis-' +
        analysisContextHash(
          contextKey
        );

      let suffix = 1;

      while (
        workContexts.some(
          function (context) {
            return context.id === id;
          }
        )
      ) {
        id =
          'context-analysis-' +
          analysisContextHash(
            contextKey
          ) +
          '-' +
          suffix;
        suffix += 1;
      }

      const now =
        new Date().toISOString();

      workContexts.push({
        id,
        project,
        object,
        work,
        startDate,
        endDate,
        safetyDays:
          defaultSafetyDays,
        sourceType:
          'analysis-gpr',
        sourceStatus:
          row.status ||
          'schedule',
        sourceDocuments:
          Array.isArray(
            row.sourceDocuments
          )
            ? [...row.sourceDocuments]
            : [],
        sourcePages:
          Array.isArray(
            row.sourcePages
          )
            ? [...row.sourcePages]
            : [],
        requiresReview:
          Boolean(row.requiresReview),
        riskEligible: true,
        reviewReasons:
          Array.isArray(
            row.reviewReasons
          )
            ? [...row.reviewReasons]
            : [],
        analysisSavedAt:
          snapshot?.savedAt ||
          '',
        createdAt: now,
        updatedAt: now
      });

      addedIds.push(id);
      added += 1;
    }
  );

  if (added > 0 || updated > 0) {
    saveWorkContexts();
    renderWorkContexts();

    if (
      !activeContextId &&
      addedIds.length > 0
    ) {
      selectWorkContextById(
        addedIds[0]
      );
    }

    window.dispatchEvent(
      new CustomEvent(
        'buildmind:work-contexts-changed',
        {
          detail: {
            action:
              'analysis-import',
            added,
            updated,
            skipped,
            invalid,
            reviewSkipped,
            total:
              workContexts.length
          }
        }
      )
    );
  }

  return {
    success: true,
    reason:
      added > 0 || updated > 0
        ? 'imported'
        : 'no-changes',
    added,
    updated,
    skipped,
    invalid,
    reviewSkipped,
    totalRows:
      rows.length,
    totalContexts:
      workContexts.length
  };
}

function deleteWorkContext(
  contextId
) {
  const contextToDelete =
    workContexts.find(
      function (context) {
        return (
          context.id ===
          contextId
        );
      }
    );

  if (!contextToDelete) {
    return;
  }

  const confirmed =
    confirm(
      'Удалить контекст?\n\n' +
      `${contextToDelete.project} / ` +
      `${contextToDelete.object} / ` +
      `${contextToDelete.work}`
    );

  if (!confirmed) {
    return;
  }

  workContexts =
    workContexts.filter(
      function (context) {
        return (
          context.id !==
          contextId
        );
      }
    );

  saveWorkContexts();

  if (
    activeContextId ===
    contextId
  ) {
    activeContextId = '';

    localStorage.removeItem(
      ACTIVE_CONTEXT_STORAGE_KEY
    );

    if (
      workContexts.length > 0
    ) {
      selectWorkContextById(
        workContexts[0].id
      );

      return;
    }

    clearCurrentWorkContext();
  }

  renderWorkContexts();
}

function initializeWorkContexts() {
  loadWorkContexts();

  if (
    workContexts.length === 0
  ) {
    clearCurrentWorkContext();
    renderWorkContexts();
    return;
  }

  const activeContextExists =
    workContexts.some(
      function (context) {
        return (
          context.id ===
          activeContextId
        );
      }
    );

  if (activeContextExists) {
    selectWorkContextById(
      activeContextId
    );
  } else {
    selectWorkContextById(
      workContexts[0].id
    );
  }
}

window.selectWorkContext =
  selectWorkContext;

window.selectWorkContextById =
  selectWorkContextById;

window.openContextForm =
  openContextForm;

window.closeContextForm =
  closeContextForm;

window.addWorkContext =
  addWorkContext;

window.deleteWorkContext =
  deleteWorkContext;

window.saveActiveContextSafetyDays =
  saveActiveContextSafetyDays;

window.BuildMindWorkContexts = {
  getAll:
    function () {
      return workContexts.map(
        function (context) {
          return {
            ...context
          };
        }
      );
    },

  getActive:
    function () {
      const context =
        workContexts.find(
          function (item) {
            return (
              item.id ===
              activeContextId
            );
          }
        );

      return context
        ? {
            ...context
          }
        : null;
    },

  selectById:
    selectWorkContextById,

  importFromAnalysis:
    importWorkContextsFromAnalysis,

  updateSafetyDays:
    updateWorkContextSafetyDays,

  refresh:
    renderWorkContexts
};

initializeWorkContexts();

console.info(
  'BuildMind Work Contexts загружен'
);
