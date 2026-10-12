"""
Fills the report data template from the programme's feedback export
(the "Basic info" sheet plus one sheet per session: "1. Zach", "2. Mahdi", ...).

Usage:
  python3 scripts/fill_from_feedback_export.py EXPORT.xlsx OUT.xlsx

What it does (and doesn't do):
  - Fellows and firms come from "Basic info" (organisation = sponsoring firm).
  - Each feedback row = feedback submitted, so the fellow attended that session.
  - Reflections are copied exactly as written. The only change is repairing
    broken characters from an encoding error (e.g. "What‚Äôs" -> "What's").
    Several submissions by the same person for one session are joined, in
    order, separated by a blank line.
  - Ratings and notes to facilitators are not part of the report, so they are
    left out.
  - Nothing is invented: attendance for fellows who sent no feedback, session
    titles/dates the export doesn't contain, Capstone results and firm
    recipients are left blank and highlighted in yellow.
"""
import re
import sys
import unicodedata
from datetime import date, timedelta

from openpyxl import load_workbook

sys.path.insert(0, 'scripts')
from build_data_template import build  # noqa: E402

SRC, OUT = sys.argv[1], sys.argv[2]
wb = load_workbook(SRC, data_only=True)

COHORT = 'cohort-2026'
FIRST_SESSION = date(2026, 8, 17)  # Monday 17 August 2026, from the sponsor report
TOTAL_SESSIONS = 16                 # "sixteen core sessions" in the application form

# Session titles: 1-4 as published in the sponsor progress report.
KNOWN_TITLES = {
    1: 'The state of VC in Africa, and how to build a fund',
    2: 'AI as a thinking partner for investors',
    3: 'AI-enabled investment workflows: capture, context, judgement',
    4: 'Sourcing, founder judgement and your edge as an investor',
}


def fix_text(v):
    """Repairs UTF-8 text that was mis-decoded as Mac Roman, nothing else."""
    if v is None:
        return None
    s = str(v)
    if re.search('[‚Äô€ú]', s) and ('‚Ä' in s or 'Äô' in s):
        try:
            s = s.encode('mac_roman').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return s if s.strip() else None


def key(name):
    n = unicodedata.normalize('NFKD', str(name)).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z]', '', n.lower())


def slug(s):
    n = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', n)).strip('-')


def tidy_name(name):
    name = ' '.join(str(name).split())
    return name.title() if name.isupper() else name


# ---------------- fellows and firms ----------------
basic = wb['Basic info']
hdr = [c.value for c in basic[1]]
col = {h: i for i, h in enumerate(hdr)}
fellows, firms, firm_ids = [], [], {}
fellow_by_key = {}
for r in basic.iter_rows(min_row=2, values_only=True):
    if not r or not r[col['Full Name']]:
        continue
    full = tidy_name(r[col['Full Name']])
    org = ' '.join(str(r[col['Your Organisation name']]).split())
    if org not in firm_ids:
        firm_ids[org] = 'firm-' + slug(org)
        logo = f'public/logos/{firm_ids[org]}.png'
        firms.append({'firm_id': firm_ids[org], 'firm_name': org, 'cohort_id': COHORT, 'report_enabled': 'yes',
                      # Logos from the sponsor report ship with the app (public/logos/).
                      'logo_url': f'/logos/{firm_ids[org]}.png' if __import__('os').path.exists(logo) else ''})
    parts = full.split(' ')
    fid = 'fellow-' + slug(full)
    fellows.append({
        'fellow_id': fid,
        'first_name': parts[0],
        'last_name': ' '.join(parts[1:]) or parts[0],
        'role': (r[col['Current job title']] or '').strip(),
        'firm_id': firm_ids[org],
        'cohort_id': COHORT,
    })
    fellow_by_key[key(full)] = fid

# ---------------- sessions and feedback ----------------
session_sheets = [n for n in wb.sheetnames if re.match(r'^\s*\d+\s*\.', n)]


def session_number(n):
    return int(re.match(r'^\s*(\d+)', n).group(1))


session_sheets.sort(key=session_number)
sessions, records, flags = [], [], {}
unmatched = []

