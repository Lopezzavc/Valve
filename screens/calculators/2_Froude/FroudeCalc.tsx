import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Clipboard, ScrollView, Animated, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import Decimal from 'decimal.js';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";

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

Decimal.set({ precision: 20 });

const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark  = require('../../../assets/icon/iconwhite.webp');

type RootStackParamList = {
  OptionsScreenFroude: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenFroude: undefined;
  FroudeTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

interface CalculatorState {
  area: string;
  width: string;
  hydraulicDepth: string;
  velocity: string;
  gravity: string;
  areaUnit: string;
  widthUnit: string;
  hydraulicDepthUnit: string;
  velocityUnit: string;
  gravityUnit: string;
  prevAreaUnit: string;
  prevWidthUnit: string;
  prevHydraulicDepthUnit: string;
  prevVelocityUnit: string;
  prevGravityUnit: string;
  resultArea: string;
  resultWidth: string;
  resultHydraulicDepth: string;
  resultFroude: number;
  lockedGeometryField: string | null;
  invalidFields: string[];
  autoCalculatedField: 'area' | 'width' | 'hydraulicDepth' | null;
}

// Factores de conversión para cada tipo de magnitud, expresados respecto a la unidad base del SI.
// Nota: el factor km/h² (0.00007716049382716) está truncado respecto al valor exacto
// (0.0000771604938271604938...) pero no se corrige aquí para preservar la lógica original.
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  area: {
    'm²': 1,
    'cm²': 0.0001,
    'mm²': 0.000001,
    'km²': 1000000,
    'ft²': 0.09290304,
    'in²': 0.00064516,
    'yd²': 0.83612736,
    'mi²': 2589988.110336,
  },
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
    'km/h': 0.27777777777777777778,
    'ft/s': 0.3048,
    'mph': 0.44704,
    'kn': 0.51444444444444444444,
    'cm/s': 0.01,
    'in/s': 0.0254,
  },
  acceleration: {
    'm/s²': 1,
    'ft/s²': 0.3048,
    'km/h²': 0.00007716049382716,
    'cm/s²': 0.01,
  },
};

// Configuración visual de los mensajes toast que aparecen en pantalla
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

// Estado inicial de la calculadora con unidades SI por defecto
const initialState = (): CalculatorState => ({
  area: '',
  width: '',
  hydraulicDepth: '',
  velocity: '',
  gravity: '9.807',
  areaUnit: 'm²',
  widthUnit: 'm',
  hydraulicDepthUnit: 'm',
  velocityUnit: 'm/s',
  gravityUnit: 'm/s²',
  prevAreaUnit: 'm²',
  prevWidthUnit: 'm',
  prevHydraulicDepthUnit: 'm',
  prevVelocityUnit: 'm/s',
  prevGravityUnit: 'm/s²',
  resultArea: '',
  resultWidth: '',
  resultHydraulicDepth: '',
  resultFroude: 0,
  lockedGeometryField: null,
  invalidFields: [],
  autoCalculatedField: null,
});

const FroudeCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { activeInputId, setActiveInputId } = useKeyboard();
  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);

  const [state, setState] = useState<CalculatorState>(initialState);
  const [isFav, setIsFav] = useState(false);

  // Referencias internas para mantener valores actualizados sin depender de closures
  const stateRef        = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  const activeInputIdRef = useRef<string | null>(null);
  const scrollViewRef   = useRef<ScrollView>(null);
  const inputRefs       = useRef<Record<string, View | null>>({});
  const dbRef           = useRef<any>(null);
  const heartScale      = useRef(new Animated.Value(1)).current;

  // Paleta de colores derivada del tema activo, calculada solo cuando cambia el tema
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
    };
  }, [currentTheme]);

  // Sincronización de los refs con el estado y con el input activo del teclado personalizado
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { activeInputIdRef.current = activeInputId; }, [activeInputId]);

  // Desplaza el scroll para mantener visible el campo activo cuando se abre el teclado
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

  // Cierra el teclado personalizado al salir de la pantalla
  useFocusEffect(
    useCallback(() => {
      return () => { setActiveInputId(null); };
    }, [])
  );

  // Clave de traducción para el régimen de flujo según el valor del número de Froude
  const regimeKey = React.useMemo(() => {
    const Fr = state.resultFroude;
    if (!Fr || !isFinite(Fr)) return 'froudeCalc.froude';
    if (Fr < 1) return 'froudeCalc.regime.subcritical';
    if (Fr === 1) return 'froudeCalc.regime.critical';
    return 'froudeCalc.regime.supercritical';
  }, [state.resultFroude]);

  // Inicialización de la base de datos y verificación del estado de favorito al montar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await getDBConnection();
        if (!mounted) return;
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
        const fav = await isFavorite(db, 'FroudeCalc');
        if (mounted) setIsFav(fav);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Animación de rebote del corazón al cambiar el estado de favorito
  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0,  useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

  useEffect(() => {
    if (isFav) bounceHeart();
  }, [isFav, bounceHeart]);

  // Alterna el estado de favorito de esta calculadora en la base de datos
  const toggleFavorite = useCallback(async () => {
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        await createTable(db);
        await createFavoritesTable(db);
        dbRef.current = db;
      }
      const route = 'FroudeCalc';
      const label = t('froudeCalc.title') || 'Calculadora de Froude';
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

  // Bloqueo automático del tercer campo geométrico cuando los otros dos tienen valor válido
  useEffect(() => {
    const inputs = [
      { id: 'area',          value: state.area },
      { id: 'width',         value: state.width },
      { id: 'hydraulicDepth',value: state.hydraulicDepth },
    ];
    const validCount = inputs.filter(({ value }) =>
      value !== '' && !isNaN(parseFloat(value.replace(',', '.')))
    ).length;

    if (validCount === 2) {
      const emptyInput = inputs.find(({ value }) =>
        value === '' || isNaN(parseFloat(value.replace(',', '.')))
      );
      setState(prev => ({ ...prev, lockedGeometryField: emptyInput ? emptyInput.id : null }));
    } else {
      setState(prev => ({ ...prev, lockedGeometryField: null }));
    }
  }, [state.area, state.width, state.hydraulicDepth]);

  // Formatea un número eliminando ceros decimales innecesarios, con hasta 15 decimales de precisión
  const formatResult = useCallback((num: number): string => {
    if (isNaN(num) || !isFinite(num)) return '';
    return new Decimal(num).toFixed(15).replace(/\.?0+$/, '');
  }, []);

  // Convierte un valor entre unidades de la misma categoría usando aritmética de alta precisión
  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'area' | 'length' | 'velocity' | 'acceleration'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
    const fromFactor = conversionFactors[category][fromUnit];
    const toFactor   = conversionFactors[category][toUnit];
    if (fromFactor === undefined || toFactor === undefined) return value;
    const result = new Decimal(cleanValue)
      .times(new Decimal(fromFactor))
      .dividedBy(new Decimal(toFactor));
    return formatResult(result.toNumber());
  }, [formatResult]);

  // Aplica el separador decimal configurado por el usuario al texto ya formateado
  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma'
      ? formattedNumber.replace('.', ',')
      : formattedNumber;
  }, [selectedDecimalSeparator]);

  // Lógica principal de cálculo: convierte entradas a SI, resuelve la geometría faltante
  // y calcula el número de Froude con aritmética Decimal de 20 dígitos de precisión
  const calculateFroude = useCallback(() => {
    const toSI = (val: string, factor: number): Decimal | null => {
      const clean = val ? val.replace(',', '.') : '';
      if (!clean || isNaN(parseFloat(clean))) return null;
      return new Decimal(clean).times(new Decimal(factor));
    };

    const areaSI     = toSI(state.area,          conversionFactors.area[state.areaUnit]);
    const widthSI    = toSI(state.width,          conversionFactors.length[state.widthUnit]);
    const depthSI    = toSI(state.hydraulicDepth, conversionFactors.length[state.hydraulicDepthUnit]);
    const velocitySI = toSI(state.velocity,       conversionFactors.velocity[state.velocityUnit]);
    const gravitySI  = toSI(state.gravity,        conversionFactors.acceleration[state.gravityUnit]);

    const invalids: string[] = [];
    if (!velocitySI) invalids.push('velocity');
    if (!gravitySI)  invalids.push('gravity');

    const geometryCount = [areaSI, widthSI, depthSI].filter(Boolean).length;
    if (geometryCount < 2) {
      if (!areaSI)  invalids.push('area');
      if (!widthSI) invalids.push('width');
      if (!depthSI) invalids.push('hydraulicDepth');
    }

    if (invalids.length > 0) {
      setState(prev => ({
        ...prev,
        invalidFields: invalids,
        autoCalculatedField: null,
        resultArea: '',
        resultWidth: '',
        resultHydraulicDepth: '',
        resultFroude: 0,
      }));
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (!velocitySI || !gravitySI)
          ? (t('froudeCalc.toasts.velocityGravityRequired') || 'Velocidad y gravedad requeridas')
          : (t('froudeCalc.toasts.geometryRequired') || 'Se requieren al menos 2 parámetros geométricos'),
      });
      return;
    }

    const newState: Partial<CalculatorState> = {};
    let finalDepthSI: Decimal | null = depthSI;

    if (geometryCount === 2) {
      if (!areaSI) {
        const calc = widthSI!.times(depthSI!);
        if (calc.gt(0)) {
          newState.resultArea = formatResult(
            calc.dividedBy(new Decimal(conversionFactors.area[state.areaUnit])).toNumber()
          );
          newState.autoCalculatedField = 'area';
        }
      } else if (!widthSI) {
        const calc = areaSI.dividedBy(depthSI!);
        if (calc.gt(0)) {
          newState.resultWidth = formatResult(
            calc.dividedBy(new Decimal(conversionFactors.length[state.widthUnit])).toNumber()
          );
          newState.autoCalculatedField = 'width';
        }
      } else {
        const calcSI = areaSI.dividedBy(widthSI);
        if (calcSI.gt(0)) {
          newState.resultHydraulicDepth = formatResult(
            calcSI.dividedBy(new Decimal(conversionFactors.length[state.hydraulicDepthUnit])).toNumber()
          );
          newState.autoCalculatedField = 'hydraulicDepth';
          finalDepthSI = calcSI;
        }
      }
    }

    let froudeResult = 0;
    if (finalDepthSI && velocitySI && gravitySI && finalDepthSI.gt(0)) {
      const froude = velocitySI.dividedBy(gravitySI.times(finalDepthSI).sqrt());
      if (froude.isFinite()) froudeResult = froude.toNumber();
    }

    newState.resultFroude = froudeResult;
    setState(prev => ({ ...prev, ...newState, invalidFields: [] }));
  }, [state, formatResult, t]);

  // Limpia todos los campos restaurando el estado inicial
  const handleClear = useCallback(() => {
    setState(initialState);
  }, []);

  // Copia los resultados actuales al portapapeles en formato legible
  const handleCopy = useCallback(() => {
    const hasResults = state.resultFroude !== 0 || state.resultArea || state.resultWidth || state.resultHydraulicDepth;
    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('froudeCalc.toasts.noResultsToCopy') || 'No hay resultados para copiar' });
      return;
    }

    const areaValue           = state.resultArea           || state.area;
    const widthValue          = state.resultWidth          || state.width;
    const hydraulicDepthValue = state.resultHydraulicDepth || state.hydraulicDepth;

    let textToCopy = `${t('froudeCalc.title') || 'Calculadora de Froude'}\n\n`;
    if (state.resultFroude !== 0) {
      textToCopy += `${t('froudeCalc.froudeNumber') || 'Número de Froude'}: ${formatResult(state.resultFroude)}\n\n`;
    }
    textToCopy += `${t('froudeCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
    if (state.velocity) textToCopy += `  ${t('froudeCalc.labels.velocity') || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
    if (state.gravity)  textToCopy += `  ${t('froudeCalc.labels.gravity')  || 'Gravedad'}: ${state.gravity} ${state.gravityUnit}\n`;
    textToCopy += `\n${t('froudeCalc.geometryParameters') || 'Parámetros Geométricos'}:\n`;
    if (areaValue)           textToCopy += `  ${t('froudeCalc.labels.area')           || 'Área'}: ${areaValue} ${state.areaUnit}\n`;
    if (widthValue)          textToCopy += `  ${t('froudeCalc.labels.width')          || 'Ancho'}: ${widthValue} ${state.widthUnit}\n`;
    if (hydraulicDepthValue) textToCopy += `  ${t('froudeCalc.labels.hydraulicDepth') || 'Profundidad Hidráulica'}: ${hydraulicDepthValue} ${state.hydraulicDepthUnit}\n`;

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('froudeCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

  // Guarda el cálculo actual en el historial de la base de datos local
  const handleSaveHistory = useCallback(async () => {
    const hasResults = state.resultFroude !== 0 || state.resultArea || state.resultWidth || state.resultHydraulicDepth;
    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('froudeCalc.toasts.nothingToSave') || 'No hay resultados para guardar' });
      return;
    }
    try {
      const db = dbRef.current ?? await getDBConnection();
      if (!dbRef.current) {
        try { await createTable(db); } catch {}
        dbRef.current = db;
      }
      const inputs = {
        area:               state.resultArea           || state.area           || 'N/A',
        areaUnit:           state.areaUnit,
        width:              state.resultWidth          || state.width          || 'N/A',
        widthUnit:          state.widthUnit,
        hydraulicDepth:     state.resultHydraulicDepth || state.hydraulicDepth || 'N/A',
        hydraulicDepthUnit: state.hydraulicDepthUnit,
        velocity:           state.velocity             || 'N/A',
        velocityUnit:       state.velocityUnit,
        gravity:            state.gravity              || 'N/A',
        gravityUnit:        state.gravityUnit,
      };
      await saveCalculation(db, 'froude', JSON.stringify(inputs), formatResult(state.resultFroude));
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('froudeCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('froudeCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenFroude', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Utilidades del teclado personalizado: lectura del valor activo y despacho al handler correcto
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const map: Record<string, string> = {
      area:           stateRef.current.area,
      width:          stateRef.current.width,
      hydraulicDepth: stateRef.current.hydraulicDepth,
      velocity:       stateRef.current.velocity,
      gravity:        stateRef.current.gravity,
    };
    return map[id] ?? '';
  }, []);

  // Función central que aplica una transformación al valor activo y lo despacha al campo correspondiente
  const callActiveHandler = useCallback((transform: (current: string) => string | null) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const handler = inputHandlersRef.current[id];
    if (!handler) return;
    const result = transform(getActiveValue());
    if (result !== null) handler(result);
  }, [getActiveValue]);

  const handleKeyboardKey    = useCallback((key: string) => callActiveHandler(val => val + key),       [callActiveHandler]);
  const handleKeyboardDelete = useCallback(() => callActiveHandler(val => val.slice(0, -1)),            [callActiveHandler]);
  const handleKeyboardClear  = useCallback(() => callActiveHandler(() => ''),                           [callActiveHandler]);
  const handleKeyboardSubmit = useCallback(() => setActiveInputId(null),                                [setActiveInputId]);

  const handleKeyboardMultiply10 = useCallback(() =>
    callActiveHandler(val => {
      if (val === '' || val === '.') return null;
      return new Decimal(val).times(10).toString();
    }), [callActiveHandler]);

  const handleKeyboardDivide10 = useCallback(() =>
    callActiveHandler(val => {
      if (val === '' || val === '.') return null;
      return new Decimal(val).dividedBy(10).toString();
    }), [callActiveHandler]);

  // Renderizado de cada campo de entrada con su etiqueta, indicador de estado, input y selector de unidades
  const renderInput = useCallback((
    labelKey: string,
    value: string,
    onChange: (text: string) => void,
    fieldId?: 'area' | 'width' | 'hydraulicDepth' | 'velocity' | 'gravity',
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean
  ) => {
    const unitByField: { [K in NonNullable<typeof fieldId>]: string } = {
      area:           state.areaUnit,
      width:          state.widthUnit,
      hydraulicDepth: state.hydraulicDepthUnit,
      velocity:       state.velocityUnit,
      gravity:        state.gravityUnit,
    } as const;

    const categoryByField: Record<NonNullable<typeof fieldId>, 'area' | 'length' | 'velocity' | 'acceleration'> = {
      area:           'area',
      width:          'length',
      hydraulicDepth: 'length',
      velocity:       'velocity',
      gravity:        'acceleration',
    };

    const shownLabel      = displayLabel || t(labelKey);
    const unit            = fieldId ? unitByField[fieldId] : '';
    const isFieldLocked   = isLocked || (fieldId && state.lockedGeometryField === fieldId);
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;

    if (fieldId) {
      inputHandlersRef.current[fieldId] = (text: string) => {
        onChange(text);
        setState(prev => ({
          ...prev,
          invalidFields: prev.invalidFields.filter(f => f !== fieldId),
          autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
          ...(fieldId === 'area'           ? { resultArea: '' }           : {}),
          ...(fieldId === 'width'          ? { resultWidth: '' }          : {}),
          ...(fieldId === 'hydraulicDepth' ? { resultHydraulicDepth: '' } : {}),
        }));
      };
    }

    return (
      <View
        ref={(r) => { if (fieldId) inputRefs.current[fieldId] = r; }}
        style={styles.inputWrapper}
      >
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {shownLabel}
          </Text>
          {(() => {
            const hasUserValue = (value?.trim()?.length ?? 0) > 0;
            const isInvalid    = fieldId ? state.invalidFields.includes(fieldId) : false;
            const isAuto =
              fieldId === state.autoCalculatedField &&
              !hasUserValue &&
              !!(resultValue && resultValue !== '');

            let dotColor = 'rgb(200,200,200)';
            if (isInvalid)         dotColor = 'rgb(254, 12, 12)';
            else if (isAuto)       dotColor = 'rgba(62, 136, 255, 1)';
            else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';

            return <View style={[styles.valueDot, { backgroundColor: dotColor }]} />;
          })()}
        </View>

        <View style={styles.redContainer}>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
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
                  const inputValue     = state[field] as string;
                  const prevUnit       = state[prevField] as string;
                  const resultVal      = resultField ? (state[resultField] as string) : '';
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
                  case 'area':           updateUnit('area',          'prevAreaUnit',          'resultArea');          break;
                  case 'width':          updateUnit('width',         'prevWidthUnit',         'resultWidth');         break;
                  case 'hydraulicDepth': updateUnit('hydraulicDepth','prevHydraulicDepthUnit','resultHydraulicDepth');break;
                  case 'velocity':       updateUnit('velocity',      'prevVelocityUnit');                             break;
                  case 'gravity':        updateUnit('gravity',       'prevGravityUnit');                              break;
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
        {/* Cabecera con botón de retroceso, favorito y teoría */}
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
                onPress={() => navigation.navigate('FroudeTheory')}
              >
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos de la pantalla */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('froudeCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title,    { fontSize: 30 * fontSizeFactor }]}>{t('froudeCalc.title')      || 'Número de Froude'}</Text>
        </View>

        {/* Tarjeta de resultados con imagen de fondo, régimen de flujo y número de Froude */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>
                  {t('froudeCalc.saveToHistory') || 'Guardar en historial'}
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
                    <Text style={[styles.flowLabel, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 14 * fontSizeFactor }]}>
                      {state.resultFroude === 0 ? 'な' : t(regimeKey)}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text style={[styles.flowValue, { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }]}>
                      {state.resultFroude === 0 ? '一' : adjustDecimalSeparator(formatNumber(state.resultFroude))}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Botones de acción: calcular, copiar, limpiar e historial */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular',  action: calculateFroude },
            { icon: 'copy',     label: t('common.copy')      || 'Copiar',    action: handleCopy },
            { icon: 'trash',    label: t('common.clear')     || 'Limpiar',   action: handleClear },
            { icon: 'clock',    label: t('common.history')   || 'Historial', action: () => navigation.navigate('HistoryScreenFroude') },
          ].map(({ icon, label, action }) => (
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

        {/* Sección de entradas dividida en parámetros de flujo y parámetros geométricos */}
        <View style={[styles.inputsSection, { backgroundColor: themeColors.card, paddingBottom: isKeyboardOpen ? 330 : 70 }]}>
          <View style={styles.inputsContainer}>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('froudeCalc.flowParameters') || 'Parámetros de Flujo'}
            </Text>

            {renderInput(
              'froudeCalc.labels.velocity',
              state.velocity,
              (text) => setState(prev => ({ ...prev, velocity: text })),
              'velocity',
              undefined,
              `${t('froudeCalc.labels.velocity') || 'Velocidad'} (V)`
            )}
            {renderInput(
              'froudeCalc.labels.gravity',
              state.gravity,
              (text) => setState(prev => ({ ...prev, gravity: text })),
              'gravity',
              undefined,
              `${t('froudeCalc.labels.gravity') || 'Gravedad'} (g)`
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('froudeCalc.geometryParameters') || 'Parámetros Geométricos'}
            </Text>

            {renderInput(
              'froudeCalc.labels.area',
              state.area,
              (text) => setState(prev => ({ ...prev, area: text })),
              'area',
              state.resultArea,
              `${t('froudeCalc.labels.area') || 'Área'} (A)`
            )}
            {renderInput(
              'froudeCalc.labels.width',
              state.width,
              (text) => setState(prev => ({ ...prev, width: text })),
              'width',
              state.resultWidth,
              `${t('froudeCalc.labels.width') || 'Ancho'} (b)`
            )}
            {renderInput(
              'froudeCalc.labels.hydraulicDepth',
              state.hydraulicDepth,
              (text) => setState(prev => ({ ...prev, hydraulicDepth: text })),
              'hydraulicDepth',
              state.resultHydraulicDepth,
              `${t('froudeCalc.labels.hydraulicDepth') || 'Profundidad Hidráulica'} (D)`
            )}
          </View>
          <View>
            <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                {t('froudeCalc.infoText')}
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

      {/* Teclado personalizado renderizado fuera del ScrollView para permanecer siempre visible */}
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
    backgroundColor: 'rgba(255, 255, 255, 1)' 
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

export default FroudeCalc;