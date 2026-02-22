import React, { useContext } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Icon2 from 'react-native-vector-icons/Feather';
import Icons from 'react-native-vector-icons/MaterialCommunityIcons';
import Icons3 from 'react-native-vector-icons/AntDesign';

import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { ThemeContext } from '../../../contexts/ThemeContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { useTheme } from '../../../contexts/ThemeContext';

import { InitialScreenContext } from '../../../contexts/InitialScreenContext';

type RootStackParamList = {
  IdiomaScreen: undefined;
  TemaScreen: undefined;
  FuenteScreen: undefined;
  SeparadorDecimalScreen: undefined;
  PrecisionDecimalScreen: undefined;
  NAScreen: undefined;
  InitialScreenConfigScreen: undefined;
};

const SettingsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { selectedLanguage, setSelectedLanguage, t } = useContext(LanguageContext);
  const { selectedTheme, setSelectedTheme } = useContext(ThemeContext);
  const { selectedFontSize, setSelectedFontSize, fontSizeFactor } = useContext(FontSizeContext);
  const { selectedDecimalSeparator, setSelectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { selectedPrecision, setSelectedPrecision, setDecimalCountFixed, setDecimalCountScientific, setDecimalCountEngineering } = useContext(PrecisionDecimalContext);
  const { initialScreen, setInitialScreen } = useContext(InitialScreenContext);

  const getInitialScreenLabel = (key: string) => {
    if (key === 'HomeScreen') return t?.('settings.initialScreen.home') || 'Home';
    if (key === 'FavScreen') return t?.('settings.initialScreen.fav') || 'Favoritos';
    return key;
  };

  const getThemeLabel = (key: string) => {
    if (key === 'Sistema') return t?.('settings.themeSystem') || 'Sistema';
    if (key === 'Claro')   return t?.('settings.themeLight')  || 'Claro';
    if (key === 'Oscuro')  return t?.('settings.themeDark')   || 'Oscuro';
    return key;
  };

  const getFontSizeLabel = (key: string) => {
    if (key === 'Muy Pequeña') return t?.('settings.fontVerySmall') || 'Muy Pequeña';
    if (key === 'Pequeña')     return t?.('settings.fontSmall')     || 'Pequeña';
    if (key === 'Normal')      return t?.('settings.fontNormal')    || 'Normal';
    if (key === 'Grande')      return t?.('settings.fontLarge')     || 'Grande';
    if (key === 'Muy Grande')  return t?.('settings.fontVeryLarge') || 'Muy Grande';
    return key;
  };

  const getSeparatorLabel = (key: string) => {
    if (key === 'Punto') return t?.('settings.sepDot')   || 'Punto';
    if (key === 'Coma')  return t?.('settings.sepComma') || 'Coma';
    return key;
  };

  const getPrecisionLabel = (key: string) => {
    if (key === 'Normal')      return t?.('settings.preNormal')      || 'Normal';
    if (key === 'Fix')         return t?.('settings.preFix')         || 'Fix';
    if (key === 'Científica')  return t?.('settings.preScientific')  || 'Científica';
    if (key === 'Ingeniería')  return t?.('settings.preEngineering') || 'Ingeniería';
    return key;
  };

  const getLanguageLabel = (key: string) => {
    if (key === 'Español') return t?.('settings.langSpanish')  || 'Español';
    if (key === 'Inglés')  return t?.('settings.langEnglish')  || 'Inglés';
    if (key === 'Francés') return t?.('settings.langFrench')   || 'Francés';
    if (key === 'Alemán')  return t?.('settings.langGerman')   || 'Alemán';
    if (key === 'Chino')   return t?.('settings.langChinese')  || 'Chino';
    if (key === 'Japonés') return t?.('settings.langJapanese') || 'Japonés';
    return key;
  };

  const { currentTheme } = useTheme();
  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
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
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const resetSettings = () => {
    setSelectedLanguage('Español');
    setSelectedTheme('Claro');
    setSelectedFontSize('Normal');
    setSelectedDecimalSeparator('Punto');
    setSelectedPrecision('Normal');
    setDecimalCountFixed(12);
    setDecimalCountScientific(5);
    setDecimalCountEngineering(5);
    setInitialScreen('HomeScreen');
  };

  const handleResetPress = () => {
    Alert.alert(
      t('settings.resetAlert.title'),
      t('settings.resetAlert.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.resetAlert.confirm'), onPress: resetSettings },
      ],
      { cancelable: false }
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
              onPress={handleResetPress}
            >
              <Icon2 name="refresh-ccw" size={20} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>Valve</Text>
        <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('settings.title')}</Text>
      </View>

      <View style={[styles.optionsContainerMain1, { experimental_backgroundImage: themeColors.gradient }]}>
        <View style={[styles.optionsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}>

          <Pressable
            onPress={() => navigation.navigate('IdiomaScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionLeftIcon]}>
                <Icons name="earth" size={24} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('settings.language')}</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getLanguageLabel(selectedLanguage)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          <Pressable
            onPress={() => navigation.navigate('TemaScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionLeftIcon}>
                <Icons name="circle-slice-4" size={24} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('settings.theme')}</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getThemeLabel(selectedTheme)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          <Pressable
            onPress={() => navigation.navigate('FuenteScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionLeftIcon}>
                <Icons name="format-size" size={24} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('settings.font')}</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getFontSizeLabel(selectedFontSize)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.optionsContainerMain,
          { marginTop: 20, experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View style={[styles.optionsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}>

          <Pressable
            onPress={() => navigation.navigate('SeparadorDecimalScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionLeftIcon}>
                <Icons name="surround-sound-5-1" size={24} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('settings.sep')}</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getSeparatorLabel(selectedDecimalSeparator)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
          <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />

          <Pressable
            onPress={() => navigation.navigate('PrecisionDecimalScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionLeftIcon}>
                <Icons name="blur-linear" size={24} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>{t('settings.pre')}</Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getPrecisionLabel(selectedPrecision)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('InitialScreenConfigScreen')}
            style={[styles.optionItem, { backgroundColor: 'transparent' }]}
          >
            <View style={styles.optionLeft}>
              <View style={styles.optionLeftIcon}>
                <Icons3 name="codepen" size={20} color={themeColors.icon} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {t('settings.initialScreen.title')}
              </Text>
            </View>
            <View style={styles.optionRight}>
              <Text style={[styles.optionSelected, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {getInitialScreenLabel(initialScreen)}
              </Text>
              <Icon2 name="chevron-down" size={20} color={themeColors.icon} />
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
    backgroundColor: 'rgba(255, 255, 255, 1)',
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
    gap: 8,
  },
  iconWrapper: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 60,
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
  optionsContainerMain1: {
    padding: 1,
    marginHorizontal: 20,
    marginTop: 0,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  optionsContainerMain: {
    padding: 1,
    marginHorizontal: 20,
    marginVertical: 0,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 3,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    borderRadius: 10,
    minHeight: 45,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionLeftIcon: {
    minWidth: 30,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionText: {
    fontSize: 16,
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  optionSelected: {
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

export default SettingsScreen;