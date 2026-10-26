'use strict';

/* ==================================================
   BUILDMIND WORKSPACE UI — V1

   Переключает существующие модули
   между рабочими зонами,
   не меняя их ID и бизнес-логику.
   ================================================== */

const BUILDMIND_WORKSPACE_VERSION =
  'workspace-ui-v1';

const BUILDMIND_WORKSPACE_STORAGE_KEY =
  'buildmind-workspace-active-view-v1';


const BUILDMIND_WORKSPACE_VIEWS = [
  {
    id: 'dashboard',
    label: 'Главная'
  },

  {
    id: 'documents',
    label: 'Документы'
  },

  {
    id: 'works',
    label: 'Работы и ГПР'
  },

  {
    id: 'materials',
    label: 'Материалы'
  },

  {
    id: 'changes',
    label: 'Изменения'
  },

  {
    id: 'history',
    label: 'История'
  },

  {
    id: 'project',
    label: 'Проект'
  }
];


function escapeWorkspaceHtml(value) {
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


function getWorkspaceElement(id) {
  return document.getElementById(
    id
  );
}


function getWorkspaceText(
  id,
  fallback = '0'
) {
  const element =
    getWorkspaceElement(id);

  const value =
    element
      ? element.textContent.trim()
      : '';

  return value || fallback;
}


function createWorkspaceView(id) {
  const view =
    document.createElement(
      'section'
    );

  view.id =
    `workspaceView-${id}`;

  view.className =
    'workspace-view';

  view.dataset.workspaceView =
    id;

  view.hidden =
    true;

  return view;
}


function createWorkspacePageHeader(
  title,
  description
) {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'card workspace-page-header';

  section.innerHTML = `
    <div>
      <span class="workspace-page-eyebrow">
        BUILDMIND WORKSPACE
      </span>

      <h2>
        ${escapeWorkspaceHtml(title)}
      </h2>

      <p class="muted">
        ${escapeWorkspaceHtml(description)}
      </p>
    </div>
  `;

  return section;
}


function createWorkspacePlaceholder(
  title,
  text
) {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'card workspace-placeholder-card';

  section.innerHTML = `
    <h2>
      ${escapeWorkspaceHtml(title)}
    </h2>

    <p>
      ${escapeWorkspaceHtml(text)}
    </p>

    <div class="workspace-placeholder-note">
      Модуль будет подключён поверх уже
      сохранённой истории проекта без
      перезаписи предыдущих данных.
    </div>
  `;

  return section;
}


function createWorkspaceNavigation() {
  const topbar =
    document.querySelector(
      '.topbar'
    );

  if (
    !topbar ||
    getWorkspaceElement(
      'buildMindWorkspaceNav'
    )
  ) {
    return null;
  }


  const nav =
    document.createElement(
      'nav'
    );

  nav.id =
    'buildMindWorkspaceNav';

  nav.className =
    'workspace-nav';

  nav.setAttribute(
    'aria-label',
    'Разделы BuildMind'
  );


  nav.innerHTML = `
    <div class="workspace-nav-inner">

      ${
        BUILDMIND_WORKSPACE_VIEWS
          .map(
            function (view) {
              return `
                <button
                  type="button"
                  class="workspace-nav-button"
                  data-workspace-target="${escapeWorkspaceHtml(
                    view.id
                  )}"
                >
                  ${escapeWorkspaceHtml(
                    view.label
                  )}
                </button>
              `;
            }
          )
          .join('')
      }

    </div>
  `;


  topbar.insertAdjacentElement(
    'afterend',
    nav
  );

  return nav;
}


function createDashboardProjectCard() {
  const section =
    document.createElement(
      'section'
    );

  section.id =
    'workspaceDashboardProject';

  section.className =
    'card workspace-dashboard-project';


  section.innerHTML = `
    <div class="workspace-dashboard-project-main">

      <div>
        <span class="workspace-page-eyebrow">
          ТЕКУЩИЙ ПРОЕКТ
        </span>

        <h2 id="workspaceDashboardProjectName">
          Проект не выбран
        </h2>

        <p
          id="workspaceDashboardProjectObject"
          class="muted"
        >
          Объект: —
        </p>
      </div>


      <div class="workspace-dashboard-active-node">
        <span>
          Активный пакет
        </span>

        <strong id="workspaceDashboardActiveNode">
          —
        </strong>
      </div>

    </div>


    <div class="workspace-quick-actions">

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="project"
      >
        Проект
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="documents"
      >
        Документы
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="materials"
      >
        Материалы
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="works"
      >
        Работы и ГПР
      </button>

    </div>
  `;

  return section;
}


function createDashboardOverview() {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'workspace-dashboard-overview';


  section.innerHTML = `
    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            ТЕКУЩАЯ РАБОТА
          </span>

          <h3 id="workspaceCurrentWork">
            —
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="works"
        >
          Открыть
        </button>
      </div>


      <dl class="workspace-mini-list">

        <div>
          <dt>Проект</dt>
          <dd id="workspaceCurrentProject">—</dd>
        </div>

        <div>
          <dt>Объект</dt>
          <dd id="workspaceCurrentObject">—</dd>
        </div>

        <div>
          <dt>Начало</dt>
          <dd id="workspaceCurrentStart">—</dd>
        </div>

        <div>
          <dt>Окончание</dt>
          <dd id="workspaceCurrentEnd">—</dd>
        </div>

      </dl>

    </article>


    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            ДОКУМЕНТЫ
          </span>

          <h3>
            Состояние документации
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="documents"
        >
          Открыть
        </button>
      </div>


      <div class="workspace-mini-stats">

        <div>
          <strong id="workspaceDocsTotal">0</strong>
          <span>Документов</span>
        </div>

        <div>
          <strong id="workspaceDocsCurrent">0</strong>
          <span>Действующих</span>
        </div>

        <div>
          <strong id="workspaceDocsReview">0</strong>
          <span>На проверке</span>
        </div>

      </div>

    </article>


    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            МАТЕРИАЛЫ
          </span>

          <h3>
            Оперативная обеспеченность
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="materials"
        >
          Открыть
        </button>
      </div>


      <div class="workspace-mini-stats">

        <div>
          <strong id="workspaceMaterialsCritical">0</strong>
          <span>Критические</span>
        </div>

        <div>
          <strong id="workspaceMaterialsOrder">0</strong>
          <span>Заказать</span>
        </div>

        <div>
          <strong id="workspaceMaterialsExpected">0</strong>
          <span>Поставки</span>
        </div>

      </div>

    </article>
  `;

  return section;
}


function getWorkspaceAnalysisSnapshot() {
  if (
    !window.BuildMindProjectAnalysis ||
    typeof window.BuildMindProjectAnalysis.getSnapshot !==
      'function'
  ) {
    return null;
  }

  return window.BuildMindProjectAnalysis.getSnapshot();
}


