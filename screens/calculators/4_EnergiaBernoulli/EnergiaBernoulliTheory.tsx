import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon2 from 'react-native-vector-icons/Feather';
import Icon3 from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { KATEX_JS, KATEX_CSS } from '../../../src/katexBundle';

// ─── Ecuación LaTeX principal (Bernoulli generalizada con pérdidas) ───────────
const LATEX_EQUATION =
  "\\frac{P_1}{\\gamma} + \\frac{V_1^2}{2g} + z_1 = \\frac{P_2}{\\gamma} + \\frac{V_2^2}{2g} + z_2 + h_f";

// ─── ALTURA DEL WEBVIEW (modo compacto, una sola ecuación) ───────────────────
// ↓ La ecuación de Bernoulli es más larga; se usa un valor mayor para evitar recortes
const WEBVIEW_SINGLE_HEIGHT = 150;

// ─── SEPARACIÓN VERTICAL ENTRE ECUACIONES (solo en modo expandido) ────────────
const EQUATION_GAP_PX = 5;

// ─── Términos expandibles y sus ecuaciones secundarias ───────────────────────
interface ExpandableConfig {
  latex: string;
  initialTerm: string;
  validTerms: Set<string>;
}

const EXPANDABLE_TERMS: Record<string, ExpandableConfig> = {
  'h_f': {
    // Ecuación de Darcy-Weisbach para pérdidas por fricción
    latex: "h_f = f \\frac{L}{D} \\frac{V^2}{2g}",
    initialTerm: 'f',
    validTerms: new Set(['h_f', 'f', 'L', 'D', 'V', 'g']),
  },
  'γ': {
    // Relación entre peso específico, densidad y gravedad
    latex: "\\gamma = \\rho g",
    initialTerm: 'ρ',
    validTerms: new Set(['γ', 'ρ', 'g']),
  },
};

// ─── Términos válidos de la ecuación principal ────────────────────────────────
// Nota: KaTeX renderiza P_1, V_1, z_1, etc. como nodos compuestos.
// Los términos con subíndice se identifican por su texto "P", "V", "z", "γ", "g", "h"
// dentro del WebView; sin embargo, para la capa React Native usamos las etiquetas
// legibles que el sistema de traducción reconocerá.
const VALID_TERMS_PRIMARY = new Set(['P₁', 'P₂', 'γ', 'V₁', 'V₂', 'g', 'z₁', 'z₂', 'h_f']);

// Unión de todos los términos válidos (primaria + secundarias)
const ALL_VALID_TERMS = new Set([
  ...VALID_TERMS_PRIMARY,
  ...Object.values(EXPANDABLE_TERMS).flatMap(cfg => [...cfg.validTerms]),
]);

// ─── Mapa de texto KaTeX → clave de término para React Native ────────────────
// KaTeX descompone P_1 en spans separados. Usamos este mapa para normalizar
// lo que llega desde el WebView a las claves que usa el sistema de traducción.
const KATEX_TEXT_TO_TERM: Record<string, string> = {
  'P': 'P₁',   // primera coincidencia será P₁; ver nota en handleWebViewMessage
  'V': 'V₁',
  'z': 'z₁',
  'γ': 'γ',
  'g': 'g',
  'h': 'h_f',
  'f': 'f',
  'L': 'L',
  'D': 'D',
  'ρ': 'ρ',
  'm': 'm',
};

// ─── HTML del WebView ────────────────────────────────────────────────────────
const buildEquationHTML = (
  latex: string,
  isDark: boolean,
  initialTerm: string,
): string => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
  crossorigin="anonymous">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  ${KATEX_CSS}

  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }

  html, body {
    background: transparent;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #equations-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0 12px;
    gap: 0px;
  }

  .equation-row {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Tamaño ligeramente reducido para que la ecuación larga quepa */
    font-size: 1.2em;
    color: ${isDark ? 'rgb(235,235,235)' : 'rgb(0,0,0)'};
    white-space: nowrap;
    transition: opacity 0.25s ease;
    overflow-x: auto;
    max-width: 100%;
  }

  #eq2-row {
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  #eq2-row.visible {
    display: flex;
    opacity: 1;
  }

  #eq1-row.dimmed {
    opacity: 0.4;
    pointer-events: none;
  }

  .katex { color: inherit !important; }

  .katex-selected {
    background: rgba(194, 254, 12, 1) !important;
    border-radius: 0px;
    outline: 0px solid rgba(194, 254, 12, 1);
    color: ${isDark ? 'rgb(0,0,0)' : 'inherit'} !important;
  }

  .mord { cursor: pointer; }
  .mrel, .mbin, .mopen, .mclose, .mpunct { cursor: default; }

  .mfrac { pointer-events: none; }
  .mfrac .mord { pointer-events: auto; }
