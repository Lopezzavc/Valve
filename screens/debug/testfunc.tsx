import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import CustomKeyboardInput from '../../src/components/CustomKeyboardInput';
import { KeyboardProvider } from '../../contexts/KeyboardContext';

const TestFuncContent = () => {
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <CustomKeyboardInput
            value={value1}
            onChangeText={setValue1}
            placeholder="0.00"
            label="Primer valor:"
            inputId="input1"
          />
          
          <View style={styles.spacer} />
          
          <CustomKeyboardInput
            value={value2}
            onChangeText={setValue2}
            placeholder="0.00"
            label="Segundo valor:"
            inputId="input2"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const TestFunc = () => {
  return (
    <KeyboardProvider>
      <TestFuncContent />
    </KeyboardProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  spacer: {
    height: 20,
  },
});

export default TestFunc;