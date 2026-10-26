// Лендинг: тарифы из API и форма заявки на пилот.
(function () {
  var money = function (v) { return new Intl.NumberFormat('ru-RU').format(v) + ' ₽'; };
  fetch('api/plans').then(function (r) { return r.json(); }).then(function (data) {
    var yearly = (data.periods || []).find(function (p) { return p.months === 12; });
    document.getElementById('trialNote').textContent = 'Пробный период ' + data.trialDays + ' дней — без оплаты и без привязки карты.';
    document.getElementById('plans').innerHTML = data.plans.filter(function (p) { return p.id !== 'trial'; }).map(function (p) {
      return '<div class="plan' + (p.id === 'team' ? ' featured' : '') + '"><h3>' + p.name + '</h3>' +
        '<p class="price">' + (p.monthlyPrice ? money(p.monthlyPrice) + '<small> / месяц</small>' : 'по договору') + '</p>' +
        '<p>' + p.description + '</p><ul>' +
        '<li>' + (p.maxUsers == null ? 'Сотрудники без ограничений' : 'До ' + p.maxUsers + ' сотрудников') + '</li>' +
        '<li>' + (p.maxProjects == null ? 'Проекты без ограничений' : 'До ' + p.maxProjects + ' проектов') + '</li>' +
        (p.monthlyPrice && yearly ? '<li>При оплате за год — скидка ' + yearly.discountPercent + '%</li>' : '') +
        '</ul><a class="btn' + (p.id === 'team' ? ' primary' : '') + '" href="' + (p.selfService ? 'app/#signup' : '#pilot') + '">' +
        (p.selfService ? 'Начать с пробного периода' : 'Обсудить условия') + '</a></div>';
    }).join('');
    if (data.contact && (data.contact.email || data.contact.phone)) {
      document.getElementById('contacts').textContent = [data.contact.email, data.contact.phone].filter(Boolean).join(' · ');
    }
  }).catch(function () {
    document.getElementById('plans').innerHTML = '<p>Тарифы временно недоступны — напишите нам через форму пилота.</p>';
  });

  // Виды работ и профильные агенты — из того же реестра, что использует сервис.
  var escapeHtml = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  fetch('api/disciplines').then(function (r) { return r.json(); }).then(function (data) {
    document.getElementById('disciplineTiles').innerHTML = data.disciplines.map(function (d) {
      return '<div class="disc"><span class="disc-mono" style="background:' + escapeHtml(d.color) + '">' + escapeHtml(d.monogram) + '</span>' +
        '<div><h3>' + escapeHtml(d.name) + '</h3><p>' + escapeHtml(d.description) + '</p>' +
        '<p class="disc-agent">' + escapeHtml(d.agent.name) + '</p></div></div>';
    }).join('');
    var s = data.summary || {};
    document.getElementById('disciplinesNote').textContent =
      'В базе: видов работ — ' + s.disciplines + ', типовых работ сверх дорожной базы — ' + s.works +
      ', нормативных документов (справочно: номер и название) — ' + s.normatives +
      '. Шаблоны проверяет инженер — это подсказка, а не норматив.';
  }).catch(function () {
    document.getElementById('disciplines').hidden = true;
  });

  var form = document.getElementById('leadForm');
  var status = document.getElementById('leadStatus');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var payload = { name: fd.get('name'), company: fd.get('company'), contact: fd.get('contact'), message: fd.get('message'), consent: fd.get('consent') === 'on' };
    if (!payload.name || !payload.contact) { status.textContent = 'Укажите имя и телефон или email.'; return; }
    if (!payload.consent) { status.textContent = 'Отметьте согласие на обработку персональных данных.'; return; }
    status.textContent = 'Отправляем…';
    fetch('api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) { status.textContent = r.d.error || 'Не удалось отправить.'; return; }
        form.reset();
        status.textContent = 'Спасибо! Свяжемся с вами в течение рабочего дня.';
      })
      .catch(function () { status.textContent = 'Нет связи с сервером, попробуйте ещё раз.'; });
  });
})();