for sheet_name in session_sheets:
    n = session_number(sheet_name)
    facilitator = re.sub(r'^\s*\d+\s*\.\s*', '', sheet_name).strip(' .')
    ws = wb[sheet_name]
    headers = [fix_text(c.value) or '' for c in ws[1]]
    low = [h.lower() for h in headers]

    def find(*needles, exclude=()):
        return [i for i, h in enumerate(low) if any(x in h for x in needles) and not any(x in h for x in exclude)]

    name_col = find('your name')[0]
    learned_cols = find('understand better')
    apply_cols = find('apply', 'differently')

    sid = f's{n:02d}'
    sessions.append({
        'session_id': sid,
        'cohort_id': COHORT,
        'session_number': str(n),
        'session_title': KNOWN_TITLES.get(n, f'Masterclass with {facilitator}'),
        'session_date': (FIRST_SESSION + timedelta(weeks=n - 1)).isoformat(),
        'status': 'held',
        'facilitator': facilitator,
    })
    if n not in KNOWN_TITLES:
        flags[('sessions', len(sessions) - 1)] = {
            'session_title': 'Placeholder: the export has no session title. Replace with the real title.',
            'session_date': 'Assumed: weekly Mondays from 17 August. Check the real date.',
        }
    elif n > 4:
        pass
    else:
        flags[('sessions', len(sessions) - 1)] = {}

    by_fellow = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or not r[name_col]:
            continue
        fid = fellow_by_key.get(key(r[name_col]))
        if not fid:
            unmatched.append((sheet_name, r[name_col]))
            continue
        entry = by_fellow.setdefault(fid, {'learned': [], 'apply': []})
        for i in learned_cols:
            t = fix_text(r[i]) if i < len(r) else None
            if t:
                entry['learned'].append(t)
        for i in apply_cols:
            t = fix_text(r[i]) if i < len(r) else None
            if t:
                entry['apply'].append(t)

    for f in fellows:
        e = by_fellow.get(f['fellow_id'])
        row = {
            'fellow_id': f['fellow_id'],
            'session_id': sid,
            'attended': 'yes' if e else '',
            'feedback_submitted': 'yes' if e else 'no',
            'what_i_learned': '\n\n'.join(e['learned']) if e else '',
            'what_ill_apply': '\n\n'.join(e['apply']) if e else '',
            'feedback_submitted_at': '',
        }
        records.append(row)
        if not e:
            flags[('attendance_feedback', len(records) - 1)] = {
                'attended': 'No feedback from this fellow, so attendance is unknown. '
                            'Enter yes or no from the attendance register (blank counts as not attended).'
            }

for n in range(len(sessions) + 1, TOTAL_SESSIONS + 1):
    sessions.append({
        'session_id': f's{n:02d}',
        'cohort_id': COHORT,
        'session_number': str(n),
        'session_title': f'Session {n}',
        'session_date': (FIRST_SESSION + timedelta(weeks=n - 1)).isoformat(),
        'status': 'scheduled',
        'facilitator': '',
    })
    flags[('sessions', len(sessions) - 1)] = {
        'session_title': 'Upcoming session: add the title when known.',
        'session_date': 'Assumed: weekly Mondays from 17 August.',
    }

held = [s['session_id'] for s in sessions if s['status'] == 'held']
checkpoints = [
    {'checkpoint_id': 'cp-2026-1', 'cohort_id': COHORT, 'checkpoint_title': 'Checkpoint 1',
     'reporting_date': sessions[3]['session_date'] if len(sessions) > 3 else sessions[-1]['session_date'],
     'session_ids': ';'.join(held[:4]), 'status': 'published'},
    {'checkpoint_id': 'cp-2026-2', 'cohort_id': COHORT, 'checkpoint_title': 'Checkpoint 2',
     'reporting_date': next(s['session_date'] for s in sessions if s['session_id'] == held[-1]),
     'session_ids': ';'.join(held), 'status': 'draft'},
]
flags[('checkpoints', 1)] = {'status': 'Draft until you have checked it. Publish in the admin (Send & access).'}

users = [{'user_id': 'admin-ops', 'email': 'ops@included.vc', 'name': 'Included VC Operations',
          'firm_id': '', 'role': 'admin', 'access_status': 'active'}]

TABLE_ROWS = {
    'cohorts': [{'cohort_id': COHORT, 'cohort_name': 'Africa Investor Fellowship 2026',
                 'programme_name': 'Africa Investor Fellowship',
                 'start_date': FIRST_SESSION.isoformat(),
                 'end_date': (FIRST_SESSION + timedelta(weeks=TOTAL_SESSIONS - 1)).isoformat()}],
    'firms': firms,
    'fellows': fellows,
    'sessions': sessions,
    'attendance_feedback': records,
    'capstone': [],
    'checkpoints': checkpoints,
    'authorised_users': users,
}
flags[('cohorts', 0)] = {'end_date': 'Assumed: 16 weekly sessions. Check the real end date.'}

missing_attendance = sum(1 for k in flags if k[0] == 'attendance_feedback')
intro = [
    ('LOADED FROM YOUR FEEDBACK EXPORT', ''),
    ('Source', SRC.split('/')[-1]),
    ('Loaded', f'{len(fellows)} fellows · {len(firms)} organisations · {len(held)} sessions · '
               f'{sum(1 for r in records if r["feedback_submitted"] == "yes")} feedback submissions'),
    ('Still to fill in', f'{missing_attendance} attendance cells (fellows who sent no feedback) · titles for sessions 5–{len(held)} · '
                         'firm leadership emails (authorised_users) · Capstone results when available'),
    ('Not included', 'Session ratings and notes written to facilitators. They are not part of the partner report.'),
]
build(OUT, lambda tab: TABLE_ROWS[tab], flags=flags, examples=False, intro=intro)
print(f'fellows={len(fellows)} firms={len(firms)} held={len(held)} '
      f'submissions={sum(1 for r in records if r["feedback_submitted"] == "yes")} '
      f'attendance_to_fill={missing_attendance} unmatched={unmatched}')
