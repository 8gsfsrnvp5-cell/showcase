'use strict';

/*
  ==================================================
  BUILDMIND PROJECT ANALYSIS UI — V1
  ==================================================

  Собирает в одном экране уже найденные данные:
  - PDF -> текущий PDF-анализ app.js
  - XLSX / XLS / CSV -> BuildMindWorkVolume

  Модуль ничего не придумывает и не создаёт
  проектные данные сам.
*/

const BUILDMIND_PROJECT_ANALYSIS_VERSION =
  'project-analysis-ui-v1';

const PROJECT_ANALYSIS_PREVIEW_LIMIT = 15;


function escapeProjectAnalysisHtml(value) {
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


function formatProjectAnalysisNumber(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return String(value ?? '');
  }

  return number.toLocaleString(
    'ru-RU',
    {
      maximumFractionDigits: 4
    }
  );
}


function getProjectAnalysisDocuments() {
  if (
    typeof uploadedProjectDocuments !==
      'undefined' &&
    Array.isArray(
      uploadedProjectDocuments
    )
  ) {
    return uploadedProjectDocuments;
  }

  return [];
}


function getProjectAnalysisExtension(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return '';
  }

  const parts =
    String(
      documentItem.file.name ||
      ''
    ).split('.');

  return parts.length > 1
    ? parts.pop().toLowerCase()
    : '';
}


function setProjectAnalysisText(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.textContent =
      String(value ?? '');
  }
}


function getProjectAnalysisConfidenceLabel(
  value
) {
  if (!value) {
    return 'Не определена';
  }

  if (
    typeof value ===
      'string'
  ) {
    return value;
  }

  if (
    typeof value ===
      'object' &&
    value.label
  ) {
    return value.label;
  }

  return 'Не определена';
}


function getProjectAnalysisTableLabel(
  analysis
) {
  if (
    !analysis ||
    !Array.isArray(
      analysis.sheets
    )
  ) {
    return 'Табличный документ';
  }

  const classifications =
    analysis.sheets
      .map(function (sheet) {
        return (
          sheet &&
          sheet.tableClassification
            ? sheet.tableClassification
            : null
        );
      })
      .filter(Boolean);

  if (
    classifications.length ===
    0
  ) {
    return 'Табличный документ';
  }

  const best =
    classifications.find(
      function (classification) {
        return (
          classification.id &&
          classification.id !==
            'unknown-table'
        );
      }
    ) ||
    classifications[0];

  return (
    best.label ||
    'Табличный документ'
  );
}


function getProjectAnalysisTableDetails(
  analysis
) {
  if (!analysis) {
    return 'Анализ не выполнен';
  }

  const sheets =
    Array.isArray(
      analysis.sheets
    )
      ? analysis.sheets
      : [];

  const sheetNames =
    sheets
      .map(function (sheet) {
        return sheet.sheetName;
      })
      .filter(Boolean);

  const parts = [];

  if (
    sheetNames.length > 0
  ) {
    parts.push(
      'Листы: ' +
      sheetNames.join(', ')
    );
  }

  parts.push(
    'Извлечено строк-кандидатов: ' +
    Number(
      analysis.candidatesCount ||
      0
    )
  );

  return parts.join(' · ');
}


function createProjectAnalysisRowItem(
  candidate,
  kind
) {
  const sourceParts = [
    candidate.sourceDocument ||
    ''
  ];

  if (candidate.sourceSheet) {
    sourceParts.push(
      'лист ' +
      candidate.sourceSheet
    );
  }

  if (candidate.sourceRow) {
    sourceParts.push(
      'строка ' +
      candidate.sourceRow
    );
  }

  let note =
    'Требуется проверка инженером.';

  if (kind === 'work') {
    note =
      candidate
        .automaticWorkVolumeAllowed ===
        true
        ? (
            'Строка распознана как работа. ' +
            'Объём может использоваться только после инженерной проверки.'
          )
        : (
            'Строка похожа на работу, ' +
            'но источник не разрешает автоматическое использование объёма.'
          );
  } else if (
    kind === 'material'
  ) {
    note =
      'Строка распознана как материал / ' +
      'строительный ресурс и не используется как объём работы.';
  } else if (
    kind === 'machinery'
  ) {
    note =
      'Строка распознана как машина / механизм ' +
      'и не используется как объём работы.';
  } else if (
    kind === 'uncertain'
  ) {
    note =
      'Тип строки надёжно не определён. ' +
      'Требуется инженерная классификация.';
  }

  return {
    kind,

    name:
      candidate.workName ||
      'Без названия',

    quantity:
      candidate.quantity,

    unit:
      candidate.unit ||
      '',

    source:
      sourceParts
        .filter(Boolean)
        .join(' · '),

    confidence:
      getProjectAnalysisConfidenceLabel(
        candidate.rowConfidence
      ),

    note,

    sourceTag:
      'REAL DOCUMENT'
  };
}


