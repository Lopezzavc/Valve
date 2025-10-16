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
        duration: 1500,
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
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.contentContainer}>
          <Image
            source={require('../../../assets/icon/play_store_512.webp')}
            style={styles.image}
          />
          <Text style={styles.text}>VALVE</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 60,
    height: 60,
    marginRight: 0,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
  },
});

export default InitialConfigSetup;