import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from "@d11/react-native-fast-image";
import { Keyboard, LayoutAnimation } from 'react-native';

import { getDBConnection, createTable, saveCalculation } from '../../../src/services/database';
import { createFavoritesTable, isFavorite, addFavorite, removeFavorite } from '../../../src/services/database';

import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

// Tipos de navegación
type RootStackParamList = {
  OptionsScreenReynolds: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
  HistoryScreenReynolds: undefined;
  ReynoldsTheory: undefined;
};

// Imagen de fondo para el contenedor de resultados
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

// Estado de la calculadora
interface CalculatorState {
  // Parámetros de flujo
  velocity: string;
  dimension: string;
  velocityUnit: string;
  dimensionUnit: string;
  prevVelocityUnit: string;
  prevDimensionUnit: string;
  
  // Parámetros del fluido
  density: string;
  dynamicViscosity: string;
  kinematicViscosity: string;
  densityUnit: string;
  dynamicViscosityUnit: string;
  kinematicViscosityUnit: string;
  prevDensityUnit: string;
  prevDynamicViscosityUnit: string;
  prevKinematicViscosityUnit: string;
  
  // Resultados
  resultDensity: string;
  resultDynamicViscosity: string;
  resultKinematicViscosity: string;
  resultReynolds: number;
  
  // Campo bloqueado para viscosidades
  lockedFluidField: string | null;
}

// Factores de conversión
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  velocity: {
    'm/s': 1,                            // exacto
    'km/h': 0.27777777777777777778,      // exacto (= 1/3.6)
    'ft/s': 0.3048,                      // exacto
    'mph': 0.44704,                      // exacto
    'kn': 0.51444444444444444444,        // exacto (1 nmi/h; nmi = 1852 m)
    'cm/s': 0.01,                        // exacto
    'in/s': 0.0254,                      // exacto
  },
  length: {
    'm': 1,                              // exacto
    'mm': 0.001,                         // exacto
    'cm': 0.01,                          // exacto
    'km': 1000,                          // exacto
    'in': 0.0254,                        // exacto
    'ft': 0.3048,                        // exacto
    'yd': 0.9144,                        // exacto
    'mi': 1609.344,                      // exacto
  },
  density: {
    'kg/m³': 1,                          // exacto
    'g/cm³': 1000,                       // exacto
    'lb/ft³': 16.018463373960139580,     // exacto (lb = 0.45359237 kg; ft = 0.3048 m)
    'g/L': 1,                            // exacto
    'kg/L': 1000,                        // exacto
  },
  dynamicViscosity: {
    'Pa·s': 1,                           // exacto
    'cP': 0.001,                         // exacto (centipoise)
    'P': 0.1,                            // exacto (poise)
    'mPa·s': 0.001,                      // exacto
    'kg/(m·s)': 1,                       // exacto (mismo que Pa·s)
    'lb/(ft·s)': 1.4881639435695538,     // exacto
    'lb/(ft·h)': 0.00041338443155264994, // exacto
  },
  kinematicViscosity: {
    'm²/s': 1,                           // exacto
    'cSt': 0.000001,                     // exacto (centistokes)
    'St': 0.0001,                        // exacto (stokes)
    'mm²/s': 0.000001,                   // exacto
    'cm²/s': 0.0001,                     // exacto
    'ft²/s': 0.09290304,                 // exacto
    'ft²/h': 0.000025806400000000000,    // exacto
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
  // Parámetros de flujo
  velocity: '',
  dimension: '',
  velocityUnit: 'm/s',
  dimensionUnit: 'm',
  prevVelocityUnit: 'm/s',
  prevDimensionUnit: 'm',
  
  // Parámetros del fluido
  density: '',
  dynamicViscosity: '',
  kinematicViscosity: '',
  densityUnit: 'kg/m³',
  dynamicViscosityUnit: 'Pa·s',
  kinematicViscosityUnit: 'm²/s',
  prevDensityUnit: 'kg/m³',
  prevDynamicViscosityUnit: 'Pa·s',
  prevKinematicViscosityUnit: 'm²/s',
  
  // Resultados
  resultDensity: '',
  resultDynamicViscosity: '',
  resultKinematicViscosity: '',
  resultReynolds: 0,
  
  // Campo bloqueado para viscosidades
  lockedFluidField: null,
});

