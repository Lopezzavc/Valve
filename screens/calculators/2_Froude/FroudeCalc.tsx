import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FroudeCalc = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Froude</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default FroudeCalc;