import { inferVariable } from "../domain/recommend";
import type { Dataset } from "../types";

const rows = [
  { participant_id: "P01", group: "control", wellbeing: 42, sleep_hours: 6.1, stress: 71 },
  { participant_id: "P02", group: "control", wellbeing: 51, sleep_hours: 7.2, stress: 55 },
  { participant_id: "P03", group: "control", wellbeing: 47, sleep_hours: 6.8, stress: 61 },
  { participant_id: "P04", group: "treatment", wellbeing: 64, sleep_hours: 7.7, stress: 39 },
  { participant_id: "P05", group: "treatment", wellbeing: 70, sleep_hours: 8.1, stress: 34 },
  { participant_id: "P06", group: "treatment", wellbeing: 61, sleep_hours: 7.4, stress: 43 },
  { participant_id: "P07", group: "control", wellbeing: 45, sleep_hours: 6.4, stress: 67 },
  { participant_id: "P08", group: "treatment", wellbeing: 68, sleep_hours: 7.9, stress: 36 },
];

export const exampleDataset: Dataset = {
  name: "Wellbeing pilot",
  rows,
  variables: Object.keys(rows[0]).map((name) =>
    inferVariable(
      name,
      rows.map((row) => row[name as keyof typeof row]),
    ),
  ),
};
