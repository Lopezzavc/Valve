import React, { memo, useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import MaskedView from '@react-native-masked-view/masked-view';
import { LanguageContext } from '../../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WelcomeScreen'>;

const WelcomeScreen = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { t, selectedLanguage } = useContext(LanguageContext);

  const handleNavigatetoMainTabs = () => {
    navigation.navigate('ThemeInitialConfig');
  };

  const handleStart = async () => {
    try {
      const done = await AsyncStorage.getItem('hasCompletedInitialConfig');
      if (done === 'true') {
        navigation.navigate('MainTabs');
      } else {
        navigation.navigate('ThemeInitialConfig');
      }
    } catch {
      navigation.navigate('ThemeInitialConfig');
    }
  };

  return (
    <View style={styles.background}>
      <ImageBackground
        source={require('../../assets/ImagesBackground/imageBackground1.webp')}
        style={{
          ...StyleSheet.absoluteFillObject,
          filter: `
            saturate(100%)
          `
        }}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <View style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>VALVE</Text>
            </View>
            <View style={styles.subtitleContainer}>
              <Text style={styles.subtitle}>
                {t('welcomeText')}
              </Text>
            </View>
            <View style={styles.buttonContainer}>
              <Pressable onPress={handleNavigatetoMainTabs}>
                <Pressable onPress={handleStart}>
                  <View style={styles.RedBackgroundSquare} />
                  <MaskedView
                    style={styles.maskedView}
                    maskElement={
                      <View style={styles.TransparentSquare} />
                    }
                  >
                    <View style={styles.RedSquare} />
                  </MaskedView>
                  <View style={styles.transparentSquare2}>
                    <Text style={styles.centeredText}>Comenzar</Text>
                  </View>
                  <View style={styles.transparentSquare3}>
                    <Text style={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: 18,
                      textAlign: 'center',
                      textAlignVertical: 'center',
                      flex: 1,
                      fontFamily: 'SFUIDisplay-Medium',
                      filter: 'blur(4px)'
                    }}>
                      Comenzar
                    </Text>
                  </View>
                </Pressable>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  imageBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(0, 0, 0, 1) 95%)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  titleContainer: {
    marginBottom: -15,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 60,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(255, 255, 255)',
    textAlign: 'left',
  },
  subtitleContainer: {
    marginTop: 10,
    marginBottom: 40,
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgb(255, 255, 255)',
    textAlign: 'left',
    lineHeight: 24,
    fontFamily: 'SFUIDisplay-Medium',
  },
  buttonContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  maskedView: {
    width: 300,
    height: 64,
  },
  TransparentSquare: {
    width: 300,
    height: 64,
    backgroundColor: 'transparent',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    position: 'absolute',
  },
  RedSquare: {
    width: 300,
    height: 64,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(200, 200, 200) 0%, rgb(58, 58, 58) 25%, rgb(58, 58, 58) 75%, rgb(170, 170, 170)) 100%',
    borderRadius: 32,
  },
  RedBackgroundSquare: {
    width: 300,
    height: 64,
    backgroundColor: 'rgba(174, 174, 174, 0.12)',
    position: 'absolute',
    borderRadius: 32,
  },
  transparentSquare2: {
    width: 300,
    height: 64,
    backgroundColor: 'transparent',
    borderRadius: 25,
    position: 'absolute',
  },
  transparentSquare3: {
    width: 300,
    height: 64,
    backgroundColor: 'transparent',
    position: 'absolute',
    borderRadius: 32,
  },
  centeredText: {
    color: 'rgba(255, 255, 255, 1)',
    fontSize: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    flex: 1,
    fontFamily: 'SFUIDisplay-Medium',
  },
  centeredText2: {
    color: 'rgba(255, 255, 255, 1)',
    fontSize: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    flex: 1,
    fontFamily: 'SFUIDisplay-Medium',
  },
});

export default WelcomeScreen;