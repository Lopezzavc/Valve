import React, { useState, useCallback, useRef, useMemo, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon2 from 'react-native-vector-icons/Feather';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ExcelJS from 'exceljs';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { encode as base64FromArrayBuffer } from 'base64-arraybuffer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';

import { getDBConnection, getHistory, deleteHistory } from '../../../src/services/database';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';

import { useTheme } from '../../../contexts/ThemeContext';

import { LanguageContext } from '../../../contexts/LanguageContext';

import { FontSizeContext } from '../../../contexts/FontSizeContext';

const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'rgb(194, 254, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontFamily: 'SFUIDisplay-Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'SFUIDisplay-Medium',
      }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: 'rgb(254, 12, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontFamily: 'SFUIDisplay-Medium',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'SFUIDisplay-Medium',
      }}
    />
  ),
};

interface HistoryItem {
  id: number;
  calculation_type: 'Continuidad_caudal' | 'Continuidad_continuidad';
  inputs: string;
  result: string;
  timestamp: number;
}

const { width } = Dimensions.get('window');
const ORIGINAL_WIDTH = width - 40;
const BUTTON_SIZE = 45;

const REVEAL_OFFSET = -(BUTTON_SIZE + 20);

const applyExcelCell = (row: ExcelJS.Row, col: number, numFmt?: string) => {
  const cell = row.getCell(col);
  if (numFmt) cell.numFmt = numFmt;
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
};

const applyExcelCells = (row: ExcelJS.Row, cols: number[], numFmt?: string) => {
  cols.forEach(col => applyExcelCell(row, col, numFmt));
};

const applyHeaderStyle = (sheet: ExcelJS.Worksheet) => {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { bold: true };
  });
};

const setColumnWidths = (sheet: ExcelJS.Worksheet, columnCount: number, defaultWidth: number = 15) => {
  for (let i = 1; i <= columnCount; i++) {
    sheet.getColumn(i).width = defaultWidth;
  }
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
};

type ParsedInputs = Record<string, any>;

const translateSectionValue = (value: string, t: (k: string, vars?: any) => string) => {
  switch (value) {
    case 'Circular':
      return t('continuidadCalc.options.sectionType.circular');
    case 'Cuadrada':
      return t('continuidadCalc.options.sectionType.square');
    case 'Rectangular':
      return t('continuidadCalc.options.sectionType.rectangular');
    default:
      return value;
  }
};

const translateFillValue = (value: string, t: (k: string, vars?: any) => string) => {
  switch (value) {
    case 'Total':
      return t('continuidadCalc.options.fillType.total');
    case 'Parcial':
      return t('continuidadCalc.options.fillType.partial');
    default:
      return value;
  }
};

const buildInputsString = (item: HistoryItem, parsedInputs: ParsedInputs, t: (k: string, vars?: any) => string) => {
  if (item.calculation_type === 'Continuidad_caudal') {
    const { sectionType, fillType, ...restInputs } = parsedInputs;
    let inputString = `${t('continuidadCalc.labels.sectionType')}: ${translateSectionValue(sectionType, t)}\n`;
    if (sectionType === 'Circular') {
      inputString += `${t('continuidadCalc.labels.diameter')}: ${restInputs.diameter} ${restInputs.diameterUnit}\n`;
    } else if (sectionType === 'Cuadrada') {
      inputString += `${t('continuidadCalc.labels.side')}: ${restInputs.side} ${restInputs.sideUnit}\n`;
    } else if (sectionType === 'Rectangular') {
      inputString += `${t('continuidadCalc.labels.width')}: ${restInputs.rectWidth} ${restInputs.rectWidthUnit}\n`;
      inputString += `${t('continuidadCalc.labels.height')}: ${restInputs.rectHeight} ${restInputs.rectHeightUnit}\n`;
    }
    inputString += `${t('continuidadCalc.labels.velocity')}: ${restInputs.velocityCaudal} ${restInputs.velocityCaudalUnit}\n`;
    inputString += `${t('continuidadCalc.labels.fillType')}: ${translateFillValue(fillType, t)}\n`;
    if (fillType === 'Parcial') {
      inputString += `${t('continuidadCalc.labels.fillHeight')}: ${restInputs.fillHeight} ${restInputs.fillHeightUnit}`;
    }
    return inputString;
  } else {
    const { A1, A1Unit, v1, v1Unit, A2, A2Unit, v2, v2Unit } = parsedInputs;
    return (
      `${t('continuidadCalc.section1')}:\n` +
      `  ${t('continuidadCalc.labels.A1')}: ${A1 ?? 'N/A'} ${A1Unit ?? ''}\n` +
      `  ${t('continuidadCalc.labels.v1')}: ${v1 ?? 'N/A'} ${v1Unit ?? ''}\n` +
      `${t('continuidadCalc.section2')}:\n` +
      `  ${t('continuidadCalc.labels.A2')}: ${A2 ?? 'N/A'} ${A2Unit ?? ''}\n` +
      `  ${t('continuidadCalc.labels.v2')}: ${v2 ?? 'N/A'} ${v2Unit ?? ''}\n`
    );
  }
};

