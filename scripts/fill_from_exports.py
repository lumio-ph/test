"""
Fills the report data template from two programme files:

  FEEDBACK  the feedback export: "Basic info" (fellows and organisations) and
            "All INVCA-Investor" (every feedback form, one row per submission)
  REGISTER  the checkpoint register: "INVAI26 - Mandatory", one row per fellow,
            one Yes/No column per masterclass, plus THE LAB (Capstone)

Usage:
  python3 scripts/fill_from_exports.py FEEDBACK.xlsx REGISTER.xlsx OUT.xlsx

Rules (nothing is invented):
  - Fellows are everyone in Basic info; firm = organisation. People not on the
    register get attendance from their feedback only (other cells highlighted).
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

FEEDBACK, REGISTER, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
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


# ---------------- register ----------------
ws = reg['INVAI26 - Mandatory']
reg_rows = list(ws.iter_rows(values_only=True))
reg_hdr = [norm_header(h) for h in reg_rows[1]]
reg_col = {h: i for i, h in enumerate(reg_hdr) if h}
register = {key(r[0]): r for r in reg_rows[2:] if r and r[0]}

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
        left_out.append(full)  # still included; reported below
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
        if any(m.startswith('yes') for m in marks):
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
        learned = [t for s in subs for i in learned_cols if (t := fix_text(s[i]))]
        apply = [t for s in subs for i in apply_cols if (t := fix_text(s[i]))]
        rating = next((x for s in subs if (x := rating_of(s[RATING_COL])) is not None), None)
        submitted_at = next((str(s[SUBMITTED_COL])[:10] for s in subs if s[SUBMITTED_COL]), '')
        records.append({
            'fellow_id': f['fellow_id'], 'session_id': sid, 'attended': attended,
            'feedback_submitted': 'yes' if subs else 'no',
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
capstone, lab_pending = [], 0
for f in fellows:
    fk = next(k for k, v in fellow_by_key.items() if v == f['fellow_id'])
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
checkpoints = [
    {'checkpoint_id': 'cp-2026-1', 'cohort_id': COHORT, 'checkpoint_title': 'Checkpoint 1',
     'reporting_date': sessions[3]['session_date'], 'session_ids': ';'.join(held[:4]), 'status': 'published'},
    {'checkpoint_id': 'cp-2026-2', 'cohort_id': COHORT, 'checkpoint_title': 'Checkpoint 2',
     'reporting_date': LAST_HELD, 'session_ids': ';'.join(held), 'status': 'draft'},
]
flags[('checkpoints', 1)] = {'status': 'Draft until you have checked it. Publish in the admin (Send & access).'}

TABLE_ROWS = {
    'cohorts': [{'cohort_id': COHORT, 'cohort_name': 'Africa Investor Fellowship 2026',
                 'programme_name': 'Africa Investor Fellowship', 'start_date': FIRST_SESSION.isoformat(),
                 'end_date': (FIRST_SESSION + timedelta(weeks=TOTAL_SESSIONS - 1)).isoformat()}],
    'firms': firms, 'fellows': fellows, 'sessions': sessions, 'attendance_feedback': records,
    'capstone': capstone, 'checkpoints': checkpoints, 'authorised_users': [],
}
flags[('cohorts', 0)] = {'end_date': 'Assumed: 16 weekly sessions. Check the real end date.'}

blank_attendance = sum(1 for r in records if r['attended'] == '')
submissions = sum(1 for r in records if r['feedback_submitted'] == 'yes')
intro = [
    ('LOADED FROM YOUR FEEDBACK EXPORT AND CHECKPOINT REGISTER', ''),
    ('Sources', f'{FEEDBACK.split("/")[-1]} · {REGISTER.split("/")[-1]}'),
    ('Loaded', f'{len(fellows)} fellows · {len(firms)} organisations · {len(held)} sessions held · '
               f'{submissions} feedback forms · {len(capstone)} Capstone (THE LAB) results'),
    ('Still to fill in', f'{blank_attendance} attendance cells ("Update Pending", no feedback) · titles for sessions 5–9 · '
                         'Capstone deadline'),
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
      f'capstone={len(capstone)} lab_pending={lab_pending}')
print('included but not on register:', left_out)
print('on register, not in Basic info:', not_in_basic)
print('feedback names not matched:', sorted(unmatched))
