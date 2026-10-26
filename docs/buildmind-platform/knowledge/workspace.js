/*
  Виды работ в рабочем месте (BuildMind Core).

  Подключается сервером после скриптов ядра и пакетов knowledge/:
  1. База знаний ядра (window.BuildMindRoadKnowledge.works) сужается до
     видов работ проекта — распознавание, проверки и расчёты строятся
     под выбранные виды работ. Массив меняется на месте: все движки ядра
     читают его при каждом обращении.
  2. Шаблоны расхода пакетов добавляются в правила расчёта ядра.
  3. В оркестраторе ядра регистрируются диспетчер и профильные агенты.
  4. На панели проекта появляется кнопка «Виды работ»: плитки выбора
     и проверка проекта профильными агентами.
*/
(function () {
  'use strict';

  var registry = window.BuildMindDisciplines;
  if (!registry) return;

  var boot = window.BUILDMIND_WORKSPACE || null;
  var selected = registry.normalizeIds(boot && boot.project && boot.project.disciplines);

  /* ------------------------------ база знаний ------------------------------ */

  var knowledge = window.BuildMindRoadKnowledge;
  var coreRoadWorks = [];
  if (knowledge && Array.isArray(knowledge.works)) {
    coreRoadWorks = knowledge.works.filter(function (work) { return !registry.getWork(work.id); });
    var scoped = (selected.indexOf('road') >= 0 ? coreRoadWorks : []).concat(registry.worksFor(selected));
    knowledge.works.length = 0;
    Array.prototype.push.apply(knowledge.works, scoped);
  }

  function lookupWork(workId) {
    return registry.getWork(workId) || coreRoadWorks.find(function (work) { return work.id === workId; }) || null;
  }

  var planning = window.BuildMindPlanningRules;
  if (planning && Array.isArray(planning.rules)) {
    registry.rulesFor(selected).forEach(function (rule) {
      if (!planning.rules.some(function (r) { return r.id === rule.id; })) planning.rules.push(rule);
    });
  }

  /* --------------------------------- агенты --------------------------------- */

  function matchWork(workName) {
    var matcher = window.BuildMindWorkMatcher;
    return matcher && typeof matcher.find === 'function' ? matcher.find(workName) : { success: false };
  }

  // Названия работ, которые ядро уже распознало: анализ комплекта и контексты работ.
  function collectProjectWorkNames() {
    var names = [];
    var keys = ['buildmind-project-analysis-snapshot-v1', 'buildmindWorkContexts-v2-clean'];
    function walk(value, depth) {
      if (!value || depth > 8 || names.length >= 1000) return;
      if (Array.isArray(value)) {
        value.forEach(function (item) { walk(item, depth + 1); });
        return;
      }
      if (typeof value !== 'object') return;
      ['workName', 'work'].forEach(function (field) {
        if (typeof value[field] === 'string' && value[field].trim()) names.push(value[field].trim());
      });
      Object.keys(value).forEach(function (key) { walk(value[key], depth + 1); });
    }
    keys.forEach(function (key) {
      try {
        walk(JSON.parse(window.localStorage.getItem(key) || 'null'), 0);
      } catch (e) {
        // повреждённые данные ядра не должны ломать проверку
      }
    });
    return Array.from(new Set(names));
  }

  function routeWorkNames(names) {
    return names.map(function (name) {
      var match = matchWork(name);
      var route = registry.route(match);
      return {
        name: name,
        workId: match.success ? match.matchedWork.id : null,
        workName: match.success ? match.matchedWork.name : null,
        confidence: match.confidence ? match.confidence.level : 'none',
        disciplineName: route.routed ? route.disciplineName : null,
        agentName: route.routed ? route.agentName : null,
      };
    });
  }

  function reviewProject() {
    var routed = routeWorkNames(collectProjectWorkNames());
    var workIds = routed.filter(function (r) { return r.workId; }).map(function (r) { return r.workId; });
    return {
      routed: routed,
      unrecognized: routed.filter(function (r) { return !r.workId; }),
      reports: registry.review(workIds, { disciplines: selected, lookup: lookupWork }),
    };
  }

  var orchestrator = window.BuildMindAgentOrchestrator;
  if (orchestrator && typeof orchestrator.register === 'function') {
    orchestrator.register({
      id: 'discipline-dispatcher',
      taskType: 'work.route',
      label: 'Диспетчер видов работ',
      confidence: 'medium',
      run: function (input) {
        var names = Array.isArray(input && input.workNames) ? input.workNames : [];
        var routed = routeWorkNames(names);
        return {
          works: routed,
          evidence: routed.filter(function (r) { return r.workId; }).map(function (r) {
            return { sourceObject: 'knowledge:work:' + r.workId, sourceQuote: r.name };
          }),
        };
      },
    });
    registry.list().forEach(function (discipline) {
      orchestrator.register({
        id: registry.agentId(discipline.id),
        taskType: 'discipline.' + discipline.id,
        label: discipline.agent.name,
        confidence: 'medium',
        run: function (input) {
          var reports = registry.review(input && input.workIds, { lookup: lookupWork })
            .filter(function (r) { return r.disciplineId === discipline.id; });
          return {
            items: reports,
            evidence: reports.reduce(function (all, r) {
              return all.concat(r.workIds.map(function (id) { return { sourceObject: 'knowledge:work:' + id }; }));
            }, []),
          };
        },
      });
    });
  }

  window.BuildMindDisciplineWorkspace = {
    selected: selected.slice(),
    lookupWork: lookupWork,
    routeWorkNames: routeWorkNames,
    reviewProject: reviewProject,
  };

  /* ------------------------------- интерфейс ------------------------------- */

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function selectedLabel() {
    var names = selected.map(function (id) { var d = registry.get(id); return d ? d.shortName : id; });
    return names.length > 2 ? names.slice(0, 2).join(', ') + ' +' + (names.length - 2) : names.join(', ');
  }

  var STYLE = [
    '.bm-disc-btn{border:1px solid #4b5568;border-radius:6px;padding:3px 10px;background:transparent;color:#e8ebf1;font:600 12px system-ui,sans-serif;cursor:pointer}',
    '.bm-disc-btn:hover{background:#2c3442}',
    '.bm-disc-overlay{position:fixed;inset:0;z-index:2000;background:rgba(15,20,30,.45);display:flex;align-items:flex-start;justify-content:center;padding:48px 16px;overflow:auto}',
    '.bm-disc-panel{background:#fff;color:#141a26;border-radius:14px;max-width:980px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.bm-disc-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e2e6ec}',
    '.bm-disc-head h2{margin:0;font-size:17px;flex:1}',
    '.bm-disc-tabs{display:flex;gap:6px}',
    '.bm-disc-tabs button,.bm-disc-actions button{border:1px solid #cbd2dc;background:#fff;border-radius:8px;padding:6px 12px;font:600 13px system-ui,sans-serif;cursor:pointer;color:#141a26}',
    '.bm-disc-tabs button[aria-pressed=true]{background:#141a26;color:#fff;border-color:#141a26}',
    '.bm-disc-actions button.primary{background:#2563eb;border-color:#2563eb;color:#fff}',
    '.bm-disc-body{padding:16px 18px}',
    '.bm-disc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}',
    '.bm-disc-tile{display:flex;gap:10px;align-items:flex-start;text-align:left;border:2px solid #e2e6ec;background:#fff;border-radius:12px;padding:10px;cursor:pointer;font:inherit;color:inherit}',
    '.bm-disc-tile[aria-pressed=true]{border-color:#2563eb;background:#eff4ff}',
    '.bm-disc-tile:disabled{cursor:default;opacity:.75}',
    '.bm-disc-mono{flex:none;width:38px;height:38px;border-radius:9px;color:#fff;display:grid;place-items:center;font:700 13px system-ui,sans-serif}',
    '.bm-disc-tile b{display:block;font-size:13.5px}',
    '.bm-disc-tile .bm-disc-desc{display:block;font-size:12px;color:#5d6676}',
    '.bm-disc-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:12px 18px;border-top:1px solid #e2e6ec}',
    '.bm-disc-note{flex:1;font-size:12.5px;color:#5d6676}',
    '.bm-disc-agent{border:1px solid #e2e6ec;border-radius:12px;padding:12px 14px;margin-bottom:10px}',
    '.bm-disc-agent h3{margin:0 0 4px;font-size:15px}',
    '.bm-disc-agent ul{margin:6px 0;padding-left:18px}',
    '.bm-disc-finding{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 10px;margin:6px 0;font-size:13px}',
    '.bm-disc-muted{color:#5d6676;font-size:12.5px}',
    '@media (max-width:600px){.bm-disc-overlay{padding:0}.bm-disc-panel{border-radius:0;min-height:100vh}.bm-disc-head{flex-wrap:wrap}}',
  ].join('');

  function tile(discipline, pressed, disabled, onClick) {
    var button = el('button', { type: 'button', class: 'bm-disc-tile', 'aria-pressed': String(pressed) });
    if (disabled) button.disabled = true;
    var mono = el('span', { class: 'bm-disc-mono' }, registry.get(discipline.id).monogram || discipline.shortName.slice(0, 2));
    mono.style.background = discipline.color;
    var text = el('div');
    text.appendChild(el('b', null, discipline.name));
    text.appendChild(el('span', { class: 'bm-disc-desc' }, discipline.description));
    button.appendChild(mono);
    button.appendChild(text);
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  function renderDisciplinesTab(body, footer, close) {
    var draft = selected.slice();
    var canEdit = !!(boot && boot.canEdit);
    var grid = el('div', { class: 'bm-disc-grid' });
    registry.list().forEach(function (discipline) {
      var button = tile(discipline, draft.indexOf(discipline.id) >= 0, !canEdit, function () {
        var index = draft.indexOf(discipline.id);
        if (index >= 0) draft.splice(index, 1);
        else draft.push(discipline.id);
        button.setAttribute('aria-pressed', String(draft.indexOf(discipline.id) >= 0));
        apply.disabled = draft.length === 0;
      });
      grid.appendChild(button);
    });
    body.appendChild(el('p', { class: 'bm-disc-muted' },
      'Отметьте виды работ проекта. Распознавание документов, проверки, расчёты и агенты перестроятся под выбранное.'));
    body.appendChild(grid);

    var note = el('span', { class: 'bm-disc-note' }, canEdit ? '' : 'Менять виды работ может пользователь с правом редактирования проекта.');
    var apply = el('button', { type: 'button', class: 'primary' }, 'Применить');
    apply.disabled = !canEdit;
    apply.addEventListener('click', function () {
      if (!draft.length) return;
      apply.disabled = true;
      note.textContent = 'Сохраняем…';
      fetch(new URL('../api/projects/' + encodeURIComponent(boot.project.id), location.href).href, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disciplines: draft }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.data.error || 'Не удалось сохранить.');
          note.textContent = 'Сохранено. Перестраиваем рабочее место…';
          setTimeout(function () { location.reload(); }, 300);
        })
        .catch(function (err) {
          note.textContent = err.message;
          apply.disabled = false;
        });
    });
    var cancel = el('button', { type: 'button' }, 'Закрыть');
    cancel.addEventListener('click', close);
    footer.appendChild(note);
    footer.appendChild(cancel);
    footer.appendChild(apply);
  }

  function list(items, format) {
    var ul = el('ul');
    items.forEach(function (item) { ul.appendChild(el('li', null, format ? format(item) : item)); });
    return ul;
  }

  function renderAgentsTab(body, footer, close) {
    body.appendChild(el('p', { class: 'bm-disc-muted' },
      'Диспетчер относит каждую распознанную работу к виду работ и передаёт её профильному агенту. ' +
      'Агенты работают по прозрачным правилам базы знаний, без отправки данных во внешние сервисы; ' +
      'каждый вывод требует подтверждения инженером.'));
    var results = el('div');
    var agents = el('div');
    selected.forEach(function (id) {
      var pack = registry.get(id);
      var card = el('div', { class: 'bm-disc-agent' });
      card.appendChild(el('h3', null, pack.agent.name));
      card.appendChild(el('div', { class: 'bm-disc-muted' }, pack.agent.role));
      card.appendChild(list(pack.agent.focus || []));
      agents.appendChild(card);
    });
    body.appendChild(agents);
    body.appendChild(results);

    var run = el('button', { type: 'button', class: 'primary' }, 'Проверить проект агентами');
    run.addEventListener('click', function () {
      results.textContent = '';
      var review = reviewProject();
      if (!review.routed.length) {
        results.appendChild(el('p', { class: 'bm-disc-finding' },
          'В проекте пока нет распознанных работ. Загрузите документы на вкладке «Документы» и выполните анализ комплекта.'));
        return;
      }
      results.appendChild(el('h3', null, 'Результат проверки'));
      results.appendChild(el('p', { class: 'bm-disc-muted' },
        'Работ в документах: ' + review.routed.length + ', распознано: ' + (review.routed.length - review.unrecognized.length) +
        ', без надёжного распознавания: ' + review.unrecognized.length + '.'));
      review.reports.forEach(function (report) {
        var card = el('div', { class: 'bm-disc-agent' });
        card.appendChild(el('h3', null, report.agentName + (report.outsideSelection ? ' (вид работ не выбран в проекте)' : '')));
        if (report.findings.length) {
          report.findings.forEach(function (f) { card.appendChild(el('div', { class: 'bm-disc-finding' }, f.message)); });
        } else {
          card.appendChild(el('div', { class: 'bm-disc-muted' }, 'Замечаний по комплектности нет.'));
        }
        if (report.hiddenWorksActs.length) {
          card.appendChild(el('b', null, 'Акты освидетельствования скрытых работ'));
          card.appendChild(list(report.hiddenWorksActs, function (a) { return a.act + ' — ' + a.workName; }));
        }
        card.appendChild(el('b', null, 'Исполнительная документация'));
        card.appendChild(list(report.executiveDocs));
        card.appendChild(el('b', null, 'Нормативная база (справочно)'));
        card.appendChild(list(report.normatives, function (n) { return n.code + ' «' + n.title + '»'; }));
        results.appendChild(card);
      });
      if (review.unrecognized.length) {
        var card = el('div', { class: 'bm-disc-agent' });
        card.appendChild(el('h3', null, 'Нужен инженер: работы не распознаны'));
        card.appendChild(list(review.unrecognized.slice(0, 30), function (r) { return r.name; }));
        results.appendChild(card);
      }
    });
    var cancel = el('button', { type: 'button' }, 'Закрыть');
    cancel.addEventListener('click', close);
    footer.appendChild(el('span', { class: 'bm-disc-note' }, ''));
    footer.appendChild(cancel);
    footer.appendChild(run);
  }

  function openPanel(tab) {
    var overlay = el('div', { class: 'bm-disc-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Виды работ' });
    var panel = el('div', { class: 'bm-disc-panel' });
    var head = el('div', { class: 'bm-disc-head' });
    head.appendChild(el('h2', null, 'Виды работ и профильные агенты'));
    var tabs = el('div', { class: 'bm-disc-tabs' });
    var body = el('div', { class: 'bm-disc-body' });
    var footer = el('div', { class: 'bm-disc-actions' });
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(event) {
      if (event.key === 'Escape') close();
    }
    function show(name) {
      body.textContent = '';
      footer.textContent = '';
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === name)); });
      if (name === 'agents') renderAgentsTab(body, footer, close);
      else renderDisciplinesTab(body, footer, close);
    }
    [['disciplines', 'Виды работ'], ['agents', 'Агенты']].forEach(function (t) {
      var b = el('button', { type: 'button', 'data-tab': t[0] }, t[1]);
      b.addEventListener('click', function () { show(t[0]); });
      tabs.appendChild(b);
    });
    head.appendChild(tabs);
    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    show(tab || 'disciplines');
  }

  function mount() {
    var style = el('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    var button = el('button', { type: 'button', class: 'bm-disc-btn', title: 'Виды работ проекта и профильные агенты' },
      'Виды работ: ' + selectedLabel());
    button.addEventListener('click', function () { openPanel('disciplines'); });
    var bar = document.querySelector('.bm-sync-bar');
    if (bar) {
      var status = bar.querySelector('.bm-sync-status');
      bar.insertBefore(button, status || null);
    } else {
      button.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:1500;background:#1c2230';
      document.body.appendChild(button);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  console.info('BuildMind: виды работ проекта —', selectedLabel(), registry.summary());
})();
