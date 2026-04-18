export type Severity = 'lockout' | 'warning' | 'info';

export type SymptomCategory =
  | 'no-ignition'
  | 'no-hot-water'
  | 'no-heating'
  | 'pressure'
  | 'leak'
  | 'noise'
  | 'fan'
  | 'condensate'
  | 'sensor';

export interface Model {
  id: string;
  name: string;
  seriesAliases?: string[];
}

export interface FaultCode {
  code: string;
  title: string;
  severity: Severity;
  appliesTo: string[] | 'all';
  summary: string;
  likelyCauses: string[];
  quickChecks: string[];
  linkedFlowcharts?: string[];
  partSearchHint?: string;
}

export type StepType = 'instruction' | 'measurement' | 'decision' | 'result';

export interface StepOption {
  label: string;
  next: string;
}

interface StepBase {
  id: string;
  body: string;
  image?: string;
}

export interface InstructionStep extends StepBase {
  type: 'instruction';
  next: string;
}

export interface MeasurementStep extends StepBase {
  type: 'measurement';
  expected: string;
  options: StepOption[];
}

export interface DecisionStep extends StepBase {
  type: 'decision';
  options: StepOption[];
}

export type ResultOutcome =
  | 'component-faulty'
  | 'needs-clean'
  | 'needs-service'
  | 'ok'
  | 'call-manufacturer';

export interface ResultStep extends StepBase {
  type: 'result';
  outcome: ResultOutcome;
  partSearchHint?: string;
}

export type Step = InstructionStep | MeasurementStep | DecisionStep | ResultStep;

export interface Flowchart {
  slug: string;
  title: string;
  symptomCategory: SymptomCategory;
  appliesTo: string[] | 'all';
  toolsNeeded: string[];
  safetyWarnings: string[];
  steps: Step[];
}

export interface BrandData {
  brand: string;
  slug: string;
  description: string;
  models: Model[];
  faultCodes: FaultCode[];
  flowcharts: Flowchart[];
}

export interface CommonTest {
  slug: string;
  title: string;
  summary: string;
  toolsNeeded: string[];
  safetyWarnings: string[];
  procedure: Step[];
  referenceTable?: Array<{ label: string; value: string }>;
}

export interface SearchHit {
  brandSlug: string;
  brandName: string;
  code: string;
  title: string;
  severity: Severity;
}
