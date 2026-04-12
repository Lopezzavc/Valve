import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { useKeyboard } from '../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../src/components/CustomKeyboardInput';
import {
  appendKeyboardKey,
  clearKeyboardValue,
  deleteKeyboardKey,
  formatKeyboardDisplayValue,
  insertKeyboardMinus,
  insertScientificNotation,
} from '../../src/components/customKeyboardHelpers';
import {
  derivePumpCurveState,
  normalizePumpCurvePoints,
  normalizePumpCurves,
  type PumpCurveDerivedState,
  type PumpCurveEntry,
} from './axisPumpCurves';

type RootStackParamList = {
  PumpCurvesAxisScreen: {
    initialCurves?: PumpCurveEntry[];
    onSave?: (curves: PumpCurveEntry[]) => void;
  };
};

type CurveStateMap = Record<number, PumpCurveDerivedState>;

function getPumpCurveChartHtml(
  currentTheme: 'light' | 'dark',
  derived: PumpCurveDerivedState,
  labels: {
    flow: string;
    head: string;
    empty: string;
  },
): string {
  const payload = JSON.stringify({
    validPoints: derived.validPoints,
    curveSamples: derived.curveSamples,
    labels,
  }).replace(/</g, '\\u003c');

  const isDark = currentTheme === 'dark';
  const background = isDark ? '#101010' : '#ffffff';
  const panel = isDark ? '#101010' : '#ffffff';
  const text = isDark ? '#f4f4f4' : '#111111';
  const muted = isDark ? '#9a9a9a' : '#666666';
  const border = isDark ? '#363636' : '#d6d6d6';
  const grid = isDark ? '#232323' : '#ececec';
  const curve = isDark ? '#f4f4f4' : '#111111';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${background};
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: ${panel};
    }
  </style>
