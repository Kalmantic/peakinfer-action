/**
 * PeakInfer GitHub Action v1.9.6
 *
 * Thin API client that calls peakinfer.com for analysis.
 * All analysis logic runs server-side - this action only:
 * 1. Collects files from the repository
 * 2. Sends them to the PeakInfer API
 * 3. Posts results as PR comments with layer status
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
  // Auth
  peakinferToken: string;
  githubToken: string;
  // Layer 1: Runtime
  runtimeSource?: string;
  runtimeApiKey?: string;
  eventsFile?: string;
  eventsMap?: string;
  // Layer 2: Benchmarks
  includeBenchmarks: boolean;
  benchmarkFramework: string;
  // Layer 3: Evals (Future)
  evalsSource?: string;
  evalsApiKey?: string;
  // Behavior
  failOnCritical: boolean;
  commentMode: 'always' | 'on-issues' | 'never';
  showEnhancementPrompts: boolean;
}

interface LayerConfig {
  code: { enabled: true }; // Always enabled
  runtime: { enabled: boolean; source?: string; apiKey?: string; eventsFile?: string };
  benchmarks: { enabled: boolean; framework: string };
  evals: { enabled: boolean; source?: string; apiKey?: string };
}

interface FileInfo {
  path: string;
  content: string;
}

interface Issue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  headline: string;
  evidence: string;
  suggestedFix?: string;
  location?: string;
}

interface InferencePoint {
  id: string;
  file: string;
  line: number;
  provider: string;
  model: string;
  issues: Issue[];
}

interface DriftDetection {
  id: string;
  file: string;
  line: number;
  type: string;
  declared: string;
  observed: string;
  severity: 'critical' | 'warning' | 'info';
}

interface BenchmarkComparison {
  pointId: string;
  model: string;
  yourP95: number;
  benchmarkP95: number;
  gapPercent: number;
  gapDescription: string;
}

interface AnalysisResponse {
  success: boolean;
  analysis: {
    inferencePoints: InferencePoint[];
    drifts?: DriftDetection[];
    benchmarkComparisons?: BenchmarkComparison[];
    insights: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
    }>;
    summary: {
      totalInferencePoints: number;
      totalFiles: number;
      providers: string[];
      models: string[];
      overallReliability: string;
      totalOptimizations: number;
      criticalOptimizations: number;
    };
    layersUsed: string[];
  };
  credits?: {
    consumed: number;
    remaining: number;
    expiringSoon: number;
  };
}

interface ErrorResponse {
  error: string;
  code?: string;
  hint?: string;
  available?: number;
  creditsNeeded?: number;
}

type Verdict = 'PASS' | 'OK' | 'REVIEW' | 'BLOCK' | 'PAUSED' | 'SKIP' | 'ERROR';

interface EnhancementPrompt {
  layer: string;
  message: string;
  workflowSnippet: string;
  docsUrl: string;
}

interface StatsResponse {
  success: boolean;
  stats?: {
    thisMonth?: {
      prsAnalyzed?: number;
      criticalCaught?: number;
      estimatedSavings?: number;
    };
  };
}

// =============================================================================
// VERDICT LOGIC
// =============================================================================

const VERDICT_TEXT: Record<Verdict, string> = {
  PASS: 'Safe to Merge',
  OK: 'Mostly Good',
  REVIEW: 'Review Recommended',
  BLOCK: 'Changes Requested',
  PAUSED: 'Analysis Paused',
  SKIP: 'No LLM Code',
  ERROR: 'Analysis Failed',
};

function calculateVerdict(
  criticalCount: number,
  warningCount: number,
  hasLLMCode: boolean,
  creditsExhausted: boolean,
  hasError: boolean
): Verdict {
  if (hasError) return 'ERROR';
  if (creditsExhausted) return 'PAUSED';
  if (!hasLLMCode) return 'SKIP';
  if (criticalCount >= 2) return 'BLOCK';
  if (criticalCount === 1 || warningCount > 5) return 'REVIEW';
  if (warningCount >= 1 && warningCount <= 5) return 'OK';
  return 'PASS';
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
  layers: LayerConfig
): Promise<AnalysisResponse | ErrorResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${PEAKINFER_API}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      files,
      repo: context.repo,
      prNumber: context.prNumber,
      sha: context.sha,
      layers: {
        runtime: layers.runtime.enabled ? {
          source: layers.runtime.source,
          apiKey: layers.runtime.apiKey,
          eventsFile: layers.runtime.eventsFile,
        } : undefined,
        benchmarks: layers.benchmarks.enabled ? {
          framework: layers.benchmarks.framework,
        } : undefined,
        evals: layers.evals.enabled ? {
          source: layers.evals.source,
          apiKey: layers.evals.apiKey,
        } : undefined,
      },
      mode: 'paid',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return data as ErrorResponse;
  }

  return data as AnalysisResponse;
}

/**
 * Fetch organization stats from the API
 * Used to show real value delivered when credits are exhausted
 */
