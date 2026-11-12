import { useRef, useState } from 'react';
import { MAX_PROJECT_BYTES, filename, parseProject, serializeProject, type ProjectBundle, type SavedAnalysis } from './bundle';
import './project.css';
import { exportRScript } from './rExport';

export default function ProjectPanel({ project, busy, onOpen, onName, onRestore, onRemoveRun, onExport, recoveryStatus }: {
  project: ProjectBundle; recoveryStatus: string; busy: boolean; onOpen: (project: ProjectBundle) => void;
  onName: (name: string) => void; onRestore: (analysis: SavedAnalysis) => void;
  onRemoveRun: (id: string) => void; onExport: (project: ProjectBundle) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<ProjectBundle | null>(null);
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<SavedAnalysis | null>(null);
  const [restoreReady, setRestoreReady] = useState(false);
  const [replaceReady, setReplaceReady] = useState(false);
  const readId = useRef(0);

  const save = () => {
    try {
      const body = serializeProject(project);
      const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename(project.name); a.click();
      onExport(project);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Project file prepared for download. Check that your browser saved it; canceling the download does not notify Opal. Keep it private: it includes data rows and any attached prompts and responses.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Project could not be saved.'); }
  };
  const saveR = (analysis: SavedAnalysis) => {
    try {
      const script = exportRScript(project, analysis.id);
      const url = URL.createObjectURL(new Blob([script.content], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = script.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('R script prepared. Check your browser saved it. It contains the original data and fresh commands for the recorded method, not imported code. Review it before running it in R. Your project has not changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'R script could not be exported.'); }
  };
  const read = async (file: File) => {
    const id = ++readId.current;
    setReading(true); setCandidate(null); setReplaceReady(false); setMessage('');
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 20 MB limit.');
      const parsed = parseProject(await file.text());
      if (id === readId.current) setCandidate(parsed);
    } catch (error) {
      if (id === readId.current) setMessage(error instanceof Error ? error.message : 'Project could not be opened.');
    } finally { if (id === readId.current) setReading(false); }
  };
  return <div className="panel-view project-panel">
    <div className="section-heading"><div><span className="eyebrow">PORTABLE WORK</span><h2>Keep your work. Pick up where you left off.</h2></div></div>
    <p>Save your dataset, measurement types, analysis results and source snapshots in one .opal file. Attached model runs travel with it. Nothing is uploaded or run when opening a file.</p>
    <label className="project-label">Project name<input value={project.name} maxLength={1000} onChange={e => onName(e.target.value)} /></label>
    <div className="project-actions">
      <button className="primary" disabled={busy || !project.name.trim()} onClick={save}>Save project file</button>
      <button className="secondary" disabled={busy || reading} onClick={() => input.current?.click()}>{reading ? 'Reading file…' : 'Open project file'}</button>
    </div>
    <input ref={input} hidden type="file" accept=".opal,application/json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void read(file); }} />
    <p className="project-note">Files contain raw data and attached model conversations. Store them securely. A local recovery copy (up to 2 MB) is kept in this browser tab to recover from reloads. It includes your data and attached conversations and is not a durable backup. Save a file before closing; tab closure, cleared browser data or device shutdown can remove recovery. A close warning is requested but may not appear. Model catalogue records and weights are not included.</p>
    <p className="project-note" role="status">{recoveryStatus}</p>
    {busy && <p role="status">An R analysis is running. Save and open will be available when it finishes.</p>}
    {message && <p role="status" className="project-message">{message}</p>}
    {candidate && <section className="project-review" aria-label="Review project import">
      <h3>Open “{candidate.name}”?</h3>
      <p>{candidate.dataset?.rows.length ?? 0} current rows · {candidate.analyses.length} recorded analyses · {candidate.modelRuns.length} model runs. Saved {new Date(candidate.savedAt).toLocaleString()}.</p>
      <p>Opening replaces this tab’s current project, including its results. Save your current project first if you want to keep it. Imported results are recorded claims, not independently verified results.</p>
      <label><input type="checkbox" checked={replaceReady} onChange={e => setReplaceReady(e.target.checked)} /> I have saved any current work I want to keep.</label>
      <div className="project-actions"><button className="primary" disabled={busy || !replaceReady} onClick={() => { onOpen(candidate); setRestoreCandidate(null); setCandidate(null); setReplaceReady(false); setMessage('Project opened. Recorded code remains inert. Restore an analysis setup and approve a newly generated plan to run it again.'); }}>Open and replace current project</button>
      <button className="secondary" onClick={() => { ++readId.current; setCandidate(null); setReplaceReady(false); }}>Cancel</button></div>
    </section>}
    <h3>Analysis history</h3>
    {!project.analyses.length && <p>Run an approved analysis to keep its data snapshot, code and result together.</p>}
    {project.analyses.map(analysis => <article className="project-record" key={analysis.id}>
      <strong>{analysis.title}</strong><p>{analysis.datasetName} · {analysis.outcome} · {new Date(analysis.completedAt).toLocaleString()}</p>
      <button className="secondary" disabled={busy} onClick={() => { setRestoreCandidate(analysis); setRestoreReady(false); }}>Restore setup for {analysis.title}</button>
      <button className="secondary" disabled={busy} onClick={() => saveR(analysis)}>Export R rerun for {analysis.title}</button>
      <p className="project-note">R export includes original data and newly generated commands for running outside Opal. It does not run anything or save current project changes.</p>
      <p className="project-note">Restores the recorded source data and mapping. You review and approve fresh generated code before another run.</p>
    </article>)}
    {restoreCandidate && <section className="project-review" aria-label="Review analysis restore">
      <h3>Restore {restoreCandidate.title}?</h3>
      <p>This replaces your current dataset with the saved source “{restoreCandidate.datasetName}”. Your analysis history and attached model runs stay in the project. Save your current project first if it contains data you want to keep.</p>
      <label><input type="checkbox" checked={restoreReady} onChange={e => setRestoreReady(e.target.checked)} /> I have saved any current data I want to keep.</label>
      <div className="project-actions"><button className="primary" disabled={busy || !restoreReady} onClick={() => { onRestore(restoreCandidate); setRestoreCandidate(null); }}>Restore data and settings</button><button className="secondary" onClick={() => setRestoreCandidate(null)}>Cancel restore</button></div>
    </section>}
    <h3>Attached model runs</h3>
    <p>In Models, choose “Attach to project” on the saved runs you want to include. These are project references, not claims that a model analysed your dataset.</p>
    {project.modelRuns.map(run => <article className="project-record" key={run.id}>
      <strong>{run.model}</strong><small>{new Date(run.at).toLocaleString()}</small>
      <details><summary>Prompt and response</summary><p>{run.prompt}</p><pre>{run.output}</pre></details>
      <button className="secondary" onClick={() => onRemoveRun(run.id)}>Remove from this project</button>
    </article>)}
  </div>;
}
