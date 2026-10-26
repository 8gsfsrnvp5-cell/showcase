'use strict';

/* ==================================================
   BUILDMIND DOCUMENT REGISTRY — V1
   Реестр логических документов и неизменяемых редакций.

   В localStorage хранятся метаданные,
   а не содержимое самих файлов.
   ================================================== */

const BUILDMIND_DOCUMENT_REGISTRY_VERSION =
  'document-registry-v1';

const DOCUMENT_REGISTRY_STORAGE_KEY =
  'buildmind-document-registry-v1';


const DOCUMENT_REGISTRY_KIND_LABELS = {
  'project-documentation':
    'Проектная / рабочая документация',

  'work-volume':
    'Ведомость объёмов работ',

  schedule:
    'График производства работ',

  specification:
    'Спецификация',

  agreement:
    'Дополнительное соглашение',

  estimate:
    'Сметная документация',

   'commercial-proposal':
  'Коммерческое предложение',

  journal:
    'Журнал / ведомость',

  other:
    'Другой документ'
};


const DOCUMENT_REGISTRY_STATUS_LABELS = {
  received:
    'Получен',

  'under-review':
    'На проверке',

  current:
    'Действующий',

  superseded:
    'Заменён',

  cancelled:
    'Аннулирован'
};


const DOCUMENT_REGISTRY_RELATION_LABELS = {
  initial:
    'Исходная редакция',

  replaces:
    'Заменяет предыдущую редакцию',

  amends:
    'Изменяет / корректирует',

  cancels:
    'Отменяет'
};


function documentRegistryId(
  prefix
) {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return (
      `${prefix}-` +
      window.crypto.randomUUID()
    );
  }

  return (
    `${prefix}-` +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


function emptyDocumentRegistryState() {
  return {
    version:
      BUILDMIND_DOCUMENT_REGISTRY_VERSION,

    documents:
      [],

    createdAt:
      '',

    updatedAt:
      ''
  };
}


function loadDocumentRegistryState() {
  try {
    const saved =
      localStorage.getItem(
        DOCUMENT_REGISTRY_STORAGE_KEY
      );

    if (!saved) {
      return emptyDocumentRegistryState();
    }

    const parsed =
      JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return emptyDocumentRegistryState();
    }

    return {
      ...emptyDocumentRegistryState(),

      ...parsed,

      version:
        BUILDMIND_DOCUMENT_REGISTRY_VERSION,

      documents:
        Array.isArray(
          parsed.documents
        )
          ? parsed.documents
          : []
    };
  } catch (error) {
    console.warn(
      'Document Registry: не удалось прочитать состояние:',
      error
    );

    return emptyDocumentRegistryState();
  }
}


let documentRegistryState =
  loadDocumentRegistryState();


function cloneDocumentRegistry(
  value
) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function saveDocumentRegistryState() {
  const now =
    new Date().toISOString();

  if (
    !documentRegistryState
      .createdAt
  ) {
    documentRegistryState
      .createdAt =
      now;
  }

  documentRegistryState
    .updatedAt =
    now;

  localStorage.setItem(
    DOCUMENT_REGISTRY_STORAGE_KEY,
    JSON.stringify(
      documentRegistryState
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:document-registry-changed',
      {
        detail:
          cloneDocumentRegistry(
            documentRegistryState
          )
      }
    )
  );
}


function escapeDocumentRegistryHtml(
  value
) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[symbol];
    }
  );
}


function setDocumentRegistryMessage(
  text
) {
  const element =
    document.getElementById(
      'documentRegistryMessage'
    );

  if (element) {
    element.textContent =
      text || '';
  }
}


function getUploadedRegistryDocuments() {
  return (
    typeof uploadedProjectDocuments !==
      'undefined' &&
    Array.isArray(
      uploadedProjectDocuments
    )
  )
    ? uploadedProjectDocuments
    : [];
}


function getRegistryProjectNodes() {
  return (
    window.BuildMindProjectCore &&
    typeof window
      .BuildMindProjectCore
      .getNodes ===
      'function'
  )
    ? window
        .BuildMindProjectCore
        .getNodes()
    : [];
}


function getActiveRegistryProjectNodeId() {
  if (
    !window.BuildMindProjectCore ||
    typeof window
      .BuildMindProjectCore
      .getActiveNode !==
      'function'
  ) {
    return '';
  }

  const node =
    window
      .BuildMindProjectCore
      .getActiveNode();

  return node
    ? node.id
    : '';
}


function normalizeDocumentRegistryAnalysisKey(
  documentItem
) {
  return [
    String(documentItem?.fileName || '')
      .trim()
      .toLowerCase(),
    documentItem?.documentRole ||
      documentItem?.kind ||
      'other'
  ].join('|');
}


function getDocumentRegistryAnalysisKind(
  documentItem
) {
  const role =
    documentItem?.documentRole || '';

  if (
    Object.prototype.hasOwnProperty.call(
      DOCUMENT_REGISTRY_KIND_LABELS,
      role
    )
  ) {
    return role;
  }

  const kind =
    documentItem?.kind || 'other';

  return Object.prototype.hasOwnProperty.call(
    DOCUMENT_REGISTRY_KIND_LABELS,
    kind
  )
    ? kind
    : 'other';
}


function getDocumentRegistryAnalysisTitle(
  fileName
) {
  return String(fileName || 'Документ анализа')
    .replace(/\.[^.]+$/u, '')
    .trim() || 'Документ анализа';
}