// Componente principal
const ReynoldsCalc: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const [inputSectionPadding, setInputSectionPadding] = useState(100);


  // Tema actual
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
      };
    }
    return {
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    };
  }, [currentTheme]);

  // Estado
  const [state, setState] = useState<CalculatorState>(initialState);

  // DB cache
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
      
        // Cargar estado inicial del corazón
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

  // Efecto para actualizar campo bloqueado para propiedades del fluido
  useEffect(() => {
    updateLockedFluidField();
  }, [state.density, state.dynamicViscosity, state.kinematicViscosity]);

  // Helpers
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
    // Convertir valores a unidades SI
    const velocity = state.velocity ? parseFloat(state.velocity.replace(',', '.')) * conversionFactors.velocity[state.velocityUnit] : NaN;
    const dimension = state.dimension ? parseFloat(state.dimension.replace(',', '.')) * conversionFactors.length[state.dimensionUnit] : NaN;
    const density = state.density ? parseFloat(state.density.replace(',', '.')) * conversionFactors.density[state.densityUnit] : NaN;
    const dynamicVisc = state.dynamicViscosity ? parseFloat(state.dynamicViscosity.replace(',', '.')) * conversionFactors.dynamicViscosity[state.dynamicViscosityUnit] : NaN;
    const kinematicVisc = state.kinematicViscosity ? parseFloat(state.kinematicViscosity.replace(',', '.')) * conversionFactors.kinematicViscosity[state.kinematicViscosityUnit] : NaN;

    // Validar que tengamos velocidad y dimensión
    if (isNaN(velocity) || isNaN(dimension)) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.velocityDimensionRequired') || 'Velocidad y dimensión requeridas' });
      return;
    }

    // Determinar qué propiedades del fluido tenemos
    const fluidProps = [!isNaN(density), !isNaN(dynamicVisc), !isNaN(kinematicVisc)];
    const validFluidProps = fluidProps.filter(Boolean).length;

    if (validFluidProps < 2) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('reynoldsCalc.toasts.fluidPropsRequired') || 'Se requieren al menos 2 propiedades del fluido' });
      setState((prev) => ({
        ...prev,
        resultDensity: '',
        resultDynamicViscosity: '',
        resultKinematicViscosity: '',
        resultReynolds: 0,
      }));
      return;
    }

    const newState: Partial<CalculatorState> = {};

    // Calcular propiedad faltante del fluido
    if (validFluidProps === 2) {
      if (isNaN(density) && !isNaN(dynamicVisc) && !isNaN(kinematicVisc)) {
        // Calcular densidad: μ = ρ * ν, entonces ρ = μ / ν
        const calculatedDensity = dynamicVisc / kinematicVisc;
        if (!isNaN(calculatedDensity) && isFinite(calculatedDensity) && calculatedDensity > 0) {
          const resultInTargetUnit = calculatedDensity / conversionFactors.density[state.densityUnit];
          newState.resultDensity = formatResult(resultInTargetUnit);
        }
      } else if (!isNaN(density) && isNaN(dynamicVisc) && !isNaN(kinematicVisc)) {
        // Calcular viscosidad dinámica: μ = ρ * ν
        const calculatedDynamicVisc = density * kinematicVisc;
        if (!isNaN(calculatedDynamicVisc) && isFinite(calculatedDynamicVisc)) {
          const resultInTargetUnit = calculatedDynamicVisc / conversionFactors.dynamicViscosity[state.dynamicViscosityUnit];
          newState.resultDynamicViscosity = formatResult(resultInTargetUnit);
        }
      } else if (!isNaN(density) && !isNaN(dynamicVisc) && isNaN(kinematicVisc)) {
        // Calcular viscosidad cinemática: ν = μ / ρ
        const calculatedKinematicVisc = dynamicVisc / density;
        if (!isNaN(calculatedKinematicVisc) && isFinite(calculatedKinematicVisc)) {
          const resultInTargetUnit = calculatedKinematicVisc / conversionFactors.kinematicViscosity[state.kinematicViscosityUnit];
          newState.resultKinematicViscosity = formatResult(resultInTargetUnit);
        }
      }
    }

    // Calcular número de Reynolds
    let reynoldsNumber = 0;

    // Usar densidad final (input o calculada)
    const finalDensity = !isNaN(density) ? density : (newState.resultDensity ? parseFloat(newState.resultDensity) * conversionFactors.density[state.densityUnit] : NaN);
    
    // Determinar qué método usar para calcular Reynolds
    if (!isNaN(finalDensity) && !isNaN(dynamicVisc)) {
      // Re = (ρ * v * L) / μ
      reynoldsNumber = (finalDensity * velocity * dimension) / dynamicVisc;
    } else if (!isNaN(kinematicVisc)) {
      // Re = (v * L) / ν
      reynoldsNumber = (velocity * dimension) / kinematicVisc;
    } else if (newState.resultDynamicViscosity && !isNaN(finalDensity)) {
      // Usar viscosidad dinámica calculada
      const calculatedDynamicVisc = parseFloat(newState.resultDynamicViscosity) * conversionFactors.dynamicViscosity[state.dynamicViscosityUnit];
      reynoldsNumber = (finalDensity * velocity * dimension) / calculatedDynamicVisc;
    } else if (newState.resultKinematicViscosity) {
      // Usar viscosidad cinemática calculada
      const calculatedKinematicVisc = parseFloat(newState.resultKinematicViscosity) * conversionFactors.kinematicViscosity[state.kinematicViscosityUnit];
      reynoldsNumber = (velocity * dimension) / calculatedKinematicVisc;
    }

    if (!isNaN(reynoldsNumber) && isFinite(reynoldsNumber)) {
      newState.resultReynolds = reynoldsNumber;
    } else {
      newState.resultReynolds = 0;
    }

    setState((prev) => ({ ...prev, ...newState }));
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
    
    // Número de Reynolds
    if (state.resultReynolds !== 0) {
      textToCopy += `${t('reynoldsCalc.reynoldsNumber') || 'Número de Reynolds'}: ${formatResult(state.resultReynolds)}\n\n`;
    }

    // Parámetros de flujo
    if (state.velocity || state.dimension) {
      textToCopy += `${t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
      if (state.velocity) textToCopy += `  ${t('reynoldsCalc.labels.velocity') || 'Velocidad'}: ${state.velocity} ${state.velocityUnit}\n`;
      if (state.dimension) textToCopy += `  ${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'}: ${state.dimension} ${state.dimensionUnit}\n`;
      textToCopy += '\n';
    }

    // Propiedades del fluido
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

      // Preparar datos de entrada
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

  // Navegar a selector de opciones/unidades
  const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
    navigation.navigate('OptionsScreenReynolds', { category, onSelectOption, selectedOption });
  }, [navigation]);

  // Render de input numérico con etiqueta
  const renderInput = useCallback((
    label: string,
    value: string,
    onChange: (text: string) => void,
    fieldId?: string,
    resultValue?: string,
    displayLabel?: string,
    isLocked?: boolean
  ) => {
    const unitMap: { [key: string]: string } = {
      'Velocidad': state.velocityUnit,
      'Dimensión Característica': state.dimensionUnit,
      'Densidad': state.densityUnit,
      'Viscosidad Dinámica': state.dynamicViscosityUnit,
      'Viscosidad Cinemática': state.kinematicViscosityUnit,
    };
    const unit = unitMap[label] || '';
    const shownLabel = displayLabel || label;
    const isFieldLocked = isLocked || (fieldId && state.lockedFluidField === fieldId);

    return (
      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{shownLabel}</Text>
        <View style={styles.redContainer}>
          <View
            style={[
              styles.Container,
              { experimental_backgroundImage: themeColors.gradient }
            ]}
          >
            <View style={[styles.innerWhiteContainer, { backgroundColor: 'themeColors.card' }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                keyboardType="numeric"
                value={resultValue && resultValue !== '' ? resultValue : value}
                onChangeText={(text) => onChange(text)}
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
              let category = '';
              switch (label) {
                case 'Velocidad':
                  category = 'velocity';
                  break;
                case 'Dimensión Característica':
                  category = 'length';
                  break;
                case 'Densidad':
                  category = 'density';
                  break;
                case 'Viscosidad Dinámica':
                  category = 'dynamicViscosity';
                  break;
                case 'Viscosidad Cinemática':
                  category = 'kinematicViscosity';
                  break;
              }

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

                switch (label) {
                  case 'Velocidad': updateUnit('velocity', 'prevVelocityUnit'); break;
                  case 'Dimensión Característica': updateUnit('dimension', 'prevDimensionUnit'); break;
                  case 'Densidad': updateUnit('density', 'prevDensityUnit', 'resultDensity'); break;
                  case 'Viscosidad Dinámica': updateUnit('dynamicViscosity', 'prevDynamicViscosityUnit', 'resultDynamicViscosity'); break;
                  case 'Viscosidad Cinemática': updateUnit('kinematicViscosity', 'prevKinematicViscosityUnit', 'resultKinematicViscosity'); break;
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
  }, [state, convertValue, navigateToOptions, themeColors, currentTheme, fontSizeFactor]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputSectionPadding(150);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInputSectionPadding(100);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={styles.iconContainer} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
          <View style={styles.rightIconsContainer}>
            <View style={styles.iconWrapper2}>
              <Pressable style={styles.iconContainer} onPress={toggleFavorite}>
                <IconFavorite
                  name={isFav ? "heart" : "heart-o"}
                  size={20}
                  color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                />
              </Pressable>
            </View>
            <View style={styles.iconWrapper2}>
              <Pressable style={styles.iconContainer} onPress={() => navigation.navigate('ReynoldsTheory')}>
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
                      {t('reynoldsCalc.reynolds') || 'Reynolds'}
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
                <Pressable style={styles.actionButton} onPress={action}>
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
            { backgroundColor: themeColors.card, paddingBottom: inputSectionPadding }
          ]}
        >
          <View style={styles.inputsContainer}>
            {/* Parámetros de flujo */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}
            </Text>

            {renderInput(
              'Velocidad',
              state.velocity,
              (text) => setState((prev) => ({ ...prev, velocity: text })),
              undefined,
              undefined,
              t('reynoldsCalc.labels.velocity') || 'Velocidad'
            )}

            {renderInput(
              'Dimensión Característica',
              state.dimension,
              (text) => setState((prev) => ({ ...prev, dimension: text })),
              undefined,
              undefined,
              t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'
            )}

            <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

            {/* Propiedades del fluido */}
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}
            </Text>

            {renderInput(
              'Densidad',
              state.density,
              (text) => setState((prev) => ({ ...prev, density: text })),
              'density',
              state.resultDensity,
              t('reynoldsCalc.labels.density') || 'Densidad'
            )}

            {renderInput(
              'Viscosidad Dinámica',
              state.dynamicViscosity,
              (text) => setState((prev) => ({ ...prev, dynamicViscosity: text })),
              'dynamicViscosity',
              state.resultDynamicViscosity,
              t('reynoldsCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'
            )}

            {renderInput(
              'Viscosidad Cinemática',
              state.kinematicViscosity,
              (text) => setState((prev) => ({ ...prev, kinematicViscosity: text })),
              'kinematicViscosity',
              state.resultKinematicViscosity,
              t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'
            )}
          </View>
        </View>
      </ScrollView>
      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

// Estilos (idénticos a BernoulliCalc)
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 1)' 
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
    borderRadius: 25, 
    paddingBottom: 100
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