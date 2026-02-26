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

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------
type RootStackParamList = {
  OptionsScreenFactorFriccion: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
};

// ---------------------------------------------------------------------------
// Static options data
// ---------------------------------------------------------------------------
const OPTIONS_DATA: Record<string, string[]> = {
  // Length units — used for ε (absolute roughness) and D (diameter)
  length: ['m', 'mm', 'cm', 'km', 'in', 'ft', 'yd', 'mi'],

  // Friction factor equations
  equation: [
    'colebrook-white',
    'haaland',
    'swamee-jain',
    'churchill',
    'serghides',
    'blasius',
    'von-karman',
  ],
};

// ---------------------------------------------------------------------------
// i18n key maps for screen titles and subtitles
// ---------------------------------------------------------------------------
const TITLE_I18N_KEY: Record<string, string> = {
  length:   'optionsScreen.titles.length',
  equation: 'factorFriccionCalc.labels.equation',
};

const SUBTITLE_I18N_KEY: Record<string, string> = {
  length:   'optionsScreen.subtitles.units',
  equation: 'optionsScreen.subtitles.selection',
};

// ---------------------------------------------------------------------------
// Memoized option row
// ---------------------------------------------------------------------------
type OptionItemProps = {
  option: string;
  displayLabel: string;
  isSelected: boolean;
  onPress: (option: string) => void;
  textColor: string;
  textSelectedColor: string;
  checkColor: string;
  fontSizeFactor: number;
};

const OptionItem = React.memo(
  ({
    option,
    displayLabel,
    isSelected,
    onPress,
    textColor,
    textSelectedColor,
    checkColor,
    fontSizeFactor,
  }: OptionItemProps) => {
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
              { color: textColor, fontSize: 16 * fontSizeFactor },
              isSelected && [
                styles.selectedOptionText,
                { color: textSelectedColor, fontSize: 18 * fontSizeFactor },
              ],
            ]}
          >
            {displayLabel}
          </Text>
        </View>
        <View style={styles.optionRight}>
          {isSelected && (
            <View style={[styles.iconSelected, { backgroundColor: 'rgb(194, 254, 12)' }]}>
              <Icon name="check" size={20} color={checkColor} />
            </View>
          )}
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.option           === next.option           &&
    prev.displayLabel     === next.displayLabel     &&
    prev.isSelected       === next.isSelected       &&
    prev.textColor        === next.textColor        &&
    prev.textSelectedColor === next.textSelectedColor &&
    prev.checkColor       === next.checkColor       &&
    prev.fontSizeFactor   === next.fontSizeFactor
);

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
const OptionsScreenFactorFriccion = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OptionsScreenFactorFriccion'>>();
  const params = route.params ?? { category: 'length' };

  const { currentTheme } = useTheme();
  const { t }            = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background:  'rgb(12,12,12)',
        card:        'rgb(24,24,24)',
        text:        'rgb(235,235,235)',
        textStrong:  'rgb(250,250,250)',
        separator:   'rgba(255,255,255,0.12)',
        icon:        'rgb(245,245,245)',
        checkIcon:   'rgb(12,12,12)',
        gradient:
          'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient:
          'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      background:  'rgba(255, 255, 255, 1)',
      card:        'rgba(255, 255, 255, 1)',
      text:        'rgb(0, 0, 0)',
      textStrong:  'rgb(0, 0, 0)',
      separator:   'rgb(235, 235, 235)',
      icon:        'rgb(0, 0, 0)',
      checkIcon:   'rgb(0, 0, 0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient:
        'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  // ── Params ─────────────────────────────────────────────────────────────────
  const category         = params.category        ?? 'length';
  const onSelectOption   = params.onSelectOption;
  const selectedFromParams = params.selectedOption;

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const options = useMemo(() => OPTIONS_DATA[category] ?? [], [category]);

  // Screen titles from i18n
  const title    = useMemo(
    () => t(TITLE_I18N_KEY[category]    ?? 'optionsScreen.titles.generic'),
    [category, t]
  );
  const subtitle = useMemo(
    () => t(SUBTITLE_I18N_KEY[category] ?? 'optionsScreen.subtitles.generic'),
    [category, t]
  );

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedOptionState, setSelectedOption] = useState<string>(
    selectedFromParams && options.includes(selectedFromParams)
      ? selectedFromParams
      : options[0] ?? ''
  );

  // Keep selection valid if category ever changes at runtime
  useEffect(() => {
    if (selectedOptionState && !options.includes(selectedOptionState)) {
      setSelectedOption(options[0] ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOptionSelect = useCallback(
    (option: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedOption(option);
      onSelectOption?.(option);
      navigation.goBack();
    },
    [navigation, onSelectOption]
  );

  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  // ── Display labels ─────────────────────────────────────────────────────────
  // - `equation` values use the factorFriccionCalc.equations.* i18n keys
  // - `length` values are universal symbols — shown as-is
  const getDisplayLabel = useCallback(
    (cat: string, value: string): string => {
      if (cat === 'equation') {
        return (
          t(`factorFriccionCalc.equations.${value}`) || value
        );
      }
      // length, area — universal symbols
      return value;
    },
    [t]
  );

  // ── FlatList helpers ───────────────────────────────────────────────────────
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
    [
      selectedOptionState,
      handleOptionSelect,
      themeColors.text,
      themeColors.textStrong,
      themeColors.checkIcon,
      category,
      getDisplayLabel,
      fontSizeFactor,
    ]
  );

  const keyExtractor = useCallback((item: string) => item, []);

  const ItemSeparator = useCallback(
    () => (
      <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
    ),
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.safeArea, { backgroundColor: themeColors.background }]}>

      {/* ── Header ── */}
      <View style={styles.headerContainer}>
        <View style={styles.rightIconsContainer}>
          <View
            style={[
              styles.iconWrapper,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
            <Pressable
              style={[
                styles.iconContainer,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient,
                },
              ]}
              onPress={handleGoBack}
            >
              <Icon name="chevron-down" size={22} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Titles ── */}
      <View style={styles.titlesContainer}>
        <Text
          style={[
            styles.subtitle,
            { color: themeColors.text, fontSize: 18 * fontSizeFactor },
          ]}
        >
          {subtitle}
        </Text>
        <Text
          style={[
            styles.title,
            { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor },
          ]}
        >
          {title}
        </Text>
      </View>

      {/* ── Options list ── */}
      <View
        style={[
          styles.optionsContainerMain,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View
          style={[
            styles.optionsContainer,
            {
              backgroundColor: 'transparent',
              experimental_backgroundImage: themeColors.cardGradient,
            },
          ]}
        >
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

// ---------------------------------------------------------------------------
// Styles — pixel-perfect copy of OptionsScreenGeometria / OptionsScreenEnergiaBernoulli
// ---------------------------------------------------------------------------
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
    borderRadius: 0,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptionsScreenFactorFriccion;