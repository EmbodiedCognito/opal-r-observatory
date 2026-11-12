import { describe, expect, it } from 'vitest';
import { exampleDataset } from '../data/example';
import type { ProjectBundle } from './bundle';
import { MAX_RECOVERY_BYTES, RECOVERY_KEY, readRecovery, writeRecovery } from './recovery';

function fixture(): ProjectBundle {
  return { format: 'opal-project', version: 1, name: 'Unsaved pilot', savedAt: new Date().toISOString(), dataset: structuredClone(exampleDataset), snapshots: [], analyses: [], modelRuns: [] };
}
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('per-tab project recovery', () => {
  it('recovers changed name and rows after a simulated reload without restoring approval', () => {
    const store = storage(); const p = fixture(); p.dataset!.rows[0].wellbeing = 77;
    expect(writeRecovery(p, store)).toContain('Current project');
    expect(readRecovery(store).project).toEqual(p);
    expect(readRecovery(store).project).not.toHaveProperty('proposal');
  });
  it('retains prior valid recovery when quota rejects a new copy', () => {
    const store = storage(); const previous = fixture(); writeRecovery(previous, store);
    const next = fixture(); next.name = 'Later work';
    const rejecting = { ...store, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(writeRecovery(next, rejecting)).toContain('previous copy may be older');
    expect(readRecovery(store).project).toEqual(previous);
  });
  it('does not overwrite invalid recovery on read', () => {
    const store = storage(); store.data.set(RECOVERY_KEY, '{damaged');
    expect(readRecovery(store).blocked).toBe(true);
    expect(store.data.get(RECOVERY_KEY)).toBe('{damaged');
  });
  it('warns for oversized work while preserving older copy', () => {
    const store = storage(); const previous = fixture(); writeRecovery(previous, store);
    const next = fixture(); next.dataset!.rows[0].participant_id = 'x'.repeat(MAX_RECOVERY_BYTES);
    expect(writeRecovery(next, store)).toContain('2 MB');
    expect(readRecovery(store).project).toEqual(previous);
  });
  it('handles unavailable storage without crashing the app', () => {
    const store = { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } };
    expect(readRecovery(store).blocked).toBe(true);
    expect(writeRecovery(fixture(), store)).toContain('Could not update');
  });
  it('a clean tab starts empty', () => {
    expect(readRecovery(storage())).toEqual({ project: null, blocked: false, message: '' });
  });
});
