import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Clipboard, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
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
  }
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

  const [state, setState] = useState<CalculatorState>(initialState);

  const regimeKey = React.useMemo(() => {
    const Fr = state.resultFroude;
    if (!Fr || !isFinite(Fr)) {
      return 'froudeCalc.froude';
    }
    if (Fr < 1) return 'froudeCalc.regime.subcritical';
    if (Fr === 1) return 'froudeCalc.regime.critical';
    return 'froudeCalc.regime.supercritical';
  }, [state.resultFroude]);

  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;

  const bounceHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.15, useNativeDriver: true, bounciness: 8, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, bounciness: 8, speed: 40 }),
    ]).start();
  }, [heartScale]);

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
    } catch (e) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('common.genericError') });
    }
  }, [t]);

  useEffect(() => {
    updateLockedGeometryField();
  }, [state.area, state.width, state.hydraulicDepth]);

  useEffect(() => {
    if (isFav) {
      bounceHeart();
    }
  }, [isFav, bounceHeart]);

  const formatResult = useCallback((num: number): string => {
    if (isNaN(num)) return '';
    const fixed = num.toFixed(15);
    return fixed.replace(/\.?0+$/, '');
  }, []);

  const convertValue = useCallback((
    value: string,
    fromUnit: string,
    toUnit: string,
    category: 'area' | 'length' | 'velocity' | 'acceleration'
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

  const updateLockedGeometryField = useCallback(() => {
    const inputs = [
      { id: 'area', value: state.area },
      { id: 'width', value: state.width },
      { id: 'hydraulicDepth', value: state.hydraulicDepth },
    ];
    const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
    if (validInputs.length === 2) {
      const emptyInput = inputs.find(({ value }) => value === '' || isNaN(parseFloat(value.replace(',', '.'))));
      setState((prev) => ({ ...prev, lockedGeometryField: emptyInput ? emptyInput.id : null }));
    } else {
      setState((prev) => ({ ...prev, lockedGeometryField: null }));
    }
  }, [state.area, state.width, state.hydraulicDepth]);

  const calculateFroude = useCallback(() => {
    const area = state.area ? parseFloat(state.area.replace(',', '.')) * conversionFactors.area[state.areaUnit] : NaN;
    const width = state.width ? parseFloat(state.width.replace(',', '.')) * conversionFactors.length[state.widthUnit] : NaN;
    const hydraulicDepth = state.hydraulicDepth ? parseFloat(state.hydraulicDepth.replace(',', '.')) * conversionFactors.length[state.hydraulicDepthUnit] : NaN;
    const velocity = state.velocity ? parseFloat(state.velocity.replace(',', '.')) * conversionFactors.velocity[state.velocityUnit] : NaN;
    const gravity = state.gravity ? parseFloat(state.gravity.replace(',', '.')) * conversionFactors.acceleration[state.gravityUnit] : NaN;

    const invalids: string[] = [];
    if (isNaN(velocity)) invalids.push('velocity');
    if (isNaN(gravity)) invalids.push('gravity');

    const geometryProvidedCount = [area, width, hydraulicDepth].filter(v => !isNaN(v)).length;
    if (geometryProvidedCount < 2) {
      if (isNaN(area)) invalids.push('area');
      if (isNaN(width)) invalids.push('width');
      if (isNaN(hydraulicDepth)) invalids.push('hydraulicDepth');
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
        text2:
          (isNaN(velocity) || isNaN(gravity))
            ? (t('froudeCalc.toasts.velocityGravityRequired') || 'Velocidad y gravedad requeridas')
            : (t('froudeCalc.toasts.geometryRequired') || 'Se requieren al menos 2 parámetros geométricos'),
      });
      return;
    }

    const newState: Partial<CalculatorState> = {};

    if (geometryProvidedCount === 2) {
      if (isNaN(area)) {
        const calculated = width * hydraulicDepth;
        if (!isNaN(calculated) && isFinite(calculated) && calculated > 0) {
          const resultInTargetUnit = calculated / conversionFactors.area[state.areaUnit];
          newState.resultArea = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'area';
        }
      } else if (isNaN(width)) {
        const calculated = area / hydraulicDepth;
        if (!isNaN(calculated) && isFinite(calculated) && calculated > 0) {
          const resultInTargetUnit = calculated / conversionFactors.length[state.widthUnit];
          newState.resultWidth = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'width';
        }
      } else if (isNaN(hydraulicDepth)) {
        const calculated = area / width;
        if (!isNaN(calculated) && isFinite(calculated) && calculated > 0) {
          const resultInTargetUnit = calculated / conversionFactors.length[state.hydraulicDepthUnit];
          newState.resultHydraulicDepth = formatResult(resultInTargetUnit);
          newState.autoCalculatedField = 'hydraulicDepth';
        }
      }
    }

    const finalHydraulicDepth = !isNaN(hydraulicDepth)
      ? hydraulicDepth
      : (newState.resultHydraulicDepth ? parseFloat(newState.resultHydraulicDepth) * conversionFactors.length[state.hydraulicDepthUnit] : NaN);

    let froudeNumber = 0;
    if (!isNaN(finalHydraulicDepth) && !isNaN(velocity) && !isNaN(gravity) && finalHydraulicDepth > 0) {
      froudeNumber = velocity / Math.sqrt(gravity * finalHydraulicDepth);
    }

    newState.resultFroude = (!isNaN(froudeNumber) && isFinite(froudeNumber)) ? froudeNumber : 0;
    setState(prev => ({ ...prev, ...newState, invalidFields: [] }));
  }, [state, formatResult, t]);

  const handleCalculate = useCallback(() => {
    calculateFroude();
  }, [calculateFroude]);

  const handleClear = useCallback(() => {
    setState(initialState);
  }, []);

  const handleCopy = useCallback(() => {
    const hasResults = state.resultFroude !== 0 || state.resultArea || state.resultWidth || state.resultHydraulicDepth;

    if (!hasResults) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('froudeCalc.toasts.noResultsToCopy') || 'No hay resultados para copiar' });
      return;
    }

    let textToCopy = `${t('froudeCalc.title') || 'Calculadora de Froude'}\n\n`;

    if (state.resultFroude !== 0) {
      textToCopy += `${t('froudeCalc.froudeNumber') || 'Número de Froude'}: ${formatResult(state.resultFroude)}\n\n`;
    }

    textToCopy += `${t('froudeCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
    if (state.velocity) textToCopy += `  ${t('froudeCalc.labels.velocity') || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
    if (state.gravity) textToCopy += `  ${t('froudeCalc.labels.gravity') || 'Gravedad'}: ${state.gravity} ${state.gravityUnit}\n`;
    textToCopy += '\n';

    textToCopy += `${t('froudeCalc.geometryParameters') || 'Parámetros Geométricos'}:\n`;
    
    const areaValue = state.resultArea || state.area;
    const widthValue = state.resultWidth || state.width;
    const hydraulicDepthValue = state.resultHydraulicDepth || state.hydraulicDepth;
    
    if (areaValue) textToCopy += `  ${t('froudeCalc.labels.area') || 'Área'}: ${areaValue} ${state.areaUnit}\n`;
    if (widthValue) textToCopy += `  ${t('froudeCalc.labels.width') || 'Ancho'}: ${widthValue} ${state.widthUnit}\n`;
    if (hydraulicDepthValue) textToCopy += `  ${t('froudeCalc.labels.hydraulicDepth') || 'Profundidad Hidráulica'}: ${hydraulicDepthValue} ${state.hydraulicDepthUnit}\n`;

    Clipboard.setString(textToCopy);
    Toast.show({ type: 'success', text1: t('common.success'), text2: t('froudeCalc.toasts.copied') || 'Resultados copiados al portapapeles' });
  }, [state, formatResult, t]);

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
        area: state.resultArea || state.area || 'N/A',
        areaUnit: state.areaUnit,
        width: state.resultWidth || state.width || 'N/A',
        widthUnit: state.widthUnit,
        hydraulicDepth: state.resultHydraulicDepth || state.hydraulicDepth || 'N/A',
        hydraulicDepthUnit: state.hydraulicDepthUnit,
        velocity: state.velocity || 'N/A',
        velocityUnit: state.velocityUnit,
        gravity: state.gravity || 'N/A',
        gravityUnit: state.gravityUnit,
      };

      const result = formatResult(state.resultFroude);

      await saveCalculation(db, 'froude', JSON.stringify(inputs), result);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('froudeCalc.toasts.saved') || 'Cálculo guardado en el historial' });
    } catch (error) {
      console.error('Error al guardar el historial:', error);
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('froudeCalc.toasts.saveError') || 'Error al guardar en el historial' });
    }
  }, [state, formatResult, t]);

  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenFroude', { category, onSelectOption, selectedOption });
  }, [navigation]);

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
      area: state.areaUnit,
      width: state.widthUnit,
      hydraulicDepth: state.hydraulicDepthUnit,
      velocity: state.velocityUnit,
      gravity: state.gravityUnit,
    } as const;
  
    const shownLabel = displayLabel || t(labelKey);
    const unit = fieldId ? unitByField[fieldId] : '';
    const isFieldLocked = isLocked || (fieldId && state.lockedGeometryField === fieldId);
    const inputContainerBg = isFieldLocked ? themeColors.blockInput : themeColors.card;
  
    const categoryByField: Record<NonNullable<typeof fieldId>, 'area' | 'length' | 'velocity' | 'acceleration'> = {
      area: 'area',
      width: 'length',
      hydraulicDepth: 'length',
      velocity: 'velocity',
      gravity: 'acceleration',
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
                      ...(fieldId === 'area' ? { resultArea: '' } : {}),
                      ...(fieldId === 'width' ? { resultWidth: '' } : {}),
                      ...(fieldId === 'hydraulicDepth' ? { resultHydraulicDepth: '' } : {}),
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
                  case 'area':           updateUnit('area', 'prevAreaUnit', 'resultArea'); break;
                  case 'width':          updateUnit('width', 'prevWidthUnit', 'resultWidth'); break;
                  case 'hydraulicDepth': updateUnit('hydraulicDepth', 'prevHydraulicDepthUnit', 'resultHydraulicDepth'); break;
                  case 'velocity':       updateUnit('velocity', 'prevVelocityUnit'); break;
                  case 'gravity':        updateUnit('gravity', 'prevGravityUnit'); break;
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
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('FroudeTheory')}>
                <Icon name="book" size={20} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Títulos */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('froudeCalc.calculator') || 'Calculadora'}</Text>
          <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('froudeCalc.title') || 'Número de Froude'}</Text>
        </View>

        {/* Resultados */}
        <View style={styles.resultsMain}>
          <View style={styles.resultsContainerMain}>
            <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
              <View style={styles.saveButton}>
                <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('froudeCalc.saveToHistory') || 'Guardar en historial'}</Text>
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
                      {adjustDecimalSeparator(formatNumber(state.resultFroude))}
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
            { icon: 'clock', label: t('common.history') || 'Historial', action: () => navigation.navigate('HistoryScreenFroude') },
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
              {t('froudeCalc.flowParameters') || 'Parámetros de Flujo'}
            </Text>

            {renderInput(
              'froudeCalc.labels.velocity',
              state.velocity,
              (text) => setState((prev) => ({ ...prev, velocity: text })),
              'velocity'
            )}
            {renderInput(
              'froudeCalc.labels.gravity',
              state.gravity,
              (text) => setState((prev) => ({ ...prev, gravity: text })),
              'gravity'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Parámetros geométricos */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('froudeCalc.geometryParameters') || 'Parámetros Geométricos'}
            </Text>

            {renderInput(
              'froudeCalc.labels.area',
              state.area,
              (text) => setState((prev) => ({ ...prev, area: text })),
              'area',
              state.resultArea
            )}
            {renderInput(
              'froudeCalc.labels.width',
              state.width,
              (text) => setState((prev) => ({ ...prev, width: text })),
              'width',
              state.resultWidth
            )}
            {renderInput(
              'froudeCalc.labels.hydraulicDepth',
              state.hydraulicDepth,
              (text) => setState((prev) => ({ ...prev, hydraulicDepth: text })),
              'hydraulicDepth',
              state.resultHydraulicDepth
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

export default FroudeCalc;