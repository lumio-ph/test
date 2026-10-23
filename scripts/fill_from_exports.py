"""
Fills the report data template from two programme files:

  FEEDBACK  the feedback export: "Basic info" (fellows and organisations) and
            "All INVCA-Investor" (every feedback form, one row per submission)
  REGISTER  the checkpoint register: "INVAI26 - Mandatory", one row per fellow,
            one Yes/No column per masterclass, plus THE LAB (Capstone)

Usage:
  python3 scripts/fill_from_exports.py FEEDBACK.xlsx REGISTER.xlsx OUT.xlsx [CAPSTONE.txt] [--forms FORMS.xlsx]
      [--self-updates TRACKER.xlsx]

  --self-updates TRACKER.xlsx (optional): a workbook with a sheet holding "Name",
  "How many Yeses", "THIS IS HOW MANY ARE DONE" and "THIS IS HOW MANY THERE ARE"
  (the "Copy of INVAI26 - Mandatory" tab). Fills the self_updates tab, which
  drives the "Checkpoint · Self updates" card.

  --forms FORMS.xlsx (optional): a register whose "NOTE (Typeform)" columns say
  whether each fellow submitted the feedback form for each session. With it the
  strict rules apply: attended only when the register says "Yes" or "Yes - not
  all of it", or the fellow sent feedback for that session (Checkpoint form
  "Yes" or a form in the feedback export); otherwise not attended. A feedback form
  counts only when FORMS says "Yes" ("Update Pending" and "No" = not submitted;
  "Y/NO" = submitted only if the form is in the feedback export).

  CAPSTONE.txt (optional): one fellow name per line, everyone who submitted the
  Capstone (THE LAB). Replaces the register's THE LAB column: listed = submitted,
  everyone else = not submitted. No dates or deadlines are added.

Rules (nothing is invented):
  - Fellows are the people on the register; firm = organisation in Basic info.
    Anyone in Basic info but not on the register has left the cohort and is
    left out (their feedback too).
  - attended: register "Yes" or "Yes - not all of it" = yes, "No" = no.
    "Update Pending" = yes if the fellow sent feedback for that session,
    otherwise left blank and highlighted.
  - Feedback, reflections and ratings come from the feedback export. Reflections
    are copied exactly; the only change is repairing broken characters from an
    encoding error. Several submissions for one session are joined in order.
    Notes written to facilitators and the recommend score are left out.
  - Capstone: THE LAB "Yes" = submitted, "No" = not submitted, anything else
    is left out. The register has no deadline, so the deadline is highlighted.
  - logo_url and report_token are left blank so the site keeps the logos and
    links it already has. The authorised_users tab is left out so the
    recipients already on the site are kept.
"""
import re
import sys
import unicodedata
from datetime import date, timedelta

from openpyxl import load_workbook

sys.path.insert(0, 'scripts')
from build_data_template import build  # noqa: E402

args = sys.argv[1:]


def option(flag):
    if flag not in args:
        return None
    i = args.index(flag)
    value = args[i + 1]
    del args[i:i + 2]
    return value


FORMS = option('--forms')
SELF_UPDATES = option('--self-updates')
FEEDBACK, REGISTER, OUT = args[0], args[1], args[2]
CAPSTONE_LIST = args[3] if len(args) > 3 else None
fb = load_workbook(FEEDBACK, data_only=True)
reg = load_workbook(REGISTER, data_only=True)

COHORT = 'cohort-2026'
FIRST_SESSION = date(2026, 8, 17)
TOTAL_SESSIONS = 16  # "sixteen core sessions" in the application form

