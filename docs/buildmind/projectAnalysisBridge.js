'use strict';

/* ==================================================
   BUILDMIND PROJECT ANALYSIS BRIDGE — V1

   Сквозной слой между анализом комплекта и рабочими
   разделами продукта. Сохраняет только компактный
   инженерный снимок; File-объекты и полный OCR-текст
   в localStorage не записываются.
   ================================================== */

const BUILDMIND_PROJECT_ANALYSIS_VERSION =
  'project-analysis-bridge-v1';

const PROJECT_ANALYSIS_STORAGE_KEY =
  'buildmind-project-analysis-snapshot-v1';

let projectAnalysisSnapshot = null;


function cloneProjectAnalysis(value) {
  return value == null
    ? null
    : JSON.parse(JSON.stringify(value));
}


function normalizeProjectAnalysisText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/^\s*[\[({]?\d+(?:[.\-/]\d+)*[\])}]?\s*/u, '')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function normalizeProjectAnalysisCode(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-zа-я0-9.\-/]/giu, '');
}


function projectAnalysisHash(value) {
  const source = String(value || '');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}


function getProjectAnalysisCandidateFiles(candidate) {
  return Array.from(
    new Set(
      [
        candidate?.fileName,
        candidate?.sourceDocument,
        ...(
          Array.isArray(candidate?.sourceDocuments)
            ? candidate.sourceDocuments
            : []
        )
      ].filter(Boolean)
    )
  );
}


function getProjectAnalysisCandidatePages(candidate) {
  return Array.from(
    new Set(
      [
        candidate?.pageNumber,
        candidate?.sourcePage,
        ...(
          Array.isArray(candidate?.pageNumbers)
            ? candidate.pageNumbers
            : []
        ),
        ...(
          Array.isArray(candidate?.sourcePages)
            ? candidate.sourcePages
            : []
        )
      ]
        .map(Number)
        // Number(null) === 0: отсутствующая страница не становится «стр. 0».
        .filter(function (page) {
          return Number.isInteger(page) && page > 0;
        })
    )
  ).sort(function (first, second) {
    return first - second;
  });
}


function sanitizeProjectAnalysisCandidate(candidate) {
  return {
    workCode:
      candidate?.workCode ||
      candidate?.code ||
      candidate?.positionNumber ||
      '',
    workName:
      candidate?.workName ||
      candidate?.name ||
      '',
    unit:
      candidate?.unit ||
      '',
    quantity:
      candidate?.quantity ??
      null,
    startDate:
      candidate?.startDate ||
      '',
    finishDate:
      candidate?.finishDate ||
      candidate?.endDate ||
      '',
    durationDays:
      candidate?.durationDays ??
      null,
    confidence:
      typeof candidate?.confidence === 'string'
        ? candidate.confidence
        : candidate?.confidence?.level || '',
    rowType:
      candidate?.rowType ||
      'work',
    sourceType:
      candidate?.sourceType ||
      '',
    sourceSheet:
      candidate?.sourceSheet ||
      '',
    sourceRow:
      candidate?.sourceRow ??
      null,
    sourceDocuments:
      getProjectAnalysisCandidateFiles(candidate),
    sourcePages:
      getProjectAnalysisCandidatePages(candidate),
    scheduleReviewRequired:
      candidate?.scheduleReviewRequired === true,
    scheduleReviewReasons:
      Array.isArray(candidate?.scheduleReviewReasons)
        ? candidate.scheduleReviewReasons.slice(0, 5)
        : [],
    measureReviewRequired:
      candidate?.measureReviewRequired === true,
    requiresEngineerConfirmation:
      candidate?.requiresEngineerConfirmation === true
  };
}


function sanitizeProjectAnalysisReviewItem(item) {
  return {
    reviewType:
      item?.reviewType ||
      item?.code ||
      'review',
    code:
      item?.code ||
      '',
    fileName:
      item?.fileName ||
      '',
    workName:
      item?.workName ||
      item?.name ||
      '',
    startDate:
      item?.startDate ||
      '',
    finishDate:
      item?.finishDate ||
      item?.endDate ||
      '',
    sourceRow:
      item?.sourceRow ??
      null,
    sourceSheet:
      item?.sourceSheet ||
      '',
    pageNumbers:
      Array.isArray(item?.pageNumbers)
        ? item.pageNumbers.slice(0, 30)
        : [],
    reason:
      item?.reason ||
      item?.message ||
      '',
    reasons:
      Array.isArray(item?.reasons)
        ? item.reasons.slice(0, 8)
        : []
  };
}


function getProjectAnalysisRowSource(row) {
  return row
    ? {
        sourceDocuments: [...(row.sourceDocuments || [])],
        sourcePages: [...(row.sourcePages || [])],
        sourceSheet: row.sourceSheet || '',
        sourceRow: row.sourceRow ?? null
      }
    : null;
}


function sanitizeProjectAnalysisAgentReport(report) {
  const source =
    report?.payload?.sourceDocument ||
    report?.payload?.fileName ||
    report?.metadata?.fileName ||
    '';

  return {
    reportId:
      report?.reportId || '',
    agentId:
      report?.agentId || '',
    taskType:
      report?.taskType || '',
    label:
      report?.metadata?.label || '',
    status:
      report?.status || '',
    truthStatus:
      report?.truthStatus || 'needs-review',
    qualityFlags:
      Array.isArray(report?.qualityFlags)
        ? report.qualityFlags.slice(0, 10)
        : [],
    evidenceCount:
      Array.isArray(report?.evidence)
        ? report.evidence.length
        : 0,
    sourceFile:
      typeof source === 'string' ? source : ''
  };
}


function projectAnalysisTokenScore(firstName, secondName) {
  const firstTokens = new Set(
    normalizeProjectAnalysisText(firstName)
      .split(' ')
      .filter(function (token) {
        return token.length > 2;
      })
  );
  const secondTokens = new Set(
    normalizeProjectAnalysisText(secondName)
      .split(' ')
      .filter(function (token) {
        return token.length > 2;
      })
  );

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  firstTokens.forEach(function (token) {
    if (secondTokens.has(token)) {
      intersection += 1;
    }
  });

  return intersection /
    Math.max(firstTokens.size, secondTokens.size);
}


function scoreProjectAnalysisWorkMatch(scheduleRow, volumeRow) {
  const scheduleName =
    normalizeProjectAnalysisText(scheduleRow?.workName);
  const volumeName =
    normalizeProjectAnalysisText(volumeRow?.workName);
  const scheduleCode =
    normalizeProjectAnalysisCode(scheduleRow?.workCode);
  const volumeCode =
    normalizeProjectAnalysisCode(volumeRow?.workCode);
  const tokenScore =
    projectAnalysisTokenScore(scheduleName, volumeName);
  const scheduleUnit =
    normalizeProjectAnalysisText(scheduleRow?.unit);
  const volumeUnit =
    normalizeProjectAnalysisText(volumeRow?.unit);
  const unitsCompatible =
    !scheduleUnit ||
    !volumeUnit ||
    scheduleUnit === volumeUnit;

  if (
    scheduleName &&
    volumeName &&
    scheduleName === volumeName &&
    unitsCompatible
  ) {
    return 1;
  }

  if (
    scheduleCode &&
    volumeCode &&
    scheduleCode === volumeCode &&
    tokenScore >= 0.35 &&
    unitsCompatible
  ) {
    return 0.96;
  }

  if (tokenScore >= 0.78 && unitsCompatible) {
    return 0.8 + tokenScore * 0.15;
  }

  return 0;
}


