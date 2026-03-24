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

const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark  = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenCompParaleloCalc: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenCompParaleloCalc: undefined;
  CompParaleloCalcTheory: undefined;
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
    m: 1, mm: 0.001, cm: 0.01, km: 1000,
    in: 0.0254, ft: 0.3048, μm: 1e-6,
  },
  viscosity: {
    'm²/s': 1, 'mm²/s': 1e-6, 'cm²/s': 1e-4, 'ft²/s': 0.09290304,
  },
};

// ─── Domain types ─────────────────────────────────────────────────────────────
interface Ramal {
  id: number;
  D: string;
  DUnit: string;
  L: string;
  LUnit: string;
  Km: string;
  ks: string;
  ksUnit: string;
}

interface IterRowRamal {
  Q: number;
  Re: number;
  f: number;
  H: number;
  error: number;
}

interface IterationRow {
  iter: number;
  Q_total: number;
  ramalesData: IterRowRamal[];
}

interface FinalRamalData {
  D: number;
  L: number;
  Q: number;
  V: number;
  Re: number;
  f: number;
  hf: number;
  hm: number;
  H: number;
}

interface CalcResult {
  converged: boolean;
  iterations: number;
  finalError: number;
  Q_total: number;
  delta_H: number;
  ramalesData: FinalRamalData[];
  iterationTable: IterationRow[];
}

interface CalculatorState {
  nu: string;
  nuUnit: string;
  H1: string;
  H1Unit: string;
  H2: string;
  H2Unit: string;
  ramales: Ramal[];
  invalidFields: string[];
  calcResult: CalcResult | null;
}

// ─── Hydraulic calc — Newton-Raphson on x = 1/√f (Colebrook-White) ───────────
function factorFriccionNR(Re: number, ks_i: number, D_i: number): number {
  if (Re <= 0) return 0;
  if (Re < 2000) return 64.0 / Re;

  const r      = ks_i / (3.7 * D_i);
  const argSW  = Math.max(r + 5.74 / Math.pow(Re, 0.9), 1e-15);
  let x        = -2.0 * Math.log10(argSW);   // x = 1/√f  (Swamee-Jain seed)
  const A      = r;
  const B      = 2.51 / Re;

  for (let iter = 0; iter < 100; iter++) {
    const arg = Math.max(A + B * x, 1e-15);
    const F   = x + 2.0 * Math.log10(arg);
    const dF  = 1.0 + (2.0 / Math.LN10) * (B / arg);
    if (Math.abs(dF) < 1e-20) break;
    const x_new = x - F / dF;
    const delta  = Math.abs(x_new - x);
    x = x_new;
    if (delta < 1e-12) break;
  }
  return Math.abs(x) > 1e-15 ? 1.0 / (x * x) : 0;
}

function perdidasRamal(
  Q_i: number,
  D_i: number,
  L_i: number,
  Km_i: number,
  ks_i: number,
  nu: number,
  g: number
): { H: number; V: number; Re: number; f: number; hf: number; hm: number } {
  const A_i  = Math.PI * D_i * D_i / 4.0;
  const V_i  = A_i > 0 ? Q_i / A_i : 0;
  const Re_i = V_i > 0 ? (V_i * D_i) / nu : 0;
  const f_i  = Re_i > 0 ? factorFriccionNR(Re_i, ks_i, D_i) : 0;
  const hv_i = (V_i * V_i) / (2.0 * g);
  const hf_i = f_i * (L_i / D_i) * hv_i;
  const hm_i = Km_i * hv_i;
  return { H: hf_i + hm_i, V: V_i, Re: Re_i, f: f_i, hf: hf_i, hm: hm_i };
}

