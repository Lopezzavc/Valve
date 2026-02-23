import React, { memo, useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, InteractionManager } from 'react-native';
import Icon2 from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
// import MathView from 'react-native-math-view';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

const REFERENCES: Array<{ title: string; author: string; year: string; url: string }> = [
  {
    title: 'DOE Fundamentals Handbook: Fluid Flow',
    author: 'Department of Energy',
    year: '1992',
    url: 'https://engineeringlibrary.org/reference/bernoullis-equation-fluid-flow-doe-handbook',
  },
  {
    title: 'FLUID MECHANICS',
    author: 'Prof. Dr. Atıl BULU',
    year: 's.f.',
    url: 'https://web.itu.edu.tr/~bulu/fluid_mechanics_files/lecture_notes_04.pdf',
  },
  {
    title: 'The Bernoulli Principle - Pump Ed 101',
    author: 'Joe Evans',
    year: '2012',
    url: 'https://www.pumpsandsystems.com/bernoulli-principle',
  },
];

const EQ_BASIC = String.raw`p_1 + \frac{1}{2}\rho v_1^2 + \rho g z_1 = p_2 + \frac{1}{2}\rho v_2^2 + \rho g z_2`;
const EQ_GENERAL = String.raw`p + \frac{1}{2}\rho v^2 + \rho g z = \text{constante}`;
const EQ_HEAD = String.raw`H = z + \frac{v^2}{2g} + \frac{p}{\rho g}`;
const EQ_EXTENDED = String.raw`z_1 + \frac{v_1^2}{2g} + \frac{p_1}{\rho g} + H_p = z_2 + \frac{v_2^2}{2g} + \frac{p_2}{\rho g} + H_f`;
const EQ_ENTHALPY = String.raw`h + \frac{1}{2}v^2 + gz = \text{constante}`;
const EQ_POTENTIAL = String.raw`\frac{\partial \phi}{\partial t} + \frac{1}{2}|\nabla \phi|^2 + \frac{p}{\rho} + gz = \text{constante}`;

type EquationProps = { math: string; containerStyle: any; ready: boolean; textColor: string };

type ReferenceItemProps = { 
  title: string; 
  author: string; 
  year: string; 
  url: string; 
  textColor: string;
  subtitleColor: string;
  backgroundColor: string;
  gradient: string;
  fontSizeFactor: number;
};
const ReferenceItem = memo(({ title, author, year, url, textColor, subtitleColor, backgroundColor, gradient, fontSizeFactor }: ReferenceItemProps) => {
  const onPress = useCallback(() => {
    return Linking.openURL(url).catch(() => {
    });
  }, [url]);

  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      <View style={[styles.contentBox, { experimental_backgroundImage: gradient }]}>
        <View style={[styles.innerBox, { backgroundColor }]}>
          <View style={styles.cardText}>
            <View style={styles.titleContainerRef}>
              <Text style={[styles.titleText, { color: textColor, fontSize: 16 * fontSizeFactor }]}>{title}</Text>
            </View>
            <Text style={[styles.subtitleText, { color: subtitleColor, fontSize: 14 * fontSizeFactor }]}>{author} ({year})</Text>
          </View>

          <View style={styles.iconContainer2} pointerEvents="none">
            <Icon2 name="external-link" size={20} color={'black'} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});
ReferenceItem.displayName = 'ReferenceItem';

