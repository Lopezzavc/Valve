import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { LanguageContext } from '../../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';

type RootStackParamList = {
  SettingsScreen: undefined;
};

const TemaScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { selectedTheme, setSelectedTheme, currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const getThemeLabel = (themeKey: string) => {
    if (themeKey === 'Sistema') {
      const label = t?.('settings.themeSystem');
      return label && typeof label === 'string' ? label : 'Sistema';
    }
    if (themeKey === 'Claro') {
      const label = t?.('settings.themeLight');
      return label && typeof label === 'string' ? label : 'Claro';
    }
    if (themeKey === 'Oscuro') {
      const label = t?.('settings.themeDark');
      return label && typeof label === 'string' ? label : 'Oscuro';
    }
    return themeKey;
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

  const themeKeys = ['Sistema', 'Claro', 'Oscuro'] as const;

  useEffect(() => {
    const initialAnimatingItems: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    
    themeKeys.forEach(themeKey => {
      const label = getThemeLabel(themeKey);
      initialAnimatingItems[themeKey] = {
        text: label,
        phase: themeKey === selectedTheme ? 3 : 1,
        font: themeKey === selectedTheme ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: themeKey === selectedTheme ? 18 * fontSizeFactor : 16 * fontSizeFactor
      };
    });
    
    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;

    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      themeKeys.forEach(themeKey => {
        const label = getThemeLabel(themeKey);
        const prevItem = prev[themeKey];
        if (!prevItem) {
          updated[themeKey] = {
            text: label,
            phase: themeKey === selectedTheme ? 3 : 1,
            font: themeKey === selectedTheme ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: themeKey === selectedTheme ? 18 * fontSizeFactor : 16 * fontSizeFactor
          };
        } else {
          updated[themeKey] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, selectedTheme, fontSizeFactor]);

  useEffect(() => {
    if (initialLoad) return;
    
    themeKeys.forEach(themeKey => {
      if (themeKey === selectedTheme && animatingItems[themeKey]?.phase !== 3) {
        startAnimation(themeKey, true);
      } else if (themeKey !== selectedTheme && animatingItems[themeKey]?.phase === 3) {
        startAnimation(themeKey, false);
      }
    });
  }, [selectedTheme, initialLoad]);

  const startAnimation = (themeKey: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [themeKey]: {
        ...prev[themeKey],
        phase: phase,
        text: prev[themeKey]?.text || getThemeLabel(themeKey)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;
    
    const animationTimers: NodeJS.Timeout[] = [];
    
    Object.keys(animatingItems).forEach(themeKey => {
      const item = animatingItems[themeKey];
      const label = getThemeLabel(themeKey);
      
      if (item.phase === 2) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: {
                ...prev[themeKey],
                text: prev[themeKey].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: {
                ...prev[themeKey],
                phase: 3,
                font: 'HomeVideoBold-R90Dv',
                size: 18 * fontSizeFactor
              }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [themeKey]: {
              ...prev[themeKey],
              text: label.substring(0, prev[themeKey].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: {
                ...prev[themeKey],
                text: prev[themeKey].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: {
                ...prev[themeKey],
                phase: 1,
                font: 'SFUIDisplay-Regular',
                size: 16 * fontSizeFactor
              }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [themeKey]: {
              ...prev[themeKey],
              text: label.substring(0, prev[themeKey].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      }
    });

    return () => {
      animationTimers.forEach(timer => clearTimeout(timer));
    };

  }, [animatingItems, initialLoad, selectedLanguage, t, fontSizeFactor]);

  const handleThemeSelect = (theme: string) => {
    setSelectedTheme(theme);
  };

  const handleResetTheme = () => {
    setSelectedTheme('Claro');
  };

  const renderOptionItem = (themeKey: string) => {
    const item = animatingItems[themeKey] || {
      text: getThemeLabel(themeKey),
      phase: themeKey === selectedTheme ? 3 : 1,
      font: themeKey === selectedTheme ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: themeKey === selectedTheme ? 18 * fontSizeFactor : 16 * fontSizeFactor
    };

    return (
      <Pressable 
        key={themeKey}
        onPress={() => handleThemeSelect(themeKey)} 
        style={[styles.optionItem, { backgroundColor: 'transparent' }]}
      >
        <View style={styles.optionLeft}>
          <Text style={[
            styles.optionText,
            { 
              fontFamily: item.font,
              fontSize: item.size,
              color: colors.text
            }
          ]}>
            {item.text}
          </Text>
        </View>
        <View style={[styles.optionRight, { backgroundColor: themeKey === selectedTheme ? colors.accentChip : 'transparent' }]}>
          {selectedTheme === themeKey && <Icon name="check" size={20} color={colors.checkIcon} />}
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
              onPress={handleResetTheme}
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
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.theme')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('Sistema')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Claro')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Oscuro')}
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

export default TemaScreen;