const buildCopyText = (item: HistoryItem, parsedInputs: ParsedInputs, formattedResult: string, t: (k: string, vars?: any) => string) => {
  let textToCopy = '';
  if (item.calculation_type === 'Continuidad_caudal') {
    const { sectionType, fillType, ...restInputs } = parsedInputs;
    textToCopy += `${t('continuidadCalc.flow')}: ${formattedResult} m³/s\n`;
    textToCopy += `${t('continuidadCalc.labels.sectionType')}: ${translateSectionValue(sectionType, t)}\n`;
    if (sectionType === 'Circular') {
      textToCopy += `${t('continuidadCalc.labels.diameter')}: ${restInputs.diameter} ${restInputs.diameterUnit}\n`;
    } else if (sectionType === 'Cuadrada') {
      textToCopy += `${t('continuidadCalc.labels.side')}: ${restInputs.side} ${restInputs.sideUnit}\n`;
    } else if (sectionType === 'Rectangular') {
      textToCopy += `${t('continuidadCalc.labels.width')}: ${restInputs.rectWidth} ${restInputs.rectWidthUnit}\n`;
      textToCopy += `${t('continuidadCalc.labels.height')}: ${restInputs.rectHeight} ${restInputs.rectHeightUnit}\n`;
    }
    textToCopy += `${t('continuidadCalc.labels.velocity')}: ${restInputs.velocityCaudal} ${restInputs.velocityCaudalUnit}\n`;
    textToCopy += `${t('continuidadCalc.labels.fillType')}: ${translateFillValue(fillType, t)}\n`;
    if (fillType === 'Parcial') {
      textToCopy += `${t('continuidadCalc.labels.fillHeight')}: ${restInputs.fillHeight} ${restInputs.fillHeightUnit}\n`;
    }
  } else {
    const { A1, A1Unit, v1, v1Unit, A2, A2Unit, v2, v2Unit } = parsedInputs;
    textToCopy += `${t('continuidadCalc.flow')}: ${formattedResult} m³/s\n`;
    textToCopy += `${t('continuidadCalc.section1')}:\n`;
    textToCopy += `  ${t('continuidadCalc.labels.A1')}: ${A1 ?? 'N/A'} ${A1Unit ?? ''}\n`;
    textToCopy += `  ${t('continuidadCalc.labels.v1')}: ${v1 ?? 'N/A'} ${v1Unit ?? ''}\n`;
    textToCopy += `${t('continuidadCalc.section2')}:\n`;
    textToCopy += `  ${t('continuidadCalc.labels.A2')}: ${A2 ?? 'N/A'} ${A2Unit ?? ''}\n`;
    textToCopy += `  ${t('continuidadCalc.labels.v2')}: ${v2 ?? 'N/A'} ${v2Unit ?? ''}\n`;
  }
  return textToCopy;
};

type HistoryCardProps = {
  item: HistoryItem;
  isFirst: boolean;
  onDelete: (id: number) => void;
};

