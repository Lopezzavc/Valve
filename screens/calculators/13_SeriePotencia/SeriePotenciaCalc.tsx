import React, { useState, useRef, useContext, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Clipboard,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import IconExpand from 'react-native-vector-icons/Ionicons';
import MaskedView from '@react-native-masked-view/masked-view';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CalculatorOptionsScreenParams, buildCalculatorOptionsParams } from '../../01_options/optionsConfig';
import { UNIT_FACTORS } from '../../01_options/unitCatalog';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from '@d11/react-native-fast-image';
import Decimal from 'decimal.js';
import {
  getDBConnection,
  createTable,
  saveCalculation,
  createFavoritesTable,
  isFavorite,
  addFavorite,
  removeFavorite,
} from '../../../src/services/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../../src/components/CustomKeyboardInput';
import {
  appendKeyboardKey,
  clearKeyboardValue,
  deleteKeyboardKey,
  formatKeyboardDisplayValue,
  insertKeyboardMinus,
  insertScientificNotation,
} from '../../../src/components/customKeyboardHelpers';

const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark  = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ─────────────────────────────────────────────────────────
type RootStackParamList = {
  [key: string]: object | undefined;
  CalculatorOptionsScreen: CalculatorOptionsScreenParams;
};

// ─── Toast config ─────────────────────────────────────────────────────────────
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

// ─── Dot color helper ─────────────────────────────────────────────────────────
const getDotColor = (hasValue: boolean, isInvalid: boolean): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (hasValue)  return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ─── Conversion factors ───────────────────────────────────────────────────────
const conversionFactors = UNIT_FACTORS;


// ─── Domain types ─────────────────────────────────────────────────────────────
interface Tramo {
  id: number;
  D: string;
  DUnit: string;
  L: string;
  LUnit: string;
  ks: string;
  ksUnit: string;
  Km: string;
  Q: string;
  QUnit: string;
}

interface TramoResult {
  D: number;
  L: number;
  Q: number;
  V: number;
  Re: number;
  f: number;
  hf: number;
  hm: number;
  h_total: number;
}

interface CalcResult {
  H_total: number;
  P: number;
  Q_entrada: number;
  tramosData: TramoResult[];
}

interface CalculatorState {
  eficiencia: string;
  densidad: string;
  densidadUnit: string;
  viscosidad: string;
  viscosidadUnit: string;
  cabeza: string;
  cabezaUnit: string;
  tramos: Tramo[];
  invalidFields: string[];
  calcResult: CalcResult | null;
}

// ─── Friction factor functions (exact port from serie_potencia.py) ─────────────

/** Régimen laminar: f = 64 / Re */
function friccionLaminar(Re: number): number {
  return 64.0 / Re;
}

/**
 * Régimen turbulento: iteración de Colebrook-White (31 iteraciones).
 * f_{n+1} = (-2·log10( ε/(3.7·D) + 2.51/(Re·√f_n) ))^{-2}
 * Valor inicial: f₀ ≈ 0.02 (equivalente al F0_TURBULENTO del script Python).
 */
function friccionTurbulento(D: number, eps: number, Re: number): number {
  let f = 0.02;
  for (let i = 0; i < 31; i++) {
    const inner = eps / (3.7 * D) + 2.51 / (Re * Math.sqrt(f));
    if (inner <= 0) break;
    f = Math.pow(-2.0 * Math.log10(inner), -2);
  }
  return f;
}

/**
 * Zona de transición (2000 ≤ Re ≤ 4000):
 * Interpolación polinómica cúbica entre laminar y turbulento
 * (mismo algoritmo que el script Python).
 */
function friccionTransicion(D: number, eps: number, Re: number): number {
  const rel  = eps / D;
  const A4000 = rel / 3.7 + 5.74 / Math.pow(4000.0, 0.9);
  const B    = -0.86859 * Math.log(A4000);
  const F4   = Math.pow(B, -2);
  const A_Re = rel / 3.7 + 5.74 / Math.pow(Re, 0.9);
  const t    = Re / 2000.0;
  const Pc   = (2.0 - 0.00514215 / (A_Re * B)) * F4;
  const c1   =  7.0 * F4 - Pc;
  const c2   =  0.128 - 17.0 * F4 + 2.5 * Pc;
  const c3   = -0.128 + 13.0 * F4 - 2.0 * Pc;
  const c4   = (0.032 -  3.0 * F4 + 0.5 * Pc) * t;
  return c1 + t * (c2 + t * (c3 + c4));
}

function factorFriccion(D: number, eps: number, Re: number): number {
  if (Re < 2000.0)  return friccionLaminar(Re);
  if (Re <= 4000.0) return friccionTransicion(D, eps, Re);
  return friccionTurbulento(D, eps, Re);
}

/**
 * Cálculo directo serie-potencia (port exacto de serie_potencia.py).
 *
 * Acumulación de caudal:
 *   Q_acum[n]   = caudales[n-1]  (último tramo entrega su propio caudal)
 *   Q_acum[i]   = Q_acum[i+1] + caudales[i-1]  (suma hacia aguas arriba)
 *
 * Por cada tramo i (1-indexado):
 *   V   = (4/π)·Q_acum[i] / D²
 *   Re  = V·D·ρ / μ
 *   f   = factor_friccion(D, ε, Re)
 *   hf  = f·(L/D)·V²/(2g)
 *   hm  = K·V²/(2g)
 *
 * Resultados finales:
 *   H_total = cabeza_pa · (1/9806.65_aprox) + Σ(hf+hm)
 *   P [kW]  = ρ · Q_entrada · g · H_total / (η · 1000)
 */
