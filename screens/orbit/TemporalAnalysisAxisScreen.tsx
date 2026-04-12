import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';
import Octicons from 'react-native-vector-icons/Octicons';
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

export interface TemporalPatternEntry {
  id: number;
  patternId: string;
  multipliers: string[];
}

export interface TemporalAnalysisConfig {
  enabled: boolean;
  durationHours: string;
  durationMinutes: string;
  stepHours: string;
  stepMinutes: string;
  patterns: TemporalPatternEntry[];
}

type RootStackParamList = {
  TemporalAnalysisAxisScreen: {
    initialConfig?: TemporalAnalysisConfig;
    onSave?: (config: TemporalAnalysisConfig) => void;
  };
};

const DEFAULT_MULTIPLIERS = Array.from({ length: 24 }, () => '1');

function normalizeMultipliers(values?: string[]): string[] {
  return Array.from({ length: 24 }, (_, index) => values?.[index] ?? DEFAULT_MULTIPLIERS[index]);
}

function normalizeTemporalConfig(config?: TemporalAnalysisConfig): TemporalAnalysisConfig {
  return {
    enabled: !!config?.enabled,
    durationHours: config?.durationHours ?? '24',
    durationMinutes: config?.durationMinutes ?? '0',
    stepHours: config?.stepHours ?? '1',
    stepMinutes: config?.stepMinutes ?? '0',
    patterns: Array.isArray(config?.patterns)
      ? config!.patterns.map((pattern, index) => ({
          id: Number.isFinite(pattern?.id) ? pattern.id : index + 1,
          patternId: pattern?.patternId ?? '',
          multipliers: normalizeMultipliers(pattern?.multipliers),
        }))
      : [],
  };
}

const TemporalAnalysisAxisScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TemporalAnalysisAxisScreen'>>();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { activeInputId, setActiveInputId } = useKeyboard();

  const initialConfig = useMemo(
    () => normalizeTemporalConfig(route.params?.initialConfig),
    [route.params?.initialConfig]
  );

  const nextPatternIdRef = useRef(
    initialConfig.patterns.reduce((max, pattern) => Math.max(max, pattern.id), 0) + 1
  );
  const onSaveRef = useRef(route.params?.onSave);
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  const activeInputIdRef = useRef<string | null>(null);
  const [draft, setDraft] = useState<TemporalAnalysisConfig>(initialConfig);

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
        checkboxMargin: 'rgb(255,255,255)',
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
      checkboxMargin: 'rgb(0,0,0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const createPattern = useCallback(
    (existingPatterns: TemporalPatternEntry[]): TemporalPatternEntry => {
      const usedIds = new Set(existingPatterns.map(pattern => pattern.patternId.trim()).filter(Boolean));
      const defaultPatternId = t('axisTemporal.defaultPatternId');
      let nextPatternId = defaultPatternId;

      if (usedIds.has(nextPatternId)) {
        const prefix = t('axisTemporal.patternIdPrefix');
        let counter = 1;
        while (usedIds.has(`${prefix}${counter}`)) counter += 1;
        nextPatternId = `${prefix}${counter}`;
      }

      const pattern = {
        id: nextPatternIdRef.current,
        patternId: nextPatternId,
        multipliers: [...DEFAULT_MULTIPLIERS],
      };
      nextPatternIdRef.current += 1;
      return pattern;
    },
    [t]
  );

  useEffect(() => {
    if (draft.patterns.length > 0) return;
    setDraft(prev => ({ ...prev, patterns: [createPattern(prev.patterns)] }));
  }, [createPattern, draft.patterns.length]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      onSaveRef.current?.({
        ...draft,
        patterns: draft.patterns.map(pattern => ({
          ...pattern,
          patternId: pattern.patternId.trim(),
          multipliers: normalizeMultipliers(pattern.multipliers),
        })),
      });
    });

    return unsubscribe;
  }, [draft, navigation]);

  const updateDraftField = useCallback(
    (field: keyof Omit<TemporalAnalysisConfig, 'patterns'>, value: string | boolean) => {
      setDraft(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const updatePattern = useCallback(
    (id: number, updater: (pattern: TemporalPatternEntry) => TemporalPatternEntry) => {
      setDraft(prev => ({
        ...prev,
        patterns: prev.patterns.map(pattern => (pattern.id === id ? updater(pattern) : pattern)),
      }));
    },
    []
  );

  const addPattern = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      patterns: [...prev.patterns, createPattern(prev.patterns)],
    }));
  }, [createPattern]);

  const removePattern = useCallback((id: number) => {
    setDraft(prev => ({
      ...prev,
      patterns: prev.patterns.filter(pattern => pattern.id !== id),
    }));
  }, []);

  const getActiveValue = useCallback((): string => {
    const activeFieldId = activeInputIdRef.current;
    if (!activeFieldId) return '';

    const configMatch = activeFieldId.match(/^config-(durationHours|durationMinutes|stepHours|stepMinutes)$/);
    if (configMatch) {
      return draft[configMatch[1] as keyof Omit<TemporalAnalysisConfig, 'patterns' | 'enabled'>] ?? '';
    }

    const patternMatch = activeFieldId.match(/^pattern-(\d+)-(patternId|hour-\d{2})$/);
    if (!patternMatch) return '';

    const patternId = Number(patternMatch[1]);
    const field = patternMatch[2];
    const pattern = draft.patterns.find(entry => entry.id === patternId);
    if (!pattern) return '';
    if (field === 'patternId') return pattern.patternId;

    const hourIndex = Number(field.slice(5));
    return pattern.multipliers[hourIndex] ?? '';
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
      compact?: boolean,
      useNativeKeyboard?: boolean,
      disabled?: boolean
    ) => {
      inputHandlersRef.current[fieldId] = onChangeText;

      return (
        <View style={[styles.inputWrapper, compact && { flex: 1 }]}>
          <Text
            style={[
              styles.inputLabel,
              { color: disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
            ]}
          >
            {label}
          </Text>
          <View
            style={[
              compact ? styles.containerCompact : styles.container,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
            <View
              style={[
                styles.innerWhiteContainer,
                { backgroundColor: disabled ? themeColors.blockInput : themeColors.card },
              ]}
            >
              {useNativeKeyboard ? (
                <TextInput
                  style={[
                    styles.input,
                    { color: disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
                  ]}
                  value={value}
                  onChangeText={onChangeText}
                  editable={!disabled}
                  onFocus={() => setActiveInputId(null)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="default"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              ) : (
                <>
                  <Pressable onPress={() => !disabled && setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: disabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
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
    ]
  );

  const isKeyboardOpen = !!activeInputId;
  const controlsDisabled = !draft.enabled;

  const getPatternHourTitle = useCallback((hourIndex: number) => `H${String(hourIndex).padStart(2, '0')}`, []);

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
            {t('axisTemporal.subtitle')}
          </Text>
          <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
            {t('axisTemporal.title')}
          </Text>
        </View>

        <View style={[styles.inputsSection, { backgroundColor: themeColors.card }]}>
          <Pressable
            style={styles.checkboxContainer}
            onPress={() => updateDraftField('enabled', !draft.enabled)}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: draft.enabled ? 'transparent' : themeColors.checkboxMargin,
                  backgroundColor: draft.enabled ? 'rgb(194,254,12)' : 'transparent',
                },
              ]}
            >
              {draft.enabled && <Octicons name="dot-fill" size={14} color="#000000" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {t('axisTemporal.enabled')}
            </Text>
          </Pressable>

          <View style={styles.temporalControls} pointerEvents={draft.enabled ? 'auto' : 'none'}>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: controlsDisabled ? themeColors.textMuted : themeColors.textStrong, fontSize: 18 * fontSizeFactor },
              ]}
            >
              {t('axisTemporal.globalSection')}
            </Text>

            <View style={styles.inputWrapper}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: controlsDisabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('axisTemporal.totalDuration')}
              </Text>
              <View style={styles.fromToRow}>
                {renderInputField(
                  t('axisTemporal.hours'),
                  draft.durationHours,
                  'config-durationHours',
                  text => updateDraftField('durationHours', text),
                  true,
                  false,
                  controlsDisabled
                )}
                {renderInputField(
                  t('axisTemporal.minutes'),
                  draft.durationMinutes,
                  'config-durationMinutes',
                  text => updateDraftField('durationMinutes', text),
                  true,
                  false,
                  controlsDisabled
                )}
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: controlsDisabled ? themeColors.textMuted : themeColors.text, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('axisTemporal.analysisStep')}
              </Text>
              <View style={styles.fromToRow}>
                {renderInputField(
                  t('axisTemporal.hours'),
                  draft.stepHours,
                  'config-stepHours',
                  text => updateDraftField('stepHours', text),
                  true,
                  false,
                  controlsDisabled
                )}
                {renderInputField(
                  t('axisTemporal.minutes'),
                  draft.stepMinutes,
                  'config-stepMinutes',
                  text => updateDraftField('stepMinutes', text),
                  true,
                  false,
                  controlsDisabled
                )}
              </View>
            </View>

            <Text
              style={[
                styles.sectionSubtitle,
                { color: controlsDisabled ? themeColors.textMuted : themeColors.textStrong, fontSize: 18 * fontSizeFactor },
              ]}
            >
              {t('axisTemporal.patternsSection')}
            </Text>

            {draft.patterns.map(pattern => (
              <View key={pattern.id} style={[styles.accessoryBlockMain, { experimental_backgroundImage: themeColors.gradient }]}>
                <View
                  style={[
                    styles.accessoryBlock,
                    { backgroundColor: controlsDisabled ? themeColors.blockInput : themeColors.card },
                  ]}
                >
                  <View style={[styles.accessoryHeader, { marginBottom: 0 }]}>
                    <Text
                      style={[
                        styles.accessoryTitle,
                        { color: controlsDisabled ? themeColors.textMuted : themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {t('axisTemporal.patternCardTitle')} ({pattern.patternId.trim() || t('axisTemporal.unnamedPattern')})
                    </Text>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    {renderInputField(
                      t('axisTemporal.patternIdLabel'),
                      pattern.patternId,
                      `pattern-${pattern.id}-patternId`,
                      text => updatePattern(pattern.id, currentPattern => ({ ...currentPattern, patternId: text })),
                      false,
                      true,
                      controlsDisabled
                    )}

                    {Array.from({ length: 12 }, (_, rowIndex) => {
                      const firstIndex = rowIndex * 2;
                      const secondIndex = firstIndex + 1;

                      return (
                        <View key={`pattern-row-${pattern.id}-${rowIndex}`} style={styles.fromToRow}>
                          {renderInputField(
                            getPatternHourTitle(firstIndex),
                            pattern.multipliers[firstIndex] ?? '',
                            `pattern-${pattern.id}-hour-${String(firstIndex).padStart(2, '0')}`,
                            text =>
                              updatePattern(pattern.id, currentPattern => {
                                const nextMultipliers = [...currentPattern.multipliers];
                                nextMultipliers[firstIndex] = text;
                                return { ...currentPattern, multipliers: nextMultipliers };
                              }),
                            true,
                            false,
                            controlsDisabled
                          )}
                          {renderInputField(
                            getPatternHourTitle(secondIndex),
                            pattern.multipliers[secondIndex] ?? '',
                            `pattern-${pattern.id}-hour-${String(secondIndex).padStart(2, '0')}`,
                            text =>
                              updatePattern(pattern.id, currentPattern => {
                                const nextMultipliers = [...currentPattern.multipliers];
                                nextMultipliers[secondIndex] = text;
                                return { ...currentPattern, multipliers: nextMultipliers };
                              }),
                            true,
                            false,
                            controlsDisabled
                          )}
                        </View>
                      );
                    })}

                    <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                      <Pressable
                        onPress={() => removePattern(pattern.id)}
                        style={[
                          styles.deleteButton,
                          controlsDisabled && { backgroundColor: themeColors.blockInput },
                        ]}
                      >
                        <Icon
                          name="trash"
                          size={18}
                          color={controlsDisabled ? themeColors.textMuted : 'rgb(255, 255, 255)'}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.addButtonRow}>
              <Pressable
                style={[
                  styles.addButton,
                  controlsDisabled && { backgroundColor: themeColors.blockInput },
                ]}
                onPress={addPattern}
              >
                <Icon name="plus" size={24} color={controlsDisabled ? themeColors.textMuted : 'white'} />
              </Pressable>
            </View>
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
    paddingTop: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    fontFamily: 'SFUIDisplay-Medium',
  },
  temporalControls: {
    marginTop: 6,
  },
  temporalDisabled: {
    opacity: 1,
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
  fromToRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
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
  customKeyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
});

export default TemporalAnalysisAxisScreen;