function buildProjectAnalysisCombinedRows(
  workVolumeRows,
  scheduleRows
) {
  const volumeRows =
    Array.isArray(workVolumeRows)
      ? workVolumeRows
      : [];
  const planRows =
    Array.isArray(scheduleRows)
      ? scheduleRows
      : [];
  const matchedVolumeIndexes = new Set();
  const rows = planRows.map(function (scheduleRow, scheduleIndex) {
    let bestIndex = -1;
    let bestScore = 0;

    volumeRows.forEach(function (volumeRow, volumeIndex) {
      const score =
        scoreProjectAnalysisWorkMatch(scheduleRow, volumeRow);

      if (score > bestScore) {
        bestIndex = volumeIndex;
        bestScore = score;
      }
    });

    const volumeRow =
      bestIndex >= 0 && bestScore >= 0.78
        ? volumeRows[bestIndex]
        : null;

    if (volumeRow) {
      matchedVolumeIndexes.add(bestIndex);
    }

    return {
      rowId:
        'schedule-' + scheduleIndex,
      vorSource:
        getProjectAnalysisRowSource(volumeRow),
      gprSource:
        getProjectAnalysisRowSource(scheduleRow),
      status:
        volumeRow
          ? 'matched'
          : 'schedule-only',
      matchScore:
        volumeRow
          ? Number(bestScore.toFixed(3))
          : 0,
      workCode:
        scheduleRow.workCode ||
        volumeRow?.workCode ||
        '',
      workName:
        scheduleRow.workName ||
        volumeRow?.workName ||
        '',
      unit:
        scheduleRow.unit ||
        volumeRow?.unit ||
        '',
      vorQuantity:
        volumeRow?.quantity ??
        null,
      gprQuantity:
        scheduleRow.quantity ??
        null,
      startDate:
        scheduleRow.startDate ||
        '',
      finishDate:
        scheduleRow.finishDate ||
        '',
      requiresReview:
        scheduleRow.scheduleReviewRequired === true ||
        scheduleRow.measureReviewRequired === true,
      reviewReasons:
        [
          ...(scheduleRow.scheduleReviewReasons || []),
          ...(
            scheduleRow.measureReviewRequired
              ? ['Проверить единицу измерения или количество ГПР.']
              : []
          )
        ],
      sourceDocuments:
        Array.from(
          new Set([
            ...(volumeRow?.sourceDocuments || []),
            ...(scheduleRow.sourceDocuments || [])
          ])
        ),
      sourcePages:
        Array.from(
          new Set([
            ...(volumeRow?.sourcePages || []),
            ...(scheduleRow.sourcePages || [])
          ])
        ).sort(function (first, second) {
          return first - second;
        })
    };
  });

  volumeRows.forEach(function (volumeRow, volumeIndex) {
    if (matchedVolumeIndexes.has(volumeIndex)) {
      return;
    }

    rows.push({
      rowId:
        'volume-' + volumeIndex,
      vorSource:
        getProjectAnalysisRowSource(volumeRow),
      gprSource:
        null,
      status:
        'volume-only',
      matchScore:
        0,
      workCode:
        volumeRow.workCode || '',
      workName:
        volumeRow.workName || '',
      unit:
        volumeRow.unit || '',
      vorQuantity:
        volumeRow.quantity ?? null,
      gprQuantity:
        null,
      startDate:
        '',
      finishDate:
        '',
      requiresReview:
        volumeRow.measureReviewRequired === true,
      reviewReasons:
        volumeRow.measureReviewRequired
          ? ['Проверить единицу измерения или количество ВОР.']
          : [],
      sourceDocuments:
        [...(volumeRow.sourceDocuments || [])],
      sourcePages:
        [...(volumeRow.sourcePages || [])]
    });
  });

  return {
    rows,
    matchedScheduleRowsCount:
      rows.filter(function (row) {
        return row.status === 'matched';
      }).length,
    matchedWorkVolumeRowsCount:
      matchedVolumeIndexes.size,
    scheduleOnlyRowsCount:
      rows.filter(function (row) {
        return row.status === 'schedule-only';
      }).length,
    workVolumeOnlyRowsCount:
      rows.filter(function (row) {
        return row.status === 'volume-only';
      }).length
  };
}


function getProjectAnalysisRowsForRole(
  works,
  documents,
  role
) {
  const roleFiles = new Set(
    documents
      .filter(function (documentItem) {
        return documentItem.documentRole === role;
      })
      .map(function (documentItem) {
        return documentItem.fileName;
      })
  );

  return works.filter(function (candidate) {
    return candidate.sourceDocuments.some(function (fileName) {
      return roleFiles.has(fileName);
    });
  });
}


