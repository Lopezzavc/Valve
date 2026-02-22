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

// Configuración visual de los mensajes Toast (idéntica)
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

// Tipos de datos del historial para Geometría de Secciones
interface HistoryItem {
  id: number;
  calculation_type: string; // Será 'GeometriaSecciones_dimensions'
  inputs: string;
  result: string;
  timestamp: number;
}

type ParsedInputs = Record<string, any>;

// Constantes de layout para el gesto de deslizamiento (idénticas)
const { width } = Dimensions.get('window');
const ORIGINAL_WIDTH = width - 40;
const BUTTON_SIZE = 45;
const REVEAL_OFFSET = -(BUTTON_SIZE + 20);

// Utilidad para restringir un valor dentro de un rango (idéntica)
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// Formatea un timestamp a cadena legible con fecha y hora (idéntica)
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

// Construye el texto de entradas para mostrar en la tarjeta del historial
const buildInputsString = (item: HistoryItem, parsedInputs: ParsedInputs, t: (k: string, vars?: any) => string) => {
  let inputString = '';

  // --- Parámetros Geométricos ---
  inputString += `${t('geometriaSeccionesCalc.paramsSection') || 'Parámetros Geométricos'}:\n`;

  // Dependiendo del tipo de sección, mostramos los parámetros relevantes
  const sectionType = parsedInputs.sectionType;
  if (sectionType) {
      inputString += `  ${t('geometriaSeccionesCalc.labels.sectionType') || 'Tipo'}: ${t(`geometriaSeccionesCalc.options.sectionType.${sectionType}`) || sectionType}\n`;
  }

  // Parámetros comunes/variables
  if (parsedInputs.diametro) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.diametro') || 'Diámetro'}: ${parsedInputs.diametro} ${parsedInputs.diametroUnit ?? ''}\n`;
  }
  if (parsedInputs.tirante) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.tirante') || 'Tirante'}: ${parsedInputs.tirante} ${parsedInputs.tiranteUnit ?? ''}\n`;
  }
  if (parsedInputs.base) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.base') || 'Base'}: ${parsedInputs.base} ${parsedInputs.baseUnit ?? ''}\n`;
  }
  if (parsedInputs.talud) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.talud') || 'Talud (z)'}: ${parsedInputs.talud}\n`;
  }
  if (parsedInputs.K) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.K') || 'K'}: ${parsedInputs.K} ${parsedInputs.KUnit ?? ''}\n`;
  }

  inputString += `\n`;

  // --- Resultados Geométricos (excluyendo R, que es el principal) ---
  inputString += `${t('geometriaSeccionesCalc.resultsSection') || 'Resultados Geométricos'}:\n`;
  if (parsedInputs.A) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.A') || 'Área (A)'}: ${parsedInputs.A} ${parsedInputs.AUnit ?? ''}\n`;
  }
  if (parsedInputs.P) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.P') || 'Perímetro (P)'}: ${parsedInputs.P} ${parsedInputs.PUnit ?? ''}\n`;
  }
  if (parsedInputs.T) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.T') || 'Ancho (T)'}: ${parsedInputs.T} ${parsedInputs.TUnit ?? ''}\n`;
  }
  if (parsedInputs.Dh) {
    inputString += `  ${t('geometriaSeccionesCalc.labels.Dh') || 'Dh'}: ${parsedInputs.Dh} ${parsedInputs.DhUnit ?? ''}\n`;
  }

  return inputString;
};

