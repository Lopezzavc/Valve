import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type InitialScreenType = 'HomeScreen' | 'FavScreen';

interface InitialScreenContextProps {
  initialScreen: InitialScreenType;
  setInitialScreen: (screen: InitialScreenType) => Promise<void>;
  t?: (key: string) => string;
}

export const InitialScreenContext = createContext<InitialScreenContextProps>({
  initialScreen: 'HomeScreen',
  setInitialScreen: async () => {},
});

export const InitialScreenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialScreen, setInitialScreenState] = useState<InitialScreenType>('HomeScreen');

  useEffect(() => {
    loadInitialScreen();
  }, []);

  const loadInitialScreen = async () => {
    try {
      const savedScreen = await AsyncStorage.getItem('initialScreen');
      if (savedScreen === 'HomeScreen' || savedScreen === 'FavScreen') {
        setInitialScreenState(savedScreen);
      }
    } catch (error) {
      console.error('Error loading initial screen:', error);
    }
  };

  const setInitialScreen = async (screen: InitialScreenType) => {
    try {
      await AsyncStorage.setItem('initialScreen', screen);
      setInitialScreenState(screen);
    } catch (error) {
      console.error('Error saving initial screen:', error);
    }
  };

  return (
    <InitialScreenContext.Provider value={{ initialScreen, setInitialScreen }}>
      {children}
    </InitialScreenContext.Provider>
  );
};