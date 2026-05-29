// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
export { VbrandSchema, SCHEMA_FILENAME } from './schema.js';
export type { VbrandType, BrandOs, FusePolicyHint, ThemeMode } from './schema.js';

export { runPull } from './commands/pull.js';
export type { PullOptions, PullResult } from './commands/pull.js';

export { runFuse } from './commands/fuse.js';
export type { FuseOptions, FuseResult } from './commands/fuse.js';

export { runEmit } from './commands/emit.js';
export type { EmitOptions, EmitResult, EmitTarget } from './commands/emit.js';

export { runAudit } from './commands/audit.js';
export type { AuditOptions, AuditResult } from './commands/audit.js';

export { runPublish } from './commands/publish.js';
export type { PublishOptions, PublishResult, PublishAs } from './commands/publish.js';

export { loadSchema, writeSchema } from './lib/schema-io.js';
export { detectPI } from './lib/pi-detect.js';
export type { PIFinding } from './lib/pi-detect.js';
export { runScrubGate, loadScrubPatterns } from './lib/scrub-gate.js';
export type { ScrubFinding } from './lib/scrub-gate.js';
export { parseLocator } from './lib/pull/locator.js';
export type { Locator, LocatorType } from './lib/pull/locator.js';
export { CandidateDocSchema } from './lib/pull/candidate-schema.js';
export type { CandidateDoc, CandidateFields, DegradationEntry, AssetProvenance } from './lib/pull/candidate-schema.js';
export type { CandidateField, ConfidenceLevel } from './lib/pull/confidence.js';
export { highField, mediumField, lowField, noneField, confidenceAtLeast } from './lib/pull/confidence.js';
export { sourceToSlug } from './lib/pull/slug.js';
export { buildCandidateDoc, emptyFields } from './lib/pull/candidate.js';
export { stripEnvelopes } from './lib/fuse/candidate-reader.js';
export { loadCandidateDoc, writeCandidateDoc } from './lib/schema-io.js';
export { mergePatch, applyMergePatchSequence } from './lib/fuse/merge-patch.js';
export { applyStrategy } from './lib/fuse/strategies.js';
export type { FuseStrategy } from './lib/fuse/strategies.js';
export { buildRegistryItem } from './lib/publish/registry-item.js';
export type { RegistryItem } from './lib/publish/registry-item.js';
export { buildDtcgBundle, DTCG_EXPERIMENTAL_NOTICE } from './lib/publish/dtcg-bundle.js';
export { minorLineFloor } from './lib/publish/semver-floor.js';
export type { VoiceProvider } from './lib/voice/provider.js';
export {
  createOpenAICompatibleProvider,
  createVoiceProviderFromEnv,
} from './lib/voice/provider.js';

export { checkContrast, wcagContrastRatio, apcaLcContrast } from './lib/audit/contrast.js';
export type { ContrastResult, WcagGrade } from './lib/audit/contrast.js';
export { runContrastCheck } from './lib/audit/contrast-runner.js';
export type { ContrastFinding } from './lib/audit/contrast-runner.js';
export { runMarksGeometry } from './lib/audit/marks-geometry.js';
export type { MarksFinding } from './lib/audit/marks-geometry.js';
export { validateFixtureFile, validateFixtureDir } from './lib/fixture-validator.js';
export type { FixtureValidationReport, FixtureError } from './lib/fixture-validator.js';
