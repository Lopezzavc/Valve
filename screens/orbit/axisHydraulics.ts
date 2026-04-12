import Decimal from 'decimal.js';
import type { TemporalAnalysisConfig, TemporalPatternEntry } from './TemporalAnalysisAxisScreen';

Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -7,
  toExpPos: 21,
});

const LENGTH_FACTORS: Record<string, Decimal> = {
  m: new Decimal(1),
  mm: new Decimal('0.001'),
  cm: new Decimal('0.01'),
  km: new Decimal(1000),
  in: new Decimal('0.0254'),
  ft: new Decimal('0.3048'),
  yd: new Decimal('0.9144'),
  mi: new Decimal('1609.344'),
};

const FLOW_TO_LS_FACTORS: Record<string, Decimal> = {
  'l/s': new Decimal(1),
  'mÂ³/s': new Decimal(1000),
  'mÂ³/h': new Decimal(1000).div(3600),
  gpm: new Decimal('15.850323141489'),
};

const DEFAULT_PATTERN_VALUES = Array.from({ length: 24 }, () => '1');
const PLAYBACK_INTERVAL_MS = 700;
const CALCULATION_DECIMALS = 15;
const TANK_LEVEL_EPS = new Decimal('1e-9');
const TANK_HEAD_EPS = new Decimal('1e-8');
const TANK_FLOW_EPS = new Decimal('1e-10');
const MAX_TANK_ACTIVESET_ITERATIONS = 32;
const MAX_HYDRAULIC_OUTER_ITERATIONS = 200;
const MAX_HYDRAULIC_INNER_ITERATIONS = 120;
const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const HALF = new Decimal('0.5');
const ALPHA = new Decimal('0.65');
const NU = new Decimal('1e-6');
const G = new Decimal('9.81');
const PI = new Decimal(Math.PI);
const PIPE_LENGTH_MIN = new Decimal('0.1');
const PIPE_DIAMETER_FALLBACK_MM = new Decimal(10);
const PIPE_ROUGHNESS_FALLBACK_MM = new Decimal('0.001');
const FLOW_GUESS = new Decimal('0.001');

export { PLAYBACK_INTERVAL_MS };

export type AxisNodeType = 'nodo' | 'tanque' | 'reservorio';

export interface AxisNodeInputEntry {
  type: AxisNodeType;
  nodeId: string;
  patternId: string;
  x: string;
  xUnit: string;
  y: string;
  yUnit: string;
  z: string;
  zUnit: string;
  demanda: string;
  demandaUnit: string;
  nivelIni: string;
  nivelIniUnit: string;
  nivelMin: string;
  nivelMinUnit: string;
  nivelMax: string;
  nivelMaxUnit: string;
  diametro: string;
  diametroUnit: string;
}

export interface AxisConnectionInputEntry {
  type?: 'tuberia' | 'bomba';
  tubId: string;
  from: string;
  to: string;
  curveId?: string;
  curveCoefficients?: {
    a: number;
    b: number;
    c: number;
  };
  maxFlowLs?: number;
  longitud: string;
  diametro: string;
  diametroUnit: string;
  rugosidad: string;
  rugosidadUnit: string;
}

export interface AxisNodeResult {
  tipo: 'nodo';
  id: string;
  H: number;
  z: number;
  P: number;
  supplied: boolean;
}

export interface AxisTankResult {
  tipo: 'tanque';
  id: string;
  elevacion: number;
  level: number;
  H: number;
  volume: number;
  Qnet_m3s: number;
  Qnet_ls: number;
  atMin: boolean;
  atMax: boolean;
  mode: TankMode;
  stateLabel: string;
}

export interface AxisPipeResult {
  tipoEnlace: 'tuberia' | 'bomba';
  id: string;
  from: string;
  to: string;
  Q_ls: number;
  V_ms: number | null;
  f: number | null;
  R: number | null;
  curveId?: string;
  headGain_m?: number | null;
}

export interface AxisHydraulicStepResult {
  nodos: AxisNodeResult[];
  tanques: AxisTankResult[];
  tuberias: AxisPipeResult[];
  convergio: boolean;
}

export interface AxisHydraulicFrame {
  timeMinutes: number;
  result: AxisHydraulicStepResult;
}

export interface AxisHydraulicAnalysisResult {
  mode: 'steady' | 'extended';
  durationMinutes: number;
  stepMinutes: number;
  frames: AxisHydraulicFrame[];
  partial?: boolean;
  partialMessage?: string;
}

export type AxisCalculationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

type TankMode = 'min' | 'max' | 'locked' | null;

type PatternDefinition = {
  id: string;
  multipliers: Decimal[];
};

type PreparedNode = {
  tipo: 'nodo';
  id: string;
  x: Decimal;
  y: Decimal;
  elevacion: Decimal;
  demandaLs: Decimal;
  patternId: string;
};

type PreparedReservoir = {
  tipo: 'reservorio';
  id: string;
  x: Decimal;
  y: Decimal;
  head: Decimal;
};

type PreparedTank = {
  tipo: 'tanque';
  id: string;
  x: Decimal;
  y: Decimal;
  elevacion: Decimal;
  nivelInicial: Decimal;
  nivelMinimo: Decimal;
  nivelMaximo: Decimal;
  diametroM: Decimal;
  area: Decimal;
  volumenMinimo: Decimal;
  volumenMaximo: Decimal;
  volumenInicial: Decimal;
};

type PreparedPipe = {
  id: string;
  tipoEnlace: 'tuberia' | 'bomba';
  from: string;
  to: string;
  longitudM: Decimal | null;
  diametroM: Decimal | null;
  rugosidadM: Decimal | null;
  curveId?: string;
  curveCoefficients?: {
    a: Decimal;
    b: Decimal;
    c: Decimal;
  } | null;
  maxFlowLs?: Decimal | null;
};

type TankState = {
  level: Decimal;
  volume: Decimal;
  head: Decimal;
  atMin: boolean;
  atMax: boolean;
};

type TankStateMap = Record<string, TankState>;
type TankModeMap = Record<string, TankMode>;

type InternalNodeResult = AxisNodeResult;
type InternalTankResult = AxisTankResult & { tanque: PreparedTank };
type InternalPipeResult = AxisPipeResult;

type HydraulicSolverResult = {
  nodos: InternalNodeResult[];
  tanques: InternalTankResult[];
  tuberias: InternalPipeResult[];
  convergio: boolean;
  unsuppliedNodes: string[];
  rawTankStates: Record<
    string,
    {
      volume: Decimal;
      head: Decimal;
      Qnet_m3s: Decimal;
      mode: TankMode;
    }
  >;
  solverState: {
    H: Decimal[];
    Q: Decimal[];
    tanks: TankStateMap;
  };
};

type WarmStartState = {
  H: Decimal[] | null;
  Q: Decimal[] | null;
  tanks: TankStateMap;
};

type PreparedModel = {
  nodos: PreparedNode[];
  reservorios: PreparedReservoir[];
  tanques: PreparedTank[];
  pipes: PreparedPipe[];
};

function success<T>(data: T, warnings: string[] = []): AxisCalculationResult<T> {
  return { ok: true, data, warnings };
}

function failure<T>(error: string, warnings: string[] = []): AxisCalculationResult<T> {
  return { ok: false, error, warnings };
}

