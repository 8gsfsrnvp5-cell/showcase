// The app may be served from a sub-path (static demo); assets live in <base>/assets/.
const APP_BASE = new URL("..", document.currentScript.src).pathname;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const loginView = $("#login-view");
const appView = $("#app-view");
const toast = $("#demo-toast");
let shipments = [];
let selectedShipmentId = null;

const labels = {
  PRECHECK_PASSED: "Pre-check пройден", NEEDS_REVIEW: "Нужна проверка", REJECTED: "Вне пилота",
  PENDING_OPERATOR: "Ожидает оператора", APPROVED_FOR_CAPACITY: "Допущен к запросу",
  RETURNED_FOR_INFO: "Возвращён", DECLINED_FOR_PILOT: "Отказ в пилоте",
  PREPARED: "Черновик запроса", SENT_MANUALLY: "Отправлен вручную", PRICE_REQUIRED: "Нужна цена",
  CONFIRMED: "Подтверждено", DECLINED: "Отказ перевозчика", EXPIRED: "Истёк"
};

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function tone(status) {
  if (["PRECHECK_PASSED", "APPROVED_FOR_CAPACITY", "CONFIRMED"].includes(status)) return "good";
  if (["REJECTED", "DECLINED_FOR_PILOT", "DECLINED"].includes(status)) return "bad";
  return "warn";
}

function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () { toast.hidden = true; }, 4200);
}

async function api(path, options) {
  const config = options || {};
  const response = await fetch(APP_BASE + path.replace(/^\//, ""), Object.assign({}, config, {
    headers: Object.assign({ "content-type": "application/json" }, config.headers || {})
  }));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "Ошибка локального сервера");
  return payload;
}

function renderDashboard(payload) {
  const user = payload.user;
  const summary = payload.summary;
  $("#user-name").textContent = user.full_name;
  $("#user-details").textContent = user.organization_name + " · " + user.role;
  $("#avatar").textContent = user.full_name.split(" ").map(function (part) { return part[0]; }).slice(0, 2).join("");
  $("#phase").textContent = summary.phase;
  $("#phase-label").textContent = summary.phase_label;
  const icons = ["◇", "㎏", "↗", "!"];
  $("#metric-grid").innerHTML = summary.metrics.map(function (metric, index) {
    return '<article class="metric-card"><div class="metric-icon tone-' + escapeHtml(metric.tone) + '">' + icons[index] + '</div><div><span>' +
      escapeHtml(metric.label) + "</span><strong>" + escapeHtml(metric.value) + "</strong><small>" + escapeHtml(metric.hint) + "</small></div></article>";
  }).join("");
  const statusLabels = { READY: "Готово", NEXT: "Следующий", PLANNED: "План" };
  $("#module-list").innerHTML = summary.modules.map(function (module) {
    return '<div class="module-row"><span class="module-code">' + escapeHtml(module.code) + "</span><strong>" + escapeHtml(module.name) +
      '</strong><span class="module-status status-' + module.status.toLowerCase() + '">' + statusLabels[module.status] + "</span></div>";
  }).join("");
  $("#action-list").innerHTML = summary.next_actions.map(function (action, index) {
    return "<li><span>" + (index + 1) + "</span><p>" + escapeHtml(action) + "</p></li>";
  }).join("");
  const formatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });
  $("#event-list").innerHTML = summary.recent_events.map(function (event) {
    return '<div class="event-row"><span class="event-dot"></span><div><strong>' + escapeHtml(event.action) + "</strong><small>" +
      formatter.format(new Date(event.created_at)) + "</small></div></div>";
  }).join("");
}

const pageMeta = {
  dashboard: ["Операционный командный центр", "Обзор компании"],
  shipments: ["Cargo intake", "Паспорт груза"],
  operations: ["Human approval", "Операторская очередь"]
};

async function navigate(view) {
  $$(".app-section").forEach(function (section) { section.hidden = section.id !== "section-" + view; });
  $$("[data-view]").forEach(function (button) { button.classList.toggle("active", button.dataset.view === view); });
  $("#page-eyebrow").textContent = pageMeta[view][0];
  $("#page-title").textContent = pageMeta[view][1];
  window.history.replaceState({}, "", APP_BASE + view);
  if (view === "dashboard") renderDashboard(await api("/api/dashboard"));
  if (view === "shipments") await loadShipments();
  if (view === "operations") await loadOperations();
}