function createProjectAnalysisPdfMaterialItem(
  documentItem,
  candidate
) {
  const fileName =
    documentItem &&
    documentItem.file
      ? documentItem.file.name
      : '';

  let statusText =
    'Требует проверки';

  if (
    candidate.transferStatus ===
      'transferred'
  ) {
    statusText =
      'Перенесено в материалы';
  } else if (
    candidate.reviewStatus ===
      'confirmed'
  ) {
    statusText =
      'Подтверждено инженером';
  } else if (
    candidate.reviewStatus ===
      'rejected'
  ) {
    statusText =
      'Отклонено инженером';
  }

  return {
    kind:
      'material',

    name:
      candidate.name ||
      'Без названия',

    quantity:
      candidate.quantity,

    unit:
      candidate.unit ||
      '',

    source:
      [
        fileName,

        candidate.pageNumber
          ? (
              'страница ' +
              candidate.pageNumber
            )
          : ''
      ]
        .filter(Boolean)
        .join(' · '),

    confidence:
      statusText,

    note:
      'Кандидат материала найден в PDF. ' +
      'Использование требует инженерного подтверждения.',

    sourceTag:
      'REAL DOCUMENT'
  };
}


function renderProjectAnalysisItems(
  containerId,
  items,
  emptyText
) {
  const container =
    document.getElementById(
      containerId
    );

  if (!container) {
    return;
  }

  const sourceItems =
    Array.isArray(items)
      ? items
      : [];

  if (
    sourceItems.length ===
    0
  ) {
    container.innerHTML =
      '<div class="project-analysis-empty">' +
      escapeProjectAnalysisHtml(
        emptyText
      ) +
      '</div>';

    return;
  }

  const rows =
    sourceItems
      .slice(
        0,
        PROJECT_ANALYSIS_PREVIEW_LIMIT
      )
      .map(function (item) {
        const quantityText =
          item.quantity !==
            undefined &&
          item.quantity !==
            null
            ? (
                formatProjectAnalysisNumber(
                  item.quantity
                ) +
                (
                  item.unit
                    ? (
                        ' ' +
                        item.unit
                      )
                    : ''
                )
              )
            : '—';

        return `
          <article class="project-analysis-item">
            <div class="project-analysis-item-main">

              <div class="project-analysis-tags">
                <span class="project-analysis-source-tag">
                  ${escapeProjectAnalysisHtml(
                    item.sourceTag
                  )}
                </span>

                <span
                  class="project-analysis-kind-tag
                  project-analysis-kind-${escapeProjectAnalysisHtml(
                    item.kind
                  )}"
                >
                  ${escapeProjectAnalysisHtml(
                    item.kind
                  )}
                </span>
              </div>

              <strong>
                ${escapeProjectAnalysisHtml(
                  item.name
                )}
              </strong>

              <p>
                <b>Источник:</b>
                ${escapeProjectAnalysisHtml(
                  item.source ||
                  '—'
                )}
              </p>

              <p>
                <b>Уверенность:</b>
                ${escapeProjectAnalysisHtml(
                  item.confidence
                )}
              </p>

              <small>
                ${escapeProjectAnalysisHtml(
                  item.note
                )}
              </small>
            </div>

            <div class="project-analysis-quantity">
              ${escapeProjectAnalysisHtml(
                quantityText
              )}
            </div>
          </article>
        `;
      })
      .join('');

  const limitMessage =
    sourceItems.length >
      PROJECT_ANALYSIS_PREVIEW_LIMIT
      ? (
          '<div class="project-analysis-limit">' +
          'Показаны первые ' +
          PROJECT_ANALYSIS_PREVIEW_LIMIT +
          ' из ' +
          sourceItems.length +
          ' позиций.' +
          '</div>'
        )
      : '';

  container.innerHTML =
    rows +
    limitMessage;
}


