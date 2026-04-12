/**
 * axisHydraulics.ts — VERSIÓN OPTIMIZADA
 *
 * PROBLEMA ORIGINAL:
 *   La versión anterior usaba `decimal.js` con precisión 50 para CADA operación aritmética
 *   dentro del solver hidráulico. Cada suma, resta, multiplicación, división, comparación,
 *   sqrt y log10 creaba objetos Decimal y ejecutaba aritmética de software de 50 dígitos.
 *   Esto es 50–200× más lento que float64 nativo del hardware.
 *
 *   Para una red de 13 nodos con análisis temporal de 24 horas:
 *   - 25 pasos × 200 iteraciones outer × 120 iteraciones inner = 600 000 Newton-Raphson
 *   - Cada iteración: matrix 13×13 con Decimal + eliminación gaussiana Decimal
 *   - Factor de fricción Colebrook-White: 120 iteraciones de Decimal por tubería
 *   → Decenas de millones de objetos Decimal → congelamiento total en móvil.
 *
 * SOLUCIÓN:
 *   Reemplazar TODO el aritmético interno con `number` (float64 IEEE 754).
 *   Float64 tiene ~15–16 dígitos significativos, más que suficiente para hidráulica.
 *   El código de index.html ya lo demuestra: cálculo instantáneo con number nativo.
 *   Decimal.js se usa SOLO para parsear strings de entrada (una sola vez por cálculo).
 *
 * CAMBIOS ADICIONALES:
 *   - handleCalcular en AxisScreen.tsx debe llamarse con InteractionManager para
 *     no bloquear el hilo de UI (ver comentario al final del archivo).
 */

import type { TemporalAnalysisConfig, TemporalPatternEntry } from './TemporalAnalysisAxisScreen';

// ─── Constantes del solver (native number) ─────────────────────────────────────
const PLAYBACK_INTERVAL_MS = 700;
const CALCULATION_DECIMALS = 10;
const MAX_TANK_ACTIVESET_ITERATIONS = 32;
const MAX_HYDRAULIC_OUTER_ITERATIONS = 200;
const MAX_HYDRAULIC_INNER_ITERATIONS = 120;
const ALPHA = 0.65;
const NU = 1e-6;        // viscosidad cinemática agua, m²/s
const G = 9.81;          // gravedad, m/s²
const PI = Math.PI;
const PIPE_LENGTH_MIN = 0.1;
const PIPE_DIAMETER_FALLBACK_M = 0.01;  // 10 mm
const PIPE_ROUGHNESS_FALLBACK_M = 1e-6; // 0.001 mm
const FLOW_GUESS = 0.001;               // m³/s
const TANK_LEVEL_EPS = 1e-9;
const TANK_HEAD_EPS = 1e-8;
const TANK_FLOW_EPS = 1e-10;
const TOL_H = 1e-7;
const TOL_Q = 1e-7;

// Factores de conversión de unidades a metros/l·s⁻¹
const LENGTH_FACTORS: Record<string, number> = {
  m: 1, mm: 0.001, cm: 0.01, km: 1000,
  in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
};
const FLOW_TO_LS_FACTORS: Record<string, number> = {
  'l/s': 1,
  'm³/s': 1000,
  'mÂ³/s': 1000,       // encoding alternativo que puede venir del texto
  'm³/h': 1000 / 3600,
  'mÂ³/h': 1000 / 3600,
  gpm: 3.785411784 / 60,  // 1 gal = 3.785 l, 1 gpm = 3.785/60 l/s
};

const DEFAULT_PATTERN_VALUES = Array.from({ length: 24 }, () => '1');

export { PLAYBACK_INTERVAL_MS };

// ─── Interfaces públicas (sin cambios para compatibilidad) ──────────────────────
export type AxisNodeType = 'nodo' | 'tanque' | 'reservorio';

export interface AxisNodeInputEntry {
  type: AxisNodeType;
  nodeId: string;
  patternId: string;
  x: string; xUnit: string;
  y: string; yUnit: string;
  z: string; zUnit: string;
  demanda: string; demandaUnit: string;
  nivelIni: string; nivelIniUnit: string;
  nivelMin: string; nivelMinUnit: string;
  nivelMax: string; nivelMaxUnit: string;
  diametro: string; diametroUnit: string;
}

export interface AxisConnectionInputEntry {
  type?: 'tuberia' | 'bomba';
  tubId: string;
  from: string; to: string;
  curveId?: string;
  curveCoefficients?: { a: number; b: number; c: number };
  maxFlowLs?: number;
  longitud: string;
  diametro: string; diametroUnit: string;
  rugosidad: string; rugosidadUnit: string;
}

export interface AxisNodeResult {
  tipo: 'nodo'; id: string;
  H: number; z: number; P: number; supplied: boolean;
}
export interface AxisTankResult {
  tipo: 'tanque'; id: string;
  elevacion: number; level: number; H: number;
  volume: number; Qnet_m3s: number; Qnet_ls: number;
  atMin: boolean; atMax: boolean;
  mode: TankMode; stateLabel: string;
}
export interface AxisPipeResult {
  tipoEnlace: 'tuberia' | 'bomba'; id: string;
  from: string; to: string;
  Q_ls: number; V_ms: number | null;
  f: number | null; R: number | null;
  curveId?: string; headGain_m?: number | null;
}
export interface AxisHydraulicStepResult {
  nodos: AxisNodeResult[]; tanques: AxisTankResult[];
  tuberias: AxisPipeResult[]; convergio: boolean;
}
export interface AxisHydraulicFrame {
  timeMinutes: number; result: AxisHydraulicStepResult;
}
export interface AxisHydraulicAnalysisResult {
  mode: 'steady' | 'extended';
  durationMinutes: number; stepMinutes: number;
  frames: AxisHydraulicFrame[];
  partial?: boolean; partialMessage?: string;
}
export type AxisCalculationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

// ─── Tipos internos del solver (todo number) ────────────────────────────────────
type TankMode = 'min' | 'max' | 'locked' | null;

type PatternDefinition = { id: string; multipliers: number[] };

type PreparedNode = {
  tipo: 'nodo'; id: string;
  x: number; y: number; elevacion: number;
  demandaLs: number; patternId: string;
};
type PreparedReservoir = { tipo: 'reservorio'; id: string; x: number; y: number; head: number };
type PreparedTank = {
  tipo: 'tanque'; id: string; x: number; y: number;
  elevacion: number; nivelInicial: number; nivelMinimo: number; nivelMaximo: number;
  diametroM: number; area: number; volumenMinimo: number; volumenMaximo: number; volumenInicial: number;
};
type PreparedPipe = {
  id: string; tipoEnlace: 'tuberia' | 'bomba';
  from: string; to: string;
  longitudM: number | null; diametroM: number | null; rugosidadM: number | null;
  curveId?: string;
  curveCoefficients?: { a: number; b: number; c: number } | null;
  maxFlowLs?: number | null;
};
type TankState = { level: number; volume: number; head: number; atMin: boolean; atMax: boolean };
type TankStateMap = Record<string, TankState>;
type TankModeMap = Record<string, TankMode>;