function buildProjectAnalysisSnapshot(result) {
  if (!result || result.success !== true) {
    return null;
  }

  const savedAt = new Date().toISOString();
  const works = (Array.isArray(result.works) ? result.works : [])
    .map(sanitizeProjectAnalysisCandidate);
  const materials = (Array.isArray(result.materials) ? result.materials : [])
    .map(sanitizeProjectAnalysisCandidate);
  const baseDocuments =
    (Array.isArray(result.documents) ? result.documents : [])
      .map(function (documentItem) {
        const fileName = documentItem?.fileName || '';
        const documentWorks = works.filter(function (candidate) {
          return candidate.sourceDocuments.includes(fileName);
        });
        const documentMaterials = materials.filter(function (candidate) {
          return candidate.sourceDocuments.includes(fileName);
        });
        const fingerprintSource = JSON.stringify({
          fileName,
          documentRole: documentItem?.documentRole || 'auto',
          kind: documentItem?.kind || 'other',
          totalPages: Number(documentItem?.totalPages) || 0,
          ocrPages: Array.isArray(documentItem?.ocrPages)
            ? documentItem.ocrPages
            : [],
          unreadablePages: Array.isArray(documentItem?.unreadablePages)
            ? documentItem.unreadablePages
            : [],
          works: documentWorks.map(function (item) {
            return [
              item.workCode,
              item.workName,
              item.unit,
              item.quantity,
              item.startDate,
              item.finishDate
            ];
          }),
          materials: documentMaterials.map(function (item) {
            return [
              item.workName,
              item.unit,
              item.quantity
            ];
          })
        });

        return {
          documentId:
            documentItem?.documentId || '',
          fileName,
          extension:
            documentItem?.extension || '',
          documentRole:
            documentItem?.documentRole || 'auto',
          documentRoleSource:
            documentItem?.documentRoleSource || '',
          kind:
            documentItem?.kind || 'other',
          confidence:
            documentItem?.confidence || 'low',
          totalPages:
            Number(documentItem?.totalPages) || 0,
          extractedPagesCount:
            Number(documentItem?.extractedPagesCount) || 0,
          pagesWithText:
            Number(documentItem?.pagesWithText) || 0,
          ocrPages:
            Array.isArray(documentItem?.ocrPages)
              ? documentItem.ocrPages.slice(0, 500)
              : [],
          unreadablePages:
            Array.isArray(documentItem?.unreadablePages)
              ? documentItem.unreadablePages.slice(0, 500)
              : [],
          worksCount:
            documentWorks.length,
          materialsCount:
            documentMaterials.length,
          requiresReview:
            documentItem?.requiresReview === true,
          analysisFingerprint:
            projectAnalysisHash(fingerprintSource)
        };
      });
  const workVolumeRows =
    getProjectAnalysisRowsForRole(works, baseDocuments, 'work-volume');
  const scheduleRows =
    getProjectAnalysisRowsForRole(works, baseDocuments, 'schedule');
  const combined =
    buildProjectAnalysisCombinedRows(workVolumeRows, scheduleRows);
  const reviewItems =
    (Array.isArray(result.reviewItems) ? result.reviewItems : [])
      .map(sanitizeProjectAnalysisReviewItem);

  return {
    version:
      BUILDMIND_PROJECT_ANALYSIS_VERSION,
    analysisVersion:
      result.version || '',
    createdAt:
      result.createdAt || savedAt,
    savedAt,
    qualityStatus:
      result.qualityStatus || 'review',
    partial:
      result.partial === true,
    documents:
      baseDocuments,
    workVolumeRows,
    scheduleRows,
    combinedRows:
      combined.rows,
    materials,
    reviewItems,
    agentReports:
      (Array.isArray(result.agentReports) ? result.agentReports : [])
        .map(sanitizeProjectAnalysisAgentReport),
    approvalsCount:
      Array.isArray(result.approvals)
        ? result.approvals.length
        : 0,
    summary: {
      documentsCount:
        baseDocuments.length,
      workVolumeRowsCount:
        Number(result.workVolumeRowsCount) ||
        workVolumeRows.length,
      workVolumeRowsRawCount:
        Number(result.rawWorkVolumeRowsCount) ||
        workVolumeRows.length,
      scheduleRowsCount:
        Number(result.scheduleRowsCount) ||
        scheduleRows.length,
      scheduleRowsRawCount:
        Number(result.rawScheduleRowsCount) ||
        scheduleRows.length,
      materialsCount:
        materials.length,
      reviewCount:
        reviewItems.length,
      unreadablePagesCount:
        Number(result.unreadablePagesCount) || 0,
      matchedScheduleRowsCount:
        combined.matchedScheduleRowsCount,
      matchedWorkVolumeRowsCount:
        combined.matchedWorkVolumeRowsCount,
      scheduleOnlyRowsCount:
        combined.scheduleOnlyRowsCount,
      workVolumeOnlyRowsCount:
        combined.workVolumeOnlyRowsCount
    }
  };
}