# Each held session: how to find it in the feedback export and the register,
# and which feedback columns hold "what I learned" / "what I'll apply".
# Column numbers are 0-based positions in "All INVCA-Investor"; the export
# puts the same question in different columns for different sessions.
SESSIONS = [
    # n, title, facilitator, feedback "Session" value, register columns, learned cols, apply cols
    (1, 'The state of VC in Africa, and how to build a fund', 'Zach, Launch Africa',
     'Zach', ['MASTERCLASS: 17th Aug - Launch Africa - Zach'], [], [8]),
    (2, 'AI as a thinking partner for investors', 'Mahdi, Humble AI',
     'Mahdi (Humble AI)', ['MASTERCLASS: 24th Aug - Humble AI - Mahdi'], [], [8]),
    (3, 'AI-enabled investment workflows: capture, context, judgement', 'Nic, Vula',
     'AI - Advanced - Nic (Vula)', ['MASTERCLASS: 31st Aug - AI - Nic'], [], [8, 5]),
    (4, 'Sourcing, founder judgement and your edge as an investor', 'Chris Tottman, Notion Capital',
     'Chris Tottman - Notion', ['MASTERCLASS: 7th Sept -Notion Capital - Chris'], [], [8, 5]),
    (5, 'Masterclass with Aditi Mishra, Sifted', 'Aditi Mishra, Sifted',
     'Aditi Mishra (Sifted)', ['MASTERCLASS: 14th Sept - Aditi (Sifted)'], [], [8, 5]),
    (6, 'Masterclass with Rosanne, AHL', 'Rosanne, AHL',
     'Rosanne (AHL)', ['MASTERCLASS: 21st Sep / AHL / Rossane'], [4], [8]),
    (7, 'Masterclass with Zee, FSDAi', 'Zee, FSDAi',
     'Zee (FSDAi)', ['MASTERCLASS: 28th Sep / FSDAi / Zee'], [4], [8]),
    (8, 'Thesis masterclass with Charnez, FMO', 'Charnez, FMO',
     'Charnez (FMO) / Thesis', ['MASTERCLASS: 5th Oct / FMO / Charnez'], [4], [7]),
    (9, 'Deep dives and research pieces with Unopa and Suad', 'Unopa and Suad',
     'Unopa & Suad - Deep Dives & Research Pieces',
     ['MASTERCLASS: 12th Oct / Deep Dives - Unopa', 'MASTERCLASS: 12th Oct / Deep Dives - Suad'], [4], [8]),
]
CONFIRMED_TITLES = {1, 2, 3, 4}  # as published in the sponsor progress report
RATING_COL, SUBMITTED_COL = 2, 12
LAB_COL = 'THE LAB - Typeform Complete (with links to project added)'

# Same person, different spelling in the two files.
ALIASES = {'idamwango': 'idamongare'}


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
    k = re.sub(r'[^a-z]', '', n.lower())
    return ALIASES.get(k, k)


def slug(s):
    n = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', n)).strip('-')


def tidy_name(name):
    name = ' '.join(str(name).split())
    return name.title() if name.isupper() else name


def norm_header(h):
    return ' '.join(str(h or '').split())


# ---------------- register(s) ----------------
def read_register(wb):
    """First sheet; header row is the one starting with "Name"."""
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    h = next(i for i, r in enumerate(rows[:10]) if r and str(r[0]).strip() == 'Name')
    cols = {norm_header(x): i for i, x in enumerate(rows[h]) if x}
    return cols, {key(r[0]): r for r in rows[h + 1:] if r and r[0]}


reg_col, register = read_register(reg)
forms_col, forms = read_register(load_workbook(FORMS, data_only=True)) if FORMS else ({}, {})
# The feedback-form column for each session, found by its date in the header.
FORM_DATES = {1: '17th Aug', 2: '24th Aug', 3: '31st Aug', 4: '7th Sep', 5: '14th Sept',
              6: '21st Sep', 7: '28th Sep', 8: '5th Oct', 9: '12th Oct'}
form_cols = {}
if FORMS:
    for n, d in FORM_DATES.items():
        found = [h for h in forms_col if h.startswith('NOTE (Typeform)') and d in h]
        assert len(found) == 1, f'feedback-form column for session {n}: {found}'
        form_cols[n] = forms_col[found[0]]
yno_forms, form_not_attended = [], []

