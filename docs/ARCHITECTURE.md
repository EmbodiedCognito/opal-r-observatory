# Architecture

## Design principles

Opal treats AI as a proposal author, not an invisible operator. Statistical reasoning, execution, and presentation are distinct concerns.

The visual configuration is canonical. Agent dialogue must compile into the same analysis specification used by direct controls; it may not maintain hidden analytical state.

## Trust zones

### Browser workbench

Owns imported CSV rows, variable metadata, the analysis canvas, approvals, and result presentation. The build serves pinned webR assets locally; R runs and results are session-only. The Models view accesses a loopback service to search saved records.

### Loopback observatory service

Serves the built interface and local `/api` routes on `127.0.0.1`. Its versioned JSON store saves published model metadata and local model prompts/responses atomically in the user's data directory. Catalogue search and run search use this store without contacting the publisher. Refresh requests a bounded, unfiltered-by-format page of Hugging Face model metadata only after a user action. No imported CSV rows are sent to this service.

The catalogue stores source-scoped keys (`source:id`) rather than assuming publisher IDs are globally unique. Source adapters supply records; optional fields can describe different model kinds and source metadata. Search indexes saved record values without an LLM or GGUF schema requirement. A format label is a publisher hint, not proof of compatibility. The service computes available download actions from runner adapters when presenting records, and checks them again before a download. Existing version 1 JSON records and runs are preserved when loaded into version 2.

The LM Studio adapter connects only to an explicitly configured loopback address. Listing installed models and running them remain local. A user-initiated download delegates the transfer to LM Studio; Opal does not automatically download model weights while refreshing metadata. The interface chooses an installed model separately because a publisher repository ID need not match LM Studio's installed-model key.

The current runner contract exposes listing installed models, compatibility checks, requested download and status, and a text chat operation. Those are LM Studio capabilities, not requirements on catalogue entries. New runtimes and forms of computation need explicit operation and result contracts. They should be allowed to record experiments without converting their inputs or outputs into a text prompt/answer. The current run UI and log only implement LM Studio text chat; this general experiment contract is still to be designed.

### Aster proposal service

Planned. Receives the minimum required schema and user question by default—not raw rows. It returns a structured proposal against a versioned analysis catalogue. Free-form model output never executes directly.

### R runtime adapter

The current adapter loads webR on demand and executes only code generated from Opal's versioned catalogue after explicit approval. Dataset values are serialised as R literals inside the local browser worker. A production adapter must additionally provide:

- filesystem and network isolation
- CPU, memory, and wall-clock limits
- package allow-lists and locked versions
- structured results rather than arbitrary HTML
- cancellation and auditable logs

## Proposal lifecycle

```text
question → structured proposal → validation → human review → approval
         → runtime plan → isolated execution → structured result → report
```

Rejection and editing are first-class outcomes. Approval is scoped to one immutable proposal and must not authorise later agent actions.

## Near-term package boundaries

- `domain/`: analysis catalogue, schema inference, proposal validation
- `runtime/`: webR execution, safe dataset serialisation, and future server adapters
- `server/`: persistent model metadata and run records, registered source adapters, and runner adapters
- `agent/`: model-provider-neutral proposal client
- `project/`: portable project bundle and provenance
- `ui/`: visual workbench

The portable project/result format is also the intended integration boundary for future clients such as an Obsidian plugin. Editor-specific integration should not own analysis state.

The prototype keeps UI code compact while the boundaries stabilise. Extraction into packages should follow working interfaces, not precede them.
