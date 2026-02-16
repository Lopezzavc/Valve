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
  calculation_type: string; // 'EnergiaBernoulli_ideal', 'EnergiaBernoulli_losses', 'EnergiaBernoulli_cavitation'
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

// Función auxiliar para obtener el modo de cálculo
const getCalculationMode = (calculationType: string): string => {
  if (calculationType.includes('ideal')) return 'ideal';
  if (calculationType.includes('losses')) return 'losses';
  if (calculationType.includes('cavitation')) return 'cavitation';
  return 'unknown';
};

const buildInputsString = (item: HistoryItem, parsedInputs: ParsedInputs, t: (k: string, vars?: any) => string) => {
  const mode = getCalculationMode(item.calculation_type);
  let inputString = `${t('energiaBernoulliCalc.mode')}: ${t(`energiaBernoulliCalc.mode.${mode}`)}\n\n`;

  // Sección 1
  inputString += `${t('energiaBernoulliCalc.section1')}:\n`;
  inputString += `  P₁: ${parsedInputs.P1 ?? 'N/A'} ${parsedInputs.P1Unit ?? ''}\n`;
  inputString += `  z₁: ${parsedInputs.z1 ?? 'N/A'} ${parsedInputs.z1Unit ?? ''}\n`;
  inputString += `  V₁: ${parsedInputs.V1 ?? 'N/A'} ${parsedInputs.V1Unit ?? ''}\n`;

  // Sección 2
  inputString += `${t('energiaBernoulliCalc.section2')}:\n`;
  inputString += `  P₂: ${parsedInputs.P2 ?? 'N/A'} ${parsedInputs.P2Unit ?? ''}\n`;
  inputString += `  z₂: ${parsedInputs.z2 ?? 'N/A'} ${parsedInputs.z2Unit ?? ''}\n`;
  inputString += `  V₂: ${parsedInputs.V2 ?? 'N/A'} ${parsedInputs.V2Unit ?? ''}\n`;

  // Propiedades del fluido
  inputString += `\n${t('energiaBernoulliCalc.fluidProps')}:\n`;
  inputString += `  γ: ${parsedInputs.gamma ?? 'N/A'} ${parsedInputs.gammaUnit ?? ''}\n`;
  inputString += `  g: ${parsedInputs.g ?? 'N/A'} ${parsedInputs.gUnit ?? ''}\n`;
  if (parsedInputs.alpha1 && parsedInputs.alpha1 !== '1') {
    inputString += `  α₁: ${parsedInputs.alpha1}\n`;
  }
  if (parsedInputs.alpha2 && parsedInputs.alpha2 !== '1') {
    inputString += `  α₂: ${parsedInputs.alpha2}\n`;
  }

  // Bomba y Turbina
  if (parsedInputs.hb) {
    inputString += `\n${t('energiaBernoulliCalc.hb')}: ${parsedInputs.hb} ${parsedInputs.hbUnit ?? ''}\n`;
  }
  if (parsedInputs.ht) {
    inputString += `${t('energiaBernoulliCalc.ht')}: ${parsedInputs.ht} ${parsedInputs.htUnit ?? ''}\n`;
  }

  // Pérdidas (modo losses)
  if (mode === 'losses') {
    inputString += `\n${t('energiaBernoulliCalc.losses')}:\n`;
    if (parsedInputs.lossInputType === 'direct') {
      inputString += `  hL: ${parsedInputs.hL ?? 'N/A'} ${parsedInputs.hLUnit ?? ''}\n`;
    } else {
      inputString += `  L: ${parsedInputs.L ?? 'N/A'} ${parsedInputs.LUnit ?? ''}\n`;
      inputString += `  D₁: ${parsedInputs.D1 ?? 'N/A'} ${parsedInputs.D1Unit ?? ''}\n`;
      inputString += `  f: ${parsedInputs.f ?? 'N/A'}\n`;
      inputString += `  K: ${parsedInputs.K ?? 'N/A'}\n`;
    }
  }

  // Cavitación (modo cavitation)
  if (mode === 'cavitation') {
    inputString += `\n${t('energiaBernoulliCalc.cavitation')}:\n`;
    inputString += `  ${t('energiaBernoulliCalc.systemType')}: ${parsedInputs.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto'}\n`;
    if (parsedInputs.cavitationSystemType === 'closed') {
      inputString += `  P_s: ${parsedInputs.Ps ?? 'N/A'} ${parsedInputs.PsUnit ?? ''}\n`;
      inputString += `  V_s: ${parsedInputs.Vs ?? 'N/A'} ${parsedInputs.VsUnit ?? ''}\n`;
    } else {
      inputString += `  P_atm: ${parsedInputs.Patm ?? 'N/A'} ${parsedInputs.PatmUnit ?? ''}\n`;
      inputString += `  z₀: ${parsedInputs.z0 ?? 'N/A'} ${parsedInputs.z0Unit ?? ''}\n`;
      inputString += `  z_s: ${parsedInputs.zs ?? 'N/A'} ${parsedInputs.zsUnit ?? ''}\n`;
      inputString += `  h_fs: ${parsedInputs.hfs ?? 'N/A'} ${parsedInputs.hfsUnit ?? ''}\n`;
    }
    inputString += `  T: ${parsedInputs.temperatura ?? 'N/A'} ${parsedInputs.temperaturaUnit ?? ''}\n`;
    inputString += `  Pv: ${parsedInputs.Pv ?? 'N/A'} ${parsedInputs.PvUnit ?? ''}\n`;
  }

  return inputString;
};