const BernoulliTheory = () => {
  const navigation = useNavigation();
  const [equationsReady, setEquationsReady] = useState(false);
  const { currentTheme } = useTheme();
  const { t, selectedLanguage } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const themeColors = React.useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 1)',
      card: 'rgba(255, 255, 255, 1)',
      text: 'rgb(0, 0, 0)',
      textStrong: 'rgb(0, 0, 0)',
      separator: 'rgb(235, 235, 235)',
      icon: 'rgb(0, 0, 0)',
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    };
  }, [currentTheme]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setEquationsReady(true);
    });
    return () => task.cancel();
  }, []);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const references = useMemo(() => REFERENCES, []);

  return (
    <ScrollView style={[styles.safeArea, { backgroundColor: themeColors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerContainer}>
        <View style={styles.leftIconsContainer}>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
            <Pressable style={[styles.iconContainer, { backgroundColor: themeColors.card }]} onPress={goBack}>
              <Icon2 name="chevron-left" size={20} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
        <View style={styles.rightIconsContainer} />
      </View>

      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>{t('theoryBernoulli.subtitle')}</Text>
        <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('theoryBernoulli.titles.mainTitle')}</Text>
      </View>

      <View style={[styles.contentSection, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph1')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph2')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph3')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph4')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph5')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph6')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph7')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph8')}
        </Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph9')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph10')}
        </Text>

        <Text style={[styles.titleInsideText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('theoryBernoulli.titles.title1')}</Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph11')}
        </Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph12')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph13')}
        </Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph14')}
        </Text>

        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph15')}
        </Text>

        <Text style={[styles.titleInsideText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('theoryBernoulli.titles.title2')}</Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph16')}
        </Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph17')}
        </Text>
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryBernoulli.paragraphs.paragraph18')}
        </Text>

        <Text style={[styles.titleReferencesText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>{t('theoryContinuity.titles.references')}</Text>
        {references.map((ref) => (
          <ReferenceItem
            key={ref.url}
            title={ref.title}
            author={ref.author}
            year={ref.year}
            url={ref.url}
            textColor={themeColors.text}
            subtitleColor={currentTheme === 'dark' ? 'rgb(170, 170, 170)' : 'rgb(170, 170, 170)'}
            backgroundColor={themeColors.card}
            gradient={themeColors.gradient}
            fontSizeFactor={fontSizeFactor}
          />
        ))}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

export default memo(BernoulliTheory);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgb(255, 255, 255)',
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
  leftIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 0,
    gap: 8,
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
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
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
    marginBottom: -10,
    marginTop: 10,
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
  titleInsideText: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: 10,
    marginBottom: -10,
  },
  contentSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  paragraph: {
    color: 'rgb(0, 0, 0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Regular',
    marginTop: 20,
    lineHeight: 24,
  },
  paragraphBold: {
    color: 'rgb(0, 0, 0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: 0,
    lineHeight: 24,
  },
  containerEquation: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    paddingHorizontal: '0%',
    marginBottom: -20,
  },
  containerEquation2: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    width: 300,
    alignSelf: 'center',
    marginBottom: -20,
  },
  containerEquation3: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    width: 400,
    alignSelf: 'center',
    marginBottom: -20,
  },
  containerEquationShorter: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    paddingHorizontal: '35%',
    marginBottom: -20,
  },
  containerEquationShorterbutnotsoshorter: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    paddingHorizontal: '25%',
    marginBottom: -20,
  },
  containerEquationShorterbutnotsoshorter2: {
    backgroundColor: 'transparent',
    paddingVertical: 30,
    paddingHorizontal: '30%',
    marginBottom: -20,
  },
  spacer: {
    height: 100,
  },
  titleReferencesText: {
    color: 'rgb(0, 0, 0)',
    fontSize: 30,
    fontFamily: 'SFUIDisplay-Bold',
    marginTop: 30,
    marginBottom: 0,
  },
  contentBox: {
    minHeight: 70,
    width: '100%',
    experimental_backgroundImage: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
    padding: 1,
    marginTop: 10,
  },
  innerBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'black',
  },
  subtitleText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 14,
    color: 'rgb(170, 170, 170)',
    marginTop: -5,
  },
  iconContainer2: {
    right: 20,
    position: 'absolute',
    backgroundColor: 'rgb(194, 254, 12)',
    padding: 3,
  },
  titleContainerRef: {
    
    marginRight: 40,
    marginTop: 0,
  },
  cardText: {
    backgroundColor: 'transparent',
    marginRight: 30,
  },
});