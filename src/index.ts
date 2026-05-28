// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bvasilenko
export { VbrandSchema, SCHEMA_FILENAME } from './schema.js';
export type { BrandOs } from './schema.js';

export { runInit } from './commands/init.js';
export type { InitOptions, InitResult } from './commands/init.js';

export { runEmit } from './commands/emit.js';
export type { EmitOptions, EmitResult } from './commands/emit.js';

export { runClassify } from './commands/classify.js';
export type { ClassifyOptions } from './commands/classify.js';

export { runAudit } from './commands/audit.js';
export type { AuditOptions, AuditResult } from './commands/audit.js';

export type { ClassifiedNode, ClassifyReport, NodeRole } from './lib/html.js';
