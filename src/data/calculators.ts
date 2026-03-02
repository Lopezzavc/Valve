import type { RootStackParamList } from '../../App';

export type CalcDef = {
  desc: string;
  id: string;
  route: keyof RootStackParamList | string;
  icon?: string;
  titleKey: string;
  descKey: string;
  math?: string;
  color?: string;
};

export const calculatorsDef: CalcDef[] = [
  //SECCION ESSENTIAL
  {
    desc: '',
    id: 'reynolds',
    route: 'ReynoldsCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle3',
    descKey: 'calc.cardDesc3',
    color: 'rgb(194, 254, 12)',
  },
  {
    desc: '',
    id: 'froude',
    route: 'FroudeCalc',
    icon: 'wind',
    titleKey: 'froude.title',
    descKey: 'froude.desc',
    color: 'rgb(194, 254, 12)',
  },
  {
    desc: '',
    id: 'continuity',
    route: 'ContinuidadCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle1',
    descKey: 'calc.cardDesc1',
    color: 'rgb(194, 254, 12)',
  },
  {
    desc: '',
    id: 'energybernoulli',
    route: 'EnergiaBernoulliCalc',
    icon: 'wind',
    titleKey: 'EnergiaBernoulliCalc.cardTitle1',
    descKey: 'EnergiaBernoulliCalc.cardDesc1',
    color: 'rgb(194, 254, 12)',
  },
  {
    desc: '',
    id: 'GeometriaSecciones',
    route: 'GeometriaSeccionesCalc',
    icon: 'wind',
    titleKey: 'geometriaSeccionesCalc.cardTitle1',
    descKey: 'geometriaSeccionesCalc.cardDesc1',
    color: 'rgb(194, 254, 12)',
  },

  //SECCION FLUJO EN TUBERIA

  {
    desc: '',
    id: 'factor-friccion',
    route: 'FactorFriccionCalc',
    icon: 'wind',
    titleKey: 'factorFriccion.title',
    descKey: 'factorFriccion.desc',
    math: 'f = \\frac{64}{Re} ; \\frac{1}{\\sqrt{f}} = -2 \\log \\left( \\frac{\\varepsilon/D}{3.7} + \\frac{2.51}{Re \\sqrt{f}} \\right)',
    color: 'rgb(172, 150, 255)',
  },
  {
    desc: '',
    id: 'perdidas-localizadas',
    route: 'PerdidasLocalizadasCalc',
    icon: 'wind',
    titleKey: 'perdidasLocalizadas.title',
    descKey: 'perdidasLocalizadas.desc',
    math: 'h_L = K \\frac{V^2}{2g}',
    color: 'rgb(172, 150, 255)',
  },
  {
    desc: '',
    id: 'comprobacion-diseño',
    route: 'DiseñoCalc',
    icon: 'wind',
    titleKey: 'tuberiaSimple.title',
    descKey: 'tuberiaSimple.desc',
    math: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}',
    color: 'rgb(172, 150, 255)',
  },
  {
    desc: '',
    id: 'diseño',
    route: 'DiseñoCalc2',
    icon: 'wind',
    titleKey: 'tuberiaSimple2.title',
    descKey: 'tuberiaSimple2.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
    color: 'rgb(172, 150, 255)',
  },

  //SECCION BOMBAS

  {
    desc: '',
    id: 'bomb-Potencia',
    route: 'potenciaCalc',
    icon: 'wind',
    titleKey: 'potenciaCalcHm.title',
    descKey: 'potenciaCalcHm.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
    color: 'rgb(82, 82, 82)',
  },
];
