/**
 * DEMONSTRATION DATA — NOT REAL FELLOWS, FIRMS OR RESULTS.
 *
 * Every name, reflection, score and attendance mark below is invented so the
 * report design can be reviewed before real data is connected. Replace this
 * module (or point the repository at a real source) in Phase 2.
 */
import type {
  CapstoneRecord,
  Checkpoint,
  Dataset,
  Fellow,
  Firm,
  Session,
  SessionRecord,
} from '../types';
import { exampleCapitalLogo, horizonVenturesLogo } from './sampleLogos';

const COHORT = 'cohort-2026';

const sessionDefs: Array<[string, string]> = [
  ['The state of venture capital in Africa', 'Session facilitator (demo)'],
  ['Investment judgement and conviction', 'Session facilitator (demo)'],
  ['Sourcing and building a proprietary pipeline', 'Session facilitator (demo)'],
  ['Due diligence that changes decisions', 'Session facilitator (demo)'],
  ['Valuation and deal structuring', 'Session facilitator (demo)'],
  ['Portfolio construction and reserves', 'Session facilitator (demo)'],
  ['Working with founders after the cheque', 'Session facilitator (demo)'],
  ['Writing for the investment committee', 'Session facilitator (demo)'],
  ['Blended and catalytic capital', 'Session facilitator (demo)'],
  ['Exits, secondaries and liquidity', 'Session facilitator (demo)'],
  ['Raising from LPs', 'Session facilitator (demo)'],
  ['Capstone Lab presentations', 'Session facilitator (demo)'],
];

