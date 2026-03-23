import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Clipboard, ScrollView, Animated, Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from '@d11/react-native-fast-image';
import Decimal from 'decimal.js';

import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../../src/components/CustomKeyboardInput';
import {
  getDBConnection, createTable, saveCalculation,
  createFavoritesTable, isFavorite, addFavorite, removeFavorite,
} from '../../../src/services/database';

// Recursos estáticos de imagen
const logoLight       = require('../../../assets/icon/iconblack.webp');
const logoDark        = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// Precisión global de Decimal para todos los cálculos numéricos del módulo
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

// Tipos de navegación del stack
type RootStackParamList = {
  OptionsScreenReynolds: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenReynolds: undefined;
  ReynoldsTheory: undefined;
};

// Estructura del estado central de la calculadora
interface CalculatorState {
  velocity: string;
  dimension: string;
  velocityUnit: string;
  dimensionUnit: string;
  prevVelocityUnit: string;
  prevDimensionUnit: string;
  density: string;
  dynamicViscosity: string;
  kinematicViscosity: string;
  densityUnit: string;
  dynamicViscosityUnit: string;
  kinematicViscosityUnit: string;
  prevDensityUnit: string;
  prevDynamicViscosityUnit: string;
  prevKinematicViscosityUnit: string;
  resultDensity: string;
  resultDynamicViscosity: string;
  resultKinematicViscosity: string;
  resultReynolds: number;
  lockedFluidField: string | null;
  invalidFields: string[];
  autoCalculatedField: 'density' | 'dynamicViscosity' | 'kinematicViscosity' | null;
  presetFluid: string;
}

// Factores de conversión de cada magnitud física hacia su unidad base del SI
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  velocity: {
    'm/s':  1,
    'km/h': 0.27777777777777777778,
    'ft/s': 0.3048,
    'mph':  0.44704,
    'kn':   0.51444444444444444444,
    'cm/s': 0.01,
    'in/s': 0.0254,
  },
  length: {
    'm':  1,
    'mm': 0.001,
    'cm': 0.01,
    'km': 1000,
    'in': 0.0254,
    'ft': 0.3048,
    'yd': 0.9144,
    'mi': 1609.344,
  },
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,
    'lb/ft³': 16.018463373960139580,
    'g/L':   1,
    'kg/L':  1000,
  },
  dynamicViscosity: {
    'Pa·s':      1,
    'cP':        0.001,
    'P':         0.1,
    'mPa·s':     0.001,
    'kg/(m·s)':  1,
    'lb/(ft·s)': 1.4881639435695538,
    'lb/(ft·h)': 0.00041338443155264994,
  },
  kinematicViscosity: {
    'm²/s':  1,
    'cSt':   0.000001,
    'St':    0.0001,
    'mm²/s': 0.000001,
    'cm²/s': 0.0001,
    'ft²/s': 0.09290304,
    'ft²/h': 0.000025806400000000000,
  },
};

// Propiedades físicas de fluidos comunes a temperaturas específicas, en unidades SI (kg/m³ y Pa·s).
const PRESET_FLUID_PROPS: Record<string, { rho: number; mu: number }> = {
  'water_0C':     { rho: 999.84,  mu: 0.001788 },
  'water_4C':     { rho: 1000.00, mu: 0.0015673 },
  'water_5C':     { rho: 999.97,  mu: 0.0015182 },
  'water_10C':    { rho: 999.70,  mu: 0.001306 },
  'water_15C':    { rho: 999.10,  mu: 0.00114 },
  'water_20C':    { rho: 998.21,  mu: 0.001002 },
  'water_25C':    { rho: 997.05,  mu: 0.000890 },
  'water_30C':    { rho: 995.65,  mu: 0.000798 },
  'water_35C':    { rho: 994.00,  mu: 0.000719 },
  'water_40C':    { rho: 992.22,  mu: 0.000653 },
  'water_50C':    { rho: 988.05,  mu: 0.000547 },
  'water_60C':    { rho: 983.20,  mu: 0.000467 },
  'water_70C':    { rho: 977.80,  mu: 0.000404 },
  'water_80C':    { rho: 971.80,  mu: 0.000355 },
  'water_90C':    { rho: 965.30,  mu: 0.000315 },
  'air_0C':       { rho: 1.275,   mu: 0.0000171 },
  'air_20C':      { rho: 1.204,   mu: 0.0000181 },
  'acetone_20C':  { rho: 784,     mu: 0.000316},
  'ethanol_20C':  { rho: 789,     mu: 0.00120 },
  'glycerin_20C': { rho: 1260,    mu: 1.49 },
  'mercury_20C':  { rho: 13534,   mu: 0.001526 },
  'sae10_20C':    { rho: 870,     mu: 0.200 },
};