function importDocumentRegistryAnalysisSnapshot(
  snapshot
) {
  if (
    !snapshot ||
    !Array.isArray(snapshot.documents)
  ) {
    return {
      imported: 0,
      updated: 0
    };
  }

  const now =
    snapshot.savedAt ||
    new Date().toISOString();
  const activeProjectNodeId =
    getActiveRegistryProjectNodeId();
  let imported = 0;
  let updated = 0;
  let changed = false;

  snapshot.documents.forEach(function (
    analysisDocument
  ) {
    const sourceAnalysisKey =
      normalizeDocumentRegistryAnalysisKey(
        analysisDocument
      );
    const kind =
      getDocumentRegistryAnalysisKind(
        analysisDocument
      );
    const fingerprint =
      analysisDocument.analysisFingerprint ||
      [
        sourceAnalysisKey,
        analysisDocument.worksCount || 0,
        analysisDocument.materialsCount || 0,
        analysisDocument.totalPages || 0,
        (analysisDocument.unreadablePages || []).join(',')
      ].join('|');
    let registryDocument =
      documentRegistryState.documents.find(
        function (item) {
          return item.sourceAnalysisKey === sourceAnalysisKey;
        }
      );

    if (!registryDocument) {
      registryDocument = {
        documentId:
          documentRegistryId('document'),
        logicalTitle:
          getDocumentRegistryAnalysisTitle(
            analysisDocument.fileName
          ),
        kind,
        sourceAnalysisKey,
        relatedDocumentIds: [],
        status: 'active',
        createdAt: now,
        updatedAt: now,
        revisions: []
      };

      documentRegistryState.documents.push(
        registryDocument
      );
      imported += 1;
      changed = true;
    }

    const existingRevision =
      (registryDocument.revisions || []).find(
        function (revision) {
          return (
            revision.sourceType ===
              'project-intake-analysis' &&
            revision.analysisFingerprint ===
              fingerprint
          );
        }
      );
    const analysisSummary = {
      documentRole:
        analysisDocument.documentRole || 'auto',
      confidence:
        analysisDocument.confidence || 'low',
      totalPages:
        Number(analysisDocument.totalPages) || 0,
      ocrPagesCount:
        Array.isArray(analysisDocument.ocrPages)
          ? analysisDocument.ocrPages.length
          : 0,
      unreadablePagesCount:
        Array.isArray(analysisDocument.unreadablePages)
          ? analysisDocument.unreadablePages.length
          : 0,
      worksCount:
        Number(analysisDocument.worksCount) || 0,
      materialsCount:
        Number(analysisDocument.materialsCount) || 0,
      qualityStatus:
        snapshot.qualityStatus || 'review'
    };

    if (existingRevision) {
      if (
        existingRevision.lastAnalyzedAt !== now ||
        JSON.stringify(existingRevision.analysisSummary) !==
          JSON.stringify(analysisSummary)
      ) {
        existingRevision.lastAnalyzedAt = now;
        existingRevision.analysisSummary = analysisSummary;
        registryDocument.updatedAt = now;
        updated += 1;
        changed = true;
      }

      return;
    }

    const previousRevision =
      [...(registryDocument.revisions || [])]
        .sort(function (first, second) {
          return (
            new Date(second.receivedAt || 0) -
            new Date(first.receivedAt || 0)
          );
        })[0] || null;

    if (
      previousRevision &&
      previousRevision.sourceType ===
        'project-intake-analysis' &&
      previousRevision.status !== 'cancelled'
    ) {
      previousRevision.status = 'superseded';
      previousRevision.supersededAt = now;
    }

    const revisionNumber =
      (registryDocument.revisions || []).length + 1;

    registryDocument.revisions.push({
      revisionId:
        documentRegistryId('revision'),
      documentId:
        registryDocument.documentId,
      changeSetId:
        null,
      revisionLabel:
        'Анализ ' + revisionNumber,
      relationType:
        previousRevision
          ? 'replaces'
          : 'initial',
      previousRevisionId:
        previousRevision?.revisionId || null,
      projectNodeIds:
        activeProjectNodeId
          ? [activeProjectNodeId]
          : [],
      fileName:
        analysisDocument.fileName ||
        registryDocument.logicalTitle,
      fileSize:
        Number(analysisDocument.fileSize) || 0,
      fileLastModified:
        Number(analysisDocument.fileLastModified) || 0,
      sha256:
        '',
      receivedAt:
        now,
      status:
        'under-review',
      notes:
        'Создано автоматически после анализа комплекта. ' +
        'Требуется подтверждение инженером.',
      sourceType:
        'project-intake-analysis',
      sourceAnalysisKey,
      analysisFingerprint:
        fingerprint,
      analysisSummary,
      lastAnalyzedAt:
        now,
      requiresEngineerConfirmation:
        true
    });

    registryDocument.kind = kind;
    registryDocument.updatedAt = now;
    updated += 1;
    changed = true;
  });

  if (changed) {
    saveDocumentRegistryState();
    renderDocumentRegistry();
    refreshRegistryExistingDocuments();
  }

  return {
    imported,
    updated,
    documentsCount:
      documentRegistryState.documents.length
  };
}


function getRegistryUploadId(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return '';
  }

  return (
    documentItem.id ||
    [
      documentItem.file.name,
      documentItem.file.size,
      documentItem.file.lastModified
    ].join('-')
  );
}


