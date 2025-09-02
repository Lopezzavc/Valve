declare module 'react-native-math-view' {
  import * as React from 'react';
  export interface MathViewProps {
    math?: string;
    style?: any;
    // Add more props as needed
  }
  export default class MathView extends React.Component<MathViewProps> {}
  export const MathText: React.FC<{ value: string; style?: any }>;
}