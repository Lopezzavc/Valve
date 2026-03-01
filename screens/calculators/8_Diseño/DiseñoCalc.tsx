import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Clipboard,
  ScrollView,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
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

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ──────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenDiseño: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenDiseño: undefined;
  DiseñoTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// ─── Conversion factors ────────────────────────────────────────────────────────
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
  viscosity: {
    'm²/s': 1,
    'cm²/s': 0.0001,
    'mm²/s': 0.000001,
    'ft²/s': 0.09290304,
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,
    'g': 9.80665,
  },
};

// ─── Toast config ──────────────────────────────────────────────────────────────
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

// ─── Dot color helper ──────────────────────────────────────────────────────────
const getDotColor = (hasValue: boolean, isInvalid: boolean): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (hasValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ─── Iteration row type ────────────────────────────────────────────────────────
interface IterationRow {
  iter: number;
  lambda: number;
  hf: number;
  V: number;
  Q: number;
  Re: number;
  regimen: string;
}

// ─── Calculator state ──────────────────────────────────────────────────────────
interface CalculatorState {
  L: string;
  LUnit: string;
  D: string;
  DUnit: string;
  ks: string;
  ksUnit: string;
  nu: string;
  nuUnit: string;
  Km: string;
  z1: string;
  z1Unit: string;
  z2: string;
  z2Unit: string;
  g: string;
  gUnit: string;
  invalidFields: string[];
  resultQ: number;
  iterationTable: IterationRow[];
}

const initialState = (): CalculatorState => ({
  L: '',
  LUnit: 'm',
  D: '',
  DUnit: 'm',
  ks: '',
  ksUnit: 'm',
  nu: '',
  nuUnit: 'm²/s',
  Km: '',
  z1: '',
  z1Unit: 'm',
  z2: '',
  z2Unit: 'm',
  g: '9.81',
  gUnit: 'm/s²',
  invalidFields: [],
  resultQ: 0,
  iterationTable: [],
});

// ─── Core algorithm (translated from casos_conductos.py) ───────────────────────

function velocidadTurbulentaDesdeHf(
  hf: number, L: number, D: number, ks: number, nu: number, g: number
): number {
  const hfPos = Math.max(hf, 1e-30);
  const A = ks / (3.7 * D);
  const denom = D * Math.sqrt(hfPos * D * 2.0 * g);
  if (denom === 0) return 0;
  const B = (2.51 * nu * Math.sqrt(L)) / denom;
  const argumento = A + B;
  if (argumento <= 0 || !isFinite(argumento)) return 0;
  const factor = -2.0 * Math.log10(argumento);
  const V = factor * (Math.sqrt(hfPos * D * 2.0 * g) / Math.sqrt(L));
  return Math.max(V, 0);
}

function velocidadLaminarDesdeHf(
  hf: number, L: number, D: number, nu: number, g: number
): number {
  return Math.max((g * D * D * hf) / (32.0 * nu * L), 0);
}

interface CalcResult {
  Q: number;
  table: IterationRow[];
}

function calcularDiseno(
  L: number, D: number, ks: number, nu: number, Km: number,
  z1: number, z2: number, g: number = 9.81,
  tolHf: number = 1e-6, tolRelQ: number = 1e-4, maxIter: number = 300
): CalcResult {
  let H = z1 - z2;
  if (H <= 0) {
    H = Math.abs(H);
  }

  const area = Math.PI * (D * D) / 4.0;
  const rows: IterationRow[] = [];

  let lam = 1.0;
  const lambdaMin = 0.3;
  const lambdaMax = 1.0;
  const shrink = 0.5;
  const grow = 1.1;
  const pacienciaSubida = 2;

  let rPrev: number | null = null;
  let mejoras = 0;
  let hf = H;
  let qPrev: number | null = null;

  for (let it = 1; it <= maxIter; it++) {
    const vTurb = velocidadTurbulentaDesdeHf(hf, L, D, ks, nu, g);
    const reTanteo = nu > 0 ? Math.abs(vTurb) * D / nu : Infinity;

    let V: number;
    let regimen: string;
    if (reTanteo < 2000) {
      V = velocidadLaminarDesdeHf(hf, L, D, nu, g);
      regimen = 'Laminar';
    } else {
      V = vTurb;
      regimen = 'Turbulento';
    }

    const Q = area * V;
    const hm = Km * V * V / (2.0 * g);
    const hfNextRaw = H - hm;
    const R = hfNextRaw - hf;
    const hfNext = hf + lam * R;

    const Re = nu > 0 ? Math.abs(V) * D / nu : Infinity;

    rows.push({
      iter: it,
      lambda: lam,
      hf,
      V,
      Q,
      Re,
      regimen,
    });

    // Convergence check
    const doneHf = Math.abs(hfNext - hf) < tolHf;
    const doneQ = qPrev !== null && Math.abs(Q - qPrev) / Math.max(Math.abs(Q), 1e-30) < tolRelQ;
    if (doneHf || doneQ) {
      break;
    }

    // Adaptive lambda
    if (rPrev !== null) {
      if (R * rPrev < 0 || Math.abs(R) > 0.9 * Math.abs(rPrev)) {
        lam = Math.max(lambdaMin, lam * shrink);
        mejoras = 0;
      } else if (Math.abs(R) < 0.5 * Math.abs(rPrev)) {
        mejoras++;
        if (mejoras >= pacienciaSubida && lam < lambdaMax) {
          lam = Math.min(lambdaMax, lam * grow);
          mejoras = 0;
        }
      } else {
        mejoras = 0;
      }
    }

    rPrev = R;
    qPrev = Q;
    hf = Math.max(hfNext, 0);
  }

  const lastRow = rows[rows.length - 1];
  return {
    Q: lastRow ? lastRow.Q : 0,
    table: rows,
  };
}

// ─── Main component ────────────────────────────────────────────────────────────
const DiseñoCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();
  const stateRef = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
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

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setActiveInputId(null);
      };
    }, [setActiveInputId])
  );
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Theme ───────────────────────────────────────────────────────────────────
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
        tableHeader: 'rgba(45,45,45,1)',
        tableBorder: 'rgba(255,255,255,0.1)',
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
      tableHeader: 'rgb(245,245,245)',
      tableBorder: 'rgb(220,220,220)',
    };
  }, [currentTheme]);

  const [state, setState] = useState<CalculatorState>(initialState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Animations
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  // DB & favorites
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
        const fav = await isFavorite(db, 'DiseñoCalc');
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
      const route = 'DiseñoCalc';
      const label = t('diseñoCalc.title');
      if (isFav) {
        await removeFavorite(db, route);
        setIsFav(false);
      } else {
        await addFavorite(db, { route, label });
        setIsFav(true);
      }
    } catch {}
  }, [isFav, t]);

  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.0, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  // ── Number formatting helpers ───────────────────────────────────────────────
  const adjustDecimalSeparator = useCallback((val: string): string => {
    if (selectedDecimalSeparator === 'Coma') return val.replace('.', ',');
    return val;
  }, [selectedDecimalSeparator]);

  const formatResult = useCallback((value: number): string => {
    if (!isFinite(value) || isNaN(value)) return '0';
    const d = new Decimal(value);
    return d.toSignificantDigits(8).toString();
  }, []);

  const formatVisualDecimal = useCallback((value: string): string => {
    if (!value || value === '') return '';
    const normalizedValue = value.replace(',', '.');
    const num = parseFloat(normalizedValue);
    if (isNaN(num)) return value;
    const formatted = num.toFixed(8).replace(/\.?0+$/, '');
    return selectedDecimalSeparator === 'Coma'
      ? formatted.replace('.', ',')
      : formatted;
  }, [selectedDecimalSeparator]);

  // ── Unit conversion helper ─────────────────────────────────────────────────
  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: string
  ): string => {
    if (!value || value.trim() === '') return '';
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num)) return value;
    const fromFactor = conversionFactors[category]?.[fromUnit] ?? 1;
    const toFactor = conversionFactors[category]?.[toUnit] ?? 1;
    const converted = (num * fromFactor) / toFactor;
    return formatResult(converted);
  }, [formatResult]);

  // ── Navigate to options screen ─────────────────────────────────────────────
  const navigateToOptions = useCallback((
    category: string,
    onSelectOption: (opt: string) => void,
    selectedOption?: string
  ) => {
    navigation.navigate('OptionsScreenDiseño', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // ── Convert field to SI ────────────────────────────────────────────────────
  const toSI = useCallback((value: string, unit: string, category: string): number | null => {
    if (!value || value.trim() === '') return null;
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num)) return null;
    const factor = conversionFactors[category]?.[unit] ?? 1;
    return num * factor;
  }, []);

  // ── Calculate ──────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const invalid: string[] = [];

    const L = toSI(state.L, state.LUnit, 'length');
    const D = toSI(state.D, state.DUnit, 'length');
    const ks = toSI(state.ks, state.ksUnit, 'length');
    const nu = toSI(state.nu, state.nuUnit, 'viscosity');
    const KmRaw = parseFloat(state.Km.replace(',', '.'));
    const Km = isNaN(KmRaw) ? null : KmRaw;
    const z1 = toSI(state.z1, state.z1Unit, 'length');
    const z2 = toSI(state.z2, state.z2Unit, 'length');
    const g = toSI(state.g, state.gUnit, 'acceleration');

    if (L === null || L <= 0) invalid.push('L');
    if (D === null || D <= 0) invalid.push('D');
    if (ks === null || ks < 0) invalid.push('ks');
    if (nu === null || nu <= 0) invalid.push('nu');
    if (Km === null || Km < 0) invalid.push('Km');
    if (z1 === null) invalid.push('z1');
    if (z2 === null) invalid.push('z2');
    if (g === null || g <= 0) invalid.push('g');

    if (invalid.length > 0) {
      setState(prev => ({ ...prev, invalidFields: invalid }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('diseñoCalc.toasts.missingFields') || 'Faltan campos obligatorios',
      });
      return;
    }

    try {
      const result = calcularDiseno(
        L!, D!, ks!, nu!, Km!, z1!, z2!, g!
      );
      setState(prev => ({
        ...prev,
        invalidFields: [],
        resultQ: result.Q,
        iterationTable: result.table,
      }));
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('diseñoCalc.toasts.calcError') || 'Error en el cálculo',
      });
    }
  }, [state, toSI, t]);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const qStr = formatResult(state.resultQ);
    let text = `${t('diseñoCalc.resultLabel')}: ${qStr} m³/s\n`;
    text += `L: ${state.L} ${state.LUnit}\n`;
    text += `D: ${state.D} ${state.DUnit}\n`;
    text += `ks: ${state.ks} ${state.ksUnit}\n`;
    text += `ν: ${state.nu} ${state.nuUnit}\n`;
    text += `Km: ${state.Km}\n`;
    text += `z1: ${state.z1} ${state.z1Unit}\n`;
    text += `z2: ${state.z2} ${state.z2Unit}\n`;
    text += `g: ${state.g} ${state.gUnit}\n`;
    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('diseñoCalc.toasts.copied') || 'Copiado al portapapeles' });
  }, [state, formatResult, t]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setState(initialState());
  }, []);

  // ── Save to history ────────────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    if (state.resultQ === 0) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('diseñoCalc.toasts.nothingToSave') || 'Nada para guardar' });
      return;
    }
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        dbRef.current = db;
      }
      const inputs = {
        L: state.L, LUnit: state.LUnit,
        D: state.D, DUnit: state.DUnit,
        ks: state.ks, ksUnit: state.ksUnit,
        nu: state.nu, nuUnit: state.nuUnit,
        Km: state.Km,
        z1: state.z1, z1Unit: state.z1Unit,
        z2: state.z2, z2Unit: state.z2Unit,
        g: state.g, gUnit: state.gUnit,
      };
      await saveCalculation(db, 'DiseñoCalc', JSON.stringify(inputs), formatResult(state.resultQ));
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('diseñoCalc.toasts.saved') || 'Guardado en historial' });
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('diseñoCalc.toasts.saveError') || 'Error al guardar' });
    }
  }, [state, formatResult, t]);

  // ── Handlers del teclado custom ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;
    const map: Record<string, string> = {
      L: s.L,
      D: s.D,
      ks: s.ks,
      nu: s.nu,
      Km: s.Km,
      z1: s.z1,
      z2: s.z2,
      g: s.g,
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

  // ─── Render helpers ────────────────────────────────────────────────────────

  /** Input with unit selector button */
  const renderInputWithUnit = useCallback((
    id: string,
    label: string,
    value: string,
    unit: string,
    category: string,
    onChange: (text: string) => void,
    onUnitChange: (newUnit: string, oldUnit: string) => void
  ) => {
    const isInvalid = state.invalidFields.includes(id);
    const hasValue = (value?.trim()?.length ?? 0) > 0;
    const dotColor = getDotColor(hasValue, isInvalid);

    if (id) {
      inputHandlersRef.current[id] = (text: string) => {
        onChange(text);
        setState(prev => ({ ...prev, invalidFields: prev.invalidFields.filter(f => f !== id) }));
      };
    }

    return (
      <View
        ref={(r) => { if (id) inputRefs.current[id] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {label}
          </Text>
          <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.redContainer}>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
              <Pressable
                onPress={() => {
                  setActiveInputId(id);
                }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
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
            onPress={() => navigateToOptions(category, (option: string) => onUnitChange(option, unit), unit)}
          >
            <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.text, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{unit}</Text>
              <Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
            </View>
          </Pressable>
        </View>
      </View>
    );
  }, [state.invalidFields, themeColors, currentTheme, fontSizeFactor, navigateToOptions, setActiveInputId]);

  /** Simple input without unit (for dimensionless Km) */
  const renderSimpleInput = useCallback((
    id: string,
    label: string,
    value: string,
    onChange: (text: string) => void
  ) => {
    const isInvalid = state.invalidFields.includes(id);
    const hasValue = (value?.trim()?.length ?? 0) > 0;
    const dotColor = getDotColor(hasValue, isInvalid);

    if (id) {
      inputHandlersRef.current[id] = (text: string) => {
        onChange(text);
        setState(prev => ({ ...prev, invalidFields: prev.invalidFields.filter(f => f !== id) }));
      };
    }

    return (
      <View
        ref={(r) => { if (id) inputRefs.current[id] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {label}
          </Text>
          <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
        </View>
        <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient, width: '100%', flex: undefined }]}>
          <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
            <Pressable
              onPress={() => {
                setActiveInputId(id);
              }}
              style={StyleSheet.absoluteFill}
            />
            <TextInput
              style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
              keyboardType="numeric"
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
  }, [state.invalidFields, themeColors, currentTheme, fontSizeFactor, setActiveInputId]);

  /** Iteration results table */
  const renderTable = useCallback(() => {
    if (state.iterationTable.length === 0) return null;

    const bc = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;

    const fmtNum = (n: number): string => {
      if (!isFinite(n) || isNaN(n)) return '-';
      if (n === 0) return '0';
      const s = formatResult(n);
      return s.length > 10 ? s.substring(0, 10) : s;
    };

    // Column definitions: [header, flex]
    const cols: [string, number][] = [
      [t('diseñoCalc.table.header.iter') || 'Iter', 1],
      [t('diseñoCalc.table.header.lambda') || 'λ', 1],
      [t('diseñoCalc.table.header.hf') || 'hf [m]', 2],
      [t('diseñoCalc.table.header.v') || 'V [m/s]', 2],
      [t('diseñoCalc.table.header.q') || 'Q [m³/s]', 2],
      [t('diseñoCalc.table.header.re') || 'Re [-]', 2],
      [t('diseñoCalc.table.header.regimen') || 'Régimen', 2],
    ];

    const headerCell = (content: string, flex: number, key: string) => (
      <View
        key={key}
        style={[
          styles.tableCell,
          { flex, borderColor: bc, backgroundColor: hBg, borderBottomWidth: 1 },
        ]}
      >
        <Text
          style={[styles.tableCellHeaderText, { color: themeColors.textStrong, fontSize: 11 * fontSizeFactor }]}
          numberOfLines={1}
        >
          {content}
        </Text>
      </View>
    );

    const dataCell = (content: string, flex: number, key: string) => (
      <View key={key} style={[styles.tableCell, { flex, borderColor: bc }]}>
        <Text
          style={[styles.tableCellText, { color: themeColors.text, fontSize: 11 * fontSizeFactor }]}
          numberOfLines={1}
        >
          {content}
        </Text>
      </View>
    );

    return (
      <View style={{ marginTop: 8 }}>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
          {t('diseñoCalc.table.title') || 'Tabla de iteraciones'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.tableContainer, { borderColor: bc }]}>
            {/* Header row */}
            <View style={styles.tableRow}>
              {cols.map(([hdr, fl], ci) => headerCell(hdr, fl, `hdr-${ci}`))}
            </View>

            {/* Data rows — la última fila se resalta como resultado convergido */}
            {state.iterationTable.map((row, i) => {
              const isLast = i === state.iterationTable.length - 1;
              const rowBg = isLast
                ? (currentTheme === 'dark' ? 'rgba(194,254,12,0.08)' : 'rgba(194,254,12,0.15)')
                : i % 2 !== 0
                  ? (currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
                  : 'transparent';
              const rowData: string[] = [
                isLast ? '→ ' + String(row.iter) : String(row.iter),
                fmtNum(row.lambda),
                fmtNum(row.hf),
                fmtNum(row.V),
                fmtNum(row.Q),
                fmtNum(row.Re),
                row.regimen,
              ];
              return (
                <View key={`row-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                  {cols.map(([, fl], ci) => (
                    <View key={`cell-${i}-${ci}`} style={[styles.tableCell, { flex: fl, borderColor: bc }]}>
                      <Text
                        style={[
                          isLast ? styles.tableCellHeaderText : styles.tableCellText,
                          { color: isLast ? themeColors.textStrong : themeColors.text, fontSize: 11 * fontSizeFactor },
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
        </ScrollView>
      </View>
    );
  }, [state.iterationTable, themeColors, currentTheme, fontSizeFactor, t, formatResult]);

  // ── Main result display value ──────────────────────────────────────────────
  const mainResultValue = adjustDecimalSeparator(
    formatNumber(parseFloat(formatResult(state.resultQ) || '0'))
  );

  const isKeyboardOpen = !!activeInputId;

  // ─── JSX ───────────────────────────────────────────────────────────────────
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
                onPress={() => navigation.navigate('DiseñoTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc.calculator') || 'Calculadora'}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('diseñoCalc.title') || 'Diseño de Tuberías'}
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
                      style={{ ...StyleSheet.absoluteFillObject as any, backgroundColor: 'rgba(0,0,0,0.7)' }}
                    />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text
                      style={[styles.flowLabel, {
                        color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
                        fontSize: 16 * fontSizeFactor,
                      }]}
                    >
                      {state.resultQ === 0 ? 'な' : (t('diseñoCalc.resultLabel') || 'Q (m³/s)')}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[styles.flowValue, {
                        color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
                        fontSize: 30 * fontSizeFactor,
                      }]}
                    >
                      {mainResultValue}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular', action: handleCalculate },
            { icon: 'copy', label: t('common.copy') || 'Copiar', action: handleCopy },
            { icon: 'trash', label: t('common.clear') || 'Limpiar', action: handleClear },
            { icon: 'clock', label: t('common.history') || 'Historial', action: () => navigation.navigate('HistoryScreenDiseño') },
          ].map(({ icon, label, action }) => (
            <View style={styles.actionWrapper} key={label}>
              <View style={styles.actionButtonMain}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                  onPress={action}
                >
                  <Icon name={icon} size={22 * fontSizeFactor} color="rgb(255, 255, 255)" />
                  <Icon
                    name={icon}
                    size={22 * fontSizeFactor}
                    color="rgba(255, 255, 255, 0.5)"
                    style={{ position: 'absolute', filter: 'blur(4px)' }}
                  />
                </Pressable>
              </View>
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontSizeFactor }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Inputs section ── */}
        <View style={[styles.inputsSection, { backgroundColor: themeColors.card, paddingBottom: isKeyboardOpen ? 330 : 70 }]}>

          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc.paramsSection') || 'Parámetros de diseño'}
          </Text>

          {/* L */}
          {renderInputWithUnit(
            'L',
            t('diseñoCalc.labels.L') || 'Longitud L',
            state.L,
            state.LUnit,
            'length',
            (text) => setState(prev => ({ ...prev, L: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.L, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, L: converted, LUnit: newUnit }));
            }
          )}

          {/* D */}
          {renderInputWithUnit(
            'D',
            t('diseñoCalc.labels.D') || 'Diámetro D',
            state.D,
            state.DUnit,
            'length',
            (text) => setState(prev => ({ ...prev, D: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.D, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, D: converted, DUnit: newUnit }));
            }
          )}

          {/* ks */}
          {renderInputWithUnit(
            'ks',
            t('diseñoCalc.labels.ks') || 'Rugosidad ks',
            state.ks,
            state.ksUnit,
            'length',
            (text) => setState(prev => ({ ...prev, ks: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.ks, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, ks: converted, ksUnit: newUnit }));
            }
          )}

          {/* nu */}
          {renderInputWithUnit(
            'nu',
            t('diseñoCalc.labels.nu') || 'Viscosidad cinemática ν',
            state.nu,
            state.nuUnit,
            'viscosity',
            (text) => setState(prev => ({ ...prev, nu: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.nu, oldUnit, newUnit, 'viscosity');
              setState(prev => ({ ...prev, nu: converted, nuUnit: newUnit }));
            }
          )}

          {/* Km – dimensionless */}
          {renderSimpleInput(
            'Km',
            t('diseñoCalc.labels.Km') || 'Pérdidas menores Km',
            state.Km,
            (text) => setState(prev => ({ ...prev, Km: text }))
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc.energySection') || 'Condiciones de energía'}
          </Text>

          {/* z1 */}
          {renderInputWithUnit(
            'z1',
            t('diseñoCalc.labels.z1') || 'z1 (aguas arriba)',
            state.z1,
            state.z1Unit,
            'length',
            (text) => setState(prev => ({ ...prev, z1: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.z1, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, z1: converted, z1Unit: newUnit }));
            }
          )}

          {/* z2 */}
          {renderInputWithUnit(
            'z2',
            t('diseñoCalc.labels.z2') || 'z2 (aguas abajo)',
            state.z2,
            state.z2Unit,
            'length',
            (text) => setState(prev => ({ ...prev, z2: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.z2, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, z2: converted, z2Unit: newUnit }));
            }
          )}

          {/* g */}
          {renderInputWithUnit(
            'g',
            t('diseñoCalc.labels.g') || 'g (gravedad)',
            state.g,
            state.gUnit,
            'acceleration',
            (text) => setState(prev => ({ ...prev, g: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.g, oldUnit, newUnit, 'acceleration');
              setState(prev => ({ ...prev, g: converted, gUnit: newUnit }));
            }
          )}

          {/* Iteration table */}
          {renderTable()}

        </View>
      </ScrollView>

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

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)',
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
    marginTop: -10,
  },
  resultsMain: {
    paddingHorizontal: 20,
  },
  resultsContainerMain: {
    padding: 1,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
  inputsSection: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  inputsContainer: {
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    marginBottom: 10,
    backgroundColor: 'transparent',
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    width: '68%',
  },
  Container2: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
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
  textOptions: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
  },
  icon: {
    marginLeft: 'auto',
  },
  // ── Table ────────────────────────────────────────────────────────────────────
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
  // ── Teclado custom ──────────────────────────────────────────────────────────
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
});

export default DiseñoCalc;