function guessDocumentRegistryKind(
  documentItem
) {
  const classificationId =
    documentItem
      ?.analysis
      ?.documentClassification
      ?.id ||
    '';

  const map = {
    'working-documents':
      'project-documentation',

    'work-volume':
      'work-volume',

    schedule:
      'schedule',

    specification:
      'specification',

    estimate:
      'estimate',

'commercial-proposal':
  'commercial-proposal',

agreement:
  'agreement',
     
    'cable-journal':
      'journal'
  };

  if (
    map[
      classificationId
    ]
  ) {
    return map[
      classificationId
    ];
  }


  const name =
    String(
      documentItem
        ?.file
        ?.name ||
      ''
    ).toLowerCase();


  if (
    name.includes('вор') ||
    name.includes(
      'ведомост'
    )
  ) {
    return 'work-volume';
  }


  if (
    name.includes('гпр') ||
    name.includes(
      'график'
    )
  ) {
    return 'schedule';
  }


  if (
    name.includes('доп') &&
    name.includes(
      'соглаш'
    )
  ) {
    return 'agreement';
  }

   if (
  name.includes(
    'коммерч'
  ) ||
  name.includes(
    'ткп'
  ) ||
  /(^|[^а-яa-z0-9])кп([^а-яa-z0-9]|$)/i.test(
    name
  )
) {
  return 'commercial-proposal';
}

if (
  name.includes(
    'смет'
  )
) {
  return 'estimate';
}

  if (
    name.endsWith(
      '.pdf'
    )
  ) {
    return 'project-documentation';
  }


  return 'other';
}


async function calculateRegistrySha256(
  file
) {
  if (!file) {
    return '';
  }


  /*
    Если SHA-256 по какой-либо причине
    недоступен, сохраняем стабильный
    технический fingerprint метаданных.
  */

  if (
    !window.crypto ||
    !window.crypto.subtle ||
    typeof window
      .crypto
      .subtle
      .digest !==
      'function'
  ) {
    return [
      'meta',
      file.name || '',
      Number(
        file.size
      ) || 0,
      Number(
        file.lastModified
      ) || 0
    ].join('|');
  }


  const buffer =
    await file.arrayBuffer();

  const digest =
    await window.crypto
      .subtle
      .digest(
        'SHA-256',
        buffer
      );


  return Array.from(
    new Uint8Array(
      digest
    )
  )
    .map(
      function (byte) {
        return byte
          .toString(16)
          .padStart(
            2,
            '0'
          );
      }
    )
    .join('');
}


function getAllRegistryRevisions() {
  return documentRegistryState
    .documents
    .flatMap(
      function (
        documentItem
      ) {
        return (
          documentItem.revisions ||
          []
        ).map(
          function (
            revision
          ) {
            return {
              documentId:
                documentItem
                  .documentId,

              logicalTitle:
                documentItem
                  .logicalTitle,

              kind:
                documentItem.kind,

              revision
            };
          }
        );
      }
    );
}


function findRegistryRevisionBySha256(
  sha256
) {
  if (!sha256) {
    return null;
  }

  return (
    getAllRegistryRevisions()
      .find(
        function (item) {
          return (
            item
              .revision
              .sha256 ===
            sha256
          );
        }
      ) ||
    null
  );
}


function getRegistryDocumentById(
  documentId
) {
  return (
    documentRegistryState
      .documents
      .find(
        function (item) {
          return (
            item.documentId ===
            documentId
          );
        }
      ) ||
    null
  );
}


function getSelectedRegistryProjectIds() {
  return Array.from(
    document.querySelectorAll(
      '[data-document-registry-project-node]:checked'
    )
  ).map(
    function (input) {
      return input.value;
    }
  );
}


function refreshRegistryProjectNodes() {
  const container =
    document.getElementById(
      'documentRegistryProjectNodes'
    );

  if (!container) {
    return;
  }


  const nodes =
    getRegistryProjectNodes();

  const activeNodeId =
    getActiveRegistryProjectNodeId();


  if (
    nodes.length === 0
  ) {
    container.innerHTML =
      '<div class="document-registry-empty">' +
      'Сначала сохраните главный проект в Project Core.' +
      '</div>';

    return;
  }


  container.innerHTML =
    nodes
      .map(
        function (node) {
          return `
            <label
              class="document-registry-project-choice"
            >
              <input
                type="checkbox"
                value="${escapeDocumentRegistryHtml(
                  node.id
                )}"
                data-document-registry-project-node
                ${
                  node.id ===
                    activeNodeId
                    ? 'checked'
                    : ''
                }
              />

              <span>
                <strong>
                  ${escapeDocumentRegistryHtml(
                    node.name
                  )}
                </strong>

                <small>
                  ${escapeDocumentRegistryHtml(
                    node.code ||
                    node.object ||
                    'Без шифра'
                  )}

                  ${
                    node.status ===
                      'closed'
                      ? ' · закрыт'
                      : ''
                  }
                </small>
              </span>
            </label>
          `;
        }
      )
      .join('');
}


