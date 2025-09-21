import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

type RootStackParamList = {
  OptionsScreen: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
};

// Datos estáticos (con valores internos SIN traducir para no romper la lógica)
const OPTIONS_DATA: Record<string, string[]> = {
  length: ['m', 'mm', 'cm', 'km', 'in', 'ft', 'yd', 'mi'],
  velocity: ['m/s', 'km/h', 'ft/s', 'mph', 'kn', 'cm/s', 'in/s'],
  area: ['m²', 'cm²', 'mm²', 'km²', 'ha', 'in²', 'ft²', 'yd²', 'mi²', 'acre'],
  sectionType: ['Circular', 'Cuadrada', 'Rectangular'],
  fillType: ['Total', 'Parcial'],
};

// Claves de título/subtítulo (aprovecha claves previas y añade mínimas nuevas para longitud/área/unidades)
const TITLE_I18N_KEY: Record<string, string> = {
  length: 'optionsScreen.titles.length',
  velocity: 'continuidadCalc.labels.velocity',
  area: 'optionsScreen.titles.area',
  sectionType: 'continuidadCalc.labels.sectionType',
  fillType: 'continuidadCalc.labels.fillType',
};
const SUBTITLE_I18N_KEY: Record<string, string> = {
  length: 'optionsScreen.subtitles.units',
  velocity: 'optionsScreen.subtitles.units',
  area: 'optionsScreen.subtitles.units',
  sectionType: 'optionsScreen.subtitles.selection',
  fillType: 'optionsScreen.subtitles.selection',
};

// Componente de fila memoizado
type OptionItemProps = {
  option: string;               // valor interno (no traducido)
  displayLabel: string;         // texto visible traducido
  isSelected: boolean;
  onPress: (option: string) => void;
  textColor: string;
  textSelectedColor: string;
  checkColor: string;
  fontSizeFactor: number;
};