type HydraulicSolverResult = {
  nodos: AxisNodeResult[];
  tanques: (AxisTankResult & { tanque: PreparedTank })[];
  tuberias: AxisPipeResult[];
  convergio: boolean;
  unsuppliedNodes: string[];
  rawTankStates: Record<string, { volume: number; head: number; Qnet_m3s: number; mode: TankMode }>;
  solverState: { H: number[]; Q: number[]; tanks: TankStateMap };
};
type WarmStartState = { H: number[] | null; Q: number[] | null; tanks: TankStateMap };
type PreparedModel = {
  nodos: PreparedNode[]; reservorios: PreparedReservoir[];
  tanques: PreparedTank[]; pipes: PreparedPipe[];
};

// ─── Helpers de resultado ───────────────────────────────────────────────────────
function success<T>(data: T, warnings: string[] = []): AxisCalculationResult<T> {
  return { ok: true, data, warnings };
}
function failure<T>(error: string, warnings: string[] = []): AxisCalculationResult<T> {
  return { ok: false, error, warnings };
}

// ─── Parseo de entrada (único lugar donde se acepta string) ─────────────────────
function parseNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const normalized = String(raw).trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(raw: string, label: string): AxisCalculationResult<number> {
  const trimmed = raw.trim();
  if (trimmed === '') return failure(`${label} es obligatorio.`);
  const v = parseNumber(trimmed);
  if (v === null) return failure(`${label} debe ser un numero valido.`);
  return success(v);
}

function parseOptionalNumber(raw: string, fallback: number): number {
  return parseNumber(raw) ?? fallback;
}

function assertRange(
  value: number, label: string,
  opts: { min?: number; max?: number; strictMin?: boolean; strictMax?: boolean } = {}
): AxisCalculationResult<number> {
  const { min, max, strictMin, strictMax } = opts;
  if (min !== undefined) {
    if (strictMin ? value <= min : value < min)
      return failure(strictMin ? `${label} debe ser mayor que ${min}.` : `${label} no puede ser menor que ${min}.`);
  }
  if (max !== undefined) {
    if (strictMax ? value >= max : value > max)
      return failure(strictMax ? `${label} debe ser menor que ${max}.` : `${label} no puede ser mayor que ${max}.`);
  }
  return success(value);
}

function convertLength(raw: string, unit: string, label: string): AxisCalculationResult<number> {
  const parsed = parseRequiredNumber(raw, label);
  if (!parsed.ok) return parsed;
  return success(parsed.data * (LENGTH_FACTORS[unit] ?? 1));
}

function convertOptionalLength(raw: string, unit: string): number {
  return parseOptionalNumber(raw, 0) * (LENGTH_FACTORS[unit] ?? 1);
}

function convertDemandToLs(raw: string, unit: string, fallback = 0): number {
  return parseOptionalNumber(raw, fallback) * (FLOW_TO_LS_FACTORS[unit] ?? 1);
}

// ─── Formateo de tiempo ─────────────────────────────────────────────────────────
function pad2(v: number): string { return String(v).padStart(2, '0'); }

export function formatTimeMinutes(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
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
  for (let t = stepMinutes; t < durationMinutes; t += stepMinutes) instants.push(t);
  if (instants[instants.length - 1] !== durationMinutes) instants.push(durationMinutes);
  return instants;
}

function readStrictNonNegativeInt(raw: string, label: string, max?: number): AxisCalculationResult<number> {
  const trimmed = raw.trim();
  if (trimmed === '') return success(0);
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed))
    return failure(`${label} debe ser un entero no negativo.`);
  if (max !== undefined && parsed > max)
    return failure(`${label} no puede ser mayor que ${max}.`);
  return success(parsed);
}

function readHourMinutePairStrict(
  hoursRaw: string, minutesRaw: string, label: string
): AxisCalculationResult<{ hours: number; minutes: number; totalMinutes: number }> {
  const h = readStrictNonNegativeInt(hoursRaw, `${label} (horas)`);
  if (!h.ok) return h;
  const m = readStrictNonNegativeInt(minutesRaw, `${label} (minutos)`, 59);
  if (!m.ok) return m;
  return success({ hours: h.data, minutes: m.data, totalMinutes: h.data * 60 + m.data });
}

// ─── Física / fluidos ───────────────────────────────────────────────────────────
function roundVal(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const r = parseFloat(v.toFixed(CALCULATION_DECIMALS));
  return Math.abs(r) < 1e-14 ? 0 : r;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function tankArea(diamM: number): number {
  return PI * diamM * diamM / 4;
}

/**
 * Factor de fricción de Darcy-Weisbach (Colebrook-White implícito)
 * Usa iteración directa con SOLO números nativos → extremadamente rápido.
 */
function solveDarcyFriction(roughnessM: number, diamM: number, reynolds: number): number {
  const MIN_F = 0.001;
  if (reynolds < 2300) return Math.max(64 / reynolds, MIN_F);
  let f = 0.025;
  const relRough = roughnessM / (diamM * 3.7);
  for (let i = 0; i < 60; i++) {
    const sqF = Math.sqrt(f);
    const arg = relRough + 2.51 / (reynolds * sqF);
    if (arg <= 0) break;
    const rhs = -2 * Math.log10(arg);
    const next = 1 / (rhs * rhs);
    if (Math.abs(next - f) < 1e-9) { f = next; break; }
    f = next;
  }
  return Math.max(f, MIN_F);
}

// ─── Eliminación gaussiana con pivoteo (native number[][]) ──────────────────────
function gaussianElimination(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  // Construir augmented matrix
  const aug: number[][] = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col++) {
    // Pivoteo parcial
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null;

    const pivot = aug[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        aug[row][k] -= factor * aug[col][k];
      }
    }
  }

  const sol = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let val = aug[row][n];
    for (let col = row + 1; col < n; col++) val -= aug[row][col] * sol[col];
    sol[row] = val / aug[row][row];
  }
  return sol;
}

// ─── Curva de bomba ─────────────────────────────────────────────────────────────
function evaluatePumpCurve(coeff: { a: number; b: number; c: number } | null | undefined, flowLs: number): number | null {
  if (!coeff) return null;
  return coeff.a + coeff.b * Math.pow(flowLs, coeff.c);
}

function evaluatePumpCurveSlope(coeff: { a: number; b: number; c: number } | null | undefined, flowLs: number): number | null {
  if (!coeff) return null;
  const q = Math.max(flowLs, 1e-6);
  return coeff.b * coeff.c * Math.pow(q, coeff.c - 1);
}

// ─── Estado de tanques ──────────────────────────────────────────────────────────
function cloneTankStates(states: TankStateMap): TankStateMap {
  const clone: TankStateMap = {};
  for (const id of Object.keys(states)) {
    clone[id] = { ...states[id] };
  }
  return clone;
}

