import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  Dices,
  FileUp,
  FlaskConical,
  Package,
  Play,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { analyses } from "./domain/catalog";
import { inferVariable, proposalFor, recommendAnalyses } from "./domain/recommend";
import { exampleDataset } from "./data/example";
import {
  generateSyntheticDataset,
  syntheticTemplates,
  type SyntheticOptions,
  type SyntheticTemplate,
  type SyntheticVariableSpec,
} from "./data/synthetic";
import { runAnalysis } from "./runtime/webr";
import type { AnalysisDefinition, AnalysisMapping, AnalysisResult, Dataset, Proposal } from "./types";
import "./styles.css";

type View = "workspace" | "data" | "results" | "r";

const emptyGuidance =
  "Import data or open the example project. I’ll work from the structure of your variables and the question you want to answer.";

const starterVariables: SyntheticVariableSpec[] = [
  { id: "id", name: "participant_id", type: "identifier", distribution: "uniform", mean: 0, spread: 1, min: 1, max: 100, categories: [] },
  { id: "group", name: "group", type: "categorical", distribution: "uniform", mean: 0, spread: 1, min: 0, max: 1, categories: ["control", "treatment"] },
  { id: "score", name: "score", type: "continuous", distribution: "normal", mean: 50, spread: 10, min: 0, max: 100, categories: [] },
];

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [view, setView] = useState<View>("workspace");
  const [selected, setSelected] = useState<AnalysisDefinition | null>(null);
  const [mapping, setMapping] = useState<AnalysisMapping>({});
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [message, setMessage] = useState("");
  const [syntheticOpen, setSyntheticOpen] = useState(false);
  const [syntheticError, setSyntheticError] = useState("");
  const [synthetic, setSynthetic] = useState<SyntheticOptions>({
    template: "custom",
    rows: 120,
    seed: 42,
    effect: 0.65,
    noise: 1,
    missingness: 0,
    groups: 2,
    variables: starterVariables,
  });
  const [runtimeState, setRuntimeState] = useState<"idle" | "loading" | "running" | "ready" | "error">("idle");
  const fileInput = useRef<HTMLInputElement>(null);
  const recommended = useMemo(
    () => (dataset ? recommendAnalyses(dataset) : analyses.slice(0, 3)),
    [dataset],
  );
  const analysisReady = useMemo(() => {
    if (!selected || !dataset) return false;
    if (selected.id === "describe") return true;
    if (!mapping.outcome) return false;
    if (selected.id === "correlation" || selected.id === "regression") {
      return Boolean(mapping.predictor && mapping.predictor !== mapping.outcome);
    }
    return Boolean(mapping.group);
  }, [dataset, mapping, selected]);

  const loadExample = () => {
    setDataset(exampleDataset);
    setView("workspace");
    setMessage(
      "I found three continuous measures and one grouping variable. A group comparison or relationship model would be defensible starting points.",
    );
  };

  const loadSynthetic = () => {
    try {
      const generated = generateSyntheticDataset(synthetic);
      setDataset(generated);
      setSyntheticError("");
      setSyntheticOpen(false);
      setView("workspace");
      setMessage(
        `Generated ${generated.rows.length} synthetic observations with seed ${synthetic.seed}. This dataset is reproducible and for demonstration only.`,
      );
    } catch (error) {
      setSyntheticError(error instanceof Error ? error.message : "The synthetic schema could not be generated.");
    }
  };

  const updateSyntheticVariable = (id: string, patch: Partial<SyntheticVariableSpec>) => {
    setSynthetic({
      ...synthetic,
      variables: synthetic.variables.map((variable) => variable.id === id ? { ...variable, ...patch } : variable),
    });
  };

  const addSyntheticVariable = () => {
    const index = synthetic.variables.length + 1;
    setSynthetic({
      ...synthetic,
      variables: [...synthetic.variables, {
        id: crypto.randomUUID(),
        name: `variable_${index}`,
        type: "continuous",
        distribution: "normal",
        mean: 0,
        spread: 1,
        min: -4,
        max: 4,
        categories: [],
      }],
    });
  };

  const removeSyntheticVariable = (id: string) => {
    setSynthetic({ ...synthetic, variables: synthetic.variables.filter((variable) => variable.id !== id) });
  };

  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const variables = meta.fields?.map((name) =>
          inferVariable(
            name,
            data.map((row) => row[name]),
          ),
        );
        setDataset({ name: file.name, rows: data, variables: variables ?? [] });
        setMessage(
          `Imported ${data.length.toLocaleString()} rows. I inferred measurement types, but you should verify them before modelling.`,
        );
        setView("workspace");
      },
    });
  };

  const setVariableKind = (id: string, kind: Dataset["variables"][number]["kind"]) => {
    if (!dataset) return;
    setDataset({
      ...dataset,
      variables: dataset.variables.map((variable) => variable.id === id ? { ...variable, kind } : variable),
    });
    setSelected(null);
    setProposal(null);
    setMessage("Measurement type updated. Analysis recommendations have been recalculated.");
  };

  const chooseAnalysis = (analysis: AnalysisDefinition) => {
    setSelected(analysis);
    setProposal(null);
    if (dataset) {
      const continuous = dataset.variables.filter((variable) => variable.kind === "continuous");
      const categorical = dataset.variables.filter((variable) =>
        (variable.kind === "nominal" || variable.kind === "ordinal") &&
        (analysis.id !== "t-test" || variable.unique === 2),
      );
      setMapping({
        outcome: continuous[0]?.name,
        predictor: continuous[1]?.name ?? continuous[0]?.name,
        group: categorical[0]?.name,
      });
    }
    setMessage(
      dataset
        ? `Configure ${analysis.name} directly. I can explain the choices, but the controls remain yours.`
        : "Load a dataset first so I can map variables to this analysis.",
    );
  };

  const prepareAnalysis = () => {
    if (!selected || !dataset) return;
    setProposal(proposalFor(selected, dataset, mapping));
    setMessage(`Prepared a transparent ${selected.name} plan from your selected variables. Review the R code before running it.`);
  };

  const decideProposal = async (approved: boolean) => {
    if (!proposal || !selected || !dataset) return;
    setProposal({ ...proposal, status: approved ? "approved" : "rejected" });
    if (approved) {
      setView("results");
      setRuntimeState("loading");
      setMessage("Loading R into a private browser worker. The first run may take a moment.");
      try {
        setRuntimeState("running");
        const execution = await runAnalysis(dataset, proposal.rCode);
        setResults((current) => [
          {
            id: proposal.id,
            title: selected.name,
            summary: "Analysis completed locally",
            details: [
              "The approved R code ran inside this browser using WebAssembly.",
              "No dataset rows were uploaded to Opal or an agent service.",
              dataset.provenance?.note ?? "Imported data remained in this browser session.",
            ],
            rCode: proposal.rCode,
            output: execution.output,
            runtime: execution.runtime,
          },
          ...current,
        ]);
        setRuntimeState("ready");
        setMessage("Analysis complete. Review the output, generated R, and data provenance together.");
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setRuntimeState("error");
        setResults((current) => [
          {
            id: proposal.id,
            title: selected.name,
            summary: "R execution failed",
            details: [
              "Nothing was uploaded. The browser runtime returned an error.",
              reason,
            ],
            rCode: proposal.rCode,
          },
          ...current,
        ]);
        setMessage(`The local R runtime could not complete this analysis: ${reason}`);
      }
    } else {
      setMessage("Proposal rejected. Nothing was executed or changed.");
    }
  };

  const submitMessage = () => {
    if (!message.trim()) return;
    if (!dataset) {
      setMessage(emptyGuidance);
      return;
    }
    setMessage(
      "I can propose analyses from the current schema. Natural-language model reasoning will connect through the same approval boundary in the server-backed release.",
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><CircleDot size={18} /></div>
          <span>OPAL</span><small>R OBSERVATORY</small>
        </div>
        <div className="project-name"><span>PROJECT</span>{dataset?.name ?? "Untitled project"}</div>
        <nav aria-label="Primary navigation">
          {(["workspace", "data", "results", "r"] as View[]).map((item) => (
            <button
              className={view === item ? "active" : ""}
              key={item}
              onClick={() => setView(item)}
            >
              {item === "workspace" ? "Analyse" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <button className="package-button"><Package size={14} /> Packages</button>
        <div className={`runtime ${runtimeState}`}><span /> {runtimeState === "idle" ? "R on demand" : runtimeState}</div>
      </header>

      <main className="workspace-grid">
        <aside className="rail data-rail">
          <div className="rail-tabs"><button className="active">Variables</button><button>Analyses</button></div>
          {dataset ? (
            <div className="variable-list">
              <div className="dataset-meta">
                <Database size={17} />
                <div><strong>{dataset.name}</strong><span>{dataset.rows.length} rows · {dataset.variables.length} variables</span></div>
              </div>
              {dataset.variables.map((variable) => (
                <div className="variable" key={variable.id}>
                  <span className={`kind ${variable.kind}`}>{variable.kind[0].toUpperCase()}</span>
                  <span><strong>{variable.label}</strong><small>{variable.kind} · {variable.unique} unique</small></span>
                  <select aria-label={`${variable.label} measurement type`} value={variable.kind} onChange={(event) => setVariableKind(variable.id, event.target.value as Dataset["variables"][number]["kind"])}>
                    <option value="continuous">Continuous</option>
                    <option value="ordinal">Ordinal</option>
                    <option value="nominal">Nominal</option>
                    <option value="identifier">Identifier</option>
                  </select>
                </div>
              ))}
              <button className="secondary full" onClick={() => fileInput.current?.click()}>
                <FileUp size={14} /> Replace CSV
              </button>
              {dataset.provenance && <div className="synthetic-label"><Dices size={13} /> Synthetic · seed {dataset.provenance.seed}</div>}
            </div>
          ) : (
            <div className="empty-rail">
              <div className="orb small" />
              <strong>No dataset</strong>
              <p>Import a CSV or open the example project.</p>
              <button className="primary" onClick={() => fileInput.current?.click()}>Import CSV</button>
              <button className="secondary" onClick={loadExample}>Open example</button>
              <button className="secondary" onClick={() => setSyntheticOpen(true)}><Dices size={14} /> Generate synthetic</button>
            </div>
          )}
          <input
            hidden
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])}
          />
        </aside>

        <section className="canvas">
          {view === "workspace" && (
            <>
              {!dataset && (
                <div className="hero">
                  <div className="orb"><Sparkles size={20} /></div>
                  <span className="eyebrow">OPEN STATISTICAL WORKSPACE</span>
                  <h1>Map the question.<br /><em>Keep the machinery visible.</em></h1>
                  <p>Bring any dataset, work visually or directly in R, and consult Aster without surrendering control of the analysis.</p>
                  <div className="hero-actions">
                    <button className="primary" onClick={() => fileInput.current?.click()}><FileUp size={15} /> Import a dataset</button>
                    <button className="secondary" onClick={loadExample}><BookOpen size={15} /> Open example project</button>
                    <button className="secondary" onClick={() => setSyntheticOpen(true)}><Dices size={15} /> Generate synthetic</button>
                  </div>
                  <div className="trust-row"><span>Local-first data</span><span>Approval gates</span><span>Reproducible R</span></div>
                </div>
              )}
              {dataset && (
                <div className="analysis-workspace">
                  <div className="section-heading">
                    <div><span className="eyebrow">QUESTION MAP</span><h2>Choose the claim you want to examine.</h2></div>
                    <span className="schema-chip"><ShieldCheck size={14} /> Schema inferred locally</span>
                  </div>
                  <div className="analysis-grid">
                    {recommended.map((analysis) => (
                      <button
                        key={analysis.id}
                        className={`analysis-card ${selected?.id === analysis.id ? "selected" : ""}`}
                        onClick={() => chooseAnalysis(analysis)}
                      >
                        <span className="card-icon"><FlaskConical size={17} /></span>
                        <small>{analysis.family}</small>
                        <strong>{analysis.name}</strong>
                        <p>{analysis.question}</p>
                        <span className="card-link">Inspect method <ChevronRight size={13} /></span>
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <div className="analysis-controls">
                      <div><span className="eyebrow">DIRECT CONTROLS</span><h3>{selected.name}</h3><p>{selected.description}</p></div>
                      <div className="mapping-fields">
                        {selected.id !== "describe" && (
                          <label>Outcome
                            <select value={mapping.outcome ?? ""} onChange={(event) => setMapping({ ...mapping, outcome: event.target.value })}>
                              {dataset.variables.filter((variable) => variable.kind === "continuous").map((variable) => <option key={variable.id} value={variable.name}>{variable.label}</option>)}
                            </select>
                          </label>
                        )}
                        {(selected.id === "correlation" || selected.id === "regression") && (
                          <label>Predictor
                            <select value={mapping.predictor ?? ""} onChange={(event) => setMapping({ ...mapping, predictor: event.target.value })}>
                              {dataset.variables.filter((variable) => variable.kind === "continuous").map((variable) => <option key={variable.id} value={variable.name}>{variable.label}</option>)}
                            </select>
                          </label>
                        )}
                        {(selected.id === "t-test" || selected.id === "anova") && (
                          <label>Grouping variable
                            <select value={mapping.group ?? ""} onChange={(event) => setMapping({ ...mapping, group: event.target.value })}>
                              {dataset.variables.filter((variable) =>
                                (variable.kind === "nominal" || variable.kind === "ordinal") &&
                                (selected.id !== "t-test" || variable.unique === 2),
                              ).map((variable) => <option key={variable.id} value={variable.name}>{variable.label}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                      <button className="primary" disabled={!analysisReady} onClick={prepareAnalysis}><BracesIcon /> Prepare visible R plan</button>
                    </div>
                  )}
                  {proposal && (
                    <div className="proposal">
                      <div className="proposal-head">
                        <span><Sparkles size={15} /> ASTER PROPOSAL</span>
                        <span className={`status ${proposal.status}`}>{proposal.status}</span>
                      </div>
                      <h3>{proposal.title}</h3>
                      <p>{proposal.rationale}</p>
                      <pre><code>{proposal.rCode}</code></pre>
                      {proposal.status === "pending" && (
                        <div className="proposal-actions">
                          <button className="approve" disabled={runtimeState === "running" || runtimeState === "loading"} onClick={() => void decideProposal(true)}>
                            {runtimeState === "running" || runtimeState === "loading" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
                            Approve & run locally
                          </button>
                          <button className="reject" onClick={() => decideProposal(false)}><X size={15} /> Reject</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {view === "data" && (
            <div className="panel-view">
              <div className="section-heading"><div><span className="eyebrow">DATA</span><h2>Inspect before you infer.</h2></div></div>
              {dataset ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr>{dataset.variables.map((item) => <th key={item.id}>{item.name}<small>{item.kind}</small></th>)}</tr></thead>
                    <tbody>{dataset.rows.slice(0, 30).map((row, index) => <tr key={index}>{dataset.variables.map((item) => <td key={item.id}>{String(row[item.name] ?? "—")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : <EmptyState icon={<Database />} text="Load a dataset to inspect its rows and inferred measurement types." />}
            </div>
          )}

          {view === "results" && (
            <div className="panel-view">
              <div className="section-heading"><div><span className="eyebrow">RESULTS</span><h2>An auditable analysis trail.</h2></div></div>
              {results.length ? results.map((result) => (
                <article className="result-card" key={result.id}>
                  <div className="result-icon"><BarChart3 /></div>
                  <div><span className="eyebrow">APPROVED PLAN</span><h3>{result.title}</h3><strong>{result.summary}</strong>
                    <ul>{result.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                    {result.runtime && <span className="runtime-badge">{result.runtime}</span>}
                    {result.output && <div className="r-output"><span>R OUTPUT</span><pre>{result.output}</pre></div>}
                    <pre><code>{result.rCode}</code></pre>
                  </div>
                </article>
              )) : <EmptyState icon={<Activity />} text="Approved analyses and their reproducible code will appear here." />}
            </div>
          )}

          {view === "r" && (
            <div className="panel-view">
              <div className="section-heading"><div><span className="eyebrow">R CONSOLE</span><h2>Visible code, isolated execution.</h2></div></div>
              <div className="terminal">
                <div className="terminal-head"><TerminalSquare size={15} /> opal-session <span>{runtimeState === "idle" ? "starts on approval" : runtimeState}</span></div>
                <pre>{`# Opal records generated code here before execution.\n# Connect an isolated R adapter to enable evaluation.\n\n${proposal?.rCode ?? "opal_data <- read.csv(\"your-data.csv\")\nsummary(opal_data)"}`}</pre>
              </div>
              <div className="notice"><ShieldCheck size={18} /><p><strong>Local runtime boundary</strong>Approved, Opal-generated R runs in a WebAssembly worker inside the browser. Imported rows are not sent to Opal or Aster. Closing the tab discards the session.</p></div>
            </div>
          )}
        </section>

        <aside className="rail agent-rail">
          <div className="agent-title"><div className="agent-mark"><Sparkles size={17} /></div><div><small>ANALYTICAL CONSULTANT</small><strong>Aster</strong></div><span>ACTIVE</span></div>
          <div className="agent-state"><i /> {dataset ? `Reading ${dataset.variables.length} variables` : "Awaiting project"}</div>
          <div className="guidance">
            <small>CURRENT GUIDANCE</small>
            <h2>{dataset ? "Start from the claim." : "Begin anywhere."}</h2>
            <p>{message || emptyGuidance}</p>
          </div>
          <div className="quick-actions">
            {recommended.slice(0, 3).map((analysis) => (
              <button key={analysis.id} onClick={() => chooseAnalysis(analysis)}>
                {analysis.question}<ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="agent-input">
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about data, models or R…" />
            <button aria-label="Send" onClick={submitMessage}><Play size={14} /></button>
          </div>
          <p className="agent-note">Aster can propose actions. You approve every execution.</p>
        </aside>
      </main>
      {syntheticOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSyntheticOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="synthetic-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title"><Dices /><div><span className="eyebrow">SAFE STARTING POINT</span><h2 id="synthetic-title">Generate synthetic data</h2></div><button aria-label="Close" onClick={() => setSyntheticOpen(false)}><X /></button></div>
            <p>Build a reproducible fictional study for learning, demonstrations, and testing. Generated values are not evidence about any real population.</p>
            <div className="template-grid">
              {(Object.entries(syntheticTemplates) as [SyntheticTemplate, (typeof syntheticTemplates)[SyntheticTemplate]][]).map(([id, template]) => (
                <button className={synthetic.template === id ? "selected" : ""} key={id} onClick={() => setSynthetic({ ...synthetic, template: id })}>
                  <strong>{template.name}</strong><span>{template.description}</span>
                </button>
              ))}
            </div>
            {synthetic.template === "custom" ? (
              <div className="schema-builder">
                <div className="schema-heading"><span>VARIABLE SCHEMA</span><button onClick={addSyntheticVariable}><Plus size={13} /> Add variable</button></div>
                {synthetic.variables.map((variable) => (
                  <div className="schema-variable" key={variable.id}>
                    <input aria-label="Variable name" value={variable.name} onChange={(event) => updateSyntheticVariable(variable.id, { name: event.target.value })} />
                    <select aria-label={`${variable.name} type`} value={variable.type} onChange={(event) => updateSyntheticVariable(variable.id, { type: event.target.value as SyntheticVariableSpec["type"] })}>
                      <option value="identifier">Identifier</option>
                      <option value="continuous">Continuous</option>
                      <option value="integer">Integer</option>
                      <option value="categorical">Categorical</option>
                      <option value="binary">Binary</option>
                      <option value="ordinal">Ordinal</option>
                    </select>
                    {(variable.type === "continuous" || variable.type === "integer") && <>
                      <select aria-label={`${variable.name} distribution`} value={variable.distribution} onChange={(event) => updateSyntheticVariable(variable.id, { distribution: event.target.value as SyntheticVariableSpec["distribution"] })}>
                        <option value="normal">Normal</option>
                        <option value="uniform">Uniform</option>
                      </select>
                      {variable.distribution === "normal" && <>
                        <label>Mean<input type="number" value={variable.mean} onChange={(event) => updateSyntheticVariable(variable.id, { mean: Number(event.target.value) })} /></label>
                        <label>SD<input type="number" min="0.01" value={variable.spread} onChange={(event) => updateSyntheticVariable(variable.id, { spread: Number(event.target.value) })} /></label>
                      </>}
                      <label>Min<input type="number" value={variable.min} onChange={(event) => updateSyntheticVariable(variable.id, { min: Number(event.target.value) })} /></label>
                      <label>Max<input type="number" value={variable.max} onChange={(event) => updateSyntheticVariable(variable.id, { max: Number(event.target.value) })} /></label>
                    </>}
                    {(variable.type === "categorical" || variable.type === "ordinal" || variable.type === "binary") && (
                      <input className="categories" aria-label={`${variable.name} categories`} value={variable.categories.join(", ")} placeholder="Categories, separated by commas" onChange={(event) => updateSyntheticVariable(variable.id, { categories: event.target.value.split(",").map((item) => item.trim()) })} />
                    )}
                    {variable.type === "binary" && <label>Probability<input type="number" min="0" max="1" step="0.05" value={variable.mean} onChange={(event) => updateSyntheticVariable(variable.id, { mean: Number(event.target.value) })} /></label>}
                    <button className="delete-variable" aria-label={`Delete ${variable.name}`} disabled={synthetic.variables.length === 1} onClick={() => removeSyntheticVariable(variable.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="variable-preview"><span>VARIABLES</span>{syntheticTemplates[synthetic.template].variables.map((variable) => <code key={variable}>{variable}</code>)}</div>
            )}
            <label>Sample size <output>{synthetic.rows}</output><input type="range" min="20" max="1000" step="10" value={synthetic.rows} onChange={(event) => setSynthetic({ ...synthetic, rows: Number(event.target.value) })} /></label>
            <label>Seed <input type="number" min="1" max="999999" value={synthetic.seed} onChange={(event) => setSynthetic({ ...synthetic, seed: Number(event.target.value) })} /></label>
            {synthetic.template !== "custom" && <>
              <label>Groups <output>{synthetic.groups}</output><input type="range" min="2" max="3" step="1" value={synthetic.groups} onChange={(event) => setSynthetic({ ...synthetic, groups: Number(event.target.value) })} /></label>
              <label>Demonstration effect <output>{synthetic.effect.toFixed(2)}</output><input type="range" min="0" max="1.5" step="0.05" value={synthetic.effect} onChange={(event) => setSynthetic({ ...synthetic, effect: Number(event.target.value) })} /></label>
              <label>Random noise <output>{synthetic.noise.toFixed(2)}</output><input type="range" min="0.25" max="2" step="0.05" value={synthetic.noise} onChange={(event) => setSynthetic({ ...synthetic, noise: Number(event.target.value) })} /></label>
            </>}
            <label>Missing values <output>{Math.round(synthetic.missingness * 100)}%</output><input type="range" min="0" max="0.25" step="0.01" value={synthetic.missingness} onChange={(event) => setSynthetic({ ...synthetic, missingness: Number(event.target.value) })} /></label>
            <div className="modal-note"><ShieldCheck size={16} /> Generated locally · deterministic seed · explicitly labelled synthetic</div>
            {syntheticError && <div className="modal-error" role="alert">{syntheticError}</div>}
            <button className="primary modal-submit" onClick={loadSynthetic}><Dices size={15} /> Generate dataset</button>
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="large-empty">{icon}<p>{text}</p></div>;
}

function BracesIcon() {
  return <span aria-hidden="true" className="braces-icon">{"{R}"}</span>;
}
