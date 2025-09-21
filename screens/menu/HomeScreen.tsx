import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, LayoutChangeEvent } from 'react-native';
import { Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../contexts/ThemeContext';
import MathView from 'react-native-math-view';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';

type RootStackParamList = {
  InfoScreen: undefined;
  SearchScreen: undefined;
  ContinuidadCalc: undefined;
  BernoulliCalc: undefined;
  ReynoldsCalc: undefined;
  ColebrookCalc: undefined;
};

const BAR_WIDTH = 4;
const RIGHT_OFFSET = 7;
const LEFT_TARGET = 7;

const HomeScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const preloadOnceRef = useRef<Promise<void> | null>(null);

  const startPreloadContinuidad = () => {
    if (preloadOnceRef.current) return;
    preloadOnceRef.current = (async () => {
      try {
        await import('../calculators/Continuidad/ContinuidadCalc');

        const { default: FastImage } = await import('@d11/react-native-fast-image');
        const bg = Image.resolveAssetSource(require('../../../assets/CardsCalcs/cardbg.png')).uri;
        FastImage.preload([{ uri: bg }]);

        const Icon = (await import('react-native-vector-icons/Feather')).default;
        const IconFavorite = (await import('react-native-vector-icons/FontAwesome')).default;
        await Promise.all([
          Icon.getImageSource('chevron-left', 22),
          Icon.getImageSource('terminal', 22),
          IconFavorite.getImageSource('heart-o', 20),
        ]);

        const dbSvc = await import('../../src/services/database');
        const db = await dbSvc.getDBConnection();
        await Promise.all([dbSvc.createTable(db), dbSvc.createFavoritesTable(db)]);

        await dbSvc.isFavorite(db, 'ContinuidadCalc');
      } catch {
      }
    })();
  };

  const { currentTheme } = useTheme();
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        textDesc: 'rgba(135, 135, 135, 1)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      textDesc: 'rgba(120, 120, 120, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
    };
  }, [currentTheme]);

  const [currentText, setCurrentText] = useState('Valve');
  const [currentFont, setCurrentFont] = useState('SFUIDisplay-Medium');
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (phase === 1) {
        setPhase(2);
      } else if (phase === 3) {
        setPhase(4);
      } else if (phase === 5) {
        setPhase(2);
      }
    }, 5000);

  return () => clearTimeout(timer);
}, [phase]);

  useEffect(() => {
    if (phase === 2) {
      if (currentText.length > 0) {
        const timer = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1));
        }, 100);
        return () => clearTimeout(timer);
      } else {
        setCurrentFont('HomeVideoBold-R90Dv');
        setPhase(3);
        setCurrentText('');
      }
    } else if (phase === 3) {
      const fullText = 'Valve';
      if (currentText.length < fullText.length) {
        const timer = setTimeout(() => {
          setCurrentText(fullText.substring(0, currentText.length + 1));
        }, 100);
        return () => clearTimeout(timer);
      }
    } else if (phase === 4) {
      if (currentText.length > 0) {
        const timer = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1));
        }, 100);
        return () => clearTimeout(timer);
      } else {
        setCurrentFont('SFUIDisplay-Medium');
        setPhase(5);
        setCurrentText('');
      }
    } else if (phase === 5) {
      const fullText = 'Valve';
      if (currentText.length < fullText.length) {
        const timer = setTimeout(() => {
          setCurrentText(fullText.substring(0, currentText.length + 1));
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentText, phase]);

  const [boxW, setBoxW] = useState(0);
  const [open, setOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const animListenerIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);

  const barToLeftDelta = useMemo(() => {
    if (boxW <= 0) return 0;
    return LEFT_TARGET - (boxW - RIGHT_OFFSET - BAR_WIDTH);
  }, [boxW]);

  const contentW = useMemo(() => Math.max(0, boxW - 40), [boxW]);

  const onLayoutInner = (e: LayoutChangeEvent) => {
    setBoxW(e.nativeEvent.layout.width);
  };

  const removeAnimListener = () => {
    if (animListenerIdRef.current) {
      translateX.removeListener(animListenerIdRef.current);
      animListenerIdRef.current = null;
    }
  };

  const toggleCard = () => {
    const toValue = open ? 0 : barToLeftDelta;
    const isOpening = !open;

    if (isOpening) {
      startPreloadContinuidad
      hasNavigatedRef.current = false;
      removeAnimListener();

      const threshold = Math.abs(toValue) * 0.98;
      animListenerIdRef.current = translateX.addListener(({ value }) => {
        if (!hasNavigatedRef.current && Math.abs(value) >= Math.abs(threshold)) {
          hasNavigatedRef.current = true;
          removeAnimListener();
          navigation.navigate('ContinuidadCalc');
        }
      });
    } else {
      removeAnimListener();
      hasNavigatedRef.current = false;
    }

    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 15,
      tension: 30,
    }).start();

    setOpen(isOpening);
  };

  const [boxW2, setBoxW2] = useState(0);
  const [open2, setOpen2] = useState(false);
  const translateX2 = useRef(new Animated.Value(0)).current;

  const animListenerIdRef2 = useRef<string | null>(null);
  const hasNavigatedRef2 = useRef(false);

  const barToLeftDelta2 = useMemo(() => {
    if (boxW2 <= 0) return 0;
    return LEFT_TARGET - (boxW2 - RIGHT_OFFSET - BAR_WIDTH);
  }, [boxW2]);

  const contentW2 = useMemo(() => Math.max(0, boxW2 - 40), [boxW2]);

  const onLayoutInner2 = (e: LayoutChangeEvent) => {
    setBoxW2(e.nativeEvent.layout.width);
  };

  const removeAnimListener2 = () => {
    if (animListenerIdRef2.current) {
      translateX2.removeListener(animListenerIdRef2.current);
      animListenerIdRef2.current = null;
    }
  };

  const toggleCard2 = () => {
    const toValue = open2 ? 0 : barToLeftDelta2;
    const isOpening = !open2;

    if (isOpening) {
      hasNavigatedRef2.current = false;
      removeAnimListener2();

      const threshold = Math.abs(toValue) * 0.98;
      animListenerIdRef2.current = translateX2.addListener(({ value }) => {
        if (!hasNavigatedRef2.current && Math.abs(value) >= Math.abs(threshold)) {
          hasNavigatedRef2.current = true;
          removeAnimListener2();
          navigation.navigate('BernoulliCalc');
        }
      });
    } else {
      removeAnimListener2();
      hasNavigatedRef2.current = false;
    }

    Animated.spring(translateX2, {
      toValue,
      useNativeDriver: true,
      friction: 15,
      tension: 30,
    }).start();

    setOpen2(isOpening);
  };

  const [boxW3, setBoxW3] = useState(0);
  const [open3, setOpen3] = useState(false);
  const translateX3 = useRef(new Animated.Value(0)).current;

  const animListenerIdRef3 = useRef<string | null>(null);
  const hasNavigatedRef3 = useRef(false);

  const barToLeftDelta3 = useMemo(() => {
    if (boxW3 <= 0) return 0;
    return LEFT_TARGET - (boxW3 - RIGHT_OFFSET - BAR_WIDTH);
  }, [boxW3]);

  const contentW3 = useMemo(() => Math.max(0, boxW3 - 40), [boxW3]);

  const onLayoutInner3 = (e: LayoutChangeEvent) => {
    setBoxW3(e.nativeEvent.layout.width);
  };

  const removeAnimListener3 = () => {
    if (animListenerIdRef3.current) {
      translateX3.removeListener(animListenerIdRef3.current);
      animListenerIdRef3.current = null;
    }
  };

  const toggleCard3 = () => {
    const toValue = open3 ? 0 : barToLeftDelta3;
    const isOpening = !open3;

    if (isOpening) {
      hasNavigatedRef3.current = false;
      removeAnimListener3();

      const threshold = Math.abs(toValue) * 0.98;
      animListenerIdRef3.current = translateX3.addListener(({ value }) => {
        if (!hasNavigatedRef3.current && Math.abs(value) >= Math.abs(threshold)) {
          hasNavigatedRef3.current = true;
          removeAnimListener3();
          navigation.navigate('ReynoldsCalc');
        }
      });
    } else {
      removeAnimListener3();
      hasNavigatedRef3.current = false;
    }

    Animated.spring(translateX3, {
      toValue,
      useNativeDriver: true,
      friction: 15,
      tension: 30,
    }).start();

    setOpen3(isOpening);
  };

  const [boxW4, setBoxW4] = useState(0);
  const [open4, setOpen4] = useState(false);
  const translateX4 = useRef(new Animated.Value(0)).current;

  const animListenerIdRef4 = useRef<string | null>(null);
  const hasNavigatedRef4 = useRef(false);

  const barToLeftDelta4 = useMemo(() => {
    if (boxW4 <= 0) return 0;
    return LEFT_TARGET - (boxW4 - RIGHT_OFFSET - BAR_WIDTH);
  }, [boxW4]);

  const contentW4 = useMemo(() => Math.max(0, boxW4 - 40), [boxW4]);

  const onLayoutInner4 = (e: LayoutChangeEvent) => {
    setBoxW4(e.nativeEvent.layout.width);
  };

  const removeAnimListener4 = () => {
    if (animListenerIdRef4.current) {
      translateX4.removeListener(animListenerIdRef4.current);
      animListenerIdRef4.current = null;
    }
  };

  const toggleCard4 = () => {
    const toValue = open4 ? 0 : barToLeftDelta4;
    const isOpening = !open4;

    if (isOpening) {
      hasNavigatedRef4.current = false;
      removeAnimListener4();

      const threshold = Math.abs(toValue) * 0.98;
      animListenerIdRef4.current = translateX4.addListener(({ value }) => {
        if (!hasNavigatedRef4.current && Math.abs(value) >= Math.abs(threshold)) {
          hasNavigatedRef4.current = true;
          removeAnimListener4();
          navigation.navigate('ColebrookCalc');
        }
      });
    } else {
      removeAnimListener4();
      hasNavigatedRef4.current = false;
    }

    Animated.spring(translateX4, {
      toValue,
      useNativeDriver: true,
      friction: 15,
      tension: 30,
    }).start();

    setOpen4(isOpening);
  };

  const [focusKey, setFocusKey] = useState(0);
  const [focusKey2, setFocusKey2] = useState(0);
  const [focusKey3, setFocusKey3] = useState(0);
  const [focusKey4, setFocusKey4] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      if (animListenerIdRef.current) {
        translateX.removeListener(animListenerIdRef.current);
        animListenerIdRef.current = null;
      }
      hasNavigatedRef.current = false;
      setOpen(false);

      translateX.stopAnimation?.(() => {
        translateX.setValue(0);
      });
      setFocusKey((k) => k + 1);

      if (animListenerIdRef2.current) {
        translateX2.removeListener(animListenerIdRef2.current);
        animListenerIdRef2.current = null;
      }
      hasNavigatedRef2.current = false;
      setOpen2(false);
      translateX2.stopAnimation?.(() => {
        translateX2.setValue(0);
      });
      setFocusKey2((k) => k + 1);

      if (animListenerIdRef3.current) {
        translateX3.removeListener(animListenerIdRef3.current);
        animListenerIdRef3.current = null;
      }
      hasNavigatedRef3.current = false;
      setOpen3(false);
      translateX3.stopAnimation?.(() => {
        translateX3.setValue(0);
      });
      setFocusKey3((k) => k + 1);

      if (animListenerIdRef4.current) {
        translateX4.removeListener(animListenerIdRef4.current);
        animListenerIdRef4.current = null;
      }
      hasNavigatedRef4.current = false;
      setOpen4(false);
      translateX4.stopAnimation?.(() => {
        translateX4.setValue(0);
      });
      setFocusKey4((k) => k + 1);

      return () => {

      };
    }, [translateX, translateX2, translateX3, translateX4])
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.valveTextPlaceholder}>
          {currentText.length > 0 && (
            <Text
              style={[
                styles.valveText,
                { fontFamily: currentFont, color: themeColors.textStrong },
              ]}
            >
              {currentText}
            </Text>
          )}
        </View>
        <View style={styles.rightIconsContainer}>
          <Pressable
            style={styles.simpleButtonContainer}
            onPress={() => navigation.navigate('SearchScreen')}
          >
            <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
            <MaskedView
              style={styles.maskedButton}
              maskElement={<View style={styles.transparentButtonMask} />}
            >
              <View
                style={[
                  styles.buttonGradient,
                  { experimental_backgroundImage: themeColors.gradient },
                ]}
              />
            </MaskedView>
            <Icon name="search" size={22} color={themeColors.icon} style={styles.buttonIcon} />
          </Pressable>

          <Pressable
            style={styles.simpleButtonContainer2}
            onPress={() => navigation.navigate('InfoScreen')}
          >
            <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
            <MaskedView
              style={styles.maskedButton2}
              maskElement={<View style={styles.transparentButtonMask2} />}
            >
              <View
                style={[
                  styles.buttonGradient2,
                  { experimental_backgroundImage: themeColors.gradient },
                ]}
              />
            </MaskedView>
            <Icon name="plus" size={22} color={themeColors.icon} style={styles.buttonIcon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.titlesContainerCalc}>
        <Text
          style={[
            styles.subtitleCalc,
            { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
          ]}
        >
          {t('home.calculatorsTitle')}
        </Text>
        <Text
          style={[
            styles.titleCalc,
            { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor },
          ]}
        >
          {t('home.pressureDuctsTitle')}
        </Text>
      </View>

      <View style={styles.preCardSubtitleWrap}>
        <Text
          style={[
            styles.preCardSubtitleBase,
            { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
          ]}
        >
          <Text style={[styles.preCardEssential, { fontSize: 18 * fontSizeFactor }]}>{t('mainMenu.subtitleEssential')}</Text>
          <Text> - </Text>
          <Text style={[styles.preCardMF, { fontSize: 18 * fontSizeFactor }]}>{t('mainMenu.subtitle1')}</Text>
        </Text>
      </View>


      <View style={styles.buttonContainer}>
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <Pressable
            style={[
              stylesRef.contentBox,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
            onPress={toggleCard}
          >
            <View
              style={[
                stylesRef.innerBox,
                { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient },
              ]}
              onLayout={onLayoutInner}
            >
              <Animated.View
                style={[stylesRef.textsContainer, { transform: [{ translateX }] }]}
              >
                <View>
                  <View style={stylesRef.titleContainerRef}>
                    <Text
                      style={[
                        stylesRef.titleText,
                        { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardTitle1')}
                    </Text>
                  </View>
                  <View style={stylesRef.descContainer}>
                    <Text
                      style={[
                        stylesRef.subtitleText,
                        { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardDesc1')}
                    </Text>
                  </View>
                </View>

                {boxW > 0 && (
                  <View
                    style={[
                      stylesRef.helloPane,
                      { left: -barToLeftDelta, width: contentW },
                    ]}
                  >
                    <View style={stylesRef.containerEq}>
                      <MathView math="A_{1} v_{1} = A_{2} v_{2}" style={{ color: themeColors.text }} />
                    </View>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                key={`bar-${focusKey}`}
                style={[stylesRef.verticalBar, { transform: [{ translateX }] }]}
              />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <Pressable
            style={[
              stylesRef.contentBox,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
            onPress={toggleCard2}
          >
            <View
              style={[
                stylesRef.innerBox,
                { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient },
              ]}
              onLayout={onLayoutInner2}
            >
              <Animated.View
                style={[stylesRef.textsContainer, { transform: [{ translateX: translateX2 }] }]}
              >
                <View>
                  <View style={stylesRef.titleContainerRef}>
                    <Text
                      style={[
                        stylesRef.titleText,
                        { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardTitle2')}
                    </Text>
                  </View>
                  <View style={stylesRef.descContainer}>
                    <Text
                      style={[
                        stylesRef.subtitleText,
                        { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardDesc2')}
                    </Text>
                  </View>
                </View>

                {boxW2 > 0 && (
                  <View
                    style={[
                      stylesRef.helloPane,
                      { left: -barToLeftDelta2, width: contentW2 },
                    ]}
                  >
                    <View style={stylesRef.containerEq2}>
                      <MathView
                        math="P + \frac{1}{2}\rho v^{2} + \rho g h = \text{cte}"
                        style={{ color: themeColors.text }}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                key={`bar2-${focusKey2}`}
                style={[stylesRef.verticalBar, { transform: [{ translateX: translateX2 }] }]}
              />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.SEPARATOR}></View>

      <View style={styles.buttonContainer}>
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <Pressable
            style={[
              stylesRef.contentBox,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
            onPress={toggleCard3}
          >
            <View
              style={[
                stylesRef.innerBox,
                { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient },
              ]}
              onLayout={onLayoutInner3}
            >
              <Animated.View
                style={[stylesRef.textsContainer, { transform: [{ translateX: translateX3 }] }]}
              >
                <View>
                  <View style={stylesRef.titleContainerRef}>
                    <Text
                      style={[
                        stylesRef.titleText,
                        { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardTitle3')}
                    </Text>
                  </View>
                  <View style={stylesRef.descContainer}>
                    <Text
                      style={[
                        stylesRef.subtitleText,
                        { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardDesc3')}
                    </Text>
                  </View>
                </View>

                {boxW3 > 0 && (
                  <View
                    style={[
                      stylesRef.helloPane,
                      { left: -barToLeftDelta3, width: contentW3 },
                    ]}
                  >
                    <View style={stylesRef.containerEq3}>
                      <MathView
                        math="Re = \frac{\rho v D}{\mu}"
                        style={{ color: themeColors.text }}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                key={`bar3-${focusKey3}`}
                style={[stylesRef.verticalBar, { transform: [{ translateX: translateX3 }] }]}
              />
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <Pressable
            style={[
              stylesRef.contentBox,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
            onPress={toggleCard4}
          >
            <View
              style={[
                stylesRef.innerBox,
                { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient },
              ]}
              onLayout={onLayoutInner4}
            >
              <Animated.View
                style={[stylesRef.textsContainer, { transform: [{ translateX: translateX4 }] }]}
              >
                <View>
                  <View style={stylesRef.titleContainerRef}>
                    <Text
                      style={[
                        stylesRef.titleText,
                        { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardTitle4')}
                    </Text>
                  </View>
                  <View style={stylesRef.descContainer}>
                    <Text
                      style={[
                        stylesRef.subtitleText,
                        { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor },
                      ]}
                    >
                      {t('calc.cardDesc4')}
                    </Text>
                  </View>
                </View>

                {boxW4 > 0 && (
                  <View
                    style={[
                      stylesRef.helloPane,
                      { left: -barToLeftDelta4, width: contentW4 },
                    ]}
                  >
                    <View style={stylesRef.containerEq4}>
                      <MathView
                        math={`\\frac{1}{\\sqrt{f}} = -2\\log_{10}\\!\\left(\\frac{\\varepsilon/D}{3.7} + \\frac{2.51}{Re\\,\\sqrt{f}}\\right)`}
                        style={{ color: themeColors.text }}
                      />
                    </View>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                key={`bar4-${focusKey4}`}
                style={[stylesRef.verticalBar, { transform: [{ translateX: translateX4 }] }]}
              />
            </View>
          </Pressable>
        </View>
      </View>


    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgb(255, 255, 255)',
  },
  SEPARATOR: {
    width: '100%',
    height: 30,
  },
  preCardSubtitleWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: -2,
  },
  preCardSubtitleBase: {
    lineHeight: 22,
  },
  preCardEssential: {
    fontFamily: 'SFUIDisplay-Medium',
  },
  preCardMF: {
    fontFamily: 'SFUIDisplay-Medium',
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
  valveTextPlaceholder: {
    minWidth: 100,
    minHeight: 30,
    justifyContent: 'center',
  },
  valveText: {
    fontSize: 30,
    color: 'rgb(0, 0, 0)',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  simpleButtonContainer: {
    width: 60,
    height: 40,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonBackground: {
    width: 60,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  transparentButtonMask: {
    width: 60,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  maskedButton: {
    width: 60,
    height: 40,
  },
  buttonGradient: {
    width: 60,
    height: 40,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  simpleButtonContainer2: {
    width: 40,
    height: 40,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonBackground2: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  transparentButtonMask2: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  maskedButton2: {
    width: 40,
    height: 40,
  },
  buttonGradient2: {
    width: 40,
    height: 40,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonIcon: {
    position: 'absolute',
  },
  titlesContainerCalc: {
    backgroundColor: 'transparent',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  subtitleCalc: {
    color: 'rgb(0, 0, 0)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  titleCalc: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'lovelace-medium-italic',
    marginTop: -45,
    marginBottom: -45,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgb(255, 255, 255)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'rgb(51, 51, 51)',
  },
  buttonContainer: {
    alignItems: 'center',
    width: '100%',
  },
});
const stylesRef = StyleSheet.create({
  contentBox: {
    minHeight: 90,
    width: '100%',
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    padding: 1,
    marginTop: 10,
  },
  innerBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 20,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  textsContainer: {
    position: 'relative',
  },
  titleContainerRef: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  titleText: {
    color: 'rgb(0, 0, 0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Bold',
  },
  subtitleText: {
    color: 'rgb(120, 120, 120)',
    fontSize: 14,
    fontFamily: 'SFUIDisplay-Regular',
    marginTop: 0,
  },
  descContainer: {
    backgroundColor: 'transparent',
    marginRight: 20,
  },
  helloPane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  verticalBar: {
    position: 'absolute',
    right: RIGHT_OFFSET,
    top: '25%',
    bottom: '25%',
    width: BAR_WIDTH,
    backgroundColor: 'rgb(194, 254, 12)',
    borderRadius: 2,
  },
  containerEq: {
    backgroundColor: 'transparent',
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 60,
  },
  containerEq2: {
    backgroundColor: 'transparent',
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 10,
  },
  containerEq3: {
    backgroundColor: 'transparent',
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 0,
  },
  containerEq4: {
    backgroundColor: 'transparent',
    width: '90%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 0,
  },
});

export default HomeScreen;