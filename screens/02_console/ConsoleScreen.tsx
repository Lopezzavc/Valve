import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';

import type { RootStackParamList } from '../../App';

type NavigationProp = StackNavigationProp<RootStackParamList, 'ConsoleScreen'>;

const ConsoleScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.iconWrapper}>
          <Pressable style={styles.iconContainer} onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgb(0, 0, 0)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 45,
    backgroundColor: 'transparent',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  iconWrapper: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60,
    height: 40,
    borderRadius: 30,
    padding: 1,
  },
  iconContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConsoleScreen;
