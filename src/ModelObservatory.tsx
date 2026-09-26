import { useCallback, useEffect, useState } from "react";
import { Database, Download, Play, RefreshCw, Search } from "lucide-react";
import "./model-observatory.css";

interface CatalogueModel {
  id: string;
  url: string;
  revision: string | null;
  updatedAt: string | null;
  task: string | null;
  downloads: number | null;
  gated: boolean;
  gguf: boolean;
  tags: string[];
}

interface LocalModel {
  key: string;
  name: string;
  type: string;
  format?: string;
  loaded: boolean;
}

interface LocalRun {
  id: string;
  at: string;
  model: string;
  prompt: string;
  output: string;
}

async function api<T>(path: string, input?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, input ? {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Local service returned HTTP ${response.status}.`);
  return result as T;
}

export default function ModelObservatory() {
  const [search, setSearch] = useState("");
  const [publisherQuery, setPublisherQuery] = useState("");
  const [models, setModels] = useState<CatalogueModel[]>([]);
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<{ at: string; returned: number } | null>(null);
  const [selected, setSelected] = useState<CatalogueModel | null>(null);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [localKey, setLocalKey] = useState("");
  const [quantization, setQuantization] = useState("");
  const [downloadJob, setDownloadJob] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [runs, setRuns] = useState<LocalRun[]>([]);
  const [runSearch, setRunSearch] = useState("");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState<"" | "refresh" | "download" | "run">("");

  const listCatalogue = useCallback(async () => {
    try {
      const result = await api<{ models: CatalogueModel[]; total: number; matched: number; lastRefresh: typeof lastRefresh }>(
        `catalogue?q=${encodeURIComponent(search)}`,
      );
      setModels(result.models);
      setTotal(result.total);
      setMatched(result.matched);
      setLastRefresh(result.lastRefresh);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local catalogue could not be opened.");
    }
  }, [search]);

  const listRuns = useCallback(async () => {
    try {
      const result = await api<{ runs: LocalRun[] }>(`runs?q=${encodeURIComponent(runSearch)}`);
      setRuns(result.runs);
    } catch {
      // The catalogue load above reports an unavailable local service.
    }
  }, [runSearch]);

  const listLocalModels = useCallback(async () => {
    try {
      const result = await api<{ models: LocalModel[] }>("local/models");
      setLocalModels(result.models.filter((model) => model.type === "llm"));
      setLocalKey((current) => result.models.some((model) => model.key === current && model.type === "llm")
        ? current : result.models.find((model) => model.type === "llm")?.key ?? "");
      setLocalError("");
    } catch {
      setLocalError("LM Studio is unavailable. Start its local API server to download or run models.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api<{ models: CatalogueModel[]; total: number; matched: number; lastRefresh: typeof lastRefresh }>(
      `catalogue?q=${encodeURIComponent(search)}`,
    ).then((result) => {
      if (!active) return;
      setModels(result.models);
      setTotal(result.total);
      setMatched(result.matched);
      setLastRefresh(result.lastRefresh);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "The local catalogue could not be opened.");
    });
    return () => { active = false; };
  }, [search]);
  useEffect(() => {
    let active = true;
    void api<{ runs: LocalRun[] }>(`runs?q=${encodeURIComponent(runSearch)}`).then((result) => {
      if (active) setRuns(result.runs);
    }).catch(() => {});
    return () => { active = false; };
  }, [runSearch]);
  useEffect(() => {
    let active = true;
    void api<{ models: LocalModel[] }>("local/models").then((result) => {
      if (!active) return;
      setLocalModels(result.models.filter((model) => model.type === "llm"));
      setLocalKey(result.models.find((model) => model.type === "llm")?.key ?? "");
    }).catch(() => {
      if (active) setLocalError("LM Studio is unavailable. Start its local API server to download or run models.");
    });
    return () => { active = false; };
  }, []);

  const refresh = async () => {
    setBusy("refresh");
    setMessage("");
    try {
      const result = await api<{ returned: number; total: number }>("catalogue/refresh", { query: publisherQuery });
      setMessage(`Saved ${result.returned} publisher records. ${result.total} models are now available for offline search.`);
      await listCatalogue();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed. Saved records remain available.");
    } finally {
      setBusy("");
    }
  };

  const download = async () => {
    if (!selected) return;
    setBusy("download");
    try {
      const result = await api<{ job_id?: string; status: string }>("local/download", {
        id: selected.id, ...(quantization.trim() ? { quantization: quantization.trim() } : {}),
      });
      setDownloadJob(result.job_id ?? "");
      setDownloadStatus(result.status);
      setMessage(`${selected.id}: ${result.status}. Download is managed by LM Studio.`);
      if (result.status === "already_downloaded") await listLocalModels();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download could not start.");
    } finally {
      setBusy("");
    }
  };

  const checkDownload = async () => {
    if (!downloadJob) return;
    try {
      const result = await api<{ status: string }>(`local/download/status?job=${encodeURIComponent(downloadJob)}`);
      setDownloadStatus(result.status);
      if (result.status === "completed") await listLocalModels();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download status unavailable.");
    }
  };

  const run = async () => {
    if (!localKey || !prompt.trim()) return;
    setBusy("run");
    try {
      const result = await api<{ run: LocalRun }>("local/chat", { model: localKey, prompt });
      setMessage(`Local run saved with ${result.run.model}.`);
      await listRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local run failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="model-observatory">
      <div className="section-heading"><div><span className="eyebrow">LOCAL MODEL OBSERVATORY</span><h2>Find online. Search and run locally.</h2></div></div>
      <p className="model-intro">Refresh published GGUF model metadata when connected. The saved catalogue and run history remain searchable offline. Downloads happen only when you select one.</p>
      {message && <p className="model-message" role="status">{message}</p>}

      <div className="model-columns">
        <section className="model-panel">
          <h3><Database size={16} /> Published models</h3>
          <div className="model-controls">
            <input aria-label="Publisher query" placeholder="Publisher query (optional)" value={publisherQuery} onChange={(event) => setPublisherQuery(event.target.value)} />
            <button onClick={() => void refresh()} disabled={busy !== ""}><RefreshCw size={14} /> {busy === "refresh" ? "Refreshing…" : "Refresh online"}</button>
          </div>
          <label className="model-search"><Search size={14} /><input aria-label="Search saved models" placeholder="Search saved models offline" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <p className="model-meta">{matched} matches · {total} saved{lastRefresh ? ` · refreshed ${new Date(lastRefresh.at).toLocaleString()}` : " · no refresh yet"}</p>
          <div className="model-list">
            {models.map((model) => <button key={model.id} className={selected?.id === model.id ? "selected" : ""} onClick={() => { setSelected(model); setDownloadJob(""); setDownloadStatus(""); }}>
              <strong>{model.id}</strong><span>{model.task ?? "Task unspecified"} · {model.downloads?.toLocaleString() ?? "?"} downloads</span>
            </button>)}
            {!models.length && <p>No saved models match this search. Refresh while online to build the catalogue.</p>}
          </div>
          {matched > models.length && <p className="model-meta">Showing the first {models.length} matches.</p>}
        </section>

        <section className="model-panel">
          <h3><Download size={16} /> Selected model</h3>
          {selected ? <>
            <strong className="model-title">{selected.id}</strong>
            <p className="model-meta">Published: {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "unknown"}<br />Revision: {selected.revision ?? "unavailable"}</p>
            <p className="model-tags">{selected.tags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}</p>
            <a href={selected.url} target="_blank" rel="noreferrer">Open publisher page</a>
            <label className="model-label">Quantization (optional)<input value={quantization} onChange={(event) => setQuantization(event.target.value)} placeholder="e.g. Q4_K_M" /></label>
            <button onClick={() => void download()} disabled={!selected.gguf || selected.gated || busy !== ""}><Download size={14} /> {busy === "download" ? "Starting…" : "Download in LM Studio"}</button>
            {(selected.gated || !selected.gguf) && <p className="model-meta">Automated download requires a public GGUF repository.</p>}
            {downloadJob && <button className="secondary" onClick={() => void checkDownload()}>Check download: {downloadStatus}</button>}
          </> : <p>Select a saved model to inspect its source and request a download.</p>}
        </section>
      </div>

      <div className="model-columns">
        <section className="model-panel">
          <h3><Play size={16} /> Run an installed model</h3>
          <p className="model-meta">LM Studio runs on this computer. Its installed models are separate from publisher search results.</p>
          {localError && <p className="model-message">{localError}</p>}
          <button className="secondary" onClick={() => void listLocalModels()}><RefreshCw size={14} /> Check installed models</button>
          <label className="model-label">Installed language model
            <select value={localKey} onChange={(event) => setLocalKey(event.target.value)}>
              {!localModels.length && <option value="">None available</option>}
              {localModels.map((model) => <option key={model.key} value={model.key}>{model.name}{model.loaded ? " · loaded" : ""}</option>)}
            </select>
          </label>
          <label className="model-label">Prompt<textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Enter a question or a controlled test prompt" /></label>
          <button onClick={() => void run()} disabled={!localKey || !prompt.trim() || busy !== ""}><Play size={14} /> {busy === "run" ? "Running…" : "Run locally and save"}</button>
        </section>
        <section className="model-panel">
          <h3><Search size={16} /> Saved runs</h3>
          <label className="model-search"><Search size={14} /><input aria-label="Search saved runs" value={runSearch} onChange={(event) => setRunSearch(event.target.value)} placeholder="Search prompts, models, and responses offline" /></label>
          <div className="model-runs">{runs.map((item) => <article key={item.id}>
            <strong>{item.model}</strong><small>{new Date(item.at).toLocaleString()}</small>
            <p>{item.prompt}</p><pre>{item.output}</pre>
          </article>)}{!runs.length && <p>No saved runs match this search.</p>}</div>
        </section>
      </div>
    </div>
  );
}
