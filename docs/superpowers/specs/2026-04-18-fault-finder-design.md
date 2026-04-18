# Fault Finder — Toolbox Feature Design

**Date:** 2026-04-18
**Status:** Draft — awaiting user review
**Owner:** GasPilot
**Scope:** New toolbox module for boiler fault diagnosis

---

## 1. Goal

Give UK gas engineers a fast, offline, in-app reference for diagnosing boiler faults on the job. Two complementary modes:

1. **Fault-code lookup** — enter a code (e.g. `EA`, `F22`, `L2`), get a plain-English explanation and a list of likely causes.
2. **Interactive fault-finding flowcharts** — step-by-step diagnosis with yes/no branching, expected meter readings, and clear end-state conclusions.

Target user: a Gas Safe engineer standing in front of a locked-out boiler who needs a second opinion in under 30 seconds.

## 2. Non-goals

- Not a replacement for manufacturer service manuals.
- Not a parts catalogue — we link out to a third-party parts site for GC-number lookup rather than shipping specific part numbers.
- Not a training course — assumes the user is already a qualified engineer.
- No combustion / gas-rate troubleshooting (already covered by existing toolbox calculators).

## 3. Content sourcing & legal posture

All content is original, written from scratch for this app. The facts themselves (fault-code meanings, test-point voltages, resistance ranges, reset procedures) are sourced and cross-verified from:

- Publicly available manufacturer installation and service manuals.
- Established UK trade resources: engineer forums (e.g. PlumbersForums.net, Screwfix community), trade YouTube channels (Allen Hart, GasTrainee, BigGasHeating, Urban Plumbers), Gas Safe Register technical bulletins.
- General working knowledge of boiler diagnostics common to qualified engineers in the UK trade.

Every fact is independently verified against at least one of the sources above before inclusion. Any data point that cannot be cross-verified is either omitted or flagged in-app as "field report — verify on site".

Structure, ordering, wording, diagrams, and selection are all independently designed for this app.

A standing safety disclaimer appears in three places (home screen footer, first-run modal, top of every flowchart):

> For qualified Gas Safe engineers only. This guide provides general diagnostic steps based on publicly available information and common field experience. Always isolate gas and electrical supplies before testing. Readings and procedures vary by model — always refer to the manufacturer's installation and service manual for the specific appliance in front of you. GasPilot and its authors accept no liability for damage, injury, or loss arising from use of this guide.

A small "About this guide" link in the Fault Finder home clarifies that the content is original work of GasPilot, with no affiliation to any manufacturer.

## 4. Coverage for v1

| Brand | Fault codes | Flowcharts | Models prioritised |
|-------|-------------|------------|---------------------|
| Worcester Bosch | ~40 | deep | Greenstar Si Compact, Greenstar 30i/25i, Greenstar 4000, CDI range |
| Vaillant | ~35 | deep | ecoTEC plus, ecoTEC pro, Turbomax (F.x legacy codes) |
| Ideal | ~25 | deep | Logic+, Vogue, Evomax |
| Generic | short primer | — | cross-brand terminology (lockout, ignition fault, overheat) |

**Flowcharts (8 for v1, combi-focused):**

1. No ignition
2. No hot water, heating works (includes flow sensor voltage test)
3. No heating, hot water works
4. Low pressure / frequent topping up
5. PRV leaking outside
6. Boiler kettling / noisy
7. Fan fault diagnosis
8. Frozen condensate

**Reusable common tests:** flow sensor voltage test, NTC thermistor resistance table, fan winding resistance, gas valve coil resistance, flame rectification (µA) reference.

**Explicitly out of scope for v1:**

- Heat-only and system boilers (combi-focused for launch; 90%+ of UK installs)
- Worcester Highflow, legacy Vaillant Atmo/Turbomax bodies
- Photographs of boiler internals — line diagrams only
- Specific OEM part numbers in result screens — replaced by parts-finder link-out

## 5. Architecture

### 5.1 Entry point

A new tool row inserted in `app/(app)/toolbox/index.tsx` between "Water Hardness Lookup" and "Boiler Manuals":

```
label: "Fault Finder"
description: "Diagnose boiler faults by code or follow a step-by-step flowchart."
icon: "construct-outline"
onPress: router.push('/toolbox/fault-finder')
```

### 5.2 Routes

```
app/(app)/toolbox/fault-finder/
├── index.tsx                    # brand picker + global search
├── [brand].tsx                  # brand landing with tabs
├── [brand]/code/[code].tsx      # single fault-code detail
└── [brand]/flow/[slug].tsx      # flowchart viewer
```

