import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Clipboard, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";

import { getDBConnection, createTable, saveCalculation } from '../../../src/services/database';
import { createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';

import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';

type RootStackParamList = {
  OptionsScreenReynolds: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenReynolds: undefined;
  ReynoldsTheory: undefined;
};

const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');


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

const conversionFactors: { [key: string]: { [key: string]: number } } = {
  velocity: {
    'm/s': 1,
    'km/h': 0.27777777777777777778,
    'ft/s': 0.3048,
    'mph': 0.44704,
    'kn': 0.51444444444444444444,
    'cm/s': 0.01,
    'in/s': 0.0254,
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
  density: {
    'kg/m³': 1,
    'g/cm³': 1000,
    'lb/ft³': 16.018463373960139580,
    'g/L': 1,
    'kg/L': 1000,
  },
  dynamicViscosity: {
    'Pa·s': 1,
    'cP': 0.001,
    'P': 0.1,
    'mPa·s': 0.001,
    'kg/(m·s)': 1,
    'lb/(ft·s)': 1.4881639435695538,
    'lb/(ft·h)': 0.00041338443155264994,
  },
  kinematicViscosity: {
    'm²/s': 1,
    'cSt': 0.000001,
    'St': 0.0001,
    'mm²/s': 0.000001,
    'cm²/s': 0.0001,
    'ft²/s': 0.09290304,
    'ft²/h': 0.000025806400000000000,
  }
};

const PRESET_FLUID_PROPS: Record<string, { rho: number; mu: number }> = {
  'water_0C':   { rho: 999.84, mu: 0.001788 },
  'water_4C':   { rho: 1000.00, mu: 0.0015673 },
  'water_5C':   { rho: 999.97, mu: 0.0015182 },
  'water_10C':  { rho: 999.70, mu: 0.001306 },
  'water_15C':  { rho: 999.10, mu: 0.00114 },
  'water_20C':  { rho: 998.21, mu: 0.001002 },
  'water_25C':  { rho: 997.05, mu: 0.000890 },
  'water_30C':  { rho: 995.65, mu: 0.000798 },
  'water_35C':  { rho: 994.00, mu: 0.000719 },
  'water_40C':  { rho: 992.22, mu: 0.000653 },
  'water_50C':  { rho: 988.05, mu: 0.000547 },
  'water_60C':  { rho: 983.20, mu: 0.000467 },
  'water_70C':  { rho: 977.80, mu: 0.000404 },
  'water_80C':  { rho: 971.80, mu: 0.000355 },
  'water_90C':  { rho: 965.30, mu: 0.000315 },
  'air_0C':     { rho: 1.275,  mu: 0.0000171 },
  'air_20C':    { rho: 1.204,  mu: 0.0000181 },
  'acetone_20C':  { rho: 784,    mu: 0.00000032 * 1000 },
  'ethanol_20C':  { rho: 789,    mu: 0.00120 },
  'glycerin_20C': { rho: 1260,   mu: 1.49 },
  'mercury_20C':  { rho: 13534,  mu: 0.001526 },
  'sae10_20C':    { rho: 870,    mu: 0.200 },
};

// Configuración del Toast
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
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const [inputSectionPadding, setInputSectionPadding] = useState(100);

  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);

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
        blockInput: 'rgba(37, 42, 27, 1)',
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
      blockInput: 'rgba(247, 255, 223, 1)',
    };
  }, [currentTheme]);

  const [state, setState] = useState<CalculatorState>(initialState);

  const regimeKey = React.useMemo(() => {
    const Re = state.resultReynolds;
    if (!Re || !isFinite(Re)) {
      return 'reynoldsCalc.reynolds';
    }
    if (Re < 2300) return 'reynoldsCalc.regime.laminar';
    if (Re < 4000) return 'reynoldsCalc.regime.transitional';
    return 'reynoldsCalc.regime.turbulent';
  }, [state.resultReynolds]);

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

        const fav = await isFavorite(db, 'ReynoldsCalc');
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
    } catch (e) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('common.genericError') });
    }
  }, [t]);

  useEffect(() => {
    updateLockedFluidField();
  }, [state.density, state.dynamicViscosity, state.kinematicViscosity]);

  const formatResult = useCallback((num: number): string => {
    if (isNaN(num)) return '';
    const fixed = num.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'velocity' | 'length' | 'density' | 'dynamicViscosity' | 'kinematicViscosity'
  ): string => {
    const cleanValue = value.replace(',', '.');
    if (cleanValue === '' || isNaN(parseFloat(cleanValue))) return value;
    const numValue = parseFloat(cleanValue);
    const fromFactor = conversionFactors[category][fromUnit];
    const toFactor = conversionFactors[category][toUnit];
    if (!fromFactor || !toFactor) return value;
    const convertedValue = (numValue * fromFactor) / toFactor;
    return formatResult(convertedValue);
  }, [formatResult]);

  const adjustDecimalSeparator = useCallback((formattedNumber: string): string => {
    return selectedDecimalSeparator === 'Coma' ? formattedNumber.replace('.', ',') : formattedNumber;
  }, [selectedDecimalSeparator]);

  const updateLockedFluidField = useCallback(() => {
    const inputs = [
      { id: 'density', value: state.density },
      { id: 'dynamicViscosity', value: state.dynamicViscosity },
      { id: 'kinematicViscosity', value: state.kinematicViscosity },
    ];
    const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
    if (validInputs.length === 2) {
      const emptyInput = inputs.find(({ value }) => value === '' || isNaN(parseFloat(value.replace(',', '.'))));
      setState((prev) => ({ ...prev, lockedFluidField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedFluidField: null }));
    }
  }, [state.density, state.dynamicViscosity, state.kinematicViscosity]);

  const calculateReynolds = useCallback(() => {
    const velocity = state.velocity ? parseFloat(state.velocity.replace(',', '.')) * conversionFactors.velocity[state.velocityUnit] : NaN;
    const dimension = state.dimension ? parseFloat(state.dimension.replace(',', '.')) * conversionFactors.length[state.dimensionUnit] : NaN;
    const density = state.density ? parseFloat(state.density.replace(',', '.')) * conversionFactors.density[state.densityUnit] : NaN;
    const dynamicVisc = state.dynamicViscosity ? parseFloat(state.dynamicViscosity.replace(',', '.')) * conversionFactors.dynamicViscosity[state.dynamicViscosityUnit] : NaN;
    const kinematicVisc = state.kinematicViscosity ? parseFloat(state.kinematicViscosity.replace(',', '.')) * conversionFactors.kinematicViscosity[state.kinematicViscosityUnit] : NaN;

    const invalids: string[] = [];
    if (isNaN(velocity)) invalids.push('velocity');
    if (isNaN(dimension)) invalids.push('dimension');

    const fluidProvidedCount = [density, dynamicVisc, kinematicVisc].filter(v => !isNaN(v)).length;
    if (fluidProvidedCount < 2) {
      if (isNaN(density)) invalids.push('density');
      if (isNaN(dynamicVisc)) invalids.push('dynamicViscosity');
      if (isNaN(kinematicVisc)) invalids.push('kinematicViscosity');
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
        text2:
          (isNaN(velocity) || isNaN(dimension))
            ? (t('reynoldsCalc.toasts.velocityDimensionRequired') || 'Velocidad y dimensión requeridas')
            : (t('reynoldsCalc.toasts.fluidPropsRequired') || 'Se requieren al menos 2 propiedades del fluido'),
      });
      return;
    }

    const newState: Partial<CalculatorState> = {};

    if (fluidProvidedCount === 2) {
      if (isNaN(density)) {
        const calculated = dynamicVisc / kinematicVisc;
        if (!isNaN(calculated) && isFinite(calculated) && calculated > 0) {
          const resultInTargetUnit = calculated / conversionFactors.density[state.densityUnit];
          newState.resultDensity = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'density';
        }
      } else if (isNaN(dynamicVisc)) {
        const calculated = density * kinematicVisc;
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.dynamicViscosity[state.dynamicViscosityUnit];
          newState.resultDynamicViscosity = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'dynamicViscosity';
        }
      } else if (isNaN(kinematicVisc)) {
        const calculated = dynamicVisc / density;
        if (!isNaN(calculated) && isFinite(calculated)) {
          const resultInTargetUnit = calculated / conversionFactors.kinematicViscosity[state.kinematicViscosityUnit];
          newState.resultKinematicViscosity = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'kinematicViscosity';
        }
      }
    }

    const finalDensity = !isNaN(density)
      ? density
      : (newState.resultDensity ? parseFloat(newState.resultDensity) * conversionFactors.density[state.densityUnit] : NaN);

    let reynoldsNumber = 0;
    if (!isNaN(finalDensity) && !isNaN(dynamicVisc)) {
      reynoldsNumber = (finalDensity * velocity * dimension) / dynamicVisc;
    } else if (!isNaN(kinematicVisc)) {
      reynoldsNumber = (velocity * dimension) / kinematicVisc;
    } else if (newState.resultDynamicViscosity && !isNaN(finalDensity)) {
      const calcDyn = parseFloat(newState.resultDynamicViscosity) * conversionFactors.dynamicViscosity[state.dynamicViscosityUnit];
      reynoldsNumber = (finalDensity * velocity * dimension) / calcDyn;
    } else if (newState.resultKinematicViscosity) {
      const calcKin = parseFloat(newState.resultKinematicViscosity) * conversionFactors.kinematicViscosity[state.kinematicViscosityUnit];
      reynoldsNumber = (velocity * dimension) / calcKin;
    }

    newState.resultReynolds = (!isNaN(reynoldsNumber) && isFinite(reynoldsNumber)) ? reynoldsNumber : 0;
    setState(prev => ({ ...prev, ...newState, invalidFields: [] }));
  }, [state, formatResult, t]);

  const handleCalculate = useCallback(() => {
    calculateReynolds();
  }, [calculateReynolds]);

  const handleClear = useCallback(() => {
    setState(initialState);
  }, []);

  const handleCopy = useCallback(() => {
    const hasResults = state.resultReynolds !== 0 || state.resultDensity || state.resultDynamicViscosity || state.resultKinematicViscosity;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.noResultsToCopy') || 'No hay resultados para copiar' });
      return;
    }

    let textToCopy = `${t('reynoldsCalc.title') || 'Calculadora de Reynolds'}\n\n`;

    if (state.resultReynolds !== 0) {
      textToCopy += `${t('reynoldsCalc.reynoldsNumber') || 'Número de Reynolds'}: ${formatResult(state.resultReynolds)}\n\n`;
    }

    if (state.velocity || state.dimension) {
      textToCopy += `${t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
      if (state.velocity) textToCopy += `  ${t('reynoldsCalc.labels.velocity') || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
      if (state.dimension) textToCopy += `  ${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'}: ${state.dimension} ${state.dimensionUnit}\n`;
      textToCopy += '\n';
    }

    textToCopy += `${t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}:\n`;
    
    const densityValue = state.resultDensity || state.density;
    const dynamicViscValue = state.resultDynamicViscosity || state.dynamicViscosity;
    const kinematicViscValue = state.resultKinematicViscosity || state.kinematicViscosity;
    
    if (densityValue) textToCopy += `  ${t('reynoldsCalc.labels.density') || 'Densidad'}: ${densityValue} ${state.densityUnit}\n`;
    if (dynamicViscValue) textToCopy += `  ${t('reynoldsCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'}: ${dynamicViscValue} ${state.dynamicViscosityUnit}\n`;
    if (kinematicViscValue) textToCopy += `  ${t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'}: ${kinematicViscValue} ${state.kinematicViscosityUnit}\n`;

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('reynoldsCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

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
        velocity: state.velocity || 'N/A',
        velocityUnit: state.velocityUnit,
        dimension: state.dimension || 'N/A',
        dimensionUnit: state.dimensionUnit,
        density: state.resultDensity || state.density || 'N/A',
        densityUnit: state.densityUnit,
        dynamicViscosity: state.resultDynamicViscosity || state.dynamicViscosity || 'N/A',
        dynamicViscosityUnit: state.dynamicViscosityUnit,
        kinematicViscosity: state.resultKinematicViscosity || state.kinematicViscosity || 'N/A',
        kinematicViscosityUnit: state.kinematicViscosityUnit,
      };

      const result = formatResult(state.resultReynolds);

      await saveCalculation(db, 'reynolds', JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('reynoldsCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenReynolds', { category, onSelectOption, selectedOption });
  }, [navigation]);

  const handleSelectPresetFluid = useCallback((option: string) => {
    if (option === 'custom') {
      setState((prev) => ({
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

    const rhoDisplay = (props.rho / conversionFactors.density[state.densityUnit]).toString();
    const muDisplay  = (props.mu  / conversionFactors.dynamicViscosity[state.dynamicViscosityUnit]).toString();

    setState((prev) => ({
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

  const renderInput = useCallback((
    labelKey: string,                     // << clave i18n, p.ej. 'reynoldsCalc.labels.velocity'
    value: string,
    onChange: (text: string) => void,
    fieldId?: 'velocity' | 'dimension' | 'density' | 'dynamicViscosity' | 'kinematicViscosity',
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean
  ) => {
    // Mapeo de unidades por fieldId (ya no por texto mostrado)
    const unitByField: { [K in NonNullable<typeof fieldId>]: string } = {
      velocity: state.velocityUnit,
      dimension: state.dimensionUnit,
      density: state.densityUnit,
      dynamicViscosity: state.dynamicViscosityUnit,
      kinematicViscosity: state.kinematicViscosityUnit,
    } as const;
  
    const shownLabel = displayLabel || t(labelKey);
    const unit = fieldId ? unitByField[fieldId] : '';
    const isFieldLocked = isLocked || (fieldId && state.lockedFluidField === fieldId);
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;
  
    // Mapeo categoría para OptionsScreen (sin strings hardcodeadas)
    const categoryByField: Record<NonNullable<typeof fieldId>, 'velocity' | 'length' | 'density' | 'dynamicViscosity' | 'kinematicViscosity'> = {
      velocity: 'velocity',
      dimension: 'length',
      density: 'density',
      dynamicViscosity: 'dynamicViscosity',
      kinematicViscosity: 'kinematicViscosity',
    };
  
    return (
      <View style={styles.inputWrapper}>
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {shownLabel}
          </Text>
          {(() => {
            const id = fieldId;
            const hasUserValue = (value?.trim()?.length ?? 0) > 0;
            const isInvalid = id ? state.invalidFields.includes(id) : false;
            const isAuto =
              (id && id === state.autoCalculatedField) &&
              !hasUserValue &&
              !!(resultValue && resultValue !== '');
          
            let dotColor = 'rgb(200,200,200)';
            if (isInvalid) dotColor = 'rgb(254, 12, 12)';
            else if (isAuto) dotColor = 'rgba(62, 136, 255, 1)';
            else if (hasUserValue) dotColor = 'rgb(194, 254, 12)';
          
            return <View style={[styles.valueDot, { backgroundColor: dotColor }]} />;
          })()}
        </View>
        
        <View style={styles.redContainer}>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: inputContainerBg }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={resultValue && resultValue !== '' ? resultValue : value}
                onChangeText={(text) => {
                  onChange(text);
                  if (fieldId) {
                    setState((prev) => ({
                      ...prev,
                      invalidFields: prev.invalidFields.filter((f) => f !== fieldId),
                      autoCalculatedField: prev.autoCalculatedField === fieldId ? null : prev.autoCalculatedField,
                      ...(fieldId === 'density' ? { resultDensity: '' } : {}),
                      ...(fieldId === 'dynamicViscosity' ? { resultDynamicViscosity: '' } : {}),
                      ...(fieldId === 'kinematicViscosity' ? { resultKinematicViscosity: '' } : {}),
                    }));
                  }
                }}
                editable={!isFieldLocked}
                selectTextOnFocus={!isFieldLocked}
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
                  const inputValue = state[field] as string;
                  const prevUnit = state[prevField] as string;
                  const resultVal = resultField ? (state[resultField] as string) : '';
                  const convertedInputValue = convertValue(inputValue, prevUnit, option, category as any);
                  let convertedResultValue = resultVal;
                  if (resultVal && resultField) {
                    convertedResultValue = convertValue(resultVal, prevUnit, option, category as any);
                  }
                  setState((prev) => ({
                    ...prev,
                    [field]: convertedInputValue,
                    [prevField]: option,
                    [`${field}Unit`]: option,
                    ...(resultField && convertedResultValue ? { [resultField]: convertedResultValue } as any : {}),
                  }));
                };
              
                switch (fieldId) {
                  case 'velocity':           updateUnit('velocity', 'prevVelocityUnit'); break;
                  case 'dimension':          updateUnit('dimension', 'prevDimensionUnit'); break;
                  case 'density':            updateUnit('density', 'prevDensityUnit', 'resultDensity'); break;
                  case 'dynamicViscosity':   updateUnit('dynamicViscosity', 'prevDynamicViscosityUnit', 'resultDynamicViscosity'); break;
                  case 'kinematicViscosity': updateUnit('kinematicViscosity', 'prevKinematicViscosityUnit', 'resultKinematicViscosity'); break;
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
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor, t]);

  return (
    <View 
      style={styles.safeArea}
    >
      <KeyboardAwareScrollView
        bottomOffset={50}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={toggleFavorite}>
                <IconFavorite
                  name={isFav ? "heart" : "heart-o"}
                  size={20}
                  color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                />
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('ReynoldsTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('reynoldsCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('reynoldsCalc.title') || 'Número de Reynolds'}</Text>
        </View>

        {/* Resultados */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('reynoldsCalc.saveToHistory') || 'Guardar en historial'}</Text>
                <Icon name="plus" size={16 * fontSizeFactor} color="rgba(255, 255, 255, 0.4)" style={styles.plusIcon} />
              </View>
              <View style={styles.imageContainer}>
                <View style={styles.flowContainer}>
                  <FastImage
                    source={backgroundImage}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {/* superposición para modo oscuro */}
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
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 14 * fontSizeFactor }
                      ]}
                    >
                      {t(regimeKey)}
                    </Text>
                  </View>
                  <View style={styles.flowValueContainer}>
                    <Text
                      style={[
                        styles.flowValue,
                        { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                      ]}
                    >
                      {adjustDecimalSeparator(formatNumber(state.resultReynolds))}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.buttonsContainer}>
          {[
            { icon: 'terminal', label: t('common.calculate') || 'Calcular', action: handleCalculate },
            { icon: 'copy', label: t('common.copy') || 'Copiar', action: handleCopy },
            { icon: 'trash', label: t('common.clear') || 'Limpiar', action: handleClear },
            { icon: 'clock', label: t('common.history') || 'Historial', action: () => navigation.navigate('HistoryScreenReynolds') },
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

        {/* Inputs */}
        <View
          style={[
            styles.inputsSection,
            { backgroundColor: themeColors.card }
          ]}
        >
          <View style={styles.inputsContainer}>
            {/* Parámetros de flujo */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}
            </Text>

            {renderInput(
              'reynoldsCalc.labels.velocity',
              state.velocity,
              (text) => setState((prev) => ({ ...prev, velocity: text })),
              'velocity'
            )}
            {renderInput(
              'reynoldsCalc.labels.dimension',
              state.dimension,
              (text) => setState((prev) => ({ ...prev, dimension: text })),
              'dimension'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Propiedades del fluido */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}
            </Text>

            {/* Fluidos predeterminados (picker 100% ancho) */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('reynoldsCalc.labels.presetFluids')}
              </Text>

              <Pressable
                style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
                onPress={() => {
                  navigateToOptions('presetFluids', (opt: string) => {
                    handleSelectPresetFluid(opt);
                  }, state.presetFluid);
                }}
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
              (text) => setState((prev) => ({ ...prev, density: text })),
              'density',
              state.resultDensity
            )}
            {renderInput(
              'reynoldsCalc.labels.dynamicViscosity',
              state.dynamicViscosity,
              (text) => setState((prev) => ({ ...prev, dynamicViscosity: text })),
              'dynamicViscosity',
              state.resultDynamicViscosity
            )}
            {renderInput(
              'reynoldsCalc.labels.kinematicViscosity',
              state.kinematicViscosity,
              (text) => setState((prev) => ({ ...prev, kinematicViscosity: text })),
              'kinematicViscosity',
              state.resultKinematicViscosity
            )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.4)', 
    borderRadius: 14, 
    marginLeft: 11, 
    marginTop: 11, 
    height: 28, 
    minWidth: 90, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 5 
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
});

export default ReynoldsCalc;