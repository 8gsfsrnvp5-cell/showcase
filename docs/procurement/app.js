const STORAGE_KEY = 'buildmind-procurement-data-v1';

const defaultMaterials = [
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Труба 76', responsible: 'Снабженец', unit: 'м', need: 5800, stock: 0, reserved: 3000,
    confirmed: 3000, deliveryDate: '2026-07-10', leadDays: 1
  },
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Уголок', responsible: 'Прораб', unit: 'шт', need: 2000, stock: 0, reserved: 1500,
    confirmed: 1500, deliveryDate: '2026-07-11', leadDays: 2
  },
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Хомуты', responsible: 'Кладовщик', unit: 'шт', need: 4500, stock: 0, reserved: 2500,
    confirmed: 2500, deliveryDate: '2026-07-10', leadDays: 1
  }
];

let materials = loadMaterials();

function loadMaterials() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [...defaultMaterials];
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
  const migratedMaterials =
    parsed.map(function (row) {
      if (
        row.work ===
        'Кабельная канализация на эстакаде В4'
      ) {
        return {
          ...row,
          work:
            'Кабельная канализация на эстакаде ДВ-4'
        };
      }

      return row;
    });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(migratedMaterials)
  );

  return migratedMaterials;
}
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые данные BuildMind:', error);
  }

  return [...defaultMaterials];
}

function saveMaterials() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
}

function parseDate(value) {
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) {
    return '—';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function riskFor(row, needDate, today) {
  const stock =
    Number(row.stock) || 0;

  const reserved =
    Number(row.reserved) || 0;

  const confirmed =
    Number(row.confirmed) || 0;

  const need =
    Number(row.need) || 0;

  const leadDays =
    Number(row.leadDays) || 0;

  const free =
    Math.max(stock - reserved, 0);

  const available =
    free + confirmed;

  const deficit =
    Math.max(need - available, 0);

  const orderDeadline =
    needDate
      ? addDays(
          needDate,
          -leadDays
        )
      : null;

  const delivery =
    parseDate(row.deliveryDate);

  if (!needDate) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        'Для материала не найден контекст работы. ' +
        'Проверьте проект, объект, название работы ' +
        'и дату начала по ГПР.'
    };
  }

  if (deficit > 0) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        `Оформить дополнительную заявку на ` +
        `${deficit} ${row.unit}. ` +
        `Крайняя дата заказа: ` +
        `${formatDate(orderDeadline)}.`
    };
  }

  if (
    delivery &&
    delivery > needDate
  ) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        'Поставка позже даты потребности. ' +
        'Ускорить поставку или найти ' +
        'резервного поставщика.'
    };
  }

  if (
    orderDeadline &&
    today > orderDeadline &&
    confirmed === 0
  ) {
    return {
      level: 'warning',
      text: 'Предупреждение',
      action:
        'Крайняя дата заказа уже прошла. ' +
        'Проверьте наличие резерва или ' +
        'альтернативного поставщика.'
    };
  }

  return {
    level: 'ok',
    text: 'ОК',
    action:
      'Материал обеспечен при условии ' +
      'подтверждения статуса поставки.'
  };
}
let activeControlFilter = 'all';

const CONTROL_STATUS_LABELS = {
  critical: 'Критический риск',
  order: 'Нужно заказать',
  'low-stock': 'Заканчивается',
  expected: 'Ожидаемая поставка',
  delayed: 'Поставка задерживается',
  ok: 'Обеспечено'
};

function normalizeControlValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getSavedWorkContextsForControl() {
  const savedContexts =
    localStorage.getItem('buildmindWorkContexts');

  if (!savedContexts) {
    return [];
  }

  try {
    const parsedContexts =
      JSON.parse(savedContexts);

    return Array.isArray(parsedContexts)
      ? parsedContexts
      : [];
  } catch (error) {
    console.warn(
      'Не удалось прочитать контексты работ:',
      error
    );

    return [];
  }
}

