import React from 'react';
import { ImageBackground, StyleSheet, View, StatusBar } from 'react-native';

const BG = require('./assets/reference.png');

export default function BackgroundScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.bg}>
        <View style={styles.header}>
          <View style={styles.headerLeft}></View>
          <View style={styles.headerRightContainer}>
            <View style={styles.headerRight}></View>
            <View style={styles.headerRight}></View>
          </View>
        </View>
        <View style={styles.titles}>
          <View style={styles.subtitle}/>
          <View style={styles.title}/>
        </View>
        <View style={styles.results}>
          <View style={styles.resultsMain}>
            <View style={styles.resultsPhoto}/>
          </View>
        </View>
        <View style={styles.circularButtons}>
          <View style={styles.buttonContainer}>
            <View style={styles.Buttons}/>
            <View style={styles.buttonText}/>
          </View>
          <View style={styles.buttonContainer}>
            <View style={styles.Buttons}/>
            <View style={styles.buttonText}/>
          </View>
          <View style={styles.buttonContainer}>
            <View style={styles.Buttons}/>
            <View style={styles.buttonText}/>
          </View>
          <View style={styles.buttonContainer}>
            <View style={styles.Buttons}/>
            <View style={styles.buttonText}/>
          </View>
        </View>
        <View style={styles.inputsContainer}>
          <View style={styles.inputsText}/>
          <View style={styles.inputsText2}/>
          <View style={styles.inputContainer}>
            <View style={styles.inputsMain}/>
            <View style={styles.inputs2}/>
          </View>
          <View style={styles.inputsText3}/>
          <View style={styles.inputContainer}>
            <View style={styles.inputsMain}/>
            <View style={styles.inputs2}/>
          </View>

          <View style={styles.section2}>
            <View style={styles.inputsTextSection2}/>
            <View style={styles.inputsText2}/>
            <View style={styles.inputContainer}>
              <View style={styles.inputsMain}/>
              <View style={styles.inputs2}/>
            </View>
            <View style={styles.inputsText3}/>
            <View style={styles.inputContainer}>
              <View style={styles.inputsMain}/>
              <View style={styles.inputs2}/>
            </View>
            
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(0, 0, 0)'
  },
  bg: {
    flex: 1,
  },
  bgImage: {
    opacity: 0.94
  },
  header: {
    height: 40,
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 35,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRightContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  headerLeft: {
    height: 40,
    width: 60,
    backgroundColor: 'rgb(60, 60, 60)',
    borderRadius: 25,
  },
  headerRight: {
    height: 40,
    width: 40,
    backgroundColor: 'rgb(60, 60, 60)',
    borderRadius: 25,
  },
  titles: {
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 15,
    gap: 8,
  },
  subtitle: {
    height: 15,
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  title: {
    height: 21,
    width: 290,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  results: {
    backgroundColor: 'transparent',
    marginVertical: 24,
    marginHorizontal: 20,
  },
  resultsMain: {
    backgroundColor: 'rgba(60, 60, 60, 1)',
    height: 115,
    borderRadius: 25,
  },
  resultsPhoto: {
    flex: 1,
    backgroundColor: 'rgba(196, 224, 225, 1)',
    marginTop: 30,
    borderRadius: 25,
  },
  circularButtons: {
    backgroundColor: 'transparent',
    marginHorizontal: 62,
    marginTop: -4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  Buttons: {
    height: 63,
    width: 63,
    backgroundColor: 'rgba(60, 60, 60, 1)',
    borderRadius: 100,
  },
  buttonText: {
    height: 10,
    width: 50,
    marginTop: -5,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  inputsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    width: '100%',
    flex: 1,
    marginTop: 22,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingTop: 30,
  },
  inputsText: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 170,
  },
  inputsTextSection2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 190,
  },
  inputsText2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 70,
    marginTop: 16,
  },
  inputsText3: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 15,
    width: 180,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputsMain: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 49,
    marginTop: 8,
    width: '68%',
    borderRadius: 100,
  },
  inputs2: {
    backgroundColor: 'rgba(225, 225, 225, 1)',
    height: 49,
    marginTop: 8,
    width: '29%',
    borderRadius: 100,
  },
  section2: {
    marginTop: 40,
  },
});