// Construye el texto para copiar al portapapeles
const buildCopyText = (item: HistoryItem, parsedInputs: ParsedInputs, formattedResult: string, t: (k: string, vars?: any) => string) => {
  let textToCopy = '';

  // Resultado principal (Radio Hidráulico)
  textToCopy += `${t('geometriaSeccionesCalc.result') || 'Radio Hidráulico'}: ${formattedResult} ${parsedInputs.RUnit ?? 'm'}\n\n`;

  // --- Parámetros Geométricos ---
  textToCopy += `${t('geometriaSeccionesCalc.paramsSection') || 'Parámetros Geométricos'}:\n`;
  const sectionType = parsedInputs.sectionType;
  if (sectionType) {
      textToCopy += `  ${t('geometriaSeccionesCalc.labels.sectionType') || 'Tipo'}: ${t(`geometriaSeccionesCalc.options.sectionType.${sectionType}`) || sectionType}\n`;
  }
  if (parsedInputs.diametro) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.diametro') || 'Diámetro'}: ${parsedInputs.diametro} ${parsedInputs.diametroUnit ?? ''}\n`;
  }
  if (parsedInputs.tirante) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.tirante') || 'Tirante'}: ${parsedInputs.tirante} ${parsedInputs.tiranteUnit ?? ''}\n`;
  }
  if (parsedInputs.base) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.base') || 'Base'}: ${parsedInputs.base} ${parsedInputs.baseUnit ?? ''}\n`;
  }
  if (parsedInputs.talud) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.talud') || 'Talud (z)'}: ${parsedInputs.talud}\n`;
  }
  if (parsedInputs.K) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.K') || 'K'}: ${parsedInputs.K} ${parsedInputs.KUnit ?? ''}\n`;
  }

  textToCopy += `\n`;

  // --- Resultados Geométricos ---
  textToCopy += `${t('geometriaSeccionesCalc.resultsSection') || 'Resultados Geométricos'}:\n`;
  if (parsedInputs.A) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.A') || 'Área (A)'}: ${parsedInputs.A} ${parsedInputs.AUnit ?? ''}\n`;
  }
  if (parsedInputs.P) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.P') || 'Perímetro (P)'}: ${parsedInputs.P} ${parsedInputs.PUnit ?? ''}\n`;
  }
  if (parsedInputs.T) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.T') || 'Ancho (T)'}: ${parsedInputs.T} ${parsedInputs.TUnit ?? ''}\n`;
  }
  if (parsedInputs.Dh) {
    textToCopy += `  ${t('geometriaSeccionesCalc.labels.Dh') || 'Dh'}: ${parsedInputs.Dh} ${parsedInputs.DhUnit ?? ''}\n`;
  }

  return textToCopy;
};

// Aplica formato de número, alineación central a una celda de Excel (idéntica)
const applyExcelCell = (row: ExcelJS.Row, col: number, numFmt?: string) => {
  const cell = row.getCell(col);
  if (numFmt) cell.numFmt = numFmt;
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
};

// Aplica el mismo formato a un conjunto de columnas de la misma fila (idéntica)
const applyExcelCells = (row: ExcelJS.Row, cols: number[], numFmt?: string) => {
  cols.forEach(col => applyExcelCell(row, col, numFmt));
};

// Aplica el estilo de encabezado a la primera fila de una hoja de Excel (idéntica)
const applyHeaderStyle = (sheet: ExcelJS.Worksheet) => {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = { bold: true };
  });
};

// Ajusta el ancho de todas las columnas de una hoja al mismo valor (idéntica)
const setColumnWidths = (sheet: ExcelJS.Worksheet, count: number, width: number = 18) => {
  for (let i = 1; i <= count; i++) {
    sheet.getColumn(i).width = width;
  }
};

// Comparador para evitar re-renders innecesarios en las tarjetas del historial (idéntico)
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

type HistoryCardProps = {
  item: HistoryItem;
  isFirst: boolean;
  onDelete: (id: number) => void;
};

