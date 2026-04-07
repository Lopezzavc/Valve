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
import { useTheme } from '../../contexts/ThemeContext';
import {
  appendKeyboardKey,
  clearKeyboardValue,
  deleteKeyboardKey,
  formatKeyboardDisplayValue,
  insertKeyboardMinus,
  insertScientificNotation,
} from './customKeyboardHelpers';

interface CustomKeyboardInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
  inputId: string;
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
  const { currentTheme } = useTheme();
  const inputRef = useRef<View>(null);
  const isDark = currentTheme === 'dark';

  const isActive = activeInputId === inputId;

  const handleKeyPress = (key: string) => {
    const nextValue = appendKeyboardKey(value, key);
    if (nextValue !== null) {
      onChangeText(nextValue);
    }
  };

  const handleDelete = () => {
    onChangeText(deleteKeyboardKey(value));
  };

  const handleMultiplyBy10 = () => {
    const nextValue = insertScientificNotation(value);
    if (nextValue !== null) {
      onChangeText(nextValue);
    }
  };

  const handleDivideBy10 = () => {
    const nextValue = insertKeyboardMinus(value);
    if (nextValue !== null) {
      onChangeText(nextValue);
    }
  };

  const handleClear = () => {
    onChangeText(clearKeyboardValue());
  };

  const handleSubmit = () => {
    setActiveInputId(null);
    onBlur?.();
  };

  const handleInputPress = () => {
    setActiveInputId(inputId);
  };

  const inputColors = isDark
    ? {
        inputBg: 'rgba(30, 30, 30, 1)',
        inputText: 'rgb(235, 235, 235)',
        inputBorder: 'rgba(255, 255, 255, 0.12)',
        placeholderText: '#666',
        labelText: 'rgb(235, 235, 235)',
        keyboardBg: 'rgb(24, 24, 24)',
      }
    : {
        inputBg: '#f9f9f9',
        inputText: '#333',
        inputBorder: '#ddd',
        placeholderText: '#999',
        labelText: '#333',
        keyboardBg: '#f5f5f5',
      };

  return (
    <>
      <View ref={inputRef} style={styles.container}>
        {label && (
          <Text style={[styles.label, { color: inputColors.labelText }]}>
            {label}
          </Text>
        )}
        <Pressable onPress={handleInputPress}>
          <View pointerEvents="none">
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputColors.inputBg,
                  borderColor: inputColors.inputBorder,
                  color: inputColors.inputText,
                },
              ]}
              value={formatKeyboardDisplayValue(value)}
              placeholder={placeholder}
              placeholderTextColor={inputColors.placeholderText}
              editable={false}
              showSoftInputOnFocus={false}
            />
          </View>
        </Pressable>
      </View>

      {isActive && (
        <View style={[styles.keyboardWrapper, { backgroundColor: inputColors.keyboardBg }]}>
          <CustomKeyboard
            onKeyPress={handleKeyPress}
            onDelete={handleDelete}
            onSubmit={handleSubmit}
            onMultiplyBy10={handleMultiplyBy10}
            onDivideBy10={handleDivideBy10}
            onClear={handleClear}
            backgroundColor={inputColors.keyboardBg}
          />
        </View>
      )}
    </>
  );
};

interface CustomKeyboardProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onMultiplyBy10: () => void;
  onDivideBy10: () => void;
  onClear: () => void;
  backgroundColor?: string;
}

const CustomKeyboard: React.FC<CustomKeyboardProps> = ({
  onKeyPress,
  onDelete,
  onSubmit,
  onMultiplyBy10,
  onDivideBy10,
  onClear,
}) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const colors = isDark
    ? {
        keyBg: 'rgba(40, 40, 40, 1)',
        keyText: 'rgb(235, 235, 235)',
        extraKeyBg: 'rgba(40, 40, 40, 1)',
        extraKeyText: 'rgb(235, 235, 235)',
      }
    : {
        keyBg: '#ffffff',
        keyText: '#000000',
        extraKeyBg: '#ffffff',
        extraKeyText: '#000000',
      };

  const mainKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'delete'],
  ];

  const extraButtons = ['×10', '-', 'C', 'submit'];

  const handlePress = (key: string) => {
    if (key === 'delete') {
      onDelete();
      return;
    }

    onKeyPress(key);
  };

  const handleExtraPress = (button: string) => {
    switch (button) {
      case '×10':
        onMultiplyBy10();
        break;
      case '-':
        onDivideBy10();
        break;
      case 'C':
        onClear();
        break;
      case 'submit':
        onSubmit();
        break;
    }
  };

  const renderKeyContent = (key: string) => {
    if (key === 'delete') {
      return <Icon name="delete" size={24} color="#ffffff" />;
    }

    return <Text style={[styles.keyText, { color: colors.keyText }]}>{key}</Text>;
  };

  const renderExtraContent = (button: string, isSubmit: boolean) => {
    if (isSubmit) {
      return <IconAnt name="enter" size={24} color="#000000" />;
    }

    return (
      <Text style={[styles.extraKeyText, { color: colors.extraKeyText }]}>
        {button}
      </Text>
    );
  };

  return (
    <View
      style={[
        styles.keyboardContainer,
        { backgroundColor: isDark ? 'rgb(24, 24, 24)' : '#f5f5f5' },
      ]}
    >
      {mainKeys.map((row, rowIndex) => {
        const extraButton = extraButtons[rowIndex];
        const isSubmitButton = extraButton === 'submit';

        return (
          <View key={rowIndex} style={styles.keyboardRow}>
            <View style={styles.numericKeysContainer}>
              {row.map((key) => {
                const isDeleteKey = key === 'delete';
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.key,
                      { backgroundColor: isDeleteKey ? 'rgb(255, 50, 50)' : colors.keyBg },
                      pressed && styles.keyPressed,
                    ]}
                    onPress={() => handlePress(key)}
                  >
                    {renderKeyContent(key)}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.separator} />

            <Pressable
              style={({ pressed }) => [
                styles.extraKey,
                { backgroundColor: colors.extraKeyBg },
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
    marginBottom: 4,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
  },
  keyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    borderRadius: 8,
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  keyPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  keyText: {
    fontSize: 24,
    fontFamily: 'HomeVideo-BLG6G',
  },
  extraKey: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    borderRadius: 8,
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  extraKeyText: {
    fontSize: 20,
    fontFamily: 'HomeVideo-BLG6G',
  },
  submitExtraKey: {
    backgroundColor: 'rgba(194, 254, 12, 1)',
  },
});

const CustomKeyboardPanel = React.memo(CustomKeyboard);
export { CustomKeyboardPanel };
export default CustomKeyboardInput;
