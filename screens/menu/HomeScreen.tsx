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
import { useIsFocused } from '@react-navigation/native';
import { calculatorsDef } from '../../src/data/calculators';

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

type CalcCardProps = {
  title: string;
  desc: string;
  math: string;
  route: keyof RootStackParamList | string;
  navigation: any;
  themeColors: any;
  fontSizeFactor: number;
};

const CalcCard: React.FC<CalcCardProps> = ({ title, desc, math, route, navigation, themeColors, fontSizeFactor }) => {
  const [boxW, setBoxW] = useState(0);
  const [open, setOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const animListenerIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);

  const isFocused = useIsFocused();

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
      hasNavigatedRef.current = false;
      removeAnimListener();

      const threshold = Math.abs(toValue) * 0.98;
      animListenerIdRef.current = translateX.addListener(({ value }) => {
        if (!hasNavigatedRef.current && Math.abs(value) >= Math.abs(threshold)) {
          hasNavigatedRef.current = true;
          removeAnimListener();
          navigation.navigate(route as any);
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

  useEffect(() => {
    return () => {
      removeAnimListener();
      translateX.stopAnimation?.(() => {
        translateX.setValue(0);
      });
    };
  }, []);

  useEffect(() => {
    if (isFocused) {
      removeAnimListener();
      hasNavigatedRef.current = false;

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 15,
        tension: 30,
      }).start();

      setOpen(false);
    }
  }, [isFocused]);

  return (
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
            <Animated.View style={[stylesRef.textsContainer, { transform: [{ translateX }] }]}>
              <View>
                <View style={stylesRef.titleContainerRef}>
                  <Text style={[stylesRef.titleText, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>{title}</Text>
                </View>
                <View style={stylesRef.descContainer}>
                  <Text style={[stylesRef.subtitleText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>{desc}</Text>
                </View>
              </View>

              {boxW > 0 && (
                <View style={[stylesRef.helloPane, { left: -barToLeftDelta, width: contentW }]}>
                  <View style={stylesRef.containerEq}>
                    <MathView math={math} style={{ color: themeColors.text }} />
                  </View>
                </View>
              )}
            </Animated.View>

            <Animated.View style={[stylesRef.verticalBar, { transform: [{ translateX }] }]} />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const HomeScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const preloadOnceRef = useRef<Promise<void> | null>(null);

  const startPreloadContinuidad = () => {
    if (preloadOnceRef.current) return;
    preloadOnceRef.current = (async () => {
      try {
        await import('../calculators/3_Continuidad/ContinuidadCalc');

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

  const cards = useMemo(() =>
    calculatorsDef.map(c => ({
      key: c.id,
      title: t(c.titleKey) ?? c.id,
      desc: t(c.descKey) ?? '',
      math: c.math ?? '',
      route: c.route,
    }))
  , [t]);

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.valveTextPlaceholder}>
          <View style={styles.logoAndTextContainer}>
            <Image
              source={
                currentTheme === 'dark'
                  ? require('../../assets/icon/iconwhite.webp')
                  : require('../../assets/icon/iconblack.webp')
              }
              style={styles.headerIcon}
              resizeMode="contain"
            />
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
          <Text style={[styles.preCardEssential, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitleEssential')}</Text>
          <Text> - </Text>
          <Text style={[styles.preCardMF, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitle1')}</Text>
        </Text>
      </View>

      {cards.map(card => (
        <CalcCard
          key={card.key}
          title={card.title}
          desc={card.desc}
          math={card.math}
          route={card.route}
          navigation={navigation}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
        />
      ))}
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
    height: 50,
  },
  logoAndTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerIcon: {
    width: 30,
    height: 30,
    marginRight: 8,
    borderRadius: 6,
  },
  preCardSubtitleWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: -3,
  },
  preCardSubtitleBase: {
    lineHeight: 22,
  },
  preCardEssential: {
    fontFamily: 'SFUIDisplay-Regular',
  },
  preCardMF: {
    fontFamily: 'SFUIDisplay-Regular',
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
    marginTop: 10, // NO SE SI DEJARLO EN 10 PERO SE PIERDE LA COHERENCIA CON EL RESTO DE PANTALLAS, O DEJARLO EN 0 PERO SE VE FEO
    paddingHorizontal: 20,
  },
  subtitleCalc: {
    color: 'rgb(0, 0, 0)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  titleCalc: {
    color: 'rgb(49, 32, 32)',
    fontSize: 30,
    fontFamily: 'Alliance No.2 Medium',
    marginTop: -8,
    marginBottom: -5,
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
    fontFamily: 'Alliance No.2 SemiBold',
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
    width: '100%',
    justifyContent: 'center',
    alignContent: 'center',
  },
});

export default HomeScreen;