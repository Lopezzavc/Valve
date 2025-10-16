
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFontSize } from '../../contexts/FontSizeContext';
import { useDecimalSeparator } from '../../contexts/DecimalSeparatorContext';
import { usePrecisionDecimal } from '../../contexts/PrecisionDecimalContext';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SplashScreen'>;
const ASSET_URIS: string[] = [
  
  Image.resolveAssetSource(require('../../assets/CardsCalcs/card2F1.webp')).uri,
  Image.resolveAssetSource(require('../../assets/ImagesBackground/imageBackground1.webp')).uri,
];
async function preloadImages(uris: string[]): Promise<void> {
  if (!uris || uris.length === 0) return;
  await Promise.all(
    uris.map((uri) =>
      Image.prefetch(uri).catch(() => false)
    )
  ).then(() => undefined);
}
async function preloadAssetsWithTimeout(timeoutMs = 5000): Promise<void> {
  const tasks = [preloadImages(ASSET_URIS)];
  await Promise.race([
    Promise.all(tasks).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const SplashScreen = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isReady, setIsReady] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  const { selectedLanguage } = useLanguage();
  const { selectedTheme } = useTheme();
  const { selectedFontSize } = useFontSize();
  const { selectedDecimalSeparator } = useDecimalSeparator();
  const { selectedPrecision } = usePrecisionDecimal();

  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const contextsReady =
      selectedLanguage !== '' &&
      selectedTheme !== '' &&
      selectedFontSize !== '' &&
      selectedDecimalSeparator !== '' &&
      selectedPrecision !== '';

    if (contextsReady) setIsReady(true);
  }, [
    selectedLanguage,
    selectedTheme,
    selectedFontSize,
    selectedDecimalSeparator,
    selectedPrecision,
    fadeAnim,
  ]);

  
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await preloadAssetsWithTimeout(5000);
      } finally {
        if (mounted) setAssetsLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  
  useEffect(() => {
    if (isReady && assetsLoaded) {
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          navigation.replace('WelcomeScreen');
        });
      }, 1500); 
      return () => clearTimeout(timer);
    }
  }, [isReady, assetsLoaded, navigation, fadeAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.imageBackground}>
        <View style={styles.overlay} />
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.title}>VALVE</Text>
          <Text style={styles.subtitle}>Alpha 1.1.7 [Build 51]</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(0, 0, 0, 1) 95%)',
  },
  content: {
    alignItems: 'center',
    gap: 5,
  },
  title: {
    fontSize: 40,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgba(255, 255, 255, 1)',
    marginBottom: -10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgb(194, 254, 12)',
    fontFamily: 'SFUIDisplay-Medium',
    padding: 2,
  },
});

export default SplashScreen;
