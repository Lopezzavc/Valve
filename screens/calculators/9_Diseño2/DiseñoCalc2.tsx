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

const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark = require('../../../assets/icon/iconwhite.webp');

Decimal.set({ 
  precision: 50, 
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -7,  // Para evitar notación científica en números pequeños
  toExpPos: 21   // Para evitar notación científica en números grandes
});

// ─── Navigation types ──────────────────────────────────────────────────────────
type RootStackParamList = {
  [key: string]: object | undefined;
  CalculatorOptionsScreen: CalculatorOptionsScreenParams;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// ─── Conversion factors ────────────────────────────────────────────────────────
const conversionFactors = UNIT_FACTORS;


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

// ─── Design iteration row type ─────────────────────────────────────────────────
interface DesignRow {
  H: Decimal;
  hf: Decimal;
  D_in: string;
  D_m: Decimal;
  V: Decimal;
  Qc: Decimal;
  Qc_geq_Qd: boolean;
  hm: Decimal;
  hf_next: Decimal;
  Vp: Decimal;
}

// ─── Design result ─────────────────────────────────────────────────────────────
interface DesignResult {
  found: boolean;
  dLabel: string;
  dMm: Decimal;
}

// ─── Calculator state ──────────────────────────────────────────────────────────
interface CalculatorState2 {
  L: string;
  LUnit: string;
  Ks: string;
  KsUnit: string;
  Qd: string;
  QdUnit: string;
  mu: string;
  muUnit: string;
  H: string;
  HUnit: string;
  Km: string;
  g: string;
  gUnit: string;
  invalidFields: string[];
  designResult: DesignResult;
  iterationTable: DesignRow[];
}

const initialState = (): CalculatorState2 => ({
  L: '',
  LUnit: 'm',
  Ks: '',
  KsUnit: 'm',
  Qd: '',
  QdUnit: 'm³/s',
  mu: '',
  muUnit: 'm²/s',
  H: '',
  HUnit: 'm',
  Km: '',
  g: '9.81',
  gUnit: 'm/s²',
  invalidFields: [],
  designResult: { found: false, dLabel: '', dMm: new Decimal(0) },
  iterationTable: [],
});

// ─── Commercial diameters list (label, float inches, D in metres) ───────────
const DIAMETERS: Array<{ label: string; inches: number; D: number }> = [
  { label: '1/8"',   inches: 0.125,  D: 0.003 },
  { label: '1/4"',   inches: 0.25,   D: 0.006 },
  { label: '3/8"',   inches: 0.375,  D: 0.010 },
  { label: '1/2"',   inches: 0.5,    D: 0.013 },
  { label: '3/4"',   inches: 0.75,   D: 0.019 },
  { label: '1"',     inches: 1.0,    D: 0.025 },
  { label: '1-1/4"', inches: 1.25,   D: 0.032 },
  { label: '1-1/2"', inches: 1.5,    D: 0.038 },
  { label: '2"',     inches: 2.0,    D: 0.051 },
  { label: '2-1/2"', inches: 2.5,    D: 0.064 },
  { label: '3"',     inches: 3.0,    D: 0.076 },
  { label: '3-1/2"', inches: 3.5,    D: 0.089 },
  { label: '4"',     inches: 4.0,    D: 0.102 },
  { label: '5"',     inches: 5.0,    D: 0.127 },
  { label: '6"',     inches: 6.0,    D: 0.152 },
  { label: '8"',     inches: 8.0,    D: 0.203 },
  { label: '10"',    inches: 10.0,   D: 0.254 },
  { label: '12"',    inches: 12.0,   D: 0.305 },
  { label: '14"',    inches: 14.0,   D: 0.356 },
  { label: '16"',    inches: 16.0,   D: 0.406 },
  { label: '18"',    inches: 18.0,   D: 0.457 },
  { label: '20"',    inches: 20.0,   D: 0.508 },
  { label: '24"',    inches: 24.0,   D: 0.610 },
  { label: '30"',    inches: 30.0,   D: 0.762 },
  { label: '36"',    inches: 36.0,   D: 0.914 },
  { label: '42"',    inches: 42.0,   D: 1.067 },
  { label: '48"',    inches: 48.0,   D: 1.219 },
];

// ─── Velocity (Swamee-Jee) ─────────────────────────────────────────────────────
function calculateVelocity(
  D: Decimal,
  hf: Decimal,
  L: Decimal,
  Ks: Decimal,
  mu: Decimal,
  g: Decimal
): Decimal {
  const term1 = Ks.div(new Decimal(3.7).times(D));
  const denom = D.times(
    hf.times(D)
      .times(2.0)
      .times(g)
      .sqrt()
  );
  
  if (denom.equals(0)) throw new Error('denom zero');
  
  const term2 = new Decimal(2.51)
    .times(mu)
    .times(L.sqrt())
    .div(denom);
  
  const arg = term1.plus(term2);
  
  if (arg.lessThanOrEqualTo(0) || !arg.isFinite()) 
    throw new Error('invalid log arg');
  
  const inner = hf.times(D)
    .times(2.0)
    .times(g)
    .sqrt()
    .div(L.sqrt());
  
  return new Decimal(-2.0)
    .times(Decimal.log10(arg))
    .times(inner);
}

// ─── Core algorithm (translated from casos_2_diseño.py) ────────────────────────
// ⚙️  CONVERGENCE PARAMETERS — adjust here if needed:
//   tolerance          = 1e-5   // Head convergence tolerance  (try 1e-4 or 1e-6)
//   velocity_tolerance = 1e-3   // Velocity convergence tolerance
const HEAD_TOLERANCE: number = 1e-5;
const VELOCITY_TOLERANCE: number = 1e-3;

interface CalcResult2 {
  designResult: DesignResult;
  table: DesignRow[];
}

function calcularDiseno2(
  L: Decimal,
  Ks: Decimal,
  Qd: Decimal,
  mu: Decimal,
  H: Decimal,
  Km: Decimal,
  g: Decimal
): CalcResult2 {
  const allRows: DesignRow[] = [];
  let designResult: DesignResult = { found: false, dLabel: '', dMm: new Decimal(0) };

  for (const { label: dLabel, D } of DIAMETERS) {
    const D_dec = new Decimal(D);
    const A = new Decimal(Math.PI).times(D_dec.pow(2)).div(4.0);

    let converged = false;
    let headMultiplier = new Decimal(0.30);
    const maxAttempts = 500;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      let hfCurrent = attempt === 0 
        ? H 
        : H.times(headMultiplier);
      
      let diameterOk = true;
      let wentNegative = false;

      for (let iteration = 0; iteration < 300; iteration++) {
        let V: Decimal;
        try {
          V = calculateVelocity(D_dec, hfCurrent, L, Ks, mu, g);
        } catch {
          diameterOk = false;
          break;
        }

        if (V.lessThanOrEqualTo(0)) {
          diameterOk = false;
          break;
        }

        const Qc = V.times(A);

        if (Qc.lessThan(Qd)) {
          // Flow is too low for this diameter
          allRows.push({
            H,
            hf: hfCurrent,
            D_in: dLabel,
            D_m: D_dec,
            V,
            Qc,
            Qc_geq_Qd: false,
            hm: new Decimal(0),
            hf_next: new Decimal(0),
            Vp: new Decimal(0),
          });
          diameterOk = false;
          break;
        }

        const hm = Km.times(V.pow(2)).div(new Decimal(2.0).times(g));
        const hfNext = H.minus(hm);

        let Vp: Decimal;
        if (hfNext.greaterThanOrEqualTo(0)) {
          const diff = H.minus(hfCurrent);
          Vp = diff.greaterThanOrEqualTo(0) 
            ? diff.times(2.0).times(g).div(Km).sqrt() 
            : new Decimal(0);
        } else {
          Vp = H.times(2.0).times(g).div(Km).sqrt();
        }

        allRows.push({
          H,
          hf: hfCurrent,
          D_in: dLabel,
          D_m: D_dec,
          V,
          Qc,
          Qc_geq_Qd: true,
          hm,
          hf_next: hfNext,
          Vp,
        });

        if (hfNext.lessThan(0)) {
          wentNegative = true;
          break;
        }

        // Convergence check (manteniendo las mismas tolerancias)
        if (
          hfCurrent.minus(hfNext).abs().lessThanOrEqualTo(HEAD_TOLERANCE) &&
          V.minus(Vp).abs().lessThanOrEqualTo(VELOCITY_TOLERANCE)
        ) {
          converged = true;
          break;
        }

        hfCurrent = hfNext;
      }

      if (converged) break;
      if (!wentNegative) break;

      headMultiplier = headMultiplier.minus(0.005);
      if (headMultiplier.lessThanOrEqualTo(0)) break;
    }

    if (converged) {
      designResult = { 
        found: true, 
        dLabel, 
        dMm: D_dec.times(1000) 
      };
      break;
    }
  }

  return { designResult, table: allRows };
}

