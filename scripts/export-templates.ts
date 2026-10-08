/**
 * Writes one CSV per table (filled with the demonstration data) to
 * data-templates/. Run: npm run templates
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tableSpecs, templateCsv } from '../src/data/importSpec';
import { sampleDataset } from '../src/data/sample/sampleDataset';

mkdirSync('data-templates', { recursive: true });
for (const spec of tableSpecs) {
  writeFileSync(`data-templates/${spec.file}`, templateCsv(spec, sampleDataset));
  console.log(`data-templates/${spec.file}`);
}
