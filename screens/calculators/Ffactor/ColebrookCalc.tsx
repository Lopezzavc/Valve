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

import { getDBConnection, createTable, saveCalculation } from '../../../src/services/database';
import { createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';

import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { Keyboard, LayoutAnimation } from 'react-native';

// Tipos de navegación
type RootStackParamList = {
  OptionsScreenColebrook: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenColebrook: undefined;
  ColebrookTheory: undefined;
};

// Imagen de fondo para el contenedor de resultados
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// Tipos para los modos de cálculo
type CalculatorMode = 'Simple' | 'Avanzado';
type PipeMaterial = 'Personalizado' | 'Acero comercial' | 'Hierro fundido' | 'Concreto' | 'PVC' | 'Cobre' | 'Acero galvanizado';

// Estado de la calculadora
interface CalculatorState {
  mode: CalculatorMode;
  material: PipeMaterial;
  
  // Características tubería
  roughness: string;
  diameter: string;
  relativeRoughness: string;
  roughnessUnit: string;
  diameterUnit: string;
  prevRoughnessUnit: string;
  prevDiameterUnit: string;
  
  // Características fluido - Simple
  reynolds: string;
  
  // Características fluido - Avanzado
  density: string;
  velocity: string;
  dynamicViscosity: string;
  densityUnit: string;
  velocityUnit: string;
  dynamicViscosityUnit: string;
  prevDensityUnit: string;
  prevVelocityUnit: string;
  prevDynamicViscosityUnit: string;
  
  // Resultados
  resultRoughness: string;
  resultDiameter: string;
  resultRelativeRoughness: string;
  resultReynolds: number;
  resultFrictionFactor: number;
  
  // Campo bloqueado para rugosidad relativa
  lockedRoughnessField: string | null;
}

// Factores de conversión
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    'm': 1,
    'mm': 0.001,
    'cm': 0.01,
    'km': 1000,
    'in': 0.0254,                  // exacto
    'ft': 0.3048,                  // exacto
    'yd': 0.9144,                  // exacto
    'mi': 1609.344,                // exacto (mile internacional)
  },
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,                 // exacto
    'lb/ft³': 16.018463373960139579655, // exacto por definición
    'g/L': 1,                      // exacto
    'kg/L': 1000,                  // exacto
  },
  velocity: {
    'm/s': 1,
    'km/h': 0.27777777777777777777778,   // = 1000/3600
    'ft/s': 0.3048,                              // exacto
    'mph': 0.44704,                              // = 1609.344/3600 exacto
    'kn': 0.5144444444444444444444444,     // = 1852/3600
    'cm/s': 0.01,                                // exacto
    'in/s': 0.0254,                              // exacto
  },
  dynamicViscosity: {
    'Pa·s': 1,
    'cP': 0.001,                                 // exacto (1 cP = 1 mPa·s)
    'P': 0.1,                                    // exacto
    'kg/(m·s)': 1,                               // exacto
    'lb/(ft·s)': 1.488163943569553805774, // = 0.45359237/0.3048
  },
};

// Valores de rugosidad absoluta por material (en metros)
const materialRoughness: { [key in PipeMaterial]: number } = {
  'Personalizado': 0,
  'Acero comercial': 0.000045,
  'Hierro fundido': 0.00026,
  'Concreto': 0.0003,
  'PVC': 0.0000015,
  'Cobre': 0.0000015,
  'Acero galvanizado': 0.00015,
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
  mode: 'Simple',
  material: 'Personalizado',
  
  // Características tubería
  roughness: '',
  diameter: '',
  relativeRoughness: '',
  roughnessUnit: 'm',
  diameterUnit: 'm',
  prevRoughnessUnit: 'm',
  prevDiameterUnit: 'm',
  
  // Características fluido - Simple
  reynolds: '',
  
  // Características fluido - Avanzado
  density: '',
  velocity: '',
  dynamicViscosity: '',
  densityUnit: 'kg/m³',
  velocityUnit: 'm/s',
  dynamicViscosityUnit: 'Pa·s',
  prevDensityUnit: 'kg/m³',
  prevVelocityUnit: 'm/s',
  prevDynamicViscosityUnit: 'Pa·s',
  
  // Resultados
  resultRoughness: '',
  resultDiameter: '',
  resultRelativeRoughness: '',
  resultReynolds: 0,
  resultFrictionFactor: 0,
  
  // Campo bloqueado
  lockedRoughnessField: null,
});

