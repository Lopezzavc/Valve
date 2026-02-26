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
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
type RootStackParamList = {
  OptionsScreenFactorFriccion: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenFactorFriccion: undefined;
  FactorFriccionTheory: undefined;
  MoodyDiagramScreen: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CalculatorMode = 'numeric' | 'graphic';

type EquationType =
  | 'colebrook-white'
  | 'haaland'
  | 'swamee-jain'
  | 'churchill'
  | 'serghides'
  | 'blasius'
  | 'von-karman';

interface CalculatorState {
  mode: CalculatorMode;
  selectedEquation: EquationType;

  // Inputs
  Re: string;          // Reynolds number (dimensionless)
  epsilon: string;     // Absolute roughness ε
  diameter: string;    // Diameter D
  epsilonOverD: string; // Relative roughness ε/D

  // Units
  epsilonUnit: string;
  diameterUnit: string;

  // Previous units (for conversion)
  prevEpsilonUnit: string;
  prevDiameterUnit: string;

  // Manual edit flags
  isManualEditRe: boolean;
  isManualEditEpsilon: boolean;
  isManualEditDiameter: boolean;
  isManualEditEpsilonOverD: boolean;

  // Result
  resultPrincipal: string; // friction factor f

  // UI state
  lockedField: string | null;
  invalidFields: string[];
  autoCalculatedField: string | null;
}

// ---------------------------------------------------------------------------
// Conversion factors
// ---------------------------------------------------------------------------
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
};

// ---------------------------------------------------------------------------
// Toast config
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const initialState = (): CalculatorState => ({
  mode: 'numeric',
  selectedEquation: 'colebrook-white',

  Re: '',
  epsilon: '',
  diameter: '',
  epsilonOverD: '',

  epsilonUnit: 'mm',
  diameterUnit: 'm',

  prevEpsilonUnit: 'mm',
  prevDiameterUnit: 'm',

  isManualEditRe: false,
  isManualEditEpsilon: false,
  isManualEditDiameter: false,
  isManualEditEpsilonOverD: false,

  resultPrincipal: '',

  lockedField: null,
  invalidFields: [],
  autoCalculatedField: null,
});

