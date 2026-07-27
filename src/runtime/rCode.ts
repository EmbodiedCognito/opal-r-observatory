import type { Dataset } from "../types";

function rString(value: string) {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function rValue(value: string | number | null) {
  if (value == null || value === "") return "NA";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NA";
  return rString(value);
}

export function datasetToR(dataset: Dataset) {
  const columns = dataset.variables.map((variable) => {
    const values = dataset.rows.map((row) => rValue(row[variable.name]));
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
