# Architecture

## Design principles

Opal treats AI as a proposal author, not an invisible operator. Statistical reasoning, execution, and presentation are distinct concerns.

The visual configuration is canonical. Agent dialogue must compile into the same analysis specification used by direct controls; it may not maintain hidden analytical state.

## Trust zones

### Browser workbench

Owns imported data, variable metadata, the analysis canvas, approvals, and result presentation. Browser-only features must work without an account or network connection after assets load.

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
- `agent/`: model-provider-neutral proposal client
- `project/`: portable project bundle and provenance
- `ui/`: visual workbench

The portable project/result format is also the intended integration boundary for future clients such as an Obsidian plugin. Editor-specific integration should not own analysis state.

The prototype keeps UI code compact while the boundaries stabilise. Extraction into packages should follow working interfaces, not precede them.