const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Weekly Monday masterclasses from 17 August 2026.
const sessions: Session[] = sessionDefs.map(([title, facilitator], i) => {
  const date = addDays('2026-08-17', i * 7);
  return {
    id: `s${String(i + 1).padStart(2, '0')}`,
    cohortId: COHORT,
    number: i + 1,
    title,
    facilitator,
    date,
    status: date <= '2026-10-05' ? 'held' : 'scheduled',
  };
});
const sid = (n: number) => `s${String(n).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/* Firms                                                               */
/* ------------------------------------------------------------------ */

const firms: Firm[] = [
  {
    id: 'firm-example-capital',
    reportToken: 'k7Qm2xP9aRf4',
    name: 'Example Capital',
    logoUrl: exampleCapitalLogo,
    cohortId: COHORT,
    isSample: true,
  },
  {
    id: 'firm-horizon-ventures',
    reportToken: 'h3Tz8vLw6NcY',
    name: 'Horizon Ventures',
    logoUrl: horizonVenturesLogo,
    cohortId: COHORT,
    isSample: true,
  },
];

/* ------------------------------------------------------------------ */
/* Featured demo fellows                                               */
/* ------------------------------------------------------------------ */

const featured: Fellow[] = [
  {
    id: 'fellow-alexandra-smith',
    reportToken: 'a9Vb4Kd2Ws7e',
    firmId: 'firm-example-capital',
    cohortId: COHORT,
    firstName: 'Alexandra',
    lastName: 'Smith',
    role: 'Investment Associate',
    isSample: true,
  },
  {
    id: 'fellow-daniel-mensah',
    reportToken: 'd5Rx1Hq8Jm3u',
    firmId: 'firm-example-capital',
    cohortId: COHORT,
    firstName: 'Daniel',
    lastName: 'Mensah',
    role: 'Senior Investment Analyst',
    isSample: true,
  },
  {
    id: 'fellow-amara-okafor',
    reportToken: 'm2Gc7Yt5Pz9b',
    firmId: 'firm-horizon-ventures',
    cohortId: COHORT,
    firstName: 'Amara',
    lastName: 'Okafor',
    role: 'Principal',
    isSample: true,
  },
];

type Reflection = [learned: string, apply: string];

/**
 * Per featured fellow: attendance pattern across sessions 1–8
 * ('1' attended, '0' missed), feedback pattern ('1' submitted) and the
 * fellow's reflections keyed by session number, written as a fellow might.
 */
const featuredRecords: Record<
  string,
  { attended: string; feedback: string; words: Record<number, Reflection> }
> = {
  'fellow-alexandra-smith': {
    attended: '11110111',
    feedback: '11110101',
    words: {
      1: [
        'I came in thinking the funding gap was mostly about the amount of capital. The session made it clear that the gap is just as much about the type of capital, and that a lot of good businesses are being pushed toward equity that doesn\'t suit them.',
        'When I screen a deal I\'m going to write one line on whether equity is actually the right instrument before I go further, and flag it to the partner if it isn\'t.',
      ],
      2: [
        'I had been treating conviction as a feeling. The session reframed it as a set of explicit assumptions I can write down and test.',
        'Before our next IC, I\'ll draft a one-page thesis for each deal with the three assumptions that have to hold.',
      ],
      3: [
        'Strong sourcing comes from being the first call for a small set of founders who trust you, rather than from volume.',
        'I\'m picking two sectors and committing to one founder conversation a week in each, with no agenda attached.',
      ],
      4: [
        'Diligence is only useful if it can change the answer. Half of what we ask for is to make ourselves feel thorough.',
        'For the deal I\'m on now I\'ll list the three questions that could kill it and do those first, before the data room checklist.',
      ],
      6: [
        'Reserves are a portfolio decision, not a deal decision. I hadn\'t realised how much our follow-on behaviour was being decided by whoever asked first.',
        'I want to build a simple reserves model for our current fund and bring it to our Monday pipeline meeting.',
      ],
      8: [
        'An IC memo is an argument, not a report. The best ones tell the committee what to believe and then show them why.',
        'My next memo will open with the recommendation and the two reasons it could be wrong, in the first paragraph.',
      ],
    },
  },
  'fellow-daniel-mensah': {
    attended: '11011011',
    feedback: '11001001',
    words: {
      1: [
        'The numbers on how little capital reaches early-stage founders outside the big four markets were sobering. We talk about pan-African but our pipeline doesn\'t look like it.',
        'I\'m going to map where our last 40 inbound deals came from and share it with the team.',
      ],
      2: [
        'Separating "I like this founder" from "this is a good investment" sounds obvious but I do not do it consistently.',
        'Keep a decision log for every deal I recommend for or against, so I can check my calls in a year.',
      ],
      5: [
        'Structure is where you can protect the downside without fighting over the headline valuation. Most of our term sheets use the same template regardless of the deal.',
        '',
      ],
      8: [
        'The committee only remembers the first page. Everything else is there to answer questions, not to persuade.',
        'Rewrite our memo template so the first page is the decision, the risks and what we need to believe.',
      ],
    },
  },
  'fellow-amara-okafor': {
    attended: '11111111',
    feedback: '11111111',
    words: {
      1: [
        'Hearing how other funds in the room think about the same market reminded me how narrow our own view can get.',
        'Set up a quarterly call with two other managers to compare notes on deals we both passed on.',
      ],
      2: [
        'The point that stuck was that conviction should be strongest about the few things that matter, and loose about everything else.',
        'In our next pipeline review I\'ll ask each of us to name the single assumption the deal depends on.',
      ],
      3: [
        'We rely almost entirely on our network for deal flow. It works, but it means we keep seeing the same kind of founder.',
        'Run a small open call for founders in two sectors we have never invested in and see what comes in.',
      ],
      4: [
        'Reference calls are most useful when you ask about the hard moments, not the highlights.',
        'Add three questions about how the founder handled a bad quarter to our reference call script.',
      ],
      5: [
        'Valuation in our market is less about comparables and more about what the next round will realistically look like.',
        'Model the next two rounds for every new deal before we agree a price.',
      ],
      6: [
        'We have been building a portfolio one deal at a time instead of deciding the shape of the portfolio first.',
        'Propose target ranges for cheque size and number of companies to our partners for the rest of the fund.',
      ],
      7: [
        'Founders want fewer, more useful conversations, not more support programmes.',
        'Ask each portfolio founder what one thing we could do this quarter that would actually help, and do it.',
      ],
      8: [
        'Writing clearly is a form of thinking clearly. If I can\'t say it in a paragraph, I don\'t understand it yet.',
        'Start every investment memo with a five-sentence summary and test it on a colleague before writing the rest.',
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/* The rest of the demo cohort (anonymous; only used for averages)    */
/* ------------------------------------------------------------------ */

// Attendance / feedback patterns across sessions 1–8.
const cohortPatterns: Array<[string, string]> = [
  ['11111111', '11111110'],
  ['11111110', '11011100'],
  ['11011111', '11011011'],
  ['11111011', '10111011'],
  ['10111101', '10101100'],
  ['11110110', '11100100'],
  ['11111111', '11111111'],
  ['11101101', '11001001'],
  ['01111011', '01010001'],
  ['11111111', '10110111'],
  ['11011010', '10010000'],
  ['11110111', '11110111'],
  ['11100111', '01100110'],
  ['10110110', '10100000'],
  ['11111101', '11011101'],
  ['11101111', '11101011'],
  ['00000000', '00000000'], // a fellow who has not attended — exercises the zero case
];

const cohortFellows: Fellow[] = cohortPatterns.map((_, i) => ({
  id: `fellow-cohort-${String(i + 1).padStart(2, '0')}`,
  reportToken: `cohort${String(i + 1).padStart(2, '0')}x`,
  firmId: 'firm-rest-of-cohort',
  cohortId: COHORT,
  firstName: 'Cohort',
  lastName: `Fellow ${String(i + 1).padStart(2, '0')}`,
  isSample: true,
}));

// A single placeholder firm holds the rest of the demo cohort. These fellows
// only feed the cohort averages; no report is issued for the firm.
const cohortFirms: Firm[] = [
  {
    id: 'firm-rest-of-cohort',
    reportToken: 'r8Lp3Wq6Zs1d',
    name: 'Other cohort firms (demo)',
    cohortId: COHORT,
    reportEnabled: false,
    isSample: true,
  },
];

/* ------------------------------------------------------------------ */
/* Session records                                                     */
/* ------------------------------------------------------------------ */

const sessionRecords: SessionRecord[] = [];
const heldCount = 8;

for (const fellow of featured) {
  const p = featuredRecords[fellow.id];
  for (let n = 1; n <= heldCount; n++) {
    const attended = p.attended[n - 1] === '1';
    const submitted = attended && p.feedback[n - 1] === '1';
    const words = p.words[n];
    sessionRecords.push({
      fellowId: fellow.id,
      sessionId: sid(n),
      attended,
      feedbackSubmitted: submitted,
      whatILearned: submitted ? words?.[0] : undefined,
      whatIllApply: submitted ? words?.[1] : undefined,
      feedbackSubmittedAt: submitted ? addDays(sessions[n - 1].date, 2) : undefined,
    });
  }
}

cohortFellows.forEach((fellow, i) => {
  const [att, fb] = cohortPatterns[i];
  for (let n = 1; n <= heldCount; n++) {
    const attended = att[n - 1] === '1';
    sessionRecords.push({
      fellowId: fellow.id,
      sessionId: sid(n),
      attended,
      feedbackSubmitted: attended && fb[n - 1] === '1',
    });
  }
});

/* ------------------------------------------------------------------ */
/* Capstone (append-only snapshots)                                    */
/* ------------------------------------------------------------------ */

const capstones: CapstoneRecord[] = [
  {
    fellowId: 'fellow-alexandra-smith',
    recordedAt: '2026-10-02',
    submitted: true,
    submissionDate: '2026-10-01',
    submissionDeadline: '2026-10-02',
    assessmentStatus: 'pending',
  },
  {
    fellowId: 'fellow-daniel-mensah',
    recordedAt: '2026-09-28',
    submitted: true,
    submissionDate: '2026-09-28',
    submissionDeadline: '2026-10-02',
    assessmentStatus: 'pending',
  },
  {
    fellowId: 'fellow-daniel-mensah',
    recordedAt: '2026-10-05',
    submitted: true,
    submissionDate: '2026-09-28',
    submissionDeadline: '2026-10-02',
    assessmentStatus: 'complete',
    assessmentScore: 78,
    assessmentMaxScore: 100,
    detailedFeedback:
      'DEMONSTRATION FEEDBACK. A clear, well-evidenced investment case with a realistic view of the exit route. The market sizing leans on top-down figures; the strongest submissions in the cohort built the case bottom-up from customer data. The risk section identifies the right issues but would be stronger with a view on how the structure mitigates each one.',
  },
  {
    fellowId: 'fellow-amara-okafor',
    recordedAt: '2026-10-05',
    submitted: false,
    submissionDeadline: '2026-11-30',
    assessmentStatus: 'not_started',
  },
];

/* ------------------------------------------------------------------ */
/* Checkpoints                                                         */
/* ------------------------------------------------------------------ */

const checkpoints: Checkpoint[] = [
  {
    id: 'cp-2026-1',
    cohortId: COHORT,
    title: 'Checkpoint 1',
    reportingDate: '2026-09-08',
    sessionIds: [1, 2, 3, 4].map(sid),
    status: 'published',
  },
  {
    id: 'cp-2026-2',
    cohortId: COHORT,
    title: 'Checkpoint 2',
    reportingDate: '2026-10-06',
    sessionIds: [1, 2, 3, 4, 5, 6, 7, 8].map(sid),
    status: 'published',
  },
];

export const sampleDataset: Dataset = {
  label: 'Demonstration data',
  isSample: true,
  cohorts: [
    {
      id: COHORT,
      name: 'Investment Cohort 2026',
      programmeName: 'Investment Cohort',
      startDate: '2026-08-17',
      endDate: '2026-11-30',
    },
  ],
  firms: [...firms, ...cohortFirms],
  fellows: [...featured, ...cohortFellows],
  sessions,
  sessionRecords,
  capstones,
  checkpoints,
  users: [
    { id: 'u1', email: 'managing.partner@example-capital.demo', name: 'Managing Partner (demo)', firmId: 'firm-example-capital', role: 'firm_leader', accessStatus: 'active' },
    { id: 'u2', email: 'coo@example-capital.demo', name: 'COO (demo)', firmId: 'firm-example-capital', role: 'firm_leader', accessStatus: 'invited' },
    { id: 'u3', email: 'partner@horizon-ventures.demo', name: 'Partner (demo)', firmId: 'firm-horizon-ventures', role: 'firm_leader', accessStatus: 'active' },
    { id: 'u4', email: 'programme@included.vc.demo', name: 'Programme team (demo)', firmId: null, role: 'admin', accessStatus: 'active' },
  ],
};