function getMaterialScheduleForControl(row) {
  const contexts =
    getSavedWorkContextsForControl();

  const materialProject =
    normalizeControlValue(row.project);

  const materialObject =
    normalizeControlValue(row.object);

  const materialWork =
    normalizeControlValue(row.work);

  const matchedContext =
    contexts.find(function (context) {
      return (
        normalizeControlValue(context.project) ===
          materialProject &&
        normalizeControlValue(context.object) ===
          materialObject &&
        normalizeControlValue(context.work) ===
          materialWork
      );
    });

 const startDateValue =
  matchedContext &&
  matchedContext.startDate
    ? matchedContext.startDate
    : '';

const safetyDays =
  matchedContext
    ? Number(
        matchedContext.safetyDays || 0
      )
    : 0;

  const startDate =
    parseDate(startDateValue);

  const needDate =
    startDate
      ? addDays(startDate, -safetyDays)
      : null;

  return {
    startDate,
    safetyDays,
    needDate
  };
}

function getControlPrimaryStatus(categories) {
  const priority = [
    'delayed',
    'critical',
    'order',
    'low-stock',
    'expected',
    'ok'
  ];

  return (
    priority.find(function (status) {
      return categories.includes(status);
    }) || 'ok'
  );
}

function buildControlEvent(row, index, today) {
  const need =
    Number(row.need) || 0;

  const stock =
    Number(row.stock) || 0;

  const reserved =
    Number(row.reserved) || 0;

  const confirmed =
    Number(row.confirmed) || 0;

  const leadDays =
    Number(row.leadDays) || 0;

  const free =
    Math.max(stock - reserved, 0);

  const available =
    free + confirmed;

  const deficit =
    Math.max(need - available, 0);

  const schedule =
    getMaterialScheduleForControl(row);

  const needDate =
    schedule.needDate;

  const orderDeadline =
    needDate
      ? addDays(needDate, -leadDays)
      : null;

  const deliveryDate =
    parseDate(row.deliveryDate);

  const deliveryAfterNeed =
    Boolean(
      deliveryDate &&
      needDate &&
      deliveryDate > needDate
    );

  const categories = [];

  if (
    !needDate ||
    deficit > 0 ||
    deliveryAfterNeed
  ) {
    categories.push('critical');
  }

  if (deficit > 0) {
    categories.push('order');
  }

  if (free < need) {
    categories.push('low-stock');
  }

  if (
    confirmed > 0 &&
    deliveryDate &&
    deliveryDate >= today
  ) {
    categories.push('expected');
  }

  if (
    confirmed > 0 &&
    deliveryDate &&
    deliveryDate < today &&
    free < need
  ) {
    categories.push('delayed');
  }

  if (free >= need) {
    categories.push('ok');
  }

  const primary =
    getControlPrimaryStatus(categories);

  let reason = '';
  let recommendation = '';

  if (primary === 'delayed') {
    reason =
      'Ожидаемая дата поставки уже прошла, а свободного остатка недостаточно.';

    recommendation =
      'Уточнить фактический статус у поставщика и подтвердить новую дату доставки.';
  } else if (primary === 'critical') {
    if (!needDate) {
      reason =
        'Для материала не найдена подтверждённая дата потребности.';

      recommendation =
        'Проверить привязку материала к контексту работы и графику.';
    } else if (deliveryAfterNeed) {
      reason =
        'Поставка запланирована позже даты потребности материала.';

      recommendation =
        'Ускорить поставку, найти резервный источник или проверить допустимый аналог.';
    } else {
      reason =
        `После учёта склада и подтверждённых поставок не хватает ${deficit} ${row.unit || ''}.`;

      recommendation =
        'Срочно проверить закупку и дополнительную потребность.';
    }
  } else if (primary === 'order') {
    reason =
      `Необходимо дополнительно заказать ${deficit} ${row.unit || ''}.`;

    recommendation =
      'Оформить заявку до крайней даты заказа.';
  } else if (primary === 'low-stock') {
    reason =
      'Свободный складской остаток меньше потребности работы.';

    recommendation =
      'Проверить подтверждённые поставки и доступные складские резервы.';
  } else if (primary === 'expected') {
    reason =
      'Поставка подтверждена поставщиком и ожидается.';

    recommendation =
      'Контролировать дату отгрузки и фактическое поступление.';
  } else {
    reason =
      'Свободного складского остатка достаточно для текущей потребности.';

    recommendation =
      'Поддерживать актуальность складских данных.';
  }

  return {
    index,
    project: row.project || 'Без проекта',
    object: row.object || 'Без объекта',
    work: row.work || 'Без работы',
    name: row.name || 'Без названия',
    responsible:
      row.responsible || 'Не назначен',
    unit: row.unit || '',
    need,
    stock,
    reserved,
    free,
    confirmed,
    available,
    deficit,
    leadDays,
    needDate,
    orderDeadline,
    deliveryDate,
    categories,
    primary,
    reason,
    recommendation
  };
}