### 5.3 Data layer — bundled JSON

Location: `src/data/faultFinder/`

```
src/data/faultFinder/
├── index.ts                     # barrel export + in-memory search index
├── types.ts                     # TypeScript interfaces
├── worcester.json
├── vaillant.json
├── ideal.json
├── generic.json
└── commonTests.json             # shared reusable tests
```

Loaded synchronously via `require()`. No network calls. Works entirely offline. Fits the existing `OfflineContext` pattern.

### 5.4 Schema

```ts
// src/data/faultFinder/types.ts

export type Severity = 'lockout' | 'warning' | 'info';

export interface BrandData {
  brand: string;                            // "Worcester Bosch"
  slug: string;                             // "worcester"
  description: string;                      // short blurb
  models: Model[];
  faultCodes: FaultCode[];
  flowcharts: Flowchart[];
}

export interface Model {
  id: string;                               // "greenstar-30i"
  name: string;                             // "Greenstar 30i"
  seriesAliases?: string[];
}

export interface FaultCode {
  code: string;                             // "EA"
  title: string;                            // "Flame not detected"
  severity: Severity;
  appliesTo: string[] | 'all';              // model ids
  summary: string;                          // one sentence plain English
  likelyCauses: string[];                   // bullet list
  quickChecks: string[];                    // 1-minute checks
  linkedFlowcharts?: string[];              // slug references
}

export interface Flowchart {
  slug: string;                             // "no-hot-water"
  title: string;
  symptomCategory: 'no-ignition' | 'no-hot-water' | 'no-heating'
                 | 'pressure' | 'leak' | 'noise' | 'fan' | 'condensate';
  appliesTo: string[] | 'all';
  toolsNeeded: string[];
  safetyWarnings: string[];
  steps: Step[];
}

export type Step =
  | InstructionStep
  | MeasurementStep
  | DecisionStep
  | ResultStep;

interface StepBase {
  id: string;
  body: string;
  image?: string;                           // asset key, resolved via require map
}

interface InstructionStep extends StepBase {
  type: 'instruction';
  next: string;                             // next step id
}

interface MeasurementStep extends StepBase {
  type: 'measurement';
  expected: string;                         // "5V DC"
  options: Array<{ label: string; next: string }>;
}

interface DecisionStep extends StepBase {
  type: 'decision';
  options: Array<{ label: string; next: string }>;
}

interface ResultStep extends StepBase {
  type: 'result';
  outcome: 'component-faulty' | 'needs-clean' | 'ok' | 'call-manufacturer';
  partSearchHint?: string;                  // e.g. "flow sensor" for parts link
}

export interface CommonTest {
  slug: string;
  title: string;
  toolsNeeded: string[];
  procedure: Step[];
  referenceTable?: Array<{ label: string; value: string }>;
}
```

### 5.5 Search index

Built once at mount time from all brand JSON files:

```ts
// flat index of { code, brand, title, severity } for fuzzy search
// match on code prefix, brand name, or title keywords
```

Kept in React context (`FaultFinderContext`) so the home-screen search box and any deep link can reuse it.

### 5.6 Assets

Line-drawing SVG diagrams generated for v1 as bundled assets:

```
assets/fault-finder/
├── worcester/
├── vaillant/
├── ideal/
└── common/                      # reusable probe diagrams, connector pinouts
```

Referenced by filename string in the JSON (e.g. `"image": "worcester/flow-sensor-connector.svg"`); resolved via a static `require` map to keep Metro bundler happy.

## 6. UX

### 6.1 Home screen (brand picker)

- Header: "Fault Finder" / "Search a code, pick a brand, or run a diagnosis"
- Persistent search bar at the top — cross-brand code search
- 2×2 grid of brand cards: Worcester, Vaillant, Ideal, Generic
- Amber safety-disclaimer card at the bottom

### 6.2 First-run consent modal

- Full-screen modal shown on first entry to Fault Finder
- Contains the full disclaimer text
- "I understand" button stores flag in `AsyncStorage`: `faultFinder.disclaimerAcceptedAt`
- Never shown again unless storage is cleared

### 6.3 Brand landing

- Model pill selector (`All models` default, then per-model pills)
- Segmented tabs: **Fault Codes** | **Flowcharts** | **Tests**
- Fault Codes tab: scrollable list grouped A–Z / 0–9, with severity chip
- Flowcharts tab: cards grouped by symptom category
- Tests tab: reusable common tests

### 6.4 Fault code detail

