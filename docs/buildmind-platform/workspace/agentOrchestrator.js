'use strict';

/*
  BUILDMIND AGENT ORCHESTRATOR — V1

  Реестр и диспетчер локальных специализированных
  исполнителей. Первый слой работает без API-ключей:
  PDF/OCR и Excel вызывают существующие локальные
  движки, а позже сюда можно подключить серверные
  LLM-агенты без изменения контракта отчёта.
*/

const BUILDMIND_AGENT_ORCHESTRATOR_VERSION =
  'buildmind-agent-orchestrator-v1';

const buildMindAgentRegistry =
  new Map();

function getBuildMindAgentContracts() {
  return (
    window.BuildMindAgentContracts ||
    null
  );
}

function registerBuildMindAgent(agent) {
  if (
    !agent ||
    !agent.id ||
    !agent.taskType ||
    typeof agent.run !==
      'function'
  ) {
    throw new Error(
      'INVALID_BUILDMIND_AGENT'
    );
  }

  buildMindAgentRegistry.set(
    String(agent.id),
    {
      ...agent,
      id:
        String(agent.id),
      taskType:
        String(agent.taskType)
    }
  );

  return buildMindAgentRegistry.get(
    String(agent.id)
  );
}

function listBuildMindAgents() {
  return Array.from(
    buildMindAgentRegistry.values()
  ).map(
    function (agent) {
      return {
        id: agent.id,
        taskType:
          agent.taskType,
        label:
          agent.label ||
          agent.id
      };
    }
  );
}

function resolveBuildMindAgent(
  taskType,
  input
) {
  const exact =
    Array.from(
      buildMindAgentRegistry.values()
    ).find(
      function (agent) {
        return (
          agent.taskType ===
          taskType
        );
      }
    );

  if (exact) {
    return exact;
  }

  return Array.from(
    buildMindAgentRegistry.values()
  ).find(
    function (agent) {
      return (
        typeof agent.supports ===
          'function' &&
        agent.supports(
          input,
          taskType
        ) === true
      );
    }
  ) || null;
}

function hasBuildMindVerifiedPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const evidence = Array.isArray(payload.evidence)
    ? payload.evidence
    : [];

  const hasEvidence = evidence.some(function (item) {
    return Boolean(
      item &&
      (
        item.sourceFile ||
        item.sourcePage ||
        item.sourceSheet ||
        item.sourceCell ||
        item.sourceObject ||
        item.sourceQuote ||
        item.documentId ||
        item.recordId
      )
    );
  });

  const directSource = Boolean(
    payload.source ||
    payload.sourceFile ||
    payload.sourceDocument
  );

  return hasEvidence || directSource;
}

function hasBuildMindCandidateData(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return [
    'facts',
    'works',
    'materials',
    'rows',
    'items',
    'candidates'
  ].some(function (key) {
    return Array.isArray(payload[key]) &&
      payload[key].length > 0;
  });
}

async function runBuildMindAgent(
  taskType,
  input,
  context
) {
  const contracts =
    getBuildMindAgentContracts();

  if (
    !contracts ||
    typeof contracts.createReport !==
      'function'
  ) {
    throw new Error(
      'BUILDMIND_AGENT_CONTRACTS_NOT_LOADED'
    );
  }

  const agent =
    resolveBuildMindAgent(
      taskType,
      input
    );

  const startedAt =
    new Date().toISOString();

  if (!agent) {
    return contracts.createReport({
      agentId:
        'director-agent',
      taskType,
      status:
        'failed',
      source:
        'agent-orchestrator',
      confidence:
        'low',
      errorCode:
        'AGENT_NOT_REGISTERED',
      errorMessage:
        'Для задачи не зарегистрирован специализированный агент.',
      metadata: {
        availableAgents:
          listBuildMindAgents()
      },
      startedAt
    });
  }

  console.info(
    '[BuildMind agent] start',
    {
      agentId: agent.id,
      taskType,
      source:
        input?.file?.name ||
        input?.documentItem?.file?.name ||
        null
    }
  );

  try {
    const payload =
      await agent.run(
        input,
        context || {}
      );

    if (
      contracts.isReport &&
      contracts.isReport(
        payload
      )
    ) {
      return payload;
    }

    const verifiedPayload =
      hasBuildMindVerifiedPayload(
        payload
      );

    const candidateData =
      hasBuildMindCandidateData(
        payload
      );

    const payloadIssues =
      candidateData && !verifiedPayload
        ? [
            'AGENT_PAYLOAD_WITHOUT_EVIDENCE'
          ]
        : [];

    return contracts.createReport({
      agentId:
        agent.id,
      taskType,
      status:
        payloadIssues.length > 0
          ? 'partial'
          : 'completed',
      truthStatus:
        verifiedPayload
          ? 'extracted'
          : 'needs-review',
      source:
        'local-specialized-agent',
      confidence:
        payloadIssues.length > 0
          ? 'low'
          : (
              agent.confidence ||
              'medium'
            ),
      issues:
        payloadIssues,
      evidence:
        Array.isArray(payload?.evidence)
          ? payload.evidence
          : [],
      payload,
      metadata: {
        label:
          agent.label ||
          agent.id,
        fileName:
          input?.file?.name ||
          input?.documentItem?.file?.name ||
          ''
      },
      startedAt
    });
  } catch (error) {
    console.warn(
      '[BuildMind agent] failed',
      {
        agentId: agent.id,
        taskType,
        error:
          String(error && error.message || error)
      }
    );

    const cancelled =
      error &&
      (
        error.name ===
          'AbortError' ||
        error.code ===
          'PROJECT_INTAKE_ANALYSIS_CANCELLED' ||
        error.code ===
          'PDF_ANALYSIS_CANCELLED'
      );

    return contracts.createReport({
      agentId:
        agent.id,
      taskType,
      status:
        cancelled
          ? 'cancelled'
          : 'failed',
      source:
        'local-specialized-agent',
      confidence:
        'low',
      errorCode:
        cancelled
          ? 'AGENT_CANCELLED'
          : 'AGENT_EXECUTION_FAILED',
      errorMessage:
        String(
          error &&
          error.message ||
          'Специализированный агент завершился с ошибкой.'
        ),
      metadata: {
        label:
          agent.label ||
          agent.id
      },
      startedAt
    });
  }
}

function aggregateBuildMindAgentReports(
  reports
) {
  const contracts =
    getBuildMindAgentContracts();

  if (
    !contracts ||
    typeof contracts.summarizeReports !==
      'function'
  ) {
    return {
      schemaVersion:
        BUILDMIND_AGENT_ORCHESTRATOR_VERSION,
      reportCount: 0,
      statusCounts: {},
      reports: []
    };
  }

  return {
    orchestratorVersion:
      BUILDMIND_AGENT_ORCHESTRATOR_VERSION,

    ...contracts.summarizeReports(
      reports
    )
  };
}

window.BuildMindAgentOrchestrator = {
  version:
    BUILDMIND_AGENT_ORCHESTRATOR_VERSION,

  register:
    registerBuildMindAgent,

  list:
    listBuildMindAgents,

  resolve:
    resolveBuildMindAgent,

  run:
    runBuildMindAgent,

  aggregate:
    aggregateBuildMindAgentReports
};

console.info(
  'BuildMind Agent Orchestrator загружен:',
  BUILDMIND_AGENT_ORCHESTRATOR_VERSION
);