function escapeControlHtml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(value ?? '').replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[symbol];
    }
  );
}

function formatControlNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('ru-RU')
    : '0';
}

function formatControlDate(date) {
  if (!date) {
    return '—';
  }

  return date.toLocaleDateString('ru-RU');
}

function setControlCount(elementId, value) {
  const element =
    document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
}

function fillControlSelect(
  selectElement,
  values,
  allLabel
) {
  if (!selectElement) {
    return;
  }

  const previousValue =
    selectElement.value || 'all';

  const sortedValues =
    [...values].sort(function (first, second) {
      return first.localeCompare(
        second,
        'ru'
      );
    });

  selectElement.innerHTML = '';

  const allOption =
    document.createElement('option');

  allOption.value = 'all';
  allOption.textContent = allLabel;

  selectElement.appendChild(allOption);

  sortedValues.forEach(function (value) {
    const option =
      document.createElement('option');

    option.value = value;
    option.textContent = value;

    selectElement.appendChild(option);
  });

  selectElement.value =
    sortedValues.includes(previousValue)
      ? previousValue
      : 'all';
}

function updateControlButtonsState() {
  const buttons =
    document.querySelectorAll(
      '[data-control-filter]'
    );

  buttons.forEach(function (button) {
    const selected =
      button.dataset.controlFilter ===
      activeControlFilter;

    button.classList.toggle(
      'active',
      selected
    );

    button.setAttribute(
      'aria-pressed',
      selected ? 'true' : 'false'
    );
  });
}