function createWorkspaceAnalysisSummary() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisSummary';
  section.className =
    'card workspace-analysis-summary';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          ПОСЛЕДНИЙ АНАЛИЗ КОМПЛЕКТА
        </span>
        <h2>Данные ВОР и ГПР</h2>
        <p id="workspaceAnalysisSavedAt" class="muted">
          Анализ ещё не выполнен
        </p>
      </div>
      <span
        id="workspaceAnalysisStatus"
        class="workspace-analysis-status workspace-analysis-status-empty"
      >
        Нет данных
      </span>
    </div>

    <div class="workspace-analysis-stats">
      <div><strong id="workspaceAnalysisDocuments">0</strong><span>Документов</span></div>
      <div><strong id="workspaceAnalysisVorRows">0</strong><span id="workspaceAnalysisVorRowsLabel">Строк ВОР</span></div>
      <div><strong id="workspaceAnalysisGprRows">0</strong><span id="workspaceAnalysisGprRowsLabel">Строк ГПР</span></div>
      <div><strong id="workspaceAnalysisMatched">0</strong><span>Связано ВОР ↔ ГПР</span></div>
      <div><strong id="workspaceAnalysisReview">0</strong><span>Требует проверки</span></div>
    </div>

    <div class="workspace-analysis-actions">
      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="works"
      >
        Открыть работы и ГПР
      </button>
      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="documents"
      >
        Открыть документы
      </button>
    </div>
  `;

  return section;
}


function createWorkspaceAnalysisWorks() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisWorks';
  section.className =
    'card workspace-analysis-table-card';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          СКВОЗНАЯ СВЕРКА
        </span>
        <h2>Ведомость работ и календарный график</h2>
        <p class="muted">
          Строки ГПР связаны с ВОР по коду и наименованию.
          Исходные значения не перезаписываются.
        </p>
      </div>
      <div class="workspace-analysis-head-actions">
        <span id="workspaceWorksAnalysisStatus" class="workspace-analysis-status">
          Нет данных
        </span>
        <button
          id="workspaceImportGprContextsBtn"
          type="button"
          class="secondary-btn workspace-analysis-import-btn"
        >
          Создать контексты из ГПР
        </button>
      </div>
    </div>

    <p id="workspaceGprContextImportStatus" class="muted workspace-analysis-import-status">
      После заполнения проекта и объекта сроки ГПР можно перенести в рабочие контексты снабжения.
    </p>

    <div class="workspace-analysis-stats workspace-analysis-stats-compact">
      <div><strong id="workspaceWorksVorCount">0</strong><span>ВОР</span></div>
      <div><strong id="workspaceWorksGprCount">0</strong><span>ГПР</span></div>
      <div><strong id="workspaceWorksMatchedCount">0</strong><span>Связано</span></div>
      <div><strong id="workspaceWorksReviewCount">0</strong><span>Проверить</span></div>
    </div>

    <div class="table-wrap workspace-analysis-table-wrap">
      <table class="workspace-analysis-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Работа</th>
            <th>Ед.</th>
            <th>Количество ВОР</th>
            <th>Количество ГПР</th>
            <th>Начало</th>
            <th>Окончание</th>
            <th>Связь</th>
            <th>Достоверность</th>
            <th>Источник</th>
          </tr>
        </thead>
        <tbody id="workspaceAnalysisWorksRows">
          <tr><td colspan="10">Анализ комплекта ещё не выполнен.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  return section;
}


function createWorkspaceAnalysisMaterials() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisMaterials';
  section.className =
    'card workspace-analysis-table-card';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          ИЗ ДОКУМЕНТОВ ПРОЕКТА
        </span>
        <h2>Материалы, найденные анализом</h2>
        <p class="muted">
          Кандидаты показаны отдельно от подтверждённого реестра материалов.
          Перенос выполняется только после действия инженера.
        </p>
      </div>
      <span id="workspaceAnalysisMaterialsCount" class="workspace-analysis-status">
        0 позиций
      </span>
    </div>

    <div class="table-wrap workspace-analysis-table-wrap">
      <table class="workspace-analysis-table">
        <thead>
          <tr>
            <th>Материал</th>
            <th>Ед.</th>
            <th>Количество</th>
            <th>Достоверность</th>
            <th>Источник</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody id="workspaceAnalysisMaterialRows">
          <tr><td colspan="6">Материалы анализом не найдены.</td></tr>
        </tbody>
      </table>
    </div>

    <p id="workspaceAnalysisMaterialsMessage" class="muted workspace-analysis-import-status">
      Найденные позиции не влияют на закупочный расчёт, пока инженер не перенесёт их в контроль снабжения.
    </p>
  `;

  return section;
}


