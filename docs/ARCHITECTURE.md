# Architecture

## Design principles

Opal treats AI as a proposal author, not an invisible operator. Statistical reasoning, execution, and presentation are distinct concerns.

## Trust zones

### Browser workbench

Owns imported data, variable metadata, the analysis canvas, approvals, and result presentation. Browser-only features must work without an account or network connection after assets load.

### Aster proposal service

Planned. Receives the minimum required schema and user question by default—not raw rows. It returns a structured proposal against a versioned analysis catalogue. Free-form model output never executes directly.

### R runtime adapter

Planned. Accepts a validated analysis specification and materialises it as R code inside a disposable session. A production adapter must provide:

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
- `runtime/`: WebR or server adapter interfaces
- `agent/`: model-provider-neutral proposal client
- `project/`: portable project bundle and provenance
- `ui/`: visual workbench

The prototype keeps UI code compact while the boundaries stabilise. Extraction into packages should follow working interfaces, not precede them.
