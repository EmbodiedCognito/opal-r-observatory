import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { WebR } from 'webr';
import { exampleDataset } from '../data/example';
import { analyses } from '../domain/catalog';
import { proposalFor } from '../domain/recommend';
import { wrapForConsole } from '../runtime/rCode';
import { parseProject, serializeProject, type ProjectBundle } from './bundle';

it('reopens a recorded source and reproduces all five analyses in real local R with fresh generated code', async () => {
  const baseUrl = fileURLToPath(new URL('../../node_modules/webr/dist/', import.meta.url));
  const runtime = new WebR({ baseUrl, repoUrl: baseUrl, createLazyFilesystem: false });
  try {
    await runtime.init();
    for (const analysis of analyses) {
      const mapping = { outcome: 'wellbeing', predictor: 'sleep_hours', group: 'group' };
      const plan = proposalFor(analysis, exampleDataset, mapping);
      const output = await runtime.evalRString(wrapForConsole(exampleDataset, plan.rCode));
      expect(output.trim().length).toBeGreaterThan(10);
      const project: ProjectBundle = {
        format: 'opal-project', version: 1, name: 'Replay', savedAt: new Date().toISOString(), dataset: exampleDataset,
        snapshots: [{ id: 'original', dataset: exampleDataset }], modelRuns: [],
        analyses: [{ id: 'result', snapshotId: 'original', analysisId: analysis.id, mapping, completedAt: new Date().toISOString(), outcome: 'completed', datasetName: exampleDataset.name, datasetRevision: 1, title: analysis.name, summary: 'Completed', details: [], output, rCode: plan.rCode, runtime: `webR ${runtime.version}` }],
      };
      const reopened = parseProject(serializeProject(project));
      const record = reopened.analyses[0];
      // Imported code is not the rerun input. Even tampering with it cannot change fresh generated execution.
      record.rCode = 'stop("imported code must not execute")';
      const source = reopened.snapshots.find(item => item.id === record.snapshotId)!.dataset;
      const freshPlan = proposalFor(analysis, source, record.mapping);
      const replay = await runtime.evalRString(wrapForConsole(source, freshPlan.rCode));
      expect(replay).toBe(output);
    }
  } finally { runtime.close(); }
}, 30000);
