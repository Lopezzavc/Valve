import React, { useState, useRef, useContext, useCallback, useEffect, useMemo } from 'react';
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

// ─── Navigation types ────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenPerdidasLocalizadas: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  HistoryScreenPerdidasLocalizadas: undefined;
  PerdidasLocalizadasTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// ─── Domain types ─────────────────────────────────────────────────────────────
type CalculatorMode = 'normal' | 'equivalent';

interface Accessory {
  id: number;
  type: string;  // fitting label from picker
  K: string;
  // Normal mode individual velocity & gravity
  V: string;
  VUnit: string;
  prevVUnit: string;
  g: string;
  gUnit: string;
  prevGUnit: string;
  // Equivalent mode individual parameters
  f: string;
  D: string;
  DUnit: string;
  prevDUnit: string;
}

interface CalculatorState {
  mode: CalculatorMode;
  accessories: Accessory[];
}

// ─── Conversion factors (SI base) ────────────────────────────────────────────
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    m: 1,
    mm: 0.001,
    cm: 0.01,
    km: 1000,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
  },
  velocity: {
    'm/s': 1,
    'km/h': 0.2777777777777778,
    'ft/s': 0.3048,
    mph: 0.44704,
    kn: 0.5144444444444445,
    'cm/s': 0.01,
    'in/s': 0.0254,
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,
    g: 9.80665,
  },
};

