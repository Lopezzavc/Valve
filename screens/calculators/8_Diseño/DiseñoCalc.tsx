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
  resultQUnit: string;
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
  g: '9.807',
  gUnit: 'm/s²',
  invalidFields: [],
  resultQ: 0,
  resultQUnit: 'm³/s',
  iterationTable: [],
});

// ─── Core algorithm (translated from casos_conductos.py) ───────────────────────

function velocidadTurbulentaDesdeHf(
  hf: number, L: number, D: number, ks: number, nu: number, g: number
): Decimal {
  const hfPos = new Decimal(Math.max(hf, 1e-30));
  const Ldec = new Decimal(L);
  const Ddec = new Decimal(D);
  const ksdec = new Decimal(ks);
  const nudec = new Decimal(nu);
  const gdec = new Decimal(g);
  
  const A = ksdec.div(new Decimal(3.7).times(Ddec));
  const denom = Ddec.times(hfPos.times(Ddec).times(2).times(gdec).sqrt());
  
  if (denom.equals(0)) return new Decimal(0);
  
  const B = new Decimal(2.51).times(nudec).times(Ldec.sqrt()).div(denom);
  const argumento = A.plus(B);
  
  if (argumento.lessThanOrEqualTo(0) || !argumento.isFinite()) return new Decimal(0);
  
  const factor = new Decimal(-2).times(Decimal.log10(argumento));
  const V = factor.times(hfPos.times(Ddec).times(2).times(gdec).sqrt().div(Ldec.sqrt()));
  
  return Decimal.max(V, 0);
}

function velocidadLaminarDesdeHf(
  hf: number, L: number, D: number, nu: number, g: number
): Decimal {
  const hfdec = new Decimal(Math.max(hf, 0));
  const Ldec = new Decimal(L);
  const Ddec = new Decimal(D);
  const nudec = new Decimal(nu);
  const gdec = new Decimal(g);
  
  const numerador = gdec.times(Ddec.pow(2)).times(hfdec);
  const denominador = new Decimal(32).times(nudec).times(Ldec);
  
  return Decimal.max(numerador.div(denominador), 0);
}

interface CalcResult {
  Q: number;
  table: IterationRow[];
}

