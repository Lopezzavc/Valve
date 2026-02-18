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
  calculation_type: 'EnergiaBernoulli_ideal' | 'EnergiaBernoulli_losses' | 'EnergiaBernoulli_cavitation';
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
  const mode = item.calculation_type.split('_')[1];
  let inputString = '';

  if (mode === 'ideal' || mode === 'losses') {
    inputString += `P₁: ${parsedInputs.P1 ?? 'N/A'} ${parsedInputs.P1Unit ?? ''}\n`;
    inputString += `z₁: ${parsedInputs.z1 ?? 'N/A'} ${parsedInputs.z1Unit ?? ''}\n`;
    inputString += `V₁: ${parsedInputs.V1 ?? 'N/A'} ${parsedInputs.V1Unit ?? ''}\n`;
    inputString += `P₂: ${parsedInputs.P2 ?? 'N/A'} ${parsedInputs.P2Unit ?? ''}\n`;
    inputString += `z₂: ${parsedInputs.z2 ?? 'N/A'} ${parsedInputs.z2Unit ?? ''}\n`;
    inputString += `V₂: ${parsedInputs.V2 ?? 'N/A'} ${parsedInputs.V2Unit ?? ''}\n`;
    inputString += `γ: ${parsedInputs.gamma ?? 'N/A'} ${parsedInputs.gammaUnit ?? ''}\n`;
    inputString += `g: ${parsedInputs.g ?? 'N/A'} ${parsedInputs.gUnit ?? ''}\n`;
    
    if (parsedInputs.alpha1 && parsedInputs.alpha1 !== '1') {
      inputString += `α₁: ${parsedInputs.alpha1}\n`;
    }
    if (parsedInputs.alpha2 && parsedInputs.alpha2 !== '1') {
      inputString += `α₂: ${parsedInputs.alpha2}\n`;
    }
    if (parsedInputs.hb) {
      inputString += `hB: ${parsedInputs.hb} ${parsedInputs.hbUnit ?? ''}\n`;
    }
    if (parsedInputs.ht) {
      inputString += `hT: ${parsedInputs.ht} ${parsedInputs.htUnit ?? ''}\n`;
    }
    if (mode === 'losses') {
      if (parsedInputs.lossInputType === 'direct') {
        inputString += `hL: ${parsedInputs.hL ?? 'N/A'} ${parsedInputs.hLUnit ?? ''}\n`;
      } else {
        inputString += `L: ${parsedInputs.L ?? 'N/A'} ${parsedInputs.LUnit ?? ''}\n`;
        inputString += `D₁: ${parsedInputs.D1 ?? 'N/A'} ${parsedInputs.D1Unit ?? ''}\n`;
        inputString += `f: ${parsedInputs.f ?? 'N/A'}\n`;
        inputString += `K: ${parsedInputs.K ?? 'N/A'}\n`;
      }
    }
  } else if (mode === 'cavitation') {
    inputString += `${t('energiaBernoulliCalc.systemType') || 'Sistema'}: ${parsedInputs.cavitationSystemType === 'closed' ? 'Cerrado' : 'Abierto'}\n`;
    
    if (parsedInputs.cavitationSystemType === 'closed') {
      inputString += `P_s: ${parsedInputs.Ps ?? 'N/A'} ${parsedInputs.PsUnit ?? ''}\n`;
      inputString += `V_s: ${parsedInputs.Vs ?? 'N/A'} ${parsedInputs.VsUnit ?? ''}\n`;
    } else {
      inputString += `P_atm: ${parsedInputs.Patm ?? 'N/A'} ${parsedInputs.PatmUnit ?? ''}\n`;
      inputString += `z₀: ${parsedInputs.z0 ?? 'N/A'} ${parsedInputs.z0Unit ?? ''}\n`;
      inputString += `z_s: ${parsedInputs.zs ?? 'N/A'} ${parsedInputs.zsUnit ?? ''}\n`;
      inputString += `h_fs: ${parsedInputs.hfs ?? 'N/A'} ${parsedInputs.hfsUnit ?? ''}\n`;
    }

    if (parsedInputs.useRhoForGamma) {
      inputString += `ρ: ${parsedInputs.rho ?? 'N/A'} ${parsedInputs.rhoUnit ?? ''}\n`;
    } else {
      inputString += `γ: ${parsedInputs.gamma ?? 'N/A'} ${parsedInputs.gammaUnit ?? ''}\n`;
    }

    inputString += `g: ${parsedInputs.g ?? 'N/A'} ${parsedInputs.gUnit ?? ''}\n`;

    if (parsedInputs.useTempForPv) {
      inputString += `T: ${parsedInputs.temperatura ?? 'N/A'} ${parsedInputs.temperaturaUnit ?? ''}\n`;
    } else {
      inputString += `Pv: ${parsedInputs.Pv ?? 'N/A'} ${parsedInputs.PvUnit ?? ''}\n`;
    }

    if (parsedInputs.resultGamma) {
      inputString += `γ calc: ${parsedInputs.resultGamma} N/m³\n`;
    }
    if (parsedInputs.resultPv) {
      inputString += `Pv calc: ${parsedInputs.resultPv} Pa\n`;
    }
  }

  return inputString;
};

