# Included VC Africa — Investment Cohort progress reports

A private, personalised progress report for the leadership of each investment
firm that sponsors fellows on the Investment Cohort, with an individual report
for every fellow. One report design, driven entirely by data.

> **Phase 1 prototype.** Every firm, fellow, reflection and result in this
> repository is **demonstration data**. There is no authentication yet, so the
> prototype is **not secure** and must not be loaded with real data.

## What's here

| | |
| --- | --- |
| Company report | Introduction, sponsored fellows at a glance, their own words on what they'll apply, comparison with the cohort, closing |
| Individual report | 01 Participation & attendance · 02 Feedback & engagement · 03 Learning journey · 04 Capstone Lab · closing |
| Checkpoints | Switch between reporting checkpoints; earlier reports stay as issued |
| Admin (`#/admin`) | Preview any report at desktop/tablet/mobile width, copy report links, data checks, CSV import, recipients |

Sample reports: **Example Capital** (Alexandra Smith, Daniel Mensah) and
**Horizon Ventures** (Amara Okafor), plus 17 anonymous demo fellows who only
feed the cohort averages.

## Run it

```bash
npm install
npm run dev           # http://localhost:5173
npm test              # calculation + import tests
npm run build         # static site in dist/
npm run build:single  # everything inlined into dist-single/index.html
npm run templates     # regenerate data-templates/*.csv
```

## Docs

- [docs/DATA_IMPORT.md](docs/DATA_IMPORT.md) — import format, and exactly how every number is calculated
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — code structure, routes, and the Phase 3 authentication / row-level security plan

## Design

The visual language follows the Africa Investor Fellowship sponsor report:
Archivo (display), Manrope (body) and IBM Plex Mono (labels); black, white
and off-white with Included VC Kelly green, lime and gold; the brand gradient
rule; highlighter headlines; and large tabular figures. Tokens live in
`src/styles/tokens.css`.
