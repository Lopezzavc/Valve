import React, { createContext, useState, useContext, ReactNode } from 'react';

interface KeyboardContextType {
  activeInputId: string | null;
  setActiveInputId: (id: string | null) => void;
  inputValues: Record<string, string>;
  setInputValue: (id: string, value: string) => void;
}

const KeyboardContext = createContext<KeyboardContextType | undefined>(undefined);

export const KeyboardProvider = ({ children }: { children: ReactNode }) => {
  const [activeInputId, setActiveInputId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const setInputValue = (id: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [id]: value
    }));
  };

  return (
    <KeyboardContext.Provider value={{
      activeInputId,
      setActiveInputId,
      inputValues,
      setInputValue,
    }}>
      {children}
    </KeyboardContext.Provider>
  );
};

export const useKeyboard = () => {
  const context = useContext(KeyboardContext);
  if (context === undefined) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
};