import { inferVariable } from "../domain/recommend";
import type { Dataset } from "../types";

export type SyntheticTemplate = "custom" | "wellbeing" | "clinical" | "regression" | "survey";
export type SyntheticVariableType = "identifier" | "continuous" | "integer" | "categorical" | "binary" | "ordinal";
export type SyntheticDistribution = "normal" | "uniform";

export interface SyntheticVariableSpec {
  id: string;
  name: string;
  type: SyntheticVariableType;
  distribution: SyntheticDistribution;
  mean: number;
  spread: number;
  min: number;
  max: number;
  categories: string[];
}

export interface SyntheticOptions {
  template: SyntheticTemplate;
  rows: number;
  seed: number;
  effect: number;
  noise: number;
  missingness: number;
  groups: number;
  variables: SyntheticVariableSpec[];
}

export const syntheticTemplates: Record<SyntheticTemplate, {
  name: string;
  description: string;
  variables: string[];
}> = {
  custom: {
    name: "Custom dataset",
    description: "Build the schema yourself, variable by variable.",
    variables: [],
  },
  wellbeing: {
    name: "Wellbeing experiment",
    description: "A grouped intervention study with sleep, stress, and wellbeing outcomes.",
    variables: ["participant_id", "group", "wellbeing", "sleep_hours", "stress"],
  },
  clinical: {
    name: "Clinical trial",
    description: "Repeated baseline and follow-up measures with treatment arms and adverse events.",
    variables: ["participant_id", "arm", "age", "baseline_score", "followup_score", "adverse_event"],
  },
  regression: {
    name: "Regression study",
    description: "Continuous predictors with adjustable association strength and noise.",
    variables: ["case_id", "outcome", "predictor_a", "predictor_b", "category"],
  },
  survey: {
    name: "Attitude survey",
    description: "Demographics, five Likert items, and a derived scale score.",
    variables: ["respondent_id", "region", "age_band", "item_1…item_5", "scale_score"],
  },
};

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function applyMissingness(
  rows: Record<string, string | number | null>[],
  random: () => number,
  rate: number,
) {
  if (rate <= 0) return rows;
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const identifier = /(^|_)id$|^id$/.test(key);
      return [key, !identifier && random() < rate ? null : value];
    }),
  ));
}

function customRows(count: number, random: () => number, options: SyntheticOptions) {
  const safeName = (name: string, index: number) => name.trim() || `variable_${index + 1}`;
  return Array.from({ length: count }, (_, rowIndex) =>
    Object.fromEntries(options.variables.map((variable, variableIndex) => {
      const name = safeName(variable.name, variableIndex);
      let value: string | number;
      switch (variable.type) {
        case "identifier":
          value = `${name.slice(0, 2).toUpperCase()}${String(rowIndex + 1).padStart(4, "0")}`;
          break;
        case "continuous": {
          const draw = variable.distribution === "uniform"
            ? variable.min + random() * (variable.max - variable.min)
            : variable.mean + normal(random) * Math.max(0.01, variable.spread);
          value = rounded(clamp(draw, variable.min, variable.max), 2);
          break;
        }
        case "integer": {
          const draw = variable.distribution === "uniform"
            ? variable.min + random() * (variable.max - variable.min)
            : variable.mean + normal(random) * Math.max(0.01, variable.spread);
          value = Math.round(clamp(draw, variable.min, variable.max));
          break;
        }
        case "binary":
          value = random() < clamp(variable.mean, 0, 1) ? (variable.categories[1] ?? "yes") : (variable.categories[0] ?? "no");
          break;
        case "ordinal":
        case "categorical": {
          const categories = variable.categories.filter(Boolean);
          value = categories[Math.floor(random() * categories.length)] ?? "category";
          break;
        }
      }
      return [name, value];
    })),
  );
}

function wellbeingRows(count: number, random: () => number, options: SyntheticOptions) {
  const groups = ["control", "treatment", "enhanced"].slice(0, options.groups);
  return Array.from({ length: count }, (_, index) => {
    const groupIndex = index % groups.length;
    const dose = groupIndex * options.effect;
    const baseline = normal(random);
    const sleepHours = clamp(7 + normal(random) * options.noise + dose * 0.25, 3.5, 10.5);
    const stress = clamp(56 - sleepHours * 2.8 - dose * 5 + normal(random) * 8 * options.noise, 5, 95);
    const wellbeing = clamp(49 + sleepHours * 2.4 - stress * 0.18 + dose * 7 + baseline * 5 * options.noise, 5, 95);
    return {
      participant_id: `S${String(index + 1).padStart(4, "0")}`,
      group: groups[groupIndex],
      wellbeing: rounded(wellbeing),
      sleep_hours: rounded(sleepHours),
      stress: rounded(stress),
    };
  });
}

