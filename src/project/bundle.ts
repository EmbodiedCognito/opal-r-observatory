import type { AnalysisMapping, AnalysisResult, Dataset } from '../types';

export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_CELLS = 1000000;
export interface ModelRunRecord { id: string; at: string; model: string; prompt: string; output: string }
export interface DatasetSnapshot { id: string; dataset: Dataset }
export interface SavedAnalysis extends AnalysisResult {
  snapshotId: string;
  analysisId: string;
  mapping: AnalysisMapping;
  completedAt: string;
  outcome: 'completed' | 'failed';
}
export interface ProjectBundle {
  format: 'opal-project';
  version: 1;
  name: string;
  savedAt: string;
  dataset: Dataset | null;
  snapshots: DatasetSnapshot[];
  analyses: SavedAnalysis[];
  modelRuns: ModelRunRecord[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a project object.');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 1000000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid or oversized project text.');
  return value;
}
function nonempty(value: unknown): string {
  const text = string(value, 1000);
  if (!text.trim()) throw new Error('A project identifier is missing.');
  return text;
}
function integer(value: unknown, max = 100000): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new Error('Invalid project count.');
  return Number(value);
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid or oversized project collection.');
  return value;
}
function date(value: unknown): string {
  const text = string(value, 100);
  if (!Number.isFinite(Date.parse(text))) throw new Error('Invalid project timestamp.');
  return text;
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error('Duplicate project identifiers.');
}
export function validateDataset(value: unknown, budget = { remaining: MAX_PROJECT_CELLS }): Dataset {
  const input = object(value);
  const rowsInput = array(input.rows, 100000);
  const variables: Dataset['variables'] = array(input.variables, 500).map((value) => {
    const v = object(value);
    if (!['continuous', 'ordinal', 'nominal', 'identifier'].includes(String(v.kind))) throw new Error('Unknown measurement type.');
    return { id: nonempty(v.id), name: nonempty(v.name), label: string(v.label, 1000), kind: v.kind as Dataset['variables'][number]['kind'], missing: integer(v.missing, rowsInput.length), unique: integer(v.unique, rowsInput.length) };
  });
  if (!variables.length) throw new Error('A dataset needs at least one variable.');
  budget.remaining -= rowsInput.length * variables.length;
  if (budget.remaining < 0) throw new Error('Project exceeds the one-million-cell limit across current and saved source datasets.');
  unique(variables.map(v => v.id)); unique(variables.map(v => v.name));
  const names = new Set(variables.map(v => v.name));
  const rows = rowsInput.map(value => {
    const row = object(value);
    if (Object.keys(row).some(key => !names.has(key))) throw new Error('Data contains an undeclared column.');
    // Define properties rather than assigning them: even a column called __proto__ is inert data.
    return Object.fromEntries(variables.map(v => {
      const cell = Object.hasOwn(row, v.name) ? row[v.name] : null;
      if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number') throw new Error('Unsupported dataset cell.');
      if (typeof cell === 'number' && !Number.isFinite(cell)) throw new Error('Non-finite dataset cell.');
      if (typeof cell === 'string') string(cell);
      return [v.name, cell];
    })) as Dataset['rows'][number];
  });
  let provenance: Dataset['provenance'];
  if (input.provenance !== undefined) {
    const p = object(input.provenance);
    if (p.kind !== 'synthetic' || typeof p.seed !== 'number' || !Number.isFinite(p.seed)) throw new Error('Invalid dataset provenance.');
    provenance = { kind: 'synthetic', seed: p.seed, generator: string(p.generator, 1000), note: string(p.note) };
  }
  return { name: nonempty(input.name), rows, variables, ...(provenance ? { provenance } : {}) };
}
export function validateModelRun(value: unknown): ModelRunRecord {
  const r = object(value);
  return { id: nonempty(r.id), at: date(r.at), model: nonempty(r.model), prompt: string(r.prompt), output: string(r.output) };
}
export function parseProject(text: string): ProjectBundle {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 20 MB limit.');
  const input = object(JSON.parse(text));
  if (input.format !== 'opal-project' || input.version !== 1) throw new Error('Unsupported Opal project format or version.');
  const budget = { remaining: MAX_PROJECT_CELLS };
  const snapshots = array(input.snapshots, 1000).map(value => {
    const s = object(value);
    return { id: nonempty(s.id), dataset: validateDataset(s.dataset, budget) };
  });
  unique(snapshots.map(s => s.id));
  const analyses: SavedAnalysis[] = array(input.analyses, 1000).map(value => {
    const a = object(value);
    const snapshotId = nonempty(a.snapshotId);
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) throw new Error('An analysis is missing its source dataset.');
    const m = object(a.mapping);
    const mapping: AnalysisMapping = {};
    for (const key of ['outcome', 'predictor', 'group'] as const) if (m[key] !== undefined) {
      const name = nonempty(m[key]);
      if (!snapshot.dataset.variables.some(v => v.name === name)) throw new Error('An analysis references a missing variable.');
      mapping[key] = name;
    }
    if (!['describe', 'correlation', 't-test', 'anova', 'regression'].includes(String(a.analysisId))) throw new Error('Unsupported analysis method.');
    if (a.outcome !== 'completed' && a.outcome !== 'failed') throw new Error('Invalid analysis outcome.');
    const datasetName = nonempty(a.datasetName);
    if (datasetName !== snapshot.dataset.name) throw new Error('Analysis and source dataset names disagree.');
    return {
      id: nonempty(a.id), snapshotId, analysisId: String(a.analysisId), mapping,
      completedAt: date(a.completedAt), outcome: a.outcome,
      datasetName, datasetRevision: integer(a.datasetRevision, Number.MAX_SAFE_INTEGER),
      title: string(a.title, 1000), summary: string(a.summary),
      details: array(a.details, 100).map(d => string(d)), rCode: string(a.rCode),
      ...(a.output === undefined ? {} : { output: string(a.output) }),
      ...(a.runtime === undefined ? {} : { runtime: string(a.runtime, 1000) }),
    };
  });
  unique(analyses.map(a => a.id));
  const modelRuns = array(input.modelRuns, 1000).map(validateModelRun);
  unique(modelRuns.map(r => r.id));
  return { format: 'opal-project', version: 1, name: nonempty(input.name), savedAt: date(input.savedAt), dataset: input.dataset === null ? null : validateDataset(input.dataset, budget), snapshots, analyses, modelRuns };
}
export function serializeProject(project: ProjectBundle): string {
  // Validate exports too, so every saved file is one that this version can reopen.
  const text = JSON.stringify(parseProject(JSON.stringify(project)), null, 2);
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 20 MB limit.');
  return text;
}
export function filename(name: string): string {
  return (name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'Opal-project') + '.opal';
}

/** A stable content marker: export timestamps do not constitute new work. */
export function projectContent(project: ProjectBundle): string {
  return JSON.stringify({
    format: project.format, version: project.version, name: project.name,
    dataset: project.dataset, snapshots: project.snapshots,
    analyses: project.analyses, modelRuns: project.modelRuns,
  });
}

export function warnBeforeClosing(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Legacy browsers require returnValue as well as preventDefault.
  event.returnValue = 'Unsaved project changes';
}
