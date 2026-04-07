export interface ReynoldsConsoleInput {
  labelKey: string;
  symbol: string;
  value: string;
  unit: string;
  derived?: boolean;
}

export interface ReynoldsConsoleStep {
  titleKey: string;
  expression: string;
}

export interface ReynoldsConsoleData {
  presetFluid: string;
  inputs: ReynoldsConsoleInput[];
  steps: ReynoldsConsoleStep[];
  result: {
    value: string;
    regimeKey: string;
  };
}