// ---------------------------------------------------------------------------
// Dot color helper
// ---------------------------------------------------------------------------
const getDotColor = (
  hasUserValue: boolean,
  isInvalid: boolean,
  isAutoCalculated: boolean
): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (isAutoCalculated) return 'rgba(62, 136, 255, 1)';
  if (hasUserValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const FactorFriccionCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // Theme colors
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
        blockInput: 'rgba(30, 30, 30, 1)',
        checkboxMargin: 'rgb(255, 255, 255)',
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
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      blockInput: 'rgba(240, 240, 240, 1)',
      checkboxMargin: 'rgb(0, 0, 0)',
    };
  }, [currentTheme]);

  const [state, setState] = useState<CalculatorState>(initialState);

  // Animated values for main mode selector (2 modes)
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;

  // Heart scale for favorite animation
  const heartScale = useRef(new Animated.Value(1)).current;

  // Button metrics/positions for the two-mode selector
  const [buttonMetrics, setButtonMetrics] = useState<{ numeric: number; graphic: number }>({
    numeric: 0,
    graphic: 0,
  });
  const [buttonPositions, setButtonPositions] = useState<{ numeric: number; graphic: number }>({
    numeric: 0,
    graphic: 0,
  });

  // DB ref and favorite state
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  // Mount: connect to DB, check favorite
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
        const fav = await isFavorite(db, 'FactorFriccionCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setState(prev => ({ ...prev, mode: 'numeric' }));
    }, [])
  );

  // Toggle favorite
  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? (await getDBConnection());
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      const route = 'FactorFriccionCalc';
      const label =
        t('factorFriccionCalc.title') || 'Factor de Fricción (Darcy-Weisbach)';
      const currentlyFav = await isFavorite(db, route);
      if (currentlyFav) {
        await removeFavorite(db, route);
        setIsFav(false);
        Toast.show({
          type: 'error',
          text1: t('favorites.deleted'),
          text2: t('favorites.deletedDesc'),
        });
      } else {
        await addFavorite(db, { route, label });
        setIsFav(true);
        Toast.show({
          type: 'success',
          text1: t('favorites.success'),
          text2: t('favorites.successDesc'),
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('common.genericError'),
      });
    }
  }, [t]);

  // Bounce heart animation
  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.15,
        useNativeDriver: true,
        bounciness: 8,
        speed: 40,
      }),
      Animated.spring(heartScale, {
        toValue: 1.0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 40,
      }),
    ]).start();
  }, [heartScale]);

  // Animate mode selector sliding overlay
  useEffect(() => {
    if (buttonMetrics.numeric > 0 && buttonMetrics.graphic > 0) {
      const targetX =
        state.mode === 'numeric' ? buttonPositions.numeric : buttonPositions.graphic;
      Animated.parallel([
        Animated.spring(animatedValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedScale, {
            toValue: 1.15,
            useNativeDriver: true,
            bounciness: 5,
            speed: 50,
          }),
          Animated.spring(animatedScale, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 5,
            speed: 50,
          }),
        ]),
      ]).start();
    }
  }, [state.mode, buttonMetrics, buttonPositions]);

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const decimalNum = new Decimal(num);
    const fixed = decimalNum.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback(
    (value: string, fromUnit: string, toUnit: string, category: 'length'): string => {
      const cleanValue = value.replace(',', '.');
      if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
      const decimalValue = new Decimal(cleanValue);
      const fromFactor = conversionFactors[category]?.[fromUnit];
      const toFactor = conversionFactors[category]?.[toUnit];
      if (!fromFactor || !toFactor) return value;
      const converted = decimalValue
        .mul(new Decimal(fromFactor))
        .div(new Decimal(toFactor))
        .toNumber();
      return formatResult(converted);
    },
    [formatResult]
  );

  const adjustDecimalSeparator = useCallback(
    (formattedNumber: string): string => {
      return selectedDecimalSeparator === 'Coma'
        ? formattedNumber.replace('.', ',')
        : formattedNumber;
    },
    [selectedDecimalSeparator]
  );

  const formatDisplayValue = useCallback(
    (val: string): string => {
      if (!val || val === '') return val;
      const lastChar = val.charAt(val.length - 1);
      // Preserve if the user just typed the decimal separator (e.g. "3.")
      if (lastChar === '.' || lastChar === ',') return val;
      // Preserve if the decimal part is empty (redundant safety check)
      if (val.includes('.') && val.split('.')[1] === '') return val;
      if (val.includes(',') && val.split(',')[1] === '') return val;
      // Preserve if the decimal part consists entirely of zeros,
      // which means the user is still typing (e.g. "0.0", "0.00", "1.000").
      // Without this guard, parseFloat("0.0") → 0 → "0", erasing what was typed.
      if (val.includes('.') && /^0+$/.test(val.split('.')[1])) return val;
      if (val.includes(',') && /^0+$/.test(val.split(',')[1])) return val;
      const normalizedVal = val.replace(',', '.');
      const num = parseFloat(normalizedVal);
      if (isNaN(num)) return val;
      const formatted = num.toFixed(8).replace(/\.?0+$/, '');
      return selectedDecimalSeparator === 'Coma'
        ? formatted.replace('.', ',')
        : formatted;
    },
    [selectedDecimalSeparator]
  );

  // ---------------------------------------------------------------------------
  // Navigation to unit options
  // ---------------------------------------------------------------------------
  const navigateToOptions = useCallback(
    (
      category: string,
      onSelectOption: (opt: string) => void,
      selectedOption?: string
    ) => {
      navigation.navigate('OptionsScreenFactorFriccion', {
        category,
        onSelectOption,
        selectedOption,
      });
    },
    [navigation]
  );

  // ---------------------------------------------------------------------------
  // Locked field logic for ε/D interaction
  // ---------------------------------------------------------------------------
  // Rules:
  // - If ε and D are both filled → lock epsilonOverD (will be auto-calculated on Calculate)
  // - If epsilonOverD is filled → lock ε and D
  // - Otherwise → all editable
  const getLockedFieldForEpsilonD = useCallback((): string | null => {
    const hasEpsilon =
      state.epsilon.trim() !== '' &&
      !isNaN(parseFloat(state.epsilon.replace(',', '.')));
    const hasDiameter =
      state.diameter.trim() !== '' &&
      !isNaN(parseFloat(state.diameter.replace(',', '.')));
    const hasEpsilonOverD =
      state.epsilonOverD.trim() !== '' &&
      !isNaN(parseFloat(state.epsilonOverD.replace(',', '.')));

    if (hasEpsilon && hasDiameter && !hasEpsilonOverD) {
      return 'epsilonOverD';
    }
    if (hasEpsilonOverD && (!hasEpsilon || !hasDiameter)) {
      return 'epsilonAndDiameter';
    }
    return null;
  }, [state.epsilon, state.diameter, state.epsilonOverD]);

  // ---------------------------------------------------------------------------
  // Determine effective ε/D value in SI (dimensionless)
  // Returns null if cannot determine
  // ---------------------------------------------------------------------------
  const getEffectiveEpsilonOverD = useCallback((): Decimal | null => {
    const lockedEpsD = getLockedFieldForEpsilonD();

    // If epsilonOverD is directly provided and ε/D is the main input
    if (lockedEpsD === 'epsilonAndDiameter') {
      const rawEoD = state.epsilonOverD.replace(',', '.');
      if (!rawEoD || isNaN(parseFloat(rawEoD))) return null;
      return new Decimal(rawEoD);
    }

    // Calculate ε/D from ε and D
    if (state.epsilon.trim() !== '' && state.diameter.trim() !== '') {
      const rawEps = state.epsilon.replace(',', '.');
      const rawD = state.diameter.replace(',', '.');
      if (isNaN(parseFloat(rawEps)) || isNaN(parseFloat(rawD))) return null;

      const epsNum = new Decimal(rawEps);
      const dNum = new Decimal(rawD);

      const epsFactor = conversionFactors.length[state.epsilonUnit] ?? 1;
      const dFactor = conversionFactors.length[state.diameterUnit] ?? 1;

      const epsSI = epsNum.mul(new Decimal(epsFactor));
      const dSI = dNum.mul(new Decimal(dFactor));

      if (dSI.isZero()) return null;
      return epsSI.div(dSI);
    }

    // If epsilonOverD has a direct value
    if (state.epsilonOverD.trim() !== '') {
      const rawEoD = state.epsilonOverD.replace(',', '.');
      if (isNaN(parseFloat(rawEoD))) return null;
      return new Decimal(rawEoD);
    }

    return null;
  }, [
    state.epsilon,
    state.diameter,
    state.epsilonOverD,
    state.epsilonUnit,
    state.diameterUnit,
    getLockedFieldForEpsilonD,
  ]);

  // ---------------------------------------------------------------------------
  // Calculation functions (Decimal.js)
  // ---------------------------------------------------------------------------

  // Haaland – used as initial guess for iterative methods
  const calcHaaland = (Re: Decimal, eoD: Decimal): Decimal => {
    // 1/sqrt(f) = -1.8 * log10( ((ε/D)/3.7)^1.11 + 6.9/Re )
    const term1 = eoD.div(3.7).pow(new Decimal('1.11'));
    const term2 = new Decimal('6.9').div(Re);
    const inner = term1.plus(term2);
    if (inner.lte(0)) throw new Error('Invalid Haaland argument');
    const log10 = Decimal.log10(inner);
    const invSqrtF = new Decimal('-1.8').mul(log10);
    if (invSqrtF.isZero()) throw new Error('Division by zero in Haaland');
    return new Decimal(1).div(invSqrtF.pow(2));
  };

  const calcColebrookWhite = useCallback(
    (Re: Decimal, eoD: Decimal): Decimal => {
      // Iterative: 1/sqrt(f) = -2 * log10( (ε/D)/3.7 + 2.51/(Re*sqrt(f)) )
      // Start with Haaland guess
      let f: Decimal;
      try {
        f = calcHaaland(Re, eoD);
      } catch {
        f = new Decimal('0.02');
      }

      const tol = new Decimal('1e-20');
      for (let i = 0; i < 200; i++) {
        const sqrtF = f.sqrt();
        const term1 = eoD.div(new Decimal('3.7'));
        const term2 = new Decimal('2.51').div(Re.mul(sqrtF));
        const inner = term1.plus(term2);
        if (inner.lte(0)) break;
        const invSqrtF = new Decimal('-2').mul(Decimal.log10(inner));
        const fNew = new Decimal(1).div(invSqrtF.pow(2));
        if (fNew.minus(f).abs().lte(tol)) {
          return fNew;
        }
        f = fNew;
      }
      return f;
    },
    []
  );

  const calcSwameeJain = useCallback((Re: Decimal, eoD: Decimal): Decimal => {
    // f = 0.25 / [log10(ε/D/3.7 + 5.74/Re^0.9)]^2
    const term1 = eoD.div(new Decimal('3.7'));
    const term2 = new Decimal('5.74').div(Re.pow(new Decimal('0.9')));
    const inner = term1.plus(term2);
    if (inner.lte(0)) throw new Error('Invalid Swamee-Jain argument');
    const log10 = Decimal.log10(inner);
    return new Decimal('0.25').div(log10.pow(2));
  }, []);

  const calcChurchill = useCallback((Re: Decimal, eoD: Decimal): Decimal => {
    // A = (-2.457 * ln((7/Re)^0.9 + 0.27*eoD))^16
    // B = (37530/Re)^16
    // f = 8 * ((8/Re)^12 + 1/(A+B)^(3/2))^(1/12)
    const innerA = new Decimal(7)
      .div(Re)
      .pow(new Decimal('0.9'))
      .plus(new Decimal('0.27').mul(eoD));
    if (innerA.lte(0)) throw new Error('Invalid Churchill argument (A)');
    const lnInnerA = Decimal.ln(innerA);
    const A = new Decimal('-2.457').mul(lnInnerA).pow(16);
    const B = new Decimal(37530).div(Re).pow(16);
    const AplusB = A.plus(B);
    const term1 = new Decimal(8).div(Re).pow(12);
    const term2 = new Decimal(1).div(AplusB.pow(new Decimal('1.5')));
    return new Decimal(8).mul(term1.plus(term2).pow(new Decimal(1).div(12)));
  }, []);

  const calcSerghides = useCallback((Re: Decimal, eoD: Decimal): Decimal => {
    const base = eoD.div(new Decimal('3.7'));
    const A = new Decimal('-2').mul(
      Decimal.log10(base.plus(new Decimal(12).div(Re)))
    );
    const B = new Decimal('-2').mul(
      Decimal.log10(base.plus(new Decimal('2.51').mul(A).div(Re)))
    );
    const C = new Decimal('-2').mul(
      Decimal.log10(base.plus(new Decimal('2.51').mul(B).div(Re)))
    );
    const BminusA = B.minus(A);
    const denom = C.minus(B.mul(2)).plus(A);
    if (denom.isZero()) throw new Error('Division by zero in Serghides');
    const f_inv = A.minus(BminusA.pow(2).div(denom));
    return f_inv.pow(new Decimal('-2'));
  }, []);

  const calcBlasius = useCallback((Re: Decimal): Decimal => {
    // f = 0.316 / Re^0.25
    return new Decimal('0.316').div(Re.pow(new Decimal('0.25')));
  }, []);

  const calcVonKarman = useCallback((eoD: Decimal): Decimal => {
    // f = 1 / (-2 * log10(eoD/3.7))^2
    const inner = eoD.div(new Decimal('3.7'));
    if (inner.lte(0)) throw new Error('Invalid von Karman argument');
    const invSqrtF = new Decimal('-2').mul(Decimal.log10(inner));
    return new Decimal(1).div(invSqrtF.pow(2));
  }, []);

  // ---------------------------------------------------------------------------
  // Handle Calculate
  // ---------------------------------------------------------------------------
  const handleCalculate = useCallback(() => {
    if (state.mode !== 'numeric') return;

    const eq = state.selectedEquation;
    const newInvalidFields: string[] = [];

    // Parse Re
    let Re: Decimal | null = null;
    if (eq !== 'von-karman') {
      const rawRe = state.Re.replace(',', '.');
      if (!rawRe || isNaN(parseFloat(rawRe))) {
        newInvalidFields.push('Re');
      } else {
        Re = new Decimal(rawRe);
      }
    }

    // Determine ε/D
    let eoD: Decimal | null = null;
    let autoCalcEoD = false;
    let calcedEoDValue = '';

    if (eq !== 'blasius') {
      eoD = getEffectiveEpsilonOverD();
      if (eoD === null) {
        // Need at least ε/D or (ε and D)
        const hasEps =
          state.epsilon.trim() !== '' &&
          !isNaN(parseFloat(state.epsilon.replace(',', '.')));
        const hasD =
          state.diameter.trim() !== '' &&
          !isNaN(parseFloat(state.diameter.replace(',', '.')));
        const hasEoD =
          state.epsilonOverD.trim() !== '' &&
          !isNaN(parseFloat(state.epsilonOverD.replace(',', '.')));

        if (!hasEoD) {
          if (!hasEps) newInvalidFields.push('epsilon');
          if (!hasD) newInvalidFields.push('diameter');
          if (!hasEps || !hasD) newInvalidFields.push('epsilonOverD');
        }
      } else {
        // Check if we need to auto-calc ε/D from ε and D
        const lockedEpsD = getLockedFieldForEpsilonD();
        if (lockedEpsD === 'epsilonOverD') {
          autoCalcEoD = true;
          calcedEoDValue = formatResult(eoD.toNumber());
        }
      }
    }

    if (newInvalidFields.length > 0) {
      setState(prev => ({
        ...prev,
        invalidFields: newInvalidFields,
        resultPrincipal: '',
        autoCalculatedField: null,
      }));
      return;
    }

    try {
      let f: Decimal;

      // Validity warnings
      if (eq === 'swamee-jain' && eoD && Re) {
        const eoDNum = eoD.toNumber();
        const ReNum = Re.toNumber();
        if (
          eoDNum < 1e-6 ||
          eoDNum > 1e-2 ||
          ReNum < 5000 ||
          ReNum > 1e8
        ) {
          Toast.show({
            type: 'error',
            text1: t('factorFriccionCalc.toasts.validityWarning') || 'Advertencia',
            text2:
              t('factorFriccionCalc.toasts.swameeJainRange') ||
              'Swamee-Jain: 10⁻⁶ ≤ ε/D ≤ 10⁻², 5000 ≤ Re ≤ 10⁸',
          });
        }
      }

      if (eq === 'blasius' && Re) {
        const ReNum = Re.toNumber();
        if (ReNum < 4000 || ReNum > 1e5) {
          Toast.show({
            type: 'error',
            text1: t('factorFriccionCalc.toasts.validityWarning') || 'Advertencia',
            text2:
              t('factorFriccionCalc.toasts.blasiusRange') ||
              'Blasius: 4000 ≤ Re ≤ 10⁵ (tubería lisa)',
          });
        }
      }

      switch (eq) {
        case 'colebrook-white':
          f = calcColebrookWhite(Re!, eoD!);
          break;
        case 'haaland':
          f = calcHaaland(Re!, eoD!);
          break;
        case 'swamee-jain':
          f = calcSwameeJain(Re!, eoD!);
          break;
        case 'churchill':
          f = calcChurchill(Re!, eoD!);
          break;
        case 'serghides':
          f = calcSerghides(Re!, eoD!);
          break;
        case 'blasius':
          f = calcBlasius(Re!);
          break;
        case 'von-karman':
          f = calcVonKarman(eoD!);
          break;
        default:
          throw new Error('Unknown equation');
      }

      if (isNaN(f.toNumber()) || !isFinite(f.toNumber())) {
        throw new Error('Result is NaN or Infinity');
      }

      setState(prev => ({
        ...prev,
        resultPrincipal: formatResult(f.toNumber()),
        invalidFields: [],
        autoCalculatedField: autoCalcEoD ? 'epsilonOverD' : null,
        epsilonOverD: autoCalcEoD ? calcedEoDValue : prev.epsilonOverD,
        isManualEditEpsilonOverD: autoCalcEoD ? false : prev.isManualEditEpsilonOverD,
      }));
    } catch (err) {
      console.error('Error en cálculo del factor de fricción:', err);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('factorFriccionCalc.toasts.calculationError') || 'Error en el cálculo',
      });
      setState(prev => ({
        ...prev,
        resultPrincipal: '',
        invalidFields: [],
        autoCalculatedField: null,
      }));
    }
  }, [
    state,
    getEffectiveEpsilonOverD,
    getLockedFieldForEpsilonD,
    formatResult,
    calcColebrookWhite,
    calcSwameeJain,
    calcChurchill,
    calcSerghides,
    calcBlasius,
    calcVonKarman,
    t,
  ]);

  // ---------------------------------------------------------------------------
  // Handle Clear
  // ---------------------------------------------------------------------------
  const handleClear = useCallback(() => {
    const currentMode = state.mode;
    const currentEq = state.selectedEquation;
    setState({
      ...initialState(),
      mode: currentMode,
      selectedEquation: currentEq,
    });
  }, [state.mode, state.selectedEquation]);

  // ---------------------------------------------------------------------------
  // Handle Copy
  // ---------------------------------------------------------------------------
  const handleCopy = useCallback(() => {
    let text = '';
    const eqName =
      t(`factorFriccionCalc.equations.${state.selectedEquation}`) ||
      state.selectedEquation;
    text += `${t('factorFriccionCalc.title') || 'Factor de Fricción'}\n`;
    text += `${t('factorFriccionCalc.equation') || 'Ecuación'}: ${eqName}\n`;
    text += `f = ${state.resultPrincipal || '—'}\n\n`;

    if (state.Re) text += `Re: ${state.Re}\n`;
    if (state.epsilon)
      text += `ε: ${state.epsilon} ${state.epsilonUnit}\n`;
    if (state.diameter)
      text += `D: ${state.diameter} ${state.diameterUnit}\n`;
    if (state.epsilonOverD)
      text += `ε/D: ${state.epsilonOverD}\n`;

    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('factorFriccionCalc.toasts.copied') || 'Copiado al portapapeles',
    });
  }, [state, t]);

  // ---------------------------------------------------------------------------
  // Handle Save History
  // ---------------------------------------------------------------------------
  const handleSaveHistory = useCallback(async () => {
    if (!state.resultPrincipal) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2:
          t('factorFriccionCalc.toasts.nothingToSave') || 'No hay resultados para guardar',
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
        selectedEquation: state.selectedEquation,
        Re: state.Re,
        epsilon: state.epsilon,
        epsilonUnit: state.epsilonUnit,
        diameter: state.diameter,
        diameterUnit: state.diameterUnit,
        epsilonOverD: state.epsilonOverD,
      };
      await saveCalculation(
        db,
        `FactorFriccion_${state.selectedEquation}`,
        JSON.stringify(inputs),
        state.resultPrincipal
      );
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('factorFriccionCalc.toasts.saved') || 'Guardado en el historial',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2:
          t('factorFriccionCalc.toasts.saveError') || 'Error al guardar',
      });
    }
  }, [state, t]);

  // ---------------------------------------------------------------------------
  // renderInput
  // ---------------------------------------------------------------------------
  const renderInput = useCallback(
    (
      label: string,
      value: string,
      onChange: (text: string) => void,
      setManualEdit: (val: boolean) => void,
      fieldId: string,
      resultValue?: string,
      shownLabel?: string,
      unit?: string,
      isNoUnit?: boolean
    ) => {
      const lockedEpsD = getLockedFieldForEpsilonD();
      let isFieldLocked = false;

      if (lockedEpsD === 'epsilonOverD' && fieldId === 'epsilonOverD') {
        isFieldLocked = true;
      } else if (
        lockedEpsD === 'epsilonAndDiameter' &&
        (fieldId === 'epsilon' || fieldId === 'diameter')
      ) {
        isFieldLocked = true;
      }

      const inputContainerBg = isFieldLocked
        ? themeColors.blockInput
        : themeColors.card;
      const hasUserValue = (value?.trim()?.length ?? 0) > 0;
      const isInvalid = state.invalidFields.includes(fieldId);
      const isAutoCalculated =
        state.autoCalculatedField === fieldId &&
        !!(resultValue && resultValue !== '');
      const dotColor = getDotColor(hasUserValue, isInvalid, isAutoCalculated);

      const handleTextChange = (text: string) => {
        onChange(text);
        setManualEdit(true);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== fieldId),
          autoCalculatedField:
            prev.autoCalculatedField === fieldId
              ? null
              : prev.autoCalculatedField,
        }));
      };

      const rawDisplayValue =
        resultValue && resultValue !== '' ? resultValue : value;
      const displayValue = formatDisplayValue(rawDisplayValue);

      return (
        <View style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.inputLabel,
                { color: themeColors.text, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {shownLabel || label}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
          </View>
          <View style={styles.redContainer}>
            <View
              style={[
                isNoUnit ? styles.ContainerFull : styles.Container,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            >
              <View
                style={[
                  styles.innerWhiteContainer,
                  { backgroundColor: inputContainerBg },
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                  keyboardType="numeric"
                  value={displayValue}
                  onChangeText={handleTextChange}
                  onBlur={() => {
                    if (value && value !== '') {
                      const formatted = formatDisplayValue(value);
                      if (formatted !== value) onChange(formatted);
                    }
                  }}
                  editable={!isFieldLocked}
                  selectTextOnFocus={!isFieldLocked}
                  placeholderTextColor={
                    currentTheme === 'dark'
                      ? 'rgba(255,255,255,0.35)'
                      : 'rgba(0,0,0,0.35)'
                  }
                />
              </View>
            </View>
            {!isNoUnit && unit && (
              <Pressable
                style={[
                  styles.Container2,
                  { experimental_backgroundImage: themeColors.gradient },
                ]}
                onPress={() => {
                  navigateToOptions(
                    'length',
                    (option: string) => {
                      if (fieldId === 'epsilon') {
                        const converted = convertValue(
                          value,
                          state.epsilonUnit,
                          option,
                          'length'
                        );
                        setState(prev => ({
                          ...prev,
                          epsilon: converted,
                          epsilonUnit: option,
                          prevEpsilonUnit: option,
                        }));
                      } else if (fieldId === 'diameter') {
                        const converted = convertValue(
                          value,
                          state.diameterUnit,
                          option,
                          'length'
                        );
                        setState(prev => ({
                          ...prev,
                          diameter: converted,
                          diameterUnit: option,
                          prevDiameterUnit: option,
                        }));
                      }
                    },
                    unit
                  );
                }}
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
                      {
                        color: themeColors.text,
                        fontSize: 16 * fontSizeFactor,
                      },
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
            )}
          </View>
        </View>
      );
    },
    [
      state,
      themeColors,
      currentTheme,
      fontSizeFactor,
      convertValue,
      navigateToOptions,
      formatDisplayValue,
      getLockedFieldForEpsilonD,
    ]
  );

  // ---------------------------------------------------------------------------
  // Layout handlers for mode selector
  // ---------------------------------------------------------------------------
  const onLayoutNumeric = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions(prev => ({ ...prev, numeric: x }));
    setButtonMetrics(prev => ({ ...prev, numeric: width }));
  }, []);

  const onLayoutGraphic = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions(prev => ({ ...prev, graphic: x }));
    setButtonMetrics(prev => ({ ...prev, graphic: width }));
  }, []);

  // ---------------------------------------------------------------------------
  // Equation picker
  // ---------------------------------------------------------------------------
  const equationOptions: { value: EquationType; labelKey: string }[] = [
    {
      value: 'colebrook-white',
      labelKey: 'factorFriccionCalc.equations.colebrook-white',
    },
    { value: 'haaland', labelKey: 'factorFriccionCalc.equations.haaland' },
    {
      value: 'swamee-jain',
      labelKey: 'factorFriccionCalc.equations.swamee-jain',
    },
    { value: 'churchill', labelKey: 'factorFriccionCalc.equations.churchill' },
    { value: 'serghides', labelKey: 'factorFriccionCalc.equations.serghides' },
    { value: 'blasius', labelKey: 'factorFriccionCalc.equations.blasius' },
    { value: 'von-karman', labelKey: 'factorFriccionCalc.equations.von-karman' },
  ];

  const getEquationDisplayName = (eq: EquationType): string => {
    const found = equationOptions.find(o => o.value === eq);
    if (!found) return eq;
    return t(found.labelKey) || found.value;
  };

  const renderEquationPicker = useCallback(
    () => (
      <View style={styles.inputWrapper}>
        <Text
          style={[
            styles.inputLabel,
            { color: themeColors.text, fontSize: 16 * fontSizeFactor },
          ]}
        >
          {t('factorFriccionCalc.labels.equation') || 'Ecuación'}
        </Text>
        <Pressable
          style={[
            styles.pickerPressable,
            { experimental_backgroundImage: themeColors.gradient },
          ]}
          onPress={() => {
            navigation.navigate('OptionsScreenFactorFriccion', {
              category: 'equation',
              onSelectOption: (option: string) => {
                setState(prev => ({
                  ...prev,
                  selectedEquation: option as EquationType,
                  resultPrincipal: '',
                  invalidFields: [],
                  autoCalculatedField: null,
                }));
              },
              selectedOption: state.selectedEquation,
            });
          }}
        >
          <View
            style={[
              styles.innerWhiteContainer2,
              { backgroundColor: themeColors.card },
            ]}
          >
            <Text
              style={[
                styles.textOptions,
                { color: themeColors.text, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {getEquationDisplayName(state.selectedEquation)}
            </Text>
            <Icon
              name="chevron-down"
              size={20}
              color={themeColors.icon}
              style={styles.icon}
            />
          </View>
        </Pressable>
      </View>
    ),
    [themeColors, t, fontSizeFactor, state.selectedEquation, navigation]
  );

  // ---------------------------------------------------------------------------
  // Render dynamic inputs based on selected equation
  // ---------------------------------------------------------------------------
  const needsRe = state.selectedEquation !== 'von-karman';
  const needsEpsilonD =
    state.selectedEquation !== 'blasius';

  const autoCalcEoDResult =
    state.autoCalculatedField === 'epsilonOverD' ? state.epsilonOverD : undefined;

  const renderNumericInputs = useCallback(
    () => (
      <>
        {/* Equation picker */}
        {renderEquationPicker()}

        <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

        {/* Re */}
        {needsRe &&
          renderInput(
            'Re',
            state.Re,
            text => setState(prev => ({ ...prev, Re: text })),
            val => setState(prev => ({ ...prev, isManualEditRe: val })),
            'Re',
            undefined,
            t('factorFriccionCalc.labels.Re') || 'Número de Reynolds (Re)',
            undefined,
            true // no unit
          )}

        {/* Epsilon / D section */}
        {needsEpsilonD && (
          <>
            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
            <Text
              style={[
                styles.sectionSubtitle,
                { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
              ]}
            >
              {t('factorFriccionCalc.roughnessSection') || 'Rugosidad relativa'}
            </Text>

            {/* ε */}
            {renderInput(
              'ε',
              state.epsilon,
              text => setState(prev => ({ ...prev, epsilon: text })),
              val => setState(prev => ({ ...prev, isManualEditEpsilon: val })),
              'epsilon',
              undefined,
              t('factorFriccionCalc.labels.epsilon') || 'Rugosidad absoluta (ε)',
              state.epsilonUnit
            )}

            {/* D */}
            {renderInput(
              'D',
              state.diameter,
              text => setState(prev => ({ ...prev, diameter: text })),
              val => setState(prev => ({ ...prev, isManualEditDiameter: val })),
              'diameter',
              undefined,
              t('factorFriccionCalc.labels.diameter') || 'Diámetro (D)',
              state.diameterUnit
            )}

            {/* ε/D */}
            {renderInput(
              'ε/D',
              state.epsilonOverD,
              text => setState(prev => ({ ...prev, epsilonOverD: text })),
              val =>
                setState(prev => ({
                  ...prev,
                  isManualEditEpsilonOverD: val,
                })),
              'epsilonOverD',
              autoCalcEoDResult,
              t('factorFriccionCalc.labels.epsilonOverD') || 'Rugosidad relativa (ε/D)',
              undefined,
              true // no unit
            )}
          </>
        )}
      </>
    ),
    [
      renderEquationPicker,
      renderInput,
      state,
      themeColors,
      t,
      fontSizeFactor,
      needsRe,
      needsEpsilonD,
      autoCalcEoDResult,
    ]
  );

  // ---------------------------------------------------------------------------
  // Main result display helpers
  // ---------------------------------------------------------------------------
  const getMainResultValue = useCallback(() => {
    return state.resultPrincipal || '0';
  }, [state.resultPrincipal]);

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.safeArea}>
      <KeyboardAwareScrollView
        bottomOffset={50}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
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
                    color={
                      isFav ? 'rgba(255, 63, 63, 1)' : 'rgb(255, 255, 255)'
                    }
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
                onPress={() => navigation.navigate('FactorFriccionTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('factorFriccionCalc.calculator') || 'Calculadora'}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('factorFriccionCalc.title') || 'Factor de Fricción'}
          </Text>
        </View>

        {/* ── Main Result Panel ── */}
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
                  {t('factorFriccionCalc.saveToHistory') ||
                    t('energiaBernoulliCalc.saveToHistory') ||
                    'Guardar en historial'}
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
                        ...(StyleSheet.absoluteFillObject as any),
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
                      {state.resultPrincipal
                        ? t('factorFriccionCalc.frictionFactor') || 'f'
                        : 'な'}
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
                      {adjustDecimalSeparator(
                        formatNumber(parseFloat(getMainResultValue()))
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.buttonsContainer}>
          {[
            {
              icon: 'terminal',
              label: t('common.calculate') || 'Calcular',
              action: handleCalculate,
            },
            {
              icon: 'copy',
              label: t('common.copy') || 'Copiar',
              action: handleCopy,
            },
            {
              icon: 'trash',
              label: t('common.clear') || 'Limpiar',
              action: handleClear,
            },
            {
              icon: 'clock',
              label: t('common.history') || 'Historial',
              action: () => navigation.navigate('HistoryScreenFactorFriccion'),
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

        {/* ── Inputs Section ── */}
        <View
          style={[styles.inputsSection, { backgroundColor: themeColors.card }]}
        >
          {/* Mode selector */}
          <View style={styles.buttonContainer}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  experimental_backgroundImage: themeColors.gradient,
                  width:
                    state.mode === 'numeric'
                      ? buttonMetrics.numeric
                      : buttonMetrics.graphic,
                  transform: [
                    { translateX: animatedValue },
                    { scale: animatedScale },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.overlayInner,
                  { backgroundColor: themeColors.card },
                ]}
              />
            </Animated.View>

            <Pressable
              onLayout={onLayoutNumeric}
              style={[
                styles.button,
                state.mode === 'numeric'
                  ? styles.selectedButton
                  : styles.unselectedButton,
              ]}
              onPress={() =>
                setState(prev => ({ ...prev, mode: 'numeric' }))
              }
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('factorFriccionCalc.mode.numeric') || 'Numérico'}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutGraphic}
              style={[
                styles.button,
                state.mode === 'graphic'
                  ? styles.selectedButton
                  : styles.unselectedButton,
              ]}
              onPress={() => {
                setState(prev => ({ ...prev, mode: 'graphic' }));
                setTimeout(() => {
                  navigation.navigate('MoodyDiagramScreen');
                }, 300);
              }}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('factorFriccionCalc.mode.graphic') || 'Gráfico'}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.separator2,
              { backgroundColor: themeColors.separator },
            ]}
          />

          <View style={styles.inputsContainer}>
            {state.mode === 'numeric' && renderNumericInputs()}
            {state.mode === 'graphic' && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                >
                  {t('factorFriccionCalc.moodyDiagramHint') ||
                    'Abriendo diagrama de Moody…'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles (pixel-perfect copy of EnergiaBernoulliCalc)
// ---------------------------------------------------------------------------
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
    marginTop: -10,
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
    marginBottom: 16,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    marginHorizontal: 5,
    height: 50,
    zIndex: 2,
  },
  selectedButton: {
    backgroundColor: 'transparent',
  },
  unselectedButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: 'rgb(0,0,0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    height: 50,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    zIndex: 0,
    padding: 1,
  },
  overlayInner: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 25,
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
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    width: '68%',
  },
  ContainerFull: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    flex: 1,
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
  pickerPressable: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
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
    marginBottom: 10,
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
});

export default FactorFriccionCalc;