function refreshRegistryUploadOptions() {
  const select =
    document.getElementById(
      'documentRegistryUploadSelect'
    );

  if (!select) {
    return;
  }


  const previousValue =
    select.value ||
    '';

  const documents =
    getUploadedRegistryDocuments();


  select.innerHTML = '';


  const emptyOption =
    document.createElement(
      'option'
    );

  emptyOption.value =
    '';

  emptyOption.textContent =
    documents.length
      ? 'Выберите загруженный файл'
      : 'Сначала загрузите файл выше';

  select.appendChild(
    emptyOption
  );


  documents.forEach(
    function (
      documentItem
    ) {
      const option =
        document.createElement(
          'option'
        );

      option.value =
        getRegistryUploadId(
          documentItem
        );

      option.textContent =
        documentItem.file.name;

      select.appendChild(
        option
      );
    }
  );


  if (
    documents.some(
      function (item) {
        return (
          getRegistryUploadId(
            item
          ) ===
          previousValue
        );
      }
    )
  ) {
    select.value =
      previousValue;
  }


  syncRegistryFormFromUpload();
}


function refreshRegistryExistingDocuments() {
  const select =
    document.getElementById(
      'documentRegistryExistingDocument'
    );

  if (!select) {
    return;
  }


  const previousValue =
    select.value ||
    '';


  select.innerHTML =
    '<option value="">' +
    'Выберите зарегистрированный документ' +
    '</option>';


  documentRegistryState
    .documents
    .forEach(
      function (
        documentItem
      ) {
        const option =
          document.createElement(
            'option'
          );

        option.value =
          documentItem.documentId;

        option.textContent =
          `${documentItem.logicalTitle} · ` +
          `${
            DOCUMENT_REGISTRY_KIND_LABELS[
              documentItem.kind
            ] ||
            documentItem.kind
          }`;

        select.appendChild(
          option
        );
      }
    );


  if (
    getRegistryDocumentById(
      previousValue
    )
  ) {
    select.value =
      previousValue;
  }
}


function getSelectedUploadedRegistryDocument() {
  const selectedId =
    document.getElementById(
      'documentRegistryUploadSelect'
    )?.value ||
    '';

  return (
    getUploadedRegistryDocuments()
      .find(
        function (
          documentItem
        ) {
          return (
            getRegistryUploadId(
              documentItem
            ) ===
            selectedId
          );
        }
      ) ||
    null
  );
}


function syncRegistryFormFromUpload() {
  const documentItem =
    getSelectedUploadedRegistryDocument();

  const mode =
    document.getElementById(
      'documentRegistryMode'
    )?.value ||
    'new';


  if (
    !documentItem ||
    mode ===
      'revision'
  ) {
    return;
  }


  const titleInput =
    document.getElementById(
      'documentRegistryLogicalTitle'
    );

  const kindSelect =
    document.getElementById(
      'documentRegistryKind'
    );


  if (
    titleInput &&
    !titleInput.value.trim()
  ) {
    titleInput.value =
      documentItem
        .file
        .name
        .replace(
          /\.[^.]+$/,
          ''
        );
  }


  if (kindSelect) {
    kindSelect.value =
      guessDocumentRegistryKind(
        documentItem
      );
  }
}


function syncRegistryFormFromExisting() {
  const mode =
    document.getElementById(
      'documentRegistryMode'
    )?.value ||
    'new';

  if (
    mode !==
    'revision'
  ) {
    return;
  }


  const documentId =
    document.getElementById(
      'documentRegistryExistingDocument'
    )?.value ||
    '';

  const documentItem =
    getRegistryDocumentById(
      documentId
    );

  if (!documentItem) {
    return;
  }


  const titleInput =
    document.getElementById(
      'documentRegistryLogicalTitle'
    );

  const kindSelect =
    document.getElementById(
      'documentRegistryKind'
    );


  if (titleInput) {
    titleInput.value =
      documentItem
        .logicalTitle ||
      '';
  }


  if (kindSelect) {
    kindSelect.value =
      documentItem.kind ||
      'other';
  }


  refreshRegistryProjectNodes();


  /*
    Проекты наследуем не из документа вообще,
    а из действующей или последней редакции.
    Таким образом история редакций не переписывается.
  */

  const sourceRevision =
    (
      documentItem.revisions ||
      []
    ).find(
      function (revision) {
        return (
          revision.status ===
          'current'
        );
      }
    ) ||
    [
      ...(
        documentItem.revisions ||
        []
      )
    ].sort(
      function (
        first,
        second
      ) {
        return (
          new Date(
            second.receivedAt
          ) -
          new Date(
            first.receivedAt
          )
        );
      }
    )[0] ||
    null;


  const ids =
    sourceRevision &&
    Array.isArray(
      sourceRevision
        .projectNodeIds
    )
      ? sourceRevision
          .projectNodeIds
      : [];


    document.querySelectorAll(
    '[data-document-registry-project-node]'
  ).forEach(
    function (input) {
      input.checked =
        ids.includes(
          input.value
        );
    }
  );


  setDocumentRegistryMessage(
    'Новая редакция будет добавлена в документ «' +
    documentItem.logicalTitle +
    '».ID документ останется прежним.'
  );
}