// Componente principal
const ColebrookCalc: React.FC = () => {
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
      };
    }
    return {
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    };
  }, [currentTheme]);

  // Estado
  const [state, setState] = useState<CalculatorState>(initialState);

  // Animaciones
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;

  // Posición y tamaño de botones
  const [buttonMetrics, setButtonMetrics] = useState<{ Simple: number; Avanzado: number }>({ Simple: 0, Avanzado: 0 });
  const [buttonPositions, setButtonPositions] = useState<{ Simple: number; Avanzado: number }>({ Simple: 0, Avanzado: 0 });

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
        const fav = await isFavorite(db, 'ColebrookCalc');
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
    
      const route = 'ColebrookCalc';
      const label = t('colebrookCalc.title') || 'Calculadora de Colebrook';
    
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

  // Animación selector
  useEffect(() => {
    if (buttonMetrics.Simple > 0 && buttonMetrics.Avanzado > 0) {
      const targetX = state.mode === 'Simple' ? buttonPositions.Simple : buttonPositions.Avanzado;
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

  // Efectos para actualizar campos bloqueados y cálculos
  useEffect(() => {
    updateLockedRoughnessField();
  }, [state.roughness, state.diameter, state.relativeRoughness]);

  useEffect(() => {
    if (state.mode === 'Avanzado') {
      calculateReynolds();
    }
  }, [state.density, state.velocity, state.dynamicViscosity, state.diameter, state.mode]);

  useEffect(() => {
    // Actualizar rugosidad cuando cambia el material
    if (state.material !== 'Personalizado') {
      const materialRoughnessValue = materialRoughness[state.material];
      const convertedValue = materialRoughnessValue / conversionFactors.length[state.roughnessUnit];
      setState((prev) => ({ ...prev, roughness: formatResult(convertedValue) }));
    }
  }, [state.material, state.roughnessUnit]);

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
    category: 'length' | 'density' | 'velocity' | 'dynamicViscosity'
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

  const updateLockedRoughnessField = useCallback(() => {
    const inputs = [
      { id: 'roughness', value: state.roughness },
      { id: 'diameter', value: state.diameter },
      { id: 'relativeRoughness', value: state.relativeRoughness },
    ];
    const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
    if (validInputs.length === 2) {
      const emptyInput = inputs.find(({ value }) => value === '' || isNaN(parseFloat(value.replace(',', '.'))));
      setState((prev) => ({ ...prev, lockedRoughnessField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedRoughnessField: null }));
    }
  }, [state.roughness, state.diameter, state.relativeRoughness]);

  const calculateReynolds = useCallback(() => {
    const rho = state.density ? parseFloat(state.density.replace(',', '.')) * conversionFactors.density[state.densityUnit] : NaN;
    const v = state.velocity ? parseFloat(state.velocity.replace(',', '.')) * conversionFactors.velocity[state.velocityUnit] : NaN;
    const mu = state.dynamicViscosity ? parseFloat(state.dynamicViscosity.replace(',', '.')) * conversionFactors.dynamicViscosity[state.dynamicViscosityUnit] : NaN;
    const d = state.diameter ? parseFloat(state.diameter.replace(',', '.')) * conversionFactors.length[state.diameterUnit] : NaN;

    if (!isNaN(rho) && !isNaN(v) && !isNaN(mu) && !isNaN(d) && mu !== 0) {
      const re = (rho * v * d) / mu;
      setState((prev) => ({ ...prev, resultReynolds: re }));
    } else {
      setState((prev) => ({ ...prev, resultReynolds: 0 }));
    }
  }, [state.density, state.velocity, state.dynamicViscosity, state.diameter, state.densityUnit, state.velocityUnit, state.dynamicViscosityUnit, state.diameterUnit]);

  // Método de Newton-Raphson para resolver la ecuación de Colebrook-White
  const newtonRaphsonColebrook = useCallback((re: number, relativeRoughness: number): number => {
    if (re <= 0 || relativeRoughness < 0) return NaN;
    
    // Estimación inicial usando la aproximación de Swamee-Jain
    let f = 0.25 / Math.pow(Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(re, 0.9)), 2);
    
    const maxIterations = 100;
    const tolerance = 1e-20;
    
    for (let i = 0; i < maxIterations; i++) {
      if (f <= 0) {
        f = 0.02; // Valor de recuperación
        continue;
      }
      
      const sqrtF = Math.sqrt(f);
      const term1 = relativeRoughness / 3.7;
      const term2 = 2.51 / (re * sqrtF);
      const logTerm = Math.log10(term1 + term2);
      
      // Función f(x) = 1/sqrt(f) + 2*log10(ε/D/3.7 + 2.51/(Re*sqrt(f)))
      const fx = 1 / sqrtF + 2 * logTerm;
      
      // Derivada f'(x)
      const dfx = -0.5 / (f * sqrtF) + 2 * (-2.51 / (re * f * sqrtF * Math.LN10 * (term1 + term2)));
      
      if (Math.abs(dfx) < tolerance) break;
      
      const newF = f - fx / dfx;
      
      if (Math.abs(newF - f) < tolerance) {
        f = newF;
        break;
      }
      
      f = Math.max(newF, 0.001); // Evitar valores negativos o muy pequeños
    }
    
    return f;
  }, []);

  const calculateColebrook = useCallback(() => {
    // Convertir valores a unidades SI y calcular rugosidad relativa si es necesario
    const roughnessSI = state.roughness ? parseFloat(state.roughness.replace(',', '.')) * conversionFactors.length[state.roughnessUnit] : NaN;
    const diameterSI = state.diameter ? parseFloat(state.diameter.replace(',', '.')) * conversionFactors.length[state.diameterUnit] : NaN;
    let relativeRoughnessValue = state.relativeRoughness ? parseFloat(state.relativeRoughness.replace(',', '.')) : NaN;

    // Manejar cálculo de parámetros faltantes de rugosidad
    const rugosidadInputs = [roughnessSI, diameterSI, relativeRoughnessValue];
    const validRugosidadCount = rugosidadInputs.filter(v => !isNaN(v)).length;

    if (validRugosidadCount === 2) {
      if (isNaN(roughnessSI) && !isNaN(diameterSI) && !isNaN(relativeRoughnessValue)) {
        const calculatedRoughness = relativeRoughnessValue * diameterSI;
        const resultInTargetUnit = calculatedRoughness / conversionFactors.length[state.roughnessUnit];
        setState((prev) => ({ ...prev, resultRoughness: formatResult(resultInTargetUnit) }));
      } else if (isNaN(diameterSI) && !isNaN(roughnessSI) && !isNaN(relativeRoughnessValue)) {
        if (relativeRoughnessValue !== 0) {
          const calculatedDiameter = roughnessSI / relativeRoughnessValue;
          const resultInTargetUnit = calculatedDiameter / conversionFactors.length[state.diameterUnit];
          setState((prev) => ({ ...prev, resultDiameter: formatResult(resultInTargetUnit) }));
        }
      } else if (isNaN(relativeRoughnessValue) && !isNaN(roughnessSI) && !isNaN(diameterSI)) {
        if (diameterSI !== 0) {
          const calculatedRelativeRoughness = roughnessSI / diameterSI;
          setState((prev) => ({ ...prev, resultRelativeRoughness: formatResult(calculatedRelativeRoughness) }));
          relativeRoughnessValue = calculatedRelativeRoughness;
        }
      }
    }

    // Determinar el número de Reynolds
    let reynolds = 0;
    if (state.mode === 'Simple') {
      reynolds = state.reynolds ? parseFloat(state.reynolds.replace(',', '.')) : 0;
    } else {
      reynolds = state.resultReynolds;
    }

    // Validar entrada para Colebrook
    if (reynolds <= 0) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.reynoldsRequired') || 'Número de Reynolds requerido' });
      setState((prev) => ({ ...prev, resultFrictionFactor: 0 }));
      return;
    }

    // Usar rugosidad relativa calculada o ingresada
    let finalRelativeRoughness = relativeRoughnessValue;
    if (isNaN(finalRelativeRoughness)) {
      if (!isNaN(roughnessSI) && !isNaN(diameterSI) && diameterSI !== 0) {
        finalRelativeRoughness = roughnessSI / diameterSI;
      } else {
        Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.roughnessRequired') || 'Datos de rugosidad requeridos' });
        setState((prev) => ({ ...prev, resultFrictionFactor: 0 }));
        return;
      }
    }

    // Calcular factor de fricción usando Newton-Raphson
    const frictionFactor = newtonRaphsonColebrook(reynolds, finalRelativeRoughness);

    if (isNaN(frictionFactor) || !isFinite(frictionFactor)) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.calculationError') || 'Error en el cálculo' });
      setState((prev) => ({ ...prev, resultFrictionFactor: 0 }));
    } else {
      setState((prev) => ({ ...prev, resultFrictionFactor: frictionFactor }));
    }
  }, [state, newtonRaphsonColebrook, formatResult, t]);

  const handleCalculate = useCallback(() => {
    calculateColebrook();
  }, [calculateColebrook]);

  const handleClear = useCallback(() => {
    setState(initialState);
  }, []);

  const handleCopy = useCallback(() => {
    const hasResults = state.resultFrictionFactor !== 0 || state.resultRoughness || state.resultDiameter || state.resultRelativeRoughness;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.noResultsToCopy') || 'No hay resultados para copiar' });
      return;
    }

    let textToCopy = `${t('colebrookCalc.title') || 'Calculadora de Colebrook'}\n\n`;
    
    // Factor de fricción
    if (state.resultFrictionFactor !== 0) {
      textToCopy += `${t('colebrookCalc.frictionFactor') || 'Factor de Fricción'}: ${formatResult(state.resultFrictionFactor)}\n\n`;
    }

    // Características de la tubería
    textToCopy += `${t('colebrookCalc.pipeCharacteristics') || 'Características de la Tubería'}:\n`;
    textToCopy += `  ${t('colebrookCalc.labels.material') || 'Material'}: ${state.material}\n`;
    
    const roughnessValue = state.resultRoughness || state.roughness;
    const diameterValue = state.resultDiameter || state.diameter;
    const relativeRoughnessValue = state.resultRelativeRoughness || state.relativeRoughness;
    
    if (roughnessValue) textToCopy += `  ${t('colebrookCalc.labels.roughness') || 'Rugosidad Absoluta'}: ${roughnessValue} ${state.roughnessUnit}\n`;
    if (diameterValue) textToCopy += `  ${t('colebrookCalc.labels.diameter') || 'Diámetro Interno'}: ${diameterValue} ${state.diameterUnit}\n`;
    if (relativeRoughnessValue) textToCopy += `  ${t('colebrookCalc.labels.relativeRoughness') || 'Rugosidad Relativa'}: ${relativeRoughnessValue}\n`;

    // Características del fluido
    textToCopy += `\n${t('colebrookCalc.fluidCharacteristics') || 'Características del Fluido'}:\n`;
    
    if (state.mode === 'Simple') {
      if (state.reynolds) textToCopy += `  ${t('colebrookCalc.labels.reynolds') || 'Número de Reynolds'}: ${state.reynolds}\n`;
    } else {
      if (state.density) textToCopy += `  ${t('colebrookCalc.labels.density') || 'Densidad'}: ${state.density} ${state.densityUnit}\n`;
      if (state.velocity) textToCopy += `  ${t('colebrookCalc.labels.velocity') || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
      if (state.dynamicViscosity) textToCopy += `  ${t('colebrookCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'}: ${state.dynamicViscosity} ${state.dynamicViscosityUnit}\n`;
      if (state.resultReynolds !== 0) textToCopy += `  ${t('colebrookCalc.labels.reynolds') || 'Número de Reynolds'}: ${formatResult(state.resultReynolds)}\n`;
    }

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('colebrookCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

  const handleSaveHistory = useCallback(async () => {
    const hasResults = state.resultFrictionFactor !== 0 || state.resultRoughness || state.resultDiameter || state.resultRelativeRoughness;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.nothingToSave') || 'No hay resultados para guardar' });
      return;
    }

    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }

      // Preparar datos de entrada
      const inputs = {
        mode: state.mode,
        material: state.material,
        roughness: state.resultRoughness || state.roughness || 'N/A',
        roughnessUnit: state.roughnessUnit,
        diameter: state.resultDiameter || state.diameter || 'N/A',
        diameterUnit: state.diameterUnit,
        relativeRoughness: state.resultRelativeRoughness || state.relativeRoughness || 'N/A',
        reynolds: state.mode === 'Simple' ? (state.reynolds || 'N/A') : (state.resultReynolds ? formatResult(state.resultReynolds) : 'N/A'),
        ...(state.mode === 'Avanzado' && {
          density: state.density || 'N/A',
          densityUnit: state.densityUnit,
          velocity: state.velocity || 'N/A',
          velocityUnit: state.velocityUnit,
          dynamicViscosity: state.dynamicViscosity || 'N/A',
          dynamicViscosityUnit: state.dynamicViscosityUnit,
        }),
      };

      const result = formatResult(state.resultFrictionFactor);

      await saveCalculation(db, 'colebrook', JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('colebrookCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('colebrookCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  // Navegar a selector de opciones/unidades
  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenColebrook', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Render de input numérico con etiqueta
  const renderInput = useCallback((
    label: string,
    value: string,
    onChange: (text: string) => void,
    setManualEdit?: (value: boolean) => void,
    fieldId?: string,
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean,
    showUnit: boolean = true
  ) => {
    const unitMap: { [key: string]: string } = {
      'Rugosidad Absoluta': state.roughnessUnit,
      'Diámetro Interno': state.diameterUnit,
      'Número de Reynolds': '',
      'Densidad': state.densityUnit,
      'Velocidad': state.velocityUnit,
      'Viscosidad Dinámica': state.dynamicViscosityUnit,
      'Rugosidad Relativa': '',
      'Reynolds Calculado': '',
    };
    const unit = unitMap[label] || '';
    const shownLabel = displayLabel || label;
    const isFieldLocked = isLocked || 
      (fieldId && state.lockedRoughnessField === fieldId);

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
                  setManualEdit && setManualEdit(true);
                }}
                editable={!isFieldLocked && label !== 'Reynolds Calculado'}
                selectTextOnFocus={!isFieldLocked && label !== 'Reynolds Calculado'}
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
          {showUnit && (
            <Pressable
              style={[
                styles.Container2,
                { experimental_backgroundImage: themeColors.gradient }
              ]}
              onPress={() => {
                let category = '';
                switch (label) {
                  case 'Rugosidad Absoluta':
                  case 'Diámetro Interno':
                    category = 'length';
                    break;
                  case 'Densidad':
                    category = 'density';
                    break;
                  case 'Velocidad':
                    category = 'velocity';
                    break;
                  case 'Viscosidad Dinámica':
                    category = 'dynamicViscosity';
                    break;
                  default:
                    return;
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
                    case 'Rugosidad Absoluta': updateUnit('roughness', 'prevRoughnessUnit', 'resultRoughness'); break;
                    case 'Diámetro Interno': updateUnit('diameter', 'prevDiameterUnit', 'resultDiameter'); break;
                    case 'Densidad': updateUnit('density', 'prevDensityUnit'); break;
                    case 'Velocidad': updateUnit('velocity', 'prevVelocityUnit'); break;
                    case 'Viscosidad Dinámica': updateUnit('dynamicViscosity', 'prevDynamicViscosityUnit'); break;
                  }
                }, unit);
              }}
            >
              <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.text, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{unit}</Text>
                <Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
              </View>
            </Pressable>
          )}
          {!showUnit && (
            <View style={[styles.Container2, { experimental_backgroundImage: themeColors.gradient }]}>
              <View style={[styles.innerWhiteContainer3, { backgroundColor: themeColors.card }]}>
                <Icon name="minus" size={20} color={themeColors.icon} style={styles.icon2} />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor]);

  // Selector de material
  const renderMaterialSelector = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('colebrookCalc.labels.material') || 'Material de la Tubería'}
      </Text>
      <Pressable
        style={[
          styles.pickerPressable,
          { experimental_backgroundImage: themeColors.gradient }
        ]}
        onPress={() => {
          navigateToOptions('pipeMaterial', (option: string) => {
            setState((prev) => ({ ...prev, material: option as PipeMaterial }));
          }, state.material);
        }}
      >
        <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {state.material}
          </Text>
          <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
        </View>
      </Pressable>
    </View>
  ), [navigateToOptions, state.material, themeColors, t, fontSizeFactor]);

  // onLayout handlers
  const onLayoutSimple = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, Simple: x }));
    setButtonMetrics((prev) => ({ ...prev, Simple: width }));
  }, []);

  const onLayoutAvanzado = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, Avanzado: x }));
    setButtonMetrics((prev) => ({ ...prev, Avanzado: width }));
  }, []);

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
            <Pressable style={styles.iconContainer} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable style={styles.iconContainer} onPress={toggleFavorite}>
                <IconFavorite
                  name={isFav ? "heart" : "heart-o"}
                  size={20}
                  color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                />
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={styles.iconContainer} onPress={() => navigation.navigate('ColebrookTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('colebrookCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('colebrookCalc.title') || 'Ecuación de Colebrook'}</Text>
        </View>

        {/* Resultados */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('colebrookCalc.saveToHistory') || 'Guardar en historial'}</Text>
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
                      {t('colebrookCalc.frictionFactor') || 'Factor Darcy'}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                      ]}
                    >
                      {adjustDecimalSeparator(formatNumber(state.resultFrictionFactor))}
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
            { icon: 'clock', label: t('common.history') || 'Historial', action: () => navigation.navigate('HistoryScreenColebrook') },
          ].map(({ icon, label, action }) => (
            <View style={styles.actionWrapper} key={label}>
              <View style={styles.actionButtonMain}>
                <Pressable style={styles.actionButton} onPress={action}>
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
            {/* Características de la tubería */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('colebrookCalc.pipeCharacteristics') || 'Características de la Tubería'}
            </Text>

            {renderMaterialSelector()}

            {renderInput(
              'Rugosidad Absoluta',
              state.roughness,
              (text) => {
                setState((prev) => ({ ...prev, roughness: text }));
                if (state.material !== 'Personalizado') {
                  setState((prev) => ({ ...prev, material: 'Personalizado' }));
                }
              },
              () => {},
              'roughness',
              state.resultRoughness,
              t('colebrookCalc.labels.roughness') || 'Rugosidad Absoluta (ε)'
            )}

            {renderInput(
              'Diámetro Interno',
              state.diameter,
              (text) => setState((prev) => ({ ...prev, diameter: text })),
              () => {},
              'diameter',
              state.resultDiameter,
              t('colebrookCalc.labels.diameter') || 'Diámetro Interno (D)'
            )}

            {renderInput(
              'Rugosidad Relativa',
              state.relativeRoughness,
              (text) => setState((prev) => ({ ...prev, relativeRoughness: text })),
              () => {},
              'relativeRoughness',
              state.resultRelativeRoughness,
              t('colebrookCalc.labels.relativeRoughness') || 'Rugosidad Relativa (ε/D)',
              false,
              false
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Características del fluido */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('colebrookCalc.fluidCharacteristics') || 'Características del Fluido'}
            </Text>

            {/* Selector de modo */}
            <View style={styles.buttonContainer}>
              <Animated.View
                style={[
                  styles.overlay,
                  {
                    experimental_backgroundImage: themeColors.gradient,
                    width: state.mode === 'Simple' ? buttonMetrics.Simple : buttonMetrics.Avanzado,
                    transform: [{ translateX: animatedValue }, { scale: animatedScale }],
                  },
                ]}
              >
                <View style={[styles.overlayInner, { backgroundColor: themeColors.card }]}></View>
              </Animated.View>

              <Pressable
                onLayout={onLayoutSimple}
                style={[styles.button, state.mode === 'Simple' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setState((prev) => ({ ...prev, mode: 'Simple' }))}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {t('colebrookCalc.mode.simple') || 'Simple'}
                </Text>
              </Pressable>

              <Pressable
                onLayout={onLayoutAvanzado}
                style={[styles.button, state.mode === 'Avanzado' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setState((prev) => ({ ...prev, mode: 'Avanzado' }))}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {t('colebrookCalc.mode.advanced') || 'Avanzado'}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.separator2, { backgroundColor: themeColors.separator }]} />

            {/* Inputs según el modo */}
            {state.mode === 'Simple' ? (
              <>
                {renderInput(
                  'Número de Reynolds',
                  state.reynolds,
                  (text) => setState((prev) => ({ ...prev, reynolds: text })),
                  () => {},
                  undefined,
                  undefined,
                  t('colebrookCalc.labels.reynolds') || 'Número de Reynolds (Re)',
                  false,
                  false
                )}
              </>
            ) : (
              <>
                {renderInput(
                  'Densidad',
                  state.density,
                  (text) => setState((prev) => ({ ...prev, density: text })),
                  () => {},
                  undefined,
                  undefined,
                  t('colebrookCalc.labels.density') || 'Densidad (ρ)'
                )}

                {renderInput(
                  'Velocidad',
                  state.velocity,
                  (text) => setState((prev) => ({ ...prev, velocity: text })),
                  () => {},
                  undefined,
                  undefined,
                  t('colebrookCalc.labels.velocity') || 'Velocidad (v)'
                )}

                {renderInput(
                  'Viscosidad Dinámica',
                  state.dynamicViscosity,
                  (text) => setState((prev) => ({ ...prev, dynamicViscosity: text })),
                  () => {},
                  undefined,
                  undefined,
                  t('colebrookCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica (μ)'
                )}

                {renderInput(
                  'Reynolds Calculado',
                  '',
                  () => {},
                  () => {},
                  undefined,
                  state.resultReynolds !== 0 ? formatResult(state.resultReynolds) : '',
                  t('colebrookCalc.labels.reynoldsCalculated') || 'Reynolds Calculado',
                  true,
                  false
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

// Estilos (idénticos a BernoulliCalc)
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
    width: 150, 
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
  innerWhiteContainer3: { 
    backgroundColor: 'white', 
    width: '100%', 
    height: '100%', 
    justifyContent: 'center', 
    borderRadius: 25, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingRight: 20, 
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
  resultText: {
    height: 50,
    backgroundColor: 'rgba(255, 143, 143, 0)',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    textAlignVertical: 'center',
    paddingTop: 15,
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
  icon2: { 
    
  },
});

export default ColebrookCalc;