function normalizeTankState(tank: PreparedTank, current: Partial<TankState> | null = null): TankState {
  const baseLevel = current?.level !== undefined ? current.level : tank.nivelInicial;
  const level0 = clamp(baseLevel, tank.nivelMinimo, tank.nivelMaximo);
  const baseVol = current?.volume !== undefined ? current.volume : tank.area * level0;
  const vol = clamp(baseVol, tank.volumenMinimo, tank.volumenMaximo);
  const level1 = clamp(vol / tank.area, tank.nivelMinimo, tank.nivelMaximo);
  const levelF = level1 <= tank.nivelMinimo + TANK_LEVEL_EPS
    ? tank.nivelMinimo
    : level1 >= tank.nivelMaximo - TANK_LEVEL_EPS
      ? tank.nivelMaximo
      : level1;
  return {
    level: levelF,
    volume: tank.area * levelF,
    head: tank.elevacion + levelF,
    atMin: levelF <= tank.nivelMinimo + TANK_LEVEL_EPS,
    atMax: levelF >= tank.nivelMaximo - TANK_LEVEL_EPS,
  };
}

function buildInitialTankStates(tanks: PreparedTank[], initial: TankStateMap | null = null): TankStateMap {
  const states: TankStateMap = {};
  for (const t of tanks) {
    states[t.id] = normalizeTankState(t, initial ? (initial[t.id] ?? null) : null);
  }
  return states;
}

function getTankLimitMode(state: TankState | null | undefined): TankMode {
  if (!state) return null;
  if (state.atMin && state.atMax) return 'locked';
  if (state.atMin) return 'min';
  if (state.atMax) return 'max';
  return null;
}

function buildTankModes(tanks: PreparedTank[], states: TankStateMap): TankModeMap {
  const modes: TankModeMap = {};
  for (const t of tanks) modes[t.id] = getTankLimitMode(states[t.id]);
  return modes;
}

function getTankHeadByMode(tank: PreparedTank, state: TankState, mode: TankMode): number {
  if (mode === 'min') return tank.elevacion + tank.nivelMinimo;
  if (mode === 'max') return tank.elevacion + tank.nivelMaximo;
  return state.head;
}

function buildFixedTankHeads(
  tanks: PreparedTank[], states: TankStateMap, modes: TankModeMap, intervalSec: number
): Record<string, number> {
  const fixed: Record<string, number> = {};
  for (const t of tanks) {
    const mode = modes[t.id];
    if (intervalSec <= 0 || mode) {
      fixed[t.id] = getTankHeadByMode(t, states[t.id], mode);
    }
  }
  return fixed;
}

function getTankStateLabel(r: { atMin: boolean; atMax: boolean }): string {
  if (r.atMin && r.atMax) return 'Bloqueado';
  if (r.atMin) return 'Minimo';
  if (r.atMax) return 'Maximo';
  return 'Libre';
}

// ─── Restricciones de flujo por modos de tanque ─────────────────────────────────
function isEndpointBlocked(id: string, q: number, side: 'from' | 'to', modes: TankModeMap): boolean {
  const mode = modes[id];
  if (!mode) return false;
  if (mode === 'locked') return true;
  if (Math.abs(q) <= TANK_FLOW_EPS) return false;
  if (side === 'from') {
    if (mode === 'min') return q > 0;
    if (mode === 'max') return q < 0;
  } else {
    if (mode === 'min') return q < 0;
    if (mode === 'max') return q > 0;
  }
  return false;
}

function isPipeBlocked(pipe: PreparedPipe, q: number, modes: TankModeMap): boolean {
  return isEndpointBlocked(pipe.from, q, 'from', modes) || isEndpointBlocked(pipe.to, q, 'to', modes);
}

// ─── Cálculo de flujo restringido ───────────────────────────────────────────────
function calcPipeFlow(
  pipe: PreparedPipe, R: number, getHead: (id: string) => number, modes: TankModeMap, qPrev: number
): { Q: number; dQdDH: number } {
  const dH = getHead(pipe.from) - getHead(pipe.to);
  const absDH = Math.max(Math.abs(dH), 1e-8);
  const R_safe = Math.max(R, 1e-12);
  const qTrial = dH >= 0 ? Math.sqrt(absDH / R_safe) : -Math.sqrt(absDH / R_safe);

  if (isPipeBlocked(pipe, qTrial, modes)) return { Q: 0, dQdDH: 0 };

  return {
    Q: qTrial,
    dQdDH: 0.5 / Math.sqrt(R_safe * absDH),
  };
}

function calcPumpFlow(
  pipe: PreparedPipe, getHead: (id: string) => number, modes: TankModeMap, qGuessM3s: number
): { Q: number; dQdDH: number } {
  const dH = getHead(pipe.from) - getHead(pipe.to);
  const q0 = Math.max(qGuessM3s, 0);
  const q0Ls = q0 * 1000;
  const headGain0 = evaluatePumpCurve(pipe.curveCoefficients, q0Ls) ?? 0;

  let slope = (evaluatePumpCurveSlope(pipe.curveCoefficients, q0Ls) ?? null);
  if (slope !== null) slope *= 1000; // convert dH/dQ_ls → dH/dQ_m3s
  if (!slope || !Number.isFinite(slope) || slope >= -1e-9) {
    const fallbackLs = Math.max(q0Ls, pipe.maxFlowLs ?? 1);
    const s2 = evaluatePumpCurveSlope(pipe.curveCoefficients, fallbackLs);
    slope = s2 !== null ? s2 * 1000 : null;
  }
  if (!slope || !Number.isFinite(slope) || slope >= -1e-9) slope = -1;

  let qTrial = q0 - (dH + headGain0) / slope;
  if (!Number.isFinite(qTrial)) qTrial = 0;
  qTrial = Math.max(qTrial, 0);
  if (pipe.maxFlowLs && pipe.maxFlowLs > 0) qTrial = Math.min(qTrial, pipe.maxFlowLs / 1000);

  if (isPipeBlocked(pipe, qTrial, modes)) return { Q: 0, dQdDH: 0 };

  return {
    Q: qTrial,
    dQdDH: Math.max(-1 / slope, 0),
  };
}

// ─── Conectividad ───────────────────────────────────────────────────────────────
function validateConnectivity(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[],
  opts: { tankStates: TankStateMap; tankLimitModes: TankModeMap; variableTankIds: Set<string> | null; fixedTankHeads: Record<string, number> | null }
): { ok: boolean; nodosAislados: string[]; visitados: string[] } {
  const sources = new Set(reservoirs.map(r => r.id));
  for (const t of tanks) {
    const mode = opts.tankLimitModes[t.id];
    const isVar = opts.variableTankIds ? opts.variableTankIds.has(t.id) : mode === null;
    const isFixed = opts.fixedTankHeads ? Object.prototype.hasOwnProperty.call(opts.fixedTankHeads, t.id) : !isVar;
    if ((isVar || isFixed) && mode !== 'min' && mode !== 'locked' && opts.tankStates[t.id]) {
      sources.add(t.id);
    }
  }

  const adj: Record<string, string[]> = {};
  for (const e of [...nodes, ...reservoirs, ...tanks]) adj[e.id] = [];

  for (const pipe of pipes) {
    if (!pipe.from || !pipe.to || pipe.from === pipe.to) continue;
    if (pipe.tipoEnlace === 'bomba') {
      if (!isPipeBlocked(pipe, 1, opts.tankLimitModes)) adj[pipe.from].push(pipe.to);
    } else {
      if (!isPipeBlocked(pipe, 1, opts.tankLimitModes)) adj[pipe.from].push(pipe.to);
      if (!isPipeBlocked(pipe, -1, opts.tankLimitModes)) adj[pipe.to].push(pipe.from);
    }
  }

  const visited = new Set<string>();
  const queue: string[] = [];
  sources.forEach(id => { visited.add(id); queue.push(id); });
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of adj[cur] ?? []) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
    }
  }

  const isolated = nodes.map(n => n.id).filter(id => !visited.has(id));
  return { ok: isolated.length === 0, nodosAislados: isolated, visitados: Array.from(visited) };
}