function syncRegistryFormMode() {
  const mode =
    document.getElementById(
      'documentRegistryMode'
    )?.value ||
    'new';

  const existingWrap =
    document.getElementById(
      'documentRegistryExistingWrap'
    );

  const existingSelect =
    document.getElementById(
      'documentRegistryExistingDocument'
    );

  const titleInput =
    document.getElementById(
      'documentRegistryLogicalTitle'
    );

  const kindSelect =
    document.getElementById(
      'documentRegistryKind'
    );

  const relationSelect =
    document.getElementById(
      'documentRegistryRelationType'
    );


  if (existingWrap) {
    existingWrap.classList.toggle(
      'hidden',
      mode !==
        'revision'
    );
  }


  if (titleInput) {
    titleInput.readOnly =
      mode ===
      'revision';
  }


  if (kindSelect) {
    kindSelect.disabled =
      mode ===
      'revision';
  }


  if (relationSelect) {
    relationSelect.disabled =
      mode !==
      'revision';
  }


  if (
    mode ===
    'revision'
  ) {
    refreshRegistryExistingDocuments();


    /*
      Если в реестре пока только
      один логический документ,
      человеку незачем выбирать его
      второй раз вручную.
    */

    if (
      existingSelect &&
      !existingSelect.value &&
      documentRegistryState
        .documents
        .length ===
        1
    ) {
      existingSelect.value =
        documentRegistryState
          .documents[0]
          .documentId;
    }


    syncRegistryFormFromExisting();


    const selectedDocument =
      getRegistryDocumentById(
        existingSelect?.value ||
        ''
      );


    if (selectedDocument) {
      setDocumentRegistryMessage(
        'Режим новой редакции: файл будет добавлен ' +
        'в документ «' +
        selectedDocument.logicalTitle +
        '». Новый Document ID создан не будет.'
      );
    } else {
      setDocumentRegistryMessage(
        'Режим новой редакции: выберите существующий документ. ' +
        'Новый Document ID создан не будет.'
      );
    }
  } else {
    syncRegistryFormFromUpload();


    setDocumentRegistryMessage(
      'Режим нового документа: будет создан новый ' +
      'логический документ с новым Document ID.'
    );
  }
}


function isLikelyFollowupRevisionLabel(
  value
) {
  const normalized =
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        ''
      );


  if (!normalized) {
    return false;
  }


  const revMatch =
    normalized.match(
      /^rev\.?([a-z]|\d+)$/
    );


  if (revMatch) {
    const marker =
      revMatch[1];


    if (
      /^[a-z]$/.test(
        marker
      )
    ) {
      return marker !==
        'a';
    }


    return Number(
      marker
    ) > 1;
  }


  const rMatch =
    normalized.match(
      /^r(\d+)$/
    );


  if (rMatch) {
    return Number(
      rMatch[1]
    ) > 1;
  }


  return /^изм\.?\d+$/.test(
    normalized
  );
}

function defaultRevisionLabel(
  documentItem
) {
  return (
    'R' +
    (
      (
        documentItem
          ?.revisions ||
        []
      ).length +
      1
    )
  );
}


