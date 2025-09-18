import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  Clipboard,
  LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import { Keyboard, LayoutAnimation } from 'react-native';

import { getDBConnection, createTable, saveCalculation } from '../../../src/services/database';
import { createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';

import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

// Tipos de navegación
type RootStackParamList = {
  OptionsScreenBernoulli: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenBernoulli: undefined;
  BernoulliTheory: undefined;
};

// Imagen de fondo para el contenedor de resultados
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// Estado de la calculadora
interface CalculatorState {
  // Propiedades del fluido
  density: string;
  densityUnit: string;
  prevDensityUnit: string;
  
  // Parámetros posición 1
  P1: string;
  h1: string;
  v1: string;
  P1Unit: string;
  h1Unit: string;
  v1Unit: string;
  prevP1Unit: string;
  prevH1Unit: string;
  prevV1Unit: string;
  
  // Parámetros posición 2
  P2: string;
  h2: string;
  v2: string;
  P2Unit: string;
  h2Unit: string;
  v2Unit: string;
  prevP2Unit: string;
  prevH2Unit: string;
  prevV2Unit: string;
  
  // Caudal
  pressureChange: string;
  diameter1: string;
  diameter2: string;
  flowRate: string;
  pressureChangeUnit: string;
  diameter1Unit: string;
  diameter2Unit: string;
  flowRateUnit: string;
  prevPressureChangeUnit: string;
  prevDiameter1Unit: string;
  prevDiameter2Unit: string;
  prevFlowRateUnit: string;
  
  // Resultados
  resultP1: string;
  resultH1: string;
  resultV1: string;
  resultP2: string;
  resultH2: string;
  resultV2: string;
  resultPressureChange: string;
  resultDiameter1: string;
  resultDiameter2: string;
  resultFlowRate: string;
  resultEnergy: number;
  
  // Estados de edición manual
  isManualEditP1: boolean;
  isManualEditH1: boolean;
  isManualEditV1: boolean;
  isManualEditP2: boolean;
  isManualEditH2: boolean;
  isManualEditV2: boolean;
  
  // Campo bloqueado
  lockedBernoulliField: string | null;
  lockedFlowField: string | null;
}

// Factores de conversión
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  density: {
    'kg/m³': 1,                          // exacto
    'g/cm³': 1000,                       // exacto
    'lb/ft³': 16.018463373960139580,     // exacto (lb = 0.45359237 kg; ft = 0.3048 m)
    'g/L': 1,                            // exacto
    'kg/L': 1000,                        // exacto
  },
  pressure: {
    'Pa': 1,                             // exacto
    'kPa': 1000,                         // exacto
    'MPa': 1000000,                      // exacto
    'bar': 100000,                       // exacto
    'psi': 6894.7572931683613367,        // exacto (lbf/in²; g₀ = 9.80665 m/s²)
    'atm': 101325,                       // exacto
    'mmHg': 133.322387415,               // convención (≈; columna de Hg a 0 °C)
    'Torr': 133.32236842105263158,       // exacto (= atm/760)
  },
  length: {
    'm': 1,                              // exacto
    'mm': 0.001,                         // exacto
    'cm': 0.01,                          // exacto
    'km': 1000,                          // exacto
    'in': 0.0254,                        // exacto
    'ft': 0.3048,                        // exacto
    'yd': 0.9144,                        // exacto
    'mi': 1609.344,                      // exacto
  },
  velocity: {
    'm/s': 1,                            // exacto
    'km/h': 0.27777777777777777778,      // exacto (= 1/3.6)
    'ft/s': 0.3048,                      // exacto
    'mph': 0.44704,                      // exacto
    'kn': 0.51444444444444444444,        // exacto (1 nmi/h; nmi = 1852 m)
    'cm/s': 0.01,                        // exacto
    'in/s': 0.0254,                      // exacto
  },
  flowRate: {
    'm³/s': 1,                           // exacto
    'L/s': 0.001,                        // exacto (1 L = 1 dm³)
    'L/min': 0.00001666666666666666667,  // exacto (= 1e-3/60)
    'gal/min': 0.0000630901964,          // exacto (US gal = 231 in³)
    'ft³/s': 0.028316846592,             // exacto
    'cm³/s': 0.000001,                   // exacto
  }
  };

// Configuración del Toast
const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'rgb(194, 254, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontFamily: 'SFUIDisplay-Bold' }}
      text2Style={{ fontSize: 14, fontFamily: 'SFUIDisplay-Medium' }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: 'rgb(254, 12, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontFamily: 'SFUIDisplay-Medium' }}
      text2Style={{ fontSize: 14, fontFamily: 'SFUIDisplay-Medium' }}
    />
  ),
};