function clinicalRows(count: number, random: () => number, options: SyntheticOptions) {
  const arms = ["placebo", "treatment", "enhanced"].slice(0, options.groups);
  return Array.from({ length: count }, (_, index) => {
    const armIndex = index % arms.length;
    const age = Math.round(clamp(48 + normal(random) * 14, 18, 85));
    const baseline = clamp(62 + normal(random) * 10, 20, 95);
    const change = -2 - armIndex * options.effect * 7 + normal(random) * 7 * options.noise;
    return {
      participant_id: `T${String(index + 1).padStart(4, "0")}`,
      arm: arms[armIndex],
      age,
      baseline_score: rounded(baseline),
      followup_score: rounded(clamp(baseline + change, 0, 100)),
      adverse_event: random() < 0.08 + armIndex * 0.03 ? "yes" : "no",
    };
  });
}

function regressionRows(count: number, random: () => number, options: SyntheticOptions) {
  return Array.from({ length: count }, (_, index) => {
    const predictorA = normal(random);
    const predictorB = predictorA * 0.35 + normal(random) * 0.94;
    const outcome = 50 + predictorA * options.effect * 12 + predictorB * 4 + normal(random) * 10 * options.noise;
    return {
      case_id: `R${String(index + 1).padStart(4, "0")}`,
      outcome: rounded(outcome, 2),
      predictor_a: rounded(predictorA, 2),
      predictor_b: rounded(predictorB, 2),
      category: ["north", "central", "south"][index % Math.min(3, options.groups + 1)],
    };
  });
}

function surveyRows(count: number, random: () => number, options: SyntheticOptions) {
  const regions = ["metro", "regional", "remote"].slice(0, Math.max(2, options.groups));
  return Array.from({ length: count }, (_, index) => {
    const attitude = normal(random) * options.effect;
    const items = Array.from({ length: 5 }, () =>
      Math.round(clamp(3 + attitude + normal(random) * options.noise, 1, 5)),
    );
    return {
      respondent_id: `Q${String(index + 1).padStart(4, "0")}`,
      region: regions[index % regions.length],
      age_band: ["18–29", "30–44", "45–59", "60+"][Math.floor(random() * 4)],
      item_1: items[0],
      item_2: items[1],
      item_3: items[2],
      item_4: items[3],
      item_5: items[4],
      scale_score: rounded(items.reduce((sum, value) => sum + value, 0) / items.length, 2),
    };
  });
}

export function generateSyntheticDataset(options: SyntheticOptions): Dataset {
  const rows = Math.round(clamp(options.rows, 20, 5000));
  const seed = Math.trunc(options.seed) || 1;
  const normalised: SyntheticOptions = {
    ...options,
    rows,
    seed,
    effect: clamp(options.effect, 0, 2),
    noise: clamp(options.noise, 0.1, 2),
    missingness: clamp(options.missingness, 0, 0.4),
    groups: Math.round(clamp(options.groups, 2, 3)),
  };
  const random = mulberry32(seed);
  const factories = {
    custom: customRows,
    wellbeing: wellbeingRows,
    clinical: clinicalRows,
    regression: regressionRows,
    survey: surveyRows,
  };
  if (normalised.template === "custom" && normalised.variables.length === 0) {
    throw new Error("Add at least one variable to generate a custom dataset.");
  }
  if (normalised.template === "custom") {
    const names = normalised.variables.map((variable) => variable.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) {
      throw new Error("Variable names must be unique.");
    }
    const invalidRange = normalised.variables.find(
      (variable) => (variable.type === "continuous" || variable.type === "integer") && variable.min >= variable.max,
    );
    if (invalidRange) throw new Error(`${invalidRange.name || "A variable"} needs a minimum below its maximum.`);
  }
  const data = applyMissingness(
    factories[normalised.template](rows, random, normalised),
    random,
    normalised.missingness,
  );

  return {
    name: `${syntheticTemplates[normalised.template].name} · n=${rows} · seed=${seed}`,
    rows: data,
    variables: Object.keys(data[0]).map((name) =>
      inferVariable(name, data.map((row) => row[name])),
    ),
    provenance: {
      kind: "synthetic",
      seed,
      generator: `${normalised.template}-v1`,
      note: "Generated for demonstration. Not representative of a real population.",
    },
  };
}
