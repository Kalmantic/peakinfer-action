/**
 * PeakInfer GitHub Action
 *
 * Thin API client that calls peakinfer.com for analysis.
 * All analysis logic runs server-side - this action only:
 * 1. Collects files from the repository
 * 2. Sends them to the PeakInfer API
 * 3. Posts results as PR comments
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PEAKINFER_API = 'https://www.peakinfer.com/api';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.java', '.kt', '.rs', '.rb',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', 'vendor', '.venv', 'venv',
]);

// =============================================================================
// TYPES
// =============================================================================

interface ActionInputs {
  path: string;
  token: string;
  githubToken: string;
  events?: string;
  eventsMap?: string;
  inlineComments: boolean;
  failOnCritical: boolean;
  compareBaseline: boolean;
}

interface FileInfo {
  path: string;
  content: string;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    inferencePoints: Array<{
      id: string;
      file: string;
      line: number;
      provider: string;
      model: string;
      issues: Array<{
        type: string;
        severity: 'critical' | 'warning' | 'info';
        headline: string;
        evidence: string;
        suggestedFix?: string;
      }>;
    }>;
    summary: {
      totalInferencePoints: number;
      criticalIssues: number;
      warnings: number;
    };
  };
  credits: {
    used: number;
    remaining: number;
  };
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// =============================================================================
// FILE COLLECTION
// =============================================================================

function collectFiles(dir: string, files: FileInfo[] = [], maxFiles = 50): FileInfo[] {
  if (files.length >= maxFiles) return files;
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (files.length >= maxFiles) break;

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        collectFiles(fullPath, files, maxFiles);
      }
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (SUPPORTED_EXTENSIONS.has(ext) && stat.size < 100000) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          files.push({ path: fullPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return files;
}

// =============================================================================
// API CLIENT
// =============================================================================

async function callAnalysisAPI(
  token: string,
  files: FileInfo[],
  context: {
    repo: string;
    prNumber: number;
    sha: string;
  },
  options: {
    events?: string;
    eventsMap?: string;
    compareBaseline?: boolean;
  }
): Promise<AnalysisResponse | ErrorResponse> {
  const response = await fetch(`${PEAKINFER_API}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      files,
      repo: context.repo,
      prNumber: context.prNumber,
      sha: context.sha,
      events: options.events,
      eventsMap: options.eventsMap,
      compareBaseline: options.compareBaseline,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return data as ErrorResponse;
  }

  return data as AnalysisResponse;
}

// =============================================================================
// PR COMMENT
// =============================================================================

function generateComment(analysis: AnalysisResponse['analysis'], credits: AnalysisResponse['credits']): string {
  const { inferencePoints, summary } = analysis;

  const lines: string[] = [
    '## PeakInfer Analysis',
    '',
  ];

  // Summary
  if (summary.totalInferencePoints === 0) {
    lines.push('No LLM inference points detected in this PR.');
    lines.push('');
    lines.push('---');
    lines.push(`*Credits remaining: ${credits.remaining}*`);
    return lines.join('\n');
  }

  lines.push(`Found **${summary.totalInferencePoints} inference points**`);
  lines.push('');

  // Issues table
  if (summary.criticalIssues > 0 || summary.warnings > 0) {
    lines.push('### Issues');
    lines.push('');
    lines.push('| Location | Severity | Issue |');
    lines.push('|----------|----------|-------|');

    for (const point of inferencePoints) {
      for (const issue of point.issues || []) {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`| \`${point.file}:${point.line}\` | ${icon} ${issue.severity} | ${issue.headline} |`);
      }
    }
    lines.push('');
  } else {
    lines.push('✅ No issues detected.');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Credits remaining: ${credits.remaining} • [PeakInfer](https://peakinfer.com)*`);

  return lines.join('\n');
}

function generateExhaustedComment(used: number, limit: number): string {
  return [
    '## PeakInfer Analysis',
    '',
    '**Analysis paused** — credit limit reached.',
    '',
    `Used: ${used} / ${limit} credits`,
    '',
    '[Add credits →](https://peakinfer.com/pricing)',
    '',
    '---',
    '*[PeakInfer](https://peakinfer.com)*',
  ].join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function run(): Promise<void> {
  try {
    // Parse inputs
    const inputs: ActionInputs = {
      path: core.getInput('path') || './src',
      token: core.getInput('token'),
      githubToken: core.getInput('github-token') || process.env.GITHUB_TOKEN || '',
      events: core.getInput('events') || undefined,
      eventsMap: core.getInput('events-map') || undefined,
      inlineComments: core.getInput('inline-comments') !== 'false',
      failOnCritical: core.getInput('fail-on-critical') === 'true',
      compareBaseline: core.getInput('compare-baseline') === 'true',
    };

    // Validate token
    if (!inputs.token) {
      core.setFailed('PeakInfer token is required. Get one at https://peakinfer.com');
      return;
    }

    if (!inputs.githubToken) {
      core.setFailed('GitHub token is required for PR comments');
      return;
    }

    const context = github.context;
    const octokit = github.getOctokit(inputs.githubToken);

    // Check if PR context
    if (!context.payload.pull_request) {
      core.warning('PeakInfer action should run on pull_request events');
      return;
    }

    const repo = `${context.repo.owner}/${context.repo.repo}`;
    const prNumber = context.payload.pull_request.number;
    const sha = context.payload.pull_request.head.sha;

    // Collect files
    core.info(`Analyzing path: ${inputs.path}`);
    const files = collectFiles(inputs.path);
    core.info(`Found ${files.length} files to analyze`);

    if (files.length === 0) {
      core.warning('No supported files found for analysis');
      return;
    }

    // Call API
    core.info('Calling PeakInfer API...');
    const response = await callAnalysisAPI(
      inputs.token,
      files,
      { repo, prNumber, sha },
      {
        events: inputs.events,
        eventsMap: inputs.eventsMap,
        compareBaseline: inputs.compareBaseline,
      }
    );

    // Handle errors
    if ('error' in response) {
      if (response.code === 'CREDIT_EXHAUSTED') {
        core.warning('Credit limit reached');
        const comment = generateExhaustedComment(0, 0);
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: comment,
        });
        core.setOutput('status', 'skipped');
        return;
      }
      core.setFailed(`API error: ${response.error}`);
      return;
    }

    const { analysis, credits } = response;
    core.info(`Analysis complete: ${analysis.summary.totalInferencePoints} inference points`);

    // Post PR comment
    const comment = generateComment(analysis, credits);
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: comment,
    });

    // Set outputs
    core.setOutput('status', analysis.summary.criticalIssues > 0 ? 'fail' : 'pass');
    core.setOutput('inference-points', analysis.summary.totalInferencePoints);
    core.setOutput('issues', analysis.summary.criticalIssues + analysis.summary.warnings);
    core.setOutput('summary', JSON.stringify(analysis.summary));

    // Fail if critical issues and configured to do so
    if (inputs.failOnCritical && analysis.summary.criticalIssues > 0) {
      core.setFailed(`Found ${analysis.summary.criticalIssues} critical issues`);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
