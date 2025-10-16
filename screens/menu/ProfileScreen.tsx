import React, { useMemo, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { Pressable } from 'react-native';
import Icon2 from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const ProfileScreen = () => {
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const handleLogoutPress = () => {
    Toast.show({
      type: 'info',
      text1: 'Sin funcionalidad :(',
    });
  };

  const themeColors = useMemo(() => {
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

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
            >
              <Icon2 name="log-out" size={20} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.favTitlesContainer}>
        <Text style={[styles.favSubtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
          Valve
        </Text>
        <Text
          style={[
            styles.favTitle,
            { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor },
          ]}
        >
          {t('profile.title')}
        </Text>
      </View>

      <View style={styles.container}>
        <View style={styles.subtitleContainer}>
          <Text
            accessibilityRole="header"
            style={[styles.title]}
          >
            {t('profileScreen.oops')}
          </Text>
        </View>
        <View>
          <Text style={[styles.subtitle, { color: themeColors.text }]}>
            {t('profileScreen.desc')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    marginTop: 10,
    marginBottom: 70,
    flex: 1,
  },
  title: {
    fontSize: 40,
    fontFamily: 'HomeVideo-BLG6G',
    letterSpacing: 0,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Regular',
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginTop: 10,
  },
  subtitleContainer: {
    backgroundColor: 'rgb(194, 254, 12)',
    padding: 5,
    paddingHorizontal: 10,
  },
  favTitlesContainer: {
    backgroundColor: 'transparent',
    marginVertical: 0,
    paddingHorizontal: 20,
    marginBottom: -10,
    marginTop: 0,
  },
  favSubtitle: {
    color: 'rgb(0, 0, 0)',
    fontSize: 18,
    fontFamily: 'SFUIDisplay-Bold',
  },
  favTitle: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: -10,
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
});

export default ProfileScreen;