async function registerDocumentRevision() {
  const mode =
    document.getElementById(
      'documentRegistryMode'
    )?.value ||
    'new';

  const uploadedDocument =
    getSelectedUploadedRegistryDocument();


  if (!uploadedDocument) {
    setDocumentRegistryMessage(
      'Выберите один из загруженных файлов.'
    );

    return;
  }


  const projectNodeIds =
    getSelectedRegistryProjectIds();

  if (
    projectNodeIds.length ===
    0
  ) {
    setDocumentRegistryMessage(
      'Укажите хотя бы один проект / пакет, ' +
      'к которому относится документ.'
    );

    return;
  }


  const logicalTitle =
    (
      document.getElementById(
        'documentRegistryLogicalTitle'
      )?.value ||
      ''
    ).trim();

  const kind =
    document.getElementById(
      'documentRegistryKind'
    )?.value ||
    'other';

  const relationType =
    document.getElementById(
      'documentRegistryRelationType'
    )?.value ||
    'replaces';

  const revisionLabelInput =
    (
      document.getElementById(
        'documentRegistryRevisionLabel'
      )?.value ||
      ''
    ).trim();

  const notes =
    (
      document.getElementById(
        'documentRegistryNotes'
      )?.value ||
      ''
    ).trim();

     if (
    mode ===
      'new' &&
    documentRegistryState
      .documents
      .length > 0 &&
    isLikelyFollowupRevisionLabel(
      revisionLabelInput
    )
  ) {
    const confirmedNewDocument =
      confirm(
        'Сейчас выбран режим «Новый логический документ».\n\n' +
        'Будет создан НОВЫЙ Document ID, хотя метка редакции выглядит ' +
        'как продолжение существующего документа: «' +
        revisionLabelInput +
        '».\n\n' +
        'Если это новая редакция существующего документа, ' +
        'нажмите «Отмена» и выберите режим «Новая редакция существующего».'
      );


    if (!confirmedNewDocument) {
      setDocumentRegistryMessage(
        'Регистрация отменена. Выберите режим ' +
        '«Новая редакция существующего» и укажите документ, ' +
        'который эта редакция продолжает.'
      );


      return;
    }
  }

  let registryDocument =
    null;


  if (
    mode ===
    'revision'
  ) {
    const existingId =
      document.getElementById(
        'documentRegistryExistingDocument'
      )?.value ||
      '';

    registryDocument =
      getRegistryDocumentById(
        existingId
      );

    if (!registryDocument) {
      setDocumentRegistryMessage(
        'Для новой редакции выберите существующий документ.'
      );

      return;
    }
  } else if (!logicalTitle) {
    setDocumentRegistryMessage(
      'Укажите логическое название документа.'
    );

    return;
  }


  const button =
    document.getElementById(
      'registerDocumentRevisionBtn'
    );

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'Регистрация...';
  }


  try {
    const sha256 =
      await calculateRegistrySha256(
        uploadedDocument.file
      );


    const duplicate =
      findRegistryRevisionBySha256(
        sha256
      );


    if (duplicate) {
      setDocumentRegistryMessage(
        'Этот файл уже зарегистрирован ' +
        'как редакция документа «' +
        duplicate.logicalTitle +
        '».'
      );

      return;
    }


    const now =
      new Date().toISOString();


    if (!registryDocument) {
      registryDocument = {
        documentId:
          documentRegistryId(
            'document'
          ),

        logicalTitle,

        kind,

        /*
          Здесь позже ChangeSet сможет
          связать дополнительный ВОР,
          ДС и другие документы между собой.
        */

        relatedDocumentIds:
          [],

        status:
          'active',

        createdAt:
          now,

        updatedAt:
          now,

        revisions:
          []
      };

      documentRegistryState
        .documents
        .push(
          registryDocument
        );
    } else {
      registryDocument.updatedAt =
        now;
    }


    const previousCurrent =
      (
        registryDocument
          .revisions ||
        []
      ).find(
        function (revision) {
          return (
            revision.status ===
            'current'
          );
        }
      ) ||
      null;


    const revision = {
      revisionId:
        documentRegistryId(
          'revision'
        ),

      documentId:
        registryDocument
          .documentId,

      /*
        ChangeSet V1 будет записывать
        сюда ID пакета изменений.
      */

      changeSetId:
        null,

      revisionLabel:
        revisionLabelInput ||
        defaultRevisionLabel(
          registryDocument
        ),

      relationType:
        mode ===
          'new'
          ? 'initial'
          : relationType,

      previousRevisionId:
        previousCurrent
          ? previousCurrent
              .revisionId
          : null,

      /*
        ВАЖНО:
        связь с проектами хранится
        на уровне конкретной редакции.
      */

      projectNodeIds:
        [...projectNodeIds],

      fileName:
        uploadedDocument
          .file
          .name,

      fileSize:
        Number(
          uploadedDocument
            .file
            .size
        ) ||
        0,

      fileLastModified:
        Number(
          uploadedDocument
            .file
            .lastModified
        ) ||
        0,

      sha256,

      receivedAt:
        now,

      status:
        'received',

      notes,

      sourceType:
        'uploaded-file',

      requiresEngineerConfirmation:
        true
    };


    if (
      window.BuildMindChangeSet &&
      typeof window
        .BuildMindChangeSet
        .captureRevision === 'function'
    ) {
      const changeSetResult =
        await window
          .BuildMindChangeSet
          .captureRevision({
            uploadedDocument,
            registryDocument,
            revision,
            previousRevision:
              previousCurrent
          });

      if (
        changeSetResult
          ?.changeSetId
      ) {
        revision.changeSetId =
          changeSetResult
            .changeSetId;
      }
    }


    registryDocument
      .revisions
      .push(
        revision
      );


    /*
      Привязываем текущий File-объект
      к записи реестра на время
      этой браузерной сессии.
    */

    uploadedDocument
      .registryDocumentId =
      registryDocument
        .documentId;

    uploadedDocument
      .registryRevisionId =
      revision.revisionId;


    saveDocumentRegistryState();

    renderDocumentRegistry();

    refreshRegistryExistingDocuments();


    setDocumentRegistryMessage(
      'Редакция зарегистрирована ' +
      'со статусом «Получен». ' +
      (
        revision.changeSetId
          ? 'Пакет изменений сформирован и ожидает проверки инженера. '
          : 'Снимок сохранён как базовая точка для следующего сравнения. '
      ) +
      'Прошлые редакции не изменены.'
    );


    const revisionInput =
      document.getElementById(
        'documentRegistryRevisionLabel'
      );

    const notesInput =
      document.getElementById(
        'documentRegistryNotes'
      );


    if (revisionInput) {
      revisionInput.value =
        '';
    }

    if (notesInput) {
      notesInput.value =
        '';
    }
  } catch (error) {
    console.error(
      'Document Registry: ошибка регистрации:',
      error
    );

    setDocumentRegistryMessage(
      'Не удалось зарегистрировать файл. ' +
      'Проверьте Console.'
    );
  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        'Зарегистрировать редакцию';
    }
  }
}


function setRegistryRevisionStatus(
  documentId,
  revisionId,
  nextStatus
) {
  const documentItem =
    getRegistryDocumentById(
      documentId
    );

  if (!documentItem) {
    return;
  }


  const revision =
    (
      documentItem.revisions ||
      []
    ).find(
      function (item) {
        return (
          item.revisionId ===
          revisionId
        );
      }
    );


  if (!revision) {
    return;
  }


  /*
    Действующей может быть
    только одна редакция
    одного логического документа.

    Прошлая CURRENT становится
    SUPERSEDED, но остаётся
    в истории.
  */

  if (
    nextStatus ===
    'current'
  ) {
    documentItem
      .revisions
      .forEach(
        function (item) {
          if (
            item.revisionId !==
              revisionId &&
            item.status ===
              'current'
          ) {
            item.status =
              'superseded';

            item.supersededAt =
              new Date()
                .toISOString();
          }
        }
      );

    revision.approvedAt =
      new Date()
        .toISOString();
  }


  revision.status =
    nextStatus;

  revision.statusUpdatedAt =
    new Date()
      .toISOString();

  documentItem.updatedAt =
    new Date()
      .toISOString();


  saveDocumentRegistryState();
  renderDocumentRegistry();
}


