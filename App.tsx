import React, { useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators, StackCardInterpolationProps } from '@react-navigation/stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { enableScreens } from 'react-native-screens';
import MaskedView from '@react-native-masked-view/masked-view';

import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontSizeProvider } from './contexts/FontSizeContext';
import { DecimalSeparatorProvider } from './contexts/DecimalSeparatorContext';
import { PrecisionDecimalProvider } from './contexts/PrecisionDecimalContext';
import { useTheme } from './contexts/ThemeContext';

import SplashScreen from './screens/welcome/SplashScreen';
import WelcomeScreen from './screens/welcome/WelcomeScreen';

import ThemeInitialConfig from './screens/welcome/InitialConfigs/ThemeInitialConfig'
import SeparatorInitialConfig from './screens/welcome/InitialConfigs/SeparatorInitialConfig'
import PrecisionInitialConfig from './screens/welcome/InitialConfigs/PrecisionInitialConfig'
import InitialConfigSetup from './screens/welcome/InitialConfigs/InitialConfigSetup'

import HomeScreen from './screens/menu/HomeScreen';
import FavScreen from './screens/menu/FavScreen';
import ProfileScreen from './screens/menu/ProfileScreen';
import SettingsScreen from './screens/menu/settings/SettingsScreen';
import IdiomaScreen from './screens/menu/settings/settingsScreens/IdiomaScreen';
import TemaScreen from './screens/menu/settings/settingsScreens/TemaScreen';
import FuenteScreen from './screens/menu/settings/settingsScreens/FuenteScreen';
import SeparadorDecimalScreen from './screens/menu/settings/settingsScreens/SeparadorDecimalScreen';
import PrecisionDecimalScreen from './screens/menu/settings/settingsScreens/PrecisionDecimalScreen';

import InfoScreen from './screens/menu/info/InfoScreen';
import SearchScreen from './screens/menu/search/SearchScreen';

// DE MOMENTO ESTO NO
import ContinuidadCalc from './screens/calculators/3_Continuidad/ContinuidadCalc';
import OptionsScreen from './screens/calculators/3_Continuidad/OptionsScreen';
import HistoryScreenContinuidad from './screens/calculators/3_Continuidad/HistoryScreenContinuidad';
import ContinuidadTheory from './screens/calculators/3_Continuidad/ContinuidadTheory'

import BernoulliCalc from './screens/calculators/Bernoulli/BernoulliCalc';
import OptionsScreenBernoulli from './screens/calculators/Bernoulli/OptionsScreenBernoulli';
import HistoryScreenBernoulli from './screens/calculators/Bernoulli/HistoryScreenBernoulli';
import BernoulliTheory from './screens/calculators/Bernoulli/BernoulliTheory';

// 1_REYNOLDS
import ReynoldsCalc from './screens/calculators/1_Reynolds/ReynoldsCalc';
import OptionsScreenReynolds from './screens/calculators/1_Reynolds/OptionsScreenReynolds';
import HistoryScreenReynolds from './screens/calculators/1_Reynolds/HistoryScreenReynolds';
import ReynoldsTheory from './screens/calculators/1_Reynolds/ReynoldsTheory';

// 2_FROUDE
import FroudeCalc from './screens/calculators/2_Froude/FroudeCalc';
import OptionsScreenFroude from './screens/calculators/2_Froude/OptionsScreenFroude';
import HistoryScreenFroude from './screens/calculators/2_Froude/HistoryScreenFroude';

import ColebrookCalc from './screens/calculators/Ffactor/ColebrookCalc';
import OptionsScreenColebrook from './screens/calculators/Ffactor/OptionsScreenColebrook';
import HistoryScreenColebrook from './screens/calculators/Ffactor/HistoryScreenColebrook';

import { KeyboardProvider, KeyboardAwareScrollView } from 'react-native-keyboard-controller';

enableScreens(true);

export type RootStackParamList = {
  SplashScreen: undefined;
  MainTabs: undefined;
  InfoScreen: undefined;
  SearchScreen: undefined;
  WelcomeScreen: undefined;
  IdiomaScreen: undefined;
  TemaScreen: undefined;
  FuenteScreen: undefined;
  SeparadorDecimalScreen: undefined;
  PrecisionDecimalScreen: undefined;
  ContinuidadCalc: undefined;
  OptionsScreen: undefined;
  HistoryScreenContinuidad: undefined;
  ContinuidadTheory: undefined;
  BernoulliCalc: undefined;
  ReynoldsCalc: undefined;
  OptionsScreenBernoulli: undefined;
  HistoryScreenBernoulli: undefined;
  BernoulliTheory: undefined;
  OptionsScreenReynolds: undefined;
  HistoryScreenReynolds: undefined;
  ColebrookCalc: undefined;
  OptionsScreenColebrook: undefined;
  HistoryScreenColebrook: undefined;
  ThemeInitialConfig: undefined;
  SeparatorInitialConfig: undefined;
  PrecisionInitialConfig: undefined;
  InitialConfigSetup: undefined;
  ReynoldsTheory: undefined;
  FroudeCalc: undefined;
  OptionsScreenFroude: undefined;
  HistoryScreenFroude: undefined;
};

