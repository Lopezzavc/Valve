import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useContext,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  SectionList,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import {
  FITTINGS_CATALOG,
  FittingItem,
  FittingGroup,
} from '../../../src/data/perdidasLocalizadasFittings';

// ─── Navigation types ─────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenPerdidasLocalizadas: {
    category: string;
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
};

// ─── Flat unit options ────────────────────────────────────────────────────────
const OPTIONS_DATA: Record<string, string[]> = {
  length: ['m', 'mm', 'cm', 'km', 'in', 'ft', 'yd', 'mi'],
  velocity: ['m/s', 'km/h', 'ft/s', 'mph', 'kn', 'cm/s', 'in/s'],
  acceleration: ['m/s²', 'ft/s²', 'g'],
};

// ─── i18n keys for screen titles & subtitles ──────────────────────────────────
const TITLE_I18N_KEY: Record<string, string> = {
  length:      'optionsScreen.titles.length',
  velocity:    'optionsScreen.titles.velocity',
  acceleration:'optionsScreen.titles.acceleration',
  fittingType: 'perdidasLocalizadasFittings.screenTitle',
};

const SUBTITLE_I18N_KEY: Record<string, string> = {
  length:      'optionsScreen.subtitles.units',
  velocity:    'optionsScreen.subtitles.units',
  acceleration:'optionsScreen.subtitles.units',
  fittingType: 'optionsScreen.subtitles.selection',
};

// ─── Shared OptionItem (used for all lists) ─────────────────────────────────
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
            <View
              style={[
                styles.iconSelected,
                { backgroundColor: 'rgb(194, 254, 12)' },
              ]}
            >
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
    prev.textSelectedColor=== next.textSelectedColor &&
    prev.checkColor       === next.checkColor       &&
    prev.fontSizeFactor   === next.fontSizeFactor
);

