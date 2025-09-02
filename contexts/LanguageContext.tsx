import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext } from 'react';

import esTranslations from './translations/es.json';
import enTranslations from './translations/en.json';
import frTranslations from './translations/fr.json';
import deTranslations from './translations/de.json';
import zhTranslations from './translations/zh.json';
import jaTranslations from './translations/ja.json';

const translationsMap: Record<string, any> = {
  'Español': esTranslations,
  'Inglés': enTranslations,
  'Francés': frTranslations,
  'Alemán': deTranslations,
  'Chino': zhTranslations,
  'Japonés': jaTranslations
};

interface LanguageContextType {
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  selectedLanguage: 'Español',
  setSelectedLanguage: () => {},
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('Español');
  const [translations, setTranslations] = useState(esTranslations);

  const t = (key: string): string => {
    try {
      const keys = key.split('.');
      let value: any = translations;
      
      for (const k of keys) {
        value = value[k];
        if (value === undefined) break;
      }
      
      return value || key;
    } catch (error) {
      return key;
    }
  };

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
        if (savedLanguage && translationsMap[savedLanguage]) {
          setSelectedLanguage(savedLanguage);
          setTranslations(translationsMap[savedLanguage]);
        }
      } catch (error) {
        console.error('Error al cargar el idioma:', error);
      }
    };
    loadLanguage();
  }, []);

  const updateLanguage = async (language: string) => {
    if (translationsMap[language]) {
      setSelectedLanguage(language);
      setTranslations(translationsMap[language]);
      try {
        await AsyncStorage.setItem('selectedLanguage', language);
      } catch (error) {
        console.error('Error al guardar el idioma:', error);
      }
    }
  };

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setSelectedLanguage: updateLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};