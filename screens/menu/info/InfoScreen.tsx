import React, { useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

const InfoScreen = () => {
  const navigation = useNavigation();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  return (
    <View style={styles.safeArea}>
      <ScrollView>
        <View style={styles.headerContainer}>
          <View style={styles.iconWrapper}>
            <Pressable
              style={styles.iconContainer}
              onPress={() => navigation.goBack()}
            >
              <Icon name="chevron-left" size={22} color="rgba(255, 255, 255, 1)" />
              <Icon
                name="chevron-left"
                size={22}
                color="rgba(255, 255, 255, 0.5)"
                style={{
                  position: 'absolute',
                  filter: 'blur(4px)',
                }}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.containerMain}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>VALVE</Text>
          </View>
          <View style={styles.titleContainer2}>
            <Text style={styles.titleText2}>2025</Text>
          </View>
        </View>
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { fontSize: 15 * fontSizeFactor }]}>Pre-Alpha 2.4.2 [Build 26]</Text>
        </View>
        <View style={{ height: 150 }} />
      </ScrollView>
      <View style={styles.creditsContainer}>
        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>
          <Text style={styles.boldText}>{t('infoScreen.creadoPor')}</Text>
        </Text>
        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>Vanesa Alejandra Martínez</Text>
        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>Andrés Felipe López</Text>

        <View style={styles.separation}/>

        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>
          <Text style={styles.boldText}>VALVE Mobile App</Text>
        </Text>
        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>
          Andrés Felipe López <Text style={styles.boldText}>Developer</Text>
        </Text>
        <View style={styles.separation}/>

        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>
          Jesus Manuel Aray <Text style={styles.boldText}> Beta Tester</Text>
        </Text>
        <Text style={[styles.creditsText, { fontSize: 16 * fontSizeFactor }]}>
          Erik Steven Polanía <Text style={styles.boldText}> Beta Tester</Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 45,
    marginTop: 30,
    backgroundColor: 'transparent',
  },
  iconWrapper: {
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(200, 200, 200) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
    width: 60,
    borderRadius: 30,
    marginHorizontal: 0,
    padding: 1,
  },
  iconContainer: {
    backgroundColor: 'rgb(20, 20, 20)',
    padding: 8,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerMain: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  titleContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  titleContainer2: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingBottom: 30.5,
    marginLeft: 5,
  },
  titleText: {
    fontSize: 60,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgba(255, 255, 255, 1)',
  },
  titleText2: {
    fontSize: 20,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgba(255, 255, 255, 1)',
  },
  versionContainer: {
    marginLeft: 20,
    marginTop: -20,
  },
  versionText: {
    fontSize: 15,
    fontFamily: 'SFUIDisplay-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  creditsContainer: {
    position: 'absolute',
    bottom: 35,
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
  },
  creditsText: {
    fontFamily: 'SFUIDisplay-Light',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
    lineHeight: 17,
  },
  boldText: {
    fontFamily: 'SFUIDisplay-Medium',
    color: 'rgba(255, 255, 255, 1)',
  },
  separation: {
    minWidth: 10,
    minHeight: 10,
  }
});

export default InfoScreen;