# ---------------- fellows and firms (Basic info, register members only) ----------------
basic = fb['Basic info']
hdr = [c.value for c in basic[1]]
col = {h: i for i, h in enumerate(hdr)}
fellows, firms, firm_ids, fellow_by_key, left_out = [], [], {}, {}, []
for r in basic.iter_rows(min_row=2, values_only=True):
    if not r or not r[col['Full Name']]:
        continue
    full = tidy_name(r[col['Full Name']])
    if key(full) not in register:
        left_out.append(full)  # no longer in the cohort
        continue
    org = ' '.join(str(r[col['Your Organisation name']]).split())
    if org not in firm_ids:
        firm_ids[org] = 'firm-' + slug(org)
        firms.append({'firm_id': firm_ids[org], 'firm_name': org, 'cohort_id': COHORT, 'report_enabled': 'yes'})
    parts = full.split(' ')
    fid = 'fellow-' + slug(full)  # same IDs as earlier imports, so links stay the same
    fellows.append({
        'fellow_id': fid,
        'first_name': parts[0],
        'last_name': ' '.join(parts[1:]) or parts[0],
        'role': (r[col['Current job title']] or '').strip(),
        'firm_id': firm_ids[org],
        'cohort_id': COHORT,
    })
    fellow_by_key[key(full)] = fid
not_in_basic = [r[0] for k, r in register.items() if k not in fellow_by_key]

# ---------------- feedback ----------------
fb_rows = [r for r in fb['All INVCA-Investor'].iter_rows(min_row=2, values_only=True) if r and r[0] and r[1]]
feedback, unmatched = {}, set()
for r in fb_rows:
    fid = fellow_by_key.get(key(r[1]))
    if not fid:
        unmatched.add(r[1])
        continue
    feedback.setdefault((r[0], fid), []).append(r)


def rating_of(v):
    try:
        v = float(str(v).strip())
    except (TypeError, ValueError):
        return None
    if not 1 <= v <= 5:
        return None
    return int(v) if v.is_integer() else v


# ---------------- sessions and attendance ----------------
sessions, records, flags = [], [], {}
conflicts, pending_with_feedback = [], 0
for n, title, facilitator, fb_name, reg_cols, learned_cols, apply_cols in SESSIONS:
    sid = f's{n:02d}'
    sessions.append({
        'session_id': sid, 'cohort_id': COHORT, 'session_number': str(n), 'session_title': title,
        'session_date': (FIRST_SESSION + timedelta(weeks=n - 1)).isoformat(),
        'status': 'held', 'facilitator': facilitator,
    })
    if n not in CONFIRMED_TITLES:
        flags[('sessions', len(sessions) - 1)] = {
            'session_title': 'Working title from the facilitator and organisation. Replace with the real title.'}
    for f in fellows:
        fk = next(k for k, v in fellow_by_key.items() if v == f['fellow_id'])
        marks = [str(register[fk][reg_col[c]] or '').strip().lower() for c in reg_cols] if fk in register else []
        subs = feedback.get((fb_name, f['fellow_id']), [])
        if FORMS:
            attended = 'yes' if any(m.startswith('yes') for m in marks) else 'no'
            form = str(forms[fk][form_cols[n]] or '').strip().lower() if fk in forms else ''
            if form == 'y/no':
                yno_forms.append((f['fellow_id'], sid, bool(subs)))
            submitted = form == 'yes' or (form == 'y/no' and bool(subs))
            # Sending feedback for a session means they attended it.
            if attended != 'yes' and (submitted or subs):
                form_not_attended.append((f['fellow_id'], sid, marks, form, bool(subs)))
                attended = 'yes'
        elif any(m.startswith('yes') for m in marks):
            attended = 'yes'
        elif subs:
            attended = 'yes'
            if any(m == 'no' for m in marks):
                conflicts.append((f['fellow_id'], sid))
            else:
                pending_with_feedback += 1
        elif marks and all(m == 'no' for m in marks):
            attended = 'no'
        else:
            attended = ''
        if not FORMS:
            submitted = bool(subs)
        learned = [t for s in subs for i in learned_cols if (t := fix_text(s[i]))]
        apply = [t for s in subs for i in apply_cols if (t := fix_text(s[i]))]
        rating = next((x for s in subs if (x := rating_of(s[RATING_COL])) is not None), None)
        submitted_at = next((str(s[SUBMITTED_COL])[:10] for s in subs if s[SUBMITTED_COL]), '')
        records.append({
            'fellow_id': f['fellow_id'], 'session_id': sid, 'attended': attended,
            'feedback_submitted': 'yes' if submitted else 'no',
            'what_i_learned': '\n\n'.join(learned), 'what_ill_apply': '\n\n'.join(apply),
            'feedback_submitted_at': submitted_at,
            'session_rating': '' if rating is None else str(rating),
        })
        if attended == '':
            flags[('attendance_feedback', len(records) - 1)] = {
                'attended': ('Register says "Update Pending"' if fk in register else 'Not on the register')
                            + ' and there is no feedback. Enter yes or no (blank counts as not attended).'}
        elif (f['fellow_id'], sid) in conflicts:
            flags[('attendance_feedback', len(records) - 1)] = {
                'attended': 'Register says No, but the fellow sent feedback for this session. Check.'}

