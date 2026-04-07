import {
  FITTINGS_CATALOG,
  FittingGroup,
  FittingItem,
} from '../../src/data/perdidasLocalizadasFittings';
import { UNIT_OPTIONS } from './unitCatalog';

export type OptionsConfigKey =
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
  | 'temperature'
  | 'reynoldsPresetFluids'
  | 'continuidadSectionType'
  | 'continuidadFillType'
  | 'geometriaSectionType'
  | 'pipeMaterial'
  | 'frictionEquation'
  | 'perdidasFittingType';

export type CalculatorOptionsScreenParams = {
  configKey: OptionsConfigKey;
  titleKey?: string;
  selectedOption?: string;
  onSelectOption?: (option: string) => void;
};

type Translator = (key: string) => string;

export type SharedOptionItem = {
  option: string;
  label: string;
  rightLabel?: string;
};

export type SharedOptionSection = {
  key: string;
  title: string;
  items: SharedOptionItem[];
};

type FlatOptionsDefinition = {
  kind: 'flat';
  titleKey: string;
  subtitleKey: string;
  getItems: (t: Translator) => SharedOptionItem[];
  isSelected?: (itemOption: string, selectedOption?: string) => boolean;
};

type SectionedOptionsDefinition = {
  kind: 'sectioned';
  titleKey: string;
  subtitleKey: string;
  getSections: (t: Translator) => SharedOptionSection[];
  isSelected?: (itemOption: string, selectedOption?: string) => boolean;
};

export type SharedOptionsDefinition =
  | FlatOptionsDefinition
  | SectionedOptionsDefinition;

type CalculatorOptionContext =
  | 'bernoulli'
  | 'reynolds'
  | 'colebrook'
  | 'froude'
  | 'continuidad'
  | 'energiaBernoulli'
  | 'geometria'
  | 'factorFriccion'
  | 'perdidasLocalizadas'
  | 'diseno'
  | 'diseno2'
  | 'potencia'
  | 'compDisenoSerie'
  | 'compParalelo'
  | 'seriePotencia'
  | 'paraleloPotencia';

type BuildOptionsParamsInput = {
  category: string;
  onSelectOption?: (option: string) => void;
  selectedOption?: string;
  fieldLabel?: string;
};

type ContextPreset = {
  configKey: OptionsConfigKey;
  titleKey?: string;
  resolveTitleKey?: (fieldLabel?: string) => string;
};

const unitItems = (configKey: keyof typeof UNIT_OPTIONS): SharedOptionItem[] =>
  (UNIT_OPTIONS[configKey] ?? []).map((option) => ({
    option,
    label: option,
  }));

const normalizeLabel = (label?: string): string =>
  (label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, '0')
    .replace(/1/g, '1')
    .replace(/2/g, '2')
    .replace(/3/g, '3')
    .replace(/4/g, '4')
    .replace(/5/g, '5')
    .replace(/6/g, '6')
    .replace(/7/g, '7')
    .replace(/8/g, '8')
    .replace(/9/g, '9')
    .replace(/ρ/g, 'rho')
    .replace(/γ/g, 'gamma')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getContinuidadTitleKey = (fieldLabel?: string): string => {
  const normalized = normalizeLabel(fieldLabel);

  if (normalized.includes('altura de lamina')) {
    return 'continuidadCalc.labels.fillHeight';
  }
  if (normalized.includes('velocidad en la seccion') && normalized.includes('v1')) {
    return 'continuidadCalc.labels.v1';
  }
  if (normalized.includes('velocidad en la seccion') && normalized.includes('v2')) {
    return 'continuidadCalc.labels.v2';
  }
  if (normalized.includes('diametro')) {
    return 'continuidadCalc.labels.diameter';
  }
  if (normalized === 'velocidad') {
    return 'continuidadCalc.labels.velocity';
  }
  if (normalized.includes('a1')) {
    return 'continuidadCalc.labels.A1';
  }
  if (normalized.includes('a2')) {
    return 'continuidadCalc.labels.A2';
  }

  return 'optionsScreen.titles.generic';
};

