import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { LanguageContext } from '../../../../contexts/LanguageContext';

type RootStackParamList = {
  SettingsScreen: undefined;
};

const FuenteScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { selectedFontSize, setSelectedFontSize, fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage } = useContext(LanguageContext);

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
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    }
  };

  const colors = themeColors[currentTheme === 'dark' ? 'dark' : 'light'];

  const fontSizes = ['Muy Pequeña', 'Pequeña', 'Normal', 'Grande', 'Muy Grande'] as const;

  const getFontLabel = (sizeKey: string) => {
    if (sizeKey === 'Muy Pequeña') {
      const label = t?.('settings.fontVerySmall');
      return label && typeof label === 'string' ? label : 'Muy Pequeña';
    }
    if (sizeKey === 'Pequeña') {
      const label = t?.('settings.fontSmall');
      return label && typeof label === 'string' ? label : 'Pequeña';
    }
    if (sizeKey === 'Normal') {
      const label = t?.('settings.fontNormal');
      return label && typeof label === 'string' ? label : 'Normal';
    }
    if (sizeKey === 'Grande') {
      const label = t?.('settings.fontLarge');
      return label && typeof label === 'string' ? label : 'Grande';
    }
    if (sizeKey === 'Muy Grande') {
      const label = t?.('settings.fontVeryLarge');
      return label && typeof label === 'string' ? label : 'Muy Grande';
    }
    return sizeKey;
  };

  useEffect(() => {
    const initialAnimatingItems: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    fontSizes.forEach(size => {
      const label = getFontLabel(size);
      initialAnimatingItems[size] = {
        text: label,
        phase: size === selectedFontSize ? 3 : 1,
        font: size === selectedFontSize ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: size === selectedFontSize ? 18 : 16
      };
    });
    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;
    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      fontSizes.forEach(size => {
        const label = getFontLabel(size);
        const prevItem = prev[size];
        if (!prevItem) {
          updated[size] = {
            text: label,
            phase: size === selectedFontSize ? 3 : 1,
            font: size === selectedFontSize ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: size === selectedFontSize ? 18 : 16
          };
        } else {
          updated[size] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, selectedFontSize]);

  useEffect(() => {
    if (initialLoad) return;
    fontSizes.forEach(size => {
      if (size === selectedFontSize && animatingItems[size]?.phase !== 3) {
        startAnimation(size, true);
      } else if (size !== selectedFontSize && animatingItems[size]?.phase === 3) {
        startAnimation(size, false);
      }
    });
  }, [selectedFontSize, initialLoad]);

  const startAnimation = (size: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [size]: {
        ...prev[size],
        phase: phase,
        text: prev[size]?.text || getFontLabel(size)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;

    const animationTimers: NodeJS.Timeout[] = [];

    Object.keys(animatingItems).forEach(size => {
      const item = animatingItems[size];
      const label = getFontLabel(size);

      if (item.phase === 2) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [size]: {
                ...prev[size],
                text: prev[size].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [size]: {
                ...prev[size],
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
            [size]: {
              ...prev[size],
              text: label.substring(0, prev[size].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [size]: {
                ...prev[size],
                text: prev[size].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [size]: {
                ...prev[size],
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
            [size]: {
              ...prev[size],
              text: label.substring(0, prev[size].text.length + 1)
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

  const handleFontSizeSelect = (size: string) => {
    setSelectedFontSize(size);
  };
  
  const handleResetFontSize = () => {
    setSelectedFontSize('Normal');
  };

  const renderOptionItem = (size: string) => {
    const item = animatingItems[size] || {
      text: getFontLabel(size),
      phase: size === selectedFontSize ? 3 : 1,
      font: size === selectedFontSize ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: size === selectedFontSize ? 18 : 16
    };

    return (
      <Pressable 
        key={size}
        onPress={() => handleFontSizeSelect(size)} 
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
        <View style={[styles.optionRight, { backgroundColor: size === selectedFontSize ? colors.accentChip : 'transparent' }]}>
          {selectedFontSize === size && <Icon name="check" size={20} color={colors.checkIcon} />}
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
              onPress={handleResetFontSize}
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
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.font')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('Muy Pequeña')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Pequeña')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Normal')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Grande')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Muy Grande')}
        </View>
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
});

export default FuenteScreen;