function shipmentCard(item) {
  const current = item.capacity ? item.capacity.status : item.review_status;
  return '<button class="shipment-card" data-shipment="' + escapeHtml(item.id) + '" type="button">' +
    '<span class="shipment-card-top"><b>' + escapeHtml(item.id) + '</b><em class="status-pill ' + tone(item.compliance_status) + '">' +
    labels[item.compliance_status] + "</em></span><strong>" + escapeHtml(item.origin) + " <i>→</i> " + escapeHtml(item.destination) +
    "</strong><small>" + escapeHtml(item.content_description) + " · " + item.chargeable_weight_kg + ' кг</small><span class="shipment-card-foot"><span>' +
    escapeHtml(item.service_tier) + "</span><span>" + labels[current] + "</span></span></button>";
}

async function loadShipments() {
  shipments = (await api("/api/shipments")).items;
  $("#shipment-count").textContent = shipments.length;
  $("#shipment-list").innerHTML = shipments.length ? shipments.map(shipmentCard).join("") :
    '<div class="empty-mini"><b>Заявок пока нет</b><span>Создайте первый паспорт слева.</span></div>';
  $("#shipment-list").querySelectorAll("[data-shipment]").forEach(function (button) {
    button.addEventListener("click", function () { selectedShipmentId = button.dataset.shipment; navigate("operations"); });
  });
}

function readFile(file, kind) {
  if (!file) return Promise.resolve(null);
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error(file.name + ": файл больше 10 МБ"));
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error("Не удалось прочитать " + file.name)); };
    reader.onload = function () {
      resolve({ kind: kind, name: file.name, content_type: file.type, data: String(reader.result).split(",")[1] });
    };
    reader.readAsDataURL(file);
  });
}

function updateWeightPreview() {
  const form = $("#shipment-form");
  const actual = Number(form.elements.actual_weight_kg.value) || 0;
  const volume = ((Number(form.elements.length_cm.value) || 0) * (Number(form.elements.width_cm.value) || 0) *
    (Number(form.elements.height_cm.value) || 0) * (Number(form.elements.pieces.value) || 0)) / 6000;
  $("#actual-preview").textContent = actual.toFixed(1) + " кг";
  $("#volume-preview").textContent = volume.toFixed(1) + " кг";
  $("#chargeable-preview").textContent = Math.max(actual, volume).toFixed(1) + " кг";
}

function queueCard(item) {
  return '<button class="queue-card ' + (item.id === selectedShipmentId ? "active" : "") + '" data-queue="' + escapeHtml(item.id) +
    '" type="button"><span><b>' + escapeHtml(item.id) + '</b><em class="status-pill ' + tone(item.compliance_status) + '">' +
    labels[item.compliance_status] + "</em></span><strong>" + escapeHtml(item.origin) + " → " + escapeHtml(item.destination) +
    "</strong><small>" + item.chargeable_weight_kg + " кг · " + labels[item.review_status] + "</small></button>";
}

async function loadOperations() {
  shipments = (await api("/api/operator-queue")).items;
  $("#queue-count").textContent = shipments.length;
  $("#queue-list").innerHTML = shipments.length ? shipments.map(queueCard).join("") :
    '<div class="empty-mini"><b>Очередь пуста</b><span>Сначала создайте паспорт груза.</span></div>';
  if (!selectedShipmentId && shipments[0]) selectedShipmentId = shipments[0].id;
  $("#queue-list").querySelectorAll("[data-queue]").forEach(function (button) {
    button.addEventListener("click", function () { selectedShipmentId = button.dataset.queue; renderDecision(); markSelected(); });
  });
  renderDecision();
  markSelected();
}

function markSelected() {
  $$("[data-queue]").forEach(function (button) { button.classList.toggle("active", button.dataset.queue === selectedShipmentId); });
}