function calcularDiseno(
  L: number, D: number, ks: number, nu: number, Km: number,
  z1: number, z2: number, g: number = 9.81,
  tolHf: number = 1e-8, tolRelQ: number = 1e-8, maxIter: number = 100
): CalcResult {
  // Convertir todo a Decimal
  const Ldec = new Decimal(L);
  const Ddec = new Decimal(D);
  const ksdec = new Decimal(ks);
  const nudec = new Decimal(nu);
  const Kmdec = new Decimal(Km);
  const z1dec = new Decimal(z1);
  const z2dec = new Decimal(z2);
  const gdec = new Decimal(g);
  
  let H = z1dec.minus(z2dec);
  if (H.lessThanOrEqualTo(0)) {
    H = H.abs();
  }

  const area = new Decimal(Math.PI).times(Ddec.pow(2)).div(4);
  const rows: IterationRow[] = [];

  let lam = new Decimal(1.0);
  const lambdaMin = new Decimal(0.3);
  const lambdaMax = new Decimal(1.0);
  const shrink = new Decimal(0.5);
  const grow = new Decimal(1.1);
  const pacienciaSubida = 2;

  let rPrev: Decimal | null = null;
  let mejoras = 0;
  let hf = H;
  let qPrev: Decimal | null = null;

  for (let it = 1; it <= maxIter; it++) {
    const vTurb = velocidadTurbulentaDesdeHf(hf.toNumber(), L, D, ks, nu, g);
    
    let reTanteo: Decimal;
    if (nudec.greaterThan(0)) {
      reTanteo = vTurb.abs().times(Ddec).div(nudec);
    } else {
      reTanteo = new Decimal(Infinity);
    }

    let V: Decimal;
    let regimen: string;
    if (reTanteo.lessThan(2000)) {
      V = velocidadLaminarDesdeHf(hf.toNumber(), L, D, nu, g);
      regimen = 'laminar';
    } else {
      V = vTurb;
      regimen = 'turbulent';
    }

    const Q = area.times(V);
    const hm = Kmdec.times(V.pow(2)).div(new Decimal(2).times(gdec));
    const hfNextRaw = H.minus(hm);
    const R = hfNextRaw.minus(hf);
    const hfNext = hf.plus(lam.times(R));

    let Re: Decimal;
    if (nudec.greaterThan(0)) {
      Re = V.abs().times(Ddec).div(nudec);
    } else {
      Re = new Decimal(Infinity);
    }

    rows.push({
      iter: it,
      lambda: lam.toNumber(),
      hf: hf.toNumber(),
      V: V.toNumber(),
      Q: Q.toNumber(),
      Re: Re.toNumber(),
      regimen,
    });

    // Convergence check - usando las tolerancias originales
    const doneHf = hfNext.minus(hf).abs().lessThan(tolHf);
    const doneQ = qPrev !== null && 
      Q.minus(qPrev).abs().div(Decimal.max(Q.abs(), new Decimal(1e-30))).lessThan(tolRelQ);
      
    if (doneHf || doneQ) {
      break;
    }

    // Adaptive lambda - usando Decimal
    if (rPrev !== null) {
      if (R.times(rPrev).lessThan(0) || R.abs().greaterThan(new Decimal(0.9).times(rPrev.abs()))) {
        lam = Decimal.max(lambdaMin, lam.times(shrink));
        mejoras = 0;
      } else if (R.abs().lessThan(new Decimal(0.5).times(rPrev.abs()))) {
        mejoras++;
        if (mejoras >= pacienciaSubida && lam.lessThan(lambdaMax)) {
          lam = Decimal.min(lambdaMax, lam.times(grow));
          mejoras = 0;
        }
      } else {
        mejoras = 0;
      }
    }

    rPrev = R;
    qPrev = Q;
    hf = Decimal.max(hfNext, 0);
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

  const [state, setState] = useState<CalculatorState>(initialState);
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
    // Usar Decimal para la conversión
    const result = new Decimal(num).times(factor);
    return result.toNumber(); // Convertir a number para compatibilidad
  }, []);

  const convertResultValue = useCallback((value: number, fromUnit: string, toUnit: string): string => {
    if (value === 0) return '0';
    
    // Factores de conversión para caudal (desde m³/s)
    const flowFactors: { [key: string]: number } = {
      'm³/s': 1,
      'L/s': 1000,
      'm³/min': 60,
      'm³/h': 3600,
      'ft³/s': 35.3147,
      'gal/min': 15850.3,
      'L/min': 60000,
      'L/h': 3600000,
    };

    const fromFactor = flowFactors[fromUnit] || 1;
    const toFactor = flowFactors[toUnit] || 1;

    // Convertir: (valor / fromFactor) * toFactor
    const converted = (value / fromFactor) * toFactor;
    return formatResult(converted);
  }, [formatResult]);

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
        // Mantener la unidad actual, no resetearla
      }));
      
      // Opcional: Log para verificar la precisión
      console.log('Cálculo completado con decimal.js - Q:', new Decimal(result.Q).toPrecision(50));
      
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
    let text = `${t('diseñoCalc.resultLabel')}: ${convertResultValue(state.resultQ, 'm³/s', state.resultQUnit)} ${state.resultQUnit}\n`;
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
    setState({
      ...initialState(),
      resultQUnit: 'm³/s', // Asegurar unidad por defecto
    });
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
      await saveCalculation(db, 'DiseñoCalc', JSON.stringify(inputs), `${convertResultValue(state.resultQ, 'm³/s', state.resultQUnit)} ${state.resultQUnit}`);
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
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const fmtNum = (n: number): string => {
      if (!isFinite(n) || isNaN(n)) return '-';
      if (n === 0) return '0';
      const s = formatResult(n);
      return s.length > 10 ? s.substring(0, 10) : s;
    };

    // Column definitions: [header, width]
    const cols: [string, number][] = [
      [t('diseñoCalc.table.header.iter') || 'Iter', 44],
      [t('diseñoCalc.table.header.lambda') || 'λ', 56],
      [t('diseñoCalc.table.header.hf') || 'hf [m]', 90],
      [t('diseñoCalc.table.header.v') || 'V [m/s]', 90],
      [t('diseñoCalc.table.header.q') || 'Q [m³/s]', 90],
      [t('diseñoCalc.table.header.re') || 'Re [-]', 90],
      [t('diseñoCalc.table.header.regimen') || 'Régimen', 80],
    ];

    // Calcular el ancho total de la tabla
    const totalTableWidth = cols.reduce((sum, [, width]) => sum + width, 0) * fontSizeFactor;

    const renderTableContent = (scale: number, textBg: string, textColor: string, textStrong: string) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header row */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, colWidth], ci) => (
            <View
              key={`hdr-${ci}`}
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
            t(`reynoldsCalc.regime.${row.regimen.toLowerCase()}`) || row.regimen
          ];
          return (
            <View key={`row-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
              {cols.map(([, colWidth], ci) => (
                <View key={`cell-${i}-${ci}`} style={[styles.tableCell, { width: colWidth * scale, borderColor: bc }]}>
                  <Text
                    style={[
                      isLast ? styles.tableCellHeaderText : styles.tableCellText,
                      { color: isLast ? textStrong : textColor, fontSize: 11 * scale },
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

    // Landscape modal dimensions: rotamos 90°, así el "ancho" es la altura real de la pantalla
    const modalLandscapeWidth = screenHeight;
    const modalLandscapeHeight = screenWidth;

    return (
      <View style={{ marginTop: 8 }}>
        {/* Title row with expand button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('diseñoCalc.table.title') || 'Tabla de iteraciones'}
          </Text>
          <Pressable
            onPress={() => setTableModalVisible(true)}
            style={styles.expandButton}
          >
            {/* CAPA 1: Fondo base */}
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
            
            {/* CAPA 2: Gradiente exterior (borde) */}
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
              
            {/* CAPA 3: Contenido del botón (texto + icono) */}
            <View style={styles.expandButtonContent}>
              <Text style={[styles.expandButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('diseñoCalc.table.viewFull') || 'Ver completo'}
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
            {/* Container rotado 90° para simular landscape */}
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
              {/* ScrollView que envuelve TODO el contenido del modal */}
              <ScrollView
                style={{ flex: 1, backgroundColor: currentTheme === 'dark' ? 'rgb(14,14,14)' : 'rgb(255,255,255)' }}
                contentContainerStyle={{ 
                  paddingVertical: 0,
                  alignItems: 'center',
                }}
                showsVerticalScrollIndicator
              >
                {/* Header del modal */}
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
                    {t('diseñoCalc.table.title') || 'Tabla de iteraciones'}
                  </Text>
              
                  {/* Botón de cerrar */}
                  <Pressable
                    onPress={() => setTableModalVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <View style={[styles.buttonBackground22, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient2 }]} />
                    <MaskedView
                      style={styles.modalCloseButtonMasked}
                      maskElement={<View style={styles.modalCloseButtonMask} />}
                    >
                      <View
                        style={[
                          styles.buttonGradient22,
                          { experimental_backgroundImage: themeColors.gradient2 },
                        ]}
                      />
                    </MaskedView>
                    <Icon name="x" size={18} color={themeColors.icon} style={styles.modalCloseButtonIcon} />
                  </Pressable>
                </View>
                      
                {/* Tabla con scroll horizontal */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderTableContent(
                    fontSizeFactor * 1.1,
                    themeColors.text,
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
  }, [state.iterationTable, themeColors, currentTheme, fontSizeFactor, t, formatResult, tableModalVisible]);

  // ── Main result display value ──────────────────────────────────────────────
  const mainResultValue = state.resultQ === 0 
    ? '一' 
    : adjustDecimalSeparator(formatNumber(parseFloat(formatResult(state.resultQ))));

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
                    <Pressable
                      onPress={() => navigateToOptions(
                        'flow',
                        (option: string) => {
                          // Convertir el valor actual a la nueva unidad
                          const newValue = convertResultValue(state.resultQ, state.resultQUnit, option);
                          setState(prev => ({
                            ...prev,
                            resultQUnit: option,
                          }));
                        },
                        state.resultQUnit
                      )}
                    >
                      <Text
                        style={[styles.flowLabel, {
                          color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
                          fontSize: 16 * fontSizeFactor,
                        }]}
                      >
                        {state.resultQ === 0
                          ? 'な'
                          : `${t('diseñoCalc.resultLabel') || 'Q'} (${state.resultQUnit})`
                        }
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[styles.flowValue, {
                        color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
                        fontSize: 30 * fontSizeFactor,
                      }]}
                    >
                      {state.resultQ === 0 
                        ? '一' 
                        : adjustDecimalSeparator(
                            formatNumber(
                              parseFloat(
                                convertResultValue(state.resultQ, 'm³/s', state.resultQUnit)
                              )
                            )
                          )
                      }
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
            `${t('diseñoCalc.labels.L') || 'Longitud'} (L)`,
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
            `${t('diseñoCalc.labels.D') || 'Diámetro'} (D)`,
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
            `${t('diseñoCalc.labels.ks') || 'Rugosidad'} (kˢ)`,
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
            `${t('diseñoCalc.labels.nu') || 'Viscosidad cinemática'} (ν)`,
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
            `${t('diseñoCalc.labels.Km') || 'Pérdidas menores'} (Kᵐ)`,
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
            `${t('diseñoCalc.labels.z1') || 'Cota aguas arriba'} (z₁)`,
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
            `${t('diseñoCalc.labels.z2') || 'Cota aguas abajo'} (z₂)`,
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
            `${t('diseñoCalc.labels.g') || 'Gravedad'} (g)`,
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
            <View style={[styles.separator, { backgroundColor: themeColors.separator, marginVertical: 15 }]} />
          )}

          {/* Iteration table */}
          {renderTable()}

          {/* Info text - solo visible cuando NO hay tabla de iteraciones */}
          {state.iterationTable.length === 0 && (
            <View>
              <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
              <View style={styles.descriptionContainer}>
                <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                  {t('diseñoCalc.infoText')}
                </Text>
              </View>
            </View>
          )}

        </View>

        {/* Logo de la aplicación al final del contenido */}
        <View style={styles.logoContainer}>
          <FastImage
            source={currentTheme === 'dark' ? logoDark : logoLight}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
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
  // mas
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
  separator2: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
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
});

export default DiseñoCalc;
