import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LanguageContext } from '../../../../contexts/LanguageContext';
import { ThemeContext } from '../../../../contexts/ThemeContext';
import { FontSizeContext } from '../../../../contexts/FontSizeContext';

type RootStackParamList = {
  SettingsScreen: undefined;
};

const IdiomaScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { selectedLanguage, setSelectedLanguage } = useContext(LanguageContext);
  const { currentTheme } = useContext(ThemeContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, {text: string, phase: number, font: string, size: number}>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage: appLanguage } = useContext(LanguageContext);

  const getLanguageLabel = (langKey: string) => {
    if (langKey === 'Español') {
      const label = t?.('settings.langSpanish');
      return label && typeof label === 'string' ? label : 'Español';
    }
    if (langKey === 'Inglés') {
      const label = t?.('settings.langEnglish');
      return label && typeof label === 'string' ? label : 'Inglés';
    }
    if (langKey === 'Francés') {
      const label = t?.('settings.langFrench');
      return label && typeof label === 'string' ? label : 'Francés';
    }
    if (langKey === 'Alemán') {
      const label = t?.('settings.langGerman');
      return label && typeof label === 'string' ? label : 'Alemán';
    }
    if (langKey === 'Chino') {
      const label = t?.('settings.langChinese');
      return label && typeof label === 'string' ? label : 'Chino';
    }
    if (langKey === 'Japonés') {
      const label = t?.('settings.langJapanese');
      return label && typeof label === 'string' ? label : 'Japonés';
    }
    return langKey;
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

  const languageKeys = ['Español', 'Inglés', 'Francés', 'Alemán', 'Chino', 'Japonés'] as const;

  useEffect(() => {
    const initialAnimatingItems: Record<string, {text: string, phase: number, font: string, size: number}> = {};
    
    languageKeys.forEach(langKey => {
      const label = getLanguageLabel(langKey);
      initialAnimatingItems[langKey] = {
        text: label,
        phase: langKey === selectedLanguage ? 3 : 1,
        font: langKey === selectedLanguage ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
        size: langKey === selectedLanguage ? 18 * fontSizeFactor : 16 * fontSizeFactor
      };
    });

    setAnimatingItems(initialAnimatingItems);
    setInitialLoad(false);
  }, []);

  useEffect(() => {
    if (initialLoad) return;

    setAnimatingItems(prev => {
      const updated: typeof prev = { ...prev };
      languageKeys.forEach(langKey => {
        const label = getLanguageLabel(langKey);
        const prevItem = prev[langKey];
        if (!prevItem) {
          updated[langKey] = {
            text: label,
            phase: langKey === selectedLanguage ? 3 : 1,
            font: langKey === selectedLanguage ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
            size: langKey === selectedLanguage ? 18 * fontSizeFactor : 16 * fontSizeFactor
          };
        } else {
          updated[langKey] = { ...prevItem, text: label };
        }
      });
      return updated;
    });
  }, [appLanguage, t, initialLoad, selectedLanguage, fontSizeFactor]);

  useEffect(() => {
    if (initialLoad) return;

    languageKeys.forEach(langKey => {
      if (langKey === selectedLanguage && animatingItems[langKey]?.phase !== 3) {
        startAnimation(langKey, true);
      } else if (langKey !== selectedLanguage && animatingItems[langKey]?.phase === 3) {
        startAnimation(langKey, false);
      }
    });
  }, [selectedLanguage, initialLoad]);

  const startAnimation = (language: string, isSelected: boolean) => {
    let phase = isSelected ? 2 : 4;
    setAnimatingItems(prev => ({
      ...prev,
      [language]: {
        ...prev[language],
        phase: phase,
        text: prev[language]?.text || getLanguageLabel(language)
      }
    }));
  };

  useEffect(() => {
    if (initialLoad) return;

    const animationTimers: NodeJS.Timeout[] = [];

    Object.keys(animatingItems).forEach(langKey => {
      const item = animatingItems[langKey];
      const label = getLanguageLabel(langKey);

      if (item.phase === 2) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [langKey]: {
                ...prev[langKey],
                text: prev[langKey].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [langKey]: {
                ...prev[langKey],
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
            [langKey]: {
              ...prev[langKey],
              text: label.substring(0, prev[langKey].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [langKey]: {
                ...prev[langKey],
                text: prev[langKey].text.slice(0, -1)
              }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [langKey]: {
                ...prev[langKey],
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
            [langKey]: {
              ...prev[langKey],
              text: label.substring(0, prev[langKey].text.length + 1)
            }
          }));
        }, 5);
        animationTimers.push(timer);
      }
    });

    return () => {
      animationTimers.forEach(timer => clearTimeout(timer));
    };
  }, [animatingItems, initialLoad, appLanguage, t, fontSizeFactor]);

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleResetLanguage = () => {
    setSelectedLanguage('Español');
  };

  const renderOptionItem = (language: string) => {
    const item = animatingItems[language] || {
      text: getLanguageLabel(language),
      phase: language === selectedLanguage ? 3 : 1,
      font: language === selectedLanguage ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: language === selectedLanguage ? 18 * fontSizeFactor : 16 * fontSizeFactor
    };

    return (
      <Pressable
        key={language}
        onPress={() => handleLanguageSelect(language)}
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
        <View style={[styles.optionRight, { backgroundColor: language === selectedLanguage ? colors.accentChip : 'transparent' }]}>
          {selectedLanguage === language && <Icon name="check" size={20} color={colors.checkIcon} />}
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
              onPress={handleResetLanguage}
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
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.language')}</Text>
      </View>
      <View style={[styles.optionsContainerMain, { experimental_backgroundImage: colors.gradient }]}>
        <View style={[styles.optionsContainer, { experimental_backgroundImage: colors.cardGradient }]}>
          {renderOptionItem('Español')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Inglés')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Francés')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Alemán')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Chino')}
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          {renderOptionItem('Japonés')}
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

export default IdiomaScreen;