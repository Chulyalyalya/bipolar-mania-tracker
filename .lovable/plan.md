
# Mania Tracker -- Full Implementation Plan

This is a comprehensive bipolar disorder tracking application with two user roles (doctor/patient), mania scoring across 7 blocks, IPSRT rhythm tracking, charting, risk alerts, and clinical PDF/CSV export. The implementation is broken into phases.

---

## Phase 1: Database Schema and Authentication

### Database migrations

**1a. Enums and core tables:**

- Create enum `app_role` ('doctor', 'patient')
- Alter existing `profiles` table to add: `role` (app_role), `doctor_code` (text, unique, nullable), `updated_at` (timestamptz)
- Create `doctor_patient_links` table (id, doctor_user_id, patient_user_id, status enum 'pending'/'active'/'revoked', created_at, updated_at)
- Create `entries` table (id, user_id, entry_date date, created_at, updated_at, unique constraint on user_id + entry_date)
- Create `mania_answers` table (id, entry_id, block_id 1-7, question_id, score 0-4)
- Create `ipsrt_anchors` table (entry_id, bedtime, wake_time, first_meal_time, last_meal_time, main_social_anchor_time -- all stored as TIME)
- Create `ipsrt_ratings` table (entry_id, rating_q1..q4 as smallint 0-4, rhythm_stability_score smallint 0-100)
- Create `entry_summaries` table (entry_id, block1_sum..block7_sum, total_risk_blocks_count, sustained_activation boolean, high_risk_sleep boolean)

**1b. RLS policies:**

- `entries`: patients read/write own data; doctors read linked patients' data
- `mania_answers`, `ipsrt_anchors`, `ipsrt_ratings`, `entry_summaries`: same pattern via entry_id join
- `profiles`: users read/update own; doctors can read profiles of linked patients
- `doctor_patient_links`: doctors read own links; patients read/create/update own links

**1c. Triggers:**

- Auto-create profile row on auth.users insert (trigger on auth.users)
- Generate unique 9-char doctor_code when role is set to 'doctor'

### Authentication UI

- Auth page with email+password sign up / sign in
- After sign-up: role selection screen ("Психолог/Психиатр" or "Пациент")
- Full name input
- Patient flow: optional doctor code entry ("Подключить врача" / "Пропустить")
- Auth context provider wrapping the app
- Protected routes

---

## Phase 2: Design System and Layout

### Theme and typography

- Import Montserrat from Google Fonts (regular 400 + medium 500)
- Update CSS variables to the specified palette:
  - Seafoam `#C0CACE` (primary/accents)
  - Ballerina `#ECECE7` (card backgrounds)
  - Linen (soft warm neutral for background)
  - Silence (muted grey-beige for secondary text)
  - Alert red `#FF0000`, alert green `#00A000`

### Global layout

- Persistent header with:
  - Patient: name (left), connected doctor or "добавить врача" (right)
  - Doctor: name (left), 9-char code + copy button (right)
- Global Date Selector below header (patient only):
  - Left arrow, "Today" button, right arrow
  - Tapping date opens calendar picker
  - Label: "Editing: {selected date}"
- Bottom navigation or sidebar for: Home, IPSRT, Settings

---

## Phase 3: Patient -- Mania Checker (7 Blocks)

### Home screen

- 7 cards, one per block, showing block name + today's sum + green/red indicator
- 1 card for IPSRT Rhythms showing today's stability score + color

### Block detail screen

- List of questions with 0-4 circle selectors on the right (0 = not at all ... 4 = extreme)
- Block total displayed with color coding (red if >4, green if <=4)
- Save / Update button (explicit save, no auto-save)
- "Clear entry for this date" with confirmation modal
- Line chart below: Date vs Block Total with range selector (7D / 30D / 90D)
  - Red dots where total >4, green/neutral otherwise

### All 7 blocks with their exact Russian question text as specified

### Data flow

- On save: upsert entry row, upsert mania_answers, compute block sums and update entry_summaries
- On date change: load existing entry or show empty form

---

## Phase 4: Patient -- IPSRT Rhythm Tracker

### IPSRT screen

- 5 time pickers for core anchors (bedtime, wake, first meal, main social anchor, last meal)
- 4 rhythm regularity ratings (0-4 circle scale), Russian labels as specified
- Computed Rhythm Stability Score (0-100) displayed with color (green 70-100, yellow 40-69, red 0-39)

