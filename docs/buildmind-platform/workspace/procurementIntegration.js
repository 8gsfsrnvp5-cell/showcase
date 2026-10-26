'use strict';

/* ==================================================
   BUILDMIND PROCUREMENT INTEGRATION — V2.1

   Связывает результат анализа ВОР/ГПР с рабочими
   контекстами снабжения. Контексты создаются только
   при наличии подтверждённых названий проекта и
   объекта; исходные строки анализа не изменяются.
   ================================================== */

const BUILDMIND_PROCUREMENT_INTEGRATION_VERSION =
  'procurement-integration-v2.1';


function getProcurementProjectContext() {
  const core =
    window.BuildMindProjectCore;

  const activeNode =
    core &&
    typeof core.getActiveNode ===
      'function'
      ? core.getActiveNode()
      : null;

  const root =
    core &&
    typeof core.getRoot ===
      'function'
      ? core.getRoot()
      : null;

  const projectInput =
    document.getElementById(
      'projectName'
    );

  const objectInput =
    document.getElementById(
      'objectName'
    );

  return {
    project:
      String(
        activeNode?.name ||
        root?.name ||
        projectInput?.value ||
        ''
      ).trim(),
    object:
      String(
        activeNode?.object ||
        root?.object ||
        objectInput?.value ||
        ''
      ).trim(),
    nodeId:
      activeNode?.id ||
      root?.id ||
      ''
  };
}


function getProcurementAnalysisSnapshot() {
  const analysis =
    window.BuildMindProjectAnalysis;

  if (
    !analysis ||
    typeof analysis.getSnapshot !==
      'function'
  ) {
    return null;
  }

  return analysis.getSnapshot();
}


function notifyProcurementIntegration(
  result,
  source
) {
  window.dispatchEvent(
    new CustomEvent(
      'buildmind:procurement-integration-changed',
      {
        detail: {
          ...result,
          source:
            source ||
            'manual',
          occurredAt:
            new Date().toISOString()
        }
      }
    )
  );
}


function importProcurementWorkContexts(
  options = {}
) {
  const snapshot =
    options.snapshot ||
    getProcurementAnalysisSnapshot();
  const context =
    getProcurementProjectContext();
  const workContexts =
    window.BuildMindWorkContexts;

  if (!snapshot) {
    const result = {
      success: false,
      reason: 'missing-analysis',
      message:
        'Сначала выполните анализ комплекта ВОР/ГПР.',
      added: 0,
      updated: 0
    };

    notifyProcurementIntegration(
      result,
      options.source
    );

    return result;
  }

  if (
    !context.project ||
    !context.object
  ) {
    const result = {
      success: false,
      reason:
        'missing-project-context',
      message:
        'Заполните проект и объект в паспорте проекта, затем повторите перенос сроков ГПР.',
      added: 0,
      updated: 0
    };

    notifyProcurementIntegration(
      result,
      options.source
    );

    return result;
  }

  if (
    !workContexts ||
    typeof workContexts
      .importFromAnalysis !==
      'function'
  ) {
    const result = {
      success: false,
      reason:
        'work-contexts-unavailable',
      message:
        'Модуль рабочих контекстов не загружен.',
      added: 0,
      updated: 0
    };

    notifyProcurementIntegration(
      result,
      options.source
    );

    return result;
  }

  const imported =
    workContexts.importFromAnalysis(
      snapshot,
      {
        project:
          context.project,
        object:
          context.object,
        safetyDays:
          Number.isFinite(
            Number(options.safetyDays)
          )
            ? Number(options.safetyDays)
            : 2
      }
    );

  const reviewNote =
    Number(imported.reviewSkipped || 0) > 0
      ? ` Строк с сомнительными датами оставлено на проверке: ${imported.reviewSkipped}.`
      : '';

  const invalidNote =
    Number(imported.invalid || 0) > 0
      ? ` Неполных строк без рабочего диапазона дат пропущено: ${imported.invalid}.`
      : '';

  const result = {
    ...imported,
    project:
      context.project,
    object:
      context.object,
    nodeId:
      context.nodeId,
    message:
      imported.success
        ? (
            imported.added > 0 ||
            imported.updated > 0
              ? `Из ГПР создано ${imported.added} контекстов, обновлено ${imported.updated}.` +
                reviewNote +
                invalidNote
              : 'Все доступные строки ГПР уже связаны с рабочими контекстами.' +
                reviewNote +
                invalidNote
          )
        : 'Контексты из ГПР не созданы.'
  };

  notifyProcurementIntegration(
    result,
    options.source
  );

  return result;
}


function autoImportProcurementContexts(
  snapshot,
  source
) {
  const context =
    getProcurementProjectContext();

  if (
    !snapshot ||
    !context.project ||
    !context.object
  ) {
    return null;
  }

  return importProcurementWorkContexts({
    snapshot,
    source:
      source ||
      'automatic'
  });
}


window.BuildMindProcurementIntegration = {
  version:
    BUILDMIND_PROCUREMENT_INTEGRATION_VERSION,
  getProjectContext:
    getProcurementProjectContext,
  importWorkContexts:
    importProcurementWorkContexts,
  autoImport:
    autoImportProcurementContexts
};


window.addEventListener(
  'buildmind:project-analysis-snapshot-changed',
  function (event) {
    autoImportProcurementContexts(
      event?.detail ||
      getProcurementAnalysisSnapshot(),
      'analysis-completed'
    );
  }
);


window.addEventListener(
  'buildmind:project-core-changed',
  function () {
    autoImportProcurementContexts(
      getProcurementAnalysisSnapshot(),
      'project-context-changed'
    );
  }
);


function initializeProcurementIntegration() {
  autoImportProcurementContexts(
    getProcurementAnalysisSnapshot(),
    'initial-load'
  );
}


if (
  document.readyState === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    initializeProcurementIntegration,
    { once: true }
  );
} else {
  initializeProcurementIntegration();
}


console.info(
  'BuildMind Procurement Integration загружен:',
  BUILDMIND_PROCUREMENT_INTEGRATION_VERSION
);
