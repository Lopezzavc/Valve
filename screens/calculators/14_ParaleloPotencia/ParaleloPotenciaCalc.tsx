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

const logoLight      = require('../../../assets/icon/iconblack.webp');
const logoDark       = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ─────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenParaleloPotenciaCalc: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenParaleloPotenciaCalc: undefined;
  ParaleloPotenciaCalcTheory: undefined;
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
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    m:   1,
    mm:  0.001,
    cm:  0.01,
    ft:  0.3048,
    in:  0.0254,
    μm:  1e-6,
  },
  pressure: {
    Pa:   1,
    kPa:  1e3,
    MPa:  1e6,
    bar:  1e5,
    atm:  101325,
    psi:  6894.757,
  },
  density: {
    'kg/m³':  1,
    'g/cm³':  1000,
    'kg/L':   1000,
    'lb/ft³': 16.018463,
  },
  kinematicViscosity: {
    'm²/s':   1,
    'mm²/s':  1e-6,
    'cm²/s':  1e-4,
    'cSt':    1e-6,
    'ft²/s':  0.09290304,
  },
  flow: {
    'm³/s':   1,
    'L/s':    0.001,
    'm³/min': 1 / 60,
    'm³/h':   1 / 3600,
    'ft³/s':  0.0283168,
  },
};

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
}

interface TramoResult {
  D: number;
  L: number;
  Q: number;
  V: number;
  Re: number;
  f: number;
  hf: number;
}

interface CalcResult {
  H_metros: number;
  P: number;
  Q_total: number;
  iteraciones: number;
  tramosData: TramoResult[];
}

interface CalculatorState {
  H_presion: string;
  H_presionUnit: string;
  rho: string;
  rhoUnit: string;
  nu: string;
  nuUnit: string;
  Q_total: string;
  Q_totalUnit: string;
  tramos: Tramo[];
  invalidFields: string[];
  calcResult: CalcResult | null;
}

// ─── Hydraulic constants ──────────────────────────────────────────────────────
const G       = 9.806;
const DOS_G   = 19.612;
const RE_LAM  = 2000.0;
const RE_TURB = 4000.0;
const TOL_CONV = 1e-7;

// ─── Friction factor functions (exact port from paralelo_potencia.py) ──────────

/** Régimen laminar: Hagen-Poiseuille */
function fLaminar(Re: number): number {
  return 64.0 / Re;
}

/**
 * Régimen turbulento: Colebrook-White iterativo.
 * Estimación inicial: Swamee-Jain.
 * 100 iteraciones, tolerancia 1e-12.
 */
function fColebrook(Re: number, eps: number, D: number): number {
  const arg = eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9);
  let f = 0.25 / Math.pow(Math.log10(Math.max(arg, 1e-15)), 2);
  for (let i = 0; i < 100; i++) {
    const inner = eps / (3.7 * D) + 2.51 / (Re * Math.sqrt(f));
    if (inner <= 0) break;
    const fNew = Math.pow(-2.0 * Math.log10(inner), -2);
    if (Math.abs(fNew - f) < 1e-12) {
      f = fNew;
      break;
    }
    f = fNew;
  }
  return f;
}

/**
 * Zona de transición (2000 ≤ Re ≤ 4000):
 * Interpolación lineal entre laminar y turbulento.
 */
function fTransicion(Re: number, eps: number, D: number): number {
  const fLam  = fLaminar(RE_LAM);
  const fTurb = fColebrook(RE_TURB, eps, D);
  const t     = (Re - RE_LAM) / (RE_TURB - RE_LAM);
  return fLam + t * (fTurb - fLam);
}

function factorFriccion(Re: number, eps: number, D: number): number {
  if (Re < RE_LAM)  return fLaminar(Re);
  if (Re <= RE_TURB) return fTransicion(Re, eps, D);
  return fColebrook(Re, eps, D);
}

/**
 * Pérdida de carga en una tubería (Darcy-Weisbach).
 * hf = (f·L/D + K) · v²/(2g)
 */
function perdidaTuberia(
  Q: number,
  D: number,
  L: number,
  eps: number,
  K: number,
  nu: number
): { hf: number; f: number; Re: number; V: number } {
  const A  = Math.PI * D * D / 4.0;
  const V  = Q / A;
  const Re = V * D / nu;
  if (Re < 1e-12) return { hf: 0, f: 0, Re: 0, V: 0 };
  const f  = factorFriccion(Re, eps, D);
  const hf = (f * L / D + K) * V * V / DOS_G;
  return { hf, f, Re, V };
}

/**
 * Estimación inicial de Q por tubería proporcional a D²/√L.
 * (Replica sub_0047C1B0 del binario)
 */
