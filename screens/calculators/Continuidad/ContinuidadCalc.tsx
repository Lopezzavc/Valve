  import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
  import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    ScrollView,
    Animated,
    Clipboard,
    LayoutChangeEvent,
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
    OptionsScreen: { category: string; onSelectOption?: (option: string) => void; selectedOption?: string };
    HistoryScreenContinuidad: undefined;
    ContinuidadTheory: undefined;
  };

  // Imagen de fondo para el contenedor de resultados
  const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

  // Tipos para los modos de cálculo y secciones
  type CalculatorMode = 'caudal' | 'continuidad';
  type SectionType = 'Circular' | 'Cuadrada' | 'Rectangular';
  type FillType = 'Total' | 'Parcial';

  // Estado de la calculadora
  interface CalculatorState {
    mode: CalculatorMode;
    sectionType: SectionType;
    diameter: string;
    side: string;
    rectWidth: string;
    rectHeight: string;
    fillType: FillType;
    fillHeight: string;
    velocityCaudal: string;
    A1: string;
    v1: string;
    A2: string;
    v2: string;
    diameterUnit: string;
    sideUnit: string;
    rectWidthUnit: string;
    rectHeightUnit: string;
    fillHeightUnit: string;
    velocityCaudalUnit: string;
    A1Unit: string;
    v1Unit: string;
    A2Unit: string;
    v2Unit: string;
    prevDiameterUnit: string;
    prevSideUnit: string;
    prevRectWidthUnit: string;
    prevRectHeightUnit: string;
    prevFillHeightUnit: string;
    prevVelocityCaudalUnit: string;
    prevA1Unit: 'm²';
    prevV1Unit: 'm/s';
    prevA2Unit: 'm²';
    prevV2Unit: 'm/s';
    resultCaudal: number;
    resultA1: string;
    resultV1: string;
    resultA2: string;
    resultV2: string;
    isManualEditA1: boolean;
    isManualEditV1: boolean;
    isManualEditA2: boolean;
    isManualEditV2: boolean;
    lockedField: string | null;
  }

  // Métricas internas de los botones
  interface ButtonMetrics {
    caudal: number;
    continuidad: number;
  }
  interface ButtonPositions {
    caudal: number;
    continuidad: number;
  }

  // Factores de conversión
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
  };

  // Configuración del Toast (textos se traducen al usarlos)
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
    mode: 'caudal',
    sectionType: 'Circular',
    diameter: '',
    side: '',
    rectWidth: '',
    rectHeight: '',
    fillType: 'Total',
    fillHeight: '',
    velocityCaudal: '',
    A1: '',
    v1: '',
    A2: '',
    v2: '',
    diameterUnit: 'm',
    sideUnit: 'm',
    rectWidthUnit: 'm',
    rectHeightUnit: 'm',
    fillHeightUnit: 'm',
    velocityCaudalUnit: 'm/s',
    A1Unit: 'm²',
    v1Unit: 'm/s',
    A2Unit: 'm²',
    v2Unit: 'm/s',
    prevDiameterUnit: 'm',
    prevSideUnit: 'm',
    prevRectWidthUnit: 'm',
    prevRectHeightUnit: 'm',
    prevFillHeightUnit: 'm',
    prevVelocityCaudalUnit: 'm/s',
    prevA1Unit: 'm²',
    prevV1Unit: 'm/s',
    prevA2Unit: 'm²',
    prevV2Unit: 'm/s',
    resultCaudal: 0,
    resultA1: '',
    resultV1: '',
    resultA2: '',
    resultV2: '',
    isManualEditA1: false,
    isManualEditV1: false,
    isManualEditA2: false,
    isManualEditV2: false,
    lockedField: null,
  });

  // Componente principal
  const ContinuidadCalc: React.FC = () => {
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
          cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
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
      };
    }, [currentTheme]);

    // Lazy init del estado
    const [state, setState] = useState<CalculatorState>(initialState);

    // Animaciones
    const animatedValue = useRef(new Animated.Value(0)).current;
    const animatedScale = useRef(new Animated.Value(1)).current;

    // Posición y tamaño de botones (medidos vía onLayout)
    const [buttonMetrics, setButtonMetrics] = useState<ButtonMetrics>({ caudal: 0, continuidad: 0 });
    const [buttonPositions, setButtonPositions] = useState<ButtonPositions>({ caudal: 0, continuidad: 0 });

    // DB cache (abre/crea tabla una vez)
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
          const fav = await isFavorite(db, 'ContinuidadCalc');
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
      
        const route = 'ContinuidadCalc';
        const label = t('continuidadCalc.title') || 'Calculadora de Continuidad';
      
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

    // Animación selector
    useEffect(() => {
      if (buttonMetrics.caudal > 0 && buttonMetrics.continuidad > 0) {
        const targetX = state.mode === 'caudal' ? buttonPositions.caudal : buttonPositions.continuidad;
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.mode, buttonMetrics, buttonPositions]);

    useEffect(() => {
      if (state.mode === 'continuidad') {
        updateLockedField();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.mode, state.A1, state.v1, state.A2, state.v2]);

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
      category: 'length' | 'velocity' | 'area'
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

    const calculateCaudal = useCallback(() => {
      const vel = state.velocityCaudal ? parseFloat(state.velocityCaudal.replace(',', '.')) * conversionFactors.velocity[state.velocityCaudalUnit] : NaN;
      if (isNaN(vel)) {
        setState((prev) => ({ ...prev, resultCaudal: 0 }));
        return;
      }
      let area = 0;

      switch (state.sectionType) {
        case 'Circular': {
          const d = state.diameter ? parseFloat(state.diameter.replace(',', '.')) * conversionFactors.length[state.diameterUnit] : NaN;
          if (isNaN(d) || d <= 0) break;
          const R = d / 2;
          if (state.fillType === 'Total') {
            area = Math.PI * R * R;
          } else {
            const h = state.fillHeight ? parseFloat(state.fillHeight.replace(',', '.')) * conversionFactors.length[state.fillHeightUnit] : NaN;
            if (isNaN(h)) break;
            const h_clamped = Math.min(Math.max(h, 0), d);
            const theta = 2 * Math.acos((R - h_clamped) / R);
            area = (R * R / 2) * (theta - Math.sin(theta));
          }
          break;
        }
        case 'Cuadrada': {
          const s = state.side ? parseFloat(state.side.replace(',', '.')) * conversionFactors.length[state.sideUnit] : NaN;
          if (isNaN(s) || s <= 0) break;
          if (state.fillType === 'Total') {
            area = s * s;
          } else {
            const h = state.fillHeight ? parseFloat(state.fillHeight.replace(',', '.')) * conversionFactors.length[state.fillHeightUnit] : NaN;
            if (isNaN(h)) break;
            const h_clamped = Math.min(Math.max(h, 0), s);
            area = s * h_clamped;
          }
          break;
        }
        case 'Rectangular': {
          const w = state.rectWidth ? parseFloat(state.rectWidth.replace(',', '.')) * conversionFactors.length[state.rectWidthUnit] : NaN;
          const h0 = state.rectHeight ? parseFloat(state.rectHeight.replace(',', '.')) * conversionFactors.length[state.rectHeightUnit] : NaN;
          if (isNaN(w) || isNaN(h0) || w <= 0 || h0 <= 0) break;
          if (state.fillType === 'Total') {
            area = w * h0;
          } else {
            const h = state.fillHeight ? parseFloat(state.fillHeight.replace(',', '.')) * conversionFactors.length[state.fillHeightUnit] : NaN;
            if (isNaN(h)) break;
            const h_clamped = Math.min(Math.max(h, 0), h0);
            area = w * h_clamped;
          }
          break;
        }
      }

      setState((prev) => ({ ...prev, resultCaudal: area * vel }));
    }, [state]);

    const calculateContinuity = useCallback(() => {
      const a1 = state.A1 ? parseFloat(state.A1.replace(',', '.')) * conversionFactors.area[state.A1Unit] : NaN;
      const vv1 = state.v1 ? parseFloat(state.v1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN;
      const a2 = state.A2 ? parseFloat(state.A2.replace(',', '.')) * conversionFactors.area[state.A2Unit] : NaN;
      const vv2 = state.v2 ? parseFloat(state.v2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN;

      const valids = [!isNaN(a1), !isNaN(vv1), !isNaN(a2), !isNaN(vv2)];
      const validCount = valids.filter(Boolean).length;

      if (validCount !== 3) {
        setState((prev) => ({
          ...prev,
          resultCaudal: 0,
          resultA1: '',
          resultV1: '',
          resultA2: '',
          resultV2: '',
        }));
        return;
      }

      let missing: string | null = null;
      if (isNaN(a1)) missing = 'A1';
      else if (isNaN(vv1)) missing = 'V1';
      else if (isNaN(a2)) missing = 'A2';
      else if (isNaN(vv2)) missing = 'V2';

      let newQ = 0;
      if (!isNaN(a1) && !isNaN(vv1)) newQ = a1 * vv1;
      else if (!isNaN(a2) && !isNaN(vv2)) newQ = a2 * vv2;

      const newState: Partial<CalculatorState> = { resultCaudal: newQ };

      switch (missing) {
        case 'A1': {
          if (vv1 === 0) break;
          const calc_si = (a2 * vv2) / vv1;
          if (!isNaN(calc_si) && isFinite(calc_si)) {
            const resultInTargetUnit = calc_si / conversionFactors.area[state.A1Unit];
            newState.resultA1 = formatResult(resultInTargetUnit);
          }
          break;
        }
        case 'V1': {
          if (a1 === 0) break;
          const calc_si = (a2 * vv2) / a1;
          if (!isNaN(calc_si) && isFinite(calc_si)) {
            const resultInTargetUnit = calc_si / conversionFactors.velocity[state.v1Unit];
            newState.resultV1 = formatResult(resultInTargetUnit);
          }
          break;
        }
        case 'A2': {
          if (vv2 === 0) break;
          const calc_si = (a1 * vv1) / vv2;
          if (!isNaN(calc_si) && isFinite(calc_si)) {
            const resultInTargetUnit = calc_si / conversionFactors.area[state.A2Unit];
            newState.resultA2 = formatResult(resultInTargetUnit);
          }
          break;
        }
        case 'V2': {
          if (a2 === 0) break;
          const calc_si = (a1 * vv1) / a2;
          if (!isNaN(calc_si) && isFinite(calc_si)) {
            const resultInTargetUnit = calc_si / conversionFactors.velocity[state.v2Unit];
            newState.resultV2 = formatResult(resultInTargetUnit);
          }
          break;
        }
      }

      setState((prev) => ({ ...prev, ...newState }));
    }, [state, formatResult]);

    const handleCalculate = useCallback(() => {
      state.mode === 'caudal' ? calculateCaudal() : calculateContinuity();
    }, [state.mode, calculateCaudal, calculateContinuity]);

    const handleClear = useCallback(() => {
      setState((prev) => ({
        ...prev,
        sectionType: 'Circular',
        diameter: '',
        side: '',
        rectWidth: '',
        rectHeight: '',
        fillType: 'Total',
        fillHeight: '',
        velocityCaudal: '',
        A1: '',
        v1: '',
        A2: '',
        v2: '',
        diameterUnit: 'm',
        sideUnit: 'm',
        rectWidthUnit: 'm',
        rectHeightUnit: 'm',
        fillHeightUnit: 'm',
        velocityCaudalUnit: 'm/s',
        A1Unit: 'm²',
        v1Unit: 'm/s',
        A2Unit: 'm²',
        v2Unit: 'm/s',
        prevDiameterUnit: 'm',
        prevSideUnit: 'm',
        prevRectWidthUnit: 'm',
        prevRectHeightUnit: 'm',
        prevFillHeightUnit: 'm',
        prevVelocityCaudalUnit: 'm/s',
        prevA1Unit: 'm²',
        prevV1Unit: 'm/s',
        prevA2Unit: 'm²',
        prevV2Unit: 'm/s',
        resultCaudal: 0,
        resultA1: '',
        resultV1: '',
        resultA2: '',
        resultV2: '',
        isManualEditA1: false,
        isManualEditV1: false,
        isManualEditA2: false,
        isManualEditV2: false,
        lockedField: null,
      }));
    }, []);

    const handleCopy = useCallback(() => {
      let textToCopy = '';
      const caudalValue = state.resultCaudal;
      const formattedCaudal = isNaN(caudalValue) ? '0' : formatResult(caudalValue);

      if (state.mode === 'caudal') {
        if (state.resultCaudal === 0 || isNaN(state.resultCaudal)) {
          Toast.show({ type: 'error', text1: t('common.error'), text2: t('continuidadCalc.toasts.noFlowToCopy') });
          return;
        }
        textToCopy += `${t('continuidadCalc.flow')}: ${formattedCaudal} m³/s\n`;
        textToCopy += `${t('continuidadCalc.section')}: ${translateSectionValue(state.sectionType, t)}\n`;
        switch (state.sectionType) {
          case 'Circular':
            textToCopy += `${t('continuidadCalc.labels.diameter')}: ${state.diameter} ${state.diameterUnit}\n`;
            break;
          case 'Cuadrada':
            textToCopy += `${t('continuidadCalc.labels.side')}: ${state.side} ${state.sideUnit}\n`;
            break;
          case 'Rectangular':
            textToCopy += `${t('continuidadCalc.labels.width')}: ${state.rectWidth} ${state.rectWidthUnit}\n`;
            textToCopy += `${t('continuidadCalc.labels.height')}: ${state.rectHeight} ${state.rectHeightUnit}\n`;
            break;
        }
        textToCopy += `${t('continuidadCalc.labels.velocity')}: ${state.velocityCaudal} ${state.velocityCaudalUnit}\n`;
        textToCopy += `${t('continuidadCalc.fill')}: ${translateFillValue(state.fillType, t)}\n`;
        if (state.fillType === 'Parcial') {
          textToCopy += `${t('continuidadCalc.labels.fillHeight')}: ${state.fillHeight} ${state.fillHeightUnit}\n`;
        }
      } else {
        const resultValue = state.resultA1 || state.resultV1 || state.resultA2 || state.resultV2;
        const inputValue = state.A1 || state.v1 || state.A2 || state.v2;

        if (!resultValue && !inputValue) {
          Toast.show({ type: 'error', text1: t('common.error'), text2: t('continuidadCalc.toasts.noContinuityToCopy') });
          return;
        }

        textToCopy += `${t('continuidadCalc.flow')}: ${formattedCaudal} m³/s\n`;
        textToCopy += `${t('continuidadCalc.section1')}\n`;
        textToCopy += `  ${t('continuidadCalc.labels.A1')}: ${state.isManualEditA1 ? state.A1 : state.resultA1} ${state.A1Unit}\n`;
        textToCopy += `  ${t('continuidadCalc.labels.v1')}: ${state.isManualEditV1 ? state.v1 : state.resultV1} ${state.v1Unit}\n`;
        textToCopy += `${t('continuidadCalc.section2')}\n`;
        textToCopy += `  ${t('continuidadCalc.labels.A2')}: ${state.isManualEditA2 ? state.A2 : state.resultA2} ${state.A2Unit}\n`;
        textToCopy += `  ${t('continuidadCalc.labels.v2')}: ${state.isManualEditV2 ? state.v2 : state.resultV2} ${state.v2Unit}\n`;
      }

      Clipboard.setString(textToCopy);
      Toast.show({ type: 'success', text1: t('common.success'), text2: t('continuidadCalc.toasts.copied') });
    }, [state, formatResult, t]);

    const handleSaveHistory = useCallback(async () => {
      const noResults =
        (state.mode === 'caudal' && state.resultCaudal === 0) ||
        (state.mode === 'continuidad' &&
          state.resultCaudal === 0 &&
          !state.resultA1 &&
          !state.resultV1 &&
          !state.resultA2 &&
          !state.resultV2);

      if (noResults) {
        Toast.show({ type: 'error', text1: t('common.error'), text2: t('continuidadCalc.toasts.nothingToSave') });
        return;
      }

      try {
        const db = dbRef.current ?? await getDBConnection();
        if (!dbRef.current) {
          try { await createTable(db); } catch {}
          dbRef.current = db;
        }

        let inputs: any;
        let result: string;

        if (state.mode === 'caudal') {
          inputs = {
            sectionType: state.sectionType,
            fillType: state.fillType,
            diameter: state.diameter,
            diameterUnit: state.diameterUnit,
            side: state.side,
            sideUnit: state.sideUnit,
            rectWidth: state.rectWidth,
            rectWidthUnit: state.rectWidthUnit,
            rectHeight: state.rectHeight,
            rectHeightUnit: state.rectHeightUnit,
            fillHeight: state.fillHeight,
            fillHeightUnit: state.fillHeightUnit,
            velocityCaudal: state.velocityCaudal,
            velocityCaudalUnit: state.velocityCaudalUnit,
          };
          result = formatResult(state.resultCaudal);
        } else {
          let finalA1 = state.isManualEditA1 ? state.A1 : state.resultA1 || state.A1;
          let finalV1 = state.isManualEditV1 ? state.v1 : state.resultV1 || state.v1;
          let finalA2 = state.isManualEditA2 ? state.A2 : state.resultA2 || state.A2;
          let finalV2 = state.isManualEditV2 ? state.v2 : state.resultV2 || state.v2;

          const validFields = [
            finalA1 ? parseFloat(finalA1.replace(',', '.')) * conversionFactors.area[state.A1Unit] : NaN,
            finalV1 ? parseFloat(finalV1.replace(',', '.')) * conversionFactors.velocity[state.v1Unit] : NaN,
            finalA2 ? parseFloat(finalA2.replace(',', '.')) * conversionFactors.area[state.A2Unit] : NaN,
            finalV2 ? parseFloat(finalV2.replace(',', '.')) * conversionFactors.velocity[state.v2Unit] : NaN,
          ];
          const validCount = validFields.filter((v) => !isNaN(v)).length;

          if (validCount >= 2 && state.resultCaudal !== 0) {
            const Q = state.resultCaudal;
            if (isNaN(validFields[0]) && !isNaN(validFields[1]) && !isNaN(validFields[2]) && !isNaN(validFields[3])) {
              finalA1 = formatResult(Q / (validFields[1] * conversionFactors.area[state.A1Unit]));
            } else if (isNaN(validFields[1]) && !isNaN(validFields[0]) && !isNaN(validFields[2]) && !isNaN(validFields[3])) {
              finalV1 = formatResult(Q / (validFields[0] * conversionFactors.velocity[state.v1Unit]));
            } else if (isNaN(validFields[2]) && !isNaN(validFields[0]) && !isNaN(validFields[1]) && !isNaN(validFields[3])) {
              finalA2 = formatResult(Q / (validFields[3] * conversionFactors.area[state.A2Unit]));
            } else if (isNaN(validFields[3]) && !isNaN(validFields[0]) && !isNaN(validFields[1]) && !isNaN(validFields[2])) {
              finalV2 = formatResult(Q / (validFields[2] * conversionFactors.velocity[state.v2Unit]));
            }
          }

          inputs = {
            A1: finalA1 || 'N/A',
            A1Unit: state.A1Unit,
            v1: finalV1 || 'N/A',
            v1Unit: state.v1Unit,
            A2: finalA2 || 'N/A',
            A2Unit: state.A2Unit,
            v2: finalV2 || 'N/A',
            v2Unit: state.v2Unit,
          };
          result = formatResult(state.resultCaudal);
        }

        await saveCalculation(db, state.mode, JSON.stringify(inputs), result);
        Toast.show({ type: 'success', text1: t('common.success'), text2: t('continuidadCalc.toasts.saved') });
      } catch (error) {
        console.error('Error al guardar el historial:', error);
        Toast.show({ type: 'error', text1: t('common.error'), text2: t('continuidadCalc.toasts.saveError') });
      }
    }, [state, formatNumber, formatResult, t]);

    const updateLockedField = useCallback(() => {
      const inputs = [
        { id: 'A1', value: state.A1 },
        { id: 'V1', value: state.v1 },
        { id: 'A2', value: state.A2 },
        { id: 'V2', value: state.v2 },
      ];
      const validInputs = inputs.filter(({ value }) => value !== '' && !isNaN(parseFloat(value.replace(',', '.'))));
      if (validInputs.length === 3) {
        const emptyInput = inputs.find(({ value }) => value === '' || isNaN(parseFloat(value.replace(',', '.'))));
        setState((prev) => ({ ...prev, lockedField: emptyInput ? emptyInput.id : null }));
      } else {
        setState((prev) => ({ ...prev, lockedField: null }));
      }
    }, [state.A1, state.v1, state.A2, state.v2]);

    // Navegar a selector de opciones/unidades (memo)
    const navigateToOptions = useCallback((category: string, onSelectOption: (opt: string) => void, selectedOption?: string) => {
      navigation.navigate('OptionsScreen', { category, onSelectOption, selectedOption });
    }, [navigation]);

    const translateSectionValue = (value: SectionType, tp: typeof t) => {
      switch (value) {
        case 'Circular': return tp('continuidadCalc.options.sectionType.circular');
        case 'Cuadrada': return tp('continuidadCalc.options.sectionType.square');
        case 'Rectangular': return tp('continuidadCalc.options.sectionType.rectangular');
        default: return value;
      }
    };
    const translateFillValue = (value: FillType, tp: typeof t) => {
      switch (value) {
        case 'Total': return tp('continuidadCalc.options.fillType.total');
        case 'Parcial': return tp('continuidadCalc.options.fillType.partial');
        default: return value;
      }
    };

    // Render de input numérico con etiqueta visible traducida SIN romper mapas internos
    const renderInput = useCallback((
      label: string,                              // clave interna (ES) usada en unitMap
      value: string,
      onChange: (text: string) => void,
      setManualEdit: (value: boolean) => void,
      fieldId?: string,
      resultValue?: string,
      displayLabel?: string                       // NUEVO: etiqueta traducida para UI
    ) => {
      const unitMap: { [key: string]: string } = {
        'Diámetro': state.diameterUnit,
        'Lado': state.sideUnit,
        'Ancho': state.rectWidthUnit,
        'Alto': state.rectHeightUnit,
        'Altura de lámina': state.fillHeightUnit,
        'Velocidad': state.velocityCaudalUnit,
        'Área de la sección (A₁)': state.A1Unit,
        'Velocidad en la sección (v₁)': state.v1Unit,
        'Área de la sección (A₂)': state.A2Unit,
        'Velocidad en la sección (v₂)': state.v2Unit,
      };
      const unit = unitMap[label] || '';
      const shownLabel = displayLabel || label;

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
              <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
                <TextInput
                  style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                  keyboardType="numeric"
                  value={resultValue && resultValue !== '' ? resultValue : value}
                  onChangeText={(text) => {
                    onChange(text);
                    setManualEdit(true);
                    if (label !== 'Área de la sección (A₁)') setState((prev) => ({ ...prev, isManualEditA1: false }));
                    if (label !== 'Velocidad en la sección (v₁)') setState((prev) => ({ ...prev, isManualEditV1: false }));
                    if (label !== 'Área de la sección (A₂)') setState((prev) => ({ ...prev, isManualEditA2: false }));
                    if (label !== 'Velocidad en la sección (v₂)') setState((prev) => ({ ...prev, isManualEditV2: false }));
                    updateLockedField();
                  }}
                  editable={state.mode !== 'continuidad' || state.lockedField !== fieldId}
                  selectTextOnFocus={state.mode !== 'continuidad' || state.lockedField !== fieldId}
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
                const category =
                  ['Diámetro', 'Lado', 'Ancho', 'Alto', 'Altura de lámina'].includes(label)
                    ? 'length'
                    : ['Velocidad', 'Velocidad en la sección (v₁)', 'Velocidad en la sección (v₂)'].includes(label)
                    ? 'velocity'
                    : 'area';

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
                    case 'Diámetro': updateUnit('diameter', 'prevDiameterUnit'); break;
                    case 'Lado': updateUnit('side', 'prevSideUnit'); break;
                    case 'Ancho': updateUnit('rectWidth', 'prevRectWidthUnit'); break;
                    case 'Alto': updateUnit('rectHeight', 'prevRectHeightUnit'); break;
                    case 'Altura de lámina': updateUnit('fillHeight', 'prevFillHeightUnit'); break;
                    case 'Velocidad': updateUnit('velocityCaudal', 'prevVelocityCaudalUnit'); break;
                    case 'Área de la sección (A₁)': updateUnit('A1', 'prevA1Unit', 'resultA1'); break;
                    case 'Velocidad en la sección (v₁)': updateUnit('v1', 'prevV1Unit', 'resultV1'); break;
                    case 'Área de la sección (A₂)': updateUnit('A2', 'prevA2Unit', 'resultA2'); break;
                    case 'Velocidad en la sección (v₂)': updateUnit('v2', 'prevV2Unit', 'resultV2'); break;
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
    }, [state, convertValue, navigateToOptions, updateLockedField, themeColors, currentTheme, fontSizeFactor]);

    // Selectores con etiqueta visible traducida SIN depender del texto para la lógica
    const renderPickerContainer = useCallback((
      internalType: 'sectionType' | 'fillType',
      labelDisplay: string,
      value: string,
      onSelect: (option: string) => void
    ) => (
      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{labelDisplay}</Text>
        <Pressable
          style={[
            styles.pickerPressable,
            { experimental_backgroundImage: themeColors.gradient }
          ]}
          onPress={() => {
            navigateToOptions(internalType, onSelect, value);
          }}
        >
          <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {internalType === 'sectionType' ? translateSectionValue(value as SectionType, t) : translateFillValue(value as FillType, t)}
            </Text>
            <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
          </View>
        </Pressable>
      </View>
    ), [navigateToOptions, themeColors, t, fontSizeFactor]);

    // Inputs por modo
    const renderCaudalInputs = useCallback(() => (
      <>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.section')}</Text>

        {renderPickerContainer(
          'sectionType',
          t('continuidadCalc.labels.sectionType'),
          state.sectionType,
          (option: string) => setState((prev) => ({ ...prev, sectionType: option as SectionType }))
        )}

        {state.sectionType === 'Circular' && renderInput(
          'Diámetro',
          state.diameter,
          (text) => setState((prev) => ({ ...prev, diameter: text })),
          () => {},
          undefined,
          undefined,
          t('continuidadCalc.labels.diameter')
        )}

        {state.sectionType === 'Cuadrada' && renderInput(
          'Lado',
          state.side,
          (text) => setState((prev) => ({ ...prev, side: text })),
          () => {},
          undefined,
          undefined,
          t('continuidadCalc.labels.side')
        )}

        {state.sectionType === 'Rectangular' && (
          <>
            {renderInput(
              'Ancho',
              state.rectWidth,
              (text) => setState((prev) => ({ ...prev, rectWidth: text })),
              () => {},
              undefined,
              undefined,
              t('continuidadCalc.labels.width')
            )}
            {renderInput(
              'Alto',
              state.rectHeight,
              (text) => setState((prev) => ({ ...prev, rectHeight: text })),
              () => {},
              undefined,
              undefined,
              t('continuidadCalc.labels.height')
            )}
          </>
        )}

        <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
        <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.fluidProps')}</Text>

        {renderInput(
          'Velocidad',
          state.velocityCaudal,
          (text) => setState((prev) => ({ ...prev, velocityCaudal: text })),
          () => {},
          undefined,
          undefined,
          t('continuidadCalc.labels.velocity')
        )}

        {renderPickerContainer(
          'fillType',
          t('continuidadCalc.labels.fillType'),
          state.fillType,
          (option: string) => setState((prev) => ({ ...prev, fillType: option as FillType }))
        )}

        {state.fillType === 'Parcial' && renderInput(
          'Altura de lámina',
          state.fillHeight,
          (text) => setState((prev) => ({ ...prev, fillHeight: text })),
          () => {},
          undefined,
          undefined,
          t('continuidadCalc.labels.fillHeight')
        )}
      </>
    ), [renderPickerContainer, renderInput, state.sectionType, state.fillType, state.diameter, state.side, state.rectWidth, state.rectHeight, state.velocityCaudal, state.fillHeight, themeColors, t, fontSizeFactor]); // ✅ Añadido

    const renderContinuityInputs = useCallback(() => (
      <>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.section1')}</Text>
        {renderInput('Área de la sección (A₁)', state.A1, (text) => setState((prev) => ({ ...prev, A1: text })), (value) => setState((prev) => ({ ...prev, isManualEditA1: value })), 'A1', state.isManualEditA1 ? state.A1 : state.resultA1, t('continuidadCalc.labels.A1'))}
        {renderInput('Velocidad en la sección (v₁)', state.v1, (text) => setState((prev) => ({ ...prev, v1: text })), (value) => setState((prev) => ({ ...prev, isManualEditV1: value })), 'V1', state.isManualEditV1 ? state.v1 : state.resultV1, t('continuidadCalc.labels.v1'))}
        <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
        <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.section2')}</Text>
        {renderInput('Área de la sección (A₂)', state.A2, (text) => setState((prev) => ({ ...prev, A2: text })), (value) => setState((prev) => ({ ...prev, isManualEditA2: value })), 'A2', state.isManualEditA2 ? state.A2 : state.resultA2, t('continuidadCalc.labels.A2'))}
        {renderInput('Velocidad en la sección (v₂)', state.v2, (text) => setState((prev) => ({ ...prev, v2: text })), (value) => setState((prev) => ({ ...prev, isManualEditV2: value })), 'V2', state.isManualEditV2 ? state.v2 : state.resultV2, t('continuidadCalc.labels.v2'))}
      </>
    ), [renderInput, state.A1, state.v1, state.A2, state.v2, state.isManualEditA1, state.isManualEditV1, state.isManualEditA2, state.isManualEditV2, state.resultA1, state.resultV1, state.resultA2, state.resultV2, themeColors, t, fontSizeFactor]); // ✅ Añadido

    // onLayout handlers
    const onLayoutCaudal = useCallback((e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setButtonPositions((prev) => ({ ...prev, caudal: x }));
      setButtonMetrics((prev) => ({ ...prev, caudal: width }));
    }, []);
    const onLayoutContinuidad = useCallback((e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      setButtonPositions((prev) => ({ ...prev, continuidad: x }));
      setButtonMetrics((prev) => ({ ...prev, continuidad: width }));
    }, []);

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
              <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
                <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
              </Pressable>
            </View>
            <View style={styles.rightIconsContainer}>
              <View style={styles.iconWrapper2}>
                <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={toggleFavorite}>
                  <IconFavorite
                    name={isFav ? "heart" : "heart-o"}   // cambia entre corazón lleno y vacío
                    size={20}
                    color={isFav ? "rgba(255, 63, 63, 1)" : "rgb(255, 255, 255)"}
                  />
                </Pressable>
              </View>
              <View style={styles.iconWrapper2}>
                <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.navigate('ContinuidadTheory')}>
                  <Icon name="book" size={20} color="rgb(255, 255, 255)" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Títulos */}
          <View style={styles.titlesContainer}>
            <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.calculator')}</Text>
            <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>{t('continuidadCalc.title')}</Text>
          </View>

          {/* Resultados */}
          <View style={styles.resultsMain}>
            <View style={styles.resultsContainerMain}>
              <Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
                <View style={styles.saveButton}>
                  <Text style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}>{t('continuidadCalc.saveToHistory')}</Text>
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
                        {t('continuidadCalc.flow')}
                      </Text>
                    </View>
                    <View style={styles.flowValueContainer}>
                      <Text
                        style={[
                          styles.flowValue,
                          { color: currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)', fontSize: 30 * fontSizeFactor }
                        ]}
                      >
                        {adjustDecimalSeparator(formatNumber(state.resultCaudal))}
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
              { icon: 'terminal', label: t('common.calculate'), action: handleCalculate },
              { icon: 'copy', label: t('common.copy'), action: handleCopy },
              { icon: 'trash', label: t('common.clear'), action: handleClear },
              { icon: 'clock', label: t('common.history'), action: () => navigation.navigate('HistoryScreenContinuidad') },
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
              { backgroundColor: themeColors.card, paddingBottom: inputSectionPadding }
            ]}
          >
            <View style={styles.buttonContainer}>
              <Animated.View
                style={[
                  styles.overlay,
                  {
                    experimental_backgroundImage: themeColors.gradient,
                    width: state.mode === 'caudal' ? buttonMetrics.caudal : buttonMetrics.continuidad,
                    transform: [{ translateX: animatedValue }, { scale: animatedScale }],
                  },
                ]}
              >
                <View style={[styles.overlayInner, { backgroundColor: themeColors.card }]}></View>
              </Animated.View>

              <Pressable
                onLayout={onLayoutCaudal}
                style={[styles.button, state.mode === 'caudal' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setState((prev) => ({ ...prev, mode: 'caudal' }))}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >{t('continuidadCalc.mode.flow')}</Text>
              </Pressable>

              <Pressable
                onLayout={onLayoutContinuidad}
                style={[styles.button, state.mode === 'continuidad' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setState((prev) => ({ ...prev, mode: 'continuidad' }))}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} >{t('continuidadCalc.mode.continuity')}</Text>
              </Pressable>
            </View>

            <View style={[styles.separator2, { backgroundColor: themeColors.separator }]} />
            <View style={styles.inputsContainer}>
              {state.mode === 'caudal' ? renderCaudalInputs() : renderContinuityInputs()}
            </View>
          </View>
        </ScrollView>
        <Toast config={toastConfig} position="bottom" />
      </View>
    );
  };

// Estilos (SIN CAMBIOS)
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
});

export default ContinuidadCalc;