const OptionItem = React.memo(
  ({ option, displayLabel, isSelected, onPress, textColor, textSelectedColor, checkColor, fontSizeFactor }: OptionItemProps) => {
    const handlePress = useCallback(() => onPress(option), [onPress, option]);

    return (
      <Pressable
        onPress={handlePress}
        style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
      >
        <View style={styles.optionLeft}>
          <Text
            style={[
              styles.optionText,
              { color: textColor },
              { fontSize: 16 * fontSizeFactor },
              isSelected && [
                styles.selectedOptionText,
                { color: textSelectedColor },
                { fontSize: 18 * fontSizeFactor },
              ],
            ]}
          >
            {displayLabel}
          </Text>
        </View>
        <View style={styles.optionRight}>
          {isSelected && (
            <View style={styles.iconSelected}>
              <Icon name="check" size={20} color={checkColor} />
            </View>
          )}
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.option === next.option &&
    prev.displayLabel === next.displayLabel &&
    prev.isSelected === next.isSelected &&
    prev.textColor === next.textColor &&
    prev.textSelectedColor === next.textSelectedColor &&
    prev.checkColor === next.checkColor &&
    prev.fontSizeFactor === next.fontSizeFactor
);

const OptionsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OptionsScreen'>>();
  const params = route.params ?? { category: 'length' };

  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  // Paleta mínima dependiente de tema (solo colores)
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        checkIcon: 'rgb(12,12,12)',
        accentChip: 'rgb(194, 254, 12)',
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    // light
    return {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      checkIcon: 'rgb(0, 0, 0)',
      accentChip: 'rgb(194, 254, 12)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const category = params.category ?? 'length';
  const onSelectOption = params.onSelectOption;
  const selectedFromParams = params.selectedOption;

  // Habilitar LayoutAnimation en Android
  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const options = useMemo(() => OPTIONS_DATA[category] ?? [], [category]);

  // Título/subtítulo traducidos
  const title = useMemo(() => t(TITLE_I18N_KEY[category] ?? 'optionsScreen.titles.generic'), [category, t]);
  const subtitle = useMemo(() => t(SUBTITLE_I18N_KEY[category] ?? 'optionsScreen.subtitles.generic'), [category, t]);

  // Estado de selección (sin cambios en la lógica)
  const [selectedOptionState, setSelectedOption] = useState<string>(
    selectedFromParams && options.includes(selectedFromParams)
      ? selectedFromParams
      : options[0] ?? ''
  );

  // Mantener selección válida si cambia la categoría
  useEffect(() => {
    if (selectedOptionState && !options.includes(selectedOptionState)) {
      setSelectedOption(options[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const handleOptionSelect = useCallback(
    (option: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedOption(option);
      onSelectOption?.(option);    // devuelve el VALOR INTERNO (sin traducir)
      navigation.goBack();
    },
    [navigation, onSelectOption]
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Mapea el valor interno etiqueta traducida solo para mostrar
  const getDisplayLabel = useCallback((cat: string, value: string): string => {
    if (cat === 'sectionType') {
      switch (value) {
        case 'Circular': return t('continuidadCalc.options.sectionType.circular');
        case 'Cuadrada': return t('continuidadCalc.options.sectionType.square');
        case 'Rectangular': return t('continuidadCalc.options.sectionType.rectangular');
        default: return value;
      }
    }
    if (cat === 'fillType') {
      switch (value) {
        case 'Total': return t('continuidadCalc.options.fillType.total');
        case 'Parcial': return t('continuidadCalc.options.fillType.partial');
        default: return value;
      }
    }
    // length, velocity, area son símbolos/unidades; se muestran tal cual
    return value;
  }, [t]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <OptionItem
        option={item}
        displayLabel={getDisplayLabel(category, item)}
        isSelected={item === selectedOptionState}
        onPress={handleOptionSelect}
        textColor={themeColors.text}
        textSelectedColor={themeColors.textStrong}
        checkColor={themeColors.checkIcon}
        fontSizeFactor={fontSizeFactor}
      />
    ),
    [selectedOptionState, handleOptionSelect, themeColors.text, themeColors.textStrong, themeColors.checkIcon, category, getDisplayLabel, fontSizeFactor]
  );

  const keyExtractor = useCallback((item: string) => item, []);
  const ItemSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />,
    [themeColors.separator]
  );
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 46,
      offset: 47 * index,
      index,
    }),
    []
  );

  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Header sin texto; botón alineado a la derecha */}
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View
            style={[
              styles.iconWrapper,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
            <Pressable
              style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
              onPress={handleGoBack}
            >
              <Icon name="chevron-down" size={22} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Contenedor de títulos */}
      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: themeColors.text }, { fontSize: 18 * fontSizeFactor }]}>{subtitle}</Text>
        <Text style={[styles.title, { color: themeColors.textStrong }, { fontSize: 30 * fontSizeFactor }]}>{title}</Text>
      </View>

      {/* Lista de opciones */}
      <View
        style={[
          styles.optionsContainerMain,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View style={[styles.optionsContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}>
          <FlatList
            data={options}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            extraData={selectedOptionState}
            initialNumToRender={12}
            windowSize={5}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={16}
            removeClippedSubviews
            getItemLayout={getItemLayout}
          />
        </View>
      </View>
    </View>
  );
};

// Styles (sin cambios funcionales)
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
  optionsContainerMain: {
    padding: 1,
    marginHorizontal: 20,
    marginTop: 0,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 3,
  },

  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    borderRadius: 10,
    minHeight: 45,
    backgroundColor: 'transparent',
  },
  selectedOptionItem: {
    backgroundColor: 'transparent',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionText: {
    fontSize: 16,
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Medium',
  },
  selectedOptionText: {
    color: 'rgb(0, 0, 0)',
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 18,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 0,
  },
  iconSelected: {
    backgroundColor: 'rgb(194, 254, 12)',
  },
});

export default OptionsScreen;