function estimarQInicial(
  QTotal: number,
  tuberias: { D: number; L: number }[]
): number[] {
  const pesos = tuberias.map(t => (t.D * t.D) / Math.sqrt(t.L));
  const suma  = pesos.reduce((a, b) => a + b, 0);
  if (suma === 0) return tuberias.map(() => QTotal / tuberias.length);
  return pesos.map(p => (QTotal * p) / suma);
}

/**
 * Encuentra Q_i tal que hf(Q_i) = hfObjetivo mediante bisección.
 * (Replica sub_0047E17C — tolerancia interna 1e-7, 200 iteraciones)
 */
function resolverQiDadoHf(
  hfObjetivo: number,
  D: number,
  L: number,
  eps: number,
  K: number,
  nu: number
): number {
  const residuo = (Q: number): number => {
    const { hf } = perdidaTuberia(Q, D, L, eps, K, nu);
    return hf - hfObjetivo;
  };

  let Qlo = 0.0;
  let Qhi = Math.max(hfObjetivo, 1e-9);

  // Expandir Qhi hasta que residuo cambie de signo
  let safetyCount = 0;
  while (residuo(Qhi) < 0) {
    Qhi *= 2.0;
    safetyCount++;
    if (Qhi > 1e6 || safetyCount > 100) break;
  }

  // Bisección
  for (let i = 0; i < 200; i++) {
    const Qmid = (Qlo + Qhi) / 2.0;
    const r    = residuo(Qmid);
    if (Math.abs(r) < TOL_CONV) return Qmid;
    if (r < 0) Qlo = Qmid;
    else        Qhi = Qmid;
  }

  return (Qlo + Qhi) / 2.0;
}

/**
 * Solver principal de tuberías en paralelo.
 * Algoritmo de escalamiento proporcional (replica sub_0047BF88):
 *  1. Q[0] como pivote → calcula hf de la tubería 0
 *  2. Para i≥1 resuelve Q_i(hf) mediante bisección
 *  3. Escala Q[0] = Q[0] · Q_total / ΣQ_i
 *  4. Repite hasta |Q_total − ΣQ_i| < tol
 */
function solverParalelo(
  QTotal: number,
  tuberias: { D: number; L: number; eps: number; K: number }[],
  nu: number,
  tol: number = 1e-7,
  maxIter: number = 500
): { Qs: number[]; iters: number } {
  const N  = tuberias.length;
  const Qs = estimarQInicial(QTotal, tuberias);

  let iters = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    iters = iter;
    const { D: D0, L: L0, eps: eps0, K: K0 } = tuberias[0];
    const { hf } = perdidaTuberia(Qs[0], D0, L0, eps0, K0, nu);

    // Resolver Q_i de las demás tuberías dado hf
    for (let i = 1; i < N; i++) {
      const { D, L, eps, K } = tuberias[i];
      Qs[i] = resolverQiDadoHf(hf, D, L, eps, K, nu);
    }

    const QSuma = Qs.reduce((a, b) => a + b, 0);

    if (Math.abs(QTotal - QSuma) < tol) break;

    // Escalar Q[0]
    if (QSuma > 0) Qs[0] = Qs[0] * QTotal / QSuma;
  }

  return { Qs, iters };
}

/**
 * Función principal (replica btnCalcularClick / calcular).
 * H_presion en Pa → H_m = H_presion / (rho·g)
 * P [kW] = rho·g·Q_total·H_m / 1000
 */
function calcularParaleloPotencia(
  H_presion: number,
  rho: number,
  nu: number,
  QTotal: number,
  tuberias: { D: number; L: number; eps: number; K: number }[]
): CalcResult {
  const H_metros = H_presion / (rho * G);
  const { Qs, iters } = solverParalelo(QTotal, tuberias, nu);
  const P = (rho * G * QTotal * H_metros) / 1000.0;

  const tramosData: TramoResult[] = tuberias.map((t, i) => {
    const { V, Re, f, hf } = perdidaTuberia(Qs[i], t.D, t.L, t.eps, t.K, nu);
    return { D: t.D, L: t.L, Q: Qs[i], V, Re, f, hf };
  });

  return { H_metros, P, Q_total: QTotal, iteraciones: iters, tramosData };
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
});

const initialState = (): CalculatorState => ({
  H_presion:     '',
  H_presionUnit: 'Pa',
  rho:           '',
  rhoUnit:       'kg/m³',
  nu:            '',
  nuUnit:        'm²/s',
  Q_total:       '',
  Q_totalUnit:   'm³/s',
  tramos:        [createNewTramo(), createNewTramo()],
  invalidFields: [],
  calcResult:    null,
});

// ─── Main component ───────────────────────────────────────────────────────────
const withSymbol = (label: string, symbol: string): string => `${label} (${symbol})`;

const ParaleloPotenciaCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber }             = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor }           = useContext(FontSizeContext);
  const { currentTheme }             = useTheme();
  const { t }                        = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  const stateRef         = useRef<CalculatorState>(initialState());
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
  const [state, setState]                     = useState<CalculatorState>(initialState());
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useFocusEffect(
    React.useCallback(() => {
      return () => { setActiveInputId(null); };
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
        const fav = await isFavorite(db, 'ParaleloPotenciaCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      const route        = 'ParaleloPotenciaCalc';
      const label        = t('paraleloPotenciaCalc.title');
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
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('common.genericError') });
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
    (category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
      navigation.navigate('OptionsScreenParaleloPotenciaCalc', {
        category,
        onSelectOption,
        selectedOption,
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
      const num = parseFloat(value.replace(',', '.'));
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
    setState(prev => ({ ...prev, tramos: prev.tramos.filter(t => t.id !== id) }));
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

    const globalMap: Record<string, string> = {
      H_presion: s.H_presion,
      rho:       s.rho,
      nu:        s.nu,
      Q_total:   s.Q_total,
    };
    if (id in globalMap) return globalMap[id];

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
    inputHandlersRef.current[id]?.(getActiveValue() + key);
  }, [getActiveValue]);

  const handleKeyboardDelete = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(getActiveValue().slice(0, -1));
  }, [getActiveValue]);

  const handleKeyboardClear = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.('');
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const val = getActiveValue();
    if (val === '' || val === '.') return;
    inputHandlersRef.current[id]?.((parseFloat(val) * 10).toString());
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const val = getActiveValue();
    if (val === '' || val === '.') return;
    inputHandlersRef.current[id]?.((parseFloat(val) / 10).toString());
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);

  const isKeyboardOpen = !!activeInputId;

  // ── Input renderers ───────────────────────────────────────────────────────────
  const renderSimpleInput = useCallback(
    (fieldId: string, label: string, value: string, onChange: (t: string) => void) => {
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
        <View ref={r => { inputRefs.current[fieldId] = r; }} style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {label}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: getDotColor(hasValue, isInvalid) }]} />
          </View>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient, width: '100%', flex: undefined }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
              <Pressable onPress={() => setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                value={value}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
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
        <View ref={r => { inputRefs.current[fieldId] = r; }} style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {label}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: getDotColor(hasValue, isInvalid) }]} />
          </View>
          <View style={styles.redContainer}>
            <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
              <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
                <Pressable onPress={() => setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                  value={value}
                  editable={false}
                  showSoftInputOnFocus={false}
                  pointerEvents="none"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              </View>
            </View>
            <Pressable
              style={[styles.Container2, { experimental_backgroundImage: themeColors.gradient }]}
              onPress={() => navigateToOptions(category, (opt: string) => onUnitChange(opt, unit), unit)}
            >
              <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.text, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {unit}
                </Text>
                <Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
              </View>
            </Pressable>
          </View>
        </View>
      );
    },
    [state.invalidFields, themeColors, currentTheme, fontSizeFactor, setActiveInputId, navigateToOptions]
  );

  // ── Tramo block renderer ──────────────────────────────────────────────────────
  const renderTramoBlock = useCallback(
    (tramo: Tramo, index: number) => (
      <View
        key={tramo.id}
        style={[styles.accessoryBlockMain, { experimental_backgroundImage: themeColors.gradient }]}
      >
        <View
          style={[
            styles.accessoryBlock,
            { backgroundColor: currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(255,255,255)' },
          ]}
        >
          {/* Header */}
          <View style={styles.accessoryHeader}>
            <Text style={[styles.accessoryTitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>
              {t('paraleloPotenciaCalc.tramoTitle') + ` ${index + 1}`}
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
            withSymbol(t('paraleloPotenciaCalc.labels.D') || 'Diámetro', 'D'),
            tramo.D, tramo.DUnit, 'length',
            text => updateTramo(tramo.id, { D: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.D, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { D: converted, DUnit: newUnit });
            }
          )}

          {/* L — Longitud */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-L`,
            withSymbol(t('paraleloPotenciaCalc.labels.L') || 'Longitud', 'L'),
            tramo.L, tramo.LUnit, 'length',
            text => updateTramo(tramo.id, { L: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.L, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { L: converted, LUnit: newUnit });
            }
          )}

          {/* ks — Rugosidad absoluta */}
          {renderInputWithUnit(
            `tramo-${tramo.id}-ks`,
            withSymbol(t('paraleloPotenciaCalc.labels.ks') || 'Rugosidad absoluta', 'kˢ'),
            tramo.ks, tramo.ksUnit, 'length',
            text => updateTramo(tramo.id, { ks: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(tramo.ks, oldUnit, newUnit, 'length');
              updateTramo(tramo.id, { ks: converted, ksUnit: newUnit });
            }
          )}

          {/* Km — Coeficiente de pérdidas menores */}
          {renderSimpleInput(
            `tramo-${tramo.id}-Km`,
            withSymbol(t('paraleloPotenciaCalc.labels.Km') || 'Coef. pérdidas menores', 'Kᵐ'),
            tramo.Km,
            text => updateTramo(tramo.id, { Km: text })
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
    const { tramosData, H_metros, P, Q_total, iteraciones } = state.calcResult;
    const bc  = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const cols: [string, number][] = [
      [t('paraleloPotenciaCalc.table.tramo'),  52],
      [t('paraleloPotenciaCalc.table.D'),      76],
      [t('paraleloPotenciaCalc.table.L'),      76],
      [t('paraleloPotenciaCalc.table.Q'),      92],
      [t('paraleloPotenciaCalc.table.V'),      80],
      [t('paraleloPotenciaCalc.table.Re'),     80],
      [t('paraleloPotenciaCalc.table.f'),      72],
      [t('paraleloPotenciaCalc.table.hf'),     80],
    ];

    const totalTableWidth = cols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;

    const renderTableContent = (scale: number, textColor: string, textStrong: string) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, w], ci) => (
            <View
              key={`sh-${ci}`}
              style={[styles.tableCell, { width: w * scale, borderColor: bc, backgroundColor: hBg, borderBottomWidth: 1 }]}
            >
              <Text style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]} numberOfLines={1}>
                {hdr}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {tramosData.map((row, i) => {
          const rowBg =
            i % 2 !== 0
              ? currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
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
          ];
          return (
            <View key={`sr-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
              {cols.map(([, w], ci) => (
                <View key={`sc-${i}-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: bc }]}>
                  <Text style={[styles.tableCellText, { color: textColor, fontSize: 11 * scale }]} numberOfLines={1}>
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
            { backgroundColor: currentTheme === 'dark' ? 'rgba(194,254,12,0.08)' : 'rgba(194,254,12,0.15)' },
          ]}
        >
          {cols.map(([, w], ci) => {
            let content = '-';
            if (ci === 0) content = t('paraleloPotenciaCalc.table.total');
            else if (ci === 3)
              content = fmtNum(tramosData.reduce((acc, r) => acc + r.Q, 0));
            return (
              <View key={`st-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: bc }]}>
                <Text style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]} numberOfLines={1}>
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
        <View style={[styles.balanceContainer, { borderColor: themeColors.tableBorder }]}>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('paraleloPotenciaCalc.balance.Hmetros')}{' '}
            <Text style={styles.balanceValue}>{fmtNum(H_metros)} m</Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('paraleloPotenciaCalc.balance.Qtotal')}{' '}
            <Text style={styles.balanceValue}>{fmtNum(Q_total)} m³/s</Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('paraleloPotenciaCalc.balance.P')}{' '}
            <Text style={styles.balanceValue}>{fmtNum(P)} kW</Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text }]}>
            {t('paraleloPotenciaCalc.balance.iteraciones')}{' '}
            <Text style={styles.balanceValue}>{iteraciones}</Text>
          </Text>
        </View>

        {/* ── Title row with expand button ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('paraleloPotenciaCalc.table.summaryTitle')}
          </Text>
          <Pressable onPress={() => setSummaryModalVisible(true)} style={styles.expandButton}>
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
            <MaskedView style={styles.expandButtonMasked} maskElement={<View style={styles.expandButtonMask} />}>
              <View style={[styles.buttonGradient2, { experimental_backgroundImage: themeColors.gradient2 }]} />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text style={[styles.expandButtonText, { color: themeColors.text, fontSize: 14 * fontSizeFactor }]}>
                {t('paraleloPotenciaCalc.table.viewFull')}
              </Text>
              <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>

        {/* ── Inline horizontally-scrollable table ── */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
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
                  backgroundColor: currentTheme === 'dark' ? 'rgb(24,24,24)' : 'rgb(255,255,255)',
                },
              ]}
            >
              <ScrollView
                style={{ flex: 1, backgroundColor: currentTheme === 'dark' ? 'rgb(14,14,14)' : 'rgb(255,255,255)' }}
                contentContainerStyle={{ paddingVertical: 0, alignItems: 'center' }}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.modalHeader,
                    { backgroundColor: 'transparent', width: totalTableWidth + 40, paddingHorizontal: 0, marginBottom: 8 },
                  ]}
                >
                  <Text style={[styles.modalTitle, { color: themeColors.textStrong }]}>
                    {t('paraleloPotenciaCalc.table.summaryTitle')}
                  </Text>
                  <Pressable onPress={() => setSummaryModalVisible(false)} style={styles.modalCloseButton}>
                    <View style={[styles.buttonBackground22, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
                    <MaskedView style={styles.modalCloseButtonMasked} maskElement={<View style={styles.modalCloseButtonMask} />}>
                      <View style={[styles.buttonGradient22, { experimental_backgroundImage: themeColors.gradient2 }]} />
                    </MaskedView>
                    <Icon name="x" size={18} color={themeColors.icon} style={styles.modalCloseButtonIcon} />
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
                </ScrollView>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }, [state.calcResult, summaryModalVisible, themeColors, currentTheme, fontSizeFactor, t, fmtNum]);

  // ── Calculate handler ─────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const invalid: string[] = [];

    // H_presion
    const H_raw = parseFloat((state.H_presion || '').replace(',', '.'));
    const H_SI  = isNaN(H_raw) ? NaN : H_raw * (conversionFactors.pressure[state.H_presionUnit] ?? 1);
    if (!isFinite(H_SI) || H_SI <= 0) invalid.push('H_presion');

    // Densidad
    const rho_raw = parseFloat((state.rho || '').replace(',', '.'));
    const rho_SI  = isNaN(rho_raw) ? NaN : rho_raw * (conversionFactors.density[state.rhoUnit] ?? 1);
    if (!isFinite(rho_SI) || rho_SI <= 0) invalid.push('rho');

    // Viscosidad cinemática
    const nu_raw = parseFloat((state.nu || '').replace(',', '.'));
    const nu_SI  = isNaN(nu_raw) ? NaN : nu_raw * (conversionFactors.kinematicViscosity[state.nuUnit] ?? 1);
    if (!isFinite(nu_SI) || nu_SI <= 0) invalid.push('nu');

    // Caudal total
    const Q_raw = parseFloat((state.Q_total || '').replace(',', '.'));
    const Q_SI  = isNaN(Q_raw) ? NaN : Q_raw * (conversionFactors.flow[state.Q_totalUnit] ?? 1);
    if (!isFinite(Q_SI) || Q_SI <= 0) invalid.push('Q_total');

    // Tramos
    const tramosForCalc: { D: number; L: number; eps: number; K: number }[] = [];
    state.tramos.forEach(tramo => {
      const D_raw = parseFloat((tramo.D || '').replace(',', '.'));
      const D_SI  = isNaN(D_raw) ? NaN : D_raw * (conversionFactors.length[tramo.DUnit] ?? 1);
      if (!isFinite(D_SI) || D_SI <= 0) invalid.push(`tramo-${tramo.id}-D`);

      const L_raw = parseFloat((tramo.L || '').replace(',', '.'));
      const L_SI  = isNaN(L_raw) ? NaN : L_raw * (conversionFactors.length[tramo.LUnit] ?? 1);
      if (!isFinite(L_SI) || L_SI <= 0) invalid.push(`tramo-${tramo.id}-L`);

      const ks_raw = parseFloat((tramo.ks || '').replace(',', '.'));
      const ks_SI  = isNaN(ks_raw) ? NaN : ks_raw * (conversionFactors.length[tramo.ksUnit] ?? 1);
      if (!isFinite(ks_SI) || ks_SI < 0) invalid.push(`tramo-${tramo.id}-ks`);

      const Km_raw = parseFloat((tramo.Km || '').replace(',', '.'));
      if (isNaN(Km_raw) || Km_raw < 0) invalid.push(`tramo-${tramo.id}-Km`);

      tramosForCalc.push({
        D:   isFinite(D_SI)  ? D_SI  : 0,
        L:   isFinite(L_SI)  ? L_SI  : 0,
        eps: isFinite(ks_SI) ? ks_SI : 0,
        K:   isNaN(Km_raw)   ? 0     : Km_raw,
      });
    });

    if (invalid.length > 0) {
      setState(prev => ({ ...prev, invalidFields: invalid }));
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('paraleloPotenciaCalc.toasts.missingFields') });
      return;
    }

    try {
      const result = calcularParaleloPotencia(H_SI, rho_SI, nu_SI, Q_SI, tramosForCalc);
      setState(prev => ({ ...prev, invalidFields: [], calcResult: result }));
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('paraleloPotenciaCalc.toasts.calcError') });
    }
  }, [state, t]);

  // ── Copy handler ──────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const cr   = state.calcResult;
    let   text = '';
    text += `${t('paraleloPotenciaCalc.labels.H_presion')}: ${state.H_presion} ${state.H_presionUnit}\n`;
    text += `${t('paraleloPotenciaCalc.labels.rho')}: ${state.rho} ${state.rhoUnit}\n`;
    text += `${t('paraleloPotenciaCalc.labels.nu')}: ${state.nu} ${state.nuUnit}\n`;
    text += `${t('paraleloPotenciaCalc.labels.Q_total')}: ${state.Q_total} ${state.Q_totalUnit}\n`;
    state.tramos.forEach((tr, i) => {
      text += `\n${t('paraleloPotenciaCalc.tramoTitle')} ${i + 1}:\n`;
      text += `  D: ${tr.D} ${tr.DUnit}\n`;
      text += `  L: ${tr.L} ${tr.LUnit}\n`;
      text += `  ks: ${tr.ks} ${tr.ksUnit}\n`;
      text += `  Km: ${tr.Km}\n`;
    });
    if (cr) {
      text += `\n${t('paraleloPotenciaCalc.balance.Hmetros')} ${fmtNum(cr.H_metros)} m\n`;
      text += `${t('paraleloPotenciaCalc.balance.P')} ${fmtNum(cr.P)} kW\n`;
    }
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('paraleloPotenciaCalc.toasts.copied') });
  }, [state, fmtNum, t]);

  // ── Clear handler ─────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setState(initialState());
  }, []);

  // ── Save to history handler ───────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    if (!state.calcResult) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('paraleloPotenciaCalc.toasts.nothingToSave') });
      return;
    }
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) { await createTable(db); dbRef.current = db; }
      const inputs = {
        H_presion: state.H_presion, H_presionUnit: state.H_presionUnit,
        rho: state.rho, rhoUnit: state.rhoUnit,
        nu: state.nu, nuUnit: state.nuUnit,
        Q_total: state.Q_total, Q_totalUnit: state.Q_totalUnit,
        tramos: state.tramos.map(tr => ({
          D: tr.D, DUnit: tr.DUnit,
          L: tr.L, LUnit: tr.LUnit,
          ks: tr.ks, ksUnit: tr.ksUnit,
          Km: tr.Km,
        })),
      };
      const resultStr = `${fmtNum(state.calcResult.P)} kW`;
      await saveCalculation(db, 'ParaleloPotenciaCalc', JSON.stringify(inputs), resultStr);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('paraleloPotenciaCalc.toasts.saved') });
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('paraleloPotenciaCalc.toasts.saveError') });
    }
  }, [state, fmtNum, t]);

  // ── Main result (Potencia requerida) ──────────────────────────────────────────
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
              style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => { bounceHeart(); toggleFavorite(); }}
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
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => navigation.navigate('ParaleloPotenciaCalcTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('paraleloPotenciaCalc.calculator')}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('paraleloPotenciaCalc.title')}
          </Text>
        </View>

        {/* ── Main result panel (Potencia requerida) ── */}
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
                  <FastImage source={backgroundImage} style={StyleSheet.absoluteFillObject} />
                  {currentTheme === 'dark' && (
                    <View
                      pointerEvents="none"
                      style={{ ...(StyleSheet.absoluteFillObject as object), backgroundColor: 'rgba(0,0,0,0.7)' }}
                    />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text style={[styles.flowLabel, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 16 * fontSizeFactor }]}>
                      {!hasResult ? 'な' : `${t('paraleloPotenciaCalc.resultLabel') || 'Potencia requerida'} (kW)`}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text style={[styles.flowValue, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }]}>
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
              { icon: 'terminal', label: t('common.calculate'), action: handleCalculate },
              { icon: 'copy',     label: t('common.copy'),      action: handleCopy },
              { icon: 'trash',    label: t('common.clear'),     action: handleClear },
              { icon: 'clock',    label: t('common.history'),   action: () => navigation.navigate('HistoryScreenParaleloPotenciaCalc') },
            ] as { icon: string; label: string; action: () => void }[]
          ).map(({ icon, label, action }) => (
            <View style={styles.actionWrapper} key={label}>
              <View style={styles.actionButtonMain}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                  onPress={action}
                >
                  <Icon name={icon} size={22 * fontSizeFactor} color="rgb(255, 255, 255)" />
                  <Icon name={icon} size={22 * fontSizeFactor} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', filter: 'blur(4px)' }} />
                </Pressable>
              </View>
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontSizeFactor }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Input section ── */}
        <View style={[styles.inputsSection, { backgroundColor: themeColors.card, paddingBottom: isKeyboardOpen ? 330 : 70 }]}>

          {/* ── Parámetros globales ── */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('paraleloPotenciaCalc.globalParams')}
          </Text>

          {/* Cabeza en presión */}
          {renderInputWithUnit(
            'H_presion',
            withSymbol(t('paraleloPotenciaCalc.labels.H_presion') || 'Cabeza total', 'H'),
            state.H_presion, state.H_presionUnit, 'pressure',
            text => setState(prev => ({ ...prev, H_presion: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.H_presion, oldUnit, newUnit, 'pressure');
              setState(prev => ({ ...prev, H_presion: converted, H_presionUnit: newUnit }));
            }
          )}

          {/* Densidad */}
          {renderInputWithUnit(
            'rho',
            withSymbol(t('paraleloPotenciaCalc.labels.rho') || 'Densidad', 'ρ'),
            state.rho, state.rhoUnit, 'density',
            text => setState(prev => ({ ...prev, rho: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.rho, oldUnit, newUnit, 'density');
              setState(prev => ({ ...prev, rho: converted, rhoUnit: newUnit }));
            }
          )}

          {/* Viscosidad cinemática */}
          {renderInputWithUnit(
            'nu',
            withSymbol(t('paraleloPotenciaCalc.labels.nu') || 'Viscosidad cinemática', 'ν'),
            state.nu, state.nuUnit, 'kinematicViscosity',
            text => setState(prev => ({ ...prev, nu: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.nu, oldUnit, newUnit, 'kinematicViscosity');
              setState(prev => ({ ...prev, nu: converted, nuUnit: newUnit }));
            }
          )}

          {/* Caudal total */}
          {renderInputWithUnit(
            'Q_total',
            withSymbol(t('paraleloPotenciaCalc.labels.Q_total') || 'Caudal total', 'Qᵗᵒᵗᵃˡ'),
            state.Q_total, state.Q_totalUnit, 'flow',
            text => setState(prev => ({ ...prev, Q_total: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.Q_total, oldUnit, newUnit, 'flow');
              setState(prev => ({ ...prev, Q_total: converted, Q_totalUnit: newUnit }));
            }
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* ── Sección de tuberías ── */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('paraleloPotenciaCalc.tramosSection')}
          </Text>

          {state.tramos.map((tramo, index) => renderTramoBlock(tramo, index))}

          {/* Botón añadir tubería */}
          <View style={styles.addButtonRow}>
            <Pressable style={styles.addButton} onPress={addTramo}>
              <Icon name="plus" size={24} color="white" />
            </Pressable>
          </View>

          {/* ── Sección de resultados ── */}
          {hasResult && (
            <>
              <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
              {renderSummaryTable()}
            </>
          )}

          {/* Texto informativo — solo visible sin resultado */}
          {!hasResult && (
            <View>
              <View style={[styles.separator, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
              <View style={styles.descriptionContainer}>
                <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                  {t('paraleloPotenciaCalc.infoText')}
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
  safeArea: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 1)' },
  mainContainer: { flex: 1, paddingVertical: 0, backgroundColor: 'rgb(0, 0, 0)' },
  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 45, backgroundColor: 'transparent', marginTop: 30, paddingHorizontal: 20,
  },
  iconWrapper: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60, height: 40, borderRadius: 30, padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 40, height: 40, borderRadius: 30, padding: 1,
  },
  iconContainer: { backgroundColor: 'rgb(20, 20, 20)', borderRadius: 30, justifyContent: 'center', alignItems: 'center', flex: 1 },
  rightIconsContainer: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  titlesContainer: { backgroundColor: 'transparent', marginVertical: 10, paddingHorizontal: 20 },
  subtitle: { color: 'rgb(255, 255, 255)', fontSize: 18, fontFamily: 'SFUIDisplay-Bold' },
  title: { color: 'rgb(255, 255, 255)', fontSize: 30, fontFamily: 'SFUIDisplay-Bold', lineHeight: 30, marginBottom: 10 },
  resultsMain: { paddingHorizontal: 20 },
  resultsContainerMain: {
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    borderRadius: 25,
  },
  resultsContainer: { backgroundColor: 'rgb(20, 20, 20)', borderRadius: 24, overflow: 'hidden' },
  saveButton: {
    backgroundColor: 'transparent', width: '100%', paddingVertical: 5, paddingHorizontal: 20,
    borderRadius: 6, alignSelf: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  saveButtonText: { color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'SFUIDisplay-Medium', fontSize: 14 },
  plusIcon: { marginLeft: 'auto' },
  imageContainer: {
    backgroundColor: 'transparent', padding: 0,
    borderTopLeftRadius: 25, borderTopRightRadius: 25, borderBottomLeftRadius: 23, borderBottomRightRadius: 23, overflow: 'hidden',
  },
  flowContainer: { alignItems: 'baseline', padding: 0, justifyContent: 'center', position: 'relative' },
  caudalLabel: {
    backgroundColor: 'rgba(142, 142, 142, 0.02)', borderWidth: 1, borderColor: 'rgba(104, 104, 104, 0.12)',
    borderRadius: 14, marginLeft: 11, marginTop: 11, height: 28, minWidth: 90, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 12,
  },
  flowLabel: { fontSize: 14, fontFamily: 'SFUIDisplay-Semibold' },
  flowValueContainer: { backgroundColor: 'transparent', marginHorizontal: 20, marginVertical: 0 },
  flowValue: { fontSize: 40, fontFamily: 'SFUIDisplay-Heavy' },
  buttonsContainer: {
    flexDirection: 'row', marginTop: 20, marginBottom: 15, backgroundColor: 'transparent',
    gap: 20, alignItems: 'center', justifyContent: 'center',
  },
  actionWrapper: { alignItems: 'center', backgroundColor: 'transparent' },
  actionButtonMain: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    padding: 1, height: 60, width: 60, borderRadius: 30,
  },
  actionButton: { backgroundColor: 'rgb(20, 20, 20)', borderRadius: 30, justifyContent: 'center', alignItems: 'center', flex: 1 },
  actionButtonText: { marginTop: 2, fontSize: 14, color: 'rgba(255, 255, 255, 1)', fontFamily: 'SFUIDisplay-Medium' },
  inputsSection: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 1)', paddingHorizontal: 20, paddingTop: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  inputWrapper: { marginBottom: 10, backgroundColor: 'transparent' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  valueDot: { width: 6, height: 6, borderRadius: 5, backgroundColor: 'rgb(194, 254, 12)', marginLeft: 0, marginBottom: 1 },
  inputLabel: { color: 'rgb(0, 0, 0)', marginBottom: 2, fontFamily: 'SFUIDisplay-Medium', fontSize: 16 },
  redContainer: { backgroundColor: 'rgba(0, 0, 0, 0)', paddingHorizontal: 0, width: '100%', gap: 10, flexDirection: 'row' },
  Container: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center', height: 50, overflow: 'hidden', borderRadius: 25, padding: 1, width: '68%',
  },
  Container2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center', height: 50, overflow: 'hidden', borderRadius: 25, padding: 1, flex: 1,
  },
  innerWhiteContainer: { backgroundColor: 'white', width: '100%', height: '100%', justifyContent: 'center', borderRadius: 25 },
  innerWhiteContainer2: {
    backgroundColor: 'white', width: '100%', height: '100%', justifyContent: 'center',
    borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingRight: 13, paddingLeft: 20,
  },
  input: { height: 50, backgroundColor: 'rgba(255, 143, 143, 0)', paddingHorizontal: 20, fontFamily: 'SFUIDisplay-Medium', marginTop: 2.75, fontSize: 16, color: 'rgba(0, 0, 0, 1)' },
  sectionSubtitle: { fontSize: 20, fontFamily: 'SFUIDisplay-Bold', color: 'rgb(0, 0, 0)', marginTop: 5, marginBottom: 5 },
  separator: { height: 1, backgroundColor: 'rgb(235, 235, 235)', marginVertical: 10 },
  text: { fontFamily: 'SFUIDisplay-Medium', fontSize: 16, color: 'rgba(0, 0, 0, 1)', marginTop: 2.75 },
  icon: { marginLeft: 'auto' },
  accessoryBlockMain: { padding: 1, marginBottom: 12, backgroundColor: 'transparent', borderRadius: 25 },
  accessoryBlock: { borderRadius: 24, paddingHorizontal: 20, paddingBottom: 15, paddingTop: 15, backgroundColor: 'rgba(255, 255, 255, 1)' },
  accessoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  accessoryTitle: { fontFamily: 'SFUIDisplay-Bold', fontSize: 16 },
  deleteButton: { backgroundColor: 'rgb(254, 12, 12)', padding: 5, borderRadius: 0 },
  addButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 6 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgb(0, 0, 0)', justifyContent: 'center', alignItems: 'center' },
  tableContainer: { borderWidth: 0, marginTop: 0, marginBottom: 16 },
  tableRow: { flexDirection: 'row' },
  tableCell: { borderRightWidth: 0, paddingVertical: 7, paddingHorizontal: 6, justifyContent: 'center' },
  tableCellHeaderText: { fontFamily: 'SFUIDisplay-Bold', fontSize: 11 },
  tableCellText: { fontFamily: 'SFUIDisplay-Regular', fontSize: 11 },
  balanceContainer: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 4 },
  balanceText: { fontFamily: 'SFUIDisplay-Regular', fontSize: 13 },
  balanceValue: { fontFamily: 'SFUIDisplay-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalLandscapeContainer: { borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 0, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0)' },
  modalTitle: { fontFamily: 'SFUIDisplay-Bold', fontSize: 15 },
  expandButton: { width: 90, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  expandButtonMasked: { width: 90, height: 40 },
  expandButtonMask: { width: 90, height: 40, backgroundColor: 'transparent', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)' },
  buttonGradient2: {
    width: 90, height: 40,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonGradient22: {
    width: 40, height: 40,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonBackground2: { width: 90, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', position: 'absolute', borderRadius: 25 },
  buttonBackground22: { width: 40, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', position: 'absolute', borderRadius: 25 },
  modalCloseButton: { width: 40, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  modalCloseButtonMasked: { width: 40, height: 40 },
  modalCloseButtonMask: { width: 40, height: 40, backgroundColor: 'transparent', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)' },
  modalCloseButtonIcon: { position: 'absolute' },
  expandButtonContent: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 15, height: '100%' },
  expandButtonText: { fontFamily: 'SFUIDisplay-Regular', fontSize: 14, marginRight: 5 },
  descriptionContainer: { marginVertical: 5, marginHorizontal: 5 },
  descriptionText: { fontSize: 14, color: 'rgb(170, 170, 170)', fontFamily: 'SFUIDisplay-Regular', lineHeight: 18, marginBottom: 8 },
  customKeyboardWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f5f5f5' },
  logoContainer: { position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, opacity: 1, zIndex: 10 },
  logoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
});

export default ParaleloPotenciaCalc;