- Large code banner coloured by severity (red / amber / blue)
- Title + one-line summary
- Three collapsible sections: **Likely causes**, **Quick checks**, **Related diagnosis** (deep-links to flowcharts if available)
- If the code pertains to a replaceable component, a "Find this part" button links to Direct Heating Spares' parts search page

### 6.5 Flowchart viewer

- Header: progress dots (`Step 3 of 7`) + tools-needed chips + safety banner
- One step visible at a time, rendered by step type:
  - **Instruction** — prose + optional diagram + `Next` button
  - **Measurement** — prose + diagram + expected-value chip + outcome buttons
  - **Decision** — prose + option buttons
  - **Result** — outcome badge (green/amber/red), conclusion text, `Find this part` link-out when applicable, `Start over` button
- Breadcrumb strip at the bottom shows the path taken so the engineer can back up without restarting
- Swipe or back button reverses one step

### 6.6 Parts link-out

Outcome screens that name a component (e.g. "Fan assembly faulty") show a secondary button:

```
Find this part  →  https://www.directheatingspares.co.uk/
```

Opens via `WebBrowser.openBrowserAsync`. Engineer enters the boiler's GC number on that site. We do not ship part numbers in-app.

## 7. Error handling

- Invalid brand slug in route → redirect to Fault Finder home with a toast.
- Invalid code or flowchart slug → "Not found" screen with back button.
- Search returning zero matches → "No results. Try the brand pages." with quick-link chips.
- Disclaimer storage read failure → treat as not-accepted, show modal again. Fail-safe toward more safety, not less.

## 8. Testing strategy

- Unit tests (Jest): JSON loader validates every brand file against the schema at test time (catches malformed entries before shipping).
- Unit tests: search index builds correctly from a fixture JSON set.
- Unit tests: flowchart traversal — given a canned JSON, assert that following step options reaches the expected result.
- Snapshot tests: each route renders without crashing with sample data.
- Manual QA script: a checklist of representative codes and flows per brand, to walk through after every content edit.

## 9. Analytics (optional, future)

Not implemented in v1, but the design is compatible with a later hook:

- `faultFinder.codeViewed` (brand, code)
- `faultFinder.flowchartCompleted` (brand, slug, outcome)

Would help prioritise content expansion. No PII, no user-entered free text.

## 10. Theming, dark mode, Pro gating

- Uses existing `useAppTheme()` tokens throughout — no new colours added.
- Pro gate: **none**. Feature is free on all tiers. Calculators are already free; this joins them as a hook that keeps Starter users coming back and softens upgrade to Pro via exposure to the paperwork features alongside it.

## 11. File layout summary

```
app/(app)/toolbox/
├── index.tsx                                 # edited: new "Fault Finder" row
└── fault-finder/
    ├── index.tsx                             # home + search
    ├── [brand].tsx
    ├── [brand]/code/[code].tsx
    └── [brand]/flow/[slug].tsx

src/
├── context/FaultFinderContext.tsx            # search index provider
├── data/faultFinder/
│   ├── index.ts
│   ├── types.ts
│   ├── worcester.json
│   ├── vaillant.json
│   ├── ideal.json
│   ├── generic.json
│   └── commonTests.json
└── components/faultFinder/
    ├── BrandCard.tsx
    ├── CodeSeverityChip.tsx
    ├── FaultCodeList.tsx
    ├── FlowchartCard.tsx
    ├── FlowchartStepView.tsx
    ├── DisclaimerModal.tsx
    └── PartsLinkButton.tsx

assets/fault-finder/
├── worcester/*.svg
├── vaillant/*.svg
├── ideal/*.svg
└── common/*.svg
```

## 12. Open questions (none blocking v1)

- Should fault-code history be stored per user (recently viewed codes)? Would need `AsyncStorage`. Deferred.
- Eventual multi-language — all strings are in-JSON so translation is feasible later, but v1 ships English-only.

## 13. Implementation sequencing (high-level — detailed plan to follow)

1. Scaffold types, data loader, and empty JSON files with 2–3 seed entries per brand.
2. Build the disclaimer modal, home screen, brand picker.
3. Build the brand landing with tabs and the fault-code list / detail screens.
4. Build the flowchart viewer and one seed flowchart end-to-end.
5. Build reusable common-tests screen.
6. Bulk-write the remaining fault-code content per brand.
7. Author the remaining seven flowcharts.
8. Generate SVG diagrams for key steps.
9. Unit tests + manual QA pass.
10. Ship via OTA update (no native changes required).

A detailed implementation plan will follow in a separate document via the writing-plans skill.
