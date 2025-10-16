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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import { getDBConnection, getHistory, deleteHistory } from '../../../src/services/database';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ExcelJS from 'exceljs';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { encode as base64FromArrayBuffer } from 'base64-arraybuffer';

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
  calculation_type: 'reynolds';
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

const buildInputsString = (item: HistoryItem, parsedInputs: ParsedInputs, t: (k: string, vars?: any) => string) => {
  const {
    velocity,
    velocityUnit,
    dimension,
    dimensionUnit,
    density,
    densityUnit,
    dynamicViscosity,
    dynamicViscosityUnit,
    kinematicViscosity,
    kinematicViscosityUnit,
  } = parsedInputs;

  let inputString = '';
  inputString += `${t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
  if (velocity && velocity !== 'N/A') {
    inputString += `  ${t('reynoldsCalc.labels.velocity') || 'Velocidad'}: ${velocity} ${velocityUnit || ''}\n`;
  }
  if (dimension && dimension !== 'N/A') {
    inputString += `  ${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'}: ${dimension} ${dimensionUnit || ''}\n`;
  }
  inputString += `${t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}:\n`;
  if (density && density !== 'N/A') {
    inputString += `  ${t('reynoldsCalc.labels.density') || 'Densidad'}: ${density} ${densityUnit || ''}\n`;
  }
  if (dynamicViscosity && dynamicViscosity !== 'N/A') {
    inputString += `  ${t('reynoldsCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'}: ${dynamicViscosity} ${dynamicViscosityUnit || ''}\n`;
  }
  if (kinematicViscosity && kinematicViscosity !== 'N/A') {
    inputString += `  ${t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'}: ${kinematicViscosity} ${kinematicViscosityUnit || ''}`;
  }

  return inputString;
};

const buildCopyText = (item: HistoryItem, parsedInputs: ParsedInputs, formattedResult: string, t: (k: string, vars?: any) => string) => {
  const {
    velocity,
    velocityUnit,
    dimension,
    dimensionUnit,
    density,
    densityUnit,
    dynamicViscosity,
    dynamicViscosityUnit,
    kinematicViscosity,
    kinematicViscosityUnit,
  } = parsedInputs;

  let textToCopy = `${t('reynoldsCalc.reynolds') || 'Reynolds'}: ${formattedResult}\n`;
  if ((velocity && velocity !== 'N/A') || (dimension && dimension !== 'N/A')) {
    textToCopy += `${t('reynoldsCalc.flowParameters') || 'Parámetros de Flujo'}:\n`;
    if (velocity && velocity !== 'N/A') {
      textToCopy += `  ${t('reynoldsCalc.labels.velocity') || 'Velocidad'}: ${velocity} ${velocityUnit || ''}\n`;
    }
    if (dimension && dimension !== 'N/A') {
      textToCopy += `  ${t('reynoldsCalc.labels.dimension') || 'Dimensión Característica'}: ${dimension} ${dimensionUnit || ''}\n`;
    }
  }
  textToCopy += `${t('reynoldsCalc.fluidProperties') || 'Propiedades del Fluido'}:\n`;
  if (density && density !== 'N/A') {
    textToCopy += `  ${t('reynoldsCalc.labels.density') || 'Densidad'}: ${density} ${densityUnit || ''}\n`;
  }
  if (dynamicViscosity && dynamicViscosity !== 'N/A') {
    textToCopy += `  ${t('reynoldsCalc.labels.dynamicViscosity') || 'Viscosidad Dinámica'}: ${dynamicViscosity} ${dynamicViscosityUnit || ''}\n`;
  }
  if (kinematicViscosity && kinematicViscosity !== 'N/A') {
    textToCopy += `  ${t('reynoldsCalc.labels.kinematicViscosity') || 'Viscosidad Cinemática'}: ${kinematicViscosity} ${kinematicViscosityUnit || ''}\n`;
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

  const adjustDecimalSeparator = useCallback(
    (s: string) => (selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s),
    [selectedDecimalSeparator]
  );

  const formatReynolds = useCallback(
    (raw: string): string => {
      if (raw == null) return '';
      const n = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(n)) return String(raw);
      return adjustDecimalSeparator(formatNumber(n));
    },
    [formatNumber, adjustDecimalSeparator]
  );

  const formattedResult = useMemo(() => formatReynolds(item.result), [item.result, formatReynolds]);

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
    const reynoldsValue = parseFloat(String(item.result ?? '').replace(',', '.'));
    if (!isFinite(reynoldsValue) || reynoldsValue === 0) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('reynoldsCalc.toasts.noReynoldsToCopy') || 'No hay número de Reynolds para copiar',
      });
      return;
    }
    
    Clipboard.setString(buildCopyText(item, parsedInputs, formattedResult, t));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('reynoldsCalc.toasts.copied') || 'Resultados copiados al portapapeles',
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
            <Text style={[styles.resultLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('reynoldsCalc.reynolds') || 'Reynolds'}:</Text>
            <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 24 * fontSizeFactor }]}>{formattedResult}</Text>
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

