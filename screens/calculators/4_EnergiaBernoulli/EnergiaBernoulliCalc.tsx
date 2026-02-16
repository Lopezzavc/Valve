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
import IconCheck from 'react-native-vector-icons/Octicons';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import { Keyboard, LayoutAnimation } from 'react-native';
import Decimal from 'decimal.js';

import { getDBConnection, createTable, saveCalculation } from '../../../src/services/database';
import { createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';

import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

// Configurar Decimal para máxima precisión
Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

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
  includeBomba: boolean;
  includeTurbina: boolean;
  
  // Variables para pérdidas
  lossInputType: 'direct' | 'darcy';
  hL: string;
  L: string;
  f: string;
  K: string;
  
  // *** NUEVO: Variables para cavitación ***
  cavitationSystemType: 'closed' | 'open';  // Selector: cerrado o abierto
  // Cerrado
  Ps: string;        // Presión en succión
  Vs: string;        // Velocidad en succión
  // Abierto
  Patm: string;      // Presión atmosférica
  z0: string;        // Elevación nivel líquido
  zs: string;        // Elevación en succión
  hfs: string;       // Pérdida en succión
  // Comunes a ambos
  temperatura: string;
  Pv: string;
  useRhoForGamma: boolean;  // Checkbox para usar ρ en lugar de γ
  useTempForPv: boolean;    // Checkbox para usar T en lugar de Pv directo
  
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
  // *** NUEVO: Unidades para cavitación ***
  PsUnit: string;
  VsUnit: string;
  PatmUnit: string;
  z0Unit: string;
  zsUnit: string;
  hfsUnit: string;
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
  // *** NUEVO: Unidades previas para cavitación ***
  prevPsUnit: string;
  prevVsUnit: string;
  prevPatmUnit: string;
  prevZ0Unit: string;
  prevZsUnit: string;
  prevHfsUnit: string;
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
  // *** NUEVO: Resultados de cavitación ***
  resultNPSHa: string;
  resultCavitationMargin: string;
  resultPabs: string;
  resultGamma: string;     // γ calculado desde ρ si aplica
  resultPv: string;        // Pv calculado desde T si aplica
  
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
  // *** NUEVO: Estados de edición para cavitación ***
  isManualEditPs: boolean;
  isManualEditVs: boolean;
  isManualEditPatm: boolean;
  isManualEditz0: boolean;
  isManualEditzs: boolean;
  isManualEdithfs: boolean;

  unknownVariable: {
    name: string;
    label: string;
    unit: string;
    value: string;
  } | null;
  
  lockedField: string | null;
  invalidFields: string[];
  autoCalculatedField: string | null;
}

