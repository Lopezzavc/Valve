import React, { memo, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon2 from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

// ─── Ecuación LaTeX ──────────────────────────────────────────────────────────
const LATEX_EQUATION = "R = \\frac{\\rho V D}{\\mu}";

// ─── HTML del WebView ────────────────────────────────────────────────────────
const buildEquationHTML = (latex: string, isDark: boolean, initialTerm: string): string => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 18px 20px;
    width: 100%;
  }
  #equation {
    font-size: 2em;
    color: ${isDark ? 'rgb(235,235,235)' : 'rgb(0,0,0)'};
    white-space: nowrap;
  }
  .mjx-selected {
    background: rgba(194, 254, 12, 1) !important;
    border-radius: 0px;
    outline: 3px solid rgba(194, 254, 12, 1);
    color: ${isDark ? 'rgb(0, 0, 0)' : 'inherit'} !important;
  }
  mjx-mi, mjx-mo, mjx-mn, mjx-mtext {
    cursor: pointer;
  }
</style>
<script>
  window.MathJax = {
    tex: { inlineMath: [['$','$']] },
    options: { skipHtmlTags: ['script','noscript','style','textarea','pre'] },
    startup: {
      ready() {
        MathJax.startup.defaultReady();
        MathJax.startup.promise.then(() => {
          attachListeners();
          // Seleccionar el término inicial después de que MathJax haya renderizado
          setTimeout(() => {
            selectInitialTerm(${JSON.stringify(initialTerm)});
          }, 100);
          reportHeight();
        });
      }
    }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async></script>
</head>
<body>
<div id="equation"></div>
<script>
  document.getElementById('equation').innerHTML = '$' + ${JSON.stringify(latex)} + '$';

  var selected = null;
  var tokens = [];
  var currentIndex = -1;

  function reportHeight() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'height', value: h })
    );
  }

  function notify(term) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'selected', value: term })
    );
  }

  function selectToken(index) {
    if (tokens.length === 0) return;
    if (selected) selected.classList.remove('mjx-selected');
    if (index < 0 || index >= tokens.length) {
      selected = null;
      currentIndex = -1;
      notify('none');
      return;
    }
    currentIndex = index;
    selected = tokens[currentIndex];
    selected.classList.add('mjx-selected');
    notify(selected.textContent.trim());
  }

  // NUEVA FUNCIÓN: Seleccionar término por texto
  function selectInitialTerm(termText) {
    if (tokens.length === 0) return;
    
    // Buscar el índice del token que coincida con el texto buscado
    const index = tokens.findIndex(tok => 
      tok.textContent.trim() === termText
    );
    
    if (index !== -1) {
      selectToken(index);
    } else {
      // Si no encuentra el término exacto, seleccionar el primero
      console.log('Término no encontrado, seleccionando el primero');
      selectToken(0);
    }
  }

  function attachListeners() {
    var container = document.getElementById('equation');
    tokens = Array.from(container.querySelectorAll('mjx-mi, mjx-mo, mjx-mn, mjx-mtext'));
    tokens.forEach(function(tok, i) {
      tok.addEventListener('click', function(e) {
        e.stopPropagation();
        selectToken(currentIndex === i ? -1 : i);
      });
    });
  }

  window.goNext = function() {
    if (tokens.length === 0) return;
    var next = currentIndex < tokens.length - 1 ? currentIndex + 1 : 0;
    selectToken(next);
  };

  window.goPrev = function() {
    if (tokens.length === 0) return;
    var prev = currentIndex > 0 ? currentIndex - 1 : tokens.length - 1;
    selectToken(prev);
  };

  window.addEventListener('resize', reportHeight);
