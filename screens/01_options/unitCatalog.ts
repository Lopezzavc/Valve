export type UnitCategoryKey =
  | 'length'
  | 'area'
  | 'velocity'
  | 'acceleration'
  | 'density'
  | 'dynamicViscosity'
  | 'kinematicViscosity'
  | 'viscosity'
  | 'flow'
  | 'flowRate'
  | 'pressure'
  | 'specificWeight'
  | 'temperature';

type UnitDefinition = {
  units: string[];
  factors: Record<string, number>;
};

const baseUnitDefinitions: Record<
  Exclude<UnitCategoryKey, 'viscosity' | 'flowRate'>,
  UnitDefinition
> = {
  length: {
    units: ['m', 'mm', 'cm', 'km', 'µm', 'in', 'ft', 'yd', 'mi'],
    factors: {
      m: 1,
      mm: 1e-3,
      cm: 1e-2,
      km: 1e3,
      'µm': 1e-6,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    },
  },
  area: {
    units: ['m²', 'cm²', 'mm²', 'km²', 'ha', 'in²', 'ft²', 'yd²', 'mi²', 'acre'],
    factors: {
      'm²': 1,
      'cm²': 1e-4,
      'mm²': 1e-6,
      'km²': 1e6,
      ha: 1e4,
      'in²': 0.00064516,
      'ft²': 0.09290304,
      'yd²': 0.83612736,
      'mi²': 2589988.110336,
      acre: 4046.8564224,
    },
  },
  velocity: {
    units: ['m/s', 'km/h', 'ft/s', 'mph', 'kn', 'cm/s', 'in/s'],
    factors: {
      'm/s': 1,
      'km/h': 1 / 3.6,
      'ft/s': 0.3048,
      mph: 0.44704,
      kn: 0.5144444444444445,
      'cm/s': 0.01,
      'in/s': 0.0254,
    },
  },
  acceleration: {
    units: ['m/s²', 'ft/s²', 'g', 'km/h²', 'cm/s²'],
    factors: {
      'm/s²': 1,
      'ft/s²': 0.3048,
      g: 9.80665,
      'km/h²': 1000 / 12960000,
      'cm/s²': 0.01,
    },
  },
  density: {
    units: ['kg/m³', 'g/cm³', 'kg/L', 'g/L', 'lb/ft³'],
    factors: {
      'kg/m³': 1,
      'g/cm³': 1000,
      'kg/L': 1000,
      'g/L': 1,
      'lb/ft³': 16.01846337396014,
    },
  },
  dynamicViscosity: {
    units: ['Pa·s', 'mPa·s', 'cP', 'P', 'µPa·s', 'kg/(m·s)', 'lb/(ft·s)', 'lb/(ft·h)'],
    factors: {
      'Pa·s': 1,
      'mPa·s': 1e-3,
      cP: 1e-3,
      P: 0.1,
      'µPa·s': 1e-6,
      'kg/(m·s)': 1,
      'lb/(ft·s)': 1.48816394357,
      'lb/(ft·h)': 1.48816394357 / 3600,
    },
  },
  kinematicViscosity: {
    units: ['m²/s', 'cm²/s', 'mm²/s', 'cSt', 'St', 'ft²/s', 'ft²/h'],
    factors: {
      'm²/s': 1,
      'cm²/s': 1e-4,
      'mm²/s': 1e-6,
      cSt: 1e-6,
      St: 1e-4,
      'ft²/s': 0.09290304,
      'ft²/h': 0.09290304 / 3600,
    },
  },
  flow: {
    units: ['m³/s', 'L/s', 'cm³/s', 'L/min', 'L/h', 'm³/min', 'm³/h', 'ft³/s', 'gal/min'],
    factors: {
      'm³/s': 1,
      'L/s': 1e-3,
      'cm³/s': 1e-6,
      'L/min': 1 / 60000,
      'L/h': 1 / 3600000,
      'm³/min': 1 / 60,
      'm³/h': 1 / 3600,
      'ft³/s': 0.028316846592,
      'gal/min': 0.0000630901964,
    },
  },
  pressure: {
    units: ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi', 'mmHg', 'Torr', 'mca'],
    factors: {
      Pa: 1,
      kPa: 1e3,
      MPa: 1e6,
      bar: 1e5,
      atm: 101325,
      psi: 6894.757293168361,
      mmHg: 133.322387415,
      Torr: 133.32236842105263,
      mca: 9806.65,
    },
  },
  specificWeight: {
    units: ['N/m³', 'kN/m³', 'lbf/ft³'],
    factors: {
      'N/m³': 1,
      'kN/m³': 1e3,
      'lbf/ft³': 157.087463844041,
    },
  },
  temperature: {
    units: ['°C', '°F', 'K'],
    factors: {
      '°C': 1,
      '°F': 1,
      K: 1,
    },
  },
};

export const UNIT_OPTIONS: Record<string, string[]> = {
  ...Object.fromEntries(
    Object.entries(baseUnitDefinitions).map(([category, definition]) => [
      category,
      definition.units,
    ]),
  ),
  viscosity: baseUnitDefinitions.kinematicViscosity.units,
  flowRate: baseUnitDefinitions.flow.units,
};

export const UNIT_FACTORS: Record<string, Record<string, number>> = {
  ...Object.fromEntries(
    Object.entries(baseUnitDefinitions).map(([category, definition]) => [
      category,
      definition.factors,
    ]),
  ),
  viscosity: baseUnitDefinitions.kinematicViscosity.factors,
  flowRate: baseUnitDefinitions.flow.factors,
};

export const TEMPERATURE_UNITS = UNIT_OPTIONS.temperature;

export const convertTemperature = (
  value: number,
  fromUnit: string,
  toUnit: string,
): number => {
  if (fromUnit === toUnit) {
    return value;
  }

  let celsiusValue = value;
  if (fromUnit === '°F') {
    celsiusValue = ((value - 32) * 5) / 9;
  } else if (fromUnit === 'K') {
    celsiusValue = value - 273.15;
  }

  if (toUnit === '°F') {
    return (celsiusValue * 9) / 5 + 32;
  }
  if (toUnit === 'K') {
    return celsiusValue + 273.15;
  }

  return celsiusValue;
};

export const isTemperatureCategory = (category: string): boolean =>
  category === 'temperature';