function renderProjectAnalysisDocuments(
  documents
) {
  const container =
    document.getElementById(
      'projectAnalysisDocuments'
    );

  if (!container) {
    return;
  }

  if (
    !Array.isArray(documents) ||
    documents.length === 0
  ) {
    container.innerHTML =
      '<div class="project-analysis-empty">' +
      'Документы ещё не анализировались.' +
      '</div>';

    return;
  }

  container.innerHTML =
    documents
      .map(function (item) {
        return `
          <article class="project-analysis-document">
            <div>

              <span class="project-analysis-source-tag">
                REAL DOCUMENT
              </span>

              <strong>
                ${escapeProjectAnalysisHtml(
                  item.fileName
                )}
              </strong>

              <p>
                ${escapeProjectAnalysisHtml(
                  item.typeLabel
                )}
              </p>

              <small>
                ${escapeProjectAnalysisHtml(
                  item.details
                )}
              </small>
            </div>

            <span class="project-analysis-document-status">
              ${escapeProjectAnalysisHtml(
                item.statusLabel
              )}
            </span>
          </article>
        `;
      })
      .join('');
}


function renderBuildMindProjectAnalysis(
  result
) {
  const safeResult =
    result &&
    typeof result ===
      'object'
      ? result
      : {};

  const works =
    safeResult.works ||
    [];

  const materialsFound =
    safeResult.materials ||
    [];

  const machinery =
    safeResult.machinery ||
    [];

  const uncertain =
    safeResult.uncertain ||
    [];

  const automaticVolumes =
    works.filter(
      function (item) {
        return (
          item
            .automaticWorkVolumeAllowed ===
          true
        );
      }
    );

  setProjectAnalysisText(
    'projectAnalysisDocumentsCount',
    safeResult.documentsCount ||
    0
  );

  setProjectAnalysisText(
    'projectAnalysisWorksCount',
    works.length
  );

  setProjectAnalysisText(
    'projectAnalysisVolumesCount',
    automaticVolumes.length
  );

  setProjectAnalysisText(
    'projectAnalysisMaterialsCount',
    materialsFound.length
  );

  setProjectAnalysisText(
    'projectAnalysisMachineryCount',
    machinery.length
  );

  setProjectAnalysisText(
    'projectAnalysisReviewCount',
    safeResult.requiresReviewCount ||
    0
  );

  renderProjectAnalysisDocuments(
    safeResult.documents ||
    []
  );

  renderProjectAnalysisItems(
    'projectAnalysisWorks',

    works.map(
      function (candidate) {
        return createProjectAnalysisRowItem(
          candidate,
          'work'
        );
      }
    ),

    'Работы пока не найдены.'
  );

  renderProjectAnalysisItems(
    'projectAnalysisMaterials',

    materialsFound,

    'Материалы пока не найдены.'
  );

  renderProjectAnalysisItems(
    'projectAnalysisMachinery',

    machinery.map(
      function (candidate) {
        return createProjectAnalysisRowItem(
          candidate,
          'machinery'
        );
      }
    ),

    'Машины и механизмы пока не найдены.'
  );

  renderProjectAnalysisItems(
    'projectAnalysisUncertain',

    uncertain.map(
      function (candidate) {
        return createProjectAnalysisRowItem(
          candidate,
          'uncertain'
        );
      }
    ),

    'Неопределённых строк нет.'
  );
}


