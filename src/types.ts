export type VariableKind = "continuous" | "ordinal" | "nominal" | "identifier";

export interface Variable {
  id: string;
  name: string;
  label: string;
  kind: VariableKind;
  missing: number;
  unique: number;
}

export interface Dataset {
  name: string;
  rows: Record<string, string | number | null>[];
  variables: Variable[];
}

export interface AnalysisDefinition {
  id: string;
  name: string;
  family: string;
  description: string;
  question: string;
  requires: string[];
  rPackage: string;
  rFunction: string;
}

export interface Proposal {
  id: string;
  title: string;
  rationale: string;
  analysisId: string;
  status: "pending" | "approved" | "rejected";
  rCode: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  summary: string;
  details: string[];
  rCode: string;
}
