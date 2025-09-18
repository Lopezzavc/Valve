import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { PrecisionDecimalContext } from '../../../../contexts/PrecisionDecimalContext';
import { Slider } from '@miblanchard/react-native-slider';
import { LanguageContext } from '../../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';

type RootStackParamList = {
  SettingsScreen: undefined;
};

const thumbLight = require('../../../../assets/LiquidGlassSimulation/thumbSliderWhite.png');
const thumbDark = require('../../../../assets/LiquidGlassSimulation/thumbSliderBlack.png');

const PrecisionDecimalScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
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
  } = useContext(PrecisionDecimalContext);

  const getPrecisionLabel = (key: string) => {
    if (key === 'Normal') {
      const label = t?.('settings.preNormal');
      return label && typeof label === 'string' ? label : 'Normal';
    }
    if (key === 'Fix') {
      const label = t?.('settings.preFix');
      return label && typeof label === 'string' ? label : 'Fix';
    }
    if (key === 'Científica') {
      const label = t?.('settings.preScientific');
      return label && typeof label === 'string' ? label : 'Científica';
    }
    if (key === 'Ingeniería') {
      const label = t?.('settings.preEngineering');
      return label && typeof label === 'string' ? label : 'Ingeniería';
    }
    return key;
  };

  const themeColors = {
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
      descriptionText: 'rgb(170, 170, 170)',
      sliderTrack: 'rgb(228,228,228)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    },
    dark: {
      background: 'rgb(12,12,12)',
      card: 'rgb(24,24,24)',
      text: 'rgb(235,235,235)',
      textStrong: 'rgb(250,250,250)',
      separator: 'rgba(255,255,255,0.12)',
      icon: 'rgb(245,245,245)',
      checkIcon: 'rgb(12,12,12)',
      accentChip: 'rgb(194, 254, 12)',
      gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
      descriptionText: 'rgba(85, 85, 85, 1)',
      sliderTrack: 'rgba(255,255,255,0.12)',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    }
  };

  const colors = themeColors[currentTheme === 'dark' ? 'dark' : 'light'];

  const precisionOptions = ['Normal', 'Fix', 'Científica', 'Ingeniería'] as const;

  useEffect(() => {
    const initialAnimating: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    precisionOptions.forEach(option => {
      const label = getPrecisionLabel(option);
      initialAnimating[option] = {
        text: label,
        phase: option === selectedPrecision ? 3 : 1,
        font: option === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: option === selectedPrecision ? 18 : 16
      };
    });
    setAnimatingItems(initialAnimating);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;
    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      precisionOptions.forEach(option => {
        const label = getPrecisionLabel(option);
        const prevItem = prev[option];
        if (!prevItem) {
          updated[option] = {
            text: label,
            phase: option === selectedPrecision ? 3 : 1,
            font: option === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: option === selectedPrecision ? 18 : 16
          };
        } else {
          updated[option] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, selectedPrecision]);

  useEffect(() => {
    if (initialLoad) return;
    precisionOptions.forEach(option => {
      if (option === selectedPrecision && animatingItems[option]?.phase !== 3) {
        startAnimation(option, true);
      } else if (option !== selectedPrecision && animatingItems[option]?.phase === 3) {
        startAnimation(option, false);
      }
    });
  }, [selectedPrecision, initialLoad]);

  const startAnimation = (option: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [option]: {
        ...prev[option],
        phase: phase,
        text: prev[option]?.text || getPrecisionLabel(option)
      }
    }));
  };

  const handlePrecisionSelect = (precision: string) => {
    setSelectedPrecision(precision);
  };

  const handleResetPrecision = () => {
    setSelectedPrecision('Normal');
    setDecimalCountFixed(12);
    setDecimalCountScientific(5);
    setDecimalCountEngineering(5);
  };

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

  const renderOptionItem = (option: string) => {
    const item = animatingItems[option] || {
      text: getPrecisionLabel(option),
      phase: option === selectedPrecision ? 3 : 1,
      font: option === selectedPrecision ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: option === selectedPrecision ? 18 : 16
    };

    const label = getPrecisionLabel(option);

    return (
      <Pressable
        key={option}
        onPress={() => handlePrecisionSelect(option)}
        style={styles.optionItem}
      >
        <View style={option === 'Normal' ? styles.NormalContainer : styles.FixedContainer}>
          <View style={styles.titleOptionContainer}>
            <Text style={[
              styles.titleOption,
              {
                fontFamily: item.font,
                fontSize: item.size * fontSizeFactor,
                color: colors.text
              }
            ]}>
              {item.text}
            </Text>
          </View>
          <View style={[styles.ExampleContainer, styles.exampleContainerWithCheck]}>
            <Text style={[
              styles.NumberExample,
              {
                color: colors.text,
                fontSize: 20 * fontSizeFactor
              }
            ]}>
              {formatExampleNumber(
                38041.920231719201905,
                option === 'Normal' ? 'normal' :
                option === 'Fix' ? 'fixed' :
                option === 'Científica' ? 'scientific' : 'engineering',
                option === 'Normal' ? 0 :
                option === 'Fix' ? decimalCountFixed :
                option === 'Científica' ? decimalCountScientific : decimalCountEngineering
              )}
            </Text>
            {selectedPrecision === option && (
              <View style={[styles.checkIconContainer, { backgroundColor: colors.accentChip }]}>
                <Icon name="check" size={20} color={colors.checkIcon} />
              </View>
            )}
          </View>
          {option !== 'Normal' && (
            <View style={styles.sliderContainer}>
              <Slider
                containerStyle={styles.sliderContainer2}
                minimumValue={1}
                maximumValue={12}
                minimumTrackTintColor="rgb(194, 254, 12)"
                maximumTrackTintColor={colors.sliderTrack}
                thumbImage={currentTheme === 'dark' ? thumbDark : thumbLight}
                thumbStyle={styles.thumbStyle}
                value={
                  option === 'Fix' ? decimalCountFixed :
                  option === 'Científica' ? decimalCountScientific : decimalCountEngineering
                }
                onValueChange={(value) => {
                  if (option === 'Fix') {
                    setDecimalCountFixed(value[0] as number);
                  } else if (option === 'Científica') {
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
  };

  useEffect(() => {
    if (initialLoad) return;

    const animationTimers: NodeJS.Timeout[] = [];

    Object.keys(animatingItems).forEach((option) => {
      const item = animatingItems[option];
      const label = getPrecisionLabel(option);

      if (item.phase === 2) {
        if (item.text.length > 0) {
          const tmr = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [option]: { ...prev[option], text: prev[option].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(tmr);
        } else {
          const tmr = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [option]: { ...prev[option], phase: 3, font: 'HomeVideoBold-R90Dv', size: 18 }
            }));
          }, 5);
          animationTimers.push(tmr);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        const tmr = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [option]: { ...prev[option], text: label.substring(0, prev[option].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(tmr);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const tmr = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [option]: { ...prev[option], text: prev[option].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(tmr);
        } else {
          const tmr = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [option]: { ...prev[option], phase: 1, font: 'SFUIDisplay-Regular', size: 16 }
            }));
          }, 5);
          animationTimers.push(tmr);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        const tmr = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [option]: { ...prev[option], text: label.substring(0, prev[option].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(tmr);
      }
    });

    return () => {
      animationTimers.forEach(t => clearTimeout(t));
    };
  }, [animatingItems, initialLoad, selectedLanguage, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper2, { experimental_backgroundImage: colors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { experimental_backgroundImage: colors.cardGradient }]}
              onPress={handleResetPrecision}
            >
              <Icon name="refresh-cw" size={20} color={colors.icon} />
            </Pressable>
          </View>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: colors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { experimental_backgroundImage: colors.cardGradient }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-down" size={22} color={colors.icon} />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: colors.text, fontSize: 18 * fontSizeFactor }]}>{t('settings.title')}</Text>
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.pre')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('Normal')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Fix')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Científica')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Ingeniería')}
        </View>
      </View>

      <View style={styles.descriptionContainer}>
        <Text style={[styles.descriptionText, { color: colors.descriptionText, fontSize: 14 * fontSizeFactor }]}>
          {t('settings.preInfo1')}
        </Text>
        <Text style={[styles.descriptionText, { color: colors.descriptionText, fontSize: 14 * fontSizeFactor }]}>
          {t('settings.preInfo2')}
        </Text>
        <Text style={[styles.descriptionText, { color: colors.descriptionText, fontSize: 14 * fontSizeFactor }]}>
          {t('settings.preInfo3')}
        </Text>
        <Text style={[styles.descriptionText, { color: colors.descriptionText, fontSize: 14 * fontSizeFactor }]}>
          {t('settings.preInfo4')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(255, 255, 255)',
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
  },
  NormalContainer: {
    backgroundColor: 'transparent',
  },
  FixedContainer: {
    backgroundColor: 'transparent',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 45,
    marginTop: 30,
    backgroundColor: 'transparent',
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
    paddingHorizontal: 20,
    marginBottom: 10,
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
  optionsContainerMain: {
    padding: 1,
    marginHorizontal: 20,
    marginVertical: 0,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  optionsContainer: {
    backgroundColor: 'rgb(255, 255, 255)',
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 0,
    backgroundColor: 'transparent',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionText: {
    fontSize: 16,
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Regular',
  },
  exampleText: {
    fontSize: 24,
    color: 'rgba(0, 0, 0, 1)',
    fontFamily: 'SFUIDisplay-Regular',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 5,
  },
  checkIconContainer: {
    backgroundColor: 'rgb(194, 254, 12)',
  },
  descriptionContainer: {
    marginTop: 20,
    marginHorizontal: 30,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgb(170, 170, 170)',
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 15,
    marginBottom: 10,
  },
});

export default PrecisionDecimalScreen;