async function analyzeProjectAnalysisPdf(
  documentItem
) {
  let analysis =
    documentItem.analysis ||
    null;

  if (
    !analysis ||
    analysis.success !==
      true
  ) {
    if (
      typeof inspectPdfDocument !==
        'function'
    ) {
      return {
        documentResult: {
          fileName:
            documentItem.file.name,

          typeLabel:
            'PDF-документ',

          details:
            'PDF-анализатор недоступен.',

          statusLabel:
            'Не проанализирован'
        },

        materials: []
      };
    }

    documentItem.status =
      'analyzing';

    if (
      typeof renderProjectDocuments ===
        'function'
    ) {
      renderProjectDocuments();
    }

    analysis =
      await inspectPdfDocument(
        documentItem
      );

    documentItem.analysis =
      analysis;

    documentItem.status =
      analysis.success
        ? 'analyzed'
        : 'error';
  }

  const classification =
    analysis &&
    analysis.documentClassification
      ? analysis.documentClassification
      : null;

  const materialsFound =
    analysis &&
    Array.isArray(
      analysis.materialCandidates
    )
      ? analysis
          .materialCandidates
          .map(function (candidate) {
            return createProjectAnalysisPdfMaterialItem(
              documentItem,
              candidate
            );
          })
      : [];

  return {
    documentResult: {
      fileName:
        documentItem.file.name,

      typeLabel:
        classification
          ? classification.label
          : 'PDF-документ',

      details:
        analysis &&
        analysis.success
          ? (
              'Страниц: ' +
              Number(
                analysis.totalPages ||
                0
              ) +
              ' · Текстовых страниц: ' +
              Number(
                analysis.pagesWithText ||
                0
              ) +
              ' · Кандидатов материалов: ' +
              materialsFound.length
            )
          : (
              analysis &&
              analysis.errorMessage
                ? analysis.errorMessage
                : 'Не удалось выполнить анализ.'
            ),

      statusLabel:
        analysis &&
        analysis.success
          ? 'Проанализирован'
          : 'Ошибка анализа'
    },

    materials:
      materialsFound
  };
}


async function analyzeProjectAnalysisTable(
  documentItem
) {
  const engine =
    window.BuildMindWorkVolume;

  if (
    !engine ||
    typeof engine.analyzeDocument !==
      'function'
  ) {
    return {
      documentResult: {
        fileName:
          documentItem.file.name,

        typeLabel:
          'Табличный документ',

        details:
          'Work Volume Engine недоступен.',

        statusLabel:
          'Не проанализирован'
      },

      works: [],
      materials: [],
      machinery: [],
      uncertain: []
    };
  }

  documentItem.status =
    'analyzing';

  if (
    typeof renderProjectDocuments ===
      'function'
  ) {
    renderProjectDocuments();
  }

  const analysis =
    await engine.analyzeDocument(
      documentItem
    );

  documentItem.workVolumeAnalysis =
    analysis;

  /*
    WORK_VOLUME_HEADER_NOT_FOUND
    не означает, что Excel не прочитан.

    Это может быть ГПР или другая
    структурированная таблица.
  */

  documentItem.status =
    analysis
      ? 'analyzed'
      : 'error';

  const candidates =
    analysis &&
    Array.isArray(
      analysis.candidates
    )
      ? analysis.candidates
      : [];

  const works = [];

  const materialsFound = [];

  const machinery = [];

  const uncertain = [];

  candidates.forEach(
    function (candidate) {
      if (
        candidate.rowType ===
          'work'
      ) {
        works.push(
          candidate
        );

        return;
      }

      if (
        candidate.rowType ===
          'material'
      ) {
        materialsFound.push(
          createProjectAnalysisRowItem(
            candidate,
            'material'
          )
        );

        return;
      }

      if (
        candidate.rowType ===
          'machinery'
      ) {
        machinery.push(
          candidate
        );

        return;
      }

      if (
        candidate.rowType ===
          'uncertain'
      ) {
        uncertain.push(
          candidate
        );
      }
    }
  );

  return {
    documentResult: {
      fileName:
        documentItem.file.name,

      typeLabel:
        getProjectAnalysisTableLabel(
          analysis
        ),

      details:
        getProjectAnalysisTableDetails(
          analysis
        ),

      statusLabel:
        'Проанализирован'
    },

    works,

    materials:
      materialsFound,

    machinery,

    uncertain
  };
}


