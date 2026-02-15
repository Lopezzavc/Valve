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
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

// Tipos de navegación
type RootStackParamList = {
  OptionsScreenEnergiaBernoulli: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenEnergiaBernoulli: undefined;
  EnergiaBernoulliTheory: undefined;
};

// Imagen de fondo para el contenedor de resultados
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// Tipos para los modos de cálculo
type CalculatorMode = 'ideal' | 'losses' | 'cavitation';

// Estado de la calculadora
interface CalculatorState {
  mode: CalculatorMode;
  
  // Variables de la ecuación general de energía
  P1: string;
  P2: string;
  z1: string;
  z2: string;
  V1: string;
  V2: string;
  D1: string;
  D2: string;
  rho: string;
  gamma: string;
  g: string;
  alpha1: string;
  alpha2: string;
  hb: string;
  ht: string;
  
  // Variables para pérdidas
  lossInputType: 'direct' | 'darcy';
  hL: string;
  L: string;
  f: string;
  K: string;
  
  // Variables para cavitación
  temperatura: string;
  Pv: string;
  
  // Unidades
  P1Unit: string;
  P2Unit: string;
  z1Unit: string;
  z2Unit: string;
  V1Unit: string;
  V2Unit: string;
  D1Unit: string;
  D2Unit: string;
  rhoUnit: string;
  gammaUnit: string;
  gUnit: string;
  hbUnit: string;
  htUnit: string;
  hLUnit: string;
  LUnit: string;
  temperaturaUnit: string;
  PvUnit: string;
  
  // Unidades previas para conversión
  prevP1Unit: string;
  prevP2Unit: string;
  prevZ1Unit: string;
  prevZ2Unit: string;
  prevV1Unit: string;
  prevV2Unit: string;
  prevD1Unit: string;
  prevD2Unit: string;
  prevRhoUnit: string;
  prevGammaUnit: string;
  prevGUnit: string;
  prevHbUnit: string;
  prevHtUnit: string;
  prevHLUnit: string;
  prevLUnit: string;
  prevTemperaturaUnit: string;
  prevPvUnit: string;
  
  // Resultados
  resultTotalEnergy: number;
  resultP1: string;
  resultV1: string;
  resultZ1: string;
  resultP2: string;
  resultV2: string;
  resultZ2: string;
  resultNPSHa: string;
  resultCavitationMargin: string;
  resultPabs: string;
  resultAlpha2?: string;
  
  // Estados de edición manual
  isManualEditP1: boolean;
  isManualEditP2: boolean;
  isManualEditz1: boolean;
  isManualEditz2: boolean;
  isManualEditV1: boolean;
  isManualEditV2: boolean;
  isManualEditD1: boolean;
  isManualEditD2: boolean;
  isManualEditHb: boolean;
  isManualEditHt: boolean;
  isManualEditHL: boolean;
  isManualEditAlpha1: boolean;
  isManualEditAlpha2: boolean;

  unknownVariable: {
    name: string;
    label: string;
    unit: string;
    value: string;
  } | null;
  
  // Campo bloqueado para resolución automática
  lockedField: string | null;
  invalidFields: string[];
  autoCalculatedField: string | null;
}

// Factores de conversión
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    'm': 1,
    'mm': 0.001,
    'cm': 0.01,
    'km': 1000,
    'in': 0.0254,
    'ft': 0.3048,
    'yd': 0.9144,
    'mi': 1609.344,
  },
  velocity: {
    'm/s': 1,
    'km/h': 0.2777777777777778,
    'ft/s': 0.3048,
    'mph': 0.44704,
    'kn': 0.5144444444444445,
    'cm/s': 0.01,
    'in/s': 0.0254,
  },
  area: {
    'm²': 1,
    'cm²': 0.0001,
    'mm²': 0.000001,
    'km²': 1000000,
    'ha': 10000,
    'in²': 0.00064516,
    'ft²': 0.09290304,
    'yd²': 0.83612736,
    'mi²': 2589988.110336,
    'acre': 4046.8564224,
  },
  pressure: {
    'Pa': 1,
    'kPa': 1000,
    'MPa': 1000000,
    'bar': 100000,
    'atm': 101325,
    'psi': 6894.76,
    'mmHg': 133.322,
    'mca': 9806.65,
    'N/m³': 1,
  },
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,
    'lb/ft³': 16.0185,
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,
    'g': 9.80665,
  },
  temperature: {
    '°C': 1,
    '°F': 1,
    'K': 1,
  },
  specificWeight: {
    'N/m³': 1,
    'kN/m³': 1000,
    'lbf/ft³': 157.087,
  },
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
  mode: 'ideal',
  
  P1: '',
  P2: '',
  z1: '',
  z2: '',
  V1: '',
  V2: '',
  D1: '',
  D2: '',
  rho: '1000',
  gamma: '9806.65',
  g: '9.81',
  alpha1: '1',
  alpha2: '1',
  hb: '',
  ht: '',
  
  lossInputType: 'direct',
  hL: '',
  L: '',
  f: '',
  K: '',
  
  temperatura: '20',
  Pv: '2338',
  
  P1Unit: 'Pa',
  P2Unit: 'Pa',
  z1Unit: 'm',
  z2Unit: 'm',
  V1Unit: 'm/s',
  V2Unit: 'm/s',
  D1Unit: 'm',
  D2Unit: 'm',
  rhoUnit: 'kg/m³',
  gammaUnit: 'N/m³',
  gUnit: 'm/s²',
  hbUnit: 'm',
  htUnit: 'm',
  hLUnit: 'm',
  LUnit: 'm',
  temperaturaUnit: '°C',
  PvUnit: 'Pa',
  
  prevP1Unit: 'Pa',
  prevP2Unit: 'Pa',
  prevZ1Unit: 'm',
  prevZ2Unit: 'm',
  prevV1Unit: 'm/s',
  prevV2Unit: 'm/s',
  prevD1Unit: 'm',
  prevD2Unit: 'm',
  prevRhoUnit: 'kg/m³',
  prevGammaUnit: 'N/m³',
  prevGUnit: 'm/s²',
  prevHbUnit: 'm',
  prevHtUnit: 'm',
  prevHLUnit: 'm',
  prevLUnit: 'm',
  prevTemperaturaUnit: '°C',
  prevPvUnit: 'Pa',
  
  resultTotalEnergy: 0,
  resultP1: '',
  resultV1: '',
  resultZ1: '',
  resultP2: '',
  resultV2: '',
  resultZ2: '',
  resultNPSHa: '',
  resultCavitationMargin: '',
  resultPabs: '',
  resultAlpha2: '',
  
  isManualEditP1: false,
  isManualEditP2: false,
  isManualEditz1: false,
  isManualEditz2: false,
  isManualEditV1: false,
  isManualEditV2: false,
  isManualEditD1: false,
  isManualEditD2: false,
  isManualEditHb: false,
  isManualEditHt: false,
  isManualEditHL: false,
  isManualEditAlpha1: false,
  isManualEditAlpha2: false,

  unknownVariable: null,
  
  lockedField: null,
  invalidFields: [],
  autoCalculatedField: null,
});

