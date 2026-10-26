/*
  Связка рабочего места (BuildMind Core из workspace/) с сервером.

  Ядро хранит проект в localStorage под ключами «buildmind…». Здесь,
  до загрузки скриптов ядра, localStorage этой страницы подменяется
  хранилищем проекта:
  - стартовые данные приходят с сервера в window.BUILDMIND_WORKSPACE;
  - изменения через секунду отправляются на сервер (PUT …/workspace);
  - при перезагрузке страницы (ядро делает её после «чистого старта»)
    несохранённое переносится через sessionStorage и сохраняется сразу
    после загрузки;
  - если проект за это время изменил кто-то другой, сервер отвечает
    конфликтом, и пользователь сам выбирает, чью версию оставить.

  Данные проекта не остаются в localStorage браузера: на общем
  компьютере следующий пользователь их не увидит. В настоящем
  localStorage остаются только настройки интерфейса (язык, вкладка).
*/
(function () {
  'use strict';

  var boot = window.BUILDMIND_WORKSPACE;
  if (!boot) return;

  var UI_KEYS = ['buildmind-ui-locale-v1', 'buildmind-workspace-active-view-v1', 'buildmind-clean-start-complete-v1'];
  var SAVE_DELAY_MS = 1000;
  var PENDING_KEY = 'buildmind-workspace-pending:' + boot.project.id;
  var apiUrl = new URL('../api/projects/' + encodeURIComponent(boot.project.id) + '/workspace', location.href).href;
  var realStorage = window.localStorage;

  function isProjectKey(key) {
    key = String(key);
    return key.indexOf('buildmind') === 0 && UI_KEYS.indexOf(key) === -1;
  }

  var data = new Map(Object.entries(boot.keys || {}));
  var version = boot.version;
  var dirty = false;
  var saving = false;
  var timer = null;
  var conflict = false;
  var lastSavedAt = null;
  // То, что сейчас лежит на сервере: одинаковое повторно не отправляем,
  // иначе каждое открытие страницы плодило бы пустые версии в истории.
  var serverJson = JSON.stringify(Object.fromEntries(data));

  // Несохранённое с прошлой загрузки этой вкладки.
  var restoredNotice = null;
  try {
    var pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    sessionStorage.removeItem(PENDING_KEY);
    if (pending && boot.canEdit) {
      if (pending.baseVersion === version) {
        data = new Map(Object.entries(pending.keys || {}));
        dirty = true;
      } else {
        restoredNotice = 'Несохранённые изменения из прошлого открытия не применены: проект уже изменён другим пользователем.';
      }
    }
  } catch (e) {
    // sessionStorage недоступен — работаем без переноса
  }

  // Паспорт проекта в ядре (projectCore.js) заводим по названию из кабинета,
  // чтобы рабочее место не начиналось с «Проект не выбран».
  var CORE_PROJECT_KEY = 'buildmind-project-core-v1';
  if (!data.has(CORE_PROJECT_KEY)) {
    var seededAt = new Date().toISOString();
    var rootId = 'project-' + boot.project.id;
    data.set(CORE_PROJECT_KEY, JSON.stringify({
      version: 'project-core-v1',
      rootProject: {
        id: rootId, parentProjectId: null, nodeType: 'root', name: boot.project.name,
        object: '', code: '', contractNumber: '', status: 'active', createdAt: seededAt, updatedAt: seededAt,
      },
      linkedProjects: [],
      archivedProjects: [],
      activeNodeId: rootId,
      timeline: { baselineSnapshotId: null, currentApprovedSnapshotId: null, latestReceivedChangeSetId: null, actualSnapshotId: null },
      createdAt: seededAt,
      updatedAt: seededAt,
    }));
    if (boot.canEdit) dirty = true;
  }

  /* ---------------------------- хранилище проекта ---------------------------- */

  var projectStorage = {
    getItem: function (key) {
      if (!isProjectKey(key)) return realStorage.getItem(key);
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    setItem: function (key, value) {
      if (!isProjectKey(key)) return realStorage.setItem(key, value);
      if (data.get(String(key)) === String(value)) return;
      data.set(String(key), String(value));
      changed();
    },
    removeItem: function (key) {
      if (!isProjectKey(key)) return realStorage.removeItem(key);
      if (data.delete(String(key))) changed();
    },
    clear: function () {
      data.clear();
      changed();
    },
    key: function (index) {
      return Array.from(data.keys())[index] || null;
    },
    get length() {
      return data.size;
    },
  };

  Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return projectStorage; } });

  /* -------------------------------- сохранение -------------------------------- */

  function snapshot() {
    return Object.fromEntries(data);
  }

  function changed() {
    if (!boot.canEdit) {
      render();
      return;
    }
    dirty = true;
    render();
    if (conflict) return;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  }

  function save(force) {
    if (!boot.canEdit || saving || (!dirty && !force)) return;
    var keysJson = JSON.stringify(snapshot());
    if (keysJson === serverJson && !force) {
      dirty = false;
      render();
      return;
    }
    saving = true;
    dirty = false;
    render();
    fetch(apiUrl, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{"baseVersion":' + JSON.stringify(version) + ',"keys":' + keysJson + '}',
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
      })
      .then(function (r) {
        saving = false;
        if (r.res.ok) {
          version = r.body.version;
          serverJson = keysJson;
          lastSavedAt = new Date();
          state.error = null;
        } else if (r.res.status === 409) {
          dirty = true;
          conflict = r.body.current || {};
        } else if (r.res.status === 401) {
          dirty = true;
          state.error = 'Сессия истекла — войдите снова в соседней вкладке, затем нажмите «Сохранить».';
        } else {
          dirty = true;
          state.error = r.body.error || ('Сервер ответил ошибкой ' + r.res.status);
        }
        render();
        if (dirty && !conflict && !state.error) timer = setTimeout(save, SAVE_DELAY_MS);
      })
      .catch(function () {
        saving = false;
        dirty = true;
        state.error = 'Нет связи с сервером. Изменения сохранятся, когда связь вернётся.';
        render();
        timer = setTimeout(save, 5000);
      });
  }

  var state = { error: null };

  // Перед уходом со страницы: несохранённое — в sessionStorage этой вкладки,
  // чтобы сохранить после перезагрузки.
  window.addEventListener('pagehide', function () {
    if (!dirty || !boot.canEdit) return;
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ baseVersion: version, keys: snapshot() }));
    } catch (e) {
      // слишком много данных для sessionStorage — остаётся предупреждение ниже
    }
  });
  window.addEventListener('beforeunload', function (event) {
    if (dirty && boot.canEdit && !sessionStorageWorks()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  function sessionStorageWorks() {
    try {
      sessionStorage.setItem('buildmind-probe', '1');
      sessionStorage.removeItem('buildmind-probe');
      return JSON.stringify(snapshot()).length < 4 * 1024 * 1024;
    } catch (e) {
      return false;
    }
  }

  /* ---------------------------------- панель ---------------------------------- */

  var bar;

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }

  function timeLabel(date) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function render() {
    if (!bar) return;
    var status = bar.querySelector('.bm-sync-status');
    var actions = bar.querySelector('.bm-sync-actions');
    actions.textContent = '';
    bar.className = 'bm-sync-bar';
    if (!boot.canEdit) {
      bar.classList.add('is-readonly');
      status.textContent = 'Только просмотр. ' + (boot.readOnlyReason || '') + ' Изменения не сохраняются.';
      return;
    }
    if (conflict) {
      bar.classList.add('is-warning');
      status.textContent = 'Проект изменил' + (conflict.updatedBy ? ' ' + conflict.updatedBy : 'и') +
        (conflict.updatedAt ? ' в ' + timeLabel(new Date(conflict.updatedAt)) : '') + '. Чью версию оставить?';
      var reload = el('button', { type: 'button' }, 'Открыть их версию');
      reload.onclick = function () {
        dirty = false;
        location.reload();
      };
      var keep = el('button', { type: 'button' }, 'Сохранить мою поверх');
      keep.onclick = function () {
        version = conflict.version;
        conflict = false;
        save(true);
      };
      actions.appendChild(reload);
      actions.appendChild(keep);
      return;
    }
    if (state.error) {
      bar.classList.add('is-warning');
      status.textContent = state.error;
      var retry = el('button', { type: 'button' }, 'Сохранить');
      retry.onclick = function () {
        state.error = null;
        save(true);
      };
      actions.appendChild(retry);
      return;
    }
    if (saving || dirty) {
      status.textContent = 'Сохранение…';
    } else {
      status.textContent = lastSavedAt ? 'Сохранено на сервере в ' + timeLabel(lastSavedAt) : 'Все изменения сохранены на сервере';
    }
    if (restoredNotice) {
      bar.classList.add('is-warning');
      status.textContent = restoredNotice;
      var ok = el('button', { type: 'button' }, 'Понятно');
      ok.onclick = function () {
        restoredNotice = null;
        render();
      };
      actions.appendChild(ok);
    }
  }

  function mountBar() {
    var style = el('style');
    style.textContent = [
      '.bm-sync-bar{position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;',
      'padding:8px 16px;background:#1c2230;color:#e8ebf1;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}',
      '.bm-sync-bar a{color:#9cc2ff;text-decoration:none;font-weight:600}',
      '.bm-sync-bar .bm-sync-project{font-weight:600}',
      '.bm-sync-bar .bm-sync-status{color:#b9c0cc;flex:1;min-width:200px}',
      '.bm-sync-bar.is-warning{background:#5c3b0b}.bm-sync-bar.is-warning .bm-sync-status{color:#ffe2b0}',
      '.bm-sync-bar.is-readonly{background:#2c3442}',
      '.bm-sync-bar button{border:0;border-radius:6px;padding:4px 10px;background:#e8ebf1;color:#1c2230;font:600 12px system-ui,sans-serif;cursor:pointer}',
      '.bm-sync-actions{display:flex;gap:6px}',
    ].join('');
    document.head.appendChild(style);
    bar = el('div', { class: 'bm-sync-bar', role: 'status' });
    var back = el('a', { href: '../app/#projects' }, '← Проекты');
    var name = el('span', { class: 'bm-sync-project' }, boot.project.name + ' · ' + boot.company.name);
    bar.appendChild(back);
    bar.appendChild(name);
    bar.appendChild(el('span', { class: 'bm-sync-status' }));
    bar.appendChild(el('span', { class: 'bm-sync-actions' }));
    document.body.insertBefore(bar, document.body.firstChild);
    render();
    if (dirty) save();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBar);
  else mountBar();
})();