export type RootTabParamList = {
  HomeScreen: undefined;
  FavScreen: undefined;
  ProfileScreen: undefined;
  SettingsScreen: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const forFade = ({ current }: StackCardInterpolationProps) => ({
  cardStyle: {
    opacity: current.progress,
  },
});

const TAB_BAR_HEIGHT = 80;
const TAB_BUTTON_WIDTH = 64;
const TAB_BAR_PADDING = 8;

const iconMap: Record<string, string> = {
  HomeScreen: 'server',
  FavScreen: 'heart',
  ProfileScreen: 'user',
  SettingsScreen: 'settings',
};

const CustomTabBar = React.memo(({ state, descriptors, navigation }: BottomTabBarProps) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const { currentTheme } = useTheme();
  const tabBarBg = currentTheme === 'dark' ? 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))' : 'linear-gradient(to bottom, rgb(14,14,14), rgb(0,0,0))';
  const tabBarButton = currentTheme === 'dark' ? 'rgba(174, 174, 174, 0.02)' : 'rgba(174, 174, 174, 0.12)';

  React.useEffect(() => {
    const tabWidth = TAB_BUTTON_WIDTH + TAB_BAR_PADDING;
    const toValue = state.index * tabWidth + TAB_BAR_PADDING / 2;

    Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: true,
      bounciness: 10,
      speed: 15,
    }).start();
  }, [state.index, animatedValue]);

  const onPress = useCallback(
    (route: typeof state.routes[0], _isFocused: boolean) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(route.name as keyof RootTabParamList);
      }
    },
    [navigation]
  );

  return (
    <View style={styles.ScreenArea}>
      <View style={[styles.tabBarContainer, { experimental_backgroundImage: tabBarBg }]}>
        <Animated.View
          style={[
            styles.movingCircle,
            {
              transform: [{ translateX: animatedValue }],
            },
          ]}
        >
          <View style={[styles.RedBackgroundSquare, { backgroundColor: tabBarButton }]} />
          <MaskedView
            style={styles.maskedViewCircle}
            maskElement={
              <View style={styles.TransparentSquare} />
            }
          >
            <View style={styles.RedSquare} />
          </MaskedView>
        </Animated.View>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const iconName = iconMap[route.name] || 'circle';
          const iconColor = 'rgb(255, 255, 255)';
          const iconColor2 = 'rgba(255, 255, 255, 0.5)';

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => onPress(route, isFocused)}
              style={styles.tabButton}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
            >
              <View style={styles.tabButtonInner}>
                {isFocused ? (
                  <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        justifyContent: 'center',
                        alignItems: 'center',
                        filter: 'blur(4px)',
                      }}
                    >
                      <Icon name={iconName} size={22} color={iconColor2} />
                    </View>
                    <Icon name={iconName} size={22} color={iconColor} />
                  </View>
                ) : (
                  <MaskedView
                    style={styles.maskedView}
                    maskElement={
                      <View style={styles.maskElement}>
                        <Icon name={iconName} size={22} color="black" />
                      </View>
                    }
                  >
                    <View style={styles.maskedGradientBackground} />
                  </MaskedView>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="HomeScreen" component={HomeScreen} />
      <Tab.Screen name="FavScreen" component={FavScreen} />
      <Tab.Screen name="ProfileScreen" component={ProfileScreen} />
      <Tab.Screen name="SettingsScreen" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const App = () => {
  return (
    <KeyboardProvider>
      <LanguageProvider>
        <ThemeProvider>
          <FontSizeProvider>
            <DecimalSeparatorProvider>
              <PrecisionDecimalProvider>
                <NavigationContainer>
                  <StatusBar hidden/>
                  <Stack.Navigator 
                    initialRouteName="SplashScreen"
                    screenOptions={{
                      transitionSpec: {
                        open: { animation: 'timing', config: { duration: 250 } },
                        close: { animation: 'timing', config: { duration: 250 } },
                      },
                    }}
                  >
                    <Stack.Screen
                      name="SplashScreen"
                      component={SplashScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                      }}
                    />
                    <Stack.Screen
                      name="WelcomeScreen"
                      component={WelcomeScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                      }}
                    />
                    <Stack.Screen
                      name="ThemeInitialConfig"
                      component={ThemeInitialConfig}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                        transitionSpec: {
                          open: { animation: 'timing', config: { duration: 500 } },
                          close: { animation: 'timing', config: { duration: 250 } },
                        },
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen
                      name="SeparatorInitialConfig"
                      component={SeparatorInitialConfig}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                        transitionSpec: {
                          open: { animation: 'timing', config: { duration: 500 } },
                          close: { animation: 'timing', config: { duration: 250 } },
                        },
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen
                      name="PrecisionInitialConfig"
                      component={PrecisionInitialConfig}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                        transitionSpec: {
                          open: { animation: 'timing', config: { duration: 500 } },
                          close: { animation: 'timing', config: { duration: 250 } },
                        },
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen
                      name="InitialConfigSetup"
                      component={InitialConfigSetup}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: forFade,
                        transitionSpec: {
                          open: { animation: 'timing', config: { duration: 500 } },
                          close: { animation: 'timing', config: { duration: 250 } },
                        },
                        gestureEnabled: false,
                      }}
                    />
                    <Stack.Screen
                      name="MainTabs"
                      component={TabNavigator}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forScaleFromCenterAndroid,
                        transitionSpec: {
                          open: { animation: 'timing', config: { duration: 500 } },
                          close: { animation: 'timing', config: { duration: 500 } },
                        },
                      }}
                    />
                    <Stack.Screen
                      name="InfoScreen"
                      component={InfoScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="SearchScreen"
                      component={SearchScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="IdiomaScreen"
                      component={IdiomaScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="TemaScreen"
                      component={TemaScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="FuenteScreen"
                      component={FuenteScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="SeparadorDecimalScreen"
                      component={SeparadorDecimalScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="PrecisionDecimalScreen"
                      component={PrecisionDecimalScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="ContinuidadCalc"
                      component={ContinuidadCalc}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                      }}
                    />
                    <Stack.Screen
                      name="OptionsScreen"
                      component={OptionsScreen}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="HistoryScreenContinuidad"
                      component={HistoryScreenContinuidad}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="ContinuidadTheory"
                      component={ContinuidadTheory}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="BernoulliCalc"
                      component={BernoulliCalc}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                      }}
                    />
                    <Stack.Screen
                      name="ReynoldsCalc"
                      component={ReynoldsCalc}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                      }}
                    />
                    <Stack.Screen
                      name="OptionsScreenBernoulli"
                      component={OptionsScreenBernoulli}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="HistoryScreenBernoulli"
                      component={HistoryScreenBernoulli}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="BernoulliTheory"
                      component={BernoulliTheory}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="OptionsScreenReynolds"
                      component={OptionsScreenReynolds}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="HistoryScreenReynolds"
                      component={HistoryScreenReynolds}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="ColebrookCalc"
                      component={ColebrookCalc}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                      }}
                    />
                    <Stack.Screen
                      name="OptionsScreenColebrook"
                      component={OptionsScreenColebrook}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="HistoryScreenColebrook"
                      component={HistoryScreenColebrook}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="ReynoldsTheory"
                      component={ReynoldsTheory}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="FroudeCalc"
                      component={FroudeCalc}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                      }}
                    />
                    <Stack.Screen
                      name="OptionsScreenFroude"
                      component={OptionsScreenFroude}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                    <Stack.Screen
                      name="HistoryScreenFroude"
                      component={HistoryScreenFroude}
                      options={{
                        headerShown: false,
                        cardStyleInterpolator: CardStyleInterpolators.forRevealFromBottomAndroid,
                      }}
                    />
                  </Stack.Navigator>
                </NavigationContainer>
              </PrecisionDecimalProvider>           
            </DecimalSeparatorProvider>
          </FontSizeProvider>
        </ThemeProvider>
      </LanguageProvider>
    </KeyboardProvider>
  );
};

