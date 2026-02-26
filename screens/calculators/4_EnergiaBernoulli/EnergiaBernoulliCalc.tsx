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
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import IconCheck from 'react-native-vector-icons/Octicons';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import Decimal from 'decimal.js';
import { getDBConnection, createTable, saveCalculation, createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// Rutas disponibles desde esta pantalla
type RootStackParamList = {
  OptionsScreenEnergiaBernoulli: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenEnergiaBernoulli: undefined;
  EnergiaBernoulliTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

type CalculatorMode = 'ideal' | 'losses' | 'cavitation';

interface CalculatorState {
  mode: CalculatorMode;

  // Campos de la ecuación de energía para los puntos 1 y 2
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

  // Campos específicos del modo con pérdidas
  lossInputType: 'direct' | 'darcy';
  hL: string;
  L: string;
  f: string;
  K: string;

  // Campos específicos del análisis de cavitación
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

  // Unidades seleccionadas para cada campo
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

  // Unidades previas para poder aplicar la conversión correcta al cambiar de unidad
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

  // Valores calculados por la calculadora
  resultTotalEnergy: number;
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

  // Indican si el usuario ha editado manualmente cada campo (o si fue auto-calculado)
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

// Factores de conversión a unidades SI para cada categoría de magnitud física
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
  velocity: {
    'm/s': 1,
    'km/h': 0.2777777777777778,
    'ft/s': 0.3048,
    'mph': 0.44704,
    'kn': 0.5144444444444445,
    'cm/s': 0.01,
    'in/s': 0.0254,
  },
  area: {
    'm²': 1,
    'cm²': 0.0001,
    'mm²': 0.000001,
    'km²': 1000000,
    'ha': 10000,
    'in²': 0.00064516,
    'ft²': 0.09290304,
    'yd²': 0.83612736,
    'mi²': 2589988.110336,
    'acre': 4046.8564224,
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
    'N/m³': 1,
  },
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,
    'lb/ft³': 16.018463373,
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,
    'g': 9.80665,
  },
  temperature: {
    '°C': 1,
    '°F': 1,
    'K': 1,
  },
  specificWeight: {
    'N/m³': 1,
    'kN/m³': 1000,
    'lbf/ft³': 157.08746061538463,
  },
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

// Apariencia personalizada de los mensajes Toast de éxito y error
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

// Valores por defecto de todos los campos al iniciar o limpiar la calculadora
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
  gamma: '9810',
  g: '9.81',
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

  resultTotalEnergy: 0,
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

// Componente de casilla de verificación para activar opciones como bomba o turbina
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

// Retorna el color del indicador de estado de un campo según si fue editado, tiene error o fue calculado
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

// Componente principal que contiene toda la lógica y la interfaz de la calculadora de Bernoulli
const EnergiaBernoulliCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);

  // Paleta de colores que se recalcula solo cuando el tema cambia
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

  // Valores de animación para el selector de modo principal
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;

  // Valor de animación para el rebote del corazón de favorito
  const heartScale = useRef(new Animated.Value(1)).current;

  // Valores de animación para el selector de tipo de pérdida
  const animatedLossValue = useRef(new Animated.Value(0)).current;
  const animatedLossScale = useRef(new Animated.Value(1)).current;

  // Valores de animación para el selector cerrado/abierto en modo cavitación
  const animatedCavitationValue = useRef(new Animated.Value(0)).current;
  const animatedCavitationScale = useRef(new Animated.Value(1)).current;

  // Tamaños y posiciones de los botones del selector de modo principal
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

  // Tamaños y posiciones de los botones del selector de tipo de pérdida
  const [lossButtonMetrics, setLossButtonMetrics] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });
  const [lossButtonPositions, setLossButtonPositions] = useState<{ direct: number; darcy: number }>({
    direct: 0,
    darcy: 0,
  });

  // Tamaños y posiciones de los botones del selector de sistema cerrado/abierto en cavitación
  const [cavitationButtonMetrics, setCavitationButtonMetrics] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });
  const [cavitationButtonPositions, setCavitationButtonPositions] = useState<{ closed: number; open: number }>({
    closed: 0,
    open: 0,
  });

  // Referencia a la conexión de base de datos y estado del botón de favorito
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  // Al montar el componente, se conecta a la base de datos y consulta si esta calculadora está en favoritos
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

  // Agrega o quita esta calculadora de favoritos y muestra un Toast de confirmación
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

  // Pequeña animación de rebote sobre el ícono de corazón al tocar favorito
  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  // Mueve el indicador deslizante del selector de modo cuando el usuario cambia entre Ideal, Pérdidas y Cavitación
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

  // Mueve el indicador deslizante del selector de tipo de pérdida entre Directo y Darcy
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

  // Mueve el indicador deslizante del selector de sistema entre Cerrado y Abierto
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

  // Convierte un número a texto eliminando los ceros decimales innecesarios
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    const decimalNum = new Decimal(num);
    const fixed = decimalNum.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  // Convierte un valor numérico de una unidad de medida a otra dentro de la misma categoría
  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'length' | 'velocity' | 'area' | 'pressure' | 'density' | 'acceleration' | 'temperature' | 'specificWeight'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;

    const decimalValue = new Decimal(cleanValue);

    if (category === 'temperature') {
      if (fromUnit === '°C' && toUnit === '°F') {
        return formatResult(decimalValue.mul(9).div(5).plus(32).toNumber());
      } else if (fromUnit === '°C' && toUnit === 'K') {
        return formatResult(decimalValue.plus(273.15).toNumber());
      } else if (fromUnit === '°F' && toUnit === '°C') {
        return formatResult(decimalValue.minus(32).mul(5).div(9).toNumber());
      } else if (fromUnit === '°F' && toUnit === 'K') {
        return formatResult(decimalValue.minus(32).mul(5).div(9).plus(273.15).toNumber());
      } else if (fromUnit === 'K' && toUnit === '°C') {
        return formatResult(decimalValue.minus(273.15).toNumber());
      } else if (fromUnit === 'K' && toUnit === '°F') {
        return formatResult(decimalValue.minus(273.15).mul(9).div(5).plus(32).toNumber());
      }
      return value;
    }

    const fromFactor = conversionFactors[category]?.[fromUnit];
    const toFactor = conversionFactors[category]?.[toUnit];
    if (!fromFactor || !toFactor) return value;

    const convertedValue = decimalValue
      .mul(new Decimal(fromFactor))
      .div(new Decimal(toFactor))
      .toNumber();

    return formatResult(convertedValue);
  }, [formatResult]);

  // Aplica la preferencia de separador decimal del usuario al texto formateado
  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Calcula la presión de vapor del agua para una temperatura dada usando la ecuación de Wagner
  const calculateVaporPressure = useCallback((temp: number, unit: string): number => {
    let tempC: number;

    if (unit === '°F') {
      tempC = (temp - 32) * 5 / 9;
    } else if (unit === 'K') {
      tempC = temp - 273.15;
    } else {
      tempC = temp;
    }

    if (tempC < 0 || tempC > 374) {
      console.warn(`Temperatura fuera de rango (0-374°C): ${tempC}°C`);
    }

    const Tc = 647.096;
    const Pc = 22064000;

    const Tk = tempC + 273.15;
    const Tr = Tk / Tc;
    const tau = 1 - Tr;

    const a = [-7.85951783, 1.84408259, -11.7866497, 22.6807411, -15.9618719, 1.80122502];

    const lnPr = (a[0] * tau +
      a[1] * Math.pow(tau, 1.5) +
      a[2] * Math.pow(tau, 3) +
      a[3] * Math.pow(tau, 3.5) +
      a[4] * Math.pow(tau, 4) +
      a[5] * Math.pow(tau, 7.5)) / Tr;

    const Pv = Pc * Math.exp(lnPr);

    return Pv;
  }, []);

  // Detecta cuál campo debe quedar bloqueado en modo ideal cuando hay exactamente 7 de 8 campos llenos
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
      value !== '' && !isNaN(parseFloat(value.replace(',', '.')))
    );

    if (validInputs.length === 7) {
      const emptyInput = inputs.find(({ value }) =>
        value === '' || isNaN(parseFloat(value.replace(',', '.')))
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.V1, state.z1, state.P2, state.V2, state.z2, state.alpha1, state.alpha2]);

  // Detecta cuál campo debe quedar bloqueado en modo con pérdidas, considerando los campos opcionales activos
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
      value && value.trim() !== '' && !isNaN(parseFloat(value.replace(',', '.')))
    );

    if (validInputs.length === allRequiredFields.length - 1) {
      const emptyInput = allRequiredFields.find(({ value }) =>
        !value || value.trim() === '' || isNaN(parseFloat(value.replace(',', '.')))
      );
      setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedField: null }));
    }
  }, [state.P1, state.z1, state.V1, state.P2, state.z2, state.V2, state.rho, state.g,
    state.alpha1, state.alpha2, state.includeBomba, state.includeTurbina, state.hb, state.ht,
    state.lossInputType, state.hL, state.L, state.D1, state.f, state.K]);

  // Calcula la pérdida de carga según si el usuario ingresó el valor directo o los parámetros de Darcy-Weisbach
  const calculateHeadLoss = useCallback((
    siValues: { [key: string]: Decimal },
    getVal: (id: string, defaultValue: Decimal) => Decimal,
    twoG: Decimal
  ): Decimal => {
    if (state.lossInputType === 'direct') {
      return getVal('hL', new Decimal(0));
    } else {
      const L = getVal('L', new Decimal(0));
      const D1 = getVal('D1', new Decimal(1));
      const f = getVal('f', new Decimal(0));
      const K = getVal('K', new Decimal(0));
      const V1 = getVal('V1', new Decimal(0));

      const vSquaredOver2g = V1.pow(2).div(twoG);
      const frictionLoss = f.mul(L.div(D1)).mul(vSquaredOver2g);
      const minorLoss = K.mul(vSquaredOver2g);
      return frictionLoss.plus(minorLoss);
    }
  }, [state.lossInputType]);

  // Despeja el parámetro faltante de la ecuación de Darcy-Weisbach (L, D1, f o K)
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
    const leftSide = getVal('P1', new Decimal(0)).div(rhoG)
      .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z1', new Decimal(0)))
      .plus(getVal('hb', new Decimal(0)));

    const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
      .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z2', new Decimal(0)))
      .plus(getVal('ht', new Decimal(0)));

    const hL_total = leftSide.minus(rightSide);

    switch (missingField) {
      case 'L': {
        const V1 = getVal('V1', new Decimal(0));
        const D1 = getVal('D1', new Decimal(1));
        const f = getVal('f', new Decimal(0));
        const K = getVal('K', new Decimal(0));

        const vSquaredOver2g = V1.pow(2).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);

        if (f.greaterThan(0) && !vSquaredOver2g.isZero()) {
          const L_si = hL_total.minus(minorLoss)
            .mul(D1)
            .div(f.mul(vSquaredOver2g));

          const result = L_si.div(new Decimal(conversionFactors.length[state.LUnit] || 1));
          newState.L = formatResult(result.toNumber());
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
        const V1 = getVal('V1', new Decimal(0));
        const L = getVal('L', new Decimal(0));
        const f = getVal('f', new Decimal(0));
        const K = getVal('K', new Decimal(0));

        const vSquaredOver2g = V1.pow(2).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);
        const numerator = f.mul(L).mul(vSquaredOver2g);
        const denominator = hL_total.minus(minorLoss);

        if (denominator.greaterThan(0)) {
          const D_si = numerator.div(denominator);
          const result = D_si.div(new Decimal(conversionFactors.length[state.D1Unit] || 1));
          newState.D1 = formatResult(result.toNumber());
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
        const V1 = getVal('V1', new Decimal(0));
        const L = getVal('L', new Decimal(0));
        const D1 = getVal('D1', new Decimal(1));
        const K = getVal('K', new Decimal(0));

        const vSquaredOver2g = V1.pow(2).div(twoG);
        const minorLoss = K.mul(vSquaredOver2g);
        const numerator = hL_total.minus(minorLoss).mul(D1);
        const denominator = L.mul(vSquaredOver2g);

        if (!denominator.isZero()) {
          const f_si = numerator.div(denominator);
          newState.f = formatResult(f_si.toNumber());
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
        const V1 = getVal('V1', new Decimal(0));
        const L = getVal('L', new Decimal(0));
        const D1 = getVal('D1', new Decimal(1));
        const f = getVal('f', new Decimal(0));

        const vSquaredOver2g = V1.pow(2).div(twoG);
        const frictionLoss = f.mul(L.div(D1)).mul(vSquaredOver2g);
        const numerator = hL_total.minus(frictionLoss);

        if (!vSquaredOver2g.isZero()) {
          const K_si = numerator.div(vSquaredOver2g);
          newState.K = formatResult(K_si.toNumber());
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

  // Despeja el campo faltante general de la ecuación de energía: puede ser presión, velocidad, cota, hB, hT o alpha
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
    fmt: (num: number) => string,
    translate: any
  ): boolean => {
    const leftSide = getVal('P1', new Decimal(0)).div(rhoG)
      .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z1', new Decimal(0)))
      .plus(getVal('hb', new Decimal(0)));

    const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
      .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z2', new Decimal(0)))
      .plus(getVal('ht', new Decimal(0)))
      .plus(calculateHeadLoss(siValues, getVal, twoG));

    switch (missingField) {
      case 'P1': {
        const rightMinusLeft = rightSide
          .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('z1', new Decimal(0)))
          .minus(getVal('hb', new Decimal(0)));

        const pressureSI = rightMinusLeft.mul(rhoG);
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[stateSnap.P1Unit] || 1));
        newState.resultP1 = fmt(result.toNumber());
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
          .minus(getVal('P1', new Decimal(0)).div(rhoG))
          .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('hb', new Decimal(0)));

        const result = elevationSI.div(new Decimal(conversionFactors.length[stateSnap.z1Unit] || 1));
        newState.resultZ1 = fmt(result.toNumber());
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
          .minus(getVal('P1', new Decimal(0)).div(rhoG))
          .minus(getVal('z1', new Decimal(0)))
          .minus(getVal('hb', new Decimal(0)));

        if (rightTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = rightTerm.mul(twoG).div(alpha1).sqrt();
          const result = velocitySI.div(new Decimal(conversionFactors.velocity[stateSnap.V1Unit] || 1));
          newState.resultV1 = fmt(result.toNumber());
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
          .minus(getVal('P1', new Decimal(0)).div(rhoG))
          .minus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('z1', new Decimal(0)));

        const result = headSI.div(new Decimal(conversionFactors.length[stateSnap.hbUnit] || 1));
        newState.hb = fmt(result.toNumber());
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
          .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('z2', new Decimal(0)))
          .minus(getVal('ht', new Decimal(0)))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const pressureSI = leftMinusRight.mul(rhoG);
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[stateSnap.P2Unit] || 1));
        newState.resultP2 = fmt(result.toNumber());
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
          .minus(getVal('P2', new Decimal(0)).div(rhoG))
          .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('ht', new Decimal(0)))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const result = elevationSI.div(new Decimal(conversionFactors.length[stateSnap.z2Unit] || 1));
        newState.resultZ2 = fmt(result.toNumber());
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
          .minus(getVal('P2', new Decimal(0)).div(rhoG))
          .minus(getVal('z2', new Decimal(0)))
          .minus(getVal('ht', new Decimal(0)))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        if (leftMinusRight.greaterThanOrEqualTo(0)) {
          const velocitySI = leftMinusRight.mul(twoG).div(alpha2).sqrt();
          const result = velocitySI.div(new Decimal(conversionFactors.velocity[stateSnap.V2Unit] || 1));
          newState.resultV2 = fmt(result.toNumber());
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
          .minus(getVal('P2', new Decimal(0)).div(rhoG))
          .minus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
          .minus(getVal('z2', new Decimal(0)))
          .minus(calculateHeadLoss(siValues, getVal, twoG));

        const result = headSI.div(new Decimal(conversionFactors.length[stateSnap.htUnit] || 1));
        newState.ht = fmt(result.toNumber());
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
            .minus(getVal('P1', new Decimal(0)).div(rhoG))
            .minus(getVal('z1', new Decimal(0)))
            .minus(getVal('hb', new Decimal(0)));

          const V1 = getVal('V1', new Decimal(0));
          if (rightTerm.greaterThan(0) && !V1.isZero()) {
            const alpha1_calc = rightTerm.mul(twoG).div(V1.pow(2));
            const formattedResult = fmt(alpha1_calc.toNumber());
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
            .minus(getVal('P2', new Decimal(0)).div(rhoG))
            .minus(getVal('z2', new Decimal(0)))
            .minus(getVal('ht', new Decimal(0)))
            .minus(calculateHeadLoss(siValues, getVal, twoG));

          const V2 = getVal('V2', new Decimal(0));
          if (leftTerm.greaterThan(0) && !V2.isZero()) {
            const alpha2_calc = leftTerm.mul(twoG).div(V2.pow(2));
            const formattedResult = fmt(alpha2_calc.toNumber());
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

  // Ejecuta el cálculo de Bernoulli ideal: identifica el único campo vacío y lo resuelve algebraicamente
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
        if (rawValue === '' || isNaN(parseFloat(rawValue))) {
          return { ...field, siValue: null, isValid: false };
        }
        return { ...field, siValue: new Decimal(rawValue), isValid: true };
      }
    
      const rawValue = field.value.replace(',', '.');
      if (rawValue === '' || isNaN(parseFloat(rawValue))) {
        return { ...field, siValue: null, isValid: false };
      }
    
      const numValue = new Decimal(rawValue);
      const factor = conversionFactors[field.category]?.[field.unit] || 1;
      const factorDecimal = new Decimal(factor);
      return { ...field, siValue: numValue.mul(factorDecimal), isValid: true };
    });
  
    const validFields = fieldsInSI.filter(f => f.isValid);
    const missingFields = fieldsInSI.filter(f => !f.isValid).map(f => f.id);
    const validCount = validFields.length;
  
    let gammaDecimal = new Decimal(9810);
    if (state.gamma && !isNaN(parseFloat(state.gamma.replace(',', '.')))) {
      gammaDecimal = new Decimal(state.gamma.replace(',', '.'))
        .mul(new Decimal(conversionFactors.pressure[state.gammaUnit] || 1));
    }
  
    let gDecimal = new Decimal(9.81);
    if (state.g && !isNaN(parseFloat(state.g.replace(',', '.')))) {
      gDecimal = new Decimal(state.g.replace(',', '.'))
        .mul(new Decimal(conversionFactors.acceleration[state.gUnit] || 1));
    }
  
    if (validCount !== 7) {
      setState((prev) => ({
        ...prev,
        resultTotalEnergy: 0,
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
  
    const alpha1 = siValues['alpha1'] !== undefined ? siValues['alpha1'] : new Decimal(1);
    const alpha2 = siValues['alpha2'] !== undefined ? siValues['alpha2'] : new Decimal(1);

    // Se pre-calcula 2g una sola vez para reutilizarlo en todos los casos del switch
    const twoG = new Decimal(2).mul(gDecimal);
  
    switch (missingField) {
      case 'P1': {
        if (siValues['V1'] === undefined || siValues['z1'] === undefined) break;
        if (siValues['P2'] === undefined || siValues['V2'] === undefined || siValues['z2'] === undefined) break;
      
        const E2 = siValues['P2'].div(gammaDecimal)
          .plus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
          .plus(siValues['z2']);
      
        const headTerm = E2
          .minus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
          .minus(siValues['z1']);
      
        const pressureSI = headTerm.mul(gammaDecimal);
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P1Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
          .plus(siValues['z2']);
      
        const headTerm = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);
      
        if (headTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = headTerm
            .mul(twoG)
            .div(alpha1)
            .sqrt();
        
          const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V1Unit] || 1));
          const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
          .plus(siValues['z2']);
      
        const elevationSI = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(alpha1.mul(siValues['V1'].pow(2)).div(twoG));
      
        const result = elevationSI.div(new Decimal(conversionFactors.length[state.z1Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
          .plus(siValues['z1']);
      
        const headTerm = E1
          .minus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
          .minus(siValues['z2']);
      
        const pressureSI = headTerm.mul(gammaDecimal);
        const result = pressureSI.div(new Decimal(conversionFactors.pressure[state.P2Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
          .plus(siValues['z1']);
      
        const headTerm = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);
      
        if (headTerm.greaterThanOrEqualTo(0)) {
          const velocitySI = headTerm
            .mul(twoG)
            .div(alpha2)
            .sqrt();
        
          const result = velocitySI.div(new Decimal(conversionFactors.velocity[state.V2Unit] || 1));
          const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
          .plus(siValues['z1']);
      
        const elevationSI = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(alpha2.mul(siValues['V2'].pow(2)).div(twoG));
      
        const result = elevationSI.div(new Decimal(conversionFactors.length[state.z2Unit] || 1));
        const formattedResult = formatResult(result.toNumber());
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
          .plus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
          .plus(siValues['z2']);
      
        const energyTerm = E2
          .minus(siValues['P1'].div(gammaDecimal))
          .minus(siValues['z1']);
      
        if (energyTerm.greaterThan(0) && !siValues['V1'].isZero()) {
          const alpha1_calc = energyTerm
            .mul(twoG)
            .div(siValues['V1'].pow(2));
        
          const formattedResult = formatResult(alpha1_calc.toNumber());
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
          .plus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
          .plus(siValues['z1']);
      
        const energyTerm = E1
          .minus(siValues['P2'].div(gammaDecimal))
          .minus(siValues['z2']);
      
        if (energyTerm.greaterThan(0) && !siValues['V2'].isZero()) {
          const alpha2_calc = energyTerm
            .mul(twoG)
            .div(siValues['V2'].pow(2));
        
          const formattedResult = formatResult(alpha2_calc.toNumber());
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
  
    // Una vez resuelto el campo faltante, se calcula la diferencia de energía entre puntos 1 y 2
    const hasAllP1 = siValues['P1'] !== undefined;
    const hasAllV1 = siValues['V1'] !== undefined;
    const hasAllz1 = siValues['z1'] !== undefined;
    const hasAllP2 = siValues['P2'] !== undefined;
    const hasAllV2 = siValues['V2'] !== undefined;
    const hasAllz2 = siValues['z2'] !== undefined;
  
    if (hasAllP1 && hasAllV1 && hasAllz1 && hasAllP2 && hasAllV2 && hasAllz2) {
      const E1 = siValues['P1'].div(gammaDecimal)
        .plus(alpha1.mul(siValues['V1'].pow(2)).div(twoG))
        .plus(siValues['z1']);
    
      const E2 = siValues['P2'].div(gammaDecimal)
        .plus(alpha2.mul(siValues['V2'].pow(2)).div(twoG))
        .plus(siValues['z2']);
    
      const energyDifference = E1.minus(E2);
    
      newState.resultTotalEnergy = energyDifference.toNumber();
    } else {
      newState.resultTotalEnergy = 0;
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

  // Retorna la lista de campos que se requieren para el modo con pérdidas según la configuración actual
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

  // Ejecuta el cálculo de energía con pérdidas, bomba y turbina, resolviendo el único campo vacío
  const calculateWithLosses = useCallback(() => {
    const requiredFieldIds = getRequiredFieldsForLosses(state);

    const fieldsInSI = requiredFieldIds.map(field => {
      const config = fieldConfigs[field.id] || { category: 'none', unit: '' };
      if (!config) return { ...field, siValue: null, isValid: false };

      const rawValue = (state as any)[field.id]?.replace(',', '.');
      if (!rawValue || rawValue === '' || isNaN(parseFloat(rawValue))) {
        return { ...field, siValue: null, isValid: false };
      }

      const numValue = new Decimal(rawValue);
      if (config.category === 'none') {
        return { ...field, siValue: numValue, isValid: true };
      }

      const factor = conversionFactors[config.category]?.[config.unit];
      const factorDecimal = factor ? new Decimal(factor) : new Decimal(1);
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
        resultTotalEnergy: 0,
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

    const rho = getVal('rho', new Decimal(1000));
    const g = getVal('g', new Decimal(9.81));
    const rhoG = rho.mul(g);
    const alpha1 = getVal('alpha1', new Decimal(1));
    const alpha2 = getVal('alpha2', new Decimal(1));
    const twoG = new Decimal(2).mul(g);

    // Se calcula la diferencia de energía antes de resolver el campo desconocido
    const leftSide = getVal('P1', new Decimal(0)).div(rhoG)
      .plus(alpha1.mul(getVal('V1', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z1', new Decimal(0)))
      .plus(getVal('hb', new Decimal(0)));

    const rightSide = getVal('P2', new Decimal(0)).div(rhoG)
      .plus(alpha2.mul(getVal('V2', new Decimal(0)).pow(2)).div(twoG))
      .plus(getVal('z2', new Decimal(0)))
      .plus(getVal('ht', new Decimal(0)))
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
        const result = hL_si.div(new Decimal(conversionFactors.length[state.hLUnit] || 1));
        newState.hL = formatResult(result.toNumber());
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
        resultTotalEnergy: energyDifference.toNumber(),
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

  // Calcula el NPSHa y el margen de seguridad contra la cavitación para el sistema configurado
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
        return !val || val.trim() === '' || isNaN(parseFloat(val));
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

      const getDecimalValue = (id: string, category: string, defaultUnit: string): Decimal => {
        const rawValue = (state as any)[id]?.replace(',', '.') || '0';
        const unit = (state as any)[`${id}Unit`] || defaultUnit;
        const value = new Decimal(rawValue);

        if (category === 'none' || !unit) return value;

        const factor = conversionFactors[category]?.[unit];
        return factor ? value.mul(new Decimal(factor)) : value;
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
        const temp = parseFloat(state.temperatura.replace(',', '.'));
        const tempUnit = state.temperaturaUnit;
        const PvNumber = calculateVaporPressure(temp, tempUnit);
        Pv = new Decimal(PvNumber);
        PvCalculado = true;
      } else {
        Pv = getDecimalValue('Pv', 'pressure', 'Pa');
      }

      let NPSHa: Decimal;
      let Pabs: Decimal = new Decimal(0);

      if (state.cavitationSystemType === 'closed') {
        const Ps = getDecimalValue('Ps', 'pressure', 'Pa');
        const Vs = getDecimalValue('Vs', 'velocity', 'm/s');

        Pabs = Ps;

        const velocityHead = Vs.pow(2).div(new Decimal(2).mul(g));
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

      const safetyMargin = new Decimal(0.5);
      const cavitationMargin = NPSHa.minus(safetyMargin);

      setState((prev) => ({
        ...prev,
        invalidFields: [],
        autoCalculatedField: null,
        resultNPSHa: formatResult(NPSHa.toNumber()),
        resultCavitationMargin: formatResult(cavitationMargin.toNumber()),
        resultPabs: formatResult(Pabs.toNumber()),
        resultGamma: gammaCalculado ? formatResult(gamma.toNumber()) : '',
        resultPv: PvCalculado ? formatResult(Pv.toNumber()) : '',
        resultTotalEnergy: cavitationMargin.toNumber(),
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

  // Lanza el cálculo correspondiente según el modo activo
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

  // Limpia todos los campos y resultados manteniendo el modo de cálculo actual
  const handleClear = useCallback(() => {
    const currentMode = state.mode;
    setState({
      ...initialState(),
      mode: currentMode,
      isManualEditAlpha2: false,
      unknownVariable: null,
    });
  }, [state.mode]);

  // Construye el texto resumen de todos los datos y resultados y lo copia al portapapeles
  const handleCopy = useCallback(() => {
    let textToCopy = '';
    const mainValue = state.resultTotalEnergy;
    const formattedMain = isNaN(mainValue) ? '0' : formatResult(mainValue);

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
      textToCopy += `${t('energiaBernoulliCalc.cavitationMargin')}: ${formattedMain} m\n`;
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

  // Guarda el cálculo actual en el historial de la base de datos local
  const handleSaveHistory = useCallback(async () => {
    const noResults = !state.unknownVariable?.value &&
      state.resultTotalEnergy === 0 &&
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
        resultToSave = state.resultNPSHa || formatResult(state.resultTotalEnergy);
      } else {
        resultToSave = formatResult(state.resultTotalEnergy);
      }

      await saveCalculation(db, `EnergiaBernoulli_${state.mode}`, JSON.stringify(inputs), resultToSave);

      Toast.show({ type: 'success', text1: t('common.success'), text2: t('energiaBernoulliCalc.toasts.saved') });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('energiaBernoulliCalc.toasts.saveError') });
    }
  }, [state, formatResult, t]);

  // Navega a la pantalla de selección de unidades para el campo indicado
  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenEnergiaBernoulli', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Renderiza un campo de entrada completo con etiqueta, indicador de estado y botón de unidades
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
    const unitMap: { [key: string]: string } = {
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
    };

    const unit = unitProp || unitMap[label] || '';
    const shownLabel = displayLabel || label;

    const isFieldLocked = fieldId && state.lockedField === fieldId;
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    // Limita la cantidad de decimales visibles a 5 sin romper el separador decimal del usuario
    const formatDisplayValue = (val: string): string => {
      if (!val || val === '') return val;

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
      const num = parseFloat(normalizedVal);

      if (isNaN(num)) return val;

      const formatted = num.toFixed(8).replace(/\.?0+$/, '');
      return selectedDecimalSeparator === 'Coma' ? formatted.replace('.', ',') : formatted;
    };

    // Al escribir se actualiza el valor y se borra el error de validación del campo
    const handleTextChange = (text: string) => {
      onChange(text);
      setManualEdit(true);
      if (fieldId) {
        setState((prev) => ({
          ...prev,
          invalidFields: prev.invalidFields.filter((f) => f !== fieldId),
          autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
          unknownVariable: prev.unknownVariable?.name === fieldId ? null : prev.unknownVariable,
        }));
      }
    };

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
      <View style={styles.inputWrapper}>
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
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={displayValue}
                onChangeText={handleTextChange}
                onBlur={() => {
                  if (value && value !== '') {
                    const formatted = formatDisplayValue(value);
                    if (formatted !== value) {
                      onChange(formatted);
                    }
                  }
                }}
                editable={!isFieldLocked}
                selectTextOnFocus={!isFieldLocked}
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
              }, unit);
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
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor, selectedDecimalSeparator]);

  // Mide el ancho y posición de cada botón del selector de tipo de pérdida para la animación
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

  // Selector animado que permite elegir entre ingreso de pérdida directa (hL) o por Darcy-Weisbach
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

  // Mide el ancho y posición de cada botón del selector de sistema en cavitación para la animación
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

  // Selector animado que permite elegir entre sistema cerrado y sistema abierto en el modo cavitación
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

  // Muestra los campos de entrada para el modo Bernoulli ideal: presiones, cotas, velocidades y coeficientes alpha
  const renderIdealInputs = useCallback(() => (
    <>
      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section1')}
      </Text>
      {renderInput('P₁', state.P1, (text) => setState((prev) => ({ ...prev, P1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditP1: val })),
        'P1', state.isManualEditP1 ? state.P1 : state.resultP1, t('energiaBernoulliCalc.labels.P1'))}

      {renderInput('z₁', state.z1, (text) => setState((prev) => ({ ...prev, z1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditz1: val })),
        'z1', state.isManualEditz1 ? state.z1 : state.resultZ1, t('energiaBernoulliCalc.labels.z1'))}

      {renderInput('V₁', state.V1, (text) => setState((prev) => ({ ...prev, V1: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditV1: val })),
        'V1', state.isManualEditV1 ? state.V1 : state.resultV1, t('energiaBernoulliCalc.labels.V1'))}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.section2')}
      </Text>
      {renderInput('P₂', state.P2, (text) => setState((prev) => ({ ...prev, P2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditP2: val })),
        'P2', state.isManualEditP2 ? state.P2 : state.resultP2, t('energiaBernoulliCalc.labels.P2'))}

      {renderInput('z₂', state.z2, (text) => setState((prev) => ({ ...prev, z2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditz2: val })),
        'z2', state.isManualEditz2 ? state.z2 : state.resultZ2, t('energiaBernoulliCalc.labels.z2'))}

      {renderInput('V₂', state.V2, (text) => setState((prev) => ({ ...prev, V2: text })),
        (val) => setState((prev) => ({ ...prev, isManualEditV2: val })),
        'V2', state.isManualEditV2 ? state.V2 : state.resultV2, t('energiaBernoulliCalc.labels.V2'))}

      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
        {t('energiaBernoulliCalc.fluidProps')}
      </Text>
      {renderInput('γ', state.gamma, (text) => setState((prev) => ({ ...prev, gamma: text })), () => {}, 'gamma', undefined, t('energiaBernoulliCalc.labels.gamma'))}
      {renderInput('g', state.g, (text) => setState((prev) => ({ ...prev, g: text })), () => {}, 'g', undefined, t('energiaBernoulliCalc.labels.g'))}

      <View style={styles.inputWrapper}>
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
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={state.alpha1}
                onChangeText={(text) => {
                  setState((prev) => ({
                    ...prev,
                    alpha1: text,
                    isManualEditAlpha1: true,
                    invalidFields: prev.invalidFields.filter((f) => f !== 'alpha1'),
                    autoCalculatedField: prev.autoCalculatedField === 'alpha1' ? null : prev.autoCalculatedField,
                  }));
                }}
                onBlur={() => {
                  if (state.alpha1 && state.alpha1 !== '') {
                    const normalized = state.alpha1.replace(',', '.');
                    const num = parseFloat(normalized);
                    if (!isNaN(num)) {
                      const formatted = num.toFixed(8).replace(/\.?0+$/, '');
                      const finalValue = selectedDecimalSeparator === 'Coma' ? formatted.replace('.', ',') : formatted;
                      if (finalValue !== state.alpha1) {
                        setState(prev => ({ ...prev, alpha1: finalValue }));
                      }
                    }
                  }
                }}
                editable={state.lockedField !== 'alpha1'}
                selectTextOnFocus={state.lockedField !== 'alpha1'}
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.inputWrapper}>
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
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={state.autoCalculatedField === 'alpha2' && !state.isManualEditAlpha2 ? state.resultAlpha2 || state.alpha2 : state.alpha2}
                onChangeText={(text) => {
                  setState((prev) => ({
                    ...prev,
                    alpha2: text,
                    isManualEditAlpha2: true,
                    invalidFields: prev.invalidFields.filter((f) => f !== 'alpha2'),
                    autoCalculatedField: prev.autoCalculatedField === 'alpha2' ? null : prev.autoCalculatedField,
                  }));
                }}
                onBlur={() => {
                  if (state.alpha2 && state.alpha2 !== '') {
                    const normalized = state.alpha2.replace(',', '.');
                    const num = parseFloat(normalized);
                    if (!isNaN(num)) {
                      const formatted = num.toFixed(8).replace(/\.?0+$/, '');
                      const finalValue = selectedDecimalSeparator === 'Coma' ? formatted.replace('.', ',') : formatted;
                      if (finalValue !== state.alpha2) {
                        setState(prev => ({ ...prev, alpha2: finalValue }));
                      }
                    }
                  }
                }}
                editable={state.lockedField !== 'alpha2'}
                selectTextOnFocus={state.lockedField !== 'alpha2'}
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  ), [renderInput, state.P1, state.P2, state.z1, state.z2, state.V1, state.V2, state.gamma, state.g, state.alpha1, state.alpha2, state.isManualEditP1, state.isManualEditP2, state.isManualEditz1, state.isManualEditz2, state.isManualEditV1, state.isManualEditV2, state.resultP1, state.resultP2, state.resultZ1, state.resultZ2, themeColors, t, fontSizeFactor, currentTheme]);

  // Muestra los campos del modo con pérdidas, extendiendo el modo ideal con bomba, turbina y pérdidas
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
        t('energiaBernoulliCalc.labels.hb')
      )}

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
        t('energiaBernoulliCalc.labels.ht')
      )}

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
          t('energiaBernoulliCalc.labels.hL')
        )
      ) : (
        <>
          {renderInput('L', state.L, (text) => setState((prev) => ({ ...prev, L: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditL: val })),
            'L', state.autoCalculatedField === 'L' && !state.isManualEditL ? state.L : undefined,
            t('energiaBernoulliCalc.labels.L'))}
          {renderInput('D₁', state.D1, (text) => setState((prev) => ({ ...prev, D1: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditD1: val })),
            'D1', state.autoCalculatedField === 'D1' && !state.isManualEditD1 ? state.D1 : undefined,
            t('energiaBernoulliCalc.labels.D1'))}
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
            <TextInput
              style={[styles.simpleInput, {
                color: themeColors.text,
                fontSize: 16 * fontSizeFactor,
                backgroundColor: state.lockedField === 'f' ? themeColors.blockInput : themeColors.card
              }]}
              keyboardType="numeric"
              value={state.f}
              onChangeText={(text) => setState((prev) => ({
                ...prev,
                f: text,
                isManualEditF: true,
                invalidFields: prev.invalidFields.filter((f) => f !== 'f'),
                autoCalculatedField: prev.autoCalculatedField === 'f' ? null : prev.autoCalculatedField,
              }))}
              editable={state.lockedField !== 'f'}
              selectTextOnFocus={state.lockedField !== 'f'}
              placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
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
            <TextInput
              style={[styles.simpleInput, {
                color: themeColors.text,
                fontSize: 16 * fontSizeFactor,
                backgroundColor: state.lockedField === 'K' ? themeColors.blockInput : themeColors.card
              }]}
              keyboardType="numeric"
              value={state.K}
              onChangeText={(text) => setState((prev) => ({
                ...prev,
                K: text,
                isManualEditK: true,
                invalidFields: prev.invalidFields.filter((f) => f !== 'K'),
                autoCalculatedField: prev.autoCalculatedField === 'K' ? null : prev.autoCalculatedField,
              }))}
              editable={state.lockedField !== 'K'}
              selectTextOnFocus={state.lockedField !== 'K'}
              placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </View>
        </>
      )}
    </>
  ), [renderIdealInputs, renderInput, renderLossTypeSelector, state.includeBomba, state.includeTurbina, state.hb, state.ht, state.hL, state.L, state.D1, state.f, state.K, state.isManualEditHb, state.isManualEditHt, state.isManualEditHL, state.lossInputType, themeColors, t, fontSizeFactor, currentTheme]);

  // Muestra los campos de entrada específicos del análisis de cavitación según el tipo de sistema
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
            t('energiaBernoulliCalc.labels.Ps') || 'Presión en succión',
            state.PsUnit)}

          {renderInput('V_s', state.Vs,
            (text) => setState((prev) => ({ ...prev, Vs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditVs: val })),
            'Vs', state.isManualEditVs ? state.Vs : undefined,
            t('energiaBernoulliCalc.labels.Vs') || 'Velocidad en succión',
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
            t('energiaBernoulliCalc.labels.Patm') || 'Presión atmosférica',
            state.PatmUnit)}

          {renderInput('z₀', state.z0,
            (text) => setState((prev) => ({ ...prev, z0: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditz0: val })),
            'z0', state.isManualEditz0 ? state.z0 : undefined,
            t('energiaBernoulliCalc.labels.z0') || 'Nivel del líquido',
            state.z0Unit)}

          {renderInput('z_s', state.zs,
            (text) => setState((prev) => ({ ...prev, zs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEditzs: val })),
            'zs', state.isManualEditzs ? state.zs : undefined,
            t('energiaBernoulliCalc.labels.zs') || 'Elevación en succión',
            state.zsUnit)}

          {renderInput('h_fs', state.hfs,
            (text) => setState((prev) => ({ ...prev, hfs: text })),
            (val) => setState((prev) => ({ ...prev, isManualEdithfs: val })),
            'hfs', state.isManualEdithfs ? state.hfs : undefined,
            t('energiaBernoulliCalc.labels.hfs') || 'Pérdida en succión',
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
          t('energiaBernoulliCalc.labels.rho') || 'Densidad', state.rhoUnit)
      ) : (
        renderInput('γ', state.gamma,
          (text) => setState((prev) => ({ ...prev, gamma: text })),
          () => {}, 'gamma', undefined,
          t('energiaBernoulliCalc.labels.gamma'), state.gammaUnit)
      )}

      {renderInput('g', state.g,
        (text) => setState((prev) => ({ ...prev, g: text })),
        () => {}, 'g', undefined,
        t('energiaBernoulliCalc.labels.g'), state.gUnit)}

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
          t('energiaBernoulliCalc.labels.temperatura'), state.temperaturaUnit)
      ) : (
        renderInput('P_v', state.Pv,
          (text) => setState((prev) => ({ ...prev, Pv: text })),
          () => {}, 'Pv', undefined,
          t('energiaBernoulliCalc.labels.Pv'), state.PvUnit)
      )}
    </>
  ), [renderInput, renderSystemTypeSelector, state.cavitationSystemType, state.Ps, state.Vs, state.Patm, state.z0, state.zs, state.hfs, state.useRhoForGamma, state.rho, state.gamma, state.g, state.useTempForPv, state.temperatura, state.Pv, state.isManualEditPs, state.isManualEditVs, state.isManualEditPatm, state.isManualEditz0, state.isManualEditzs, state.isManualEdithfs, themeColors, t, fontSizeFactor, currentTheme]);

  // Mide el ancho y posición de cada botón del selector de modo principal para la animación
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

  // Genera el texto de la etiqueta del panel de resultado según el modo y el estado del cálculo
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

        const margin = parseFloat(state.resultCavitationMargin || '0');

        if (margin > 0.5) {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.safe') || 'Seguro'}`;
        } else if (margin > 0) {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.lowMargin') || 'Margen bajo'}`;
        } else {
          return `${t('energiaBernoulliCalc.npsha') || 'NPSHa'} - ${t('energiaBernoulliCalc.cavitationRisk') || '¡RIESGO!'}`;
        }
      }
      default:
        return t('energiaBernoulliCalc.result');
    }
  }, [state.mode, state.unknownVariable, state.resultNPSHa, state.resultCavitationMargin, t]);

  // Indica si la etiqueta del resultado debe mostrarse como un placeholder porque no hay nada calculado
  const shouldShowPlaceholderLabel = useCallback(() => {
    if (state.unknownVariable) {
      return false;
    }
    if (state.mode === 'ideal') {
      return true;
    }
    return state.resultTotalEnergy === 0 && !state.resultNPSHa;
  }, [state.mode, state.unknownVariable, state.resultTotalEnergy, state.resultNPSHa]);

  // Retorna el valor numérico principal a mostrar en el panel de resultados
  const getMainResultValue = useCallback(() => {
    if (state.unknownVariable) {
      return state.unknownVariable.value || '0';
    }

    switch (state.mode) {
      case 'cavitation':
        return state.resultNPSHa || '0';
      default:
        return formatResult(state.resultTotalEnergy) || '0';
    }
  }, [state.mode, state.unknownVariable, state.resultNPSHa, state.resultTotalEnergy, formatResult]);

  return (
    <View style={styles.safeArea}>
      <KeyboardAwareScrollView
        bottomOffset={50}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Cabecera con botón de retroceso, favorito y acceso a la teoría */}
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

        {/* Panel principal de resultado con imagen de fondo */}
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
                      {adjustDecimalSeparator(formatNumber(parseFloat(getMainResultValue())))}
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
            { icon: 'terminal', label: t('common.calculate'), action: handleCalculate },
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

        {/* Sección de campos de entrada con selector de modo y formulario dinámico */}
        <View
          style={[
            styles.inputsSection,
            {
              backgroundColor: themeColors.card,
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
        </View>
      </KeyboardAwareScrollView>
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
    marginTop: -10
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
    paddingHorizontal: 12 
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
    paddingBottom: 70,
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
});

export default EnergiaBernoulliCalc;