// ─── SOLVER HIDRÁULICO CORE (todo native number) ────────────────────────────────
function solveHydraulicCore(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[], tankStates: TankStateMap,
  options: {
    demandOverrides?: Record<string, number> | null;
    initialHeads?: number[] | null;
    initialFlows?: number[] | null;
    intervalSeconds?: number;
    fixedTankHeads?: Record<string, number>;
    tankLimitModes?: TankModeMap;
  } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const demandOverrides = options.demandOverrides ?? null;
  const initialHeads = options.initialHeads ?? null;
  const initialFlows = options.initialFlows ?? null;
  const intervalSec = options.intervalSeconds ?? 0;
  const fixedTankHeads = options.fixedTankHeads ?? {};
  const tankLimitModes = options.tankLimitModes ?? {};

  const variableTanks = tanks.filter(t => !Object.prototype.hasOwnProperty.call(fixedTankHeads, t.id));
  const variableTankIds = new Set(variableTanks.map(t => t.id));

  const conn = validateConnectivity(nodes, reservoirs, tanks, pipes, {
    tankStates, tankLimitModes, variableTankIds, fixedTankHeads,
  });

  const activePointIds = new Set(conn.visitados);
  const unsuppliedNodeIds = new Set(conn.nodosAislados);
  const activeNodes = nodes.filter(n => !unsuppliedNodeIds.has(n.id));
  const activeVariableTanks = variableTanks.filter(t => activePointIds.has(t.id));

  // Índice global de nodos (para allHeads)
  const nodeOrderIndex: Record<string, number> = {};
  nodes.forEach((n, i) => { nodeOrderIndex[n.id] = i; });

  // Cabezas fijas (reservorios + tanques fijos)
  const fixedHeads: Record<string, number> = {};
  for (const r of reservoirs) fixedHeads[r.id] = r.head;
  for (const id of Object.keys(fixedTankHeads)) fixedHeads[id] = fixedTankHeads[id];

  // Variables: nodos activos + tanques variables
  const variableIds = [
    ...activeNodes.map(n => n.id),
    ...activeVariableTanks.map(t => t.id),
  ];
  const variableIndex: Record<string, number> = {};
  variableIds.forEach((id, i) => { variableIndex[id] = i; });
  const variableCount = variableIds.length;

  // Cabeza promedio de fuentes para inicialización
  const sourceHeads = [
    ...reservoirs.map(r => r.head),
    ...Object.keys(fixedTankHeads).map(id => fixedTankHeads[id]),
    ...activeVariableTanks.map(t => tankStates[t.id].head),
  ];
  const avgSourceHead = sourceHeads.length > 0
    ? sourceHeads.reduce((a, b) => a + b, 0) / sourceHeads.length
    : 0;

  // Inicializar cabezas
  const allHeads: number[] = new Array(nodes.length).fill(0);
  nodes.forEach((n, i) => {
    if (unsuppliedNodeIds.has(n.id)) { allHeads[i] = n.elevacion; return; }
    if (initialHeads && initialHeads.length === nodes.length) { allHeads[i] = initialHeads[i]; return; }
    allHeads[i] = Math.max(n.elevacion + 10, avgSourceHead - 5);
  });

  const X: number[] = new Array(variableCount).fill(0);
  activeNodes.forEach(n => { X[variableIndex[n.id]] = allHeads[nodeOrderIndex[n.id]]; });
  activeVariableTanks.forEach(t => { X[variableIndex[t.id]] = tankStates[t.id].head; });

  // Flujos iniciales
  const flows: number[] =
    initialFlows && initialFlows.length === pipes.length
      ? [...initialFlows]
      : new Array(pipes.length).fill(FLOW_GUESS);

  const activePipeMask = pipes.map(p => activePointIds.has(p.from) && activePointIds.has(p.to));

  const getHead = (id: string): number => {
    if (Object.prototype.hasOwnProperty.call(fixedHeads, id)) return fixedHeads[id];
    const idx = variableIndex[id];
    return idx !== undefined ? X[idx] : 0;
  };

  let converged = false;

  for (let outer = 0; outer < MAX_HYDRAULIC_OUTER_ITERATIONS; outer++) {
    // Calcular resistencias hidráulicas (Darcy-Weisbach)
    const resistances: number[] = pipes.map((pipe, k) => {
      if (!activePipeMask[k] || pipe.tipoEnlace === 'bomba') return 0;
      if (!pipe.longitudM || !pipe.diametroM || !pipe.rugosidadM) return 0;
      const L = Math.max(pipe.longitudM, PIPE_LENGTH_MIN);
      const D = Math.max(pipe.diametroM, PIPE_DIAMETER_FALLBACK_M);
      const ks = Math.max(pipe.rugosidadM, PIPE_ROUGHNESS_FALLBACK_M);
      const A = PI * D * D / 4;
      const qAbs = Math.max(Math.abs(flows[k]), 1e-9);
      const V = qAbs / A;
      const Re = Math.max(V * D / NU, 1);
      const f = solveDarcyFriction(ks, D, Re);
      return (8 * f * L) / (PI * PI * G * Math.pow(D, 5));
    });

    let convergedInner = variableCount === 0;

    if (!convergedInner) {
      // Reutilizar arrays para evitar allocaciones en cada inner iter
      const F: number[] = new Array(variableCount).fill(0);
      // Jacobiana como array plano (row-major) para cache locality
      const J: number[] = new Array(variableCount * variableCount).fill(0);

      for (let inner = 0; inner < MAX_HYDRAULIC_INNER_ITERATIONS; inner++) {
        // Reset F y J
        F.fill(0);
        J.fill(0);

        for (let k = 0; k < pipes.length; k++) {
          if (!activePipeMask[k]) continue;
          const pipe = pipes[k];
          if (!pipe.from || !pipe.to || pipe.from === pipe.to) continue;

          const flowData = pipe.tipoEnlace === 'bomba'
            ? calcPumpFlow(pipe, getHead, tankLimitModes, flows[k])
            : calcPipeFlow(pipe, resistances[k], getHead, tankLimitModes, flows[k]);

          const iFrom = variableIndex[pipe.from];
          const iTo = variableIndex[pipe.to];

          if (iFrom !== undefined) {
            F[iFrom] -= flowData.Q;
            J[iFrom * variableCount + iFrom] -= flowData.dQdDH;
            if (iTo !== undefined) J[iFrom * variableCount + iTo] += flowData.dQdDH;
          }
          if (iTo !== undefined) {
            F[iTo] += flowData.Q;
            J[iTo * variableCount + iTo] -= flowData.dQdDH;
            if (iFrom !== undefined) J[iTo * variableCount + iFrom] += flowData.dQdDH;
          }
        }

        // Demanda de nodos
        for (const node of activeNodes) {
          const idx = variableIndex[node.id];
          const dem = demandOverrides && Object.prototype.hasOwnProperty.call(demandOverrides, node.id)
            ? demandOverrides[node.id]
            : node.demandaLs;
          F[idx] -= dem / 1000; // l/s → m³/s
        }

        // Almacenamiento de tanques variables (paso temporal)
        if (intervalSec > 0) {
          for (const tank of activeVariableTanks) {
            const idx = variableIndex[tank.id];
            const storageCoeff = tank.area / intervalSec;
            const prevHead = tankStates[tank.id].head;
            F[idx] -= storageCoeff * (X[idx] - prevHead);
            J[idx * variableCount + idx] -= storageCoeff;
          }
        }

        // Convertir J plano a matrix 2D para gaussianElimination
        const Jmat: number[][] = Array.from({ length: variableCount }, (_, r) =>
          Array.from({ length: variableCount }, (_, c) => J[r * variableCount + c])
        );

        const deltaH = gaussianElimination(Jmat, F);
        if (!deltaH) {
          return failure('El sistema lineal del solver hidraulico es singular o esta severamente mal condicionado.');
        }

        let maxChangeH = 0;
        for (let i = 0; i < variableCount; i++) {
          const change = ALPHA * deltaH[i];
          X[i] -= change;
          maxChangeH = Math.max(maxChangeH, Math.abs(change));
        }

        if (maxChangeH < TOL_H) { convergedInner = true; break; }
      }
    }

    // Actualizar flujos
    const prevFlows = [...flows];
    let maxQChange = 0;

    for (let k = 0; k < pipes.length; k++) {
      if (!activePipeMask[k]) {
        maxQChange = Math.max(maxQChange, Math.abs(prevFlows[k]));
        flows[k] = 0; continue;
      }
      const pipe = pipes[k];
      if (!pipe.from || !pipe.to || pipe.from === pipe.to) { flows[k] = 0; continue; }

      const fd = pipe.tipoEnlace === 'bomba'
        ? calcPumpFlow(pipe, getHead, tankLimitModes, prevFlows[k])
        : calcPipeFlow(pipe, resistances[k], getHead, tankLimitModes, prevFlows[k]);

      maxQChange = Math.max(maxQChange, Math.abs(fd.Q - prevFlows[k]));
      flows[k] = fd.Q;
    }

    if (convergedInner && maxQChange < TOL_Q) { converged = true; break; }
  }

  // Copiar cabezas resueltas
  for (const node of activeNodes) {
    allHeads[nodeOrderIndex[node.id]] = X[variableIndex[node.id]];
  }

  // Resultados nodos
  const nodeResults: AxisNodeResult[] = nodes.map((n, i) => ({
    tipo: 'nodo', id: n.id,
    H: roundVal(allHeads[i]),
    z: roundVal(n.elevacion),
    P: roundVal(allHeads[i] - n.elevacion),
    supplied: !unsuppliedNodeIds.has(n.id),
  }));

  // Balance de flujo en tanques
  const netTankFlows: Record<string, number> = {};
  for (const t of tanks) netTankFlows[t.id] = 0;

  // Resultados tuberías
  const pipeResults: AxisPipeResult[] = pipes.map((pipe, k) => {
    const Q = flows[k];
    if (Object.prototype.hasOwnProperty.call(netTankFlows, pipe.from)) netTankFlows[pipe.from] -= Q;
    if (Object.prototype.hasOwnProperty.call(netTankFlows, pipe.to)) netTankFlows[pipe.to] += Q;

    if (pipe.tipoEnlace === 'bomba') {
      return {
        tipoEnlace: 'bomba', id: pipe.id, from: pipe.from, to: pipe.to,
        curveId: pipe.curveId,
        Q_ls: roundVal(Q * 1000),
        V_ms: null, f: null, R: null,
        headGain_m: roundVal(evaluatePumpCurve(pipe.curveCoefficients, Q * 1000) ?? 0),
      };
    }

    const D = Math.max(pipe.diametroM ?? PIPE_DIAMETER_FALLBACK_M, PIPE_DIAMETER_FALLBACK_M);
    const ks = Math.max(pipe.rugosidadM ?? PIPE_ROUGHNESS_FALLBACK_M, PIPE_ROUGHNESS_FALLBACK_M);
    const L = Math.max(pipe.longitudM ?? PIPE_LENGTH_MIN, PIPE_LENGTH_MIN);
    const A = PI * D * D / 4;
    const V = A > 0 ? Math.abs(Q) / A : 0;
    const Re = Math.max(V * D / NU, 1);
    const f = solveDarcyFriction(ks, D, Re);
    const R = (8 * f * L) / (PI * PI * G * Math.pow(D, 5));

    return {
      tipoEnlace: 'tuberia', id: pipe.id, from: pipe.from, to: pipe.to,
      Q_ls: roundVal(Q * 1000), V_ms: roundVal(V), f: roundVal(f), R: roundVal(R),
    };
  });

  // Estados brutos de tanques
  const rawTankStates: HydraulicSolverResult['rawTankStates'] = {};
  for (const tank of tanks) {
    const prevState = tankStates[tank.id];
    const Qnet = netTankFlows[tank.id] ?? 0;
    const mode = tankLimitModes[tank.id] ?? null;

    let rawVol: number;
    if (mode === 'min') rawVol = tank.volumenMinimo;
    else if (mode === 'max') rawVol = tank.volumenMaximo;
    else if (intervalSec > 0 && variableTankIds.has(tank.id))
      rawVol = prevState.volume + Qnet * intervalSec;
    else rawVol = prevState.volume;

    const rawHead = tank.elevacion + rawVol / tank.area;
    if (intervalSec > 0 && mode === null && variableTankIds.has(tank.id)) {
      const solvedHead = getHead(tank.id);
      if (Math.abs(solvedHead - rawHead) > 1e-5) continue; // inconsistencia silenciosa
    }
    rawTankStates[tank.id] = { volume: rawVol, head: rawHead, Qnet_m3s: Qnet, mode };
  }

  const badTank = tanks.find(t => !rawTankStates[t.id]);
  if (badTank) {
    return failure(`Inconsistencia numerica en el tanque ${badTank.id}: la cabeza y el balance de masa no coinciden.`);
  }

  const tankResults = tanks.map(tank => {
    const raw = rawTankStates[tank.id];
    const state = normalizeTankState(tank, { volume: raw.volume });
    return {
      tipo: 'tanque' as const, id: tank.id,
      elevacion: roundVal(tank.elevacion),
      level: roundVal(state.level),
      H: roundVal(state.head),
      volume: roundVal(state.volume),
      Qnet_m3s: roundVal(raw.Qnet_m3s),
      Qnet_ls: roundVal(raw.Qnet_m3s * 1000),
      atMin: state.atMin, atMax: state.atMax,
      mode: raw.mode,
      stateLabel: getTankStateLabel(state),
      tanque: tank,
    };
  });

  const solverTankStates = tankResults.reduce<TankStateMap>((acc, r) => {
    acc[r.id] = normalizeTankState(r.tanque, { volume: r.volume });
    return acc;
  }, {});

  return success({
    nodos: nodeResults, tanques: tankResults, tuberias: pipeResults,
    convergio: converged,
    unsuppliedNodes: Array.from(unsuppliedNodeIds),
    rawTankStates,
    solverState: { H: [...allHeads], Q: [...flows], tanks: cloneTankStates(solverTankStates) },
  });
}

