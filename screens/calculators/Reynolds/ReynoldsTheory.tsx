import React, { memo, useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, InteractionManager } from 'react-native';
import Icon2 from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import MathView from 'react-native-math-view';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

const REFERENCES: Array<{ title: string; author: string; year: string; url: string }> = [
  {
    title: 'An Experimental Investigation of the Circumstances which Determine whether the Motion of Water shall be Direct or Sinuous',
    author: 'Osborne Reynolds',
    year: '1883',
    url: 'https://royalsocietypublishing.org/doi/10.1098/rstl.1883.0029',
  },
  {
    title: 'Reynolds Number',
    author: 'NASA',
    year: '2021',
    url: 'https://www.grc.nasa.gov/www/k-12/airplane/reynolds.html',
  },
  {
    title: 'Fluid Mechanics Fundamentals and Applications',
    author: 'Yunus A. Çengel & John M. Cimbala',
    year: '2018',
    url: 'https://www.example.com',
  },
];

// Ecuaciones de ejemplo - Reemplaza con las ecuaciones que necesites
const EQ_REYNOLDS = String.raw`Re = \frac{\rho v L}{\mu} = \frac{v L}{\nu}`;
const EQ_EXAMPLE2 = String.raw`\frac{\partial u}{\partial t} + u \frac{\partial u}{\partial x} = -\frac{1}{\rho}\frac{\partial p}{\partial x} + \nu \frac{\partial^2 u}{\partial x^2}`;
const EQ_EXAMPLE3 = String.raw`Re_c \approx 2300`;

type EquationProps = { math: string; containerStyle: any; ready: boolean; textColor: string };
const Equation = memo(({ math, containerStyle, ready, textColor }: EquationProps) => {
  return (
    <View style={containerStyle}>
      {ready ? (
        <MathView math={math} style={{ color: textColor }} />
      ) : (
        <Text selectable={false} accessibilityElementsHidden>
        </Text>
      )}
    </View>
  );
});

type ReferenceItemProps = { 
  title: string; 
  author: string; 
  year: string; 
  url: string; 
  textColor: string;
  subtitleColor: string;
  cardGradient: string;
  gradient: string;
  fontSizeFactor: number;
};
const ReferenceItem = memo(({ title, author, year, url, textColor, subtitleColor, cardGradient, gradient, fontSizeFactor }: ReferenceItemProps) => {
  const onPress = useCallback(() => {
    return Linking.openURL(url).catch(() => {
    });
  }, [url]);

  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      <View style={[styles.contentBox, { experimental_backgroundImage: gradient }]}>
        <View style={[
          styles.innerBox, 
          { experimental_backgroundImage: cardGradient, backgroundColor: 'transparent' }
        ]}>
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

const ReynoldsTheory = () => {
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
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
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
        <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
          {t('theoryReynolds.subtitle')}
        </Text>
        <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('theoryReynolds.titles.mainTitle')}
        </Text>
      </View>

      <View style={[styles.contentSection, { backgroundColor: themeColors.background }]}>
        {/* Párrafo introductorio */}
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryReynolds.paragraphs.paragraph1')}
        </Text>

        {/* Ecuación 1 */}
        <Equation 
          math={EQ_REYNOLDS} 
          containerStyle={styles.containerEquation} 
          ready={equationsReady} 
          textColor={themeColors.text}
        />

        {/* Más párrafos */}
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryReynolds.paragraphs.paragraph2')}
        </Text>

        {/* Subtítulo 1 */}
        <Text style={[styles.titleInsideText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('theoryReynolds.titles.title1')}
        </Text>
        
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryReynolds.paragraphs.paragraph3')}
        </Text>

        <Equation 
          math={EQ_EXAMPLE2} 
          containerStyle={styles.containerEquation} 
          ready={equationsReady} 
          textColor={themeColors.text}
        />

        {/* Subtítulo 2 */}
        <Text style={[styles.titleInsideText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('theoryReynolds.titles.title2')}
        </Text>
        
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryReynolds.paragraphs.paragraph4')}
        </Text>

        <Equation 
          math={EQ_EXAMPLE3} 
          containerStyle={styles.containerEquationShorter} 
          ready={equationsReady} 
          textColor={themeColors.text}
        />

        {/* Más contenido según necesites */}
        <Text style={[styles.paragraph, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
          {t('theoryReynolds.paragraphs.paragraph5')}
        </Text>

        {/* Título de Referencias */}
        <Text style={[styles.titleReferencesText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('theoryReynolds.titles.references')}
        </Text>

        {/* Lista de referencias */}
        {references.map((ref) => (
          <ReferenceItem
            key={ref.url}
            title={ref.title}
            author={ref.author}
            year={ref.year}
            url={ref.url}
            textColor={themeColors.text}
            subtitleColor={currentTheme === 'dark' ? 'rgb(170, 170, 170)' : 'rgb(170, 170, 170)'}
            cardGradient={themeColors.cardGradient}
            gradient={themeColors.gradient}
            fontSizeFactor={fontSizeFactor}
          />
        ))}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

export default memo(ReynoldsTheory);

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
    backgroundColor: 'transparent',
    marginRight: 40,
    marginTop: 0,
  },
  cardText: {
    backgroundColor: 'transparent',
    marginRight: 30,
  },
});