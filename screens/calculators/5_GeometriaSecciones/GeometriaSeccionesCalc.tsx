import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Clipboard,
  LayoutChangeEvent,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import Decimal from 'decimal.js';
import { getDBConnection, createTable, saveCalculation, createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../../src/components/CustomKeyboardInput';

// ============================================================================
// Módulo geométrico integrado (anteriormente geometricSections.ts)
// ============================================================================

/**
 * Calcula el área, perímetro y ancho superficial de una sección circular parcialmente llena.
 * @param D Diámetro interior (m)
 * @param y Tirante de agua (m), 0 <= y <= D
 * @returns Objeto con A (área), P (perímetro), T (ancho superficial)
 */
function circularParcial(D: number, y: number): { A: number; P: number; T: number } {
  // Validar rango
  const yClamped = Math.max(0, Math.min(y, D));
  if (yClamped === 0) {
    return { A: 0, P: 0, T: 0 };
  }
  if (yClamped === D) {
    // Sección llena
    return {
      A: Math.PI * D * D / 4,
      P: Math.PI * D,
      T: D,
    };
  }
  // Ángulo central (radianes) que subtiende el espejo de agua
  // θ = 2 * arccos(1 - 2y/D)
  const cosHalfTheta = 1 - 2 * yClamped / D;
  const halfTheta = Math.acos(cosHalfTheta);
  const theta = 2 * halfTheta;
  const sinTheta = Math.sin(theta);
  const A = (D * D / 8) * (theta - sinTheta);
  const P = (D / 2) * theta;
  const T = D * Math.sin(theta / 2);
  return { A, P, T };
}

/**
 * Resuelve el tirante y a partir del área mojada en una sección circular parcial.
 * Utiliza el método de Newton‑Raphson sobre la variable θ.
 * @param D Diámetro (m)
 * @param A Área objetivo (m²)
 * @param tol Tolerancia (por defecto 1e-9)
 * @param maxIter Máximo de iteraciones (por defecto 100)
 * @returns Tirante y (m) o NaN si no converge
 */
function solveTiranteCircularParcialDesdeArea(
  D: number,
  A: number,
  tol: number = 1e-9,
  maxIter: number = 100
): number {
  if (A <= 0) return 0;
  const AFull = Math.PI * D * D / 4;
  if (A >= AFull) return D;

  // Función f(θ) = (D²/8)*(θ - sinθ) - A
  // Derivada f'(θ) = (D²/8)*(1 - cosθ)
  const D2_8 = D * D / 8;

  // Estimación inicial: θ = π (mitad del círculo) si A es pequeño, sino algo mayor
  let theta = Math.PI; // Inicio con medio círculo
  for (let i = 0; i < maxIter; i++) {
    const sinTheta = Math.sin(theta);
    const f = D2_8 * (theta - sinTheta) - A;
    if (Math.abs(f) < tol) {
      // Convertir θ a y
      const y = D * (1 - Math.cos(theta / 2)) / 2;
      return y;
    }
    const cosTheta = Math.cos(theta);
    const fPrime = D2_8 * (1 - cosTheta);
    if (Math.abs(fPrime) < 1e-12) break; // Evitar división por cero
    const delta = f / fPrime;
    theta -= delta;
    // Mantener θ en rango (0, 2π)
    if (theta < 0) theta = 0;
    if (theta > 2 * Math.PI) theta = 2 * Math.PI;
  }
  return NaN; // No convergió
}

/**
 * Resuelve el tirante y a partir del perímetro mojado en una sección circular parcial.
 * @param D Diámetro (m)
 * @param P Perímetro objetivo (m)
 * @param tol Tolerancia (por defecto 1e-9)
 * @param maxIter Máximo de iteraciones (por defecto 100)
 * @returns Tirante y (m) o NaN
 */
function solveTiranteCircularParcialDesdePerimetro(
  D: number,
  P: number,
  tol: number = 1e-9,
  maxIter: number = 100
): number {
  if (P <= 0) return 0;
  const PFull = Math.PI * D;
  if (P >= PFull) return D;

  // P = (D/2)*θ  => θ = 2P/D
  const theta = (2 * P) / D;
  if (theta < 0 || theta > 2 * Math.PI) return NaN;
  // Convertir θ a y
  const y = D * (1 - Math.cos(theta / 2)) / 2;
  return y;
}

/**
 * Resuelve el tirante y a partir del ancho superficial en una sección circular parcial.
 * @param D Diámetro (m)
 * @param T Ancho superficial objetivo (m)
 * @returns Tirante y (m) o NaN
 */
function solveTiranteCircularParcialDesdeAncho(D: number, T: number): number {
  if (T <= 0) return 0;
  if (T >= D) return D;

  // T = D * sin(θ/2)  => θ/2 = arcsin(T/D)
  const halfTheta = Math.asin(T / D);
  const theta = 2 * halfTheta;
  const y = D * (1 - Math.cos(halfTheta)) / 2;
  return y;
}

/**
 * Calcula propiedades de una sección rectangular.
 * @param b Base (m)
 * @param y Tirante (m)
 * @returns Objeto con A, P, T, R, Dh
 */
function rectangular(b: number, y: number) {
  const A = b * y;
  const P = b + 2 * y;
  const T = b;
  const R = A / P;
  const Dh = A / T;
  return { A, P, T, R, Dh };
}

/**
 * Calcula propiedades de una sección trapezoidal.
 * @param b Base menor (m)
 * @param y Tirante (m)
 * @param z Talud (horizontal:vertical)
 * @returns Objeto con A, P, T, R, Dh
 */
function trapezoidal(b: number, y: number, z: number) {
  const A = (b + z * y) * y;
  const P = b + 2 * y * Math.sqrt(1 + z * z);
  const T = b + 2 * z * y;
  const R = A / P;
  const Dh = A / T;
  return { A, P, T, R, Dh };
}

/**
 * Calcula propiedades de una sección triangular.
 * @param y Tirante (m)
 * @param z Talud (horizontal:vertical)
 * @returns Objeto con A, P, T, R, Dh
 */
function triangular(y: number, z: number) {
  const A = z * y * y;
  const P = 2 * y * Math.sqrt(1 + z * z);
  const T = 2 * z * y;
  const R = A / P;
  const Dh = A / T;
  return { A, P, T, R, Dh };
}

/**
 * Calcula propiedades de una sección parabólica.
 * Se asume que la forma sigue T = K * sqrt(y), con K en m^(1/2).
 * @param y Tirante (m)
 * @param K Parámetro de forma (m^(1/2))
 * @returns Objeto con A, P, T, R, Dh
 */
function parabolico(y: number, K: number) {
  const T = K * Math.sqrt(y);
  const A = (2 / 3) * T * y;
  // Aproximación del perímetro (válida para y pequeña)
  const P = T + (8 * y * y) / (3 * T);
  const R = A / P;
  const Dh = A / T;
  return { A, P, T, R, Dh };
}

/**
 * Resuelve el tirante y a partir del área en una sección parabólica.
 * @param K Parámetro de forma (m^(1/2))
 * @param A Área objetivo (m²)
 * @returns Tirante y (m)
 */
function solveTiranteParabolicoDesdeArea(K: number, A: number): number {
  if (A <= 0) return 0;
  // A = (2/3) * K * y^(3/2)  => y^(3/2) = (3A)/(2K)  => y = ((3A)/(2K))^(2/3)
  const y = Math.pow((3 * A) / (2 * K), 2 / 3);
  return y;
}

/**
 * Resuelve el tirante y a partir del ancho superficial en una sección parabólica.
 * @param K Parámetro de forma (m^(1/2))
 * @param T Ancho superficial objetivo (m)
 * @returns Tirante y (m)
 */
function solveTiranteParabolicoDesdeAncho(K: number, T: number): number {
  if (T <= 0) return 0;
  // T = K * sqrt(y)  => sqrt(y) = T/K  => y = (T/K)^2
  const y = Math.pow(T / K, 2);
  return y;
}

// ============================================================================
// Fin del módulo geométrico integrado
// ============================================================================

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// Tipos de navegación
type RootStackParamList = {
  OptionsScreenGeometria: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenGeometriaSecciones: undefined;
  GeometriaSeccionesTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

type SectionType = 'circular-llena' | 'circular-parcial' | 'rectangular' | 'trapezoidal' | 'triangular' | 'parabolico';

interface CalculatorState {
  sectionType: SectionType;

  // Parámetros geométricos (dependen del tipo de sección)
  diametro: string;       // circular
  tirante: string;        // todas
  base: string;           // rectangular, trapezoidal
  talud: string;          // trapezoidal, triangular
  K: string;              // parabólico

  // Resultados geométricos (siempre presentes)
  A: string;
  P: string;
  R: string;
  T: string;
  Dh: string;

  // Unidades
  diametroUnit: string;
  tiranteUnit: string;
  baseUnit: string;
  taludUnit: string;      // adimensional, no se usa unidad
  KUnit: string;          // (longitud^(1/2) – se trata como longitud para simplificar)
  AUnit: string;
  PUnit: string;
  RUnit: string;
  TUnit: string;
  DhUnit: string;

  prevDiametroUnit: string;
  prevTiranteUnit: string;
  prevBaseUnit: string;
  prevKUnit: string;
  prevAUnit: string;
  prevPUnit: string;
  prevRUnit: string;
  prevTUnit: string;
  prevDhUnit: string;

  // Flags de edición manual
  isManualEditA: boolean;
  isManualEditP: boolean;
  isManualEditR: boolean;
  isManualEditT: boolean;
  isManualEditDh: boolean;

  // Variables de control
  lockedField: string | null;
  invalidFields: string[];
  autoCalculatedField: string | null;
  unknownVariable: {
    name: string;
    label: string;
    unit: string;
    value: string;
  } | null;

  // Resultados calculados (para mostrar en el panel principal)
  resultPrincipal: number; // Se usará para el valor principal (por ejemplo R)
}

// Factores de conversión (copiados de EnergiaBernoulliCalc y ampliados con área)
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
};

// Configuración de Toast
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
  sectionType: 'circular-llena',

  diametro: '',
  tirante: '',
  base: '',
  talud: '',
  K: '',

  A: '',
  P: '',
  R: '',
  T: '',
  Dh: '',

  diametroUnit: 'm',
  tiranteUnit: 'm',
  baseUnit: 'm',
  taludUnit: '',
  KUnit: 'm',
  AUnit: 'm²',
  PUnit: 'm',
  RUnit: 'm',
  TUnit: 'm',
  DhUnit: 'm',

  prevDiametroUnit: 'm',
  prevTiranteUnit: 'm',
  prevBaseUnit: 'm',
  prevKUnit: 'm',
  prevAUnit: 'm²',
  prevPUnit: 'm',
  prevRUnit: 'm',
  prevTUnit: 'm',
  prevDhUnit: 'm',

  isManualEditA: false,
  isManualEditP: false,
  isManualEditR: false,
  isManualEditT: false,
  isManualEditDh: false,

  lockedField: null,
  invalidFields: [],
  autoCalculatedField: null,
  unknownVariable: null,

  resultPrincipal: 0,
});