const initialState = (): CalculatorState => ({
  // Propiedades del fluido
  density: '',
  densityUnit: 'kg/m³',
  prevDensityUnit: 'kg/m³',
  
  // Parámetros posición 1
  P1: '',
  h1: '',
  v1: '',
  P1Unit: 'Pa',
  h1Unit: 'm',
  v1Unit: 'm/s',
  prevP1Unit: 'Pa',
  prevH1Unit: 'm',
  prevV1Unit: 'm/s',
  
  // Parámetros posición 2
  P2: '',
  h2: '',
  v2: '',
  P2Unit: 'Pa',
  h2Unit: 'm',
  v2Unit: 'm/s',
  prevP2Unit: 'Pa',
  prevH2Unit: 'm',
  prevV2Unit: 'm/s',
  
  // Caudal
  pressureChange: '',
  diameter1: '',
  diameter2: '',
  flowRate: '',
  pressureChangeUnit: 'Pa',
  diameter1Unit: 'm',
  diameter2Unit: 'm',
  flowRateUnit: 'm³/s',
  prevPressureChangeUnit: 'Pa',
  prevDiameter1Unit: 'm',
  prevDiameter2Unit: 'm',
  prevFlowRateUnit: 'm³/s',
  
  // Resultados
  resultP1: '',
  resultH1: '',
  resultV1: '',
  resultP2: '',
  resultH2: '',
  resultV2: '',
  resultPressureChange: '',
  resultDiameter1: '',
  resultDiameter2: '',
  resultFlowRate: '',
  resultEnergy: 0,
  
  // Estados de edición manual
  isManualEditP1: false,
  isManualEditH1: false,
  isManualEditV1: false,
  isManualEditP2: false,
  isManualEditH2: false,
  isManualEditV2: false,
  
  // Campo bloqueado
  lockedBernoulliField: null,
  lockedFlowField: null,
});