// ─── Resolver estacionario ──────────────────────────────────────────────────────
function solveSteadyNetwork(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[], tankStates: TankStateMap,
  opts: { demandOverrides?: Record<string, number> | null; initialHeads?: number[] | null; initialFlows?: number[] | null } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const modes = buildTankModes(tanks, tankStates);
  const fixed = buildFixedTankHeads(tanks, tankStates, modes, 0);
  return solveHydraulicCore(nodes, reservoirs, tanks, pipes, tankStates, {
    ...opts, intervalSeconds: 0, fixedTankHeads: fixed, tankLimitModes: modes,
  });
}

// ─── Resolver con tanques acoplados (paso temporal) ─────────────────────────────
function solveCoupledNetworkWithTanks(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[], tankStates: TankStateMap,
  opts: {
    demandOverrides?: Record<string, number> | null;
    initialHeads?: number[] | null; initialFlows?: number[] | null;
    intervalSeconds: number;
  }
): AxisCalculationResult<HydraulicSolverResult> {
  let modes = buildTankModes(tanks, tankStates);
  let lastResult: HydraulicSolverResult | null = null;
  let heads = opts.initialHeads ? [...opts.initialHeads] : null;
  let flows = opts.initialFlows ? [...opts.initialFlows] : null;

  for (let iter = 0; iter < MAX_TANK_ACTIVESET_ITERATIONS; iter++) {
    const fixed = buildFixedTankHeads(tanks, tankStates, modes, opts.intervalSeconds);
    const res = solveHydraulicCore(nodes, reservoirs, tanks, pipes, tankStates, {
      demandOverrides: opts.demandOverrides,
      initialHeads: heads, initialFlows: flows,
      intervalSeconds: opts.intervalSeconds, fixedTankHeads: fixed, tankLimitModes: modes,
    });
    if (!res.ok) return res;
    lastResult = res.data;

    const nextModes: TankModeMap = { ...modes };
    let changed = false;

    for (const tank of tanks) {
      const raw = lastResult.rawTankStates[tank.id];
      const curMode = modes[tank.id];
      const tolVol = tank.area * TANK_HEAD_EPS;

      if (!curMode) {
        if (raw.volume < tank.volumenMinimo - tolVol) { nextModes[tank.id] = 'min'; changed = true; }
        else if (raw.volume > tank.volumenMaximo + tolVol) { nextModes[tank.id] = 'max'; changed = true; }
        continue;
      }
      if (curMode === 'min' && raw.Qnet_m3s > TANK_FLOW_EPS) { nextModes[tank.id] = null; changed = true; continue; }
      if (curMode === 'max' && raw.Qnet_m3s < -TANK_FLOW_EPS) { nextModes[tank.id] = null; changed = true; }
    }

    if (!changed) {
      if (!lastResult.convergio)
        return failure('El paso temporal acoplado de tanques no convergio y no se puede usar para avanzar el estado.');
      return success(lastResult);
    }

    modes = nextModes;
    heads = [...lastResult.solverState.H];
    flows = [...lastResult.solverState.Q];
  }

  return lastResult
    ? success({ ...lastResult, convergio: false })
    : failure('No fue posible resolver el paso temporal acoplado de tanques.');
}

