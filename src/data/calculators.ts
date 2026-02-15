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
    math: 'Re = \\frac{\\rho v D}{\\mu}',
  },
  {
    desc: '',
    id: 'froude',
    route: 'FroudeCalc',
    icon: 'wind',
    titleKey: 'froude.title',
    descKey: 'froude.desc',
    math: 'Fr = \\frac{V}{\\sqrt{gL}}',
  },
  {
    desc: '',
    id: 'continuity',
    route: 'ContinuidadCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle1',
    descKey: 'calc.cardDesc1',
    math: '\\frac{\\partial \\rho}{\\partial t} + \\nabla \\cdot (\\rho \\mathbf{v}) = 0',
  },
  {
    desc: '',
    id: 'energybernoulli',
    route: 'EnergiaBernoulliCalc',
    icon: 'wind',
    titleKey: 'EnergiaBernoulliCalc.cardTitle1',
    descKey: 'EnergiaBernoulliCalc.cardDesc1',
    math: '\\frac{P_1}{\\gamma} + \\frac{V_1^2}{2g} + z_1 + h_b - h_t - h_L = \\frac{P_2}{\\gamma} + \\frac{V_2^2}{2g} + z_2',
  },
];