for n in range(len(sessions) + 1, TOTAL_SESSIONS + 1):
    sessions.append({
        'session_id': f's{n:02d}', 'cohort_id': COHORT, 'session_number': str(n), 'session_title': f'Session {n}',
        'session_date': (FIRST_SESSION + timedelta(weeks=n - 1)).isoformat(), 'status': 'scheduled', 'facilitator': '',
    })
    flags[('sessions', len(sessions) - 1)] = {
        'session_title': 'Upcoming session: add the title when known.',
        'session_date': 'Assumed: weekly Mondays from 17 August.'}

# ---------------- Capstone (THE LAB) ----------------
LAST_HELD = (FIRST_SESSION + timedelta(weeks=len(SESSIONS) - 1)).isoformat()
capstone, lab_pending, capstone_unknown = [], 0, []
listed = None
if CAPSTONE_LIST:
    names = [ln.strip() for ln in open(CAPSTONE_LIST, encoding='utf-8') if ln.strip()]
    listed = {key(n) for n in names}
    capstone_unknown = [n for n in names if key(n) not in fellow_by_key]
for f in fellows:
    fk = next(k for k, v in fellow_by_key.items() if v == f['fellow_id'])
    if listed is not None:
        capstone.append({
            'fellow_id': f['fellow_id'], 'recorded_at': LAST_HELD, 'submitted': 'yes' if fk in listed else 'no',
            'submission_date': '', 'submission_deadline': '', 'submitted_on_time': '',
            'assessment_status': 'pending' if fk in listed else 'not_started',
            'assessment_score': '', 'assessment_max_score': '', 'detailed_feedback': '',
        })
        continue
    mark = str(register[fk][reg_col[LAB_COL]] or '').strip().lower() if fk in register else ''
    if mark not in ('yes', 'no'):
        lab_pending += 1
        continue
    capstone.append({
        'fellow_id': f['fellow_id'], 'recorded_at': LAST_HELD, 'submitted': mark,
        'submission_date': '', 'submission_deadline': LAST_HELD, 'submitted_on_time': '',
        'assessment_status': 'pending' if mark == 'yes' else 'not_started',
        'assessment_score': '', 'assessment_max_score': '', 'detailed_feedback': '',
    })
    flags[('capstone', len(capstone) - 1)] = {
        'submission_deadline': 'Placeholder: the register has no deadline. Enter the real Capstone deadline.'}

held = [s['session_id'] for s in sessions if s['status'] == 'held']
# One checkpoint covering every session held, so reports show no checkpoint
# menu. The id stays cp-2026-2 so links made for it keep working.
checkpoints = [
    {'checkpoint_id': 'cp-2026-2', 'cohort_id': COHORT, 'checkpoint_title': 'Progress report',
     'reporting_date': LAST_HELD, 'session_ids': ';'.join(held), 'status': 'published'},
]