### Baseline and scoring logic

- Rolling median of last 14 days with data for each time anchor
- Deviation in minutes from baseline reduces stability score
- Quick ratings contribute to final score
- Formula: weighted combination of time deviations and self-ratings

### Charts

- Chart 1: Date vs Rhythm Stability Score (0-100) with colored background bands
- Chart 2: Bedtime and Wake time trends (two lines)
- Range selector: 7D / 30D / 90D

---

## Phase 5: Risk Logic and Banners

- If any block total >4 today: mark that block card red on home screen
- If >=3 blocks have total >4 for 3-4 consecutive days: calm banner "Sustained activation pattern detected. Consider contacting your psychiatrist."
- If Block 1 high + bedtime/wake deviation very large: urgent red banner "High risk pattern. Consider immediate professional support."
- Store flags in entry_summaries (sustained_activation, high_risk_sleep)
- Clinical, calm, non-alarmist tone throughout

---

## Phase 6: Doctor Dashboard

- Patient list showing connected patients (name, last entry date, today risk indicator)
- Search by name
- Patient detail view (read-only):
  - Tabs: "Сводка" (summary last 14/30 days), "Графики" (all charts), "Экспорт PDF"
  - Same charts the patient sees
  - Doctor cannot edit patient data

---

## Phase 7: Data Export

### Settings / Data screen

- "Экспорт для врача (PDF)" button -- full clinical report
  - Date range picker (7/30/90/custom)
  - Toggles for what to include
  - Multi-page PDF with summary, charts, optional per-day appendix
  - Generated client-side using a library like jspdf + html2canvas

- "Краткое резюме для приёма (1 стр.)" button -- 1-page summary
  - Auto-generated rule-based observations (no AI speculation)
  - Sparkline, key metrics, risk flags

- CSV export (one row per date, all scores)
- JSON full backup export
- JSON import (optional)

### Privacy note

- "Your data is sensitive mental health information. Export only when necessary."

---

## Phase 8: Offline / Local Draft Support

- If user is not logged in: allow local draft storage in localStorage
- Show "Not synced" banner
- On login: offer to sync local data to account

---

## Technical Details

### File structure (new files)

```
src/
  contexts/
    AuthContext.tsx
    DateContext.tsx
  pages/
    Auth.tsx
    Onboarding.tsx
    ResetPassword.tsx
    PatientHome.tsx
    BlockDetail.tsx
    IpsrtScreen.tsx
    Settings.tsx
    DataExport.tsx
    DoctorDashboard.tsx
    DoctorPatientDetail.tsx
  components/
    GlobalHeader.tsx
    DateSelector.tsx
    CircleRating.tsx
    BlockCard.tsx
    IpsrtCard.tsx
    RiskBanner.tsx
    BlockChart.tsx
    IpsrtCharts.tsx
    AddDoctorModal.tsx
    ExportModal.tsx
    ShortSummaryModal.tsx
    TimePicker.tsx
  hooks/
    useEntry.ts
    useManiaAnswers.ts
    useIpsrtData.ts
    useRiskLogic.ts
    useBaselineMedian.ts
    useDoctorPatients.ts
  lib/
    questions.ts        (all 7 blocks with question text)
    ipsrtQuestions.ts
    riskEngine.ts
    rhythmScore.ts
    pdfGenerator.ts
    csvExport.ts
  types/
    index.ts
```

### Key libraries

- recharts (already installed) for all charts
- jspdf + html2canvas for PDF generation (new dependency)
- date-fns (already installed) for date manipulation

### Database tables summary

| Table | Purpose |
|-------|---------|
| profiles | User info, role, doctor_code |
| doctor_patient_links | Doctor-patient connections |
| entries | One row per user per date |
| mania_answers | Individual question scores |
| ipsrt_anchors | Daily time anchors |
| ipsrt_ratings | Daily rhythm self-ratings + computed score |
| entry_summaries | Precomputed block sums and risk flags |

### Implementation order

The phases above are listed in dependency order. Phase 1 (database + auth) must come first. Phases 3-4 can be done in parallel. Phase 5 depends on 3-4. Phase 6 depends on 1. Phase 7 depends on 3-5. Phase 8 is independent.

Given the size, I recommend implementing in multiple conversations, starting with Phase 1 (database + auth + onboarding), then Phase 2 (design system + layout + date selector), then Phases 3-4 (core tracking features), and so on.