// ─── Main component ────────────────────────────────────────────────────────────
const DiseñoCalc2: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();
  const stateRef = useRef<CalculatorState2>(initialState());
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

  // ── Theme ───────────────────────────────────────────────────────────────────
  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card: 'rgb(24,24,24)',
        card2: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient: 'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        gradient2:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        cardGradient2: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        blockInput: 'rgba(30, 30, 30, 1)',
        tableHeader: 'rgba(45,45,45,1)',
        tableBorder: 'rgba(255,255,255,0.1)',
      };
    }
    return {
      card: 'rgba(255, 255, 255, 1)',
      card2: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      gradient2:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      cardGradient2: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
      blockInput: 'rgba(240, 240, 240, 1)',
      tableHeader: 'rgb(245,245,245)',
      tableBorder: 'rgb(220,220,220)',
    };
  }, [currentTheme]);

  const [state, setState] = useState<CalculatorState2>(initialState);
  const [tableModalVisible, setTableModalVisible] = useState(false);

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
        const fav = await isFavorite(db, 'DiseñoCalc2');
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
      const route = 'DiseñoCalc2';
      const label = t('diseñoCalc2.title') || 'Diseño de Tuberías II';
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

  const formatResult = useCallback((value: Decimal | number): string => {
    if (value instanceof Decimal) {
      if (!value.isFinite() || value.isNaN()) return '0';
      return value.toSignificantDigits(8).toString();
    }
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
    navigation.navigate({
      name: 'CalculatorOptionsScreen',
      params: buildCalculatorOptionsParams('diseno2', {
        category,
        onSelectOption,
        selectedOption,
      }),
    });
  }, [navigation]);

  // ── Convert field to SI ────────────────────────────────────────────────────
  const toSI = useCallback((value: string, unit: string, category: string): Decimal | null => {
    if (!value || value.trim() === '') return null;
    const num = parseFloat(value.replace(',', '.'));
    if (isNaN(num)) return null;
    const factor = conversionFactors[category]?.[unit] ?? 1;
    return new Decimal(num).times(factor);
  }, []);

  // ── Calculate ──────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const invalid: string[] = [];

    const L = toSI(state.L, state.LUnit, 'length');
    const Ks = toSI(state.Ks, state.KsUnit, 'length');
    const Qd = toSI(state.Qd, state.QdUnit, 'flow');
    const mu = toSI(state.mu, state.muUnit, 'viscosity');
    const H = toSI(state.H, state.HUnit, 'length');
    const KmRaw = parseFloat(state.Km.replace(',', '.'));
    const Km = isNaN(KmRaw) ? null : new Decimal(KmRaw);
    const g = toSI(state.g, state.gUnit, 'acceleration');

    if (L === null || L.lessThanOrEqualTo(0)) invalid.push('L');
    if (Ks === null || Ks.lessThan(0)) invalid.push('Ks');
    if (Qd === null || Qd.lessThanOrEqualTo(0)) invalid.push('Qd');
    if (mu === null || mu.lessThanOrEqualTo(0)) invalid.push('mu');
    if (H === null || H.lessThanOrEqualTo(0)) invalid.push('H');
    if (Km === null || Km.lessThan(0)) invalid.push('Km');
    if (g === null || g.lessThanOrEqualTo(0)) invalid.push('g');

    if (invalid.length > 0) {
      setState(prev => ({ ...prev, invalidFields: invalid }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('diseñoCalc2.toasts.missingFields') || 'Faltan campos obligatorios',
      });
      return;
    }

    try {
      const result = calcularDiseno2(L!, Ks!, Qd!, mu!, H!, Km!, g!);
      setState(prev => ({
        ...prev,
        invalidFields: [],
        designResult: result.designResult,
        iterationTable: result.table,
      }));

      if (!result.designResult.found) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('diseñoCalc2.toasts.noSolution') || 'No se encontró diámetro adecuado',
        });
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('diseñoCalc2.toasts.calcError') || 'Error en el cálculo',
      });
    }
  }, [state, toSI, t]);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const { dLabel, dMm, found } = state.designResult;
    let text = found
      ? `${t('diseñoCalc2.resultLabel') || 'Diámetro de diseño'}: ${dLabel} (${dMm.toFixed(1)} mm)\n`
      : `${t('diseñoCalc2.resultLabel') || 'Diámetro de diseño'}: -\n`;
    text += `L: ${state.L} ${state.LUnit}\n`;
    text += `Ks: ${state.Ks} ${state.KsUnit}\n`;
    text += `Qd: ${state.Qd} ${state.QdUnit}\n`;
    text += `μ: ${state.mu} ${state.muUnit}\n`;
    text += `H: ${state.H} ${state.HUnit}\n`;
    text += `Km: ${state.Km}\n`;
    text += `g: ${state.g} ${state.gUnit}\n`;
    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('diseñoCalc2.toasts.copied') || 'Copiado al portapapeles',
    });
  }, [state, t]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setState(initialState());
  }, []);

  // ── Save to history ────────────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    if (!state.designResult.found) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('diseñoCalc2.toasts.nothingToSave') || 'Nada para guardar' });
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
        Ks: state.Ks, KsUnit: state.KsUnit,
        Qd: state.Qd, QdUnit: state.QdUnit,
        mu: state.mu, muUnit: state.muUnit,
        H: state.H, HUnit: state.HUnit,
        Km: state.Km,
        g: state.g, gUnit: state.gUnit,
      };
      const resultStr = state.designResult.found
        ? `${state.designResult.dLabel} (${state.designResult.dMm.toFixed(1)} mm)`
        : '-';
      await saveCalculation(db, 'DiseñoCalc2', JSON.stringify(inputs), resultStr);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('diseñoCalc2.toasts.saved') || 'Guardado en historial' });
    } catch {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('diseñoCalc2.toasts.saveError') || 'Error al guardar' });
    }
  }, [state, t]);

  // ── Custom keyboard handlers ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;
    const map: Record<string, string> = {
      L: s.L, Ks: s.Ks, Qd: s.Qd, mu: s.mu, H: s.H, Km: s.Km, g: s.g,
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
                onPress={() => { setActiveInputId(id); }}
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
              onPress={() => { setActiveInputId(id); }}
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

  /** Design iteration table */
  const renderTable = useCallback(() => {
    if (state.iterationTable.length === 0) return null;

    const bc = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const fmtNum = (n: Decimal | number): string => {
      if (n instanceof Decimal) {
        if (!n.isFinite() || n.isNaN()) return '-';
        if (n.isZero()) return '0';
        const s = formatResult(n);
        return s.length > 10 ? s.substring(0, 10) : s;
      }
      if (!isFinite(n) || isNaN(n)) return '-';
      if (n === 0) return '0';
      const s = formatResult(n);
      return s.length > 10 ? s.substring(0, 10) : s;
    };

    // Column definitions: [header, width]
    const cols: [string, number][] = [
      [t('diseñoCalc2.table.header.iter') || 'Iter', 44],      // ← NUEVA COLUMNA
      [t('diseñoCalc2.table.header.H')       || 'H [m]',      78],
      [t('diseñoCalc2.table.header.hf')      || 'hf [m]',     78],
      [t('diseñoCalc2.table.header.D_in')    || 'D [in]',     56],
      [t('diseñoCalc2.table.header.D_mm')    || 'D [mm]',     62],
      [t('diseñoCalc2.table.header.V')       || 'V [m/s]',    78],
      [t('diseñoCalc2.table.header.Qc')      || 'Q [m³/s]',   90],
      [t('diseñoCalc2.table.header.qgeq')    || 'Qc≥Qd',      54],
      [t('diseñoCalc2.table.header.hm')      || 'hm [m]',     78],
      [t('diseñoCalc2.table.header.hf_next') || 'hfi+1 [m]',  80],
      [t('diseñoCalc2.table.header.Vp')      || 'Vp [m/s]',   78],
    ];

    const totalTableWidth = cols.reduce((sum, [, width]) => sum + width, 0) * fontSizeFactor;

    const renderTableContent = (scale: number, textBg: string, textColor: string, textStrong: string) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header row */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, colWidth], ci) => (
            <View
              key={`hdr2-${ci}`}
              style={[
                styles.tableCell,
                { width: colWidth * scale, borderColor: bc, backgroundColor: hBg, borderBottomWidth: 1 },
              ]}
            >
              <Text
                style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]}
                numberOfLines={1}
              >
                {hdr}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {state.iterationTable.map((row, i) => {
          const isLast = i === state.iterationTable.length - 1;
          const isConverged = isLast && state.designResult.found;
          const rowBg = isConverged
            ? (currentTheme === 'dark' ? 'rgba(194,254,12,0.08)' : 'rgba(194,254,12,0.15)')
            : i % 2 !== 0
              ? (currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
              : 'transparent';

          const rowData: string[] = [
            isConverged ? '→ ' + String(i + 1) : String(i + 1),
            fmtNum(row.H),
            fmtNum(row.hf),
            isConverged ? '→ ' + row.D_in : row.D_in,
            fmtNum(row.D_m.times(1000)),
            fmtNum(row.V),
            fmtNum(row.Qc),
            row.Qc_geq_Qd
              ? (t('diseñoCalc2.table.si') || 'SI')
              : (t('diseñoCalc2.table.no') || 'NO'),
            fmtNum(row.hm),
            fmtNum(row.hf_next),
            fmtNum(row.Vp),
          ];

          return (
            <View key={`row2-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
              {cols.map(([, colWidth], ci) => (
                <View key={`cell2-${i}-${ci}`} style={[styles.tableCell, { width: colWidth * scale, borderColor: bc }]}>
                  <Text
                    style={[
                      isConverged ? styles.tableCellHeaderText : styles.tableCellText,
                      { color: isConverged ? textStrong : textColor, fontSize: 11 * scale },
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

    const modalLandscapeWidth = screenHeight;
    const modalLandscapeHeight = screenWidth;

    return (
      <View style={{ marginTop: 8 }}>
        {/* Title row with expand button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc2.table.title') || 'Tabla de iteraciones'}
          </Text>
          <Pressable
            onPress={() => setTableModalVisible(true)}
            style={styles.expandButton}
          >
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
            <MaskedView
              style={styles.expandButtonMasked}
              maskElement={<View style={styles.expandButtonMask} />}
            >
              <View style={[styles.buttonGradient2, { experimental_backgroundImage: themeColors.gradient2 }]} />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text style={[styles.expandButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('diseñoCalc2.table.viewFull') || 'Ver completo'}
              </Text>
              <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>

        {/* Inline table (portrait, scrollable horizontally) */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(fontSizeFactor, themeColors.text, themeColors.text, themeColors.textStrong)}
          </ScrollView>
        </View>

        {/* ── Landscape modal ── */}
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
                <View style={[
                  styles.modalHeader,
                  {
                    backgroundColor: 'transparent',
                    width: totalTableWidth + 40,
                    paddingHorizontal: 0,
                    marginBottom: 8,
                  }
                ]}>
                  <Text style={[styles.modalTitle, { color: themeColors.textStrong }]}>
                    {t('diseñoCalc2.table.title') || 'Tabla de iteraciones'}
                  </Text>
                  <Pressable
                    onPress={() => setTableModalVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <View style={[styles.buttonBackground22, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
                    <MaskedView
                      style={styles.modalCloseButtonMasked}
                      maskElement={<View style={styles.modalCloseButtonMask} />}
                    >
                      <View style={[styles.buttonGradient22, { experimental_backgroundImage: themeColors.gradient2 }]} />
                    </MaskedView>
                    <Icon name="x" size={18} color={themeColors.icon} style={styles.modalCloseButtonIcon} />
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderTableContent(fontSizeFactor * 1.1, themeColors.text, themeColors.text, themeColors.textStrong)}
                </ScrollView>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }, [state.iterationTable, state.designResult, themeColors, currentTheme, fontSizeFactor, t, formatResult, tableModalVisible]);

  // ── Main result display ────────────────────────────────────────────────────
  const mainResultLabel = state.designResult.found
    ? state.designResult.dLabel
    : '一';
  const mainResultSub = state.designResult.found
    ? `${state.designResult.dMm.toFixed(1)} mm`
    : '';

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
            {t('diseñoCalc2.calculator') || 'Calculadora'}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('diseñoCalc2.title') || 'Diseño de Tuberías'}
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
                      {!state.designResult.found
                        ? 'な'
                        : (t('diseñoCalc2.resultLabel') || 'Diámetro de diseño')}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[styles.flowValue, {
                        color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
                        fontSize: 30 * fontSizeFactor,
                        marginBottom: -5,
                      }]}
                    >
                      {mainResultLabel}
                    </Text>
                    {mainResultSub !== '' && (
                      <Text style={[styles.flowLabel, {
                        color: currentTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        fontSize: 16 * fontSizeFactor,
                        marginLeft: 0,
                        marginBottom: 5,
                      }]}>
                        {mainResultSub}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular',  action: handleCalculate },
            { icon: 'copy',     label: t('common.copy')      || 'Copiar',    action: handleCopy },
            { icon: 'trash',    label: t('common.clear')     || 'Limpiar',   action: handleClear },
            { icon: 'clock',    label: t('common.history')   || 'Historial', action: () => navigation.navigate('HistoryScreenDiseño2') },
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
            {t('diseñoCalc2.paramsSection') || 'Parámetros de diseño'}
          </Text>

          {/* L — Pipe length */}
          {renderInputWithUnit(
            'L',
            `${t('diseñoCalc2.labels.L') || 'Longitud'} (L)`,
            state.L,
            state.LUnit,
            'length',
            (text) => setState(prev => ({ ...prev, L: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.L, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, L: converted, LUnit: newUnit }));
            }
          )}

          {/* Ks — Absolute roughness */}
          {renderInputWithUnit(
            'Ks',
            `${t('diseñoCalc2.labels.Ks') || 'Rugosidad absoluta'} (Kˢ)`,
            state.Ks,
            state.KsUnit,
            'length',
            (text) => setState(prev => ({ ...prev, Ks: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.Ks, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, Ks: converted, KsUnit: newUnit }));
            }
          )}

          {/* Qd — Design flow rate */}
          {renderInputWithUnit(
            'Qd',
            `${t('diseñoCalc2.labels.Qd') || 'Caudal de diseño'} (Qᵈ)`,
            state.Qd,
            state.QdUnit,
            'flow',
            (text) => setState(prev => ({ ...prev, Qd: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.Qd, oldUnit, newUnit, 'flow');
              setState(prev => ({ ...prev, Qd: converted, QdUnit: newUnit }));
            }
          )}

          {/* mu — Kinematic viscosity */}
          {renderInputWithUnit(
            'mu',
            `${t('diseñoCalc2.labels.mu') || 'Viscosidad cinemática'} (ν)`,
            state.mu,
            state.muUnit,
            'viscosity',
            (text) => setState(prev => ({ ...prev, mu: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.mu, oldUnit, newUnit, 'viscosity');
              setState(prev => ({ ...prev, mu: converted, muUnit: newUnit }));
            }
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc2.energySection') || 'Condiciones de energía'}
          </Text>

          {/* H — Total available head */}
          {renderInputWithUnit(
            'H',
            `${t('diseñoCalc2.labels.H') || 'Carga disponible'} (H)`,
            state.H,
            state.HUnit,
            'length',
            (text) => setState(prev => ({ ...prev, H: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.H, oldUnit, newUnit, 'length');
              setState(prev => ({ ...prev, H: converted, HUnit: newUnit }));
            }
          )}
          
          {/* Km — Minor loss coefficient */}
          {renderSimpleInput(
            'Km',
            `${t('diseñoCalc2.labels.Km') || 'Pérdidas menores'} (Kᵐ)`,
            state.Km,
            (text) => setState(prev => ({ ...prev, Km: text }))
          )}
          
          {/* g — Gravity */}
          {renderInputWithUnit(
            'g',
            `${t('diseñoCalc2.labels.g') || 'Gravedad'} (g)`,
            state.g,
            state.gUnit,
            'acceleration',
            (text) => setState(prev => ({ ...prev, g: text })),
            (newUnit, oldUnit) => {
              const converted = convertValue(state.g, oldUnit, newUnit, 'acceleration');
              setState(prev => ({ ...prev, g: converted, gUnit: newUnit }));
            }
          )}

          {state.iterationTable.length > 0 && (
            <View style={[styles.separator, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
          )}

          {/* Iteration table */}
          {renderTable()}

          {/* Info text - solo visible cuando NO hay tabla de iteraciones */}
          {state.iterationTable.length === 0 && (
            <View>
              <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
              <View style={styles.descriptionContainer}>
                <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                  {t('diseñoCalc2.infoText')}
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
    lineHeight: 30,
    marginBottom: 10,
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
  separator2: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
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
  // ── Custom keyboard ──────────────────────────────────────────────────────────
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
  // ── Expand button & landscape modal ─────────────────────────────────────────
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
  expandButtonIcon: {
    position: 'absolute',
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

export default DiseñoCalc2;