const buildCopyText = (item: HistoryItem, parsedInputs: ParsedInputs, formattedResult: string, t: (k: string, vars?: any) => string) => {
  const mode = item.calculation_type.split('_')[1];
  let textToCopy = '';

  if (mode === 'cavitation') {
    textToCopy += `${t('energiaBernoulliCalc.npsha') || 'NPSHa'}: ${formattedResult} m\n`;
    if (parsedInputs.resultCavitationMargin) {
      textToCopy += `${t('energiaBernoulliCalc.cavitationMargin') || 'Margen'}: ${parsedInputs.resultCavitationMargin} m\n`;
    }
    if (parsedInputs.resultPabs) {
      textToCopy += `${t('energiaBernoulliCalc.pabs') || 'Pabs'}: ${parsedInputs.resultPabs} Pa\n`;
    }
  } else {
    textToCopy += `${t('energiaBernoulliCalc.energyDifference') || 'Diferencia de energía'}: ${formattedResult} m\n`;
  }

  textToCopy += `\n${t('energiaBernoulliCalc.section1') || 'Sección 1'}:\n`;
  textToCopy += `  P₁: ${parsedInputs.P1 ?? 'N/A'} ${parsedInputs.P1Unit ?? ''}\n`;
  textToCopy += `  z₁: ${parsedInputs.z1 ?? 'N/A'} ${parsedInputs.z1Unit ?? ''}\n`;
  textToCopy += `  V₁: ${parsedInputs.V1 ?? 'N/A'} ${parsedInputs.V1Unit ?? ''}\n`;
  if (parsedInputs.alpha1 && parsedInputs.alpha1 !== '1') {
    textToCopy += `  α₁: ${parsedInputs.alpha1}\n`;
  }

  textToCopy += `\n${t('energiaBernoulliCalc.section2') || 'Sección 2'}:\n`;
  textToCopy += `  P₂: ${parsedInputs.P2 ?? 'N/A'} ${parsedInputs.P2Unit ?? ''}\n`;
  textToCopy += `  z₂: ${parsedInputs.z2 ?? 'N/A'} ${parsedInputs.z2Unit ?? ''}\n`;
  textToCopy += `  V₂: ${parsedInputs.V2 ?? 'N/A'} ${parsedInputs.V2Unit ?? ''}\n`;
  if (parsedInputs.alpha2 && parsedInputs.alpha2 !== '1') {
    textToCopy += `  α₂: ${parsedInputs.alpha2}\n`;
  }

  if (parsedInputs.hb) {
    textToCopy += `\nhB: ${parsedInputs.hb} ${parsedInputs.hbUnit ?? ''}\n`;
  }
  if (parsedInputs.ht) {
    textToCopy += `hT: ${parsedInputs.ht} ${parsedInputs.htUnit ?? ''}\n`;
  }

  if (mode === 'losses') {
    textToCopy += `\n${t('energiaBernoulliCalc.losses') || 'Pérdidas'}:\n`;
    if (parsedInputs.lossInputType === 'direct') {
      textToCopy += `  hL: ${parsedInputs.hL ?? 'N/A'} ${parsedInputs.hLUnit ?? ''}\n`;
    } else {
      textToCopy += `  L: ${parsedInputs.L ?? 'N/A'} ${parsedInputs.LUnit ?? ''}\n`;
      textToCopy += `  D₁: ${parsedInputs.D1 ?? 'N/A'} ${parsedInputs.D1Unit ?? ''}\n`;
      textToCopy += `  f: ${parsedInputs.f ?? 'N/A'}\n`;
      textToCopy += `  K: ${parsedInputs.K ?? 'N/A'}\n`;
    }
  }

  if (mode === 'cavitation') {
    textToCopy += `\n${t('energiaBernoulliCalc.fluidProps') || 'Propiedades'}:\n`;
    if (parsedInputs.useRhoForGamma) {
      textToCopy += `  ρ: ${parsedInputs.rho ?? 'N/A'} ${parsedInputs.rhoUnit ?? ''}\n`;
    } else {
      textToCopy += `  γ: ${parsedInputs.gamma ?? 'N/A'} ${parsedInputs.gammaUnit ?? ''}\n`;
    }
    textToCopy += `  g: ${parsedInputs.g ?? 'N/A'} ${parsedInputs.gUnit ?? ''}\n`;

    if (parsedInputs.useTempForPv) {
      textToCopy += `  T: ${parsedInputs.temperatura ?? 'N/A'} ${parsedInputs.temperaturaUnit ?? ''}\n`;
    } else {
      textToCopy += `  Pv: ${parsedInputs.Pv ?? 'N/A'} ${parsedInputs.PvUnit ?? ''}\n`;
    }

    if (parsedInputs.resultGamma) {
      textToCopy += `  γ (calc): ${parsedInputs.resultGamma} N/m³\n`;
    }
    if (parsedInputs.resultPv) {
      textToCopy += `  Pv (calc): ${parsedInputs.resultPv} Pa\n`;
    }
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

  const mode = item.calculation_type.split('_')[1];
  
  // Determinar el resultado principal según el modo
  let mainResult = '';
  let mainLabel = '';
  
  if (mode === 'cavitation') {
    mainResult = parsedInputs.resultNPSHa || item.result;
    mainLabel = t('energiaBernoulliCalc.npsha') || 'NPSHa';
  } else {
    mainResult = item.result;
    mainLabel = t('energiaBernoulliCalc.energyDifference') || 'Diferencia de energía';
  }
  
  const formattedMainResult = useMemo(() => formatValue(mainResult), [mainResult, formatValue]);
  const inputsString = useMemo(() => buildInputsString(item, parsedInputs, t), [item, parsedInputs, t]);
  const dateStr = useMemo(() => formatDate(item.timestamp), [item.timestamp]);

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

  const handleCopy = useCallback(() => {
    Clipboard.setString(buildCopyText(item, parsedInputs, formattedMainResult, t));
    Toast.show({
      type: 'success',
      text1: t('common.success'),
      text2: t('energiaBernoulliCalc.toasts.copied'),
    });
  }, [item, parsedInputs, formattedMainResult, t]);

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
              {mainLabel}:
            </Text>
            <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 24 * fontSizeFactor }]}>
              {formattedMainResult} {mode === 'cavitation' ? 'm' : 'm'}
            </Text>
            
            {mode === 'cavitation' && parsedInputs.resultCavitationMargin && (
              <>
                <Text style={[styles.resultLabel, { color: themeColors.text, fontSize: 14 * fontSizeFactor, marginTop: 5 }]}>
                  {t('energiaBernoulliCalc.cavitationMargin') || 'Margen de cavitación'}:
                </Text>
                <Text style={[styles.resultValue, { color: themeColors.text, fontSize: 20 * fontSizeFactor }]}>
                  {formatValue(parsedInputs.resultCavitationMargin)} m
                </Text>
              </>
            )}

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
      // Filtrar solo los items de EnergiaBernoulli
      const filtered = fetched.filter((item: HistoryItem) => 
        item.calculation_type.startsWith('EnergiaBernoulli_')
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

      const idealItems = history.filter(h => h.calculation_type === 'EnergiaBernoulli_ideal');
      const lossesItems = history.filter(h => h.calculation_type === 'EnergiaBernoulli_losses');
      const cavitationItems = history.filter(h => h.calculation_type === 'EnergiaBernoulli_cavitation');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'App Hidráulica';
      wb.created = new Date();

      // Hoja para Bernoulli Ideal
      if (idealItems.length > 0) {
        const wsIdeal = wb.addWorksheet('Bernoulli Ideal');
        const idealHeaders = [
          'Fecha/Hora', 'Diferencia Energía (m)', 'P₁', 'z₁', 'V₁', 'P₂', 'z₂', 'V₂',
          'γ', 'g', 'α₁', 'α₂', 'hB', 'hT'
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
          
          wsIdeal.addRow([
            formatDate(it.timestamp),
            parseFloat(it.result) || 0,
            inputs.P1 || 0, inputs.z1 || 0, inputs.V1 || 0,
            inputs.P2 || 0, inputs.z2 || 0, inputs.V2 || 0,
            inputs.gamma || 0, inputs.g || 0,
            inputs.alpha1 || 1, inputs.alpha2 || 1,
            inputs.hb || 0, inputs.ht || 0,
          ]);
        });

        // Ajustar anchos
        idealHeaders.forEach((_, i) => {
          wsIdeal.getColumn(i + 1).width = 15;
        });
      }

      // Hoja para Bernoulli con Pérdidas
      if (lossesItems.length > 0) {
        const wsLosses = wb.addWorksheet('Bernoulli con Pérdidas');
        const lossesHeaders = [
          'Fecha/Hora', 'Diferencia Energía (m)', 'P₁', 'z₁', 'V₁', 'P₂', 'z₂', 'V₂',
          'γ', 'g', 'α₁', 'α₂', 'hB', 'hT', 'Tipo Pérdida', 'hL', 'L', 'D₁', 'f', 'K'
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
          
          wsLosses.addRow([
            formatDate(it.timestamp),
            parseFloat(it.result) || 0,
            inputs.P1 || 0, inputs.z1 || 0, inputs.V1 || 0,
            inputs.P2 || 0, inputs.z2 || 0, inputs.V2 || 0,
            inputs.gamma || 0, inputs.g || 0,
            inputs.alpha1 || 1, inputs.alpha2 || 1,
            inputs.hb || 0, inputs.ht || 0,
            inputs.lossInputType || '',
            inputs.hL || 0,
            inputs.L || 0, inputs.D1 || 0,
            inputs.f || 0, inputs.K || 0,
          ]);
        });

        lossesHeaders.forEach((_, i) => {
          wsLosses.getColumn(i + 1).width = 15;
        });
      }

      // Hoja para Cavitación
      if (cavitationItems.length > 0) {
        const wsCav = wb.addWorksheet('Cavitación');
        const cavHeaders = [
          'Fecha/Hora', 'NPSHa (m)', 'Margen (m)', 'Pabs (Pa)',
          'Tipo Sistema', 'P_s', 'V_s', 'P_atm', 'z₀', 'z_s', 'h_fs',
          'ρ/γ', 'g', 'T/Pv', 'γ calc', 'Pv calc'
        ];
        wsCav.addRow(cavHeaders);
        
        const cavHeaderRow = wsCav.getRow(1);
        cavHeaderRow.font = { bold: true, color: { argb: 'FF000000' } };
        cavHeaderRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2FE0C' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        cavitationItems.forEach(it => {
          let inputs: any = {};
          try { inputs = JSON.parse(it.inputs || '{}'); } catch { inputs = {}; }
          
          wsCav.addRow([
            formatDate(it.timestamp),
            parseFloat(inputs.resultNPSHa) || 0,
            parseFloat(inputs.resultCavitationMargin) || 0,
            parseFloat(inputs.resultPabs) || 0,
            inputs.cavitationSystemType || '',
            inputs.Ps || 0, inputs.Vs || 0,
            inputs.Patm || 0, inputs.z0 || 0, inputs.zs || 0, inputs.hfs || 0,
            inputs.useRhoForGamma ? (inputs.rho || 0) : (inputs.gamma || 0),
            inputs.g || 0,
            inputs.useTempForPv ? (inputs.temperatura || 0) : (inputs.Pv || 0),
            inputs.resultGamma || 0,
            inputs.resultPv || 0,
          ]);
        });

        cavHeaders.forEach((_, i) => {
          wsCav.getColumn(i + 1).width = 15;
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const base64 = base64FromArrayBuffer(buffer);
      const fileName = `Valve_Historial_EnergiaBernoulli.xlsx`;
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