// Componente principal
const EnergiaBernoulliCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const [inputSectionPadding, setInputSectionPadding] = useState(100);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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
        blockInput: 'rgba(30, 30, 30, 1)',
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
      blockInput: 'rgba(240, 240, 240, 1)',
    };
  }, [currentTheme]);

  // Lazy init del estado
  const [state, setState] = useState<CalculatorState>(initialState);

  // Animaciones
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  // En la sección de animaciones, después de animatedScale y heartScale
  const animatedLossValue = useRef(new Animated.Value(0)).current;
  const animatedLossScale = useRef(new Animated.Value(1)).current;

  // Nuevos estados para métricas del selector de pérdidas
  const [lossButtonMetrics, setLossButtonMetrics] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });
  const [lossButtonPositions, setLossButtonPositions] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });

  // Posición y tamaño de botones
  const [buttonMetrics, setButtonMetrics] = useState<{ ideal: number; losses: number; cavitation: number }>({
    ideal: 0,
    losses: 0,
    cavitation: 0,
  });
  const [buttonPositions, setButtonPositions] = useState<{ ideal: number; losses: number; cavitation: number }>({
    ideal: 0,
    losses: 0,
    cavitation: 0,
  });

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
      
        const fav = await isFavorite(db, 'EnergiaBernoulliCalc');
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
    
      const route = 'EnergiaBernoulliCalc';
      const label = t('energiaBernoulliCalc.title') || 'Calculadora de Energía/Bernoulli';
    
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

  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  // Animación selector
  useEffect(() => {
    if (buttonMetrics.ideal > 0 && buttonMetrics.losses > 0 && buttonMetrics.cavitation > 0) {
      let targetX = 0;
      if (state.mode === 'ideal') targetX = buttonPositions.ideal;
      else if (state.mode === 'losses') targetX = buttonPositions.losses;
      else if (state.mode === 'cavitation') targetX = buttonPositions.cavitation;
      
      Animated.parallel([
        Animated.spring(animatedValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.mode, buttonMetrics, buttonPositions]);

  useEffect(() => {
    if (lossButtonMetrics.direct > 0 && lossButtonMetrics.darcy > 0) {
      let targetX = 0;
      if (state.lossInputType === 'direct') targetX = lossButtonPositions.direct;
      else if (state.lossInputType === 'darcy') targetX = lossButtonPositions.darcy;

      Animated.parallel([
        Animated.spring(animatedLossValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedLossScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedLossScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.lossInputType, lossButtonMetrics, lossButtonPositions]);

  // Helpers
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const fixed = num.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
    const numValue = parseFloat(cleanValue);
    
    if (category === 'temperature') {
      // Manejo especial para temperatura
      if (fromUnit === '°C' && toUnit === '°F') {
        return formatResult((numValue * 9/5) + 32);
      } else if (fromUnit === '°C' && toUnit === 'K') {
        return formatResult(numValue + 273.15);
      } else if (fromUnit === '°F' && toUnit === '°C') {
        return formatResult((numValue - 32) * 5/9);
      } else if (fromUnit === '°F' && toUnit === 'K') {
        return formatResult((numValue - 32) * 5/9 + 273.15);
      } else if (fromUnit === 'K' && toUnit === '°C') {
        return formatResult(numValue - 273.15);
      } else if (fromUnit === 'K' && toUnit === '°F') {
        return formatResult((numValue - 273.15) * 9/5 + 32);
      }
      return value;
    }
    
    const fromFactor = conversionFactors[category]?.[fromUnit];
    const toFactor = conversionFactors[category]?.[toUnit];
    if (!fromFactor || !toFactor) return value;
    const convertedValue = (numValue * fromFactor) / toFactor;
    return formatResult(convertedValue);
  }, [formatResult]);

  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Cálculo de presión de vapor según temperatura (agua)
  const calculateVaporPressure = useCallback((temp: number, unit: string): number => {
    // Convertir a °C si es necesario
    let tempC = temp;
    if (unit === '°F') {
      tempC = (temp - 32) * 5/9;
    } else if (unit === 'K') {
      tempC = temp - 273.15;
    }
    
    // Fórmula aproximada para presión de vapor del agua en Pa (rango 0-100°C)
    // Basada en ecuación de Antoine
    if (tempC < 0 || tempC > 100) return 0;
    
    const A = 8.07131;
    const B = 1730.63;
    const C = 233.426;
    
    // Presión en mmHg, convertir a Pa
    const P_mmHg = Math.pow(10, A - (B / (tempC + C)));
    return P_mmHg * 133.322;
  }, []);

  const updateLockedFieldIdeal = useCallback(() => {
    // Ahora incluimos TODOS los 8 campos
    const inputs = [
      { id: 'P1', value: state.P1 },
      { id: 'V1', value: state.V1 },
      { id: 'z1', value: state.z1 },
      { id: 'P2', value: state.P2 },
      { id: 'V2', value: state.V2 },
      { id: 'z2', value: state.z2 },
      { id: 'alpha1', value: state.alpha1 }, // Añadido alpha1
      { id: 'alpha2', value: state.alpha2 },
    ];

    const validInputs = inputs.filter(({ value }) => 
      value !== '' && !isNaN(parseFloat(value.replace(',', '.')))
    );

    // Si hay exactamente 7 válidos (8 total - 1 incógnita)
    if (validInputs.length === 7) {
      const emptyInput = inputs.find(({ value }) => 
        value === '' || isNaN(parseFloat(value.replace(',', '.')))
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.V1, state.z1, state.P2, state.V2, state.z2, state.alpha1, state.alpha2]);

  const calculateIdealBernoulli = useCallback(() => {
    // Definir los 8 campos posibles (incluyendo alpha1 y alpha2)
    const allFields = [
      { id: 'P1', value: state.P1, unit: state.P1Unit, category: 'pressure', resultField: 'resultP1' },
      { id: 'V1', value: state.V1, unit: state.V1Unit, category: 'velocity', resultField: 'resultV1' },
      { id: 'z1', value: state.z1, unit: state.z1Unit, category: 'length', resultField: 'resultZ1' },
      { id: 'P2', value: state.P2, unit: state.P2Unit, category: 'pressure', resultField: 'resultP2' },
      { id: 'V2', value: state.V2, unit: state.V2Unit, category: 'velocity', resultField: 'resultV2' },
      { id: 'z2', value: state.z2, unit: state.z2Unit, category: 'length', resultField: 'resultZ2' },
      { id: 'alpha1', value: state.alpha1, unit: '', category: 'none', resultField: 'alpha1' }, // Añadido
      { id: 'alpha2', value: state.alpha2, unit: '', category: 'none', resultField: 'alpha2' },
    ];

    // Convertir cada campo a unidades SI y verificar validez
    const fieldsInSI = allFields.map(field => {
      if (field.id === 'alpha1' || field.id === 'alpha2') {
        // α₁ y α₂ no necesitan conversión de unidades
        const rawValue = field.value.replace(',', '.');
        if (rawValue === '' || isNaN(parseFloat(rawValue))) {
          return { ...field, siValue: NaN, isValid: false };
        }
        return { ...field, siValue: parseFloat(rawValue), isValid: true };
      }

      const rawValue = field.value.replace(',', '.');
      if (rawValue === '' || isNaN(parseFloat(rawValue))) {
        return { ...field, siValue: NaN, isValid: false };
      }
      const numValue = parseFloat(rawValue);
      const factor = conversionFactors[field.category]?.[field.unit] || 1;
      return { ...field, siValue: numValue * factor, isValid: true };
    });

    // Contar campos válidos y encontrar los faltantes
    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);
    const validCount = validFields.length;

    // Obtener valores gamma y g en unidades SI
    const gammaSI = state.gamma && !isNaN(parseFloat(state.gamma.replace(',', '.')))
      ? parseFloat(state.gamma.replace(',', '.')) * conversionFactors.pressure[state.gammaUnit]
      : 9806.65;

    const gSI = state.g && !isNaN(parseFloat(state.g.replace(',', '.')))
      ? parseFloat(state.g.replace(',', '.')) * conversionFactors.acceleration[state.gUnit]
      : 9.81;

    // Caso 1: Más de un campo faltante → marcar inválido y no calcular
    if (validCount !== 7) { // Cambiado de 6 a 7
      setState((prev) => ({
        ...prev,
        resultTotalEnergy: 0,
        resultP1: '',
        resultV1: '',
        resultZ1: '',
        resultP2: '',
        resultV2: '',
        resultZ2: '',
        invalidFields: missingFields,
        autoCalculatedField: null,
      }));
      return;
    }

    // Caso 2: Exactamente 7 campos válidos → encontrar el faltante y resolver
    const missingField = missingFields[0];

    // Crear mapa de valores SI
    const siValues: { [key: string]: number } = {};
    validFields.forEach(f => { 
      if (f.id !== 'alpha1' && f.id !== 'alpha2') {
        siValues[f.id] = f.siValue;
      } else {
        siValues[f.id] = f.siValue;
      }
    });

    const newState: Partial<CalculatorState> = {};

    // Calcular energía total usando los valores disponibles
    let E = 0;
    const alpha1 = siValues['alpha1'] !== undefined ? siValues['alpha1'] : 1;
    const alpha2 = siValues['alpha2'] !== undefined ? siValues['alpha2'] : 1;

    if (siValues['P1'] !== undefined && siValues['V1'] !== undefined && siValues['z1'] !== undefined) {
      E = siValues['P1']/gammaSI + alpha1 * siValues['V1']*siValues['V1']/(2*gSI) + siValues['z1'];
    } else if (siValues['P2'] !== undefined && siValues['V2'] !== undefined && siValues['z2'] !== undefined) {
      E = siValues['P2']/gammaSI + alpha2 * siValues['V2']*siValues['V2']/(2*gSI) + siValues['z2'];
    }

    // Limpiar resultados anteriores
    newState.resultP1 = '';
    newState.resultV1 = '';
    newState.resultZ1 = '';
    newState.resultP2 = '';
    newState.resultV2 = '';
    newState.resultZ2 = '';

    switch (missingField) {
      case 'P1': {
        if (siValues['V1'] === undefined || siValues['z1'] === undefined) break;
        const headTerm = E - alpha1 * siValues['V1']*siValues['V1']/(2*gSI) - siValues['z1'];
        const pressureSI = headTerm * gammaSI;
        const result = pressureSI / conversionFactors.pressure[state.P1Unit];
        const formattedResult = formatResult(result);
        newState.resultP1 = formattedResult;
        
        // AÑADIR: Actualizar unknownVariable
        newState.unknownVariable = {
          name: 'P₁',
          label: t('energiaBernoulliCalc.labels.P1'),
          unit: state.P1Unit,
          value: formattedResult
        };
        break;
      }

      case 'V1': {
        if (siValues['P1'] === undefined || siValues['z1'] === undefined) break;
        const headTerm = E - siValues['P1']/gammaSI - siValues['z1'];
        if (headTerm >= 0) {
          const velocitySI = Math.sqrt(2 * gSI * headTerm / alpha1);
          const result = velocitySI / conversionFactors.velocity[state.V1Unit];
          const formattedResult = formatResult(result);
          newState.resultV1 = formattedResult;

          // AÑADIR: Actualizar unknownVariable
          newState.unknownVariable = {
            name: 'V₁',
            label: t('energiaBernoulliCalc.labels.V1'),
            unit: state.V1Unit,
            value: formattedResult
          };
        }
        break;
      }

      case 'z1': {
        if (siValues['P1'] === undefined || siValues['V1'] === undefined) break;
        const elevationSI = E - siValues['P1']/gammaSI - alpha1 * siValues['V1']*siValues['V1']/(2*gSI);
        const result = elevationSI / conversionFactors.length[state.z1Unit];
        const formattedResult = formatResult(result);
        newState.resultZ1 = formattedResult;
        
        // AÑADIR: Actualizar unknownVariable
        newState.unknownVariable = {
          name: 'z₁',
          label: t('energiaBernoulliCalc.labels.z1'),
          unit: state.z1Unit,
          value: formattedResult
        };
        break;
      }

      case 'P2': {
        if (siValues['V2'] === undefined || siValues['z2'] === undefined) break;
        const headTerm = E - alpha2 * siValues['V2']*siValues['V2']/(2*gSI) - siValues['z2'];
        const pressureSI = headTerm * gammaSI;
        const result = pressureSI / conversionFactors.pressure[state.P2Unit];
        const formattedResult = formatResult(result);
        newState.resultP2 = formattedResult;
        
        // AÑADIR: Actualizar unknownVariable
        newState.unknownVariable = {
          name: 'P₂',
          label: t('energiaBernoulliCalc.labels.P2'),
          unit: state.P2Unit,
          value: formattedResult
        };
        break;
      }

      case 'V2': {
        if (siValues['P2'] === undefined || siValues['z2'] === undefined) break;
        const headTerm = E - siValues['P2']/gammaSI - siValues['z2'];
        if (headTerm >= 0) {
          const velocitySI = Math.sqrt(2 * gSI * headTerm / alpha2);
          const result = velocitySI / conversionFactors.velocity[state.V2Unit];
          const formattedResult = formatResult(result);
          newState.resultV2 = formattedResult;

          // AÑADIR: Actualizar unknownVariable
          newState.unknownVariable = {
            name: 'V₂',
            label: t('energiaBernoulliCalc.labels.V2'),
            unit: state.V2Unit,
            value: formattedResult
          };
        }
        break;
      }

      case 'z2': {
        if (siValues['P2'] === undefined || siValues['V2'] === undefined) break;
        const elevationSI = E - siValues['P2']/gammaSI - alpha2 * siValues['V2']*siValues['V2']/(2*gSI);
        const result = elevationSI / conversionFactors.length[state.z2Unit];
        const formattedResult = formatResult(result);
        newState.resultZ2 = formattedResult;
        
        // AÑADIR: Actualizar unknownVariable
        newState.unknownVariable = {
          name: 'z₂',
          label: t('energiaBernoulliCalc.labels.z2'),
          unit: state.z2Unit,
          value: formattedResult
        };
        break;
      }

      case 'alpha1': {
        if (E === 0) {
          // Intentar calcular E con los valores que tenemos
          if (siValues['P1'] !== undefined && siValues['V1'] !== undefined && siValues['z1'] !== undefined) {
            E = siValues['P1']/gammaSI + alpha1 * siValues['V1']*siValues['V1']/(2*gSI) + siValues['z1'];
          } else if (siValues['P2'] !== undefined && siValues['V2'] !== undefined && siValues['z2'] !== undefined) {
            E = siValues['P2']/gammaSI + alpha2 * siValues['V2']*siValues['V2']/(2*gSI) + siValues['z2'];
          }
        }

        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;

        // Primero, asegurarnos de tener la energía total correcta
        // Si tenemos valores de la sección 2, calcular E desde allí
        if (siValues['P2'] !== undefined && siValues['V2'] !== undefined && siValues['z2'] !== undefined) {
          // Usar la sección 2 para calcular E
          E = siValues['P2']/gammaSI + alpha2 * siValues['V2']*siValues['V2']/(2*gSI) + siValues['z2'];
        }

        // Calcular α₁ usando la ecuación de Bernoulli
        // P₁/γ + α₁·V₁²/2g + z₁ = E
        // Por lo tanto: α₁·V₁²/2g = E - P₁/γ - z₁
        const energyTerm = E - siValues['P1']/gammaSI - siValues['z1'];

        if (energyTerm > 0 && siValues['V1'] !== 0) {
          // Despejando α₁ = (2g * (E - P₁/γ - z₁)) / V₁²
          const alpha1_calc = (2 * gSI * energyTerm) / (siValues['V1'] * siValues['V1']);
          const formattedResult = formatResult(alpha1_calc);
          newState.alpha1 = formattedResult;
          newState.isManualEditAlpha1 = false;
        
          // Actualizar unknownVariable
          newState.unknownVariable = {
            name: 'α₁',
            label: t('energiaBernoulliCalc.labels.alpha1'),
            unit: '',
            value: formattedResult
          };
        }
        break;
      }

      case 'alpha2': {
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;

        // Si tenemos valores de la sección 1, calcular E desde allí
        if (siValues['P1'] !== undefined && siValues['V1'] !== undefined && siValues['z1'] !== undefined) {
          E = siValues['P1']/gammaSI + alpha1 * siValues['V1']*siValues['V1']/(2*gSI) + siValues['z1'];
        }

        const energyTerm = E - siValues['P2']/gammaSI - siValues['z2'];

        if (energyTerm > 0 && siValues['V2'] !== 0) {
          const alpha2_calc = (2 * gSI * energyTerm) / (siValues['V2'] * siValues['V2']);
          const formattedResult = formatResult(alpha2_calc);
          newState.resultAlpha2 = formattedResult;
          newState.alpha2 = formattedResult;
          newState.isManualEditAlpha2 = false;
        
          newState.unknownVariable = {
            name: 'α₂',
            label: t('energiaBernoulliCalc.labels.alpha2'),
            unit: '',
            value: formattedResult
          };
        }
        break;
      }
    }

    // Si no se encontró una variable faltante (caso cuando hay 8 campos válidos)
    if (!missingField) {
      newState.unknownVariable = null;
    }


    setState((prev) => ({
      ...prev,
      ...newState,
      invalidFields: [],
      autoCalculatedField: missingField,
      resultTotalEnergy: E,
      // Resetear banderas de edición manual para el campo calculado
      isManualEditP1: missingField === 'P1' ? false : prev.isManualEditP1,
      isManualEditV1: missingField === 'V1' ? false : prev.isManualEditV1,
      isManualEditz1: missingField === 'z1' ? false : prev.isManualEditz1,
      isManualEditP2: missingField === 'P2' ? false : prev.isManualEditP2,
      isManualEditV2: missingField === 'V2' ? false : prev.isManualEditV2,
      isManualEditz2: missingField === 'z2' ? false : prev.isManualEditz2,
      isManualEditAlpha1: missingField === 'alpha1' ? false : (prev.isManualEditAlpha1 || false),
      isManualEditAlpha2: missingField === 'alpha2' ? false : prev.isManualEditAlpha2,
    }));

  }, [state, formatResult]);

  useEffect(() => {
    if (state.mode === 'ideal') {
      updateLockedFieldIdeal();
    }
  }, [state.mode, state.P1, state.V1, state.z1, state.P2, state.V2, state.z2, state.alpha1, state.alpha2, updateLockedFieldIdeal]);
  // Añadido state.alpha2 ↑

  const calculateWithLosses = useCallback(() => {
    const requiredIds = ['P1', 'z1', 'V1', 'P2', 'z2', 'V2', 'gamma', 'g'];
    if (state.lossInputType === 'direct') {
      requiredIds.push('hL');
    } else {
      requiredIds.push('L', 'D1', 'f', 'K');
    }
    
    const missing = requiredIds.filter((id) => {
      const raw = (state as any)[id] as string;
      const val = raw?.replace(',', '.');
      return !val || isNaN(parseFloat(val));
    });

    if (missing.length > 1) {
      setState((prev) => ({
        ...prev,
        invalidFields: missing,
        autoCalculatedField: null,
        resultTotalEnergy: 0,
      }));
      return;
    }

    // Calcular pérdidas
    let hL_value = 0;
    if (state.lossInputType === 'direct') {
      hL_value = parseFloat(state.hL.replace(',', '.')) * conversionFactors.length[state.hLUnit];
    } else {
      const L = parseFloat(state.L.replace(',', '.')) * conversionFactors.length[state.LUnit];
      const D1 = parseFloat(state.D1.replace(',', '.')) * conversionFactors.length[state.D1Unit];
      const f = parseFloat(state.f.replace(',', '.'));
      const K = parseFloat(state.K.replace(',', '.'));
      const V1 = parseFloat(state.V1.replace(',', '.')) * conversionFactors.velocity[state.V1Unit];
      const g = parseFloat(state.g.replace(',', '.')) * conversionFactors.acceleration[state.gUnit];
      
      // Pérdidas por fricción + pérdidas menores
      const hL_friction = f * (L / D1) * (V1 * V1) / (2 * g);
      const hL_minor = K * (V1 * V1) / (2 * g);
      hL_value = hL_friction + hL_minor;
    }

    // Obtener valores en unidades base
    const P1 = parseFloat(state.P1.replace(',', '.')) * conversionFactors.pressure[state.P1Unit];
    const P2 = parseFloat(state.P2.replace(',', '.')) * conversionFactors.pressure[state.P2Unit];
    const z1 = parseFloat(state.z1.replace(',', '.')) * conversionFactors.length[state.z1Unit];
    const z2 = parseFloat(state.z2.replace(',', '.')) * conversionFactors.length[state.z2Unit];
    const V1 = parseFloat(state.V1.replace(',', '.')) * conversionFactors.velocity[state.V1Unit];
    const V2 = parseFloat(state.V2.replace(',', '.')) * conversionFactors.velocity[state.V2Unit];
    const gamma = parseFloat(state.gamma.replace(',', '.')) * conversionFactors.pressure[state.gammaUnit];
    const g = parseFloat(state.g.replace(',', '.')) * conversionFactors.acceleration[state.gUnit];
    const alpha1 = parseFloat(state.alpha1?.replace(',', '.') || '1');
    const alpha2 = parseFloat(state.alpha2?.replace(',', '.') || '1');
    const hb = state.hb ? parseFloat(state.hb.replace(',', '.')) * conversionFactors.length[state.hbUnit] : 0;
    const ht = state.ht ? parseFloat(state.ht.replace(',', '.')) * conversionFactors.length[state.htUnit] : 0;

    // Energía en sección 1
    const E1 = P1/gamma + alpha1 * V1*V1/(2*g) + z1 + hb - ht;
    // Energía en sección 2
    const E2 = P2/gamma + alpha2 * V2*V2/(2*g) + z2 + hL_value;

    setState((prev) => ({
      ...prev,
      invalidFields: [],
      autoCalculatedField: null,
      resultTotalEnergy: E1 - E2, // Diferencia de energía (pérdidas)
    }));
  }, [state, formatResult]);

  const calculateCavitation = useCallback(() => {
    const requiredIds = ['P1', 'z1', 'V1', 'gamma', 'g', 'temperatura'];
    
    const missing = requiredIds.filter((id) => {
      const raw = (state as any)[id] as string;
      const val = raw?.replace(',', '.');
      return !val || isNaN(parseFloat(val));
    });

    if (missing.length > 0) {
      setState((prev) => ({
        ...prev,
        invalidFields: missing,
        autoCalculatedField: null,
        resultCavitationMargin: '',
        resultNPSHa: '',
      }));
      return;
    }

    // Calcular presión de vapor según temperatura
    const temp = parseFloat(state.temperatura.replace(',', '.'));
    let Pv = 0;
    
    if (state.Pv && !isNaN(parseFloat(state.Pv.replace(',', '.')))) {
      Pv = parseFloat(state.Pv.replace(',', '.')) * conversionFactors.pressure[state.PvUnit];
    } else {
      Pv = calculateVaporPressure(temp, state.temperaturaUnit);
    }

    // Obtener valores en unidades base
    const P1 = parseFloat(state.P1.replace(',', '.')) * conversionFactors.pressure[state.P1Unit];
    const z1 = parseFloat(state.z1.replace(',', '.')) * conversionFactors.length[state.z1Unit];
    const V1 = parseFloat(state.V1.replace(',', '.')) * conversionFactors.velocity[state.V1Unit];
    const gamma = parseFloat(state.gamma.replace(',', '.')) * conversionFactors.pressure[state.gammaUnit];
    const g = parseFloat(state.g.replace(',', '.')) * conversionFactors.acceleration[state.gUnit];
    
    // Pérdidas (opcionales)
    const hL = state.hL ? parseFloat(state.hL.replace(',', '.')) * conversionFactors.length[state.hLUnit] : 0;

    // Presión absoluta en la sección (asumiendo presión atmosférica si no se especifica)
    const Pabs = P1 + 101325; // Sumar presión atmosférica si P1 es manométrica
    
    // NPSH disponible
    const NPSHa = (Pabs / gamma) + z1 - (Pv / gamma) - hL;
    
    // Margen de cavitación (positivo = seguro)
    const cavitationMargin = NPSHa - 0.5; // Margen típico de seguridad

    setState((prev) => ({
      ...prev,
      invalidFields: [],
      autoCalculatedField: null,
      resultPabs: formatResult(Pabs / conversionFactors.pressure['Pa']),
      resultNPSHa: formatResult(NPSHa / conversionFactors.length['m']),
      resultCavitationMargin: formatResult(cavitationMargin / conversionFactors.length['m']),
      resultTotalEnergy: cavitationMargin,
    }));
  }, [state, formatResult, calculateVaporPressure]);

  const handleCalculate = useCallback(() => {
    switch (state.mode) {
      case 'ideal':
        calculateIdealBernoulli();
        break;
      case 'losses':
        calculateWithLosses();
        break;
      case 'cavitation':
        calculateCavitation();
        break;
    }
  }, [state.mode, calculateIdealBernoulli, calculateWithLosses, calculateCavitation]);

  const handleClear = useCallback(() => {
    const currentMode = state.mode;
    setState({
      ...initialState(),
      mode: currentMode,
      isManualEditAlpha2: false,
      unknownVariable: null, // Añadir esta línea
    });
  }, [state.mode]);

  const handleCopy = useCallback(() => {
    let textToCopy = '';
    const mainValue = state.resultTotalEnergy;
    const formattedMain = isNaN(mainValue) ? '0' : formatResult(mainValue);

    let modeText = '';
    switch (state.mode) {
      case 'ideal':
        modeText = t('energiaBernoulliCalc.mode.ideal');
        break;
      case 'losses':
        modeText = t('energiaBernoulliCalc.mode.losses');
        break;
      case 'cavitation':
        modeText = t('energiaBernoulliCalc.mode.cavitation');
        break;
    }

    if (state.mode === 'cavitation') {
      textToCopy += `${t('energiaBernoulliCalc.cavitationMargin')}: ${formattedMain} m\n`;
      textToCopy += `${t('energiaBernoulliCalc.npsha')}: ${state.resultNPSHa} m\n`;
      textToCopy += `${t('energiaBernoulliCalc.pabs')}: ${state.resultPabs} Pa\n`;
    } else {
      textToCopy += `${t('energiaBernoulliCalc.energyDifference')}: ${formattedMain} m\n`;
    }

    textToCopy += `${t('energiaBernoulliCalc.mode')}: ${modeText}\n\n`;
    textToCopy += `${t('energiaBernoulliCalc.section1')}\n`;

    // Sección 1
    textToCopy += `  P₁: ${state.isManualEditP1 ? state.P1 : state.resultP1 || state.P1} ${state.P1Unit}\n`;
    textToCopy += `  z₁: ${state.isManualEditz1 ? state.z1 : state.resultZ1 || state.z1} ${state.z1Unit}\n`;
    textToCopy += `  V₁: ${state.isManualEditV1 ? state.V1 : state.resultV1 || state.V1} ${state.V1Unit}\n`;

    if (state.alpha1 !== '1') {
      textToCopy += `  α₁: ${state.alpha1}\n`;
    }

    textToCopy += `${t('energiaBernoulliCalc.section2')}\n`;

    // Sección 2
    textToCopy += `  P₂: ${state.isManualEditP2 ? state.P2 : state.resultP2 || state.P2} ${state.P2Unit}\n`;
    textToCopy += `  z₂: ${state.isManualEditz2 ? state.z2 : state.resultZ2 || state.z2} ${state.z2Unit}\n`;
    textToCopy += `  V₂: ${state.isManualEditV2 ? state.V2 : state.resultV2 || state.V2} ${state.V2Unit}\n`;

    // Determinar qué valor de α₂ mostrar
    let alpha2Display = state.alpha2;

    // Si α₂ fue calculado automáticamente (es la incógnita) y no ha sido editado manualmente
    if (state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2) {
      // Si existe resultAlpha2, úsalo, de lo contrario usa el valor actual de alpha2
      alpha2Display = state.resultAlpha2 || state.alpha2;
    }

    // Si α₂ tiene un valor diferente de 1, mostrarlo
    if (alpha2Display && alpha2Display !== '1' && alpha2Display !== '') {
      textToCopy += `  α₂: ${alpha2Display}\n`;
    }

    // Mostrar α₂ incluso si es 1 pero fue calculado automáticamente (opcional)
    // Descomenta las siguientes líneas si quieres mostrar α₂ incluso cuando es 1
    /*
    if (state.autoCalculatedField === 'alpha2') {
      textToCopy += `  α₂: ${alpha2Display} (calculado)\n`;
    }
    */

    if (state.hb) {
      textToCopy += `${t('energiaBernoulliCalc.hb')}: ${state.hb} ${state.hbUnit}\n`;
    }
    if (state.ht) {
      textToCopy += `${t('energiaBernoulliCalc.ht')}: ${state.ht} ${state.htUnit}\n`;
    }

    if (state.mode === 'losses') {
      if (state.lossInputType === 'direct') {
        textToCopy += `${t('energiaBernoulliCalc.hL')}: ${state.hL} ${state.hLUnit}\n`;
      } else {
        textToCopy += `${t('energiaBernoulliCalc.L')}: ${state.L} ${state.LUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.D1')}: ${state.D1} ${state.D1Unit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.f')}: ${state.f}\n`;
        textToCopy += `${t('energiaBernoulliCalc.K')}: ${state.K}\n`;
      }
    }

    if (state.mode === 'cavitation') {
      textToCopy += `${t('energiaBernoulliCalc.temperatura')}: ${state.temperatura} ${state.temperaturaUnit}\n`;
      textToCopy += `${t('energiaBernoulliCalc.Pv')}: ${state.Pv || 'Calculada'} ${state.PvUnit}\n`;
    }

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('energiaBernoulliCalc.toasts.copied') });
  }, [state, formatResult, t]);

  const handleSaveHistory = useCallback(async () => {
    const noResults = state.resultTotalEnergy === 0 && 
                     !state.resultP1 && !state.resultP2 && 
                     !state.resultV1 && !state.resultV2 &&
                     !state.resultZ1 && !state.resultZ2 &&
                     !state.resultNPSHa;

    if (noResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('energiaBernoulliCalc.toasts.nothingToSave') });
      return;
    }

    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }

      const inputs = {
        mode: state.mode,
        P1: state.P1,
        P1Unit: state.P1Unit,
        P2: state.P2,
        P2Unit: state.P2Unit,
        z1: state.z1,
        z1Unit: state.z1Unit,
        z2: state.z2,
        z2Unit: state.z2Unit,
        V1: state.V1,
        V1Unit: state.V1Unit,
        V2: state.V2,
        V2Unit: state.V2Unit,
        gamma: state.gamma,
        gammaUnit: state.gammaUnit,
        g: state.g,
        gUnit: state.gUnit,
        alpha1: state.alpha1,
        alpha2: state.alpha2,
        hb: state.hb,
        hbUnit: state.hbUnit,
        ht: state.ht,
        htUnit: state.htUnit,
        ...(state.mode === 'losses' && {
          lossInputType: state.lossInputType,
          hL: state.hL,
          hLUnit: state.hLUnit,
          L: state.L,
          LUnit: state.LUnit,
          D1: state.D1,
          D1Unit: state.D1Unit,
          f: state.f,
          K: state.K,
        }),
        ...(state.mode === 'cavitation' && {
          temperatura: state.temperatura,
          temperaturaUnit: state.temperaturaUnit,
          Pv: state.Pv,
          PvUnit: state.PvUnit,
        }),
      };

      const result = formatResult(state.resultTotalEnergy);
      await saveCalculation(db, `EnergiaBernoulli_${state.mode}`, JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('energiaBernoulliCalc.toasts.saved') });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('energiaBernoulliCalc.toasts.saveError') });
    }
  }, [state, formatResult, t]);

  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenEnergiaBernoulli', { category, onSelectOption, selectedOption });
  }, [navigation]);

  const renderInput = useCallback((
    label: string,
    value: string,
    onChange: (text: string) => void,
    setManualEdit: (value: boolean) => void,
    fieldId?: string,
    resultValue?: string,
    displayLabel?: string,
    unitProp?: string,
  ) => {
    const unitMap: { [key: string]: string } = {
      'P₁': state.P1Unit,
      'P₂': state.P2Unit,
      'z₁': state.z1Unit,
      'z₂': state.z2Unit,
      'V₁': state.V1Unit,
      'V₂': state.V2Unit,
      'D₁': state.D1Unit,
      'D₂': state.D2Unit,
      'ρ': state.rhoUnit,
      'γ': state.gammaUnit,
      'g': state.gUnit,
      'hB': state.hbUnit,
      'hT': state.htUnit,
      'hL': state.hLUnit,
      'L': state.LUnit,
      'T': state.temperaturaUnit,
      'Pv': state.PvUnit,
    };
    
    const unit = unitProp || unitMap[label] || '';
    const shownLabel = displayLabel || label;

    const isFieldLocked = fieldId && state.lockedField === fieldId;
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    return (
      <View style={styles.inputWrapper}>
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.inputLabel,
              { color: themeColors.text, fontSize: 16 * fontSizeFactor }
            ]}
          >
            {shownLabel}
          </Text>
        {(() => {
          const id = fieldId || label;
          const hasUserValue = (value?.trim()?.length ?? 0) > 0;
          const isInvalid = state.invalidFields.includes(id);
          const isAuto =
            (id === state.autoCalculatedField) &&
            !hasUserValue &&
            !!(resultValue && resultValue !== '');
        
          let dotColor = 'rgb(200,200,200)';
          if (isInvalid) dotColor = 'rgb(254, 12, 12)';
          else if (isAuto) dotColor = 'rgba(62, 136, 255, 1)';
          else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';
        
          return <View style={[styles.valueDot, { backgroundColor: dotColor }]} />;
        })()}
        </View>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: inputContainerBg }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={resultValue && resultValue !== '' ? resultValue : value}
                onChangeText={(text) => {
                  onChange(text);
                  setManualEdit(true);
                  if (fieldId) {
                    setState((prev) => ({
                      ...prev,
                      invalidFields: prev.invalidFields.filter((f) => f !== fieldId),
                      autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
                      // Limpiar unknownVariable si el campo editado era la incógnita
                      unknownVariable: prev.unknownVariable?.name === fieldId ? null : prev.unknownVariable,
                    }));
                  }
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
              let category = 'length';
              if (label.includes('P')) category = 'pressure';
              else if (label.includes('V')) category = 'velocity';
              else if (label.includes('ρ')) category = 'density';
              else if (label.includes('γ')) category = 'specificWeight';
              else if (label === 'g') category = 'acceleration';
              else if (label === 'T') category = 'temperature';
              
              navigateToOptions(category, (option: string) => {
                // En la función updateUnit dentro de navigateToOptions:
                const updateUnit = (field: keyof CalculatorState, prevField: keyof CalculatorState, resultField?: keyof CalculatorState) => {
                  const inputValue = state[field] as string;
                  const prevUnit = state[prevField] as string;
                  const resultVal = resultField ? (state[resultField] as string) : '';
                  const convertedInputValue = convertValue(inputValue, prevUnit, option, category as any);
                  let convertedResultValue = resultVal;
                  if (resultVal && resultField) {
                    convertedResultValue = convertValue(resultVal, prevUnit, option, category as any);
                  }

                  setState((prev) => {
                    // Actualizar unknownVariable si la variable actual es la incógnita
                    let updatedUnknown = prev.unknownVariable;
                    if (updatedUnknown && field === updatedUnknown.name) {
                      updatedUnknown = {
                        ...updatedUnknown,
                        unit: option,
                        value: convertedResultValue || updatedUnknown.value
                      };
                    }

                    return {
                      ...prev,
                      [field]: convertedInputValue,
                      [prevField]: option,
                      [`${field}Unit`]: option,
                      ...(resultField && convertedResultValue ? { [resultField]: convertedResultValue } as any : {}),
                      unknownVariable: updatedUnknown,
                    };
                  });
                };

                switch (label) {
                  case 'P₁': updateUnit('P1', 'prevP1Unit', 'resultP1'); break;
                  case 'P₂': updateUnit('P2', 'prevP2Unit', 'resultP2'); break;
                  case 'z₁': updateUnit('z1', 'prevZ1Unit', 'resultZ1'); break;
                  case 'z₂': updateUnit('z2', 'prevZ2Unit', 'resultZ2'); break;
                  case 'V₁': updateUnit('V1', 'prevV1Unit', 'resultV1'); break;
                  case 'V₂': updateUnit('V2', 'prevV2Unit', 'resultV2'); break;
                  case 'D₁': updateUnit('D1', 'prevD1Unit'); break;
                  case 'D₂': updateUnit('D2', 'prevD2Unit'); break;
                  case 'ρ': updateUnit('rho', 'prevRhoUnit'); break;
                  case 'γ': updateUnit('gamma', 'prevGammaUnit'); break;
                  case 'g': updateUnit('g', 'prevGUnit'); break;
                  case 'hB': updateUnit('hb', 'prevHbUnit'); break;
                  case 'hT': updateUnit('ht', 'prevHtUnit'); break;
                  case 'hL': updateUnit('hL', 'prevHLUnit'); break;
                  case 'L': updateUnit('L', 'prevLUnit'); break;
                  case 'T': updateUnit('temperatura', 'prevTemperaturaUnit'); break;
                  case 'Pv': updateUnit('Pv', 'prevPvUnit'); break;
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

  const onLayoutDirect = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLossButtonPositions((prev) => ({ ...prev, direct: x }));
    setLossButtonMetrics((prev) => ({ ...prev, direct: width }));
  }, []);

  const onLayoutDarcy = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLossButtonPositions((prev) => ({ ...prev, darcy: x }));
    setLossButtonMetrics((prev) => ({ ...prev, darcy: width }));
  }, []);

  const renderLossTypeSelector = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.lossInputType')}
      </Text>
      <View style={styles.lossButtonContainer}>
        <Animated.View
          style={[
            styles.lossOverlay,
            {
              experimental_backgroundImage: themeColors.gradient,
              width: state.lossInputType === 'direct' ? lossButtonMetrics.direct : lossButtonMetrics.darcy,
              transform: [{ translateX: animatedLossValue }, { scale: animatedLossScale }],
            },
          ]}
        >
          <View style={[styles.lossOverlayInner, { backgroundColor: themeColors.card }]}></View>
        </Animated.View>

        <Pressable
          onLayout={onLayoutDirect}
          style={[styles.lossButton, state.lossInputType === 'direct' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, lossInputType: 'direct' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.direct')}
          </Text>
        </Pressable>

        <Pressable
          onLayout={onLayoutDarcy}
          style={[styles.lossButton, state.lossInputType === 'darcy' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, lossInputType: 'darcy' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.darcy')}
          </Text>
        </Pressable>
      </View>
    </View>
  ), [themeColors, t, fontSizeFactor, state.lossInputType, lossButtonMetrics, lossButtonPositions, animatedLossValue, animatedLossScale, onLayoutDirect, onLayoutDarcy]);

  const renderIdealInputs = useCallback(() => (
    <>
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section1')}
      </Text>
      {renderInput('P₁', state.P1, (text) => setState((prev) => ({ ...prev, P1: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditP1: val })), 
        'P1', state.isManualEditP1 ? state.P1 : state.resultP1, t('energiaBernoulliCalc.labels.P1'))}

      {renderInput('z₁', state.z1, (text) => setState((prev) => ({ ...prev, z1: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditz1: val })), 
        'z1', state.isManualEditz1 ? state.z1 : state.resultZ1, t('energiaBernoulliCalc.labels.z1'))}

      {renderInput('V₁', state.V1, (text) => setState((prev) => ({ ...prev, V1: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditV1: val })), 
        'V1', state.isManualEditV1 ? state.V1 : state.resultV1, t('energiaBernoulliCalc.labels.V1'))}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section2')}
      </Text>
      {renderInput('P₂', state.P2, (text) => setState((prev) => ({ ...prev, P2: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditP2: val })), 
        'P2', state.isManualEditP2 ? state.P2 : state.resultP2, t('energiaBernoulliCalc.labels.P2'))}

      {renderInput('z₂', state.z2, (text) => setState((prev) => ({ ...prev, z2: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditz2: val })), 
        'z2', state.isManualEditz2 ? state.z2 : state.resultZ2, t('energiaBernoulliCalc.labels.z2'))}

      {renderInput('V₂', state.V2, (text) => setState((prev) => ({ ...prev, V2: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditV2: val })), 
        'V2', state.isManualEditV2 ? state.V2 : state.resultV2, t('energiaBernoulliCalc.labels.V2'))}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>
      {renderInput('γ', state.gamma, (text) => setState((prev) => ({ ...prev, gamma: text })), () => {}, 'gamma', undefined, t('energiaBernoulliCalc.labels.gamma'))}
      {renderInput('g', state.g, (text) => setState((prev) => ({ ...prev, g: text })), () => {}, 'g', undefined, t('energiaBernoulliCalc.labels.g'))}
      
      <View style={styles.inputWrapper}>
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.labels.alpha1')}
          </Text>
          {(() => {
            const hasUserValue = state.alpha1?.trim()?.length > 0;
            const isInvalid = state.invalidFields.includes('alpha1');
            const isAuto = state.autoCalculatedField === 'alpha1' && !state.isManualEditAlpha1;

            let dotColor = 'rgb(200,200,200)';
            if (isInvalid) dotColor = 'rgb(254, 12, 12)';
            else if (isAuto) dotColor = 'rgba(62, 136, 255, 1)';
            else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';

            return <View style={[styles.valueDot, { backgroundColor: dotColor }]} />;
          })()}
        </View>
        <TextInput
          style={[
            styles.simpleInput, 
            { 
              color: themeColors.text, 
              fontSize: 16 * fontSizeFactor, 
              backgroundColor: state.lockedField === 'alpha1' ? themeColors.blockInput : themeColors.card 
            }
          ]}
          keyboardType="numeric"
          value={state.alpha1}
          onChangeText={(text) => {
            setState((prev) => ({ 
              ...prev, 
              alpha1: text,
              isManualEditAlpha1: true,
              invalidFields: prev.invalidFields.filter((f) => f !== 'alpha1'),
              autoCalculatedField: prev.autoCalculatedField === 'alpha1' ? null : prev.autoCalculatedField,
            }));
          }}
          editable={state.lockedField !== 'alpha1'}
          selectTextOnFocus={state.lockedField !== 'alpha1'}
          placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
        />
      </View>
      
      <View style={styles.inputWrapper}>
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.labels.alpha2')}
          </Text>
          {(() => {
            const hasUserValue = state.alpha2?.trim()?.length > 0;
            const isInvalid = state.invalidFields.includes('alpha2');
            const isAuto = state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2 && !!state.resultAlpha2;

            let dotColor = 'rgb(200,200,200)';
            if (isInvalid) dotColor = 'rgb(254, 12, 12)';
            else if (isAuto) dotColor = 'rgba(62, 136, 255, 1)';
            else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';

            return <View style={[styles.valueDot, { backgroundColor: dotColor }]} />;
          })()}
        </View>
        <TextInput
          style={[
            styles.simpleInput, 
            { 
              color: themeColors.text, 
              fontSize: 16 * fontSizeFactor, 
              backgroundColor: state.lockedField === 'alpha2' ? themeColors.blockInput : themeColors.card 
            }
          ]}
          keyboardType="numeric"
          value={state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2 ? state.resultAlpha2 || state.alpha2 : state.alpha2}
          onChangeText={(text) => {
            setState((prev) => ({ 
              ...prev, 
              alpha2: text,
              isManualEditAlpha2: true,
              invalidFields: prev.invalidFields.filter((f) => f !== 'alpha2'),
              autoCalculatedField: prev.autoCalculatedField === 'alpha2' ? null : prev.autoCalculatedField,
            }));
          }}
          editable={state.lockedField !== 'alpha2'}
          selectTextOnFocus={state.lockedField !== 'alpha2'}
          placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
        />
      </View>
    </>
  ), [renderInput, state.P1, state.P2, state.z1, state.z2, state.V1, state.V2, state.gamma, state.g, state.alpha1, state.alpha2, state.isManualEditP1, state.isManualEditP2, state.isManualEditz1, state.isManualEditz2, state.isManualEditV1, state.isManualEditV2, state.resultP1, state.resultP2, state.resultZ1, state.resultZ2, themeColors, t, fontSizeFactor, currentTheme]);

  const renderLossesInputs = useCallback(() => (
    <>
      {renderIdealInputs()}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.pumpTurbine')}
      </Text>
      {renderInput('hB', state.hb, (text) => setState((prev) => ({ ...prev, hb: text })), (val) => setState((prev) => ({ ...prev, isManualEditHb: val })), 'hb', state.isManualEditHb ? state.hb : undefined, t('energiaBernoulliCalc.labels.hb'))}
      {renderInput('hT', state.ht, (text) => setState((prev) => ({ ...prev, ht: text })), (val) => setState((prev) => ({ ...prev, isManualEditHt: val })), 'ht', state.isManualEditHt ? state.ht : undefined, t('energiaBernoulliCalc.labels.ht'))}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.losses')}
      </Text>
      
      {renderLossTypeSelector()}
      
      {state.lossInputType === 'direct' ? (
        renderInput('hL', state.hL, (text) => setState((prev) => ({ ...prev, hL: text })), (val) => setState((prev) => ({ ...prev, isManualEditHL: val })), 'hL', state.isManualEditHL ? state.hL : undefined, t('energiaBernoulliCalc.labels.hL'))
      ) : (
        <>
          {renderInput('L', state.L, (text) => setState((prev) => ({ ...prev, L: text })), () => {}, 'L', undefined, t('energiaBernoulliCalc.labels.L'))}
          {renderInput('D₁', state.D1, (text) => setState((prev) => ({ ...prev, D1: text })), () => {}, 'D1', undefined, t('energiaBernoulliCalc.labels.D1'))}
          <View style={styles.inputWrapper}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('energiaBernoulliCalc.labels.f')}
              </Text>
              <View style={[styles.valueDot, { backgroundColor: state.f ? 'rgb(194, 254, 12)' : 'rgb(200,200,200)' }]} />
            </View>
            <TextInput
              style={[styles.simpleInput, { color: themeColors.text, fontSize: 16 * fontSizeFactor, backgroundColor: themeColors.card }]}
              keyboardType="numeric"
              value={state.f}
              onChangeText={(text) => setState((prev) => ({ ...prev, f: text }))}
              placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </View>
          <View style={styles.inputWrapper}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('energiaBernoulliCalc.labels.K')}
              </Text>
              <View style={[styles.valueDot, { backgroundColor: state.K ? 'rgb(194, 254, 12)' : 'rgb(200,200,200)' }]} />
            </View>
            <TextInput
              style={[styles.simpleInput, { color: themeColors.text, fontSize: 16 * fontSizeFactor, backgroundColor: themeColors.card }]}
              keyboardType="numeric"
              value={state.K}
              onChangeText={(text) => setState((prev) => ({ ...prev, K: text }))}
              placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </View>
        </>
      )}
    </>
  ), [renderIdealInputs, renderInput, renderLossTypeSelector, state.hb, state.ht, state.hL, state.L, state.D1, state.f, state.K, state.isManualEditHb, state.isManualEditHt, state.isManualEditHL, state.lossInputType, themeColors, t, fontSizeFactor, currentTheme]);

  const renderCavitationInputs = useCallback(() => (
    <>
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.suctionSection')}
      </Text>
      {renderInput('P₁', state.P1, (text) => setState((prev) => ({ ...prev, P1: text })), (val) => setState((prev) => ({ ...prev, isManualEditP1: val })), 'P1', state.isManualEditP1 ? state.P1 : state.resultP1, t('energiaBernoulliCalc.labels.P1_suction'))}
      {renderInput('z₁', state.z1, (text) => setState((prev) => ({ ...prev, z1: text })), (val) => setState((prev) => ({ ...prev, isManualEditz1: val })), 'z1', state.isManualEditz1 ? state.z1 : state.resultZ1, t('energiaBernoulliCalc.labels.z_suction'))}
      {renderInput('V₁', state.V1, (text) => setState((prev) => ({ ...prev, V1: text })), (val) => setState((prev) => ({ ...prev, isManualEditV1: val })), 'V1', state.isManualEditV1 ? state.V1 : state.resultZ1, t('energiaBernoulliCalc.labels.V_suction'))}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>
      {renderInput('γ', state.gamma, (text) => setState((prev) => ({ ...prev, gamma: text })), () => {}, 'gamma', undefined, t('energiaBernoulliCalc.labels.gamma'))}
      {renderInput('g', state.g, (text) => setState((prev) => ({ ...prev, g: text })), () => {}, 'g', undefined, t('energiaBernoulliCalc.labels.g'))}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.cavitationParams')}
      </Text>
      
      {renderInput('T', state.temperatura, (text) => setState((prev) => ({ ...prev, temperatura: text })), () => {}, 'temperatura', undefined, t('energiaBernoulliCalc.labels.temperatura'))}
      {renderInput('Pv', state.Pv, (text) => setState((prev) => ({ ...prev, Pv: text })), () => {}, 'Pv', undefined, t('energiaBernoulliCalc.labels.Pv'))}
      
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.losses')}
      </Text>
      
      {renderInput('hL', state.hL, (text) => setState((prev) => ({ ...prev, hL: text })), (val) => setState((prev) => ({ ...prev, isManualEditHL: val })), 'hL', state.isManualEditHL ? state.hL : undefined, t('energiaBernoulliCalc.labels.hL_suction'))}
    </>
  ), [renderInput, state.P1, state.z1, state.V1, state.gamma, state.g, state.temperatura, state.Pv, state.hL, state.isManualEditP1, state.isManualEditz1, state.isManualEditV1, state.isManualEditHL, state.resultP1, state.resultZ1, themeColors, t, fontSizeFactor]);

  // onLayout handlers
  const onLayoutIdeal = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, ideal: x }));
    setButtonMetrics((prev) => ({ ...prev, ideal: width }));
  }, []);
  
  const onLayoutLosses = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, losses: x }));
    setButtonMetrics((prev) => ({ ...prev, losses: width }));
  }, []);
  
  const onLayoutCavitation = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, cavitation: x }));
    setButtonMetrics((prev) => ({ ...prev, cavitation: width }));
  }, []);

  const getMainResultLabel = useCallback(() => {
    // Si hay una variable incógnita calculada en modo ideal
    if (state.mode === 'ideal' && state.unknownVariable) {
      const unit = state.unknownVariable.unit ? ` (${state.unknownVariable.unit})` : '';
      return `${state.unknownVariable.label} ${unit}`;
    }

    // Para otros modos, mantener el comportamiento original
    switch (state.mode) {
      case 'losses':
        return t('energiaBernoulliCalc.energyDifference');
      case 'cavitation':
        return t('energiaBernoulliCalc.cavitationMargin');
      default:
        return t('energiaBernoulliCalc.result');
    }
  }, [state.mode, state.unknownVariable, t]);

  // Añadir función para verificar si mostrar placeholder en el label
  const shouldShowPlaceholderLabel = useCallback(() => {
    if (state.mode === 'ideal') {
      return !state.unknownVariable;
    }
    // Para otros modos, mostrar placeholder si no hay resultado
    return state.resultTotalEnergy === 0 && 
           !state.resultCavitationMargin;
  }, [state.mode, state.unknownVariable, state.resultTotalEnergy, state.resultCavitationMargin]);

  // El valor numérico siempre mostrará 0 cuando no haya resultado
  const getMainResultValue = useCallback(() => {
    // Si hay una variable incógnita calculada en modo ideal
    if (state.mode === 'ideal' && state.unknownVariable) {
      return state.unknownVariable.value || '0';
    }

    // Para otros modos, mantener el comportamiento original
    switch (state.mode) {
      case 'cavitation':
        return state.resultCavitationMargin || '0';
      default:
        return formatResult(state.resultTotalEnergy) || '0';
    }
  }, [state.mode, state.unknownVariable, state.resultCavitationMargin, state.resultTotalEnergy, formatResult]);

  // Añadir función para verificar si mostrar placeholder "--/"
  const shouldShowPlaceholder = useCallback(() => {
    if (state.mode === 'ideal') {
      return !state.unknownVariable;
    }
    // Para otros modos, mostrar placeholder si no hay resultado
    return state.resultTotalEnergy === 0 && 
           !state.resultCavitationMargin;
  }, [state.mode, state.unknownVariable, state.resultTotalEnergy, state.resultCavitationMargin]);

  return (
    <View style={styles.safeArea}>
      <KeyboardAwareScrollView
        bottomOffset={50}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
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
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => { 
                  bounceHeart(); 
                  toggleFavorite(); 
                }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <IconFavorite
                    name={isFav ? "heart" : "heart-o"}
                    size={20}
                    color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                  />
                </Animated.View>
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('EnergiaBernoulliTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('energiaBernoulliCalc.calculator')}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('energiaBernoulliCalc.title')}</Text>
        </View>

        {/* Resultados */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>
                  {t('energiaBernoulliCalc.saveToHistory')}
                </Text>
                <Icon name="plus" size={16 * fontSizeFactor} color="rgba(255, 255, 255, 0.4)" style={styles.plusIcon} />
              </View>
              <View style={styles.imageContainer}>
                <View style={styles.flowContainer}>
                  <FastImage
                    source={backgroundImage}
                    style={StyleSheet.absoluteFillObject}
                  />
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
                      {shouldShowPlaceholderLabel() ? 'な' : getMainResultLabel()}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                      ]}
                    >
                      {adjustDecimalSeparator(formatNumber(parseFloat(getMainResultValue())))}
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
            { icon: 'terminal', label: t('common.calculate'), action: handleCalculate },
            { icon: 'copy', label: t('common.copy'), action: handleCopy },
            { icon: 'trash', label: t('common.clear'), action: handleClear },
            { icon: 'clock', label: t('common.history'), action: () => navigation.navigate('HistoryScreenEnergiaBernoulli') },
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
            { 
              backgroundColor: themeColors.card,
            }
          ]}
        >
          <View style={styles.buttonContainer}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  experimental_backgroundImage: themeColors.gradient,
                  width: state.mode === 'ideal' ? buttonMetrics.ideal : state.mode === 'losses' ? buttonMetrics.losses : buttonMetrics.cavitation,
                  transform: [{ translateX: animatedValue }, { scale: animatedScale }],
                },
              ]}
            >
              <View style={[styles.overlayInner, { backgroundColor: themeColors.card }]}></View>
            </Animated.View>

            <Pressable
              onLayout={onLayoutIdeal}
              style={[styles.button, state.mode === 'ideal' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({ 
                ...prev, 
                mode: 'ideal',
                unknownVariable: null, // Limpiar al cambiar a modo ideal
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.ideal')}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutLosses}
              style={[styles.button, state.mode === 'losses' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({ 
                ...prev, 
                mode: 'losses',
                unknownVariable: null, // Limpiar al cambiar a modo losses
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.losses')}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutCavitation}
              style={[styles.button, state.mode === 'cavitation' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({ 
                ...prev, 
                mode: 'cavitation',
                unknownVariable: null, // Limpiar al cambiar a modo cavitation
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.cavitation')}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.separator2, { backgroundColor: themeColors.separator }]} />
          <View style={styles.inputsContainer}>
            {state.mode === 'ideal' && renderIdealInputs()}
            {state.mode === 'losses' && renderLossesInputs()}
            {state.mode === 'cavitation' && renderCavitationInputs()}
          </View>
        </View>
      </KeyboardAwareScrollView>
      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 1)' 
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
  },
  valueDot: {
    width: 6,
    height: 6,
    borderRadius: 5,
    backgroundColor: 'rgb(194, 254, 12)',
    marginLeft: 0,
    marginBottom: 1,
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
  iconWrapper2: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    width: 40, 
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
    paddingHorizontal: 20 
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
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 70,
  },
  buttonContainer: { 
    flexDirection: 'row', 
    width: '100%', 
    justifyContent: 'space-between', 
    position: 'relative', 
    height: 50, 
    marginBottom: 16 
  },
  button: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 15, 
    borderRadius: 25, 
    marginHorizontal: 5, 
    height: 50, 
    zIndex: 2 
  },
  selectedButton: { 
    backgroundColor: 'transparent' 
  },
  unselectedButton: { 
    backgroundColor: 'transparent' 
  },
  buttonText: { 
    color: 'rgb(0,0,0)', 
    fontSize: 16, 
    fontFamily: 'SFUIDisplay-Medium', 
    zIndex: 1 
  },
  overlay: { 
    position: 'absolute', 
    height: 50, 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)', 
    borderRadius: 25, 
    zIndex: 0, 
    padding: 1 
  },
  overlayInner: { 
    flex: 1, 
    backgroundColor: 'white', 
    borderRadius: 25 
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
  simpleInput: {
    height: 50,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  pickerPressable: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)', 
    height: 50, 
    overflow: 'hidden', 
    borderRadius: 25, 
    padding: 1 
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
  separator2: { 
    height: 1, 
    backgroundColor: 'rgb(235, 235, 235)', 
    marginBottom: 10 
  },
  text: { 
    fontFamily: 'SFUIDisplay-Medium', 
    fontSize: 16, 
    color: 'rgba(0, 0, 0, 1)', 
    marginTop: 2.75 
  },
  textOptions: { 
    fontFamily: 'SFUIDisplay-Regular', 
    fontSize: 16, 
    color: 'rgba(0, 0, 0, 1)', 
    marginTop: 2.75 
  },
  icon: { 
    marginLeft: 'auto' 
  },
  lossButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    position: 'relative',
    height: 50,
    marginTop: 5,
  },
  lossButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    marginHorizontal: 5,
    height: 50,
    zIndex: 2,
  },
  selectedLossButton: {
    backgroundColor: 'transparent',
  },
  unselectedLossButton: {
    backgroundColor: 'transparent',
  },
  lossButtonText: {
    color: 'rgb(0,0,0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    zIndex: 1,
  },
  lossOverlay: {
    position: 'absolute',
    height: 50,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    zIndex: 0,
    padding: 1,
  },
  lossOverlayInner: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 25,
  },
});

export default EnergiaBernoulliCalc;