const buildCopyText = (item: HistoryItem, parsedInputs: ParsedInputs, formattedResult: string, t: (k: string, vars?: any) => string) => {
  const mode = getCalculationMode(item.calculation_type);
  let textToCopy = '';

  if (mode === 'cavitation') {
    textToCopy += `${t('energiaBernoulliCalc.npsha')}: ${parsedInputs.resultNPSHa ?? 'N/A'} m\n`;
    textToCopy += `${t('energiaBernoulliCalc.cavitationMargin')}: ${formattedResult} m\n`;
    textToCopy += `${t('energiaBernoulliCalc.pabs')}: ${parsedInputs.resultPabs ?? 'N/A'} Pa\n`;
    if (parsedInputs.resultGamma) textToCopy += `γ: ${parsedInputs.resultGamma} N/m³ (calculado)\n`;
    if (parsedInputs.resultPv) textToCopy += `Pv: ${parsedInputs.resultPv} Pa (calculado)\n`;
    textToCopy += `\n${t('energiaBernoulliCalc.systemType')}: ${parsedInputs.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto'}\n`;
  } else {
    textToCopy += `${t('energiaBernoulliCalc.energyDifference')}: ${formattedResult} m\n`;
  }

  textToCopy += `${t('energiaBernoulliCalc.mode')}: ${t(`energiaBernoulliCalc.mode.${mode}`)}\n\n`;
  textToCopy += buildInputsString(item, parsedInputs, t);
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

  const formatResultValue = useCallback(
    (raw: string): string => {
      if (raw == null) return '';
      const n = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(n)) return String(raw);
      return adjustDecimalSeparator(formatNumber(n));
    },
    [formatNumber, adjustDecimalSeparator]
  );

  const formattedResult = useMemo(() => formatResultValue(item.result), [item.result, formatResultValue]);

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
    Clipboard.setString(buildCopyText(item, parsedInputs, formattedResult, t));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('energiaBernoulliCalc.toasts.copied'),
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
            <Text style={[styles.resultLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {t('energiaBernoulliCalc.energyDifference')}:
            </Text>
            <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 24 * fontSizeFactor }]}>
              {formattedResult} m
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

