import React, { useEffect, useMemo, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, DeviceEventEmitter } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../contexts/ThemeContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { getDBConnection } from '../../src/services/database';
import { LanguageContext } from '../../contexts/LanguageContext';

type RootStackParamList = {
  ContinuidadCalc: undefined;
  [key: string]: any;
};

type Favorite = {
  id?: number;
  route: string;
  label: string;
  created_at?: number;
};

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
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
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
      '¿Deseas desmarcar todas las pantallas como favoritas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: clearAllFavorites },
      ],
      { cancelable: true }
    );
  }, [clearAllFavorites]);

  const renderFav = ({ item }: { item: Favorite }) => {
    return (
      <View style={styles.buttonRow}>
        <Pressable
          style={styles.continuityButton}
          onPress={() => navigation.navigate(item.route as any)}
        >
          <Text style={styles.continuityButtonText}>{item.label}</Text>
        </Pressable>
      </View>
    );
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
            paddingHorizontal: 20,
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
  buttonRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  continuityButton: {
    backgroundColor: 'rgb(194, 254, 12)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
  },
  continuityButtonText: {
    fontSize: 16,
    color: 'rgb(0, 0, 0)',
    fontWeight: '500',
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
});

export default FavScreen;