function parseDecimalValue(rawValue: string | undefined | null): Decimal | null {
  if (rawValue === undefined || rawValue === null) return null;
  const normalized = String(rawValue).trim().replace(',', '.');
  if (normalized === '') return null;
  try {
    const parsed = new Decimal(normalized);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function roundCalculatedValue(value: Decimal.Value): number {
  const decimalValue = new Decimal(value);
  const rounded = decimalValue.toDecimalPlaces(CALCULATION_DECIMALS);
  return rounded.abs().lt('1e-15') ? 0 : rounded.toNumber();
}

function normalizeTemporalMultipliers(values?: string[]): string[] {
  return Array.from({ length: 24 }, (_, index) => values?.[index] ?? DEFAULT_PATTERN_VALUES[index]);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatTimeMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function getPatternHourIndex(timeMinutes: number): number {
  const normalized = ((Math.floor(timeMinutes) % 1440) + 1440) % 1440;
  return Math.floor(normalized / 60);
}

export function getPatternHourLabel(timeMinutes: number): string {
  return `H${pad2(getPatternHourIndex(timeMinutes))}`;
}

export function buildAnalysisInstants(durationMinutes: number, stepMinutes: number): number[] {
  const instants = [0];
  if (stepMinutes <= 0 || durationMinutes <= 0) return instants;
  for (let t = stepMinutes; t < durationMinutes; t += stepMinutes) {
    instants.push(t);
  }
  if (instants[instants.length - 1] !== durationMinutes) {
    instants.push(durationMinutes);
  }
  return instants;
}

function readStrictNonNegativeInt(rawValue: string, label: string, max?: number): AxisCalculationResult<number> {
  const trimmed = rawValue.trim();
  if (trimmed === '') return success(0);
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return failure(`${label} debe ser un entero no negativo.`);
  }
  if (max !== undefined && parsed > max) {
    return failure(`${label} no puede ser mayor que ${max}.`);
  }
  return success(parsed);
}

function readHourMinutePairStrict(
  hoursRaw: string,
  minutesRaw: string,
  label: string
): AxisCalculationResult<{ hours: number; minutes: number; totalMinutes: number }> {
  const hoursResult = readStrictNonNegativeInt(hoursRaw, `${label} (horas)`);
  if (!hoursResult.ok) return hoursResult;
  const minutesResult = readStrictNonNegativeInt(minutesRaw, `${label} (minutos)`, 59);
  if (!minutesResult.ok) return minutesResult;
  return success({
    hours: hoursResult.data,
    minutes: minutesResult.data,
    totalMinutes: hoursResult.data * 60 + minutesResult.data,
  });
}

function readRequiredDecimal(rawValue: string, label: string): AxisCalculationResult<Decimal> {
  const trimmed = rawValue.trim();
  if (trimmed === '') return failure(`${label} es obligatorio.`);
  const value = parseDecimalValue(trimmed);
  if (!value) return failure(`${label} debe ser un numero valido.`);
  return success(value);
}

function readOptionalDecimal(rawValue: string, fallback: Decimal): Decimal {
  return parseDecimalValue(rawValue) ?? fallback;
}

function assertDecimalRange(
  value: Decimal,
  label: string,
  options: {
    min?: Decimal;
    max?: Decimal;
    strictMin?: boolean;
    strictMax?: boolean;
  } = {}
): AxisCalculationResult<Decimal> {
  const { min, max, strictMin, strictMax } = options;
  if (min) {
    if (strictMin ? value.lte(min) : value.lt(min)) {
      return failure(
        strictMin ? `${label} debe ser mayor que ${min.toString()}.` : `${label} no puede ser menor que ${min.toString()}.`
      );
    }
  }
  if (max) {
    if (strictMax ? value.gte(max) : value.gt(max)) {
      return failure(
        strictMax ? `${label} debe ser menor que ${max.toString()}.` : `${label} no puede ser mayor que ${max.toString()}.`
      );
    }
  }
  return success(value);
}

function convertLengthToMeters(rawValue: string, unit: string, label: string): AxisCalculationResult<Decimal> {
  const parsed = readRequiredDecimal(rawValue, label);
  if (!parsed.ok) return parsed;
  const factor = LENGTH_FACTORS[unit] ?? ONE;
  return success(parsed.data.times(factor));
}

function convertOptionalLengthToMeters(rawValue: string, unit: string): Decimal {
  const factor = LENGTH_FACTORS[unit] ?? ONE;
  return readOptionalDecimal(rawValue, ZERO).times(factor);
}

function convertDemandToLs(rawValue: string, unit: string, fallback: Decimal = ZERO): Decimal {
  const factor = FLOW_TO_LS_FACTORS[unit] ?? ONE;
  return readOptionalDecimal(rawValue, fallback).times(factor);
}

function decimalClamp(value: Decimal, min: Decimal, max: Decimal): Decimal {
  return Decimal.min(Decimal.max(value, min), max);
}

function calculateTankArea(diameterMeters: Decimal): Decimal {
  return PI.times(diameterMeters.pow(2)).div(4);
}

function cloneTankStates(tankStates: TankStateMap = {}): TankStateMap {
  const clone: TankStateMap = {};
  Object.keys(tankStates).forEach(id => {
    const state = tankStates[id];
    clone[id] = {
      level: new Decimal(state.level),
      volume: new Decimal(state.volume),
      head: new Decimal(state.head),
      atMin: state.atMin,
      atMax: state.atMax,
    };
  });
  return clone;
}

function normalizeTankState(tank: PreparedTank, currentState: Partial<TankState> | null = null): TankState {
  const baseLevel = currentState?.level !== undefined ? new Decimal(currentState.level) : tank.nivelInicial;
  const level = decimalClamp(baseLevel, tank.nivelMinimo, tank.nivelMaximo);

  const baseVolume = currentState?.volume !== undefined ? new Decimal(currentState.volume) : tank.area.times(level);
  const volume = decimalClamp(baseVolume, tank.volumenMinimo, tank.volumenMaximo);
  const normalizedLevel = decimalClamp(volume.div(tank.area), tank.nivelMinimo, tank.nivelMaximo);

  const levelFinal = normalizedLevel.lte(tank.nivelMinimo.plus(TANK_LEVEL_EPS))
    ? tank.nivelMinimo
    : normalizedLevel.gte(tank.nivelMaximo.minus(TANK_LEVEL_EPS))
      ? tank.nivelMaximo
      : normalizedLevel;

  return {
    level: levelFinal,
    volume: tank.area.times(levelFinal),
    head: tank.elevacion.plus(levelFinal),
    atMin: levelFinal.lte(tank.nivelMinimo.plus(TANK_LEVEL_EPS)),
    atMax: levelFinal.gte(tank.nivelMaximo.minus(TANK_LEVEL_EPS)),
  };
}

function getMinimumTankHead(tank: PreparedTank): Decimal {
  return tank.elevacion.plus(tank.nivelMinimo);
}

function getMaximumTankHead(tank: PreparedTank): Decimal {
  return tank.elevacion.plus(tank.nivelMaximo);
}

function getTankHeadByMode(tank: PreparedTank, tankState: TankState, mode: TankMode): Decimal {
  if (mode === 'min') return getMinimumTankHead(tank);
  if (mode === 'max') return getMaximumTankHead(tank);
  return tankState.head;
}

function buildInitialTankStates(tanks: PreparedTank[], initialTankStates: TankStateMap | null = null): TankStateMap {
  const tankStates: TankStateMap = {};
  tanks.forEach(tank => {
    tankStates[tank.id] = normalizeTankState(tank, initialTankStates ? initialTankStates[tank.id] ?? null : null);
  });
  return tankStates;
}

function getTankLimitMode(state: TankState | null | undefined): TankMode {
  if (!state) return null;
  if (state.atMin && state.atMax) return 'locked';
  if (state.atMin) return 'min';
  if (state.atMax) return 'max';
  return null;
}

function buildTankModes(tanks: PreparedTank[], tankStates: TankStateMap): TankModeMap {
  const modes: TankModeMap = {};
  tanks.forEach(tank => {
    modes[tank.id] = getTankLimitMode(tankStates[tank.id]);
  });
  return modes;
}

function isDirectionBlockedAtEndpoint(
  endpointId: string,
  qCandidate: Decimal,
  side: 'from' | 'to',
  tankModes: TankModeMap
): boolean {
  const mode = tankModes[endpointId];
  if (!mode) return false;
  if (mode === 'locked') return true;
  if (qCandidate.abs().lte(TANK_FLOW_EPS)) return false;

  if (side === 'from') {
    if (mode === 'min') return qCandidate.gt(ZERO);
    if (mode === 'max') return qCandidate.lt(ZERO);
  } else {
    if (mode === 'min') return qCandidate.lt(ZERO);
    if (mode === 'max') return qCandidate.gt(ZERO);
  }

  return false;
}

function isDirectionBlockedByTank(pipe: PreparedPipe, qCandidate: Decimal, tankModes: TankModeMap): boolean {
  return (
    isDirectionBlockedAtEndpoint(pipe.from, qCandidate, 'from', tankModes) ||
    isDirectionBlockedAtEndpoint(pipe.to, qCandidate, 'to', tankModes)
  );
}

function evaluatePumpCurve(
  coefficients: PreparedPipe['curveCoefficients'],
  flowLs: Decimal,
): Decimal | null {
  if (!coefficients) return null;
  return coefficients.a.plus(coefficients.b.times(flowLs)).plus(coefficients.c.times(flowLs.pow(2)));
}

function evaluatePumpCurveSlope(
  coefficients: PreparedPipe['curveCoefficients'],
  flowLs: Decimal,
): Decimal | null {
  if (!coefficients) return null;
  return coefficients.b.plus(coefficients.c.times(2).times(flowLs));
}

function calculatePumpRestrictedFlow(
  pipe: PreparedPipe,
  getHead: (id: string) => Decimal,
  tankModes: TankModeMap,
  flowGuessM3s: Decimal = ZERO,
): {
  Q: Decimal;
  dQdDH: Decimal;
} {
  const dH = getHead(pipe.from).minus(getHead(pipe.to));
  const q0 = Decimal.max(flowGuessM3s, ZERO);
  const q0Ls = q0.times(1000);
  const headGain0 = evaluatePumpCurve(pipe.curveCoefficients ?? null, q0Ls) ?? ZERO;

  let slope = evaluatePumpCurveSlope(pipe.curveCoefficients ?? null, q0Ls)?.times(1000) ?? null;
  if (!slope || !slope.isFinite() || slope.gte('-1e-9')) {
    const fallbackFlowLs = Decimal.max(q0Ls, pipe.maxFlowLs ?? ONE);
    slope = evaluatePumpCurveSlope(pipe.curveCoefficients ?? null, fallbackFlowLs)?.times(1000) ?? null;
  }
  if (!slope || !slope.isFinite() || slope.gte('-1e-9')) {
    slope = ONE.neg();
  }

  let qTrial = q0.minus(dH.plus(headGain0).div(slope));
  if (!qTrial.isFinite()) qTrial = ZERO;
  qTrial = Decimal.max(qTrial, ZERO);

  if (pipe.maxFlowLs && pipe.maxFlowLs.gt(ZERO)) {
    qTrial = Decimal.min(qTrial, pipe.maxFlowLs.div(1000));
  }

  if (isDirectionBlockedByTank(pipe, qTrial, tankModes)) {
    return {
      Q: ZERO,
      dQdDH: ZERO,
    };
  }

  return {
    Q: qTrial,
    dQdDH: Decimal.max(ONE.neg().div(slope), ZERO),
  };
}

function getTankStateLabel(result: { atMin: boolean; atMax: boolean }): string {
  if (result.atMin && result.atMax) return 'Bloqueado';
  if (result.atMin) return 'Minimo';
  if (result.atMax) return 'Maximo';
  return 'Libre';
}

function buildFixedTankHeads(
  tanks: PreparedTank[],
  tankStates: TankStateMap,
  tankModes: TankModeMap,
  intervalSeconds: Decimal
): Record<string, Decimal> {
  const fixedHeads: Record<string, Decimal> = {};
  tanks.forEach(tank => {
    const mode = tankModes[tank.id];
    if (!intervalSeconds.gt(ZERO) || mode) {
      fixedHeads[tank.id] = getTankHeadByMode(tank, tankStates[tank.id], mode);
    }
  });
  return fixedHeads;
}

function buildVariableTanks(tanks: PreparedTank[], fixedTankHeads: Record<string, Decimal>): PreparedTank[] {
  return tanks.filter(tank => !Object.prototype.hasOwnProperty.call(fixedTankHeads, tank.id));
}

function calculateRestrictedFlow(
  pipe: PreparedPipe,
  resistance: Decimal,
  getHead: (id: string) => Decimal,
  tankModes: TankModeMap
): {
  Q: Decimal;
  dQdDH: Decimal;
} {
  if (pipe.tipoEnlace === 'bomba') {
    return calculatePumpRestrictedFlow(pipe, getHead, tankModes, ZERO);
  }

  const dH = getHead(pipe.from).minus(getHead(pipe.to));
  const absDH = Decimal.max(dH.abs(), new Decimal('1e-8'));
  const qTrial = dH.gte(ZERO)
    ? absDH.div(Decimal.max(resistance, new Decimal('1e-12'))).sqrt()
    : absDH.div(Decimal.max(resistance, new Decimal('1e-12'))).sqrt().neg();

  if (isDirectionBlockedByTank(pipe, qTrial, tankModes)) {
    return {
      Q: ZERO,
      dQdDH: ZERO,
    };
  }

  return {
    Q: qTrial,
    dQdDH: HALF.div(Decimal.max(resistance, new Decimal('1e-12')).times(absDH).sqrt()),
  };
}

function gaussianEliminationDecimal(matrix: Decimal[][], vector: Decimal[]): Decimal[] | null {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let maxRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (augmented[row][column].abs().gt(augmented[maxRow][column].abs())) {
        maxRow = row;
      }
    }

    [augmented[column], augmented[maxRow]] = [augmented[maxRow], augmented[column]];

    if (augmented[column][column].abs().lt('1e-12')) {
      return null;
    }

    const pivot = augmented[column][column];
    for (let row = column + 1; row < size; row += 1) {
      const factor = augmented[row][column].div(pivot);
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] = augmented[row][index].minus(factor.times(augmented[column][index]));
      }
    }
  }

  const solution: Decimal[] = Array.from({ length: size }, () => ZERO);
  for (let row = size - 1; row >= 0; row -= 1) {
    let value = augmented[row][size];
    for (let column = row + 1; column < size; column += 1) {
      value = value.minus(augmented[row][column].times(solution[column]));
    }
    solution[row] = value.div(augmented[row][row]);
  }

  return solution;
}