// Factores de conversión - Versión de máxima precisión
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    'm': 1,
    'mm': 0.001,                    // Exacto por definición SI
    'cm': 0.01,                      // Exacto por definición SI
    'km': 1000,                       // Exacto por definición SI
    'in': 0.0254,                     // Exacto por definición (1959)
    'ft': 0.3048,                     // Exacto (0.3048 m exactamente)
    'yd': 0.9144,                     // Exacto (0.9144 m exactamente)
    'mi': 1609.344,                   // Exacto (1609.344 m exactamente)
  },
  velocity: {
    'm/s': 1,
    'km/h': 0.2777777777777778,       // 5/18 exacto
    'ft/s': 0.3048,                   // Exacto (mismo factor que ft)
    'mph': 0.44704,                   // Exacto (1609.344/3600)
    'kn': 0.5144444444444445,         // 1852/3600 exacto
    'cm/s': 0.01,                     // Exacto
    'in/s': 0.0254,                   // Exacto
  },
  area: {
    'm²': 1,
    'cm²': 0.0001,                    // Exacto (10^-4)
    'mm²': 0.000001,                  // Exacto (10^-6)
    'km²': 1000000,                   // Exacto (10^6)
    'ha': 10000,                      // Exacto (10^4)
    'in²': 0.00064516,                // Exacto (0.0254^2)
    'ft²': 0.09290304,                // Exacto (0.3048^2)
    'yd²': 0.83612736,                // Exacto (0.9144^2)
    'mi²': 2589988.110336,            // Exacto (1609.344^2)
    'acre': 4046.8564224,             // Exacto (1 acre = 4046.8564224 m²)
  },
  pressure: {
    'Pa': 1,
    'kPa': 1000,                      // Exacto
    'MPa': 1000000,                   // Exacto
    'bar': 100000,                    // Exacto (10^5 Pa)
    'atm': 101325,                    // Exacto (definición)
    'psi': 6894.757293178,            // Alta precisión (lb*f/in² exacto)
    'mmHg': 133.32236842105263,       // Alta precisión (101325/760)
    'mca': 9806.65,                   // Preciso con g=9.80665 m/s²
    'N/m³': 1,                        // Es presión, pero N/m³ = Pa/m? Esto parece incorrecto
  },
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,                    // Exacto (10^3)
    'lb/ft³': 16.018463373,           // Alta precisión (0.45359237/0.028316846592)
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,                  // Exacto
    'g': 9.80665,                     // g estándar exacto (definición)
  },
  temperature: {
    '°C': 1,      // NOTA: Estos factores son insuficientes para conversiones
    '°F': 1,      // Se necesita una función especial para temperatura
    'K': 1,       // ya que las conversiones son: °F = °C × 9/5 + 32, K = °C + 273.15
  },
  specificWeight: {
    'N/m³': 1,
    'kN/m³': 1000,                    // Exacto
    'lbf/ft³': 157.08746061538463,    // Alta precisión (lb*f/ft³ exacto)
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
  gamma: '9810',
  g: '9.81',
  alpha1: '1',
  alpha2: '1',
  hb: '',
  ht: '',
  includeBomba: true,
  includeTurbina: false,
  
  lossInputType: 'direct',
  hL: '',
  L: '',
  f: '',
  K: '',
  
  // *** NUEVO: Estado inicial para cavitación ***
  cavitationSystemType: 'closed',
  Ps: '',
  Vs: '',
  Patm: '101325',
  z0: '',
  zs: '',
  hfs: '',
  temperatura: '20',
  Pv: '2338',
  useRhoForGamma: false,
  useTempForPv: true,
  
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
  // *** NUEVO: Unidades iniciales para cavitación ***
  PsUnit: 'Pa',
  VsUnit: 'm/s',
  PatmUnit: 'Pa',
  z0Unit: 'm',
  zsUnit: 'm',
  hfsUnit: 'm',
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
  // *** NUEVO: Unidades previas para cavitación ***
  prevPsUnit: 'Pa',
  prevVsUnit: 'm/s',
  prevPatmUnit: 'Pa',
  prevZ0Unit: 'm',
  prevZsUnit: 'm',
  prevHfsUnit: 'm',
  prevTemperaturaUnit: '°C',
  prevPvUnit: 'Pa',
  
  resultTotalEnergy: 0,
  resultP1: '',
  resultV1: '',
  resultZ1: '',
  resultP2: '',
  resultV2: '',
  resultZ2: '',
  // *** NUEVO: Resultados iniciales para cavitación ***
  resultNPSHa: '',
  resultCavitationMargin: '',
  resultPabs: '',
  resultGamma: '',
  resultPv: '',
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
  // *** NUEVO: Estados de edición iniciales para cavitación ***
  isManualEditPs: false,
  isManualEditVs: false,
  isManualEditPatm: false,
  isManualEditz0: false,
  isManualEditzs: false,
  isManualEdithfs: false,

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
        checkboxMargin: 'rgb(255, 255, 255)'
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
      checkboxMargin: 'rgb(0, 0, 0)'
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

  const Checkbox = ({ 
    label, 
    value, 
    onValueChange,
    themeColors,
    fontSizeFactor
  }: { 
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    themeColors: any;
    fontSizeFactor: number;
  }) => (
    <Pressable 
      style={styles.checkboxContainer}
      onPress={() => onValueChange(!value)}
    >
      <View style={[
        styles.checkbox, 
        { 
          borderColor: value ? 'transparent' : themeColors.checkboxMargin,
          backgroundColor: value ? 'rgb(194,254,12)' : 'transparent',
        }
      ]}>
        {value && (
          <IconCheck name="dot-fill" size={14} color={currentTheme === 'dark' ? '#000' : '#000'} />
        )}
      </View>
      <Text style={[styles.checkboxLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {label}
      </Text>
    </Pressable>
  );

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
    
    // Usar Decimal para formateo preciso
    const decimalNum = new Decimal(num);
    
    // Formatear a 15 decimales (o la precisión que desees)
    // Nota: Esto es para mostrar, no para cálculos internos
    const fixed = decimalNum.toFixed(15);
    
    // Eliminar ceros innecesarios
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;

    // Convertir a Decimal
    const decimalValue = new Decimal(cleanValue);

    if (category === 'temperature') {
      // Conversiones de temperatura con Decimal
      if (fromUnit === '°C' && toUnit === '°F') {
        return formatResult(decimalValue.mul(9).div(5).plus(32).toNumber());
      } else if (fromUnit === '°C' && toUnit === 'K') {
        return formatResult(decimalValue.plus(273.15).toNumber());
      } else if (fromUnit === '°F' && toUnit === '°C') {
        return formatResult(decimalValue.minus(32).mul(5).div(9).toNumber());
      } else if (fromUnit === '°F' && toUnit === 'K') {
        return formatResult(decimalValue.minus(32).mul(5).div(9).plus(273.15).toNumber());
      } else if (fromUnit === 'K' && toUnit === '°C') {
        return formatResult(decimalValue.minus(273.15).toNumber());
      } else if (fromUnit === 'K' && toUnit === '°F') {
        return formatResult(decimalValue.minus(273.15).mul(9).div(5).plus(32).toNumber());
      }
      return value;
    }

    const fromFactor = conversionFactors[category]?.[fromUnit];
    const toFactor = conversionFactors[category]?.[toUnit];
    if (!fromFactor || !toFactor) return value;

    // Conversión con Decimal: (valor * fromFactor) / toFactor
    const convertedValue = decimalValue
      .mul(new Decimal(fromFactor))
      .div(new Decimal(toFactor))
      .toNumber();

    return formatResult(convertedValue);
  }, [formatResult]);

  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Cálculo de presión de vapor según temperatura (agua)
  const calculateVaporPressure = useCallback((temp: number, unit: string): number => {
    // Convertir a °C
    let tempC = temp;
    if (unit === '°F') {
      tempC = (temp - 32) * 5/9;
    } else if (unit === 'K') {
      tempC = temp - 273.15;
    }

    // Ecuación de Wagner (más precisa, válida 0-374°C)
    // Basada en IAPWS IF-97
    const Tc = 647.096;      // Temperatura crítica (K)
    const Pc = 22064000;     // Presión crítica (Pa)

    const Tr = (tempC + 273.15) / Tc;
    const tau = 1 - Tr;

    // Coeficientes de Wagner
    const a = [-7.85951783, 1.84408259, -11.7866497, 22.6807411, -15.9618719, 1.80122502];

    let lnPr = (a[0] * tau + a[1] * Math.pow(tau, 1.5) + a[2] * Math.pow(tau, 3) + 
                a[3] * Math.pow(tau, 3.5) + a[4] * Math.pow(tau, 4) + a[5] * Math.pow(tau, 7.5)) / Tr;

    return Pc * Math.exp(lnPr);
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

  const updateLockedFieldLosses = useCallback(() => {
    const baseFields = [
      { id: 'P1', value: state.P1 },
      { id: 'z1', value: state.z1 },
      { id: 'V1', value: state.V1 },
      { id: 'P2', value: state.P2 },
      { id: 'z2', value: state.z2 },
      { id: 'V2', value: state.V2 },
      { id: 'rho', value: state.rho },
      { id: 'g', value: state.g },
      { id: 'alpha1', value: state.alpha1 },
      { id: 'alpha2', value: state.alpha2 },
    ];
  
    const conditionalFields = [];
    if (state.includeBomba) {
      conditionalFields.push({ id: 'hb', value: state.hb });
    }
    if (state.includeTurbina) {
      conditionalFields.push({ id: 'ht', value: state.ht });
    }
  
    const lossFields = [];
    if (state.lossInputType === 'direct') {
      lossFields.push({ id: 'hL', value: state.hL });
    } else {
      lossFields.push(
        { id: 'L', value: state.L },
        { id: 'D1', value: state.D1 },
        { id: 'f', value: state.f },
        { id: 'K', value: state.K }
      );
    }
  
    const allPossibleFields = [...baseFields, ...conditionalFields, ...lossFields];
    const validInputs = allPossibleFields.filter(({ value }) => 
      value !== '' && !isNaN(parseFloat(value.replace(',', '.')))
    );
    const totalFields = allPossibleFields.length;
  
    if (validInputs.length === totalFields - 1) {
      const emptyInput = allPossibleFields.find(({ value }) => 
        value === '' || isNaN(parseFloat(value.replace(',', '.')))
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.z1, state.V1, state.P2, state.z2, state.V2, state.rho, state.g,
      state.alpha1, state.alpha2, state.includeBomba, state.includeTurbina, state.hb, state.ht,
      state.lossInputType, state.hL, state.L, state.D1, state.f, state.K]);

  const calculateIdealBernoulli = useCallback(() => {
    // Definir los 8 campos posibles (incluyendo alpha1 y alpha2)
    const allFields = [
      { id: 'P1', value: state.P1, unit: state.P1Unit, category: 'pressure', resultField: 'resultP1' },
      { id: 'V1', value: state.V1, unit: state.V1Unit, category: 'velocity', resultField: 'resultV1' },
      { id: 'z1', value: state.z1, unit: state.z1Unit, category: 'length', resultField: 'resultZ1' },
      { id: 'P2', value: state.P2, unit: state.P2Unit, category: 'pressure', resultField: 'resultP2' },
      { id: 'V2', value: state.V2, unit: state.V2Unit, category: 'velocity', resultField: 'resultV2' },
      { id: 'z2', value: state.z2, unit: state.z2Unit, category: 'length', resultField: 'resultZ2' },
      { id: 'alpha1', value: state.alpha1, unit: '', category: 'none', resultField: 'alpha1' },
      { id: 'alpha2', value: state.alpha2, unit: '', category: 'none', resultField: 'alpha2' },
    ];

    // Convertir cada campo a unidades SI usando Decimal
    const fieldsInSI = allFields.map(field => {
      if (field.id === 'alpha1' || field.id === 'alpha2') {
        const rawValue = field.value.replace(',', '.');
        if (rawValue === '' || isNaN(parseFloat(rawValue))) {
          return { ...field, siValue: null, isValid: false };
        }
        return { ...field, siValue: new Decimal(rawValue), isValid: true };
      }

      const rawValue = field.value.replace(',', '.');
      if (rawValue === '' || isNaN(parseFloat(rawValue))) {
        return { ...field, siValue: null, isValid: false };
      }

      const numValue = new Decimal(rawValue);
      const factor = conversionFactors[field.category]?.[field.unit] || 1;
      // Convertir a Decimal si factor es número
      const factorDecimal = new Decimal(factor);
      return { ...field, siValue: numValue.mul(factorDecimal), isValid: true };
    });

    // Contar campos válidos y encontrar los faltantes
    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);
    const validCount = validFields.length;

    // Obtener valores gamma y g en unidades SI usando Decimal
    let gammaDecimal = new Decimal(9810);
    if (state.gamma && !isNaN(parseFloat(state.gamma.replace(',', '.')))) {
      gammaDecimal = new Decimal(state.gamma.replace(',', '.'))
        .mul(new Decimal(conversionFactors.pressure[state.gammaUnit] || 1));
    }

    let gDecimal = new Decimal(9.81);
    if (state.g && !isNaN(parseFloat(state.g.replace(',', '.')))) {
      gDecimal = new Decimal(state.g.replace(',', '.'))
        .mul(new Decimal(conversionFactors.acceleration[state.gUnit] || 1));
    }

    // Caso 1: Más de un campo faltante → marcar inválido y no calcular
    if (validCount !== 7) {
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
        unknownVariable: null,
      }));
      return;
    }

    // Caso 2: Exactamente 7 campos válidos → encontrar el faltante y resolver
    const missingField = missingFields[0];

    // Crear mapa de valores SI (Decimal)
    const siValues: { [key: string]: Decimal } = {};
    validFields.forEach(f => { 
      siValues[f.id] = f.siValue as Decimal;
    });

    const newState: Partial<CalculatorState> = {};

    // Calcular energía total usando Decimal
    let E = new Decimal(0);
    const alpha1 = siValues['alpha1'] !== undefined ? siValues['alpha1'] : new Decimal(1);
    const alpha2 = siValues['alpha2'] !== undefined ? siValues['alpha2'] : new Decimal(1);

    if (siValues['P1'] !== undefined && siValues['V1'] !== undefined && siValues['z1'] !== undefined) {
      // E = P1/γ + α1·V1²/2g + z1
      E = siValues['P1'].div(gammaDecimal)
        .plus(alpha1.mul(siValues['V1'].pow(2)).div(new Decimal(2).mul(gDecimal)))
        .plus(siValues['z1']);
    } else if (siValues['P2'] !== undefined && siValues['V2'] !== undefined && siValues['z2'] !== undefined) {
      E = siValues['P2'].div(gammaDecimal)
        .plus(alpha2.mul(siValues['V2'].pow(2)).div(new Decimal(2).mul(gDecimal)))
        .plus(siValues['z2']);
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

        // headTerm = E - α1·V1²/2g - z1
        const headTerm = E
          .minus(alpha1.mul(siValues['V1'].pow(2)).div(new Decimal(2).mul(gDecimal)))
          .minus(siValues['z1']);

        // P1 = headTerm * γ
        const pressureSI = headTerm.mul(gammaDecimal);

        // Convertir a la unidad de salida
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P1Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
        newState.resultP1 = formattedResult;

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

        // headTerm = E - P1/γ - z1
        const headTerm = E
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);

        if (headTerm.greaterThanOrEqualTo(0)) {
          // V1 = √(2·g·headTerm / α1)
          const velocitySI = headTerm
            .mul(new Decimal(2).mul(gDecimal))
            .div(alpha1)
            .sqrt();

          const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V1Unit] || 1));
          const formattedResult = formatResult(result.toNumber());
          newState.resultV1 = formattedResult;

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

        // z1 = E - P1/γ - α1·V1²/2g
        const elevationSI = E
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(alpha1.mul(siValues['V1'].pow(2)).div(new Decimal(2).mul(gDecimal)));

        const result = elevationSI.div(new Decimal(conversionFactors.length[state.z1Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
        newState.resultZ1 = formattedResult;

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

        const headTerm = E
          .minus(alpha2.mul(siValues['V2'].pow(2)).div(new Decimal(2).mul(gDecimal)))
          .minus(siValues['z2']);

        const pressureSI = headTerm.mul(gammaDecimal);
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P2Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
        newState.resultP2 = formattedResult;

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

        const headTerm = E
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);

        if (headTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = headTerm
            .mul(new Decimal(2).mul(gDecimal))
            .div(alpha2)
            .sqrt();

          const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V2Unit] || 1));
          const formattedResult = formatResult(result.toNumber());
          newState.resultV2 = formattedResult;

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

        const elevationSI = E
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(alpha2.mul(siValues['V2'].pow(2)).div(new Decimal(2).mul(gDecimal)));

        const result = elevationSI.div(new Decimal(conversionFactors.length[state.z2Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
        newState.resultZ2 = formattedResult;

        newState.unknownVariable = {
          name: 'z₂',
          label: t('energiaBernoulliCalc.labels.z2'),
          unit: state.z2Unit,
          value: formattedResult
        };
        break;
      }

      case 'alpha1': {
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;

        // Si tenemos valores de la sección 2, recalcular E desde allí
        if (siValues['P2'] !== undefined && siValues['V2'] !== undefined && siValues['z2'] !== undefined) {
          E = siValues['P2'].div(gammaDecimal)
            .plus(alpha2.mul(siValues['V2'].pow(2)).div(new Decimal(2).mul(gDecimal)))
            .plus(siValues['z2']);
        }

        // energyTerm = E - P1/γ - z1
        const energyTerm = E
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);

        if (energyTerm.greaterThan(0) && !siValues['V1'].isZero()) {
          // α1 = (2g * energyTerm) / V1²
          const alpha1_calc = energyTerm
            .mul(new Decimal(2).mul(gDecimal))
            .div(siValues['V1'].pow(2));

          const formattedResult = formatResult(alpha1_calc.toNumber());
          newState.alpha1 = formattedResult;
          newState.isManualEditAlpha1 = false;
        
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

        // Si tenemos valores de la sección 1, recalcular E desde allí
        if (siValues['P1'] !== undefined && siValues['V1'] !== undefined && siValues['z1'] !== undefined) {
          E = siValues['P1'].div(gammaDecimal)
            .plus(alpha1.mul(siValues['V1'].pow(2)).div(new Decimal(2).mul(gDecimal)))
            .plus(siValues['z1']);
        }

        const energyTerm = E
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);

        if (energyTerm.greaterThan(0) && !siValues['V2'].isZero()) {
          const alpha2_calc = energyTerm
            .mul(new Decimal(2).mul(gDecimal))
            .div(siValues['V2'].pow(2));

          const formattedResult = formatResult(alpha2_calc.toNumber());
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

    // Si no se encontró una variable faltante
    if (!missingField) {
      newState.unknownVariable = null;
    }

    setState((prev) => ({
      ...prev,
      ...newState,
      invalidFields: [],
      autoCalculatedField: missingField,
      resultTotalEnergy: E.toNumber(),
      isManualEditP1: missingField === 'P1' ? false : prev.isManualEditP1,
      isManualEditV1: missingField === 'V1' ? false : prev.isManualEditV1,
      isManualEditz1: missingField === 'z1' ? false : prev.isManualEditz1,
      isManualEditP2: missingField === 'P2' ? false : prev.isManualEditP2,
      isManualEditV2: missingField === 'V2' ? false : prev.isManualEditV2,
      isManualEditz2: missingField === 'z2' ? false : prev.isManualEditz2,
      isManualEditAlpha1: missingField === 'alpha1' ? false : (prev.isManualEditAlpha1 || false),
      isManualEditAlpha2: missingField === 'alpha2' ? false : prev.isManualEditAlpha2,
    }));

  }, [state, formatResult, t]);

  useEffect(() => {
    if (state.mode === 'ideal') {
      updateLockedFieldIdeal();
    } else if (state.mode === 'losses') {
      updateLockedFieldLosses();
    }
    // Para el modo cavitation, podrías añadir una lógica similar más adelante.
  }, [state.mode, state.P1, state.V1, state.z1, state.P2, state.V2, state.z2, 
      state.alpha1, state.alpha2, state.gamma, state.g,
      state.includeBomba, state.includeTurbina, state.hb, state.ht,
      state.lossInputType, state.hL, state.L, state.D1, state.f, state.K,
      updateLockedFieldIdeal, updateLockedFieldLosses]); // No olvides añadir las nuevas dependencias

  const calculateWithLosses = useCallback(() => {
    // 1. Definir todos los campos posibles según el modo
    const allFields = [
      { id: 'P1', value: state.P1, unit: state.P1Unit, category: 'pressure', resultField: 'resultP1' },
      { id: 'z1', value: state.z1, unit: state.z1Unit, category: 'length', resultField: 'resultZ1' },
      { id: 'V1', value: state.V1, unit: state.V1Unit, category: 'velocity', resultField: 'resultV1' },
      { id: 'P2', value: state.P2, unit: state.P2Unit, category: 'pressure', resultField: 'resultP2' },
      { id: 'z2', value: state.z2, unit: state.z2Unit, category: 'length', resultField: 'resultZ2' },
      { id: 'V2', value: state.V2, unit: state.V2Unit, category: 'velocity', resultField: 'resultV2' },
      { id: 'rho', value: state.rho, unit: state.rhoUnit, category: 'density', resultField: null },
      { id: 'g', value: state.g, unit: state.gUnit, category: 'acceleration', resultField: null },
      { id: 'alpha1', value: state.alpha1, unit: '', category: 'none', resultField: null },
      { id: 'alpha2', value: state.alpha2, unit: '', category: 'none', resultField: null },
    ];
  
    // Añadir bomba y turbina si están incluidas
    if (state.includeBomba) {
      allFields.push({ id: 'hb', value: state.hb, unit: state.hbUnit, category: 'length', resultField: null });
    }
    if (state.includeTurbina) {
      allFields.push({ id: 'ht', value: state.ht, unit: state.htUnit, category: 'length', resultField: null });
    }
  
    // Añadir campos de pérdidas
    if (state.lossInputType === 'direct') {
      allFields.push({ id: 'hL', value: state.hL, unit: state.hLUnit, category: 'length', resultField: null });
    } else {
      allFields.push(
        { id: 'L', value: state.L, unit: state.LUnit, category: 'length', resultField: null },
        { id: 'D1', value: state.D1, unit: state.D1Unit, category: 'length', resultField: null },
        { id: 'f', value: state.f, unit: '', category: 'none', resultField: null },
        { id: 'K', value: state.K, unit: '', category: 'none', resultField: null }
      );
    }
  
    // 2. Convertir cada campo a unidades SI usando Decimal
    const fieldsInSI = allFields.map(field => {
      // Campos sin unidad (adimensionales)
      if (field.category === 'none') {
        const rawValue = field.value?.replace(',', '.');
        if (!rawValue || rawValue === '' || isNaN(parseFloat(rawValue))) {
          return { ...field, siValue: null, isValid: false };
        }
        return { ...field, siValue: new Decimal(rawValue), isValid: true };
      }
    
      // Campos con unidad
      const rawValue = field.value?.replace(',', '.');
      if (!rawValue || rawValue === '' || isNaN(parseFloat(rawValue))) {
        return { ...field, siValue: null, isValid: false };
      }
    
      const numValue = new Decimal(rawValue);
      const factor = conversionFactors[field.category]?.[field.unit];
      if (!factor) {
        return { ...field, siValue: numValue, isValid: true };
      }
      const factorDecimal = new Decimal(factor);
      return { ...field, siValue: numValue.mul(factorDecimal), isValid: true };
    });
  
    // 3. Validar y encontrar la incógnita
    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);
    const validCount = validFields.length;
    const totalFields = fieldsInSI.length;
  
    // Si no hay exactamente UNA incógnita, no se puede calcular
    if (validCount !== totalFields - 1) {
      setState((prev) => ({
        ...prev,
        resultTotalEnergy: 0,
        resultP1: '', resultV1: '', resultZ1: '',
        resultP2: '', resultV2: '', resultZ2: '',
        invalidFields: missingFields,
        autoCalculatedField: null,
        unknownVariable: null,
      }));
      return;
    }
  
    const missingField = missingFields[0];
  
    // 4. Crear un mapa de valores SI
    const siValues: { [key: string]: Decimal } = {};
    validFields.forEach(f => { siValues[f.id] = f.siValue as Decimal; });
  
    // 5. Función auxiliar para obtener un valor del mapa o un valor por defecto
    const getVal = (id: string, defaultValue: Decimal): Decimal => {
      return siValues[id] !== undefined ? siValues[id] : defaultValue;
    };
  
    // Obtener valores esenciales
    const rho = getVal('rho', new Decimal(1000)); // kg/m³ por defecto
    const g = getVal('g', new Decimal(9.81));
    const rhoG = rho.mul(g); // ρg en N/m³
    const alpha1 = getVal('alpha1', new Decimal(1));
    const alpha2 = getVal('alpha2', new Decimal(1));
    const twoG = new Decimal(2).mul(g);
  
    // 6. Función para calcular hL en SI
    const calculateHL = (): Decimal => {
      if (state.lossInputType === 'direct') {
        return getVal('hL', new Decimal(0));
      } else {
        // Darcy: hL = f * (L/D) * (V²/(2g)) + K * (V²/(2g))
        const L = getVal('L', new Decimal(0));
        const D1 = getVal('D1', new Decimal(1));
        const f = getVal('f', new Decimal(0));
        const K = getVal('K', new Decimal(0));
        const V1 = getVal('V1', new Decimal(0));
      
        const vSquaredOver2g = V1.pow(2).div(twoG);
        const hL_friction = f.mul(L.div(D1)).mul(vSquaredOver2g);
        const hL_minor = K.mul(vSquaredOver2g);
        return hL_friction.plus(hL_minor);
      }
    };
  
    // 7. Preparar el nuevo estado
    const newState: Partial<CalculatorState> = {
      resultP1: '', resultV1: '', resultZ1: '',
      resultP2: '', resultV2: '', resultZ2: '',
    };
  
    // 8. ECUACIÓN CORREGIDA: P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB = P₂/(ρg) + α₂V₂²/(2g) + z₂ + hT + hL
    try {
      switch (missingField) {
        case 'P1': {
          // P₁ = ρg * (P₂/(ρg) + α₂V₂²/(2g) + z₂ + hT + hL - α₁V₁²/(2g) - z₁ - hB)
          const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
            .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z2', new Decimal(0)))
            .plus(getVal('ht', new Decimal(0)))
            .plus(calculateHL())
            .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('z1', new Decimal(0)))
            .minus(getVal('hb', new Decimal(0)));
          
          const pressureSI = rightSide.mul(rhoG);
          const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P1Unit] || 1));
          newState.resultP1 = formatResult(result.toNumber());
          newState.unknownVariable = { 
            name: 'P₁', 
            label: t('energiaBernoulliCalc.labels.P1'), 
            unit: state.P1Unit, 
            value: newState.resultP1 
          };
          break;
        }
      
        case 'z1': {
          // z₁ = P₂/(ρg) + α₂V₂²/(2g) + z₂ + hT + hL - P₁/(ρg) - α₁V₁²/(2g) - hB
          const elevationSI = getVal('P2', new Decimal(0)).div(rhoG)
            .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z2', new Decimal(0)))
            .plus(getVal('ht', new Decimal(0)))
            .plus(calculateHL())
            .minus(getVal('P1', new Decimal(0)).div(rhoG))
            .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('hb', new Decimal(0)));
          
          const result = elevationSI.div(new Decimal(conversionFactors.length[state.z1Unit] || 1));
          newState.resultZ1 = formatResult(result.toNumber());
          newState.unknownVariable = { 
            name: 'z₁', 
            label: t('energiaBernoulliCalc.labels.z1'), 
            unit: state.z1Unit, 
            value: newState.resultZ1 
          };
          break;
        }
      
        case 'V1': {
          // α₁V₁²/(2g) = P₂/(ρg) + α₂V₂²/(2g) + z₂ + hT + hL - P₁/(ρg) - z₁ - hB
          const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
            .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z2', new Decimal(0)))
            .plus(getVal('ht', new Decimal(0)))
            .plus(calculateHL())
            .minus(getVal('P1', new Decimal(0)).div(rhoG))
            .minus(getVal('z1', new Decimal(0)))
            .minus(getVal('hb', new Decimal(0)));
          
          if (rightSide.greaterThanOrEqualTo(0)) {
            // V₁ = √( (2g * rightSide) / α₁ )
            const velocitySI = rightSide.mul(twoG).div(alpha1).sqrt();
            const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V1Unit] || 1));
            newState.resultV1 = formatResult(result.toNumber());
            newState.unknownVariable = { 
              name: 'V₁', 
              label: t('energiaBernoulliCalc.labels.V1'), 
              unit: state.V1Unit, 
              value: newState.resultV1 
            };
          }
          break;
        }
      
        case 'hb': {
          // hB = P₂/(ρg) + α₂V₂²/(2g) + z₂ + hT + hL - P₁/(ρg) - α₁V₁²/(2g) - z₁
          const headSI = getVal('P2', new Decimal(0)).div(rhoG)
            .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z2', new Decimal(0)))
            .plus(getVal('ht', new Decimal(0)))
            .plus(calculateHL())
            .minus(getVal('P1', new Decimal(0)).div(rhoG))
            .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('z1', new Decimal(0)));
          
          const result = headSI.div(new Decimal(conversionFactors.length[state.hbUnit] || 1));
          newState.hb = formatResult(result.toNumber());
          newState.isManualEditHb = false;
          newState.unknownVariable = { 
            name: 'hB', 
            label: t('energiaBernoulliCalc.labels.hb'), 
            unit: state.hbUnit, 
            value: newState.hb 
          };
          break;
        }
      
        case 'P2': {
          // P₂ = ρg * (P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB - α₂V₂²/(2g) - z₂ - hT - hL)
          const rightSide = getVal('P1', new Decimal(0)).div(rhoG)
            .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z1', new Decimal(0)))
            .plus(getVal('hb', new Decimal(0)))
            .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('z2', new Decimal(0)))
            .minus(getVal('ht', new Decimal(0)))
            .minus(calculateHL());
          
          const pressureSI = rightSide.mul(rhoG);
          const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P2Unit] || 1));
          newState.resultP2 = formatResult(result.toNumber());
          newState.unknownVariable = { 
            name: 'P₂', 
            label: t('energiaBernoulliCalc.labels.P2'), 
            unit: state.P2Unit, 
            value: newState.resultP2 
          };
          break;
        }
      
        case 'z2': {
          // z₂ = P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB - P₂/(ρg) - α₂V₂²/(2g) - hT - hL
          const elevationSI = getVal('P1', new Decimal(0)).div(rhoG)
            .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z1', new Decimal(0)))
            .plus(getVal('hb', new Decimal(0)))
            .minus(getVal('P2', new Decimal(0)).div(rhoG))
            .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('ht', new Decimal(0)))
            .minus(calculateHL());
          
          const result = elevationSI.div(new Decimal(conversionFactors.length[state.z2Unit] || 1));
          newState.resultZ2 = formatResult(result.toNumber());
          newState.unknownVariable = { 
            name: 'z₂', 
            label: t('energiaBernoulliCalc.labels.z2'), 
            unit: state.z2Unit, 
            value: newState.resultZ2 
          };
          break;
        }
      
        case 'V2': {
          // α₂V₂²/(2g) = P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB - P₂/(ρg) - z₂ - hT - hL
          const rightSide = getVal('P1', new Decimal(0)).div(rhoG)
            .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z1', new Decimal(0)))
            .plus(getVal('hb', new Decimal(0)))
            .minus(getVal('P2', new Decimal(0)).div(rhoG))
            .minus(getVal('z2', new Decimal(0)))
            .minus(getVal('ht', new Decimal(0)))
            .minus(calculateHL());
          
          if (rightSide.greaterThanOrEqualTo(0)) {
            const velocitySI = rightSide.mul(twoG).div(alpha2).sqrt();
            const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V2Unit] || 1));
            newState.resultV2 = formatResult(result.toNumber());
            newState.unknownVariable = { 
              name: 'V₂', 
              label: t('energiaBernoulliCalc.labels.V2'), 
              unit: state.V2Unit, 
              value: newState.resultV2 
            };
          }
          break;
        }
      
        case 'ht': {
          // hT = P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB - P₂/(ρg) - α₂V₂²/(2g) - z₂ - hL
          const headSI = getVal('P1', new Decimal(0)).div(rhoG)
            .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z1', new Decimal(0)))
            .plus(getVal('hb', new Decimal(0)))
            .minus(getVal('P2', new Decimal(0)).div(rhoG))
            .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('z2', new Decimal(0)))
            .minus(calculateHL());
          
          const result = headSI.div(new Decimal(conversionFactors.length[state.htUnit] || 1));
          newState.ht = formatResult(result.toNumber());
          newState.isManualEditHt = false;
          newState.unknownVariable = { 
            name: 'hT', 
            label: t('energiaBernoulliCalc.labels.ht'), 
            unit: state.htUnit, 
            value: newState.ht 
          };
          break;
        }
      
        case 'hL': {
          // hL = P₁/(ρg) + α₁V₁²/(2g) + z₁ + hB - P₂/(ρg) - α₂V₂²/(2g) - z₂ - hT
          const headSI = getVal('P1', new Decimal(0)).div(rhoG)
            .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
            .plus(getVal('z1', new Decimal(0)))
            .plus(getVal('hb', new Decimal(0)))
            .minus(getVal('P2', new Decimal(0)).div(rhoG))
            .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
            .minus(getVal('z2', new Decimal(0)))
            .minus(getVal('ht', new Decimal(0)));
          
          const result = headSI.div(new Decimal(conversionFactors.length[state.hLUnit] || 1));
          newState.hL = formatResult(result.toNumber());
          newState.isManualEditHL = false;
          newState.unknownVariable = { 
            name: 'hL', 
            label: t('energiaBernoulliCalc.labels.hL'), 
            unit: state.hLUnit, 
            value: newState.hL 
          };
          break;
        }
      
        case 'rho': {
          // ρ = P₂/(g) / [P₁/(ρg?) - Esto es más complejo]
          // Por simplicidad, no implementamos despeje de ρ
          console.warn('Resolución para ρ no implementada');
          setState((prev) => ({
            ...prev,
            invalidFields: [missingField],
            autoCalculatedField: null,
            unknownVariable: null,
          }));
          return;
        }
      
        case 'g': {
          // Similar a ρ, no implementado
          console.warn('Resolución para g no implementada');
          setState((prev) => ({
            ...prev,
            invalidFields: [missingField],
            autoCalculatedField: null,
            unknownVariable: null,
          }));
          return;
        }
      
        case 'alpha1':
        case 'alpha2': {
          // α = (2g * término) / V²
          // Similar al modo ideal, pero con la ecuación completa
          if (missingField === 'alpha1') {
            const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
              .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
              .plus(getVal('z2', new Decimal(0)))
              .plus(getVal('ht', new Decimal(0)))
              .plus(calculateHL())
              .minus(getVal('P1', new Decimal(0)).div(rhoG))
              .minus(getVal('z1', new Decimal(0)))
              .minus(getVal('hb', new Decimal(0)));
            
            const V1 = getVal('V1', new Decimal(0));
            if (rightSide.greaterThan(0) && !V1.isZero()) {
              const alpha1_calc = rightSide.mul(twoG).div(V1.pow(2));
              const formattedResult = formatResult(alpha1_calc.toNumber());
              newState.alpha1 = formattedResult;
              newState.isManualEditAlpha1 = false;
              newState.unknownVariable = { 
                name: 'α₁', 
                label: t('energiaBernoulliCalc.labels.alpha1'), 
                unit: '', 
                value: formattedResult 
              };
            }
          } else { // alpha2
            const rightSide = getVal('P1', new Decimal(0)).div(rhoG)
              .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
              .plus(getVal('z1', new Decimal(0)))
              .plus(getVal('hb', new Decimal(0)))
              .minus(getVal('P2', new Decimal(0)).div(rhoG))
              .minus(getVal('z2', new Decimal(0)))
              .minus(getVal('ht', new Decimal(0)))
              .minus(calculateHL());
            
            const V2 = getVal('V2', new Decimal(0));
            if (rightSide.greaterThan(0) && !V2.isZero()) {
              const alpha2_calc = rightSide.mul(twoG).div(V2.pow(2));
              const formattedResult = formatResult(alpha2_calc.toNumber());
              newState.alpha2 = formattedResult;
              newState.isManualEditAlpha2 = false;
              newState.unknownVariable = { 
                name: 'α₂', 
                label: t('energiaBernoulliCalc.labels.alpha2'), 
                unit: '', 
                value: formattedResult 
              };
            }
          }
          break;
        }
      
        default:
          console.warn(`Resolución para '${missingField}' no implementada`);
          setState((prev) => ({
            ...prev,
            invalidFields: [missingField],
            autoCalculatedField: null,
            unknownVariable: null,
          }));
          return;
      }
    
      // 9. Actualizar estado
      setState((prev) => ({
        ...prev,
        ...newState,
        invalidFields: [],
        autoCalculatedField: missingField,
        resultTotalEnergy: 0,
        isManualEditP1: missingField === 'P1' ? false : prev.isManualEditP1,
        isManualEditV1: missingField === 'V1' ? false : prev.isManualEditV1,
        isManualEditz1: missingField === 'z1' ? false : prev.isManualEditz1,
        isManualEditP2: missingField === 'P2' ? false : prev.isManualEditP2,
        isManualEditV2: missingField === 'V2' ? false : prev.isManualEditV2,
        isManualEditz2: missingField === 'z2' ? false : prev.isManualEditz2,
        isManualEditHb: missingField === 'hb' ? false : (prev.isManualEditHb || false),
        isManualEditHt: missingField === 'ht' ? false : (prev.isManualEditHt || false),
        isManualEditHL: missingField === 'hL' ? false : (prev.isManualEditHL || false),
        isManualEditAlpha1: missingField === 'alpha1' ? false : (prev.isManualEditAlpha1 || false),
        isManualEditAlpha2: missingField === 'alpha2' ? false : (prev.isManualEditAlpha2 || false),
      }));
    
    } catch (error) {
      console.error("Error en cálculo con pérdidas:", error);
      setState((prev) => ({
        ...prev,
        invalidFields: [missingField],
        autoCalculatedField: null,
        unknownVariable: null,
      }));
    }
  }, [state, formatResult, t]);

  const calculateCavitation = useCallback(() => {
    try {
      // Validar campos según el tipo de sistema
      let requiredIds: string[] = ['g'];

      if (state.cavitationSystemType === 'closed') {
        requiredIds = [...requiredIds, 'Ps', 'Vs'];
      } else {
        requiredIds = [...requiredIds, 'Patm', 'z0', 'zs', 'hfs'];
      }

      // Validar según opciones de fluido
      if (state.useRhoForGamma) {
        requiredIds.push('rho');
      } else {
        requiredIds.push('gamma');
      }

      if (state.useTempForPv) {
        requiredIds.push('temperatura');
      } else {
        requiredIds.push('Pv');
      }

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
          resultNPSHa: '',
          resultCavitationMargin: '',
          resultPabs: '',
        }));
        return;
      }

      // Obtener valores en unidades base
      const g = parseFloat(state.g.replace(',', '.')) * conversionFactors.acceleration[state.gUnit];

      // Calcular gamma (peso específico)
      let gamma: number;
      if (state.useRhoForGamma) {
        const rho = parseFloat(state.rho.replace(',', '.')) * conversionFactors.density[state.rhoUnit];
        gamma = rho * g;
        setState(prev => ({ ...prev, resultGamma: formatResult(gamma) }));
      } else {
        gamma = parseFloat(state.gamma.replace(',', '.')) * conversionFactors.specificWeight[state.gammaUnit];
      }

      // Calcular Pv (presión de vapor)
      let Pv: number;
      if (state.useTempForPv) {
        const temp = parseFloat(state.temperatura.replace(',', '.'));
        Pv = calculateVaporPressure(temp, state.temperaturaUnit);
        setState(prev => ({ ...prev, resultPv: formatResult(Pv) }));
      } else {
        Pv = parseFloat(state.Pv.replace(',', '.')) * conversionFactors.pressure[state.PvUnit];
      }

      let NPSHa: number;
      let Pabs: number = 0;

      if (state.cavitationSystemType === 'closed') {
        // SISTEMA CERRADO
        // NPSH_disp = P_s/γ + V_s²/(2g) - P_v/γ
        const Ps = parseFloat(state.Ps.replace(',', '.')) * conversionFactors.pressure[state.PsUnit];
        const Vs = parseFloat(state.Vs.replace(',', '.')) * conversionFactors.velocity[state.VsUnit];

        Pabs = Ps; // En sistema cerrado, Ps es presión absoluta
        const velocityHead = Math.pow(Vs, 2) / (2 * g);

        NPSHa = (Ps / gamma) + velocityHead - (Pv / gamma);

      } else {
        // SISTEMA ABIERTO
        // NPSH_disp = P_atm/γ + z₀ - z_s - h_fs - P_v/γ
        const Patm = parseFloat(state.Patm.replace(',', '.')) * conversionFactors.pressure[state.PatmUnit];
        const z0 = parseFloat(state.z0.replace(',', '.')) * conversionFactors.length[state.z0Unit];
        const zs = parseFloat(state.zs.replace(',', '.')) * conversionFactors.length[state.zsUnit];
        const hfs = parseFloat(state.hfs.replace(',', '.')) * conversionFactors.length[state.hfsUnit];

        Pabs = Patm; // En sistema abierto, usamos presión atmosférica

        NPSHa = (Patm / gamma) + z0 - zs - hfs - (Pv / gamma);
      }

      // Margen de cavitación (NPSHa - 0.5m como margen típico)
      // En una versión mejorada, esto podría ser configurable
      const cavitationMargin = NPSHa - 0.5;

      // Determinar estado de cavitación
      let cavitationStatus = '';
      if (cavitationMargin > 0.5) {
        cavitationStatus = 'Seguro';
      } else if (cavitationMargin > 0) {
        cavitationStatus = 'Margen bajo';
      } else {
        cavitationStatus = 'Riesgo de cavitación';
      }

      setState((prev) => ({
        ...prev,
        invalidFields: [],
        autoCalculatedField: null,
        resultNPSHa: formatResult(NPSHa / conversionFactors.length['m']), // Convertir a metros para mostrar
        resultCavitationMargin: formatResult(cavitationMargin / conversionFactors.length['m']),
        resultPabs: formatResult(Pabs / conversionFactors.pressure['Pa']),
        resultTotalEnergy: cavitationMargin, // Para mantener compatibilidad
      }));

      // Mostrar toast con estado de cavitación
      // Toast.show({
      //   type: cavitationMargin > 0 ? 'success' : 'error',
      //   text1: t('energiaBernoulliCalc.cavitationStatus') || 'Estado de cavitación',
      //   text2: cavitationStatus,
      // });

    } catch (error) {
      console.error('Error en cálculo de cavitación:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('energiaBernoulliCalc.toasts.calculationError'),
      });
    }
  }, [state, formatResult, calculateVaporPressure, t]);

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
      textToCopy += `${t('energiaBernoulliCalc.npsha')}: ${state.resultNPSHa} m\n`;
      textToCopy += `${t('energiaBernoulliCalc.cavitationMargin')}: ${formattedMain} m\n`;
      textToCopy += `${t('energiaBernoulliCalc.pabs')}: ${state.resultPabs} Pa\n`;

      if (state.resultGamma) {
        textToCopy += `γ: ${state.resultGamma} N/m³ (calculado)\n`;
      }
      if (state.resultPv) {
        textToCopy += `Pv: ${state.resultPv} Pa (calculado)\n`;
      }

      textToCopy += `\n${t('energiaBernoulliCalc.systemType')}: ${state.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto'}\n`;

      if (state.cavitationSystemType === 'closed') {
        textToCopy += `${t('energiaBernoulliCalc.labels.Ps')}: ${state.Ps} ${state.PsUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.Vs')}: ${state.Vs} ${state.VsUnit}\n`;
      } else {
        textToCopy += `${t('energiaBernoulliCalc.labels.Patm')}: ${state.Patm} ${state.PatmUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.z0')}: ${state.z0} ${state.z0Unit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.zs')}: ${state.zs} ${state.zsUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.hfs')}: ${state.hfs} ${state.hfsUnit}\n`;
      }
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
          cavitationSystemType: state.cavitationSystemType,
          Ps: state.Ps,
          PsUnit: state.PsUnit,
          Vs: state.Vs,
          VsUnit: state.VsUnit,
          Patm: state.Patm,
          PatmUnit: state.PatmUnit,
          z0: state.z0,
          z0Unit: state.z0Unit,
          zs: state.zs,
          zsUnit: state.zsUnit,
          hfs: state.hfs,
          hfsUnit: state.hfsUnit,
          temperatura: state.temperatura,
          temperaturaUnit: state.temperaturaUnit,
          Pv: state.Pv,
          PvUnit: state.PvUnit,
          useRhoForGamma: state.useRhoForGamma,
          useTempForPv: state.useTempForPv,
          resultNPSHa: state.resultNPSHa,
          resultCavitationMargin: state.resultCavitationMargin,
          resultPabs: state.resultPabs,
          resultGamma: state.resultGamma,
          resultPv: state.resultPv,
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
      // *** NUEVO: Unidades para cavitación ***
      'P_s': state.PsUnit,
      'V_s': state.VsUnit,
      'P_atm': state.PatmUnit,
      'z₀': state.z0Unit,
      'z_s': state.zsUnit,
      'h_fs': state.hfsUnit,
    };

    const unit = unitProp || unitMap[label] || '';
    const shownLabel = displayLabel || label;

    const isFieldLocked = fieldId && state.lockedField === fieldId;
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    // Función para formatear el valor mostrado (máximo 5 decimales)
    const formatDisplayValue = (val: string): string => {
      if (!val || val === '') return val;

      // Si el usuario está escribiendo y el último carácter es un punto o coma,
      // o si hay un punto/coma sin dígitos después, mantener el valor sin formato
      const lastChar = val.charAt(val.length - 1);
      if (lastChar === '.' || lastChar === ',') {
        return val;
      }

      // Si hay un punto/coma seguido de nada (ej: "123.") mantenerlo
      if (val.includes('.') && val.split('.')[1] === '') {
        return val;
      }
      if (val.includes(',') && val.split(',')[1] === '') {
        return val;
      }

      // Reemplazar coma por punto para parsear
      const normalizedVal = val.replace(',', '.');
      const num = parseFloat(normalizedVal);

      if (isNaN(num)) return val;

      // Formatear a máximo 5 decimales, eliminando ceros innecesarios
      const formatted = num.toFixed(5).replace(/\.?0+$/, '');

      // Restaurar el separador decimal original si es coma
      return selectedDecimalSeparator === 'Coma' ? formatted.replace('.', ',') : formatted;
    };

    // Función para manejar cambios en el texto sin formato
    const handleTextChange = (text: string) => {
      // Permitir que el usuario escriba puntos y comas libremente
      onChange(text);
      setManualEdit(true);
      if (fieldId) {
        setState((prev) => ({
          ...prev,
          invalidFields: prev.invalidFields.filter((f) => f !== fieldId),
          autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
          unknownVariable: prev.unknownVariable?.name === fieldId ? null : prev.unknownVariable,
        }));
      }
    };

    // Determinar qué valor mostrar (resultado calculado o valor manual)
    const rawDisplayValue = resultValue && resultValue !== '' ? resultValue : value;
    const displayValue = formatDisplayValue(rawDisplayValue);

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
                value={displayValue}
                onChangeText={handleTextChange}
                onBlur={() => {
                  // Al perder el foco, forzar la actualización del formato
                  if (value && value !== '') {
                    const formatted = formatDisplayValue(value);
                    if (formatted !== value) {
                      onChange(formatted);
                    }
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
              else if (label === 'P_v') category = 'pressure';

              navigateToOptions(category, (option: string) => {
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
              
                // *** ACTUALIZADO: Añadir casos para los nuevos labels de cavitación ***
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
                  case 'P_v': updateUnit('Pv', 'prevPvUnit'); break;
                  case 'P_s': updateUnit('Ps', 'prevPsUnit'); break;
                  case 'V_s': updateUnit('Vs', 'prevVsUnit'); break;
                  case 'P_atm': updateUnit('Patm', 'prevPatmUnit'); break;
                  case 'z₀': updateUnit('z0', 'prevZ0Unit'); break;
                  case 'z_s': updateUnit('zs', 'prevZsUnit'); break;
                  case 'h_fs': updateUnit('hfs', 'prevHfsUnit'); break;
                  default: break;
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
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor, selectedDecimalSeparator]);

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

  // *** NUEVO: Selector para sistema cerrado/abierto ***
  const onLayoutClosed = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setCavitationButtonPositions((prev) => ({ ...prev, closed: x }));
    setCavitationButtonMetrics((prev) => ({ ...prev, closed: width }));
  }, []);

  const onLayoutOpen = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setCavitationButtonPositions((prev) => ({ ...prev, open: x }));
    setCavitationButtonMetrics((prev) => ({ ...prev, open: width }));
  }, []);

  // Añadir estos estados junto con los otros estados de métricas (línea ~290)
  const [cavitationButtonMetrics, setCavitationButtonMetrics] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });
  const [cavitationButtonPositions, setCavitationButtonPositions] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });

  // Añadir animaciones para el selector de cavitación (junto a animatedLossValue, línea ~300)
  const animatedCavitationValue = useRef(new Animated.Value(0)).current;
  const animatedCavitationScale = useRef(new Animated.Value(1)).current;

  // Añadir useEffect para la animación del selector de cavitación (después del useEffect de loss)
  useEffect(() => {
    if (cavitationButtonMetrics.closed > 0 && cavitationButtonMetrics.open > 0) {
      let targetX = 0;
      if (state.cavitationSystemType === 'closed') targetX = cavitationButtonPositions.closed;
      else if (state.cavitationSystemType === 'open') targetX = cavitationButtonPositions.open;

      Animated.parallel([
        Animated.spring(animatedCavitationValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedCavitationScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedCavitationScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.cavitationSystemType, cavitationButtonMetrics, cavitationButtonPositions]);

  // *** NUEVO: Render del selector de sistema ***
  const renderSystemTypeSelector = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.systemType')}
      </Text>
      <View style={styles.lossButtonContainer}>
        <Animated.View
          style={[
            styles.lossOverlay,
            {
              experimental_backgroundImage: themeColors.gradient,
              width: state.cavitationSystemType === 'closed' ? cavitationButtonMetrics.closed : cavitationButtonMetrics.open,
              transform: [{ translateX: animatedCavitationValue }, { scale: animatedCavitationScale }],
            },
          ]}
        >
          <View style={[styles.lossOverlayInner, { backgroundColor: themeColors.card }]}></View>
        </Animated.View>

        <Pressable
          onLayout={onLayoutClosed}
          style={[styles.lossButton, state.cavitationSystemType === 'closed' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, cavitationSystemType: 'closed' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.closed') || 'Cerrado'}
          </Text>
        </Pressable>

        <Pressable
          onLayout={onLayoutOpen}
          style={[styles.lossButton, state.cavitationSystemType === 'open' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, cavitationSystemType: 'open' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.open') || 'Abierto'}
          </Text>
        </Pressable>
      </View>
    </View>
  ), [themeColors, t, fontSizeFactor, state.cavitationSystemType, cavitationButtonMetrics, cavitationButtonPositions, animatedCavitationValue, animatedCavitationScale]);

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
              alpha1: text, // guarda lo q el usuario escribe
              isManualEditAlpha1: true,
              invalidFields: prev.invalidFields.filter((f) => f !== 'alpha1'),
              autoCalculatedField: prev.autoCalculatedField === 'alpha1' ? null : prev.autoCalculatedField,
            }));
          }}
          onBlur={() => {
            // Formatear al perder el foco
            if (state.alpha1 && state.alpha1 !== '') {
              const normalized = state.alpha1.replace(',', '.');
              const num = parseFloat(normalized);
              if (!isNaN(num)) {
                const formatted = num.toFixed(5).replace(/\.?0+$/, '');
                const finalValue = selectedDecimalSeparator === 'Coma' ? formatted.replace('.', ',') : formatted;
                if (finalValue !== state.alpha1) {
                  setState(prev => ({ ...prev, alpha1: finalValue }));
                }
              }
            }
          }} // ← Nuevo: agregar onBlur
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

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.includeBomba') || 'Incluir Bomba'}
          value={state.includeBomba}
          onValueChange={(value) => setState(prev => ({ ...prev, includeBomba: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
        />
      </View>
      {state.includeBomba && renderInput('hB', state.hb, 
        (text) => setState((prev) => ({ ...prev, hb: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditHb: val })), 
        'hb', state.isManualEditHb ? state.hb : undefined, 
        t('energiaBernoulliCalc.labels.hb')
      )}

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.includeTurbina') || 'Incluir Turbina'}
          value={state.includeTurbina}
          onValueChange={(value) => setState(prev => ({ ...prev, includeTurbina: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
        />
      </View>
      {state.includeTurbina && renderInput('hT', state.ht, 
        (text) => setState((prev) => ({ ...prev, ht: text })), 
        (val) => setState((prev) => ({ ...prev, isManualEditHt: val })), 
        'ht', state.isManualEditHt ? state.ht : undefined, 
        t('energiaBernoulliCalc.labels.ht')
      )}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.losses')}
      </Text>

      {renderLossTypeSelector()}

      {state.lossInputType === 'direct' ? (
        renderInput('hL', state.hL, 
          (text) => setState((prev) => ({ ...prev, hL: text })), 
          (val) => setState((prev) => ({ ...prev, isManualEditHL: val })), 
          'hL', state.isManualEditHL ? state.hL : undefined, 
          t('energiaBernoulliCalc.labels.hL')
        )
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
  ), [renderIdealInputs, renderInput, renderLossTypeSelector, state.includeBomba, state.includeTurbina, state.hb, state.ht, state.hL, state.L, state.D1, state.f, state.K, state.isManualEditHb, state.isManualEditHt, state.isManualEditHL, state.lossInputType, themeColors, t, fontSizeFactor, currentTheme]);

  const renderCavitationInputs = useCallback(() => (
    <>
      {renderSystemTypeSelector()}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      {state.cavitationSystemType === 'closed' ? (
        // SISTEMA CERRADO
        <>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.closedSystem') || 'Sistema Cerrado'}
          </Text>

          {renderInput('P_s', state.Ps, 
            (text) => setState((prev) => ({ ...prev, Ps: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEditPs: val })), 
            'Ps', state.isManualEditPs ? state.Ps : undefined, 
            t('energiaBernoulliCalc.labels.Ps') || 'Presión en succión', 
          state.PsUnit)}

          {renderInput('V_s', state.Vs, 
            (text) => setState((prev) => ({ ...prev, Vs: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEditVs: val })), 
            'Vs', state.isManualEditVs ? state.Vs : undefined, 
            t('energiaBernoulliCalc.labels.Vs') || 'Velocidad en succión', 
          state.VsUnit)}
        </>
      ) : (
        // SISTEMA ABIERTO
        <>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.openSystem') || 'Sistema Abierto'}
          </Text>

          {renderInput('P_atm', state.Patm, 
            (text) => setState((prev) => ({ ...prev, Patm: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEditPatm: val })), 
            'Patm', state.isManualEditPatm ? state.Patm : undefined, 
            t('energiaBernoulliCalc.labels.Patm') || 'Presión atmosférica', 
          state.PatmUnit)}

          {renderInput('z₀', state.z0, 
            (text) => setState((prev) => ({ ...prev, z0: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEditz0: val })), 
            'z0', state.isManualEditz0 ? state.z0 : undefined, 
            t('energiaBernoulliCalc.labels.z0') || 'Nivel del líquido', 
          state.z0Unit)}

          {renderInput('z_s', state.zs, 
            (text) => setState((prev) => ({ ...prev, zs: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEditzs: val })), 
            'zs', state.isManualEditzs ? state.zs : undefined, 
            t('energiaBernoulliCalc.labels.zs') || 'Elevación en succión', 
          state.zsUnit)}

          {renderInput('h_fs', state.hfs, 
            (text) => setState((prev) => ({ ...prev, hfs: text })), 
            (val) => setState((prev) => ({ ...prev, isManualEdithfs: val })), 
            'hfs', state.isManualEdithfs ? state.hfs : undefined, 
            t('energiaBernoulliCalc.labels.hfs') || 'Pérdida en succión', 
          state.hfsUnit)}
        </>
      )}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.useRhoForGamma') || 'Usar densidad (ρ) en lugar de peso específico (γ)'}
          value={state.useRhoForGamma}
          onValueChange={(value) => setState(prev => ({ ...prev, useRhoForGamma: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
        />
      </View>

      {state.useRhoForGamma ? (
        // Input de densidad
        renderInput('ρ', state.rho, 
          (text) => setState((prev) => ({ ...prev, rho: text })), 
          () => {}, 'rho', undefined, 
          t('energiaBernoulliCalc.labels.rho') || 'Densidad', state.rhoUnit)
      ) : (
        // Input de peso específico
        renderInput('γ', state.gamma, 
          (text) => setState((prev) => ({ ...prev, gamma: text })), 
          () => {}, 'gamma', undefined, 
          t('energiaBernoulliCalc.labels.gamma'), state.gammaUnit)
      )}

      {renderInput('g', state.g, 
        (text) => setState((prev) => ({ ...prev, g: text })), 
        () => {}, 'g', undefined, 
        t('energiaBernoulliCalc.labels.g'), state.gUnit)}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
      
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.vaporPressure') || 'Presión de Vapor'}
      </Text>
      
      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.useTempForPv') || 'Calcular Pv desde temperatura'}
          value={state.useTempForPv}
          onValueChange={(value) => setState(prev => ({ ...prev, useTempForPv: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
        />
      </View>
      
      {state.useTempForPv ? (
        // Input de temperatura
        renderInput('T', state.temperatura, 
          (text) => setState((prev) => ({ ...prev, temperatura: text })), 
          () => {}, 'temperatura', undefined, 
          t('energiaBernoulliCalc.labels.temperatura'), state.temperaturaUnit)
      ) : (
        // Input directo de Pv
        renderInput('P_v', state.Pv, 
          (text) => setState((prev) => ({ ...prev, Pv: text })), 
          () => {}, 'Pv', undefined, 
          t('energiaBernoulliCalc.labels.Pv'), state.PvUnit)
      )}
    </>
  ), [renderInput, renderSystemTypeSelector, state.cavitationSystemType, state.Ps, state.Vs, state.Patm, state.z0, state.zs, state.hfs, state.useRhoForGamma, state.rho, state.gamma, state.g, state.useTempForPv, state.temperatura, state.Pv, state.isManualEditPs, state.isManualEditVs, state.isManualEditPatm, state.isManualEditz0, state.isManualEditzs, state.isManualEdithfs, themeColors, t, fontSizeFactor]);

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
    // Si hay una variable incógnita calculada (en CUALQUIER modo)
    if (state.unknownVariable) {
      const unit = state.unknownVariable.unit ? ` (${state.unknownVariable.unit})` : '';
      return `${state.unknownVariable.label} ${unit}`;
    }

    // Para otros modos, mantener el comportamiento original
    switch (state.mode) {
      case 'losses':
        return t('energiaBernoulliCalc.energyDifference');
      case 'cavitation': {
        // Calcular el margen para determinar el estado
        const margin = parseFloat(state.resultCavitationMargin || '0');

        if (margin > 0.5) {
          return `${t('energiaBernoulliCalc.noCavitation') || 'Sin riesgo de cavitación'}`;
        } else if (margin > 0) {
          return `${t('energiaBernoulliCalc.lowMargin') || 'Margen bajo'}`;
        } else {
          return `${t('energiaBernoulliCalc.cavitationRisk') || '¡RIESGO DE CAVITACIÓN!'}`;
        }
      }
      default:
        return t('energiaBernoulliCalc.result');
    }
  }, [state.mode, state.unknownVariable, state.resultCavitationMargin, t]);

  // También actualizar la función shouldShowPlaceholder para reflejar el cambio
  const shouldShowPlaceholderLabel = useCallback(() => {
    // Si hay una variable incógnita, mostrar el label (no placeholder)
    if (state.unknownVariable) {
      return false;
    }
    
    // Para otros modos, mostrar placeholder si no hay resultado
    if (state.mode === 'ideal') {
      return !state.unknownVariable;
    }
    
    return state.resultTotalEnergy === 0 && 
           !state.resultNPSHa; // Cambiado de resultCavitationMargin a resultNPSHa
  }, [state.mode, state.unknownVariable, state.resultTotalEnergy, state.resultNPSHa]);

  // El valor numérico ahora mostrará NPSHa en lugar del margen
  const getMainResultValue = useCallback(() => {
    // Si hay una variable incógnita calculada (en CUALQUIER modo)
    if (state.unknownVariable) {
      return state.unknownVariable.value || '0';
    }

    // Para otros modos, mantener el comportamiento original
    switch (state.mode) {
      case 'cavitation':
        return state.resultNPSHa || '0'; // Cambiado de resultCavitationMargin a resultNPSHa
      default:
        return formatResult(state.resultTotalEnergy) || '0';
    }
  }, [state.mode, state.unknownVariable, state.resultNPSHa, state.resultTotalEnergy, formatResult]);

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
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 16 * fontSizeFactor }
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
    backgroundColor: 'rgba(142, 142, 142, 0.1)', 
    borderWidth: 1, 
    borderColor: 'rgba(104, 104, 104, 0.2)', 
    borderRadius: 14, 
    marginLeft: 11, 
    marginTop: 11, 
    height: 28, 
    minWidth: 90, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 12,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    fontFamily: 'SFUIDisplay-Medium',
  },
  checkboxRow: {
    marginTop: 0,
    backgroundColor: 'transparent',
  },
});

export default EnergiaBernoulliCalc;