const HistoryScreenReynolds = () => {
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
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))', // <-- NUEVO
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
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))', // <-- NUEVO
    };
  }, [currentTheme]);

  const loadHistory = useCallback(async () => {
    try {
      if (!dbRef.current) {
        dbRef.current = await getDBConnection();
      }
      const fetched = await getHistory(dbRef.current);
      // Filtrar solo los cálculos de Reynolds
      const reynoldsHistory = fetched.filter((item: HistoryItem) => item.calculation_type === 'reynolds');
      setHistory((prev) => {
        const sameLength = prev.length === reynoldsHistory.length;
        if (sameLength) {
          const same = prev.every((p, i) => {
            const n = reynoldsHistory[i];
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
        return reynoldsHistory;
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
              for (const item of history) {
                await deleteHistory(db, item.id);
              }
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
  }, [history, t]);

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

      const reynoldsItems = history.filter(h => h.calculation_type === 'reynolds');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      const ws = wb.addWorksheet('Reynolds');

      const headers = [
        'Fecha/Hora',
        'Reynolds',
        'Velocidad',
        'Dimensión característica',
        'Densidad',
        'Viscosidad dinámica',
        'Viscosidad cinemática',
      ];
      ws.addRow(headers);

      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FF000000' } };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const maxLen = headers.map(h => h.length);

      reynoldsItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

        const reynolds = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;

        const velocity = inputs.velocity != null ? parseFloat(String(inputs.velocity).replace(',', '.')) : null;
        const dimension = inputs.dimension != null ? parseFloat(String(inputs.dimension).replace(',', '.')) : null;
        const density = inputs.density != null ? parseFloat(String(inputs.density).replace(',', '.')) : null;
        const mu = inputs.dynamicViscosity != null ? parseFloat(String(inputs.dynamicViscosity).replace(',', '.')) : null;
        const nu = inputs.kinematicViscosity != null ? parseFloat(String(inputs.kinematicViscosity).replace(',', '.')) : null;

        const row = ws.addRow([
          formatDate(it.timestamp),
          isFinite(reynolds as number) ? reynolds : null,
          isFinite(velocity as number) ? velocity : null,
          isFinite(dimension as number) ? dimension : null,
          isFinite(density as number) ? density : null,
          isFinite(mu as number) ? mu : null,
          isFinite(nu as number) ? nu : null,
        ]);

        row.eachCell(cell => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const fmtWithUnit = (unit?: string) =>
          unit && String(unit).trim().length > 0 ? `General "${unit}"` : 'General';

        if (isFinite(velocity as number))  row.getCell(3).numFmt = fmtWithUnit(inputs.velocityUnit);
        if (isFinite(dimension as number)) row.getCell(4).numFmt = fmtWithUnit(inputs.dimensionUnit);
        if (isFinite(density as number))   row.getCell(5).numFmt = fmtWithUnit(inputs.densityUnit);
        if (isFinite(mu as number))        row.getCell(6).numFmt = fmtWithUnit(inputs.dynamicViscosityUnit);
        if (isFinite(nu as number))        row.getCell(7).numFmt = fmtWithUnit(inputs.kinematicViscosityUnit);

        const withUnit = (val: any, u?: string) => (isFinite(val) ? `${val}${u ? ` ${u}` : ''}` : '');
        maxLen[0] = Math.max(maxLen[0], String(row.getCell(1).value ?? '').length);
        maxLen[1] = Math.max(maxLen[1], isFinite(reynolds as number) ? String(reynolds).length : 0);
        maxLen[2] = Math.max(maxLen[2], withUnit(velocity, inputs.velocityUnit).length);
        maxLen[3] = Math.max(maxLen[3], withUnit(dimension, inputs.dimensionUnit).length);
        maxLen[4] = Math.max(maxLen[4], withUnit(density, inputs.densityUnit).length);
        maxLen[5] = Math.max(maxLen[5], withUnit(mu, inputs.dynamicViscosityUnit).length);
        maxLen[6] = Math.max(maxLen[6], withUnit(nu, inputs.kinematicViscosityUnit).length);
      });

      maxLen.forEach((len, i) => {
        ws.getColumn(i + 1).width = Math.min(Math.max(len + 2, 10), 60);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `Valve_Historial_Reynolds.xlsx`;
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
                    <Icon2 name="chevron-left" size={20} color={themeColors.icon} />
                  </Pressable>
                </View>
              </View>

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

            <View style={styles.titlesContainer}>
              <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>{t('reynoldsCalc.title') || 'Número de Reynolds'}</Text>
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
  iconWrapper2: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 40,
    height: 40,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
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

export default HistoryScreenReynolds;