function reviewHtml(item) {
  return '<section class="decision-section"><h3>1. Решение оператора</h3><textarea id="review-comment" placeholder="Комментарий обязателен для возврата или отказа">' +
    escapeHtml(item.review_comment) + '</textarea><div class="button-row"><button class="button button-success" data-review="APPROVED_FOR_CAPACITY" type="button" ' +
    (item.compliance_status !== "PRECHECK_PASSED" ? "disabled" : "") + '>Допустить к запросу</button><button class="button button-secondary" data-review="RETURNED_FOR_INFO" type="button">Вернуть на уточнение</button>' +
    '<button class="button button-danger" data-review="DECLINED_FOR_PILOT" type="button">Отказать</button></div><small>Текущий статус: <b>' +
    labels[item.review_status] + "</b></small></section>";
}

function capacityHtml(item) {
  const capacity = item.capacity;
  if (!capacity) {
    return '<section class="decision-section"><h3>2. Ручной запрос ёмкости</h3><div class="field-grid two"><label><span>Перевозчик</span><input id="carrier-name" value="Перевозчик A" /></label>' +
      '<label><span>Вылет / дата</span><input id="departure" placeholder="Например: завтра 18:40" /></label></div><button class="button button-primary" id="prepare-capacity" type="button" ' +
      (item.review_status !== "APPROVED_FOR_CAPACITY" ? "disabled" : "") + ">Подготовить запрос</button></section>";
  }
  return '<section class="decision-section"><h3>2. Ручной запрос ёмкости</h3><div class="capacity-card"><span class="status-pill ' + tone(capacity.status) + '">' +
    labels[capacity.status] + "</span><strong>" + escapeHtml(capacity.carrier) + "</strong><small>" + escapeHtml(capacity.departure || "Дата не указана") +
    '</small></div><div class="field-grid two"><label><span>Цена, ₽</span><input id="quoted-price" min="0" step=".01" type="number" value="' +
    (capacity.quoted_price == null ? "" : capacity.quoted_price) + '" /></label><label><span>Номер брони / ссылка</span><input id="carrier-reference" value="' +
    escapeHtml(capacity.carrier_reference) + '" /></label></div><label><span>Комментарий перевозчика</span><textarea id="capacity-comment">' +
    escapeHtml(capacity.comment) + '</textarea></label><div class="button-row capacity-actions"><button class="button button-secondary" data-capacity="SENT_MANUALLY" type="button">Отправлен</button>' +
    '<button class="button button-secondary" data-capacity="PRICE_REQUIRED" type="button">Нужна цена</button><button class="button button-success" data-capacity="CONFIRMED" type="button">Подтверждён</button>' +
    '<button class="button button-danger" data-capacity="DECLINED" type="button">Отказ</button></div></section>';
}

function renderDecision() {
  const item = shipments.find(function (shipment) { return shipment.id === selectedShipmentId; });
  if (!item) return;
  $("#decision-panel").innerHTML = '<div class="panel-heading"><div><span class="eyebrow">Заявка ' + escapeHtml(item.id) + "</span><h2>" +
    escapeHtml(item.origin) + " → " + escapeHtml(item.destination) + '</h2></div><a class="button button-ghost" href="' + APP_BASE + 'api/shipments/' +
    encodeURIComponent(item.id) + '/document" target="_blank">Паспорт ↗</a></div><div class="decision-summary"><div><span>Платный вес</span><strong>' +
    item.chargeable_weight_kg + " кг</strong></div><div><span>Файлы</span><strong>" + item.attachments.length + '/3</strong></div><div><span>Тариф</span><strong>' +
    escapeHtml(item.service_tier) + '</strong></div></div><div class="compliance-box ' + tone(item.compliance_status) + '"><span>' +
    labels[item.compliance_status] + "</span><p>" + escapeHtml(item.compliance_summary) + "</p></div>" + reviewHtml(item) + capacityHtml(item) +
    '<p class="form-error" id="operation-error" role="alert" hidden></p>';
  $("#decision-panel").querySelectorAll("[data-review]").forEach(function (button) {
    button.addEventListener("click", function () { reviewShipment(item.id, button.dataset.review); });
  });
  const prepare = $("#prepare-capacity");
  if (prepare) prepare.addEventListener("click", function () { prepareCapacity(item.id); });
  $("#decision-panel").querySelectorAll("[data-capacity]").forEach(function (button) {
    button.addEventListener("click", function () { updateCapacity(item.id, button.dataset.capacity); });
  });
}

