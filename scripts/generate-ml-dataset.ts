/** Usage: bun scripts/generate-ml-dataset.ts --seed 7 --count 1000 > dataset.json */
import { generateDataset } from "../src/ml/generator";
import { summarizeDataset } from "../src/ml/quality";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : undefined;
};
const seed = arg("seed");
const count = arg("count");
const records = generateDataset({ ...(seed !== undefined && { seed }), ...(count !== undefined && { count }) });
process.stdout.write(JSON.stringify(records, null, 2));
process.stderr.write(JSON.stringify(summarizeDataset(records), null, 2) + "\n");