const HistoryScreenEnergiaBernoulli = () => {
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

  const loadHistory = useCallback(async () => {
    try {
      if (!dbRef.current) {
        dbRef.current = await getDBConnection();
      }
      const fetched = await getHistory(dbRef.current);
      // Filtrar solo los items que pertenecen a EnergiaBernoulli
      const filtered = fetched.filter((item: HistoryItem) => 
        item.calculation_type.startsWith('EnergiaBernoulli')
      );
      setHistory((prev) => {
        const sameLength = prev.length === filtered.length;
        if (sameLength) {
          const same = prev.every((p, i) => {
            const n = filtered[i];
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
        return filtered;
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
              // Eliminar solo los items de EnergiaBernoulli
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
  }, [history.length, t, history]);

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

      const idealItems = history.filter(h => h.calculation_type.includes('ideal'));
      const lossesItems = history.filter(h => h.calculation_type.includes('losses'));
      const cavitationItems = history.filter(h => h.calculation_type.includes('cavitation'));

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      // Hoja para modo Ideal
      const wsIdeal = wb.addWorksheet('Ideal');
      const idealHeaders = [
        'Fecha/Hora',
        'Energía Total (m)',
        'P₁', 'z₁', 'V₁',
        'P₂', 'z₂', 'V₂',
        'γ', 'g', 'α₁', 'α₂',
        'hB', 'hT',
      ];
      wsIdeal.addRow(idealHeaders);
      const idealHeaderRow = wsIdeal.getRow(1);
      idealHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
      idealHeaderRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      idealItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }
        const q = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;

        wsIdeal.addRow([
          formatDate(it.timestamp),
          isFinite(q as number) ? q : null,
          inputs.P1, inputs.z1, inputs.V1,
          inputs.P2, inputs.z2, inputs.V2,
          inputs.gamma, inputs.g, inputs.alpha1, inputs.alpha2,
          inputs.hb, inputs.ht,
        ]);
      });

      // Hoja para modo Losses
      const wsLosses = wb.addWorksheet('Con Pérdidas');
      const lossesHeaders = [
        'Fecha/Hora',
        'Diferencia Energía (m)',
        'P₁', 'z₁', 'V₁',
        'P₂', 'z₂', 'V₂',
        'γ', 'g', 'α₁', 'α₂',
        'hB', 'hT',
        'Tipo Pérdida', 'hL', 'L', 'D₁', 'f', 'K',
      ];
      wsLosses.addRow(lossesHeaders);
      const lossesHeaderRow = wsLosses.getRow(1);
      lossesHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
      lossesHeaderRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      lossesItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }
        const q = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;

        wsLosses.addRow([
          formatDate(it.timestamp),
          isFinite(q as number) ? q : null,
          inputs.P1, inputs.z1, inputs.V1,
          inputs.P2, inputs.z2, inputs.V2,
          inputs.gamma, inputs.g, inputs.alpha1, inputs.alpha2,
          inputs.hb, inputs.ht,
          inputs.lossInputType,
          inputs.hL,
          inputs.L,
          inputs.D1,
          inputs.f,
          inputs.K,
        ]);
      });

      // Hoja para modo Cavitation
      const wsCavitation = wb.addWorksheet('Cavitación');
      const cavitationHeaders = [
        'Fecha/Hora',
        'NPSHa (m)',
        'Margen (m)',
        'Pabs (Pa)',
        'Sistema',
        'P_s', 'V_s',
        'P_atm', 'z₀', 'z_s', 'h_fs',
        'T', 'Pv',
        'γ/ρ', 'g',
      ];
      wsCavitation.addRow(cavitationHeaders);
      const cavitationHeaderRow = wsCavitation.getRow(1);
      cavitationHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
      cavitationHeaderRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      cavitationItems.forEach(it => {
        let inputs: any = {};
        try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }
        const q = it.result != null ? parseFloat(String(it.result).replace(',', '.')) : null;

        wsCavitation.addRow([
          formatDate(it.timestamp),
          inputs.resultNPSHa,
          isFinite(q as number) ? q : null,
          inputs.resultPabs,
          inputs.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto',
          inputs.Ps,
          inputs.Vs,
          inputs.Patm,
          inputs.z0,
          inputs.zs,
          inputs.hfs,
          inputs.temperatura,
          inputs.Pv,
          inputs.resultGamma || inputs.gamma,
          inputs.g,
        ]);
      });

      // Autoajustar ancho de columnas (simplificado)
      [wsIdeal, wsLosses, wsCavitation].forEach((ws, idx) => {
        ws.columns.forEach((column, i) => {
          let maxLength = 10;
          if (idx === 0 && idealHeaders[i]) maxLength = idealHeaders[i].length;
          if (idx === 1 && lossesHeaders[i]) maxLength = lossesHeaders[i].length;
          if (idx === 2 && cavitationHeaders[i]) maxLength = cavitationHeaders[i].length;
          column.width = Math.min(Math.max(maxLength + 2, 10), 60);
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `EnergiaBernoulli_Historial.xlsx`;
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
              <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>{t('energiaBernoulliCalc.title')}</Text>
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

export default HistoryScreenEnergiaBernoulli;