</style>

<script>${KATEX_JS}</script>

</head>
<body>
<div id="equations-wrapper">
  <div id="eq1-row" class="equation-row"></div>
  <div id="eq2-row" class="equation-row"></div>
</div>

<script>
  var SKIP_TEXT = new Set(['=', '+', '-', '±', '×', '÷', '/', '·', '*',
    '<', '>', '≤', '≥', '≠', '≈', '∝', '∞',
    '(', ')', '[', ']', '{', '}', ',', '.', ':', ';', '|',
    '1', '2']);   // ← ignorar los dígitos de subíndice sueltos

  var SKIP_CLASSES = ['mrel', 'mbin', 'mopen', 'mclose', 'mpunct'];

  var activeEq   = 1;
  var tokens1    = [];
  var tokens2    = [];
  var selected   = null;
  var currentIdx = -1;

  function isOperator(span) {
    var text = span.textContent.trim();
    if (SKIP_TEXT.has(text)) return true;
    for (var i = 0; i < SKIP_CLASSES.length; i++) {
      if (span.classList.contains(SKIP_CLASSES[i])) return true;
    }
    return false;
  }

  function getTokenText(tok) { return tok.textContent.trim(); }
  function activeTokens()    { return activeEq === 1 ? tokens1 : tokens2; }

  // ── Comunicación con React Native ─────────────────────────────────────────
  function reportHeight() {
    var h = document.getElementById('equations-wrapper').scrollHeight;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'height', value: h })
    );
  }

  function notify(term) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'selected', value: term })
    );
  }

  // ── Selección ─────────────────────────────────────────────────────────────
  function selectToken(index) {
    var toks = activeTokens();
    if (toks.length === 0) return;
    if (selected) selected.classList.remove('katex-selected');
    if (index < 0 || index >= toks.length) {
      selected = null; currentIdx = -1; notify('none'); return;
    }
    currentIdx = index;
    selected = toks[currentIdx];
    selected.classList.add('katex-selected');
    notify(getTokenText(selected));
  }

  function selectByText(termText, toks) {
    var idx = toks.findIndex(function(tok) {
      return getTokenText(tok) === termText;
    });
    selectToken(idx !== -1 ? idx : 0);
  }

  /*
   * buildTokens: recoge los nodos .mord que contienen texto seleccionable.
   *
   * Para la ecuación de Bernoulli con subíndices (P_1, V_1, z_1, etc.),
   * KaTeX produce spans .mord anidados para el subíndice. Filtramos los
   * nodos hoja (sin hijos .mord) y excluimos los dígitos de subíndice
   * via SKIP_TEXT (ver arriba).
   *
   * Para h_f: KaTeX renderiza 'h' y 'f' como .mord separados dentro de
   * la clase .mord principal que contiene el subíndice '_f'. Capturamos
   * el 'h' como representante de h_f en la ecuación principal.
   *
   * \text{} se usa en la ec. de Darcy si se requieren términos compuestos.
   */
  function buildTokens(containerId) {
    var container = document.getElementById(containerId);
    var all = Array.from(container.querySelectorAll('.mord'));
    return all.filter(function(span) {
      var text = span.textContent.trim();
      return text.length > 0 && !isOperator(span) && !span.querySelector('.mord');
    });
  }

  function attachListeners(toks) {
    toks.forEach(function(tok, i) {
      tok.addEventListener('click', function(e) {
        e.stopPropagation();
        var newIdx = (currentIdx === i) ? -1 : i;
        selectToken(newIdx);
      });
    });
  }

  // ── Inicializar ecuación principal ────────────────────────────────────────
  (function initPrimary() {
    katex.render(
      ${JSON.stringify(latex)},
      document.getElementById('eq1-row'),
      { displayMode: true, throwOnError: false }
    );
    tokens1 = buildTokens('eq1-row');
    attachListeners(tokens1);
    selectByText(${JSON.stringify(initialTerm)}, tokens1);
  })();

  // ── Navegación ─────────────────────────────────────────────────────────────
  window.goNext = function() {
    var toks = activeTokens();
    if (toks.length === 0) return;
    selectToken(currentIdx < toks.length - 1 ? currentIdx + 1 : 0);
  };
  window.goPrev = function() {
    var toks = activeTokens();
    if (toks.length === 0) return;
    selectToken(currentIdx > 0 ? currentIdx - 1 : toks.length - 1);
  };

  // ── Expandir ──────────────────────────────────────────────────────────────
  window.expandTo = function(secondLatex, secondInitialTerm) {
    var eq2 = document.getElementById('eq2-row');
    eq2.innerHTML = '';

    katex.render(secondLatex, eq2, { displayMode: true, throwOnError: false });
    tokens2 = buildTokens('eq2-row');
    attachListeners(tokens2);

    document.getElementById('equations-wrapper').style.gap = '${EQUATION_GAP_PX}px';

    document.getElementById('eq1-row').classList.add('dimmed');
    eq2.classList.add('visible');

    if (selected) selected.classList.remove('katex-selected');
    selected = null;
    currentIdx = -1;
    activeEq = 2;

    selectByText(secondInitialTerm, tokens2);

    setTimeout(reportHeight, 50);
  };

  // ── Comprimir ─────────────────────────────────────────────────────────────
  window.collapseEquation = function(restoreTerm) {
    var eq2 = document.getElementById('eq2-row');
    eq2.classList.remove('visible');

    document.getElementById('eq1-row').classList.remove('dimmed');

    document.getElementById('equations-wrapper').style.gap = '0px';

    if (selected) selected.classList.remove('katex-selected');
    selected = null;
    currentIdx = -1;
    tokens2 = [];
    activeEq = 1;

    selectByText(restoreTerm || ${JSON.stringify(initialTerm)}, tokens1);

    setTimeout(function() {
      eq2.innerHTML = '';
    }, 300);
  };

  // ── Actualizar segunda ecuación dinámicamente ─────────────────────────────
  window.updateSecondaryEquation = function(secondLatex, secondInitialTerm) {
    if (activeEq !== 2) return;
    var eq2 = document.getElementById('eq2-row');
    if (selected) selected.classList.remove('katex-selected');
    selected = null; currentIdx = -1;
    eq2.innerHTML = '';
    katex.render(secondLatex, eq2, { displayMode: true, throwOnError: false });
    tokens2 = buildTokens('eq2-row');
    attachListeners(tokens2);
    selectByText(secondInitialTerm, tokens2);
    setTimeout(reportHeight, 50);
  };
