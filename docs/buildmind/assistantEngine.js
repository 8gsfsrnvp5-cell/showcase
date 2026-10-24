'use strict';

/*
  ==================================================
  BUILDMIND ASSISTANT ENGINE — DEMO V1
  ==================================================
*/

function calculateAssistantRowLocal(
  material
) {
  const need =
    Number(material.need) || 0;

  const stock =
    Number(material.stock) || 0;

  const reserved =
    Number(material.reserved) || 0;

  const confirmed =
    Number(material.confirmed) || 0;

  const free =
    Math.max(
      0,
      stock - reserved
    );

  const available =
    free + confirmed;

  const deficit =
    Math.max(
      0,
      need - available
    );

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
  const input =
    document.getElementById(
      'assistantInput'
    );

  const answer =
    document.getElementById(
      'assistantAnswer'
    );

  if (!input || !answer) {
    alert(
      'Командное окно не найдено.'
    );

    return;
  }

  const command =
    input.value
      .trim()
      .toLowerCase();

  if (!command) {
    answer.textContent =
      'Введите команду для BuildMind.';

    return;
  }

  if (
    typeof materials ===
    'undefined'
  ) {
    answer.textContent =
      'Ошибка: список материалов не найден. Нужно проверить app.js.';

    return;
  }

  const calculatedMaterials =
    materials.map(
      calculateAssistantRowLocal
    );

  if (
    command.includes('сводка') ||
    command.includes('сводку') ||
    command.includes('итог') ||
    command.includes(
      'общая информация'
    )
  ) {
    const totalMaterials =
      calculatedMaterials.length;

    const deficitMaterials =
      calculatedMaterials.filter(
        function (item) {
          return item.deficit > 0;
        }
      );

    const withoutResponsible =
      calculatedMaterials.filter(
        function (item) {
          return (
            !item.responsible ||
            item.responsible ===
              'Не назначен'
          );
        }
      );

    let biggestDeficit = null;

    deficitMaterials.forEach(
      function (item) {
        if (
          !biggestDeficit ||
          item.deficit >
            biggestDeficit.deficit
        ) {
          biggestDeficit = item;
        }
      }
    );

    let summaryText =
      'Сводка BuildMind:\n\n';

    summaryText +=
      `Всего материалов: ` +
      `${totalMaterials}\n`;

    summaryText +=
      `Материалов с дефицитом: ` +
      `${deficitMaterials.length}\n`;

    summaryText +=
      `Материалов без ответственного: ` +
      `${withoutResponsible.length}\n`;

    if (biggestDeficit) {
      summaryText +=
        `Самый большой дефицит: ` +
        `${biggestDeficit.name} — ` +
        `${biggestDeficit.deficit} ` +
        `${biggestDeficit.unit}\n`;
    } else {
      summaryText +=
        'Самый большой дефицит: не найден\n';
    }

    summaryText +=
      '\nКраткий вывод:\n';

    if (
      deficitMaterials.length > 0
    ) {
      summaryText +=
        'Есть материалы с дефицитом. Нужно проверить закупки и ответственных.';
    } else {
      summaryText +=
        'По текущим данным дефицита материалов нет.';
    }

    answer.textContent =
      summaryText;

    return;
  }

  if (
    command.includes('проект') ||
    command.includes('объект') ||
    command.includes('работа')
  ) {
    const contextMaterials =
      calculatedMaterials.filter(
        function (item) {
          const project =
            (
              item.project || ''
            ).toLowerCase();

          const object =
            (
              item.object || ''
            ).toLowerCase();

          const work =
            (
              item.work || ''
            ).toLowerCase();

          return (
            (
              project &&
              command.includes(project)
            ) ||
            (
              object &&
              command.includes(object)
            ) ||
            (
              work &&
              command.includes(work)
            )
          );
        }
      );

    if (
      contextMaterials.length === 0
    ) {
      answer.textContent =
        'Я не нашёл материалы по указанному проекту, объекту или работе.\n\n' +
        'Попробуйте написать точное название, например:\n' +
        '- Покажи объект СВХ\n' +
        '- Покажи проект АСУДД 1\n' +
        '- Покажи работу Кабельная канализация на эстакаде ДВ-4';

      return;
    }

    const lines =
      contextMaterials.map(
        function (item) {
          return (
            `- ${item.project || '—'} / ` +
            `${item.object || '—'} / ` +
            `${item.work || '—'} / ` +
            `${item.name}: ` +
            `нужно ${item.need} ` +
            `${item.unit}, ` +
            `доступно ${item.available} ` +
            `${item.unit}, ` +
            `дефицит ${item.deficit} ` +
            `${item.unit}`
          );
        }
      );

    answer.textContent =
      'Материалы по найденному проекту / объекту / работе:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('дефицит') ||
    command.includes('не хватает') ||
    command.includes('риск')
  ) {
    const deficitMaterials =
      calculatedMaterials.filter(
        function (item) {
          return item.deficit > 0;
        }
      );

    if (
      deficitMaterials.length === 0
    ) {
      answer.textContent =
        'Материалов с дефицитом не найдено.';

      return;
    }

    const lines =
      deficitMaterials.map(
        function (item) {
          return (
            `- ${item.project || '—'} / ` +
            `${item.object || '—'} / ` +
            `${item.work || '—'} / ` +
            `${item.name}: ` +
            `дефицит ${item.deficit} ` +
            `${item.unit}, ` +
            `ответственный: ` +
            `${item.responsible || 'не назначен'}`
          );
        }
      );

    answer.textContent =
      'Материалы с дефицитом:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes(
      'все материалы'
    ) ||
    command.includes(
      'покажи материалы'
    ) ||
    command.includes(
      'список материалов'
    )
  ) {
    const lines =
      calculatedMaterials.map(
        function (item) {
          return (
            `- ${item.project || '—'} / ` +
            `${item.object || '—'} / ` +
            `${item.work || '—'} / ` +
            `${item.name}: ` +
            `нужно ${item.need} ` +
            `${item.unit}, ` +
            `доступно ${item.available} ` +
            `${item.unit}, ` +
            `дефицит ${item.deficit} ` +
            `${item.unit}`
          );
        }
      );

    answer.textContent =
      'Список материалов:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes(
      'ответственный'
    ) ||
    command.includes(
      'кто отвечает'
    ) ||
    command.includes(
      'ответственные'
    )
  ) {
    const lines =
      calculatedMaterials.map(
        function (item) {
          return (
            `- ${item.project || '—'} / ` +
            `${item.object || '—'} / ` +
            `${item.work || '—'} / ` +
            `${item.name}: ` +
            `${item.responsible || 'ответственный не назначен'}`
          );
        }
      );

    answer.textContent =
      'Ответственные по материалам:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('помощь') ||
    command.includes(
      'что умеешь'
    ) ||
    command.includes('команды')
  ) {
    answer.textContent =
      'Я понимаю команды:\n\n' +
      '1. Покажи сводку\n' +
      '2. Покажи материалы с дефицитом\n' +
      '3. Покажи все материалы\n' +
      '4. Кто ответственный\n' +
      '5. Покажи проект АСУДД 1\n' +
      '6. Покажи объект СВХ\n' +
      '7. Покажи работу Кабельная канализация на эстакаде ДВ-4';

    return;
  }

  answer.textContent =
    'Я пока не понял команду.\n\n' +
    'Попробуйте написать:\n' +
    '- Покажи сводку\n' +
    '- Покажи материалы с дефицитом\n' +
    '- Покажи все материалы\n' +
    '- Кто ответственный\n' +
    '- Покажи объект СВХ\n' +
    '- Помощь';
}

function clearBuildMindAssistant() {
  const answer =
    document.getElementById(
      'assistantAnswer'
    );

  const input =
    document.getElementById(
      'assistantInput'
    );

  if (answer) {
    answer.textContent =
      'Здесь появится ответ BuildMind.';
  }

  if (input) {
    input.value = '';
  }
}

window.runBuildMindAssistant =
  runBuildMindAssistant;

window.clearBuildMindAssistant =
  clearBuildMindAssistant;

console.info(
  'BuildMind Assistant Engine загружен'
);