async function fetchOrgStats(token: string): Promise<{
  prsAnalyzed: number;
  criticalCaught: number;
  estimatedSavings: number;
} | null> {
  try {
    const response = await fetch(`${PEAKINFER_API}/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      core.debug(`Failed to fetch stats: ${response.status}`);
      return null;
    }

    const data = await response.json() as StatsResponse;
    if (data.success && data.stats?.thisMonth) {
      return {
        prsAnalyzed: data.stats.thisMonth.prsAnalyzed ?? 0,
        criticalCaught: data.stats.thisMonth.criticalCaught ?? 0,
        estimatedSavings: data.stats.thisMonth.estimatedSavings ?? 0,
      };
    }
    return null;
  } catch (error) {
    core.debug(`Error fetching stats: ${error}`);
    return null;
  }
}

// =============================================================================
// ENHANCEMENT PROMPTS
// =============================================================================

function getEnhancementPrompts(layersUsed: string[], hasRecommendations: boolean): EnhancementPrompt[] {
  const prompts: EnhancementPrompt[] = [];

  if (!layersUsed.includes('runtime')) {
    prompts.push({
      layer: 'Runtime',
      message: 'Detect drift between code and actual behavior',
      workflowSnippet: `runtime-source: helicone
runtime-api-key: \${{ secrets.HELICONE_API_KEY }}`,
      docsUrl: 'https://peakinfer.com/docs/runtime',
    });
  }

  if (!layersUsed.includes('benchmarks')) {
    prompts.push({
      layer: 'Benchmarks',
      message: 'Compare to InferenceMAX benchmarks',
      workflowSnippet: `include-benchmarks: true`,
      docsUrl: 'https://peakinfer.com/docs/benchmarks',
    });
  }

  if (!layersUsed.includes('evals') && hasRecommendations) {
    prompts.push({
      layer: 'Evals',
      message: 'Gate recommendations by quality scores',
      workflowSnippet: `evals-source: braintrust
evals-api-key: \${{ secrets.BRAINTRUST_API_KEY }}`,
      docsUrl: 'https://peakinfer.com/docs/evals',
    });
  }

  return prompts;
}

// =============================================================================
// PR COMMENT GENERATION
// =============================================================================

function countIssues(inferencePoints: InferencePoint[]): { critical: number; warnings: number } {
  let critical = 0;
  let warnings = 0;

  for (const point of inferencePoints) {
    for (const issue of point.issues || []) {
      if (issue.severity === 'critical') critical++;
      else if (issue.severity === 'warning') warnings++;
    }
  }

  return { critical, warnings };
}

function renderLayerStatus(layersUsed: string[]): string {
  const check = (layer: string) => layersUsed.includes(layer) ? '✓' : '○';
  return `Code ${check('code')} | Runtime ${check('runtime')} | Benchmarks ${check('benchmarks')} | Evals ${check('evals')}`;
}

function generateComment(
  analysis: AnalysisResponse['analysis'],
  verdict: Verdict,
  credits: AnalysisResponse['credits'] | undefined,
  showEnhancementPrompts: boolean
): string {
  const { inferencePoints, drifts, benchmarkComparisons, insights, summary, layersUsed } = analysis;
  const issueCounts = countIssues(inferencePoints);
  const driftCount = drifts?.length || 0;

  const lines: string[] = [
    `## [${verdict}] PeakInfer: ${VERDICT_TEXT[verdict]}`,
    '',
    `**Layers:** ${renderLayerStatus(layersUsed)}`,
    '',
  ];

  // Summary line
  if (summary.totalInferencePoints === 0) {
    lines.push('No LLM inference points detected in this PR.');
    lines.push('');
  } else {
    lines.push(`**Found:** ${summary.totalInferencePoints} inference points | ${issueCounts.critical} critical | ${issueCounts.warnings} warnings | ${driftCount} drift`);
    lines.push('');
  }

  // Top issue (if any critical or warnings)
  const topIssue = findTopIssue(inferencePoints);
  if (topIssue) {
    lines.push(`### Critical: ${topIssue.headline}`);
    lines.push(`**Location:** \`${topIssue.location}\``);
    lines.push(`**Impact:** ${topIssue.evidence}`);
    if (topIssue.suggestedFix) {
      lines.push('');
      lines.push('**Fix:**');
      lines.push('```');
      lines.push(topIssue.suggestedFix);
      lines.push('```');
    }
    lines.push('');
  }

  // Drift detections (if runtime layer enabled)
  if (drifts && drifts.length > 0) {
    lines.push('<details>');
    lines.push('<summary>Drift Detections (' + drifts.length + ')</summary>');
    lines.push('');
    lines.push('| Location | Type | Declared | Observed |');
    lines.push('|----------|------|----------|----------|');
    for (const drift of drifts.slice(0, 10)) {
      lines.push(`| \`${drift.file}:${drift.line}\` | ${drift.type} | ${drift.declared} | ${drift.observed} |`);
    }
    if (drifts.length > 10) {
      lines.push(`| ... | ${drifts.length - 10} more | | |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Benchmark comparisons (if benchmarks layer enabled)
  if (benchmarkComparisons && benchmarkComparisons.length > 0) {
    lines.push('<details>');
    lines.push('<summary>Benchmark Comparison</summary>');
    lines.push('');
    lines.push('| Model | Your p95 | Benchmark p95 | Gap |');
    lines.push('|-------|----------|---------------|-----|');
    for (const comp of benchmarkComparisons.slice(0, 10)) {
      lines.push(`| ${comp.model} | ${comp.yourP95}ms | ${comp.benchmarkP95}ms | ${comp.gapDescription} |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // All issues table (collapsed)
  if (issueCounts.critical > 0 || issueCounts.warnings > 0) {
    lines.push('<details>');
    lines.push('<summary>All Issues (' + (issueCounts.critical + issueCounts.warnings) + ')</summary>');
    lines.push('');
    lines.push('| Location | Severity | Issue |');
    lines.push('|----------|----------|-------|');

    for (const point of inferencePoints) {
      for (const issue of point.issues || []) {
        const severity = issue.severity === 'critical' ? 'CRITICAL' : issue.severity === 'warning' ? 'WARNING' : 'INFO';
        lines.push(`| \`${point.file}:${point.line}\` | ${severity} | ${issue.headline} |`);
      }
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // High-priority insights
  const criticalInsights = insights.filter(i => i.severity === 'critical' || i.severity === 'warning');
  if (criticalInsights.length > 0) {
    lines.push('<details>');
    lines.push('<summary>Insights (' + criticalInsights.length + ')</summary>');
    lines.push('');
    for (const insight of criticalInsights.slice(0, 5)) {
      const severity = insight.severity === 'critical' ? 'CRITICAL' : 'WARNING';
      lines.push(`- **[${severity}] ${insight.title}**: ${insight.description}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Enhancement prompts (collapsed)
  if (showEnhancementPrompts) {
    const prompts = getEnhancementPrompts(layersUsed, summary.totalOptimizations > 0);
    if (prompts.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Enhance Your Analysis</summary>');
      lines.push('');
      for (const prompt of prompts) {
        lines.push(`**Add ${prompt.layer}:** ${prompt.message}`);
        lines.push('```yaml');
        lines.push(prompt.workflowSnippet);
        lines.push('```');
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  if (credits) {
    lines.push(`*Credits: ${credits.consumed} used | ${credits.remaining} remaining | [PeakInfer](https://peakinfer.com)*`);
  } else {
    lines.push('*[PeakInfer](https://peakinfer.com)*');
  }

  return lines.join('\n');
}

function findTopIssue(inferencePoints: InferencePoint[]): (Issue & { location: string }) | null {
  for (const point of inferencePoints) {
    for (const issue of point.issues || []) {
      if (issue.severity === 'critical') {
        return { ...issue, location: `${point.file}:${point.line}` };
      }
    }
  }
  for (const point of inferencePoints) {
    for (const issue of point.issues || []) {
      if (issue.severity === 'warning') {
        return { ...issue, location: `${point.file}:${point.line}` };
      }
    }
  }
  return null;
}

function generateExhaustedComment(
  valueDelivered: { prsAnalyzed: number; criticalCaught: number; estimatedSavings: number },
  unchecked: { files: number; estimatedPoints: number }
): string {
  return [
    '## [PAUSED] PeakInfer: Analysis Paused',
    '',
    '**Value Delivered This Month:**',
    `- ${valueDelivered.prsAnalyzed} PRs analyzed`,
    `- ${valueDelivered.criticalCaught} critical issues caught before production`,
    `- $${valueDelivered.estimatedSavings.toLocaleString()} estimated savings`,
    '',
    '**Unchecked:**',
    `- ${unchecked.files} files with ~${unchecked.estimatedPoints} inference points`,
    '',
    '[Add Credits](https://peakinfer.com/pricing)',
    '',
    '---',
    '*[PeakInfer](https://peakinfer.com)*',
  ].join('\n');
}

function generateSkipComment(): string {
  return [
    '## [SKIP] PeakInfer: No LLM Code',
    '',
    'No LLM inference points detected in the changed files.',
    '',
    'PeakInfer analyzes: OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google Vertex, vLLM, LangChain, LlamaIndex',
    '',
    '---',
    '*[PeakInfer](https://peakinfer.com)*',
  ].join('\n');
}

function generateErrorComment(error: string, hint?: string): string {
  const lines = [
    '## [ERROR] PeakInfer: Analysis Failed',
    '',
    `**Error:** ${error}`,
  ];

  if (hint) {
    lines.push('');
    lines.push(`**Hint:** ${hint}`);
  }

  lines.push('');
  lines.push('If this persists, please [report an issue](https://github.com/Kalmantic/peakinfer-action/issues).');
  lines.push('');
  lines.push('---');
  lines.push('*[PeakInfer](https://peakinfer.com)*');

  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function run(): Promise<void> {
  try {
    // Parse inputs
    const inputs: ActionInputs = {
      path: core.getInput('path') || './src',
      // Auth
      peakinferToken: core.getInput('peakinfer-token') || process.env.PEAKINFER_TOKEN || '',
      githubToken: core.getInput('github-token') || process.env.GITHUB_TOKEN || '',
      // Layer 1: Runtime
      runtimeSource: core.getInput('runtime-source') || undefined,
      runtimeApiKey: core.getInput('runtime-api-key') || undefined,
      eventsFile: core.getInput('events-file') || undefined,
      eventsMap: core.getInput('events-map') || undefined,
      // Layer 2: Benchmarks
      includeBenchmarks: core.getInput('include-benchmarks') !== 'false',
      benchmarkFramework: core.getInput('benchmark-framework') || 'api',
      // Layer 3: Evals
      evalsSource: core.getInput('evals-source') || undefined,
      evalsApiKey: core.getInput('evals-api-key') || undefined,
      // Behavior
      failOnCritical: core.getInput('fail-on-critical') === 'true',
      commentMode: (core.getInput('comment-mode') || 'always') as ActionInputs['commentMode'],
      showEnhancementPrompts: core.getInput('show-enhancement-prompts') !== 'false',
    };

    // 1. Auth check
    if (!inputs.peakinferToken) {
      core.setFailed('Authentication required. Provide peakinfer-token via secrets.PEAKINFER_TOKEN.');
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

    // 2. Parse layer config
    const layers: LayerConfig = {
      code: { enabled: true },
      runtime: {
        enabled: !!(inputs.runtimeSource || inputs.eventsFile),
        source: inputs.runtimeSource,
        apiKey: inputs.runtimeApiKey,
        eventsFile: inputs.eventsFile,
      },
      benchmarks: {
        enabled: inputs.includeBenchmarks,
        framework: inputs.benchmarkFramework,
      },
      evals: {
        enabled: !!inputs.evalsSource,
        source: inputs.evalsSource,
        apiKey: inputs.evalsApiKey,
      },
    };

    core.info(`Layers: Code ✓ | Runtime ${layers.runtime.enabled ? '✓' : '○'} | Benchmarks ${layers.benchmarks.enabled ? '✓' : '○'} | Evals ${layers.evals.enabled ? '✓' : '○'}`);

    // 3. Collect files
    core.info(`Analyzing path: ${inputs.path}`);
    const files = collectFiles(inputs.path);
    core.info(`Found ${files.length} files to analyze`);

    if (files.length === 0) {
      core.warning('No supported files found for analysis');
      if (inputs.commentMode !== 'never') {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: generateSkipComment(),
        });
      }
      core.setOutput('verdict', 'SKIP');
      core.setOutput('inference-points', 0);
      return;
    }

    // 4. Call API
    core.info('Calling PeakInfer API...');
    const response = await callAnalysisAPI(inputs.peakinferToken, files, { repo, prNumber, sha }, layers);

    // 5. Handle errors
    if ('error' in response) {
      if (response.code === 'CREDIT_EXHAUSTED') {
        core.warning('Credit limit reached');

        // Fetch real org stats from the API
        let valueDelivered = { prsAnalyzed: 0, criticalCaught: 0, estimatedSavings: 0 };
        const stats = await fetchOrgStats(inputs.peakinferToken);
        if (stats) {
          valueDelivered = {
            prsAnalyzed: stats.prsAnalyzed,
            criticalCaught: stats.criticalCaught,
            estimatedSavings: stats.estimatedSavings,
          };
        }

        const comment = generateExhaustedComment(
          valueDelivered,
          { files: files.length, estimatedPoints: files.length * 3 }
        );
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: comment,
        });
        core.setOutput('verdict', 'PAUSED');
        return;
      }
      core.setFailed(`API error: ${response.error}`);
      if (inputs.commentMode !== 'never') {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: generateErrorComment(response.error, response.hint),
        });
      }
      core.setOutput('verdict', 'ERROR');
      return;
    }

    const { analysis, credits } = response;
    core.info(`Analysis complete: ${analysis.summary.totalInferencePoints} inference points`);

    // 6. Calculate verdict
    const issueCounts = countIssues(analysis.inferencePoints);
    const verdict = calculateVerdict(
      issueCounts.critical,
      issueCounts.warnings,
      analysis.summary.totalInferencePoints > 0,
      false, // Not exhausted if we got here
      false  // No error if we got here
    );

    // 7. Post PR comment
    if (inputs.commentMode === 'always' || (inputs.commentMode === 'on-issues' && (issueCounts.critical > 0 || issueCounts.warnings > 0))) {
      const comment = generateComment(analysis, verdict, credits, inputs.showEnhancementPrompts);
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: comment,
      });
    }

    // 8. Set outputs
    const driftCount = analysis.drifts?.length || 0;
    core.setOutput('verdict', verdict);
    core.setOutput('inference-points', analysis.summary.totalInferencePoints);
    core.setOutput('critical-count', issueCounts.critical);
    core.setOutput('warning-count', issueCounts.warnings);
    core.setOutput('drift-count', driftCount);
    core.setOutput('layers-used', analysis.layersUsed.join(','));
    if (credits) {
      core.setOutput('credits-used', credits.consumed);
      core.setOutput('credits-remaining', credits.remaining);
    }

    // 9. Fail if critical issues and configured to do so
    if (inputs.failOnCritical && issueCounts.critical > 0) {
      core.setFailed(`Found ${issueCounts.critical} critical issues`);
    }

  } catch (error) {
    core.setOutput('verdict', 'ERROR');
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
