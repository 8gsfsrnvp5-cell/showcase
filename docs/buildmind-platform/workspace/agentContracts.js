'use strict';

/*
  BUILDMIND AGENT CONTRACTS — V1

  Все специализированные исполнители возвращают
  один и тот же отчёт. Это позволяет главному агенту
  собирать PDF, Excel, расчёты и будущие API-агенты
  в единую картину проекта.
*/

const BUILDMIND_AGENT_CONTRACTS_VERSION =
  'buildmind-agent-contracts-v1';

function createBuildMindAgentId(prefix) {
  const safePrefix =
    String(prefix || 'agent')
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '') ||
    'agent';

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return (
      safePrefix +
      '-' +
      window.crypto.randomUUID()
    );
  }

  return (
    safePrefix +
    '-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  );
}

function normalizeBuildMindAgentArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}


const BUILDMIND_TRUTH_STATUSES = [
  'confirmed',
  'extracted',
  'calculated',
  'needs-review',
  'conflict',
  'not-found',
  'unreadable',
  'rejected',
  'manual-override'
];

function hasBuildMindEvidence(value) {
  if (!value) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return Boolean(
    value.sourceFile ||
    value.sourcePage ||
    value.sourceSheet ||
    value.sourceCell ||
    value.sourceObject ||
    value.sourceQuote ||
    value.documentId ||
    value.recordId
  );
}

function normalizeBuildMindTruthStatus(value) {
  return BUILDMIND_TRUTH_STATUSES.includes(value)
    ? value
    : 'needs-review';
}

function validateBuildMindAgentReportIntegrity(report) {
  const issues = [];

  if (!report || typeof report !== 'object') {
    return {
      valid: false,
      issues: ['REPORT_IS_NOT_AN_OBJECT']
    };
  }

  const evidence = normalizeBuildMindAgentArray(report.evidence);
  const facts = normalizeBuildMindAgentArray(report.facts);

  if (facts.length > 0 && evidence.length === 0) {
    issues.push('FACTS_HAVE_NO_EVIDENCE');
  }

  const unsupportedFacts = facts.filter(function (fact) {
    return (
      fact &&
      typeof fact === 'object' &&
      !hasBuildMindEvidence(fact.evidence || fact.source || fact)
    );
  });

  if (unsupportedFacts.length > 0) {
    issues.push('UNSUPPORTED_FACTS_PRESENT');
  }

  if (report.truthStatus === 'confirmed' && issues.length > 0) {
    issues.push('CONFIRMED_STATUS_REQUIRES_EVIDENCE');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function createBuildMindAgentReport(options) {
  const settings =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const startedAt =
    settings.startedAt ||
    new Date().toISOString();

  const completedAt =
    settings.completedAt ||
    new Date().toISOString();

  const startedTime =
    Date.parse(startedAt);

  const completedTime =
    Date.parse(completedAt);

  const durationMs =
    Number.isFinite(startedTime) &&
    Number.isFinite(completedTime)
      ? Math.max(
          0,
          completedTime -
            startedTime
        )
      : null;

  let status =
    [
      'completed',
      'partial',
      'blocked',
      'failed',
      'cancelled'
    ].includes(
      settings.status
    )
      ? settings.status
      : 'partial';

  const truthStatus =
    normalizeBuildMindTruthStatus(
      settings.truthStatus
    );

  const facts =
    normalizeBuildMindAgentArray(
      settings.facts
    );

  const evidence =
    normalizeBuildMindAgentArray(
      settings.evidence
    );

  const integrity =
    validateBuildMindAgentReportIntegrity({
      facts,
      evidence,
      truthStatus
    });

  const qualityFlags =
    normalizeBuildMindAgentArray(
      settings.qualityFlags
    ).slice();

  if (!integrity.valid) {
    qualityFlags.push(
      ...integrity.issues
    );

    if (status === 'completed') {
      status = 'partial';
    }
  }

  return {
    schemaVersion:
      BUILDMIND_AGENT_CONTRACTS_VERSION,

    reportId:
      settings.reportId ||
      createBuildMindAgentId(
        'agent-report'
      ),

    agentId:
      String(
        settings.agentId ||
          'unknown-agent'
      ),

    taskType:
      String(
        settings.taskType ||
          'unknown'
      ),

    status,

    source:
      settings.source ||
      null,

    confidence:
      settings.confidence ||
      'medium',

    facts,

    issues:
      normalizeBuildMindAgentArray(
        settings.issues
      ).concat(
        integrity.issues
      ),

    evidence,

    truthStatus,

    qualityFlags,

    manualReview:
      settings.manualReview &&
      typeof settings.manualReview === 'object'
        ? settings.manualReview
        : null,

    payload:
      settings.payload === undefined
        ? {}
        : settings.payload,

    metadata:
      settings.metadata &&
      typeof settings.metadata ===
        'object'
        ? settings.metadata
        : {},

    startedAt,

    completedAt,

    durationMs,

    errorCode:
      settings.errorCode ||
      null,

    errorMessage:
      settings.errorMessage ||
      null
  };
}

function isBuildMindAgentReport(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.schemaVersion ===
      BUILDMIND_AGENT_CONTRACTS_VERSION &&
    typeof value.agentId ===
      'string' &&
    typeof value.taskType ===
      'string' &&
    typeof value.status ===
      'string'
  );
}

function summarizeBuildMindAgentReports(
  reports
) {
  const normalizedReports =
    normalizeBuildMindAgentArray(
      reports
    ).filter(
      isBuildMindAgentReport
    );

  const statusCounts = {};

  normalizedReports.forEach(
    function (report) {
      statusCounts[report.status] =
        (statusCounts[report.status] ||
          0) + 1;
    }
  );

  const failedReports =
    normalizedReports.filter(
      function (report) {
        return [
          'failed',
          'cancelled',
          'blocked'
        ].includes(
          report.status
        );
      }
    );

  return {
    schemaVersion:
      BUILDMIND_AGENT_CONTRACTS_VERSION,

    reportCount:
      normalizedReports.length,

    agentIds:
      Array.from(
        new Set(
          normalizedReports.map(
            function (report) {
              return report.agentId;
            }
          )
        )
      ),

    taskTypes:
      Array.from(
        new Set(
          normalizedReports.map(
            function (report) {
              return report.taskType;
            }
          )
        )
      ),

    statusCounts,

    failedReportCount:
      failedReports.length,

    totalDurationMs:
      normalizedReports.reduce(
        function (total, report) {
          return (
            total +
            (Number(
              report.durationMs
            ) || 0)
          );
        },
        0
      ),

    reports:
      normalizedReports
  };
}

window.BuildMindAgentContracts = {
  version:
    BUILDMIND_AGENT_CONTRACTS_VERSION,

  createReport:
    createBuildMindAgentReport,

  isReport:
    isBuildMindAgentReport,

  validateIntegrity:
    validateBuildMindAgentReportIntegrity,

  hasEvidence:
    hasBuildMindEvidence,

  summarizeReports:
    summarizeBuildMindAgentReports
};

console.info(
  'BuildMind Agent Contracts загружен:',
  BUILDMIND_AGENT_CONTRACTS_VERSION
);
