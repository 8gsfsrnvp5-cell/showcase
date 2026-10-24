'use strict';

/*
  ==================================================
  BUILDMIND ENGINEERING AUDIT ENGINE — DEMO V1
  ==================================================

  Модуль:
  - получает выбранный тип работы;
  - получает материалы, найденные в проекте;
  - сравнивает их с Road Knowledge Base;
  - формирует предварительный инженерный аудит.

  Важно:
  - выводы являются рекомендациями;
  - требуется подтверждение инженером;
  - модуль не заменяет проектную документацию;
  - модуль не создаёт закупки автоматически.
*/

const ENGINEERING_AUDIT_VERSION =
  'engineering-audit-demo-v1';

function normalizeEngineeringAuditText(
  value
) {
  const knowledge =
    window.BuildMindRoadKnowledge;

  if (
    knowledge &&
    typeof knowledge.normalizeText ===
      'function'
  ) {
    return knowledge.normalizeText(
      value
    );
  }

  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeEngineeringAuditText(
  value
) {
  const normalized =
    normalizeEngineeringAuditText(
      value
    );

  if (!normalized) {
    return [];
  }

  const ignoredWords =
    new Set([
      'для',
      'при',
      'или',
      'под',
      'над',
      'без',
      'через',
      'комплект',
      'материал',
      'материалы',
      'оборудование',
      'изделие',
      'изделия'
    ]);

  return normalized
    .split(' ')
    .filter(function (word) {
      return (
        word.length >= 2 &&
        !ignoredWords.has(word)
      );
    });
}

function getEngineeringAuditWordRoot(
  word
) {
  const normalized =
    normalizeEngineeringAuditText(
      word
    );

  if (normalized.length <= 4) {
    return normalized;
  }

  const endings = [
    'иями',
    'ями',
    'ами',
    'ого',
    'ему',
    'ому',
    'ыми',
    'ими',
    'ий',
    'ый',
    'ой',
    'ая',
    'яя',
    'ое',
    'ее',
    'ые',
    'ие',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ах',
    'ях',
    'ом',
    'ем',
    'а',
    'я',
    'ы',
    'и',
    'у',
    'ю',
    'е',
    'о'
  ];

  const ending =
    endings.find(function (item) {
      return (
        normalized.endsWith(item) &&
        normalized.length - item.length >= 4
      );
    });

  if (!ending) {
    return normalized;
  }

  return normalized.slice(
    0,
    -ending.length
  );
}

function getEngineeringAuditRoots(
  value
) {
  return tokenizeEngineeringAuditText(
    value
  ).map(
    getEngineeringAuditWordRoot
  );
}

function engineeringAuditTextsMatch(
  firstValue,
  secondValue
) {
  const firstNormalized =
    normalizeEngineeringAuditText(
      firstValue
    );

  const secondNormalized =
    normalizeEngineeringAuditText(
      secondValue
    );

  if (
    !firstNormalized ||
    !secondNormalized
  ) {
    return false;
  }

  if (
    firstNormalized.includes(
      secondNormalized
    ) ||
    secondNormalized.includes(
      firstNormalized
    )
  ) {
    return true;
  }

  const firstRoots =
    getEngineeringAuditRoots(
      firstValue
    );

  const secondRoots =
    getEngineeringAuditRoots(
      secondValue
    );

  if (
    firstRoots.length === 0 ||
    secondRoots.length === 0
  ) {
    return false;
  }

  const matchedRoots =
    firstRoots.filter(
      function (firstRoot) {
        return secondRoots.some(
          function (secondRoot) {
            return (
              firstRoot === secondRoot ||
              (
                firstRoot.length >= 4 &&
                secondRoot.length >= 4 &&
                (
                  firstRoot.startsWith(
                    secondRoot
                  ) ||
                  secondRoot.startsWith(
                    firstRoot
                  )
                )
              )
            );
          }
        );
      }
    );

  const shortestLength =
    Math.min(
      firstRoots.length,
      secondRoots.length
    );

  return (
    matchedRoots.length >= 1 &&
    matchedRoots.length /
      shortestLength >=
      0.5
  );
}

function normalizeEngineeringAuditMaterials(
  materials
) {
  const source =
    Array.isArray(materials)
      ? materials
      : [];

  return source
    .map(function (item, index) {
      if (
        typeof item === 'string'
      ) {
        return {
          id:
            'audit-material-' +
            index,
          name: item,
          quantity: null,
          unit: '',
          pageNumber: null,
          source: ''
        };
      }

      return {
        id:
          item.id ||
          'audit-material-' +
            index,

        name:
          item.name ||
          item.material ||
          '',

        quantity:
          Number.isFinite(
            Number(item.quantity)
          )
            ? Number(item.quantity)
            : (
                Number.isFinite(
                  Number(item.need)
                )
                  ? Number(item.need)
                  : null
              ),

        unit:
          item.unit || '',

        pageNumber:
          item.pageNumber ||
          item.sourcePage ||
          null,

        source:
          item.source ||
          item.sourceDocument ||
          ''
      };
    })
    .filter(function (item) {
      return Boolean(
        normalizeEngineeringAuditText(
          item.name
        )
      );
    });
}

function findEngineeringAuditMaterial(
  expectedMaterial,
  projectMaterials
) {
  const searchableNames = [
    expectedMaterial.name,
    ...(expectedMaterial.aliases || [])
  ];

  return (
    projectMaterials.find(
      function (projectMaterial) {
        return searchableNames.some(
          function (searchableName) {
            return engineeringAuditTextsMatch(
              searchableName,
              projectMaterial.name
            );
          }
        );
      }
    ) || null
  );
}

function createEngineeringAuditMaterialResult(
  expectedMaterial,
  matchedMaterial
) {
  return {
    id:
      expectedMaterial.id ||
      normalizeEngineeringAuditText(
        expectedMaterial.name
      ).replace(/\s+/g, '-'),

    name:
      expectedMaterial.name,

    role:
      expectedMaterial.role || '',

    required:
      expectedMaterial.required ===
      true,

    found:
      Boolean(matchedMaterial),

    matchedMaterial:
      matchedMaterial || null
  };
}

function buildEngineeringAuditMissingChecks(
  workItem,
  projectMaterials
) {
  return (
    workItem.typicalMissing || []
  ).map(function (missingItem) {
    const matchedMaterial =
      findEngineeringAuditMaterial(
        missingItem,
        projectMaterials
      );

    return {
      name:
        missingItem.name,

      reason:
        missingItem.reason || '',

      found:
        Boolean(matchedMaterial),

      matchedMaterial:
        matchedMaterial || null,

      requiresEngineerCheck:
        true
    };
  });
}

function calculateEngineeringAuditSeverity(
  requiredMissing,
  typicalMissing,
  projectMaterials
) {
  if (requiredMissing.length > 0) {
    return {
      level: 'critical',
      label: 'Требуется внимание'
    };
  }

  const unresolvedTypical =
    typicalMissing.filter(
      function (item) {
        return !item.found;
      }
    );

  if (
    unresolvedTypical.length > 0
  ) {
    return {
      level: 'warning',
      label: 'Требуется проверка'
    };
  }

  if (
    projectMaterials.length === 0
  ) {
    return {
      level: 'warning',
      label:
        'Нет материалов для сравнения'
    };
  }

  return {
    level: 'ok',
    label:
      'Критичных расхождений не найдено'
  };
}

function buildEngineeringAuditSummary(
  audit
) {
  const foundExpectedCount =
    audit.expectedMaterials.filter(
      function (item) {
        return item.found;
      }
    ).length;

  const missingRequiredCount =
    audit.missingRequiredMaterials
      .length;

  const unresolvedTypicalCount =
    audit.typicalMissingChecks.filter(
      function (item) {
        return !item.found;
      }
    ).length;

  return {
    projectMaterialsCount:
      audit.projectMaterials.length,

    expectedMaterialsCount:
      audit.expectedMaterials.length,

    foundExpectedCount,

    missingRequiredCount,

    unresolvedTypicalCount,

    toolsCount:
      audit.tools.length,

    equipmentCount:
      audit.equipment.length,

    crewRolesCount:
      audit.crew.suggestedRoles.length,

    checksCount:
      audit.checks.length,

    risksCount:
      audit.risks.length
  };
}

function runEngineeringAudit(options) {
  const settings =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const knowledge =
    window.BuildMindRoadKnowledge;

  if (!knowledge) {
    return {
      success: false,
      errorCode:
        'KNOWLEDGE_BASE_NOT_FOUND',
      errorMessage:
        'База дорожных работ не подключена.'
    };
  }

  let workItem = null;

  if (settings.workId) {
    workItem =
      knowledge.getWorkById(
        settings.workId
      );
  }

  if (
    !workItem &&
    settings.workName
  ) {
    workItem =
      knowledge.findWorkByName(
        settings.workName
      );
  }

  if (!workItem) {
    return {
      success: false,
      errorCode:
        'WORK_NOT_FOUND',
      errorMessage:
        'Работа не найдена в базе дорожных работ.',
      requestedWorkId:
        settings.workId || '',
      requestedWorkName:
        settings.workName || ''
    };
  }

  const projectMaterials =
    normalizeEngineeringAuditMaterials(
      settings.materials
    );

  const expectedMaterials =
    (workItem.materials || [])
      .map(function (
        expectedMaterial
      ) {
        const matchedMaterial =
          findEngineeringAuditMaterial(
            expectedMaterial,
            projectMaterials
          );

        return (
          createEngineeringAuditMaterialResult(
            expectedMaterial,
            matchedMaterial
          )
        );
      });

  const missingRequiredMaterials =
    expectedMaterials.filter(
      function (item) {
        return (
          item.required &&
          !item.found
        );
      }
    );

  const typicalMissingChecks =
    buildEngineeringAuditMissingChecks(
      workItem,
      projectMaterials
    );

  const severity =
    calculateEngineeringAuditSeverity(
      missingRequiredMaterials,
      typicalMissingChecks,
      projectMaterials
    );

  const audit = {
    success: true,

    version:
      ENGINEERING_AUDIT_VERSION,

    generatedAt:
      new Date().toISOString(),

    requiresEngineerConfirmation:
      true,

    disclaimer:
      'Результат является предварительной инженерной рекомендацией и требует проверки специалистом.',

    work: {
      id:
        workItem.id,

      name:
        workItem.name,

      categoryId:
        workItem.categoryId,

      categoryName:
        workItem.categoryName,

      description:
        workItem.description || ''
    },

    severity,

    projectMaterials,

    expectedMaterials,

    missingRequiredMaterials,

    typicalMissingChecks,

    tools:
      (workItem.tools || []).map(
        function (tool) {
          return {
            ...tool
          };
        }
      ),

    equipment:
      (
        workItem.equipment ||
        []
      ).map(
        function (equipmentItem) {
          return {
            ...equipmentItem
          };
        }
      ),

    crew: {
      suggestedRoles:
        (
          workItem.crew &&
          workItem.crew
            .suggestedRoles
            ? workItem.crew
                .suggestedRoles
            : []
        ).map(
          function (roleItem) {
            return {
              ...roleItem
            };
          }
        ),

      note:
        workItem.crew &&
        workItem.crew.note
          ? workItem.crew.note
          : ''
    },

    checks:
      [
        ...(workItem.checks || [])
      ],

    risks:
      [
        ...(workItem.risks || [])
      ],

    relatedWorkIds:
      [
        ...(
          workItem.relatedWorkIds ||
          []
        )
      ]
  };

  audit.summary =
    buildEngineeringAuditSummary(
      audit
    );

  return audit;
}

function getEngineeringAuditReadableResult(
  audit
) {
  if (
    !audit ||
    !audit.success
  ) {
    return (
      audit &&
      audit.errorMessage
        ? audit.errorMessage
        : 'Не удалось сформировать аудит.'
    );
  }

  const lines = [
    'ИНЖЕНЕРНЫЙ АУДИТ BUILDMIND',
    '',
    `Работа: ${audit.work.name}`,
    `Категория: ${audit.work.categoryName}`,
    `Статус: ${audit.severity.label}`,
    '',
    'Ожидаемые материалы:'
  ];

  audit.expectedMaterials.forEach(
    function (item) {
      lines.push(
        (
          item.found
            ? '✓ '
            : '⚠ '
        ) +
        item.name +
        (
          item.required
            ? ' — обязательная позиция'
            : ''
        )
      );
    }
  );

  lines.push('');
  lines.push(
    'Позиции для дополнительной проверки:'
  );

  const unresolvedTypical =
    audit.typicalMissingChecks.filter(
      function (item) {
        return !item.found;
      }
    );

  if (
    unresolvedTypical.length === 0
  ) {
    lines.push(
      '✓ Дополнительных позиций не выявлено.'
    );
  } else {
    unresolvedTypical.forEach(
      function (item) {
        lines.push(
          `⚠ ${item.name}: ` +
          item.reason
        );
      }
    );
  }

  lines.push('');
  lines.push(
    'Рекомендуемая техника:'
  );

  if (audit.equipment.length === 0) {
    lines.push('— Не указана.');
  } else {
    audit.equipment.forEach(
      function (item) {
        lines.push(
          `• ${item.name}` +
          (
            item.quantityHint
              ? ` — ориентировочно ${item.quantityHint}`
              : ''
          )
        );
      }
    );
  }

  lines.push('');
  lines.push(
    'Предварительный состав бригады:'
  );

  if (
    audit.crew
      .suggestedRoles.length === 0
  ) {
    lines.push('— Не указан.');
  } else {
    audit.crew
      .suggestedRoles
      .forEach(
        function (item) {
          lines.push(
            `• ${item.role}` +
            (
              item.quantityHint
                ? ` — ${item.quantityHint}`
                : ''
            )
          );
        }
      );
  }

  lines.push('');
  lines.push(
    'Важно: результат требует подтверждения инженером.'
  );

  return lines.join('\n');
}

window.BuildMindEngineeringAudit = {
  version:
    ENGINEERING_AUDIT_VERSION,

  normalizeText:
    normalizeEngineeringAuditText,

  textsMatch:
    engineeringAuditTextsMatch,

  normalizeMaterials:
    normalizeEngineeringAuditMaterials,

  run:
    runEngineeringAudit,

  toText:
    getEngineeringAuditReadableResult
};

console.info(
  'BuildMind Engineering Audit загружен:',
  {
    version:
      ENGINEERING_AUDIT_VERSION
  }
);