function calcularParalelo(
  nuVal: number,
  H1Val: number,
  H2Val: number,
  ramales: { D: number; L: number; Km: number; ks: number }[]
): CalcResult {
  const g       = 9.81;
  const TOL     = 1e-8;
  const MAX_ITER = 300;
  const N       = ramales.length;
  const delta_H = H1Val - H2Val;

  const D  = ramales.map(r => r.D);
  const L  = ramales.map(r => r.L);
  const Km = ramales.map(r => r.Km);
  const ks = ramales.map(r => r.ks);

  const perdidas = (Q_i: number, i: number) =>
    perdidasRamal(Q_i, D[i], L[i], Km[i], ks[i], nuVal, g);

  // Initial estimates: V = 1 m/s per ramal; second point +5%
  let Qa = D.map(d => 1.0 * Math.PI * d * d / 4.0);
  let Qb = Qa.map(q => q * 1.05);
  let Fa = Qa.map((q, i) => perdidas(q, i).H - delta_H);
  let Fb = Qb.map((q, i) => perdidas(q, i).H - delta_H);

  const buildIterRow = (iterNum: number, Q_list: number[]): IterationRow => {
    const rData = Q_list.map((q, i) => {
      const { H, Re, f } = perdidas(q, i);
      return { Q: q, Re, f, H, error: H - delta_H };
    });
    return {
      iter: iterNum,
      Q_total: Q_list.reduce((a, b) => a + b, 0),
      ramalesData: rData,
    };
  };

  const iterationTable: IterationRow[] = [buildIterRow(0, Qa)];

  let converged = false;
  let n_iter    = 0;

  for (let k = 1; k <= MAX_ITER; k++) {
    n_iter = k;
    const Qc: number[] = [];
    const Fc: number[] = [];

    for (let i = 0; i < N; i++) {
      let dF = Fb[i] - Fa[i];
      if (Math.abs(dF) < 1e-20) {
        Qb[i] *= 1.01;
        Fb[i]  = perdidas(Qb[i], i).H - delta_H;
        dF     = Fb[i] - Fa[i];
      }
      let Q_new = Qb[i] - Fb[i] * (Qb[i] - Qa[i]) / dF;
      if (Q_new <= 0) Q_new = (Qa[i] + Qb[i]) / 2.0;
      const { H: H_new } = perdidas(Q_new, i);
      Qc.push(Q_new);
      Fc.push(H_new - delta_H);
    }

    iterationTable.push(buildIterRow(k, Qc));

    const maxErr = Math.max(...Fc.map(v => Math.abs(v)));
    if (maxErr < TOL) {
      converged = true;
      Qa = [...Qb]; Fa = [...Fb];
      Qb = [...Qc]; Fb = [...Fc];
      break;
    }
    Qa = [...Qb]; Fa = [...Fb];
    Qb = [...Qc]; Fb = [...Fc];
  }

  const Q_conv  = Qb;
  const Q_total = Q_conv.reduce((a, b) => a + b, 0);
  const finalError = Math.max(...Fb.map(v => Math.abs(v)));

  const ramalesData: FinalRamalData[] = Q_conv.map((q, i) => {
    const { H, V, Re, f, hf, hm } = perdidas(q, i);
    return { D: D[i], L: L[i], Q: q, V, Re, f, hf, hm, H };
  });

  return {
    converged,
    iterations: n_iter,
    finalError,
    Q_total,
    delta_H,
    ramalesData,
    iterationTable,
  };
}

// ─── Ramal factory ────────────────────────────────────────────────────────────
const createNewRamal = (): Ramal => ({
  id: Date.now() + Math.random(),
  D: '',    DUnit: 'mm',
  L: '',    LUnit: 'm',
  Km: '',
  ks: '',   ksUnit: 'mm',
});

const initialState = (): CalculatorState => ({
  nu:     '',  nuUnit: 'm²/s',
  H1:     '',  H1Unit: 'm',
  H2:     '',  H2Unit: 'm',
  ramales: [createNewRamal(), createNewRamal()],
  invalidFields: [],
  calcResult: null,
});

// ─── Main component ───────────────────────────────────────────────────────────
const withSymbol = (label: string, symbol: string): string => `${label} (${symbol})`;

const CompParaleloCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber }            = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor }          = useContext(FontSizeContext);
  const { currentTheme }            = useTheme();
  const { t }                       = useContext(LanguageContext);

  const { activeInputId, setActiveInputId } = useKeyboard();

  const stateRef        = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});

  // ── Theme palette ─────────────────────────────────────────────────────────────
  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
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
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      gradient2:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient:  'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      cardGradient2: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
      tableHeader:   'rgb(245,245,245)',
      tableBorder:   'rgb(220,220,220)',
    };
  }, [currentTheme]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [state, setState]                       = useState<CalculatorState>(initialState());
  const [tableModalVisible, setTableModalVisible]     = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  useFocusEffect(
    React.useCallback(() => {
      return () => { setActiveInputId(null); };
    }, [setActiveInputId])
  );

  // ── ScrollView + auto-scroll ──────────────────────────────────────────────
  const scrollViewRef    = useRef<ScrollView>(null);
  const inputRefs        = useRef<Record<string, View | null>>({});
  const activeInputIdRef = useRef<string | null>(null);

  useEffect(() => { activeInputIdRef.current = activeInputId; }, [activeInputId]);

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

  // ── Animations ────────────────────────────────────────────────────────────
  const heartScale = useRef(new Animated.Value(1)).current;

  // ── DB / favourites ───────────────────────────────────────────────────────
  const dbRef          = useRef<any>(null);
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
        const fav = await isFavorite(db, 'CompParaleloCalc');
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
      const route = 'CompParaleloCalc';
      const label = t('compParaleloCalc.title') || 'Tuberías en Paralelo';
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

  // ── Navigate to options ───────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
      navigation.navigate('OptionsScreenCompParaleloCalc', { category, onSelectOption, selectedOption });
    },
    [navigation]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  // ── Ramal CRUD ────────────────────────────────────────────────────────────
  const addRamal = useCallback(() => {
    setState(prev => ({ ...prev, ramales: [...prev.ramales, createNewRamal()] }));
  }, []);

  const removeRamal = useCallback((id: number) => {
    setState(prev => ({ ...prev, ramales: prev.ramales.filter(r => r.id !== id) }));
  }, []);

  const updateRamal = useCallback((id: number, updates: Partial<Ramal>) => {
    setState(prev => ({
      ...prev,
      ramales: prev.ramales.map(r => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  // ── Custom keyboard handlers ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;
    const globalMap: Record<string, string> = { nu: s.nu, H1: s.H1, H2: s.H2 };
    if (id in globalMap) return globalMap[id];

    const parts = id.split('-');
    if (parts.length >= 3 && parts[0] === 'ramal') {
      const ramalId = parseFloat(parts[1]);
      const field   = parts[2] as keyof Ramal;
      const ramal   = s.ramales.find(r => r.id === ramalId);
      if (ramal && typeof ramal[field] === 'string') return ramal[field] as string;
    }
    return '';
  }, []);

  const handleKeyboardKey       = useCallback((key: string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(getActiveValue() + key);
  }, [getActiveValue]);

  const handleKeyboardDelete    = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(getActiveValue().slice(0, -1));
  }, [getActiveValue]);

  const handleKeyboardClear     = useCallback(() => {
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

  const handleKeyboardDivide10  = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const val = getActiveValue();
    if (val === '' || val === '.') return;
    inputHandlersRef.current[id]?.((parseFloat(val) / 10).toString());
  }, [getActiveValue]);

  const handleKeyboardSubmit    = useCallback(() => { setActiveInputId(null); }, [setActiveInputId]);

  const isKeyboardOpen = !!activeInputId;

  // ── Input renderers ───────────────────────────────────────────────────────
  const renderSimpleInput = useCallback(
    (fieldId: string, label: string, value: string, onChange: (t: string) => void) => {
      const isInvalid = state.invalidFields.includes(fieldId);
      const hasValue  = (value?.trim()?.length ?? 0) > 0;

      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setState(prev => ({ ...prev, invalidFields: prev.invalidFields.filter(f => f !== fieldId) }));
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
        setState(prev => ({ ...prev, invalidFields: prev.invalidFields.filter(f => f !== fieldId) }));
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

  // ── Ramal block renderer ──────────────────────────────────────────────────
  const renderRamalBlock = useCallback(
    (ramal: Ramal, index: number) => (
      <View
        key={ramal.id}
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
              {(t('compParaleloCalc.ramalTitle') || 'Ramal') + ` ${index + 1}`}
            </Text>
            {state.ramales.length > 1 && (
              <Pressable
                onPress={() => removeRamal(ramal.id)}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
              </Pressable>
            )}
          </View>

          {/* D */}
          {renderInputWithUnit(
            `ramal-${ramal.id}-D`,
            withSymbol(t('compParaleloCalc.labels.D') || 'Diámetro', 'D'),
            ramal.D, ramal.DUnit, 'length',
            text => updateRamal(ramal.id, { D: text }),
            (newUnit, oldUnit) => {
              const c = convertValue(ramal.D, oldUnit, newUnit, 'length');
              updateRamal(ramal.id, { D: c, DUnit: newUnit });
            }
          )}

          {/* L */}
          {renderInputWithUnit(
            `ramal-${ramal.id}-L`,
            withSymbol(t('compParaleloCalc.labels.L') || 'Longitud', 'L'),
            ramal.L, ramal.LUnit, 'length',
            text => updateRamal(ramal.id, { L: text }),
            (newUnit, oldUnit) => {
              const c = convertValue(ramal.L, oldUnit, newUnit, 'length');
              updateRamal(ramal.id, { L: c, LUnit: newUnit });
            }
          )}

          {/* Km */}
          {renderSimpleInput(
            `ramal-${ramal.id}-Km`,
            withSymbol(t('compParaleloCalc.labels.Km') || 'Coef. pérdidas menores', 'Kᵐ'),
            ramal.Km,
            text => updateRamal(ramal.id, { Km: text })
          )}

          {/* ks */}
          {renderInputWithUnit(
            `ramal-${ramal.id}-ks`,
            withSymbol(t('compParaleloCalc.labels.ks') || 'Rugosidad absoluta', 'kˢ'),
            ramal.ks, ramal.ksUnit, 'length',
            text => updateRamal(ramal.id, { ks: text }),
            (newUnit, oldUnit) => {
              const c = convertValue(ramal.ks, oldUnit, newUnit, 'length');
              updateRamal(ramal.id, { ks: c, ksUnit: newUnit });
            }
          )}
        </View>
      </View>
    ),
    [
      state.ramales.length, themeColors, currentTheme, fontSizeFactor, t,
      renderInputWithUnit, renderSimpleInput, convertValue, updateRamal, removeRamal,
    ]
  );

  // ── Table renderers ───────────────────────────────────────────────────────
  const fmtNum = useCallback(
    (n: number): string => {
      if (!isFinite(n) || isNaN(n)) return '-';
      if (n === 0) return '0';
      const s = formatResult(n);
      return s.length > 10 ? s.substring(0, 10) : s;
    },
    [formatResult]
  );

  /** Summary table: final per-ramal values */
  const renderSummaryTable = useCallback(() => {
    if (!state.calcResult) return null;
    const { ramalesData, Q_total, delta_H } = state.calcResult;
    const bc  = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const cols: [string, number][] = [
      [t('compParaleloCalc.table.ramal')  || 'Ramal',     52],
      [t('compParaleloCalc.table.D')      || 'D [m]',     76],
      [t('compParaleloCalc.table.L')      || 'L [m]',     76],
      [t('compParaleloCalc.table.Q')      || 'Q [m³/s]',  92],
      [t('compParaleloCalc.table.V')      || 'V [m/s]',   80],
      [t('compParaleloCalc.table.Re')     || 'Re',        80],
      [t('compParaleloCalc.table.f')      || 'f',         72],
      [t('compParaleloCalc.table.hf')     || 'hf [m]',    80],
      [t('compParaleloCalc.table.hm')     || 'hm [m]',    80],
      [t('compParaleloCalc.table.Hramal') || 'H [m]',     80],
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
        {ramalesData.map((row, i) => {
          const rowBg = i % 2 !== 0
            ? currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
            : 'transparent';
          const rowData = [
            String(i + 1),
            fmtNum(row.D), fmtNum(row.L), fmtNum(row.Q),
            fmtNum(row.V), fmtNum(row.Re), fmtNum(row.f),
            fmtNum(row.hf), fmtNum(row.hm), fmtNum(row.H),
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
            if (ci === 0) content = t('compParaleloCalc.table.total') || 'Σ';
            else if (ci === 3) content = fmtNum(Q_total);
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
        {/* Title row with expand button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('compParaleloCalc.table.summaryTitle') || 'Resumen final'}
          </Text>
          <Pressable onPress={() => setSummaryModalVisible(true)} style={styles.expandButton}>
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
            <MaskedView style={styles.expandButtonMasked} maskElement={<View style={styles.expandButtonMask} />}>
              <View style={[styles.buttonGradient2, { experimental_backgroundImage: themeColors.gradient2 }]} />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text style={[styles.expandButtonText, { color: themeColors.text, fontSize: 14 * fontSizeFactor }]}>
                {t('compParaleloCalc.table.viewFull') || 'Ver completo'}
              </Text>
              <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>

        {/* Inline table */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
          </ScrollView>
        </View>

        {/* Balance */}
        <View style={[styles.balanceContainer, { borderColor: themeColors.tableBorder }]}>
          {ramalesData.map((row, i) => (
            <Text key={`bal-${i}`} style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
              {`Q${i + 1}`}{': '}
              <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
                {fmtNum(row.Q)} m³/s
              </Text>
            </Text>
          ))}
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {t('compParaleloCalc.balance.Qtotal') || 'Q total'}{': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(Q_total)} m³/s
            </Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {'ΔH disp.'}{': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(delta_H)} m
            </Text>
          </Text>
        </View>

        {/* Landscape modal */}
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
                    {t('compParaleloCalc.table.summaryTitle') || 'Resumen final'}
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

  /** Iteration table (secant method per ramal) */
  const renderIterationTable = useCallback(() => {
    if (!state.calcResult || state.calcResult.iterationTable.length === 0) return null;

    const { iterationTable, converged } = state.calcResult;
    const N   = state.ramales.length;
    const bc  = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // Dynamic columns: Iter | per-ramal: Q_i Re_i f_i H_i Err_i | Q_total
    const fixedCols: [string, number][] = [
      [t('compParaleloCalc.table.iter') || 'Iter', 46],
    ];
    const ramalCols: [string, number][] = [];
    for (let i = 0; i < N; i++) {
      const n = i + 1;
      ramalCols.push(
        [`Q${n} [m³/s]`, 94],
        [`Re${n}`,        82],
        [`f${n}`,         72],
        [`H${n} [m]`,     82],
        [`Err${n} [m]`,   88],
      );
    }
    const endCols: [string, number][] = [
      [t('compParaleloCalc.table.Qtotal') || 'Q_tot [m³/s]', 100],
    ];
    const cols: [string, number][] = [...fixedCols, ...ramalCols, ...endCols];
    const totalTableWidth = cols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;

    const renderTableContent = (scale: number, textColor: string, textStrong: string) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, w], ci) => (
            <View key={`ih-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: bc, backgroundColor: hBg, borderBottomWidth: 1 }]}>
              <Text style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]} numberOfLines={1}>
                {hdr}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {iterationTable.map((row, ri) => {
          const isLast         = ri === iterationTable.length - 1;
          const isConvergedRow = isLast && converged;
          const rowBg = isConvergedRow
            ? currentTheme === 'dark' ? 'rgba(194,254,12,0.08)' : 'rgba(194,254,12,0.15)'
            : ri % 2 !== 0
            ? currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
            : 'transparent';

          const rowData: string[] = [
            isConvergedRow ? '→ ' + String(row.iter) : String(row.iter),
          ];
          row.ramalesData.forEach(rd => {
            rowData.push(fmtNum(rd.Q), fmtNum(rd.Re), fmtNum(rd.f), fmtNum(rd.H), fmtNum(rd.error));
          });
          rowData.push(fmtNum(row.Q_total));

          return (
            <View key={`ir-${ri}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
              {cols.map(([, w], ci) => (
                <View key={`ic-${ri}-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: bc }]}>
                  <Text
                    style={[
                      isConvergedRow ? styles.tableCellHeaderText : styles.tableCellText,
                      { color: isConvergedRow ? textStrong : textColor, fontSize: 11 * scale },
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
      </View>
    );

    const modalLandscapeWidth  = screenHeight;
    const modalLandscapeHeight = screenWidth;

    return (
      <View style={{ marginTop: 8 }}>
        {/* Title row with expand button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('compParaleloCalc.table.iterTitle') || 'Tabla de iteraciones'}
          </Text>
          <Pressable onPress={() => setTableModalVisible(true)} style={styles.expandButton}>
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
            <MaskedView style={styles.expandButtonMasked} maskElement={<View style={styles.expandButtonMask} />}>
              <View style={[styles.buttonGradient2, { experimental_backgroundImage: themeColors.gradient2 }]} />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text style={[styles.expandButtonText, { color: themeColors.text, fontSize: 14 * fontSizeFactor }]}>
                {t('compParaleloCalc.table.viewFull') || 'Ver completo'}
              </Text>
              <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>

        {/* Inline table */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
          </ScrollView>
        </View>

        {/* Landscape modal */}
        <Modal
          visible={tableModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTableModalVisible(false)}
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
                    {t('compParaleloCalc.table.iterTitle') || 'Tabla de iteraciones'}
                  </Text>
                  <Pressable onPress={() => setTableModalVisible(false)} style={styles.modalCloseButton}>
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
  }, [
    state.calcResult, state.ramales.length, tableModalVisible,
    themeColors, currentTheme, fontSizeFactor, t, fmtNum,
  ]);

  // ── Calculate handler ─────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const invalid: string[] = [];

    const nuRaw = parseFloat((state.nu || '').replace(',', '.'));
    const nuSI  = isNaN(nuRaw) ? NaN : nuRaw * (conversionFactors.viscosity[state.nuUnit] ?? 1);
    if (!isFinite(nuSI) || nuSI <= 0) invalid.push('nu');

    const H1Raw = parseFloat((state.H1 || '').replace(',', '.'));
    const H1SI  = isNaN(H1Raw) ? NaN : H1Raw * (conversionFactors.length[state.H1Unit] ?? 1);
    if (!isFinite(H1SI)) invalid.push('H1');

    const H2Raw = parseFloat((state.H2 || '').replace(',', '.'));
    const H2SI  = isNaN(H2Raw) ? NaN : H2Raw * (conversionFactors.length[state.H2Unit] ?? 1);
    if (!isFinite(H2SI)) invalid.push('H2');

    if (isFinite(H1SI) && isFinite(H2SI) && H1SI <= H2SI) {
      if (!invalid.includes('H1')) invalid.push('H1');
      if (!invalid.includes('H2')) invalid.push('H2');
    }

    const ramalesForCalc: { D: number; L: number; Km: number; ks: number }[] = [];

    state.ramales.forEach(ramal => {
      const D_raw = parseFloat((ramal.D || '').replace(',', '.'));
      const D_si  = isNaN(D_raw) ? NaN : D_raw * (conversionFactors.length[ramal.DUnit] ?? 1);
      if (!isFinite(D_si) || D_si <= 0) invalid.push(`ramal-${ramal.id}-D`);

      const L_raw = parseFloat((ramal.L || '').replace(',', '.'));
      const L_si  = isNaN(L_raw) ? NaN : L_raw * (conversionFactors.length[ramal.LUnit] ?? 1);
      if (!isFinite(L_si) || L_si <= 0) invalid.push(`ramal-${ramal.id}-L`);

      const Km_raw = parseFloat((ramal.Km || '').replace(',', '.'));
      if (isNaN(Km_raw) || Km_raw < 0) invalid.push(`ramal-${ramal.id}-Km`);

      const ks_raw = parseFloat((ramal.ks || '').replace(',', '.'));
      const ks_si  = isNaN(ks_raw) ? NaN : ks_raw * (conversionFactors.length[ramal.ksUnit] ?? 1);
      if (!isFinite(ks_si) || ks_si < 0) invalid.push(`ramal-${ramal.id}-ks`);

      ramalesForCalc.push({
        D:  isFinite(D_si)  ? D_si  : 0,
        L:  isFinite(L_si)  ? L_si  : 0,
        Km: isNaN(Km_raw)   ? 0     : Km_raw,
        ks: isFinite(ks_si) ? ks_si : 0,
      });
    });

    if (invalid.length > 0) {
      setState(prev => ({ ...prev, invalidFields: invalid }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('compParaleloCalc.toasts.missingFields') || 'Faltan campos obligatorios',
      });
      return;
    }

    try {
      const result = calcularParalelo(nuSI, H1SI, H2SI, ramalesForCalc);
      setState(prev => ({ ...prev, invalidFields: [], calcResult: result }));
      if (!result.converged) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('compParaleloCalc.toasts.notConverged') || 'No se alcanzó la convergencia',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('compParaleloCalc.toasts.calcError') || 'Error en el cálculo',
      });
    }
  }, [state, t]);

  // ── Copy handler ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const cr = state.calcResult;
    let text = '';
    text += `${t('compParaleloCalc.labels.Q_total') || 'Q total'}: ${cr ? fmtNum(cr.Q_total) : '-'} m³/s\n`;
    text += `ν: ${state.nu} ${state.nuUnit}\n`;
    text += `H1: ${state.H1} ${state.H1Unit}  H2: ${state.H2} ${state.H2Unit}\n`;
    state.ramales.forEach((r, i) => {
      text += `\n${t('compParaleloCalc.ramalTitle') || 'Ramal'} ${i + 1}:\n`;
      text += `  D: ${r.D} ${r.DUnit}\n`;
      text += `  L: ${r.L} ${r.LUnit}\n`;
      text += `  Km: ${r.Km}\n`;
      text += `  ks: ${r.ks} ${r.ksUnit}\n`;
    });
    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('compParaleloCalc.toasts.copied') || 'Copiado al portapapeles',
    });
  }, [state, fmtNum, t]);

  // ── Clear handler ─────────────────────────────────────────────────────────
  const handleClear = useCallback(() => { setState(initialState()); }, []);

  // ── Save to history handler ───────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    if (!state.calcResult) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('compParaleloCalc.toasts.nothingToSave') || 'Nada para guardar',
      });
      return;
    }
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) { await createTable(db); dbRef.current = db; }
      const inputs = {
        nu: state.nu, nuUnit: state.nuUnit,
        H1: state.H1, H1Unit: state.H1Unit,
        H2: state.H2, H2Unit: state.H2Unit,
        ramales: state.ramales.map(r => ({
          D: r.D, DUnit: r.DUnit, L: r.L, LUnit: r.LUnit,
          Km: r.Km, ks: r.ks, ksUnit: r.ksUnit,
        })),
      };
      const resultStr = `${fmtNum(state.calcResult.Q_total)} m³/s`;
      await saveCalculation(db, 'CompParaleloCalc', JSON.stringify(inputs), resultStr);
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('compParaleloCalc.toasts.saved') || 'Guardado en historial',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('compParaleloCalc.toasts.saveError') || 'Error al guardar',
      });
    }
  }, [state, fmtNum, t]);

  // ── Main result ───────────────────────────────────────────────────────────
  const mainResultValue = useMemo(() => {
    if (!state.calcResult) return '';
    const Q = state.calcResult.Q_total;
    if (!isFinite(Q) || isNaN(Q)) return '-';
    const s = formatResult(Q);
    const num = parseFloat(s);
    if (isNaN(num)) return s;
    return adjustDecimalSeparator(formatNumber(num));
  }, [state.calcResult, formatResult, formatNumber, adjustDecimalSeparator]);

  const hasResult = !!state.calcResult;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
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
                onPress={() => navigation.navigate('CompParaleloCalcTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('compParaleloCalc.calculator') || 'Calculadora'}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('compParaleloCalc.title') || 'Tuberías en Paralelo'}
          </Text>
        </View>

        {/* ── Main result panel ── */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>
                  {t('energiaBernoulliCalc.saveToHistory') || 'Guardar en historial'}
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
                      {!hasResult ? 'な' : `${t('compParaleloCalc.resultLabel') || 'Caudal total'} (m³/s)`}
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
              { icon: 'terminal', label: t('common.calculate') || 'Calcular',  action: handleCalculate },
              { icon: 'copy',     label: t('common.copy')      || 'Copiar',    action: handleCopy },
              { icon: 'trash',    label: t('common.clear')     || 'Limpiar',   action: handleClear },
              { icon: 'clock',    label: t('common.history')   || 'Historial', action: () => navigation.navigate('HistoryScreenCompParaleloCalc') },
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

          {/* Global parameters */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('compParaleloCalc.globalParams') || 'Parámetros globales'}
          </Text>

          {renderInputWithUnit(
            'nu',
            withSymbol(t('compParaleloCalc.labels.nu') || 'Viscosidad cinemática', 'ν'),
            state.nu, state.nuUnit, 'viscosity',
            text => setState(prev => ({ ...prev, nu: text })),
            (newUnit, oldUnit) => {
              const c = convertValue(state.nu, oldUnit, newUnit, 'viscosity');
              setState(prev => ({ ...prev, nu: c, nuUnit: newUnit }));
            }
          )}

          {renderInputWithUnit(
            'H1',
            withSymbol(t('compParaleloCalc.labels.H1') || 'Carga piezométrica aguas arriba', 'H₁'),
            state.H1, state.H1Unit, 'length',
            text => setState(prev => ({ ...prev, H1: text })),
            (newUnit, oldUnit) => {
              const c = convertValue(state.H1, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, H1: c, H1Unit: newUnit }));
            }
          )}

          {renderInputWithUnit(
            'H2',
            withSymbol(t('compParaleloCalc.labels.H2') || 'Carga piezométrica aguas abajo', 'H₂'),
            state.H2, state.H2Unit, 'length',
            text => setState(prev => ({ ...prev, H2: text })),
            (newUnit, oldUnit) => {
              const c = convertValue(state.H2, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, H2: c, H2Unit: newUnit }));
            }
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* Ramales section */}
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('compParaleloCalc.ramalesSection') || 'Ramales'}
          </Text>

          {state.ramales.map((ramal, index) => renderRamalBlock(ramal, index))}

          {/* Add ramal button */}
          <View style={styles.addButtonRow}>
            <Pressable style={styles.addButton} onPress={addRamal}>
              <Icon name="plus" size={24} color="white" />
            </Pressable>
          </View>

          {/* Results section */}
          {hasResult && (
            <>
              <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
              {renderSummaryTable()}
              <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
              {renderIterationTable()}
            </>
          )}

          {/* Info text */}
          {!hasResult && (
            <View>
              <View style={[styles.separator, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
              <View style={styles.descriptionContainer}>
                <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                  {t('compParaleloCalc.infoText')}
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

      {/* Custom keyboard */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: 'rgba(0, 0, 0, 1)' },
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
  iconContainer: {
    backgroundColor: 'rgb(20, 20, 20)', borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', flex: 1,
  },
  rightIconsContainer: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  titlesContainer:     { backgroundColor: 'transparent', marginVertical: 10, paddingHorizontal: 20 },
  subtitle: { color: 'rgb(255, 255, 255)', fontSize: 18, fontFamily: 'SFUIDisplay-Bold' },
  title:    { color: 'rgb(255, 255, 255)', fontSize: 30, fontFamily: 'SFUIDisplay-Bold', lineHeight: 30, marginBottom: 10 },
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
  plusIcon:       { marginLeft: 'auto' },
  imageContainer: {
    backgroundColor: 'transparent', padding: 0,
    borderTopLeftRadius: 25, borderTopRightRadius: 25,
    borderBottomLeftRadius: 23, borderBottomRightRadius: 23, overflow: 'hidden',
  },
  flowContainer:      { alignItems: 'baseline', padding: 0, justifyContent: 'center', position: 'relative' },
  caudalLabel: {
    backgroundColor: 'rgba(142, 142, 142, 0.02)', borderWidth: 1,
    borderColor: 'rgba(104, 104, 104, 0.12)', borderRadius: 14,
    marginLeft: 11, marginTop: 11, height: 28, minWidth: 90,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12,
  },
  flowLabel:          { fontSize: 14, fontFamily: 'SFUIDisplay-Semibold' },
  flowValueContainer: { backgroundColor: 'transparent', marginHorizontal: 20, marginVertical: 0 },
  flowValue:          { fontSize: 40, fontFamily: 'SFUIDisplay-Heavy' },
  buttonsContainer: {
    flexDirection: 'row', marginTop: 20, marginBottom: 15,
    backgroundColor: 'transparent', gap: 20, alignItems: 'center', justifyContent: 'center',
  },
  actionWrapper:    { alignItems: 'center', backgroundColor: 'transparent' },
  actionButtonMain: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    padding: 1, height: 60, width: 60, borderRadius: 30,
  },
  actionButton:     { backgroundColor: 'rgb(20, 20, 20)', borderRadius: 30, justifyContent: 'center', alignItems: 'center', flex: 1 },
  actionButtonText: { marginTop: 2, fontSize: 14, color: 'rgba(255, 255, 255, 1)', fontFamily: 'SFUIDisplay-Medium' },
  // ── Input section ──────────────────────────────────────────────────────────
  inputsSection: {
    flex: 1, backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingHorizontal: 20, paddingTop: 20,
    borderTopLeftRadius: 25, borderTopRightRadius: 25,
  },
  inputWrapper: { marginBottom: 10, backgroundColor: 'transparent' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  valueDot:  { width: 6, height: 6, borderRadius: 5, backgroundColor: 'rgb(194, 254, 12)', marginLeft: 0, marginBottom: 1 },
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
  innerWhiteContainer:  { backgroundColor: 'white', width: '100%', height: '100%', justifyContent: 'center', borderRadius: 25 },
  innerWhiteContainer2: {
    backgroundColor: 'white', width: '100%', height: '100%', justifyContent: 'center',
    borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingRight: 13, paddingLeft: 20,
  },
  input: {
    height: 50, backgroundColor: 'rgba(255, 143, 143, 0)',
    paddingHorizontal: 20, fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75, fontSize: 16, color: 'rgba(0, 0, 0, 1)',
  },
  sectionSubtitle: { fontSize: 20, fontFamily: 'SFUIDisplay-Bold', color: 'rgb(0, 0, 0)', marginTop: 5, marginBottom: 5 },
  separator:       { height: 1, backgroundColor: 'rgb(235, 235, 235)', marginVertical: 10 },
  text:            { fontFamily: 'SFUIDisplay-Medium', fontSize: 16, color: 'rgba(0, 0, 0, 1)', marginTop: 2.75 },
  icon:            { marginLeft: 'auto' },
  // ── Ramal block ────────────────────────────────────────────────────────────
  accessoryBlockMain: { padding: 1, marginBottom: 12, backgroundColor: 'transparent', borderRadius: 25 },
  accessoryBlock:     { borderRadius: 24, paddingHorizontal: 20, paddingBottom: 15, paddingTop: 15, backgroundColor: 'rgba(255, 255, 255, 1)' },
  accessoryHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  accessoryTitle:     { fontFamily: 'SFUIDisplay-Bold', fontSize: 16 },
  deleteButton:       { backgroundColor: 'rgb(254, 12, 12)', padding: 5, borderRadius: 0 },
  // ── Add ramal button ────────────────────────────────────────────────────────
  addButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 6 },
  addButton:    { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgb(0, 0, 0)', justifyContent: 'center', alignItems: 'center' },
  // ── Tables ─────────────────────────────────────────────────────────────────
  tableContainer:      { borderWidth: 0, marginTop: 0, marginBottom: 16 },
  tableRow:            { flexDirection: 'row' },
  tableCell:           { borderRightWidth: 0, paddingVertical: 7, paddingHorizontal: 6, justifyContent: 'center' },
  tableCellHeaderText: { fontFamily: 'SFUIDisplay-Bold', fontSize: 11 },
  tableCellText:       { fontFamily: 'SFUIDisplay-Regular', fontSize: 11 },
  balanceContainer:    { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 4 },
  balanceText:         { fontFamily: 'SFUIDisplay-Regular', fontSize: 13 },
  balanceValue:        { fontFamily: 'SFUIDisplay-Bold' },
  // ── Expand button & landscape modal ────────────────────────────────────────
  modalOverlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalLandscapeContainer: { borderRadius: 16, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 0, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0)',
  },
  modalTitle:  { fontFamily: 'SFUIDisplay-Bold', fontSize: 15 },
  expandButton:        { width: 90, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  expandButtonMasked:  { width: 90, height: 40 },
  expandButtonMask:    { width: 90, height: 40, backgroundColor: 'transparent', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)' },
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
  buttonBackground2:  { width: 90, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', position: 'absolute', borderRadius: 25 },
  buttonBackground22: { width: 40, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.12)', position: 'absolute', borderRadius: 25 },
  modalCloseButton:       { width: 40, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  modalCloseButtonMasked: { width: 40, height: 40 },
  modalCloseButtonMask:   { width: 40, height: 40, backgroundColor: 'transparent', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)' },
  modalCloseButtonIcon:   { position: 'absolute' },
  expandButtonContent: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', paddingHorizontal: 15, height: '100%',
  },
  expandButtonText: { fontFamily: 'SFUIDisplay-Regular', fontSize: 14, marginRight: 5 },
  // ── Description ────────────────────────────────────────────────────────────
  descriptionContainer: { marginVertical: 5, marginHorizontal: 5 },
  descriptionText: { fontSize: 14, color: 'rgb(170, 170, 170)', fontFamily: 'SFUIDisplay-Regular', lineHeight: 18, marginBottom: 8 },
  // ── Custom keyboard ────────────────────────────────────────────────────────
  customKeyboardWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f5f5f5' },
  logoContainer: { position: 'absolute', bottom: 20, left: 20, width: 40, height: 40, opacity: 1, zIndex: 10 },
  logoImage:     { width: '100%', height: '100%', resizeMode: 'contain' },
});

export default CompParaleloCalc;