const styles = StyleSheet.create({
  ScreenArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    height: TAB_BAR_HEIGHT,
    width: 296,
    borderRadius: 40,
    justifyContent: 'center',
    gap: TAB_BAR_PADDING,
    marginBottom: 35,
  },
  tabButton: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: TAB_BUTTON_WIDTH / 2,
    backgroundColor: 'transparent',
  },
  tabButtonInner: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movingCircle: {
    position: 'absolute',
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    left: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  TransparentSquare: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    backgroundColor: 'transparent',
    borderRadius: TAB_BUTTON_WIDTH / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    position: 'absolute',
  },
  RedSquare: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(200, 200, 200) 10%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 90%',
    borderRadius: TAB_BUTTON_WIDTH / 2,
  },
  RedBackgroundSquare: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
    backgroundColor: 'rgba(174, 174, 174, 0.12)',
    position: 'absolute',
    borderRadius: TAB_BUTTON_WIDTH / 2,
  },
  maskedViewCircle: {
    width: TAB_BUTTON_WIDTH,
    height: TAB_BUTTON_WIDTH,
  },
  maskedView: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  maskElement: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  maskedGradientBackground: {
    width: 22,
    height: 22,
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgba(120, 120, 120, 1) 20%, rgba(80, 80, 80, 1) 80%)',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});

export default App;