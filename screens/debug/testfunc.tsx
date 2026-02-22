import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  SafeAreaView,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';

type Nav = StackNavigationProp<RootStackParamList>;

const MARQUEE_TEXT = 'Esta es una version Beta, es normal que hayan errores';
const GAP          = 40;
const SPEED        = 60;
const FONT_SIZE    = 16;
const STRIP_HEIGHT = 30;

const INITIAL_COPIES = 200;

const TestFunc: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();

  const unitRef   = useRef(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const measured  = useRef(false);

  const [copiesCount, setCopiesCount] = useState(INITIAL_COPIES);
  const [trackWidth, setTrackWidth]   = useState<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isAnimating) return;

    const unit     = unitRef.current;
    const duration = (unit / SPEED) * 1000;

    animValue.setValue(0);

    const anim = Animated.loop(
      Animated.timing(animValue, {
        toValue:         -unit,
        duration,
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
    );

    anim.start();
    return () => anim.stop();
  }, [isAnimating, animValue]);
  const handleFirstTextLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      if (measured.current) return;
      const textW = e.nativeEvent.layout.width;
      if (textW <= 0) return;

      measured.current = true;

      const unit   = textW + GAP;
      unitRef.current = unit;

      const count  = Math.ceil(screenWidth / unit) + 2;
      const tWidth = count * unit;

      setCopiesCount(count);
      setTrackWidth(tWidth);
      setIsAnimating(true);
    },
    [screenWidth],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Cabecera */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('MainTabs' as any)}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Icon name="server" size={24} color="#000" />
          </Pressable>
        </View>

        {/* Contenido */}
        <View style={styles.content}>
          <View style={styles.marqueeWrapper}>
            <View style={styles.clipView}>
              <Animated.View
                style={[
                  styles.marqueeTrack,
                  trackWidth !== undefined && { width: trackWidth },
                  isAnimating && { transform: [{ translateX: animValue }] },
                ]}
              >
                {Array.from({ length: copiesCount }).map((_, i) => (
                  <Text
                    key={i}
                    style={styles.marqueeText}
                    numberOfLines={1}
                    onLayout={i === 0 ? handleFirstTextLayout : undefined}
                  >
                    {MARQUEE_TEXT}
                  </Text>
                ))}
              </Animated.View>

            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal:  16,
    paddingTop:         40,
    backgroundColor:   '#fff',
  },
  backButton: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:          4,
    backgroundColor: 'rgba(194, 254, 12, 1)',
  },
  backButtonPressed: {
    opacity:          0.7,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  marqueeWrapper: {
    width:           '100%',
    height:           STRIP_HEIGHT,
    maxHeight:        STRIP_HEIGHT,
    backgroundColor: '#FFD700',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  clipView: {
    width:    '100%',
    height:    STRIP_HEIGHT,
    overflow: 'hidden',
  },
  marqueeTrack: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    height:         STRIP_HEIGHT,
  },
  marqueeText: {
    fontSize:           FONT_SIZE,
    color:              '#000',
    lineHeight:          STRIP_HEIGHT,
    includeFontPadding:  false,
    flexShrink:          0,
    marginRight:         GAP,
    fontFamily:         'HomeVideo-BLG6G',
  },
});

export default TestFunc;