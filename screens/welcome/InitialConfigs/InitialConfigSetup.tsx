import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

type RootStackParamList = {
  MainTabs: undefined;
};

const LOADER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .loader {
      --color-one: #5bc8f5;
      --color-two: #0a4fa8;
      --color-three: #5bc8f580;
      --color-four: #0a4fa880;
      --color-five: #5bc8f540;
      --time-animation: 2s;
      --size: 0.8;
      position: relative;
      border-radius: 50%;
      transform: scale(var(--size));
      box-shadow:
        0 0 25px 0 var(--color-three),
        0 20px 50px 0 var(--color-four);
      animation: colorize calc(var(--time-animation) * 3) ease-in-out infinite;
    }
    .loader::before {
      content: "";
      position: absolute;
      top: 0; left: 0;
      width: 100px; height: 100px;
      border-radius: 50%;
      border-top: solid 1px var(--color-one);
      border-bottom: solid 1px var(--color-two);
      background: linear-gradient(180deg, var(--color-five), var(--color-four));
      box-shadow:
        inset 0 10px 10px 0 var(--color-three),
        inset 0 -10px 10px 0 var(--color-four);
    }
    .loader .box {
      width: 100px; height: 100px;
      background: linear-gradient(180deg, var(--color-one) 30%, var(--color-two) 70%);
      mask: url(#clipping);
      -webkit-mask: url(#clipping);
    }
    .loader svg { position: absolute; }
    .loader svg #clipping {
      filter: contrast(15);
      animation: roundness calc(var(--time-animation) / 2) linear infinite;
    }
    .loader svg #clipping polygon { filter: blur(7px); }
    .loader svg #clipping polygon:nth-child(1) {
      transform-origin: 75% 25%;
      transform: rotate(90deg);
    }
    .loader svg #clipping polygon:nth-child(2) {
      transform-origin: 50% 50%;
      animation: rotation var(--time-animation) linear infinite reverse;
    }
    .loader svg #clipping polygon:nth-child(3) {
      transform-origin: 50% 60%;
      animation: rotation var(--time-animation) linear infinite;
      animation-delay: calc(var(--time-animation) / -3);
    }
    .loader svg #clipping polygon:nth-child(4) {
      transform-origin: 40% 40%;
      animation: rotation var(--time-animation) linear infinite reverse;
    }
    .loader svg #clipping polygon:nth-child(5) {
      transform-origin: 40% 40%;
      animation: rotation var(--time-animation) linear infinite reverse;
      animation-delay: calc(var(--time-animation) / -2);
    }
    .loader svg #clipping polygon:nth-child(6) {
      transform-origin: 60% 40%;
      animation: rotation var(--time-animation) linear infinite;
    }
    .loader svg #clipping polygon:nth-child(7) {
      transform-origin: 60% 40%;
      animation: rotation var(--time-animation) linear infinite;
      animation-delay: calc(var(--time-animation) / -1.5);
    }
    @keyframes rotation {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes roundness {
      0%   { filter: contrast(15); }
      20%  { filter: contrast(3); }
      40%  { filter: contrast(3); }
      60%  { filter: contrast(15); }
      100% { filter: contrast(15); }
    }
    @keyframes colorize {
      0%   { filter: hue-rotate(0deg); }
      20%  { filter: hue-rotate(-20deg); }
      40%  { filter: hue-rotate(20deg); }
      60%  { filter: hue-rotate(-15deg); }
      80%  { filter: hue-rotate(10deg); }
      100% { filter: hue-rotate(0deg); }
    }
  </style>
</head>
<body>
  <div class="loader">
    <svg width="100" height="100" viewBox="0 0 100 100">
      <defs>
        <mask id="clipping">
          <polygon points="0,0 100,0 100,100 0,100" fill="black"></polygon>
          <polygon points="25,25 75,25 50,75" fill="white"></polygon>
          <polygon points="50,25 75,75 25,75" fill="white"></polygon>
          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
        </mask>
      </defs>
    </svg>
    <div class="box"></div>
  </div>
</body>
</html>
`;

const InitialConfigSetup = () => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.navigate('MainTabs');
      AsyncStorage.setItem('hasCompletedInitialConfig', 'true')
        .catch(() => {})
        .finally(() => {
          navigation.navigate('MainTabs');
        });
    }, 5000);

    return () => clearTimeout(timer);
  }, [fadeAnim, navigation]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.animatedWrapper, { opacity: fadeAnim }]}>

        {/* 1. Centrado exacto en pantalla */}
        <View style={styles.centerOverlay}>
          <View style={styles.contentContainer}>
            <Image
              source={require('../../../assets/icon/play_store_512.webp')}
              style={styles.image}
            />
            <Text style={styles.text}>VALVE</Text>
          </View>
        </View>

        {/* 2. Loader centrado entre contentContainer y bottomContainer */}
        <View style={styles.loaderOverlay}>
          <WebView
            source={{ html: LOADER_HTML }}
            style={styles.loaderWebView}
            scrollEnabled={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            backgroundColor="transparent"    // prop de WebView para iOS
            androidLayerType="hardware"       // mejora rendimiento de animaciones en Android
          />
        </View>

        {/* 3. Fijo en la parte inferior */}
        <View style={styles.bottomContainer}>
          <View style={styles.poweredByContainer}>
            <Text style={styles.poweredByText}>Powered by:</Text>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/icon/easteregg.webp')}
                style={styles.bottomImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  animatedWrapper: {
    flex: 1,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0, right: 0,
    bottom: -100,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  loaderWebView: {
    width: 200,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 70,
    height: 70,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 35,
    fontFamily: 'SFUIDisplay-Bold',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poweredByContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  poweredByText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'SFUIDisplay-Medium',
    opacity: 0.75,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomImage: {
    width: 120,
    height: 30,
  },
});

export default InitialConfigSetup;