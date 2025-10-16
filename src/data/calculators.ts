import type { RootStackParamList } from '../../App';

export type CalcDef = {
  id: string;
  route: keyof RootStackParamList | string;
  icon?: string;
  titleKey: string;
  descKey: string;
  math?: string;
};

export const calculatorsDef: CalcDef[] = [
  {
    id: 'reynolds',
    route: 'ReynoldsCalc',
    icon: 'wind',
    titleKey: 'calc.cardTitle3',
    descKey: 'calc.cardDesc3',
    math: 'Re = \\frac{\\rho v D}{\\mu}',
  },
  {
    id: 'froude',
    route: 'FroudeCalc',
    icon: 'wind',
    titleKey: 'froude.title',
    descKey: 'froude.desc',
    math: 'Fr = \\frac{V}{\\sqrt{gL}}',
  },
];