// ─── Toast config (exact replica) ────────────────────────────────────────────
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
  if (hasValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ─── Main component ───────────────────────────────────────────────────────────
const PerdidasLocalizadasCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  const createNewAccessory = useCallback((): Accessory => {
    // Usar timestamp + random para garantizar unicidad
    const uniqueId = Date.now() + Math.random();
    return {
      id: uniqueId,
      type: '',
      K: '',
      V: '',
      VUnit: 'm/s',
      prevVUnit: 'm/s',
      g: '9.81',
      gUnit: 'm/s²',
      prevGUnit: 'm/s²',
      f: '',
      D: '',
      DUnit: 'm',
      prevDUnit: 'm',
    };
  }, []);

  const getInitialState = useCallback((): CalculatorState => {
    return {
      mode: 'normal',
      accessories: [createNewAccessory()],
    };
  }, [createNewAccessory]);

  // Ref con el estado actual para evitar closures obsoletas en los handlers del teclado
  const stateRef = useRef<CalculatorState>(getInitialState());

  // Ref que mapea cada fieldId al handler completo de cambio de valor
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Theme palette ──────────────────────────────────────────────────────────
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
        cardGradient2: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
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
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      cardGradient2: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
      blockInput: 'rgba(240, 240, 240, 1)',
      tableHeader: 'rgb(245,245,245)',
      tableBorder: 'rgb(220,220,220)',
    };
  }, [currentTheme]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [state, setState] = useState<CalculatorState>(getInitialState());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setActiveInputId(null);
      };
    }, [])
  );

  // ── ScrollView refs para scroll automático ─────────────────────────────────
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

  // ── Animations ─────────────────────────────────────────────────────────────
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const [buttonMetrics, setButtonMetrics] = useState<{
    normal: number;
    equivalent: number;
  }>({ normal: 0, equivalent: 0 });

  const [buttonPositions, setButtonPositions] = useState<{
    normal: number;
    equivalent: number;
  }>({ normal: 0, equivalent: 0 });

  // ── DB / favourites ────────────────────────────────────────────────────────
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
        const fav = await isFavorite(db, 'PerdidasLocalizadasCalc');
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
      const route = 'PerdidasLocalizadasCalc';
      const label =
        t('perdidasLocalizadasCalc.title') || 'Pérdidas Localizadas';
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

  // ── Mode-selector slide animation ──────────────────────────────────────────
  useEffect(() => {
    if (
      buttonMetrics.normal > 0 &&
      buttonMetrics.equivalent > 0
    ) {
      let targetX = 0;
      if (state.mode === 'normal') targetX = buttonPositions.normal;
      else if (state.mode === 'equivalent')
        targetX = buttonPositions.equivalent;

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

  // ── Utility helpers ────────────────────────────────────────────────────────
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const d = new Decimal(num);
    return d.toFixed(15).replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback(
    (value: string, fromUnit: string, toUnit: string, category: string): string => {
      const clean = value.replace(',', '.');
      if (clean === '' || isNaN(parseFloat(clean))) return value;
      const fromF = conversionFactors[category]?.[fromUnit];
      const toF = conversionFactors[category]?.[toUnit];
      if (!fromF || !toF) return value;
      return formatResult(
        new Decimal(clean).mul(fromF).div(toF).toNumber()
      );
    },
    [formatResult]
  );

  const adjustDecimalSeparator = useCallback(
    (s: string): string =>
      selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s,
    [selectedDecimalSeparator]
  );

  /** Format a string value for display in inputs (max 8 decimals, respects separator). */
  const formatDisplay = useCallback(
    (val: string): string => {
      if (!val || val === '') return val;
      const last = val.charAt(val.length - 1);
      if (last === '.' || last === ',') return val;
      const norm = val.replace(',', '.');
      const num = parseFloat(norm);
      if (isNaN(num)) return val;
      const fmt = num.toFixed(8).replace(/\.?0+$/, '');
      return selectedDecimalSeparator === 'Coma'
        ? fmt.replace('.', ',')
        : fmt;
    },
    [selectedDecimalSeparator]
  );

  // ── Reactive calculations (useMemo so table updates on every keystroke) ──
  const accessoryResults = useMemo(() => {
    return state.accessories.map((acc) => {
      try {
        const kStr = acc.K.replace(',', '.');
        const K = kStr && !isNaN(parseFloat(kStr)) ? new Decimal(kStr) : new Decimal(0);

        if (state.mode === 'equivalent') {
          const fStr = acc.f.replace(',', '.');
          const f =
            fStr && !isNaN(parseFloat(fStr))
              ? new Decimal(fStr)
              : new Decimal(0);
          const dStr = acc.D.replace(',', '.');
          const D_raw =
            dStr && !isNaN(parseFloat(dStr))
              ? new Decimal(dStr)
              : new Decimal(0);
          const D_si = D_raw.mul(conversionFactors.length[acc.DUnit] ?? 1);
          const vStr = acc.V.replace(',', '.');
          const V_raw =
            vStr && !isNaN(parseFloat(vStr))
              ? new Decimal(vStr)
              : new Decimal(0);
          const V_si = V_raw.mul(conversionFactors.velocity[acc.VUnit] ?? 1);
          const gStr = acc.g.replace(',', '.');
          const g_raw =
            gStr && !isNaN(parseFloat(gStr))
              ? new Decimal(gStr)
              : new Decimal('9.81');
          const g_si = g_raw.mul(conversionFactors.acceleration[acc.gUnit] ?? 1);

          if (f.isZero() || D_si.isZero() || g_si.isZero())
            return { hm: 0, leq: 0 };
          // L_eq = K * D / f
          const leq = K.mul(D_si).div(f);
          // h_m = f * (L_eq / D) * V² / (2g)  ≡  K * V² / (2g)
          const hm = f
            .mul(leq.div(D_si))
            .mul(V_si.pow(2))
            .div(new Decimal(2).mul(g_si));
          return {
            hm: hm.isFinite() ? hm.toNumber() : 0,
            leq: leq.isFinite() ? leq.toNumber() : 0,
          };
        } else {
          // Normal / Advanced: h_m = K * V² / (2g)
          const vStr = acc.V.replace(',', '.');
          const V_raw =
            vStr && !isNaN(parseFloat(vStr))
              ? new Decimal(vStr)
              : new Decimal(0);
          const V_si = V_raw.mul(conversionFactors.velocity[acc.VUnit] ?? 1);
          const gStr = acc.g.replace(',', '.');
          const g_raw =
            gStr && !isNaN(parseFloat(gStr))
              ? new Decimal(gStr)
              : new Decimal('9.81');
          const g_si = g_raw.mul(conversionFactors.acceleration[acc.gUnit] ?? 1);

          if (g_si.isZero()) return { hm: 0, leq: 0 };
          const hm = K.mul(V_si.pow(2)).div(new Decimal(2).mul(g_si));
          return { hm: hm.isFinite() ? hm.toNumber() : 0, leq: 0 };
        }
      } catch {
        return { hm: 0, leq: 0 };
      }
    });
  }, [state]);

  const totalHl = useMemo(
    () => accessoryResults.reduce((s, r) => s + r.hm, 0),
    [accessoryResults]
  );

  const totalLeq = useMemo(
    () =>
      state.mode === 'equivalent'
        ? accessoryResults.reduce((s, r) => s + r.leq, 0)
        : 0,
    [accessoryResults, state.mode]
  );

  // ── Navigation helper ─────────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (
      category: string,
      onSelectOption: (opt: string) => void,
      selectedOption?: string
    ) => {
      navigation.navigate('OptionsScreenPerdidasLocalizadas', {
        category,
        onSelectOption,
        selectedOption,
      });
    },
    [navigation]
  );

  // ── Accessory CRUD ────────────────────────────────────────────────────────
  const addAccessory = useCallback(() => {
    setState((prev) => ({
      ...prev,
      accessories: [...prev.accessories, createNewAccessory()],
    }));
  }, [createNewAccessory]);

  const removeAccessory = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      accessories: prev.accessories.filter((a) => a.id !== id),
    }));
  }, []);

  const updateAccessory = useCallback(
    (id: number, updates: Partial<Accessory>) => {
      setState((prev) => ({
        ...prev,
        accessories: prev.accessories.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }));
    },
    []
  );

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
    const formattedTotal = formatDisplay(formatResult(totalHl));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: `${t('perdidasLocalizadasCalc.totalLoss') || 'hL total'}: ${formattedTotal} m`,
    });
  }, [totalHl, formatResult, formatDisplay, t]);

  const handleClear = useCallback(() => {
    setState(getInitialState());
  }, [getInitialState]);

  const handleCopy = useCallback(() => {
    let text = `${t('perdidasLocalizadasCalc.title') || 'Pérdidas Localizadas'}\n`;
    text += `${t('perdidasLocalizadasCalc.modec') || 'Modo'}: ${state.mode}\n`;
    text += `hL total = ${formatResult(totalHl)} m\n\n`;

    if (state.mode === 'equivalent') {
      if (totalLeq > 0)
        text += `${t('perdidasLocalizadasCalc.table.totalLeq') || 'L_eq total'} = ${formatResult(totalLeq)} m\n\n`;
    }

    state.accessories.forEach((acc, i) => {
      const res = accessoryResults[i];
      const title = t('perdidasLocalizadasCalc.accessoryTitle') + ` ${i + 1}` || `Accesorio ${i + 1}`;
      text += `${title}: ${acc.type || '-'}\n`;
      text += `  K = ${acc.K}\n`;
      if (state.mode === 'equivalent') {
        text += `  f = ${acc.f}\n`;
        text += `  D = ${acc.D} ${acc.DUnit}\n`;
      }
      text += `  V = ${acc.V} ${acc.VUnit}\n`;
      text += `  g = ${acc.g} ${acc.gUnit}\n`;
      if (state.mode === 'equivalent')
        text += `  L_eq = ${formatResult(res.leq)} m\n`;
      text += `  h_m = ${formatResult(res.hm)} m\n\n`;
    });

    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('perdidasLocalizadasCalc.toasts.copied') || 'Copiado al portapapeles',
    });
  }, [state, accessoryResults, totalHl, totalLeq, formatResult, t]);

  const handleSaveHistory = useCallback(async () => {
    if (totalHl === 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('perdidasLocalizadasCalc.toasts.nothingToSave') || 'Nada para guardar',
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
        mode: state.mode,
        accessories: state.accessories,
        totalHl,
      };
      await saveCalculation(
        db,
        'PerdidasLocalizadas',
        JSON.stringify(inputs),
        formatResult(totalHl)
      );
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('perdidasLocalizadasCalc.toasts.saved') || 'Guardado en historial',
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('perdidasLocalizadasCalc.toasts.saveError') || 'Error al guardar',
      });
    }
  }, [state, totalHl, formatResult, t]);

  // ── Layout handlers for animated mode selector ────────────────────────────
  const onLayoutNormal = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((p) => ({ ...p, normal: x }));
    setButtonMetrics((p) => ({ ...p, normal: width }));
  }, []);

  const onLayoutEquivalent = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((p) => ({ ...p, equivalent: x }));
    setButtonMetrics((p) => ({ ...p, equivalent: width }));
  }, []);

  // ── Handlers del teclado custom ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';

    // Extraer el accessoryId y el field del formato "accessory-{id}-{field}"
    const parts = id.split('-');
    if (parts.length < 3) return '';

    const accessoryId = parseFloat(parts[1]);
    const field = parts[2] as keyof Accessory;

    const accessory = stateRef.current.accessories.find(a => a.id === accessoryId);
    if (!accessory) return '';

    return accessory[field] as string;
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

  const isKeyboardOpen = !!activeInputId;

  // ── Reusable input renderers ───────────────────────────────────────────────

  /** A plain text input with no unit button (for dimensionless fields like K, f). */
  const renderSimpleInput = useCallback(
    (label: string, value: string, fieldId: string, onChange: (t: string) => void) => {
      // Registrar el handler completo del campo en el ref para que el teclado lo use
      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
      };

      return (
        <View
          ref={(r) => { inputRefs.current[fieldId] = r; }}
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
                {
                  backgroundColor: getDotColor(
                    (value?.trim()?.length ?? 0) > 0,
                    false
                  ),
                },
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
              style={[
                styles.innerWhiteContainer,
                { backgroundColor: themeColors.card },
              ]}
            >
              <Pressable
                onPress={() => {
                  setActiveInputId(fieldId);
                }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
                value={value}
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
    [themeColors, currentTheme, fontSizeFactor, setActiveInputId]
  );

  /** An input with a unit-selector button on the right. */
  const renderInputWithUnit = useCallback(
    (
      label: string,
      value: string,
      unit: string,
      category: string,
      fieldId: string,
      onChange: (t: string) => void,
      onUnitChange: (newUnit: string, oldUnit: string) => void
    ) => {
      // Registrar el handler completo del campo en el ref para que el teclado lo use
      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
      };

      return (
        <View
          ref={(r) => { inputRefs.current[fieldId] = r; }}
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
                {
                  backgroundColor: getDotColor(
                    (value?.trim()?.length ?? 0) > 0,
                    false
                  ),
                },
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
                style={[
                  styles.innerWhiteContainer,
                  { backgroundColor: themeColors.card },
                ]}
              >
                <Pressable
                  onPress={() => {
                    setActiveInputId(fieldId);
                  }}
                  style={StyleSheet.absoluteFill}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: themeColors.text,
                      fontSize: 16 * fontSizeFactor,
                    },
                  ]}
                  value={value}
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
                  (option: string) => onUnitChange(option, unit),
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
    [themeColors, currentTheme, fontSizeFactor, navigateToOptions, setActiveInputId]
  );

  /** Fitting-type picker, styled like GeometriaSeccionesCalc's section picker. */
  const renderFittingPicker = useCallback(
    (acc: Accessory) => (
      <View style={styles.inputWrapper}>
        <Text
          style={[
            styles.inputLabel,
            { color: themeColors.text, fontSize: 16 * fontSizeFactor },
          ]}
        >
          {t('perdidasLocalizadasCalc.fittingType') || 'Tipo de accesorio'}
        </Text>
        <Pressable
          style={[
            styles.pickerPressable,
            { experimental_backgroundImage: themeColors.gradient },
          ]}
          onPress={() => {
            navigateToOptions(
              'fittingType',
              (option: string) => {
                // Convention: option can be "Label|K_value" or just "Label"
                const parts = option.split('|');
                const typeName = parts[0] ?? option;
                const kVal = parts[1] ?? '';
                updateAccessory(acc.id, {
                  type: typeName,
                  ...(kVal !== '' ? { K: kVal } : {}),
                });
              },
              acc.type
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
                styles.textOptions,
                { color: themeColors.text, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {acc.type ||
                t('perdidasLocalizadasCalc.selectFitting') ||
                'Seleccionar accesorio...'}
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
    [themeColors, fontSizeFactor, t, navigateToOptions, updateAccessory]
  );

  /** Full accessory block with all inputs and delete button. */
  const renderAccessoryBlock = useCallback(
    (acc: Accessory, index: number) => (
      <View
        key={acc.id}
        style={[
          styles.accessoryBlockMain,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View
          style={[
            styles.accessoryBlock,
            {
              backgroundColor: 'transparent',
              experimental_backgroundImage: themeColors.cardGradient2,
            },
          ]}
        >
          {/* Block header */}
          <View style={styles.accessoryHeader}>
            <Text
              style={[
                styles.accessoryTitle,
                { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
              ]}
            >
              {(t('perdidasLocalizadasCalc.accessoryTitle') || 'Accesorio') + ` ${index + 1}`}
            </Text>
            {state.accessories.length > 1 && (
              <Pressable
                onPress={() => removeAccessory(acc.id)}
                style={styles.deleteButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
              </Pressable>
            )}
          </View>

          {/* Fitting picker */}
          {renderFittingPicker(acc)}

          {/* K */}
          {renderSimpleInput(
            t('perdidasLocalizadasCalc.labels.K') || 'K',
            acc.K,
            `accessory-${acc.id}-K`,
            (text) => updateAccessory(acc.id, { K: text })
          )}

          {/* f – equivalent mode per-accessory */}
          {state.mode === 'equivalent' &&
            renderSimpleInput(
              t('perdidasLocalizadasCalc.labels.f') || 'f (factor de fricción)',
              acc.f,
              `accessory-${acc.id}-f`,
              (text) => updateAccessory(acc.id, { f: text })
            )}

          {/* D – equivalent mode per-accessory */}
          {state.mode === 'equivalent' &&
            renderInputWithUnit(
              t('perdidasLocalizadasCalc.labels.D') || 'D (diámetro)',
              acc.D,
              acc.DUnit,
              'length',
              `accessory-${acc.id}-D`,
              (text) => updateAccessory(acc.id, { D: text }),
              (newUnit, oldUnit) => {
                const converted = convertValue(acc.D, oldUnit, newUnit, 'length');
                updateAccessory(acc.id, {
                  D: converted,
                  DUnit: newUnit,
                  prevDUnit: newUnit,
                });
              }
            )}

          {/* V */}
          {renderInputWithUnit(
            t('perdidasLocalizadasCalc.labels.V') || 'V',
            acc.V,
            acc.VUnit,
            'velocity',
            `accessory-${acc.id}-V`,
            (text) => updateAccessory(acc.id, { V: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(acc.V, oldUnit, newUnit, 'velocity');
              updateAccessory(acc.id, {
                V: converted,
                VUnit: newUnit,
                prevVUnit: newUnit,
              });
            }
          )}

          {/* g */}
          {renderInputWithUnit(
            t('perdidasLocalizadasCalc.labels.g') || 'g',
            acc.g,
            acc.gUnit,
            'acceleration',
            `accessory-${acc.id}-g`,
            (text) => updateAccessory(acc.id, { g: text }),
            (newUnit, oldUnit) => {
              const converted = convertValue(acc.g, oldUnit, newUnit, 'acceleration');
              updateAccessory(acc.id, {
                g: converted,
                gUnit: newUnit,
                prevGUnit: newUnit,
              });
            }
          )}
        </View>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.accessories,
      state.mode,
      themeColors,
      fontSizeFactor,
      t,
      renderFittingPicker,
      renderSimpleInput,
      renderInputWithUnit,
      convertValue,
      updateAccessory,
      removeAccessory,
    ]
  );

  /** Dynamic results table, columns vary by mode. */
  const renderTable = useCallback(() => {
    const bc = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;

    // Shared cell helpers
    const headerCell = (
      content: string,
      flex: number,
      key: string
    ) => (
      <View
        key={key}
        style={[
          styles.tableCell,
          {
            flex,
            borderColor: bc,
            backgroundColor: hBg,
            borderBottomWidth: 1,
          },
        ]}
      >
        <Text
          style={[
            styles.tableCellHeaderText,
            {
              color: themeColors.textStrong,
              fontSize: 12 * fontSizeFactor,
            },
          ]}
          numberOfLines={1}
        >
          {content}
        </Text>
      </View>
    );

    const dataCell = (content: string, flex: number, key: string) => (
      <View
        key={key}
        style={[styles.tableCell, { flex, borderColor: bc }]}
      >
        <Text
          style={[
            styles.tableCellText,
            { color: themeColors.text, fontSize: 12 * fontSizeFactor },
          ]}
          numberOfLines={1}
        >
          {content}
        </Text>
      </View>
    );

    const fmtNum = (n: number) => {
      if (n === 0) return '-';
      const s = formatResult(n);
      // Trim to 9 significant chars for table readability
      return s.length > 9 ? s.substring(0, 9) : s;
    };

    // Column definition per mode
    // [header, flex]
    const cols: [string, number][] =
      state.mode === 'normal'
        ? [
            [t('perdidasLocalizadasCalc.table.name') || 'Accesorio', 3],
            ['K', 1],
            ['h_m (m)', 2],
            ['%', 1],
          ]
        : /* equivalent */ [
            [t('perdidasLocalizadasCalc.table.name') || 'Accesorio', 3],
            ['K', 1],
            ['L_eq (m)', 2],
            ['h_m (m)', 2],
          ];

    return (
      <View
        style={[
          styles.tableContainer,
          { borderColor: bc },
        ]}
      >
        {/* Header row */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, fl], ci) =>
            headerCell(hdr, fl, `hdr-${ci}`)
          )}
        </View>

        {/* Data rows */}
        {state.accessories.map((acc, i) => {
          const res = accessoryResults[i] ?? { hm: 0, leq: 0 };
          const pct =
            totalHl > 0 ? ((res.hm / totalHl) * 100).toFixed(1) + '%' : '-';
          const name =
          acc.type ||
          ((t('perdidasLocalizadasCalc.accessoryTitle') || 'Acc') + ` ${i + 1}`);

          const rowData: string[] =
            state.mode === 'normal'
              ? [name, acc.K || '-', fmtNum(res.hm), pct]
              : /* equivalent */ [name, acc.K || '-', fmtNum(res.leq), fmtNum(res.hm)];

          return (
            <View key={acc.id} style={styles.tableRow}>
              {cols.map(([, fl], ci) =>
                dataCell(rowData[ci] ?? '-', fl, `cell-${acc.id}-${ci}`)
              )}
            </View>
          );
        })}

        {/* Total row */}
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
          {cols.map(([, fl], ci) => {
            let content = '-';
            if (ci === 0)
              content = t('perdidasLocalizadasCalc.table.total') || 'Total';
            else if (
              state.mode === 'normal' &&
              ci === 2
            )
              content = fmtNum(totalHl);
            else if (
              state.mode === 'normal' &&
              ci === 3
            )
              content = totalHl > 0 ? '100%' : '-';
            else if (state.mode === 'equivalent' && ci === 2)
              content = fmtNum(totalLeq);
            else if (state.mode === 'equivalent' && ci === 3)
              content = fmtNum(totalHl);

            return (
              <View
                key={`total-${ci}`}
                style={[
                  styles.tableCell,
                  { flex: fl, borderColor: bc },
                ]}
              >
                <Text
                  style={[
                    ci === 0
                      ? styles.tableCellHeaderText
                      : styles.tableCellHeaderText,
                    {
                      color: themeColors.textStrong,
                      fontSize: 12 * fontSizeFactor,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {content}
                </Text>
              </View>
            );
          })}
        </View>

        {/* L_eq summary line for equivalent mode */}
        {state.mode === 'equivalent' && totalLeq > 0 && (
          <View style={styles.leqSummary}>
            <Text
              style={[
                styles.leqSummaryText,
                {
                  color: themeColors.text,
                  fontSize: 14 * fontSizeFactor,
                },
              ]}
            >
              {t('perdidasLocalizadasCalc.table.totalLeq') ||
                'Longitud equivalente total'}
              {': '}
              {formatResult(totalLeq)} m
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    state.accessories,
    state.mode,
    accessoryResults,
    totalHl,
    totalLeq,
    themeColors,
    currentTheme,
    fontSizeFactor,
    t,
    formatResult,
    formatDisplay,
  ]);

  // ── Derived values for the result panel ───────────────────────────────────
  const mainResultValue = useMemo(
    () =>
      adjustDecimalSeparator(
        formatNumber(parseFloat(formatResult(totalHl) || '0'))
      ),
    [totalHl, formatResult, formatNumber, adjustDecimalSeparator]
  );

  const getModeOverlayWidth = () => {
    if (state.mode === 'normal') return buttonMetrics.normal;
    return buttonMetrics.equivalent;
  };

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
                onPress={() => navigation.navigate('PerdidasLocalizadasTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Titles ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
            {t('perdidasLocalizadasCalc.calculator') || 'Calculadora'}
          </Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
            {t('perdidasLocalizadasCalc.title') || 'Pérdidas Localizadas'}
          </Text>
        </View>

        {/* ── Main result panel ── */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable
              style={styles.resultsContainer}
              onPress={handleSaveHistory}
            >
              <View style={styles.saveButton}>
                <Text
                  style={[
                    styles.saveButtonText,
                    { fontSize: 14 * fontSizeFactor },
                  ]}
                >
                  {t('energiaBernoulliCalc.saveToHistory') ||
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
                      {totalHl === 0
                        ? 'な'
                        : t('perdidasLocalizadasCalc.totalLoss') ||
                          'hL total (m)'}
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
          {(
            [
              {
                icon: 'terminal',
                label: t('common.calculate'),
                action: handleCalculate,
              },
              {
                icon: 'copy',
                label: t('common.copy'),
                action: handleCopy,
              },
              {
                icon: 'trash',
                label: t('common.clear'),
                action: handleClear,
              },
              {
                icon: 'clock',
                label: t('common.history'),
                action: () =>
                  navigation.navigate('HistoryScreenPerdidasLocalizadas'),
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
            }
          ]}
        >
          {/* Animated mode selector */}
          <View style={styles.buttonContainer}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  experimental_backgroundImage: themeColors.gradient,
                  width: getModeOverlayWidth(),
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
              onLayout={onLayoutNormal}
              style={[
                styles.button,
                state.mode === 'normal'
                  ? styles.selectedButton
                  : styles.unselectedButton,
              ]}
              onPress={() =>
                setState((prev) => ({ ...prev, mode: 'normal' }))
              }
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('perdidasLocalizadasCalc.mode.normal') || 'Normal'}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutEquivalent}
              style={[
                styles.button,
                state.mode === 'equivalent'
                  ? styles.selectedButton
                  : styles.unselectedButton,
              ]}
              onPress={() =>
                setState((prev) => ({ ...prev, mode: 'equivalent' }))
              }
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('perdidasLocalizadasCalc.mode.equivalent') || 'L equiv.'}
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
            {/* Accessories section header */}
            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color: themeColors.textStrong,
                  fontSize: 18 * fontSizeFactor,
                },
              ]}
            >
              {t('perdidasLocalizadasCalc.accessories') || 'Accesorios'}
            </Text>

            {/* Accessory blocks */}
            {state.accessories.map((acc, index) =>
              renderAccessoryBlock(acc, index)
            )}

            {/* Add accessory button */}
            <View style={styles.addButtonRow}>
              <Pressable style={styles.addButton} onPress={addAccessory}>
                <Icon name="plus" size={24} color="white" />
              </Pressable>
            </View>

            {/* Results table */}
            <View
              style={[
                styles.separator,
                { backgroundColor: themeColors.separator },
              ]}
            />
            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color: themeColors.textStrong,
                  fontSize: 18 * fontSizeFactor,
                },
              ]}
            >
              {t('perdidasLocalizadasCalc.tableTitle') ||
                'Tabla de resultados'}
            </Text>
            {renderTable()}
          </View>
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

// ─── Styles (exact replica of EnergiaBernoulliCalc + new table/accessory styles)
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
  // ── Input section ──────────────────────────────────────────────────────────
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
  selectedButton: { backgroundColor: 'transparent' },
  unselectedButton: { backgroundColor: 'transparent' },
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
  inputsContainer: { backgroundColor: 'transparent' },
  inputWrapper: { marginBottom: 10, backgroundColor: 'transparent' },
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
  icon: { marginLeft: 'auto' },
  // ── Accessory block ────────────────────────────────────────────────────────
  accessoryBlockMain: {
    padding: 1,
    marginBottom: 12,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  accessoryBlock: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingTop: 15,
    backgroundColor: 'transparent',
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
  // ── Add accessory button ───────────────────────────────────────────────────
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
  addButtonLabel: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 14,
  },
  // ── Table ──────────────────────────────────────────────────────────────────
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
    fontSize: 12,
  },
  tableCellText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 12,
  },
  leqSummary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leqSummaryText: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 14,
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

export default PerdidasLocalizadasCalc;