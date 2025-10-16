import React, { useEffect, useMemo, useState, useCallback, useContext, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, DeviceEventEmitter, Animated, LayoutChangeEvent } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../contexts/ThemeContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { getDBConnection } from '../../src/services/database';
import { LanguageContext } from '../../contexts/LanguageContext';
import MathView from 'react-native-math-view';
import { calculatorsDef } from '../../src/data/calculators';

type RootStackParamList = {
  ContinuidadCalc: undefined;
  BernoulliCalc: undefined;
  ReynoldsCalc: undefined;
  ColebrookCalc: undefined;
  [key: string]: any;
};

type Favorite = {
  id?: number;
  route: string;
  label: string;
  created_at?: number;
};

const BAR_WIDTH = 4;
const RIGHT_OFFSET = 7;
const LEFT_TARGET = 7;

const FavScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { t } = useContext(LanguageContext);

  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        textDesc: 'rgba(135, 135, 135, 1)',
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
      textDesc: 'rgba(120, 120, 120, 1)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
    };
  }, [currentTheme]);

  const [favs, setFavs] = useState<Favorite[]>([]);

  const ensureFavoritesTable = useCallback(async (db: any) => {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        created_at REAL NOT NULL
      );
    `);
    await db.executeSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_route ON favorites(route);
    `);
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const db = await getDBConnection();
      await ensureFavoritesTable(db);
      const [res] = await db.executeSql(
        `SELECT id, route, label, created_at FROM favorites ORDER BY created_at DESC;`
      );
      const out: Favorite[] = [];
      for (let i = 0; i < res.rows.length; i++) {
        out.push(res.rows.item(i));
      }
      setFavs(out);
    } catch {
      setFavs([]);
    }
  }, [ensureFavoritesTable]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('favorites/changed', () => {
      loadFavorites();
    });
    return () => sub.remove();
  }, [loadFavorites]);

  const clearAllFavorites = useCallback(async () => {
    const db = await getDBConnection();
    await ensureFavoritesTable(db);
    await db.executeSql(`DELETE FROM favorites;`);
    setFavs([]);
    DeviceEventEmitter.emit('favorites/changed');
  }, [ensureFavoritesTable]);

  const confirmClearAll = useCallback(() => {
    Alert.alert(
      'Eliminar favoritos',
      'Â¿Deseas desmarcar todas las pantallas como favoritas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: clearAllFavorites },
      ],
      { cancelable: true }
    );
  }, [clearAllFavorites]);

  const getCardData = (route: string) => {
    const calc = calculatorsDef.find(
      (c: any) => c.route === route || c.id === route
    );
  
    if (calc) {
      return {
        title: t(calc.titleKey) ?? calc.id ?? route,
        desc: t(calc.descKey) ?? calc.desc ?? '',
        equation: calc.math ?? '',
        containerStyle: styles.containerEq,
      };
    }
  
    return {
      title: 'Unknown',
      desc: 'Unknown calculator',
      equation: '',
      containerStyle: styles.containerEq,
    };
  };

  const FavoriteCard = ({ item }: { item: Favorite }) => {
    const [boxW, setBoxW] = useState(0);
    const [open, setOpen] = useState(false);
    const translateX = useRef(new Animated.Value(0)).current;
    const animListenerIdRef = useRef<string | null>(null);
    const hasNavigatedRef = useRef(false);

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
            navigation.navigate(item.route as any);
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

    const cardData = getCardData(item.route);

    return (
      <View style={styles.buttonContainer}>
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <Pressable
            style={[
              styles.contentBox,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
            onPress={toggleCard}
          >
            <View
              style={[
                styles.innerBox,
                { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient },
              ]}
              onLayout={onLayoutInner}
            >
              <Animated.View
                style={[styles.textsContainer, { transform: [{ translateX }] }]}
              >
                <View>
                  <View style={styles.titleContainerRef}>
                    <Text
                      style={[
                        styles.titleText,
                        { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
                      ]}
                    >
                      {cardData.title}
                    </Text>
                  </View>
                  <View style={styles.descContainer}>
                    <Text
                      style={[
                        styles.subtitleText,
                        { color: themeColors.textDesc, fontSize: 14 * fontSizeFactor },
                      ]}
                    >
                      {cardData.desc}
                    </Text>
                  </View>
                </View>

                {boxW > 0 && (
                  <View
                    style={[
                      styles.helloPane,
                      { left: -barToLeftDelta, width: contentW },
                    ]}
                  >
                    <View style={cardData.containerStyle}>
                      <MathView math={cardData.equation} style={{ color: themeColors.text }} />
                    </View>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                style={[styles.verticalBar, { transform: [{ translateX }] }]}
              />
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderFav = ({ item }: { item: Favorite }) => {
    return <FavoriteCard item={item} />;
  };

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name="hard-drive"
        size={50}
        color={currentTheme === 'dark' ? 'rgb(120, 120, 120)' : 'rgb(180, 180, 180)'}
      />
      <Text
        style={[
          styles.emptyText,
          {
            color: currentTheme === 'dark' ? 'rgb(170, 170, 170)' : 'rgb(180, 180, 180)',
            fontSize: 16 * fontSizeFactor,
          },
        ]}
      >
        {t('favorites.noFavorites')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { backgroundColor: themeColors.card }]}
              onPress={confirmClearAll}
            >
              <Icon name="trash" size={20} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
          Valve
        </Text>
        <Text
          style={[
            styles.title,
            { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor },
          ]}
        >
          {t('favorites.title')}
        </Text>
      </View>

      {favs.length === 0 ? (
        <EmptyComponent />
      ) : (
        <FlatList
          data={favs}
          keyExtractor={(it) => `${it.route}`}
          renderItem={renderFav}
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingTop: 10,
            paddingBottom: 20,
          }}
        />
      )}
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
    marginBottom: -10,
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
  buttonContainer: {
    alignItems: 'center',
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: 'rgb(180, 180, 180)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  contentBox: {
    minHeight: 90,
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
    fontFamily: 'SFUIDisplay-Bold',
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
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 60,
  },
  containerEq2: {
    backgroundColor: 'transparent',
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 10,
  },
  containerEq3: {
    backgroundColor: 'transparent',
    width: '80%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 0,
  },
  containerEq4: {
    backgroundColor: 'transparent',
    width: '90%',
    height: '90%',
    justifyContent: 'center',
    alignContent: 'center',
    paddingHorizontal: 0,
  },
});

export default FavScreen;