export type FixtureTableName =
  | 'products'
  | 'sales'
  | 'traffic'
  | 'inventory'
  | 'suppliers'
  | 'categories'
  | 'titleSamples'
  | 'trendNotes'
  | 'supplierIssues';

export type TutorialAudience = 'first-time' | 'returning';

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  actionLabel?: string;
};

export type ExerciseTask = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  goal: string;
  estimatedMinutes: number;
  requiredTables: FixtureTableName[];
  steps: string[];
  expectedOutcome: string;
  skills: string[];
};

export type FixtureBundle = {
  id: string;
  name: string;
  description: string;
  period: { start: string; end: string; label: string };
  tables: Record<FixtureTableName, FixtureTableFixture>;
};

export type FixtureTableFixture = {
  name: FixtureTableName;
  label: string;
  description: string;
  primaryKey?: string;
  columns: FixtureColumn[];
  rows: Record<string, unknown>[];
};

export type FixtureColumn = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'enum';
  role: 'required' | 'recommended' | 'optional';
  aliases?: string[];
};