function solveNetwork(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[],
  opts: {
    demandOverrides?: Record<string, number> | null;
    initialHeads?: number[] | null; initialFlows?: number[] | null;
    initialTankStates?: TankStateMap | null;
    intervalSeconds?: number;
  } = {}
): AxisCalculationResult<HydraulicSolverResult> {
  const states = buildInitialTankStates(tanks, opts.initialTankStates ?? null);
  const intSec = opts.intervalSeconds ?? 0;

  if (intSec > 0) {
    return solveCoupledNetworkWithTanks(nodes, reservoirs, tanks, pipes, states, {
      demandOverrides: opts.demandOverrides,
      initialHeads: opts.initialHeads ?? null,
      initialFlows: opts.initialFlows ?? null,
      intervalSeconds: intSec,
    });
  }
  return solveSteadyNetwork(nodes, reservoirs, tanks, pipes, states, {
    demandOverrides: opts.demandOverrides,
    initialHeads: opts.initialHeads ?? null,
    initialFlows: opts.initialFlows ?? null,
  });
}

function integrateTanksInterval(
  nodes: PreparedNode[], reservoirs: PreparedReservoir[], tanks: PreparedTank[],
  pipes: PreparedPipe[], demandOverrides: Record<string, number>,
  initResult: HydraulicSolverResult, intervalSec: number, timeLabel: string
): AxisCalculationResult<WarmStartState> {
  if (intervalSec <= 0) {
    return success({ H: [...initResult.solverState.H], Q: [...initResult.solverState.Q], tanks: cloneTankStates(initResult.solverState.tanks) });
  }
  if (!initResult.convergio) {
    return failure(`No se puede avanzar el intervalo en ${timeLabel} porque la hidraulica inicial no convergio.`);
  }
  const res = solveNetwork(nodes, reservoirs, tanks, pipes, {
    demandOverrides, initialHeads: initResult.solverState.H, initialFlows: initResult.solverState.Q,
    initialTankStates: initResult.solverState.tanks, intervalSeconds: intervalSec,
  });
  if (!res.ok) return res;
  if (!res.data.convergio) {
    return failure(`El paso temporal acoplado no convergio en ${timeLabel}; no se propagara un warmStart inconsistente.`);
  }
  return success({ H: [...res.data.solverState.H], Q: [...res.data.solverState.Q], tanks: cloneTankStates(res.data.solverState.tanks) });
}

// ─── Preparación del modelo (parseo de inputs) ──────────────────────────────────
function normalizeMultipliers(values?: string[]): string[] {
  return Array.from({ length: 24 }, (_, i) => values?.[i] ?? DEFAULT_PATTERN_VALUES[i]);
}