const HistoryCard = React.memo(({ item, isFirst, onDelete }: HistoryCardProps) => {
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { t } = useContext(LanguageContext);

  const { fontSizeFactor } = useContext(FontSizeContext);

  const { currentTheme } = useTheme();
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
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
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const adjustDecimalSeparator = useCallback(
    (s: string) => (selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s),
    [selectedDecimalSeparator]
  );

  const formatCaudal = useCallback(
    (raw: string): string => {
      if (raw == null) return '';
      const n = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(n)) return String(raw);
      return adjustDecimalSeparator(formatNumber(n));
    },
    [formatNumber, adjustDecimalSeparator]
  );

  const formattedResult = useMemo(() => formatCaudal(item.result), [item.result, formatCaudal]);

  const translateX = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(
    translateX.interpolate({
      inputRange: [REVEAL_OFFSET, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })
  ).current;
  const buttonsTranslateY = useRef(
    translateX.interpolate({
      inputRange: [REVEAL_OFFSET, 0],
      outputRange: [0, 20],
      extrapolate: 'clamp',
    })
  ).current;

  const isRevealed = useRef(false);

  useEffect(() => {
    if (!isFirst) return;
    const timeoutId = setTimeout(() => {
      isRevealed.current = true;
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: REVEAL_OFFSET,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [isFirst, translateX]);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, g) => {
        const base = isRevealed.current ? REVEAL_OFFSET : 0;
        const next = clamp(base + g.dx, REVEAL_OFFSET, 0);
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const shouldReveal = isRevealed.current ? g.dx < 30 : g.dx < -50;

        const target = shouldReveal ? REVEAL_OFFSET : 0;
        isRevealed.current = shouldReveal;

        Animated.timing(translateX, {
          toValue: target,
          duration: 250,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const parsedInputs = useMemo<ParsedInputs>(() => {
    try {
      return JSON.parse(item.inputs) || {};
    } catch {
      return {};
    }
  }, [item.inputs]);

  const inputsString = useMemo(() => buildInputsString(item, parsedInputs, t), [item, parsedInputs, t]);
  const dateStr = useMemo(() => formatDate(item.timestamp), [item.timestamp]);

  const handleCopy = useCallback(() => {
    if (item.calculation_type === 'Continuidad_caudal') {
      const q = parseFloat(String(item.result ?? '').replace(',', '.'));
      if (!isFinite(q) || q === 0) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('continuidadCalc.toasts.noFlowToCopy'),
        });
        return;
      }
    } else {
      const { A1, v1, A2, v2 } = parsedInputs;
      const hasValidInput = A1 || v1 || A2 || v2;
      if (!hasValidInput && !item.result) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: t('continuidadCalc.toasts.noContinuityToCopy'),
        });
        return;
      }
    }
    Clipboard.setString(buildCopyText(item, parsedInputs, formattedResult, t));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('continuidadCalc.toasts.copied'),
    });
  }, [item, parsedInputs, formattedResult, t]);

  return (
    <View style={styles.THISCONTAINER}>
      <Animated.View
        style={[
          styles.optionsContainerMain,
          { width: ORIGINAL_WIDTH, transform: [{ translateX }], experimental_backgroundImage: themeColors.gradient },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.optionsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}>
          <View style={styles.itemContent}>
            <Text style={[styles.resultLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('continuidadCalc.flow')}:</Text>
            <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 24 * fontSizeFactor }]}>{formattedResult} m³/s</Text>
            <Text style={[styles.inputsText, { color: currentTheme === 'dark' ? 'rgb(210, 210, 210)' : 'rgb(50, 50, 50)', fontSize: 14 * fontSizeFactor }]}>{inputsString}</Text>
            <Text style={[styles.timestampText, { color: currentTheme === 'dark' ? 'rgb(170, 170, 170)' : 'rgb(150, 150, 150)', fontSize: 12 * fontSizeFactor }]}>
              {t('history.savedOn') + ' ' + dateStr}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.buttonsContainer,
          { opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }] },
        ]}
        pointerEvents="box-none"
      >
        <Pressable style={styles.button} onPress={handleCopy}>
          <Icon2 name="copy" size={20} color="black" />
        </Pressable>
        <Pressable style={styles.button} onPress={() => onDelete(item.id)}>
          <Icon2 name="trash" size={20} color="black" />
        </Pressable>
      </Animated.View>
    </View>
  );
}, areEqualHistoryCard);

function areEqualHistoryCard(prev: HistoryCardProps, next: HistoryCardProps) {
  return (
    prev.isFirst === next.isFirst &&
    prev.item.id === next.item.id &&
    prev.item.result === next.item.result &&
    prev.item.inputs === next.item.inputs &&
    prev.item.timestamp === next.item.timestamp &&
    prev.item.calculation_type === next.item.calculation_type
  );
}