async function operationAction(callback) {
  const error = $("#operation-error");
  error.hidden = true;
  try {
    await callback();
    await loadOperations();
    renderDashboard(await api("/api/dashboard"));
  } catch (caught) {
    error.textContent = caught.message; error.hidden = false; showToast(caught.message, true);
  }
}

function reviewShipment(id, action) {
  return operationAction(function () {
    return api("/api/shipments/" + id + "/review", { method: "POST", body: JSON.stringify({ action: action, comment: $("#review-comment").value }) });
  });
}

function prepareCapacity(id) {
  return operationAction(function () {
    return api("/api/shipments/" + id + "/capacity", { method: "POST", body: JSON.stringify({ carrier: $("#carrier-name").value, departure: $("#departure").value }) });
  });
}

function updateCapacity(id, status) {
  return operationAction(function () {
    return api("/api/shipments/" + id + "/capacity/status", {
      method: "POST",
      body: JSON.stringify({ status: status, quoted_price: $("#quoted-price").value, carrier_reference: $("#carrier-reference").value, comment: $("#capacity-comment").value })
    });
  });
}

$("#login-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const error = $("#login-error"); const button = $("#login-button");
  error.hidden = true; button.disabled = true;
  try {
    const payload = await api("/api/login", { method: "POST", body: JSON.stringify({ email: $("#email").value, password: $("#password").value }) });
    renderDashboard(payload); loginView.hidden = true; appView.hidden = false; await navigate("dashboard");
  } catch (caught) {
    error.textContent = caught.message; error.hidden = false;
  } finally { button.disabled = false; }
});

$("#shipment-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const form = event.currentTarget; const error = $("#shipment-error"); const button = $("#shipment-submit");
  error.hidden = true; button.disabled = true; button.textContent = "Сохраняем и проверяем…";
  try {
    const files = await Promise.all([
      readFile($("#contents-file").files[0], "contents_photo"),
      readFile($("#package-file").files[0], "package_photo"),
      readFile($("#packing-file").files[0], "packing_list")
    ]);
    const payload = Object.fromEntries(new FormData(form).entries());
    ["has_batteries", "has_chemicals", "has_medicines", "is_perishable", "declaration_accepted"].forEach(function (key) {
      payload[key] = form.elements[key].checked;
    });
    payload.attachments = files.filter(Boolean);
    const created = await api("/api/shipments", { method: "POST", body: JSON.stringify(payload) });
    showToast(created.id + ": " + labels[created.compliance_status]); selectedShipmentId = created.id;
    await loadShipments(); renderDashboard(await api("/api/dashboard"));
  } catch (caught) {
    error.textContent = caught.message; error.hidden = false; showToast(caught.message, true);
  } finally { button.disabled = false; button.textContent = "Создать паспорт и выполнить pre-check"; }
});

$$("[data-view]").forEach(function (button) { button.addEventListener("click", function () { navigate(button.dataset.view); }); });
$$("[data-future]").forEach(function (button) { button.addEventListener("click", function () { showToast(button.dataset.future + ": модуль запланирован на следующий этап"); }); });
$("#logout-button").addEventListener("click", async function () {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(function () { return null; });
  appView.hidden = true; loginView.hidden = false; window.history.replaceState({}, "", APP_BASE + "login");
});
$("#shipment-form").addEventListener("input", updateWeightPreview);
$$('input[type="file"]').forEach(function (input) {
  input.addEventListener("change", function () {
    const target = $("#" + input.id.replace("-file", "-file-name"));
    if (target && input.files[0]) target.textContent = input.files[0].name;
  });
});
$$(".tier-card input").forEach(function (input) {
  input.addEventListener("change", function () {
    $$(".tier-card").forEach(function (card) { card.classList.toggle("active", card.contains(input) && input.checked); });
  });
});
