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
  calculation_type: 'caudal' | 'continuidad';
  inputs: string;
  result: string;
  timestamp: number;
}

const { width } = Dimensions.get('window');
const ORIGINAL_WIDTH = width - 40;
const BUTTON_SIZE = 45;

const REVEAL_OFFSET = -(BUTTON_SIZE + 20);

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
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
  if (item.calculation_type === 'caudal') {
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
  if (item.calculation_type === 'caudal') {
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
    if (item.calculation_type === 'caudal') {
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

  const loadHistory = useCallback(async () => {
    try {
      if (!dbRef.current) {
        dbRef.current = await getDBConnection();
      }
      const fetched = await getHistory(dbRef.current);
      setHistory((prev) => {
        const sameLength = prev.length === fetched.length;
        if (sameLength) {
          const same = prev.every((p, i) => {
            const n = fetched[i];
            return (
              p.id === n.id &&
              p.result === n.result &&
              p.inputs === n.inputs &&
              p.timestamp === n.timestamp &&
              p.calculation_type === n.calculation_type
            );
          });
          if (same) return prev;
        }
        return fetched;
      });
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
              await deleteHistory(db, -1);
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

      const caudalItems = history.filter(h => h.calculation_type === 'caudal');
      const contItems   = history.filter(h => h.calculation_type === 'continuidad');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      const wsCaudal = wb.addWorksheet('Caudal');

      const caudalHeaders = [
        'Fecha/Hora',
        'Caudal (m³/s)',
        'Tipo de sección',
        'Diámetro',
        'Lado',
        'Ancho (rect)',
        'Alto (rect)',
        'Velocidad',
        'Tipo de llenado',
        'Altura de llenado',
      ];
      wsCaudal.addRow(caudalHeaders);

      const caudalHeaderRow = wsCaudal.getRow(1);
      caudalHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
      caudalHeaderRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC2FE0C' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const caudalMaxLen = caudalHeaders.map(h => h.length);

      caudalItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

        const q   = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;
        const dia = inputs.diameter != null ? parseFloat(String(inputs.diameter).replace(',', '.')) : null;
        const lad = inputs.side != null ? parseFloat(String(inputs.side).replace(',', '.')) : null;
        const rw  = inputs.rectWidth != null ? parseFloat(String(inputs.rectWidth).replace(',', '.')) : null;
        const rh  = inputs.rectHeight != null ? parseFloat(String(inputs.rectHeight).replace(',', '.')) : null;
        const vel = inputs.velocityCaudal != null ? parseFloat(String(inputs.velocityCaudal).replace(',', '.')) : null;
        const fh  = inputs.fillHeight != null ? parseFloat(String(inputs.fillHeight).replace(',', '.')) : null;

        const row = wsCaudal.addRow([
          formatDate(it.timestamp),
          isFinite(q as number) ? q : null,
          inputs.sectionType ?? '',
          isFinite(dia as number) ? dia : null,
          isFinite(lad as number) ? lad : null,
          isFinite(rw  as number) ? rw  : null,
          isFinite(rh  as number) ? rh  : null,
          isFinite(vel as number) ? vel : null,
          inputs.fillType ?? '',
          isFinite(fh  as number) ? fh  : null,
        ]);

        const fmtWithUnit = (unit?: string) =>
          unit && String(unit).trim().length > 0 ? `General "${unit}"` : 'General';

        if (isFinite(q as number)) {
          row.getCell(2).numFmt = `General "m³/s"`;
        }
        if (isFinite(dia as number)) {
          row.getCell(4).numFmt = fmtWithUnit(inputs.diameterUnit);
        }
        if (isFinite(lad as number)) {
          row.getCell(5).numFmt = fmtWithUnit(inputs.sideUnit);
        }
        if (isFinite(rw as number)) {
          row.getCell(6).numFmt = fmtWithUnit(inputs.rectWidthUnit);
        }
        if (isFinite(rh as number)) {
          row.getCell(7).numFmt = fmtWithUnit(inputs.rectHeightUnit);
        }
        if (isFinite(vel as number)) {
          row.getCell(8).numFmt = fmtWithUnit(inputs.velocityCaudalUnit);
        }
        if (isFinite(fh as number)) {
          row.getCell(10).numFmt = fmtWithUnit(inputs.fillHeightUnit);
        }
        caudalMaxLen[0] = Math.max(caudalMaxLen[0], String(row.getCell(1).value ?? '').length);
        if (isFinite(q as number)) {
          const s = `${q} m³/s`;
          caudalMaxLen[1] = Math.max(caudalMaxLen[1], s.length);
        }
        caudalMaxLen[2] = Math.max(caudalMaxLen[2], String(inputs.sectionType ?? '').length);
        const lensWithUnits: Array<[number, any, string | undefined]> = [
          [3, dia, inputs.diameterUnit],
          [4, lad, inputs.sideUnit],
          [5, rw, inputs.rectWidthUnit],
          [6, rh, inputs.rectHeightUnit],
        ];
        lensWithUnits.forEach(([idx, val, unit]) => {
          const s = isFinite(val as number) ? `${val}${unit ? ` ${unit}` : ''}` : '';
          caudalMaxLen[idx] = Math.max(caudalMaxLen[idx], s.length);
        });
        {
          const s = isFinite(vel as number) ? `${vel}${inputs.velocityCaudalUnit ? ` ${inputs.velocityCaudalUnit}` : ''}` : '';
          caudalMaxLen[7] = Math.max(caudalMaxLen[7], s.length);
        }
        caudalMaxLen[8] = Math.max(caudalMaxLen[8], String(inputs.fillType ?? '').length);
        {
          const s = isFinite(fh as number) ? `${fh}${inputs.fillHeightUnit ? ` ${inputs.fillHeightUnit}` : ''}` : '';
          caudalMaxLen[9] = Math.max(caudalMaxLen[9], s.length);
        }
      });

      caudalMaxLen.forEach((len, i) => {
        wsCaudal.getColumn(i + 1).width = Math.min(Math.max(len + 2, 10), 60);
      });
      const wsCont = wb.addWorksheet('Continuidad');

      const contHeaders = [
        'Fecha/Hora',
        'Caudal (m³/s)',
        'A1',
        'v1',
        'A2',
        'v2',
      ];
      wsCont.addRow(contHeaders);

      const contHeaderRow = wsCont.getRow(1);
      contHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
      contHeaderRow.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC2FE0C' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const contMaxLen = contHeaders.map(h => h.length);

      contItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

        const q  = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;
        const A1 = inputs.A1 != null ? parseFloat(String(inputs.A1).replace(',', '.')) : null;
        const v1 = inputs.v1 != null ? parseFloat(String(inputs.v1).replace(',', '.')) : null;
        const A2 = inputs.A2 != null ? parseFloat(String(inputs.A2).replace(',', '.')) : null;
        const v2 = inputs.v2 != null ? parseFloat(String(inputs.v2).replace(',', '.')) : null;

        const row = wsCont.addRow([
          formatDate(it.timestamp),
          isFinite(q  as number) ? q  : null,
          isFinite(A1 as number) ? A1 : null,
          isFinite(v1 as number) ? v1 : null,
          isFinite(A2 as number) ? A2 : null,
          isFinite(v2 as number) ? v2 : null,
        ]);

        row.getCell(2).numFmt = `General "m³/s"`;
        if (isFinite(A1 as number)) row.getCell(3).numFmt = (inputs.A1Unit && inputs.A1Unit.trim()) ? `General "${inputs.A1Unit}"` : 'General';
        if (isFinite(v1 as number)) row.getCell(4).numFmt = (inputs.v1Unit && inputs.v1Unit.trim()) ? `General "${inputs.v1Unit}"` : 'General';
        if (isFinite(A2 as number)) row.getCell(5).numFmt = (inputs.A2Unit && inputs.A2Unit.trim()) ? `General "${inputs.A2Unit}"` : 'General';
        if (isFinite(v2 as number)) row.getCell(6).numFmt = (inputs.v2Unit && inputs.v2Unit.trim()) ? `General "${inputs.v2Unit}"` : 'General';

        // Longitudes visibles para auto ancho
        contMaxLen[0] = Math.max(contMaxLen[0], String(row.getCell(1).value ?? '').length);
        contMaxLen[1] = Math.max(contMaxLen[1], isFinite(q as number) ? String(`${q} m³/s`).length : 0);
        contMaxLen[2] = Math.max(contMaxLen[2], isFinite(A1 as number) ? String(`${A1}${inputs.A1Unit ? `${inputs.A1Unit}` : ''}`).length : 0);
        contMaxLen[3] = Math.max(contMaxLen[3], isFinite(v1 as number) ? String(`${v1}${inputs.v1Unit ? `${inputs.v1Unit}` : ''}`).length : 0);
        contMaxLen[4] = Math.max(contMaxLen[4], isFinite(A2 as number) ? String(`${A2}${inputs.A2Unit ? `${inputs.A2Unit}` : ''}`).length : 0);
        contMaxLen[5] = Math.max(contMaxLen[5], isFinite(v2 as number) ? String(`${v2}${inputs.v2Unit ? `${inputs.v2Unit}` : ''}`).length : 0);
      });

      contMaxLen.forEach((len, i) => {
        wsCont.getColumn(i + 1).width = Math.min(Math.max(len + 2, 10), 60);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `Valve_Historial_Continuidad.xlsx`;
      const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, base64, 'base64');

      await Share.open({
        title: 'Exportar historial',
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