function prepareModel(rawNodes: AxisNodeInputEntry[], rawConns: AxisConnectionInputEntry[]): AxisCalculationResult<PreparedModel> {
  const usedIds = new Map<string, string>();
  const registerId = (id: string, label: string): AxisCalculationResult<string> => {
    const trimmed = id.trim();
    if (!trimmed) return failure(`${label} debe tener un ID.`);
    if (usedIds.has(trimmed)) return failure(`El ID "${trimmed}" esta repetido entre ${usedIds.get(trimmed)} y ${label}.`);
    usedIds.set(trimmed, label);
    return success(trimmed);
  };

  const nodes: PreparedNode[] = [];
  const reservoirs: PreparedReservoir[] = [];
  const tanks: PreparedTank[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const entry = rawNodes[i];
    const label = `Nodo ${i + 1}`;

    if (entry.type === 'nodo') {
      const idR = registerId(entry.nodeId, label); if (!idR.ok) return idR;
      const xR = convertLength(entry.x, entry.xUnit, `${label} X`); if (!xR.ok) return xR;
      const yR = convertLength(entry.y, entry.yUnit, `${label} Y`); if (!yR.ok) return yR;
      const zR = convertLength(entry.z, entry.zUnit, `${label} Elevacion`); if (!zR.ok) return zR;
      const elevCheck = assertRange(zR.data, `${label} Elevacion`, { min: -10000, max: 10000 });
      if (!elevCheck.ok) return elevCheck;
      nodes.push({
        tipo: 'nodo', id: idR.data, x: xR.data, y: yR.data, elevacion: zR.data,
        demandaLs: convertDemandToLs(entry.demanda, entry.demandaUnit),
        patternId: entry.patternId ?? '',
      });

    } else if (entry.type === 'reservorio') {
      const idR = registerId(entry.nodeId, label); if (!idR.ok) return idR;
      const xR = convertLength(entry.x, entry.xUnit, `${label} X`); if (!xR.ok) return xR;
      const yR = convertLength(entry.y, entry.yUnit, `${label} Y`); if (!yR.ok) return yR;
      const zR = convertLength(entry.z, entry.zUnit, `${label} Carga total`); if (!zR.ok) return zR;
      const headCheck = assertRange(zR.data, `${label} Carga total`, { min: -10000, max: 10000 });
      if (!headCheck.ok) return headCheck;
      reservoirs.push({ tipo: 'reservorio', id: idR.data, x: xR.data, y: yR.data, head: zR.data });

    } else if (entry.type === 'tanque') {
      const idR = registerId(entry.nodeId, label); if (!idR.ok) return idR;
      const xR = convertLength(entry.x, entry.xUnit, `${label} X`); if (!xR.ok) return xR;
      const yR = convertLength(entry.y, entry.yUnit, `${label} Y`); if (!yR.ok) return yR;
      const elevR = convertLength(entry.z, entry.zUnit, `${label} Elevacion`); if (!elevR.ok) return elevR;
      const dR = convertLength(entry.diametro, entry.diametroUnit, `${label} Diametro`); if (!dR.ok) return dR;
      const dCheck = assertRange(dR.data, `${label} Diametro`, { min: 0, strictMin: true }); if (!dCheck.ok) return dCheck;
      const nIni = convertOptionalLength(entry.nivelIni, entry.nivelIniUnit);
      const nMin = convertOptionalLength(entry.nivelMin, entry.nivelMinUnit);
      const nMax = convertOptionalLength(entry.nivelMax, entry.nivelMaxUnit);
      if (nMin >= nMax && nMax > 0) {
        return failure(`${label}: el nivel minimo debe ser menor que el nivel maximo.`);
      }
      const area = tankArea(dR.data);
      tanks.push({
        tipo: 'tanque', id: idR.data, x: xR.data, y: yR.data, elevacion: elevR.data,
        nivelInicial: nIni, nivelMinimo: nMin, nivelMaximo: nMax,
        diametroM: dR.data, area,
        volumenMinimo: area * nMin, volumenMaximo: area * nMax, volumenInicial: area * nIni,
      });
    }
  }

  const pipes: PreparedPipe[] = [];
  for (let i = 0; i < rawConns.length; i++) {
    const entry = rawConns[i];
    const label = `Conexion ${i + 1} (${entry.tubId})`;
    if (!entry.from || !entry.to || entry.from === entry.to) continue;

    if (entry.type === 'bomba') {
      pipes.push({
        id: entry.tubId, tipoEnlace: 'bomba',
        from: entry.from, to: entry.to,
        longitudM: null, diametroM: null, rugosidadM: null,
        curveId: entry.curveId,
        curveCoefficients: entry.curveCoefficients ?? null,
        maxFlowLs: entry.maxFlowLs ?? null,
      });
    } else {
      const longR = convertLength(entry.longitud, 'm', `${label} Longitud`); if (!longR.ok) return longR;
      const longCheck = assertRange(longR.data, `${label} Longitud`, { min: 0, strictMin: true }); if (!longCheck.ok) return longCheck;
      const diamR = convertLength(entry.diametro, entry.diametroUnit, `${label} Diametro`); if (!diamR.ok) return diamR;
      const diamCheck = assertRange(diamR.data, `${label} Diametro`, { min: 0, strictMin: true }); if (!diamCheck.ok) return diamCheck;
      const rugR = convertLength(entry.rugosidad, entry.rugosidadUnit, `${label} Rugosidad`); if (!rugR.ok) return rugR;
      const rugCheck = assertRange(rugR.data, `${label} Rugosidad`, { min: 0 }); if (!rugCheck.ok) return rugCheck;
      pipes.push({
        id: entry.tubId, tipoEnlace: 'tuberia',
        from: entry.from, to: entry.to,
        longitudM: longR.data, diametroM: diamR.data, rugosidadM: rugR.data,
      });
    }
  }

  if (reservoirs.length === 0 && tanks.length === 0) {
    return failure('Se necesita al menos un reservorio o tanque con carga hidraulica.');
  }
  if (pipes.length === 0) return failure('No hay conexiones validas definidas.');

  return success({ nodos: nodes, reservorios: reservoirs, tanques: tanks, pipes });
}

// ─── Lectura de configuración temporal ─────────────────────────────────────────
function readTemporalConfig(cfg: TemporalAnalysisConfig): AxisCalculationResult<{ enabled: boolean; durationMinutes: number; stepMinutes: number }> {
  if (!cfg.enabled) return success({ enabled: false, durationMinutes: 0, stepMinutes: 0 });

  const durR = readHourMinutePairStrict(cfg.durationHours, cfg.durationMinutes, 'La duracion total');
  if (!durR.ok) return durR;
  const stepR = readHourMinutePairStrict(cfg.stepHours, cfg.stepMinutes, 'El paso de analisis');
  if (!stepR.ok) return stepR;

  if (durR.data.totalMinutes <= 0) return failure('La duracion total debe ser mayor que 00:00.');
  if (stepR.data.totalMinutes <= 0) return failure('El paso de analisis debe ser mayor que 00:00.');
  if (stepR.data.totalMinutes > durR.data.totalMinutes)
    return failure('El paso de analisis no puede ser mayor que la duracion total del periodo.');

  return success({ enabled: true, durationMinutes: durR.data.totalMinutes, stepMinutes: stepR.data.totalMinutes });
}

