import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { useContext } from 'react';

interface ThemeContextType {
  selectedTheme: string;
  setSelectedTheme: (theme: string) => void;
  currentTheme: 'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextType>({
  selectedTheme: 'Claro',
  setSelectedTheme: () => {},
  currentTheme: 'light',
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTheme, setSelectedTheme] = useState('Claro');
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('selectedTheme');
        if (savedTheme) {
          setSelectedTheme(savedTheme);
          updateCurrentTheme(savedTheme);
        }
      } catch (error) {
        console.error('Error al cargar el tema:', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (selectedTheme === 'Sistema') {
        setCurrentTheme(colorScheme || 'light');
      }
    });
    return () => subscription.remove();
  }, [selectedTheme]);

  const updateCurrentTheme = (theme: string) => {
    if (theme === 'Sistema') {
      setCurrentTheme(Appearance.getColorScheme() || 'light');
    } else if (theme === 'Oscuro') {
      setCurrentTheme('dark');
    } else {
      setCurrentTheme('light');
    }
  };

  const updateTheme = async (theme: string) => {
    setSelectedTheme(theme);
    updateCurrentTheme(theme);
    try {
      await AsyncStorage.setItem('selectedTheme', theme);
    } catch (error) {
      console.error('Error al guardar el tema:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      selectedTheme, 
      setSelectedTheme: updateTheme,
      currentTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};