function calcularSeriePotencia(
  eficienciaPct: number,
  densidadSI:   number,
  viscosidadSI: number,
  cabezaM:      number,
  tramosInput:  { D: number; L: number; ks: number; Km: number; Q: number }[]
): CalcResult {
  const G   = 9.806;
  const eta = eficienciaPct / 100.0;
  const n   = tramosInput.length;

  // Acumulación de caudal de aguas abajo hacia arriba
  const Q_acum = new Array(n + 1).fill(0);
  Q_acum[n] = tramosInput[n - 1].Q;
  for (let i = n - 1; i >= 1; i--) {
    Q_acum[i] = Q_acum[i + 1] + tramosInput[i - 1].Q;
  }

  // Conversión cabeza: m → Pa → m (factor exacto del script Python)
  const cabeza_pa = cabezaM * 9806.0;
  let suma_h = 0.0;
  const tramosData: TramoResult[] = [];

  for (let i = 1; i <= n; i++) {
    const { D, L, ks, Km } = tramosInput[i - 1];
    const Q  = Q_acum[i];
    const V  = D > 0 ? (4.0 / Math.PI) * Q / (D * D) : 0;
    const Re = V > 0 && D > 0 ? (V * D * densidadSI) / viscosidadSI : 0;
    const f  = Re > 0 ? factorFriccion(D, ks, Re) : 0;
    const hf = D > 0 ? f * (L / D) * (V * V) / (2.0 * G) : 0;
    const hm = Km * (V * V) / (2.0 * G);
    suma_h += hf + hm;
    tramosData.push({ D, L, Q, V, Re, f, hf, hm, h_total: hf + hm });
  }

  const H_total = cabeza_pa * 0.000101978380583316 + suma_h;
  const P       = (densidadSI * Q_acum[1] * G * H_total) / (eta * 1000.0);

  return { H_total, P, Q_entrada: Q_acum[1], tramosData };
}

// ─── Factory helpers ──────────────────────────────────────────────────────────
const createNewTramo = (): Tramo => ({
  id:     Date.now() + Math.random(),
  D:      '',
  DUnit:  'mm',
  L:      '',
  LUnit:  'm',
  ks:     '',
  ksUnit: 'mm',
  Km:     '',
  Q:      '',
  QUnit:  'm³/s',
});

const initialState = (): CalculatorState => ({
  eficiencia:     '',
  densidad:       '',
  densidadUnit:   'kg/m³',
  viscosidad:     '',
  viscosidadUnit: 'Pa·s',
  cabeza:         '',
  cabezaUnit:     'm',
  tramos:         [createNewTramo(), createNewTramo()],
  invalidFields:  [],
  calcResult:     null,
});

// ─── Main component ───────────────────────────────────────────────────────────
const withSymbol = (label: string, symbol: string): string => `${label} (${symbol})`;

const SeriePotenciaCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber }            = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor }          = useContext(FontSizeContext);
  const { currentTheme }            = useTheme();
  const { t }                       = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  const stateRef        = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});

  // ── Theme palette ─────────────────────────────────────────────────────────────
  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card:          'rgb(24,24,24)',
        text:          'rgb(235,235,235)',
        textStrong:    'rgb(250,250,250)',
        separator:     'rgba(255,255,255,0.12)',
        icon:          'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        gradient2:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient:  'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        cardGradient2: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        tableHeader:   'rgba(45,45,45,1)',
        tableBorder:   'rgba(255,255,255,0.1)',
      };
    }
    return {
      card:          'rgba(255, 255, 255, 1)',
      text:          'rgb(0, 0, 0)',
      textStrong:    'rgb(0, 0, 0)',
      separator:     'rgb(235, 235, 235)',
      icon:          'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      gradient2:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient:  'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      cardGradient2:
        'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
      tableHeader:   'rgb(245,245,245)',
      tableBorder:   'rgb(220,220,220)',
    };
  }, [currentTheme]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [state, setState] = useState<CalculatorState>(initialState());
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setActiveInputId(null);
      };
    }, [setActiveInputId])
  );

  // ── ScrollView + auto-scroll ──────────────────────────────────────────────────
  const scrollViewRef    = useRef<ScrollView>(null);
  const inputRefs        = useRef<Record<string, View | null>>({});
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
          const SCREEN_HEIGHT   = Dimensions.get('window').height;
          const targetScrollY   = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetScrollY), animated: true });
        },
        () => {}
      );
    }, 150);
  }, [activeInputId]);

  // ── Animations ────────────────────────────────────────────────────────────────
  const heartScale = useRef(new Animated.Value(1)).current;

  // ── DB / favourites ───────────────────────────────────────────────────────────
  const dbRef    = useRef<any>(null);
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
        const fav = await isFavorite(db, 'SeriePotenciaCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      const route        = 'SeriePotenciaCalc';
      const label        = t('seriePotenciaCalc.title');
      const currentlyFav = await isFavorite(db, route);
      if (currentlyFav) {
        await removeFavorite(db, route);
        setIsFav(false);
        Toast.show({
          type:  'error',
          text1: t('favorites.deleted'),
          text2: t('favorites.deletedDesc'),
        });
      } else {
        await addFavorite(db, { route, label });
        setIsFav(true);
        Toast.show({
          type:  'success',
          text1: t('favorites.success'),
          text2: t('favorites.successDesc'),
        });
      }
    } catch {
      Toast.show({
        type:  'error',
        text1: t('common.error'),
        text2: t('common.genericError'),
      });
    }
  }, [t]);

  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.0, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  // ── Navigate to options ───────────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (
      category: string,
      onSelectOption: (opt: string) => void,
      selectedOption?: string
    ) => {
      navigation.navigate({
        name: 'CalculatorOptionsScreen',
        params: buildCalculatorOptionsParams('seriePotencia', {
          category,
          onSelectOption,
          selectedOption,
        }),
      });
    },
    [navigation]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const adjustDecimalSeparator = useCallback(
    (s: string): string =>
      selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s,
    [selectedDecimalSeparator]
  );

  const formatResult = useCallback((num: number): string => {
    if (!isFinite(num) || isNaN(num)) return '-';
    if (num === 0) return '0';
    const d = new Decimal(num);
    return d.toSignificantDigits(8).toString();
  }, []);

  const convertValue = useCallback(
    (value: string, fromUnit: string, toUnit: string, category: string): string => {
      if (!value || value.trim() === '') return '';
      const num  = parseFloat(value.replace(',', '.'));
      if (isNaN(num)) return value;
      const fromF = conversionFactors[category]?.[fromUnit] ?? 1;
      const toF   = conversionFactors[category]?.[toUnit]   ?? 1;
      return formatResult((num * fromF) / toF);
    },
    [formatResult]
  );

  // ── Tramo CRUD ────────────────────────────────────────────────────────────────
  const addTramo = useCallback(() => {
    setState(prev => ({ ...prev, tramos: [...prev.tramos, createNewTramo()] }));
  }, []);

  const removeTramo = useCallback((id: number) => {
    setState(prev => ({
      ...prev,
      tramos: prev.tramos.filter(t => t.id !== id),
    }));
  }, []);

  const updateTramo = useCallback((id: number, updates: Partial<Tramo>) => {
    setState(prev => ({
      ...prev,
      tramos: prev.tramos.map(t => (t.id === id ? { ...t, ...updates } : t)),
    }));
  }, []);

  // ── Custom keyboard handlers ──────────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;

    // Global fields
    const globalMap: Record<string, string> = {
      eficiencia: s.eficiencia,
      densidad:   s.densidad,
      viscosidad: s.viscosidad,
      cabeza:     s.cabeza,
    };
    if (id in globalMap) return globalMap[id];

    // Tramo fields: "tramo-{id}-{field}"
    const parts = id.split('-');
    if (parts.length >= 3 && parts[0] === 'tramo') {
      const tramoId = parseFloat(parts[1]);
      const field   = parts[2] as keyof Tramo;
      const tramo   = s.tramos.find(t => t.id === tramoId);
      if (tramo && typeof tramo[field] === 'string') return tramo[field] as string;
    }

    return '';
  }, []);

  const handleKeyboardKey = useCallback((key: string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = appendKeyboardKey(getActiveValue(), key);
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDelete = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(deleteKeyboardKey(getActiveValue()));
  }, [getActiveValue]);

  const handleKeyboardClear = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(clearKeyboardValue());
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = insertScientificNotation(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = insertKeyboardMinus(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);

  const isKeyboardOpen = !!activeInputId;

  // ── Input renderers ───────────────────────────────────────────────────────────
  const renderSimpleInput = useCallback(
    (
      fieldId: string,
      label: string,
      value: string,
      onChange: (t: string) => void
    ) => {
      const isInvalid = state.invalidFields.includes(fieldId);
      const hasValue  = (value?.trim()?.length ?? 0) > 0;

      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== fieldId),
        }));
      };

      return (
        <View
          ref={r => { inputRefs.current[fieldId] = r; }}
          style={styles.inputWrapper}
        >
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.inputLabel,
                { color: themeColors.text, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.valueDot,
                { backgroundColor: getDotColor(hasValue, isInvalid) },
              ]}
            />
          </View>
          <View
            style={[
              styles.Container,
              {
                experimental_backgroundImage: themeColors.gradient,
                width: '100%',
                flex: undefined,
              },
            ]}
          >
            <View
              style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}
            >
              <Pressable
                onPress={() => setActiveInputId(fieldId)}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
                value={formatKeyboardDisplayValue(value)}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={
                  currentTheme === 'dark'
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(0,0,0,0.35)'
                }
              />
            </View>
          </View>
        </View>
      );
    },
    [state.invalidFields, themeColors, currentTheme, fontSizeFactor, setActiveInputId]
  );

  const renderInputWithUnit = useCallback(
    (
      fieldId: string,
      label: string,
      value: string,
      unit: string,
      category: string,
      onChange: (t: string) => void,
      onUnitChange: (newUnit: string, oldUnit: string) => void
    ) => {
      const isInvalid = state.invalidFields.includes(fieldId);
      const hasValue  = (value?.trim()?.length ?? 0) > 0;

      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== fieldId),
        }));
      };

      return (
        <View
          ref={r => { inputRefs.current[fieldId] = r; }}
          style={styles.inputWrapper}
        >
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.inputLabel,
                { color: themeColors.text, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.valueDot,
                { backgroundColor: getDotColor(hasValue, isInvalid) },
              ]}
            />
          </View>
          <View style={styles.redContainer}>
            <View
              style={[
                styles.Container,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            >
              <View
                style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}
              >
                <Pressable
                  onPress={() => setActiveInputId(fieldId)}
                  style={StyleSheet.absoluteFill}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                  value={formatKeyboardDisplayValue(value)}
                  editable={false}
                  showSoftInputOnFocus={false}
                  pointerEvents="none"
                  placeholderTextColor={
                    currentTheme === 'dark'
                      ? 'rgba(255,255,255,0.35)'
                      : 'rgba(0,0,0,0.35)'
                  }
                />
              </View>
            </View>
            <Pressable
              style={[
                styles.Container2,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
              onPress={() =>
                navigateToOptions(
                  category,
                  (opt: string) => onUnitChange(opt, unit),
                  unit
                )
              }
            >
              <View
                style={[
                  styles.innerWhiteContainer2,
                  { backgroundColor: themeColors.card },
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                >
                  {unit}
                </Text>
                <Icon
                  name="plus"
                  size={20}
                  color={themeColors.icon}
                  style={styles.icon}
                />
              </View>
            </Pressable>
          </View>
        </View>
      );
    },
    [
      state.invalidFields,
      themeColors,
      currentTheme,
      fontSizeFactor,
      setActiveInputId,
      navigateToOptions,
    ]
  );

  // ── Tramo block renderer ──────────────────────────────────────────────────────
  const renderTramoBlock = useCallback(
    (tramo: Tramo, index: number) => (
      <View
        key={tramo.id}
        style={[
          styles.accessoryBlockMain,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View
          style={[
            styles.accessoryBlock,
            {
              backgroundColor:
                currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(255,255,255)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.accessoryHeader}>
            <Text
              style={[
                styles.accessoryTitle,
                { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {t('seriePotenciaCalc.tramoTitle') + ` ${index + 1}`}
            </Text>
            {state.tramos.length > 1 && (
              <Pressable
                onPress={() => removeTramo(tramo.id)}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
              </Pressable>
            )}
          </View>

          {/* D — Diámetro */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-D`,
            withSymbol(t('seriePotenciaCalc.labels.D') || 'Diámetro', 'D'),
            tramo.D,
            tramo.DUnit,
            'length',
            text => updateTramo(tramo.id, { D: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.D, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { D: converted, DUnit: newUnit });
            }
          )}

          {/* L — Longitud */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-L`,
            withSymbol(t('seriePotenciaCalc.labels.L') || 'Longitud', 'L'),
            tramo.L,
            tramo.LUnit,
            'length',
            text => updateTramo(tramo.id, { L: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.L, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { L: converted, LUnit: newUnit });
            }
          )}

          {/* ks — Rugosidad absoluta */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-ks`,
            withSymbol(t('seriePotenciaCalc.labels.ks') || 'Rugosidad absoluta', 'kˢ'),
            tramo.ks,
            tramo.ksUnit,
            'length',
            text => updateTramo(tramo.id, { ks: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.ks, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { ks: converted, ksUnit: newUnit });
            }
          )}

          {/* Km — Coeficiente de pérdidas menores */}
          {renderSimpleInput(
            `tramo-${tramo.id}-Km`,
            withSymbol(t('seriePotenciaCalc.labels.Km') || 'Coef. pérdidas menores', 'Kᵐ'),
            tramo.Km,
            text => updateTramo(tramo.id, { Km: text })
          )}

          {/* Q — Caudal del tramo */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-Q`,
            withSymbol(t('seriePotenciaCalc.labels.Q') || 'Caudal', 'Q'),
            tramo.Q,
            tramo.QUnit,
            'flow',
            text => updateTramo(tramo.id, { Q: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.Q, oldUnit, newUnit, 'flow');
              updateTramo(tramo.id, { Q: converted, QUnit: newUnit });
            }
          )}
        </View>
      </View>
    ),
    [
      state.tramos.length,
      themeColors,
      currentTheme,
      fontSizeFactor,
      t,
      renderInputWithUnit,
      renderSimpleInput,
      convertValue,
      updateTramo,
      removeTramo,
    ]
  );

  // ── Table helpers ─────────────────────────────────────────────────────────────
  const fmtNum = useCallback(
    (n: number): string => {
      if (!isFinite(n) || isNaN(n)) return '-';
      if (n === 0) return '0';
      const s = formatResult(n);
      return s.length > 10 ? s.substring(0, 10) : s;
    },
    [formatResult]
  );

  // ── Summary table ─────────────────────────────────────────────────────────────
  const renderSummaryTable = useCallback(() => {
    if (!state.calcResult) return null;
    const { tramosData, H_total, P, Q_entrada } = state.calcResult;
    const bc  = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const cols: [string, number][] = [
      [t('seriePotenciaCalc.table.tramo'),  52],
      [t('seriePotenciaCalc.table.D'),      76],
      [t('seriePotenciaCalc.table.L'),      76],
      [t('seriePotenciaCalc.table.Q'),      92],
      [t('seriePotenciaCalc.table.V'),      80],
      [t('seriePotenciaCalc.table.Re'),     80],
      [t('seriePotenciaCalc.table.f'),      72],
      [t('seriePotenciaCalc.table.hf'),     80],
      [t('seriePotenciaCalc.table.hm'),     80],
      [t('seriePotenciaCalc.table.htotal'), 88],
    ];

    const totalTableWidth =
      cols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;

    const renderTableContent = (
      scale: number,
      textColor: string,
      textStrong: string
    ) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, w], ci) => (
            <View
              key={`sh-${ci}`}
              style={[
                styles.tableCell,
                {
                  width: w * scale,
                  borderColor: bc,
                  backgroundColor: hBg,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.tableCellHeaderText,
                  { color: textStrong, fontSize: 11 * scale },
                ]}
                numberOfLines={1}
              >
                {hdr}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {tramosData.map((row, i) => {
          const rowBg =
            i % 2 !== 0
              ? currentTheme === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)'
              : 'transparent';
          const rowData = [
            String(i + 1),
            fmtNum(row.D),
            fmtNum(row.L),
            fmtNum(row.Q),
            fmtNum(row.V),
            fmtNum(row.Re),
            fmtNum(row.f),
            fmtNum(row.hf),
            fmtNum(row.hm),
            fmtNum(row.h_total),
          ];
          return (
            <View
              key={`sr-${i}`}
              style={[styles.tableRow, { backgroundColor: rowBg }]}
            >
              {cols.map(([, w], ci) => (
                <View
                  key={`sc-${i}-${ci}`}
                  style={[styles.tableCell, { width: w * scale, borderColor: bc }]}
                >
                  <Text
                    style={[
                      styles.tableCellText,
                      { color: textColor, fontSize: 11 * scale },
                    ]}
                    numberOfLines={1}
                  >
                    {rowData[ci] ?? '-'}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Totals row */}
        <View
          style={[
            styles.tableRow,
            {
              backgroundColor:
                currentTheme === 'dark'
                  ? 'rgba(194,254,12,0.08)'
                  : 'rgba(194,254,12,0.15)',
            },
          ]}
        >
          {cols.map(([, w], ci) => {
            let content = '-';
            if (ci === 0) content = t('seriePotenciaCalc.table.total');
            else if (ci === 9)
              content = fmtNum(
                tramosData.reduce((acc, r) => acc + r.h_total, 0)
              );
            return (
              <View
                key={`st-${ci}`}
                style={[styles.tableCell, { width: w * scale, borderColor: bc }]}
              >
                <Text
                  style={[
                    styles.tableCellHeaderText,
                    { color: textStrong, fontSize: 11 * scale },
                  ]}
                  numberOfLines={1}
                >
                  {content}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );

    const modalLandscapeWidth  = screenHeight;
    const modalLandscapeHeight = screenWidth;

    return (
      <View style={{ marginTop: 8 }}>
        {/* ── Balance card ── */}
        <View
          style={[
            styles.balanceContainer,
            { borderColor: themeColors.tableBorder },
          ]}
        >
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('seriePotenciaCalc.balance.Qentrada')}{' '}
            <Text style={styles.balanceValue}>
              {fmtNum(Q_entrada)} m³/s
            </Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('seriePotenciaCalc.balance.Htotal')}{' '}
            <Text style={styles.balanceValue}>{fmtNum(H_total)} m</Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('seriePotenciaCalc.balance.P')}{' '}
            <Text style={styles.balanceValue}>{fmtNum(P)} kW</Text>
          </Text>
        </View>

        {/* ── Title row with expand button ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 15,
          }}
        >
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            {t('seriePotenciaCalc.table.summaryTitle')}
          </Text>
          <Pressable
            onPress={() => setSummaryModalVisible(true)}
            style={styles.expandButton}
          >
            <View
              style={[
                styles.buttonBackground2,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient2,
                },
              ]}
            />
            <MaskedView
              style={styles.expandButtonMasked}
              maskElement={<View style={styles.expandButtonMask} />}
            >
              <View
                style={[
                  styles.buttonGradient2,
                  { experimental_backgroundImage: themeColors.gradient2 },
                ]}
              />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text
                style={[
                  styles.expandButtonText,
                  { color: themeColors.text, fontSize: 14 * fontSizeFactor },
                ]}
              >
                {t('seriePotenciaCalc.table.viewFull')}
              </Text>
              <IconExpand
                name="expand-sharp"
                size={20}
                color={themeColors.icon}
              />
            </View>
          </Pressable>
        </View>

        {/* ── Inline horizontally-scrollable table ── */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(
              fontSizeFactor,
              themeColors.text,
              themeColors.textStrong
            )}
          </ScrollView>
        </View>

        {/* ── Landscape modal ── */}
        <Modal
          visible={summaryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSummaryModalVisible(false)}
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalLandscapeContainer,
                {
                  width: modalLandscapeWidth,
                  height: modalLandscapeHeight,
                  transform: [{ rotate: '90deg' }],
                  backgroundColor:
                    currentTheme === 'dark'
                      ? 'rgb(24,24,24)'
                      : 'rgb(255,255,255)',
                },
              ]}
            >
              <ScrollView
                style={{
                  flex: 1,
                  backgroundColor:
                    currentTheme === 'dark'
                      ? 'rgb(14,14,14)'
                      : 'rgb(255,255,255)',
                }}
                contentContainerStyle={{
                  paddingVertical: 0,
                  alignItems: 'center',
                }}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.modalHeader,
                    {
                      backgroundColor: 'transparent',
                      width: totalTableWidth + 40,
                      paddingHorizontal: 0,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: themeColors.textStrong },
                    ]}
                  >
                    {t('seriePotenciaCalc.table.summaryTitle')}
                  </Text>
                  <Pressable
                    onPress={() => setSummaryModalVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <View
                      style={[
                        styles.buttonBackground22,
                        {
                          backgroundColor: 'transparent',
                          experimental_backgroundImage:
                            themeColors.cardGradient2,
                        },
                      ]}
                    />
                    <MaskedView
                      style={styles.modalCloseButtonMasked}
                      maskElement={<View style={styles.modalCloseButtonMask} />}
                    >
                      <View
                        style={[
                          styles.buttonGradient22,
                          {
                            experimental_backgroundImage: themeColors.gradient2,
                          },
                        ]}
                      />
                    </MaskedView>
                    <Icon
                      name="x"
                      size={18}
                      color={themeColors.icon}
                      style={styles.modalCloseButtonIcon}
                    />
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderTableContent(
                    fontSizeFactor,
                    themeColors.text,
                    themeColors.textStrong
                  )}
                </ScrollView>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }, [
    state.calcResult,
    summaryModalVisible,
    themeColors,
    currentTheme,
    fontSizeFactor,
    t,
    fmtNum,
  ]);

  // ── Calculate handler ─────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const invalid: string[] = [];

    // Eficiencia (%)
    const eficienciaRaw = parseFloat((state.eficiencia || '').replace(',', '.'));
    if (isNaN(eficienciaRaw) || eficienciaRaw <= 0 || eficienciaRaw > 100)
      invalid.push('eficiencia');

    // Densidad
    const densidadRaw = parseFloat((state.densidad || '').replace(',', '.'));
    const densidadSI  = isNaN(densidadRaw)
      ? NaN
      : densidadRaw * (conversionFactors.density[state.densidadUnit] ?? 1);
    if (!isFinite(densidadSI) || densidadSI <= 0) invalid.push('densidad');

    // Viscosidad dinámica
    const viscosidadRaw = parseFloat((state.viscosidad || '').replace(',', '.'));
    const viscosidadSI  = isNaN(viscosidadRaw)
      ? NaN
      : viscosidadRaw *
        (conversionFactors.dynamicViscosity[state.viscosidadUnit] ?? 1);
    if (!isFinite(viscosidadSI) || viscosidadSI <= 0) invalid.push('viscosidad');

    // Cabeza
    const cabezaRaw = parseFloat((state.cabeza || '').replace(',', '.'));
    const cabezaSI  = isNaN(cabezaRaw)
      ? NaN
      : cabezaRaw * (conversionFactors.length[state.cabezaUnit] ?? 1);
    if (!isFinite(cabezaSI) || cabezaSI <= 0) invalid.push('cabeza');

    // Tramos
    const tramosForCalc: {
      D: number;
      L: number;
      ks: number;
      Km: number;
      Q: number;
    }[] = [];

    state.tramos.forEach(tramo => {
      const D_raw = parseFloat((tramo.D || '').replace(',', '.'));
      const D_si  = isNaN(D_raw)
        ? NaN
        : D_raw * (conversionFactors.length[tramo.DUnit] ?? 1);
      if (!isFinite(D_si) || D_si <= 0) invalid.push(`tramo-${tramo.id}-D`);

      const L_raw = parseFloat((tramo.L || '').replace(',', '.'));
      const L_si  = isNaN(L_raw)
        ? NaN
        : L_raw * (conversionFactors.length[tramo.LUnit] ?? 1);
      if (!isFinite(L_si) || L_si <= 0) invalid.push(`tramo-${tramo.id}-L`);

      const ks_raw = parseFloat((tramo.ks || '').replace(',', '.'));
      const ks_si  = isNaN(ks_raw)
        ? NaN
        : ks_raw * (conversionFactors.length[tramo.ksUnit] ?? 1);
      if (!isFinite(ks_si) || ks_si < 0) invalid.push(`tramo-${tramo.id}-ks`);

      const Km_raw = parseFloat((tramo.Km || '').replace(',', '.'));
      if (isNaN(Km_raw) || Km_raw < 0) invalid.push(`tramo-${tramo.id}-Km`);

      const Q_raw = parseFloat((tramo.Q || '').replace(',', '.'));
      const Q_si  = isNaN(Q_raw)
        ? NaN
        : Q_raw * (conversionFactors.flow[tramo.QUnit] ?? 1);
      if (!isFinite(Q_si) || Q_si <= 0) invalid.push(`tramo-${tramo.id}-Q`);

      tramosForCalc.push({
        D:  isFinite(D_si)  ? D_si  : 0,
        L:  isFinite(L_si)  ? L_si  : 0,
        ks: isFinite(ks_si) ? ks_si : 0,
        Km: isNaN(Km_raw)   ? 0     : Km_raw,
        Q:  isFinite(Q_si)  ? Q_si  : 0,
      });
    });

    if (invalid.length > 0) {
      setState(prev => ({ ...prev, invalidFields: invalid }));
      Toast.show({
        type:  'error',
        text1: t('common.error'),
        text2: t('seriePotenciaCalc.toasts.missingFields'),
      });
      return;
    }

    try {
      const result = calcularSeriePotencia(
        eficienciaRaw,
        densidadSI,
        viscosidadSI,
        cabezaSI,
        tramosForCalc
      );
      setState(prev => ({ ...prev, invalidFields: [], calcResult: result }));
    } catch {
      Toast.show({
        type:  'error',
        text1: t('common.error'),
        text2: t('seriePotenciaCalc.toasts.calcError'),
      });
    }
  }, [state, t]);

  // ── Copy handler ──────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const cr   = state.calcResult;
    let   text = '';
    text += `${t('seriePotenciaCalc.labels.eficiencia')}: ${state.eficiencia} %\n`;
    text += `${t('seriePotenciaCalc.labels.densidad')}: ${state.densidad} ${state.densidadUnit}\n`;
    text += `${t('seriePotenciaCalc.labels.viscosidad')}: ${state.viscosidad} ${state.viscosidadUnit}\n`;
    text += `${t('seriePotenciaCalc.labels.cabeza')}: ${state.cabeza} ${state.cabezaUnit}\n`;
    state.tramos.forEach((tr, i) => {
      text += `\n${t('seriePotenciaCalc.tramoTitle')} ${i + 1}:\n`;
      text += `  D: ${tr.D} ${tr.DUnit}\n`;
      text += `  L: ${tr.L} ${tr.LUnit}\n`;
      text += `  ks: ${tr.ks} ${tr.ksUnit}\n`;
      text += `  Km: ${tr.Km}\n`;
      text += `  Q: ${tr.Q} ${tr.QUnit}\n`;
    });
    if (cr) {
      text += `\n${t('seriePotenciaCalc.balance.Htotal')} ${fmtNum(cr.H_total)} m\n`;
      text += `${t('seriePotenciaCalc.balance.P')} ${fmtNum(cr.P)} kW\n`;
    }
    Clipboard.setString(text);
    Toast.show({
      type:  'success',
      text1: t('common.success'),
      text2: t('seriePotenciaCalc.toasts.copied'),
    });
  }, [state, fmtNum, t]);

  // ── Clear handler ─────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setState(initialState());
  }, []);

  // ── Save to history handler ───────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    if (!state.calcResult) {
      Toast.show({
        type:  'error',
        text1: t('common.error'),
        text2: t('seriePotenciaCalc.toasts.nothingToSave'),
      });
      return;
    }
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) {
        await createTable(db);
        dbRef.current = db;
      }
      const inputs = {
        eficiencia:     state.eficiencia,
        densidad:       state.densidad,
        densidadUnit:   state.densidadUnit,
        viscosidad:     state.viscosidad,
        viscosidadUnit: state.viscosidadUnit,
        cabeza:         state.cabeza,
        cabezaUnit:     state.cabezaUnit,
        tramos: state.tramos.map(tr => ({
          D:      tr.D,
          DUnit:  tr.DUnit,
          L:      tr.L,
          LUnit:  tr.LUnit,
          ks:     tr.ks,
          ksUnit: tr.ksUnit,
          Km:     tr.Km,
          Q:      tr.Q,
          QUnit:  tr.QUnit,
        })),
      };
      const resultStr = `${fmtNum(state.calcResult.P)} kW`;
      await saveCalculation(
        db,
        'SeriePotenciaCalc',
        JSON.stringify(inputs),
        resultStr
      );
      Toast.show({
        type:  'success',
        text1: t('common.success'),
        text2: t('seriePotenciaCalc.toasts.saved'),
      });
    } catch {
      Toast.show({
        type:  'error',
        text1: t('common.error'),
        text2: t('seriePotenciaCalc.toasts.saveError'),
      });
    }
  }, [state, fmtNum, t]);

  // ── Main result (potencia requerida) ─────────────────────────────────────────
  const mainResultValue = useMemo(() => {
    if (!state.calcResult) return '';
    const P = state.calcResult.P;
    if (!isFinite(P) || isNaN(P)) return '-';
    const s   = formatResult(P);
    const num = parseFloat(s);
    if (isNaN(num)) return s;
    return adjustDecimalSeparator(formatNumber(num));
  }, [state.calcResult, formatResult, formatNumber, adjustDecimalSeparator]);

  const hasResult = !!state.calcResult;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.safeArea}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInset={{ bottom: isKeyboardOpen ? 280 : 0 }}
      >
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable
              style={[
                styles.iconContainer,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient,
                },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: 'transparent',
                    experimental_backgroundImage: themeColors.cardGradient,
                  },
                ]}
                onPress={() => {
                  bounceHeart();
                  toggleFavorite();
                }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <IconFavorite
                    name={isFav ? 'heart' : 'heart-o'}
                    size={20}
                    color={isFav ? 'rgba(255, 63, 63, 1)' : 'rgb(255, 255, 255)'}
                  />
                </Animated.View>
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: 'transparent',
                    experimental_backgroundImage: themeColors.cardGradient,
                  },
                ]}
                onPress={() => navigation.navigate('SeriePotenciaCalcTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('seriePotenciaCalc.calculator')}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('seriePotenciaCalc.title')}
          </Text>
        </View>

        {/* ── Main result panel (Potencia requerida) ── */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text
                  style={[
                    styles.saveButtonText,
                    { fontSize: 14 * fontSizeFactor },
                  ]}
                >
                  {t('energiaBernoulliCalc.saveToHistory')}
                </Text>
                <Icon
                  name="plus"
                  size={16 * fontSizeFactor}
                  color="rgba(255, 255, 255, 0.4)"
                  style={styles.plusIcon}
                />
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
                        ...(StyleSheet.absoluteFillObject as object),
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      }}
                    />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text
                      style={[
                        styles.flowLabel,
                        {
                          color:
                            currentTheme === 'dark'
                              ? '#FFFFFF'
                              : 'rgba(0,0,0,1)',
                          fontSize: 16 * fontSizeFactor,
                        },
                      ]}
                    >
                      {!hasResult
                        ? 'な'
                        : `${t('seriePotenciaCalc.resultLabel') || 'Potencia requerida'} (kW)`}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        {
                          color:
                            currentTheme === 'dark'
                              ? '#FFFFFF'
                              : 'rgba(0,0,0,1)',
                          fontSize: 30 * fontSizeFactor,
                        },
                      ]}
                    >
                      {!hasResult ? '一' : mainResultValue}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.buttonsContainer}>
          {(
            [
              {
                icon:   'zap',
                label:  t('common.calculate'),
                action: handleCalculate,
              },
              {
                icon:   'copy',
                label:  t('common.copy'),
                action: handleCopy,
              },
              {
                icon:   'trash',
                label:  t('common.clear'),
                action: handleClear,
              },
              {
                icon:   'clock',
                label:  t('common.history'),
                action: () =>
                  navigation.navigate('HistoryScreenSeriePotenciaCalc'),
              },
            ] as { icon: string; label: string; action: () => void }[]
          ).map(({ icon, label, action }) => (
            <View style={styles.actionWrapper} key={label}>
              <View style={styles.actionButtonMain}>
                <Pressable
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: 'transparent',
                      experimental_backgroundImage: themeColors.cardGradient,
                    },
                  ]}
                  onPress={action}
                >
                  <Icon
                    name={icon}
                    size={22 * fontSizeFactor}
                    color="rgb(255, 255, 255)"
                  />
                  <Icon
                    name={icon}
                    size={22 * fontSizeFactor}
                    color="rgba(255, 255, 255, 0.5)"
                    style={{ position: 'absolute', filter: 'blur(4px)' }}
                  />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.actionButtonText,
                  { fontSize: 14 * fontSizeFactor },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Input section ── */}
        <View
          style={[
            styles.inputsSection,
            {
              backgroundColor: themeColors.card,
              paddingBottom: isKeyboardOpen ? 330 : 70,
            },
          ]}
        >
          {/* ── Parámetros globales ── */}
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            {t('seriePotenciaCalc.globalParams')}
          </Text>

          {/* Eficiencia [%] */}
          {renderSimpleInput(
            'eficiencia',
            withSymbol(t('seriePotenciaCalc.labels.eficiencia') || 'Eficiencia', 'η'),
            state.eficiencia,
            text =>
              setState(prev => ({ ...prev, eficiencia: text }))
          )}

          {/* Densidad */}
          {renderInputWithUnit(
            'densidad',
            withSymbol(t('seriePotenciaCalc.labels.densidad') || 'Densidad', 'ρ'),
            state.densidad,
            state.densidadUnit,
            'density',
            text => setState(prev => ({ ...prev, densidad: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(
                state.densidad,
                oldUnit,
                newUnit,
                'density'
              );
              setState(prev => ({
                ...prev,
                densidad: converted,
                densidadUnit: newUnit,
              }));
            }
          )}

          {/* Viscosidad dinámica */}
          {renderInputWithUnit(
            'viscosidad',
            withSymbol(t('seriePotenciaCalc.labels.viscosidad') || 'Viscosidad dinámica', 'μ'),
            state.viscosidad,
            state.viscosidadUnit,
            'dynamicViscosity',
            text => setState(prev => ({ ...prev, viscosidad: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(
                state.viscosidad,
                oldUnit,
                newUnit,
                'dynamicViscosity'
              );
              setState(prev => ({
                ...prev,
                viscosidad: converted,
                viscosidadUnit: newUnit,
              }));
            }
          )}

          {/* Cabeza total */}
          {renderInputWithUnit(
            'cabeza',
            withSymbol(t('seriePotenciaCalc.labels.cabeza') || 'Cabeza total', 'H'),
            state.cabeza,
            state.cabezaUnit,
            'length',
            text => setState(prev => ({ ...prev, cabeza: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(
                state.cabeza,
                oldUnit,
                newUnit,
                'length'
              );
              setState(prev => ({
                ...prev,
                cabeza: converted,
                cabezaUnit: newUnit,
              }));
            }
          )}

          <View
            style={[styles.separator, { backgroundColor: themeColors.separator }]}
          />

          {/* ── Sección de tramos ── */}
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            {t('seriePotenciaCalc.tramosSection')}
          </Text>

          {state.tramos.map((tramo, index) =>
            renderTramoBlock(tramo, index)
          )}

          {/* Botón añadir tramo */}
          <View style={styles.addButtonRow}>
            <Pressable style={styles.addButton} onPress={addTramo}>
              <Icon name="plus" size={24} color="white" />
            </Pressable>
          </View>

          {/* ── Sección de resultados ── */}
          {hasResult && (
            <>
              <View
                style={[
                  styles.separator,
                  { backgroundColor: themeColors.separator },
                ]}
              />
              {renderSummaryTable()}
            </>
          )}

          {/* Texto informativo — solo visible sin resultado */}
          {!hasResult && (
            <View>
              <View
                style={[
                  styles.separator,
                  {
                    backgroundColor: themeColors.separator,
                    marginVertical: 10,
                  },
                ]}
              />
              <View style={styles.descriptionContainer}>
                <Text
                  style={[
                    styles.descriptionText,
                    {
                      color: themeColors.text,
                      opacity: 0.6,
                      fontSize: 14 * fontSizeFactor,
                    },
                  ]}
                >
                  {t('seriePotenciaCalc.infoText')}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.logoContainer}>
          <FastImage
            source={currentTheme === 'dark' ? logoDark : logoLight}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>
      </ScrollView>

      {/* ── Custom keyboard ── */}
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

// ─── Styles (identical to CompDiseñoSerie) ────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  mainContainer: {
    flex: 1,
    paddingVertical: 0,
    backgroundColor: 'rgb(0, 0, 0)',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 45,
    backgroundColor: 'transparent',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  iconWrapper: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 40,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconContainer: {
    backgroundColor: 'rgb(20, 20, 20)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'space-between',
  },
  titlesContainer: {
    backgroundColor: 'transparent',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: 'rgb(255, 255, 255)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  title: {
    color: 'rgb(255, 255, 255)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    lineHeight: 30,
    marginBottom: 10,
  },
  resultsMain: {
    paddingHorizontal: 20,
  },
  resultsContainerMain: {
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    borderRadius: 25,
  },
  resultsContainer: {
    backgroundColor: 'rgb(20, 20, 20)',
    borderRadius: 24,
    overflow: 'hidden',
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
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 14,
  },
  plusIcon: {
    marginLeft: 'auto',
  },
  imageContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 23,
    borderBottomRightRadius: 23,
    overflow: 'hidden',
  },
  flowContainer: {
    alignItems: 'baseline',
    padding: 0,
    justifyContent: 'center',
    position: 'relative',
  },
  caudalLabel: {
    backgroundColor: 'rgba(142, 142, 142, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(104, 104, 104, 0.12)',
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
    fontFamily: 'SFUIDisplay-Semibold',
  },
  flowValueContainer: {
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginVertical: 0,
  },
  flowValue: {
    fontSize: 40,
    fontFamily: 'SFUIDisplay-Heavy',
  },
  buttonsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 15,
    backgroundColor: 'transparent',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionWrapper: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  actionButtonMain: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    padding: 1,
    height: 60,
    width: 60,
    borderRadius: 30,
  },
  actionButton: {
    backgroundColor: 'rgb(20, 20, 20)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonText: {
    marginTop: 2,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 1)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  // ── Input section ─────────────────────────────────────────────────────────────
  inputsSection: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  inputWrapper: {
    marginBottom: 10,
    backgroundColor: 'transparent',
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
  inputLabel: {
    color: 'rgb(0, 0, 0)',
    marginBottom: 2,
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
  },
  redContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    paddingHorizontal: 0,
    width: '100%',
    gap: 10,
    flexDirection: 'row',
  },
  Container: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    width: '68%',
  },
  Container2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    flex: 1,
  },
  innerWhiteContainer: {
    backgroundColor: 'white',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    borderRadius: 25,
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
    paddingLeft: 20,
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255, 143, 143, 0)',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
  },
  sectionSubtitle: {
    fontSize: 20,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(0, 0, 0)',
    marginTop: 5,
    marginBottom: 5,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 10,
  },
  text: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
  },
  icon: {
    marginLeft: 'auto',
  },
  // ── Tramo block ───────────────────────────────────────────────────────────────
  accessoryBlockMain: {
    padding: 1,
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderRadius: 25,
  },
  accessoryBlock: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  accessoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accessoryTitle: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: 'rgb(254, 12, 12)',
    padding: 5,
    borderRadius: 0,
  },
  // ── Add tramo button ──────────────────────────────────────────────────────────
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgb(0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Tables ────────────────────────────────────────────────────────────────────
  tableContainer: {
    borderWidth: 0,
    marginTop: 0,
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    borderRightWidth: 0,
    paddingVertical: 7,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  tableCellHeaderText: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 11,
  },
  tableCellText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 11,
  },
  balanceContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  balanceText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 13,
  },
  balanceValue: {
    fontFamily: 'SFUIDisplay-Bold',
  },
  // ── Expand button & landscape modal ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLandscapeContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0)',
  },
  modalTitle: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 15,
  },
  expandButton: {
    width: 90,
    height: 40,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButtonMasked: {
    width: 90,
    height: 40,
  },
  expandButtonMask: {
    width: 90,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  buttonGradient2: {
    width: 90,
    height: 40,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonGradient22: {
    width: 40,
    height: 40,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonBackground2: {
    width: 90,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  buttonBackground22: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonMasked: {
    width: 40,
    height: 40,
  },
  modalCloseButtonMask: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  modalCloseButtonIcon: {
    position: 'absolute',
  },
  expandButtonContent: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 15,
    height: '100%',
  },
  expandButtonText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 14,
    marginRight: 5,
  },
  descriptionContainer: {
    marginVertical: 5,
    marginHorizontal: 5,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgb(170, 170, 170)',
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 18,
    marginBottom: 8,
  },
  // ── Custom keyboard ───────────────────────────────────────────────────────────
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
  logoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 40,
    height: 40,
    opacity: 1,
    zIndex: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

export default SeriePotenciaCalc;