const HistoryScreenContinuidad = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const dbRef = useRef<any>(null);
  const navigation = useNavigation();

  const { t } = useContext(LanguageContext);

  const { fontSizeFactor } = useContext(FontSizeContext);

  const { currentTheme } = useTheme();
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  // En HistoryScreenContinuidad.tsx
  const loadHistory = useCallback(async () => {
    try {
      if (!dbRef.current) {
        dbRef.current = await getDBConnection();
      }
      const fetched = await getHistory(dbRef.current);
      // Filtrar solo los items de Continuidad
      const filtered = fetched.filter((item: HistoryItem) => 
        item.calculation_type.startsWith('Continuidad_')
      );
      setHistory(filtered);
    } catch (error) {
      console.error('Error al cargar el historial:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleDeleteItem = useCallback(
    async (id: number) => {
      const db = dbRef.current;
      if (db) {
        await deleteHistory(db, id);
        setHistory((current) => current.filter((it) => it.id !== id));
        Toast.show({
          type: 'success',
          text1: t('history.delete.successTitle'),
          text2: t('history.delete.successMsg'),
        });
      }
    },
    [t]
  );

  const handleResetPress = useCallback(() => {
    if (history.length === 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('history.deleteAll.noHistory'),
      });
      return;
    }
    Alert.alert(
      t('history.deleteAll.title'),
      t('history.deleteAll.message'),
      [
        { text: t('history.deleteAll.cancel'), style: 'cancel' },
        {
          text: t('history.deleteAll.confirm'),
          onPress: async () => {
            const db = dbRef.current;
            if (db) {
              // Cambio importante: pasar el tipo de cálculo
              await deleteHistory(db, -1, 'Continuidad_');
              setHistory([]);
              Toast.show({
                type: 'success',
                text1: t('history.deleteAll.successTitle'),
                text2: t('history.deleteAll.successMsg'),
              });
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [history.length, t]);

  const handleExportExcel = useCallback(async () => {
    try {
      if (history.length === 0) {
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: 'No hay historial para exportar',
        });
        return;
      }

      const caudalItems = history.filter(h => h.calculation_type === 'Continuidad_caudal');
      const contItems = history.filter(h => h.calculation_type === 'Continuidad_continuidad');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      // ============================================
      // HOJA DE CAUDAL
      // ============================================
      if (caudalItems.length > 0) {
        const wsCaudal = wb.addWorksheet('Caudal');

        const caudalHeaders = [
          'Fecha/Hora',
          'Caudal (m³/s)',
          'Tipo de sección',
          'Diámetro (m)',
          'Lado (m)',
          'Ancho (m)',
          'Alto (m)',
          'Velocidad (m/s)',
          'Tipo de llenado',
          'Altura de lámina (m)',
        ];

        wsCaudal.addRow(caudalHeaders);
        applyHeaderStyle(wsCaudal);

        caudalItems.forEach(it => {
          let inputs: any = {};
          try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

          const q = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;
          const dia = inputs.diameter != null ? parseFloat(String(inputs.diameter).replace(',', '.')) : null;
          const lad = inputs.side != null ? parseFloat(String(inputs.side).replace(',', '.')) : null;
          const rw = inputs.rectWidth != null ? parseFloat(String(inputs.rectWidth).replace(',', '.')) : null;
          const rh = inputs.rectHeight != null ? parseFloat(String(inputs.rectHeight).replace(',', '.')) : null;
          const vel = inputs.velocityCaudal != null ? parseFloat(String(inputs.velocityCaudal).replace(',', '.')) : null;
          const fh = inputs.fillHeight != null ? parseFloat(String(inputs.fillHeight).replace(',', '.')) : null;

          const row = wsCaudal.addRow([
            formatDate(it.timestamp),
            isFinite(q as number) ? q : null,
            translateSectionValue(inputs.sectionType || '', t),
            isFinite(dia as number) ? dia : null,
            isFinite(lad as number) ? lad : null,
            isFinite(rw as number) ? rw : null,
            isFinite(rh as number) ? rh : null,
            isFinite(vel as number) ? vel : null,
            translateFillValue(inputs.fillType || '', t),
            isFinite(fh as number) ? fh : null,
          ]);

          // Aplicar formatos específicos según la unidad
          applyExcelCell(row, 1); // Fecha
          applyExcelCell(row, 2, '#,##0.0000 "m³/s"'); // Caudal

          if (inputs.sectionType === 'Circular') {
            applyExcelCell(row, 4, `#,##0.000 "${inputs.diameterUnit || 'm'}"`); // Diámetro
          } else if (inputs.sectionType === 'Cuadrada') {
            applyExcelCell(row, 5, `#,##0.000 "${inputs.sideUnit || 'm'}"`); // Lado
          } else if (inputs.sectionType === 'Rectangular') {
            applyExcelCell(row, 6, `#,##0.000 "${inputs.rectWidthUnit || 'm'}"`); // Ancho
            applyExcelCell(row, 7, `#,##0.000 "${inputs.rectHeightUnit || 'm'}"`); // Alto
          }

          applyExcelCell(row, 8, `#,##0.00 "${inputs.velocityCaudalUnit || 'm/s'}"`); // Velocidad

          if (inputs.fillType === 'Parcial') {
            applyExcelCell(row, 10, `#,##0.000 "${inputs.fillHeightUnit || 'm'}"`); // Altura de lámina
          }

          applyExcelCells(row, [3, 9]); // Tipo de sección y tipo de llenado (texto)
        });

        setColumnWidths(wsCaudal, caudalHeaders.length, 16);
      }

      // ============================================
      // HOJA DE CONTINUIDAD
      // ============================================
      if (contItems.length > 0) {
        const wsCont = wb.addWorksheet('Continuidad');

        const contHeaders = [
          'Fecha/Hora',
          'Caudal (m³/s)',
          'A₁ (m²)',
          'v₁ (m/s)',
          'A₂ (m²)',
          'v₂ (m/s)',
        ];

        wsCont.addRow(contHeaders);
        applyHeaderStyle(wsCont);

        contItems.forEach(it => {
          let inputs: any = {};
          try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

          const q = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;
          const A1 = inputs.A1 != null ? parseFloat(String(inputs.A1).replace(',', '.')) : null;
          const v1 = inputs.v1 != null ? parseFloat(String(inputs.v1).replace(',', '.')) : null;
          const A2 = inputs.A2 != null ? parseFloat(String(inputs.A2).replace(',', '.')) : null;
          const v2 = inputs.v2 != null ? parseFloat(String(inputs.v2).replace(',', '.')) : null;

          const row = wsCont.addRow([
            formatDate(it.timestamp),
            isFinite(q as number) ? q : null,
            isFinite(A1 as number) ? A1 : null,
            isFinite(v1 as number) ? v1 : null,
            isFinite(A2 as number) ? A2 : null,
            isFinite(v2 as number) ? v2 : null,
          ]);

          applyExcelCell(row, 1); // Fecha
          applyExcelCell(row, 2, '#,##0.0000 "m³/s"'); // Caudal
          applyExcelCell(row, 3, `#,##0.000 "${inputs.A1Unit || 'm²'}"`); // A₁
          applyExcelCell(row, 4, `#,##0.00 "${inputs.v1Unit || 'm/s'}"`); // v₁
          applyExcelCell(row, 5, `#,##0.000 "${inputs.A2Unit || 'm²'}"`); // A₂
          applyExcelCell(row, 6, `#,##0.00 "${inputs.v2Unit || 'm/s'}"`); // v₂
        });

        setColumnWidths(wsCont, contHeaders.length, 18);
      }

      if (history.length > 0) {
        const wsResumen = wb.addWorksheet('Resumen');

        const resumenHeaders = ['Métrica', 'Valor'];
        wsResumen.addRow(resumenHeaders);
        applyHeaderStyle(wsResumen);

        // Calcular estadísticas
        const totalCalculos = history.length;
        const totalCaudal = history.filter(h => h.calculation_type === 'Continuidad_caudal').length;
        const totalContinuidad = history.filter(h => h.calculation_type === 'Continuidad_continuidad').length;

        // Obtener fechas
        const fechas = history.map(h => h.timestamp);
        const fechaMasAntigua = fechas.length > 0 ? Math.min(...fechas) : null;
        const fechaMasReciente = fechas.length > 0 ? Math.max(...fechas) : null;

        // Calcular promedio de caudal (solo para items con resultado válido)
        const caudalesValidos = history
          .map(h => parseFloat(String(h.result).replace(',', '.')))
          .filter(q => isFinite(q) && q > 0);
        const promedioCaudal = caudalesValidos.length > 0 
          ? caudalesValidos.reduce((a, b) => a + b, 0) / caudalesValidos.length 
          : 0;

        const row1 = wsResumen.addRow(['Total de cálculos', totalCalculos]);
        const row2 = wsResumen.addRow(['Cálculos de caudal', totalCaudal]);
        const row3 = wsResumen.addRow(['Cálculos de continuidad', totalContinuidad]);
        const row4 = wsResumen.addRow(['Primer cálculo', fechaMasAntigua ? formatDate(fechaMasAntigua) : 'N/A']);
        const row5 = wsResumen.addRow(['Último cálculo', fechaMasReciente ? formatDate(fechaMasReciente) : 'N/A']);
        const row6 = wsResumen.addRow(['Promedio de caudal (m³/s)', promedioCaudal]);

        // Aplicar formato de texto a la primera columna de cada fila
        [row1, row2, row3, row4, row5, row6].filter(Boolean).forEach(row => {
          applyExcelCells(row, [1]); // Formato de texto para la columna 1
        });
        
        // Luego aplicar formatos específicos a los valores numéricos
        applyExcelCell(row1, 2, '#,##0');
        applyExcelCell(row2, 2, '#,##0');
        applyExcelCell(row3, 2, '#,##0');
        applyExcelCell(row6, 2, '#,##0.0000 "m³/s"');

        setColumnWidths(wsResumen, 2, 25);
      }

      // Exportar el archivo
      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `Continuidad_Historial_${new Date().toISOString().split('T')[0]}.xlsx`;
      const path = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.writeFile(path, base64, 'base64');

      await Share.open({
        title: 'Exportar historial de Continuidad',
        url: 'file://' + path,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        failOnCancel: false,
        showAppsToView: true,
      });

      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: 'Historial exportado correctamente',
      });

    } catch (e) {
      console.error('Export error:', e);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: 'Ocurrió un error al exportar',
      });
    }
  }, [history, t]);

  const renderHistoryItem = useCallback(
    ({ item, index }: { item: HistoryItem; index: number }) => (
      <HistoryCard item={item} isFirst={index === 0} onDelete={handleDeleteItem} />
    ),
    [handleDeleteItem]
  );

  const keyExtractor = useCallback((it: HistoryItem) => it.id.toString(), []);

  const ListEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Icon2 name="hard-drive" size={50} color={currentTheme === 'dark' ? 'rgb(120, 120, 120)' : 'rgb(180, 180, 180)'} />
        <Text style={[styles.emptyText, { color: currentTheme === 'dark' ? 'rgb(170, 170, 170)' : 'rgb(180, 180, 180)', fontSize: 16 * fontSizeFactor }]}>
          {t('history.empty')}
        </Text>
      </View>
    ),
    [currentTheme, t, fontSizeFactor]
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={ListEmpty}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            <View style={styles.headerContainer}>
              <View style={styles.leftIconsContainer}>
                <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
                  <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={() => navigation.goBack()}>
                    <Icon2 name="chevron-left" size={22} color={themeColors.icon} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.rightIconsContainer}>
                <View style={styles.rightIconsContainer}>
                  <View style={[styles.iconWrapper2, { experimental_backgroundImage: themeColors.gradient }]}>
                    <Pressable
                      style={[
                        styles.iconContainer,
                        { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }
                      ]}
                      onPress={handleExportExcel}
                    >
                      <MCIcon name="export-variant" size={20} color={themeColors.icon} />
                    </Pressable>
                  </View>
                  <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
                    <Pressable
                      style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                      onPress={handleResetPress}
                    >
                      <Icon2 name="trash" size={20} color={themeColors.icon} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.titlesContainer}>
              <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>{t('continuidadCalc.title')}</Text>
              <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('history.title')}</Text>
            </View>
          </>
        }
      />

      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgb(255, 255, 255)',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    minHeight: 45,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  leftIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 0,
    gap: 8,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 0,
    gap: 5,
  },
  iconWrapper: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 60,
    height: 40,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 40,
    height: 40,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  titlesContainer: {
    backgroundColor: 'transparent',
    marginVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 0,
    marginTop: 10,
  },
  subtitle: {
    color: 'rgb(0, 0, 0)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  title: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: -10,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  optionsContainerMain: {
    padding: 1,
    marginVertical: 10,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  optionTextHeader: {
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(0, 0, 0)',
    marginBottom: 5,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 5,
  },
  itemContent: {
    marginTop: 5,
  },
  resultLabel: {
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    color: 'rgb(0, 0, 0)',
  },
  resultValue: {
    fontSize: 24,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(0, 0, 0)',
    marginBottom: 10,
    marginTop: -5,
  },
  inputsLabel: {
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    color: 'rgb(0, 0, 0)',
    marginBottom: 5,
  },
  inputsText: {
    fontSize: 14,
    fontFamily: 'SFUIDisplay-Regular',
    color: 'rgb(50, 50, 50)',
    lineHeight: 20,
  },
  timestampText: {
    fontSize: 12,
    fontFamily: 'SFUIDisplay-Regular',
    color: 'rgb(150, 150, 150)',
    marginTop: 10,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: 'rgb(180, 180, 180)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  THISCONTAINER: {
    position: 'relative',
  },
  buttonsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    backgroundColor: 'rgb(194, 254, 12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HistoryScreenContinuidad;