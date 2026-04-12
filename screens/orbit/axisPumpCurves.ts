export interface PumpCurvePointEntry {
  id: number;
  flow: string;
  head: string;
}

export interface PumpCurveEntry {
  id: number;
  curveId: string;
  points: PumpCurvePointEntry[];
}

export interface PumpCurveCoefficients {
  a: number;
  b: number;
  c: number;
}

export interface PumpCurvePointValue {
  flow: number;
  head: number;
}

export interface PumpCurveDerivedState {
  validPoints: PumpCurvePointValue[];
  invalidRows: number;
  coefficients: PumpCurveCoefficients | null;
  curveSamples: PumpCurvePointValue[];
  maxFlowLs: number;
  isReady: boolean;
}

const DEFAULT_POINT_ROWS = 3;

function parseOptionalFiniteNumber(rawValue: string | undefined | null): number | null {
  if (rawValue === undefined || rawValue === null) return null;
  const normalized = String(rawValue).trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function gaussianElimination(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < size; column += 1) {
    let maxRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[maxRow][column])) {
        maxRow = row;
      }
    }

    [augmented[column], augmented[maxRow]] = [augmented[maxRow], augmented[column]];

    if (Math.abs(augmented[column][column]) < 1e-12) {
      return null;
    }

    const pivot = augmented[column][column];
    for (let row = column + 1; row < size; row += 1) {
      const factor = augmented[row][column] / pivot;
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let value = augmented[row][size];
    for (let column = row + 1; column < size; column += 1) {
      value -= augmented[row][column] * solution[column];
    }
    solution[row] = value / augmented[row][row];
  }

  return solution;
}

export function fitPumpCurveQuadratic(points: PumpCurvePointValue[]): PumpCurveCoefficients | null {
  if (!Array.isArray(points) || points.length < 3) return null;

  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;

  points.forEach(point => {
    const q = point.flow;
    const h = point.head;
    const q2 = q * q;
    s0 += 1;
    s1 += q;
    s2 += q2;
    s3 += q2 * q;
    s4 += q2 * q2;
    t0 += h;
    t1 += q * h;
    t2 += q2 * h;
  });

  const solution = gaussianElimination(
    [
      [s0, s1, s2],
      [s1, s2, s3],
      [s2, s3, s4],
    ],
    [t0, t1, t2],
  );

  if (!solution || solution.some(value => !Number.isFinite(value))) return null;

  return {
    a: solution[0],
    b: solution[1],
    c: solution[2],
  };
}

export function evaluatePumpCurve(coefficients: PumpCurveCoefficients | null, flow: number): number | null {
  if (!coefficients) return null;
  return coefficients.a + coefficients.b * flow + coefficients.c * flow * flow;
}

export function evaluatePumpCurveSlope(coefficients: PumpCurveCoefficients | null, flow: number): number | null {
  if (!coefficients) return null;
  return coefficients.b + 2 * coefficients.c * flow;
}

function buildPumpCurveSamples(
  coefficients: PumpCurveCoefficients | null,
  validPoints: PumpCurvePointValue[],
  segments = 48,
): PumpCurvePointValue[] {
  if (!coefficients || validPoints.length < 2) return [];

  const minFlow = validPoints[0].flow;
  const maxFlow = validPoints[validPoints.length - 1].flow;
  if (!Number.isFinite(minFlow) || !Number.isFinite(maxFlow)) return [];

  const samples: PumpCurvePointValue[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const flow = minFlow + ((maxFlow - minFlow) * index) / segments;
    const head = evaluatePumpCurve(coefficients, flow);
    if (head !== null && Number.isFinite(head)) {
      samples.push({ flow, head });
    }
  }
  return samples;
}

export function normalizePumpCurvePoints(points?: PumpCurvePointEntry[]): PumpCurvePointEntry[] {
  const safePoints = Array.isArray(points)
    ? points.map((point, index) => ({
        id: Number.isFinite(point?.id) ? Number(point.id) : index + 1,
        flow: point?.flow ?? '',
        head: point?.head ?? '',
      }))
    : [];

  while (safePoints.length < DEFAULT_POINT_ROWS) {
    safePoints.push({
      id: safePoints.length > 0 ? Math.max(...safePoints.map(point => point.id)) + 1 : safePoints.length + 1,
      flow: '',
      head: '',
    });
  }

  return safePoints;
}

export function normalizePumpCurves(curves?: PumpCurveEntry[]): PumpCurveEntry[] {
  return Array.isArray(curves)
    ? curves.map((curve, index) => ({
        id: Number.isFinite(curve?.id) ? Number(curve.id) : index + 1,
        curveId: curve?.curveId ?? '',
        points: normalizePumpCurvePoints(curve?.points),
      }))
    : [];
}

export function getPumpCurveIds(curves: PumpCurveEntry[]): string[] {
  const seen = new Set<string>();
  return curves
    .map(curve => curve.curveId.trim())
    .filter(curveId => {
      if (!curveId || seen.has(curveId)) return false;
      seen.add(curveId);
      return true;
    });
}

export function derivePumpCurveState(curve: PumpCurveEntry): PumpCurveDerivedState {
  const validPoints: PumpCurvePointValue[] = [];
  let invalidRows = 0;

  curve.points.forEach(point => {
    const flowRaw = point.flow.trim();
    const headRaw = point.head.trim();
    const flow = parseOptionalFiniteNumber(flowRaw);
    const head = parseOptionalFiniteNumber(headRaw);
    const rowEmpty = flowRaw === '' && headRaw === '';
    const rowValid = !rowEmpty && flow !== null && head !== null;

    if (!rowEmpty && !rowValid) {
      invalidRows += 1;
    }

    if (rowValid) {
      validPoints.push({ flow: flow as number, head: head as number });
    }
  });

  validPoints.sort((left, right) => left.flow - right.flow);

  if (validPoints.length < 3) {
    return {
      validPoints,
      invalidRows,
      coefficients: null,
      curveSamples: [],
      maxFlowLs: validPoints.reduce((max, point) => Math.max(max, point.flow), 0),
      isReady: false,
    };
  }

  const coefficients = fitPumpCurveQuadratic(validPoints);
  if (!coefficients) {
    return {
      validPoints,
      invalidRows,
      coefficients: null,
      curveSamples: [],
      maxFlowLs: validPoints.reduce((max, point) => Math.max(max, point.flow), 0),
      isReady: false,
    };
  }

  return {
    validPoints,
    invalidRows,
    coefficients,
    curveSamples: buildPumpCurveSamples(coefficients, validPoints),
    maxFlowLs: validPoints.reduce((max, point) => Math.max(max, point.flow), 0),
    isReady: true,
  };
}