// ─── Main screen ──────────────────────────────────────────────────────────────
const OptionsScreenPerdidasLocalizadas: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<
    RouteProp<RootStackParamList, 'OptionsScreenPerdidasLocalizadas'>
  >();
  const params = route.params ?? { category: 'length' };

  const { currentTheme }   = useTheme();
  const { t }              = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  // ── Theme ────────────────────────────────────────────────────────────────
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background:   'rgb(12,12,12)',
        card:         'rgb(24,24,24)',
        text:         'rgb(235,235,235)',
        textStrong:   'rgb(250,250,250)',
        separator:    'rgba(255,255,255,0.12)',
        icon:         'rgb(245,245,245)',
        checkIcon:    'rgb(12,12,12)',
        sectionHeader:'rgba(45,45,45,1)',
        gradient:
          'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient:
          'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      background:   'rgba(255, 255, 255, 1)',
      card:         'rgba(255, 255, 255, 1)',
      text:         'rgb(0, 0, 0)',
      textStrong:   'rgb(0, 0, 0)',
      separator:    'rgb(235, 235, 235)',
      icon:         'rgb(0, 0, 0)',
      checkIcon:    'rgb(0, 0, 0)',
      sectionHeader:'rgb(245,245,245)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient:
        'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  // ── Params ────────────────────────────────────────────────────────────────
  const category          = params.category       ?? 'length';
  const onSelectOption    = params.onSelectOption;
  const selectedFromParams= params.selectedOption;

  const isFittingType = category === 'fittingType';

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // ── Flat options (unit categories) ────────────────────────────────────────
  const flatOptions = useMemo(
    () => (isFittingType ? [] : OPTIONS_DATA[category] ?? []),
    [category, isFittingType]
  );

  // ── Section data (fitting type catalog) ───────────────────────────────────
  // Transform catalog into sections with translated titles
  type SectionData = {
    title: string;        // translated group header
    groupKey: string;     // original group key for keyExtractor
    data: { item: FittingItem; option: string }[];
  };

  const sections = useMemo<SectionData[]>(() => {
    if (!isFittingType) return [];
    return FITTINGS_CATALOG.map((group: FittingGroup) => ({
      title: t(group.groupKey) || group.groupKey,
      groupKey: group.groupKey,
      data: group.items.map((fitting: FittingItem) => {
        const label = t(fitting.labelKey) || fitting.labelKey;
        return {
          item: fitting,
          // Convention expected by PerdidasLocalizadasCalc: "Label|K"
          option: `${label}|${fitting.K}`,
        };
      }),
    }));
  }, [isFittingType, t]);

  // ── Titles ────────────────────────────────────────────────────────────────
  const title = useMemo(
    () =>
      t(TITLE_I18N_KEY[category] ?? 'optionsScreen.titles.generic'),
    [category, t]
  );
  const subtitle = useMemo(
    () =>
      t(SUBTITLE_I18N_KEY[category] ?? 'optionsScreen.subtitles.generic'),
    [category, t]
  );

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedOption, setSelectedOption] = useState<string>(
    selectedFromParams ?? (isFittingType ? '' : flatOptions[0] ?? '')
  );

  // Keep flat selection valid if category changes
  useEffect(() => {
    if (!isFittingType && selectedOption && !flatOptions.includes(selectedOption)) {
      setSelectedOption(flatOptions[0] ?? '');
    }
  }, [flatOptions, isFittingType, selectedOption]);

  // ── Shared handler ────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (option: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedOption(option);
      onSelectOption?.(option);
      navigation.goBack();
    },
    [navigation, onSelectOption]
  );

  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

  // ── Flat list helpers (for unit categories) ───────────────────────────────
  const flatRenderItem = useCallback(
    ({ item }: { item: string }) => (
      <OptionItem
        option={item}
        displayLabel={item}          // unit symbols are universal
        isSelected={item === selectedOption}
        onPress={handleSelect}
        textColor={themeColors.text}
        textSelectedColor={themeColors.textStrong}
        checkColor={themeColors.checkIcon}
        fontSizeFactor={fontSizeFactor}
      />
    ),
    [selectedOption, handleSelect, themeColors, fontSizeFactor]
  );

  const flatKeyExtractor = useCallback((item: string) => item, []);

  const FlatSeparator = useCallback(
    () => (
      <View
        style={[styles.separator, { backgroundColor: themeColors.separator }]}
      />
    ),
    [themeColors.separator]
  );

  // ── Individual card renderer for fitting sections ─────────────────────────
  const renderFittingCard = useCallback(
    (section: SectionData) => {
      const renderItem = ({ item }: { item: { item: FittingItem; option: string } }) => {
        const displayLabel = t(item.item.labelKey) || item.item.labelKey;
        const kValue = `K = ${item.item.K}`;
        return (
          <Pressable
            onPress={() => handleSelect(item.option)}
            style={[styles.optionItem, item.option === selectedOption && styles.selectedOptionItem]}
          >
            <View style={styles.optionLeft}>
              <Text
                style={[
                  styles.optionText,
                  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
                  item.option === selectedOption && [
                    styles.selectedOptionText,
                    { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
                  ],
                ]}
              >
                {displayLabel}
              </Text>
            </View>
            <View style={styles.optionRight}>
              <Text
                style={[
                  styles.optionText,
                  { color: themeColors.text, fontSize: 14 * fontSizeFactor },
                  item.option === selectedOption && [
                    styles.selectedOptionText,
                    { color: themeColors.textStrong, fontSize: 14 * fontSizeFactor },
                  ],
                ]}
              >
                {kValue}
              </Text>
              {item.option === selectedOption && (
                <View
                  style={[
                    styles.iconSelected,
                    { backgroundColor: 'rgb(194, 254, 12)' },
                  ]}
                >
                  <Icon name="check" size={20} color={themeColors.checkIcon} />
                </View>
              )}
            </View>
          </Pressable>
        );
      };

      return (
        <View key={section.groupKey} style={styles.cardContainer}>
          <View
            style={[
              styles.cardMain,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
            <View
              style={[
                styles.cardInner,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient,
                },
              ]}
            >
              {/* Card Header - Section Title */}
              <View
                style={[
                  styles.cardHeader,
                  { backgroundColor: themeColors.sectionHeader },
                ]}
              >
                <Text
                  style={[
                    styles.cardHeaderText,
                    {
                      color: themeColors.textStrong,
                      fontSize: 13 * fontSizeFactor,
                    },
                  ]}
                >
                  {section.title.toUpperCase()}
                </Text>
              </View>

              {/* Card Content - List of fittings */}
              <FlatList
                data={section.data}
                keyExtractor={(item, index) => `${item.option}-${index}`}
                renderItem={renderItem}
                ItemSeparatorComponent={FlatSeparator}
                extraData={selectedOption}
                scrollEnabled={false} // Disable internal scrolling, use parent ScrollView
                initialNumToRender={section.data.length}
              />
            </View>
          </View>
        </View>
      );
    },
    [selectedOption, handleSelect, themeColors, fontSizeFactor, t, FlatSeparator]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View
      style={[styles.safeArea, { backgroundColor: themeColors.background }]}
    >
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollViewContent}
      showsVerticalScrollIndicator={false}
    >
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
              <Icon
                name="chevron-down"
                size={22}
                color={themeColors.icon}
              />
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
        {isFittingType ? (
          /* ── Multiple cards, one per section ── */
          sections.map(renderFittingCard)
        ) : (
          /* ── Single card for unit categories ── */
          <View style={styles.cardContainer}>
            <View
              style={[
                styles.cardMain,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            >
              <View
                style={[
                  styles.cardInner,
                  {
                    backgroundColor: 'transparent',
                    experimental_backgroundImage: themeColors.cardGradient,
                  },
                ]}
              >
                <FlatList
                  data={flatOptions}
                  keyExtractor={flatKeyExtractor}
                  renderItem={flatRenderItem}
                  ItemSeparatorComponent={FlatSeparator}
                  extraData={selectedOption}
                  scrollEnabled={false}
                  initialNumToRender={flatOptions.length}
                />
              </View>
            </View>
          </View>
        )}
        
        {/* Add bottom spacing for better scrolling experience */}
        <View style={styles.bottomSpacing} />
    </ScrollView>
    </View>
  );
};

// ─── Styles — adapted for multiple cards and global scroll ───────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 0,
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
    paddingHorizontal: 0,
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
  scrollView: {
    flexGrow: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  cardContainer: {
    marginBottom: 16,
    width: '100%',
  },
  cardMain: {
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  cardInner: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 13,
    marginBottom: 4,
    borderRadius: 10,
  },
  cardHeaderText: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 13,
    letterSpacing: 0.5,
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
    flex: 1,
    paddingRight: 8,
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
  bottomSpacing: {
    height: 40,
  },
});

export default OptionsScreenPerdidasLocalizadas;