function renderOperationalControlCenter() {
  const eventsList =
    document.getElementById(
      'controlEventsList'
    );

  if (!eventsList) {
    return;
  }

  const todayInput =
    document.getElementById('todayDate');

  const today =
    parseDate(
      todayInput ? todayInput.value : ''
    ) || new Date();

  const events =
    materials.map(function (row, index) {
      return buildControlEvent(
        row,
        index,
        today
      );
    });

  const countByStatus =
    function (status) {
      return events.filter(function (event) {
        return event.categories.includes(status);
      }).length;
    };

  setControlCount(
    'criticalCount',
    countByStatus('critical')
  );

  setControlCount(
    'warningCount',
    countByStatus('order')
  );

  setControlCount(
    'lowStockCount',
    countByStatus('low-stock')
  );

  setControlCount(
    'expectedDeliveryCount',
    countByStatus('expected')
  );

  setControlCount(
    'delayedDeliveryCount',
    countByStatus('delayed')
  );

  setControlCount(
    'okCount',
    countByStatus('ok')
  );

  const analysisDate =
    document.getElementById(
      'controlAnalysisDate'
    );

  if (analysisDate) {
    analysisDate.textContent =
      formatControlDate(today);
  }

  const projectFilter =
    document.getElementById(
      'controlProjectFilter'
    );

  const objectFilter =
    document.getElementById(
      'controlObjectFilter'
    );

  const statusFilter =
    document.getElementById(
      'controlStatusFilter'
    );

  const projects =
    Array.from(
      new Set(
        events.map(function (event) {
          return event.project;
        })
      )
    );

  fillControlSelect(
    projectFilter,
    projects,
    'Все проекты'
  );

  const selectedProject =
    projectFilter
      ? projectFilter.value
      : 'all';

  const objects =
    Array.from(
      new Set(
        events
          .filter(function (event) {
            return (
              selectedProject === 'all' ||
              event.project ===
                selectedProject
            );
          })
          .map(function (event) {
            return event.object;
          })
      )
    );

  fillControlSelect(
    objectFilter,
    objects,
    'Все объекты'
  );

  const selectedObject =
    objectFilter
      ? objectFilter.value
      : 'all';

  if (statusFilter) {
    statusFilter.value =
      activeControlFilter;
  }

  const filteredEvents =
    events.filter(function (event) {
      const statusMatches =
        activeControlFilter === 'all' ||
        event.categories.includes(
          activeControlFilter
        );

      const projectMatches =
        selectedProject === 'all' ||
        event.project === selectedProject;

      const objectMatches =
        selectedObject === 'all' ||
        event.object === selectedObject;

      return (
        statusMatches &&
        projectMatches &&
        objectMatches
      );
    });

  const totalElement =
    document.getElementById(
      'controlEventsTotal'
    );

  if (totalElement) {
    totalElement.textContent =
      `Найдено событий: ${filteredEvents.length}`;
  }

  eventsList.innerHTML = '';

  if (filteredEvents.length === 0) {
    const emptyState =
      document.createElement('div');

    emptyState.className =
      'control-empty-state';

    emptyState.textContent =
      'По выбранным фильтрам событий не найдено.';

    eventsList.appendChild(emptyState);
    updateControlButtonsState();
    return;
  }

  filteredEvents.forEach(function (event) {
    const card =
      document.createElement('article');

    card.className =
      'control-event-card ' +
      `control-event-card-${event.primary}`;

    const categoryNames =
      event.categories
        .map(function (status) {
          return CONTROL_STATUS_LABELS[status];
        })
        .join(', ');

    card.innerHTML = `
      <h4>${escapeControlHtml(event.name)}</h4>

      <p>
        <strong>Основной статус:</strong>
        ${escapeControlHtml(
          CONTROL_STATUS_LABELS[event.primary]
        )}
      </p>

      <p>
        <strong>Категории контроля:</strong>
        ${escapeControlHtml(categoryNames)}
      </p>

      <p>
        <strong>Проект / объект / работа:</strong>
        ${escapeControlHtml(event.project)}
        /
        ${escapeControlHtml(event.object)}
        /
        ${escapeControlHtml(event.work)}
      </p>

      <p>
        <strong>Ответственный:</strong>
        ${escapeControlHtml(event.responsible)}
      </p>

      <p>
        <strong>Нужно:</strong>
        ${formatControlNumber(event.need)}
        ${escapeControlHtml(event.unit)}

        · <strong>Свободно:</strong>
        ${formatControlNumber(event.free)}
        ${escapeControlHtml(event.unit)}

        · <strong>Подтверждено:</strong>
        ${formatControlNumber(event.confirmed)}
        ${escapeControlHtml(event.unit)}

        · <strong>Дефицит:</strong>
        ${formatControlNumber(event.deficit)}
        ${escapeControlHtml(event.unit)}
      </p>

      <p>
        <strong>Дата потребности:</strong>
        ${formatControlDate(event.needDate)}

        · <strong>Крайняя дата заказа:</strong>
        ${formatControlDate(
          event.orderDeadline
        )}

        · <strong>Дата поставки:</strong>
        ${formatControlDate(
          event.deliveryDate
        )}
      </p>

      <p>
        <strong>Причина:</strong>
        ${escapeControlHtml(event.reason)}
      </p>

      <p>
        <strong>Рекомендация:</strong>
        ${escapeControlHtml(
          event.recommendation
        )}
      </p>
    `;

    eventsList.appendChild(card);
  });

  updateControlButtonsState();
}

