// screens/menu/search/SearchScreen.tsx
import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  FlatList, 
  Image, 
  Keyboard,
  Animated,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Icon2 from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../../App';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { ThemeContext } from '../../../contexts/ThemeContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import { CommonActions } from '@react-navigation/native';

import { calculatorsDef } from '../../../src/data/calculators';

// Importar la imagen del easter egg
const EASTER_EGG_IMAGE = require('../../../assets/easter_egg/IMG_8677.webp'); // Ajusta la ruta según tu estructura de carpetas

const { width, height } = Dimensions.get('window');

type Nav = StackNavigationProp<RootStackParamList>;

const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'rgb(194, 254, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontFamily: 'SFUIDisplay-Bold',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'SFUIDisplay-Medium',
      }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: 'rgb(254, 12, 12)' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontFamily: 'SFUIDisplay-Medium',
      }}
      text2Style={{
        fontSize: 14,
        fontFamily: 'SFUIDisplay-Medium',
      }}
    />
  ),
};

type SortMode = 'none' | 'asc' | 'desc';

const SearchScreen = () => {
  const navigation = useNavigation<Nav>();
  const { t } = useContext(LanguageContext);
  const { currentTheme } = useContext(ThemeContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  // Estados para el easter egg
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const themeColors = {
    light: {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      textDesc: 'rgba(120, 120, 120, 1)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      accentChip: 'rgb(194, 254, 12)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    },
    dark: {
      background: 'rgb(12,12,12)',
      card: 'rgb(24,24,24)',
      text: 'rgb(235,235,235)',
      textStrong: 'rgb(250,250,250)',
      textDesc: 'rgba(135, 135, 135, 1)',
      separator: 'rgba(255,255,255,0.12)',
      icon: 'rgb(245,245,245)',
      accentChip: 'rgb(194, 254, 12)',
      gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
      cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    },
  } as const;

  const colors = themeColors[currentTheme === 'dark' ? 'dark' : 'light'];

  const calculators = useMemo(() => {
    return calculatorsDef.map(c => ({
      id: c.id,
      title: t(c.titleKey) ?? c.id,
      desc: t(c.descKey) ?? '',
      route: c.route,
      icon: c.icon,
      math: c.math,
    }));
  }, [t]);

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('none');

  useEffect(() => {
    if (query === '310807' && !showEasterEgg) {
      Keyboard.dismiss();
      setShowEasterEgg(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (query.toLowerCase() === 'testfunc') {
      setQuery('');

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'testFunc' as any }],
        })
      );

    }
  }, [query, showEasterEgg, navigation]);

  const handleCloseEasterEgg = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEasterEgg(false);
      setQuery('');
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = !q ? calculators : calculators.filter(c => (c.title ?? '').toLowerCase().includes(q));
    if (sortMode === 'asc') {
      base = [...base].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'desc') {
      base = [...base].sort((a, b) => (b.title ?? '').localeCompare(a.title ?? '', undefined, { sensitivity: 'base' }));
    }
    return base;
  }, [query, calculators, sortMode]);

  const handleToggleSort = () => {
    const next: SortMode = sortMode === 'none' ? 'asc' : sortMode === 'asc' ? 'desc' : 'none';
    setSortMode(next);
    Toast.show({
      type: 'success',
      text1: t('search.sort.toastTitle'),
      text2: next === 'asc' ? t('search.sort.az') : next === 'desc' ? t('search.sort.za') : t('search.sort.reset'),
    });
  };

  const renderItem = ({ item }: { item: typeof calculators[number] }) => (
    <Pressable
      onPress={() => navigation.navigate(item.route as any)}
      style={[styles.cardWrapper, { experimental_backgroundImage: colors.gradient }]}
    >
      <View style={[styles.cardInner, { backgroundColor: colors.card, experimental_backgroundImage: colors.cardGradient }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textStrong, fontSize: 16 * fontSizeFactor }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Icon name="chevron-right" size={18} color={colors.icon} />
        </View>
        <Text
          style={[styles.cardDesc, { color: colors.textDesc, fontSize: 14 * fontSizeFactor }]}
          numberOfLines={2}
        >
          {item.desc}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper2, { experimental_backgroundImage: colors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { experimental_backgroundImage: colors.cardGradient }]}
              onPress={handleToggleSort}
            >
              <Icon2 name="filter" size={20} color={colors.icon} />
            </Pressable>
          </View>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: colors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { experimental_backgroundImage: colors.cardGradient }]}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-down" size={22} color={colors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: colors.text, fontSize: 18 * fontSizeFactor }]}>
          {t('search.title')}
        </Text>
        <Text style={[styles.title, { color: colors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('search.title2')}
        </Text>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.redContainer}>
          <View style={[styles.ContainerSearch, { experimental_backgroundImage: colors.gradient }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: colors.card }]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    fontSize: 16 * fontSizeFactor,
                    paddingRight: 44,
                  },
                ]}
                placeholder={t('search.placeholder') ?? 'Buscar...'}
                placeholderTextColor={currentTheme === 'dark'
                  ? 'rgba(255, 255, 255, 0.35)'
                  : 'rgba(0, 0, 0, 0.35)'}
                editable
              />
              <View pointerEvents="none" style={styles.searchIconContainer}>
                <Icon name="search" size={20} color={currentTheme === 'dark' ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)'} />
              </View>
            </View>
          </View>
        </View>
      </View>
      
      {filtered.length === 0 ? (
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Text style={{ opacity: 0.6, fontFamily: 'SFUIDisplay-Regular' }}>
            {t('search.emptyPrefix')} “{query}”.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Easter Egg Overlay */}
      {showEasterEgg && (
        <Animated.View 
          style={[
            styles.easterEggContainer,
            {
              opacity: fadeAnim,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }
          ]}
        >
          <Pressable 
            style={styles.easterEggPressable}
            onPress={handleCloseEasterEgg}
          >
            <Animated.View
              style={[
                styles.easterEggImageContainer,
                {
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <Image
                source={EASTER_EGG_IMAGE}
                style={styles.easterEggImage}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}

      <Toast config={toastConfig} position="bottom" />
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgb(255, 255, 255)' },
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
    gap: 5,
  },
  iconWrapper: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 60,
    height: 40,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
  },
  iconWrapper2: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    width: 40,
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
    fontFamily: 'SFUIDisplay-Bold'
  },
  title: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: -10
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: -5,
    backgroundColor: 'transparent'
  },
  redContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    paddingHorizontal: 0,
    width: '100%',
    gap: 10,
    flexDirection: 'row'
  },
  ContainerSearch: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    justifyContent: 'center', height: 50, overflow: 'hidden', borderRadius: 25, padding: 1, width: '100%',
  },
  innerWhiteContainer: { backgroundColor: 'white', width: '100%', height: '100%', justifyContent: 'center', borderRadius: 25, position: 'relative' },
  input: {
    height: 50,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    fontFamily: 'SFUIDisplay-Medium',
    marginTop: 2.75,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)'
  },
  searchIconContainer: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  listContent: {
    padding: 20,
    paddingTop: 12
  },
  cardWrapper: {
    minHeight: 90,
    width: '100%',
    borderRadius: 25,
    padding: 1,
  },
  cardInner: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  cardTitle: {
    fontFamily: 'Alliance No.2 SemiBold'
  },
  cardDesc: {
    fontFamily: 'SFUIDisplay-Regular'
  },
  // Estilos para el easter egg
  easterEggContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  easterEggPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  easterEggImageContainer: {
    width: width * 0.95,
    height: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  easterEggImage: {
    width: '100%',
    height: '100%',
  },
});