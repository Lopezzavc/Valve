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
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import type {
  CalculatorOptionsScreenParams,
  SharedOptionItem,
  SharedOptionSection,
} from './optionsConfig';
import { SHARED_OPTIONS_REGISTRY } from './optionsConfig';

type RootStackParamList = {
  CalculatorOptionsScreen: CalculatorOptionsScreenParams | undefined;
};

type OptionItemProps = {
  item: SharedOptionItem;
  isSelected: boolean;
  onPress: (option: string) => void;
  textColor: string;
  textSelectedColor: string;
  checkColor: string;
  fontSizeFactor: number;
};

const OptionItem = React.memo(
  ({
    item,
    isSelected,
    onPress,
    textColor,
    textSelectedColor,
    checkColor,
    fontSizeFactor,
  }: OptionItemProps) => {
    const handlePress = useCallback(() => onPress(item.option), [onPress, item.option]);

    return (
      <Pressable
        onPress={handlePress}
        style={[styles.optionItem, isSelected && styles.selectedOptionItem]}
      >
        <View style={[styles.optionLeft, { flex: 1 }]}>
          <Text
            style={[
              styles.optionText,
              { color: textColor },
              { fontSize: 16 * fontSizeFactor },
              isSelected && [
                styles.selectedOptionText,
                { color: textSelectedColor },
              ],
            ]}
          >
            {item.label}
          </Text>
        </View>
        <View style={styles.optionRight}>
          {item.rightLabel ? (
            <Text
              numberOfLines={1}
              style={[
                styles.optionText,
                { color: textColor },
                { fontSize: 16 * fontSizeFactor },
                { textAlign: 'right' },
                isSelected && [
                  styles.selectedOptionText,
                  { color: textSelectedColor },
                ],
              ]}
            >
              {item.rightLabel}
            </Text>
          ) : null}
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
    prev.item.option === next.item.option &&
    prev.item.label === next.item.label &&
    prev.item.rightLabel === next.item.rightLabel &&
    prev.isSelected === next.isSelected &&
    prev.textColor === next.textColor &&
    prev.textSelectedColor === next.textSelectedColor &&
    prev.checkColor === next.checkColor &&
    prev.fontSizeFactor === next.fontSizeFactor,
);

const CalculatorOptionsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CalculatorOptionsScreen'>>();
  const params = route.params ?? { configKey: 'length' as const };

  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

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
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }

    return {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      checkIcon: 'rgb(0, 0, 0)',
      accentChip: 'rgb(194, 254, 12)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const config = SHARED_OPTIONS_REGISTRY[params.configKey];

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const flatItems = useMemo(
    () => (config?.kind === 'flat' ? config.getItems(t) : []),
    [config, t],
  );

  const sectionItems = useMemo<SharedOptionSection[]>(
    () => (config?.kind === 'sectioned' ? config.getSections(t) : []),
    [config, t],
  );

  const allOptions = useMemo(
    () =>
      config?.kind === 'sectioned'
        ? sectionItems.flatMap((section) => section.items.map((item) => item.option))
        : flatItems.map((item) => item.option),
    [config?.kind, flatItems, sectionItems],
  );

  const hasMatchingOption = useCallback(
    (candidate?: string) => {
      if (!candidate) {
        return false;
      }

      return allOptions.some((itemOption) =>
        config?.isSelected ? config.isSelected(itemOption, candidate) : itemOption === candidate,
      );
    },
    [allOptions, config],
  );

  const title = useMemo(
    () => t(params.titleKey ?? config?.titleKey ?? 'optionsScreen.titles.generic'),
    [config?.titleKey, params.titleKey, t],
  );

  const subtitle = useMemo(
    () => t(config?.subtitleKey ?? 'optionsScreen.subtitles.generic'),
    [config?.subtitleKey, t],
  );

  const [selectedOptionState, setSelectedOption] = useState<string>(
    hasMatchingOption(params.selectedOption)
      ? params.selectedOption || ''
      : allOptions[0] ?? params.selectedOption ?? '',
  );

  useEffect(() => {
    if (hasMatchingOption(params.selectedOption)) {
      setSelectedOption(params.selectedOption || '');
      return;
    }

    setSelectedOption((current) => {
      if (hasMatchingOption(current)) {
        return current;
      }

      return allOptions[0] ?? params.selectedOption ?? '';
    });
  }, [allOptions, hasMatchingOption, params.selectedOption]);

  const isSelected = useCallback(
    (itemOption: string) =>
      config?.isSelected
        ? config.isSelected(itemOption, selectedOptionState)
        : itemOption === selectedOptionState,
    [config, selectedOptionState],
  );

  const handleOptionSelect = useCallback(
    (option: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedOption(option);
      params.onSelectOption?.(option);
      navigation.goBack();
    },
    [navigation, params],
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: SharedOptionItem }) => (
      <OptionItem
        item={item}
        isSelected={isSelected(item.option)}
        onPress={handleOptionSelect}
        textColor={themeColors.text}
        textSelectedColor={themeColors.textStrong}
        checkColor={themeColors.checkIcon}
        fontSizeFactor={fontSizeFactor}
      />
    ),
    [
      fontSizeFactor,
      handleOptionSelect,
      isSelected,
      themeColors.checkIcon,
      themeColors.text,
      themeColors.textStrong,
    ],
  );

  const keyExtractor = useCallback((item: SharedOptionItem) => item.option, []);

  const ItemSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />,
    [themeColors.separator],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: 46,
      offset: 47 * index,
      index,
    }),
    [],
  );

  const renderOptionsBlock = useCallback(
    (items: SharedOptionItem[]) => (
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
            data={items}
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
            scrollEnabled={false}
          />
        </View>
      </View>
    ),
    [
      ItemSeparator,
      getItemLayout,
      keyExtractor,
      renderItem,
      selectedOptionState,
      themeColors.cardGradient,
      themeColors.gradient,
    ],
  );

  return (
    <ScrollView
      style={[styles.safeArea, { backgroundColor: themeColors.background }]}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
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

      <View style={styles.titlesContainer}>
        <Text
          style={[
            styles.subtitle,
            { color: themeColors.text },
            { fontSize: 18 * fontSizeFactor },
          ]}
        >
          {subtitle}
        </Text>
        <Text
          style={[
            styles.title,
            { color: themeColors.textStrong },
            { fontSize: 30 * fontSizeFactor },
          ]}
        >
          {title}
        </Text>
      </View>

      {config?.kind === 'sectioned'
        ? sectionItems.map((section) => (
            <React.Fragment key={section.key}>
              <View style={styles.titlesContainer}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: themeColors.text },
                    { fontSize: 18 * fontSizeFactor },
                  ]}
                >
                  {section.title}
                </Text>
              </View>
              {renderOptionsBlock(section.items)}
            </React.Fragment>
          ))
        : renderOptionsBlock(flatItems)}

      <View style={styles.spaceEndPage} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  spaceEndPage: {
    width: '100%',
    height: 100,
    backgroundColor: 'transparent',
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
  },
  separator: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginVertical: 0,
  },
  iconSelected: {
    backgroundColor: 'rgb(194, 254, 12)',
    borderRadius: 0,
  },
});

export default CalculatorOptionsScreen;
