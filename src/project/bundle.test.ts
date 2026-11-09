import { describe, expect, it } from 'vitest';
import { exampleDataset } from '../data/example';
import { filename, parseProject, serializeProject, validateDataset, projectContent, warnBeforeClosing, type ProjectBundle } from './bundle';

function fixture(): ProjectBundle {
  const dataset = structuredClone(exampleDataset);
  return {
    format: 'opal-project', version: 1, name: 'Pilot α', savedAt: '2026-11-09T12:00:00.000Z', dataset,
    snapshots: [{ id: 'source1', dataset: structuredClone(dataset) }],
    analyses: [{ id: 'analysis1', snapshotId: 'source1', analysisId: 'describe', mapping: {}, completedAt: '2026-11-09T12:00:00.000Z', outcome: 'completed', datasetName: dataset.name, datasetRevision: 1, title: 'Description', summary: 'Completed locally', details: ['Local data'], rCode: 'print(summary(opal_data))', output: 'Mean 56', runtime: 'webR 0.6.0' }],
    modelRuns: [{ id: 'run1', at: '2026-11-09T12:00:00.000Z', model: 'local/model', prompt: 'A controlled prompt', output: 'An answer' }],
  };
}
describe('portable projects', () => {
  it('round trips source data, measurement types, code, runtime, outputs and attached runs', () => {
    expect(parseProject(serializeProject(fixture()))).toEqual(fixture());
  });
  it('keeps immutable source snapshots distinct from current data', () => {
    const p = fixture(); p.dataset!.rows[0].wellbeing = 999;
    const restored = parseProject(serializeProject(p));
    expect(restored.snapshots[0].dataset.rows[0].wellbeing).toBe(42);
    expect(restored.dataset!.rows[0].wellbeing).toBe(999);
  });
  it('supports model-only projects and empty new projects', () => {
    const p = fixture(); p.dataset = null; p.snapshots = []; p.analyses = [];
    expect(parseProject(serializeProject(p)).modelRuns).toHaveLength(1);
    p.modelRuns = []; expect(parseProject(serializeProject(p)).dataset).toBeNull();
  });
  it('preserves leading-zero IDs, Unicode and nulls', () => {
    const p = fixture(); p.dataset!.rows[0].participant_id = '001'; p.dataset!.rows[1].group = '研究'; p.dataset!.rows[1].stress = null;
    expect(parseProject(serializeProject(p)).dataset).toEqual(p.dataset);
  });
  it('treats stored code and markup as inert strings, strips unknown execution and credential fields', () => {
    const p = fixture(); p.analyses[0].rCode = 'system("do not run")'; p.modelRuns[0].output = '<script>throw 1</script>';
    const input = { ...p, apiKey: 'not-a-real-key', approved: true };
    const restored = parseProject(JSON.stringify(input));
    expect(restored).not.toHaveProperty('apiKey'); expect(restored).not.toHaveProperty('approved');
    expect(restored.analyses[0].rCode).toContain('system');
  });
  it.each([
    ['unknown version', (p: ProjectBundle) => ({ ...p, version: 2 })],
    ['missing source', (p: ProjectBundle) => ({ ...p, snapshots: [] })],
    ['duplicate source', (p: ProjectBundle) => ({ ...p, snapshots: [...p.snapshots, ...p.snapshots] })],
    ['duplicate result', (p: ProjectBundle) => ({ ...p, analyses: [...p.analyses, ...p.analyses] })],
    ['duplicate run', (p: ProjectBundle) => ({ ...p, modelRuns: [...p.modelRuns, ...p.modelRuns] })],
    ['unknown method', (p: ProjectBundle) => ({ ...p, analyses: [{ ...p.analyses[0], analysisId: 'eval' }] })],
    ['missing mapped variable', (p: ProjectBundle) => ({ ...p, analyses: [{ ...p.analyses[0], mapping: { outcome: 'absent' } }] })],
    ['mismatched provenance', (p: ProjectBundle) => ({ ...p, analyses: [{ ...p.analyses[0], datasetName: 'wrong' }] })],
    ['invalid timestamp', (p: ProjectBundle) => ({ ...p, savedAt: 'not a date' })],
  ])('rejects %s without partially importing', (_, mutate) => {
    expect(() => parseProject(JSON.stringify(mutate(fixture())))).toThrow();
  });
  it('rejects malformed JSON and byte oversized input', () => {
    expect(() => parseProject('{broken')).toThrow();
    expect(() => parseProject('あ'.repeat(7 * 1024 * 1024))).toThrow('20 MB');
  });
  it('rejects duplicate columns, invalid measurement types, objects and nonfinite cells', () => {
    const d = structuredClone(exampleDataset);
    expect(() => validateDataset({ ...d, variables: [d.variables[0], d.variables[0]] })).toThrow();
    expect(() => validateDataset({ ...d, variables: [{ ...d.variables[0], kind: 'code' }] })).toThrow();
    expect(() => validateDataset({ ...d, rows: [{ participant_id: { malicious: true } }] })).toThrow();
    expect(() => validateDataset({ ...d, rows: [{ wellbeing: Infinity }] })).toThrow();
  });
  it('preserves a __proto__ column as an own data property without prototype pollution', () => {
    const d = { name: 'Adversarial names', variables: [{ id: 'x', name: '__proto__', label: 'x', kind: 'nominal', missing: 0, unique: 1 }], rows: [JSON.parse('{"__proto__":"value"}')] };
    const result = validateDataset(d);
    expect(Object.hasOwn(result.rows[0], '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result.rows[0])).toBe(Object.prototype);
    expect(result.rows[0].__proto__).toBe('value');
  });
  it('sanitizes filenames and has a fallback', () => {
    expect(filename('../../My project')).toBe('My-project.opal');
    expect(filename('💎')).toBe('Opal-project.opal');
  });
});

describe('unsaved-work protection', () => {
  it('ignores export timestamps but notices every persisted part of the project', () => {
    const original = fixture(); const baseline = projectContent(original);
    const next = fixture(); next.savedAt = '2026-11-10T12:00:00.000Z';
    expect(projectContent(next)).toBe(baseline);
    for (const mutate of [
      (p: ProjectBundle) => { p.name = 'Renamed'; },
      (p: ProjectBundle) => { p.dataset!.rows[0].wellbeing = 100; },
      (p: ProjectBundle) => { p.dataset!.variables[0].kind = 'nominal'; },
      (p: ProjectBundle) => { p.snapshots = []; },
      (p: ProjectBundle) => { p.analyses = []; },
      (p: ProjectBundle) => { p.modelRuns = []; },
    ]) { const changed = fixture(); mutate(changed); expect(projectContent(changed)).not.toBe(baseline); }
  });
  it('requests a standard browser close warning without custom message claims', () => {
    let prevented = false;
    const event = { preventDefault: () => { prevented = true; }, returnValue: true };
    warnBeforeClosing(event as unknown as BeforeUnloadEvent);
    expect(prevented).toBe(true); expect(event.returnValue).toBe('Unsaved project changes');
  });
});

it('bounds expanded cell count before sparse inputs can amplify into large allocations', () => {
  const sparse = {
    name: 'Sparse adversarial project',
    variables: Array.from({ length: 500 }, (_, i) => ({ id: String(i), name: String(i), label: String(i), kind: 'nominal', missing: 2001, unique: 0 })),
    rows: Array.from({ length: 2001 }, () => ({})),
  };
  expect(() => validateDataset(sparse)).toThrow('one-million-cell');
});
