/*
  BuildMind — реестр видов работ (дисциплин) и профильных агентов.

  Один и тот же файл работает и в браузере (рабочее место, window.BuildMindDisciplines),
  и на сервере (require). Пакеты видов работ лежат в knowledge/disciplines/*.js
  и регистрируются через addPack(); нормативные ссылки — в knowledge/normatives.js.

  Агенты здесь — не «искусственный интеллект», а прозрачные правила
  инженера ПТО по своему виду работ:
  - диспетчер определяет вид работ позиции по распознанной типовой работе;
  - профильный агент проверяет комплектность (что обычно идёт вместе),
    собирает акты скрытых работ, исполнительную документацию и нормативную базу.
  Каждый вывод ссылается на запись базы знаний (evidence) и требует
  подтверждения инженером.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BuildMindDisciplines = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 'disciplines-v1';
  const DEFAULT_DISCIPLINES = ['road'];

  const packs = new Map();
  const normatives = new Map();
  const worksById = new Map();

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function fail(message) {
    throw new Error('BuildMindDisciplines: ' + message);
  }

  /* ------------------------------ регистрация ------------------------------ */

  function addNormatives(list) {
    asArray(list).forEach(function (item) {
      if (!item || !item.id || !item.code || !item.title) fail('нормативная ссылка без id/code/title');
      normatives.set(item.id, Object.freeze({ ...item }));
    });
  }

  function addPack(pack) {
    if (!pack || !/^[a-z][a-z0-9-]*$/.test(String(pack.id || ''))) fail('пакет без корректного id');
    if (!pack.name || !pack.agent || !pack.agent.name) fail(pack.id + ': нет названия или агента');
    const works = asArray(pack.works).map(function (work) {
      if (!work.id || !work.name) fail(pack.id + ': работа без id/name');
      if (worksById.has(work.id)) fail('повтор id работы ' + work.id);
      const tagged = {
        aliases: [],
        materials: [],
        typicalMissing: [],
        tools: [],
        equipment: [],
        crew: { suggestedRoles: [], note: '' },
        checks: [],
        risks: [],
        hiddenWorksActs: [],
        executiveDocs: [],
        normativeRefs: [],
        relatedWorkIds: [],
        ...work,
        categoryId: work.categoryId || pack.id,
        categoryName: work.categoryName || pack.name,
        disciplineId: pack.id,
        disciplineName: pack.name,
      };
      worksById.set(tagged.id, tagged);
      return tagged;
    });
    const stored = {
      shortName: pack.name,
      color: '#2563eb',
      description: '',
      normativeRefs: [],
      hiddenWorksActs: [],
      executiveDocs: [],
      resourceRules: [],
      sequencingRules: [],
      companionRules: [],
      ...pack,
      works,
    };
    packs.set(stored.id, stored);
    return stored;
  }

  /* -------------------------------- выборка -------------------------------- */

  function list() {
    return Array.from(packs.values())
      .sort(function (a, b) { return (a.order || 99) - (b.order || 99); })
      .map(function (pack) {
        return {
          id: pack.id,
          name: pack.name,
          shortName: pack.shortName,
          monogram: pack.monogram || pack.shortName.slice(0, 2).toUpperCase(),
          color: pack.color,
          description: pack.description,
          worksCount: pack.usesCoreRoadKnowledge ? null : pack.works.length,
          agent: { name: pack.agent.name, role: pack.agent.role || '' },
        };
      });
  }

  function get(id) {
    return packs.get(id) || null;
  }

  function has(id) {
    return packs.has(id);
  }

  // Только известные id, без повторов; пустой выбор — дорожные работы (как было до дисциплин).
  function normalizeIds(ids) {
    const unique = Array.from(new Set(asArray(ids).map(String))).filter(has);
    return unique.length ? unique : DEFAULT_DISCIPLINES.filter(has);
  }

  function packsFor(ids) {
    return normalizeIds(ids).map(get);
  }

  function worksFor(ids) {
    return packsFor(ids).reduce(function (all, pack) { return all.concat(pack.works); }, []);
  }

  function allWorks() {
    return Array.from(worksById.values());
  }

  function getWork(id) {
    return worksById.get(id) || null;
  }

  function rulesFor(ids) {
    return packsFor(ids).reduce(function (all, pack) { return all.concat(asArray(pack.resourceRules)); }, []);
  }

  function sequencingRulesFor(ids) {
    return packsFor(ids).reduce(function (all, pack) { return all.concat(asArray(pack.sequencingRules)); }, []);
  }

  function getNormative(id) {
    return normatives.get(id) || null;
  }

  function resolveNormatives(ids) {
    return Array.from(new Set(asArray(ids))).map(getNormative).filter(Boolean);
  }

  // Вид работ типовой работы: из пакета; работы дорожной базы ядра — «road».
  function disciplineOfWork(workId, workItem) {
    const own = getWork(workId);
    if (own) return own.disciplineId;
    if (workItem && workItem.disciplineId) return workItem.disciplineId;
    return workId ? 'road' : null;
  }

  /* --------------------------------- агенты --------------------------------- */

  function agentId(disciplineId) {
    return 'discipline-' + disciplineId + '-agent';
  }

  // Что профильный агент знает о работе: акты, документы, нормативы, проверки.
  function describeWork(workId, workItem) {
    const disciplineId = disciplineOfWork(workId, workItem);
    const pack = get(disciplineId);
    if (!pack) return null;
    // Работы дорожной базы ядра описаны в пакете дополнениями (workExtras).
    const extra = (pack.workExtras && pack.workExtras[workId]) || {};
    const work = { ...(workItem || {}), ...(getWork(workId) || {}), ...extra };
    const ownRefs = asArray(work.normativeRefs);
    return {
      workId: workId,
      workName: work.name || '',
      disciplineId: pack.id,
      disciplineName: pack.name,
      agentId: agentId(pack.id),
      agentName: pack.agent.name,
      checks: asArray(work.checks),
      risks: asArray(work.risks),
      hiddenWorksActs: asArray(work.hiddenWorksActs),
      executiveDocs: asArray(work.executiveDocs),
      normatives: resolveNormatives(ownRefs.length ? ownRefs : pack.normativeRefs),
    };
  }

  /*
    Проверка профильных агентов по набору распознанных работ.
    workIds — id типовых работ, найденных в документах (ГПР, ВОР, рабочее место).
    options.lookup(workId) — работа из внешней базы (дорожная база ядра), для названий.
    Возвращает по одному отчёту на каждый задействованный вид работ.
  */
  function review(workIds, options) {
    const settings = options || {};
    const present = new Set(asArray(workIds).filter(Boolean));
    const selected = settings.disciplines ? normalizeIds(settings.disciplines) : null;
    const lookup = function (id) {
      return getWork(id) || (typeof settings.lookup === 'function' ? settings.lookup(id) : null);
    };
    const byDiscipline = new Map();
    present.forEach(function (workId) {
      const disciplineId = disciplineOfWork(workId);
      if (!disciplineId || !has(disciplineId)) return;
      if (!byDiscipline.has(disciplineId)) byDiscipline.set(disciplineId, []);
      byDiscipline.get(disciplineId).push(workId);
    });

    const reports = [];
    byDiscipline.forEach(function (ids, disciplineId) {
      const pack = get(disciplineId);
      const findings = [];
      asArray(pack.companionRules).forEach(function (rule) {
        if (!present.has(rule.ifWork)) return;
        const missing = asArray(rule.expect).filter(function (id) { return !present.has(id); });
        if (!missing.length) return;
        findings.push({
          type: 'missing-companion',
          ruleId: rule.id,
          workId: rule.ifWork,
          missingWorkIds: missing,
          missingWorkNames: missing.map(function (id) { const w = lookup(id); return w ? w.name : id; }),
          message: rule.message,
          evidence: [{ sourceObject: 'knowledge:' + pack.id + ':companion:' + rule.id }],
        });
      });

      const acts = [];
      const docs = [];
      const refs = [];
      ids.forEach(function (workId) {
        const info = describeWork(workId, lookup(workId));
        if (!info) return;
        info.hiddenWorksActs.forEach(function (act) { acts.push({ workId: workId, workName: info.workName, act: act }); });
        info.executiveDocs.forEach(function (doc) { if (docs.indexOf(doc) === -1) docs.push(doc); });
        info.normatives.forEach(function (n) { if (!refs.some(function (r) { return r.id === n.id; })) refs.push(n); });
      });
      asArray(pack.executiveDocs).forEach(function (doc) { if (docs.indexOf(doc) === -1) docs.push(doc); });
      resolveNormatives(pack.normativeRefs).forEach(function (n) { if (!refs.some(function (r) { return r.id === n.id; })) refs.push(n); });

      reports.push({
        agentId: agentId(pack.id),
        agentName: pack.agent.name,
        agentRole: pack.agent.role || '',
        disciplineId: pack.id,
        disciplineName: pack.name,
        outsideSelection: selected ? selected.indexOf(pack.id) === -1 : false,
        workIds: ids,
        findings: findings,
        hiddenWorksActs: acts,
        executiveDocs: docs,
        normatives: refs,
        disclaimer: 'Проверка по шаблонам базы знаний BuildMind. Требует подтверждения инженером ПТО; ' +
          'действующие редакции нормативных документов сверяйте по официальным перечням.',
      });
    });
    return reports.sort(function (a, b) { return (get(a.disciplineId).order || 99) - (get(b.disciplineId).order || 99); });
  }

  // Диспетчер: по результату сопоставления строки определяет вид работ и агента.
  function route(match) {
    if (!match || !match.success || !match.matchedWork) {
      return { routed: false, agentId: 'discipline-dispatcher', reason: 'Работа не распознана — нужен инженер.' };
    }
    const disciplineId = disciplineOfWork(match.matchedWork.id, match.matchedWork);
    const pack = get(disciplineId);
    return {
      routed: !!pack,
      disciplineId: disciplineId,
      disciplineName: pack ? pack.name : '',
      agentId: pack ? agentId(pack.id) : 'discipline-dispatcher',
      agentName: pack ? pack.agent.name : '',
    };
  }

  function summary() {
    return {
      version: VERSION,
      disciplines: packs.size,
      works: worksById.size,
      normatives: normatives.size,
      resourceRules: Array.from(packs.values()).reduce(function (n, p) { return n + asArray(p.resourceRules).length; }, 0),
    };
  }

  return {
    version: VERSION,
    DEFAULT_DISCIPLINES: DEFAULT_DISCIPLINES,
    addPack: addPack,
    addNormatives: addNormatives,
    list: list,
    get: get,
    has: has,
    normalizeIds: normalizeIds,
    worksFor: worksFor,
    allWorks: allWorks,
    getWork: getWork,
    rulesFor: rulesFor,
    sequencingRulesFor: sequencingRulesFor,
    getNormative: getNormative,
    resolveNormatives: resolveNormatives,
    disciplineOfWork: disciplineOfWork,
    agentId: agentId,
    describeWork: describeWork,
    review: review,
    route: route,
    summary: summary,
  };
});
