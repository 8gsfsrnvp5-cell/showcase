'use strict';

/* ==================================================
   BUILDMIND PROJECT SESSION — V1

   Отделяет данные живого проекта от настроек
   интерфейса и выполняет полный чистый старт.
   ================================================== */

const BUILDMIND_PROJECT_SESSION_VERSION =
  'project-session-v1';

const BUILDMIND_LIVE_PROJECT_STORAGE_KEYS =
  Object.freeze([
    'buildmind-procurement-data-v2-clean',
    'buildmind-material-archive-v1',
    'buildmind-material-history-v1',
    'buildmindWorkContexts-v2-clean',
    'buildmindActiveContextId-v2-clean',
    'buildmind-material-candidate-reviews-v2-clean',
    'buildmind-project-core-v1',
    'buildmind-document-registry-v1',
    'buildmind-change-sets-v1',
    'buildmind-truth-review-v1'
  ]);

const BUILDMIND_WORKSPACE_VIEW_STORAGE_KEY =
  'buildmind-workspace-active-view-v1';

const BUILDMIND_CLEAN_START_NOTICE_KEY =
  'buildmind-clean-start-complete-v1';


function getProjectSessionStorage(
  storage,
  fallbackName
) {
  if (storage) {
    return storage;
  }

  if (
    typeof window !== 'undefined' &&
    window[fallbackName]
  ) {
    return window[fallbackName];
  }

  return null;
}


function resetBuildMindLiveProject(
  options = {}
) {
  const projectStorage =
    getProjectSessionStorage(
      options.localStorage,
      'localStorage'
    );

  const noticeStorage =
    getProjectSessionStorage(
      options.sessionStorage,
      'sessionStorage'
    );

  const nextView =
    options.nextView ||
    'documents';

  if (!projectStorage) {
    throw new Error(
      'Хранилище проекта недоступно.'
    );
  }

  BUILDMIND_LIVE_PROJECT_STORAGE_KEYS
    .forEach(
      function (storageKey) {
        projectStorage.removeItem(
          storageKey
        );
      }
    );

  projectStorage.setItem(
    BUILDMIND_WORKSPACE_VIEW_STORAGE_KEY,
    nextView
  );

  const notice = {
    version:
      BUILDMIND_PROJECT_SESSION_VERSION,
    completedAt:
      new Date().toISOString(),
    nextView,
    clearedKeys:
      [
        ...BUILDMIND_LIVE_PROJECT_STORAGE_KEYS
      ]
  };

  if (noticeStorage) {
    try {
      noticeStorage.setItem(
        BUILDMIND_CLEAN_START_NOTICE_KEY,
        JSON.stringify(notice)
      );
    } catch (error) {
      console.warn(
        'BuildMind: не удалось сохранить уведомление о чистом старте:',
        error
      );
    }
  }

  return notice;
}


function consumeBuildMindCleanStartNotice(
  storage
) {
  const noticeStorage =
    getProjectSessionStorage(
      storage,
      'sessionStorage'
    );

  if (!noticeStorage) {
    return null;
  }

  try {
    const saved =
      noticeStorage.getItem(
        BUILDMIND_CLEAN_START_NOTICE_KEY
      );

    noticeStorage.removeItem(
      BUILDMIND_CLEAN_START_NOTICE_KEY
    );

    if (!saved) {
      return null;
    }

    const parsed =
      JSON.parse(saved);

    return (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    )
      ? parsed
      : null;
  } catch (error) {
    console.warn(
      'BuildMind: не удалось прочитать уведомление о чистом старте:',
      error
    );

    return null;
  }
}


function showBuildMindCleanStartNotice() {
  if (
    typeof document === 'undefined'
  ) {
    return;
  }

  const notice =
    consumeBuildMindCleanStartNotice();

  if (!notice) {
    return;
  }

  const message =
    document.getElementById(
      'documentsMessage'
    );

  if (!message) {
    return;
  }

  message.textContent =
    'Чистый живой проект готов. ' +
    'Старые материалы, документы, история и изменения удалены. ' +
    'Выберите первый реальный PDF, XLSX, XLS или CSV.';

  message.classList.add(
    'clean-project-ready'
  );
}


function clearBuildMindCleanStartNoticeStyle() {
  if (
    typeof document === 'undefined'
  ) {
    return;
  }

  document
    .getElementById(
      'documentsMessage'
    )
    ?.classList
    .remove(
      'clean-project-ready'
    );
}


function handleBuildMindCleanProjectClick(
  event
) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const confirmed =
    window.confirm(
      'Начать новый чистый проект?\n\n' +
      'Будут очищены материалы, контексты работ, ' +
      'структура проекта, реестр редакций, пакеты изменений, ' +
      'решения по кандидатам, архив и история текущего проекта, ' +
      'а также текущий список документов.\n\n' +
      'Настройки языка сохранятся.'
    );

  if (!confirmed) {
    return;
  }

  resetBuildMindLiveProject({
    nextView:
      'documents'
  });

  window.location.reload();
}


function initializeBuildMindProjectSessionUi() {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  const cleanProjectButton =
    document.getElementById(
      'newCleanProjectBtn'
    );

  cleanProjectButton?.addEventListener(
    'click',
    handleBuildMindCleanProjectClick,
    true
  );

  document
    .getElementById(
      'projectDocumentsInput'
    )
    ?.addEventListener(
      'change',
      clearBuildMindCleanStartNoticeStyle,
      true
    );

  document
    .getElementById(
      'documentsDropZone'
    )
    ?.addEventListener(
      'drop',
      clearBuildMindCleanStartNoticeStyle,
      true
    );

  if (
    document.readyState ===
    'complete'
  ) {
    window.setTimeout(
      showBuildMindCleanStartNotice,
      0
    );
  } else {
    window.addEventListener(
      'load',
      showBuildMindCleanStartNotice,
      {
        once: true
      }
    );
  }
}


const BuildMindProjectSession = {
  version:
    BUILDMIND_PROJECT_SESSION_VERSION,

  liveProjectStorageKeys:
    [
      ...BUILDMIND_LIVE_PROJECT_STORAGE_KEYS
    ],

  resetLiveProject:
    resetBuildMindLiveProject,

  consumeCleanStartNotice:
    consumeBuildMindCleanStartNotice
};


if (typeof window !== 'undefined') {
  window.BuildMindProjectSession =
    BuildMindProjectSession;

  initializeBuildMindProjectSessionUi();
}


if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports =
    BuildMindProjectSession;
}
