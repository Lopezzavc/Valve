import type { RootStackParamList } from '../../App';

export type CalcDef = {
  desc: string;
  id: string;
  route: keyof RootStackParamList | string;
  icon?: string;
  titleKey: string;
  descKey: string;
  math?: string;
};

export const calculatorsDef: CalcDef[] = [
  {
    desc: '',
    id: 'reynolds',
    route: 'ReynoldsCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle3',
    descKey: 'calc.cardDesc3',
  },
  {
    desc: '',
    id: 'froude',
    route: 'FroudeCalc',
    icon: 'wind',
    titleKey: 'froude.title',
    descKey: 'froude.desc',
  },
  {
    desc: '',
    id: 'continuity',
    route: 'ContinuidadCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle1',
    descKey: 'calc.cardDesc1',
  },
  {
    desc: '',
    id: 'energybernoulli',
    route: 'EnergiaBernoulliCalc',
    icon: 'wind',
    titleKey: 'EnergiaBernoulliCalc.cardTitle1',
    descKey: 'EnergiaBernoulliCalc.cardDesc1',
  },
  {
    desc: '',
    id: 'GeometriaSecciones',
    route: 'GeometriaSeccionesCalc',
    icon: 'wind',
    titleKey: 'geometriaSeccionesCalc.cardTitle1',
    descKey: 'geometriaSeccionesCalc.cardDesc1',
  },

  // SEGUNDA SECCIÓN

  {
    desc: '',
    id: 'factor-friccion',
    route: 'FactorFriccionCalc',
    icon: 'wind',
    titleKey: 'factorFriccion.title',
    descKey: 'factorFriccion.desc',
    math: 'f = \\frac{64}{Re} ; \\frac{1}{\\sqrt{f}} = -2 \\log \\left( \\frac{\\varepsilon/D}{3.7} + \\frac{2.51}{Re \\sqrt{f}} \\right)',
  },
  {
    desc: '',
    id: 'perdidas-localizadas',
    route: 'PerdidasLocalizadasCalc',
    icon: 'wind',
    titleKey: 'perdidasLocalizadas.title',
    descKey: 'perdidasLocalizadas.desc',
    math: 'h_L = K \\frac{V^2}{2g}',
  },
  {
    desc: '',
    id: 'tuberia-simple',
    route: 'DiseñoCalc',
    icon: 'wind',
    titleKey: 'tuberiaSimple.title',
    descKey: 'tuberiaSimple.desc',
    math: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}',
  },
  {
    desc: '',
    id: 'hazen-williams',
    route: 'HazenWilliamsCalc',
    icon: 'wind',
    titleKey: 'hazenWilliams.title',
    descKey: 'hazenWilliams.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
  },
];
