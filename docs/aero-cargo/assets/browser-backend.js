// Browser edition of the P1.2 demo server (start_demo.py) for static hosting
// such as GitHub Pages: the same API, rules and texts, answered inside the page
// with state in localStorage. Included only by build_static_demo.py, before
// demo.js; keep it in step with DemoStore / DemoHandler in start_demo.py.
(function () {
  "use strict";

  const APP_BASE = new URL("..", document.currentScript.src).pathname;
  const STORAGE_KEY = "aero-cargo-demo-state-v1";
  const DEMO_EMAIL = "admin@aerocargo.local";
  const DEMO_PASSWORD = "ChangeMe123!";
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  class ApiError extends Error {
    constructor(detail, status) {
      super(detail);
      this.detail = detail;
      this.status = status || 422;
    }
  }

  const utcNow = () => new Date().toISOString();
  const uuidHex = () => crypto.randomUUID().replaceAll("-", "");

  function emptyState() {
    return {
      shipments: [],
      audit: [{ id: "foundation-seed", action: "python_demo.ready", actor_type: "system", created_at: utcNow() }],
    };
  }

  function load() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (state && Array.isArray(state.shipments) && Array.isArray(state.audit)) return state;
    } catch (_) {
      // fall through to a fresh state
    }
    return emptyState();
  }

  let state = load();

  function write() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // Private mode or full storage: keep working in memory.
    }
  }

  function audit(action, entityId, actorType) {
    state.audit.unshift({ id: uuidHex(), action: action, entity_id: entityId || null, actor_type: actorType || "user", created_at: utcNow() });
    state.audit = state.audit.slice(0, 200);
  }

  function getShipment(id) {
    const shipment = state.shipments.find((item) => item.id === id);
    if (!shipment) throw new ApiError("Заявка не найдена", 404);
    return shipment;
  }

  function dashboard() {
    const shipments = state.shipments;
    const reviewCount = shipments.filter((item) => item.compliance_status === "NEEDS_REVIEW").length;
    const readyCount = shipments.filter((item) => item.review_status === "APPROVED_FOR_CAPACITY").length;
    const confirmedCount = shipments.filter((item) => (item.capacity || {}).status === "CONFIRMED").length;
    const totalWeight = shipments.reduce((sum, item) => sum + Number(item.chargeable_weight_kg), 0);
    return {
      phase: "P1.2",
      phase_label: "Cargo Passport + Operator Queue",
      data_status: "LOCAL_DEMO_DATA",
      metrics: [
        { label: "Заявки", value: String(shipments.length), hint: "сохранены локально", tone: "neutral" },
        { label: "Платный вес", value: totalWeight.toFixed(1) + " кг", hint: "факт или объём", tone: "positive" },
        { label: "Готовы к запросу", value: String(readyCount), hint: "одобрены оператором", tone: "positive" },
        { label: "Требуют внимания", value: String(reviewCount), hint: "подтверждено: " + confirmedCount, tone: "warning" },
      ],
      modules: [
        { code: "P0", name: "Локальный вход, хранение и аудит", status: "READY" },
        { code: "P1.1", name: "Паспорт груза, вложения и pre-check", status: "READY" },
        { code: "P1.2", name: "Операторская очередь и ручная ёмкость", status: "READY" },
        { code: "P1.3", name: "Справочники и подтверждённые партнёры", status: "NEXT" },
        { code: "P2", name: "Тарифы, P&L и подбор маршрута", status: "PLANNED" },
      ],
      next_actions: [
        "Создайте паспорт груза и приложите три подтверждающих файла.",
        "Откройте операторскую и примите решение по заявке.",
        "Подготовьте ручной запрос перевозчику и зафиксируйте ответ.",
        "Используйте номер брони только после фактического ответа перевозчика.",
      ],
      recent_events: state.audit.slice(0, 8),
    };
  }

  function number(payload, key, label) {
    const value = Number(payload[key] == null ? 0 : payload[key]);
    if (!Number.isFinite(value)) throw new ApiError("Поле «" + label + "» должно быть числом");
    if (value <= 0) throw new ApiError("Поле «" + label + "» должно быть больше нуля");
    return Math.round(value * 100) / 100;
  }

  function saveFile(shipmentId, item) {
    const kind = String(item.kind || "");
    const allowed = {
      contents_photo: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
      package_photo: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
      packing_list: { "application/pdf": ".pdf" },
    };
    const contentType = String(item.content_type || "");
    if (!allowed[kind] || !allowed[kind][contentType]) {
      throw new ApiError("Допустимы JPG/PNG/WEBP для фото и PDF для упаковочного листа");
    }
    let size;
    try {
      size = atob(String(item.data || "")).length;
    } catch (_) {
      throw new ApiError("Не удалось прочитать вложение");
    }
    if (!size || size > MAX_FILE_BYTES) throw new ApiError("Каждый файл должен быть размером от 1 байта до 10 МБ");
    // The browser demo keeps file metadata only; nothing else reads the bytes.
    const storedName = shipmentId + "-" + kind + "-" + uuidHex().slice(0, 8) + allowed[kind][contentType];
    return { kind: kind, name: String(item.name || storedName).split(/[\\/]/).pop(), content_type: contentType, size: size, stored_name: storedName };
  }

  function createShipment(payload) {
    const requiredText = { origin: "Откуда", destination: "Куда", content_description: "Описание содержимого", package_type: "Тип упаковки" };
    const cleaned = {};
    for (const [key, label] of Object.entries(requiredText)) {
      const value = String(payload[key] == null ? "" : payload[key]).trim();
      if (!value) throw new ApiError("Заполните поле «" + label + "»");
      cleaned[key] = value.slice(0, 500);
    }
    if (!payload.declaration_accepted) throw new ApiError("Подтвердите достоверность сведений о грузе");
    const actual = number(payload, "actual_weight_kg", "Вес");
    const length = number(payload, "length_cm", "Длина");
    const width = number(payload, "width_cm", "Ширина");
    const height = number(payload, "height_cm", "Высота");
    const pieces = Math.trunc(number(payload, "pieces", "Количество мест"));
    const volumetric = Math.round((length * width * height * pieces / 6000) * 100) / 100;
    const chargeable = Math.max(actual, volumetric);
    const tier = String(payload.service_tier || "STANDARD").toUpperCase();
    if (!["ECONOMY", "STANDARD", "EXPRESS", "CHARTER"].includes(tier)) throw new ApiError("Неизвестный тариф");
    const riskLabels = { has_batteries: "батареи", has_chemicals: "химические вещества", has_medicines: "лекарственные средства", is_perishable: "скоропортящийся груз" };
    const risks = {};
    for (const key of Object.keys(riskLabels)) risks[key] = Boolean(payload[key]);
    const rejectionReasons = Object.keys(riskLabels).filter((key) => risks[key]).map((key) => riskLabels[key]);

    const shipmentId = "SHP-" + String(state.shipments.length + 1).padStart(5, "0");
    const attachments = (payload.attachments || []).map((item) => saveFile(shipmentId, item));
    const kinds = new Set(attachments.map((item) => item.kind));
    const missing = [["contents_photo", "фото содержимого"], ["package_photo", "фото упаковки"], ["packing_list", "PDF упаковочного листа"]]
      .filter(([kind]) => !kinds.has(kind)).map(([, label]) => label);
    let complianceStatus;
    let complianceSummary;
    if (rejectionReasons.length) {
      complianceStatus = "REJECTED";
      complianceSummary = "Вне белого списка пилота: " + rejectionReasons.join(", ");
    } else if (missing.length) {
      complianceStatus = "NEEDS_REVIEW";
      complianceSummary = "Нужны материалы: " + missing.join(", ");
    } else {
      complianceStatus = "PRECHECK_PASSED";
      complianceSummary = "Предварительная проверка пройдена; финальное решение принимает оператор и перевозчик";
    }
    const now = utcNow();
    const shipment = Object.assign({ id: shipmentId }, cleaned, {
      service_tier: tier, pieces: pieces, actual_weight_kg: actual, length_cm: length, width_cm: width, height_cm: height,
      volumetric_weight_kg: volumetric, chargeable_weight_kg: chargeable,
    }, risks, {
      attachments: attachments, compliance_status: complianceStatus, compliance_summary: complianceSummary,
      review_status: "PENDING_OPERATOR", review_comment: "", capacity: null,
      documents: ["Декларация отправителя", "Упаковочный лист", "Черновик поручения экспедитору", "Паспорт груза для проверки оператором"],
      created_at: now, updated_at: now,
    });
    state.shipments.push(shipment);
    audit("shipment.created", shipmentId);
    audit("compliance." + complianceStatus.toLowerCase(), shipmentId, "system");
    write();
    return shipment;
  }

  function review(shipmentId, action, comment) {
    if (!["APPROVED_FOR_CAPACITY", "RETURNED_FOR_INFO", "DECLINED_FOR_PILOT"].includes(action)) throw new ApiError("Неизвестное решение оператора");
    const shipment = getShipment(shipmentId);
    if (action === "APPROVED_FOR_CAPACITY" && shipment.compliance_status !== "PRECHECK_PASSED") {
      throw new ApiError("Одобрение возможно только после полного pre-check", 409);
    }
    if (action !== "APPROVED_FOR_CAPACITY" && !comment.trim()) throw new ApiError("Для возврата или отказа нужен комментарий");
    shipment.review_status = action;
    shipment.review_comment = comment.trim().slice(0, 1000);
    shipment.updated_at = utcNow();
    audit("operator." + action.toLowerCase(), shipmentId);
    write();
    return shipment;
  }

  function prepareCapacity(shipmentId, payload) {
    const shipment = getShipment(shipmentId);
    if (shipment.review_status !== "APPROVED_FOR_CAPACITY") throw new ApiError("Сначала оператор должен допустить груз к запросу", 409);
    if (shipment.capacity && shipment.capacity.status === "CONFIRMED") throw new ApiError("Для заявки уже зафиксировано подтверждение", 409);
    const carrier = String(payload.carrier || "Перевозчик A").trim() || "Перевозчик A";
    const departure = String(payload.departure || "").trim();
    shipment.capacity = {
      status: "PREPARED", carrier: carrier.slice(0, 200), departure: departure.slice(0, 80), quoted_price: null, carrier_reference: "",
      comment: "Черновик подготовлен; отправка выполняется оператором вручную", updated_at: utcNow(),
    };
    shipment.updated_at = utcNow();
    audit("capacity.prepared", shipmentId);
    write();
    return shipment;
  }

  function updateCapacity(shipmentId, payload) {
    const status = String(payload.status || "").toUpperCase();
    if (!["SENT_MANUALLY", "PRICE_REQUIRED", "CONFIRMED", "DECLINED", "EXPIRED"].includes(status)) throw new ApiError("Неизвестный статус ответа перевозчика");
    const shipment = getShipment(shipmentId);
    const capacity = shipment.capacity;
    if (!capacity) throw new ApiError("Сначала подготовьте запрос ёмкости", 409);
    const reference = String(payload.carrier_reference || "").trim();
    if (status === "CONFIRMED" && !reference) throw new ApiError("Для подтверждения нужен номер брони или ссылка перевозчика", 409);
    let price = null;
    if (payload.quoted_price != null && payload.quoted_price !== "") {
      price = Number(payload.quoted_price);
      if (!Number.isFinite(price)) throw new ApiError("Цена перевозчика должна быть числом");
      if (price < 0) throw new ApiError("Цена не может быть отрицательной");
      price = Math.round(price * 100) / 100;
    }
    Object.assign(capacity, { status: status, quoted_price: price, carrier_reference: reference.slice(0, 300), comment: String(payload.comment || "").trim().slice(0, 1000), updated_at: utcNow() });
    shipment.updated_at = utcNow();
    audit("capacity." + status.toLowerCase(), shipmentId);
    write();
    return shipment;
  }

  const user = () => ({ full_name: "Манучер Маник", organization_name: "AERO CARGO Demo", role: "Owner / CEO" });

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;");
  }

  function shipmentDocument(shipment) {
    const safe = escapeHtml;
    const risks = [["has_batteries", "Батареи"], ["has_chemicals", "Химические вещества"], ["has_medicines", "Лекарства"], ["is_perishable", "Скоропортящийся груз"]]
      .filter(([key]) => shipment[key]).map(([, label]) => label);
    return "<!doctype html><html lang='ru'><head><meta charset='utf-8'><title>" + safe(shipment.id) + "</title>" +
      "<style>body{font:15px Arial;color:#15242b;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:28px}.meta{color:#62737b}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:10px;border:1px solid #ccd7da}td:first-child{width:38%;font-weight:bold;background:#f3f7f7}.notice{padding:16px;background:#fff7dd;border-left:4px solid #e0a72f}@media print{button{display:none}}</style></head><body>" +
      "<button onclick='print()'>Печать / Сохранить PDF</button><p class='meta'>AERO CARGO AI · черновик для проверки оператором</p>" +
      "<h1>Паспорт груза " + safe(shipment.id) + "</h1><table>" +
      "<tr><td>Маршрут</td><td>" + safe(shipment.origin) + " → " + safe(shipment.destination) + "</td></tr><tr><td>Содержимое</td><td>" + safe(shipment.content_description) + "</td></tr>" +
      "<tr><td>Упаковка</td><td>" + safe(shipment.package_type) + ", " + safe(shipment.pieces) + " мест</td></tr><tr><td>Габариты одного места</td><td>" + safe(shipment.length_cm) + " × " + safe(shipment.width_cm) + " × " + safe(shipment.height_cm) + " см</td></tr>" +
      "<tr><td>Вес</td><td>фактический " + safe(shipment.actual_weight_kg) + " кг; объёмный " + safe(shipment.volumetric_weight_kg) + " кг; платный " + safe(shipment.chargeable_weight_kg) + " кг</td></tr>" +
      "<tr><td>Pre-check</td><td>" + safe(shipment.compliance_status) + ": " + safe(shipment.compliance_summary) + "</td></tr><tr><td>Заявленные риски</td><td>" + safe(risks.length ? risks.join(", ") : "Не заявлены") + "</td></tr>" +
      "</table><p class='notice'>Документ не является подтверждением перевозки. Финальную приёмку, тариф и возможность перевозки подтверждает оператор и фактический перевозчик.</p></body></html>";
  }

  async function route(method, path, readJson) {
    if (method === "GET") {
      if (path === "/api/health") return { status: "ok", service: "browser-demo", phase: "P1.2" };
      if (path === "/api/dashboard") return { user: user(), summary: dashboard() };
      if (path === "/api/shipments" || path === "/api/operator-queue") return { items: state.shipments.slice().reverse() };
      const doc = path.match(/^\/api\/shipments\/([^/]+)\/document$/);
      if (doc) return new Response(shipmentDocument(getShipment(decodeURIComponent(doc[1]))), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (method === "POST") {
      if (path === "/api/login") {
        const body = await readJson();
        if (String(body.email || "").trim().toLowerCase() !== DEMO_EMAIL || String(body.password || "") !== DEMO_PASSWORD) {
          throw new ApiError("Неверный email или пароль", 401);
        }
        audit("auth.login.success");
        write();
        return { user: user(), summary: dashboard() };
      }
      if (path === "/api/logout") return { ok: true };
      if (path === "/api/shipments") return [createShipment(await readJson()), 201];
      let m;
      if ((m = path.match(/^\/api\/shipments\/([^/]+)\/review$/))) {
        const body = await readJson();
        return review(decodeURIComponent(m[1]), String(body.action || ""), String(body.comment || ""));
      }
      if ((m = path.match(/^\/api\/shipments\/([^/]+)\/capacity$/))) return prepareCapacity(decodeURIComponent(m[1]), await readJson());
      if ((m = path.match(/^\/api\/shipments\/([^/]+)\/capacity\/status$/))) return updateCapacity(decodeURIComponent(m[1]), await readJson());
    }
    throw new ApiError("Страница не найдена", 404);
  }

  function apiPath(url) {
    if (url.origin !== location.origin) return null;
    const prefix = APP_BASE + "api/";
    return url.pathname.startsWith(prefix) ? "/api/" + url.pathname.slice(prefix.length) : null;
  }

  async function handle(request, path) {
    const readJson = async () => {
      let payload;
      try {
        payload = JSON.parse(await request.text());
      } catch (_) {
        throw new ApiError("Некорректный JSON-запрос", 400);
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ApiError("Некорректный JSON-запрос", 400);
      return payload;
    };
    try {
      const out = await route(request.method, path, readJson);
      if (out instanceof Response) return out;
      const [body, status] = Array.isArray(out) ? out : [out, 200];
      return Response.json(body, { status: status });
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ detail: error.detail }, { status: error.status });
      throw error;
    }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const request = new Request(input, init);
    const path = apiPath(new URL(request.url));
    return path ? handle(request, path) : nativeFetch(input, init);
  };

  // The cargo passport opens in a new tab via a link; serve it from here.
  document.addEventListener("click", function (event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link || !apiPath(new URL(link.href))) return;
    event.preventDefault();
    const tab = window.open("", "_blank");
    window.fetch(link.href).then(function (res) { return res.text(); }).then(function (html) {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      if (tab) tab.location.href = url;
      else location.href = url;
    });
  }, true);

  // ---------------------------------------------------------------------------
  // Demo conveniences: texts that describe the local Python run, and sample
  // attachments so the full pre-check → operator → carrier flow is one click.

  function adaptTexts() {
    const replace = [
      [".status-chip", "<i></i> Демо работает в браузере"],
      [".login-card .muted", "Ничего устанавливать не нужно: демо работает прямо в браузере, данные остаются у вас."],
      [".security-note", "<span>✓</span> Демо · вход уже заполнен · данные в этом браузере"],
    ];
    for (const [selector, html] of replace) {
      const el = document.querySelector(selector);
      if (el) el.innerHTML = html;
    }
    document.title = "AERO CARGO AI — демо P1.2";
  }

  function samplePng(label, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eef3f4";
    ctx.fillRect(0, 0, 640, 420);
    ctx.fillStyle = color;
    ctx.fillRect(170, 100, 300, 210);
    ctx.fillStyle = "#15242b";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 320, 370);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function samplePdf() {
    const text = "Packing list (demo): 2 boxes, spare parts";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      null,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    const stream = "BT /F1 18 Tf 60 760 Td (" + text + ") Tj ET";
    objects[3] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach((body, i) => { offsets.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + body + "\nendobj\n"; });
    const xref = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n" + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
    pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  }

  function attach(inputId, file) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillSampleFiles(button) {
    button.disabled = true;
    attach("contents-file", new File([await samplePng("Содержимое (демо)", "#5b8a9a")], "contents-demo.png", { type: "image/png" }));
    attach("package-file", new File([await samplePng("Упаковка (демо)", "#c9a25b")], "package-demo.png", { type: "image/png" }));
    attach("packing-file", new File([samplePdf()], "packing-list-demo.pdf", { type: "application/pdf" }));
    button.textContent = "Демо-файлы приложены";
  }

  function addSampleFilesButton() {
    const target = document.getElementById("packing-file");
    const host = target && (target.closest("fieldset, .upload-grid, .form-section") || target.parentElement && target.parentElement.parentElement);
    if (!host) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-ghost";
    button.textContent = "Подставить демо-файлы (2 фото и PDF)";
    button.style.marginTop = "12px";
    button.addEventListener("click", () => void fillSampleFiles(button));
    host.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded", function () {
    adaptTexts();
    if (typeof DataTransfer === "function") addSampleFilesButton();
  });
})();
