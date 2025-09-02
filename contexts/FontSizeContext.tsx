import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext } from 'react';

interface FontSizeContextType {
  selectedFontSize: string;
  setSelectedFontSize: (size: string) => void;
  fontSizeFactor: number;
}

export const FontSizeContext = createContext<FontSizeContextType>({
  selectedFontSize: 'Normal',
  setSelectedFontSize: () => {},
  fontSizeFactor: 1,
});

export const useFontSize = () => useContext(FontSizeContext);

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [selectedFontSize, setSelectedFontSize] = useState('Normal');
  const [fontSizeFactor, setFontSizeFactor] = useState(1);

  useEffect(() => {
    const loadFontSize = async () => {
      try {
        const savedFontSize = await AsyncStorage.getItem('selectedFontSize');
        if (savedFontSize) {
          setSelectedFontSize(savedFontSize);
          updateFontSizeFactor(savedFontSize);
        }
      } catch (error) {
        console.error('Error loading font size:', error);
      }
    };
    loadFontSize();
  }, []);

  const updateFontSizeFactor = (size: string) => {
    switch (size) {
      case 'Muy Pequeña':
        setFontSizeFactor(0.624);  // 10 / 16 = 0.624
        break;
      case 'Pequeña':
        setFontSizeFactor(0.875);  // 14 / 16 = 0.875
        break;
      case 'Normal':
        setFontSizeFactor(1);      // 16 / 16 = 1
        break;
      case 'Grande':
        setFontSizeFactor(1.125);  // 18 / 16 = 1.125
        break;
      case 'Muy Grande':
        setFontSizeFactor(1.375);  // 22 / 16 = 1.375
        break;
      default:
        setFontSizeFactor(1);
    }
  };

  const updateFontSize = async (size: string) => {
    setSelectedFontSize(size);
    updateFontSizeFactor(size);
    try {
      await AsyncStorage.setItem('selectedFontSize', size);
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  return (
    <FontSizeContext.Provider value={{
      selectedFontSize,
      setSelectedFontSize: updateFontSize,
      fontSizeFactor
    }}>
      {children}
    </FontSizeContext.Provider>
  );
};