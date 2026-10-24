// Resolved against this file (<app>/assets/common.js), so the app also works under a sub-path.
const APP_BASE = new URL('..', import.meta.url);
export const API = new URL('api', APP_BASE).pathname;

export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.error || `Ошибка ${response.status}`);
  return body;
}

export const statusLabels = {
  submitted: 'Заявка создана', analyzing: 'Идёт анализ', needs_review: 'Нужна проверка',
  quote_draft: 'Проект предложения', quote_sent: 'Предложение отправлено', accepted: 'Заказ подтверждён',
  awaiting_cargo: 'Ожидаем груз', warehouse_received: 'Принято на склад', customs_processing: 'Таможенное оформление',
  ready_for_departure: 'Готово к отправке', handed_to_carrier: 'Передано перевозчику', departed: 'Вылетело',
  arrived: 'Прибыло', last_mile: 'Доставка до получателя', delivered: 'Доставлено', cancelled: 'Отменено',
};

export const tariffLabels = { economy: 'Эконом', standard: 'Стандарт 48–72 ч', express: 'Экспресс', charter: 'Чартер' };
export const commercialTariffLabels = { flex: 'FLEX', standard: 'STANDARD', priority: 'PRIORITY', charter: 'CHARTER' };

export function money(value, currency = 'RUB') {
  if (value == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

export function toast(message, kind = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  document.querySelector('.toast-stack')?.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

export function realtimeUrl(path) {
  const url = new URL(path.replace(/^\//, ''), APP_BASE);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