function renderDocumentRegistry() {
  const list =
    document.getElementById(
      'documentRegistryList'
    );

  const allRevisions =
    getAllRegistryRevisions();


  const counters = {
    documentRegistryDocumentsCount:
      documentRegistryState
        .documents
        .length,

    documentRegistryRevisionsCount:
      allRevisions.length,

    documentRegistryCurrentCount:
      allRevisions.filter(
        function (item) {
          return (
            item
              .revision
              .status ===
            'current'
          );
        }
      ).length,

    documentRegistryReviewCount:
      allRevisions.filter(
        function (item) {
          return [
            'received',
            'under-review'
          ].includes(
            item
              .revision
              .status
          );
        }
      ).length
  };


  Object.entries(
    counters
  ).forEach(
    function (
      [id, value]
    ) {
      const element =
        document.getElementById(
          id
        );

      if (element) {
        element.textContent =
          String(value);
      }
    }
  );


  if (!list) {
    return;
  }


  if (
    documentRegistryState
      .documents
      .length ===
    0
  ) {
    list.innerHTML =
      '<div class="document-registry-empty">' +
      'Реестр пуст. Загрузите файл выше ' +
      'и зарегистрируйте первую редакцию.' +
      '</div>';

    return;
  }


  const projectMap =
    new Map(
      getRegistryProjectNodes()
        .map(
          function (node) {
            return [
              node.id,
              node
            ];
          }
        )
    );


  list.innerHTML =
    documentRegistryState
      .documents
      .map(
        function (
          documentItem
        ) {
          const revisions =
            [
              ...(
                documentItem
                  .revisions ||
                []
              )
            ].sort(
              function (
                first,
                second
              ) {
                return (
                  new Date(
                    second.receivedAt
                  ) -
                  new Date(
                    first.receivedAt
                  )
                );
              }
            );


          const effectiveRevision =
            revisions.find(
              function (revision) {
                return (
                  revision.status ===
                  'current'
                );
              }
            ) ||
            revisions[0] ||
            null;


          const projectLabels =
            effectiveRevision &&
            Array.isArray(
              effectiveRevision
                .projectNodeIds
            )
              ? effectiveRevision
                  .projectNodeIds
                  .map(
                    function (nodeId) {
                      return (
                        projectMap.get(
                          nodeId
                        )?.name ||
                        nodeId
                      );
                    }
                  )
                  .join(', ')
              : '';


          const revisionsHtml =
            revisions
              .map(
                function (
                  revision
                ) {
                  const revisionProjects =
                    (
                      revision
                        .projectNodeIds ||
                      []
                    )
                      .map(
                        function (
                          nodeId
                        ) {
                          return (
                            projectMap.get(
                              nodeId
                            )?.name ||
                            nodeId
                          );
                        }
                      )
                      .join(', ');


                  return `
                    <article
                      class="
                        document-registry-revision
                        document-registry-status-${escapeDocumentRegistryHtml(
                          revision.status
                        )}
                      "
                    >
                      <div
                        class="document-registry-revision-main"
                      >
                        <div
                          class="document-registry-revision-tags"
                        >
                          <span
                            class="document-registry-revision-label"
                          >
                            ${escapeDocumentRegistryHtml(
                              revision.revisionLabel
                            )}
                          </span>

                          <span
                            class="document-registry-status-tag"
                          >
                            ${escapeDocumentRegistryHtml(
                              DOCUMENT_REGISTRY_STATUS_LABELS[
                                revision.status
                              ] ||
                              revision.status
                            )}
                          </span>
                        </div>

                        <strong>
                          ${escapeDocumentRegistryHtml(
                            revision.fileName
                          )}
                        </strong>

                        <p>
                          ${escapeDocumentRegistryHtml(
                            DOCUMENT_REGISTRY_RELATION_LABELS[
                              revision.relationType
                            ] ||
                            revision.relationType
                          )}

                          · получен

                          ${escapeDocumentRegistryHtml(
                            new Date(
                              revision.receivedAt
                            ).toLocaleString(
                              'ru-RU'
                            )
                          )}
                        </p>

                        <p>
                          Проекты этой редакции:
                          ${escapeDocumentRegistryHtml(
                            revisionProjects ||
                            'не указаны'
                          )}
                        </p>

                        <small>
                          ID редакции:
                          ${escapeDocumentRegistryHtml(
                            revision.revisionId
                          )}

                          ${
                            revision.notes
                              ? (
                                  ' · ' +
                                  escapeDocumentRegistryHtml(
                                    revision.notes
                                  )
                                )
                              : ''
                          }
                        </small>
                      </div>

                      <div
                        class="document-registry-revision-actions"
                      >
                        <button
                          type="button"
                          data-registry-action="review"
                          data-document-id="${escapeDocumentRegistryHtml(
                            documentItem.documentId
                          )}"
                          data-revision-id="${escapeDocumentRegistryHtml(
                            revision.revisionId
                          )}"
                          ${
                            revision.status ===
                              'under-review'
                              ? 'disabled'
                              : ''
                          }
                        >
                          На проверку
                        </button>

                        <button
                          type="button"
                          data-registry-action="current"
                          data-document-id="${escapeDocumentRegistryHtml(
                            documentItem.documentId
                          )}"
                          data-revision-id="${escapeDocumentRegistryHtml(
                            revision.revisionId
                          )}"
                          ${
                            revision.status ===
                              'current'
                              ? 'disabled'
                              : ''
                          }
                        >
                          Сделать действующей
                        </button>

                        <button
                          type="button"
                          data-registry-action="cancel"
                          data-document-id="${escapeDocumentRegistryHtml(
                            documentItem.documentId
                          )}"
                          data-revision-id="${escapeDocumentRegistryHtml(
                            revision.revisionId
                          )}"
                          ${
                            revision.status ===
                              'cancelled'
                              ? 'disabled'
                              : ''
                          }
                        >
                          Аннулировать
                        </button>
                      </div>
                    </article>
                  `;
                }
              )
              .join('');


          return `
            <section
              class="document-registry-document-card"
            >
              <div
                class="document-registry-document-head"
              >
                <div>
                  <span
                    class="document-registry-kind-tag"
                  >
                    ${escapeDocumentRegistryHtml(
                      DOCUMENT_REGISTRY_KIND_LABELS[
                        documentItem.kind
                      ] ||
                      documentItem.kind
                    )}
                  </span>

                  <h3>
                    ${escapeDocumentRegistryHtml(
                      documentItem.logicalTitle
                    )}
                  </h3>

                  <p>
                    Проекты / пакеты
                    действующей или последней редакции:
                    ${escapeDocumentRegistryHtml(
                      projectLabels ||
                      'не указаны'
                    )}
                  </p>

                  <small>
                    Document ID:
                    ${escapeDocumentRegistryHtml(
                      documentItem.documentId
                    )}
                  </small>
                </div>

                <strong
                  class="document-registry-revision-count"
                >
                  ${
                    documentItem
                      .revisions
                      .length
                  }
                  ред.
                </strong>
              </div>

              <div
                class="document-registry-revisions"
              >
                ${revisionsHtml}
              </div>
            </section>
          `;
        }
      )
      .join('');
}


