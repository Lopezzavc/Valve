import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext } from 'react';

interface PrecisionDecimalContextType {
  selectedPrecision: string;
  setSelectedPrecision: (precision: string) => void;
  decimalCountFixed: number;
  setDecimalCountFixed: (count: number) => void;
  decimalCountScientific: number;
  setDecimalCountScientific: (count: number) => void;
  decimalCountEngineering: number;
  setDecimalCountEngineering: (count: number) => void;
  formatNumber: (num: number) => string;
}

export const PrecisionDecimalContext = createContext<PrecisionDecimalContextType>({
  selectedPrecision: 'Normal',
  setSelectedPrecision: () => {},
  decimalCountFixed: 12,
  setDecimalCountFixed: () => {},
  decimalCountScientific: 5,
  setDecimalCountScientific: () => {},
  decimalCountEngineering: 5,
  setDecimalCountEngineering: () => {},
  formatNumber: (num: number) => num.toString(),
});

export const usePrecisionDecimal = () => useContext(PrecisionDecimalContext);

export const PrecisionDecimalProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPrecision, setSelectedPrecisionState] = useState('Normal');
  const [decimalCountFixed, setDecimalCountFixedState] = useState(5);
  const [decimalCountScientific, setDecimalCountScientificState] = useState(12);
  const [decimalCountEngineering, setDecimalCountEngineeringState] = useState(12);

  useEffect(() => {
    const loadPrecisionSettings = async () => {
      try {
        const savedPrecision = await AsyncStorage.getItem('selectedPrecision');
        if (savedPrecision) {
          setSelectedPrecisionState(savedPrecision);
        }
        const savedDecimalCountFixed = await AsyncStorage.getItem('decimalCountFixed');
        if (savedDecimalCountFixed) {
          setDecimalCountFixedState(parseInt(savedDecimalCountFixed, 10));
        }
        const savedDecimalCountScientific = await AsyncStorage.getItem('decimalCountScientific');
        if (savedDecimalCountScientific) {
          setDecimalCountScientificState(parseInt(savedDecimalCountScientific, 10));
        }
        const savedDecimalCountEngineering = await AsyncStorage.getItem('decimalCountEngineering');
        if (savedDecimalCountEngineering) {
          setDecimalCountEngineeringState(parseInt(savedDecimalCountEngineering, 10));
        }
      } catch (error) {
        console.error('Error loading precision settings:', error);
      }
    };
    loadPrecisionSettings();
  }, []);

  useEffect(() => {
    const savePrecisionSettings = async () => {
      try {
        await AsyncStorage.setItem('selectedPrecision', selectedPrecision);
        await AsyncStorage.setItem('decimalCountFixed', decimalCountFixed.toString());
        await AsyncStorage.setItem('decimalCountScientific', decimalCountScientific.toString());
        await AsyncStorage.setItem('decimalCountEngineering', decimalCountEngineering.toString());
      } catch (error) {
        console.error('Error saving precision settings:', error);
      }
    };
    savePrecisionSettings();
  }, [selectedPrecision, decimalCountFixed, decimalCountScientific, decimalCountEngineering]);

  const setSelectedPrecision = (precision: string) => {
    setSelectedPrecisionState(precision);
  };

  const setDecimalCountFixed = (count: number) => {
    setDecimalCountFixedState(count);
  };

  const setDecimalCountScientific = (count: number) => {
    setDecimalCountScientificState(count);
  };

  const setDecimalCountEngineering = (count: number) => {
    setDecimalCountEngineeringState(count);
  };

  const formatNumber = (num: number): string => {
    const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    const toSuperscript = (n: number): string => {
      const isNegative = n < 0;
      const numStr = Math.abs(n).toString();
      return (isNegative ? '⁻' : '') + numStr.split('').map(digit => superscriptDigits[parseInt(digit)]).join('');
    };

    switch (selectedPrecision) {
      case 'Normal': {
        if (!Number.isFinite(num)) return num.toString();
        return num.toFixed(10).replace(/\.?0+$/, '');
      }
      case 'Fix':
        return num.toFixed(decimalCountFixed);
      case 'Científica': {
        if (num === 0) return '0';
        const exponent = Math.floor(Math.log10(Math.abs(num)));
        const mantissa = num / Math.pow(10, exponent);
        return `${mantissa.toFixed(decimalCountScientific)} × 10${toSuperscript(exponent)}`;
      }
      case 'Ingeniería': {
        if (num === 0) return '0';
        let exponent = Math.floor(Math.log10(Math.abs(num)));
        let remainder = exponent % 3;
        if (remainder < 0) remainder += 3;
        exponent -= remainder;
        const mantissa = num / Math.pow(10, exponent);
        return `${mantissa.toFixed(decimalCountEngineering)} × 10${toSuperscript(exponent)}`;
      }
      default:
        return num.toString();
    }
  };

  return (
    <PrecisionDecimalContext.Provider
      value={{
        selectedPrecision,
        setSelectedPrecision,
        decimalCountFixed,
        setDecimalCountFixed,
        decimalCountScientific,
        setDecimalCountScientific,
        decimalCountEngineering,
        setDecimalCountEngineering,
        formatNumber,
      }}
    >
      {children}
    </PrecisionDecimalContext.Provider>
  );
};
