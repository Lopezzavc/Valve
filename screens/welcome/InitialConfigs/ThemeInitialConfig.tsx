import React, { useContext, useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { StyleSheet, View, Text, Pressable, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ThemeContext } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../App';
import { useNavigation } from '@react-navigation/native';

type ThemeInitialConfigNavigationProp = StackNavigationProp<RootStackParamList, 'ThemeInitialConfig'>;

const THEME_KEYS = ['Sistema', 'Claro', 'Oscuro'] as const;

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
    resultsPhoto: 'rgba(196, 224, 225, 1)',
    cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
  },
  dark: {
    background: 'rgb(12,12,12)',
    card: 'rgba(24,24,24,1)',
    text: 'rgb(255,255,255)',
    textStrong: 'rgb(250,250,250)',
    separator: 'rgba(255,255,255,0.12)',
    icon: 'rgb(245,245,245)',
    checkIcon: 'rgb(12,12,12)',
    accentChip: 'rgb(194, 254, 12)',
    gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    innerInputs: 'rgba(24,24,24,1)',
    innerInputsChildren: 'rgba(40,40,40,1)',
    resultsPhoto: 'rgba(118, 136, 136, 1)',
    cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
  }
} as const;

type OptionItemProps = {
  themeKey: string;
  isSelected: boolean;
  item: { text: string; font: string; size: number };
  textColor: string;
  accentChip: string;
  onPress: (key: string) => void;
};