// Componente principal
const BernoulliCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const [inputSectionPadding, setInputSectionPadding] = useState(100);

  // Tema actual
  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);

  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient: 'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    };
  }, [currentTheme]);

  // Estado
  const [state, setState] = useState<CalculatorState>(initialState);

  // DB cache
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      
        // Cargar estado inicial del corazón
        const fav = await isFavorite(db, 'BernoulliCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
    
      const route = 'BernoulliCalc';
      const label = t('bernoulliCalc.title') || 'Calculadora de Bernoulli';
    
      const currentlyFav = await isFavorite(db, route);
      if (currentlyFav) {
        await removeFavorite(db, route);
        setIsFav(false);
        Toast.show({ type: 'error', text1: t('favorites.deleted'), text2: t('favorites.deletedDesc') });
      } else {
        await addFavorite(db, { route, label });
        setIsFav(true);
        Toast.show({ type: 'success', text1: t('favorites.success'), text2: t('favorites.successDesc') });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('common.genericError') });
    }
  }, [t]);

  // Efectos para actualizar campos bloqueados
  useEffect(() => {
    updateLockedBernoulliField();
  }, [state.P1, state.h1, state.v1, state.P2, state.h2, state.v2]);

  useEffect(() => {
    updateLockedFlowField();
  }, [state.diameter1, state.diameter2, state.flowRate]);

  useEffect(() => {
    updatePressureChange();
  }, [state.P1, state.P2]);

  // Helpers
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num)) return '';
    const fixed = num.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'density' | 'pressure' | 'length' | 'velocity' | 'flowRate'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
    const numValue = parseFloat(cleanValue);
    const fromFactor = conversionFactors[category][fromUnit];
    const toFactor = conversionFactors[category][toUnit];
    if (!fromFactor || !toFactor) return value;
    const convertedValue = (numValue * fromFactor) / toFactor;
    return formatResult(convertedValue);
  }, [formatResult]);

  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  const updateLockedBernoulliField = useCallback(() => {
    const inputs = [
      { id: 'P1', value: state.P1 },
      { id: 'h1', value: state.h1 },
      { id: 'v1', value: state.v1 },
      { id: 'P2', value: state.P2 },
      { id: 'h2', value: state.h2 },
      { id: 'v2', value: state.v2 },
    ];
    const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
    if (validInputs.length === 5) {
      const emptyInput = inputs.find(({ value }) => value === '' || isNaN(parseFloat(value.replace(',', '.'))));
      setState((prev) => ({ ...prev, lockedBernoulliField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedBernoulliField: null }));
    }
  }, [state.P1, state.h1, state.v1, state.P2, state.h2, state.v2]);

  const updateLockedFlowField = useCallback(() => {
    const inputs = [
      { id: 'diameter1', value: state.diameter1 },
      { id: 'diameter2', value: state.diameter2 },
      { id: 'flowRate', value: state.flowRate },
    ];
    const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
    if (validInputs.length === 1) {
      const validIds = validInputs.map(({ id }) => id);
      const lockedIds = inputs.filter(({ id }) => !validIds.includes(id)).map(({ id }) => id);
      setState((prev) => ({ ...prev, lockedFlowField: lockedIds.join(',') }));
    } else {
      setState((prev) => ({ ...prev, lockedFlowField: null }));
    }
  }, [state.diameter1, state.diameter2, state.flowRate]);

  const updatePressureChange = useCallback(() => {
    const p1Val = state.P1 ? parseFloat(state.P1.replace(',', '.')) * conversionFactors.pressure[state.P1Unit] : NaN;
    const p2Val = state.P2 ? parseFloat(state.P2.replace(',', '.')) * conversionFactors.pressure[state.P2Unit] : NaN;
    
    if (!isNaN(p1Val) && !isNaN(p2Val)) {
      const changeInPa = p1Val - p2Val;
      const changeInTargetUnit = changeInPa / conversionFactors.pressure[state.pressureChangeUnit];
      setState((prev) => ({ ...prev, resultPressureChange: formatResult(changeInTargetUnit) }));
    } else {
      setState((prev) => ({ ...prev, resultPressureChange: '' }));
    }
  }, [state.P1, state.P2, state.P1Unit, state.P2Unit, state.pressureChangeUnit, formatResult]);

  const calculateBernoulli = useCallback(() => {
    const g = 9.81; // Aceleración de la gravedad
    
    // Convertir valores a unidades SI
    const density = state.density ? parseFloat(state.density.replace(',', '.')) * conversionFactors.density[state.densityUnit] : NaN;
    const p1 = state.P1 ? parseFloat(state.P1.replace(',', '.')) * conversionFactors.pressure[state.P1Unit] : NaN;
    const h1 = state.h1 ? parseFloat(state.h1.replace(',', '.')) * conversionFactors.length[state.h1Unit] : NaN;
    const v1 = state.v1 ? parseFloat(state.v1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN;
    const p2 = state.P2 ? parseFloat(state.P2.replace(',', '.')) * conversionFactors.pressure[state.P2Unit] : NaN;
    const h2 = state.h2 ? parseFloat(state.h2.replace(',', '.')) * conversionFactors.length[state.h2Unit] : NaN;
    const v2 = state.v2 ? parseFloat(state.v2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN;

    if (isNaN(density)) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('bernoulliCalc.toasts.densityRequired') });
      return;
    }

    const values = [p1, h1, v1, p2, h2, v2];
    const validCount = values.filter(v => !isNaN(v)).length;

    if (validCount !== 5) {
      setState((prev) => ({
        ...prev,
        resultP1: '',
        resultH1: '',
        resultV1: '',
        resultP2: '',
        resultH2: '',
        resultV2: '',
        resultEnergy: 0,
      }));
      return;
    }

    let missing: string | null = null;
    if (isNaN(p1)) missing = 'P1';
    else if (isNaN(h1)) missing = 'h1';
    else if (isNaN(v1)) missing = 'v1';
    else if (isNaN(p2)) missing = 'P2';
    else if (isNaN(h2)) missing = 'h2';
    else if (isNaN(v2)) missing = 'v2';

    // Calcular energía total (usando valores conocidos)
    let totalEnergy = 0;
    if (!isNaN(p1) && !isNaN(h1) && !isNaN(v1)) {
      totalEnergy = (p1 / density) + (g * h1) + (0.5 * v1 * v1);
    } else if (!isNaN(p2) && !isNaN(h2) && !isNaN(v2)) {
      totalEnergy = (p2 / density) + (g * h2) + (0.5 * v2 * v2);
    }

    const newState: Partial<CalculatorState> = { resultEnergy: totalEnergy };

    // Calcular el valor faltante
    switch (missing) {
      case 'P1': {
        const calculated = density * (totalEnergy - (g * h1) - (0.5 * v1 * v1));
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.pressure[state.P1Unit];
          newState.resultP1 = formatResult(resultInTargetUnit);
        }
        break;
      }
      case 'h1': {
        const calculated = (totalEnergy - (p1 / density) - (0.5 * v1 * v1)) / g;
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.length[state.h1Unit];
          newState.resultH1 = formatResult(resultInTargetUnit);
        }
        break;
      }
      case 'v1': {
        const calculated = Math.sqrt(2 * (totalEnergy - (p1 / density) - (g * h1)));
        if (!isNaN(calculated) && isFinite(calculated) && calculated >= 0) {
          const resultInTargetUnit = calculated / conversionFactors.velocity[state.v1Unit];
          newState.resultV1 = formatResult(resultInTargetUnit);
        }
        break;
      }
      case 'P2': {
        const calculated = density * (totalEnergy - (g * h2) - (0.5 * v2 * v2));
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.pressure[state.P2Unit];
          newState.resultP2 = formatResult(resultInTargetUnit);
        }
        break;
      }
      case 'h2': {
        const calculated = (totalEnergy - (p2 / density) - (0.5 * v2 * v2)) / g;
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.length[state.h2Unit];
          newState.resultH2 = formatResult(resultInTargetUnit);
        }
        break;
      }
      case 'v2': {
        const calculated = Math.sqrt(2 * (totalEnergy - (p2 / density) - (g * h2)));
        if (!isNaN(calculated) && isFinite(calculated) && calculated >= 0) {
          const resultInTargetUnit = calculated / conversionFactors.velocity[state.v2Unit];
          newState.resultV2 = formatResult(resultInTargetUnit);
        }
        break;
      }
    }

    setState((prev) => ({ ...prev, ...newState }));

    // Calcular parámetros de caudal si es posible
    calculateFlowParameters();
  }, [state, formatResult, t]);

  const calculateFlowParameters = useCallback(() => {
    const d1 = state.diameter1 ? parseFloat(state.diameter1.replace(',', '.')) * conversionFactors.length[state.diameter1Unit] : NaN;
    const d2 = state.diameter2 ? parseFloat(state.diameter2.replace(',', '.')) * conversionFactors.length[state.diameter2Unit] : NaN;
    const Q = state.flowRate ? parseFloat(state.flowRate.replace(',', '.')) * conversionFactors.flowRate[state.flowRateUnit] : NaN;

    const validInputs = [!isNaN(d1), !isNaN(d2), !isNaN(Q)].filter(Boolean).length;

    if (validInputs !== 1) return;

    const newState: Partial<CalculatorState> = {};

    if (!isNaN(Q)) {
      // Calcular diámetros basado en caudal y velocidades conocidas
      const v1 = state.v1 ? parseFloat(state.v1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : state.resultV1 ? parseFloat(state.resultV1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN;
      const v2 = state.v2 ? parseFloat(state.v2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : state.resultV2 ? parseFloat(state.resultV2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN;

      if (!isNaN(v1) && v1 > 0) {
        const A1 = Q / v1;
        const d1_calc = Math.sqrt(4 * A1 / Math.PI);
        const resultInTargetUnit = d1_calc / conversionFactors.length[state.diameter1Unit];
        newState.resultDiameter1 = formatResult(resultInTargetUnit);
      }

      if (!isNaN(v2) && v2 > 0) {
        const A2 = Q / v2;
        const d2_calc = Math.sqrt(4 * A2 / Math.PI);
        const resultInTargetUnit = d2_calc / conversionFactors.length[state.diameter2Unit];
        newState.resultDiameter2 = formatResult(resultInTargetUnit);
      }
    } else if (!isNaN(d1)) {
      // Calcular caudal y d2 basado en d1
      const v1 = state.v1 ? parseFloat(state.v1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : state.resultV1 ? parseFloat(state.resultV1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN;
      const v2 = state.v2 ? parseFloat(state.v2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : state.resultV2 ? parseFloat(state.resultV2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN;

      if (!isNaN(v1)) {
        const A1 = Math.PI * (d1 / 2) * (d1 / 2);
        const Q_calc = A1 * v1;
        const resultInTargetUnit = Q_calc / conversionFactors.flowRate[state.flowRateUnit];
        newState.resultFlowRate = formatResult(resultInTargetUnit);

        if (!isNaN(v2) && v2 > 0) {
          const A2 = Q_calc / v2;
          const d2_calc = Math.sqrt(4 * A2 / Math.PI);
          const resultInTargetUnit2 = d2_calc / conversionFactors.length[state.diameter2Unit];
          newState.resultDiameter2 = formatResult(resultInTargetUnit2);
        }
      }
    } else if (!isNaN(d2)) {
      // Calcular caudal y d1 basado en d2
      const v1 = state.v1 ? parseFloat(state.v1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : state.resultV1 ? parseFloat(state.resultV1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN;
      const v2 = state.v2 ? parseFloat(state.v2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : state.resultV2 ? parseFloat(state.resultV2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN;

      if (!isNaN(v2)) {
        const A2 = Math.PI * (d2 / 2) * (d2 / 2);
        const Q_calc = A2 * v2;
        const resultInTargetUnit = Q_calc / conversionFactors.flowRate[state.flowRateUnit];
        newState.resultFlowRate = formatResult(resultInTargetUnit);

        if (!isNaN(v1) && v1 > 0) {
          const A1 = Q_calc / v1;
          const d1_calc = Math.sqrt(4 * A1 / Math.PI);
          const resultInTargetUnit2 = d1_calc / conversionFactors.length[state.diameter1Unit];
          newState.resultDiameter1 = formatResult(resultInTargetUnit2);
        }
      }
    }

    setState((prev) => ({ ...prev, ...newState }));
  }, [state, formatResult]);

  const handleCalculate = useCallback(() => {
    calculateBernoulli();
  }, [calculateBernoulli]);

  const handleClear = useCallback(() => {
    setState(initialState);
  }, []);

  const handleCopy = useCallback(() => {
    const hasResults = state.resultEnergy !== 0 || state.resultP1 || state.resultH1 || state.resultV1 || state.resultP2 || state.resultH2 || state.resultV2;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('bernoulliCalc.toasts.noResultsToCopy') });
      return;
    }

    let textToCopy = `${t('bernoulliCalc.title') || 'Calculadora de Bernoulli'}\n\n`;
    
    // Energía total
    if (state.resultEnergy !== 0) {
      textToCopy += `${t('bernoulliCalc.totalEnergy') || 'Energía Total'}: ${formatResult(state.resultEnergy)} J/kg\n\n`;
    }

    // Propiedades del fluido
    if (state.density) {
      textToCopy += `${t('bernoulliCalc.fluidProperties') || 'Propiedades del Fluido'}:\n`;
      textToCopy += `  ${t('bernoulliCalc.labels.density') || 'Densidad'}: ${state.density} ${state.densityUnit}\n\n`;
    }

    // Parámetros posición 1
    textToCopy += `${t('bernoulliCalc.position1') || 'Parámetros Posición 1'}:\n`;
    const p1Value = state.isManualEditP1 ? state.P1 : state.resultP1 || state.P1;
    const h1Value = state.isManualEditH1 ? state.h1 : state.resultH1 || state.h1;
    const v1Value = state.isManualEditV1 ? state.v1 : state.resultV1 || state.v1;
    
    if (p1Value) textToCopy += `  ${t('bernoulliCalc.labels.P1') || 'Presión P₁'}: ${p1Value} ${state.P1Unit}\n`;
    if (h1Value) textToCopy += `  ${t('bernoulliCalc.labels.h1') || 'Altura h₁'}: ${h1Value} ${state.h1Unit}\n`;
    if (v1Value) textToCopy += `  ${t('bernoulliCalc.labels.v1') || 'Velocidad v₁'}: ${v1Value} ${state.v1Unit}\n`;
    
    // Parámetros posición 2
    textToCopy += `\n${t('bernoulliCalc.position2') || 'Parámetros Posición 2'}:\n`;
    const p2Value = state.isManualEditP2 ? state.P2 : state.resultP2 || state.P2;
    const h2Value = state.isManualEditH2 ? state.h2 : state.resultH2 || state.h2;
    const v2Value = state.isManualEditV2 ? state.v2 : state.resultV2 || state.v2;
    
    if (p2Value) textToCopy += `  ${t('bernoulliCalc.labels.P2') || 'Presión P₂'}: ${p2Value} ${state.P2Unit}\n`;
    if (h2Value) textToCopy += `  ${t('bernoulliCalc.labels.h2') || 'Altura h₂'}: ${h2Value} ${state.h2Unit}\n`;
    if (v2Value) textToCopy += `  ${t('bernoulliCalc.labels.v2') || 'Velocidad v₂'}: ${v2Value} ${state.v2Unit}\n`;

    // Parámetros de caudal
    const hasFlowData = state.resultPressureChange || state.resultDiameter1 || state.resultDiameter2 || state.resultFlowRate || 
                       state.pressureChange || state.diameter1 || state.diameter2 || state.flowRate;
    
    if (hasFlowData) {
      textToCopy += `\n${t('bernoulliCalc.flowParameters') || 'Parámetros de Caudal'}:\n`;
      
      const pressureChangeValue = state.resultPressureChange || state.pressureChange;
      const diameter1Value = state.resultDiameter1 || state.diameter1;
      const diameter2Value = state.resultDiameter2 || state.diameter2;
      const flowRateValue = state.resultFlowRate || state.flowRate;
      
      if (pressureChangeValue) textToCopy += `  ${t('bernoulliCalc.labels.pressureChange') || 'Cambio de Presión'}: ${pressureChangeValue} ${state.pressureChangeUnit}\n`;
      if (diameter1Value) textToCopy += `  ${t('bernoulliCalc.labels.diameter1') || 'Diámetro Posición 1'}: ${diameter1Value} ${state.diameter1Unit}\n`;
      if (diameter2Value) textToCopy += `  ${t('bernoulliCalc.labels.diameter2') || 'Diámetro Posición 2'}: ${diameter2Value} ${state.diameter2Unit}\n`;
      if (flowRateValue) textToCopy += `  ${t('bernoulliCalc.labels.flowRate') || 'Caudal Volumétrico'}: ${flowRateValue} ${state.flowRateUnit}\n`;
    }

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('bernoulliCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

  const handleSaveHistory = useCallback(async () => {
    const hasResults = state.resultEnergy !== 0 || state.resultP1 || state.resultH1 || state.resultV1 || state.resultP2 || state.resultH2 || state.resultV2;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('bernoulliCalc.toasts.nothingToSave') || 'No hay resultados para guardar' });
      return;
    }

    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }

      // Preparar datos de entrada
      let finalP1 = state.isManualEditP1 ? state.P1 : state.resultP1 || state.P1;
      let finalH1 = state.isManualEditH1 ? state.h1 : state.resultH1 || state.h1;
      let finalV1 = state.isManualEditV1 ? state.v1 : state.resultV1 || state.v1;
      let finalP2 = state.isManualEditP2 ? state.P2 : state.resultP2 || state.P2;
      let finalH2 = state.isManualEditH2 ? state.h2 : state.resultH2 || state.h2;
      let finalV2 = state.isManualEditV2 ? state.v2 : state.resultV2 || state.v2;

      const inputs = {
        density: state.density || 'N/A',
        densityUnit: state.densityUnit,
        P1: finalP1 || 'N/A',
        P1Unit: state.P1Unit,
        h1: finalH1 || 'N/A',
        h1Unit: state.h1Unit,
        v1: finalV1 || 'N/A',
        v1Unit: state.v1Unit,
        P2: finalP2 || 'N/A',
        P2Unit: state.P2Unit,
        h2: finalH2 || 'N/A',
        h2Unit: state.h2Unit,
        v2: finalV2 || 'N/A',
        v2Unit: state.v2Unit,
        pressureChange: state.resultPressureChange || state.pressureChange || 'N/A',
        pressureChangeUnit: state.pressureChangeUnit,
        diameter1: state.resultDiameter1 || state.diameter1 || 'N/A',
        diameter1Unit: state.diameter1Unit,
        diameter2: state.resultDiameter2 || state.diameter2 || 'N/A',
        diameter2Unit: state.diameter2Unit,
        flowRate: state.resultFlowRate || state.flowRate || 'N/A',
        flowRateUnit: state.flowRateUnit,
      };

      const result = formatResult(state.resultEnergy);

      await saveCalculation(db, 'bernoulli', JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('bernoulliCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('bernoulliCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  // Navegar a selector de opciones/unidades
  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenBernoulli', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Render de input numérico con etiqueta
  const renderInput = useCallback((
    label: string,
    value: string,
    onChange: (text: string) => void,
    setManualEdit: (value: boolean) => void,
    fieldId?: string,
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean
  ) => {
    const unitMap: { [key: string]: string } = {
      'Densidad': state.densityUnit,
      'Presión P₁': state.P1Unit,
      'Altura h₁': state.h1Unit,
      'Velocidad v₁': state.v1Unit,
      'Presión P₂': state.P2Unit,
      'Altura h₂': state.h2Unit,
      'Velocidad v₂': state.v2Unit,
      'Cambio de Presión': state.pressureChangeUnit,
      'Diámetro Posición 1': state.diameter1Unit,
      'Diámetro Posición 2': state.diameter2Unit,
      'Caudal Volumétrico': state.flowRateUnit,
    };
    const unit = unitMap[label] || '';
    const shownLabel = displayLabel || label;
    const isFieldLocked = isLocked || 
      (fieldId && state.lockedBernoulliField === fieldId) ||
      (fieldId && state.lockedFlowField && state.lockedFlowField.includes(fieldId));

    return (
      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{shownLabel}</Text>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={resultValue && resultValue !== '' ? resultValue : value}
                onChangeText={(text) => {
                  onChange(text);
                  setManualEdit(true);
                  // Reset manual edit flags for other fields
                  if (label !== 'Presión P₁') setState((prev) => ({ ...prev, isManualEditP1: false }));
                  if (label !== 'Altura h₁') setState((prev) => ({ ...prev, isManualEditH1: false }));
                  if (label !== 'Velocidad v₁') setState((prev) => ({ ...prev, isManualEditV1: false }));
                  if (label !== 'Presión P₂') setState((prev) => ({ ...prev, isManualEditP2: false }));
                  if (label !== 'Altura h₂') setState((prev) => ({ ...prev, isManualEditH2: false }));
                  if (label !== 'Velocidad v₂') setState((prev) => ({ ...prev, isManualEditV2: false }));
                }}
                editable={!isFieldLocked}
                selectTextOnFocus={!isFieldLocked}
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
          <Pressable
            style={[
              styles.Container2,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
            onPress={() => {
              let category = '';
              switch (label) {
                case 'Densidad':
                  category = 'density';
                  break;
                case 'Presión P₁':
                case 'Presión P₂':
                case 'Cambio de Presión':
                  category = 'pressure';
                  break;
                case 'Altura h₁':
                case 'Altura h₂':
                case 'Diámetro Posición 1':
                case 'Diámetro Posición 2':
                  category = 'length';
                  break;
                case 'Velocidad v₁':
                case 'Velocidad v₂':
                  category = 'velocity';
                  break;
                case 'Caudal Volumétrico':
                  category = 'flowRate';
                  break;
              }

              navigateToOptions(category, (option: string) => {
                const updateUnit = (
                  field: keyof CalculatorState,
                  prevField: keyof CalculatorState,
                  resultField?: keyof CalculatorState
                ) => {
                  const inputValue = state[field] as string;
                  const prevUnit = state[prevField] as string;
                  const resultVal = resultField ? (state[resultField] as string) : '';
                  const convertedInputValue = convertValue(inputValue, prevUnit, option, category as any);
                  let convertedResultValue = resultVal;
                  if (resultVal && resultField) {
                    convertedResultValue = convertValue(resultVal, prevUnit, option, category as any);
                  }
                  setState((prev) => ({
                    ...prev,
                    [field]: convertedInputValue,
                    [prevField]: option,
                    [`${field}Unit`]: option,
                    ...(resultField && convertedResultValue ? { [resultField]: convertedResultValue } as any : {}),
                  }));
                };

                switch (label) {
                  case 'Densidad': updateUnit('density', 'prevDensityUnit'); break;
                  case 'Presión P₁': updateUnit('P1', 'prevP1Unit', 'resultP1'); break;
                  case 'Altura h₁': updateUnit('h1', 'prevH1Unit', 'resultH1'); break;
                  case 'Velocidad v₁': updateUnit('v1', 'prevV1Unit', 'resultV1'); break;
                  case 'Presión P₂': updateUnit('P2', 'prevP2Unit', 'resultP2'); break;
                  case 'Altura h₂': updateUnit('h2', 'prevH2Unit', 'resultH2'); break;
                  case 'Velocidad v₂': updateUnit('v2', 'prevV2Unit', 'resultV2'); break;
                  case 'Cambio de Presión': updateUnit('pressureChange', 'prevPressureChangeUnit', 'resultPressureChange'); break;
                  case 'Diámetro Posición 1': updateUnit('diameter1', 'prevDiameter1Unit', 'resultDiameter1'); break;
                  case 'Diámetro Posición 2': updateUnit('diameter2', 'prevDiameter2Unit', 'resultDiameter2'); break;
                  case 'Caudal Volumétrico': updateUnit('flowRate', 'prevFlowRateUnit', 'resultFlowRate'); break;
                }
              }, unit);
            }}
          >
            <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.text, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{unit}</Text>
              <Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
            </View>
          </Pressable>
        </View>
      </View>
    );
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputSectionPadding(150);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputSectionPadding(100);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={toggleFavorite}>
                <IconFavorite
                  name={isFav ? "heart" : "heart-o"}
                  size={20}
                  color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                />
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('BernoulliTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('bernoulliCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('bernoulliCalc.title') || 'Ecuación de Bernoulli'}</Text>
        </View>

        {/* Resultados */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={[styles.resultsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('bernoulliCalc.saveToHistory') || 'Guardar en historial'}</Text>
                <Icon name="plus" size={16 * fontSizeFactor} color="rgba(255, 255, 255, 0.4)" style={styles.plusIcon} />
              </View>
              <View style={styles.imageContainer}>
                <View style={styles.flowContainer}>
                  <FastImage
                    source={backgroundImage}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {/* superposición para modo oscuro */}
                  {currentTheme === 'dark' && (
                    <View
                      pointerEvents="none"
                      style={{
                        ...StyleSheet.absoluteFillObject as any,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                      }}
                    />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text
                      style={[
                        styles.flowLabel,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 14 * fontSizeFactor }
                      ]}
                    >
                      {t('bernoulliCalc.energy') || 'Energía'}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                      ]}
                    >
                      {adjustDecimalSeparator(formatNumber(state.resultEnergy))}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular', action: handleCalculate },
            { icon: 'copy', label: t('common.copy') || 'Copiar', action: handleCopy },
            { icon: 'trash', label: t('common.clear') || 'Limpiar', action: handleClear },
            { icon: 'clock', label: t('common.history') || 'Historial', action: () => navigation.navigate('HistoryScreenBernoulli') },
          ].map(({ icon, label, action }) => (
            <View style={styles.actionWrapper} key={label}>
              <View style={styles.actionButtonMain}>
                <Pressable style={[styles.actionButton, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={action}>
                  <Icon name={icon} size={22 * fontSizeFactor} color="rgb(255, 255, 255)" />
                  <Icon name={icon} size={22 * fontSizeFactor} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', filter: 'blur(4px)' }} />
                </Pressable>
              </View>
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontSizeFactor }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Inputs */}
        <View
          style={[
            styles.inputsSection,
            { backgroundColor: themeColors.card, paddingBottom: inputSectionPadding }
          ]}
        >
          <View style={styles.inputsContainer}>
            {/* Propiedades del fluido */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('bernoulliCalc.fluidProperties') || 'Propiedades del Fluido'}
            </Text>

            {renderInput(
              'Densidad',
              state.density,
              (text) => setState((prev) => ({ ...prev, density: text })),
              () => {},
              undefined,
              undefined,
              t('bernoulliCalc.labels.density') || 'Densidad'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Parámetros posición 1 */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('bernoulliCalc.position1') || 'Parámetros Posición 1'}
            </Text>

            {renderInput(
              'Presión P₁',
              state.P1,
              (text) => setState((prev) => ({ ...prev, P1: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditP1: value })),
              'P1',
              state.isManualEditP1 ? state.P1 : state.resultP1,
              t('bernoulliCalc.labels.P1') || 'Presión P₁'
            )}

            {renderInput(
              'Altura h₁',
              state.h1,
              (text) => setState((prev) => ({ ...prev, h1: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditH1: value })),
              'h1',
              state.isManualEditH1 ? state.h1 : state.resultH1,
              t('bernoulliCalc.labels.h1') || 'Altura h₁'
            )}

            {renderInput(
              'Velocidad v₁',
              state.v1,
              (text) => setState((prev) => ({ ...prev, v1: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditV1: value })),
              'v1',
              state.isManualEditV1 ? state.v1 : state.resultV1,
              t('bernoulliCalc.labels.v1') || 'Velocidad v₁'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Parámetros posición 2 */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('bernoulliCalc.position2') || 'Parámetros Posición 2'}
            </Text>

            {renderInput(
              'Presión P₂',
              state.P2,
              (text) => setState((prev) => ({ ...prev, P2: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditP2: value })),
              'P2',
              state.isManualEditP2 ? state.P2 : state.resultP2,
              t('bernoulliCalc.labels.P2') || 'Presión P₂'
            )}

            {renderInput(
              'Altura h₂',
              state.h2,
              (text) => setState((prev) => ({ ...prev, h2: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditH2: value })),
              'h2',
              state.isManualEditH2 ? state.h2 : state.resultH2,
              t('bernoulliCalc.labels.h2') || 'Altura h₂'
            )}

            {renderInput(
              'Velocidad v₂',
              state.v2,
              (text) => setState((prev) => ({ ...prev, v2: text })),
              (value) => setState((prev) => ({ ...prev, isManualEditV2: value })),
              'v2',
              state.isManualEditV2 ? state.v2 : state.resultV2,
              t('bernoulliCalc.labels.v2') || 'Velocidad v₂'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Caudal */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('bernoulliCalc.flowSection') || 'Caudal'}
            </Text>

            {renderInput(
              'Cambio de Presión',
              state.pressureChange,
              (text) => setState((prev) => ({ ...prev, pressureChange: text })),
              () => {},
              'pressureChange',
              state.resultPressureChange,
              t('bernoulliCalc.labels.pressureChange') || 'Cambio de Presión',
              !!state.resultPressureChange
            )}

            {renderInput(
              'Diámetro Posición 1',
              state.diameter1,
              (text) => setState((prev) => ({ ...prev, diameter1: text })),
              () => {},
              'diameter1',
              state.resultDiameter1,
              t('bernoulliCalc.labels.diameter1') || 'Diámetro Posición 1'
            )}

            {renderInput(
              'Diámetro Posición 2',
              state.diameter2,
              (text) => setState((prev) => ({ ...prev, diameter2: text })),
              () => {},
              'diameter2',
              state.resultDiameter2,
              t('bernoulliCalc.labels.diameter2') || 'Diámetro Posición 2'
            )}

            {renderInput(
              'Caudal Volumétrico',
              state.flowRate,
              (text) => setState((prev) => ({ ...prev, flowRate: text })),
              () => {},
              'flowRate',
              state.resultFlowRate,
              t('bernoulliCalc.labels.flowRate') || 'Caudal Volumétrico'
            )}
          </View>
        </View>
      </ScrollView>
      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 1)' 
  },
  mainContainer: { 
    flex: 1, 
    paddingVertical: 0, 
    backgroundColor: 'rgb(0, 0, 0)' 
  },
  headerContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    minHeight: 45, 
    backgroundColor: 'transparent', 
    marginTop: 30, 
    paddingHorizontal: 20 
  },
  iconWrapper: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    width: 60, 
    height: 40, 
    borderRadius: 30, 
    padding: 1 
  },
  iconContainer: { 
    backgroundColor: 'rgb(20, 20, 20)', 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flex: 1 
  },
  rightIconsContainer: { 
    flexDirection: 'row', 
    gap: 5, 
    justifyContent: 'space-between' 
  },
  titlesContainer: { 
    backgroundColor: 'transparent', 
    marginVertical: 10, 
    paddingHorizontal: 20 
  },
  subtitle: { 
    color: 'rgb(255, 255, 255)', 
    fontSize: 18, 
    fontFamily: 'SFUIDisplay-Bold'
   },
  title: { 
    color: 'rgb(255, 255, 255)', 
    fontSize: 30, 
    fontFamily: 'SFUIDisplay-Bold', 
    marginTop: -10 
  },
  resultsMain: { 
    paddingHorizontal: 20 
  },
  resultsContainerMain: { 
    padding: 1, 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    borderRadius: 25 
  },
  resultsContainer: { 
    backgroundColor: 'rgb(20, 20, 20)', 
    borderRadius: 24, 
    overflow: 'hidden' 
  },
  saveButton: { 
    backgroundColor: 'transparent', 
    width: '100%', 
    paddingVertical: 5, 
    paddingHorizontal: 20, 
    borderRadius: 6, 
    alignSelf: 'flex-start', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  saveButtonText: { 
    color: 'rgba(255, 255, 255, 0.4)', 
    fontFamily: 'SFUIDisplay-Medium', 
    fontSize: 14 
  },
  plusIcon: { 
    marginLeft: 'auto' 
  },
  imageContainer: { 
    backgroundColor: 'transparent', 
    padding: 0, 
    borderTopLeftRadius: 25, 
    borderTopRightRadius: 25, 
    borderBottomLeftRadius: 23, 
    borderBottomRightRadius: 23, 
    overflow: 'hidden' 
  },
  flowContainer: { 
    alignItems: 'baseline', 
    padding: 0, 
    justifyContent: 'center', 
    position: 'relative' 
  },
  caudalLabel: { 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.4)', 
    borderRadius: 14, 
    marginLeft: 11, 
    marginTop: 11, 
    height: 28, 
    minWidth: 90, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 5 
  },
  flowLabel: { 
    fontSize: 14, 
    fontFamily: 'SFUIDisplay-Semibold' 
  },
  flowValueContainer: { 
    backgroundColor: 'transparent', 
    marginHorizontal: 20, 
    marginVertical: 0 
  },
  flowValue: { 
    fontSize: 40, 
    fontFamily: 'SFUIDisplay-Heavy' 
  },
  buttonsContainer: { 
    flexDirection: 'row', 
    marginTop: 20, 
    marginBottom: 15, 
    backgroundColor: 'transparent', 
    gap: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  actionWrapper: { 
    alignItems: 'center', 
    backgroundColor: 'transparent' 
  },
  actionButtonMain: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    padding: 1, 
    height: 60, 
    width: 60, 
    borderRadius: 30 
  },
  actionButton: { 
    backgroundColor: 'rgb(20, 20, 20)', 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flex: 1 
  },
  actionButtonText: { 
    marginTop: 2, 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 1)', 
    fontFamily: 'SFUIDisplay-Medium' 
  },
  inputsSection: { 
    flex: 1, 
    backgroundColor: 'rgba(255, 255, 255, 1)', 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    borderRadius: 25, 
    paddingBottom: 100 
  },
  inputsContainer: { 
    backgroundColor: 'transparent' 
  },
  inputWrapper: { 
    marginBottom: 10, 
    backgroundColor: 'transparent' 
  },
  inputLabel: { 
    color: 'rgb(0, 0, 0)', 
    marginBottom: 2, 
    fontFamily: 'SFUIDisplay-Medium', 
    fontSize: 16 
  },
  redContainer: { 
    backgroundColor: 'rgba(0, 0, 0, 0)', 
    paddingHorizontal: 0, 
    width: '100%', 
    gap: 10, 
    flexDirection: 'row' 
  },
  Container: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)', 
    justifyContent: 'center', 
    height: 50, 
    overflow: 'hidden', 
    borderRadius: 25, 
    padding: 1, 
    width: '68%' 
  },
  Container2: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)', 
    justifyContent: 'center', 
    height: 50, 
    overflow: 'hidden', 
    borderRadius: 25, 
    padding: 1, 
    flex: 1 
  },
  innerWhiteContainer: { 
    backgroundColor: 'white', 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    borderRadius: 25 
  },
  innerWhiteContainer2: { 
    backgroundColor: 'white', 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    borderRadius: 25, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingRight: 13, 
    paddingLeft: 20 
  },
  input: { 
    height: 50, 
    backgroundColor: 'rgba(255, 143, 143, 0)', 
    paddingHorizontal: 20, 
    fontFamily: 'SFUIDisplay-Medium', 
    marginTop: 2.75, 
    fontSize: 16, 
    color: 'rgba(0, 0, 0, 1)' 
  },
  sectionSubtitle: { 
    fontSize: 20, 
    fontFamily: 'SFUIDisplay-Bold', 
    color: 'rgb(0, 0, 0)', 
    marginTop: 5, 
    marginBottom: 5 
  },
  separator: { 
    height: 1, 
    backgroundColor: 'rgb(235, 235, 235)', 
    marginVertical: 10 
  },
  text: { 
    fontFamily: 'SFUIDisplay-Medium', 
    fontSize: 16, 
    color: 'rgba(0, 0, 0, 1)', 
    marginTop: 2.75 
  },
  icon: { 
    marginLeft: 'auto' 
  },
  iconWrapper2: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    width: 40, 
    height: 40, 
    borderRadius: 30, 
    padding: 1 
  },
});

export default BernoulliCalc;