</head>
<body>
  <canvas id="chart"></canvas>
  <script>
    const payload = ${payload};
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');

    function resizeAndDraw() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = Math.max(Math.round(rect.width || 320), 320);
      const cssHeight = Math.max(Math.round(rect.height || 180), 180);
    
      if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
      }
    
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = ${JSON.stringify(background)};
      ctx.fillRect(0, 0, cssWidth, cssHeight);
    
      const pad = { left: 32, right: 2, top: 2, bottom: 15};
      const plotWidth = cssWidth - pad.left - pad.right;
      const plotHeight = cssHeight - pad.top - pad.bottom;
    
      ctx.strokeStyle = ${JSON.stringify(border)};
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.left, pad.top, plotWidth, plotHeight);
    
      const points = Array.isArray(payload.validPoints) ? payload.validPoints : [];
      const curvePoints = Array.isArray(payload.curveSamples) ? payload.curveSamples : [];
    
      // --- NUEVA LÓGICA: definir rangos incluso sin datos ---
      let minQ, maxQ, minH, maxH;
    
      if (points.length === 0 && curvePoints.length === 0) {
        // Sin datos: usar rango por defecto para mostrar estructura
        minQ = 0;
        maxQ = 100;
        minH = 0;
        maxH = 100;
      } else {
        // Con datos: calcular rangos reales
        const qValues = points.map(point => point.flow);
        const hValues = points.map(point => point.head);
        curvePoints.forEach(point => {
          qValues.push(point.flow);
          hValues.push(point.head);
        });
    
        minQ = Math.min(...qValues);
        maxQ = Math.max(...qValues);
        minH = Math.min(...hValues);
        maxH = Math.max(...hValues);
    
        if (Math.abs(maxQ - minQ) < 1e-9) {
          minQ -= 1;
          maxQ += 1;
        }
        if (Math.abs(maxH - minH) < 1e-9) {
          minH -= 1;
          maxH += 1;
        }
      }
    
      const qPadding = (maxQ - minQ) * 0.1;
      const hPadding = (maxH - minH) * 0.12;
      minQ -= qPadding;
      maxQ += qPadding;
      minH -= hPadding;
      maxH += hPadding;
    
      const toX = q => pad.left + ((q - minQ) / (maxQ - minQ)) * plotWidth;
      const toY = h => pad.top + plotHeight - ((h - minH) / (maxH - minH)) * plotHeight;
    
      // --- CUADRÍCULA (siempre se dibuja) ---
      ctx.strokeStyle = ${JSON.stringify(grid)};
      ctx.lineWidth = 1;
      for (let index = 1; index < 4; index += 1) {
        const x = pad.left + (plotWidth / 4) * index;
        const y = pad.top + (plotHeight / 4) * index;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + plotHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + plotWidth, y);
        ctx.stroke();
      }
    
      // --- LABELS DE EJES (siempre se dibujan) ---
      ctx.fillStyle = ${JSON.stringify(muted)};
      ctx.font = "10px sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(payload.labels.flow, pad.left + plotWidth / 2, cssHeight - 2);
      ctx.save();
      ctx.translate(pad.left - 10, pad.top + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(payload.labels.head, 0, 0);
      ctx.restore();
    
      // --- VALORES DE LOS EJES (siempre se dibujan) ---
      ctx.textAlign = 'left';
      // Número superior (máxima altura): anclado arriba con margen de 2px
      ctx.textBaseline = 'top';
      ctx.fillText(maxH.toFixed(1), 0, pad.top + 2);
      // Número inferior (mínima altura): anclado abajo con margen de 2px
      ctx.textBaseline = 'bottom';
      ctx.fillText(minH.toFixed(1), 0, pad.top + plotHeight - 2);
      // Restaurar baseline por defecto
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(minQ.toFixed(1), pad.left + 2, cssHeight - 2);
      // Número máximo (derecha): alineado a la derecha y con un pequeño margen
      ctx.textAlign = 'right';
      ctx.fillText(maxQ.toFixed(1), pad.left + plotWidth - 2, cssHeight - 2);
    
      // --- CURVA (solo si hay suficientes puntos) ---
      if (curvePoints.length > 1) {
        ctx.strokeStyle = ${JSON.stringify(curve)};
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        curvePoints.forEach((point, index) => {
          const x = toX(point.flow);
          const y = toY(point.head);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    
      // --- PUNTOS (solo si hay puntos válidos) ---
      ctx.fillStyle = ${JSON.stringify(text)};
      points.forEach(point => {
        ctx.beginPath();
        ctx.arc(toX(point.flow), toY(point.head), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    resizeAndDraw();
    window.addEventListener('resize', resizeAndDraw);
  </script>
</body>
</html>`;
}

const PumpCurvesAxisScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PumpCurvesAxisScreen'>>();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { activeInputId, setActiveInputId } = useKeyboard();

  const initialCurves = useMemo(
    () => normalizePumpCurves(route.params?.initialCurves),
    [route.params?.initialCurves],
  );

  const nextCurveIdRef = useRef(
    initialCurves.reduce((max, curve) => Math.max(max, curve.id), 0) + 1,
  );
  const nextPointIdRef = useRef(
    initialCurves.reduce(
      (max, curve) => Math.max(max, ...curve.points.map(point => point.id), 0),
      0,
    ) + 1,
  );
  const onSaveRef = useRef(route.params?.onSave);
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  const activeInputIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<PumpCurveEntry[]>(initialCurves);

  useEffect(() => {
    onSaveRef.current = route.params?.onSave;
  }, [route.params?.onSave]);

  useEffect(() => {
    activeInputIdRef.current = activeInputId;
  }, [activeInputId]);

  useEffect(() => {
    setActiveInputId(null);
    return () => setActiveInputId(null);
  }, [setActiveInputId]);

  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card: 'rgb(24,24,24)',
        blockInput: 'rgb(36,36,36)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        textMuted: 'rgb(150,150,150)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }

    return {
      card: 'rgb(255,255,255)',
      blockInput: 'rgb(245,245,245)',
      text: 'rgb(0,0,0)',
      textStrong: 'rgb(0,0,0)',
      textMuted: 'rgb(120,120,120)',
      separator: 'rgb(235,235,235)',
      icon: 'rgb(0,0,0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const getNextAvailableCurveId = useCallback(
    (curves: PumpCurveEntry[], currentCurveId?: number) => {
      const prefix = t('axisPump.curveIdPrefix') || 'CB';
      const usedIds = new Set(
        curves
          .filter(curve => curve.id !== currentCurveId)
          .map(curve => curve.curveId.trim())
          .filter(Boolean),
      );
      let counter = 1;
      while (usedIds.has(`${prefix}${counter}`)) counter += 1;
      return `${prefix}${counter}`;
    },
    [t],
  );

  const sanitizeCurvesForSave = useCallback(
    (curves: PumpCurveEntry[]): PumpCurveEntry[] => {
      const usedIds = new Set<string>();
      const prefix = t('axisPump.curveIdPrefix') || 'CB';
      let fallbackCounter = 1;

      return normalizePumpCurves(curves).map(curve => {
        let nextCurveId = curve.curveId.trim();
        while (!nextCurveId || usedIds.has(nextCurveId)) {
          nextCurveId = `${prefix}${fallbackCounter}`;
          fallbackCounter += 1;
        }
        usedIds.add(nextCurveId);
        return {
          ...curve,
          curveId: nextCurveId,
          points: normalizePumpCurvePoints(curve.points),
        };
      });
    },
    [t],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      onSaveRef.current?.(sanitizeCurvesForSave(draft));
    });

    return unsubscribe;
  }, [draft, navigation, sanitizeCurvesForSave]);

  const updateCurve = useCallback((id: number, updater: (curve: PumpCurveEntry) => PumpCurveEntry) => {
    setDraft(prev => prev.map(curve => (curve.id === id ? updater(curve) : curve)));
  }, []);

  const addCurve = useCallback(() => {
    setDraft(prev => ([
      ...prev,
      {
        id: nextCurveIdRef.current++,
        curveId: getNextAvailableCurveId(prev),
        points: normalizePumpCurvePoints(
          Array.from({ length: 3 }, () => ({
            id: nextPointIdRef.current++,
            flow: '',
            head: '',
          })),
        ),
      },
    ]));
  }, [getNextAvailableCurveId]);

  const removeCurve = useCallback((id: number) => {
    setDraft(prev => prev.filter(curve => curve.id !== id));
  }, []);

  const addPoint = useCallback((curveId: number) => {
    updateCurve(curveId, curve => ({
      ...curve,
      points: [
        ...curve.points,
        {
          id: nextPointIdRef.current++,
          flow: '',
          head: '',
        },
      ],
    }));
  }, [updateCurve]);

  const removePoint = useCallback((curveId: number, pointId: number) => {
    updateCurve(curveId, curve => ({
      ...curve,
      points: curve.points.filter(point => point.id !== pointId),
    }));
  }, [updateCurve]);

  const normalizeCurveId = useCallback((curveId: number) => {
    setDraft(prev => prev.map(curve => {
      if (curve.id !== curveId) return curve;
      const trimmed = curve.curveId.trim();
      if (trimmed && prev.every(item => item.id === curveId || item.curveId.trim() !== trimmed)) {
        return { ...curve, curveId: trimmed };
      }
      return { ...curve, curveId: getNextAvailableCurveId(prev, curveId) };
    }));
  }, [getNextAvailableCurveId]);

  const getActiveValue = useCallback((): string => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return '';

    const match = fieldId.match(/^curve-(\d+)-point-(\d+)-(flow|head)$/);
    if (!match) return '';

    const curveId = Number(match[1]);
    const pointId = Number(match[2]);
    const field = match[3] as 'flow' | 'head';
    const curve = draft.find(entry => entry.id === curveId);
    const point = curve?.points.find(entry => entry.id === pointId);
    return point?.[field] ?? '';
  }, [draft]);

  const handleKeyboardKey = useCallback((key: string) => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return;
    const nextValue = appendKeyboardKey(getActiveValue(), key);
    if (nextValue !== null) {
      inputHandlersRef.current[fieldId]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDelete = useCallback(() => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return;
    inputHandlersRef.current[fieldId]?.(deleteKeyboardKey(getActiveValue()));
  }, [getActiveValue]);

  const handleKeyboardClear = useCallback(() => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return;
    inputHandlersRef.current[fieldId]?.(clearKeyboardValue());
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return;
    const nextValue = insertScientificNotation(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[fieldId]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
    const fieldId = activeInputIdRef.current;
    if (!fieldId) return;
    const nextValue = insertKeyboardMinus(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[fieldId]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => {
    setActiveInputId(null);
  }, [setActiveInputId]);

  const renderInputField = useCallback(
    (
      label: string,
      value: string,
      fieldId: string,
      onChangeText: (text: string) => void,
      options: {
        compact?: boolean;
        nativeKeyboard?: boolean;
        disabled?: boolean;
        onEndEditing?: () => void;
      } = {},
    ) => {
      inputHandlersRef.current[fieldId] = onChangeText;

      return (
        <View style={[styles.inputWrapper, options.compact && { flex: 1 }]}>
          <Text
            style={[
              styles.inputLabel,
              { color: options.disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
            ]}
          >
            {label}
          </Text>
          <View
            style={[
              options.compact ? styles.containerCompact : styles.container,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
            <View
              style={[
                styles.innerWhiteContainer,
                { backgroundColor: options.disabled ? themeColors.blockInput : themeColors.card },
              ]}
            >
              {options.nativeKeyboard ? (
                <TextInput
                  style={[
                    styles.input,
                    { color: options.disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                  value={value}
                  onChangeText={onChangeText}
                  editable={!options.disabled}
                  onFocus={() => setActiveInputId(null)}
                  onEndEditing={options.onEndEditing}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="default"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              ) : (
                <>
                  <Pressable onPress={() => !options.disabled && setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: options.disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
                    ]}
                    value={formatKeyboardDisplayValue(value)}
                    editable={false}
                    showSoftInputOnFocus={false}
                    pointerEvents="none"
                    placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      );
    },
    [
      currentTheme,
      fontSizeFactor,
      setActiveInputId,
      themeColors.blockInput,
      themeColors.card,
      themeColors.gradient,
      themeColors.text,
      themeColors.textMuted,
    ],
  );

  const curveStates = useMemo<CurveStateMap>(() => (
    draft.reduce<CurveStateMap>((acc, curve) => {
      acc[curve.id] = derivePumpCurveState(curve);
      return acc;
    }, {})
  ), [draft]);

  const getCurveStatusLabel = useCallback((derived: PumpCurveDerivedState) => {
    if (derived.validPoints.length < 3) {
      return derived.invalidRows > 0
        ? t('axisPump.status.needThreePointsWithErrors')
        : t('axisPump.status.needThreePoints');
    }
    if (!derived.coefficients) {
      return t('axisPump.status.fitError');
    }
    return derived.invalidRows > 0
      ? t('axisPump.status.readyWithErrors')
      : t('axisPump.status.ready');
  }, [t]);

  const isKeyboardOpen = !!activeInputId;

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={{ paddingBottom: isKeyboardOpen ? 330 : 70 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <View style={styles.leftIconsContainer}>
            <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => navigation.goBack()}
              >
                <Icon name="chevron-left" size={20} color={themeColors.icon} />
              </Pressable>
            </View>
          </View>
          <View style={styles.rightIconsPlaceholder} />
        </View>

        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
            {t('axisPump.subtitle')}
          </Text>
          <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
            {t('axisPump.title')}
          </Text>
        </View>

        <View style={[styles.inputsSection, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('axisPump.section')}
          </Text>

          {draft.length === 0 && (
            <View style={[styles.emptyStateShell, { experimental_backgroundImage: themeColors.gradient }]}>
              <View style={[styles.emptyStateCard, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.emptyStateText, { color: themeColors.textMuted, fontSize: 15 * fontSizeFactor }]}>
                  {t('axisPump.emptyState')}
                </Text>
              </View>
            </View>
          )}

          {draft.map(curve => {
            const derived = curveStates[curve.id];
            return (
              <View key={curve.id} style={[styles.accessoryBlockMain, { experimental_backgroundImage: themeColors.gradient }]}>
                <View style={[styles.accessoryBlock, { backgroundColor: themeColors.card }]}>
                  <View style={[styles.accessoryHeader, { marginBottom: 0 }]}>
                    <Text style={[styles.accessoryTitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>
                      {`${t('axisPump.curveCardTitle')} (${curve.curveId.trim() || t('axisPump.unnamedCurve')})`}
                    </Text>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    {renderInputField(
                      t('axisPump.field.curveId'),
                      curve.curveId,
                      `curve-${curve.id}-curveId`,
                      text => updateCurve(curve.id, currentCurve => ({ ...currentCurve, curveId: text })),
                      {
                        nativeKeyboard: true,
                        onEndEditing: () => normalizeCurveId(curve.id),
                      },
                    )}

                    {curve.points.map(point => (
                      <View key={`point-${curve.id}-${point.id}`} style={styles.pointRow}>
                        {renderInputField(
                          t('axisPump.field.flow'),
                          point.flow,
                          `curve-${curve.id}-point-${point.id}-flow`,
                          text => updateCurve(curve.id, currentCurve => ({
                            ...currentCurve,
                            points: currentCurve.points.map(currentPoint => (
                              currentPoint.id === point.id ? { ...currentPoint, flow: text } : currentPoint
                            )),
                          })),
                          { compact: true },
                        )}
                        {renderInputField(
                          t('axisPump.field.head'),
                          point.head,
                          `curve-${curve.id}-point-${point.id}-head`,
                          text => updateCurve(curve.id, currentCurve => ({
                            ...currentCurve,
                            points: currentCurve.points.map(currentPoint => (
                              currentPoint.id === point.id ? { ...currentPoint, head: text } : currentPoint
                            )),
                          })),
                          { compact: true },
                        )}
                        <Pressable
                          onPress={() => removePoint(curve.id, point.id)}
                          style={[styles.pointDeleteButton, { backgroundColor: themeColors.blockInput }]}
                        >
                          <Icon name="x" size={18} color={themeColors.icon} />
                        </Pressable>
                      </View>
                    ))}

                    <View style={styles.inlineActionsRow}>
                      <Pressable style={styles.addPointButton} onPress={() => addPoint(curve.id)}>
                        <Icon name="plus" size={16} color="white" />
                        <Text style={[styles.addPointButtonLabel, { fontSize: 14 * fontSizeFactor }]}>
                          {t('axisPump.addPoint')}
                        </Text>
                      </Pressable>
                    </View>

                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: derived.coefficients ? '#000000' : themeColors.textMuted,
                          fontSize: 14 * fontSizeFactor,
                        },
                      ]}
                    >
                      {getCurveStatusLabel(derived)}
                    </Text>

                    <View style={[styles.chartWrapper, { borderColor: themeColors.separator }]}>
                      <WebView
                        originWhitelist={['*']}
                        source={{
                          html: getPumpCurveChartHtml(currentTheme === 'dark' ? 'dark' : 'light', derived, {
                            flow: t('axisPump.field.flow'),
                            head: t('axisPump.field.head'),
                            empty: t('axisPump.chart.empty'),
                          }),
                        }}
                        style={styles.chartWebView}
                        scrollEnabled={false}
                        bounces={false}
                        overScrollMode="never"
                      />
                    </View>

                    <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                      <Pressable onPress={() => removeCurve(curve.id)} style={styles.deleteButton}>
                        <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.addButtonRow}>
            <Pressable style={styles.addButton} onPress={addCurve}>
              <Icon name="plus" size={24} color="white" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {isKeyboardOpen && (
        <View style={styles.customKeyboardWrapper}>
          <CustomKeyboardPanel
            onKeyPress={handleKeyboardKey}
            onDelete={handleKeyboardDelete}
            onSubmit={handleKeyboardSubmit}
            onMultiplyBy10={handleKeyboardMultiply10}
            onDivideBy10={handleKeyboardDivide10}
            onClear={handleKeyboardClear}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 45,
    marginTop: 30,
    backgroundColor: 'transparent',
  },
  leftIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 8,
  },
  rightIconsPlaceholder: {
    width: 60,
    height: 40,
  },
  iconWrapper: {
    width: 60,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconContainer: {
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  titlesContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  title: {
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: -10,
  },
  inputsSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 0,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: 0,
  },
  sectionSubtitle: {
    fontSize: 20,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: 5,
    marginBottom: 8,
  },
  inputWrapper: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  inputLabel: {
    marginBottom: 2,
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
  },
  container: {
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    width: '100%',
  },
  containerCompact: {
    justifyContent: 'center',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
    flex: 1,
  },
  innerWhiteContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    borderRadius: 25,
  },
  input: {
    height: 50,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75,
    fontSize: 16,
  },
  accessoryBlockMain: {
    padding: 1,
    marginBottom: 12,
    backgroundColor: 'transparent',
    borderRadius: 25,
  },
  accessoryBlock: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 15,
    paddingTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  accessoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accessoryTitle: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 16,
  },
  pointRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  pointDeleteButton: {
    width: 44,
    height: 50,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 30,
  },
  addPointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgb(0, 0, 0)',
    paddingHorizontal: 16,
  },
  addPointButtonLabel: {
    color: 'white',
    fontFamily: 'SFUIDisplay-Medium',
  },
  statusText: {
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 20,
    marginBottom: 8,
  },
  chartWrapper: {
    height: 210,
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  chartWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  deleteButton: {
    backgroundColor: 'rgb(254, 12, 12)',
    padding: 5,
    borderRadius: 0,
    marginLeft: 10,
    marginBottom: 8,
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgb(0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateShell: {
    padding: 1,
    borderRadius: 25,
    marginBottom: 12,
  },
  emptyStateCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyStateText: {
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 22,
  },
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
});

export default PumpCurvesAxisScreen;