// Configuración visual de los mensajes Toast del sistema
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

// Estado inicial limpio para una sesión de cálculo nueva
const initialState = (): CalculatorState => ({
  velocity: '',
  dimension: '',
  velocityUnit: 'm/s',
  dimensionUnit: 'm',
  prevVelocityUnit: 'm/s',
  prevDimensionUnit: 'm',
  density: '',
  dynamicViscosity: '',
  kinematicViscosity: '',
  densityUnit: 'kg/m³',
  dynamicViscosityUnit: 'Pa·s',
  kinematicViscosityUnit: 'm²/s',
  prevDensityUnit: 'kg/m³',
  prevDynamicViscosityUnit: 'Pa·s',
  prevKinematicViscosityUnit: 'm²/s',
  resultDensity: '',
  resultDynamicViscosity: '',
  resultKinematicViscosity: '',
  resultReynolds: 0,
  lockedFluidField: null,
  invalidFields: [],
  autoCalculatedField: null,
  presetFluid: 'custom',
});

const ReynoldsCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Contextos globales de configuración
  const { formatNumber }             = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor }           = useContext(FontSizeContext);
  const { currentTheme }             = useTheme();
  const { t, selectedLanguage }      = useContext(LanguageContext);
  const { activeInputId, setActiveInputId } = useKeyboard();

  // Referencias que permiten acceder a valores actuales sin generar dependencias en closures
  const stateRef         = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  const scrollViewRef    = useRef<ScrollView>(null);
  const inputRefs        = useRef<Record<string, View | null>>({});
  const activeInputIdRef = useRef<string | null>(null);
  const dbRef            = useRef<any>(null);
  const heartScale       = useRef(new Animated.Value(1)).current;

  const [state, setState] = useState<CalculatorState>(initialState);
  const [isFav, setIsFav] = useState(false);

  // Mantenimiento de refs sincronizadas con los últimos valores reactivos
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { activeInputIdRef.current = activeInputId; }, [activeInputId]);

  // Cierre del teclado personalizado al perder el foco la pantalla
  useFocusEffect(
    React.useCallback(() => {
      return () => setActiveInputId(null);
    }, [])
  );

  // Desplazamiento automático para mantener el input activo visible sobre el teclado
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
          const targetY = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
        },
        () => {}
      );
    }, 150);
  }, [activeInputId]);

  // Conexión a la base de datos y verificación del estado de favorito al montar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
        const fav = await isFavorite(db, 'ReynoldsCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Bloqueo automático del campo de fluido que puede derivarse cuando exactamente dos de los tres están llenos
  useEffect(() => {
    const fluidFields = [
      { id: 'density',            value: state.density },
      { id: 'dynamicViscosity',   value: state.dynamicViscosity },
      { id: 'kinematicViscosity', value: state.kinematicViscosity },
    ];
    const isValid    = (v: string) => v !== '' && Number.isFinite(parseFloat(v.replace(',', '.')));
    const validCount = fluidFields.filter(({ value }) => isValid(value)).length;
    const lockedField = validCount === 2
      ? (fluidFields.find(({ value }) => !isValid(value))?.id ?? null)
      : null;
    setState(prev => ({ ...prev, lockedFluidField: lockedField }));
  }, [state.density, state.dynamicViscosity, state.kinematicViscosity]);

  // Paleta de colores derivada del tema activo
  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card:         'rgb(24,24,24)',
        text:         'rgb(235,235,235)',
        textStrong:   'rgb(250,250,250)',
        separator:    'rgba(255,255,255,0.12)',
        icon:         'rgb(245,245,245)',
        gradient:     'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        blockInput:   'rgba(30, 30, 30, 1)',
      };
    }
    return {
      card:         'rgba(255, 255, 255, 1)',
      text:         'rgb(0, 0, 0)',
      textStrong:   'rgb(0, 0, 0)',
      separator:    'rgb(235, 235, 235)',
      icon:         'rgb(0, 0, 0)',
      gradient:     'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      blockInput:   'rgba(240, 240, 240, 1)',
    };
  }, [currentTheme]);

  // Clave de traducción del régimen de flujo según el número de Reynolds calculado
  const regimeKey = React.useMemo(() => {
    const Re = state.resultReynolds;
    if (!Re || !isFinite(Re)) return 'reynoldsCalc.reynolds';
    if (Re < 2300)            return 'reynoldsCalc.regime.laminar';
    if (Re < 4000)            return 'reynoldsCalc.regime.transitional';
    return 'reynoldsCalc.regime.turbulent';
  }, [state.resultReynolds]);

  // Formateo de un número para mostrar, eliminando ceros decimales finales con Decimal para mayor precisión
  const formatResult = useCallback((num: number): string => {
    if (!Number.isFinite(num)) return '';
    return new Decimal(num).toDecimalPlaces(15).toString();
  }, []);

  // Sustitución del punto decimal por coma según la preferencia del usuario
  const adjustDecimalSeparator = useCallback((value: string): string => {
    return selectedDecimalSeparator === 'Coma' ? value.replace('.', ',') : value;
  }, [selectedDecimalSeparator]);

  // Conversión de un valor entre unidades dentro de la misma categoría física
  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'velocity' | 'length' | 'density' | 'dynamicViscosity' | 'kinematicViscosity'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || !Number.isFinite(parseFloat(cleanValue))) return value;
    const fromFactor = conversionFactors[category][fromUnit];
    const toFactor   = conversionFactors[category][toUnit];
    if (!fromFactor || !toFactor) return value;
    const result = new Decimal(cleanValue)
      .times(fromFactor.toString())
      .dividedBy(toFactor.toString());
    return formatResult(result.toNumber());
  }, [formatResult]);

  // Cálculo principal del número de Reynolds con derivación automática de la propiedad de fluido faltante
  const calculateReynolds = useCallback(() => {
    const toBase = (raw: string, factor: number): Decimal | null => {
      const clean = raw.replace(',', '.');
      if (!clean || !Number.isFinite(parseFloat(clean))) return null;
      try {
        return new Decimal(clean).times(factor.toString());
      } catch {
        return null;
      }
    };

    const dV  = toBase(state.velocity,          conversionFactors.velocity[state.velocityUnit]);
    const dL  = toBase(state.dimension,          conversionFactors.length[state.dimensionUnit]);
    const dRo = toBase(state.density,            conversionFactors.density[state.densityUnit]);
    const dMu = toBase(state.dynamicViscosity,   conversionFactors.dynamicViscosity[state.dynamicViscosityUnit]);
    const dNu = toBase(state.kinematicViscosity, conversionFactors.kinematicViscosity[state.kinematicViscosityUnit]);

    const invalids: string[] = [];
    if (!dV) invalids.push('velocity');
    if (!dL) invalids.push('dimension');

    const fluidCount = [dRo, dMu, dNu].filter(Boolean).length;
    if (fluidCount < 2) {
      if (!dRo) invalids.push('density');
      if (!dMu) invalids.push('dynamicViscosity');
      if (!dNu) invalids.push('kinematicViscosity');
    }

    if (invalids.length > 0) {
      setState(prev => ({
        ...prev,
        invalidFields: invalids,
        autoCalculatedField: null,
        resultDensity: '',
        resultDynamicViscosity: '',
        resultKinematicViscosity: '',
        resultReynolds: 0,
      }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (!dV || !dL)
          ? t('reynoldsCalc.toasts.velocityDimensionRequired') || 'Velocidad y dimensión requeridas'
          : t('reynoldsCalc.toasts.fluidPropsRequired') || 'Se requieren al menos 2 propiedades del fluido',
      });
      return;
    }

    const partial: Partial<CalculatorState> = {};
    let finalRo = dRo;
    let finalMu = dMu;
    let finalNu = dNu;

    if (fluidCount === 2) {
      if (!dRo && dMu && dNu && dNu.gt(0)) {
        finalRo = dMu.dividedBy(dNu);
        const inUnit = finalRo.dividedBy(conversionFactors.density[state.densityUnit].toString());
        partial.resultDensity = formatResult(inUnit.toNumber());
        partial.autoCalculatedField = 'density';
      } else if (!dMu && dRo && dNu) {
        finalMu = dRo.times(dNu);
        const inUnit = finalMu.dividedBy(conversionFactors.dynamicViscosity[state.dynamicViscosityUnit].toString());
        partial.resultDynamicViscosity = formatResult(inUnit.toNumber());
        partial.autoCalculatedField = 'dynamicViscosity';
      } else if (!dNu && dMu && dRo && dRo.gt(0)) {
        finalNu = dMu.dividedBy(dRo);
        const inUnit = finalNu.dividedBy(conversionFactors.kinematicViscosity[state.kinematicViscosityUnit].toString());
        partial.resultKinematicViscosity = formatResult(inUnit.toNumber());
        partial.autoCalculatedField = 'kinematicViscosity';
      }
    }

    let reynoldsDecimal: Decimal | null = null;
    if (dV && dL) {
      if (finalRo && finalMu && finalMu.gt(0)) {
        reynoldsDecimal = finalRo.times(dV).times(dL).dividedBy(finalMu);
      } else if (finalNu && finalNu.gt(0)) {
        reynoldsDecimal = dV.times(dL).dividedBy(finalNu);
      }
    }

    partial.resultReynolds = (reynoldsDecimal && reynoldsDecimal.isFinite())
      ? reynoldsDecimal.toNumber()
      : 0;

    setState(prev => ({ ...prev, ...partial, invalidFields: [] }));
  }, [state, formatResult, t]);

  // Copia de resultados e inputs al portapapeles como texto formateado
  const handleCopy = useCallback(() => {
    const hasResults = state.resultReynolds !== 0 || state.resultDensity || state.resultDynamicViscosity || state.resultKinematicViscosity;
    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.noResultsToCopy') || 'No hay resultados para copiar' });
      return;
    }

    let text = `${t('reynoldsCalc.title') || 'Calculadora de Reynolds'}\n\n`;

    if (state.resultReynolds !== 0) {
      text += `${t('reynoldsCalc.reynoldsNumber') || 'Número de Reynolds'}: ${formatResult(state.resultReynolds)}\n\n`;
    }

    if (state.velocity || state.dimension) {
      text += `${t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
      if (state.velocity)  text += `  ${t('reynoldsCalc.labels.velocity')  || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
      if (state.dimension) text += `  ${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'}: ${state.dimension} ${state.dimensionUnit}\n`;
      text += '\n';
    }

    text += `${t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}:\n`;
    const densityVal = state.resultDensity            || state.density;
    const dynViscVal = state.resultDynamicViscosity   || state.dynamicViscosity;
    const kinViscVal = state.resultKinematicViscosity || state.kinematicViscosity;
    if (densityVal) text += `  ${t('reynoldsCalc.labels.density')            || 'Densidad'}: ${densityVal} ${state.densityUnit}\n`;
    if (dynViscVal) text += `  ${t('reynoldsCalc.labels.dynamicViscosity')   || 'Viscosidad Dinámica'}: ${dynViscVal} ${state.dynamicViscosityUnit}\n`;
    if (kinViscVal) text += `  ${t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'}: ${kinViscVal} ${state.kinematicViscosityUnit}\n`;

    Clipboard.setString(text);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('reynoldsCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

  // Persistencia del cálculo actual en el historial de la base de datos
  const handleSaveHistory = useCallback(async () => {
    const hasResults = state.resultReynolds !== 0 || state.resultDensity || state.resultDynamicViscosity || state.resultKinematicViscosity;
    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.nothingToSave') || 'No hay resultados para guardar' });
      return;
    }

    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }

      const inputs = {
        velocity:               state.velocity               || 'N/A',
        velocityUnit:           state.velocityUnit,
        dimension:              state.dimension               || 'N/A',
        dimensionUnit:          state.dimensionUnit,
        density:                state.resultDensity          || state.density            || 'N/A',
        densityUnit:            state.densityUnit,
        dynamicViscosity:       state.resultDynamicViscosity || state.dynamicViscosity   || 'N/A',
        dynamicViscosityUnit:   state.dynamicViscosityUnit,
        kinematicViscosity:     state.resultKinematicViscosity || state.kinematicViscosity || 'N/A',
        kinematicViscosityUnit: state.kinematicViscosityUnit,
      };

      await saveCalculation(db, 'reynolds', JSON.stringify(inputs), formatResult(state.resultReynolds));
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('reynoldsCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  // Alternancia del estado de favorito con animación del icono de corazón
  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      const route = 'ReynoldsCalc';
      const label = t('reynoldsCalc.title') || 'Calculadora de Reynolds';
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
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0,  useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  // Redirige a la pantalla de selección de unidades para una categoría física dada
  const navigateToOptions = useCallback((
    category: string,
    onSelectOption: (opt: string) => void,
    selectedOption?: string
  ) => {
    navigation.navigate('OptionsScreenReynolds', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Carga de propiedades predefinidas de un fluido en los campos de densidad y viscosidad dinámica
  const handleSelectPresetFluid = useCallback((option: string) => {
    if (option === 'custom') {
      setState(prev => ({
        ...prev,
        presetFluid: option,
        density: '',
        dynamicViscosity: '',
        resultDensity: '',
        resultDynamicViscosity: '',
        autoCalculatedField: null,
      }));
      return;
    }
    const props = PRESET_FLUID_PROPS[option];
    if (!props) return;

    const rhoDisplay = new Decimal(props.rho)
      .dividedBy(conversionFactors.density[state.densityUnit].toString())
      .toDecimalPlaces(15).toString();
    const muDisplay = new Decimal(props.mu)
      .dividedBy(conversionFactors.dynamicViscosity[state.dynamicViscosityUnit].toString())
      .toDecimalPlaces(15).toString();

    setState(prev => ({
      ...prev,
      presetFluid: option,
      density: rhoDisplay,
      dynamicViscosity: muDisplay,
      resultDensity: '',
      resultDynamicViscosity: '',
      resultKinematicViscosity: '',
      autoCalculatedField: null,
    }));
  }, [state.densityUnit, state.dynamicViscosityUnit]);

  const handleClear = useCallback(() => setState(initialState), []);

  // Enrutador interno del teclado personalizado que aplica una transformación al input activo en ese momento
  const withActiveInput = useCallback((transform: (current: string) => string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const s = stateRef.current;
    const valueMap: Record<string, string> = {
      velocity:           s.velocity,
      dimension:          s.dimension,
      density:            s.density,
      dynamicViscosity:   s.dynamicViscosity,
      kinematicViscosity: s.kinematicViscosity,
    };
    handler(transform(valueMap[id] ?? ''));
  }, []);

  // Manejadores individuales de las acciones del teclado personalizado
  const handleKeyboardKey        = useCallback((key: string) => withActiveInput(v => v + key), [withActiveInput]);
  const handleKeyboardDelete     = useCallback(() => withActiveInput(v => v.slice(0, -1)), [withActiveInput]);
  const handleKeyboardClear      = useCallback(() => withActiveInput(() => ''), [withActiveInput]);
  const handleKeyboardMultiply10 = useCallback(() => withActiveInput(v => {
    if (!v || v === '.') return v;
    return new Decimal(v.replace(',', '.')).times(10).toString();
  }), [withActiveInput]);
  const handleKeyboardDivide10   = useCallback(() => withActiveInput(v => {
    if (!v || v === '.') return v;
    return new Decimal(v.replace(',', '.')).dividedBy(10).toString();
  }), [withActiveInput]);
  const handleKeyboardSubmit     = useCallback(() => setActiveInputId(null), [setActiveInputId]);

  // Renderizado de una fila de input etiquetada con su selector de unidades
  const renderInput = useCallback((
    labelKey: string,
    value: string,
    onChange: (text: string) => void,
    fieldId?: 'velocity' | 'dimension' | 'density' | 'dynamicViscosity' | 'kinematicViscosity',
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean
  ) => {
    const unitByField: Record<NonNullable<typeof fieldId>, string> = {
      velocity:           state.velocityUnit,
      dimension:          state.dimensionUnit,
      density:            state.densityUnit,
      dynamicViscosity:   state.dynamicViscosityUnit,
      kinematicViscosity: state.kinematicViscosityUnit,
    } as const;

    const categoryByField: Record<NonNullable<typeof fieldId>, 'velocity' | 'length' | 'density' | 'dynamicViscosity' | 'kinematicViscosity'> = {
      velocity:           'velocity',
      dimension:          'length',
      density:            'density',
      dynamicViscosity:   'dynamicViscosity',
      kinematicViscosity: 'kinematicViscosity',
    };

    const shownLabel       = displayLabel || t(labelKey);
    const unit             = fieldId ? unitByField[fieldId] : '';
    const isFieldLocked    = isLocked || (fieldId ? state.lockedFluidField === fieldId : false);
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    if (fieldId) {
      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== fieldId),
          autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
          ...(fieldId === 'density'            ? { resultDensity: '' }            : {}),
          ...(fieldId === 'dynamicViscosity'   ? { resultDynamicViscosity: '' }   : {}),
          ...(fieldId === 'kinematicViscosity' ? { resultKinematicViscosity: '' } : {}),
        }));
      };
    }

    const hasUserValue = (value?.trim()?.length ?? 0) > 0;
    const isInvalid    = fieldId ? state.invalidFields.includes(fieldId) : false;
    const isAuto       = (fieldId && fieldId === state.autoCalculatedField)
      && !hasUserValue
      && !!(resultValue && resultValue !== '');

    let dotColor = 'rgb(200,200,200)';
    if (isInvalid)         dotColor = 'rgb(254, 12, 12)';
    else if (isAuto)       dotColor = 'rgba(62, 136, 255, 1)';
    else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';

    return (
      <View
        ref={(r) => { if (fieldId) inputRefs.current[fieldId] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {shownLabel}
          </Text>
          <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
        </View>

        <View style={styles.redContainer}>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: inputContainerBg }]}>
              <Pressable
                onPress={() => { if (isFieldLocked || !fieldId) return; setActiveInputId(fieldId); }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                value={resultValue && resultValue !== '' ? resultValue : value}
                editable={false}
                showSoftInputOnFocus={false}
                pointerEvents="none"
                placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
            </View>
          </View>

          <Pressable
            style={[styles.Container2, { experimental_backgroundImage: themeColors.gradient }]}
            onPress={() => {
              if (!fieldId) return;
              const category = categoryByField[fieldId];
              navigateToOptions(category, (option: string) => {
                const updateUnit = (
                  field: keyof CalculatorState,
                  prevField: keyof CalculatorState,
                  resultField?: keyof CalculatorState
                ) => {
                  const inputValue      = state[field] as string;
                  const prevUnit        = state[prevField] as string;
                  const resultVal       = resultField ? (state[resultField] as string) : '';
                  const convertedInput  = convertValue(inputValue, prevUnit, option, category as any);
                  const convertedResult = resultVal && resultField
                    ? convertValue(resultVal, prevUnit, option, category as any)
                    : resultVal;
                  setState(prev => ({
                    ...prev,
                    [field]: convertedInput,
                    [prevField]: option,
                    [`${field}Unit`]: option,
                    ...(resultField && convertedResult ? { [resultField]: convertedResult } as any : {}),
                  }));
                };

                switch (fieldId) {
                  case 'velocity':           updateUnit('velocity',          'prevVelocityUnit');                                          break;
                  case 'dimension':          updateUnit('dimension',         'prevDimensionUnit');                                         break;
                  case 'density':            updateUnit('density',           'prevDensityUnit',           'resultDensity');                break;
                  case 'dynamicViscosity':   updateUnit('dynamicViscosity',  'prevDynamicViscosityUnit',  'resultDynamicViscosity');        break;
                  case 'kinematicViscosity': updateUnit('kinematicViscosity','prevKinematicViscosityUnit','resultKinematicViscosity');      break;
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
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor, t, setActiveInputId]);

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
        {/* Cabecera con navegación y acciones rápidas */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => { bounceHeart(); toggleFavorite(); }}>
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
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('ReynoldsTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Título y subtítulo de la pantalla */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('reynoldsCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title,    { fontSize: 30 * fontSizeFactor }]}>{t('reynoldsCalc.title')      || 'Número de Reynolds'}</Text>
        </View>

        {/* Tarjeta de resultado */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('reynoldsCalc.saveToHistory') || 'Guardar en historial'}</Text>
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
                    <Text style={[styles.flowLabel, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 14 * fontSizeFactor }]}>
                      {state.resultReynolds === 0 ? 'な' : t(regimeKey)}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text style={[styles.flowValue, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }]}>
                      {state.resultReynolds === 0 ? '一' : adjustDecimalSeparator(formatNumber(state.resultReynolds))}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Botones de acción principal */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular',  action: calculateReynolds },
            { icon: 'copy',     label: t('common.copy')      || 'Copiar',    action: handleCopy },
            { icon: 'trash',    label: t('common.clear')     || 'Limpiar',   action: handleClear },
            { icon: 'clock',    label: t('common.history')   || 'Historial', action: () => navigation.navigate('HistoryScreenReynolds') },
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

        {/* Sección de campos de entrada */}
        <View style={[styles.inputsSection, { backgroundColor: themeColors.card, paddingBottom: isKeyboardOpen ? 330 : 70 }]}>
          <View style={styles.inputsContainer}>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}
            </Text>

            {renderInput(
              'reynoldsCalc.labels.velocity', 
              state.velocity,  
              v => setState(p => ({ ...p, velocity: v })),  
              'velocity',
              undefined,
              `${t('reynoldsCalc.labels.velocity') || 'Velocidad'} (V)`
            )}
            
            {renderInput(
              'reynoldsCalc.labels.dimension', 
              state.dimension, 
              v => setState(p => ({ ...p, dimension: v })), 
              'dimension',
              undefined,
              `${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'} (L)`
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}
            </Text>

            {/* Selector de fluido predefinido */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('reynoldsCalc.labels.presetFluids')}
              </Text>
              <Pressable
                style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
                onPress={() => navigateToOptions('presetFluids', handleSelectPresetFluid, state.presetFluid)}
              >
                <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                  <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                    {t(`reynoldsCalc.fluids.${state.presetFluid}`) || state.presetFluid}
                  </Text>
                  <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
                </View>
              </Pressable>
            </View>

            {renderInput(
              'reynoldsCalc.labels.density',            
              state.density,            
              v => setState(p => ({ ...p, density: v })),            
              'density',            
              state.resultDensity,
              `${t('reynoldsCalc.labels.density') || 'Densidad'} (ρ)`
            )}

            {renderInput(
              'reynoldsCalc.labels.dynamicViscosity',   
              state.dynamicViscosity,   
              v => setState(p => ({ ...p, dynamicViscosity: v })),   
              'dynamicViscosity',   
              state.resultDynamicViscosity,
              `${t('reynoldsCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'} (μ)`
            )}

            {renderInput(
              'reynoldsCalc.labels.kinematicViscosity', 
              state.kinematicViscosity, 
              v => setState(p => ({ ...p, kinematicViscosity: v })), 
              'kinematicViscosity', 
              state.resultKinematicViscosity,
              `${t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'} (ν)`
            )}
          </View>

          <View>
            <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                {t('reynoldsCalc.infoText')}
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

      {/* Teclado numérico personalizado superpuesto en la parte inferior */}
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
  pickerPressable: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
  },
  textOptions: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
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
    paddingLeft: 20,
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
  text: { 
    fontFamily: 'SFUIDisplay-Medium', 
    fontSize: 16, 
    color: 'rgba(0, 0, 0, 1)', 
    marginTop: 2.75 
  },
  icon: { 
    marginLeft: 'auto' 
  },
  iconWrapper2: { 
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%', 
    width: 40, 
    height: 40, 
    borderRadius: 30, 
    padding: 1 
  },
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

export default ReynoldsCalc;