// Tarjeta individual del historial con gesto de deslizamiento para revelar acciones
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
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const adjustDecimalSeparator = useCallback(
    (s: string) => (selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s),
    [selectedDecimalSeparator]
  );

  // Convierte un valor crudo en string con el formato de número de la aplicación
  const formatValue = useCallback(
    (raw: string): string => {
      if (raw == null || raw === '') return 'N/A';
      const n = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(n)) return String(raw);
      return adjustDecimalSeparator(formatNumber(n));
    },
    [formatNumber, adjustDecimalSeparator]
  );

  const parsedInputs = useMemo<ParsedInputs>(() => {
    try {
      return JSON.parse(item.inputs) || {};
    } catch {
      return {};
    }
  }, [item.inputs]);

  // El resultado principal es el Radio Hidráulico (R)
  const mainResult = parsedInputs.R || item.result;
  const formattedMainResult = useMemo(() => formatValue(mainResult), [mainResult, formatValue]);
  const mainUnit = parsedInputs.RUnit || 'm';
  const mainLabel = t('geometriaSeccionesCalc.result') || 'Radio Hidráulico';

  const inputsString = useMemo(() => buildInputsString(item, parsedInputs, t), [item, parsedInputs, t]);
  const dateStr = useMemo(() => formatDate(item.timestamp), [item.timestamp]);

  // --- Lógica de animación de deslizamiento (idéntica) ---
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
      Animated.timing(translateX, {
        toValue: REVEAL_OFFSET,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [isFirst, translateX]);

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

  const handleCopy = useCallback(() => {
    Clipboard.setString(buildCopyText(item, parsedInputs, formattedMainResult, t));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('geometriaSeccionesCalc.toasts.copied') || 'Copiado al portapapeles',
    });
  }, [item, parsedInputs, formattedMainResult, t]);
  // ------------------------------------------------

  return (
    <View style={styles.cardWrapper}>
      <Animated.View
        style={[
          styles.optionsContainerMain,
          { width: ORIGINAL_WIDTH, transform: [{ translateX }], experimental_backgroundImage: themeColors.gradient },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.optionsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}>
          <View style={styles.itemContent}>
            <Text style={[styles.resultLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {mainLabel}:
            </Text>
            <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 24 * fontSizeFactor }]}>
              {formattedMainResult} {mainUnit}
            </Text>

            <Text style={[styles.inputsText, { color: currentTheme === 'dark' ? 'rgb(210, 210, 210)' : 'rgb(50, 50, 50)', fontSize: 14 * fontSizeFactor }]}>
              {inputsString}
            </Text>

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

// Pantalla principal del historial de Geometría de Secciones
const HistoryScreenGeometriaSecciones = () => {
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
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  // Carga el historial desde la base de datos filtrando solo entradas de GeometriaSecciones
  const loadHistory = useCallback(async () => {
    try {
      if (!dbRef.current) {
        dbRef.current = await getDBConnection();
      }
      const fetched = await getHistory(dbRef.current);
      // Filtramos por el tipo de cálculo que guardamos en GeometriaSeccionesCalc
      const filtered = fetched.filter((item: HistoryItem) =>
        item.calculation_type === 'GeometriaSecciones_dimensions'
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

  // Elimina un registro individual del historial por su id (idéntico)
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

  // Muestra un diálogo de confirmación antes de borrar todo el historial (idéntico)
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
              // Usamos -1 y un filtro para borrar solo los de este tipo
              await deleteHistory(db, -1, 'GeometriaSecciones_dimensions');
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

  // Genera y comparte el archivo Excel con el historial
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

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      // Hoja de Geometría de Secciones
      const ws = wb.addWorksheet('Geometría Secciones');

      // Definir un conjunto amplio de columnas para cubrir todas las secciones
      const headers = [
        'Fecha/Hora',
        'Radio Hid. (R)',
        'Tipo Sección',
        'Diámetro (D)',
        'Tirante (y)',
        'Base (b)',
        'Talud (z)',
        'K',
        'Área (A)',
        'Perímetro (P)',
        'Ancho (T)',
        'Dh',
      ];
      ws.addRow(headers);
      applyHeaderStyle(ws);

      history.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }

        const row = ws.addRow([
          formatDate(it.timestamp),
          parseFloat(it.result) || 0, // R
          inputs.sectionType || '',
          parseFloat(inputs.diametro) || 0,
          parseFloat(inputs.tirante) || 0,
          parseFloat(inputs.base) || 0,
          parseFloat(inputs.talud) || 0,
          parseFloat(inputs.K) || 0,
          parseFloat(inputs.A) || 0,
          parseFloat(inputs.P) || 0,
          parseFloat(inputs.T) || 0,
          parseFloat(inputs.Dh) || 0,
        ]);

        applyExcelCell(row, 1); // Fecha
        applyExcelCell(row, 2, '#,##0.00 "m"'); // R
        applyExcelCell(row, 3); // Tipo (texto)
        applyExcelCells(row, [4,5,6,8,10,11,12], '#,##0.00 "m"'); // Longitudes
        applyExcelCell(row, 7); // Talud (adimensional)
        applyExcelCell(row, 9, '#,##0.00 "m²"'); // Área
      });

      setColumnWidths(ws, headers.length);

      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `Historial_Geometria_Secciones.xlsx`;
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
                  <Pressable
                    style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                    onPress={() => navigation.goBack()}
                  >
                    <Icon2 name="chevron-left" size={22} color={themeColors.icon} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.rightIconsContainer}>
                <View style={[styles.iconWrapper2, { experimental_backgroundImage: themeColors.gradient }]}>
                  <Pressable
                    style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
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
              <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>{t('geometriaSeccionesCalc.title')}</Text>
              <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('history.title')}</Text>
            </View>
          </>
        }
      />

      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

// Estilos (idénticos a HistoryScreenEnergiaBernoulli)
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 60,
    height: 40,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
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
  cardWrapper: {
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

export default HistoryScreenGeometriaSecciones;