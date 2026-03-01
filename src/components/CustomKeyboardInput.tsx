import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import IconAnt from 'react-native-vector-icons/AntDesign';
import { useKeyboard } from '../../contexts/KeyboardContext';
import Decimal from 'decimal.js';

interface CustomKeyboardInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
  inputId: string; // Nuevo: identificador único para cada input
}

const CustomKeyboardInput: React.FC<CustomKeyboardInputProps> = ({
  value,
  onChangeText,
  placeholder,
  label,
  onBlur,
  autoFocus = false,
  inputId,
}) => {
  const { activeInputId, setActiveInputId } = useKeyboard();
  const inputRef = useRef<View>(null);

  const isActive = activeInputId === inputId;

  const handleKeyPress = (key: string) => {
    onChangeText(value + key);
  };

  const handleDelete = () => {
    onChangeText(value.slice(0, -1));
  };

  const handleMultiplyBy10 = () => {
    if (value === '' || value === '.') return;
    const result = new Decimal(value).times(10).toString();
    onChangeText(result);
  };

  const handleDivideBy10 = () => {
    if (value === '' || value === '.') return;
    const result = new Decimal(value).dividedBy(10).toString();
    onChangeText(result);
  };

  const handleClear = () => {
    onChangeText('');
  };

  const handleSubmit = () => {
    setActiveInputId(null);
    onBlur?.();
  };

  const handleInputPress = () => {
    setActiveInputId(inputId);
  };

  return (
    <>
      <View ref={inputRef} style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Pressable onPress={handleInputPress}>
          <View pointerEvents="none">
            <TextInput
              style={styles.input}
              value={value}
              placeholder={placeholder}
              placeholderTextColor="#999"
              editable={false}
              showSoftInputOnFocus={false}
            />
          </View>
        </Pressable>
      </View>

      {isActive && (
        <View style={styles.keyboardWrapper}>
          <CustomKeyboard
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onSubmit={handleSubmit}
            onMultiplyBy10={handleMultiplyBy10}
            onDivideBy10={handleDivideBy10}
            onClear={handleClear}
          />
        </View>
      )}
    </>
  );
};

// El componente CustomKeyboard se mantiene igual que antes
const CustomKeyboard = ({ 
  onKeyPress, 
  onDelete, 
  onSubmit,
  onMultiplyBy10,
  onDivideBy10,
  onClear
}: { 
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onMultiplyBy10: () => void;
  onDivideBy10: () => void;
  onClear: () => void;
}) => {
  const mainKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const extraButtons = ['×10', '÷10', 'C', '✓'];

  const handlePress = (key: string) => {
    if (key === '⌫') {
      onDelete();
    } else {
      onKeyPress(key);
    }
  };

  const handleExtraPress = (button: string) => {
    switch (button) {
      case '×10':
        onMultiplyBy10();
        break;
      case '÷10':
        onDivideBy10();
        break;
      case 'C':
        onClear();
        break;
      case '✓':
        onSubmit();
        break;
    }
  };

  const renderKeyContent = (key: string) => {
    if (key === '⌫') {
      return <Icon name="delete" size={24} color="#333" />;
    }
    return <Text style={styles.keyText}>{key}</Text>;
  };

  const renderExtraContent = (button: string, isSubmit: boolean) => {
    if (isSubmit) {
      return <IconAnt name="enter" size={24} color="#000000" />;
    }
    return <Text style={styles.extraKeyText}>{button}</Text>;
  };

  return (
    <View style={styles.keyboardContainer}>
      {mainKeys.map((row, rowIndex) => {
        const extraButton = extraButtons[rowIndex];
        const isSubmitButton = extraButton === '✓';
        
        return (
          <View key={rowIndex} style={styles.keyboardRow}>
            <View style={styles.numericKeysContainer}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.key,
                    pressed && styles.keyPressed,
                  ]}
                  onPress={() => handlePress(key)}
                >
                  {renderKeyContent(key)}
                </Pressable>
              ))}
            </View>
            
            <View style={styles.separator} />
            
            <Pressable
              style={({ pressed }) => [
                styles.extraKey,
                isSubmitButton && styles.submitExtraKey,
                pressed && styles.keyPressed,
              ]}
              onPress={() => handleExtraPress(extraButton)}
            >
              {renderExtraContent(extraButton, isSubmitButton)}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  keyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
  },
  keyboardContainer: {
    width: '100%',
    paddingVertical: 5,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  keyboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
    width: '100%',
  },
  numericKeysContainer: {
    flex: 3,
    flexDirection: 'row',
    gap: 6,
  },
  separator: {
    width: 0,
    height: 45,
    backgroundColor: '#ddd',
    marginHorizontal: 2,
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 2,
  },
  keyPressed: {
    backgroundColor: '#e0e0e0',
    transform: [{ scale: 0.98 }],
  },
  keyText: {
    fontSize: 24,
    color: '#000000',
    fontFamily: 'HomeVideo-BLG6G',
  },
  extraKey: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 2,
  },
  extraKeyText: {
    fontSize: 20,
    color: '#000000',
    fontFamily: 'HomeVideo-BLG6G',
  },
  submitExtraKey: {
    backgroundColor: 'rgba(194, 254, 12, 1)',
  },
});

const CustomKeyboardPanel = React.memo(CustomKeyboard);
export { CustomKeyboardPanel };