const getEnergiaBernoulliTitleKey = (fieldLabel?: string): string => {
  const normalized = normalizeLabel(fieldLabel);
  const titleMap: Record<string, string> = {
    p1: 'energiaBernoulliCalc.labels.P1',
    z1: 'energiaBernoulliCalc.labels.z1',
    v1: 'energiaBernoulliCalc.labels.V1',
    p2: 'energiaBernoulliCalc.labels.P2',
    z2: 'energiaBernoulliCalc.labels.z2',
    v2: 'energiaBernoulliCalc.labels.V2',
    gamma: 'energiaBernoulliCalc.labels.gamma',
    g: 'energiaBernoulliCalc.labels.g',
    hb: 'energiaBernoulliCalc.labels.hb',
    ht: 'energiaBernoulliCalc.labels.ht',
    hl: 'energiaBernoulliCalc.labels.hL',
    l: 'energiaBernoulliCalc.labels.L',
    d1: 'energiaBernoulliCalc.labels.D1',
    d2: 'energiaBernoulliCalc.labels.D2',
    f: 'energiaBernoulliCalc.labels.f',
    k: 'energiaBernoulliCalc.labels.K',
    p_s: 'energiaBernoulliCalc.labels.Ps',
    v_s: 'energiaBernoulliCalc.labels.Vs',
    p_atm: 'energiaBernoulliCalc.labels.Patm',
    z0: 'energiaBernoulliCalc.labels.z0',
    z_s: 'energiaBernoulliCalc.labels.zs',
    h_fs: 'energiaBernoulliCalc.labels.hfs',
    rho: 'energiaBernoulliCalc.labels.rho',
    t: 'energiaBernoulliCalc.labels.temperatura',
    p_v: 'energiaBernoulliCalc.labels.Pv',
  };

  return titleMap[normalized] ?? 'optionsScreen.titles.generic';
};

const reynoldsPresetOptions = [
  'custom',
  'water_0C',
  'water_4C',
  'water_5C',
  'water_10C',
  'water_15C',
  'water_20C',
  'water_25C',
  'water_30C',
  'water_35C',
  'water_40C',
  'water_50C',
  'water_60C',
  'water_70C',
  'water_80C',
  'water_90C',
  'acetone_20C',
  'ethanol_20C',
  'glycerin_20C',
  'mercury_20C',
  'sae10_20C',
];

const pipeMaterials: { option: string; labelKey: string }[] = [
  { option: 'Personalizado', labelKey: 'colebrookCalc.materials.custom' },
  { option: 'Acero comercial', labelKey: 'colebrookCalc.materials.commercialSteel' },
  { option: 'Hierro fundido', labelKey: 'colebrookCalc.materials.castIron' },
  { option: 'Concreto', labelKey: 'colebrookCalc.materials.concrete' },
  { option: 'PVC', labelKey: 'colebrookCalc.materials.pvc' },
  { option: 'Cobre', labelKey: 'colebrookCalc.materials.copper' },
  { option: 'Acero galvanizado', labelKey: 'colebrookCalc.materials.galvanizedSteel' },
];

const frictionEquations = [
  'colebrook-white',
  'haaland',
  'swamee-jain',
  'churchill',
  'serghides',
  'blasius',
  'von-karman',
];

export const SHARED_OPTIONS_REGISTRY: Record<OptionsConfigKey, SharedOptionsDefinition> = {
  length: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.length',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('length'),
  },
  area: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.area',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('area'),
  },
  velocity: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.velocity',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('velocity'),
  },
  acceleration: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.acceleration',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('acceleration'),
  },
  density: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.density',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('density'),
  },
  dynamicViscosity: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.dynamicViscosity',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('dynamicViscosity'),
  },
  kinematicViscosity: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.viscosity',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('kinematicViscosity'),
  },
  viscosity: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.viscosity',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('viscosity'),
  },
  flow: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.flow',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('flow'),
  },
  flowRate: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.flow',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('flowRate'),
  },
  pressure: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.pressure',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('pressure'),
  },
  specificWeight: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.specificWeight',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('specificWeight'),
  },
  temperature: {
    kind: 'flat',
    titleKey: 'optionsScreen.titles.temperature',
    subtitleKey: 'optionsScreen.subtitles.units',
    getItems: () => unitItems('temperature'),
  },
  reynoldsPresetFluids: {
    kind: 'flat',
    titleKey: 'reynoldsCalc.labels.presetFluids',
    subtitleKey: 'optionsScreen.subtitles.generic',
    getItems: (t) =>
      reynoldsPresetOptions.map((option) => ({
        option,
        label: t(`reynoldsCalc.fluids.${option}`) || option,
      })),
  },
  continuidadSectionType: {
    kind: 'flat',
    titleKey: 'continuidadCalc.labels.sectionType',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getItems: (t) => [
      {
        option: 'Circular',
        label: t('continuidadCalc.options.sectionType.circular') || 'Circular',
      },
      {
        option: 'Cuadrada',
        label: t('continuidadCalc.options.sectionType.square') || 'Cuadrada',
      },
      {
        option: 'Rectangular',
        label: t('continuidadCalc.options.sectionType.rectangular') || 'Rectangular',
      },
    ],
  },
  continuidadFillType: {
    kind: 'flat',
    titleKey: 'continuidadCalc.labels.fillType',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getItems: (t) => [
      {
        option: 'Total',
        label: t('continuidadCalc.options.fillType.total') || 'Total',
      },
      {
        option: 'Parcial',
        label: t('continuidadCalc.options.fillType.partial') || 'Parcial',
      },
    ],
  },
  geometriaSectionType: {
    kind: 'flat',
    titleKey: 'geometriaSeccionesCalc.labels.sectionType',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getItems: (t) =>
      [
        'circular-llena',
        'circular-parcial',
        'rectangular',
        'trapezoidal',
        'triangular',
        'parabolico',
      ].map((option) => ({
        option,
        label:
          t(`geometriaSeccionesCalc.options.sectionType.${option}`) || option,
      })),
  },
  pipeMaterial: {
    kind: 'flat',
    titleKey: 'colebrookCalc.labels.material',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getItems: (t) =>
      pipeMaterials.map((item) => ({
        option: item.option,
        label: t(item.labelKey) || item.option,
      })),
  },
  frictionEquation: {
    kind: 'flat',
    titleKey: 'factorFriccionCalc.labels.equation',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getItems: (t) =>
      frictionEquations.map((option) => ({
        option,
        label: t(`factorFriccionCalc.equations.${option}`) || option,
      })),
  },
  perdidasFittingType: {
    kind: 'sectioned',
    titleKey: 'perdidasLocalizadasFittings.screenTitle',
    subtitleKey: 'optionsScreen.subtitles.selection',
    getSections: (t) =>
      FITTINGS_CATALOG.map((group: FittingGroup) => ({
        key: group.groupKey,
        title: t(group.groupKey) || group.groupKey,
        items: group.items.map((item: FittingItem) => {
          const translatedLabel = t(item.labelKey) || item.labelKey;
          return {
            option: `${translatedLabel}|${item.K}`,
            label: translatedLabel,
            rightLabel: `K = ${item.K}`,
          };
        }),
      })),
    isSelected: (itemOption, selectedOption) =>
      itemOption === selectedOption ||
      itemOption.split('|')[0] === selectedOption,
  },
};

