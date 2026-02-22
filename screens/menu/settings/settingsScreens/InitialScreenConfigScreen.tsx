import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LanguageContext } from '../../../../contexts/LanguageContext';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';
import { InitialScreenContext } from '../../../../contexts/InitialScreenContext';
import { RootStackParamList } from '../../../../App';

type NavigationProp = StackNavigationProp<RootStackParamList, 'InitialScreenConfigScreen'>;

const InitialScreenConfigScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { selectedLanguage, t } = useContext(LanguageContext);
  const { currentTheme } = useContext(ThemeContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { initialScreen, setInitialScreen } = useContext(InitialScreenContext);
  
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  
  // Referencia para almacenar todos los timers activos
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Función para limpiar todos los timers
  const clearAllTimers = () => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
  };

  // Función segura para crear timers
  const setSafeTimeout = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      // Remover el timer de la referencia cuando se ejecuta
      timersRef.current = timersRef.current.filter(t => t !== timer);
      callback();
    }, delay);
    timersRef.current.push(timer);
    return timer;
  };

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const getInitialScreenLabel = (screenKey: string) => {
    if (screenKey === 'HomeScreen') {
      const label = t?.('settings.initialScreen.home');
      return label && typeof label === 'string' ? label : 'Pantalla Principal';
    }
    if (screenKey === 'FavScreen') {
      const label = t?.('settings.initialScreen.fav');
      return label && typeof label === 'string' ? label : 'Favoritos';
    }
    return screenKey;
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

  const screenKeys = ['HomeScreen', 'FavScreen'] as const;

  useEffect(() => {
    const initialAnimatingItems: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    
    screenKeys.forEach(screenKey => {
      const label = getInitialScreenLabel(screenKey);
      initialAnimatingItems[screenKey] = {
        text: label,
        phase: screenKey === initialScreen ? 3 : 1,
        font: screenKey === initialScreen ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: screenKey === initialScreen ? 18 * fontSizeFactor : 16 * fontSizeFactor
      };
    });

    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;

    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      screenKeys.forEach(screenKey => {
        const label = getInitialScreenLabel(screenKey);
        const prevItem = prev[screenKey];
        if (!prevItem) {
          updated[screenKey] = {
            text: label,
            phase: screenKey === initialScreen ? 3 : 1,
            font: screenKey === initialScreen ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: screenKey === initialScreen ? 18 * fontSizeFactor : 16 * fontSizeFactor
          };
        } else {
          updated[screenKey] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [selectedLanguage, t, initialLoad, initialScreen, fontSizeFactor]);

  useEffect(() => {
    if (initialLoad) return;

    screenKeys.forEach(screenKey => {
      if (screenKey === initialScreen && animatingItems[screenKey]?.phase !== 3) {
        startAnimation(screenKey, true);
      } else if (screenKey !== initialScreen && animatingItems[screenKey]?.phase === 3) {
        startAnimation(screenKey, false);
      }
    });
  }, [initialScreen, initialLoad]);

  const startAnimation = (screenKey: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [screenKey]: {
        ...prev[screenKey],
        phase: phase,
        text: prev[screenKey]?.text || getInitialScreenLabel(screenKey)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;

    // Limpiar timers anteriores antes de crear nuevos
    clearAllTimers();

    Object.keys(animatingItems).forEach(screenKey => {
      const item = animatingItems[screenKey];
      const label = getInitialScreenLabel(screenKey);

      if (item.phase === 2) {
        if (item.text.length > 0) {
          setSafeTimeout(() => {
            setAnimatingItems(prev => {
              if (!prev[screenKey]) return prev;
              return {
                ...prev,
                [screenKey]: {
                  ...prev[screenKey],
                  text: prev[screenKey].text.slice(0, -1)
                }
              };
            });
          }, 5);
        } else {
          setSafeTimeout(() => {
            setAnimatingItems(prev => {
              if (!prev[screenKey]) return prev;
              return {
                ...prev,
                [screenKey]: {
                  ...prev[screenKey],
                  phase: 3,
                  font: 'HomeVideoBold-R90Dv',
                  size: 18 * fontSizeFactor
                }
              };
            });
          }, 5);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        setSafeTimeout(() => {
          setAnimatingItems(prev => {
            if (!prev[screenKey]) return prev;
            return {
              ...prev,
              [screenKey]: {
                ...prev[screenKey],
                text: label.substring(0, prev[screenKey].text.length + 1)
              }
            };
          });
        }, 5);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          setSafeTimeout(() => {
            setAnimatingItems(prev => {
              if (!prev[screenKey]) return prev;
              return {
                ...prev,
                [screenKey]: {
                  ...prev[screenKey],
                  text: prev[screenKey].text.slice(0, -1)
                }
              };
            });
          }, 5);
        } else {
          setSafeTimeout(() => {
            setAnimatingItems(prev => {
              if (!prev[screenKey]) return prev;
              return {
                ...prev,
                [screenKey]: {
                  ...prev[screenKey],
                  phase: 1,
                  font: 'SFUIDisplay-Regular',
                  size: 16 * fontSizeFactor
                }
              };
            });
          }, 5);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        setSafeTimeout(() => {
          setAnimatingItems(prev => {
            if (!prev[screenKey]) return prev;
            return {
              ...prev,
              [screenKey]: {
                ...prev[screenKey],
                text: label.substring(0, prev[screenKey].text.length + 1)
              }
            };
          });
        }, 5);
      }
    });

  }, [animatingItems, initialLoad, selectedLanguage, t, fontSizeFactor]);

  const handleScreenSelect = (screen: string) => {
    setInitialScreen(screen as 'HomeScreen' | 'FavScreen');
  };

  const handleResetScreen = () => {
    setInitialScreen('HomeScreen');
  };

  const renderOptionItem = (screenKey: string) => {
    const item = animatingItems[screenKey] || {
      text: getInitialScreenLabel(screenKey),
      phase: screenKey === initialScreen ? 3 : 1,
      font: screenKey === initialScreen ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: screenKey === initialScreen ? 18 * fontSizeFactor : 16 * fontSizeFactor
    };

    return (
      <Pressable
        key={screenKey}
        onPress={() => handleScreenSelect(screenKey)}
        style={[styles.optionItem, { backgroundColor: 'transparent' }]}
      >
        <View style={styles.optionLeft}>
          <Text
            style={[
              styles.optionText,
              {
                fontFamily: item.font,
                fontSize: item.size,
                color: colors.text
              }
            ]}
          >
            {item.text}
          </Text>
        </View>
        <View style={[styles.optionRight, { backgroundColor: screenKey === initialScreen ? colors.accentChip : 'transparent' }]}>
          {initialScreen === screenKey && <Icon name="check" size={20} color={colors.checkIcon} />}
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
              onPress={handleResetScreen}
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
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.initialScreen.title')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('HomeScreen')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('FavScreen')}
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

export default InitialScreenConfigScreen;