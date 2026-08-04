export type {
  Category,
  Finding,
  RuleResult,
  RuleStatus,
  RunResult,
  RunSummary,
  RunTarget,
  Severity,
  SpecVersion,
} from './types';
export { STABLE_SPEC_VERSION } from './types';

export type { Rule, RuleContext } from './rule';
export { finding, SkipRule } from './rule';

export { rulesForSpecVersion, allRules } from './registry';

export { runSuite, runRules, summarizeResults, computeExitCode } from './runner';
export type { RunSuiteOptions } from './runner';

export { connectStdio, connectHttp, connectTarget } from './transports/index';
export { TargetConnectionError } from './transports/errors';
export type { StderrSnapshot } from './transports/stderr';
export type {
  ConnectedClient,
  ConnectTarget,
  HttpTargetConfig,
  StdioTargetConfig,
  TransportInfo,
} from './transports/index';

// Regression / golden-set engine (M2).
export { recordGoldens } from './golden/record';
export { runRegression } from './golden/regress';
export { readGoldenSet, writeGoldenSet, GoldenError } from './golden/io';
export { stableStringify } from './golden/serialize';
export {
  BUILTIN_NORMALIZER_NAMES,
  applyNormalizers,
  normalizerName,
  suggestNormalizer,
} from './golden/normalize';
export type { NormalizerFn, NormalizerObject, NormalizerRef } from './golden/normalize';
export { applyAtPath, parsePath } from './golden/path';
export type { PathSegment } from './golden/path';
export { compareJsonValues } from './golden/sort';
export {
  IGNORED_PLACEHOLDER,
  buildPipeline,
  describePipeline,
  effectivePipelineSpec,
} from './golden/pipeline';
export type { PipelineSpec } from './golden/pipeline';
export type { GoldenCaseSpec, GoldenConfig, GoldenToolSpec } from './golden/config';
export {
  GOLDEN_FORMAT_VERSION,
  GoldenManifestSchema,
  GoldenRecordingSchema,
  RegressionDetailSchema,
} from './golden/format';
export type {
  FieldDiff,
  GoldenCase,
  GoldenManifest,
  GoldenRecording,
  GoldenSet,
  RegressionDetail,
  RegressionKind,
} from './golden/format';

export { BRAND } from './brand';
