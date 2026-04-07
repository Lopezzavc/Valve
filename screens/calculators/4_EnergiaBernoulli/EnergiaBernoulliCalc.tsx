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
import { CalculatorOptionsScreenParams, buildCalculatorOptionsParams } from '../../01_options/optionsConfig';
import { UNIT_FACTORS } from '../../01_options/unitCatalog';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import Decimal from 'decimal.js';
import { getDBConnection, createTable, saveCalculation, createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';
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
const logoDark = require('../../../assets/icon/iconwhite.webp');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

const DECIMAL_ZERO = new Decimal('0');
const DECIMAL_ONE = new Decimal('1');
const DECIMAL_TWO = new Decimal('2');
const DECIMAL_THREE = new Decimal('3');
const DECIMAL_FOUR = new Decimal('4');
const DECIMAL_FIVE = new Decimal('5');
const DECIMAL_NINE = new Decimal('9');
const DECIMAL_TEN = new Decimal('10');
const DECIMAL_HALF = new Decimal('0.5');
const DECIMAL_THIRTY_TWO = new Decimal('32');
const DECIMAL_KELVIN_OFFSET = new Decimal('273.15');
const DECIMAL_DEFAULT_G = new Decimal('9.81');
const DECIMAL_DEFAULT_G_LOSSES = new Decimal('9.807');
const DECIMAL_DEFAULT_GAMMA = new Decimal('9810');
const DECIMAL_TEMP_MIN_C = new Decimal('0');
const DECIMAL_TEMP_MAX_C = new Decimal('374');

// Tipos de rutas disponibles desde esta pantalla
type RootStackParamList = {
  [key: string]: object | undefined;
  CalculatorOptionsScreen: CalculatorOptionsScreenParams;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

type CalculatorMode = 'ideal' | 'losses' | 'cavitation';

interface CalculatorState {
  mode: CalculatorMode;

  P1: string;
  P2: string;
  z1: string;
  z2: string;
  V1: string;
  V2: string;
  D1: string;
  D2: string;
  rho: string;
  gamma: string;
  g: string;
  alpha1: string;
  alpha2: string;
  hb: string;
  ht: string;
  includeBomba: boolean;
  includeTurbina: boolean;

  lossInputType: 'direct' | 'darcy';
  hL: string;
  L: string;
  f: string;
  K: string;

  cavitationSystemType: 'closed' | 'open';
  Ps: string;
  Vs: string;
  Patm: string;
  z0: string;
  zs: string;
  hfs: string;
  temperatura: string;
  Pv: string;
  useRhoForGamma: boolean;
  useTempForPv: boolean;

  P1Unit: string;
  P2Unit: string;
  z1Unit: string;
  z2Unit: string;
  V1Unit: string;
  V2Unit: string;
  D1Unit: string;
  D2Unit: string;
  rhoUnit: string;
  gammaUnit: string;
  gUnit: string;
  hbUnit: string;
  htUnit: string;
  hLUnit: string;
  LUnit: string;
  PsUnit: string;
  VsUnit: string;
  PatmUnit: string;
  z0Unit: string;
  zsUnit: string;
  hfsUnit: string;
  temperaturaUnit: string;
  PvUnit: string;

  prevP1Unit: string;
  prevP2Unit: string;
  prevZ1Unit: string;
  prevZ2Unit: string;
  prevV1Unit: string;
  prevV2Unit: string;
  prevD1Unit: string;
  prevD2Unit: string;
  prevRhoUnit: string;
  prevGammaUnit: string;
  prevGUnit: string;
  prevHbUnit: string;
  prevHtUnit: string;
  prevHLUnit: string;
  prevLUnit: string;
  prevPsUnit: string;
  prevVsUnit: string;
  prevPatmUnit: string;
  prevZ0Unit: string;
  prevZsUnit: string;
  prevHfsUnit: string;
  prevTemperaturaUnit: string;
  prevPvUnit: string;

  resultTotalEnergy: string;
  resultP1: string;
  resultV1: string;
  resultZ1: string;
  resultP2: string;
  resultV2: string;
  resultZ2: string;
  resultNPSHa: string;
  resultCavitationMargin: string;
  resultPabs: string;
  resultGamma: string;
  resultPv: string;
  resultAlpha2?: string;

  isManualEditP1: boolean;
  isManualEditP2: boolean;
  isManualEditz1: boolean;
  isManualEditz2: boolean;
  isManualEditV1: boolean;
  isManualEditV2: boolean;
  isManualEditL: boolean;
  isManualEditD1: boolean;
  isManualEditF: boolean;
  isManualEditK: boolean;
  isManualEditD2: boolean;
  isManualEditHb: boolean;
  isManualEditHt: boolean;
  isManualEditHL: boolean;
  isManualEditAlpha1: boolean;
  isManualEditAlpha2: boolean;
  isManualEditPs: boolean;
  isManualEditVs: boolean;
  isManualEditPatm: boolean;
  isManualEditz0: boolean;
  isManualEditzs: boolean;
  isManualEdithfs: boolean;

  unknownVariable: {
    name: string;
    label: string;
    unit: string;
    value: string;
  } | null;

  lockedField: string | null;
  invalidFields: string[];
  autoCalculatedField: string | null;
}

// Factores de conversión a unidades SI agrupados por categoría de magnitud física
const conversionFactors = UNIT_FACTORS;


const isValidDecimalString = (val: string): boolean => {
  if (!val || val.trim() === '') return false;
  try {
    new Decimal(val.replace(',', '.'));
    return true;
  } catch {
    return false;
  }
};

const getConversionFactor = (
  category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight',
  unit: string
): Decimal => {
  const factor = conversionFactors[category]?.[unit];
  if (factor === undefined) {
    throw new Error(`Unidad no reconocida: "${unit}" en categoría "${category}"`);
  }
  return new Decimal(factor);
};

// Categoría y unidad base en SI para cada campo del formulario
const fieldConfigs: { [key: string]: { category: string; unit: string } } = {
  P1: { category: 'pressure', unit: 'Pa' },
  z1: { category: 'length', unit: 'm' },
  V1: { category: 'velocity', unit: 'm/s' },
  P2: { category: 'pressure', unit: 'Pa' },
  z2: { category: 'length', unit: 'm' },
  V2: { category: 'velocity', unit: 'm/s' },
  rho: { category: 'density', unit: 'kg/m³' },
  g: { category: 'acceleration', unit: 'm/s²' },
  alpha1: { category: 'none', unit: '' },
  alpha2: { category: 'none', unit: '' },
  hb: { category: 'length', unit: 'm' },
  ht: { category: 'length', unit: 'm' },
  hL: { category: 'length', unit: 'm' },
  L: { category: 'length', unit: 'm' },
  D1: { category: 'length', unit: 'm' },
  f: { category: 'none', unit: '' },
  K: { category: 'none', unit: '' },
};

// Estilos personalizados para los mensajes Toast de éxito y error
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

// Estado inicial de todos los campos; se usa al montar y al limpiar la calculadora
const initialState = (): CalculatorState => ({
  mode: 'ideal',

  P1: '',
  P2: '',
  z1: '',
  z2: '',
  V1: '',
  V2: '',
  D1: '',
  D2: '',
  rho: '1000',
  gamma: '9807',
  g: '9.807',
  alpha1: '1',
  alpha2: '1',
  hb: '',
  ht: '',
  includeBomba: true,
  includeTurbina: false,

  lossInputType: 'direct',
  hL: '',
  L: '',
  f: '',
  K: '',

  cavitationSystemType: 'closed',
  Ps: '',
  Vs: '',
  Patm: '101325',
  z0: '',
  zs: '',
  hfs: '',
  temperatura: '20',
  Pv: '2338',
  useRhoForGamma: false,
  useTempForPv: true,

  P1Unit: 'Pa',
  P2Unit: 'Pa',
  z1Unit: 'm',
  z2Unit: 'm',
  V1Unit: 'm/s',
  V2Unit: 'm/s',
  D1Unit: 'm',
  D2Unit: 'm',
  rhoUnit: 'kg/m³',
  gammaUnit: 'N/m³',
  gUnit: 'm/s²',
  hbUnit: 'm',
  htUnit: 'm',
  hLUnit: 'm',
  LUnit: 'm',
  PsUnit: 'Pa',
  VsUnit: 'm/s',
  PatmUnit: 'Pa',
  z0Unit: 'm',
  zsUnit: 'm',
  hfsUnit: 'm',
  temperaturaUnit: '°C',
  PvUnit: 'Pa',

  prevP1Unit: 'Pa',
  prevP2Unit: 'Pa',
  prevZ1Unit: 'm',
  prevZ2Unit: 'm',
  prevV1Unit: 'm/s',
  prevV2Unit: 'm/s',
  prevD1Unit: 'm',
  prevD2Unit: 'm',
  prevRhoUnit: 'kg/m³',
  prevGammaUnit: 'N/m³',
  prevGUnit: 'm/s²',
  prevHbUnit: 'm',
  prevHtUnit: 'm',
  prevHLUnit: 'm',
  prevLUnit: 'm',
  prevPsUnit: 'Pa',
  prevVsUnit: 'm/s',
  prevPatmUnit: 'Pa',
  prevZ0Unit: 'm',
  prevZsUnit: 'm',
  prevHfsUnit: 'm',
  prevTemperaturaUnit: '°C',
  prevPvUnit: 'Pa',

  resultTotalEnergy: '',
  resultP1: '',
  resultV1: '',
  resultZ1: '',
  resultP2: '',
  resultV2: '',
  resultZ2: '',
  resultNPSHa: '',
  resultCavitationMargin: '',
  resultPabs: '',
  resultGamma: '',
  resultPv: '',
  resultAlpha2: '',

  isManualEditP1: false,
  isManualEditP2: false,
  isManualEditz1: false,
  isManualEditz2: false,
  isManualEditV1: false,
  isManualEditV2: false,
  isManualEditL: false,
  isManualEditD1: false,
  isManualEditF: false,
  isManualEditK: false,
  isManualEditD2: false,
  isManualEditHb: false,
  isManualEditHt: false,
  isManualEditHL: false,
  isManualEditAlpha1: false,
  isManualEditAlpha2: false,
  isManualEditPs: false,
  isManualEditVs: false,
  isManualEditPatm: false,
  isManualEditz0: false,
  isManualEditzs: false,
  isManualEdithfs: false,

  unknownVariable: null,
  lockedField: null,
  invalidFields: [],
  autoCalculatedField: null,
});

// Casilla de verificación para activar opciones como bomba o turbina
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
  onValueChange: (value: boolean) => void;
  themeColors: any;
  fontSizeFactor: number;
  currentTheme: string;
}) => (
  <Pressable
    style={styles.checkboxContainer}
    onPress={() => onValueChange(!value)}
  >
    <View style={[
      styles.checkbox,
      {
        borderColor: value ? 'transparent' : themeColors.checkboxMargin,
        backgroundColor: value ? 'rgb(194,254,12)' : 'transparent',
      }
    ]}>
      {value && (
        <IconCheck name="dot-fill" size={14} color={currentTheme === 'dark' ? '#000' : '#000'} />
      )}
    </View>
    <Text style={[styles.checkboxLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
      {label}
    </Text>
  </Pressable>
);

// Retorna el color del indicador de estado según si fue editado, inválido o auto-calculado
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

// Componente principal de la calculadora de Bernoulli
const EnergiaBernoulliCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const {
    selectedPrecision,
    decimalCountFixed,
    decimalCountScientific,
    decimalCountEngineering,
  } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  // ── Teclado personalizado ────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  // Ref con el estado actual para evitar closures obsoletas en los handlers del teclado
  const stateRef = useRef<CalculatorState>(initialState());

  // Ref que mapea cada fieldId al handler de cambio de valor para uso del teclado
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  // ─────────────────────────────────────────────────────────────────────────────

  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);

  // Paleta de colores recalculada solo cuando cambia el tema
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

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setActiveInputId(null);
      };
    }, [])
  );

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

  // Valores de animación para el selector de modo principal
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;

  // Animación del ícono de favorito
  const heartScale = useRef(new Animated.Value(1)).current;

  // Valores de animación para el selector de tipo de pérdida
  const animatedLossValue = useRef(new Animated.Value(0)).current;
  const animatedLossScale = useRef(new Animated.Value(1)).current;

  // Valores de animación para el selector de sistema en cavitación
  const animatedCavitationValue = useRef(new Animated.Value(0)).current;
  const animatedCavitationScale = useRef(new Animated.Value(1)).current;

  // Dimensiones y posiciones de los botones del selector de modo principal
  const [buttonMetrics, setButtonMetrics] = useState<{ ideal: number; losses: number; cavitation: number }>({
    ideal: 0,
    losses: 0,
    cavitation: 0,
  });
  const [buttonPositions, setButtonPositions] = useState<{ ideal: number; losses: number; cavitation: number }>({
    ideal: 0,
    losses: 0,
    cavitation: 0,
  });

  // Dimensiones y posiciones de los botones del selector de tipo de pérdida
  const [lossButtonMetrics, setLossButtonMetrics] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });
  const [lossButtonPositions, setLossButtonPositions] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });

  // Dimensiones y posiciones de los botones del selector de sistema en cavitación
  const [cavitationButtonMetrics, setCavitationButtonMetrics] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });
  const [cavitationButtonPositions, setCavitationButtonPositions] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });

  // Referencia a la conexión de base de datos y estado del favorito
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  // Conecta a la base de datos al montar y consulta si esta calculadora está en favoritos
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;

        const fav = await isFavorite(db, 'EnergiaBernoulliCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Agrega o quita la calculadora de favoritos y muestra un Toast de confirmación
  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }

      const route = 'EnergiaBernoulliCalc';
      const label = t('energiaBernoulliCalc.title') || 'Calculadora de Energía/Bernoulli';

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

  // Animación de rebote sobre el ícono de favorito
  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  // Anima el indicador deslizante del selector de modo al cambiar entre Ideal, Pérdidas y Cavitación
  useEffect(() => {
    if (buttonMetrics.ideal > 0 && buttonMetrics.losses > 0 && buttonMetrics.cavitation > 0) {
      let targetX = 0;
      if (state.mode === 'ideal') targetX = buttonPositions.ideal;
      else if (state.mode === 'losses') targetX = buttonPositions.losses;
      else if (state.mode === 'cavitation') targetX = buttonPositions.cavitation;

      Animated.parallel([
        Animated.spring(animatedValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.mode, buttonMetrics, buttonPositions]);

  // Anima el indicador del selector de tipo de pérdida entre Directo y Darcy
  useEffect(() => {
    if (lossButtonMetrics.direct > 0 && lossButtonMetrics.darcy > 0) {
      let targetX = 0;
      if (state.lossInputType === 'direct') targetX = lossButtonPositions.direct;
      else if (state.lossInputType === 'darcy') targetX = lossButtonPositions.darcy;

      Animated.parallel([
        Animated.spring(animatedLossValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedLossScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedLossScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.lossInputType, lossButtonMetrics, lossButtonPositions]);

  // Anima el indicador del selector de sistema entre Cerrado y Abierto
  useEffect(() => {
    if (cavitationButtonMetrics.closed > 0 && cavitationButtonMetrics.open > 0) {
      let targetX = 0;
      if (state.cavitationSystemType === 'closed') targetX = cavitationButtonPositions.closed;
      else if (state.cavitationSystemType === 'open') targetX = cavitationButtonPositions.open;

      Animated.parallel([
        Animated.spring(animatedCavitationValue, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 5,
          speed: 5,
        }),
        Animated.sequence([
          Animated.spring(animatedCavitationScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedCavitationScale, { toValue: 1, useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [state.cavitationSystemType, cavitationButtonMetrics, cavitationButtonPositions]);

  // Convierte un Decimal a texto eliminando ceros decimales innecesarios
  const formatResult = useCallback((value: Decimal): string => {
    if (!value.isFinite()) return '';
    const fixed = value.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const toSuperscriptExponent = useCallback((value: string): string => {
    const superscriptMap: Record<string, string> = {
      '-': '⁻',
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹',
    };

    return value
      .split('')
      .map((char) => superscriptMap[char] ?? char)
      .join('');
  }, []);

  const formatDecimalWithPrecision = useCallback((value: Decimal): string => {
    if (!value.isFinite()) return value.toString();

    switch (selectedPrecision) {
      case 'Normal':
        return value.toFixed(10).replace(/\.?0+$/, '');
      case 'Fix':
        return value.toFixed(decimalCountFixed);
      case 'Científica': {
        if (value.isZero()) return '0';
        const scientific = value.toExponential(decimalCountScientific);
        const [mantissa, exponent = '0'] = scientific.split('e');
        return `${mantissa} × 10${toSuperscriptExponent(exponent.replace('+', ''))}`;
      }
      case 'Ingeniería': {
        if (value.isZero()) return '0';

        const scientific = value.toExponential();
        const [, exponent = '0'] = scientific.split('e');
        const engineeringExponent = new Decimal(exponent.replace('+', ''))
          .div(DECIMAL_THREE)
          .floor()
          .mul(DECIMAL_THREE);
        const mantissa = value
          .div(DECIMAL_TEN.pow(engineeringExponent.toFixed(0)))
          .toFixed(decimalCountEngineering);

        return `${mantissa} × 10${toSuperscriptExponent(engineeringExponent.toFixed(0))}`;
      }
      default:
        return value.toString();
    }
  }, [
    selectedPrecision,
    decimalCountFixed,
    decimalCountScientific,
    decimalCountEngineering,
    toSuperscriptExponent,
  ]);

  // Convierte un valor de una unidad a otra dentro de la misma categoría
  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || !isValidDecimalString(cleanValue)) return value;

    const decimalValue = new Decimal(cleanValue);

    if (category === 'temperature') {
      if (fromUnit === toUnit) return value;
      if (fromUnit === '°C' && toUnit === '°F') {
        return formatResult(decimalValue.mul(DECIMAL_NINE).div(DECIMAL_FIVE).plus(DECIMAL_THIRTY_TWO));
      } else if (fromUnit === '°C' && toUnit === 'K') {
        return formatResult(decimalValue.plus(DECIMAL_KELVIN_OFFSET));
      } else if (fromUnit === '°F' && toUnit === '°C') {
        return formatResult(decimalValue.minus(DECIMAL_THIRTY_TWO).mul(DECIMAL_FIVE).div(DECIMAL_NINE));
      } else if (fromUnit === '°F' && toUnit === 'K') {
        return formatResult(decimalValue.minus(DECIMAL_THIRTY_TWO).mul(DECIMAL_FIVE).div(DECIMAL_NINE).plus(DECIMAL_KELVIN_OFFSET));
      } else if (fromUnit === 'K' && toUnit === '°C') {
        return formatResult(decimalValue.minus(DECIMAL_KELVIN_OFFSET));
      } else if (fromUnit === 'K' && toUnit === '°F') {
        return formatResult(decimalValue.minus(DECIMAL_KELVIN_OFFSET).mul(DECIMAL_NINE).div(DECIMAL_FIVE).plus(DECIMAL_THIRTY_TWO));
      }
      return value;
    }

    const fromFactor = getConversionFactor(category, fromUnit);
    const toFactor = getConversionFactor(category, toUnit);

    return formatResult(decimalValue.mul(fromFactor).div(toFactor));
  }, [formatResult]);

  // Aplica la preferencia de separador decimal del usuario al texto formateado
  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Calcula la presión de vapor del agua para una temperatura dada (ecuación de Wagner)
  const calculateVaporPressure = useCallback((temp: string, unit: string): Decimal => {
    let tempC: Decimal;

    const tempDecimal = new Decimal(temp.replace(',', '.'));
    if (unit === '°F') {
      tempC = tempDecimal.minus(DECIMAL_THIRTY_TWO).mul(DECIMAL_FIVE).div(DECIMAL_NINE);
    } else if (unit === 'K') {
      tempC = tempDecimal.minus(DECIMAL_KELVIN_OFFSET);
    } else {
      tempC = tempDecimal;
    }

    if (tempC.lessThan(DECIMAL_TEMP_MIN_C) || tempC.greaterThan(DECIMAL_TEMP_MAX_C)) {
      console.warn(`Temperatura fuera de rango (0-374°C): ${tempC.toFixed(2)}°C`);
    }
    
    const Tc = new Decimal('647.096');
    const Pc = new Decimal('22064000');
    const Tk = tempC.plus(DECIMAL_KELVIN_OFFSET);
    const Tr = Tk.div(Tc);
    const tau = DECIMAL_ONE.minus(Tr);

    const a = [
      new Decimal('-7.85951783'),
      new Decimal('1.84408259'),
      new Decimal('-11.7866497'),
      new Decimal('22.6807411'),
      new Decimal('-15.9618719'),
      new Decimal('1.80122502'),
    ];

    const lnPrD = a[0].mul(tau)
      .plus(a[1].mul(tau.pow(new Decimal('1.5'))))
      .plus(a[2].mul(tau.pow(DECIMAL_THREE)))
      .plus(a[3].mul(tau.pow(new Decimal('3.5'))))
      .plus(a[4].mul(tau.pow(DECIMAL_FOUR)))
      .plus(a[5].mul(tau.pow(new Decimal('7.5'))))
      .div(Tr);

    return Pc.mul(lnPrD.exp());
  }, []);

  // Detecta el campo a bloquear en modo ideal cuando hay exactamente 7 de 8 campos válidos
  const updateLockedFieldIdeal = useCallback(() => {
    const inputs = [
      { id: 'P1', value: state.P1 },
      { id: 'V1', value: state.V1 },
      { id: 'z1', value: state.z1 },
      { id: 'P2', value: state.P2 },
      { id: 'V2', value: state.V2 },
      { id: 'z2', value: state.z2 },
      { id: 'alpha1', value: state.alpha1 },
      { id: 'alpha2', value: state.alpha2 },
    ];

    const validInputs = inputs.filter(({ value }) =>
      value !== '' && isValidDecimalString(value)
    );

    if (validInputs.length === 7) {
      const emptyInput = inputs.find(({ value }) =>
        value === '' || !isValidDecimalString(value)
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.V1, state.z1, state.P2, state.V2, state.z2, state.alpha1, state.alpha2]);

  // Detecta el campo a bloquear en modo pérdidas considerando los campos opcionales activos
  const updateLockedFieldLosses = useCallback(() => {
    const baseFields = [
      { id: 'P1', value: state.P1 },
      { id: 'z1', value: state.z1 },
      { id: 'V1', value: state.V1 },
      { id: 'P2', value: state.P2 },
      { id: 'z2', value: state.z2 },
      { id: 'V2', value: state.V2 },
      { id: 'rho', value: state.rho },
      { id: 'g', value: state.g },
      { id: 'alpha1', value: state.alpha1 },
      { id: 'alpha2', value: state.alpha2 },
    ];

    const conditionalFields = [];
    if (state.includeBomba) {
      conditionalFields.push({ id: 'hb', value: state.hb });
    }
    if (state.includeTurbina) {
      conditionalFields.push({ id: 'ht', value: state.ht });
    }

    let lossFields = [];
    if (state.lossInputType === 'direct') {
      lossFields = [{ id: 'hL', value: state.hL }];
    } else {
      lossFields = [
        { id: 'L', value: state.L },
        { id: 'D1', value: state.D1 },
        { id: 'f', value: state.f },
        { id: 'K', value: state.K }
      ];
    }

    const allRequiredFields = [...baseFields, ...conditionalFields, ...lossFields];

    const validInputs = allRequiredFields.filter(({ value }) =>
      value && value.trim() !== '' && isValidDecimalString(value)
    );

    if (validInputs.length === allRequiredFields.length - 1) {
      const emptyInput = allRequiredFields.find(({ value }) =>
        !value || value.trim() === '' || !isValidDecimalString(value)
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.z1, state.V1, state.P2, state.z2, state.V2, state.rho, state.g,
    state.alpha1, state.alpha2, state.includeBomba, state.includeTurbina, state.hb, state.ht,
    state.lossInputType, state.hL, state.L, state.D1, state.f, state.K]);

  // Calcula la pérdida de carga: valor directo o fórmula de Darcy-Weisbach según el modo
  const calculateHeadLoss = useCallback((
    siValues: { [key: string]: Decimal },
    getVal: (id: string, defaultValue: Decimal) => Decimal,
    twoG: Decimal
  ): Decimal => {
    if (state.lossInputType === 'direct') {
      return getVal('hL', DECIMAL_ZERO);
    } else {
      const L = getVal('L', DECIMAL_ZERO);
      const D1 = getVal('D1', DECIMAL_ONE);
      const f = getVal('f', DECIMAL_ZERO);
      const K = getVal('K', DECIMAL_ZERO);
      const V1 = getVal('V1', DECIMAL_ZERO);

      const vSquaredOver2g = V1.pow(DECIMAL_TWO).div(twoG);
      const frictionLoss = f.mul(L.div(D1)).mul(vSquaredOver2g);
      const minorLoss = K.mul(vSquaredOver2g);
      return frictionLoss.plus(minorLoss);
    }
  }, [state.lossInputType]);

  // Despeja el parámetro faltante de Darcy-Weisbach (L, D1, f o K)
  const calculateDarcyField = useCallback((
    missingField: string,
    siValues: { [key: string]: Decimal },
    getVal: (id: string, defaultValue: Decimal) => Decimal,
    rhoG: Decimal,
    twoG: Decimal,
    alpha1: Decimal,
    alpha2: Decimal,
    newState: Partial<CalculatorState>
  ): boolean => {
    const leftSide = getVal('P1', DECIMAL_ZERO).div(rhoG)
      .plus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z1', DECIMAL_ZERO))
      .plus(getVal('hb', DECIMAL_ZERO));

    const rightSide = getVal('P2', DECIMAL_ZERO).div(rhoG)
      .plus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z2', DECIMAL_ZERO))
      .plus(getVal('ht', DECIMAL_ZERO));

    const hL_total = leftSide.minus(rightSide);

    switch (missingField) {
      case 'L': {
        const V1 = getVal('V1', DECIMAL_ZERO);
        const D1 = getVal('D1', DECIMAL_ONE);
        const f = getVal('f', DECIMAL_ZERO);
        const K = getVal('K', DECIMAL_ZERO);

        const vSquaredOver2g = V1.pow(DECIMAL_TWO).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);

        if (f.greaterThan(0) && !vSquaredOver2g.isZero()) {
          const L_si = hL_total.minus(minorLoss)
            .mul(D1)
            .div(f.mul(vSquaredOver2g));

          const result = L_si.div(getConversionFactor('length', state.LUnit));
          newState.L = formatResult(result);
          newState.isManualEditL = false;
          newState.unknownVariable = {
            name: 'L',
            label: t('energiaBernoulliCalc.labels.L'),
            unit: state.LUnit,
            value: newState.L
          };
          return true;
        }
        break;
      }

      case 'D1': {
        const V1 = getVal('V1', DECIMAL_ZERO);
        const L = getVal('L', DECIMAL_ZERO);
        const f = getVal('f', DECIMAL_ZERO);
        const K = getVal('K', DECIMAL_ZERO);

        const vSquaredOver2g = V1.pow(DECIMAL_TWO).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);
        const numerator = f.mul(L).mul(vSquaredOver2g);
        const denominator = hL_total.minus(minorLoss);

        if (denominator.greaterThan(0)) {
          const D_si = numerator.div(denominator);
          const result = D_si.div(getConversionFactor('length', state.D1Unit));
          newState.D1 = formatResult(result);
          newState.isManualEditD1 = false;
          newState.unknownVariable = {
            name: 'D₁',
            label: t('energiaBernoulliCalc.labels.D1'),
            unit: state.D1Unit,
            value: newState.D1
          };
          return true;
        }
        break;
      }

      case 'f': {
        const V1 = getVal('V1', DECIMAL_ZERO);
        const L = getVal('L', DECIMAL_ZERO);
        const D1 = getVal('D1', DECIMAL_ONE);
        const K = getVal('K', DECIMAL_ZERO);

        const vSquaredOver2g = V1.pow(DECIMAL_TWO).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);
        const numerator = hL_total.minus(minorLoss).mul(D1);
        const denominator = L.mul(vSquaredOver2g);

        if (!denominator.isZero()) {
          const f_si = numerator.div(denominator);
          newState.f = formatResult(f_si);
          newState.isManualEditF = false;
          newState.unknownVariable = {
            name: 'f',
            label: t('energiaBernoulliCalc.labels.f'),
            unit: '',
            value: newState.f
          };
          return true;
        }
        break;
      }

      case 'K': {
        const V1 = getVal('V1', DECIMAL_ZERO);
        const L = getVal('L', DECIMAL_ZERO);
        const D1 = getVal('D1', DECIMAL_ONE);
        const f = getVal('f', DECIMAL_ZERO);

        const vSquaredOver2g = V1.pow(DECIMAL_TWO).div(twoG);
        const frictionLoss = f.mul(L.div(D1)).mul(vSquaredOver2g);
        const numerator = hL_total.minus(frictionLoss);

        if (!vSquaredOver2g.isZero()) {
          const K_si = numerator.div(vSquaredOver2g);
          newState.K = formatResult(K_si);
          newState.isManualEditK = false;
          newState.unknownVariable = {
            name: 'K',
            label: t('energiaBernoulliCalc.labels.K'),
            unit: '',
            value: newState.K
          };
          return true;
        }
        break;
      }
    }
    return false;
  }, [formatResult, t, state.LUnit, state.D1Unit]);

  // Despeja el campo faltante de la ecuación de energía: presión, velocidad, cota, hB, hT o alpha
  const calculateGeneralField = useCallback((
    missingField: string,
    siValues: { [key: string]: Decimal },
    getVal: (id: string, defaultValue: Decimal) => Decimal,
    rhoG: Decimal,
    twoG: Decimal,
    alpha1: Decimal,
    alpha2: Decimal,
    newState: Partial<CalculatorState>,
    stateSnap: CalculatorState,
    fmt: (value: Decimal) => string,
    translate: any
  ): boolean => {
    const leftSide = getVal('P1', DECIMAL_ZERO).div(rhoG)
      .plus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z1', DECIMAL_ZERO))
      .plus(getVal('hb', DECIMAL_ZERO));

    const rightSide = getVal('P2', DECIMAL_ZERO).div(rhoG)
      .plus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z2', DECIMAL_ZERO))
      .plus(getVal('ht', DECIMAL_ZERO))
      .plus(calculateHeadLoss(siValues, getVal, twoG));

    switch (missingField) {
      case 'P1': {
        const rightMinusLeft = rightSide
          .minus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('z1', DECIMAL_ZERO))
          .minus(getVal('hb', DECIMAL_ZERO));

        const pressureSI = rightMinusLeft.mul(rhoG);
        const result = pressureSI.div(getConversionFactor('pressure', stateSnap.P1Unit));
        newState.resultP1 = fmt(result);
        newState.unknownVariable = {
          name: 'P₁',
          label: translate('energiaBernoulliCalc.labels.P1'),
          unit: stateSnap.P1Unit,
          value: newState.resultP1
        };
        return true;
      }

      case 'z1': {
        const elevationSI = rightSide
          .minus(getVal('P1', DECIMAL_ZERO).div(rhoG))
          .minus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('hb', DECIMAL_ZERO));

        const result = elevationSI.div(getConversionFactor('length', stateSnap.z1Unit));
        newState.resultZ1 = fmt(result);
        newState.unknownVariable = {
          name: 'z₁',
          label: translate('energiaBernoulliCalc.labels.z1'),
          unit: stateSnap.z1Unit,
          value: newState.resultZ1
        };
        return true;
      }

      case 'V1': {
        const rightTerm = rightSide
          .minus(getVal('P1', DECIMAL_ZERO).div(rhoG))
          .minus(getVal('z1', DECIMAL_ZERO))
          .minus(getVal('hb', DECIMAL_ZERO));

        if (rightTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = rightTerm.mul(twoG).div(alpha1).sqrt();
          const result = velocitySI.div(getConversionFactor('velocity', stateSnap.V1Unit));
          newState.resultV1 = fmt(result);
          newState.unknownVariable = {
            name: 'V₁',
            label: translate('energiaBernoulliCalc.labels.V1'),
            unit: stateSnap.V1Unit,
            value: newState.resultV1
          };
          return true;
        }
        break;
      }

      case 'hb': {
        const headSI = rightSide
          .minus(getVal('P1', DECIMAL_ZERO).div(rhoG))
          .minus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('z1', DECIMAL_ZERO));

        const result = headSI.div(getConversionFactor('length', stateSnap.hbUnit));
        newState.hb = fmt(result);
        newState.isManualEditHb = false;
        newState.unknownVariable = {
          name: 'hB',
          label: translate('energiaBernoulliCalc.labels.hb'),
          unit: stateSnap.hbUnit,
          value: newState.hb
        };
        return true;
      }

      case 'P2': {
        const leftMinusRight = leftSide
          .minus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('z2', DECIMAL_ZERO))
          .minus(getVal('ht', DECIMAL_ZERO))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const pressureSI = leftMinusRight.mul(rhoG);
        const result = pressureSI.div(getConversionFactor('pressure', stateSnap.P2Unit));
        newState.resultP2 = fmt(result);
        newState.unknownVariable = {
          name: 'P₂',
          label: translate('energiaBernoulliCalc.labels.P2'),
          unit: stateSnap.P2Unit,
          value: newState.resultP2
        };
        return true;
      }

      case 'z2': {
        const elevationSI = leftSide
          .minus(getVal('P2', DECIMAL_ZERO).div(rhoG))
          .minus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('ht', DECIMAL_ZERO))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const result = elevationSI.div(getConversionFactor('length', stateSnap.z2Unit));
        newState.resultZ2 = fmt(result);
        newState.unknownVariable = {
          name: 'z₂',
          label: translate('energiaBernoulliCalc.labels.z2'),
          unit: stateSnap.z2Unit,
          value: newState.resultZ2
        };
        return true;
      }

      case 'V2': {
        const leftMinusRight = leftSide
          .minus(getVal('P2', DECIMAL_ZERO).div(rhoG))
          .minus(getVal('z2', DECIMAL_ZERO))
          .minus(getVal('ht', DECIMAL_ZERO))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        if (leftMinusRight.greaterThanOrEqualTo(0)) {
          const velocitySI = leftMinusRight.mul(twoG).div(alpha2).sqrt();
          const result = velocitySI.div(getConversionFactor('velocity', stateSnap.V2Unit));
          newState.resultV2 = fmt(result);
          newState.unknownVariable = {
            name: 'V₂',
            label: translate('energiaBernoulliCalc.labels.V2'),
            unit: stateSnap.V2Unit,
            value: newState.resultV2
          };
          return true;
        }
        break;
      }

      case 'ht': {
        const headSI = leftSide
          .minus(getVal('P2', DECIMAL_ZERO).div(rhoG))
          .minus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
          .minus(getVal('z2', DECIMAL_ZERO))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const result = headSI.div(getConversionFactor('length', stateSnap.htUnit));
        newState.ht = fmt(result);
        newState.isManualEditHt = false;
        newState.unknownVariable = {
          name: 'hT',
          label: translate('energiaBernoulliCalc.labels.ht'),
          unit: stateSnap.htUnit,
          value: newState.ht
        };
        return true;
      }

      case 'alpha1':
      case 'alpha2':
        if (missingField === 'alpha1') {
          const rightTerm = rightSide
            .minus(getVal('P1', DECIMAL_ZERO).div(rhoG))
            .minus(getVal('z1', DECIMAL_ZERO))
            .minus(getVal('hb', DECIMAL_ZERO));

          const V1 = getVal('V1', DECIMAL_ZERO);
          if (rightTerm.greaterThan(0) && !V1.isZero()) {
            const alpha1_calc = rightTerm.mul(twoG).div(V1.pow(DECIMAL_TWO));
            const formattedResult = fmt(alpha1_calc);
            newState.alpha1 = formattedResult;
            newState.isManualEditAlpha1 = false;
            newState.unknownVariable = {
              name: 'α₁',
              label: translate('energiaBernoulliCalc.labels.alpha1'),
              unit: '',
              value: formattedResult
            };
            return true;
          }
        } else {
          const leftTerm = leftSide
            .minus(getVal('P2', DECIMAL_ZERO).div(rhoG))
            .minus(getVal('z2', DECIMAL_ZERO))
            .minus(getVal('ht', DECIMAL_ZERO))
            .minus(calculateHeadLoss(siValues, getVal, twoG));

          const V2 = getVal('V2', DECIMAL_ZERO);
          if (leftTerm.greaterThan(0) && !V2.isZero()) {
            const alpha2_calc = leftTerm.mul(twoG).div(V2.pow(DECIMAL_TWO));
            const formattedResult = fmt(alpha2_calc);
            newState.alpha2 = formattedResult;
            newState.isManualEditAlpha2 = false;
            newState.unknownVariable = {
              name: 'α₂',
              label: translate('energiaBernoulliCalc.labels.alpha2'),
              unit: '',
              value: formattedResult
            };
            return true;
          }
        }
        break;
    }
    return false;
  }, [calculateHeadLoss]);

  // Calcula Bernoulli ideal: identifica el único campo vacío y lo resuelve algebraicamente
  const calculateIdealBernoulli = useCallback(() => {
    const allFields = [
      { id: 'P1', value: state.P1, unit: state.P1Unit, category: 'pressure', resultField: 'resultP1' },
      { id: 'V1', value: state.V1, unit: state.V1Unit, category: 'velocity', resultField: 'resultV1' },
      { id: 'z1', value: state.z1, unit: state.z1Unit, category: 'length', resultField: 'resultZ1' },
      { id: 'P2', value: state.P2, unit: state.P2Unit, category: 'pressure', resultField: 'resultP2' },
      { id: 'V2', value: state.V2, unit: state.V2Unit, category: 'velocity', resultField: 'resultV2' },
      { id: 'z2', value: state.z2, unit: state.z2Unit, category: 'length', resultField: 'resultZ2' },
      { id: 'alpha1', value: state.alpha1, unit: '', category: 'none', resultField: 'alpha1' },
      { id: 'alpha2', value: state.alpha2, unit: '', category: 'none', resultField: 'alpha2' },
    ];
  
    const fieldsInSI = allFields.map(field => {
      if (field.id === 'alpha1' || field.id === 'alpha2') {
        const rawValue = field.value.replace(',', '.');
        if (rawValue === '' || !isValidDecimalString(rawValue)) {
          return { ...field, siValue: null, isValid: false };
        }
        return { ...field, siValue: new Decimal(rawValue), isValid: true };
      }
    
      const rawValue = field.value.replace(',', '.');
      if (rawValue === '' || !isValidDecimalString(rawValue)) {
        return { ...field, siValue: null, isValid: false };
      }
    
      const numValue = new Decimal(rawValue);
      const factorDecimal = getConversionFactor(
        field.category as 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight',
        field.unit
      );
      return { ...field, siValue: numValue.mul(factorDecimal), isValid: true };
    });
  
    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);
    const validCount = validFields.length;
  
    let gammaDecimal = DECIMAL_DEFAULT_GAMMA;
    if (state.gamma && isValidDecimalString(state.gamma)) {
      const gammaFactor = getConversionFactor('specificWeight', state.gammaUnit);
      gammaDecimal = new Decimal(state.gamma.replace(',', '.')).mul(gammaFactor);
    }
  
    let gDecimal = DECIMAL_DEFAULT_G;
    if (state.g && isValidDecimalString(state.g)) {
      gDecimal = new Decimal(state.g.replace(',', '.'))
        .mul(getConversionFactor('acceleration', state.gUnit));
    }
  
    if (validCount !== 7) {
      setState((prev) => ({
        ...prev,
        resultTotalEnergy: '',
        resultP1: '',
        resultV1: '',
        resultZ1: '',
        resultP2: '',
        resultV2: '',
        resultZ2: '',
        invalidFields: missingFields,
        autoCalculatedField: null,
        unknownVariable: null,
      }));
      return;
    }
  
    const missingField = missingFields[0];
  
    const siValues: { [key: string]: Decimal } = {};
    validFields.forEach(f => {
      siValues[f.id] = f.siValue as Decimal;
    });
  
    const newState: Partial<CalculatorState> = {};
  
    const alpha1 = siValues['alpha1'] !== undefined ? siValues['alpha1'] : DECIMAL_ONE;
    const alpha2 = siValues['alpha2'] !== undefined ? siValues['alpha2'] : DECIMAL_ONE;

    // 2g pre-calculado para reutilizar en todos los casos
    const twoG = DECIMAL_TWO.mul(gDecimal);
  
    switch (missingField) {
      case 'P1': {
        if (siValues['V1'] === undefined || siValues['z1'] === undefined) break;
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
      
        const E2 = siValues['P2'].div(gammaDecimal)
          .plus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z2']);
      
        const headTerm = E2
          .minus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
          .minus(siValues['z1']);
      
        const pressureSI = headTerm.mul(gammaDecimal);
        const result = pressureSI.div(getConversionFactor('pressure', state.P1Unit));
        const formattedResult = formatResult(result);
        newState.resultP1 = formattedResult;
      
        siValues['P1'] = pressureSI;
      
        newState.unknownVariable = {
          name: 'P₁',
          label: t('energiaBernoulliCalc.labels.P1'),
          unit: state.P1Unit,
          value: formattedResult
        };
        break;
      }
    
      case 'V1': {
        if (siValues['P1'] === undefined || siValues['z1'] === undefined) break;
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
      
        const E2 = siValues['P2'].div(gammaDecimal)
          .plus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z2']);
      
        const headTerm = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);
      
        if (headTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = headTerm
            .mul(twoG)
            .div(alpha1)
            .sqrt();
        
          const result = velocitySI.div(getConversionFactor('velocity', state.V1Unit));
          const formattedResult = formatResult(result);
          newState.resultV1 = formattedResult;
        
          siValues['V1'] = velocitySI;
        
          newState.unknownVariable = {
            name: 'V₁',
            label: t('energiaBernoulliCalc.labels.V1'),
            unit: state.V1Unit,
            value: formattedResult
          };
        }
        break;
      }
    
      case 'z1': {
        if (siValues['P1'] === undefined || siValues['V1'] === undefined) break;
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
      
        const E2 = siValues['P2'].div(gammaDecimal)
          .plus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z2']);
      
        const elevationSI = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG));
      
        const result = elevationSI.div(getConversionFactor('length', state.z1Unit));
        const formattedResult = formatResult(result);
        newState.resultZ1 = formattedResult;
      
        siValues['z1'] = elevationSI;
      
        newState.unknownVariable = {
          name: 'z₁',
          label: t('energiaBernoulliCalc.labels.z1'),
          unit: state.z1Unit,
          value: formattedResult
        };
        break;
      }
    
      case 'P2': {
        if (siValues['V2'] === undefined || siValues['z2'] === undefined) break;
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;
      
        const E1 = siValues['P1'].div(gammaDecimal)
          .plus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z1']);
      
        const headTerm = E1
          .minus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
          .minus(siValues['z2']);
      
        const pressureSI = headTerm.mul(gammaDecimal);
        const result = pressureSI.div(getConversionFactor('pressure', state.P2Unit));
        const formattedResult = formatResult(result);
        newState.resultP2 = formattedResult;
      
        siValues['P2'] = pressureSI;
      
        newState.unknownVariable = {
          name: 'P₂',
          label: t('energiaBernoulliCalc.labels.P2'),
          unit: state.P2Unit,
          value: formattedResult
        };
        break;
      }
    
      case 'V2': {
        if (siValues['P2'] === undefined || siValues['z2'] === undefined) break;
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;
      
        const E1 = siValues['P1'].div(gammaDecimal)
          .plus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z1']);
      
        const headTerm = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);
      
        if (headTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = headTerm
            .mul(twoG)
            .div(alpha2)
            .sqrt();
        
          const result = velocitySI.div(getConversionFactor('velocity', state.V2Unit));
          const formattedResult = formatResult(result);
          newState.resultV2 = formattedResult;
        
          siValues['V2'] = velocitySI;
        
          newState.unknownVariable = {
            name: 'V₂',
            label: t('energiaBernoulliCalc.labels.V2'),
            unit: state.V2Unit,
            value: formattedResult
          };
        }
        break;
      }
    
      case 'z2': {
        if (siValues['P2'] === undefined || siValues['V2'] === undefined) break;
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;
      
        const E1 = siValues['P1'].div(gammaDecimal)
          .plus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z1']);
      
        const elevationSI = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG));
      
        const result = elevationSI.div(getConversionFactor('length', state.z2Unit));
        const formattedResult = formatResult(result);
        newState.resultZ2 = formattedResult;
      
        siValues['z2'] = elevationSI;
      
        newState.unknownVariable = {
          name: 'z₂',
          label: t('energiaBernoulliCalc.labels.z2'),
          unit: state.z2Unit,
          value: formattedResult
        };
        break;
      }
    
      case 'alpha1': {
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
      
        const E2 = siValues['P2'].div(gammaDecimal)
          .plus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z2']);
      
        const energyTerm = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);
      
        if (energyTerm.greaterThan(0) && !siValues['V1'].isZero()) {
          const alpha1_calc = energyTerm
            .mul(twoG)
            .div(siValues['V1'].pow(DECIMAL_TWO));
        
            const formattedResult = formatResult(alpha1_calc);
          newState.alpha1 = formattedResult;
          newState.isManualEditAlpha1 = false;
        
          siValues['alpha1'] = alpha1_calc;
        
          newState.unknownVariable = {
            name: 'α₁',
            label: t('energiaBernoulliCalc.labels.alpha1'),
            unit: '',
            value: formattedResult
          };
        }
        break;
      }
    
      case 'alpha2': {
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
        if (siValues['P1'] === undefined || siValues['V1'] === undefined || siValues['z1'] === undefined) break;
      
        const E1 = siValues['P1'].div(gammaDecimal)
          .plus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
          .plus(siValues['z1']);
      
        const energyTerm = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);
      
        if (energyTerm.greaterThan(0) && !siValues['V2'].isZero()) {
          const alpha2_calc = energyTerm
            .mul(twoG)
            .div(siValues['V2'].pow(DECIMAL_TWO));
        
          const formattedResult = formatResult(alpha2_calc);
          newState.resultAlpha2 = formattedResult;
          newState.alpha2 = formattedResult;
          newState.isManualEditAlpha2 = false;
        
          siValues['alpha2'] = alpha2_calc;
        
          newState.unknownVariable = {
            name: 'α₂',
            label: t('energiaBernoulliCalc.labels.alpha2'),
            unit: '',
            value: formattedResult
          };
        }
        break;
      }
    }
  
    // Calcula la diferencia de energía entre puntos 1 y 2 con todos los valores disponibles
    const hasAllP1 = siValues['P1'] !== undefined;
    const hasAllV1 = siValues['V1'] !== undefined;
    const hasAllz1 = siValues['z1'] !== undefined;
    const hasAllP2 = siValues['P2'] !== undefined;
    const hasAllV2 = siValues['V2'] !== undefined;
    const hasAllz2 = siValues['z2'] !== undefined;
  
    if (hasAllP1 && hasAllV1 && hasAllz1 && hasAllP2 && hasAllV2 && hasAllz2) {
      const E1 = siValues['P1'].div(gammaDecimal)
        .plus(alpha1.mul(siValues['V1'].pow(DECIMAL_TWO)).div(twoG))
        .plus(siValues['z1']);
    
      const E2 = siValues['P2'].div(gammaDecimal)
        .plus(alpha2.mul(siValues['V2'].pow(DECIMAL_TWO)).div(twoG))
        .plus(siValues['z2']);
    
      const energyDifference = E1.minus(E2);
    
      newState.resultTotalEnergy = formatResult(energyDifference);
      } else {
        newState.resultTotalEnergy = '';
      }
  
    if (!missingField) {
      newState.unknownVariable = null;
    }
  
    setState((prev) => ({
      ...prev,
      ...newState,
      invalidFields: [],
      autoCalculatedField: missingField,
      isManualEditP1: missingField === 'P1' ? false : prev.isManualEditP1,
      isManualEditV1: missingField === 'V1' ? false : prev.isManualEditV1,
      isManualEditz1: missingField === 'z1' ? false : prev.isManualEditz1,
      isManualEditP2: missingField === 'P2' ? false : prev.isManualEditP2,
      isManualEditV2: missingField === 'V2' ? false : prev.isManualEditV2,
      isManualEditz2: missingField === 'z2' ? false : prev.isManualEditz2,
      isManualEditAlpha1: missingField === 'alpha1' ? false : (prev.isManualEditAlpha1 || false),
      isManualEditAlpha2: missingField === 'alpha2' ? false : prev.isManualEditAlpha2,
    }));
  
  }, [state, formatResult, t]);

  // Actualiza el campo bloqueado cada vez que cambian los valores de entrada
  useEffect(() => {
    if (state.mode === 'ideal') {
      updateLockedFieldIdeal();
    } else if (state.mode === 'losses') {
      updateLockedFieldLosses();
    }
  }, [
    state.mode,
    state.P1, state.V1, state.z1, state.P2, state.V2, state.z2,
    state.alpha1, state.alpha2, state.rho, state.g,
    state.includeBomba, state.includeTurbina, state.hb, state.ht,
    state.lossInputType, state.hL, state.L, state.D1, state.f, state.K,
    updateLockedFieldIdeal, updateLockedFieldLosses
  ]);

  // Retorna los campos requeridos para el modo pérdidas según la configuración activa
  const getRequiredFieldsForLosses = useCallback((stateSnap: CalculatorState) => {
    const baseFields = [
      { id: 'P1', config: { category: 'pressure', unit: stateSnap.P1Unit } },
      { id: 'z1', config: { category: 'length', unit: stateSnap.z1Unit } },
      { id: 'V1', config: { category: 'velocity', unit: stateSnap.V1Unit } },
      { id: 'P2', config: { category: 'pressure', unit: stateSnap.P2Unit } },
      { id: 'z2', config: { category: 'length', unit: stateSnap.z2Unit } },
      { id: 'V2', config: { category: 'velocity', unit: stateSnap.V2Unit } },
      { id: 'rho', config: { category: 'density', unit: stateSnap.rhoUnit } },
      { id: 'g', config: { category: 'acceleration', unit: stateSnap.gUnit } },
      { id: 'alpha1', config: { category: 'none' } },
      { id: 'alpha2', config: { category: 'none' } },
    ];

    const conditionalFields = [];
    if (stateSnap.includeBomba) {
      conditionalFields.push({ id: 'hb', config: { category: 'length', unit: stateSnap.hbUnit } });
    }
    if (stateSnap.includeTurbina) {
      conditionalFields.push({ id: 'ht', config: { category: 'length', unit: stateSnap.htUnit } });
    }

    const lossFields = stateSnap.lossInputType === 'direct'
      ? [{ id: 'hL', config: { category: 'length', unit: stateSnap.hLUnit } }]
      : [
        { id: 'L', config: { category: 'length', unit: stateSnap.LUnit } },
        { id: 'D1', config: { category: 'length', unit: stateSnap.D1Unit } },
        { id: 'f', config: { category: 'none' } },
        { id: 'K', config: { category: 'none' } },
      ];

    return [...baseFields, ...conditionalFields, ...lossFields];
  }, []);

  // Calcula con pérdidas, bomba y turbina, resolviendo el único campo vacío
  const calculateWithLosses = useCallback(() => {
    const requiredFieldIds = getRequiredFieldsForLosses(state);

    const fieldsInSI = requiredFieldIds.map(field => {
      const config = field.config;

      const rawValue = (state as any)[field.id]?.replace(',', '.');
      if (!rawValue || rawValue === '' || !isValidDecimalString(rawValue)) {
        return { ...field, siValue: null, isValid: false };
      }

      const numValue = new Decimal(rawValue);
      if (config.category === 'none') {
        return { ...field, siValue: numValue, isValid: true };
      }

      const factorDecimal = getConversionFactor(
        config.category as 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight',
        config.unit!
      );
      return {
        ...field,
        siValue: numValue.mul(factorDecimal),
        isValid: true
      };
    });

    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);

    if (validFields.length !== requiredFieldIds.length - 1) {
      setState(prev => ({
        ...prev,
        resultTotalEnergy: '',
        resultP1: '', resultV1: '', resultZ1: '',
        resultP2: '', resultV2: '', resultZ2: '',
        invalidFields: missingFields,
        autoCalculatedField: null,
        unknownVariable: null,
      }));
      return;
    }

    const missingField = missingFields[0];

    const siValues: { [key: string]: Decimal } = {};
    validFields.forEach(f => { siValues[f.id] = f.siValue as Decimal; });

    const getVal = (id: string, defaultValue: Decimal): Decimal =>
      siValues[id] !== undefined ? siValues[id] : defaultValue;

    const rho = getVal('rho', new Decimal('1000'));
    const g = getVal('g', DECIMAL_DEFAULT_G_LOSSES);
    const rhoG = rho.mul(g);
    const alpha1 = getVal('alpha1', DECIMAL_ONE);
    const alpha2 = getVal('alpha2', DECIMAL_ONE);
    const twoG = DECIMAL_TWO.mul(g);

    // Diferencia de energía antes de resolver el campo desconocido
    const leftSide = getVal('P1', DECIMAL_ZERO).div(rhoG)
      .plus(alpha1.mul(getVal('V1', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z1', DECIMAL_ZERO))
      .plus(getVal('hb', DECIMAL_ZERO));

    const rightSide = getVal('P2', DECIMAL_ZERO).div(rhoG)
      .plus(alpha2.mul(getVal('V2', DECIMAL_ZERO).pow(DECIMAL_TWO)).div(twoG))
      .plus(getVal('z2', DECIMAL_ZERO))
      .plus(getVal('ht', DECIMAL_ZERO))
      .plus(calculateHeadLoss(siValues, getVal, twoG));

    const energyDifference = leftSide.minus(rightSide);

    const newState: Partial<CalculatorState> = {
      resultP1: '', resultV1: '', resultZ1: '',
      resultP2: '', resultV2: '', resultZ2: '',
    };

    try {
      let calculated = false;

      const generalResult = calculateGeneralField(
        missingField, siValues, getVal, rhoG, twoG, alpha1, alpha2, newState, state, formatResult, t
      );

      if (generalResult) {
        calculated = true;
      } else if (missingField === 'hL' && state.lossInputType === 'direct') {
        const hL_si = calculateHeadLoss(siValues, getVal, twoG);
        const result = hL_si.div(getConversionFactor('length', state.hLUnit));
        newState.hL = formatResult(result);
        newState.isManualEditHL = false;
        newState.unknownVariable = {
          name: 'hL',
          label: t('energiaBernoulliCalc.labels.hL'),
          unit: state.hLUnit,
          value: newState.hL
        };
        calculated = true;
      } else if (state.lossInputType === 'darcy' &&
        ['L', 'D1', 'f', 'K'].includes(missingField)) {
        calculated = calculateDarcyField(
          missingField, siValues, getVal, rhoG, twoG, alpha1, alpha2, newState
        );
      }

      if (!calculated) {
        console.warn(`No se pudo calcular el campo: ${missingField}`);
        setState(prev => ({
          ...prev,
          invalidFields: [missingField],
          autoCalculatedField: null,
          unknownVariable: null,
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        ...newState,
        resultTotalEnergy: formatResult(energyDifference),
        invalidFields: [],
        autoCalculatedField: missingField,
        isManualEditP1: missingField === 'P1' ? false : prev.isManualEditP1,
        isManualEditV1: missingField === 'V1' ? false : prev.isManualEditV1,
        isManualEditz1: missingField === 'z1' ? false : prev.isManualEditz1,
        isManualEditP2: missingField === 'P2' ? false : prev.isManualEditP2,
        isManualEditV2: missingField === 'V2' ? false : prev.isManualEditV2,
        isManualEditz2: missingField === 'z2' ? false : prev.isManualEditz2,
        isManualEditHb: missingField === 'hb' ? false : (prev.isManualEditHb || false),
        isManualEditHt: missingField === 'ht' ? false : (prev.isManualEditHt || false),
        isManualEditHL: missingField === 'hL' ? false : (prev.isManualEditHL || false),
        isManualEditL: missingField === 'L' ? false : (prev.isManualEditL || false),
        isManualEditD1: missingField === 'D1' ? false : (prev.isManualEditD1 || false),
        isManualEditF: missingField === 'f' ? false : (prev.isManualEditF || false),
        isManualEditK: missingField === 'K' ? false : (prev.isManualEditK || false),
        isManualEditAlpha1: missingField === 'alpha1' ? false : (prev.isManualEditAlpha1 || false),
        isManualEditAlpha2: missingField === 'alpha2' ? false : (prev.isManualEditAlpha2 || false),
      }));

    } catch (error) {
      console.error("Error en cálculo con pérdidas:", error);
      setState(prev => ({
        ...prev,
        invalidFields: [missingField],
        autoCalculatedField: null,
        unknownVariable: null,
      }));
    }
  }, [state, formatResult, t, calculateHeadLoss, calculateDarcyField, calculateGeneralField]);

  // Calcula el NPSHa y el margen de cavitación para el sistema configurado
  const calculateCavitation = useCallback(() => {
    try {
      let requiredIds: string[] = ['g'];

      if (state.cavitationSystemType === 'closed') {
        requiredIds = [...requiredIds, 'Ps', 'Vs'];
      } else {
        requiredIds = [...requiredIds, 'Patm', 'z0', 'zs', 'hfs'];
      }

      if (state.useRhoForGamma) {
        requiredIds.push('rho');
      } else {
        requiredIds.push('gamma');
      }

      if (state.useTempForPv) {
        requiredIds.push('temperatura');
      } else {
        requiredIds.push('Pv');
      }

      const missing = requiredIds.filter((id) => {
        const raw = (state as any)[id] as string;
        const val = raw?.replace(',', '.');
        return !val || val.trim() === '' || !isValidDecimalString(val);
      });

      if (missing.length > 0) {
        setState((prev) => ({
          ...prev,
          invalidFields: missing,
          autoCalculatedField: null,
          resultNPSHa: '',
          resultCavitationMargin: '',
          resultPabs: '',
        }));
        return;
      }

      const getDecimalValue = (
        id: string,
        category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight' | 'none',
        defaultUnit: string
      ): Decimal => {
        const rawValue = (state as any)[id]?.replace(',', '.') || '0';
        const unit = (state as any)[`${id}Unit`] || defaultUnit;
        const value = new Decimal(rawValue);

        if (category === 'none' || !unit) return value;

        const factor = getConversionFactor(category, unit);
        return value.mul(factor);
      };

      const g = getDecimalValue('g', 'acceleration', 'm/s²');

      let gamma: Decimal;
      let gammaCalculado = false;

      if (state.useRhoForGamma) {
        const rho = getDecimalValue('rho', 'density', 'kg/m³');
        gamma = rho.mul(g);
        gammaCalculado = true;
      } else {
        gamma = getDecimalValue('gamma', 'specificWeight', 'N/m³');
      }

      let Pv: Decimal;
      let PvCalculado = false;

      if (state.useTempForPv) {
        Pv = calculateVaporPressure(state.temperatura, state.temperaturaUnit);
        PvCalculado = true;
      } else {
        Pv = getDecimalValue('Pv', 'pressure', 'Pa');
      }

      let NPSHa: Decimal;
      let Pabs: Decimal = DECIMAL_ZERO;

      if (state.cavitationSystemType === 'closed') {
        const Ps = getDecimalValue('Ps', 'pressure', 'Pa');
        const Vs = getDecimalValue('Vs', 'velocity', 'm/s');

        Pabs = Ps;

        const velocityHead = Vs.pow(DECIMAL_TWO).div(DECIMAL_TWO.mul(g));
        NPSHa = Ps.div(gamma).plus(velocityHead).minus(Pv.div(gamma));

      } else {
        const Patm = getDecimalValue('Patm', 'pressure', 'Pa');
        const z0 = getDecimalValue('z0', 'length', 'm');
        const zs = getDecimalValue('zs', 'length', 'm');
        const hfs = getDecimalValue('hfs', 'length', 'm');

        Pabs = Patm;

        NPSHa = Patm.div(gamma)
          .plus(z0)
          .minus(zs)
          .minus(hfs)
          .minus(Pv.div(gamma));
      }

      if (NPSHa.isNegative()) {
        Toast.show({
          type: 'error',
          text1: t('common.warning'),
          text2: t('energiaBernoulliCalc.toasts.negativeNPSHa') || 'NPSHa negativo - verifique los datos',
        });
      }

      setState((prev) => ({
        ...prev,
        invalidFields: [],
        autoCalculatedField: null,
        resultNPSHa: formatResult(NPSHa),
        resultCavitationMargin: '',
        resultPabs: formatResult(Pabs),
        resultGamma: gammaCalculado ? formatResult(gamma) : '',
        resultPv: PvCalculado ? formatResult(Pv) : '',
        resultTotalEnergy: '',
      }));

    } catch (error) {
      console.error('Error en cálculo de cavitación:', error);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('energiaBernoulliCalc.toasts.calculationError'),
      });
    }
  }, [state, formatResult, calculateVaporPressure, t]);

  // Lanza el cálculo correspondiente al modo activo
  const handleCalculate = useCallback(() => {
    switch (state.mode) {
      case 'ideal':
        calculateIdealBernoulli();
        break;
      case 'losses':
        calculateWithLosses();
        break;
      case 'cavitation':
        calculateCavitation();
        break;
    }
  }, [state.mode, calculateIdealBernoulli, calculateWithLosses, calculateCavitation]);

  // Limpia todos los campos y resultados manteniendo el modo activo
  const handleClear = useCallback(() => {
    const currentMode = state.mode;
    setState({
      ...initialState(),
      mode: currentMode,
      isManualEditAlpha2: false,
      unknownVariable: null,
    });
  }, [state.mode]);

  // Construye un resumen de datos y resultados y lo copia al portapapeles
  const handleCopy = useCallback(() => {
    let textToCopy = '';
    const formattedMain = state.resultTotalEnergy || '0';

    let modeText = '';
    switch (state.mode) {
      case 'ideal':
        modeText = t('energiaBernoulliCalc.mode.ideal');
        break;
      case 'losses':
        modeText = t('energiaBernoulliCalc.mode.losses');
        break;
      case 'cavitation':
        modeText = t('energiaBernoulliCalc.mode.cavitation');
        break;
    }

    if (state.mode === 'cavitation') {
      textToCopy += `${t('energiaBernoulliCalc.npsha')}: ${state.resultNPSHa} m\n`;
      if (state.resultCavitationMargin) {
        textToCopy += `${t('energiaBernoulliCalc.cavitationMargin')}: ${state.resultCavitationMargin} m\n`;
      }
      textToCopy += `${t('energiaBernoulliCalc.pabs')}: ${state.resultPabs} Pa\n`;

      if (state.resultGamma) {
        textToCopy += `γ: ${state.resultGamma} N/m³ (calculado)\n`;
      }
      if (state.resultPv) {
        textToCopy += `Pv: ${state.resultPv} Pa (calculado)\n`;
      }

      textToCopy += `\n${t('energiaBernoulliCalc.systemType')}: ${state.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto'}\n`;

      if (state.cavitationSystemType === 'closed') {
        textToCopy += `${t('energiaBernoulliCalc.labels.Ps')}: ${state.Ps} ${state.PsUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.Vs')}: ${state.Vs} ${state.VsUnit}\n`;
      } else {
        textToCopy += `${t('energiaBernoulliCalc.labels.Patm')}: ${state.Patm} ${state.PatmUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.z0')}: ${state.z0} ${state.z0Unit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.zs')}: ${state.zs} ${state.zsUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.hfs')}: ${state.hfs} ${state.hfsUnit}\n`;
      }
    } else {
      textToCopy += `${t('energiaBernoulliCalc.energyDifference')}: ${formattedMain} m\n`;
    }

    textToCopy += `${t('energiaBernoulliCalc.modec')}: ${modeText}\n\n`;
    textToCopy += `${t('energiaBernoulliCalc.section1')}\n`;

    textToCopy += `  P₁: ${state.isManualEditP1 ? state.P1 : state.resultP1 || state.P1} ${state.P1Unit}\n`;
    textToCopy += `  z₁: ${state.isManualEditz1 ? state.z1 : state.resultZ1 || state.z1} ${state.z1Unit}\n`;
    textToCopy += `  V₁: ${state.isManualEditV1 ? state.V1 : state.resultV1 || state.V1} ${state.V1Unit}\n`;

    if (state.alpha1 !== '1') {
      textToCopy += `  α₁: ${state.alpha1}\n`;
    }

    textToCopy += `${t('energiaBernoulliCalc.section2')}\n`;

    textToCopy += `  P₂: ${state.isManualEditP2 ? state.P2 : state.resultP2 || state.P2} ${state.P2Unit}\n`;
    textToCopy += `  z₂: ${state.isManualEditz2 ? state.z2 : state.resultZ2 || state.z2} ${state.z2Unit}\n`;
    textToCopy += `  V₂: ${state.isManualEditV2 ? state.V2 : state.resultV2 || state.V2} ${state.V2Unit}\n`;

    let alpha2Display = state.alpha2;
    if (state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2) {
      alpha2Display = state.resultAlpha2 || state.alpha2;
    }
    if (alpha2Display && alpha2Display !== '1' && alpha2Display !== '') {
      textToCopy += `  α₂: ${alpha2Display}\n`;
    }

    if (state.hb) {
      textToCopy += `${t('energiaBernoulliCalc.labels.hb')}: ${state.hb} ${state.hbUnit}\n`;
    }
    if (state.ht) {
      textToCopy += `${t('energiaBernoulliCalc.labels.ht')}: ${state.ht} ${state.htUnit}\n`;
    }
    
    if (state.mode === 'losses') {
      if (state.lossInputType === 'direct') {
        textToCopy += `${t('energiaBernoulliCalc.labels.hL')}: ${state.hL} ${state.hLUnit}\n`;
      } else {
        textToCopy += `${t('energiaBernoulliCalc.labels.L')}: ${state.L} ${state.LUnit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.D1')}: ${state.D1} ${state.D1Unit}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.f')}: ${state.f}\n`;
        textToCopy += `${t('energiaBernoulliCalc.labels.K')}: ${state.K}\n`;
      }
    }

    if (state.mode === 'cavitation') {
      textToCopy += `${t('energiaBernoulliCalc.temperatura')}: ${state.temperatura} ${state.temperaturaUnit}\n`;
      textToCopy += `${t('energiaBernoulliCalc.Pv')}: ${state.Pv || 'Calculada'} ${state.PvUnit}\n`;
    }

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('energiaBernoulliCalc.toasts.copied') });
  }, [state, formatResult, t]);

  // Guarda el cálculo actual en el historial local de la base de datos
  const handleSaveHistory = useCallback(async () => {
    const noResults = !state.unknownVariable?.value &&
      state.resultTotalEnergy === '' &&
      !state.resultP1 && !state.resultP2 &&
      !state.resultV1 && !state.resultV2 &&
      !state.resultZ1 && !state.resultZ2 &&
      !state.resultNPSHa;

    if (noResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('energiaBernoulliCalc.toasts.nothingToSave') });
      return;
    }

    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }

      const inputs = {
        mode: state.mode,
        unknownVariable: state.unknownVariable,
        P1: (state.autoCalculatedField === 'P1' && !state.isManualEditP1) ? state.resultP1 : state.P1,
        P1Unit: state.P1Unit,
        P2: (state.autoCalculatedField === 'P2' && !state.isManualEditP2) ? state.resultP2 : state.P2,
        P2Unit: state.P2Unit,
        z1: (state.autoCalculatedField === 'z1' && !state.isManualEditz1) ? state.resultZ1 : state.z1,
        z1Unit: state.z1Unit,
        z2: (state.autoCalculatedField === 'z2' && !state.isManualEditz2) ? state.resultZ2 : state.z2,
        z2Unit: state.z2Unit,
        V1: (state.autoCalculatedField === 'V1' && !state.isManualEditV1) ? state.resultV1 : state.V1,
        V1Unit: state.V1Unit,
        V2: (state.autoCalculatedField === 'V2' && !state.isManualEditV2) ? state.resultV2 : state.V2,
        V2Unit: state.V2Unit,
        gamma: state.gamma,
        gammaUnit: state.gammaUnit,
        g: state.g,
        gUnit: state.gUnit,
        alpha1: state.alpha1,
        alpha2: state.alpha2,
        hb: state.hb,
        hbUnit: state.hbUnit,
        ht: state.ht,
        htUnit: state.htUnit,
        ...(state.mode === 'losses' && {
          lossInputType: state.lossInputType,
          hL: state.hL,
          hLUnit: state.hLUnit,
          L: state.L,
          LUnit: state.LUnit,
          D1: state.D1,
          D1Unit: state.D1Unit,
          f: state.f,
          K: state.K,
        }),
        ...(state.mode === 'cavitation' && {
          cavitationSystemType: state.cavitationSystemType,
          Ps: state.Ps,
          PsUnit: state.PsUnit,
          Vs: state.Vs,
          VsUnit: state.VsUnit,
          Patm: state.Patm,
          PatmUnit: state.PatmUnit,
          z0: state.z0,
          z0Unit: state.z0Unit,
          zs: state.zs,
          zsUnit: state.zsUnit,
          hfs: state.hfs,
          hfsUnit: state.hfsUnit,
          temperatura: state.temperatura,
          temperaturaUnit: state.temperaturaUnit,
          Pv: state.Pv,
          PvUnit: state.PvUnit,
          useRhoForGamma: state.useRhoForGamma,
          useTempForPv: state.useTempForPv,
          resultNPSHa: state.resultNPSHa,
          resultCavitationMargin: state.resultCavitationMargin,
          resultPabs: state.resultPabs,
          resultGamma: state.resultGamma,
          resultPv: state.resultPv,
        }),
      };

      let resultToSave: string;

      if (state.mode === 'cavitation') {
        resultToSave = state.resultNPSHa || '0';
      } else {
        resultToSave = state.resultTotalEnergy || '0';
      }

      await saveCalculation(db, `EnergiaBernoulli_${state.mode}`, JSON.stringify(inputs), resultToSave);

      Toast.show({ type: 'success', text1: t('common.success'), text2: t('energiaBernoulliCalc.toasts.saved') });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('energiaBernoulliCalc.toasts.saveError') });
    }
  }, [state, formatResult, t]);

  // Navega a la pantalla de selección de unidades para el campo indicado
  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string, fieldLabel?: string) => {
    navigation.navigate({
      name: 'CalculatorOptionsScreen',
      params: buildCalculatorOptionsParams('energiaBernoulli', {
        category,
        onSelectOption,
        selectedOption,
        fieldLabel,
      }),
    });
  }, [navigation]);

  // ── Handlers del teclado personalizado ──────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    return (stateRef.current as any)[id] ?? '';
  }, []);

  const handleKeyboardKey = useCallback((key: string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const nextValue = appendKeyboardKey(getActiveValue(), key);
    if (nextValue !== null) {
      handler(nextValue);
    }
  }, []);

  const handleKeyboardDelete = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    handler(deleteKeyboardKey(getActiveValue()));
  }, []);

  const handleKeyboardClear = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    handler(clearKeyboardValue());
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const nextValue = insertScientificNotation(getActiveValue());
    if (nextValue !== null) {
      handler(nextValue);
    }
  }, []);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const nextValue = insertKeyboardMinus(getActiveValue());
    if (nextValue !== null) {
      handler(nextValue);
    }
  }, []);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    inputHandlersRef.current['alpha1'] = (text: string) => {
      setState((prev) => ({
        ...prev,
        alpha1: text,
        isManualEditAlpha1: true,
        invalidFields: prev.invalidFields.filter((f) => f !== 'alpha1'),
        autoCalculatedField:
          prev.autoCalculatedField === 'alpha1' ? null : prev.autoCalculatedField,
      }));
    };
    inputHandlersRef.current['alpha2'] = (text: string) => {
      setState((prev) => ({
        ...prev,
        alpha2: text,
        isManualEditAlpha2: true,
        invalidFields: prev.invalidFields.filter((f) => f !== 'alpha2'),
        autoCalculatedField:
          prev.autoCalculatedField === 'alpha2' ? null : prev.autoCalculatedField,
      }));
    };
  }, []);

  // Mapa de etiqueta de campo a su unidad activa, memoizado para no reconstruirse en cada render
  const unitMap = React.useMemo((): { [key: string]: string } => ({
    'P₁': state.P1Unit,
    'P₂': state.P2Unit,
    'z₁': state.z1Unit,
    'z₂': state.z2Unit,
    'V₁': state.V1Unit,
    'V₂': state.V2Unit,
    'D₁': state.D1Unit,
    'D₂': state.D2Unit,
    'ρ': state.rhoUnit,
    'γ': state.gammaUnit,
    'g': state.gUnit,
    'hB': state.hbUnit,
    'hT': state.htUnit,
    'hL': state.hLUnit,
    'L': state.LUnit,
    'T': state.temperaturaUnit,
    'Pv': state.PvUnit,
    'P_s': state.PsUnit,
    'V_s': state.VsUnit,
    'P_atm': state.PatmUnit,
    'z₀': state.z0Unit,
    'z_s': state.zsUnit,
    'h_fs': state.hfsUnit,
  }), [
    state.P1Unit, state.P2Unit, state.z1Unit, state.z2Unit,
    state.V1Unit, state.V2Unit, state.D1Unit, state.D2Unit,
    state.rhoUnit, state.gammaUnit, state.gUnit,
    state.hbUnit, state.htUnit, state.hLUnit, state.LUnit,
    state.temperaturaUnit, state.PvUnit, state.PsUnit, state.VsUnit,
    state.PatmUnit, state.z0Unit, state.zsUnit, state.hfsUnit,
  ]);

  // Renderiza un campo de entrada con etiqueta, indicador de estado y botón de unidades
  const renderInput = useCallback((
    label: string,
    value: string,
    onChange: (text: string) => void,
    setManualEdit: (value: boolean) => void,
    fieldId?: string,
    resultValue?: string,
    displayLabel?: string,
    unitProp?: string,
  ) => {
    const unit = unitProp || unitMap[label] || '';
    const shownLabel = displayLabel || label;

    const isFieldLocked = fieldId && state.lockedField === fieldId;
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    // Formatea el valor visible limitando decimales sin romper el separador del usuario
    const formatDisplayValue = (val: string): string => {
      if (!val || val === '') return val;
      if (val.includes('e')) return formatKeyboardDisplayValue(val);
        
      const lastChar = val.charAt(val.length - 1);
      if (lastChar === '.' || lastChar === ',') {
        return val;
      }
    
      if (val.includes('.') && val.split('.')[1] === '') {
        return val;
      }
      if (val.includes(',') && val.split(',')[1] === '') {
        return val;
      }
    
      const normalizedVal = val.replace(',', '.');
      
      if (normalizedVal === '0.0') {
        return selectedDecimalSeparator === 'Coma' ? '0,0' : '0.0';
      }
    
      let decNum: Decimal;
      try {
        decNum = new Decimal(normalizedVal);
      } catch {
        return val;
      }
      
      const decimalPart = normalizedVal.includes('.') ? normalizedVal.split('.')[1] : '';
      const userDecimalCount = decimalPart.length;
      
      if (userDecimalCount === 0) {
        const formatted0 = decNum.toFixed(0);
        return selectedDecimalSeparator === 'Coma'
          ? formatted0.replace('.', ',')
          : formatted0;
      }
      
      const formatted = decNum.toFixed(userDecimalCount);
      return selectedDecimalSeparator === 'Coma'
        ? formatted.replace('.', ',')
        : formatted;
    };

    // Registra el handler del campo para que el teclado lo use
    if (fieldId) {
      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setManualEdit(true);
        setState((prev) => {
          const next: Partial<CalculatorState> = {};
          if (fieldId) {
            next.invalidFields = prev.invalidFields.filter((f) => f !== fieldId);
            next.autoCalculatedField =
              prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField;
          }
          return { ...prev, ...next };
        });
      };
    }

    const rawDisplayValue = resultValue && resultValue !== '' ? resultValue : value;
    const displayValue = formatDisplayValue(rawDisplayValue);

    const id = fieldId || label;
    const hasUserValue = (value?.trim()?.length ?? 0) > 0;
    const isInvalid = state.invalidFields.includes(id);
    const isAutoCalculated =
      (id === state.autoCalculatedField) &&
      !hasUserValue &&
      (!!(resultValue && resultValue !== '') ||
        (state.autoCalculatedField === id && !hasUserValue));

    const dotColor = getDotColor(hasUserValue, isInvalid, isAutoCalculated);

    return (
      <View
        ref={(r) => { if (fieldId) inputRefs.current[fieldId] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.inputLabel,
              { color: themeColors.text, fontSize: 16 * fontSizeFactor }
            ]}
          >
            {shownLabel}
          </Text>
          <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: inputContainerBg }]}>
              <Pressable
                onPress={() => {
                  if (isFieldLocked || !fieldId) return;
                  setActiveInputId(fieldId);
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
            style={[
              styles.Container2,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
            onPress={() => {
              let category = 'length';
              if (label.includes('P')) category = 'pressure';
              else if (label.includes('V')) category = 'velocity';
              else if (label.includes('ρ')) category = 'density';
              else if (label.includes('γ')) category = 'specificWeight';
              else if (label === 'g') category = 'acceleration';
              else if (label === 'T') category = 'temperature';
              else if (label === 'P_v') category = 'pressure';

              navigateToOptions(category, (option: string) => {
                const updateUnit = (field: keyof CalculatorState, prevField: keyof CalculatorState, resultField?: keyof CalculatorState) => {
                  const inputValue = state[field] as string;
                  const prevUnit = state[prevField] as string;
                  const resultVal = resultField ? (state[resultField] as string) : '';
                  const convertedInputValue = convertValue(inputValue, prevUnit, option, category as any);
                  let convertedResultValue = resultVal;
                  if (resultVal && resultField) {
                    convertedResultValue = convertValue(resultVal, prevUnit, option, category as any);
                  }

                  setState((prev) => {
                    let updatedUnknown = prev.unknownVariable;
                    if (updatedUnknown && field === updatedUnknown.name) {
                      updatedUnknown = {
                        ...updatedUnknown,
                        unit: option,
                        value: convertedResultValue || updatedUnknown.value
                      };
                    }

                    return {
                      ...prev,
                      [field]: convertedInputValue,
                      [prevField]: option,
                      [`${field}Unit`]: option,
                      ...(resultField && convertedResultValue ? { [resultField]: convertedResultValue } as any : {}),
                      unknownVariable: updatedUnknown,
                    };
                  });
                };

                switch (label) {
                  case 'P₁': updateUnit('P1', 'prevP1Unit', 'resultP1'); break;
                  case 'P₂': updateUnit('P2', 'prevP2Unit', 'resultP2'); break;
                  case 'z₁': updateUnit('z1', 'prevZ1Unit', 'resultZ1'); break;
                  case 'z₂': updateUnit('z2', 'prevZ2Unit', 'resultZ2'); break;
                  case 'V₁': updateUnit('V1', 'prevV1Unit', 'resultV1'); break;
                  case 'V₂': updateUnit('V2', 'prevV2Unit', 'resultV2'); break;
                  case 'D₁': updateUnit('D1', 'prevD1Unit'); break;
                  case 'D₂': updateUnit('D2', 'prevD2Unit'); break;
                  case 'ρ': updateUnit('rho', 'prevRhoUnit'); break;
                  case 'γ': updateUnit('gamma', 'prevGammaUnit'); break;
                  case 'g': updateUnit('g', 'prevGUnit'); break;
                  case 'hB': updateUnit('hb', 'prevHbUnit'); break;
                  case 'hT': updateUnit('ht', 'prevHtUnit'); break;
                  case 'hL': updateUnit('hL', 'prevHLUnit'); break;
                  case 'L': updateUnit('L', 'prevLUnit'); break;
                  case 'T': updateUnit('temperatura', 'prevTemperaturaUnit'); break;
                  case 'P_v': updateUnit('Pv', 'prevPvUnit'); break;
                  case 'P_s': updateUnit('Ps', 'prevPsUnit'); break;
                  case 'V_s': updateUnit('Vs', 'prevVsUnit'); break;
                  case 'P_atm': updateUnit('Patm', 'prevPatmUnit'); break;
                  case 'z₀': updateUnit('z0', 'prevZ0Unit'); break;
                  case 'z_s': updateUnit('zs', 'prevZsUnit'); break;
                  case 'h_fs': updateUnit('hfs', 'prevHfsUnit'); break;
                  default: break;
                }
              }, unit, label);
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
  }, [state, unitMap, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor, selectedDecimalSeparator, setActiveInputId]);

  // Mide ancho y posición de los botones del selector de tipo de pérdida para la animación
  const onLayoutDirect = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLossButtonPositions((prev) => ({ ...prev, direct: x }));
    setLossButtonMetrics((prev) => ({ ...prev, direct: width }));
  }, []);

  const onLayoutDarcy = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLossButtonPositions((prev) => ({ ...prev, darcy: x }));
    setLossButtonMetrics((prev) => ({ ...prev, darcy: width }));
  }, []);

  // Selector animado entre pérdida directa (hL) y parámetros de Darcy-Weisbach
  const renderLossTypeSelector = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.lossInputType')}
      </Text>
      <View style={styles.lossButtonContainer}>
        <Animated.View
          style={[
            styles.lossOverlay,
            {
              experimental_backgroundImage: themeColors.gradient,
              width: state.lossInputType === 'direct' ? lossButtonMetrics.direct : lossButtonMetrics.darcy,
              transform: [{ translateX: animatedLossValue }, { scale: animatedLossScale }],
            },
          ]}
        >
          <View style={[styles.lossOverlayInner, { backgroundColor: themeColors.card }]}></View>
        </Animated.View>

        <Pressable
          onLayout={onLayoutDirect}
          style={[styles.lossButton, state.lossInputType === 'direct' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, lossInputType: 'direct' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.direct')}
          </Text>
        </Pressable>

        <Pressable
          onLayout={onLayoutDarcy}
          style={[styles.lossButton, state.lossInputType === 'darcy' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, lossInputType: 'darcy' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.darcy')}
          </Text>
        </Pressable>
      </View>
    </View>
  ), [themeColors, t, fontSizeFactor, state.lossInputType, lossButtonMetrics, lossButtonPositions, animatedLossValue, animatedLossScale, onLayoutDirect, onLayoutDarcy]);

  // Mide ancho y posición de los botones del selector de sistema en cavitación para la animación
  const onLayoutClosed = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setCavitationButtonPositions((prev) => ({ ...prev, closed: x }));
    setCavitationButtonMetrics((prev) => ({ ...prev, closed: width }));
  }, []);

  const onLayoutOpen = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setCavitationButtonPositions((prev) => ({ ...prev, open: x }));
    setCavitationButtonMetrics((prev) => ({ ...prev, open: width }));
  }, []);

  // Selector animado entre sistema cerrado y abierto en el modo cavitación
  const renderSystemTypeSelector = useCallback(() => (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.systemType')}
      </Text>
      <View style={styles.lossButtonContainer}>
        <Animated.View
          style={[
            styles.lossOverlay,
            {
              experimental_backgroundImage: themeColors.gradient,
              width: state.cavitationSystemType === 'closed' ? cavitationButtonMetrics.closed : cavitationButtonMetrics.open,
              transform: [{ translateX: animatedCavitationValue }, { scale: animatedCavitationScale }],
            },
          ]}
        >
          <View style={[styles.lossOverlayInner, { backgroundColor: themeColors.card }]}></View>
        </Animated.View>

        <Pressable
          onLayout={onLayoutClosed}
          style={[styles.lossButton, state.cavitationSystemType === 'closed' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, cavitationSystemType: 'closed' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.closed') || 'Cerrado'}
          </Text>
        </Pressable>

        <Pressable
          onLayout={onLayoutOpen}
          style={[styles.lossButton, state.cavitationSystemType === 'open' ? styles.selectedLossButton : styles.unselectedLossButton]}
          onPress={() => setState(prev => ({ ...prev, cavitationSystemType: 'open' }))}
        >
          <Text style={[styles.lossButtonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.open') || 'Abierto'}
          </Text>
        </Pressable>
      </View>
    </View>
  ), [themeColors, t, fontSizeFactor, state.cavitationSystemType, cavitationButtonMetrics, cavitationButtonPositions, animatedCavitationValue, animatedCavitationScale]);

  // Campos de entrada del modo Bernoulli ideal: presiones, cotas, velocidades y coeficientes alpha
  const renderIdealInputs = useCallback(() => (
    <>
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section1')}
      </Text>
      {renderInput('P₁', state.P1, (text) => setState((prev) => ({ ...prev, P1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditP1: val })),
        'P1', state.isManualEditP1 ? state.P1 : state.resultP1, `${t('energiaBernoulliCalc.labels.P1') || 'Presión'} (P₁)`)}

      {renderInput('z₁', state.z1, (text) => setState((prev) => ({ ...prev, z1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditz1: val })),
        'z1', state.isManualEditz1 ? state.z1 : state.resultZ1, `${t('energiaBernoulliCalc.labels.z1') || 'Altura'} (z₁)`)}

      {renderInput('V₁', state.V1, (text) => setState((prev) => ({ ...prev, V1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditV1: val })),
        'V1', state.isManualEditV1 ? state.V1 : state.resultV1, `${t('energiaBernoulliCalc.labels.V1') || 'Velocidad'} (V₁)`)}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section2')}
      </Text>
      {renderInput('P₂', state.P2, (text) => setState((prev) => ({ ...prev, P2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditP2: val })),
        'P2', state.isManualEditP2 ? state.P2 : state.resultP2, `${t('energiaBernoulliCalc.labels.P2') || 'Presión'} (P₂)`)}

      {renderInput('z₂', state.z2, (text) => setState((prev) => ({ ...prev, z2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditz2: val })),
        'z2', state.isManualEditz2 ? state.z2 : state.resultZ2, `${t('energiaBernoulliCalc.labels.z2') || 'Altura'} (z₂)`)}

      {renderInput('V₂', state.V2, (text) => setState((prev) => ({ ...prev, V2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditV2: val })),
        'V2', state.isManualEditV2 ? state.V2 : state.resultV2, `${t('energiaBernoulliCalc.labels.V2') || 'Velocidad'} (V₂)`)}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>
      {renderInput('γ', state.gamma, (text) => setState((prev) => ({ ...prev, gamma: text })), () => {}, 'gamma', undefined, `${t('energiaBernoulliCalc.labels.gamma') || 'Peso específico'} (γ)`)}
      {renderInput('g', state.g, (text) => setState((prev) => ({ ...prev, g: text })), () => {}, 'g', undefined, `${t('energiaBernoulliCalc.labels.g') || 'Gravedad'} (g)`)}

      <View
        ref={(r) => { inputRefs.current['alpha1'] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.labels.alpha1')}
          </Text>
          <View style={[styles.valueDot, {
            backgroundColor: getDotColor(
              state.alpha1?.trim()?.length > 0,
              state.invalidFields.includes('alpha1'),
              state.autoCalculatedField === 'alpha1' && !state.isManualEditAlpha1
            )
          }]} />
        </View>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              {
                experimental_backgroundImage: themeColors.gradient,
                width: '100%',
                flex: undefined
              }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: state.lockedField === 'alpha1' ? themeColors.blockInput : themeColors.card }]}>
              <Pressable
                onPress={() => {
                  if (state.lockedField === 'alpha1') return;
                  setActiveInputId('alpha1');
                }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                value={formatKeyboardDisplayValue(state.alpha1)}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
        </View>
      </View>

      <View
        ref={(r) => { inputRefs.current['alpha2'] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.labels.alpha2')}
          </Text>
          <View style={[styles.valueDot, {
            backgroundColor: getDotColor(
              state.alpha2?.trim()?.length > 0,
              state.invalidFields.includes('alpha2'),
              state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2 && !!state.resultAlpha2
            )
          }]} />
        </View>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              {
                experimental_backgroundImage: themeColors.gradient,
                width: '100%',
                flex: undefined
              }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: state.lockedField === 'alpha2' ? themeColors.blockInput : themeColors.card }]}>
              <Pressable
                onPress={() => {
                  if (state.lockedField === 'alpha2') return;
                  setActiveInputId('alpha2');
                }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                value={formatKeyboardDisplayValue(state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2 ? state.resultAlpha2 || state.alpha2 : state.alpha2)}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  ), [renderInput, state.P1, state.P2, state.z1, state.z2, state.V1, state.V2, state.gamma, state.g, state.alpha1, state.alpha2, state.isManualEditP1, state.isManualEditP2, state.isManualEditz1, state.isManualEditz2, state.isManualEditV1, state.isManualEditV2, state.resultP1, state.resultP2, state.resultZ1, state.resultZ2, themeColors, t, fontSizeFactor, currentTheme, setActiveInputId]);

  // Campos del modo pérdidas: extiende el modo ideal con bomba, turbina y pérdidas
  const renderLossesInputs = useCallback(() => (
    <>
      {renderIdealInputs()}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.pumpTurbine')}
      </Text>

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.includeBomba') || 'Incluir Bomba'}
          value={state.includeBomba}
          onValueChange={(value) => setState(prev => ({ ...prev, includeBomba: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
          currentTheme={currentTheme}
        />
      </View>
      {state.includeBomba && renderInput('hB', state.hb,
        (text) => setState((prev) => ({ ...prev, hb: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditHb: val })),
        'hb', state.isManualEditHb ? state.hb : undefined,
        `${t('energiaBernoulliCalc.labels.hb') || 'Altura de bomba'} (hᴮ)`)}

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.includeTurbina') || 'Incluir Turbina'}
          value={state.includeTurbina}
          onValueChange={(value) => setState(prev => ({ ...prev, includeTurbina: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
          currentTheme={currentTheme}
        />
      </View>
      {state.includeTurbina && renderInput('hT', state.ht,
        (text) => setState((prev) => ({ ...prev, ht: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditHt: val })),
        'ht', state.isManualEditHt ? state.ht : undefined,
        `${t('energiaBernoulliCalc.labels.ht') || 'Altura de turbina'} (hᵀ)`)}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.losses')}
      </Text>

      {renderLossTypeSelector()}

      {state.lossInputType === 'direct' ? (
        renderInput('hL', state.hL,
          (text) => setState((prev) => ({ ...prev, hL: text })),
          (val) => setState((prev) => ({ ...prev, isManualEditHL: val })),
          'hL', state.isManualEditHL ? state.hL : undefined,
          `${t('energiaBernoulliCalc.labels.hL') || 'Pérdida de carga'} (hᴸ)`)
      ) : (
        <>
          {renderInput('L', state.L, (text) => setState((prev) => ({ ...prev, L: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditL: val })),
            'L', state.autoCalculatedField === 'L' && !state.isManualEditL ? state.L : undefined,
            `${t('energiaBernoulliCalc.labels.L') || 'Longitud'} (L)`)}
          {renderInput('D₁', state.D1, (text) => setState((prev) => ({ ...prev, D1: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditD1: val })),
            'D1', state.autoCalculatedField === 'D1' && !state.isManualEditD1 ? state.D1 : undefined,
            `${t('energiaBernoulliCalc.labels.D1') || 'Diámetro'} (D)`)}
          <View style={styles.inputWrapper}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('energiaBernoulliCalc.labels.f')}
              </Text>
              <View style={[styles.valueDot, {
                backgroundColor: getDotColor(
                  state.f?.trim()?.length > 0,
                  state.invalidFields.includes('f'),
                  state.autoCalculatedField === 'f' && !(state.f?.trim()?.length > 0)
                )
              }]} />
            </View>
            <Pressable
              onPress={() => {
                if (state.lockedField === 'f') return;
                setActiveInputId('f');
              }}
            >
              <TextInput
                style={[styles.simpleInput, {
                  color: themeColors.text,
                  fontSize: 16 * fontSizeFactor,
                  backgroundColor: state.lockedField === 'f' ? themeColors.blockInput : themeColors.card
                }]}
                value={formatKeyboardDisplayValue(state.f)}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </Pressable>
          </View>
          <View style={styles.inputWrapper}>
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('energiaBernoulliCalc.labels.K')}
              </Text>
              <View style={[styles.valueDot, {
                backgroundColor: getDotColor(
                  state.K?.trim()?.length > 0,
                  state.invalidFields.includes('K'),
                  state.autoCalculatedField === 'K' && !(state.K?.trim()?.length > 0)
                )
              }]} />
            </View>
            <Pressable
              onPress={() => {
                if (state.lockedField === 'K') return;
                setActiveInputId('K');
              }}
            >
              <TextInput
                style={[styles.simpleInput, {
                  color: themeColors.text,
                  fontSize: 16 * fontSizeFactor,
                  backgroundColor: state.lockedField === 'K' ? themeColors.blockInput : themeColors.card
                }]}
                value={formatKeyboardDisplayValue(state.K)}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </Pressable>
          </View>
        </>
      )}
    </>
  ), [renderIdealInputs, renderInput, renderLossTypeSelector, state.includeBomba, state.includeTurbina, state.hb, state.ht, state.hL, state.L, state.D1, state.f, state.K, state.isManualEditHb, state.isManualEditHt, state.isManualEditHL, state.lossInputType, themeColors, t, fontSizeFactor, currentTheme, setActiveInputId]);

  // Campos de entrada del análisis de cavitación según el tipo de sistema
  const renderCavitationInputs = useCallback(() => (
    <>
      {renderSystemTypeSelector()}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      {state.cavitationSystemType === 'closed' ? (
        <>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.closedSystem') || 'Sistema Cerrado'}
          </Text>

          {renderInput('P_s', state.Ps,
            (text) => setState((prev) => ({ ...prev, Ps: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditPs: val })),
            'Ps', state.isManualEditPs ? state.Ps : undefined,
            `${t('energiaBernoulliCalc.labels.Ps') || 'Presión en succión'} (Pˢ)`,
            state.PsUnit)}

          {renderInput('V_s', state.Vs,
            (text) => setState((prev) => ({ ...prev, Vs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditVs: val })),
            'Vs', state.isManualEditVs ? state.Vs : undefined,
            `${t('energiaBernoulliCalc.labels.Vs') || 'Velocidad en succión'} (Vˢ)`,
            state.VsUnit)}
        </>
      ) : (
        <>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('energiaBernoulliCalc.openSystem') || 'Sistema Abierto'}
          </Text>

          {renderInput('P_atm', state.Patm,
            (text) => setState((prev) => ({ ...prev, Patm: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditPatm: val })),
            'Patm', state.isManualEditPatm ? state.Patm : undefined,
            `${t('energiaBernoulliCalc.labels.Patm') || 'Presión atmosférica'} (Pᵃᵗᵐ)`,
            state.PatmUnit)}

          {renderInput('z₀', state.z0,
            (text) => setState((prev) => ({ ...prev, z0: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditz0: val })),
            'z0', state.isManualEditz0 ? state.z0 : undefined,
            `${t('energiaBernoulliCalc.labels.z0') || 'Nivel del líquido'} (z₀)`,
            state.z0Unit)}

          {renderInput('z_s', state.zs,
            (text) => setState((prev) => ({ ...prev, zs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditzs: val })),
            'zs', state.isManualEditzs ? state.zs : undefined,
            `${t('energiaBernoulliCalc.labels.zs') || 'Elevación en succión'} (zˢ)`,
            state.zsUnit)}

          {renderInput('h_fs', state.hfs,
            (text) => setState((prev) => ({ ...prev, hfs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEdithfs: val })),
            'hfs', state.isManualEdithfs ? state.hfs : undefined,
            `${t('energiaBernoulliCalc.labels.hfs') || 'Pérdida en succión'} (hᶠˢ)`,
            state.hfsUnit)}
        </>
      )}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.useRhoForGamma') || 'Usar densidad (ρ) en lugar de peso específico (γ)'}
          value={state.useRhoForGamma}
          onValueChange={(value) => setState(prev => ({ ...prev, useRhoForGamma: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
          currentTheme={currentTheme}
        />
      </View>

      {state.useRhoForGamma ? (
        renderInput('ρ', state.rho,
          (text) => setState((prev) => ({ ...prev, rho: text })),
          () => {}, 'rho', undefined,
          `${t('energiaBernoulliCalc.labels.rho') || 'Densidad'} (ρ)`, state.rhoUnit)
      ) : (
        renderInput('γ', state.gamma,
          (text) => setState((prev) => ({ ...prev, gamma: text })),
          () => {}, 'gamma', undefined,
          `${t('energiaBernoulliCalc.labels.gamma') || 'Peso específico'} (γ)`, state.gammaUnit)
      )}

      {renderInput('g', state.g,
        (text) => setState((prev) => ({ ...prev, g: text })),
        () => {}, 'g', undefined,
        `${t('energiaBernoulliCalc.labels.g') || 'Gravedad'} (g)`, state.gUnit)}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.vaporPressure') || 'Presión de Vapor'}
      </Text>

      <View style={styles.checkboxRow}>
        <Checkbox
          label={t('energiaBernoulliCalc.useTempForPv') || 'Calcular Pv desde temperatura'}
          value={state.useTempForPv}
          onValueChange={(value) => setState(prev => ({ ...prev, useTempForPv: value }))}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
          currentTheme={currentTheme}
        />
      </View>

      {state.useTempForPv ? (
        renderInput('T', state.temperatura,
          (text) => setState((prev) => ({ ...prev, temperatura: text })),
          () => {}, 'temperatura', undefined,
          `${t('energiaBernoulliCalc.labels.temperatura') || 'Temperatura'} (T)`, state.temperaturaUnit)
      ) : (
        renderInput('P_v', state.Pv,
          (text) => setState((prev) => ({ ...prev, Pv: text })),
          () => {}, 'Pv', undefined,
          `${t('energiaBernoulliCalc.labels.Pv') || 'Presión de vapor'} (Pv)`, state.PvUnit)
      )}
    </>
  ), [renderInput, renderSystemTypeSelector, state.cavitationSystemType, state.Ps, state.Vs, state.Patm, state.z0, state.zs, state.hfs, state.useRhoForGamma, state.rho, state.gamma, state.g, state.useTempForPv, state.temperatura, state.Pv, state.isManualEditPs, state.isManualEditVs, state.isManualEditPatm, state.isManualEditz0, state.isManualEditzs, state.isManualEdithfs, themeColors, t, fontSizeFactor, currentTheme]);

  // Mide ancho y posición de los botones del selector de modo principal para la animación
  const onLayoutIdeal = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, ideal: x }));
    setButtonMetrics((prev) => ({ ...prev, ideal: width }));
  }, []);

  const onLayoutLosses = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, losses: x }));
    setButtonMetrics((prev) => ({ ...prev, losses: width }));
  }, []);

  const onLayoutCavitation = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions((prev) => ({ ...prev, cavitation: x }));
    setButtonMetrics((prev) => ({ ...prev, cavitation: width }));
  }, []);

  // Genera la etiqueta del panel de resultado según el modo y el estado del cálculo
  const getMainResultLabel = useCallback(() => {
    if (state.unknownVariable) {
      const unit = state.unknownVariable.unit ? ` (${state.unknownVariable.unit})` : '';
      return `${state.unknownVariable.label} ${unit}`;
    }

    switch (state.mode) {
      case 'losses':
        return t('energiaBernoulliCalc.energyDifference');
      case 'cavitation': {
        if (!state.resultNPSHa || state.resultNPSHa === '') {
          return t('energiaBernoulliCalc.npsha') || 'NPSHa';
        }

        const margin = new Decimal(state.resultCavitationMargin || '0');

        if (margin.greaterThan(new Decimal('0.5'))) {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.safe') || 'Seguro'}`;
        } else if (margin.greaterThan(new Decimal('0'))) {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.lowMargin') || 'Margen bajo'}`;
        } else {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.cavitationRisk') || '¡RIESGO!'}`;
        }
      }
      default:
        return t('energiaBernoulliCalc.result');
    }
  }, [state.mode, state.unknownVariable, state.resultNPSHa, state.resultCavitationMargin, t]);

  // Indica si la etiqueta del resultado debe mostrarse como placeholder por falta de cálculo
  const shouldShowPlaceholderLabel = useCallback(() => {
    if (state.unknownVariable) {
      return false;
    }
    if (state.mode === 'ideal') {
      return true;
    }
    return state.resultTotalEnergy === '' && !state.resultNPSHa;
  }, [state.mode, state.unknownVariable, state.resultTotalEnergy, state.resultNPSHa]);

  // Retorna el valor numérico principal para mostrar en el panel de resultados
  const getMainResultValue = useCallback(() => {
    if (state.unknownVariable) {
      return state.unknownVariable.value || '0';
    }

    switch (state.mode) {
      case 'cavitation':
        return state.resultNPSHa || '0';
      default:
        return state.resultTotalEnergy || '0';
    }
  }, [state.mode, state.unknownVariable, state.resultNPSHa, state.resultTotalEnergy]);

  const isKeyboardOpen = !!activeInputId;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInset={{ bottom: isKeyboardOpen ? 280 : 0 }}
      >
        {/* Cabecera: retroceso, favorito y acceso a la teoría */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => {
                  bounceHeart();
                  toggleFavorite();
                }}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <IconFavorite
                    name={isFav ? "heart" : "heart-o"}
                    size={20}
                    color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                  />
                </Animated.View>
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('EnergiaBernoulliTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Nombre y subtítulo de la pantalla */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('energiaBernoulliCalc.calculator')}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('energiaBernoulliCalc.title')}</Text>
        </View>

        {/* Panel principal de resultado */}
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
                  <FastImage
                    source={backgroundImage}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {currentTheme === 'dark' && (
                    <View
                      pointerEvents="none"
                      style={{
                        ...StyleSheet.absoluteFillObject as any,
                        backgroundColor: 'rgba(0,0,0,0.7)'
                      }}
                    />
                  )}
                  <View style={styles.caudalLabel}>
                    <Text
                      style={[
                        styles.flowLabel,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 16 * fontSizeFactor }
                      ]}
                    >
                      {shouldShowPlaceholderLabel() ? 'な' : getMainResultLabel()}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                      ]}
                    >
                      {getMainResultValue() === '0' ? '一' : adjustDecimalSeparator(formatDecimalWithPrecision(new Decimal(getMainResultValue())))}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Botones de acción: Calcular, Copiar, Limpiar e Historial */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'zap', label: t('common.calculate'), action: handleCalculate },
            { icon: 'copy', label: t('common.copy'), action: handleCopy },
            { icon: 'trash', label: t('common.clear'), action: handleClear },
            { icon: 'clock', label: t('common.history'), action: () => navigation.navigate('HistoryScreenEnergiaBernoulli') },
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

        {/* Sección de entradas con selector de modo y formulario dinámico */}
        <View
          style={[
            styles.inputsSection,
            {
              backgroundColor: themeColors.card,
              paddingBottom: isKeyboardOpen ? 330 : 70,
            }
          ]}
        >
          <View style={styles.buttonContainer}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  experimental_backgroundImage: themeColors.gradient,
                  width: state.mode === 'ideal' ? buttonMetrics.ideal : state.mode === 'losses' ? buttonMetrics.losses : buttonMetrics.cavitation,
                  transform: [{ translateX: animatedValue }, { scale: animatedScale }],
                },
              ]}
            >
              <View style={[styles.overlayInner, { backgroundColor: themeColors.card }]}></View>
            </Animated.View>

            <Pressable
              onLayout={onLayoutIdeal}
              style={[styles.button, state.mode === 'ideal' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({
                ...prev,
                mode: 'ideal',
                unknownVariable: null,
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.ideal')}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutLosses}
              style={[styles.button, state.mode === 'losses' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({
                ...prev,
                mode: 'losses',
                unknownVariable: null,
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.losses')}
              </Text>
            </Pressable>

            <Pressable
              onLayout={onLayoutCavitation}
              style={[styles.button, state.mode === 'cavitation' ? styles.selectedButton : styles.unselectedButton]}
              onPress={() => setState((prev) => ({
                ...prev,
                mode: 'cavitation',
                unknownVariable: null,
              }))}
            >
              <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >
                {t('energiaBernoulliCalc.mode.cavitation')}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.separator2, { backgroundColor: themeColors.separator }]} />
          <View style={styles.inputsContainer}>
            {state.mode === 'ideal' && renderIdealInputs()}
            {state.mode === 'losses' && renderLossesInputs()}
            {state.mode === 'cavitation' && renderCavitationInputs()}
          </View>
          <View>
            <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                {t('energiaBernoulliCalc.infoText')}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.logoContainer}>
          <FastImage
            source={currentTheme === 'dark' ? logoDark : logoLight}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>
      </ScrollView>

      {/* Teclado personalizado fuera del ScrollView para quedar siempre visible */}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)'
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
    lineHeight: 30,
    marginBottom: 10,
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
  simpleInput: {
    height: 50,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
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
  lossButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    position: 'relative',
    height: 50,
    marginTop: 5,
  },
  lossButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    marginHorizontal: 5,
    height: 50,
    zIndex: 2,
  },
  selectedLossButton: {
    backgroundColor: 'transparent',
  },
  unselectedLossButton: {
    backgroundColor: 'transparent',
  },
  lossButtonText: {
    color: 'rgb(0,0,0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    zIndex: 1,
  },
  lossOverlay: {
    position: 'absolute',
    height: 50,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    zIndex: 0,
    padding: 1,
  },
  lossOverlayInner: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 25,
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
  // ── Teclado personalizado ────────────────────────────────────────────────────
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

export default EnergiaBernoulliCalc;





