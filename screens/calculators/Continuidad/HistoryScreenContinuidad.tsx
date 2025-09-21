// HistoryScreenContinuidad.tsx
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

// Desplazamiento horizontal para revelar botones
const REVEAL_OFFSET = -(BUTTON_SIZE + 20);

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

type ParsedInputs = Record<string, any>;

// Utilidades de traducción para valores internos guardados ===
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

  // factor de fuente para escalar textos dentro de la tarjeta
  const { fontSizeFactor } = useContext(FontSizeContext);

  // tema para pintar tarjeta y textos
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

  // i18n
  const { t } = useContext(LanguageContext);

  // factor de fuente a nivel de pantalla (igual que en SettingsScreen)
  const { fontSizeFactor } = useContext(FontSizeContext);

  // tema para contenedor general y cabecera
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
                <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
                  <Pressable style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} onPress={handleResetPress}>
                    <Icon2 name="trash" size={20} color={themeColors.icon} />
                  </Pressable>
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

      <Toast config={toastConfig} />
    </View>
  );
};

// Styles ORIGINALES (sin cambios). Los colores se sobreescriben dinámicamente arriba.
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
    gap: 8,
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

export default HistoryScreenContinuidad;