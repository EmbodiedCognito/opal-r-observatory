import type { Dataset, VariableKind } from "../types";

function rString(value: string) {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function rValue(value: string | number | null, kind: VariableKind, name: string, row: number) {
  if (value == null || value === "") return "NA";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NA";
  if (kind === "continuous") {
    if (!value.trim()) return "NA";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      throw new Error(`Column ${name}, row ${row}: expected a numeric value, found ${JSON.stringify(value)}.`);
    }
    return String(numeric);
  }
  return rString(value);
}

export function datasetToR(dataset: Dataset) {
  const columns = dataset.variables.map((variable) => {
    const values = dataset.rows.map((row, index) =>
      rValue(row[variable.name], variable.kind, variable.name, index + 1));
    return `c(${values.join(", ")})`;
  });
  const names = dataset.variables.map((variable) => rString(variable.name));

  return [
    "opal_data <- structure(",
    `  list(${columns.join(",\n       ")}),`,
    `  names = c(${names.join(", ")}),`,
    '  class = "data.frame",',
    `  row.names = .set_row_names(${dataset.rows.length})`,
    ")",
  ].join("\n");
}

export function wrapForConsole(dataset: Dataset, analysisCode: string) {
  return [
    "paste(capture.output({",
    datasetToR(dataset),
    analysisCode,
    "}), collapse = \"\\n\")",
  ].join("\n");
}
