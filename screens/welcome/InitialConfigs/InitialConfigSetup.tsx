import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  MainTabs: undefined;
};

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

        {/* 2. Fijo en la parte inferior */}
        <View style={styles.bottomContainer}>
          <View style={styles.poweredByContainer}>
            <Text style={styles.poweredByText}>Developed in:</Text>
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
    width: 130,
    height: 30,
  },
});

export default InitialConfigSetup;