</script>
</body>
</html>
`;

// ─── Componente ──────────────────────────────────────────────────────────────
const ReynoldsTheory = ({ initialSelectedTerm = 'R' }: { initialSelectedTerm?: string }) => {
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const webViewRef = useRef<WebView>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>('none');
  const [webViewHeight, setWebViewHeight] = useState<number>(100); // ALTURA DEL WEBVIEW

  // CORRECCIÓN:
  const [isWebViewReady, setIsWebViewReady] = useState(false); // ← AÑADIR ESTO ANTES
  
  const handleWebViewLoad = useCallback(() => {
    setIsWebViewReady(true);
  }, []);

  // Actualizar el handleWebViewMessage para incluir logs de depuración
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && typeof data.value === 'number') {
        setWebViewHeight(Math.max(data.value, 80));
      } else if (data.type === 'selected') {
        setSelectedTerm(data.value);
      }
    } catch (_) {}
  }, []);

  const isDark = currentTheme === 'dark';

  const themeColors = React.useMemo(() => {
    if (isDark) {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        selectedAccent: 'rgb(194, 254, 12)',
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
      selectedAccent: 'rgb(80,160,0)',
    };
  }, [isDark]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleNext = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.goNext(); true;');
  }, []);

  const handlePrev = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.goPrev(); true;');
  }, []);

  const equationHTML = React.useMemo(
    () => buildEquationHTML(LATEX_EQUATION, isDark, initialSelectedTerm),
    [isDark, initialSelectedTerm]
  );

  return (
    <ScrollView
      style={[styles.safeArea, { backgroundColor: themeColors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.leftIconsContainer}>
          <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
            <Pressable
              style={[styles.iconContainer, { backgroundColor: themeColors.card }]}
              onPress={goBack}
            >
              <Icon2 name="chevron-left" size={20} color={themeColors.icon} />
            </Pressable>
          </View>
        </View>
        <View style={styles.rightIconsContainer} />
      </View>

      {/* Títulos */}
      <View style={styles.titlesContainer}>
        <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
          {t('reynoldsTheory.subtitle')}
        </Text>
        <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('reynoldsTheory.title')}
        </Text>
      </View>

      {/* ── Ecuación LaTeX ── */}
      <View style={[styles.equationContainer, { borderColor: themeColors.separator }]}>
        <WebView
          ref={webViewRef}
          source={{ html: equationHTML }}
          style={[styles.webView, { height: webViewHeight }]}
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onMessage={handleWebViewMessage}
          onLoad={handleWebViewLoad}  // AÑADIR ESTA LÍNEA
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          cacheEnabled={false}
          overScrollMode="never"
          bounces={false}
        />
      </View>

      {/* ── Flechas de navegación ── */}
      <View style={styles.controlsRow}>
        <Pressable
          style={styles.simpleButtonContainer}
          onPress={handlePrev}
        >
          <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
          <MaskedView
            style={styles.maskedButton}
            maskElement={<View style={styles.transparentButtonMask} />}
          >
            <View
              style={[
                styles.buttonGradient,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            />
          </MaskedView>
          <Icon2 name="chevron-left" size={22} color={themeColors.icon} style={styles.buttonIcon} />
        </Pressable>

        <Pressable
          style={styles.simpleButtonContainer}
          onPress={handleNext}
        >
          <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
          <MaskedView
            style={styles.maskedButton}
            maskElement={<View style={styles.transparentButtonMask} />}
          >
            <View
              style={[
                styles.buttonGradient,
                { experimental_backgroundImage: themeColors.gradient },
              ]}
            />
          </MaskedView>
          <Icon2 name="chevron-right" size={22} color={themeColors.icon} style={styles.buttonIcon} />
        </Pressable>
      </View>

      {/* ── Término seleccionado ── */}
      <View style={styles.selectedRow}>
        <Text style={[styles.selectedLabel, { color: themeColors.text, fontSize: 14 * fontSizeFactor }]}>
          {'Término seleccionado: '}
        </Text>
        <Text
          style={[
            styles.selectedValue,
            {
              color: selectedTerm !== 'none' ? themeColors.selectedAccent : themeColors.text,
              fontSize: 14 * fontSizeFactor,
            },
          ]}
        >
          {selectedTerm}
        </Text>
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
    marginTop: 11,
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
  equationContainer: {
    marginHorizontal: 20,
    marginTop: 0,
    overflow: 'hidden',
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    marginTop: 5,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  selectedLabel: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 14,
  },
  selectedValue: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 14,
  },
  spacer: {
    height: 100,
  },
    simpleButtonContainer: {
    width: 46,
    height: 46,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonBackground: {
    width: 46,
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  transparentButtonMask: {
    width: 46,
    height: 46,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  maskedButton: {
    width: 46,
    height: 46,
  },
  buttonGradient: {
    width: 46,
    height: 46,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonIcon: {
    position: 'absolute',
  },
});