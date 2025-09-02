import React, { useContext, useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { StyleSheet, View, Text, Pressable, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import { ThemeContext } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../App';
import { useNavigation } from '@react-navigation/native';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { Slider } from '@miblanchard/react-native-slider';

type ThemeInitialConfigNavigationProp = StackNavigationProp<RootStackParamList, 'PrecisionInitialConfig'>;

const PRECISION_KEYS = ['Normal', 'Fix', 'Científica', 'Ingeniería'] as const;

const thumbLight = require('../../../assets/LiquidGlassSimulation/thumbSliderWhite.png');
const thumbDark = require('../../../assets/LiquidGlassSimulation/thumbSliderBlack.png');

const THEME_COLORS = {
  light: {
    background: 'rgba(255, 255, 255, 1)',
    card: 'rgba(255, 255, 255, 1)',
    text: 'rgb(0, 0, 0)',
    textStrong: 'rgb(0, 0, 0)',
    separator: 'rgb(235, 235, 235)',
    icon: 'rgb(0, 0, 0)',
    checkIcon: 'rgb(0, 0, 0)',
    accentChip: 'rgb(194, 254, 12)',
    gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    innerInputs: 'rgba(255, 255, 255, 1)',
    innerInputsChildren: 'rgba(245, 245, 245, 1)',
    descriptionText: 'rgb(170, 170, 170)',
    sliderTrack: 'rgb(228,228,228)',
  },
  dark: {
    background: 'rgb(12,12,12)',
    card: 'rgba(24,24,24,1)',
    text: 'rgb(235,235,235)',
    textStrong: 'rgb(250,250,250)',
    separator: 'rgba(255,255,255,0.12)',
    icon: 'rgb(245,245,245)',
    checkIcon: 'rgb(12,12,12)',
    accentChip: 'rgb(194, 254, 12)',
    gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    innerInputs: 'rgba(24,24,24,1)',
    innerInputsChildren: 'rgba(40,40,40,1)',
    descriptionText: 'rgba(85, 85, 85, 1)',
    sliderTrack: 'rgba(255,255,255,0.12)',
  }
} as const;

type OptionItemProps = {
  precisionKey: string;
  isSelected: boolean;
  item: { text: string; font: string; size: number };
  textColor: string;
  accentChip: string;
  sliderTrack: string;
  onPress: (key: string) => void;
  decimalCountFixed: number;
  setDecimalCountFixed: (count: number) => void;
  decimalCountScientific: number;
  setDecimalCountScientific: (count: number) => void;
  decimalCountEngineering: number;
  setDecimalCountEngineering: (count: number) => void;
  currentTheme: string;
  fontSizeFactor: number;
};

const OptionItem = memo(({
  precisionKey,
  isSelected,
  item,
  textColor,
  accentChip,
  sliderTrack,
  onPress,
  decimalCountFixed,
  setDecimalCountFixed,
  decimalCountScientific,
  setDecimalCountScientific,
  decimalCountEngineering,
  setDecimalCountEngineering,
  currentTheme,
  fontSizeFactor
}: OptionItemProps) => {
  const handlePress = useCallback(() => onPress(precisionKey), [onPress, precisionKey]);

  const formatExampleNumber = (num: number, mode: string, decimals: number): string => {
    const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    const toSuperscript = (num: number): string => {
      const isNegative = num < 0;
      const numStr = Math.abs(num).toString();
      return (isNegative ? '⁻' : '') + numStr.split('').map(digit => superscriptDigits[parseInt(digit)]).join('');
    };

    switch (mode) {
      case 'normal':
        return num.toFixed(10).replace(/\.?0+$/, '');
      case 'fixed':
        return num.toFixed(decimals);
      case 'scientific': {
        if (num === 0) return '0';
        const exponent = Math.floor(Math.log10(Math.abs(num)));
        const mantissa = num / Math.pow(10, exponent);
        return `${mantissa.toFixed(decimals)} × 10${toSuperscript(exponent)}`;
      }
      case 'engineering': {
        if (num === 0) return '0';
        let exponent = Math.floor(Math.log10(Math.abs(num)));
        let remainder = exponent % 3;
        if (remainder < 0) {
          remainder += 3;
        }
        exponent -= remainder;
        const mantissa = num / Math.pow(10, exponent);
        return `${mantissa.toFixed(decimals)} × 10${toSuperscript(exponent)}`;
      }
      default:
        return num.toString();
    }
  };

  return (
    <Pressable
      key={precisionKey}
      onPress={handlePress}
      hitSlop={8}
      style={[styles.optionItem, { backgroundColor: 'transparent' }]}
    >
      <View style={precisionKey === 'Normal' ? styles.NormalContainer : styles.FixedContainer}>
        <View style={styles.titleOptionContainer}>
          <Text style={[
            styles.titleOption,
            {
              fontFamily: item.font,
              fontSize: item.size,
              color: textColor
            }
          ]}>
            {item.text}
          </Text>
        </View>
        <View style={[styles.ExampleContainer, styles.exampleContainerWithCheck]}>
          <Text style={[
            styles.NumberExample,
            {
              color: textColor,
              fontSize: 20 * fontSizeFactor
            }
          ]}>
            {formatExampleNumber(
              38041.920231719201905,
              precisionKey === 'Normal' ? 'normal' :
              precisionKey === 'Fix' ? 'fixed' :
              precisionKey === 'Científica' ? 'scientific' : 'engineering',
              precisionKey === 'Normal' ? 0 :
              precisionKey === 'Fix' ? decimalCountFixed :
              precisionKey === 'Científica' ? decimalCountScientific : decimalCountEngineering
            )}
          </Text>
          {isSelected && (
            <View style={[styles.checkIconContainer, { backgroundColor: accentChip }]}>
              <Icon name="check" size={20} color={'rgb(0, 0, 0)'} />
            </View>
          )}
        </View>
        {precisionKey !== 'Normal' && (
          <View style={styles.sliderContainer}>
            <Slider
              containerStyle={styles.sliderContainer2}
              minimumValue={1}
              maximumValue={12}
              minimumTrackTintColor="rgb(194, 254, 12)"
              maximumTrackTintColor={sliderTrack}
              thumbImage={currentTheme === 'dark' ? thumbDark : thumbLight}
              thumbStyle={styles.thumbStyle}
              value={
                precisionKey === 'Fix' ? decimalCountFixed :
                precisionKey === 'Científica' ? decimalCountScientific : decimalCountEngineering
              }
              onValueChange={(value) => {
                if (precisionKey === 'Fix') {
                  setDecimalCountFixed(value[0] as number);
                } else if (precisionKey === 'Científica') {
                  setDecimalCountScientific(value[0] as number);
                } else {
                  setDecimalCountEngineering(value[0] as number);
                }
              }}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
});
OptionItem.displayName = 'OptionItem';

const PrecisionInitialConfig = () => {
  const navigation = useNavigation<ThemeInitialConfigNavigationProp>();
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, { text: string; phase: number; font: string; size: number }>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const {
    selectedPrecision,
    setSelectedPrecision,
    decimalCountFixed,
    setDecimalCountFixed,
    decimalCountScientific,
    setDecimalCountScientific,
    decimalCountEngineering,
    setDecimalCountEngineering,
    formatNumber
  } = useContext(PrecisionDecimalContext);

  const handleNavigatetoNext = () => {
    navigation.navigate('MainTabs');
  };

  const isDark = currentTheme === 'dark';
  const themeNow = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  const getPrecisionLabel = useCallback((precisionKey: string) => {
    if (precisionKey === 'Normal') {
      const label = t?.('settings.preNormal');
      return label && typeof label === 'string' ? label : 'Normal';
    }
    if (precisionKey === 'Fix') {
      const label = t?.('settings.preFix');
      return label && typeof label === 'string' ? label : 'Fix';
    }
    if (precisionKey === 'Científica') {
      const label = t?.('settings.preScientific');
      return label && typeof label === 'string' ? label : 'Científica';
    }
    if (precisionKey === 'Ingeniería') {
      const label = t?.('settings.preEngineering');
      return label && typeof label === 'string' ? label : 'Ingeniería';
    }
    return precisionKey;
  }, [t]);

  const animatedBackgroundColor = themeNow.background;
  const animatedCardColor = themeNow.card;
  const animatedTextColor = themeNow.text;
  const animatedSeparatorColor = themeNow.separator;
  const animatedInnerInputsColor = themeNow.innerInputs;
  const animatedInnerInputsChildrenColor = themeNow.innerInputsChildren;

  useEffect(() => {
    const initialAnimatingItems: Record<string, { text: string; phase: number; font: string; size: number }> = {};
    PRECISION_KEYS.forEach(precisionKey => {
      const label = getPrecisionLabel(precisionKey);
      initialAnimatingItems[precisionKey] = {
        text: label,
        phase: precisionKey === selectedPrecision ? 3 : 1,
        font: precisionKey === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: precisionKey === selectedPrecision ? 18 * fontSizeFactor : 16 * fontSizeFactor
      };
    });
    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;
    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      PRECISION_KEYS.forEach(precisionKey => {
        const label = getPrecisionLabel(precisionKey);
        const prevItem = prev[precisionKey];
        if (!prevItem) {
          updated[precisionKey] = {
            text: label,
            phase: precisionKey === selectedPrecision ? 3 : 1,
            font: precisionKey === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: precisionKey === selectedPrecision ? 18 * fontSizeFactor : 16 * fontSizeFactor
          };
        } else {
          updated[precisionKey] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, selectedPrecision, fontSizeFactor, getPrecisionLabel]);

  useEffect(() => {
    if (initialLoad) return;
    PRECISION_KEYS.forEach(precisionKey => {
      if (precisionKey === selectedPrecision && animatingItems[precisionKey]?.phase !== 3) {
        startAnimation(precisionKey, true);
      } else if (precisionKey !== selectedPrecision && animatingItems[precisionKey]?.phase === 3) {
        startAnimation(precisionKey, false);
      }
    });
  }, [selectedPrecision, initialLoad]);

  const startAnimation = (precisionKey: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [precisionKey]: {
        ...prev[precisionKey],
        phase: phase,
        text: prev[precisionKey]?.text || getPrecisionLabel(precisionKey)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;
    const animationTimers: NodeJS.Timeout[] = [];
    Object.keys(animatingItems).forEach(precisionKey => {
      const item = animatingItems[precisionKey];
      const label = getPrecisionLabel(precisionKey);
      if (item.phase === 2) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [precisionKey]: { ...prev[precisionKey], text: prev[precisionKey].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [precisionKey]: { ...prev[precisionKey], phase: 3, font: 'HomeVideoBold-R90Dv', size: 18 * fontSizeFactor }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [precisionKey]: { ...prev[precisionKey], text: label.substring(0, prev[precisionKey].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [precisionKey]: { ...prev[precisionKey], text: prev[precisionKey].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [precisionKey]: { ...prev[precisionKey], phase: 1, font: 'SFUIDisplay-Regular', size: 16 * fontSizeFactor }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [precisionKey]: { ...prev[precisionKey], text: label.substring(0, prev[precisionKey].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(timer);
      }
    });
    return () => { animationTimers.forEach(timer => clearTimeout(timer)); };
  }, [animatingItems, initialLoad, selectedLanguage, t, fontSizeFactor, getPrecisionLabel]);

  const handlePrecisionSelect = useCallback((precision: string) => {
    setSelectedPrecision(precision);
  }, [setSelectedPrecision]);

  const renderOptionItem = useCallback((precisionKey: string) => {
    const item = animatingItems[precisionKey] || {
      text: getPrecisionLabel(precisionKey),
      phase: precisionKey === selectedPrecision ? 3 : 1,
      font: precisionKey === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: precisionKey === selectedPrecision ? 18 * fontSizeFactor : 16 * fontSizeFactor
    };
    return (
      <OptionItem
        key={precisionKey}
        precisionKey={precisionKey}
        isSelected={selectedPrecision === precisionKey}
        item={{ text: item.text, font: item.font, size: item.size }}
        textColor={animatedTextColor}
        accentChip={themeNow.accentChip}
        sliderTrack={themeNow.sliderTrack}
        onPress={handlePrecisionSelect}
        decimalCountFixed={decimalCountFixed}
        setDecimalCountFixed={setDecimalCountFixed}
        decimalCountScientific={decimalCountScientific}
        setDecimalCountScientific={setDecimalCountScientific}
        decimalCountEngineering={decimalCountEngineering}
        setDecimalCountEngineering={setDecimalCountEngineering}
        currentTheme={currentTheme}
        fontSizeFactor={fontSizeFactor}
      />
    );
  }, [animatingItems, animatedTextColor, selectedPrecision, fontSizeFactor, handlePrecisionSelect, getPrecisionLabel, themeNow.accentChip, themeNow.sliderTrack, decimalCountFixed, setDecimalCountFixed, decimalCountScientific, setDecimalCountScientific, decimalCountEngineering, setDecimalCountEngineering, currentTheme]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = 1000;
    const fadeInDuration = 500;
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim]);

  const sampleNumber = useMemo(() => {
    const base = formatNumber(12341.234);
    return selectedDecimalSeparator === 'Coma' ? base.replace(/\./g, ',') : base;
  }, [formatNumber, selectedDecimalSeparator]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: animatedBackgroundColor}]}>
      <Animated.View style={[styles.container, { backgroundColor: animatedBackgroundColor, opacity: fadeAnim }]}>
        <View style={[styles.topContainer, { experimental_backgroundImage: themeNow.gradient }]}>
          <View style={styles.ContainerApp}>
            <View style={styles.bg}>
              <View style={styles.header}>
                <View style={styles.headerLeft}></View>
                <View style={styles.headerRightContainer}>
                  <View style={styles.headerRight}></View>
                  <View style={styles.headerRight}></View>
                </View>
              </View>
              <View style={styles.titles}>
                <View style={styles.subtitle}/>
                <View style={styles.title}/>
              </View>
              <View style={styles.results}>
                <View style={styles.resultsMain}>
                  <View style={styles.resultsPhoto}>
                    <Text
                      style={{
                        fontFamily: 'SFUIDisplay-Bold',
                        fontSize: 30 * fontSizeFactor,
                        textAlign: 'center',
                        color: 'black',
                      }}
                    >
                      {sampleNumber}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.circularButtons}>
                <View style={styles.buttonContainer}>
                  <View style={styles.Buttons}/>
                  <View style={styles.buttonText}/>
                </View>
                <View style={styles.buttonContainer}>
                  <View style={styles.Buttons}/>
                  <View style={styles.buttonText}/>
                </View>
                <View style={styles.buttonContainer}>
                  <View style={styles.Buttons}/>
                  <View style={styles.buttonText}/>
                </View>
                <View style={styles.buttonContainer}>
                  <View style={styles.Buttons}/>
                  <View style={styles.buttonText}/>
                </View>
              </View>
              <Animated.View style={[styles.innerInputsContainer, { backgroundColor: animatedInnerInputsColor }]}>
                <Animated.View style={[styles.inputsText, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                <Animated.View style={[styles.inputsText2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                <View style={styles.inputContainerInner}>
                  <Animated.View style={[styles.inputsMain, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  <Animated.View style={[styles.inputs2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                </View>
                <Animated.View style={[styles.inputsText3, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                <View style={styles.inputContainerInner}>
                  <Animated.View style={[styles.inputsMain, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  <Animated.View style={[styles.inputs2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                </View>
                <View style={styles.section2}>
                  <Animated.View style={[styles.inputsTextSection2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  <Animated.View style={[styles.inputsText2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  <View style={styles.inputContainerInner}>
                    <Animated.View style={[styles.inputsMain, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                    <Animated.View style={[styles.inputs2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  </View>
                  <Animated.View style={[styles.inputsText3, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  <View style={styles.inputContainerInner}>
                    <Animated.View style={[styles.inputsMain, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                    <Animated.View style={[styles.inputs2, { backgroundColor: animatedInnerInputsChildrenColor }]}/>
                  </View>
                </View>
              </Animated.View>
            </View>
          </View>
        </View>

        <View style={styles.languageContainer}>
          <Animated.Text style={[styles.languageText, { color: animatedTextColor }]}>
            Selecciona la <Text style={styles.lovelaceText}>precisión decimal</Text> de los valores
          </Animated.Text>
        </View>

        <View style={[styles.optionsContainerMain, { experimental_backgroundImage: themeNow.gradient }]}>
          <Animated.View style={[styles.optionsContainer, { backgroundColor: animatedCardColor }]}>
            {renderOptionItem('Normal')}
            <Animated.View style={[styles.separator, { backgroundColor: animatedSeparatorColor }]} />
            {renderOptionItem('Fix')}
            <Animated.View style={[styles.separator, { backgroundColor: animatedSeparatorColor }]} />
            {renderOptionItem('Científica')}
            <Animated.View style={[styles.separator, { backgroundColor: animatedSeparatorColor }]} />
            {renderOptionItem('Ingeniería')}
          </Animated.View>
        </View>

        <View style={styles.containerNextButton}>
          <Pressable style={styles.NextButton} onPress={handleNavigatetoNext}>
            <Text style={styles.NextText}>Siguiente</Text>
            <View style={styles.IconContainer}>
              <Icon name="chevron-right" size={20} color={'rgb(0, 0, 0)'} />
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  thumbStyle: {
    height: 24,
    width: 40,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleOptionContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingTop: 5,
    minHeight: 40,
    marginTop: 0,
  },
  titleOption: {
    fontSize: 16,
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Regular',
    marginBottom: 0,
  },
  ExampleContainer: {
    backgroundColor: 'transparent',
    marginTop: -10,
  },
  NumberExample: {
    fontSize: 20,
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Regular',
  },
  sliderContainer: {
    backgroundColor: 'transparent',
  },
  sliderContainer2: {
    backgroundColor: 'transparent',
    height: 30,
    marginBottom: 5,
  },
  NormalContainer: {
    backgroundColor: 'transparent',
  },
  FixedContainer: {
    backgroundColor: 'transparent',
  },
  containerNextButton: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 40,
    marginBottom: 30,
    marginHorizontal: 20,
  },
  NextText: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
  },
  IconContainer: {
    height: 40,
    width: 40,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  NextButton: {
    height: 40,
    backgroundColor: 'rgb(194, 254, 12)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: 15,
  },
  topContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 80,
    borderRadius: 25,
    padding: 1,
  },
  ContainerApp: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 24,
    overflow: 'hidden'
  },
  optionsContainerMain: {
    padding: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    marginVertical: 0,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    alignSelf: 'stretch',
  },
  languageContainer: {
    backgroundColor: 'transparent',
    marginVertical: 30,
    marginHorizontal: 20,
  },
  languageText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 26,
    textAlign: 'center',
    marginVertical: 0,
    lineHeight: 25,
  },
  lovelaceText: {
    fontFamily: 'fonnts.com-lovelace-italic',
  },
  optionsContainer: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  optionItem: {
    padding: 0,
  },
  exampleContainerWithCheck: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Regular',
  },
  separator: {
    height: 1,
    marginTop: 5,
  },
  checkIconContainer: {
    backgroundColor: 'rgb(194, 254, 12)',
  },
  bg: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    height: 35,
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRightContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  headerLeft: {
    height: 35,
    width: 52.5,
    backgroundColor: 'rgb(60, 60, 60)',
    borderRadius: 25,
  },
  headerRight: {
    height: 35,
    width: 35,
    backgroundColor: 'rgb(60, 60, 60)',
    borderRadius: 25,
  },
  titles: {
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 15,
    gap: 8,
  },
  subtitle: {
    height: 15,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  title: {
    height: 21,
    width: 290,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  results: {
    backgroundColor: 'transparent',
    marginVertical: 24,
    marginHorizontal: 20,
  },
  resultsMain: {
    backgroundColor: 'rgba(60, 60, 60, 1)',
    height: 115,
    borderRadius: 25,
  },
  resultsPhoto: {
    flex: 1,
    backgroundColor: 'rgba(196, 224, 225, 1)',
    marginTop: 25,
    borderRadius: 25,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: 15,
    paddingBottom: 5,
  },
  circularButtons: {
    backgroundColor: 'transparent',
    marginHorizontal: 62,
    marginTop: -4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  Buttons: {
    height: 53,
    width: 53,
    backgroundColor: 'rgba(60, 60, 60, 1)',
    borderRadius: 100,
  },
  buttonText: {
    height: 10,
    width: 50,
    marginTop: -5,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  innerInputsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    width: '100%',
    flex: 1,
    marginTop: 22,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingTop: 30,
  },
  inputsText: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 170,
  },
  inputsTextSection2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 190,
  },
  inputsText2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 70,
    marginTop: 16,
  },
  inputsText3: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 180,
    marginTop: 16,
  },
  inputContainerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputsMain: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 49,
    marginTop: 8,
    width: '68%',
    borderRadius: 100,
  },
  inputs2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 49,
    marginTop: 8,
    width: '29%',
    borderRadius: 100,
  },
  section2: {
    marginTop: 40,
  },
});

export default PrecisionInitialConfig;