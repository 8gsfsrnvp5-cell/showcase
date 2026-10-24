const materials = [
  {
    name: 'Труба 76', unit: 'м', need: 5800, stock: 0, reserved: 3000,
    confirmed: 3000, deliveryDate: '2026-07-10', leadDays: 1
  },
  {
    name: 'Уголок', unit: 'шт', need: 2000, stock: 0, reserved: 1500,
    confirmed: 1500, deliveryDate: '2026-07-11', leadDays: 2
  },
  {
    name: 'Хомуты', unit: 'шт', need: 4500, stock: 0, reserved: 2500,
    confirmed: 2500, deliveryDate: '2026-07-10', leadDays: 1
  }
];

function parseDate(value) {
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return '—';
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function riskFor(row, needDate, today) {
  const free = Math.max(row.stock - row.reserved, 0);
  const available = free + row.confirmed;
  const deficit = Math.max(row.need - available, 0);
  const orderDeadline = addDays(needDate, -row.leadDays);
  const delivery = parseDate(row.deliveryDate);

  if (deficit > 0) {
    return {
      level: 'critical',
      text: 'Критический',
      action: `Оформить дополнительную заявку на ${deficit} ${row.unit}. Крайняя дата заказа: ${formatDate(orderDeadline)}.`
    };
  }

  if (delivery && delivery > needDate) {
    return {
      level: 'critical',
      text: 'Критический',
      action: `Поставка позже даты потребности. Ускорить поставку или найти резервного поставщика.`
    };
  }

  if (today > orderDeadline && row.confirmed === 0) {
    return {
      level: 'warning',
      text: 'Предупреждение',
      action: 'Крайняя дата заказа уже прошла. Проверьте наличие резерва или альтернативного поставщика.'
    };
  }

  return {
    level: 'ok',
    text: 'ОК',
    action: 'Материал обеспечен при условии подтверждения статуса поставки.'
  };
}

function render() {
  const tbody = document.querySelector('#materialsTable tbody');
  tbody.innerHTML = '';

  const startDate = parseDate(document.getElementById('workStartDate').value);
  const safetyDays = Number(document.getElementById('safetyDays').value || 0);
  const today = parseDate(document.getElementById('todayDate').value) || new Date();
  const needDate = addDays(startDate, -safetyDays);

  let critical = 0;
  let warning = 0;
  let ok = 0;

  materials.forEach((row) => {
    const free = Math.max(row.stock - row.reserved, 0);
    const available = free + row.confirmed;
    const deficit = Math.max(row.need - available, 0);
    const orderDeadline = addDays(needDate, -row.leadDays);
    const risk = riskFor(row, needDate, today);

    if (risk.level === 'critical') critical++;
    if (risk.level === 'warning') warning++;
    if (risk.level === 'ok') ok++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.need}</td>
      <td>${row.unit}</td>
      <td>${row.stock}</td>
      <td>${row.reserved}</td>
      <td>${free}</td>
      <td>${row.confirmed}</td>
      <td>${row.deliveryDate || '—'}</td>
      <td>${row.leadDays}</td>
      <td>${deficit}</td>
      <td>${formatDate(needDate)}</td>
      <td>${formatDate(orderDeadline)}</td>
      <td><span class="badge ${risk.level}">${risk.text}</span></td>
      <td>${risk.action}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('warningCount').textContent = warning;
  document.getElementById('okCount').textContent = ok;
}

function addMaterial() {
  const name = document.getElementById('newName').value.trim();
  const need = Number(document.getElementById('newNeed').value);
  const unit = document.getElementById('newUnit').value.trim() || 'шт';

  if (!name || !need) {
    alert('Введите материал и нужное количество.');
    return;
  }

  materials.push({
    name,
    unit,
    need,
    stock: Number(document.getElementById('newStock').value || 0),
    reserved: Number(document.getElementById('newReserved').value || 0),
    confirmed: Number(document.getElementById('newConfirmed').value || 0),
    deliveryDate: document.getElementById('newDelivery').value,
    leadDays: Number(document.getElementById('newLead').value || 1)
  });

  render();
}

function exportJson() {
  const data = {
    project: document.getElementById('projectName').value,
    object: document.getElementById('objectName').value,
    work: document.getElementById('workName').value,
    workStartDate: document.getElementById('workStartDate').value,
    safetyDays: Number(document.getElementById('safetyDays').value || 0),
    materials
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'buildmind-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('recalcBtn').addEventListener('click', render);
document.getElementById('addBtn').addEventListener('click', addMaterial);
document.getElementById('exportBtn').addEventListener('click', exportJson);
render();
