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
  FileUp,
  FlaskConical,
  Package,
  Play,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import { analyses } from "./domain/catalog";
import { inferVariable, proposalFor, recommendAnalyses } from "./domain/recommend";
import { exampleDataset } from "./data/example";
import type { AnalysisDefinition, AnalysisResult, Dataset, Proposal } from "./types";
import "./styles.css";

type View = "workspace" | "data" | "results" | "r";

const emptyGuidance =
  "Import data or open the example project. I’ll work from the structure of your variables and the question you want to answer.";

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [view, setView] = useState<View>("workspace");
  const [selected, setSelected] = useState<AnalysisDefinition | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const recommended = useMemo(
    () => (dataset ? recommendAnalyses(dataset) : analyses.slice(0, 3)),
    [dataset],
  );

  const loadExample = () => {
    setDataset(exampleDataset);
    setView("workspace");
    setMessage(
      "I found three continuous measures and one grouping variable. A group comparison or relationship model would be defensible starting points.",
    );
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

  const chooseAnalysis = (analysis: AnalysisDefinition) => {
    setSelected(analysis);
    setProposal(dataset ? proposalFor(analysis, dataset) : null);
    setMessage(
      dataset
        ? `I prepared a transparent ${analysis.name} proposal. Review the rationale and generated R before approving it.`
        : "Load a dataset first so I can map variables to this analysis.",
    );
  };

  const decideProposal = (approved: boolean) => {
    if (!proposal || !selected) return;
    setProposal({ ...proposal, status: approved ? "approved" : "rejected" });
    if (approved) {
      setResults((current) => [
        {
          id: proposal.id,
          title: selected.name,
          summary: "Execution plan approved",
          details: [
            "The browser prototype generated and recorded this reproducible R command.",
            "A production R adapter will execute it in an isolated, resource-limited session.",
            "No analysis was silently run and no data left this browser.",
          ],
          rCode: proposal.rCode,
        },
        ...current,
      ]);
      setView("results");
      setMessage(
        "Approved. The reproducible command is recorded. Runtime execution is deliberately disabled until the isolated R adapter is connected.",
      );
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
        <div className="runtime"><span /> R adapter</div>
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
                <button className="variable" key={variable.id}>
                  <span className={`kind ${variable.kind}`}>{variable.kind[0].toUpperCase()}</span>
                  <span><strong>{variable.label}</strong><small>{variable.kind} · {variable.unique} unique</small></span>
                </button>
              ))}
              <button className="secondary full" onClick={() => fileInput.current?.click()}>
                <FileUp size={14} /> Replace CSV
              </button>
            </div>
          ) : (
            <div className="empty-rail">
              <div className="orb small" />
              <strong>No dataset</strong>
              <p>Import a CSV or open the example project.</p>
              <button className="primary" onClick={() => fileInput.current?.click()}>Import CSV</button>
              <button className="secondary" onClick={loadExample}>Open example</button>
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
                          <button className="approve" onClick={() => decideProposal(true)}><Check size={15} /> Approve plan</button>
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
                <div className="terminal-head"><TerminalSquare size={15} /> opal-session <span>adapter offline</span></div>
                <pre>{`# Opal records generated code here before execution.\n# Connect an isolated R adapter to enable evaluation.\n\n${proposal?.rCode ?? "opal_data <- read.csv(\"your-data.csv\")\nsummary(opal_data)"}`}</pre>
              </div>
              <div className="notice"><ShieldCheck size={18} /><p><strong>Runtime trust boundary</strong>The browser never executes arbitrary system commands. The planned adapter uses disposable sessions, package allow-lists, resource limits, and explicit approval.</p></div>
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
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="large-empty">{icon}<p>{text}</p></div>;
}
