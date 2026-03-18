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
  progress?: number;
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
    color: '#15BFAE',
    progress: 4,
  },
  {
    desc: '',
    id: 'froude',
    route: 'FroudeCalc',
    icon: 'wind',
    titleKey: 'froude.title',
    descKey: 'froude.desc',
    color: '#15BFAE',
    progress: 4,
  },
  {
    desc: '',
    id: 'continuity',
    route: 'ContinuidadCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle1',
    descKey: 'calc.cardDesc1',
    color: '#15BFAE',
    progress: 4,
  },
  {
    desc: '',
    id: 'energybernoulli',
    route: 'EnergiaBernoulliCalc',
    icon: 'wind',
    titleKey: 'EnergiaBernoulliCalc.cardTitle1',
    descKey: 'EnergiaBernoulliCalc.cardDesc1',
    color: '#15BFAE',
    progress: 4,
  },
  {
    desc: '',
    id: 'GeometriaSecciones',
    route: 'GeometriaSeccionesCalc',
    icon: 'wind',
    titleKey: 'geometriaSeccionesCalc.cardTitle1',
    descKey: 'geometriaSeccionesCalc.cardDesc1',
    color: '#15BFAE',
    progress: 4,
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
    color: '#188C81',
    progress: 2,
  },
  {
    desc: '',
    id: 'perdidas-localizadas',
    route: 'PerdidasLocalizadasCalc',
    icon: 'wind',
    titleKey: 'perdidasLocalizadas.title',
    descKey: 'perdidasLocalizadas.desc',
    math: 'h_L = K \\frac{V^2}{2g}',
    color: '#188C81',
    progress: 2,
  },

  // DISEÑO

  {
    desc: '',
    id: 'diseño_simple',
    route: 'DiseñoCalc2',
    icon: 'wind',
    titleKey: 'tuberiaSimple2.title',
    descKey: 'tuberiaSimple2.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
    color: '#94F2E9',
    progress: 2,
  },
  // {
  //   desc: '',
  //   id: 'diseño_serie',
  //   route: '',
  //   icon: 'wind',
  //   titleKey: '',
  //   descKey: '',
  //   math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
  //   color: 'rgb(255, 150, 229)',
  //   progress: 0,
  // },
  // {
  //   desc: '',
  //   id: 'diseño_paralelo',
  //   route: '',
  //   icon: 'wind',
  //   titleKey: '',
  //   descKey: '',
  //   math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
  //   color: 'rgb(255, 150, 229)',
  //   progress: 0,
  // },

  // COMPROBACION DE DISEÑO
  
  {
    desc: '',
    id: 'compdiseño_simple',
    route: 'DiseñoCalc',
    icon: 'wind',
    titleKey: 'tuberiaSimple.title',
    descKey: 'tuberiaSimple.desc',
    math: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}',
    color: '#A8BAC3',
    progress: 2,
  },
  {
    desc: '',
    id: 'compdiseño_serie',
    route: 'CompDiseñoSerie',
    icon: 'wind',
    titleKey: 'compDiseñoSerie.titlecard',
    descKey: 'compDiseñoSerie.desccard',
    math: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}',
    color: '#A8BAC3',
    progress: 2,
  },
  {
    desc: '',
    id: 'compdiseño_paralelo',
    route: 'CompParaleloCalc',
    icon: 'wind',
    titleKey: 'compDiseñoParalelo.titlecard',
    descKey: 'compDiseñoParalelo.desccard',
    math: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}',
    color: '#A8BAC3',
    progress: 2,
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
    color: 'rgb(255, 55, 155)',
    progress: 2,
  },
  {
    desc: '',
    id: 'serie-potencia',
    route: 'seriePotenciaCalc',
    icon: 'wind',
    titleKey: 'seriePotencia.title',
    descKey: 'seriePotencia.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
    color: 'rgb(255, 55, 155)',
    progress: 2,
  },
  {
    desc: '',
    id: 'paralelo-potencia',
    route: 'paraleloPotenciaCalc',
    icon: 'wind',
    titleKey: 'paraleloPotencia.title',
    descKey: 'paraleloPotencia.desc',
    math: 'h_f = 10.67 \\frac{L Q^{1.85}}{C^{1.85} D^{4.87}}',
    color: 'rgb(255, 55, 155)',
    progress: 2,
  },

  
];