function createWorkspaceTruthReview() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceTruthReview';
  section.className =
    'card workspace-truth-review';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          КОНТРАКТ ДОСТОВЕРНОСТИ
        </span>
        <h2>Спорные моменты / Требует проверки</h2>
        <p class="muted">
          Значения без источника, конфликты ВОР и ГПР, ненайденные и
          непрочитанные данные. Фактом считается только значение,
          подтверждённое инженером ПТО, руководителем или администратором
          проекта. Исходные значения анализа сохраняются в истории.
        </p>
      </div>
      <label class="workspace-truth-filter">
        Показать
        <select id="workspaceTruthReviewFilter">
          <option value="open">Спорные (открытые)</option>
          <option value="pending">Ожидают подтверждения</option>
          <option value="resolved">Решённые</option>
          <option value="all">Все</option>
        </select>
      </label>
    </div>

    <div class="workspace-analysis-stats workspace-analysis-stats-compact">
      <div><strong id="workspaceTruthOpenCount">0</strong><span>Открыто</span></div>
      <div><strong id="workspaceTruthConflictCount">0</strong><span>Конфликтов</span></div>
      <div><strong id="workspaceTruthResolvedCount">0</strong><span>Решено</span></div>
      <div><strong id="workspaceTruthPendingCount">0</strong><span>Ожидают подтверждения</span></div>
      <div><strong id="workspaceTruthConfirmedCount">0</strong><span>Подтверждённых значений</span></div>
    </div>

    <p id="workspaceTruthReviewMessage" class="muted workspace-analysis-import-status">
      После анализа комплекта здесь появятся спорные значения.
    </p>

    <p id="workspaceTruthSubjectBar" class="workspace-truth-subject-bar" hidden>
      <span></span>
      <button type="button" class="small-btn secondary-btn" data-truth-subject-reset>
        Показать все строки
      </button>
    </p>

    <div id="workspaceTruthReviewList" class="workspace-truth-list"></div>
  `;

  return section;
}


const WORKSPACE_TRUTH_REVIEW_LIMIT = 50;

let workspaceTruthReviewIdentity = {
  role: '',
  user: ''
};

let workspaceTruthSubjectFilter = '';


function renderWorkspaceTruthSourceCell(row) {
  const truth = getWorkspaceTruthReview();
  const sources = [
    ['ВОР', row.vorSource],
    ['ГПР', row.gprSource]
  ].filter(function (entry) {
    return entry[1];
  });

  if (!truth || sources.length === 0) {
    const pages = (row.sourcePages || []).length > 0
      ? ' · стр. ' + row.sourcePages.join(', ')
      : '';

    return ((row.sourceDocuments || []).join(', ') || '—') + pages;
  }

  return sources.map(function (entry) {
    return entry[0] + ': ' + truth.describeSource(entry[1]);
  }).join('; ');
}


function renderWorkspaceTruthRowAction(subjectId) {
  return `
    <button
      type="button"
      class="small-btn secondary-btn workspace-truth-row-action"
      data-truth-subject="${escapeWorkspaceHtml(subjectId)}"
    >
      Проверить
    </button>
  `;
}


function openWorkspaceTruthSubject(subjectId) {
  const filter = getWorkspaceElement('workspaceTruthReviewFilter');

  workspaceTruthSubjectFilter = subjectId || '';

  if (filter) {
    filter.value = 'all';
  }

  if (subjectId) {
    openBuildMindWorkspaceView('works', { persist: false, scroll: false });
  }

  renderWorkspaceAnalysis();

  if (subjectId) {
    getWorkspaceElement('workspaceTruthReview')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}


function getWorkspaceTruthReview() {
  return window.BuildMindTruthReview || null;
}


function getWorkspaceTruthModel(snapshot) {
  const truth = getWorkspaceTruthReview();

  return truth && snapshot
    ? truth.buildModel(snapshot)
    : null;
}


function formatWorkspaceTruthValue(value, unit) {
  const truth = getWorkspaceTruthReview();

  if (value == null || value === '' || value === truth?.unknown) {
    return '—';
  }

  const text = typeof value === 'number'
    ? formatWorkspaceAnalysisQuantity(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? formatWorkspaceAnalysisDate(value)
      : String(value);

  return unit ? text + ' ' + unit : text;
}


function renderWorkspaceTruthBadge(status) {
  const truth = getWorkspaceTruthReview();

  if (!truth || !status) {
    return '<span class="workspace-truth-badge">—</span>';
  }

  return `
    <span class="workspace-truth-badge workspace-truth-badge-${escapeWorkspaceHtml(status)}">
      ${escapeWorkspaceHtml(truth.statusLabels[status] || status)}
    </span>
  `;
}


function renderWorkspaceTruthHistoryEntry(entry) {
  const change = entry.action === 'assign'
    ? ' · ' + (entry.responsible || '—') + ', срок ' +
      (entry.dueDate ? formatWorkspaceAnalysisDate(entry.dueDate) : '—')
    : ': ' + formatWorkspaceTruthValue(entry.previousValue, entry.unit) +
      ' → ' + formatWorkspaceTruthValue(entry.newValue, entry.unit);

  return `
    <li>
      ${escapeWorkspaceHtml(new Date(entry.decidedAt).toLocaleString('ru-RU'))} ·
      ${escapeWorkspaceHtml(entry.roleLabel + ' ' + entry.user)} ·
      ${escapeWorkspaceHtml(entry.actionLabel + change)}
      ${entry.reason ? ' · основание: ' + escapeWorkspaceHtml(entry.reason) : ''}
      ${entry.documentRef ? ' · документ: ' + escapeWorkspaceHtml(entry.documentRef) : ''}
      ${entry.comment ? ' · ' + escapeWorkspaceHtml(entry.comment) : ''}
    </li>
  `;
}


function renderWorkspaceTruthDispute(dispute) {
  const truth = getWorkspaceTruthReview();
  const riskLabels = {
    high: 'Высокий риск',
    medium: 'Средний риск',
    low: 'Низкий риск'
  };
  const roleOptions = Object.keys(truth.roles).map(function (role) {
    return `<option value="${escapeWorkspaceHtml(role)}" ${
      workspaceTruthReviewIdentity.role === role ? 'selected' : ''
    }>${escapeWorkspaceHtml(truth.roles[role])}</option>`;
  }).join('');
  const sourceOptions = dispute.values.map(function (item, index) {
    return `<option value="${index}">${escapeWorkspaceHtml(
      item.label + ': ' + formatWorkspaceTruthValue(item.value, item.unit)
    )}</option>`;
  }).join('');
  const history = Array.isArray(dispute.history) ? dispute.history : [];
  const decision = dispute.decision;

  return `
    <article
      class="workspace-truth-item workspace-truth-risk-${escapeWorkspaceHtml(dispute.risk)}"
      data-truth-dispute-id="${escapeWorkspaceHtml(dispute.disputeId)}"
    >
      <div class="workspace-truth-item-head">
        <div>
          <strong>${escapeWorkspaceHtml(dispute.subjectLabel)}</strong>
          <p class="muted">${escapeWorkspaceHtml(dispute.fieldLabel)}</p>
        </div>
        <div class="workspace-truth-item-badges">
          ${renderWorkspaceTruthBadge(dispute.status)}
          <span class="workspace-truth-risk">${escapeWorkspaceHtml(riskLabels[dispute.risk] || dispute.risk)}</span>
        </div>
      </div>

      <div class="table-wrap">
        <table class="workspace-truth-values">
          <thead>
            <tr><th>Источник</th><th>Значение</th><th>Документ и страница</th></tr>
          </thead>
          <tbody>
            ${dispute.values.map(function (item) {
              return `
                <tr>
                  <td>${escapeWorkspaceHtml(item.label)}</td>
                  <td><strong>${escapeWorkspaceHtml(formatWorkspaceTruthValue(item.value, item.unit))}</strong></td>
                  <td>${escapeWorkspaceHtml(item.sourceLabel)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <p><strong>Причина:</strong> ${escapeWorkspaceHtml(dispute.reason)}</p>
      <p class="muted"><strong>Что проверить:</strong> ${escapeWorkspaceHtml(dispute.checkHint)}</p>
      <p class="muted">
        Ответственный: ${escapeWorkspaceHtml(dispute.responsible || 'не назначен')} ·
        срок проверки: ${escapeWorkspaceHtml(dispute.dueDate ? formatWorkspaceAnalysisDate(dispute.dueDate) : 'не задан')}
      </p>
      ${
        decision
          ? `<p class="workspace-truth-decision">
              <strong>Решение:</strong>
              ${escapeWorkspaceHtml(decision.actionLabel)} —
              ${escapeWorkspaceHtml(formatWorkspaceTruthValue(dispute.currentValue, dispute.currentUnit))}.
              ${escapeWorkspaceHtml(decision.roleLabel + ' ' + decision.user)},
              ${escapeWorkspaceHtml(new Date(decision.decidedAt).toLocaleString('ru-RU'))}.
              ${decision.comment ? 'Комментарий: ' + escapeWorkspaceHtml(decision.comment) : ''}
            </p>`
          : ''
      }

      <details class="workspace-truth-form">
        <summary>Решение инженера</summary>
        <div class="workspace-truth-form-grid">
          <label>Роль
            <select data-truth-field="role">
              <option value="">— выберите —</option>
              ${roleOptions}
            </select>
          </label>
          <label>ФИО
            <input data-truth-field="user" value="${escapeWorkspaceHtml(workspaceTruthReviewIdentity.user)}" />
          </label>
          <label class="workspace-truth-wide">Основание (обязательно)
            <input data-truth-field="reason" placeholder="Например: сверено с подписанной ВОР, стр. 4" />
          </label>
          <label>Источник значения
            <select data-truth-field="sourceIndex">${sourceOptions}</select>
          </label>
          <label>Исправленное значение
            <input data-truth-field="newValue" />
          </label>
          <label>Ед. изм.
            <input data-truth-field="unit" value="${escapeWorkspaceHtml(dispute.currentUnit || '')}" />
          </label>
          <label>Документ или фото
            <input data-truth-field="documentRef" placeholder="Файл, страница или фото" />
          </label>
          <label>Ответственный
            <input data-truth-field="responsible" value="${escapeWorkspaceHtml(dispute.responsible || '')}" />
          </label>
          <label>Срок проверки
            <input data-truth-field="dueDate" type="date" value="${escapeWorkspaceHtml(dispute.dueDate || '')}" />
          </label>
          <label class="workspace-truth-wide">Комментарий
            <input data-truth-field="comment" />
          </label>
        </div>
        <div class="workspace-truth-actions">
          <button type="button" class="small-btn" data-truth-action="confirm-source">Подтвердить значение из источника</button>
          ${dispute.values.length > 1 ? '<button type="button" class="small-btn" data-truth-action="choose-source">Выбрать указанный источник</button>' : ''}
          <button type="button" class="small-btn" data-truth-action="manual-value">Ввести исправленное значение</button>
          <button type="button" class="small-btn" data-truth-action="keep-unknown">Оставить неизвестным</button>
          <button type="button" class="small-btn" data-truth-action="reject">Отклонить вывод</button>
          <button type="button" class="small-btn" data-truth-action="rerecognize">Вернуть на распознавание</button>
          <button type="button" class="small-btn secondary-btn" data-truth-action="assign">Назначить ответственного</button>
        </div>
        <p class="muted workspace-truth-form-message" data-truth-message></p>
      </details>

      ${
        history.length > 0
          ? `<details class="workspace-truth-history">
              <summary>История решений (${history.length})</summary>
              <ol>${history.map(renderWorkspaceTruthHistoryEntry).join('')}</ol>
            </details>`
          : ''
      }
    </article>
  `;
}


function renderWorkspaceTruthReview(model) {
  const list = getWorkspaceElement('workspaceTruthReviewList');
  const filter = getWorkspaceElement('workspaceTruthReviewFilter')?.value || 'open';
  const summary = model?.summary || {};

  setWorkspaceAnalysisText('workspaceTruthOpenCount', summary.openDisputesCount || 0);
  setWorkspaceAnalysisText('workspaceTruthConflictCount', summary.conflictCount || 0);
  setWorkspaceAnalysisText('workspaceTruthResolvedCount', summary.resolvedDisputesCount || 0);
  setWorkspaceAnalysisText('workspaceTruthConfirmedCount', summary.confirmedCount || 0);
  setWorkspaceAnalysisText('workspaceTruthPendingCount', summary.pendingConfirmationCount || 0);

  if (!list) {
    return;
  }

  if (!getWorkspaceTruthReview()) {
    list.innerHTML = '<p class="muted">Модуль контракта достоверности не загружен.</p>';
    return;
  }

  if (!model) {
    list.innerHTML = '';
    setWorkspaceProcurementStatus(
      'workspaceTruthReviewMessage',
      'После анализа комплекта здесь появятся спорные значения.'
    );
    return;
  }

  const pool = {
    open: model.openDisputes,
    pending: model.pendingConfirmations,
    resolved: model.disputes.concat(model.confirmations).filter(function (item) {
      return item.resolved;
    }),
    all: model.disputes.concat(model.confirmations)
  }[filter] || model.openDisputes;
  const disputes = workspaceTruthSubjectFilter
    ? pool.filter(function (item) {
        return item.subjectId === workspaceTruthSubjectFilter;
      })
    : pool;
  const subjectLabel = workspaceTruthSubjectFilter
    ? model.records.find(function (record) {
        return record.subjectId === workspaceTruthSubjectFilter;
      })?.subjectLabel || workspaceTruthSubjectFilter
    : '';
  const subjectFilterBar = getWorkspaceElement('workspaceTruthSubjectBar');

  if (subjectFilterBar) {
    subjectFilterBar.hidden = !workspaceTruthSubjectFilter;
    subjectFilterBar.querySelector('span').textContent =
      'Показаны значения: ' + subjectLabel;
  }

  setWorkspaceProcurementStatus(
    'workspaceTruthReviewMessage',
    model.disputes.length === 0 && filter === 'open'
      ? 'Спорных значений не найдено. Извлечённые значения остаются неподтверждёнными до проверки инженера — см. фильтр «Ожидают подтверждения».'
      : disputes.length > WORKSPACE_TRUTH_REVIEW_LIMIT
        ? `Показаны первые ${WORKSPACE_TRUTH_REVIEW_LIMIT} из ${disputes.length}.`
        : ''
  );

  list.innerHTML = disputes.length === 0
    ? '<p class="muted">В выбранном фильтре записей нет.</p>'
    : disputes
        .slice(0, WORKSPACE_TRUTH_REVIEW_LIMIT)
        .map(renderWorkspaceTruthDispute)
        .join('');
}


function submitWorkspaceTruthDecision(button) {
  const card = button.closest('[data-truth-dispute-id]');
  const truth = getWorkspaceTruthReview();
  const message = card?.querySelector('[data-truth-message]');

  if (!card || !truth) {
    return null;
  }

  const decision = {
    action: button.dataset.truthAction
  };

  card.querySelectorAll('[data-truth-field]').forEach(function (field) {
    decision[field.dataset.truthField] = field.value;
  });

  const result = truth.applyDecision(
    getWorkspaceAnalysisSnapshot(),
    card.dataset.truthDisputeId,
    decision
  );

  if (!result.success) {
    if (message) {
      message.textContent = result.message;
    }
    return result;
  }

  workspaceTruthReviewIdentity = {
    role: decision.role,
    user: decision.user
  };

  // Событие buildmind:truth-review-changed перерисует экран.
  setWorkspaceProcurementStatus('workspaceTruthReviewMessage', result.message);

  return result;
}


function setWorkspaceAnalysisText(id, value) {
  const element = getWorkspaceElement(id);

  if (element) {
    element.textContent = String(value ?? '');
  }
}


function formatWorkspaceAnalysisQuantity(value) {
  // Пустое значение — неизвестно, а не ноль: Number(null) === 0.
  if (value == null || String(value).trim() === '') {
    return '—';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toLocaleString('ru-RU', {
    maximumFractionDigits: 4
  });
}


function formatWorkspaceAnalysisDate(value) {
  if (!value) {
    return '—';
  }

  const isoDate = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (isoDate) {
    return [
      isoDate[3],
      isoDate[2],
      isoDate[1]
    ].join('.');
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('ru-RU');
}


function getWorkspaceAnalysisContextCount() {
  if (
    !window.BuildMindWorkContexts ||
    typeof window.BuildMindWorkContexts
      .getAll !== 'function'
  ) {
    return 0;
  }

  return window.BuildMindWorkContexts
    .getAll()
    .filter(
      function (context) {
        return (
          context.sourceType ===
          'analysis-gpr'
        );
      }
    )
    .length;
}


function setWorkspaceProcurementStatus(
  elementId,
  message
) {
  const element =
    getWorkspaceElement(elementId);

  if (element) {
    element.textContent =
      message || '';
  }
}


function importWorkspaceAnalysisContexts() {
  const integration =
    window.BuildMindProcurementIntegration;

  if (
    !integration ||
    typeof integration.importWorkContexts !==
      'function'
  ) {
    setWorkspaceProcurementStatus(
      'workspaceGprContextImportStatus',
      'Модуль связи ГПР со снабжением не загружен.'
    );
    return null;
  }

  const result =
    integration.importWorkContexts({
      source:
        'workspace-button',
      safetyDays: 2
    });

  renderWorkspaceAnalysis();
  updateWorkspaceDashboard();

  setWorkspaceProcurementStatus(
    'workspaceGprContextImportStatus',
    result.message ||
      'Перенос контекстов завершён.'
  );

  return result;
}


function isWorkspaceAnalysisMaterialTransferred(
  candidate
) {
  return Boolean(
    window.BuildMindProcurement &&
    typeof window.BuildMindProcurement
      .isAnalysisMaterialTransferred ===
      'function' &&
    window.BuildMindProcurement
      .isAnalysisMaterialTransferred(
        candidate
      )
  );
}


function prepareWorkspaceAnalysisMaterial(
  materialIndex
) {
  const snapshot =
    getWorkspaceAnalysisSnapshot();
  const candidate =
    snapshot?.materials?.[
      Number(materialIndex)
    ];
  const procurement =
    window.BuildMindProcurement;

  if (!candidate) {
    setWorkspaceProcurementStatus(
      'workspaceAnalysisMaterialsMessage',
      'Позиция анализа не найдена. Повторите анализ комплекта.'
    );
    return null;
  }

  if (
    getWorkspaceTruthModel(snapshot)
      ?.subjectStatus[
        'material-' + Number(materialIndex)
      ] === 'rejected'
  ) {
    setWorkspaceProcurementStatus(
      'workspaceAnalysisMaterialsMessage',
      'Позиция отклонена инженером и не переносится в контроль снабжения.'
    );
    return null;
  }

  if (
    !procurement ||
    typeof procurement
      .prepareAnalysisMaterial !==
      'function'
  ) {
    setWorkspaceProcurementStatus(
      'workspaceAnalysisMaterialsMessage',
      'Модуль контроля снабжения не загружен.'
    );
    return null;
  }

  const result =
    procurement.prepareAnalysisMaterial(
      candidate
    );

  setWorkspaceProcurementStatus(
    'workspaceAnalysisMaterialsMessage',
    result.success
      ? 'Позиция подготовлена. Проверьте форму ниже и подтвердите добавление в расчёт.'
      : result.message ||
        'Позицию не удалось подготовить.'
  );

  return result;
}


function renderWorkspaceAnalysis() {
  const snapshot = getWorkspaceAnalysisSnapshot();
  const summary = snapshot?.summary || {};
  const truthModel = getWorkspaceTruthModel(snapshot);
  const subjectStatus = truthModel?.subjectStatus || {};
  const reviewCount = truthModel
    ? truthModel.summary.openDisputesCount
    : summary.reviewCount || 0;
  const statusLabels = {
    complete: 'Анализ завершён',
    review: 'Нужна проверка',
    blocked: 'Анализ заблокирован'
  };

  setWorkspaceAnalysisText(
    'workspaceAnalysisDocuments',
    summary.documentsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisVorRows',
    summary.workVolumeRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisGprRows',
    summary.scheduleRowsCount || 0
  );

  const rawVorRowsCount =
    Number(summary.workVolumeRowsRawCount) ||
    Number(summary.workVolumeRowsCount) ||
    0;
  const rawGprRowsCount =
    Number(summary.scheduleRowsRawCount) ||
    Number(summary.scheduleRowsCount) ||
    0;
  const uniqueVorRowsCount =
    Number(summary.workVolumeRowsCount) ||
    0;
  const uniqueGprRowsCount =
    Number(summary.scheduleRowsCount) ||
    0;
  const vorRowsLabel =
    getWorkspaceElement(
      'workspaceAnalysisVorRowsLabel'
    );
  const gprRowsLabel =
    getWorkspaceElement(
      'workspaceAnalysisGprRowsLabel'
    );

  if (vorRowsLabel) {
    vorRowsLabel.textContent =
      rawVorRowsCount > uniqueVorRowsCount
        ? `Уникальные строки ВОР · исходных ${rawVorRowsCount}`
        : 'Строк ВОР';
  }

  if (gprRowsLabel) {
    gprRowsLabel.textContent =
      rawGprRowsCount > uniqueGprRowsCount
        ? `Уникальные строки ГПР · исходных ${rawGprRowsCount}`
        : 'Строк ГПР';
  }
  setWorkspaceAnalysisText(
    'workspaceAnalysisMatched',
    summary.matchedScheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisReview',
    reviewCount
  );
  setWorkspaceAnalysisText(
    'workspaceWorksVorCount',
    summary.workVolumeRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksGprCount',
    summary.scheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksMatchedCount',
    summary.matchedScheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksReviewCount',
    reviewCount
  );

  const status = getWorkspaceElement('workspaceAnalysisStatus');
  const worksStatus = getWorkspaceElement('workspaceWorksAnalysisStatus');
  const statusText = snapshot
    ? statusLabels[snapshot.qualityStatus] || 'Результат сохранён'
    : 'Нет данных';

  [status, worksStatus].filter(Boolean).forEach(function (element) {
    element.textContent = statusText;
    element.className =
      'workspace-analysis-status workspace-analysis-status-' +
      (snapshot?.qualityStatus || 'empty');
  });

  const importContextsButton =
    getWorkspaceElement(
      'workspaceImportGprContextsBtn'
    );
  const importedContextsCount =
    getWorkspaceAnalysisContextCount();

  if (importContextsButton) {
    importContextsButton.disabled =
      !snapshot ||
      Number(
        summary.scheduleRowsCount || 0
      ) === 0;
  }

  setWorkspaceProcurementStatus(
    'workspaceGprContextImportStatus',
    !snapshot
      ? 'Сначала выполните анализ комплекта ВОР/ГПР.'
      : importedContextsCount > 0
        ? `Из ГПР создано рабочих контекстов: ${importedContextsCount}. Сроки участвуют в расчёте потребности и крайней даты заказа.`
        : 'Заполните проект и объект, затем создайте рабочие контексты из сроков ГПР.'
  );

  setWorkspaceAnalysisText(
    'workspaceAnalysisSavedAt',
    snapshot
      ? 'Сохранено: ' +
        new Date(snapshot.savedAt).toLocaleString('ru-RU') +
        '. Данные восстановятся после обновления страницы.'
      : 'Анализ ещё не выполнен'
  );

  const worksBody =
    getWorkspaceElement('workspaceAnalysisWorksRows');

  if (worksBody) {
    const rows = Array.isArray(snapshot?.combinedRows)
      ? snapshot.combinedRows
      : [];
    const relationLabels = {
      matched: 'ВОР ↔ ГПР',
      'schedule-only': 'Только ГПР',
      'volume-only': 'Только ВОР'
    };

    worksBody.innerHTML = rows.length === 0
      ? '<tr><td colspan="10">Анализ комплекта ещё не дал строк ВОР/ГПР.</td></tr>'
      : rows.slice(0, 500).map(function (row) {
          return `
            <tr class="${row.requiresReview ? 'workspace-analysis-row-review' : ''}">
              <td>${escapeWorkspaceHtml(row.workCode || '—')}</td>
              <td><strong>${escapeWorkspaceHtml(row.workName || '—')}</strong></td>
              <td>${escapeWorkspaceHtml(row.unit || '—')}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(row.vorQuantity))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(row.gprQuantity))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisDate(row.startDate))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisDate(row.finishDate))}</td>
              <td>
                <span class="workspace-analysis-relation workspace-analysis-relation-${escapeWorkspaceHtml(row.status)}">
                  ${escapeWorkspaceHtml(relationLabels[row.status] || row.status)}
                </span>
                ${row.requiresReview ? '<span class="workspace-analysis-review-flag">Проверить</span>' : ''}
              </td>
              <td>
                ${renderWorkspaceTruthBadge(subjectStatus[row.rowId])}
                ${truthModel ? renderWorkspaceTruthRowAction(row.rowId) : ''}
              </td>
              <td>${escapeWorkspaceHtml(renderWorkspaceTruthSourceCell(row))}</td>
            </tr>
          `;
        }).join('');
  }

  const materialBody =
    getWorkspaceElement('workspaceAnalysisMaterialRows');
  const materials = Array.isArray(snapshot?.materials)
    ? snapshot.materials
    : [];

  setWorkspaceAnalysisText(
    'workspaceAnalysisMaterialsCount',
    materials.length + ' поз.'
  );

  if (materialBody) {
    materialBody.innerHTML = materials.length === 0
      ? '<tr><td colspan="6">Материалы анализом не найдены.</td></tr>'
      : materials.slice(0, 500).map(function (item, index) {
          const source = getWorkspaceTruthReview()
            ? getWorkspaceTruthReview().describeSource(item)
            : (item.sourceDocuments || []).join(', ') || '—';
          const truthStatus = subjectStatus['material-' + index];
          const rejected = truthStatus === 'rejected';
          const transferred =
            isWorkspaceAnalysisMaterialTransferred(
              item
            );

          return `
            <tr>
              <td><strong>${escapeWorkspaceHtml(item.workName || '—')}</strong></td>
              <td>${escapeWorkspaceHtml(item.unit || '—')}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(item.quantity))}</td>
              <td>
                ${renderWorkspaceTruthBadge(truthStatus)}
                ${truthModel ? renderWorkspaceTruthRowAction('material-' + index) : ''}
              </td>
              <td>${escapeWorkspaceHtml(source)}</td>
              <td>
                <button
                  type="button"
                  class="small-btn workspace-analysis-material-action"
                  data-analysis-material-index="${index}"
                  ${transferred || rejected ? 'disabled' : ''}
                >
                  ${transferred ? 'Перенесено' : rejected ? 'Отклонено' : 'В контроль снабжения'}
                </button>
              </td>
            </tr>
          `;
        }).join('');
  }

  renderWorkspaceTruthReview(truthModel);
}


function moveWorkspaceNode(
  node,
  target
) {
  if (
    node &&
    target
  ) {
    target.appendChild(
      node
    );
  }
}


function buildWorkspaceViews() {
  const layout =
    document.querySelector(
      'main.layout'
    );


  if (
    !layout ||
    getWorkspaceElement(
      'buildMindWorkspaceViews'
    )
  ) {
    return null;
  }


  const operationalCenter =
    getWorkspaceElement(
      'operationalControlCenter'
    );

  const projectData =
    getWorkspaceElement(
      'projectDataSection'
    );

  const projectCore =
    getWorkspaceElement(
      'projectCoreSection'
    );

const projectIntake =
  getWorkspaceElement(
    'projectIntakeSection'
  );
   
  const projectDocuments =
    getWorkspaceElement(
      'projectDocumentsSection'
    );

  const documentRegistry =
    getWorkspaceElement(
      'documentRegistrySection'
    );

  const changeSetSection =
    getWorkspaceElement(
      'changeSetSection'
    );

  const assistant =
    document.querySelector(
      '.assistant-card'
    );

  const materialsTable =
    getWorkspaceElement(
      'materialsTableSection'
    );

  const materialManagement =
    getWorkspaceElement(
      'materialManagementSection'
    );

  const materialArchive =
    getWorkspaceElement(
      'materialArchiveSection'
    );

  const materialHistory =
    getWorkspaceElement(
      'materialHistorySection'
    );

  const contextLayout =
    document.querySelector(
      '.context-layout'
    );


  const host =
    document.createElement(
      'div'
    );

  host.id =
    'buildMindWorkspaceViews';

  host.className =
    'workspace-views';

  layout.appendChild(
    host
  );


  const views = {};


  BUILDMIND_WORKSPACE_VIEWS
    .forEach(
      function (
        viewDefinition
      ) {
        const view =
          createWorkspaceView(
            viewDefinition.id
          );

        views[
          viewDefinition.id
        ] = view;

        host.appendChild(
          view
        );
      }
    );


  /*
    ==================================================
    ГЛАВНАЯ
    ==================================================
  */

  views.dashboard.appendChild(
    createDashboardProjectCard()
  );

  views.dashboard.appendChild(
    createWorkspaceAnalysisSummary()
  );

  moveWorkspaceNode(
    operationalCenter,
    views.dashboard
  );

  views.dashboard.appendChild(
    createDashboardOverview()
  );

  moveWorkspaceNode(
    assistant,
    views.dashboard
  );


  /*
    ==================================================
    ДОКУМЕНТЫ
    ==================================================
  */

  views.documents.appendChild(
    createWorkspacePageHeader(
      'Документы проекта',

      'Загрузка файлов, действующие редакции, ' +
      'новые версии и история документации проекта.'
    )
  );

moveWorkspaceNode(
  projectIntake,
  views.documents
);
   
  moveWorkspaceNode(
    projectDocuments,
    views.documents
  );

  moveWorkspaceNode(
    documentRegistry,
    views.documents
  );


  /*
    ==================================================
    РАБОТЫ И ГПР
    ==================================================
  */

  views.works.appendChild(
    createWorkspacePageHeader(
      'Работы и ГПР',

      'Рабочие контексты, объёмы, сроки ' +
      'и будущий план-факт по графику производства работ.'
    )
  );

  moveWorkspaceNode(
    contextLayout,
    views.works
  );

  views.works.appendChild(
    createWorkspaceAnalysisWorks()
  );

  views.works.appendChild(
    createWorkspaceTruthReview()
  );


  /*
    ==================================================
    МАТЕРИАЛЫ
    ==================================================
  */

  views.materials.appendChild(
    createWorkspacePageHeader(
      'Материалы',

      'Полный реестр потребности, остатков, ' +
      'резервов, поставок, дефицита и риска по материалам.'
    )
  );

  views.materials.appendChild(
    createWorkspaceAnalysisMaterials()
  );

  moveWorkspaceNode(
    materialsTable,
    views.materials
  );

  moveWorkspaceNode(
    materialManagement,
    views.materials
  );

  moveWorkspaceNode(
    materialArchive,
    views.materials
  );


  /*
    ==================================================
    ИЗМЕНЕНИЯ
    ==================================================
  */

  views.changes.appendChild(
    createWorkspacePageHeader(
      'Изменения проекта',

      'Новые редакции, дополнительные ВОР, ' +
      'изменения ГПР и влияние изменений ' +
      'на работы, сроки и ресурсы.'
    )
  );

  moveWorkspaceNode(
    changeSetSection,
    views.changes
  );

  if (!changeSetSection) {
    views.changes.appendChild(
      createWorkspacePlaceholder(
        'Изменений пока нет',

        'Зарегистрируйте новую редакцию документа, ' +
        'чтобы сравнить работы, объёмы, материалы и даты.'
      )
    );
  }


  /*
    ==================================================
    ИСТОРИЯ
    ==================================================
  */

  views.history.appendChild(
    createWorkspacePageHeader(
      'История проекта',

      'Хронология редакций, утверждений, ' +
      'дополнительных соглашений и будущих ' +
      'фактических событий проекта.'
    )
  );

  moveWorkspaceNode(
    materialHistory,
    views.history
  );

  if (!materialHistory) {
    views.history.appendChild(
      createWorkspacePlaceholder(
        'Хронология будет формироваться автоматически',

        'История будет сохранять редакцию 1 → редакцию 2 → редакцию 3, ' +
        'пакеты изменений, утверждения и изменения ' +
        'без удаления прошлого.'
      )
    );
  }


  /*
    ==================================================
    ПРОЕКТ
    ==================================================
  */

  views.project.appendChild(
    createWorkspacePageHeader(
      'Проект',

      'Паспорт проекта, основные даты, договор ' +
      'и связанные проекты / пакеты.'
    )
  );

  moveWorkspaceNode(
    projectData,
    views.project
  );

  moveWorkspaceNode(
    projectCore,
    views.project
  );


  return views;
}


function updateWorkspaceDashboard() {
  let root =
    null;

  let activeNode =
    null;


  if (
    window.BuildMindProjectCore &&
    typeof window
      .BuildMindProjectCore
      .getRoot ===
      'function'
  ) {
    root =
      window.BuildMindProjectCore
        .getRoot();
  }


  if (
    window.BuildMindProjectCore &&
    typeof window
      .BuildMindProjectCore
      .getActiveNode ===
      'function'
  ) {
    activeNode =
      window.BuildMindProjectCore
        .getActiveNode();
  }


  const projectName =
    root?.name ||
    getWorkspaceElement(
      'projectName'
    )?.value ||
    'Проект не выбран';


  const objectName =
    root?.object ||
    getWorkspaceElement(
      'objectName'
    )?.value ||
    '—';


  const activeLabel =
    activeNode
      ? [
          activeNode.code,
          activeNode.name
        ]
          .filter(Boolean)
          .join(' · ')
      : '—';


  const projectNameElement =
    getWorkspaceElement(
      'workspaceDashboardProjectName'
    );

  const objectElement =
    getWorkspaceElement(
      'workspaceDashboardProjectObject'
    );

  const activeElement =
    getWorkspaceElement(
      'workspaceDashboardActiveNode'
    );


  if (projectNameElement) {
    projectNameElement.textContent =
      projectName;
  }


  if (objectElement) {
    objectElement.textContent =
      `Объект: ${objectName}`;
  }


  if (activeElement) {
    activeElement.textContent =
      activeLabel;
  }


  const mirrorPairs = [
    [
      'currentProject',
      'workspaceCurrentProject'
    ],

    [
      'currentObject',
      'workspaceCurrentObject'
    ],

    [
      'currentWork',
      'workspaceCurrentWork'
    ],

    [
      'currentStartDate',
      'workspaceCurrentStart'
    ],

    [
      'currentEndDate',
      'workspaceCurrentEnd'
    ]
  ];


  mirrorPairs.forEach(
    function (
      [
        sourceId,
        targetId
      ]
    ) {
      const source =
        getWorkspaceElement(
          sourceId
        );

      const target =
        getWorkspaceElement(
          targetId
        );

      if (target) {
        target.textContent =
          source
            ?.textContent
            ?.trim() ||
          '—';
      }
    }
  );


  const registryDocuments =
    getWorkspaceText(
      'documentRegistryDocumentsCount'
    );

  const registryCurrent =
    getWorkspaceText(
      'documentRegistryCurrentCount'
    );

  const registryReview =
    getWorkspaceText(
      'documentRegistryReviewCount'
    );


  const docsTotal =
    getWorkspaceElement(
      'workspaceDocsTotal'
    );

  const docsCurrent =
    getWorkspaceElement(
      'workspaceDocsCurrent'
    );

  const docsReview =
    getWorkspaceElement(
      'workspaceDocsReview'
    );


  if (docsTotal) {
    docsTotal.textContent =
      registryDocuments;
  }

  if (docsCurrent) {
    docsCurrent.textContent =
      registryCurrent;
  }

  if (docsReview) {
    docsReview.textContent =
      registryReview;
  }


  const materialCritical =
    getWorkspaceElement(
      'workspaceMaterialsCritical'
    );

  const materialOrder =
    getWorkspaceElement(
      'workspaceMaterialsOrder'
    );

  const materialExpected =
    getWorkspaceElement(
      'workspaceMaterialsExpected'
    );


  if (materialCritical) {
    materialCritical.textContent =
      getWorkspaceText(
        'criticalCount'
      );
  }


  if (materialOrder) {
    materialOrder.textContent =
      getWorkspaceText(
        'warningCount'
      );
  }


  if (materialExpected) {
    materialExpected.textContent =
      getWorkspaceText(
        'expectedDeliveryCount'
      );
  }
}


function getSavedWorkspaceView() {
  const saved =
    localStorage.getItem(
      BUILDMIND_WORKSPACE_STORAGE_KEY
    );


  const exists =
    BUILDMIND_WORKSPACE_VIEWS
      .some(
        function (view) {
          return (
            view.id ===
            saved
          );
        }
      );


  return exists
    ? saved
    : 'dashboard';
}


function openBuildMindWorkspaceView(
  viewId,
  options = {}
) {
  const exists =
    BUILDMIND_WORKSPACE_VIEWS
      .some(
        function (view) {
          return (
            view.id ===
            viewId
          );
        }
      );


  const targetView =
    exists
      ? viewId
      : 'dashboard';


  document
    .querySelectorAll(
      '[data-workspace-view]'
    )
    .forEach(
      function (view) {
        const isActive =
          view
            .dataset
            .workspaceView ===
          targetView;

        view.hidden =
          !isActive;

        view.classList.toggle(
          'workspace-view-active',
          isActive
        );
      }
    );


  document
    .querySelectorAll(
      '[data-workspace-target]'
    )
    .forEach(
      function (button) {
        const isActive =
          button
            .dataset
            .workspaceTarget ===
          targetView;

        button.classList.toggle(
          'active',
          isActive
        );

        button.setAttribute(
          'aria-current',

          isActive
            ? 'page'
            : 'false'
        );
      }
    );


  if (
    options.persist !==
    false
  ) {
    localStorage.setItem(
      BUILDMIND_WORKSPACE_STORAGE_KEY,
      targetView
    );
  }


  updateWorkspaceDashboard();


  if (
    options.scroll !==
    false
  ) {
    window.scrollTo(
      {
        top: 0,
        behavior: 'smooth'
      }
    );
  }


  window.dispatchEvent(
    new CustomEvent(
      'buildmind:workspace-view-changed',

      {
        detail: {
          viewId:
            targetView
        }
      }
    )
  );
}


function initializeWorkspaceObservers() {
  const ids = [
    'criticalCount',
    'warningCount',
    'expectedDeliveryCount',

    'documentRegistryDocumentsCount',
    'documentRegistryCurrentCount',
    'documentRegistryReviewCount',

    'currentProject',
    'currentObject',
    'currentWork',
    'currentStartDate',
    'currentEndDate'
  ];


  const targets =
    ids
      .map(
        getWorkspaceElement
      )
      .filter(Boolean);


  if (
    targets.length > 0 &&
    window.MutationObserver
  ) {
    const observer =
      new MutationObserver(
        updateWorkspaceDashboard
      );


    targets.forEach(
      function (target) {
        observer.observe(
          target,

          {
            childList: true,
            subtree: true,
            characterData: true
          }
        );
      }
    );
  }


  window.addEventListener(
    'buildmind:project-core-changed',
    updateWorkspaceDashboard
  );


  window.addEventListener(
    'buildmind:document-registry-changed',
    updateWorkspaceDashboard
  );


  window.addEventListener(
    'buildmind:project-analysis-snapshot-changed',
    function () {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();
    }
  );


  window.addEventListener(
    'buildmind:truth-review-changed',
    function () {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();
    }
  );


  window.addEventListener(
    'buildmind:materials-changed',
    function () {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();
    }
  );


  window.addEventListener(
    'buildmind:work-contexts-changed',
    function () {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();
    }
  );


  window.addEventListener(
    'buildmind:procurement-integration-changed',
    function (event) {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();

      if (event?.detail?.message) {
        setWorkspaceProcurementStatus(
          'workspaceGprContextImportStatus',
          event.detail.message
        );
      }
    }
  );
}


function initializeBuildMindWorkspace() {
  if (
    window
      .BuildMindWorkspace
      ?.initialized ===
    true
  ) {
    return;
  }


  const nav =
    createWorkspaceNavigation();

  const views =
    buildWorkspaceViews();


  if (
    !nav ||
    !views
  ) {
    console.warn(
      'BuildMind Workspace: ' +
      'не удалось создать рабочую оболочку.'
    );

    return;
  }


  nav.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-workspace-target]'
        );

      if (!button) {
        return;
      }

      openBuildMindWorkspaceView(
        button
          .dataset
          .workspaceTarget
      );
    }
  );


  document.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-workspace-open]'
        );

      if (!button) {
        return;
      }

      openBuildMindWorkspaceView(
        button
          .dataset
          .workspaceOpen
      );
    }
  );


  document.addEventListener(
    'click',
    function (event) {
      const importContextsButton =
        event.target.closest(
          '#workspaceImportGprContextsBtn'
        );

      if (importContextsButton) {
        importWorkspaceAnalysisContexts();
        return;
      }

      const truthButton =
        event.target.closest(
          '[data-truth-action]'
        );

      if (truthButton) {
        submitWorkspaceTruthDecision(
          truthButton
        );
        return;
      }

      const truthSubjectButton =
        event.target.closest(
          '[data-truth-subject]'
        );

      if (truthSubjectButton) {
        openWorkspaceTruthSubject(
          truthSubjectButton.dataset
            .truthSubject
        );
        return;
      }

      if (
        event.target.closest(
          '[data-truth-subject-reset]'
        )
      ) {
        openWorkspaceTruthSubject('');
        return;
      }

      const materialButton =
        event.target.closest(
          '[data-analysis-material-index]'
        );

      if (materialButton) {
        prepareWorkspaceAnalysisMaterial(
          materialButton.dataset
            .analysisMaterialIndex
        );
      }
    }
  );


  document.addEventListener(
    'change',
    function (event) {
      if (
        event.target.id ===
        'workspaceTruthReviewFilter'
      ) {
        renderWorkspaceAnalysis();
      }
    }
  );


  initializeWorkspaceObservers();

  updateWorkspaceDashboard();
  renderWorkspaceAnalysis();


  window
    .BuildMindWorkspace
    .initialized =
    true;


  openBuildMindWorkspaceView(
    getSavedWorkspaceView(),

    {
      persist: false,
      scroll: false
    }
  );
}


window.BuildMindWorkspace = {
  version:
    BUILDMIND_WORKSPACE_VERSION,

  initialized:
    false,

  open:
    openBuildMindWorkspaceView,

  refresh:
    updateWorkspaceDashboard,

  getActiveView:
    function () {
      return (
        document
          .querySelector(
            '[data-workspace-view]:not([hidden])'
          )
          ?.dataset
          .workspaceView ||
        'dashboard'
      );
    }
};


initializeBuildMindWorkspace();


console.info(
  'BuildMind Workspace загружен:',
  BUILDMIND_WORKSPACE_VERSION
);