</script>
</body>
</html>
`;

// ─── Referencias ─────────────────────────────────────────────────────────────
const REFERENCES: Array<{ title: string; author: string; year: string; url: string }> = [
  {
    title: 'Hydrodynamica',
    author: 'Daniel Bernoulli',
    year: '1738',
    url: 'https://archive.org/details/bub_gb_c5QOAAAAQAAJ',
  },
  {
    title: 'Fluid Mechanics (8th ed.) — Capítulo 5: Ecuación de Bernoulli',
    author: 'Frank M. White',
    year: '2016',
    url: 'https://www.mheducation.com/highered/product/fluid-mechanics-white/M9780073398273.html',
  },
  {
    title: 'Friction factors for pipe flow',
    author: 'Lewis F. Moody',
    year: '1944',
    url: 'https://doi.org/10.1115/1.4018140',
  },
  {
    title: 'Explicit equations for pipe-flow problems (Swamee-Jain)',
    author: 'P. K. Swamee & A. K. Jain',
    year: '1976',
    url: 'https://doi.org/10.1061/JYCEAJ.0004517',
  },
  {
    title: 'Engineering Fluid Mechanics — Darcy-Weisbach equation',
    author: 'Clayton T. Crowe et al.',
    year: '2009',
    url: 'https://www.wiley.com/en-us/Engineering+Fluid+Mechanics%2C+10th+Edition-p-9781118164297',
  },
];

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
    return Linking.openURL(url).catch(() => {});
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

// ─── Mapa de texto KaTeX → clave de término usada en traducción ──────────────
// KaTeX produce nodos .mord con texto plano como 'P', 'V', 'h', etc.
// Este mapa convierte esos textos en las claves reconocidas por el sistema de i18n.
// Para términos con subíndices duplicados (P₁/P₂, V₁/V₂, z₁/z₂) el primer
// aparecimiento corresponde a la versión "1" y el segundo a "2". Dado que
// el WebView solo envía el texto base ('P', 'V', 'z'), se usa una clave genérica
// para el título/descripción (e.g. 'P' → 'energiaBernoulliTheory.terms.P.title').
const WEBVIEW_TO_I18N_KEY: Record<string, string> = {
  'P': 'P',
  'V': 'V',
  'z': 'z',
  'γ': 'γ',
  'g': 'g',
  'h': 'h_f',
  'f': 'f',
  'L': 'L',
  'D': 'D',
  'ρ': 'ρ',
  'm': 'm',
  'τ': 'τ',
};

// ─── Componente principal ─────────────────────────────────────────────────────
const EnergiaBernoulliTheory = ({ initialSelectedTerm = 'h' }: { initialSelectedTerm?: string }) => {
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);

  const webViewRef = useRef<WebView>(null);

  // ── Estado de UI ─────────────────────────────────────────────────────────────
  const [selectedTerm, setSelectedTerm]     = useState<string>('none');
  const [webViewHeight, setWebViewHeight]   = useState<number>(WEBVIEW_SINGLE_HEIGHT);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  // ── Estado expandir/comprimir ────────────────────────────────────────────────
  const [isExpanded, setIsExpanded]         = useState(false);
  const isExpandedRef                       = useRef(false);
  const expandedFromTerm                    = useRef<string>('h');

  const references = useMemo(() => REFERENCES, []);

  // ── Callbacks del WebView ────────────────────────────────────────────────────
  const handleWebViewLoad = useCallback(() => {
    setIsWebViewReady(true);
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && typeof data.value === 'number') {
        if (isExpandedRef.current) {
          setWebViewHeight(Math.max(data.value, WEBVIEW_SINGLE_HEIGHT));
        }
      } else if (data.type === 'selected') {
        // El WebView envía el texto plano del nodo KaTeX (e.g. 'P', 'h', 'γ').
        // Lo convertimos a la clave i18n correspondiente antes de guardarlo en estado.
        const raw = data.value as string;
        const mapped = WEBVIEW_TO_I18N_KEY[raw] ?? raw;
        setSelectedTerm(mapped);
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
        selectedAccent: 'rgb(255, 255, 255)',
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
      selectedAccent: 'rgb(0, 0, 0)',
    };
  }, [isDark]);

  // ── Navegación ───────────────────────────────────────────────────────────────
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleNext = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.goNext(); true;');
  }, []);

  const handlePrev = useCallback(() => {
    webViewRef.current?.injectJavaScript('window.goPrev(); true;');
  }, []);

  // ── Expandir / Comprimir ─────────────────────────────────────────────────────
  const handleExpand = useCallback(() => {
    if (isExpandedRef.current) {
      // — Comprimir —
      const restore = expandedFromTerm.current;
      webViewRef.current?.injectJavaScript(
        `window.collapseEquation(${JSON.stringify(restore)}); true;`
      );
      isExpandedRef.current = false;
      setIsExpanded(false);
      setWebViewHeight(WEBVIEW_SINGLE_HEIGHT);
    } else {
      // — Expandir (solo si el término seleccionado es expandible) —
      // selectedTerm está en clave i18n (e.g. 'h_f', 'γ'); EXPANDABLE_TERMS usa esas mismas claves.
      const config = EXPANDABLE_TERMS[selectedTerm];
      if (!config) return;

      expandedFromTerm.current = selectedTerm;
      webViewRef.current?.injectJavaScript(
        `window.expandTo(${JSON.stringify(config.latex)}, ${JSON.stringify(config.initialTerm)}); true;`
      );
      isExpandedRef.current = true;
      setIsExpanded(true);
    }
  }, [selectedTerm]);

  // ── Helpers de estado ────────────────────────────────────────────────────────
  // Para 'canExpand' también verificamos las claves directas del WebView que se mapean a expandibles.
  // 'h' → 'h_f', 'γ' → 'γ'
  const canExpand = isExpanded || Boolean(EXPANDABLE_TERMS[selectedTerm]);

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
          {t('energiaBernoulliTheory.subtitle')}
        </Text>
        <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('energiaBernoulliTheory.title')}
        </Text>
      </View>

      {/* ── Ecuación LaTeX ── */}
      <View style={[styles.equationContainer, { borderColor: themeColors.separator }]}>
        <WebView
          ref={webViewRef}
          source={{ html: equationHTML }}
          style={[styles.webView, { height: webViewHeight }]}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onMessage={handleWebViewMessage}
          onLoad={handleWebViewLoad}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          overScrollMode="never"
          bounces={false}
          mixedContentMode="always"
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          textInteractionEnabled={false}
        />
      </View>

      {/* ── Controles de navegación + botón expandir ── */}
      <View style={styles.controlsRow}>
        {/* Botón anterior */}
        <Pressable style={styles.simpleButtonContainer} onPress={handlePrev}>
          <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
          <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
            <View style={[styles.buttonGradient, { experimental_backgroundImage: themeColors.gradient }]} />
          </MaskedView>
          <Icon2 name="chevron-left" size={22} color={themeColors.icon} style={styles.buttonIcon} />
        </Pressable>

        {/* Botón siguiente */}
        <Pressable style={styles.simpleButtonContainer} onPress={handleNext}>
          <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
          <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
            <View style={[styles.buttonGradient, { experimental_backgroundImage: themeColors.gradient }]} />
          </MaskedView>
          <Icon2 name="chevron-right" size={22} color={themeColors.icon} style={styles.buttonIcon} />
        </Pressable>

        {/* Botón expandir/comprimir */}
        <Pressable
          style={[styles.simpleButtonContainer2, !canExpand && styles.buttonDisabled]}
          onPress={handleExpand}
          disabled={!canExpand}
        >
          <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]} />
          <MaskedView
            style={styles.maskedButton2}
            maskElement={<View style={[styles.transparentButtonMask2, isExpanded && styles.expandedButtonMask]} />}
          >
            <View style={[styles.buttonGradient2, { experimental_backgroundImage: themeColors.gradient }]} />
          </MaskedView>
          <Icon3
            name={isExpanded ? 'arrow-collapse-vertical' : 'arrow-expand-vertical'}
            size={20}
            color={themeColors.icon}
            style={styles.buttonIcon}
          />
        </Pressable>
      </View>

      {/* ── Info del término seleccionado ── */}
      {selectedTerm !== 'none' && (
        <View style={[styles.termCard, { borderColor: themeColors.separator }]}>
          <Text style={[styles.termTitle, { color: themeColors.selectedAccent, fontSize: 30 * fontSizeFactor }]}>
            {t(`energiaBernoulliTheory.terms.${selectedTerm}.title`)}
          </Text>
          <Text style={[styles.termDescription, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t(`energiaBernoulliTheory.terms.${selectedTerm}.description`)}
          </Text>
        </View>
      )}
      {selectedTerm === 'none' && (
        <View style={[styles.termCard, { borderColor: themeColors.separator }]}>
          <Text style={[styles.termPlaceholder, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('energiaBernoulliTheory.selectTermPlaceholder')}
          </Text>
        </View>
      )}

      {/* Referencias */}
      <View style={styles.refcont}>
        <Text style={[styles.titleReferencesText, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
          {t('energiaBernoulliTheory.titles.references')}
        </Text>
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

export default memo(EnergiaBernoulliTheory);

// ─── Estilos ─────────────────────────────────────────────────────────────────
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
    marginBottom: 0,
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
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 0,
  },
  webView: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  controlsRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 0,
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
  termCard: {
    backgroundColor: 'rgba(255, 159, 159, 0)',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 0,
    gap: 5,
  },
  termTitle: {
    fontFamily: 'SFUIDisplay-Bold',
    fontSize: 30,
  },
  termDescription: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 16,
    lineHeight: 20,
  },
  termPlaceholder: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.5,
  },
  simpleButtonContainer: {
    width: 46,
    height: 46,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
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
  expandedButtonMask: {
    borderColor: 'rgb(194, 254, 12)',
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
  simpleButtonContainer2: {
    width: 69,
    height: 46,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled2: {
    opacity: 0.35,
  },
  buttonBackground2: {
    width: 69,
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    position: 'absolute',
    borderRadius: 25,
  },
  transparentButtonMask2: {
    width: 69,
    height: 46,
    backgroundColor: 'transparent',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  expandedButtonMask2: {
    borderColor: 'rgb(194, 254, 12)',
  },
  maskedButton2: {
    width: 69,
    height: 46,
  },
  buttonGradient2: {
    width: 69,
    height: 46,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 25,
  },
  buttonIcon: {
    position: 'absolute',
  },
  expandedBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  expandedBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  expandedBadgeText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 12,
    opacity: 0.8,
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
  refcont: {
    paddingHorizontal: 20,
  },
});