function readDemandPatterns(patterns: TemporalPatternEntry[]): AxisCalculationResult<PatternDefinition[]> {
  if (patterns.length === 0) return failure('Define al menos un patron de demanda para el analisis temporal.');
  const usedIds = new Set<string>();
  const result: PatternDefinition[] = [];

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    const id = p.patternId.trim();
    if (!id) return failure(`El patron ${i + 1} debe tener un ID.`);
    if (usedIds.has(id)) return failure(`El ID de patron "${id}" esta repetido.`);
    usedIds.add(id);

    const multipliers = normalizeMultipliers(p.multipliers).map(raw => {
      const v = parseNumber(raw === '' ? '1' : raw);
      return v !== null && v >= 0 ? v : null;
    });
    const badIdx = multipliers.findIndex(m => m === null);
    if (badIdx >= 0) return failure(`El patron ${id} tiene un multiplicador invalido en ${getPatternHourLabel(badIdx * 60)}.`);
    result.push({ id, multipliers: multipliers as number[] });
  }
  return success(result);
}

function buildDemandsForTime(
  nodes: PreparedNode[], patternMap: Record<string, PatternDefinition>, timeMinutes: number
): AxisCalculationResult<Record<string, number>> {
  const overrides: Record<string, number> = {};
  const fallback = Object.keys(patternMap)[0];
  for (const node of nodes) {
    const pid = node.patternId || fallback;
    const pattern = patternMap[pid];
    if (!pattern) return failure(`El nodo ${node.id} referencia un patron inexistente (${pid || 'sin patron'}).`);
    const factor = pattern.multipliers[getPatternHourIndex(timeMinutes)] ?? 1;
    overrides[node.id] = node.demandaLs * factor;
  }
  return success(overrides);
}

function stripSolverState(r: HydraulicSolverResult): AxisHydraulicStepResult {
  return {
    nodos: r.nodos,
    tanques: r.tanques.map(({ tanque: _t, ...rest }) => rest),
    tuberias: r.tuberias,
    convergio: r.convergio,
  };
}

// ─── Ejecutar análisis hidráulico completo ──────────────────────────────────────
function executeHydraulicAnalysis(model: PreparedModel, cfg: TemporalAnalysisConfig): AxisCalculationResult<AxisHydraulicAnalysisResult> {
  const tcfg = readTemporalConfig(cfg);
  if (!tcfg.ok) return tcfg;

  const initTankStates = buildInitialTankStates(model.tanques);

  if (!tcfg.data.enabled) {
    const r = solveNetwork(model.nodos, model.reservorios, model.tanques, model.pipes, { initialTankStates: initTankStates });
    if (!r.ok) return r;
    return success({ mode: 'steady', durationMinutes: 0, stepMinutes: 0, frames: [{ timeMinutes: 0, result: stripSolverState(r.data) }] });
  }

  const patternsR = readDemandPatterns(cfg.patterns);
  if (!patternsR.ok) return patternsR;
  const patternMap: Record<string, PatternDefinition> = {};
  for (const p of patternsR.data) patternMap[p.id] = p;

  const frames: AxisHydraulicFrame[] = [];
  const instants = buildAnalysisInstants(tcfg.data.durationMinutes, tcfg.data.stepMinutes);
  let warmStart: WarmStartState = { H: null, Q: null, tanks: cloneTankStates(initTankStates) };
  let partialMessage = '';

  for (let idx = 0; idx < instants.length; idx++) {
    const t = instants[idx];
    const demsR = buildDemandsForTime(model.nodos, patternMap, t);
    if (!demsR.ok) { partialMessage = demsR.error; break; }

    const res = solveNetwork(model.nodos, model.reservorios, model.tanques, model.pipes, {
      demandOverrides: demsR.data,
      initialHeads: warmStart.H, initialFlows: warmStart.Q, initialTankStates: warmStart.tanks,
    });
    if (!res.ok) { partialMessage = res.error; break; }

    frames.push({ timeMinutes: t, result: stripSolverState(res.data) });

    const nextT = instants[idx + 1];
    if (nextT !== undefined) {
      const wsR = integrateTanksInterval(
        model.nodos, model.reservorios, model.tanques, model.pipes,
        demsR.data, res.data, (nextT - t) * 60, formatTimeMinutes(t)
      );
      if (!wsR.ok) { partialMessage = wsR.error; break; }
      warmStart = wsR.data;
    }
  }

  if (frames.length === 0 && partialMessage) return failure(partialMessage);

  return success({
    mode: 'extended',
    durationMinutes: tcfg.data.durationMinutes,
    stepMinutes: tcfg.data.stepMinutes,
    frames, partial: !!partialMessage, partialMessage,
  });
}

// ─── Función pública principal ──────────────────────────────────────────────────
export function runAxisHydraulicAnalysis(
  rawNodes: AxisNodeInputEntry[],
  rawConnections: AxisConnectionInputEntry[],
  temporalConfig: TemporalAnalysisConfig
): AxisCalculationResult<AxisHydraulicAnalysisResult> {
  if (!rawNodes.some(n => n.type === 'reservorio' || n.type === 'tanque')) {
    return failure('Se necesita al menos un reservorio o tanque con carga hidraulica para calcular la red.');
  }
  if (!rawConnections.some(c => c.from && c.to && c.from !== c.to)) {
    return failure('No hay conexiones definidas o ninguna tiene puntos asignados.');
  }

  const model = prepareModel(rawNodes, rawConnections);
  if (!model.ok) return model;

  const analysis = executeHydraulicAnalysis(model.data, temporalConfig);
  if (!analysis.ok) return analysis;

  const warnings: string[] = [];
  const nonConverged = analysis.data.frames.filter(f => !f.result.convergio);
  if (nonConverged.length > 0) {
    warnings.push(
      analysis.data.mode === 'extended'
        ? `La simulacion termino, pero ${nonConverged.length} de ${analysis.data.frames.length} pasos no alcanzaron convergencia total.`
        : 'El calculo termino, pero no alcanzo convergencia total.'
    );
  }
  if (analysis.data.partialMessage) warnings.push(analysis.data.partialMessage);

  return success(analysis.data, warnings);
}

/*
 * ─── INSTRUCCIÓN ADICIONAL PARA AxisScreen.tsx ────────────────────────────────
 *
 * El cálculo es síncrono y puede tardar algunos milisegundos incluso con native
 * float. Para no bloquear el hilo de UI y mostrar un indicador de carga, cambiar
 * handleCalcular en AxisScreen.tsx así:
 *
 *   import { InteractionManager } from 'react-native';
 *
 *   const handleCalcular = useCallback(() => {
 *     stopTemporalPlayback();
 *     setIsCalculating(true);          // mostrar spinner
 *
 *     // Ceder el hilo al motor de UI para que el spinner aparezca
 *     InteractionManager.runAfterInteractions(() => {
 *       setTimeout(() => {
 *         const result = runAxisHydraulicAnalysis(
 *           nodesRef.current as AxisNodeInputEntry[],
 *           connectionsRef.current.map(conn => { ... }),
 *           temporalConfig
 *         );
 *         setIsCalculating(false);     // quitar spinner
 *         if (!result.ok) { Toast.show({ type: 'error', text2: result.error }); return; }
 *         setAnalysisResult(result.data);
 *         applyAnalysisFrame(result.data, 0);
 *       }, 0);
 *     });
 *   }, [...]);
 *
 * Agregar al estado: const [isCalculating, setIsCalculating] = useState(false);
 * Y mostrar un ActivityIndicator sobre el botón mientras isCalculating === true.
 */