# ---------------- Checkpoint self updates ----------------
# From a sheet with "Name", "How many Yeses", "THIS IS HOW MANY ARE DONE" and
# "THIS IS HOW MANY THERE ARE" columns (the "Copy of INVAI26 - Mandatory" tab).
self_updates, self_missing = [], []
if SELF_UPDATES:
    su_wb = load_workbook(SELF_UPDATES, data_only=True)

    def su_sheet():
        for ws in su_wb.worksheets:
            for i, r in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True)):
                cells = [norm_header(x).lower() for x in (r or [])]
                if 'how many yeses' in cells and 'this is how many are done' in cells:
                    return ws, i + 1, cells
        raise SystemExit('No sheet with "How many Yeses" and "THIS IS HOW MANY ARE DONE" columns.')

    ws, hrow, cells = su_sheet()
    ci = {name: cells.index(name) for name in ('name', 'how many yeses', 'this is how many are done', 'this is how many there are')}
    figures = {}
    for r in ws.iter_rows(min_row=hrow + 1, values_only=True):
        if r and r[ci['name']] and r[ci['this is how many there are']]:
            figures[key(r[ci['name']])] = (int(r[ci['how many yeses']]), int(r[ci['this is how many are done']]),
                                           int(r[ci['this is how many there are']]))
    for k, fid in fellow_by_key.items():
        if k not in figures:
            self_missing.append(fid)
            continue
        done, filled, total = figures[k]
        self_updates.append({'fellow_id': fid, 'checkpoint_id': 'cp-2026-2', 'activities_completed': str(done),
                             'tracker_filled_in': str(filled), 'total_activities': str(total)})

TABLE_ROWS = {
    'cohorts': [{'cohort_id': COHORT, 'cohort_name': 'Africa Investor Fellowship 2026',
                 'programme_name': 'Africa Investor Fellowship', 'start_date': FIRST_SESSION.isoformat(),
                 'end_date': (FIRST_SESSION + timedelta(weeks=TOTAL_SESSIONS - 1)).isoformat()}],
    'firms': firms, 'fellows': fellows, 'sessions': sessions, 'attendance_feedback': records,
    'capstone': capstone, 'self_updates': self_updates, 'checkpoints': checkpoints, 'authorised_users': [],
}
flags[('cohorts', 0)] = {'end_date': 'Assumed: 16 weekly sessions. Check the real end date.'}

blank_attendance = sum(1 for r in records if r['attended'] == '')
submissions = sum(1 for r in records if r['feedback_submitted'] == 'yes')
intro = [
    ('LOADED FROM YOUR FEEDBACK EXPORT AND CHECKPOINT REGISTER', ''),
    ('Sources', f'{FEEDBACK.split("/")[-1]} · {REGISTER.split("/")[-1]}'),
    ('Loaded', f'{len(fellows)} fellows · {len(firms)} organisations · {len(held)} sessions held · '
               f'{submissions} feedback forms · {len(capstone)} Capstone (THE LAB) results'),
    ('Still to fill in', f'{blank_attendance} attendance cells ("Update Pending", no feedback) · titles for sessions 5–9'
                         + ('' if listed is not None else ' · Capstone deadline')),
    ('Kept as on the site', 'Logos, report links and recipients: logo_url and report_token are blank, and there is '
                            'no authorised_users tab, so uploading this file does not change them.'),
    ('Not included', 'Notes written to facilitators, the recommend score, decision journals and onboarding.'),
]
build(OUT, lambda tab: TABLE_ROWS[tab], flags=flags, examples=False, intro=intro)

# Leave recipients alone: a missing tab is not touched by the import.
wb = load_workbook(OUT)
if 'authorised_users' in wb.sheetnames:
    del wb['authorised_users']
wb.save(OUT)

print(f'fellows={len(fellows)} firms={len(firms)} held={len(held)} submissions={submissions} '
      f'attendance_blank={blank_attendance} pending_but_feedback={pending_with_feedback} conflicts={len(conflicts)} '
      f'capstone={len(capstone)} lab_pending={lab_pending} self_updates={len(self_updates)}')
if SELF_UPDATES:
    print('no self-update figures for:', self_missing)
print('left out (not on register):', left_out)
print('on register, not in Basic info:', not_in_basic)
print('feedback names not matched:', sorted(unmatched))
if FORMS:
    att = [r for r in records if r['attended'] == 'yes']
    print('forms counted:', sum(1 for r in att if r['feedback_submitted'] == 'yes'), 'of', len(att), 'attended')
    print('Y/NO forms (submitted?):', yno_forms)
    print('marked attended because of feedback:', form_not_attended)
if listed is not None:
    print('capstone submitted:', sum(1 for c in capstone if c['submitted'] == 'yes'), 'not matched:', capstone_unknown)