const getDotColor = (hasUserValue: boolean, isInvalid: boolean, isAutoCalculated: boolean): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (isAutoCalculated) return 'rgba(62, 136, 255, 1)';
  if (hasUserValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

const GeometriaSeccionesCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  // Ref con el estado actual para evitar closures obsoletas en los handlers del teclado
  const stateRef = useRef<CalculatorState>(initialState());

  // Ref que mapea cada fieldId al handler completo de cambio de valor
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  // ─────────────────────────────────────────────────────────────────────────────

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

  const [state, setState] = useState<CalculatorState>(initialState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Animaciones
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  // Scroll view ref y input refs
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, View | null>>({});
  const activeInputIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeInputIdRef.current = activeInputId;
  }, [activeInputId]);

  useEffect(() => {
    if (!activeInputId) return;
    const viewRef = inputRefs.current[activeInputId];
    if (!viewRef || !scrollViewRef.current) return;

    setTimeout(() => {
      viewRef.measureLayout(
        scrollViewRef.current as any,
        (_x, y, _w, height) => {
          const KEYBOARD_HEIGHT = 280;
          const SCREEN_HEIGHT = Dimensions.get('window').height;
          const targetScrollY = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetScrollY), animated: true });
        },
        () => {}
      );
    }, 150);
  }, [activeInputId]);

  // DB y favoritos
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setActiveInputId(null);
      };
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
        const fav = await isFavorite(db, 'GeometriaSeccionesCalc');
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
      const route = 'GeometriaSeccionesCalc';
      const label = t('geometriaSeccionesCalc.title');
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

  // Actualizar campo bloqueado cuando cambian los valores
  useEffect(() => {
    updateLockedField();
  }, [
    state.sectionType,
    state.diametro, state.tirante, state.base, state.talud, state.K,
    state.A, state.P, state.R, state.T, state.Dh
  ]);

  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const decimalNum = new Decimal(num);
    const fixed = decimalNum.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'length' | 'area'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
    const decimalValue = new Decimal(cleanValue);
    const fromFactor = conversionFactors[category]?.[fromUnit];
    const toFactor = conversionFactors[category]?.[toUnit];
    if (!fromFactor || !toFactor) return value;
    const convertedValue = decimalValue.mul(new Decimal(fromFactor)).div(new Decimal(toFactor)).toNumber();
    return formatResult(convertedValue);
  }, [formatResult]);

  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Determina la lista de campos según el tipo de sección
  const getParameterFields = useCallback((): { id: string; label: string; unit: string; category: 'length' | 'area' }[] => {
    const fields: { id: string; label: string; unit: string; category: 'length' | 'area' }[] = [];
    switch (state.sectionType) {
      case 'circular-llena':
      case 'circular-parcial':
        fields.push({ id: 'diametro', label: t('geometriaSeccionesCalc.labels.diametro'), unit: state.diametroUnit, category: 'length' });
        if (state.sectionType === 'circular-parcial') {
          fields.push({ id: 'tirante', label: t('geometriaSeccionesCalc.labels.tirante'), unit: state.tiranteUnit, category: 'length' });
        }
        break;
      case 'rectangular':
        fields.push({ id: 'base', label: t('geometriaSeccionesCalc.labels.base'), unit: state.baseUnit, category: 'length' });
        fields.push({ id: 'tirante', label: t('geometriaSeccionesCalc.labels.tirante'), unit: state.tiranteUnit, category: 'length' });
        break;
      case 'trapezoidal':
        fields.push({ id: 'base', label: t('geometriaSeccionesCalc.labels.base'), unit: state.baseUnit, category: 'length' });
        fields.push({ id: 'tirante', label: t('geometriaSeccionesCalc.labels.tirante'), unit: state.tiranteUnit, category: 'length' });
        fields.push({ id: 'talud', label: t('geometriaSeccionesCalc.labels.talud'), unit: '', category: 'length' }); // talud es adimensional
        break;
      case 'triangular':
        fields.push({ id: 'tirante', label: t('geometriaSeccionesCalc.labels.tirante'), unit: state.tiranteUnit, category: 'length' });
        fields.push({ id: 'talud', label: t('geometriaSeccionesCalc.labels.talud'), unit: '', category: 'length' });
        break;
      case 'parabolico':
        fields.push({ id: 'tirante', label: t('geometriaSeccionesCalc.labels.tirante'), unit: state.tiranteUnit, category: 'length' });
        fields.push({ id: 'K', label: t('geometriaSeccionesCalc.labels.K'), unit: state.KUnit, category: 'length' });
        break;
    }
    return fields;
  }, [state.sectionType, state.diametroUnit, state.tiranteUnit, state.baseUnit, state.KUnit, t]);

  const getResultFields = useCallback((): { id: string; label: string; unit: string; category: 'area' | 'length' }[] => [
    { id: 'A', label: t('geometriaSeccionesCalc.labels.A'), unit: state.AUnit, category: 'area' },
    { id: 'P', label: t('geometriaSeccionesCalc.labels.P'), unit: state.PUnit, category: 'length' },
    { id: 'R', label: t('geometriaSeccionesCalc.labels.R'), unit: state.RUnit, category: 'length' },
    { id: 'T', label: t('geometriaSeccionesCalc.labels.T'), unit: state.TUnit, category: 'length' },
    { id: 'Dh', label: t('geometriaSeccionesCalc.labels.Dh'), unit: state.DhUnit, category: 'length' },
  ], [state.AUnit, state.PUnit, state.RUnit, state.TUnit, state.DhUnit, t]);

  const getAllFields = useCallback(() => {
    return [...getParameterFields(), ...getResultFields()];
  }, [getParameterFields, getResultFields]);

  // Actualiza el campo bloqueado (cuando exactamente un campo está vacío)
  const updateLockedField = useCallback(() => {
    const params = getParameterFields(); // Campos de entrada básicos
    const results = getResultFields();   // Campos de resultado
    
    // Contar cuántos campos de parámetros tienen valores válidos
    const filledParams = params.filter(({ id }) => {
      const value = (state as any)[id] as string;
      return value && value.trim() !== '' && !isNaN(parseFloat(value.replace(',', '.')));
    });

    // Contar cuántos campos de resultados tienen valores válidos
    const filledResults = results.filter(({ id }) => {
      const value = (state as any)[id] as string;
      return value && value.trim() !== '' && !isNaN(parseFloat(value.replace(',', '.')));
    });

    // REGLA 1: Si todos los parámetros básicos están llenos, bloquear TODOS los resultados
    if (filledParams.length === params.length) {
      setState(prev => ({ ...prev, lockedField: 'all-results' }));
      return;
    }

    // REGLA 2: Si hay exactamente UN resultado lleno y los parámetros NO están todos llenos
    if (filledResults.length === 1 && filledParams.length < params.length) {
      // El campo bloqueado será el parámetro que falta
      const missingParam = params.find(({ id }) => {
        const value = (state as any)[id] as string;
        return !value || value.trim() === '' || isNaN(parseFloat(value.replace(',', '.')));
      });
      setState(prev => ({ ...prev, lockedField: missingParam ? missingParam.id : null }));
      return;
    }
    setState(prev => ({ ...prev, lockedField: null }));
  }, [getParameterFields, getResultFields, state]);

  const getValuesInSI = useCallback((fields: { id: string; unit: string; category: string }[]) => {
    const siValues: { [key: string]: Decimal } = {};
    fields.forEach(({ id, unit, category }) => {
      const raw = (state as any)[id] as string;
      if (!raw) return;
      const num = parseFloat(raw.replace(',', '.'));
      if (isNaN(num)) return;
      let value = new Decimal(num);
      if (category !== 'none' && unit) {
        const factor = conversionFactors[category]?.[unit];
        if (factor) value = value.mul(new Decimal(factor));
      }
      siValues[id] = value;
    });
    return siValues;
  }, [state]);

  // Calcula todos los resultados a partir de los parámetros (modo directo)
  const computeAllResults = useCallback((): { A: Decimal; P: Decimal; R: Decimal; T: Decimal; Dh: Decimal } | null => {
    const params = getParameterFields();
    const siParams = getValuesInSI(params);

    // Verificar que todos los parámetros necesarios estén presentes
    for (const p of params) {
      if (!siParams[p.id]) return null;
    }

    const D = siParams.diametro ? siParams.diametro.toNumber() : undefined;
    const y = siParams.tirante ? siParams.tirante.toNumber() : undefined;
    const b = siParams.base ? siParams.base.toNumber() : undefined;
    const z = siParams.talud ? siParams.talud.toNumber() : undefined;
    const K = siParams.K ? siParams.K.toNumber() : undefined;

    let A: number, P: number, T: number;
    switch (state.sectionType) {
      case 'circular-llena':
        if (!D) return null;
        A = Math.PI * D * D / 4;
        P = Math.PI * D;
        T = D;
        break;
      case 'circular-parcial':
        if (!D || !y) return null;
        ({ A, P, T } = circularParcial(D, y));
        break;
      case 'rectangular':
        if (!b || !y) return null;
        A = b * y;
        P = b + 2 * y;
        T = b;
        break;
      case 'trapezoidal':
        if (!b || !y || z === undefined) return null;
        A = (b + z * y) * y;
        P = b + 2 * y * Math.sqrt(1 + z * z);
        T = b + 2 * z * y;
        break;
      case 'triangular':
        if (!y || z === undefined) return null;
        A = z * y * y;
        P = 2 * y * Math.sqrt(1 + z * z);
        T = 2 * z * y;
        break;
      case 'parabolico':
        if (!y || !K) return null;
        // T = K * sqrt(y); A = (2/3)*T*y; P ≈ T + (8*y^2)/(3*T) (aprox)
        T = K * Math.sqrt(y);
        A = (2 / 3) * T * y;
        P = T + (8 * y * y) / (3 * T);
        break;
      default:
        return null;
    }
    const R = A / P;
    const Dh = A / T;

    return {
      A: new Decimal(A),
      P: new Decimal(P),
      R: new Decimal(R),
      T: new Decimal(T),
      Dh: new Decimal(Dh),
    };
  }, [state.sectionType, getParameterFields, getValuesInSI]);

  // Resuelve el campo faltante (modo continuidad)
  const solveForUnknown = useCallback((missingId: string): Decimal | null => {
    const allFields = getAllFields();
    const siValues = getValuesInSI(allFields);

    // Construir un objeto con los valores conocidos (en SI)
    const known: any = {};
    allFields.forEach(f => {
      if (f.id !== missingId && siValues[f.id]) {
        known[f.id] = siValues[f.id].toNumber();
      }
    });

    // Llamar al solver específico de la sección
    try {
      let result: number | null = null;
      switch (state.sectionType) {
        case 'circular-llena':
          // Solo tiene diámetro y resultados; resolver es algebraico
          if (missingId === 'diametro') {
            if (known.A) result = Math.sqrt(known.A * 4 / Math.PI);
            else if (known.P) result = known.P / Math.PI;
            else if (known.T) result = known.T;
          } else if (missingId === 'A') {
            if (known.diametro) result = Math.PI * known.diametro * known.diametro / 4;
          } else if (missingId === 'P') {
            if (known.diametro) result = Math.PI * known.diametro;
          } else if (missingId === 'T') {
            if (known.diametro) result = known.diametro;
          } else if (missingId === 'R') {
            if (known.diametro) result = known.diametro / 4;
          } else if (missingId === 'Dh') {
            if (known.diametro) result = known.diametro;
          }
          break;
        case 'circular-parcial':
          if (missingId === 'tirante') {
            // Necesitamos resolver y a partir de A, P o T
            if (known.A) result = solveTiranteCircularParcialDesdeArea(known.diametro, known.A);
            else if (known.P) result = solveTiranteCircularParcialDesdePerimetro(known.diametro, known.P);
            else if (known.T) result = solveTiranteCircularParcialDesdeAncho(known.diametro, known.T);
          } else {
            // Los resultados se pueden calcular algebraicamente si se conoce y
            if (known.tirante) {
              const { A, P, T } = circularParcial(known.diametro, known.tirante);
              if (missingId === 'A') result = A;
              else if (missingId === 'P') result = P;
              else if (missingId === 'T') result = T;
              else if (missingId === 'R') result = A / P;
              else if (missingId === 'Dh') result = A / T;
            }
          }
          break;
        case 'rectangular':
          // Implementar solvers para rectangular
          if (missingId === 'base') {
            if (known.A && known.tirante) result = known.A / known.tirante;
            else if (known.P && known.tirante) result = known.P - 2 * known.tirante;
            else if (known.T) result = known.T;
          } else if (missingId === 'tirante') {
            if (known.A && known.base) result = known.A / known.base;
            else if (known.P && known.base) result = (known.P - known.base) / 2;
          } else if (missingId === 'A') {
            if (known.base && known.tirante) result = known.base * known.tirante;
          } else if (missingId === 'P') {
            if (known.base && known.tirante) result = known.base + 2 * known.tirante;
          } else if (missingId === 'T') {
            if (known.base) result = known.base;
          } else if (missingId === 'R') {
            if (known.A && known.P) result = known.A / known.P;
          } else if (missingId === 'Dh') {
            if (known.A && known.T) result = known.A / known.T;
          }
          break;
        case 'trapezoidal':
          // Nota: Para trapezoidal algunos despejes son más complejos, se implementan los algebraicos simples
          if (missingId === 'base') {
            if (known.A && known.tirante && known.z) result = (known.A / known.tirante) - known.z * known.tirante;
            else if (known.T && known.tirante && known.z) result = known.T - 2 * known.z * known.tirante;
          } else if (missingId === 'tirante') {
            // Ecuación cuadrática: (z)*y² + b*y - A = 0
            if (known.A && known.base && known.z !== undefined) {
              const a = known.z;
              const b = known.base;
              const c = -known.A;
              const discriminant = b * b - 4 * a * c;
              if (discriminant >= 0) {
                result = (-b + Math.sqrt(discriminant)) / (2 * a);
              }
            } else if (known.T && known.base && known.z !== undefined) {
              // T = b + 2*z*y => y = (T - b)/(2*z)
              if (known.z !== 0) result = (known.T - known.base) / (2 * known.z);
            }
          } else if (missingId === 'A') {
            if (known.base && known.tirante && known.z !== undefined) {
              result = (known.base + known.z * known.tirante) * known.tirante;
            }
          } else if (missingId === 'P') {
            if (known.base && known.tirante && known.z !== undefined) {
              result = known.base + 2 * known.tirante * Math.sqrt(1 + known.z * known.z);
            }
          } else if (missingId === 'T') {
            if (known.base && known.tirante && known.z !== undefined) {
              result = known.base + 2 * known.z * known.tirante;
            }
          } else if (missingId === 'R') {
            if (known.A && known.P) result = known.A / known.P;
          } else if (missingId === 'Dh') {
            if (known.A && known.T) result = known.A / known.T;
          }
          break;
        case 'triangular':
          if (missingId === 'tirante') {
            if (known.A && known.z !== undefined) result = Math.sqrt(known.A / known.z);
            else if (known.T && known.z !== undefined) result = known.T / (2 * known.z);
            else if (known.P && known.z !== undefined) result = known.P / (2 * Math.sqrt(1 + known.z * known.z));
          } else if (missingId === 'talud') {
            if (known.A && known.tirante) result = known.A / (known.tirante * known.tirante);
            else if (known.T && known.tirante) result = known.T / (2 * known.tirante);
            else if (known.P && known.tirante) {
              const halfP = known.P / (2 * known.tirante);
              result = Math.sqrt(halfP * halfP - 1);
            }
          } else if (missingId === 'A') {
            if (known.tirante && known.z !== undefined) result = known.z * known.tirante * known.tirante;
          } else if (missingId === 'P') {
            if (known.tirante && known.z !== undefined) result = 2 * known.tirante * Math.sqrt(1 + known.z * known.z);
          } else if (missingId === 'T') {
            if (known.tirante && known.z !== undefined) result = 2 * known.z * known.tirante;
          } else if (missingId === 'R') {
            if (known.A && known.P) result = known.A / known.P;
          } else if (missingId === 'Dh') {
            if (known.A && known.T) result = known.A / known.T;
          }
          break;
        case 'parabolico':
          if (missingId === 'tirante') {
            if (known.A && known.K) result = solveTiranteParabolicoDesdeArea(known.K, known.A);
            else if (known.T && known.K) result = solveTiranteParabolicoDesdeAncho(known.K, known.T);
          } else if (missingId === 'K') {
            if (known.tirante && known.A) result = (3 * known.A) / (2 * Math.pow(known.tirante, 3/2));
            else if (known.tirante && known.T) result = known.T / Math.sqrt(known.tirante);
          } else if (missingId === 'A') {
            if (known.tirante && known.K) {
              const T = known.K * Math.sqrt(known.tirante);
              result = (2/3) * T * known.tirante;
            }
          } else if (missingId === 'P') {
            if (known.tirante && known.K) {
              const T = known.K * Math.sqrt(known.tirante);
              result = T + (8 * known.tirante * known.tirante) / (3 * T);
            }
          } else if (missingId === 'T') {
            if (known.tirante && known.K) result = known.K * Math.sqrt(known.tirante);
          } else if (missingId === 'R') {
            if (known.A && known.P) result = known.A / known.P;
          } else if (missingId === 'Dh') {
            if (known.A && known.T) result = known.A / known.T;
          }
          break;
        default:
          break;
      }
      return result !== null ? new Decimal(result) : null;
    } catch (e) {
      return null;
    }
  }, [state.sectionType, getAllFields, getValuesInSI]);

  // Cálculo principal
  const handleCalculate = useCallback(() => {
    const params = getParameterFields();
    const results = getResultFields();
    const allFields = [...params, ...results];
    
    // Obtener valores en SI
    const siValues = getValuesInSI(allFields);
    
    // Caso 1: Todos los parámetros básicos están llenos -> calcular todos los resultados
    const filledParams = params.filter(p => siValues[p.id]);
    // En handleCalculate, dentro del Caso 1 (todos los parámetros llenos)
    if (filledParams.length === params.length) {
      const computedResults = computeAllResults();
      if (!computedResults) {
        setState(prev => ({ 
          ...prev, 
          invalidFields: params.map(p => p.id),
          unknownVariable: null 
        }));
        return;
      }
    
      // Actualizar todos los resultados
      const newState: Partial<CalculatorState> = {};
      results.forEach(r => {
        const valSI = computedResults[r.id as keyof typeof computedResults] as Decimal;
        const factor = conversionFactors[r.category]?.[r.unit] || 1;
        const valInUnit = valSI.div(new Decimal(factor)).toNumber();
        newState[r.id as keyof CalculatorState] = formatResult(valInUnit) as any;
        // Marcar como calculado automático
        const manualFlag = `isManualEdit${r.id.toUpperCase()}` as keyof CalculatorState;
        (newState as any)[manualFlag] = false;
      });
    
      // AÑADIR ESTAS LÍNEAS: Marcar el primer resultado como autoCalculatedField para que el dot se ponga azul
      if (results.length > 0) {
        newState.autoCalculatedField = results[0].id;
      }
    
      // Resultado principal (por ejemplo R)
      const rFactor = conversionFactors.length[state.RUnit] || 1;
      newState.resultPrincipal = computedResults.R.div(rFactor).toNumber();
      newState.unknownVariable = null;
      newState.invalidFields = [];
    
      setState(prev => ({ ...prev, ...newState }));
      return;
    }

    // Caso 2: Un resultado lleno + algunos parámetros -> calcular el parámetro faltante
    const filledResults = results.filter(r => siValues[r.id]);
    if (filledResults.length === 1 && filledParams.length === params.length - 1) {
      const missingParam = params.find(p => !siValues[p.id]);
      if (!missingParam) return;
    
      const solvedValue = solveForUnknown(missingParam.id);
      if (!solvedValue) {
        setState(prev => ({ 
          ...prev, 
          invalidFields: [missingParam.id],
          unknownVariable: null 
        }));
        return;
      }
    
      // Convertir a la unidad del parámetro
      const factor = conversionFactors[missingParam.category]?.[(state as any)[`${missingParam.id}Unit`]] || 1;
      const valueInUnit = solvedValue.div(new Decimal(factor)).toNumber();
    
      // MODIFICAR: Incluir autoCalculatedField en el update
      setState(prev => ({
        ...prev,
        [missingParam.id]: formatResult(valueInUnit),
        // AÑADIR: Marcar el campo calculado
        autoCalculatedField: missingParam.id,
        unknownVariable: {
          name: missingParam.id,
          label: missingParam.label,
          unit: (state as any)[`${missingParam.id}Unit`],
          value: formatResult(valueInUnit)
        },
        invalidFields: []
      }));
      return;
    }

    // Caso 3: Configuración no válida
    setState(prev => ({ 
      ...prev, 
      invalidFields: allFields
        .filter(f => !siValues[f.id])
        .map(f => f.id),
      unknownVariable: null 
    }));
  }, [state, getParameterFields, getResultFields, getValuesInSI, computeAllResults, solveForUnknown, formatResult]);

  const formatDisplayValue = useCallback((val: string): string => {
    if (!val || val === '') return val;

    // Si el último carácter es un punto o coma, mantenerlo como está
    const lastChar = val.charAt(val.length - 1);
    if (lastChar === '.' || lastChar === ',') {
      return val;
    }

    // Si el valor termina con punto decimal (ej: "0."), mantenerlo
    if (val.includes('.') && val.split('.')[1] === '') {
      return val;
    }
    if (val.includes(',') && val.split(',')[1] === '') {
      return val;
    }

    const normalizedVal = val.replace(',', '.');

    // Verificar si el usuario escribió específicamente "0.0"
    if (normalizedVal === '0.0') {
      return selectedDecimalSeparator === 'Coma' ? '0,0' : '0.0';
    }

    const num = parseFloat(normalizedVal);
    if (isNaN(num)) return val;

    // Detectar cuántos decimales escribió el usuario
    const decimalPart = normalizedVal.includes('.') ? normalizedVal.split('.')[1] : '';
    const userDecimalCount = decimalPart.length;

    // Si el usuario no escribió decimales, formatear como entero
    if (userDecimalCount === 0) {
      return selectedDecimalSeparator === 'Coma' 
        ? num.toString().replace('.', ',') 
        : num.toString();
    }

    // Si el usuario escribió decimales, mantener exactamente esa cantidad
    const formatted = num.toFixed(userDecimalCount);
    return selectedDecimalSeparator === 'Coma' 
      ? formatted.replace('.', ',') 
      : formatted;
  }, [selectedDecimalSeparator]);

  // Agregar esta función auxiliar:
  const isResultEditable = useCallback((resultId: string): boolean => {
    const params = getParameterFields();
    const filledParams = params.filter(p => {
      const val = (state as any)[p.id];
      return val && val.trim() !== '' && !isNaN(parseFloat(val.replace(',', '.')));
    });

    // Si todos los parámetros están llenos, los resultados NO son editables
    if (filledParams.length === params.length) {
      return false;
    }

    // Si hay exactamente un resultado lleno, los otros resultados NO son editables
    const results = getResultFields();
    const filledResults = results.filter(r => {
      const val = (state as any)[r.id];
      return val && val.trim() !== '' && !isNaN(parseFloat(val.replace(',', '.')));
    });

    if (filledResults.length === 1 && filledResults[0].id !== resultId) {
      return false;
    }

    return true;
  }, [getParameterFields, getResultFields, state]);

  const handleClear = useCallback(() => {
    setState({
      ...initialState(),
      autoCalculatedField: null, // Aunque initialState ya lo tiene en null, por seguridad
    });
  }, []);

  const handleCopy = useCallback(() => {
    let textToCopy = '';
    const resultValue = state.resultPrincipal;
    const formattedResult = isNaN(resultValue) ? '0' : formatResult(resultValue);
    textToCopy += `${t('geometriaSeccionesCalc.result')}: ${formattedResult} ${state.RUnit}\n`;
    textToCopy += `${t('geometriaSeccionesCalc.sectionType')}: ${t(`geometriaSeccionesCalc.options.sectionType.${state.sectionType}`)}\n`;
    const params = getParameterFields();
    params.forEach(p => {
      const val = (state as any)[p.id];
      if (val) textToCopy += `${p.label}: ${val} ${p.unit}\n`;
    });
    const results = getResultFields();
    results.forEach(r => {
      const val = (state as any)[r.id];
      if (val) textToCopy += `${r.label}: ${val} ${r.unit}\n`;
    });
    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('geometriaSeccionesCalc.toasts.copied') });
  }, [state, getParameterFields, getResultFields, formatResult, t]);

  const handleSaveHistory = useCallback(async () => {
    if (state.resultPrincipal === 0 && !state.unknownVariable) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('geometriaSeccionesCalc.toasts.nothingToSave') });
      return;
    }
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        dbRef.current = db;
      }
      const inputs = {
        sectionType: state.sectionType,
        diametro: state.diametro,
        diametroUnit: state.diametroUnit,
        tirante: state.tirante,
        tiranteUnit: state.tiranteUnit,
        base: state.base,
        baseUnit: state.baseUnit,
        talud: state.talud,
        K: state.K,
        KUnit: state.KUnit,
        A: state.A,
        AUnit: state.AUnit,
        P: state.P,
        PUnit: state.PUnit,
        R: state.R,
        RUnit: state.RUnit,
        T: state.T,
        TUnit: state.TUnit,
        Dh: state.Dh,
        DhUnit: state.DhUnit,
      };
      const result = state.unknownVariable?.value || formatResult(state.resultPrincipal);
      await saveCalculation(db, 'GeometriaSecciones_dimensions', JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('geometriaSeccionesCalc.toasts.saved') });
    } catch (error) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('geometriaSeccionesCalc.toasts.saveError') });
    }
  }, [state, formatResult, t]);

  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenGeometria', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // ── Handlers del teclado custom ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;
    // Mapa de fieldId a propiedad del estado
    const map: Record<string, string> = {
      diametro: s.diametro,
      tirante: s.tirante,
      base: s.base,
      talud: s.talud,
      K: s.K,
      A: s.A,
      P: s.P,
      R: s.R,
      T: s.T,
      Dh: s.Dh,
    };
    return map[id] ?? '';
  }, []);

  const handleKeyboardKey = useCallback((key: string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    handler(getActiveValue() + key);
  }, []);

  const handleKeyboardDelete = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    handler(getActiveValue().slice(0, -1));
  }, []);

  const handleKeyboardClear = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    handler('');
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const val = getActiveValue();
    if (val === '' || val === '.') return;
    handler((parseFloat(val) * 10).toString());
  }, []);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const val = getActiveValue();
    if (val === '' || val === '.') return;
    handler((parseFloat(val) / 10).toString());
  }, []);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);
  // ─────────────────────────────────────────────────────────────────────────────

  // Render de un campo de entrada (similar a EnergiaBernoulliCalc)
  const renderInput = useCallback((
    id: string,
    label: string,
    value: string,
    unit: string,
    category: 'length' | 'area' | 'none',
    onChange: (text: string) => void,
    setManualEdit?: (val: boolean) => void,
    resultValue?: string,
  ) => {
    const isFieldLocked = (() => {
      if (state.lockedField === 'all-results') {
        // Si es un campo de resultado y todos los parámetros están llenos
        const resultIds = getResultFields().map(f => f.id);
        return resultIds.includes(id);
      }
      // Si es un parámetro específico que está bloqueado
      return state.lockedField === id;
    })();
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;
    const hasUserValue = value?.trim()?.length > 0;
    const isInvalid = state.invalidFields.includes(id);
    const isAutoCalculated = (() => {
      // Si el campo actual es el que se acaba de calcular automáticamente
      if (state.autoCalculatedField === id) return true;
        
      // Si es un resultado y tiene valor pero no fue editado manualmente
      const resultIds = getResultFields().map(f => f.id);
      if (resultIds.includes(id)) {
        const manualFlag = `isManualEdit${id.toUpperCase()}` as keyof CalculatorState;
        const isManual = (state as any)[manualFlag];
        // Tiene valor y no fue editado manualmente
        if (value && value.trim() !== '' && !isManual) return true;
      }
      return false;
    })();
    const dotColor = getDotColor(hasUserValue, isInvalid, isAutoCalculated);

    const handleTextChange = (text: string) => {
      onChange(text);
      if (setManualEdit) setManualEdit(true);
      setState(prev => ({
        ...prev,
        invalidFields: prev.invalidFields.filter(f => f !== id),
        autoCalculatedField: prev.autoCalculatedField === id ? null : prev.autoCalculatedField,
        unknownVariable: prev.unknownVariable?.name === id ? null : prev.unknownVariable,
      }));
    };

    // Registrar el handler completo del campo en el ref para que el teclado lo use
    if (id) {
      inputHandlersRef.current[id] = (text: string) => {
        handleTextChange(text);
      };
    }

    // Para visualización, aplicar formato de 8 decimales máximo
    const rawValue = resultValue && resultValue !== '' ? resultValue : value;
    const displayValue = formatDisplayValue(rawValue);

    return (
      <View
        ref={(r) => { if (id) inputRefs.current[id] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{label}</Text>
          <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.redContainer}>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: inputContainerBg }]}>
              <Pressable
                onPress={() => {
                  if (isFieldLocked || !id) return;
                  setActiveInputId(id);
                }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                value={displayValue}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
          <Pressable
            style={[styles.Container2, { experimental_backgroundImage: themeColors.gradient }]}
            onPress={() => {
              navigateToOptions(category, (option: string) => {
                const prevUnitField = `prev${id.charAt(0).toUpperCase() + id.slice(1)}Unit` as keyof CalculatorState;
                const prevUnit = state[prevUnitField] as string || unit;
                const converted = convertValue(value, prevUnit, option, category as any);
                setState(prev => {
                  let updatedUnknown = prev.unknownVariable;
                  if (updatedUnknown && updatedUnknown.name === id) {
                    updatedUnknown = { ...updatedUnknown, unit: option, value: converted };
                  }
                  return {
                    ...prev,
                    [id]: converted,
                    [prevUnitField]: option,
                    [`${id}Unit`]: option,
                    unknownVariable: updatedUnknown,
                  } as any;
                });
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
  }, [state, themeColors, currentTheme, fontSizeFactor, convertValue, navigateToOptions, formatDisplayValue, setActiveInputId]);

  // Render del selector de tipo de sección (usando el estilo de picker de ContinuidadCalc)
  const renderSectionTypePicker = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('geometriaSeccionesCalc.labels.sectionType')}
      </Text>
      <Pressable
        style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
        onPress={() => {
          navigateToOptions('sectionType', (option: string) => {
            setState(prev => ({ 
              ...prev, 
              sectionType: option as SectionType,
              autoCalculatedField: null,
              unknownVariable: null 
            }));
          }, state.sectionType);
        }}
      >
        <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t(`geometriaSeccionesCalc.options.sectionType.${state.sectionType}`)}
          </Text>
          <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
        </View>
      </Pressable>
    </View>
  ), [themeColors, t, fontSizeFactor, state.sectionType, navigateToOptions]);

  // Render de los campos de parámetros según la sección
  const renderParameterInputs = useCallback(() => {
    const params = getParameterFields();
    return params.map(p => {
      // Agregar un React.Fragment o View con key
      const inputElement = renderInput(
        p.id,
        p.label,
        (state as any)[p.id] as string,
        p.unit,
        p.category,
        (text) => setState(prev => ({ ...prev, [p.id]: text } as any)),
        undefined,
        undefined
      );

      // Envolver con key
      return (
        <View key={`param-${p.id}`} style={{ width: '100%' }}>
          {inputElement}
        </View>
      );
    });
  }, [getParameterFields, renderInput, state]);

  // Render de los campos de resultados
  const renderResultInputs = useCallback(() => {
    const results = getResultFields();
    return results.map(r => {
      const editable = isResultEditable(r.id);
      const inputElement = renderInput(
        r.id,
        r.label,
        (state as any)[r.id] as string,
        r.unit,
        r.category,
        (text) => {
          if (editable) {
            setState(prev => ({ ...prev, [r.id]: text } as any));
          }
        },
        (val) => {
          if (editable) {
            const flag = `isManualEdit${r.id.toUpperCase()}` as keyof CalculatorState;
            setState(prev => ({ ...prev, [flag]: val } as any));
          }
        },
        (state.autoCalculatedField === r.id && !(state as any)[`isManualEdit${r.id.toUpperCase()}`]) 
          ? (state as any)[r.id] 
          : undefined
      );
      
      return (
        <View key={`result-${r.id}`} style={{ width: '100%' }}>
          {inputElement}
        </View>
      );
    });
  }, [getResultFields, renderInput, state, isResultEditable]);

  // Obtener etiqueta del resultado principal
  const getMainResultLabel = useCallback(() => {
    if (state.unknownVariable) {
      const unit = state.unknownVariable.unit ? ` (${state.unknownVariable.unit})` : '';
      return `${state.unknownVariable.label} ${unit}`;
    }
    return t('geometriaSeccionesCalc.result');
  }, [state.unknownVariable, t]);

  const getMainResultValue = useCallback(() => {
    let rawValue: string;
    
    if (state.unknownVariable) {
      rawValue = state.unknownVariable.value || '0';
    } else {
      rawValue = formatResult(state.resultPrincipal) || '0';
    }

    return formatDisplayValue(rawValue);
  }, [state.unknownVariable, state.resultPrincipal, formatResult, formatDisplayValue]);

  const shouldShowPlaceholderLabel = useCallback(() => {
    if (state.unknownVariable) return false;
    return state.resultPrincipal === 0;
  }, [state.unknownVariable, state.resultPrincipal]);

  const isKeyboardOpen = !!activeInputId;

  return (
    <View style={styles.safeArea}>
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInset={{ bottom: isKeyboardOpen ? 280 : 0 }}
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
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => { bounceHeart(); toggleFavorite(); }}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <IconFavorite name={isFav ? "heart" : "heart-o"} size={20} color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"} />
                </Animated.View>
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('GeometriaSeccionesTheory')}>
                <Icon name="cloud-off" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('geometriaSeccionesCalc.calculator')}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('geometriaSeccionesCalc.title')}</Text>
        </View>

        {/* Panel de resultado principal */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('energiaBernoulliCalc.saveToHistory')}</Text>
                <Icon name="plus" size={16 * fontSizeFactor} color="rgba(255, 255, 255, 0.4)" style={styles.plusIcon} />
              </View>
              <View style={styles.imageContainer}>
                <View style={styles.flowContainer}>
                  <FastImage source={backgroundImage} style={StyleSheet.absoluteFillObject} />
                  {currentTheme === 'dark' && (
                    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(0,0,0,0.7)' }} />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text style={[styles.flowLabel, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 16 * fontSizeFactor }]}>
                      {shouldShowPlaceholderLabel() ? 'な' : getMainResultLabel()}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text style={[styles.flowValue, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }]}>
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
            { icon: 'clock', label: t('common.history'), action: () => navigation.navigate('HistoryScreenGeometriaSecciones') },
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

        {/* Sección de inputs */}
        <View
          style={[
            styles.inputsSection,
            { 
              backgroundColor: themeColors.card,
              paddingBottom: isKeyboardOpen ? 330 : 70,
            }
          ]}
        >

          {/* Selector de tipo de sección (picker) */}
          {renderSectionTypePicker()}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* Parámetros Geométricos */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('geometriaSeccionesCalc.paramsSection')}
          </Text>
          {renderParameterInputs()}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* Resultados Geométricos */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('geometriaSeccionesCalc.resultsSection')}
          </Text>
          {renderResultInputs()}
        </View>
      </Animated.ScrollView>

      {/* ── Teclado custom ── renderizado fuera del ScrollView para quedar siempre visible en el fondo */}
      {isKeyboardOpen && (
        <View style={styles.customKeyboardWrapper}>
          <CustomKeyboardPanel
            onKeyPress={handleKeyboardKey}
            onDelete={handleKeyboardDelete}
            onSubmit={handleKeyboardSubmit}
            onMultiplyBy10={handleKeyboardMultiply10}
            onDivideBy10={handleKeyboardDivide10}
            onClear={handleKeyboardClear}
          />
        </View>
      )}

      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

// Estilos (copiados exactamente de EnergiaBernoulliCalc y ContinuidadCalc, con algunos ajustes)
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 1)' 
  },
  labelRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-start', 
    gap: 5 
  },
  valueDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 5, 
    backgroundColor: 'rgb(194, 254, 12)', 
    marginLeft: 0, 
    marginBottom: 1 
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
    paddingHorizontal: 12 
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
  checkboxContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10, 
    marginTop: 5 
  },
  checkbox: { 
    width: 24, 
    height: 24, 
    borderRadius: 5, 
    borderWidth: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  checkboxLabel: { 
    fontFamily: 'SFUIDisplay-Medium' 
  },
  // ── Teclado custom ──────────────────────────────────────────────────────────
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
});

export default GeometriaSeccionesCalc;