function initializeOperationalControlCenter() {
  const buttons =
    document.querySelectorAll(
      '[data-control-filter]'
    );

  const statusFilter =
    document.getElementById(
      'controlStatusFilter'
    );

  const projectFilter =
    document.getElementById(
      'controlProjectFilter'
    );

  const objectFilter =
    document.getElementById(
      'controlObjectFilter'
    );

  buttons.forEach(function (button) {
    button.addEventListener(
      'click',
      function () {
        activeControlFilter =
          button.dataset.controlFilter ||
          'all';

        if (statusFilter) {
          statusFilter.value =
            activeControlFilter;
        }

        renderOperationalControlCenter();
      }
    );
  });

  if (statusFilter) {
    statusFilter.addEventListener(
      'change',
      function () {
        activeControlFilter =
          statusFilter.value || 'all';

        renderOperationalControlCenter();
      }
    );
  }

  if (projectFilter) {
    projectFilter.addEventListener(
      'change',
      renderOperationalControlCenter
    );
  }

  if (objectFilter) {
    objectFilter.addEventListener(
      'change',
      renderOperationalControlCenter
    );
  }

  updateControlButtonsState();
}
function render() {
  const tbody = document.querySelector('#materialsTable tbody');
  tbody.innerHTML = '';

 const today =
  parseDate(
    document.getElementById(
      'todayDate'
    ).value
  ) || new Date();

  let critical = 0;
  let warning = 0;
  let ok = 0;

  materials.forEach((row, index) => {
  const schedule =
    getMaterialScheduleForControl(row);

  const needDate =
    schedule.needDate;

  const free =
    Math.max(
      Number(row.stock || 0) -
      Number(row.reserved || 0),
      0
    );
    const available =
  free + Number(row.confirmed || 0);

const deficit =
  Math.max(
    Number(row.need || 0) -
    available,
    0
  );

const orderDeadline =
  needDate
    ? addDays(
        needDate,
        -Number(row.leadDays || 0)
      )
    : null;

const risk =
  riskFor(
    row,
    needDate,
    today
  );

    if (risk.level === 'critical') critical++;
    if (risk.level === 'warning') warning++;
    if (risk.level === 'ok') ok++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.project || '—'}</td>
      <td>${row.object || '—'}</td>
      <td>${row.work || '—'}</td>
      <td>${row.name}</td>
      <td>${row.responsible || '—'}</td>
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
      <td><button class="small-btn" onclick="deleteMaterial(${index})">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('warningCount').textContent = warning;
  document.getElementById('okCount').textContent = ok;

  renderOperationalControlCenter();
}

function addMaterial() {
  const project = document.getElementById('newProject').value.trim() || 'Без проекта';
  const object = document.getElementById('newObject').value.trim() || 'Без объекта';
  const work = document.getElementById('newWork').value.trim() || 'Без работы';
  const name = document.getElementById('newName').value.trim();
  const responsible = document.getElementById('newResponsible').value.trim() || 'Не назначен';
  const need = Number(document.getElementById('newNeed').value);
  const unit = document.getElementById('newUnit').value.trim() || 'шт';

  if (!name || !need) {
    alert('Введите материал и нужное количество.');
    return;
  }

  materials.push({
    project,
    object,
    work,
    name,
    responsible,
    unit,
    need,
    stock: Number(document.getElementById('newStock').value || 0),
    reserved: Number(document.getElementById('newReserved').value || 0),
    confirmed: Number(document.getElementById('newConfirmed').value || 0),
    deliveryDate: document.getElementById('newDelivery').value,
    leadDays: Number(document.getElementById('newLead').value || 1)
  });

  saveMaterials();
  clearAddForm();
  render();
}

function deleteMaterial(index) {
  materials.splice(index, 1);
  saveMaterials();
  render();
}

function clearAddForm() {
  document.getElementById('newName').value = '';
  document.getElementById('newResponsible').value = '';
  document.getElementById('newNeed').value = '';
  document.getElementById('newUnit').value = '';
  document.getElementById('newStock').value = '0';
  document.getElementById('newReserved').value = '0';
  document.getElementById('newConfirmed').value = '0';
  document.getElementById('newDelivery').value = '';
  document.getElementById('newLead').value = '1';
}

function resetMaterials() {
  const confirmed = confirm('Сбросить материалы к стартовому примеру? Все добавленные материалы будут удалены.');
  if (!confirmed) return;

  materials = [...defaultMaterials];
  saveMaterials();
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
document.getElementById('resetBtn').addEventListener('click', resetMaterials);

initializeOperationalControlCenter();
render();
function calculateAssistantRow(material) {
  const need = Number(material.need) || 0;
  const stock = Number(material.stock) || 0;
  const reserved = Number(material.reserved) || 0;
  const confirmed = Number(material.confirmed) || 0;

  const free = Math.max(0, stock - reserved);
  const available = free + confirmed;
  const deficit = Math.max(0, need - available);

  return {
    ...material,
    need,
    stock,
    reserved,
    confirmed,
    free,
    available,
    deficit
  };
}

function runBuildMindAssistant() {
  const input = document.getElementById('assistantInput');
  const answer = document.getElementById('assistantAnswer');

  if (!input || !answer) {
    alert('Командное окно не найдено на странице.');
    return;
  }

  const command = input.value.trim().toLowerCase();

  if (!command) {
    answer.textContent = 'Введите команду для BuildMind.';
    return;
  }

  const calculatedMaterials = materials.map(calculateAssistantRow);

  if (
    command.includes('дефицит') ||
    command.includes('не хватает') ||
    command.includes('риск')
  ) {
    const deficitMaterials = calculatedMaterials.filter(item => item.deficit > 0);

    if (deficitMaterials.length === 0) {
      answer.textContent = 'Материалов с дефицитом не найдено.';
      return;
    }

    const lines = deficitMaterials.map(item => {
      return `- ${item.name}: дефицит ${item.deficit} ${item.unit}, ответственный: ${item.responsible || 'не назначен'}`;
    });

    answer.textContent =
      'Материалы с дефицитом:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('все материалы') ||
    command.includes('покажи материалы') ||
    command.includes('список материалов')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: нужно ${item.need} ${item.unit}, доступно ${item.available} ${item.unit}, дефицит ${item.deficit} ${item.unit}`;
    });

    answer.textContent =
      'Список материалов:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('ответственный') ||
    command.includes('кто отвечает') ||
    command.includes('ответственные')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: ${item.responsible || 'ответственный не назначен'}`;
    });

    answer.textContent =
      'Ответственные по материалам:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('помощь') ||
    command.includes('что умеешь') ||
    command.includes('команды')
  ) {
    answer.textContent =
      'Я пока понимаю простые команды:\n\n' +
      '1. Покажи материалы с дефицитом\n' +
      '2. Покажи все материалы\n' +
      '3. Кто ответственный\n' +
      '4. Помощь\n\n' +
      'Позже я буду понимать проекты, объекты, работы и периоды.';
    return;
  }

  answer.textContent =
    'Я пока не понял команду.\n\n' +
    'Попробуйте написать:\n' +
    '- Покажи материалы с дефицитом\n' +
    '- Покажи все материалы\n' +
    '- Кто ответственный\n' +
    '- Помощь';
}

function clearBuildMindAssistant() {
  const answer = document.getElementById('assistantAnswer');
  const input = document.getElementById('assistantInput');

  if (answer) {
    answer.textContent = 'Здесь появится ответ BuildMind.';
  }

  if (input) {
    input.value = '';
  }
}

window.runBuildMindAssistant = runBuildMindAssistant;
window.clearBuildMindAssistant = clearBuildMindAssistant;