const OptionItem = memo(({ themeKey, isSelected, item, textColor, accentChip, onPress }: OptionItemProps) => {
  const handlePress = useCallback(() => onPress(themeKey), [onPress, themeKey]);

  return (
    <Pressable
      key={themeKey}
      onPress={handlePress}
      hitSlop={8}
      style={[styles.optionItem, { backgroundColor: 'transparent' }]}
    >
      <View style={styles.optionLeft}>
        <Animated.Text
          style={[
            styles.optionText,
            {
              fontFamily: item.font,
              fontSize: item.size,
              color: textColor
            }
          ]}
        >
          {item.text}
        </Animated.Text>
      </View>
      <View style={[styles.optionRight, { backgroundColor: isSelected ? accentChip : 'transparent' }]}>
        {isSelected && (
          <Animated.View>
            <Icon name="check" size={20} color={'rgb(0, 0, 0)'} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
});
OptionItem.displayName = 'OptionItem';

const ThemeInitialConfig = () => {
  const navigation = useNavigation<ThemeInitialConfigNavigationProp>();
  const { selectedTheme, setSelectedTheme, currentTheme } = useContext(ThemeContext);
  const [animatingItems, setAnimatingItems] = useState<Record<string, { text: string; phase: number; font: string; size: number }>>({});
  const [initialLoad, setInitialLoad] = useState(true);
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const handleNavigatetoSeparatorInitialConfig = () => {
    navigation.navigate('SeparatorInitialConfig');
  };

  const isDark = currentTheme === 'dark';
  const themeNow = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  const getThemeLabel = useCallback((themeKey: string) => {
    if (themeKey === 'Sistema') return t?.('settings.themeSystem') || 'Sistema';
    if (themeKey === 'Claro') return t?.('settings.themeLight') || 'Claro';
    if (themeKey === 'Oscuro') return t?.('settings.themeDark') || 'Oscuro';
    return themeKey;
  }, [t]);

  const animatedBackgroundColor = themeNow.background;
  const animatedCardColor = themeNow.cardGradient;
  const animatedTextColor = themeNow.text;
  const animatedSeparatorColor = themeNow.separator;
  const animatedInnerInputsColor = themeNow.innerInputs;
  const animatedInnerInputsChildrenColor = themeNow.innerInputsChildren;
  const animatedResultsPhotoColor = themeNow.resultsPhoto;

  useEffect(() => {
    const initialAnimatingItems: Record<string, { text: string; phase: number; font: string; size: number }> = {};
    THEME_KEYS.forEach(themeKey => {
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
      THEME_KEYS.forEach(themeKey => {
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
  }, [selectedLanguage, t, initialLoad, selectedTheme, fontSizeFactor, getThemeLabel]);

  useEffect(() => {
    if (initialLoad) return;
    THEME_KEYS.forEach(themeKey => {
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
              [themeKey]: { ...prev[themeKey], text: prev[themeKey].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: { ...prev[themeKey], phase: 3, font: 'HomeVideoBold-R90Dv', size: 18 * fontSizeFactor }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 3 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [themeKey]: { ...prev[themeKey], text: label.substring(0, prev[themeKey].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(timer);
      } else if (item.phase === 4) {
        if (item.text.length > 0) {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: { ...prev[themeKey], text: prev[themeKey].text.slice(0, -1) }
            }));
          }, 5);
          animationTimers.push(timer);
        } else {
          const timer = setTimeout(() => {
            setAnimatingItems(prev => ({
              ...prev,
              [themeKey]: { ...prev[themeKey], phase: 1, font: 'SFUIDisplay-Regular', size: 16 * fontSizeFactor }
            }));
          }, 5);
          animationTimers.push(timer);
        }
      } else if (item.phase === 1 && item.text.length < label.length) {
        const timer = setTimeout(() => {
          setAnimatingItems(prev => ({
            ...prev,
            [themeKey]: { ...prev[themeKey], text: label.substring(0, prev[themeKey].text.length + 1) }
          }));
        }, 5);
        animationTimers.push(timer);
      }
    });
    return () => { animationTimers.forEach(timer => clearTimeout(timer)); };
  }, [animatingItems, initialLoad, selectedLanguage, t, fontSizeFactor, getThemeLabel]);

  const handleThemeSelect = useCallback((theme: string) => {
    setSelectedTheme(theme);
  }, [setSelectedTheme]);

  const renderOptionItem = useCallback((themeKey: string) => {
    const item = animatingItems[themeKey] || {
      text: getThemeLabel(themeKey),
      phase: themeKey === selectedTheme ? 3 : 1,
      font: themeKey === selectedTheme ? 'HomeVideoBold-R90Dv' : 'SFUIDisplay-Regular',
      size: themeKey === selectedTheme ? 18 * fontSizeFactor : 16 * fontSizeFactor
    };
    return (
      <OptionItem
        key={themeKey}
        themeKey={themeKey}
        isSelected={selectedTheme === themeKey}
        item={{ text: item.text, font: item.font, size: item.size }}
        textColor={animatedTextColor}
        accentChip={themeNow.accentChip}
        onPress={handleThemeSelect}
      />
    );
  }, [animatingItems, animatedTextColor, selectedTheme, fontSizeFactor, handleThemeSelect, getThemeLabel, themeNow.accentChip]);

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
                  <Animated.View style={[styles.resultsPhoto, { backgroundColor: animatedResultsPhotoColor }]} />
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
            Selecciona el <Text style={styles.lovelaceText}>tema</Text> de la aplicación
          </Animated.Text>
        </View>

        <View style={[styles.optionsContainerMain, { experimental_backgroundImage: themeNow.gradient }]}>
          <Animated.View style={[styles.optionsContainer, { experimental_backgroundImage: animatedCardColor }]}>
            {renderOptionItem('Sistema')}
            <Animated.View style={[styles.separator, { backgroundColor: animatedSeparatorColor }]} />
            {renderOptionItem('Claro')}
            <Animated.View style={[styles.separator, { backgroundColor: animatedSeparatorColor }]} />
            {renderOptionItem('Oscuro')}
          </Animated.View>
        </View>

        <View style={styles.containerNextButton}>
          <Pressable style={styles.NextButton} onPress={handleNavigatetoSeparatorInitialConfig}>
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
    marginTop: 40,
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
    fontFamily: 'SFUIDisplay-Regular',
  },
  separator: {
    height: 1,
    marginVertical: 0,
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
    marginTop: 25,
    borderRadius: 25,
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

export default ThemeInitialConfig;