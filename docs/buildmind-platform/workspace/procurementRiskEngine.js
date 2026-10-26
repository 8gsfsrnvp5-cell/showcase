'use strict';

/* ==================================================
   BUILDMIND PROCUREMENT RISK ENGINE — V2.1

   Единый прозрачный расчёт снабженческого риска:
   потребность → свободный остаток → подтверждённая
   поставка → дефицит → дата потребности → крайняя
   дата заказа → риск и рекомендуемое действие.
   ================================================== */

(function initializeProcurementRiskEngine(
  root,
  factory
) {
  const api = factory();

  if (
    typeof module === 'object' &&
    module.exports
  ) {
    module.exports = api;
  }

  if (root) {
    root.BuildMindProcurementRisk = api;
  }
})(
  typeof window !== 'undefined'
    ? window
    : globalThis,

  function createProcurementRiskEngine() {
    const VERSION =
      'procurement-risk-v2.1';


    function toNonNegativeNumber(value) {
      const number = Number(value);

      return Number.isFinite(number)
        ? Math.max(number, 0)
        : 0;
    }


    function parseDate(value) {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? null
          : new Date(
              value.getFullYear(),
              value.getMonth(),
              value.getDate()
            );
      }

      const iso = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

      if (iso) {
        const date = new Date(
          Number(iso[1]),
          Number(iso[2]) - 1,
          Number(iso[3])
        );

        return Number.isNaN(date.getTime())
          ? null
          : date;
      }

      const parsed = new Date(value);

      return Number.isNaN(parsed.getTime())
        ? null
        : new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
          );
    }


    function addDays(value, days) {
      const date = parseDate(value);

      if (!date) {
        return null;
      }

      date.setDate(
        date.getDate() + Number(days || 0)
      );

      return date;
    }


    function formatDate(value) {
      const date = parseDate(value);

      if (!date) {
        return '—';
      }

      const year = date.getFullYear();
      const month = String(
        date.getMonth() + 1
      ).padStart(2, '0');
      const day = String(
        date.getDate()
      ).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }


    function resolveNeedDate(context) {
      const source =
        context &&
        typeof context === 'object'
          ? context
          : {};

      const explicitNeedDate =
        parseDate(source.needDate);

      if (explicitNeedDate) {
        return explicitNeedDate;
      }

      const startDate =
        parseDate(source.startDate);

      if (!startDate) {
        return null;
      }

      return addDays(
        startDate,
        -toNonNegativeNumber(
          source.safetyDays
        )
      );
    }


    function calculate(row, context, controlDate) {
      const material =
        row &&
        typeof row === 'object'
          ? row
          : {};

      const need =
        toNonNegativeNumber(material.need);
      const stock =
        toNonNegativeNumber(material.stock);
      const reserved =
        toNonNegativeNumber(material.reserved);
      const confirmed =
        toNonNegativeNumber(material.confirmed);
      const leadDays =
        toNonNegativeNumber(material.leadDays);
      const free =
        Math.max(stock - reserved, 0);
      const available =
        free + confirmed;
      const deficit =
        Math.max(need - available, 0);
      const reliesOnDelivery =
        free < need && confirmed > 0;
      const needDate =
        resolveNeedDate(context);
      const orderDeadline =
        needDate
          ? addDays(needDate, -leadDays)
          : null;
      const deliveryDate =
        parseDate(material.deliveryDate);
      const today =
        parseDate(controlDate) ||
        parseDate(new Date());
      const deliveryAfterNeed =
        Boolean(
          reliesOnDelivery &&
          deliveryDate &&
          needDate &&
          deliveryDate > needDate
        );
      const deliveryOverdue =
        Boolean(
          reliesOnDelivery &&
          deliveryDate &&
          today &&
          deliveryDate < today
        );

      let code = 'ok';
      let level = 'ok';
      let text = 'ОК';
      let reason =
        'Свободного остатка и подтверждённых поставок достаточно.';
      let action =
        'Материал обеспечен. Поддерживайте актуальность складских данных и статуса поставки.';

      if (!needDate) {
        code = 'missing-schedule';
        level = 'critical';
        text = 'Критический';
        reason =
          'Для материала не найдена дата потребности по рабочему контексту.';
        action =
          'Проверьте привязку материала к проекту, объекту и работе с датой начала по ГПР.';
      } else if (deficit > 0) {
        code = 'deficit';
        level = 'critical';
        text = 'Критический';
        reason =
          `После учёта свободного остатка и подтверждённых поставок не хватает ${deficit} ${material.unit || ''}.`;
        action =
          `Проверьте дополнительную заявку на ${deficit} ${material.unit || ''}. ` +
          `Расчётная крайняя дата заказа: ${formatDate(orderDeadline)}.`;
      } else if (
        reliesOnDelivery &&
        !deliveryDate
      ) {
        code = 'delivery-date-missing';
        level = 'warning';
        text = 'Предупреждение';
        reason =
          'Обеспеченность зависит от подтверждённой поставки, но дата поставки не указана.';
        action =
          'Уточните у поставщика дату отгрузки и внесите её в карточку материала.';
      } else if (deliveryOverdue) {
        code = 'delivery-overdue';
        level = 'critical';
        text = 'Критический';
        reason =
          'Подтверждённая дата поставки уже прошла, а свободного остатка недостаточно.';
        action =
          'Уточните фактический статус поставки и зафиксируйте новую дату либо резервный источник.';
      } else if (deliveryAfterNeed) {
        code = 'delivery-after-need';
        level = 'critical';
        text = 'Критический';
        reason =
          'Подтверждённая поставка запланирована позже даты потребности материала.';
        action =
          'Рассмотрите ускорение поставки, резервного поставщика или допустимый аналог.';
      } else if (
        orderDeadline &&
        today > orderDeadline &&
        free < need &&
        confirmed === 0
      ) {
        code = 'order-deadline-passed';
        level = 'warning';
        text = 'Предупреждение';
        reason =
          'Расчётная крайняя дата заказа уже прошла, а поставка не подтверждена.';
        action =
          'Проверьте наличие резерва, срочную закупку или альтернативного поставщика.';
      }

      const categories = [];

      if (level === 'critical') {
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
        today &&
        deliveryDate >= today
      ) {
        categories.push('expected');
      }

      if (
        code === 'delivery-overdue' ||
        code === 'delivery-after-need'
      ) {
        categories.push('delayed');
      }

      if (level === 'ok') {
        categories.push('ok');
      }

      return {
        version: VERSION,
        code,
        level,
        text,
        reason,
        action,
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
        reliesOnDelivery,
        deliveryAfterNeed,
        deliveryOverdue,
        categories:
          Array.from(new Set(categories))
      };
    }


    return {
      version: VERSION,
      parseDate,
      formatDate,
      addDays,
      resolveNeedDate,
      calculate
    };
  }
);

