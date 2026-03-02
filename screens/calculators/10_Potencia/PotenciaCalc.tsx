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
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import IconCheck from 'react-native-vector-icons/Octicons';
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
  Favorite
} from '../../../src/services/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../../src/components/CustomKeyboardInput';

// ─── Assets ────────────────────────────────────────────────────────────────────
const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ──────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenPotencia: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenPotencia: undefined;
  PotenciaTheory: undefined;
};

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
  },
  flow: {
    'm³/s': 1,
    'L/s': 0.001,
    'm³/h': 1 / 3600,
    'ft³/s': 0.028316846592,
    'gal/min': 6.30902e-5,
  },
  viscosity: {
    'm²/s': 1,
    'cm²/s': 0.0001,
    'mm²/s': 0.000001,
    'ft²/s': 0.09290304,
    'cSt': 0.000001,
  },
  specificWeight: {
    'N/m³': 1,
    'kN/m³': 1000,
    'lbf/ft³': 157.08746061538463,
  },
  pressure: {
    'Pa': 1,
    'kPa': 1000,
    'MPa': 1000000,
    'bar': 100000,
    'atm': 101325,
    'psi': 6894.757293178,
    'mmHg': 133.32236842105263,
    'mca': 9806.65,
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

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ResultsData {
  A: number;
  V: number;
  Re: number;
  regimen: string;
  f: number;
  iteraciones: number;
  convergio: boolean;
  hf: number;
  hm: number;
  deltaZ: number;
  deltaPGamma: number;
  Ht: number;
  Ph: number;
  P: number;
}

interface CalculatorState {
  // Pipe parameters
  D: string;
  DUnit: string;
  Q: string;
  QUnit: string;
  ks: string;
  ksUnit: string;
  nu: string;
  nuUnit: string;
  L: string;
  LUnit: string;
  // Fluid & system
  km: string;
  gamma: string;
  gammaUnit: string;
  eta: string;
  // Heights
  z1: string;
  z1Unit: string;
  z2: string;
  z2Unit: string;
  // Pressures (optional)
  includePresiones: boolean;
  p1: string;
  p1Unit: string;
  p2: string;
  p2Unit: string;
  // Results
  results: ResultsData | null;
  invalidFields: string[];
}

// ─── Initial state ─────────────────────────────────────────────────────────────
const initialState = (): CalculatorState => ({
  D: '',
  DUnit: 'm',
  Q: '',
  QUnit: 'm³/s',
  ks: '',
  ksUnit: 'm',
  nu: '1e-6',
  nuUnit: 'm²/s',
  L: '',
  LUnit: 'm',
  km: '',
  gamma: '9810',
  gammaUnit: 'N/m³',
  eta: '',
  z1: '',
  z1Unit: 'm',
  z2: '',
  z2Unit: 'm',
  includePresiones: false,
  p1: '0',
  p1Unit: 'Pa',
  p2: '0',
  p2Unit: 'Pa',
  results: null,
  invalidFields: [],
});

// ─── Checkbox component ────────────────────────────────────────────────────────
const Checkbox = ({
  label,
  value,
  onValueChange,
  themeColors,
  fontSizeFactor,
  currentTheme,
}: {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  themeColors: any;
  fontSizeFactor: number;
  currentTheme: string;
}) => (
  <Pressable style={styles.checkboxContainer} onPress={() => onValueChange(!value)}>
    <View
      style={[
        styles.checkbox,
        {
          borderColor: value ? 'transparent' : themeColors.checkboxMargin,
          backgroundColor: value ? 'rgb(194,254,12)' : 'transparent',
        },
      ]}
    >
      {value && <IconCheck name="dot-fill" size={14} color="#000" />}
    </View>
    <Text style={[styles.checkboxLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
      {label}
    </Text>
  </Pressable>
);

// ─── Dot color helper ─────────────────────────────────────────────────────────
// No blue (auto-calculated) state since this calculator never auto-fills a field
const getDotColor = (hasUserValue: boolean, isInvalid: boolean): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (hasUserValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ─── Main component ────────────────────────────────────────────────────────────
const PotenciaCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { activeInputId, setActiveInputId } = useKeyboard();
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // Ref with current state — avoids stale closures in keyboard handlers
  const stateRef = useRef<CalculatorState>(initialState());
  // Map of fieldId → full onChange handler for the custom keyboard
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});

  // ─── Theme colors ───────────────────────────────────────────────────────────
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
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        tableHeader: 'rgba(255,255,255,0.06)',
        tableBorder: 'rgba(255,255,255,0.1)',
        checkboxMargin: 'rgb(255,255,255)',
      };
    }
    return {
      card: 'rgba(255,255,255,1)',
      text: 'rgb(0,0,0)',
      textStrong: 'rgb(0,0,0)',
      separator: 'rgb(235,235,235)',
      icon: 'rgb(0,0,0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      tableHeader: 'rgba(0,0,0,0.04)',
      tableBorder: 'rgba(0,0,0,0.08)',
      checkboxMargin: 'rgb(0,0,0)',
    };
  }, [currentTheme]);

  // ─── State ──────────────────────────────────────────────────────────────────
  const [state, setState] = useState<CalculatorState>(initialState);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useFocusEffect(
    React.useCallback(() => {
      return () => setActiveInputId(null);
    }, []),
  );

  // ─── Scroll-to-input when keyboard opens ───────────────────────────────────
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
    
    // Pequeño delay para asegurar que el teclado ya se mostró
    setTimeout(() => {
      viewRef.measureLayout(
        scrollViewRef.current as any,
        (_x: number, y: number, _w: number, height: number) => {
          const KEYBOARD_HEIGHT = 280; // Misma altura que en contentInset
          const SCREEN_HEIGHT = Dimensions.get('window').height;
          
          // Calcula la posición para que el input quede justo encima del teclado
          const targetScrollY = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
          
          scrollViewRef.current?.scrollTo({ 
            y: Math.max(0, targetScrollY), 
            animated: true 
          });
        },
        () => {} // fallback si measureLayout falla
      );
    }, 150); // 150ms de delay
  }, [activeInputId]);

  // ─── Favorites ─────────────────────────────────────────────────────────────
  const heartScale = useRef(new Animated.Value(1)).current;
  const [isFav, setIsFav] = useState(false);
  const dbRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDBConnection();
        await createFavoritesTable(db);
        dbRef.current = db;
        const fav = await isFavorite(db, 'PotenciaCalc');
        setIsFav(fav);
      } catch {}
    })();
  }, []);

  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) {
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      
      if (isFav) {
        await removeFavorite(db, 'PotenciaCalc');
        setIsFav(false);
        Toast.show({
          type: 'success',
          text1: t('common.success'),
          text2: t('common.removedFromFavorites') || 'Eliminado de favoritos',
        });
      } else {
        // Crear objeto Favorite correctamente
        const favorite: Favorite = {
          route: 'PotenciaCalc',
          label: t('potenciaCalc.title') || 'Calculadora de Potencia',
          created_at: Date.now()
        };
        
        await addFavorite(db, favorite);
        
        setIsFav(true);
        Toast.show({
          type: 'success',
          text1: t('common.success'),
          text2: t('common.addedToFavorites') || 'Añadido a favoritos',
        });
      }
      bounceHeart();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('common.favoriteError') || 'Error al gestionar favoritos',
      });
    }
  }, [isFav, t, bounceHeart]);

  // ─── Utilities ─────────────────────────────────────────────────────────────
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const d = new Decimal(num);
    return d.toFixed(15).replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback(
    (value: string, fromUnit: string, toUnit: string, category: string): string => {
      const clean = value.replace(',', '.');
      if (clean === '' || isNaN(parseFloat(clean))) return value;
      const num = new Decimal(clean);
      const from = conversionFactors[category]?.[fromUnit];
      const to = conversionFactors[category]?.[toUnit];
      if (!from || !to) return value;
      return formatResult(num.mul(new Decimal(from)).div(new Decimal(to)).toNumber());
    },
    [formatResult],
  );

  const adjustDecimalSeparator = useCallback(
    (s: string): string =>
      selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s,
    [selectedDecimalSeparator],
  );

  const formatDisplayValue = useCallback(
    (val: string): string => {
      if (!val) return val;
      const last = val.charAt(val.length - 1);
      if (last === '.' || last === ',') return val;
      if ((val.includes('.') && val.split('.')[1] === '') || (val.includes(',') && val.split(',')[1] === ''))
        return val;
      const norm = val.replace(',', '.');
      if (norm === '0.0') return selectedDecimalSeparator === 'Coma' ? '0,0' : '0.0';
      const num = parseFloat(norm);
      if (isNaN(num)) return val;
      const dec = norm.includes('.') ? norm.split('.')[1] : '';
      if (dec.length === 0)
        return selectedDecimalSeparator === 'Coma' ? num.toString().replace('.', ',') : num.toString();
      return selectedDecimalSeparator === 'Coma'
        ? num.toFixed(dec.length).replace('.', ',')
        : num.toFixed(dec.length);
    },
    [selectedDecimalSeparator],
  );

  // ─── Colebrook-White (Newton-Raphson) ──────────────────────────────────────
  const solveColebrookWhite = useCallback(
    (
      Re: number,
      ks: number,
      D: number,
    ): { f: number; iteraciones: number; convergio: boolean } => {
      // Laminar flow
      if (Re < 2300) {
        return { f: 64 / Re, iteraciones: 1, convergio: true };
      }
      const A_cb = ks / (3.7 * D);
      const B_cb = 2.51 / Re;
      // Starting estimate (Swamee-Jain inspired)
      let x = -2.0 * Math.log10(A_cb + B_cb);
      const tol = 1e-20;
      const maxIter = 1000;
      for (let i = 1; i <= maxIter; i++) {
        const arg = A_cb + B_cb * x;
        if (arg <= 0) break;
        const F = x + 2.0 * Math.log10(arg);
        const dF = 1.0 + (2.0 * B_cb) / (Math.log(10) * arg);
        const x_new = x - F / dF;
        if (Math.abs(x_new - x) < tol) {
          return { f: 1.0 / (x_new * x_new), iteraciones: i, convergio: true };
        }
        x = x_new;
      }
      return { f: 1.0 / (x * x), iteraciones: maxIter, convergio: false };
    },
    [],
  );

  // ─── Convert a raw field to SI ─────────────────────────────────────────────
  const toSI = useCallback(
    (value: string, unit: string, category: string): number | null => {
      const clean = value.replace(',', '.').trim();
      if (clean === '' || isNaN(parseFloat(clean))) return null;
      const num = parseFloat(clean);
      const factor = conversionFactors[category]?.[unit] ?? 1;
      return num * factor;
    },
    [],
  );

  // ─── Calculate ─────────────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const s = stateRef.current;
    const invalid: string[] = [];

    const need = (field: string, unit: string, category: string): number | null => {
      const raw = (s as any)[field] as string;
      const v = toSI(raw, unit, category);
      if (v === null) invalid.push(field);
      return v;
    };

    const needDimensionless = (field: string): number | null => {
      const raw = ((s as any)[field] as string).replace(',', '.').trim();
      if (raw === '' || isNaN(parseFloat(raw))) { invalid.push(field); return null; }
      return parseFloat(raw);
    };

    const D     = need('D',     s.DUnit,     'length');
    const Q     = need('Q',     s.QUnit,     'flow');
    const ks    = need('ks',    s.ksUnit,    'length');
    const nu    = need('nu',    s.nuUnit,    'viscosity');
    const L     = need('L',     s.LUnit,     'length');
    const gamma = need('gamma', s.gammaUnit, 'specificWeight');
    const km    = needDimensionless('km');
    const eta   = needDimensionless('eta');
    const z1    = need('z1',    s.z1Unit,    'length');
    const z2    = need('z2',    s.z2Unit,    'length');

    let p1_si = 0;
    let p2_si = 0;
    if (s.includePresiones) {
      const p1v = need('p1', s.p1Unit, 'pressure');
      const p2v = need('p2', s.p2Unit, 'pressure');
      if (p1v !== null) p1_si = p1v;
      if (p2v !== null) p2_si = p2v;
    }

    const allValid =
      invalid.length === 0 &&
      D !== null && Q !== null && ks !== null && nu !== null && L !== null &&
      gamma !== null && km !== null && eta !== null && z1 !== null && z2 !== null;

    if (!allValid) {
      setState(prev => ({ ...prev, invalidFields: invalid, results: null }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('potenciaCalc.toasts.missingFields'),
      });
      return;
    }

    // Logical validation
    if (
      D! <= 0 || Q! <= 0 || nu! <= 0 || L! <= 0 ||
      gamma! <= 0 || eta! <= 0 || eta! > 1 || ks! < 0
    ) {
      setState(prev => ({ ...prev, invalidFields: invalid, results: null }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('potenciaCalc.toasts.invalidValues'),
      });
      return;
    }

    const g = 9.80665;
    const A = Math.PI * D! * D! / 4;
    const V = Q! / A;
    const Re = (V * D!) / nu!;
    const { f, iteraciones, convergio } = solveColebrookWhite(Re, ks!, D!);
    const V2g = (V * V) / (2 * g);
    const hf = f * (L! / D!) * V2g;
    const hm = km! * V2g;
    const deltaZ = z2! - z1!;
    const deltaP = p2_si - p1_si;
    const deltaPGamma = deltaP / gamma!;
    const Ht = deltaZ + hf + hm + deltaPGamma;
    const Ph = gamma! * Q! * Ht;
    const P = Ph / eta!;

    const regimen =
      Re < 2300
        ? t('potenciaCalc.regimen.laminar')
        : Re < 4000
          ? t('potenciaCalc.regimen.transicion')
          : t('potenciaCalc.regimen.turbulento');

    setState(prev => ({
      ...prev,
      invalidFields: [],
      results: { A, V, Re, regimen, f, iteraciones, convergio, hf, hm, deltaZ, deltaPGamma, Ht, Ph, P },
    }));
  }, [solveColebrookWhite, toSI, t]);

  // ─── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setState(initialState());
    setActiveInputId(null);
  }, [setActiveInputId]);

  // ─── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const s = stateRef.current;
    if (!s.results) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('potenciaCalc.toasts.nothingToCopy'),
      });
      return;
    }
    const r = s.results;
    const fmt = (n: number) => formatResult(n);
    let text = `${t('potenciaCalc.title')}\n\n`;
    text += `${t('potenciaCalc.results.A')}: ${fmt(r.A)} m²\n`;
    text += `${t('potenciaCalc.results.V')}: ${fmt(r.V)} m/s\n`;
    text += `${t('potenciaCalc.results.Re')}: ${fmt(r.Re)}\n`;
    text += `${t('potenciaCalc.results.regimen')}: ${r.regimen}\n`;
    text += `${t('potenciaCalc.results.f')}: ${fmt(r.f)}\n`;
    text += `${t('potenciaCalc.results.hf')}: ${fmt(r.hf)} m\n`;
    text += `${t('potenciaCalc.results.hm')}: ${fmt(r.hm)} m\n`;
    text += `${t('potenciaCalc.results.deltaZ')}: ${fmt(r.deltaZ)} m\n`;
    text += `${t('potenciaCalc.results.deltaPGamma')}: ${fmt(r.deltaPGamma)} m\n`;
    text += `${t('potenciaCalc.results.Ht')}: ${fmt(r.Ht)} m\n`;
    text += `${t('potenciaCalc.results.Ph')}: ${fmt(r.Ph)} W\n`;
    text += `${t('potenciaCalc.results.P')}: ${fmt(r.P)} W  (${fmt(r.P / 1000)} kW)\n`;
    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('potenciaCalc.toasts.copied'),
    });
  }, [formatResult, t]);

  // ─── Save history ──────────────────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
    const s = stateRef.current;
    if (!s.results) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('potenciaCalc.toasts.nothingToSave'),
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
        D: s.D, DUnit: s.DUnit,
        Q: s.Q, QUnit: s.QUnit,
        ks: s.ks, ksUnit: s.ksUnit,
        nu: s.nu, nuUnit: s.nuUnit,
        L: s.L, LUnit: s.LUnit,
        km: s.km,
        gamma: s.gamma, gammaUnit: s.gammaUnit,
        eta: s.eta,
        z1: s.z1, z1Unit: s.z1Unit,
        z2: s.z2, z2Unit: s.z2Unit,
        includePresiones: s.includePresiones,
        ...(s.includePresiones && {
          p1: s.p1, p1Unit: s.p1Unit,
          p2: s.p2, p2Unit: s.p2Unit,
        }),
      };
      await saveCalculation(
        db,
        'PotenciaCalc',
        JSON.stringify(inputs),
        formatResult(s.results.P),
      );
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('potenciaCalc.toasts.saved'),
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('potenciaCalc.toasts.saveError'),
      });
    }
  }, [formatResult, t]);

  // ─── Navigate to unit picker ────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (
      category: string,
      onSelectOption: (opt: string) => void,
      selectedOption?: string,
    ) => {
      navigation.navigate('OptionsScreenPotencia', {
        category,
        onSelectOption,
        selectedOption,
      });
    },
    [navigation],
  );

  // ─── Custom keyboard handlers ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const s = stateRef.current;
    const map: Record<string, string> = {
      D: s.D, Q: s.Q, ks: s.ks, nu: s.nu, L: s.L,
      km: s.km, gamma: s.gamma, eta: s.eta,
      z1: s.z1, z2: s.z2, p1: s.p1, p2: s.p2,
    };
    return map[id] ?? '';
  }, []);

  const handleKeyboardKey = useCallback(
    (key: string) => {
      const id = activeInputIdRef.current;
      if (!id) return;
      inputHandlersRef.current[id]?.(getActiveValue() + key);
    },
    [getActiveValue],
  );

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
    if (!val || val === '.') return;
    inputHandlersRef.current[id]?.(
      (parseFloat(val.replace(',', '.')) * 10).toString(),
    );
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const val = getActiveValue();
    if (!val || val === '.') return;
    inputHandlersRef.current[id]?.(
      (parseFloat(val.replace(',', '.')) / 10).toString(),
    );
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);

  // ─── Render input with unit picker ────────────────────────────────────────
  const renderInput = useCallback(
    (
      id: string,
      label: string,
      value: string,
      unit: string,
      category: string,
      onChange: (text: string) => void,
      onChangeUnit: (newUnit: string) => void,
    ) => {
      const isInvalid = state.invalidFields.includes(id);
      const hasValue = (value?.trim()?.length ?? 0) > 0;
      const dotColor = getDotColor(hasValue, isInvalid);

      // Register handler for custom keyboard
      inputHandlersRef.current[id] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== id),
        }));
      };

      return (
        <View
          key={id}
          ref={r => {
            inputRefs.current[id] = r;
          }}
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
            <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
          </View>
          <View style={styles.redContainer}>
            {/* Value field */}
            <View
              style={[
                styles.Container,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            >
              <View
                style={[
                  styles.innerWhiteContainer,
                  { backgroundColor: themeColors.card },
                ]}
              >
                <Pressable
                  onPress={() => setActiveInputId(id)}
                  style={StyleSheet.absoluteFill}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                  value={formatDisplayValue(value)}
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
            {/* Unit picker */}
            <Pressable
              style={[
                styles.Container2,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
              onPress={() =>
                navigateToOptions(
                  category,
                  (option: string) => {
                    const converted = convertValue(value, unit, option, category);
                    onChangeUnit(option);
                    onChange(converted);
                  },
                  unit,
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
                  name="chevron-right"
                  size={16 * fontSizeFactor}
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
      fontSizeFactor,
      currentTheme,
      navigateToOptions,
      convertValue,
      formatDisplayValue,
      setActiveInputId,
    ],
  );

  // ─── Render dimensionless input (no unit picker) ──────────────────────────
  const renderSimpleInput = useCallback(
    (
      id: string,
      label: string,
      value: string,
      onChange: (text: string) => void,
    ) => {
      const isInvalid = state.invalidFields.includes(id);
      const hasValue = (value?.trim()?.length ?? 0) > 0;
      const dotColor = getDotColor(hasValue, isInvalid);

      inputHandlersRef.current[id] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== id),
        }));
      };

      return (
        <View
          key={id}
          ref={r => {
            inputRefs.current[id] = r;
          }}
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
            <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
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
              style={[
                styles.innerWhiteContainer,
                { backgroundColor: themeColors.card },
              ]}
            >
              <Pressable
                onPress={() => setActiveInputId(id)}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
                value={formatDisplayValue(value)}
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
    [
      state.invalidFields,
      themeColors,
      fontSizeFactor,
      currentTheme,
      formatDisplayValue,
      setActiveInputId,
    ],
  );

  // ─── Render results table ──────────────────────────────────────────────────
  const renderTable = useCallback(() => {
    const { results } = state;
    if (!results) return null;

    const bc = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;

    const fmtNum = (n: number): string => {
      if (!isFinite(n) || isNaN(n)) return '-';
      return adjustDecimalSeparator(formatNumber(n));
    };

    type TableRow = { label: string; value: string; isHighlight?: boolean };

    const rows: TableRow[] = [
      {
        label: t('potenciaCalc.results.A'),
        value: `${fmtNum(results.A)} m²`,
      },
      {
        label: t('potenciaCalc.results.V'),
        value: `${fmtNum(results.V)} m/s`,
      },
      {
        label: t('potenciaCalc.results.Re'),
        value: fmtNum(results.Re),
      },
      {
        label: t('potenciaCalc.results.regimen'),
        value: results.regimen,
      },
      {
        label: t('potenciaCalc.results.f'),
        value: fmtNum(results.f),
      },
      {
        label: t('potenciaCalc.results.hf'),
        value: `${fmtNum(results.hf)} m`,
      },
      {
        label: t('potenciaCalc.results.hm'),
        value: `${fmtNum(results.hm)} m`,
      },
      {
        label: t('potenciaCalc.results.deltaZ'),
        value: `${fmtNum(results.deltaZ)} m`,
      },
      {
        label: t('potenciaCalc.results.deltaPGamma'),
        value: `${fmtNum(results.deltaPGamma)} m`,
      },
      {
        label: t('potenciaCalc.results.Ht'),
        value: `${fmtNum(results.Ht)} m`,
      },
      {
        label: t('potenciaCalc.results.Ph'),
        value: `${fmtNum(results.Ph)} W`,
      },
      {
        label: t('potenciaCalc.results.P'),
        value: `${fmtNum(results.P)} W  (${fmtNum(results.P / 1000)} kW)`,
        isHighlight: true,
      },
    ];

    return (
      <View style={{ marginTop: 8 }}>
        <Text
          style={[
            styles.sectionSubtitle,
            {
              color: themeColors.textStrong,
              fontSize: 18 * fontSizeFactor,
              marginBottom: 15,
            },
          ]}
        >
          {t('potenciaCalc.resultsTitle')}
        </Text>

        <View style={[styles.tableContainer, { borderColor: bc }]}>
          {/* Header row */}
          <View style={[styles.tableRow]}>
            <View
              style={[
                styles.tableCell,
                {
                  flex: 1.7,
                  borderColor: bc,
                  backgroundColor: hBg,
                  borderBottomWidth: 1,
                  borderBottomColor: bc,
                },
              ]}
            >
              <Text
                style={[
                  styles.tableCellHeaderText,
                  { color: themeColors.textStrong, fontSize: 12 * fontSizeFactor },
                ]}
              >
                {t('potenciaCalc.table.parameter')}
              </Text>
            </View>
            <View
              style={[
                styles.tableCell,
                {
                  flex: 1,
                  borderColor: bc,
                  backgroundColor: hBg,
                  borderBottomWidth: 1,
                  borderBottomColor: bc,
                },
              ]}
            >
              <Text
                style={[
                  styles.tableCellHeaderText,
                  { color: themeColors.textStrong, fontSize: 12 * fontSizeFactor },
                ]}
              >
                {t('potenciaCalc.table.value')}
              </Text>
            </View>
          </View>

          {/* Data rows */}
          {rows.map((row, i) => {
            const isLast = !!row.isHighlight;
            const rowBg = isLast
              ? currentTheme === 'dark'
                ? 'rgba(194,254,12,0.08)'
                : 'rgba(194,254,12,0.15)'
              : i % 2 !== 0
                ? currentTheme === 'dark'
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)'
                : 'transparent';

            return (
              <View
                key={`row-${i}`}
                style={[styles.tableRow, { backgroundColor: rowBg }]}
              >
                <View
                  style={[
                    styles.tableCell,
                    { flex: 1.7, borderColor: bc },
                  ]}
                >
                  <Text
                    style={[
                      isLast ? styles.tableCellHeaderText : styles.tableCellText,
                      {
                        color: isLast ? themeColors.textStrong : themeColors.text,
                        fontSize: 12 * fontSizeFactor,
                      },
                    ]}
                  >
                    {row.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.tableCell,
                    { flex: 1, borderColor: bc },
                  ]}
                >
                  <Text
                    style={[
                      isLast ? styles.tableCellHeaderText : styles.tableCellText,
                      {
                        color: isLast ? themeColors.textStrong : themeColors.text,
                        fontSize: 12 * fontSizeFactor,
                      },
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }, [
    state.results,
    themeColors,
    currentTheme,
    fontSizeFactor,
    t,
    adjustDecimalSeparator,
    formatNumber,
  ]);

  // ─── Derived display values ────────────────────────────────────────────────
  const isKeyboardOpen = !!activeInputId;

  const mainResultValue = state.results
    ? adjustDecimalSeparator(formatNumber(state.results.P / 1000))
    : '一';

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
              style={[
                styles.iconContainer,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient,
                },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={22} color="rgb(255,255,255)" />
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
                onPress={() => { bounceHeart(); toggleFavorite(); }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <IconFavorite
                    name={isFav ? 'heart' : 'heart-o'}
                    size={20}
                    color={isFav ? 'rgba(255,63,63,1)' : 'rgb(255,255,255)'}
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
                onPress={() => navigation.navigate('PotenciaTheory')}
              >
                <Icon name="book" size={20} color="rgb(255,255,255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('potenciaCalc.calculator')}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('potenciaCalc.title')}
          </Text>
        </View>

        {/* ── Main result card ── */}
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
                  {t('potenciaCalc.saveToHistory')}
                </Text>
                <Icon
                  name="plus"
                  size={16 * fontSizeFactor}
                  color="rgba(255,255,255,0.4)"
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
                        ...(StyleSheet.absoluteFillObject as any),
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      }}
                    />
                  )}
                  {/* Label tag */}
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
                      {state.results === null
                        ? 'な'
                        : `${t('potenciaCalc.resultLabel')} (kW)`}
                    </Text>
                  </View>
                  {/* Result value */}
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
            {
              icon: 'terminal',
              label: t('common.calculate'),
              action: handleCalculate,
            },
            { icon: 'copy', label: t('common.copy'), action: handleCopy },
            { icon: 'trash', label: t('common.clear'), action: handleClear },
            {
              icon: 'clock',
              label: t('common.history'),
              action: () => navigation.navigate('HistoryScreenPotencia'),
            },
          ].map(({ icon, label, action }) => (
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
                    color="rgb(255,255,255)"
                  />
                  <Icon
                    name={icon}
                    size={22 * fontSizeFactor}
                    color="rgba(255,255,255,0.5)"
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

        {/* ── Inputs section ── */}
        <View
          style={[
            styles.inputsSection,
            {
              backgroundColor: themeColors.card,
              paddingBottom: isKeyboardOpen ? 330 : 70,
            },
          ]}
        >
          {/* ─ Section: Pipe parameters ─ */}
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: themeColors.textStrong,
                fontSize: 18 * fontSizeFactor,
              },
            ]}
          >
            {t('potenciaCalc.sections.pipe')}
          </Text>

          {renderInput(
            'D',
            t('potenciaCalc.labels.D'),
            state.D, state.DUnit, 'length',
            v => setState(prev => ({ ...prev, D: v })),
            u => setState(prev => ({ ...prev, DUnit: u })),
          )}

          {renderInput(
            'Q',
            t('potenciaCalc.labels.Q'),
            state.Q, state.QUnit, 'flow',
            v => setState(prev => ({ ...prev, Q: v })),
            u => setState(prev => ({ ...prev, QUnit: u })),
          )}

          {renderInput(
            'ks',
            t('potenciaCalc.labels.ks'),
            state.ks, state.ksUnit, 'length',
            v => setState(prev => ({ ...prev, ks: v })),
            u => setState(prev => ({ ...prev, ksUnit: u })),
          )}

          {renderInput(
            'nu',
            t('potenciaCalc.labels.nu'),
            state.nu, state.nuUnit, 'viscosity',
            v => setState(prev => ({ ...prev, nu: v })),
            u => setState(prev => ({ ...prev, nuUnit: u })),
          )}

          {renderInput(
            'L',
            t('potenciaCalc.labels.L'),
            state.L, state.LUnit, 'length',
            v => setState(prev => ({ ...prev, L: v })),
            u => setState(prev => ({ ...prev, LUnit: u })),
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* ─ Section: Fluid & system ─ */}
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: themeColors.textStrong,
                fontSize: 18 * fontSizeFactor,
              },
            ]}
          >
            {t('potenciaCalc.sections.fluid')}
          </Text>

          {renderSimpleInput(
            'km',
            t('potenciaCalc.labels.km'),
            state.km,
            v => setState(prev => ({ ...prev, km: v })),
          )}

          {renderInput(
            'gamma',
            t('potenciaCalc.labels.gamma'),
            state.gamma, state.gammaUnit, 'specificWeight',
            v => setState(prev => ({ ...prev, gamma: v })),
            u => setState(prev => ({ ...prev, gammaUnit: u })),
          )}

          {renderSimpleInput(
            'eta',
            t('potenciaCalc.labels.eta'),
            state.eta,
            v => setState(prev => ({ ...prev, eta: v })),
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* ─ Section: Heights ─ */}
          <Text
            style={[
              styles.sectionSubtitle,
              {
                color: themeColors.textStrong,
                fontSize: 18 * fontSizeFactor,
              },
            ]}
          >
            {t('potenciaCalc.sections.heights')}
          </Text>

          {renderInput(
            'z1',
            t('potenciaCalc.labels.z1'),
            state.z1, state.z1Unit, 'length',
            v => setState(prev => ({ ...prev, z1: v })),
            u => setState(prev => ({ ...prev, z1Unit: u })),
          )}

          {renderInput(
            'z2',
            t('potenciaCalc.labels.z2'),
            state.z2, state.z2Unit, 'length',
            v => setState(prev => ({ ...prev, z2: v })),
            u => setState(prev => ({ ...prev, z2Unit: u })),
          )}

          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          {/* ─ Pressures checkbox ─ */}
          <View style={styles.checkboxRow}>
            <Checkbox
              label={t('potenciaCalc.includePresiones')}
              value={state.includePresiones}
              onValueChange={v =>
                setState(prev => ({ ...prev, includePresiones: v }))
              }
              themeColors={themeColors}
              fontSizeFactor={fontSizeFactor}
              currentTheme={currentTheme}
            />
          </View>

          {/* ─ Section: Pressures (conditional) ─ */}
          {state.includePresiones && (
            <>
              <Text
                style={[
                  styles.sectionSubtitle,
                  {
                    color: themeColors.textStrong,
                    fontSize: 18 * fontSizeFactor,
                  },
                ]}
              >
                {t('potenciaCalc.sections.pressures')}
              </Text>

              {renderInput(
                'p1',
                t('potenciaCalc.labels.p1'),
                state.p1, state.p1Unit, 'pressure',
                v => setState(prev => ({ ...prev, p1: v })),
                u => setState(prev => ({ ...prev, p1Unit: u })),
              )}

              {renderInput(
                'p2',
                t('potenciaCalc.labels.p2'),
                state.p2, state.p2Unit, 'pressure',
                v => setState(prev => ({ ...prev, p2: v })),
                u => setState(prev => ({ ...prev, p2Unit: u })),
              )}
            </>
          )}

          {/* ─ Results table / info text ─ */}
          {state.results ? (
            <>
              <View
                style={[
                  styles.separator,
                  {
                    backgroundColor: themeColors.separator,
                    marginVertical: 15,
                  },
                ]}
              />
              {renderTable()}
            </>
          ) : (
            <View>
              <View
                style={[
                  styles.separator2,
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
                  {t('potenciaCalc.infoText')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── App icon ── */}
        <View style={styles.logoContainer}>
          <FastImage
            source={currentTheme === 'dark' ? logoDark : logoLight}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>
      </ScrollView>

      {/* ── Custom keyboard panel — rendered outside ScrollView ── */}
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
    backgroundColor: 'rgba(0,0,0,1)',
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
    backgroundColor: 'rgb(194,254,12)',
    marginLeft: 0,
    marginBottom: 1,
  },
  mainContainer: {
    flex: 1,
    paddingVertical: 0,
    backgroundColor: 'rgb(0,0,0)',
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
    backgroundColor: 'rgb(20,20,20)',
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
    color: 'rgb(255,255,255)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  title: {
    color: 'rgb(255,255,255)',
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
    backgroundColor: 'rgb(20,20,20)',
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
    color: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(142,142,142,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(104,104,104,0.2)',
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
    backgroundColor: 'rgb(20,20,20)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonText: {
    marginTop: 2,
    fontSize: 14,
    color: 'rgba(255,255,255,1)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  inputsSection: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  inputWrapper: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  inputLabel: {
    color: 'rgb(0,0,0)',
    marginBottom: 2,
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
  },
  redContainer: {
    backgroundColor: 'rgba(0,0,0,0)',
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
    backgroundColor: 'rgba(255,143,143,0)',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75,
    fontSize: 16,
    color: 'rgba(0,0,0,1)',
  },
  sectionSubtitle: {
    fontSize: 20,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(0,0,0)',
    marginTop: 5,
    marginBottom: 5,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235,235,235)',
    marginVertical: 10,
  },
  separator2: {
    height: 1,
    backgroundColor: 'rgb(235,235,235)',
  },
  text: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0,0,0,1)',
    marginTop: 2.75,
  },
  icon: {
    marginLeft: 'auto',
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
  // ── Table (matching DiseñoCalc) ─────────────────────────────────────────────
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
  // ── Info text ───────────────────────────────────────────────────────────────
  descriptionContainer: {
    marginVertical: 5,
    marginHorizontal: 5,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgb(170,170,170)',
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 18,
    marginBottom: 8,
  },
  // ── App logo (matching DiseñoCalc) ──────────────────────────────────────────
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
  // ── Custom keyboard ─────────────────────────────────────────────────────────
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
});

export default PotenciaCalc;