function validateConnectivityWithSources(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  options: {
    tankStates: TankStateMap;
    tankLimitModes: TankModeMap;
    variableTankIds: Set<string> | null;
    fixedTankHeads: Record<string, Decimal> | null;
  }
): { ok: boolean; nodosAislados: string[]; visitados: string[] } {
  const { tankStates, tankLimitModes, variableTankIds, fixedTankHeads } = options;
  const sourceIds = new Set(reservoirs.map(reservoir => reservoir.id));

  tanks.forEach(tank => {
    const mode = tankLimitModes[tank.id];
    const isVariableTank = variableTankIds ? variableTankIds.has(tank.id) : mode === null;
    const isFixedTank = fixedTankHeads
      ? Object.prototype.hasOwnProperty.call(fixedTankHeads, tank.id)
      : !isVariableTank;
    if ((isVariableTank || isFixedTank) && mode !== 'min' && mode !== 'locked' && tankStates[tank.id]) {
      sourceIds.add(tank.id);
    }
  });

  const adjacency: Record<string, string[]> = {};
  [...nodes, ...reservoirs, ...tanks].forEach(entry => {
    adjacency[entry.id] = [];
  });

  pipes.forEach(pipe => {
    if (!pipe.from || !pipe.to || pipe.from === pipe.to) return;
    if (pipe.tipoEnlace === 'bomba') {
      if (!isDirectionBlockedByTank(pipe, ONE, tankLimitModes)) adjacency[pipe.from].push(pipe.to);
      return;
    }
    if (!isDirectionBlockedByTank(pipe, ONE, tankLimitModes)) adjacency[pipe.from].push(pipe.to);
    if (!isDirectionBlockedByTank(pipe, ONE.neg(), tankLimitModes)) adjacency[pipe.to].push(pipe.from);
  });

  const visited = new Set<string>();
  const queue: string[] = [];

  sourceIds.forEach(id => {
    visited.add(id);
    queue.push(id);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency[current] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const isolatedNodes = nodes.map(node => node.id).filter(id => !visited.has(id));
  return {
    ok: isolatedNodes.length === 0,
    nodosAislados: isolatedNodes,
    visitados: Array.from(visited),
  };
}

function solveDarcyFriction(roughnessMeters: Decimal, diameterMeters: Decimal, reynolds: Decimal): Decimal {
  const minFriction = new Decimal('0.001');
  if (reynolds.lt(2300)) {
    return Decimal.max(new Decimal(64).div(reynolds), minFriction);
  }

  let friction = new Decimal('0.025');
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const sqrtF = friction.sqrt();
    const arg = roughnessMeters.div(diameterMeters.times('3.7')).plus(new Decimal('2.51').div(reynolds.times(sqrtF)));
    if (arg.lte(ZERO)) break;
    const rhs = Decimal.log10(arg).times(-2);
    const next = ONE.div(rhs.times(rhs));
    if (next.minus(friction).abs().lt('1e-9')) {
      friction = next;
      break;
    }
    friction = next;
  }

  return Decimal.max(friction, minFriction);
}

function solveHydraulicCore(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  tankStates: TankStateMap,
  options: {
    demandOverrides?: Record<string, Decimal>;
    initialHeads?: Decimal[] | null;
    initialFlows?: Decimal[] | null;
    intervalSeconds?: Decimal;
    fixedTankHeads?: Record<string, Decimal>;
    tankLimitModes?: TankModeMap;
  } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const demandOverrides = options.demandOverrides ?? null;
  const initialHeads = options.initialHeads ?? null;
  const initialFlows = options.initialFlows ?? null;
  const intervalSeconds = options.intervalSeconds ?? ZERO;
  const fixedTankHeads = options.fixedTankHeads ?? {};
  const tankLimitModes = options.tankLimitModes ?? {};
  const variableTanks = buildVariableTanks(tanks, fixedTankHeads);
  const variableTankIds = new Set(variableTanks.map(tank => tank.id));

  const connectivity = validateConnectivityWithSources(nodes, reservoirs, tanks, pipes, {
    tankStates,
    tankLimitModes,
    variableTankIds,
    fixedTankHeads,
  });

  const activePointIds = new Set(connectivity.visitados);
  const unsuppliedNodeIds = new Set(connectivity.nodosAislados);
  const activeNodes = nodes.filter(node => !unsuppliedNodeIds.has(node.id));
  const activeVariableTanks = variableTanks.filter(tank => activePointIds.has(tank.id));

  const nodeOrderIndex: Record<string, number> = {};
  nodes.forEach((node, index) => {
    nodeOrderIndex[node.id] = index;
  });

  const fixedHeads: Record<string, Decimal> = {};
  reservoirs.forEach(reservoir => {
    fixedHeads[reservoir.id] = reservoir.head;
  });
  Object.keys(fixedTankHeads).forEach(id => {
    fixedHeads[id] = fixedTankHeads[id];
  });

  const variableIds = [...activeNodes.map(node => node.id), ...activeVariableTanks.map(tank => tank.id)];
  const variableIndex: Record<string, number> = {};
  variableIds.forEach((id, index) => {
    variableIndex[id] = index;
  });

  const headsFromSources = [
    ...reservoirs.map(reservoir => reservoir.head),
    ...Object.keys(fixedTankHeads).map(id => fixedTankHeads[id]),
    ...activeVariableTanks.map(tank => tankStates[tank.id].head),
  ];
  const avgSourceHead = headsFromSources.length > 0
    ? headsFromSources.reduce((acc, value) => acc.plus(value), ZERO).div(headsFromSources.length)
    : ZERO;

  const allHeads: Decimal[] = new Array(nodes.length).fill(ZERO);
  nodes.forEach((node, index) => {
    if (unsuppliedNodeIds.has(node.id)) {
      allHeads[index] = node.elevacion;
      return;
    }
    if (initialHeads && initialHeads.length === nodes.length) {
      allHeads[index] = new Decimal(initialHeads[index]);
      return;
    }
    allHeads[index] = Decimal.max(node.elevacion.plus(10), avgSourceHead.minus(5));
  });

  const X: Decimal[] = Array.from({ length: variableIds.length }, () => ZERO);
  activeNodes.forEach(node => {
    X[variableIndex[node.id]] = allHeads[nodeOrderIndex[node.id]];
  });
  activeVariableTanks.forEach(tank => {
    X[variableIndex[tank.id]] = tankStates[tank.id].head;
  });

  const flows: Decimal[] =
    initialFlows && initialFlows.length === pipes.length
      ? initialFlows.map(flow => new Decimal(flow))
      : new Array(pipes.length).fill(FLOW_GUESS);

  const activePipeMask = pipes.map(pipe => activePointIds.has(pipe.from) && activePointIds.has(pipe.to));

  const getHead = (id: string): Decimal => {
    if (Object.prototype.hasOwnProperty.call(fixedHeads, id)) return fixedHeads[id];
    const index = variableIndex[id];
    return index !== undefined ? X[index] : ZERO;
  };

  let converged = false;

  for (let outer = 0; outer < MAX_HYDRAULIC_OUTER_ITERATIONS; outer += 1) {
    const resistances = pipes.map((pipe, index) => {
      if (!activePipeMask[index]) return ZERO;
      if (pipe.tipoEnlace === 'bomba') return ZERO;
      if (!pipe.longitudM || !pipe.diametroM || !pipe.rugosidadM) return ZERO;
      const length = Decimal.max(pipe.longitudM, PIPE_LENGTH_MIN);
      const diameter = Decimal.max(pipe.diametroM, PIPE_DIAMETER_FALLBACK_MM.div(1000));
      const roughness = Decimal.max(pipe.rugosidadM, PIPE_ROUGHNESS_FALLBACK_MM.div(1000));
      const area = PI.times(diameter.pow(2)).div(4);
      const qAbs = Decimal.max(flows[index].abs(), new Decimal('1e-9'));
      const velocity = qAbs.div(area);
      const reynolds = Decimal.max(velocity.times(diameter).div(NU), ONE);
      const friction = solveDarcyFriction(roughness, diameter, reynolds);
      return new Decimal(8).times(friction).times(length).div(PI.pow(2).times(G).times(diameter.pow(5)));
    });

    let convergedInner = false;

    if (variableIds.length === 0) {
      convergedInner = true;
    } else {
      for (let inner = 0; inner < MAX_HYDRAULIC_INNER_ITERATIONS; inner += 1) {
        const F: Decimal[] = Array.from({ length: variableIds.length }, () => ZERO);
        const J: Decimal[][] = Array.from({ length: variableIds.length }, () =>
          Array.from({ length: variableIds.length }, () => ZERO)
        );

        for (let pipeIndex = 0; pipeIndex < pipes.length; pipeIndex += 1) {
          if (!activePipeMask[pipeIndex]) continue;
          const pipe = pipes[pipeIndex];
          if (!pipe.from || !pipe.to || pipe.from === pipe.to) continue;

          const flowData = pipe.tipoEnlace === 'bomba'
            ? calculatePumpRestrictedFlow(pipe, getHead, tankLimitModes, flows[pipeIndex])
            : calculateRestrictedFlow(pipe, resistances[pipeIndex], getHead, tankLimitModes);
          const fromIndex = variableIndex[pipe.from];
          const toIndex = variableIndex[pipe.to];

          if (fromIndex !== undefined) {
            F[fromIndex] = F[fromIndex].minus(flowData.Q);
            J[fromIndex][fromIndex] = J[fromIndex][fromIndex].minus(flowData.dQdDH);
            if (toIndex !== undefined) {
              J[fromIndex][toIndex] = J[fromIndex][toIndex].plus(flowData.dQdDH);
            }
          }

          if (toIndex !== undefined) {
            F[toIndex] = F[toIndex].plus(flowData.Q);
            J[toIndex][toIndex] = J[toIndex][toIndex].minus(flowData.dQdDH);
            if (fromIndex !== undefined) {
              J[toIndex][fromIndex] = J[toIndex][fromIndex].plus(flowData.dQdDH);
            }
          }
        }

        activeNodes.forEach(node => {
          const index = variableIndex[node.id];
          const demandLs = demandOverrides && Object.prototype.hasOwnProperty.call(demandOverrides, node.id)
            ? demandOverrides[node.id]
            : node.demandaLs;
          F[index] = F[index].minus(demandLs.div(1000));
        });

        if (intervalSeconds.gt(ZERO)) {
          activeVariableTanks.forEach(tank => {
            const index = variableIndex[tank.id];
            const storageCoeff = tank.area.div(intervalSeconds);
            const previousHead = tankStates[tank.id].head;
            F[index] = F[index].minus(storageCoeff.times(X[index].minus(previousHead)));
            J[index][index] = J[index][index].minus(storageCoeff);
          });
        }

        const deltaH = gaussianEliminationDecimal(J, F);
        if (!deltaH) {
          return failure('El sistema lineal del solver hidraulico es singular o esta severamente mal condicionado.');
        }

        let maxChangeH = ZERO;
        for (let index = 0; index < variableIds.length; index += 1) {
          const change = ALPHA.times(deltaH[index]);
          X[index] = X[index].minus(change);
          maxChangeH = Decimal.max(maxChangeH, change.abs());
        }

        if (maxChangeH.lt('1e-7')) {
          convergedInner = true;
          break;
        }
      }
    }

    const previousFlows = [...flows];
    let maxQChange = ZERO;

    for (let pipeIndex = 0; pipeIndex < pipes.length; pipeIndex += 1) {
      if (!activePipeMask[pipeIndex]) {
        maxQChange = Decimal.max(maxQChange, previousFlows[pipeIndex].abs());
        flows[pipeIndex] = ZERO;
        continue;
      }

      const pipe = pipes[pipeIndex];
      if (!pipe.from || !pipe.to || pipe.from === pipe.to) {
        flows[pipeIndex] = ZERO;
        continue;
      }

      const flowData = pipe.tipoEnlace === 'bomba'
        ? calculatePumpRestrictedFlow(pipe, getHead, tankLimitModes, previousFlows[pipeIndex])
        : calculateRestrictedFlow(pipe, resistances[pipeIndex], getHead, tankLimitModes);
      maxQChange = Decimal.max(maxQChange, flowData.Q.minus(previousFlows[pipeIndex]).abs());
      flows[pipeIndex] = flowData.Q;
    }

    if (convergedInner && maxQChange.lt('1e-7')) {
      converged = true;
      break;
    }
  }

  activeNodes.forEach(node => {
    allHeads[nodeOrderIndex[node.id]] = X[variableIndex[node.id]];
  });

  const nodeResults: InternalNodeResult[] = nodes.map((node, index) => ({
    tipo: 'nodo',
    id: node.id,
    H: roundCalculatedValue(allHeads[index]),
    z: roundCalculatedValue(node.elevacion),
    P: roundCalculatedValue(allHeads[index].minus(node.elevacion)),
    supplied: !unsuppliedNodeIds.has(node.id),
  }));

  const netTankFlows: Record<string, Decimal> = {};
  tanks.forEach(tank => {
    netTankFlows[tank.id] = ZERO;
  });

  const pipeResults: InternalPipeResult[] = pipes.map((pipe, index) => {
    const Q = flows[index];
    if (Object.prototype.hasOwnProperty.call(netTankFlows, pipe.from)) {
      netTankFlows[pipe.from] = netTankFlows[pipe.from].minus(Q);
    }
    if (Object.prototype.hasOwnProperty.call(netTankFlows, pipe.to)) {
      netTankFlows[pipe.to] = netTankFlows[pipe.to].plus(Q);
    }

    if (pipe.tipoEnlace === 'bomba') {
      return {
        tipoEnlace: 'bomba',
        id: pipe.id,
        from: pipe.from,
        to: pipe.to,
        curveId: pipe.curveId,
        Q_ls: roundCalculatedValue(Q.times(1000)),
        V_ms: null,
        f: null,
        R: null,
        headGain_m: roundCalculatedValue(evaluatePumpCurve(pipe.curveCoefficients ?? null, Q.times(1000)) ?? ZERO),
      };
    }

    const diameter = pipe.diametroM ?? PIPE_DIAMETER_FALLBACK_MM.div(1000);
    const roughness = pipe.rugosidadM ?? PIPE_ROUGHNESS_FALLBACK_MM.div(1000);
    const length = pipe.longitudM ?? PIPE_LENGTH_MIN;
    const area = PI.times(diameter.pow(2)).div(4);
    const velocity = area.gt(ZERO) ? Q.abs().div(area) : ZERO;
    const reynolds = Decimal.max(velocity.times(diameter).div(NU), ONE);
    const friction = solveDarcyFriction(Decimal.max(roughness, new Decimal('1e-9')), diameter, reynolds);
    const resistance = new Decimal(8)
      .times(friction)
      .times(length)
      .div(PI.pow(2).times(G).times(diameter.pow(5)));

    return {
      tipoEnlace: 'tuberia',
      id: pipe.id,
      from: pipe.from,
      to: pipe.to,
      Q_ls: roundCalculatedValue(Q.times(1000)),
      V_ms: roundCalculatedValue(velocity),
      f: roundCalculatedValue(friction),
      R: roundCalculatedValue(resistance),
    };
  });

  const rawTankStates: HydraulicSolverResult['rawTankStates'] = {};
  tanks.forEach(tank => {
    const previousState = tankStates[tank.id];
    const netFlow = netTankFlows[tank.id] ?? ZERO;
    const mode = tankLimitModes[tank.id] ?? null;

    let rawVolume: Decimal;
    if (mode === 'min') {
      rawVolume = tank.volumenMinimo;
    } else if (mode === 'max') {
      rawVolume = tank.volumenMaximo;
    } else if (intervalSeconds.gt(ZERO) && variableTankIds.has(tank.id)) {
      rawVolume = previousState.volume.plus(netFlow.times(intervalSeconds));
    } else {
      rawVolume = previousState.volume;
    }

    const rawHead = tank.elevacion.plus(rawVolume.div(tank.area));
    if (intervalSeconds.gt(ZERO) && mode === null && variableTankIds.has(tank.id)) {
      const solvedHead = getHead(tank.id);
      if (solvedHead.minus(rawHead).abs().gt('1e-5')) {
        return;
      }
    }

    rawTankStates[tank.id] = {
      volume: rawVolume,
      head: rawHead,
      Qnet_m3s: netFlow,
      mode,
    };
  });

  const inconsistentTank = tanks.find(tank => !rawTankStates[tank.id]);
  if (inconsistentTank) {
    return failure(`Inconsistencia numerica en el tanque ${inconsistentTank.id}: la cabeza y el balance de masa no coinciden.`);
  }

  const tankResults: InternalTankResult[] = tanks.map(tank => {
    const rawState = rawTankStates[tank.id];
    const state = normalizeTankState(tank, { volume: rawState.volume });
    return {
      tipo: 'tanque',
      id: tank.id,
      elevacion: roundCalculatedValue(tank.elevacion),
      level: roundCalculatedValue(state.level),
      H: roundCalculatedValue(state.head),
      volume: roundCalculatedValue(state.volume),
      Qnet_m3s: roundCalculatedValue(rawState.Qnet_m3s),
      Qnet_ls: roundCalculatedValue(rawState.Qnet_m3s.times(1000)),
      atMin: state.atMin,
      atMax: state.atMax,
      mode: rawState.mode,
      stateLabel: getTankStateLabel(state),
      tanque: tank,
    };
  });

  const solverTankStates = tankResults.reduce<TankStateMap>((acc, tankResult) => {
    acc[tankResult.id] = normalizeTankState(tankResult.tanque, { volume: new Decimal(tankResult.volume) });
    return acc;
  }, {});

  return success({
    nodos: nodeResults,
    tanques: tankResults,
    tuberias: pipeResults,
    convergio: converged,
    unsuppliedNodes: Array.from(unsuppliedNodeIds),
    rawTankStates,
    solverState: {
      H: [...allHeads],
      Q: [...flows],
      tanks: cloneTankStates(solverTankStates),
    },
  });
}

function solveSteadyNetwork(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  tankStates: TankStateMap,
  options: {
    demandOverrides?: Record<string, Decimal>;
    initialHeads?: Decimal[] | null;
    initialFlows?: Decimal[] | null;
  } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const tankModes = buildTankModes(tanks, tankStates);
  const fixedTankHeads = buildFixedTankHeads(tanks, tankStates, tankModes, ZERO);
  return solveHydraulicCore(nodes, reservoirs, tanks, pipes, tankStates, {
    ...options,
    intervalSeconds: ZERO,
    fixedTankHeads,
    tankLimitModes: tankModes,
  });
}

function solveCoupledNetworkWithTanks(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  tankStates: TankStateMap,
  options: {
    demandOverrides?: Record<string, Decimal>;
    initialHeads?: Decimal[] | null;
    initialFlows?: Decimal[] | null;
    intervalSeconds: Decimal;
  }
): AxisCalculationResult<HydraulicSolverResult> {
  let tankModes = buildTankModes(tanks, tankStates);
  let lastResult: HydraulicSolverResult | null = null;
  let currentInitialHeads = options.initialHeads ? [...options.initialHeads] : null;
  let currentInitialFlows = options.initialFlows ? [...options.initialFlows] : null;

  for (let iteration = 0; iteration < MAX_TANK_ACTIVESET_ITERATIONS; iteration += 1) {
    const fixedTankHeads = buildFixedTankHeads(tanks, tankStates, tankModes, options.intervalSeconds);
    const result = solveHydraulicCore(nodes, reservoirs, tanks, pipes, tankStates, {
      demandOverrides: options.demandOverrides,
      initialHeads: currentInitialHeads,
      initialFlows: currentInitialFlows,
      intervalSeconds: options.intervalSeconds,
      fixedTankHeads,
      tankLimitModes: tankModes,
    });

    if (!result.ok) return result;
    lastResult = result.data;

    const nextModes: TankModeMap = { ...tankModes };
    let changed = false;

    tanks.forEach(tank => {
      const rawState = lastResult!.rawTankStates[tank.id];
      const currentMode = tankModes[tank.id];
      const toleranceVolume = tank.area.times(TANK_HEAD_EPS);

      if (!currentMode) {
        if (rawState.volume.lt(tank.volumenMinimo.minus(toleranceVolume))) {
          nextModes[tank.id] = 'min';
          changed = true;
        } else if (rawState.volume.gt(tank.volumenMaximo.plus(toleranceVolume))) {
          nextModes[tank.id] = 'max';
          changed = true;
        }
        return;
      }

      if (currentMode === 'min' && rawState.Qnet_m3s.gt(TANK_FLOW_EPS)) {
        nextModes[tank.id] = null;
        changed = true;
        return;
      }

      if (currentMode === 'max' && rawState.Qnet_m3s.lt(TANK_FLOW_EPS.neg())) {
        nextModes[tank.id] = null;
        changed = true;
      }
    });

    if (!changed) {
      if (!lastResult.convergio) {
        return failure('El paso temporal acoplado de tanques no convergio y no se puede usar para avanzar el estado.');
      }
      return success(lastResult);
    }

    tankModes = nextModes;
    currentInitialHeads = [...lastResult.solverState.H];
    currentInitialFlows = [...lastResult.solverState.Q];
  }

  if (!lastResult) {
    return failure('No fue posible resolver el paso temporal acoplado de tanques.');
  }

  return success({
    ...lastResult,
    convergio: false,
  });
}

function solveNetwork(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  options: {
    demandOverrides?: Record<string, Decimal>;
    initialHeads?: Decimal[] | null;
    initialFlows?: Decimal[] | null;
    initialTankStates?: TankStateMap | null;
    intervalSeconds?: Decimal;
  } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const tankStates = buildInitialTankStates(tanks, options.initialTankStates ?? null);
  const intervalSeconds = options.intervalSeconds ?? ZERO;

  if (intervalSeconds.gt(ZERO)) {
    return solveCoupledNetworkWithTanks(nodes, reservoirs, tanks, pipes, tankStates, {
      demandOverrides: options.demandOverrides,
      initialHeads: options.initialHeads ?? null,
      initialFlows: options.initialFlows ?? null,
      intervalSeconds,
    });
  }

  return solveSteadyNetwork(nodes, reservoirs, tanks, pipes, tankStates, {
    demandOverrides: options.demandOverrides,
    initialHeads: options.initialHeads ?? null,
    initialFlows: options.initialFlows ?? null,
  });
}

function integrateTanksDuringInterval(
  nodes: PreparedNode[],
  reservoirs: PreparedReservoir[],
  tanks: PreparedTank[],
  pipes: PreparedPipe[],
  demandOverrides: Record<string, Decimal>,
  initialResult: HydraulicSolverResult,
  intervalSeconds: Decimal,
  timeLabel: string
): AxisCalculationResult<WarmStartState> {
  if (!intervalSeconds.gt(ZERO)) {
    return success({
      H: [...initialResult.solverState.H],
      Q: [...initialResult.solverState.Q],
      tanks: cloneTankStates(initialResult.solverState.tanks),
    });
  }

  if (!initialResult.convergio) {
    return failure(`No se puede avanzar el intervalo en ${timeLabel} porque la hidraulica inicial no convergio.`);
  }

  const result = solveNetwork(nodes, reservoirs, tanks, pipes, {
    demandOverrides,
    initialHeads: initialResult.solverState.H,
    initialFlows: initialResult.solverState.Q,
    initialTankStates: initialResult.solverState.tanks,
    intervalSeconds,
  });

  if (!result.ok) return result;
  if (!result.data.convergio) {
    return failure(`El paso temporal acoplado no convergio en ${timeLabel}; no se propagara un warmStart inconsistente.`);
  }

  return success({
    H: [...result.data.solverState.H],
    Q: [...result.data.solverState.Q],
    tanks: cloneTankStates(result.data.solverState.tanks),
  });
}

function prepareModel(
  rawNodes: AxisNodeInputEntry[],
  rawConnections: AxisConnectionInputEntry[]
): AxisCalculationResult<PreparedModel> {
  const usedIds = new Map<string, string>();

  const registerId = (id: string, label: string): AxisCalculationResult<string> => {
    const trimmed = id.trim();
    if (!trimmed) return failure(`${label} debe tener un ID.`);
    if (usedIds.has(trimmed)) {
      return failure(`El ID "${trimmed}" esta repetido entre ${usedIds.get(trimmed)} y ${label}.`);
    }
    usedIds.set(trimmed, label);
    return success(trimmed);
  };

  const nodes: PreparedNode[] = [];
  const reservoirs: PreparedReservoir[] = [];
  const tanks: PreparedTank[] = [];

  for (let index = 0; index < rawNodes.length; index += 1) {
    const entry = rawNodes[index];
    if (entry.type === 'nodo') {
      const idResult = registerId(entry.nodeId, `el nodo ${index + 1}`);
      if (!idResult.ok) return idResult;
      const elevation = convertLengthToMeters(entry.z, entry.zUnit, `La elevacion del nodo ${idResult.data}`);
      if (!elevation.ok) return elevation;
      const demandLs = convertDemandToLs(entry.demanda, entry.demandaUnit, ZERO);
      const demandValidation = assertDecimalRange(demandLs, `La demanda base del nodo ${idResult.data}`, { min: ZERO });
      if (!demandValidation.ok) return demandValidation;
      nodes.push({
        tipo: 'nodo',
        id: idResult.data,
        x: convertOptionalLengthToMeters(entry.x, entry.xUnit),
        y: convertOptionalLengthToMeters(entry.y, entry.yUnit),
        elevacion: elevation.data,
        demandaLs: demandLs,
        patternId: entry.patternId.trim(),
      });
      continue;
    }

    if (entry.type === 'reservorio') {
      const idResult = registerId(entry.nodeId, `el reservorio ${index + 1}`);
      if (!idResult.ok) return idResult;
      const head = convertLengthToMeters(entry.z, entry.zUnit, `La carga Ht del reservorio ${idResult.data}`);
      if (!head.ok) return head;
      reservoirs.push({
        tipo: 'reservorio',
        id: idResult.data,
        x: convertOptionalLengthToMeters(entry.x, entry.xUnit),
        y: convertOptionalLengthToMeters(entry.y, entry.yUnit),
        head: head.data,
      });
      continue;
    }

    const idResult = registerId(entry.nodeId, `el tanque ${index + 1}`);
    if (!idResult.ok) return idResult;
    const elevation = convertLengthToMeters(entry.z, entry.zUnit, `La elevacion del tanque ${idResult.data}`);
    if (!elevation.ok) return elevation;
    const initialLevel = convertLengthToMeters(entry.nivelIni, entry.nivelIniUnit, `El nivel inicial del tanque ${idResult.data}`);
    if (!initialLevel.ok) return initialLevel;
    const minimumLevel = convertLengthToMeters(entry.nivelMin, entry.nivelMinUnit, `El nivel minimo del tanque ${idResult.data}`);
    if (!minimumLevel.ok) return minimumLevel;
    const maximumLevel = convertLengthToMeters(entry.nivelMax, entry.nivelMaxUnit, `El nivel maximo del tanque ${idResult.data}`);
    if (!maximumLevel.ok) return maximumLevel;
    const diameter = convertLengthToMeters(entry.diametro, entry.diametroUnit, `El diametro del tanque ${idResult.data}`);
    if (!diameter.ok) return diameter;

    const minLevelValidation = assertDecimalRange(minimumLevel.data, `El nivel minimo del tanque ${idResult.data}`, { min: ZERO });
    if (!minLevelValidation.ok) return minLevelValidation;
    const initialLevelValidation = assertDecimalRange(initialLevel.data, `El nivel inicial del tanque ${idResult.data}`, { min: ZERO });
    if (!initialLevelValidation.ok) return initialLevelValidation;
    const maxLevelValidation = assertDecimalRange(maximumLevel.data, `El nivel maximo del tanque ${idResult.data}`, { min: ZERO });
    if (!maxLevelValidation.ok) return maxLevelValidation;
    const diameterValidation = assertDecimalRange(diameter.data, `El diametro del tanque ${idResult.data}`, { min: ZERO, strictMin: true });
    if (!diameterValidation.ok) return diameterValidation;

    if (minimumLevel.data.gt(initialLevel.data)) {
      return failure(`El tanque ${idResult.data} debe cumplir nivel minimo <= nivel inicial.`);
    }
    if (initialLevel.data.gt(maximumLevel.data)) {
      return failure(`El tanque ${idResult.data} debe cumplir nivel inicial <= nivel maximo.`);
    }

    const area = calculateTankArea(diameter.data);
    tanks.push({
      tipo: 'tanque',
      id: idResult.data,
      x: convertOptionalLengthToMeters(entry.x, entry.xUnit),
      y: convertOptionalLengthToMeters(entry.y, entry.yUnit),
      elevacion: elevation.data,
      nivelInicial: initialLevel.data,
      nivelMinimo: minimumLevel.data,
      nivelMaximo: maximumLevel.data,
      diametroM: diameter.data,
      area,
      volumenMinimo: area.times(minimumLevel.data),
      volumenMaximo: area.times(maximumLevel.data),
      volumenInicial: area.times(initialLevel.data),
    });
  }

  const pointIds = new Set(usedIds.keys());
  const pipes: PreparedPipe[] = [];

  for (let index = 0; index < rawConnections.length; index += 1) {
    const entry = rawConnections[index];
    const from = entry.from.trim();
    const to = entry.to.trim();
    const connectionType = entry.type === 'bomba' ? 'bomba' : 'tuberia';
    const pipeId = entry.tubId.trim() || `${connectionType === 'bomba' ? 'B' : 'P'}${index + 1}`;
    const pipeLabel = connectionType === 'bomba' ? `La bomba ${pipeId}` : `La tuberia ${pipeId}`;

    if (!from || !to) return failure(`${pipeLabel} debe tener origen y destino.`);
    if (from === to) return failure(`${pipeLabel} no puede conectarse al mismo punto.`);
    if (!pointIds.has(from) || !pointIds.has(to)) return failure(`${pipeLabel} referencia un punto inexistente.`);

    if (connectionType === 'bomba') {
      const coefficients = entry.curveCoefficients;
      const maxFlowLs = Number(entry.maxFlowLs);

      if (!entry.curveId?.trim()) {
        return failure(`${pipeLabel} debe tener una curva asignada.`);
      }
      if (
        !coefficients ||
        !Number.isFinite(coefficients.a) ||
        !Number.isFinite(coefficients.b) ||
        !Number.isFinite(coefficients.c)
      ) {
        return failure(`${pipeLabel} requiere una curva valida con al menos 3 puntos calculables.`);
      }
      if (!Number.isFinite(maxFlowLs) || maxFlowLs <= 0) {
        return failure(`${pipeLabel} requiere una curva valida con caudal maximo positivo.`);
      }

      pipes.push({
        id: pipeId,
        tipoEnlace: 'bomba',
        from,
        to,
        longitudM: null,
        diametroM: null,
        rugosidadM: null,
        curveId: entry.curveId.trim(),
        curveCoefficients: {
          a: new Decimal(coefficients.a),
          b: new Decimal(coefficients.b),
          c: new Decimal(coefficients.c),
        },
        maxFlowLs: new Decimal(maxFlowLs),
      });
      continue;
    }

    const length = readRequiredDecimal(entry.longitud, `La longitud de ${pipeId}`);
    if (!length.ok) return length;
    const diameter = convertLengthToMeters(entry.diametro, entry.diametroUnit, `El diametro de ${pipeId}`);
    if (!diameter.ok) return diameter;
    const roughness = convertLengthToMeters(entry.rugosidad, entry.rugosidadUnit, `La rugosidad de ${pipeId}`);
    if (!roughness.ok) return roughness;

    const lengthValidation = assertDecimalRange(length.data, `La longitud de ${pipeId}`, { min: ZERO, strictMin: true });
    if (!lengthValidation.ok) return lengthValidation;
    const diameterValidation = assertDecimalRange(diameter.data, `El diametro de ${pipeId}`, { min: ZERO, strictMin: true });
    if (!diameterValidation.ok) return diameterValidation;
    const roughnessValidation = assertDecimalRange(roughness.data, `La rugosidad de ${pipeId}`, { min: ZERO });
    if (!roughnessValidation.ok) return roughnessValidation;

    pipes.push({
      id: pipeId,
      tipoEnlace: 'tuberia',
      from,
      to,
      longitudM: length.data,
      diametroM: diameter.data,
      rugosidadM: roughness.data,
    });
  }

  return success({
    nodos: nodes,
    reservorios: reservoirs,
    tanques: tanks,
    pipes,
  });
}

function readTemporalConfiguration(
  config: TemporalAnalysisConfig
): AxisCalculationResult<{ enabled: boolean; durationMinutes: number; stepMinutes: number }> {
  if (!config.enabled) {
    return success({
      enabled: false,
      durationMinutes: 0,
      stepMinutes: 0,
    });
  }

  const duration = readHourMinutePairStrict(config.durationHours, config.durationMinutes, 'La duracion total');
  if (!duration.ok) return duration;
  const step = readHourMinutePairStrict(config.stepHours, config.stepMinutes, 'El paso de analisis');
  if (!step.ok) return step;

  if (duration.data.totalMinutes <= 0) {
    return failure('La duracion total debe ser mayor que 00:00.');
  }
  if (step.data.totalMinutes <= 0) {
    return failure('El paso de analisis debe ser mayor que 00:00.');
  }
  if (step.data.totalMinutes > duration.data.totalMinutes) {
    return failure('El paso de analisis no puede ser mayor que la duracion total del periodo.');
  }

  return success({
    enabled: true,
    durationMinutes: duration.data.totalMinutes,
    stepMinutes: step.data.totalMinutes,
  });
}

function readDemandPatterns(patterns: TemporalPatternEntry[]): AxisCalculationResult<PatternDefinition[]> {
  if (patterns.length === 0) {
    return failure('Define al menos un patron de demanda para el analisis temporal.');
  }

  const usedIds = new Set<string>();
  const parsedPatterns: PatternDefinition[] = [];

  for (let index = 0; index < patterns.length; index += 1) {
    const pattern = patterns[index];
    const id = pattern.patternId.trim();
    if (!id) return failure(`El patron ${index + 1} debe tener un ID.`);
    if (usedIds.has(id)) return failure(`El ID de patron "${id}" esta repetido.`);
    usedIds.add(id);

    const multipliers = normalizeTemporalMultipliers(pattern.multipliers).map(rawValue => {
      const value = parseDecimalValue(rawValue === '' ? '1' : rawValue);
      if (!value || value.lt(ZERO)) return null;
      return value;
    });

    const invalidIndex = multipliers.findIndex(multiplier => multiplier === null);
    if (invalidIndex >= 0) {
      return failure(`El patron ${id} tiene un multiplicador invalido en ${getPatternHourLabel(invalidIndex * 60)}.`);
    }

    parsedPatterns.push({
      id,
      multipliers: multipliers as Decimal[],
    });
  }

  return success(parsedPatterns);
}

function buildPatternMap(patterns: PatternDefinition[]): Record<string, PatternDefinition> {
  return patterns.reduce<Record<string, PatternDefinition>>((acc, pattern) => {
    acc[pattern.id] = pattern;
    return acc;
  }, {});
}

function buildDemandsForTime(
  nodes: PreparedNode[],
  patternMap: Record<string, PatternDefinition>,
  timeMinutes: number
): AxisCalculationResult<Record<string, Decimal>> {
  const overrides: Record<string, Decimal> = {};
  const fallbackPatternId = Object.keys(patternMap)[0];

  for (const node of nodes) {
    const patternId = node.patternId || fallbackPatternId;
    const pattern = patternMap[patternId];
    if (!pattern) {
      return failure(`El nodo ${node.id} referencia un patron inexistente (${patternId || 'sin patron'}).`);
    }

    const factor = pattern.multipliers[getPatternHourIndex(timeMinutes)] ?? ONE;
    overrides[node.id] = node.demandaLs.times(factor);
  }

  return success(overrides);
}

function stripSolverState(result: HydraulicSolverResult): AxisHydraulicStepResult {
  return {
    nodos: result.nodos,
    tanques: result.tanques.map(({ tanque: _tank, ...tank }) => tank),
    tuberias: result.tuberias,
    convergio: result.convergio,
  };
}

function executeHydraulicAnalysis(
  model: PreparedModel,
  temporalConfig: TemporalAnalysisConfig
): AxisCalculationResult<AxisHydraulicAnalysisResult> {
  const temporalSettings = readTemporalConfiguration(temporalConfig);
  if (!temporalSettings.ok) return temporalSettings;

  const initialTankStates = buildInitialTankStates(model.tanques);

  if (!temporalSettings.data.enabled) {
    const result = solveNetwork(model.nodos, model.reservorios, model.tanques, model.pipes, {
      initialTankStates,
    });
    if (!result.ok) return result;
    return success({
      mode: 'steady',
      durationMinutes: 0,
      stepMinutes: 0,
      frames: [{
        timeMinutes: 0,
        result: stripSolverState(result.data),
      }],
    });
  }

  const patternResult = readDemandPatterns(temporalConfig.patterns);
  if (!patternResult.ok) return patternResult;
  const patternMap = buildPatternMap(patternResult.data);

  const frames: AxisHydraulicFrame[] = [];
  const instants = buildAnalysisInstants(temporalSettings.data.durationMinutes, temporalSettings.data.stepMinutes);
  let warmStart: WarmStartState = {
    H: null,
    Q: null,
    tanks: cloneTankStates(initialTankStates),
  };
  let partialMessage = '';

  for (let index = 0; index < instants.length; index += 1) {
    const timeMinutes = instants[index];
    const demandOverrides = buildDemandsForTime(model.nodos, patternMap, timeMinutes);
    if (!demandOverrides.ok) {
      partialMessage = demandOverrides.error;
      break;
    }

    const result = solveNetwork(model.nodos, model.reservorios, model.tanques, model.pipes, {
      demandOverrides: demandOverrides.data,
      initialHeads: warmStart.H,
      initialFlows: warmStart.Q,
      initialTankStates: warmStart.tanks,
    });

    if (!result.ok) {
      partialMessage = result.error;
      break;
    }

    frames.push({
      timeMinutes,
      result: stripSolverState(result.data),
    });

    const nextTime = instants[index + 1];
    if (nextTime !== undefined) {
      const nextWarmStart = integrateTanksDuringInterval(
        model.nodos,
        model.reservorios,
        model.tanques,
        model.pipes,
        demandOverrides.data,
        result.data,
        new Decimal(nextTime - timeMinutes).times(60),
        formatTimeMinutes(timeMinutes)
      );

      if (!nextWarmStart.ok) {
        partialMessage = nextWarmStart.error;
        break;
      }

      warmStart = nextWarmStart.data;
    }
  }

  if (frames.length === 0 && partialMessage) {
    return failure(partialMessage);
  }

  return success({
    mode: 'extended',
    durationMinutes: temporalSettings.data.durationMinutes,
    stepMinutes: temporalSettings.data.stepMinutes,
    frames,
    partial: !!partialMessage,
    partialMessage,
  });
}

export function runAxisHydraulicAnalysis(
  rawNodes: AxisNodeInputEntry[],
  rawConnections: AxisConnectionInputEntry[],
  temporalConfig: TemporalAnalysisConfig
): AxisCalculationResult<AxisHydraulicAnalysisResult> {
  if (rawNodes.filter(node => node.type === 'reservorio').length === 0 && rawNodes.filter(node => node.type === 'tanque').length === 0) {
    return failure('Se necesita al menos un reservorio o tanque con carga hidraulica para calcular la red.');
  }

  if (rawConnections.filter(connection => connection.from && connection.to && connection.from !== connection.to).length === 0) {
    return failure('No hay conexiones definidas o ninguna tiene puntos asignados.');
  }

  const model = prepareModel(rawNodes, rawConnections);
  if (!model.ok) return model;

  const analysis = executeHydraulicAnalysis(model.data, temporalConfig);
  if (!analysis.ok) return analysis;

  const warnings: string[] = [];
  const nonConvergedSteps = analysis.data.frames.filter(frame => !frame.result.convergio);
  if (nonConvergedSteps.length > 0) {
    if (analysis.data.mode === 'extended') {
      warnings.push(
        `La simulacion termino, pero ${nonConvergedSteps.length} de ${analysis.data.frames.length} pasos no alcanzaron convergencia total.`
      );
    } else {
      warnings.push('El calculo termino, pero no alcanzo convergencia total.');
    }
  }
  if (analysis.data.partialMessage) {
    warnings.push(analysis.data.partialMessage);
  }

  return success(analysis.data, warnings);
}