function loadProjectAnalysisSnapshot() {
  try {
    const saved =
      localStorage.getItem(PROJECT_ANALYSIS_STORAGE_KEY);

    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved);

    return parsed &&
      parsed.version === BUILDMIND_PROJECT_ANALYSIS_VERSION
        ? parsed
        : null;
  } catch (error) {
    console.warn(
      'BuildMind Project Analysis: снимок не прочитан:',
      error
    );
    return null;
  }
}


function notifyProjectAnalysisChanged(snapshot) {
  window.dispatchEvent(
    new CustomEvent(
      'buildmind:project-analysis-snapshot-changed',
      {
        detail: cloneProjectAnalysis(snapshot)
      }
    )
  );
}


function persistProjectAnalysisResult(result) {
  const snapshot = buildProjectAnalysisSnapshot(result);

  if (!snapshot) {
    return null;
  }

  projectAnalysisSnapshot = snapshot;

  try {
    localStorage.setItem(
      PROJECT_ANALYSIS_STORAGE_KEY,
      JSON.stringify(snapshot)
    );
  } catch (error) {
    console.warn(
      'BuildMind Project Analysis: снимок не сохранён:',
      error
    );
  }

  if (
    window.BuildMindDocumentRegistry &&
    typeof window.BuildMindDocumentRegistry.importAnalysisSnapshot ===
      'function'
  ) {
    window.BuildMindDocumentRegistry.importAnalysisSnapshot(snapshot);
  }

  notifyProjectAnalysisChanged(snapshot);

  return cloneProjectAnalysis(snapshot);
}


function clearProjectAnalysisSnapshot() {
  projectAnalysisSnapshot = null;
  localStorage.removeItem(PROJECT_ANALYSIS_STORAGE_KEY);
  notifyProjectAnalysisChanged(null);
}


projectAnalysisSnapshot = loadProjectAnalysisSnapshot();


window.BuildMindProjectAnalysis = {
  version:
    BUILDMIND_PROJECT_ANALYSIS_VERSION,
  storageKey:
    PROJECT_ANALYSIS_STORAGE_KEY,
  buildSnapshot:
    buildProjectAnalysisSnapshot,
  combineWorksAndSchedule:
    buildProjectAnalysisCombinedRows,
  scoreWorkMatch:
    scoreProjectAnalysisWorkMatch,
  persistResult:
    persistProjectAnalysisResult,
  getSnapshot:
    function () {
      return cloneProjectAnalysis(projectAnalysisSnapshot);
    },
  clear:
    clearProjectAnalysisSnapshot
};


window.addEventListener(
  'buildmind:project-intake-completed',
  function (event) {
    persistProjectAnalysisResult(
      event?.detail?.result ||
      event?.detail
    );
  }
);


if (
  projectAnalysisSnapshot &&
  window.BuildMindDocumentRegistry &&
  typeof window.BuildMindDocumentRegistry.importAnalysisSnapshot ===
    'function'
) {
  window.BuildMindDocumentRegistry.importAnalysisSnapshot(
    projectAnalysisSnapshot
  );
}


if (
  window.BuildMindProjectIntake &&
  typeof window.BuildMindProjectIntake.getLastResult === 'function'
) {
  const currentResult =
    window.BuildMindProjectIntake.getLastResult();

  if (currentResult?.success === true) {
    persistProjectAnalysisResult(currentResult);
  }
}


console.info(
  'BuildMind Project Analysis Bridge загружен:',
  BUILDMIND_PROJECT_ANALYSIS_VERSION
);
