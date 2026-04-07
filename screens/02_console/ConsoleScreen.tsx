import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Text, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';
import Decimal from 'decimal.js';

import type { RootStackParamList } from '../../App';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { DecimalSeparatorContext } from '../../contexts/DecimalSeparatorContext';

type NavigationProp = StackNavigationProp<RootStackParamList, 'ConsoleScreen'>;
type ConsoleRouteProp = RouteProp<RootStackParamList, 'ConsoleScreen'>;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

const detectRepeatingDecimal = (value: string): string | null => {
  const normalized = value.trim();
  const sign = normalized.startsWith('-') ? '-' : '';
  const unsigned = sign ? normalized.slice(1) : normalized;

  if (!unsigned.includes('.')) return null;

  const [integerPart, decimalPart] = unsigned.split('.');
  if (!decimalPart || decimalPart.length < 6) return null;

  for (let prefixLength = 0; prefixLength <= 2; prefixLength += 1) {
    for (let patternLength = 1; patternLength <= 3; patternLength += 1) {
      if (prefixLength + patternLength * 3 > decimalPart.length) continue;

      const prefix = decimalPart.slice(0, prefixLength);
      const repeating = decimalPart.slice(prefixLength, prefixLength + patternLength);
      const rest = decimalPart.slice(prefixLength);
      const expanded = repeating
        .repeat(Math.ceil(rest.length / patternLength))
        .slice(0, rest.length);

      if (rest.slice(0, -1) === expanded.slice(0, -1)) {
        const compactDecimal = `${prefix}${repeating}`.charAt(0) || '0';
        return `${sign}${integerPart}.${compactDecimal}~`;
      }
    }
  }

  return null;
};

const getProcedureDecimals = (value: string): number => {
  const normalized = value.trim().replace('-', '');
  const decimalPart = normalized.split('.')[1];

  if (!decimalPart) return 5;

  const firstTen = decimalPart.slice(0, 10);
  const firstFive = firstTen.slice(0, 5);

  if (firstFive.length < 5) return 5;

  const firstDigit = firstFive.charAt(0);
  const firstFiveAreEqual = firstFive.split('').every((digit) => digit === firstDigit);
  const remainingDigits = firstTen.slice(5);
  const changesAfterFive = remainingDigits.split('').some((digit) => digit !== firstDigit);

  return firstFiveAreEqual && changesAfterFive ? 10 : 5;
};

const TYPING_CHAR_DELAY_MS = 10;
const TYPING_STAGE_PAUSE_MS = 500;
const TYPING_INITIAL_DELAY_MS = 120;
const COMMAND_BLOCK_SPACER_HEIGHT = 10;

const ConsoleScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConsoleRouteProp>();
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);

  const reynoldsData = route.params?.reynoldsData;
  const [openedAt] = useState(() => new Date());
  const [typedInputsCommand, setTypedInputsCommand] = useState('');
  const [typedProcedureCommand, setTypedProcedureCommand] = useState('');
  const [typedResultCommand, setTypedResultCommand] = useState('');
  const [showInputsBlock, setShowInputsBlock] = useState(false);
  const [showProcedureBlock, setShowProcedureBlock] = useState(false);
  const [showResultBlock, setShowResultBlock] = useState(false);

  const applyDecimalSeparator = useMemo(() => {
    return (value: string) => (
      selectedDecimalSeparator === 'Coma' ? value.replace(/\./g, ',') : value
    );
  }, [selectedDecimalSeparator]);

  const trimDecimalValue = useMemo(() => {
    return (value: string, maxDecimals: number) => {
      const repeating = detectRepeatingDecimal(value);
      if (repeating) return repeating;

      try {
        return new Decimal(value).toDecimalPlaces(maxDecimals).toString();
      } catch {
        return value;
      }
    };
  }, []);

  const formatExpressionDecimals = useMemo(() => {
    return (expression: string) => (
      expression.replace(NUMBER_PATTERN, (match) => trimDecimalValue(match, getProcedureDecimals(match)))
    );
  }, [trimDecimalValue]);

  const openedAtText = useMemo(() => openedAt.toLocaleString(), [openedAt]);

  const shellCommand = useMemo(
    () => `${t('reynoldsCalc.console.shell.app')}:~ ${t('reynoldsCalc.console.shell.calculator')}$ ${t('reynoldsCalc.console.shell.command')}`,
    [t]
  );

  const inputsCommand = useMemo(
    () => `${t('reynoldsCalc.console.shell.print')} ${t('reynoldsCalc.console.shell.calculator')}$ ${t('reynoldsCalc.console.shell.inputs')}`,
    [t]
  );

  const procedureCommand = useMemo(
    () => `${t('reynoldsCalc.console.shell.print')} ${t('reynoldsCalc.console.shell.calculator')}$ ${t('reynoldsCalc.console.shell.procedure')}`,
    [t]
  );

  const resultCommand = useMemo(
    () => `${t('reynoldsCalc.console.shell.print')} ${t('reynoldsCalc.console.shell.calculator')}$ ${t('reynoldsCalc.console.shell.result')}`,
    [t]
  );

  useEffect(() => {
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;

    const sleep = (ms: number) => new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        timeouts.delete(timeoutId);
        resolve();
      }, ms);
      timeouts.add(timeoutId);
    });

    const typeLine = async (text: string, setText: (value: string) => void) => {
      setText('');
      for (let i = 1; i <= text.length; i += 1) {
        if (cancelled) return;
        setText(text.slice(0, i));
        await sleep(TYPING_CHAR_DELAY_MS);
      }
    };

    const runSequence = async () => {
      setTypedInputsCommand('');
      setTypedProcedureCommand('');
      setTypedResultCommand('');
      setShowInputsBlock(false);
      setShowProcedureBlock(false);
      setShowResultBlock(false);

      if (!reynoldsData) {
        return;
      }

      await sleep(TYPING_INITIAL_DELAY_MS);
      if (cancelled) return;

      await typeLine(inputsCommand, setTypedInputsCommand);
      if (cancelled) return;
      setShowInputsBlock(true);

      await sleep(TYPING_STAGE_PAUSE_MS);
      if (cancelled) return;

      await typeLine(procedureCommand, setTypedProcedureCommand);
      if (cancelled) return;
      setShowProcedureBlock(true);

      await sleep(TYPING_STAGE_PAUSE_MS);
      if (cancelled) return;

      await typeLine(resultCommand, setTypedResultCommand);
      if (cancelled) return;
      setShowResultBlock(true);
    };

    runSequence();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [inputsCommand, procedureCommand, resultCommand, reynoldsData]);

  const colors = currentTheme === 'dark'
    ? {
        shellBorder: 'rgba(255, 255, 255, 0.25)',
        shellBackground: 'rgb(10, 10, 10)',
        shellGlow: 'rgba(255, 255, 255, 0.08)',
        chrome: 'rgb(22, 22, 22)',
        prompt: 'rgb(255, 255, 255)',
        text: 'rgb(255, 255, 255)',
        dim: 'rgba(255, 255, 255, 0.55)',
        divider: 'rgba(255, 255, 255, 0.15)',
      }
    : {
        shellBorder: 'rgba(255, 255, 255, 0.2)',
        shellBackground: 'rgb(8, 8, 8)',
        shellGlow: 'rgba(255, 255, 255, 0.05)',
        chrome: 'rgb(18, 18, 18)',
        prompt: 'rgb(255, 255, 255)',
        text: 'rgb(255, 255, 255)',
        dim: 'rgba(255, 255, 255, 0.55)',
        divider: 'rgba(255, 255, 255, 0.12)',
      };

  const renderPrompt = (symbol: string, content: string, subdued?: boolean) => (
    <View style={styles.line}>
      <Text
        style={[
          styles.prompt,
          {
            width: symbol ? 18 : 0,
            color: subdued ? colors.dim : colors.prompt,
            fontSize: 14 * fontSizeFactor,
          },
        ]}
      >
        {symbol}
      </Text>
      <Text
        style={[
          styles.lineText,
          {
            color: subdued ? colors.dim : colors.text,
            fontSize: 14 * fontSizeFactor,
          },
        ]}
      >
        {content}
      </Text>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable style={styles.iconContainer} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.shell,
            {
              borderColor: colors.shellBorder,
              backgroundColor: colors.shellBackground,
              shadowColor: colors.shellGlow,
            },
          ]}
        >
          <View style={[styles.windowBar, { backgroundColor: colors.chrome, borderBottomColor: colors.divider }]}>
            <View style={styles.windowControls}>
              <View style={[styles.windowDot, { backgroundColor: 'rgb(255, 95, 86)' }]} />
              <View style={[styles.windowDot, { backgroundColor: 'rgb(255, 189, 46)' }]} />
              <View style={[styles.windowDot, { backgroundColor: 'rgb(39, 201, 63)' }]} />
            </View>
          </View>

          <View style={styles.consoleBody}>
            {renderPrompt('', openedAtText, true)}
            {renderPrompt('', shellCommand)}
          </View>

          <View style={styles.consoleContent}>
            {typedInputsCommand !== '' && renderPrompt('$', typedInputsCommand)}
            {typedInputsCommand !== '' && <View style={{ height: COMMAND_BLOCK_SPACER_HEIGHT }} />}

            {showInputsBlock && reynoldsData && (
              <>
                {renderPrompt('>', t('reynoldsCalc.console.sectionInputs'))}
                {reynoldsData.presetFluid !== 'custom' &&
                  renderPrompt(
                    '',
                    `${t('reynoldsCalc.labels.presetFluids')}: ${t(`reynoldsCalc.fluids.${reynoldsData.presetFluid}`)}`,
                    true
                  )}
                {reynoldsData.inputs.map((input) => (
                  <View key={`${input.labelKey}-${input.symbol}`}>
                    {renderPrompt(
                      '',
                      `${t(input.labelKey)} [${input.symbol}] = ${applyDecimalSeparator(input.value)} ${input.unit}${input.derived ? ` (${t('reynoldsCalc.console.derived')})` : ''}`
                    )}
                  </View>
                ))}

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              </>
            )}

            {typedProcedureCommand !== '' && renderPrompt('$', typedProcedureCommand)}
            {typedProcedureCommand !== '' && <View style={{ height: COMMAND_BLOCK_SPACER_HEIGHT }} />}

            {showProcedureBlock && reynoldsData && (
              <>
                {renderPrompt('>', t('reynoldsCalc.console.sectionProcedure'))}
                {reynoldsData.steps.map((step) => (
                  <View key={`${step.titleKey}-${step.expression}`} style={styles.stepBlock}>
                    {renderPrompt('', t(step.titleKey))}
                    {renderPrompt(' ', applyDecimalSeparator(formatExpressionDecimals(step.expression)), true)}
                  </View>
                ))}

                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              </>
            )}

            {typedResultCommand !== '' && renderPrompt('$', typedResultCommand)}
            {typedResultCommand !== '' && <View style={{ height: COMMAND_BLOCK_SPACER_HEIGHT }} />}

            {showResultBlock && reynoldsData && (
              <>
                {renderPrompt('>', t('reynoldsCalc.console.sectionResult'))}
                {renderPrompt(
                  '',
                  `${t('reynoldsCalc.reynoldsNumber')} = ${applyDecimalSeparator(trimDecimalValue(reynoldsData.result.value, 10))}`
                )}
                {reynoldsData.result.regimeKey !== 'reynoldsCalc.reynolds' &&
                  renderPrompt('', t(reynoldsData.result.regimeKey), true)}
              </>
            )}

            {!reynoldsData && (
              <View style={styles.emptyState}>
                {renderPrompt('', '', true)}
                {renderPrompt(' ', '', true)}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgb(0, 0, 0)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45,
    backgroundColor: 'transparent',
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  iconWrapper: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  shell: {
    minHeight: 320,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: 0,
  },
  windowBar: {
    height: 38,
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  windowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  windowDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  consoleBody: {
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  consoleContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  prompt: {
    width: 18,
    fontFamily: 'SFMonoRegular',
    lineHeight: 18,
  },
  lineText: {
    flex: 1,
    fontFamily: 'SFMonoRegular',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginBottom: 20,
    marginHorizontal: 0,
  },
  stepBlock: {
    marginBottom: 4,
    paddingHorizontal: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 0,
  },
});

export default ConsoleScreen;
