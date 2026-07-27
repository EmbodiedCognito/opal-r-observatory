import { analyses } from "./catalog";
import type { AnalysisDefinition, AnalysisMapping, Dataset, Variable } from "../types";

export function inferVariable(name: string, values: unknown[]): Variable {
  const present = values.filter((value) => value !== "" && value != null);
  const numeric = present.filter((value) => !Number.isNaN(Number(value)));
  const unique = new Set(present.map(String)).size;
  const numericRatio = present.length === 0 ? 0 : numeric.length / present.length;

  let kind: Variable["kind"] = "nominal";
  if (/^(id|uuid|participant|subject)/i.test(name)) kind = "identifier";
  else if (numericRatio > 0.9 && unique > Math.min(8, present.length / 3)) kind = "continuous";
  else if (numericRatio > 0.9) kind = "ordinal";

  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    name,
    label: name.replace(/[_-]/g, " "),
    kind,
    missing: values.length - present.length,
    unique,
  };
}

export function recommendAnalyses(dataset: Dataset): AnalysisDefinition[] {
  const continuous = dataset.variables.filter((item) => item.kind === "continuous").length;
  const categorical = dataset.variables.filter(
    (item) => item.kind === "nominal" || item.kind === "ordinal",
  ).length;

  return analyses.filter((analysis) => {
    if (analysis.id === "describe") return true;
    if (analysis.id === "correlation") return continuous >= 2;
    if (analysis.id === "regression") return continuous >= 2;
    if (analysis.id === "t-test" || analysis.id === "anova") {
      return continuous >= 1 && categorical >= 1;
    }
    return false;
  });
}

export function proposalFor(analysis: AnalysisDefinition, dataset: Dataset, mapping: AnalysisMapping = {}) {
  const continuous = dataset.variables.filter((item) => item.kind === "continuous");
  const categorical = dataset.variables.filter(
    (item) => item.kind === "nominal" || item.kind === "ordinal",
  );
  const outcome = mapping.outcome ?? continuous[0]?.name ?? "outcome";
  const predictor = mapping.predictor ?? continuous[1]?.name ?? categorical[0]?.name ?? "predictor";
  const group = mapping.group ?? categorical[0]?.name ?? predictor;
  const column = (name: string) => `opal_data[[${JSON.stringify(name)}]]`;

  const code: Record<string, string> = {
    describe: `summary(opal_data)\ncolSums(is.na(opal_data))`,
    correlation: `cor.test(${column(outcome)}, ${column(predictor)})`,
    "t-test": `t.test(${column(outcome)} ~ as.factor(${column(group)}))`,
    anova: `summary(aov(${column(outcome)} ~ as.factor(${column(group)})))`,
    regression: `model <- lm(${column(outcome)} ~ ${column(predictor)})\nsummary(model)`,
  };

  return {
    id: `${analysis.id}-${Date.now()}`,
    title: `Run ${analysis.name}`,
    rationale: `${analysis.description} Opal selected variables by inferred measurement type; inspect and edit the generated R before execution.`,
    analysisId: analysis.id,
    status: "pending" as const,
    rCode: code[analysis.id],
  };
}
