import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext } from 'react';

interface DecimalSeparatorContextType {
  selectedDecimalSeparator: string;
  setSelectedDecimalSeparator: (separator: string) => void;
}

export const DecimalSeparatorContext = createContext<DecimalSeparatorContextType>({
  selectedDecimalSeparator: 'Punto',
  setSelectedDecimalSeparator: () => {},
});

interface DecimalSeparatorProviderProps {
  children: ReactNode;
}

export const useDecimalSeparator = () => useContext(DecimalSeparatorContext);

export const DecimalSeparatorProvider = ({ children }: DecimalSeparatorProviderProps) => {
  const [selectedDecimalSeparator, setSelectedDecimalSeparator] = useState<string>('Punto');

  useEffect(() => {
    const loadSeparator = async () => {
      try {
        const savedSeparator = await AsyncStorage.getItem('decimalSeparator');
        if (savedSeparator !== null) {
          setSelectedDecimalSeparator(savedSeparator);
        }
      } catch (error) {
        console.error('Failed to load decimal separator from AsyncStorage', error);
      }
    };

    loadSeparator();
  }, []);

  useEffect(() => {
    const saveSeparator = async () => {
      try {
        await AsyncStorage.setItem('decimalSeparator', selectedDecimalSeparator);
      } catch (error) {
        console.error('Failed to save decimal separator to AsyncStorage', error);
      }
    };

    saveSeparator();
  }, [selectedDecimalSeparator]);

  return (
    <DecimalSeparatorContext.Provider value={{ selectedDecimalSeparator, setSelectedDecimalSeparator }}>
      {children}
    </DecimalSeparatorContext.Provider>
  );
};