import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, LayoutChangeEvent, useWindowDimensions, Easing } from 'react-native';
import { Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../contexts/ThemeContext';
// import MathView from 'react-native-math-view';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { useIsFocused } from '@react-navigation/native';
import { calculatorsDef } from '../../src/data/calculators';
import { ScrollView } from 'react-native';
import FastImage from '@d11/react-native-fast-image'; // ← AGREGAR ESTA LÍNEA

type RootStackParamList = {
  InfoScreen: undefined;
  SearchScreen: undefined;
  ContinuidadCalc: undefined;
  BernoulliCalc: undefined;
  ReynoldsCalc: undefined;
  ColebrookCalc: undefined;
  AxisScreen: undefined;
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
  barColor?: string;
  progress?: number;  // ← NUEVA PROPIEDAD
};

const CalcCard: React.FC<CalcCardProps> = ({ 
  title, 
  desc, 
  math, 
  route, 
  navigation, 
  themeColors, 
  fontSizeFactor,
  barColor,
  progress
}) => {
  const renderProgressDots = () => {
    const dots = [];
    const currentProgress = progress || 0; // ← Usar la variable directa
    
    for (let i = 1; i <= 5; i++) {
      let dotColor = '#E0E0E0'; // Gris por defecto

      if (i <= currentProgress) {
        if (i === 1) {
          dotColor = '#FF3B30'; // Rojo para el primero
        } else if (i === 2) {
          dotColor = '#FF9500'; // Naranja para segundo y tercero
        } else if (i === 3 || i === 4) {
          dotColor = '#34C759'; // Verde para el cuarto
        } else if (i === 5) {
          dotColor = '#FFD700'; // Dorado para el quinto
        }
      }

      dots.push(
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: dotColor }
          ]}
        />
      );
    }

    return <View style={styles.progressContainer}>{dots}</View>;
  };
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
                <View style={styles.progressWrapper}>
                  {renderProgressDots()}
                </View>
              </View>

              {boxW > 0 && (
                <View style={[stylesRef.helloPane, { left: -barToLeftDelta, width: contentW }]}>
                  <View style={stylesRef.containerEq}>
                    
                  </View>
                </View>
              )}
            </Animated.View>

            <Animated.View 
              style={[
                stylesRef.verticalBar, 
                { 
                  transform: [{ translateX }],
                  backgroundColor: barColor || 'rgb(194, 254, 12)'
                } 
              ]} 
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const SpecialCard: React.FC<{
  title: string;
  navigation: any;
  themeColors: any;
  fontSizeFactor: number;
  currentTheme: string; // ← AÑADE ESTA PROPIEDAD
}> = ({ title, navigation, themeColors, fontSizeFactor, currentTheme }) => {
  
  // Determinar qué imagen usar según el tema
  const getCardBackground = () => {
    if (currentTheme === 'dark') {
      return require('../../assets/ORBIT/cardBG_dark.png'); // Imagen para modo oscuro
    }
    return require('../../assets/ORBIT/cardBG.png'); // Imagen para modo claro
  };

  return (
    <View style={styles.buttonContainer}>
      <View style={{ width: '100%', paddingHorizontal: 20 }}>
        <Pressable
          style={[
            stylesRef.contentBox,
            { 
              experimental_backgroundImage: themeColors.gradient,
              minHeight: 80,
            },
          ]}
          onPress={() => navigation.navigate('AxisScreen')}
        >
          <View
            style={[
              stylesRef.innerBox,
              { 
                backgroundColor: 'transparent', 
                experimental_backgroundImage: themeColors.cardGradient,
                position: 'relative',
                overflow: 'hidden',
              },
            ]}
          >
            {/* IMAGEN SUPERPUESTA CON SOPORTE PARA MODO CLARO/OSCURO */}
            <FastImage
              source={getCardBackground()}
              style={[
                StyleSheet.absoluteFillObject,
                {
                  opacity: 1,
                }
              ]}
              resizeMode={FastImage.resizeMode.cover}
            />

            {/* TEXTO */}
            <View style={[stylesRef.textsContainer, { zIndex: 2 }]}>
              <View>
                <View style={stylesRef.titleContainerRef}>
                  <Text style={[stylesRef.titleText, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>
                    {title}
                  </Text>
                </View>
              </View>
            </View>
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

  // AGREGAR ESTAS VARIABLES Y HOOKS PARA LA MARQUESINA
  const MARQUEE_TEXT = t('home.marquee');
  const GAP = 40;
  const SPEED = 60;
  const FONT_SIZE = 16;
  const STRIP_HEIGHT = 30;
  const INITIAL_COPIES = 200;

  const { width: screenWidth } = useWindowDimensions();
  const unitRef = useRef(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const measured = useRef(false);

  const [copiesCount, setCopiesCount] = useState(INITIAL_COPIES);
  const [trackWidth, setTrackWidth] = useState<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isAnimating) return;

    const unit = unitRef.current;
    const duration = (unit / SPEED) * 1000;

    animValue.setValue(0);

    const anim = Animated.loop(
      Animated.timing(animValue, {
        toValue: -unit,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    anim.start();
    return () => anim.stop();
  }, [isAnimating, animValue]);

  const handleFirstTextLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      if (measured.current) return;
      const textW = e.nativeEvent.layout.width;
      if (textW <= 0) return;

      measured.current = true;

      const unit = textW + GAP;
      unitRef.current = unit;

      const count = Math.ceil(screenWidth / unit) + 2;
      const tWidth = count * unit;

      setCopiesCount(count);
      setTrackWidth(tWidth);
      setIsAnimating(true);
    },
    [screenWidth],
  );

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

  // Calculadoras de la primera sección (Esencial - Mecánica de fluidos)
  const essentialCards = useMemo(() =>
    calculatorsDef
      .filter(c => ['reynolds', 'froude', 'continuity', 'energybernoulli', 'GeometriaSecciones'].includes(c.id))
      .map(c => ({
        key: c.id,
        title: t(c.titleKey) ?? c.id,
        desc: t(c.descKey) ?? '',
        math: c.math ?? '',
        route: c.route,
        color: c.color,
        progress: c.progress,
      }))
  , [t]);

  // Calculadoras de la nueva sección (Flujo en tubería y pérdidas)
  const pipeFlowCards = useMemo(() =>
    calculatorsDef
      .filter(c => ['factor-friccion', 'perdidas-localizadas'].includes(c.id))
      .map(c => ({
        key: c.id,
        title: t(c.titleKey) ?? c.id,
        desc: t(c.descKey) ?? '',
        math: c.math ?? '',
        route: c.route,
        color: c.color,
        progress: c.progress,
      }))
  , [t]);

  // Calculadoras DISEÑO
  const designCards = useMemo(() =>
    calculatorsDef
      .filter(c => ['diseño_simple', 'diseño_serie', 'diseño_paralelo'].includes(c.id))
      .map(c => ({
        key: c.id,
        title: t(c.titleKey) ?? c.id,
        desc: t(c.descKey) ?? '',
        math: c.math ?? '',
        route: c.route,
        color: c.color,
        progress: c.progress,
      }))
  , [t]);

  // Calculadoras COMPROBACION DISEÑO
  const designcompCards = useMemo(() =>
    calculatorsDef
      .filter(c => ['compdiseño_simple', 'compdiseño_serie', 'compdiseño_paralelo'].includes(c.id))
      .map(c => ({
        key: c.id,
        title: t(c.titleKey) ?? c.id,
        desc: t(c.descKey) ?? '',
        math: c.math ?? '',
        route: c.route,
        color: c.color,
        progress: c.progress,
      }))
  , [t]);

  // Calculadoras BOMBAS
  const bombCards = useMemo(() =>
    calculatorsDef
      .filter(c => ['bomb-Potencia', 'serie-potencia', 'paralelo-potencia'].includes(c.id))
      .map(c => ({
        key: c.id,
        title: t(c.titleKey) ?? c.id,
        desc: t(c.descKey) ?? '',
        math: c.math ?? '',
        route: c.route,
        color: c.color,
        progress: c.progress,
      }))
  , [t]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent, 
        { backgroundColor: themeColors.background }
      ]}
    >
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

        {/* MARQUESINA */}
        <View style={styles.marqueeWrapper}>
          <View style={styles.clipView}>
            <Animated.View
              style={[
                styles.marqueeTrack,
                trackWidth !== undefined && { width: trackWidth },
                isAnimating && { transform: [{ translateX: animValue }] },
              ]}
            >
              {Array.from({ length: copiesCount }).map((_, i) => (
                <Text
                  key={i}
                  style={styles.marqueeText}
                  numberOfLines={1}
                  onLayout={i === 0 ? handleFirstTextLayout : undefined}
                >
                  {MARQUEE_TEXT}
                </Text>
              ))}
            </Animated.View>
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

        <View style={styles.preCardSubtitleWrap2}></View>

        <SpecialCard
          title="ORBIT"
          navigation={navigation}
          themeColors={themeColors}
          fontSizeFactor={fontSizeFactor}
          currentTheme={currentTheme}
        />

        {/* PRIMERA SECCIÓN: Calculadoras esenciales */}
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

        {essentialCards.map(card => (
          <CalcCard
            key={card.key}
            title={card.title}
            desc={card.desc}
            math={card.math}
            route={card.route}
            navigation={navigation}
            themeColors={themeColors}
            fontSizeFactor={fontSizeFactor}
            barColor={card.color}
            progress={card.progress}
          />
        ))}

        {/* SEGUNDA SECCIÓN: canales y tuberias */}
        <View style={styles.preCardSubtitleWrap}>
          <Text
            style={[
              styles.preCardSubtitleBase,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            <Text style={[styles.preCardEssential, { fontSize: 16 * fontSizeFactor }]}></Text>
            <Text></Text>
            <Text style={[styles.preCardMF, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitle2')}</Text>
          </Text>
        </View>

        {pipeFlowCards.map(card => (
          <CalcCard
            key={card.key}
            title={card.title}
            desc={card.desc}
            math={card.math}
            route={card.route}
            navigation={navigation}
            themeColors={themeColors}
            fontSizeFactor={fontSizeFactor}
            barColor={card.color}
            progress={card.progress}
          />
        ))}

        {/* TERCERA SECCIÓN: diseño */}
        <View style={styles.preCardSubtitleWrap}>
          <Text
            style={[
              styles.preCardSubtitleBase,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            <Text style={[styles.preCardEssential, { fontSize: 16 * fontSizeFactor }]}></Text>
            <Text></Text>
            <Text style={[styles.preCardMF, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitle3')}</Text>
          </Text>
        </View>

        {designCards.map(card => (
          <CalcCard
            key={card.key}
            title={card.title}
            desc={card.desc}
            math={card.math}
            route={card.route}
            navigation={navigation}
            themeColors={themeColors}
            fontSizeFactor={fontSizeFactor}
            barColor={card.color}
            progress={card.progress}
          />
        ))}

        {/* TERCERA SECCIÓN: comprobacion diseño */}
        <View style={styles.preCardSubtitleWrap}>
          <Text
            style={[
              styles.preCardSubtitleBase,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            <Text style={[styles.preCardEssential, { fontSize: 16 * fontSizeFactor }]}></Text>
            <Text></Text>
            <Text style={[styles.preCardMF, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitle4')}</Text>
          </Text>
        </View>

        {designcompCards.map(card => (
          <CalcCard
            key={card.key}
            title={card.title}
            desc={card.desc}
            math={card.math}
            route={card.route}
            navigation={navigation}
            themeColors={themeColors}
            fontSizeFactor={fontSizeFactor}
            barColor={card.color}
            progress={card.progress}
          />
        ))}

        {/* AUN NO SECCIÓN: Bombas */}
        <View style={styles.preCardSubtitleWrap}>
          <Text
            style={[
              styles.preCardSubtitleBase,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            <Text style={[styles.preCardEssential, { fontSize: 16 * fontSizeFactor }]}></Text>
            <Text></Text>
            <Text style={[styles.preCardMF, { fontSize: 16 * fontSizeFactor }]}>{t('mainMenu.subtitle5')}</Text>
          </Text>
        </View>

        {bombCards.map(card => (
          <CalcCard
            key={card.key}
            title={card.title}
            desc={card.desc}
            math={card.math}
            route={card.route}
            navigation={navigation}
            themeColors={themeColors}
            fontSizeFactor={fontSizeFactor}
            barColor={card.color}
            progress={card.progress}
          />
        ))}
        
        {/* SECCIÓN DE INFORMACIÓN DE PROGRESO */}
        <View style={styles.infoSection}>
          <View style={[styles.separatorInfo, { backgroundColor: themeColors.separator }]} />

          <Text style={[styles.infoTitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
            {t('home.progressInfo.title') || 'Indicador de progreso'}
          </Text>

          {/* Caso 1: 1 punto */}
          <View style={styles.infoRow}>
            <View style={styles.infoDotsContainer}>
              {[1,2,3,4,5].map((i) => {
                let dotColor = '#E0E0E0';
                if (i === 1) dotColor = '#FF3B30';
                return (
                  <View key={`info1-${i}`} style={[styles.infoDot, { backgroundColor: dotColor }]} />
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>
              {t('home.progressInfo.level1') || 'Nivel 1: Introducción'}
            </Text>
          </View>

          {/* Caso 2: 2 puntos */}
          <View style={styles.infoRow}>
            <View style={styles.infoDotsContainer}>
              {[1,2,3,4,5].map((i) => {
                let dotColor = '#E0E0E0';
                if (i === 1) dotColor = '#FF3B30';
                if (i === 2) dotColor = '#FF9500';
                return (
                  <View key={`info2-${i}`} style={[styles.infoDot, { backgroundColor: dotColor }]} />
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>
              {t('home.progressInfo.level2') || 'Nivel 2: Conceptos básicos'}
            </Text>
          </View>

          {/* Caso 3: 3 puntos */}
          <View style={styles.infoRow}>
            <View style={styles.infoDotsContainer}>
              {[1,2,3,4,5].map((i) => {
                let dotColor = '#E0E0E0';
                if (i === 1) dotColor = '#FF3B30';
                if (i === 2) dotColor = '#FF9500';
                if (i === 3) dotColor = '#34C759';
                return (
                  <View key={`info3-${i}`} style={[styles.infoDot, { backgroundColor: dotColor }]} />
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>
              {t('home.progressInfo.level3') || 'Nivel 3: Aplicaciones prácticas'}
            </Text>
          </View>

          {/* Caso 4: 4 puntos */}
          <View style={styles.infoRow}>
            <View style={styles.infoDotsContainer}>
              {[1,2,3,4,5].map((i) => {
                let dotColor = '#E0E0E0';
                if (i === 1) dotColor = '#FF3B30';
                if (i === 2) dotColor = '#FF9500';
                if (i === 4 || i === 3) dotColor = '#34C759';
                return (
                  <View key={`info4-${i}`} style={[styles.infoDot, { backgroundColor: dotColor }]} />
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>
              {t('home.progressInfo.level4') || 'Nivel 4: Análisis avanzado'}
            </Text>
          </View>

          {/* Caso 5: 5 puntos */}
          <View style={styles.infoRow}>
            <View style={styles.infoDotsContainer}>
              {[1,2,3,4,5].map((i) => {
                let dotColor = '#E0E0E0';
                if (i === 1) dotColor = '#FF3B30';
                if (i === 2) dotColor = '#FF9500';
                if (i === 4 || i === 3) dotColor = '#34C759';
                if (i === 5) dotColor = '#FFD700';
                return (
                  <View key={`info5-${i}`} style={[styles.infoDot, { backgroundColor: dotColor }]} />
                );
              })}
            </View>
            <Text style={[styles.infoText, { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor }]}>
              {t('home.progressInfo.level5') || 'Nivel 5: Experto'}
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
    </ScrollView>
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
  preCardSubtitleWrap2: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    marginTop: 15,
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
    marginTop: 10,
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
  marqueeWrapper: {
    width: '100%',
    height: 30,
    maxHeight: 30,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 0,
  },
  clipView: {
    width: '100%',
    height: 30,
    overflow: 'hidden',
  },
  marqueeTrack: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  marqueeText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 30,
    includeFontPadding: false,
    flexShrink: 0,
    marginRight: 40,
    fontFamily: 'HomeVideo-BLG6G',
  },
  scrollContent: {
    paddingBottom: 200,   
    flexGrow: 1,
  },
  sectionContainer: {
    marginTop: 30,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  sectionTitleContainer: {
    marginBottom: 5,
  },
  sectionTitle: {
    fontFamily: 'Alliance No.2 SemiBold',
    fontSize: 22,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 14,
  },
  bottomSpacing: {
    height: 40,
  },
  progressWrapper: {
    marginTop: 8,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  separatorInfo: {
    height: 1,
    marginBottom: 20,
  },
  infoTitle: {
    fontFamily: 'SFUIDisplay-Bold',
    marginBottom: 10,
    marginTop: -7,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60, // Ancho fijo para alinear los textos
    marginRight: 12,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoText: {
    flex: 1,
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 18,
  },
  infoFootnote: {
    fontFamily: 'SFUIDisplay-Regular',
    fontStyle: 'italic',
    marginTop: 5,
    opacity: 0.7,
  },
});

const stylesRef = StyleSheet.create({
  contentBox: {
    minHeight: 110,
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
  specialCardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginLeft: 10,
  },
  specialCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default HomeScreen;