/**
 * PeakInfer GitHub Action v1.9.7
 *
 * Thin API client that calls peakinfer.com for analysis.
 * All analysis logic runs server-side - this action only:
 * 1. Collects files from the repository
 * 2. Sends them to the PeakInfer API
 * 3. Posts results as PR comments with layer status
 *
 * v1.9.7 Changes:
 * - Show ALL issues with their solutions (not just top issue)
 * - Remove hardcoded limits on insights, drifts, and benchmarks
 * - Improved PR output format with severity-grouped issues
 */
export {};
