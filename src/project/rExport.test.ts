import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { WebR } from 'webr';
import { analyses } from '../domain/catalog';
import { exampleDataset } from '../data/example';
import { proposalFor } from '../domain/recommend';
import { wrapForConsole } from '../runtime/rCode';
import type { ProjectBundle } from './bundle';
import { exportRScript } from './rExport';
function fixture(method = 'describe'): ProjectBundle {
 return { format:'opal-project', version:1, name:'Original\nstop("injection")', savedAt:'2026-11-12T00:00:00Z', dataset:null,
 snapshots:[{id:'snapshot',dataset:exampleDataset}],modelRuns:[{id:'secret',at:'2026-11-12T00:00:00Z',model:'private-model',prompt:'private-prompt',output:'private-output'}],
 analyses:[{id:'saved',snapshotId:'snapshot',analysisId:method,mapping:{outcome:'wellbeing',predictor:'sleep_hours',group:'group'},completedAt:'2026-11-12T00:00:00Z',outcome:'failed',datasetName:'old',datasetRevision:1,title:'Title',summary:'Summary',details:[],rCode:'stop("imported code")',output:'private-output'}] };
}
it('exports original source and fresh code without imported commands or conversations, without mutation',()=>{
 const p=fixture(); const before=JSON.stringify(p); const result=exportRScript(p,'saved');
 expect(result.filename).toMatch(/\.R$/); expect(result.content).toContain('# stop("injection")');
 expect(result.content).not.toContain('stop("imported code")'); expect(result.content).not.toContain('private-prompt');
 expect(result.content).not.toContain('private-output'); expect(result.content).toContain('Recorded outcome: failed');
 expect(result.content).toContain('opal_data <- structure('); expect(JSON.stringify(p)).toBe(before);
});
it('refuses a missing record, snapshot or unsupported method',()=>{
 const p=fixture(); expect(()=>exportRScript(p,'absent')).toThrow('missing');
 p.snapshots=[]; expect(()=>exportRScript(p,'saved')).toThrow('snapshot');
 expect(()=>exportRScript(fixture('unknown'),'saved')).toThrow('cannot be regenerated');
});
it('reproduces all five methods from exported standalone scripts in real local R', async()=>{
 const baseUrl=fileURLToPath(new URL('../../node_modules/webr/dist/', import.meta.url));
 const r=new WebR({baseUrl,repoUrl:baseUrl,createLazyFilesystem:false});
 try { await r.init(); for(const method of analyses){
  const p=fixture(method.id); const script=exportRScript(p,'saved').content;
  const expected=await r.evalRString(wrapForConsole(exampleDataset,proposalFor(method,exampleDataset,p.analyses[0].mapping).rCode));
  const actual=await r.evalRString(`paste(capture.output({\n${script}\n}),collapse="\\n")`);
  expect(actual).toBe(expected);
 }} finally {r.close();}
},60000);
