import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DecimalSeparatorContext } from '../../../../contexts/DecimalSeparatorContext';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { LanguageContext } from '../../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';

type RootStackParamList = {
  SettingsScreen: undefined;
};

const SeparadorDecimalScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { selectedDecimalSeparator, setSelectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const getSeparatorLabel = (key: string) => {
    if (key === 'Punto') {
      const label = t?.('settings.sepDot');
      return label && typeof label === 'string' ? label : 'Punto';
    }
    if (key === 'Coma') {
      const label = t?.('settings.sepComma');
      return label && typeof label === 'string' ? label : 'Coma';
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
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    }
  };

  const colors = themeColors[currentTheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    const initialAnimatingItems: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    const separators = ['Punto', 'Coma'];

    separators.forEach(separator => {
      const label = getSeparatorLabel(separator);
      initialAnimatingItems[separator] = {
        text: label,
        phase: separator === selectedDecimalSeparator ? 3 : 1,
        font: separator === selectedDecimalSeparator ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: separator === selectedDecimalSeparator ? 18 : 16
      };
    });

    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;
    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      ['Punto', 'Coma'].forEach(key => {
        const label = getSeparatorLabel(key);
        const prevItem = prev[key];
        if (!prevItem) {
          updated[key] = {
            text: label,
            phase: key === selectedDecimalSeparator ? 3 : 1,
            font: key === selectedDecimalSeparator ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: key === selectedDecimalSeparator ? 18 : 16
          };
        } else {
          updated[key] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, selectedDecimalSeparator]);

  useEffect(() => {
    if (initialLoad) return;

    const separators = ['Punto', 'Coma'];

    separators.forEach(separator => {
      if (separator === selectedDecimalSeparator && animatingItems[separator]?.phase !== 3) {
        startAnimation(separator, true);
      } else if (separator !== selectedDecimalSeparator && animatingItems[separator]?.phase === 3) {
        startAnimation(separator, false);
      }
    });
  }, [selectedDecimalSeparator, initialLoad]);

  const startAnimation = (separator: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [separator]: {
        ...prev[separator],
        phase: phase,
        text: prev[separator]?.text || getSeparatorLabel(separator)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;

    const animationTimers: NodeJS.Timeout[] = [];

    Object.keys(animatingItems).forEach(key => {
      const item = animatingItems[key];
      const label = getSeparatorLabel(key);

      if (item.phase === 2) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                text: prev[key].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                phase: 3,
                font: 'HomeVideoBold-R90Dv',
                size: 18
              }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              text: label.substring(0, prev[key].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                text: prev[key].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                phase: 1,
                font: 'SFUIDisplay-Regular',
                size: 16
              }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              text: label.substring(0, prev[key].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      }
    });

    return () => {
      animationTimers.forEach(timer => clearTimeout(timer));
    };
  }, [animatingItems, initialLoad, selectedLanguage, t]);

  const handleSeparatorSelect = (separator: string) => {
    setSelectedDecimalSeparator(separator);
  };

  const handleResetSeparator = () => {
    setSelectedDecimalSeparator('Punto');
  };

  const renderOptionItem = (separator: string) => {
    const item = animatingItems[separator] || {
      text: getSeparatorLabel(separator),
      phase: separator === selectedDecimalSeparator ? 3 : 1,
      font: separator === selectedDecimalSeparator ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: separator === selectedDecimalSeparator ? 18 : 16
    };

    return (
      <Pressable
        key={separator}
        onPress={() => handleSeparatorSelect(separator)}
        style={[styles.optionItem, { backgroundColor: 'transparent' }]}
      >
        <View style={styles.optionLeft}>
          <Text style={[
            styles.optionText,
            {
              fontFamily: item.font,
              fontSize: item.size * fontSizeFactor,
              color: colors.text
            }
          ]}>
            {item.text}
          </Text>
        </View>
        <View style={[styles.optionRight, { backgroundColor: separator === selectedDecimalSeparator ? colors.accentChip : 'transparent' }]}>
          {selectedDecimalSeparator === separator && <Icon name="check" size={20} color={colors.checkIcon} />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper2, { experimental_backgroundImage: colors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { experimental_backgroundImage: colors.cardGradient }]}
              onPress={handleResetSeparator}
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
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.sep')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('Punto')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Coma')}
        </View>
      </View>
      <View style={styles.descriptionContainer}>
        <Text style={[styles.descriptionText, { color: colors.descriptionText, fontSize: 14 * fontSizeFactor }]}>
          {t('settings.sepInfo')}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    borderRadius: 10,
    minHeight: 45,
    backgroundColor: 'transparent',
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
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Regular',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 0,
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
  },
});

export default SeparadorDecimalScreen;