function initializeDocumentRegistry() {
  refreshRegistryProjectNodes();
  refreshRegistryUploadOptions();
  refreshRegistryExistingDocuments();
  syncRegistryFormMode();
  renderDocumentRegistry();


  document.getElementById(
    'documentRegistryMode'
  )?.addEventListener(
    'change',
    syncRegistryFormMode
  );


  document.getElementById(
    'documentRegistryUploadSelect'
  )?.addEventListener(
    'change',
    syncRegistryFormFromUpload
  );


  document.getElementById(
    'documentRegistryExistingDocument'
  )?.addEventListener(
    'change',
    syncRegistryFormFromExisting
  );


  document.getElementById(
    'registerDocumentRevisionBtn'
  )?.addEventListener(
    'click',
    registerDocumentRevision
  );


  document.getElementById(
    'documentRegistryList'
  )?.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-registry-action]'
        );

      if (!button) {
        return;
      }


      const action =
        button.dataset
          .registryAction;


      const statusMap = {
        review:
          'under-review',

        current:
          'current',

        cancel:
          'cancelled'
      };


      const nextStatus =
        statusMap[
          action
        ];


      if (!nextStatus) {
        return;
      }


      if (
        nextStatus ===
          'current' &&
        !confirm(
          'Сделать эту редакцию действующей?\n\n' +
          'Если у документа уже есть действующая редакция, ' +
          'она получит статус «Заменён». История сохранится.'
        )
      ) {
        return;
      }


      if (
        nextStatus ===
          'cancelled' &&
        !confirm(
          'Аннулировать эту редакцию?\n\n' +
          'Запись останется в истории документа.'
        )
      ) {
        return;
      }


      setRegistryRevisionStatus(
        button.dataset.documentId,
        button.dataset.revisionId,
        nextStatus
      );
    }
  );


  window.addEventListener(
    'buildmind:project-core-changed',
    function () {
      refreshRegistryProjectNodes();
      refreshRegistryExistingDocuments();
      renderDocumentRegistry();
    }
  );


  /*
    app.js уже меняет documentsCount
    при загрузке / удалении файлов.

    Наблюдаем за этим счётчиком,
    чтобы список файлов в реестре
    обновлялся автоматически.
  */

  const documentsCount =
    document.getElementById(
      'documentsCount'
    );


  if (
    documentsCount &&
    window.MutationObserver
  ) {
    const observer =
      new MutationObserver(
        function () {
          refreshRegistryUploadOptions();
        }
      );

    observer.observe(
      documentsCount,
      {
        childList:
          true,

        subtree:
          true,

        characterData:
          true
      }
    );
  }
}


window.BuildMindDocumentRegistry = {
  version:
    BUILDMIND_DOCUMENT_REGISTRY_VERSION,

  getState:
    function () {
      return cloneDocumentRegistry(
        documentRegistryState
      );
    },

  getDocuments:
    function () {
      return cloneDocumentRegistry(
        documentRegistryState
          .documents
      );
    },

  getCurrentRevisions:
    function () {
      return cloneDocumentRegistry(
        getAllRegistryRevisions()
          .filter(
            function (item) {
              return (
                item
                  .revision
                  .status ===
                'current'
              );
            }
          )
      );
    },

  findRevisionBySha256:
    function (sha256) {
      const found =
        findRegistryRevisionBySha256(
          sha256
        );

      return found
        ? cloneDocumentRegistry(
            found
          )
        : null;
    },

  importAnalysisSnapshot:
    function (snapshot) {
      return importDocumentRegistryAnalysisSnapshot(
        cloneDocumentRegistry(snapshot)
      );
    },

  refreshUploads:
    refreshRegistryUploadOptions,

  refresh:
    renderDocumentRegistry
};


initializeDocumentRegistry();


console.info(
  'BuildMind Document Registry загружен:',
  BUILDMIND_DOCUMENT_REGISTRY_VERSION
);