async function runBuildMindProjectAnalysis() {
  const button =
    document.getElementById(
      'projectAnalysisBtn'
    );

  const status =
    document.getElementById(
      'projectAnalysisStatus'
    );

  const documents =
    getProjectAnalysisDocuments();

  if (
    documents.length ===
    0
  ) {
    if (status) {
      status.textContent =
        'Сначала загрузите проектные документы.';
    }

    renderBuildMindProjectAnalysis({
      documentsCount: 0,
      documents: [],
      works: [],
      materials: [],
      machinery: [],
      uncertain: [],
      requiresReviewCount: 0
    });

    return {
      success: false,

      errorCode:
        'PROJECT_DOCUMENTS_NOT_FOUND'
    };
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'Анализ проекта...';
  }

  if (status) {
    status.textContent =
      'BuildMind анализирует загруженные документы.';
  }

  const result = {
    success:
      true,

    version:
      BUILDMIND_PROJECT_ANALYSIS_VERSION,

    documentsCount:
      documents.length,

    documents: [],

    works: [],

    materials: [],

    machinery: [],

    uncertain: [],

    requiresReviewCount:
      0
  };

  try {
    for (
      let index = 0;
      index <
        documents.length;
      index += 1
    ) {
      const documentItem =
        documents[index];

      const extension =
        getProjectAnalysisExtension(
          documentItem
        );

      if (status) {
        status.textContent =
          'Анализируется ' +
          (index + 1) +
          ' из ' +
          documents.length +
          ': ' +
          documentItem.file.name;
      }

      if (
        extension ===
        'pdf'
      ) {
        const pdfResult =
          await analyzeProjectAnalysisPdf(
            documentItem
          );

        result.documents.push(
          pdfResult.documentResult
        );

        result.materials.push(
          ...pdfResult.materials
        );

        continue;
      }

      if (
        extension === 'xlsx' ||
        extension === 'xls' ||
        extension === 'csv'
      ) {
        const tableResult =
          await analyzeProjectAnalysisTable(
            documentItem
          );

        result.documents.push(
          tableResult.documentResult
        );

        result.works.push(
          ...tableResult.works
        );

        result.materials.push(
          ...tableResult.materials
        );

        result.machinery.push(
          ...tableResult.machinery
        );

        result.uncertain.push(
          ...tableResult.uncertain
        );

        continue;
      }

      result.documents.push({
        fileName:
          documentItem.file.name,

        typeLabel:
          'Неподдерживаемый документ',

        details:
          'Формат не участвует в анализе.',

        statusLabel:
          'Пропущен'
      });
    }

    result.requiresReviewCount =
      result.works.length +
      result.materials.length +
      result.machinery.length +
      result.uncertain.length;

    renderBuildMindProjectAnalysis(
      result
    );

    if (
      typeof renderProjectDocuments ===
        'function'
    ) {
      renderProjectDocuments();
    }

    if (status) {
      status.textContent =
        'Анализ завершён. ' +
        'Результаты сформированы автоматически ' +
        'и требуют инженерной проверки.';
    }

    window
      .BuildMindProjectAnalysis
      .lastResult =
      result;

    return result;
  } catch (error) {
    console.error(
      'Ошибка Project Analysis:',
      error
    );

    if (status) {
      status.textContent =
        'Во время анализа произошла ошибка. ' +
        'Проверьте Console.';
    }

    return {
      success: false,

      errorCode:
        'PROJECT_ANALYSIS_ERROR',

      error
    };
  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        'Анализировать проект';
    }
  }
}


function initializeBuildMindProjectAnalysis() {
  const button =
    document.getElementById(
      'projectAnalysisBtn'
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    'click',
    runBuildMindProjectAnalysis
  );

  renderBuildMindProjectAnalysis({
    documentsCount: 0,
    documents: [],
    works: [],
    materials: [],
    machinery: [],
    uncertain: [],
    requiresReviewCount: 0
  });
}


window.BuildMindProjectAnalysis = {
  version:
    BUILDMIND_PROJECT_ANALYSIS_VERSION,

  run:
    runBuildMindProjectAnalysis,

  render:
    renderBuildMindProjectAnalysis,

  lastResult:
    null
};


initializeBuildMindProjectAnalysis();


console.info(
  'BuildMind Project Analysis UI загружен:',
  BUILDMIND_PROJECT_ANALYSIS_VERSION
);
