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
];