const calculatorOptionPresets: Record<
  CalculatorOptionContext,
  Record<string, ContextPreset>
> = {
  bernoulli: {
    density: { configKey: 'density', titleKey: 'bernoulliCalc.labels.density' },
    pressure: { configKey: 'pressure', titleKey: 'optionsScreen.titles.pressure' },
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    velocity: { configKey: 'velocity', titleKey: 'continuidadCalc.labels.velocity' },
    flowRate: { configKey: 'flowRate', titleKey: 'bernoulliCalc.labels.flowRate' },
  },
  reynolds: {
    velocity: { configKey: 'velocity', titleKey: 'reynoldsCalc.labels.velocity' },
    length: { configKey: 'length', titleKey: 'reynoldsCalc.labels.dimension' },
    density: { configKey: 'density', titleKey: 'reynoldsCalc.labels.density' },
    dynamicViscosity: {
      configKey: 'dynamicViscosity',
      titleKey: 'reynoldsCalc.labels.dynamicViscosity',
    },
    kinematicViscosity: {
      configKey: 'kinematicViscosity',
      titleKey: 'reynoldsCalc.labels.kinematicViscosity',
    },
    presetFluids: {
      configKey: 'reynoldsPresetFluids',
      titleKey: 'reynoldsCalc.labels.presetFluids',
    },
  },
  colebrook: {
    density: { configKey: 'density', titleKey: 'colebrookCalc.labels.density' },
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    velocity: { configKey: 'velocity', titleKey: 'colebrookCalc.labels.velocity' },
    dynamicViscosity: {
      configKey: 'dynamicViscosity',
      titleKey: 'colebrookCalc.labels.dynamicViscosity',
    },
    pipeMaterial: {
      configKey: 'pipeMaterial',
      titleKey: 'colebrookCalc.labels.material',
    },
  },
  froude: {
    area: { configKey: 'area', titleKey: 'froudeCalc.labels.area' },
    length: { configKey: 'length', titleKey: 'froudeCalc.labels.width' },
    velocity: { configKey: 'velocity', titleKey: 'froudeCalc.labels.velocity' },
    acceleration: {
      configKey: 'acceleration',
      titleKey: 'froudeCalc.labels.gravity',
    },
  },
  continuidad: {
    length: { configKey: 'length', resolveTitleKey: getContinuidadTitleKey },
    velocity: { configKey: 'velocity', resolveTitleKey: getContinuidadTitleKey },
    area: { configKey: 'area', resolveTitleKey: getContinuidadTitleKey },
    sectionType: {
      configKey: 'continuidadSectionType',
      titleKey: 'continuidadCalc.labels.sectionType',
    },
    fillType: {
      configKey: 'continuidadFillType',
      titleKey: 'continuidadCalc.labels.fillType',
    },
  },
  energiaBernoulli: {
    length: {
      configKey: 'length',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    velocity: {
      configKey: 'velocity',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    area: { configKey: 'area', titleKey: 'optionsScreen.titles.area' },
    pressure: {
      configKey: 'pressure',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    density: {
      configKey: 'density',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    acceleration: {
      configKey: 'acceleration',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    temperature: {
      configKey: 'temperature',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
    specificWeight: {
      configKey: 'specificWeight',
      resolveTitleKey: getEnergiaBernoulliTitleKey,
    },
  },
  geometria: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    area: { configKey: 'area', titleKey: 'optionsScreen.titles.area' },
    sectionType: {
      configKey: 'geometriaSectionType',
      titleKey: 'geometriaSeccionesCalc.labels.sectionType',
    },
  },
  factorFriccion: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    equation: {
      configKey: 'frictionEquation',
      titleKey: 'factorFriccionCalc.labels.equation',
    },
  },
  perdidasLocalizadas: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    velocity: { configKey: 'velocity', titleKey: 'optionsScreen.titles.velocity' },
    acceleration: {
      configKey: 'acceleration',
      titleKey: 'optionsScreen.titles.acceleration',
    },
    fittingType: {
      configKey: 'perdidasFittingType',
      titleKey: 'perdidasLocalizadasFittings.screenTitle',
    },
  },
  diseno: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    viscosity: { configKey: 'viscosity', titleKey: 'optionsScreen.titles.viscosity' },
    acceleration: {
      configKey: 'acceleration',
      titleKey: 'optionsScreen.titles.gravity',
    },
    flow: { configKey: 'flow', titleKey: 'optionsScreen.titles.flow' },
  },
  diseno2: {
    length: { configKey: 'length', titleKey: 'diseñoCalc2.labels.L' },
    viscosity: { configKey: 'viscosity', titleKey: 'diseñoCalc2.labels.mu' },
    flow: { configKey: 'flow', titleKey: 'diseñoCalc2.labels.Qd' },
    acceleration: { configKey: 'acceleration', titleKey: 'diseñoCalc2.labels.g' },
  },
  potencia: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    flow: { configKey: 'flow', titleKey: 'optionsScreen.titles.flow' },
    viscosity: { configKey: 'viscosity', titleKey: 'optionsScreen.titles.viscosity' },
    specificWeight: {
      configKey: 'specificWeight',
      titleKey: 'optionsScreen.titles.specificWeight',
    },
    pressure: { configKey: 'pressure', titleKey: 'optionsScreen.titles.pressure' },
  },
  compDisenoSerie: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    viscosity: { configKey: 'viscosity', titleKey: 'optionsScreen.titles.viscosity' },
    flow: { configKey: 'flow', titleKey: 'optionsScreen.titles.flow' },
  },
  compParalelo: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    viscosity: { configKey: 'viscosity', titleKey: 'optionsScreen.titles.viscosity' },
  },
  seriePotencia: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    density: { configKey: 'density', titleKey: 'optionsScreen.titles.density' },
    dynamicViscosity: {
      configKey: 'dynamicViscosity',
      titleKey: 'optionsScreen.titles.dynamicViscosity',
    },
    flow: { configKey: 'flow', titleKey: 'optionsScreen.titles.flow' },
  },
  paraleloPotencia: {
    length: { configKey: 'length', titleKey: 'optionsScreen.titles.length' },
    pressure: { configKey: 'pressure', titleKey: 'optionsScreen.titles.pressure' },
    density: { configKey: 'density', titleKey: 'reynoldsCalc.labels.density' },
    kinematicViscosity: {
      configKey: 'kinematicViscosity',
      titleKey: 'optionsScreen.titles.viscosity',
    },
    flow: { configKey: 'flow', titleKey: 'optionsScreen.titles.flow' },
  },
};

export const buildCalculatorOptionsParams = (
  context: CalculatorOptionContext,
  {
    category,
    onSelectOption,
    selectedOption,
    fieldLabel,
  }: BuildOptionsParamsInput,
): CalculatorOptionsScreenParams => {
  const preset = calculatorOptionPresets[context]?.[category];

  if (!preset) {
    return {
      configKey: category as OptionsConfigKey,
      onSelectOption,
      selectedOption,
    };
  }

  return {
    configKey: preset.configKey,
    titleKey:
      preset.resolveTitleKey?.(fieldLabel) ??
      preset.titleKey ??
      SHARED_OPTIONS_REGISTRY[preset.configKey].titleKey,
    onSelectOption,
    selectedOption,
  };
};
