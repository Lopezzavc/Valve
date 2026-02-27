/**
 * MoodyDiagramScreen.tsx
 *
 * Interactive Moody Diagram screen for friction factor visualization.
 *
 * Required libraries (install if not already present):
 *   npm install react-native-svg
 *   npx pod-install          (iOS linking)
 *
 * Already used in this project (no extra install needed):
 *   @miblanchard/react-native-slider
 */

import React, {
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Icon2 from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Circle,
  Defs,
  ClipPath,
  Rect,
  G,
} from 'react-native-svg';
import { Slider } from '@miblanchard/react-native-slider';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const thumbLight = require('../../../assets/LiquidGlassSimulation/thumbSliderWhite.png');
const thumbDark  = require('../../../assets/LiquidGlassSimulation/thumbSliderBlack.png');

/** ε/D values for the fixed background curves */
const FIXED_ED_VALUES = [0, 0.00001, 0.0001, 0.001, 0.01, 0.05] as const;

/** Log10 bounds for Reynolds number axis */
const RE_LOG_MIN = 3; // 10³  = 1,000
const RE_LOG_MAX = 8; // 10⁸ = 100,000,000

/** Friction factor axis bounds */
const F_LOG_MIN = Math.log10(0.008);
const F_LOG_MAX = Math.log10(0.1);

/** Number of points per curve at full resolution (when not sliding) */
const CURVE_POINTS_FULL = 120;
/** Number of points per curve while slider is being dragged */
const CURVE_POINTS_SLIDING = 50;

/** Colebrook-White max iterations at full resolution */
const ITER_FULL = 60;
/** Colebrook-White max iterations while slider is being dragged.
 *  Swamee-Jain initial guess is already ~1-3% accurate; 3 extra
 *  iterations bring error well below 0.01% – invisible on screen. */
const ITER_SLIDING = 3;

// ─── Math helpers ─────────────────────────────────────────────────────────────

/**
 * Solve Colebrook-White via fixed-point iteration.
 *   1/√f = -2·log₁₀( (ε/D)/3.7 + 2.51/(Re·√f) )
 *
 * For ε/D = 0 this reduces to the smooth-pipe formula. Works for all Re > 4000.
 */
function colebrookWhite(Re: number, eD: number, maxIter = 60): number {
  if (Re <= 0 || !isFinite(Re)) return NaN;

  // Initial guess: Swamee-Jain approximation
  const eDGuard = Math.max(eD, 1e-12);
  let f = 0.25 / Math.pow(Math.log10(eDGuard / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
  if (!isFinite(f) || f <= 0) f = 0.02;

  for (let i = 0; i < maxIter; i++) {
    const sqrtF = Math.sqrt(f);
    const inner = eD / 3.7 + 2.51 / (Re * sqrtF);
    if (inner <= 0) break;
    const invSqrtF = -2 * Math.log10(inner);
    if (invSqrtF <= 0) break;
    const fNew = 1 / (invSqrtF * invSqrtF);
    if (!isFinite(fNew) || fNew <= 0) break;
    if (Math.abs(fNew - f) < 1e-12) { f = fNew; break; }
    f = fNew;
  }
  return f;
}

/**
 * Return friction factor for given Re and ε/D.
 * - Re < 2000  → laminar: f = 64/Re
 * - Re > 4000  → turbulent: Colebrook-White
 * - 2000–4000  → linear interpolation (transition / uncertain region)
 *
 * @param maxIter – passed through to colebrookWhite; reduce while sliding
 *                  for better performance.
 */
function frictionFactor(Re: number, eD: number, maxIter = 60): number {
  if (Re <= 0) return NaN;
  if (Re < 2000) {
    return 64 / Re;
  }
  if (Re > 4000) {
    return colebrookWhite(Re, eD, maxIter);
  }
  // Transition: linear blend
  const t = (Re - 2000) / 2000;
  const fLam = 64 / Re;
  const fTurb = colebrookWhite(Re, eD, maxIter);
  return fLam * (1 - t) + fTurb * t;
}

/** Generate logarithmically-spaced Re values */
function logspace(logMin: number, logMax: number, n: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(Math.pow(10, logMin + (i / (n - 1)) * (logMax - logMin)));
  }
  return result;
}

// ─── Diagram geometry helpers ─────────────────────────────────────────────────

interface DiagramLayout {
  svgWidth: number;
  svgHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  plotWidth: number;
  plotHeight: number;
}

function buildLayout(screenWidth: number): DiagramLayout {
  const svgWidth = screenWidth - 40;
  const svgHeight = 300;
  const marginLeft = 40;
  const marginRight = 14;
  const marginTop = 12;
  const marginBottom = 35;
  return {
    svgWidth,
    svgHeight,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    plotWidth: svgWidth - marginLeft - marginRight,
    plotHeight: svgHeight - marginTop - marginBottom,
  };
}

function reToX(Re: number, layout: DiagramLayout): number {
  const t = (Math.log10(Re) - RE_LOG_MIN) / (RE_LOG_MAX - RE_LOG_MIN);
  return layout.marginLeft + t * layout.plotWidth;
}

function fToY(f: number, layout: DiagramLayout): number {
  const logF = Math.log10(f);
  const t = (logF - F_LOG_MIN) / (F_LOG_MAX - F_LOG_MIN);
  // t=0 → bottom of plot (low f), t=1 → top of plot (high f)
  return layout.marginTop + (1 - t) * layout.plotHeight;
}

/** Convert an array of {re, f} to an SVG path string, splitting on NaN/out-of-range */
function pointsToPath(
  points: { re: number; f: number }[],
  layout: DiagramLayout
): string {
  let d = '';
  let penDown = false;
  for (const { re, f } of points) {
    if (!isFinite(f) || f <= 0) {
      penDown = false;
      continue;
    }
    const x = reToX(re, layout);
    const y = fToY(f, layout);
    if (d === '' || !penDown) {
      d += `M ${x.toFixed(2)} ${y.toFixed(2)} `;
      penDown = true;
    } else {
      d += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
  }
  return d;
}

// ─── Curve colors ─────────────────────────────────────────────────────────────

const CURVE_COLORS_DARK = [
  '#AAAAAA', // smooth (ε/D = 0)
  '#4FC3F7', // 0.00001
  '#81C784', // 0.0001
  '#FFB74D', // 0.001
  '#F06292', // 0.01
  '#CE93D8', // 0.05
];

const CURVE_COLORS_LIGHT = [
  '#757575',
  '#0288D1',
  '#388E3C',
  '#E65100',
  '#C2185B',
  '#7B1FA2',
];

// ─── Axis tick configurations ─────────────────────────────────────────────────

const RE_MAJOR_TICKS = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8];
const RE_MINOR_TICKS = [
  2e3, 3e3, 4e3, 5e3, 6e3, 7e3, 8e3, 9e3,
  2e4, 3e4, 4e4, 5e4, 6e4, 7e4, 8e4, 9e4,
  2e5, 3e5, 4e5, 5e5, 6e5, 7e5, 8e5, 9e5,
  2e6, 3e6, 4e6, 5e6, 6e6, 7e6, 8e6, 9e6,
  2e7, 3e7, 4e7, 5e7, 6e7, 7e7, 8e7, 9e7,
];
const F_MAJOR_TICKS = [0.008, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];

function formatRe(re: number): string {
  const exp = Math.round(Math.log10(re));
  const superMap: { [k: string]: string } = {
    '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸',
  };
  return `10${superMap[String(exp)] ?? String(exp)}`;
}

// ─── Static diagram layer (memoized – never re-renders on slider change) ──────

interface StaticLayerProps {
  layout: DiagramLayout;
  fixedPaths: string[];
  curveColors: string[];
  diagramGrid: string;
  diagramAxis: string;
  diagramAxisLabel: string;
  transitionLine: string;
  fontSizeFactor: number;
  xAxisLabel: string;
  yAxisLabel: string;
  transitionLabel: string;
}

/**
 * All SVG elements that do NOT change when the slider moves:
 * grid lines, fixed ε/D curves, axis labels, transition zone.
 *
 * Wrapped in React.memo so React skips reconciliation entirely
 * during slider dragging.
 */
const StaticDiagramLayer = memo(({
  layout,
  fixedPaths,
  curveColors,
  diagramGrid,
  diagramAxis,
  diagramAxisLabel,
  transitionLine,
  fontSizeFactor,
  xAxisLabel,
  yAxisLabel,
  transitionLabel,
}: StaticLayerProps) => {
  const plotRight = layout.marginLeft + layout.plotWidth;
  const plotBottom = layout.marginTop + layout.plotHeight;
  const x2000 = reToX(2000, layout);
  const x4000 = reToX(4000, layout);

  return (
    <G>
      {/* ── Grid lines ── */}
      <G clipPath="url(#plotClip)">
        {/* Minor x grid */}
        {RE_MINOR_TICKS.filter(
          (re) =>
            re >= Math.pow(10, RE_LOG_MIN) &&
            re <= Math.pow(10, RE_LOG_MAX)
        ).map((re) => {
          const x = reToX(re, layout);
          return (
            <Line
              key={`xminor-${re}`}
              x1={x}
              y1={layout.marginTop}
              x2={x}
              y2={plotBottom}
              stroke={diagramGrid}
              strokeWidth={0.5}
            />
          );
        })}
        {/* Major x grid */}
        {RE_MAJOR_TICKS.map((re) => {
          const x = reToX(re, layout);
          return (
            <Line
              key={`xmajor-${re}`}
              x1={x}
              y1={layout.marginTop}
              x2={x}
              y2={plotBottom}
              stroke={diagramAxis}
              strokeWidth={0.7}
              opacity={0.4}
            />
          );
        })}
        {/* Major y grid */}
        {F_MAJOR_TICKS.map((f) => {
          const y = fToY(f, layout);
          return (
            <Line
              key={`ymajor-${f}`}
              x1={layout.marginLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke={diagramAxis}
              strokeWidth={0.7}
              opacity={0.4}
            />
          );
        })}

        {/* ── Transition zone (2000 < Re < 4000) ── */}
        <Rect
          x={x2000}
          y={layout.marginTop}
          width={x4000 - x2000}
          height={layout.plotHeight}
          fill={transitionLine}
          opacity={0.18}
        />
        <Line
          x1={x2000}
          y1={layout.marginTop}
          x2={x2000}
          y2={plotBottom}
          stroke={transitionLine}
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <Line
          x1={x4000}
          y1={layout.marginTop}
          x2={x4000}
          y2={plotBottom}
          stroke={transitionLine}
          strokeWidth={1}
          strokeDasharray="4,3"
        />

        {/* ── Fixed background curves ── */}
        {fixedPaths.map((d, i) => (
          <Path
            key={`curve-${i}`}
            d={d}
            stroke={curveColors[i]}
            strokeWidth={1.2}
            fill="none"
            opacity={0.55}
          />
        ))}
      </G>

      {/* ── Plot border ── */}
      <Rect
        x={layout.marginLeft}
        y={layout.marginTop}
        width={layout.plotWidth}
        height={layout.plotHeight}
        fill="none"
        stroke={diagramAxis}
        strokeWidth={1}
        opacity={0.6}
      />

      {/* ── X-axis labels (Reynolds number) ── */}
      {RE_MAJOR_TICKS.map((re) => {
        const x = reToX(re, layout);
        return (
          <SvgText
            key={`xlabel-${re}`}
            x={x}
            y={plotBottom + 14}
            fontSize={8.5 * fontSizeFactor}
            textAnchor="middle"
            fill={diagramAxisLabel}
            fontFamily="SFUIDisplay-Regular"
          >
            {formatRe(re)}
          </SvgText>
        );
      })}

      {/* X-axis title */}
      <SvgText
        x={layout.marginLeft + layout.plotWidth / 2}
        y={layout.svgHeight - 4}
        fontSize={9 * fontSizeFactor}
        textAnchor="middle"
        fill={diagramAxisLabel}
        fontFamily="SFUIDisplay-Medium"
      >
        {xAxisLabel}
      </SvgText>

      {/* ── Y-axis labels (friction factor f) ── */}
      {F_MAJOR_TICKS.map((f) => {
        const y = fToY(f, layout);
        const label =
          f === 0.008 || f === 0.01 || f === 0.02 || f === 0.05 || f === 0.1
            ? String(f)
            : f === 0.03 || f === 0.04
            ? String(f)
            : '';
        if (!label) return null;
        return (
          <SvgText
            key={`ylabel-${f}`}
            x={layout.marginLeft - 4}
            y={y + 3}
            fontSize={8 * fontSizeFactor}
            textAnchor="end"
            fill={diagramAxisLabel}
            fontFamily="SFUIDisplay-Regular"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Y-axis title (rotated) */}
      <SvgText
        x={9}
        y={layout.marginTop + layout.plotHeight / 2 + 4}
        fontSize={9 * fontSizeFactor}
        textAnchor="middle"
        fill={diagramAxisLabel}
        fontFamily="SFUIDisplay-Medium"
        rotation="-90"
        originX={9}
        originY={layout.marginTop + layout.plotHeight / 2}
      >
        {yAxisLabel}
      </SvgText>

      {/* ── Transition label ── */}
      <SvgText
        x={(x2000 + x4000) / 2}
        y={layout.marginTop + 10}
        fontSize={6.5 * fontSizeFactor}
        textAnchor="middle"
        fill={transitionLine}
        fontFamily="SFUIDisplay-Regular"
      >
        {transitionLabel}
      </SvgText>
    </G>
  );
});

// ─── Dynamic diagram layer (re-renders on every slider change) ────────────────

interface DynamicLayerProps {
  layout: DiagramLayout;
  selectedPath: string;
  markerX: number;
  markerY: number | null;
  selectedCurveColor: string;
  markerFill: string;
  markerStroke: string;
}

/**
 * Only the user-selected ε/D curve and the current-point marker.
 * These are the only elements that actually change during sliding.
 */
const DynamicDiagramLayer = memo(({
  layout,
  selectedPath,
  markerX,
  markerY,
  selectedCurveColor,
  markerFill,
  markerStroke,
}: DynamicLayerProps) => {
  const plotRight = layout.marginLeft + layout.plotWidth;
  const plotBottom = layout.marginTop + layout.plotHeight;

  return (
    <G clipPath="url(#plotClip)">
      {/* ── Selected ε/D curve (highlighted) ── */}
      <Path
        d={selectedPath}
        stroke={selectedCurveColor}
        strokeWidth={2.4}
        fill="none"
        opacity={0.9}
      />

      {/* ── Current point marker ── */}
      {markerY !== null && (
        <G>
          {/* Cross-hair lines */}
          <Line
            x1={markerX}
            y1={layout.marginTop}
            x2={markerX}
            y2={plotBottom}
            stroke={markerFill}
            strokeWidth={0.8}
            strokeDasharray="3,3"
            opacity={0.6}
          />
          <Line
            x1={layout.marginLeft}
            y1={markerY}
            x2={plotRight}
            y2={markerY}
            stroke={markerFill}
            strokeWidth={0.8}
            strokeDasharray="3,3"
            opacity={0.6}
          />
          {/* Outer ring */}
          <Circle
            cx={markerX}
            cy={markerY}
            r={7}
            fill="none"
            stroke={markerStroke}
            strokeWidth={1.5}
            opacity={0.7}
          />
          {/* Inner dot */}
          <Circle
            cx={markerX}
            cy={markerY}
            r={4}
            fill={markerFill}
            stroke={markerStroke}
            strokeWidth={1}
          />
        </G>
      )}
    </G>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

const MoodyDiagramScreen = () => {
  const navigation = useNavigation();
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { width: screenWidth } = useWindowDimensions();

  const isDark = currentTheme === 'dark';

  // ── Theme colors (identical pattern to existing code) ───────────────────────
  const themeColors = useMemo(() => {
    if (isDark) {
      return {
        background: 'rgb(12,12,12)',
        card: 'rgb(24,24,24)',
        text: 'rgb(235,235,235)',
        textStrong: 'rgb(250,250,250)',
        separator: 'rgba(255,255,255,0.12)',
        icon: 'rgb(245,245,245)',
        gradient:
          'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
        selectedAccent: 'rgb(255, 255, 255)',
        sliderTrack: 'rgba(255,255,255,0.12)',
        diagramBg: 'rgb(24,24,24)',
        diagramGrid: 'rgba(255,255,255,0.06)',
        diagramAxis: 'rgba(255,255,255,0.35)',
        diagramAxisLabel: 'rgba(200,200,200,0.8)',
        resultCard: 'rgb(24,24,24)',
        resultLabel: 'rgba(200,200,200,0.7)',
        resultValue: 'rgb(255,255,255)',
        sliderLabel: 'rgb(255, 255, 255)',
        sliderValue: 'rgb(235,235,235)',
        transitionLine: 'rgba(255,200,100,0.5)',
        curveColors: CURVE_COLORS_DARK,
        markerFill: '#FFE082',
        markerStroke: '#FF8F00',
      };
    }
    return {
      background: 'rgba(255,255,255,1)',
      card: 'rgba(255,255,255,1)',
      text: 'rgb(0,0,0)',
      textStrong: 'rgb(0,0,0)',
      separator: 'rgb(235,235,235)',
      icon: 'rgb(0,0,0)',
      gradient:
        'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
      selectedAccent: 'rgb(0,0,0)',
      sliderTrack: 'rgb(228,228,228)',
      diagramBg: 'rgba(255,255,255,1)',
      diagramGrid: 'rgba(0,0,0,0.06)',
      diagramAxis: 'rgba(0,0,0,0.4)',
      diagramAxisLabel: 'rgba(60,60,60,0.85)',
      resultCard: 'rgb(248,248,248)',
      resultLabel: 'rgba(80,80,80,0.8)',
      resultValue: 'rgb(0,0,0)',
      sliderLabel: 'rgb(0, 0, 0)',
      sliderValue: 'rgb(20,20,20)',
      transitionLine: 'rgba(200,140,0,0.45)',
      curveColors: CURVE_COLORS_LIGHT,
      markerFill: '#FF6F00',
      markerStroke: '#BF360C',
    };
  }, [isDark]);

  // ── State ────────────────────────────────────────────────────────────────────

  /**
   * Re slider raw value 0..1 → Re = 10^(RE_LOG_MIN + v*(RE_LOG_MAX-RE_LOG_MIN))
   * Initial: Re = 10^5 = 100,000 → t = (5-3)/(8-3) = 0.4
   */
  const [reSlider, setReSlider] = useState(0.4);

  /**
   * ε/D slider raw value 0..1 → eD = 10^(-5 + v*4)
   * Initial: eD = 0.001 → log10(0.001)=-3 → t=(-3-(-5))/4 = 0.5
   */
  const [eDSlider, seteDSlider] = useState(0.5);

  /**
   * Track whether any slider is currently being dragged.
   * While sliding: use fewer iterations and fewer curve points for speed.
   * After release:  revert to full-precision computation.
   */
  const [isSliding, setIsSliding] = useState(false);

  // ── Derived scalar values ────────────────────────────────────────────────────
  const Re = useMemo(
    () => Math.pow(10, RE_LOG_MIN + reSlider * (RE_LOG_MAX - RE_LOG_MIN)),
    [reSlider]
  );

  const eD = useMemo(
    () => Math.pow(10, -5 + eDSlider * 4),
    [eDSlider]
  );

  // Adaptive iterations: fewer while dragging for performance
  const activeIter = isSliding ? ITER_SLIDING : ITER_FULL;

  const fResult = useMemo(
    () => frictionFactor(Re, eD, activeIter),
    [Re, eD, activeIter]
  );

  // ── Diagram layout ───────────────────────────────────────────────────────────
  const layout = useMemo(() => buildLayout(screenWidth), [screenWidth]);

  // ── Pre-computed Re value arrays ─────────────────────────────────────────────
  // Full-resolution array – used when not sliding
  const reValuesFull = useMemo(
    () => logspace(RE_LOG_MIN, RE_LOG_MAX, CURVE_POINTS_FULL),
    []
  );
  // Reduced-resolution array – used while dragging for lower CPU load
  const reValuesSliding = useMemo(
    () => logspace(RE_LOG_MIN, RE_LOG_MAX, CURVE_POINTS_SLIDING),
    []
  );

  // ── Pre-computed background curve points (all fixed ε/D) ────────────────────
  // These only depend on the full-res Re array and never change → compute once.
  const fixedCurvePoints = useMemo(() => {
    return FIXED_ED_VALUES.map((edVal) =>
      reValuesFull.map((re) => ({ re, f: frictionFactor(re, edVal, ITER_FULL) }))
    );
  }, [reValuesFull]);

  /** Points for the user-selected ε/D curve.
   *  During dragging: fewer points + fewer iterations → much faster.
   *  After release:   full resolution. */
  const selectedCurvePoints = useMemo(() => {
    const pts = isSliding ? reValuesSliding : reValuesFull;
    return pts.map((re) => ({ re, f: frictionFactor(re, eD, activeIter) }));
  }, [reValuesFull, reValuesSliding, eD, activeIter, isSliding]);

  // ── Path strings ─────────────────────────────────────────────────────────────
  const fixedPaths = useMemo(
    () => fixedCurvePoints.map((pts) => pointsToPath(pts, layout)),
    [fixedCurvePoints, layout]
  );

  const selectedPath = useMemo(
    () => pointsToPath(selectedCurvePoints, layout),
    [selectedCurvePoints, layout]
  );

  /** Marker position */
  const markerX = useMemo(() => reToX(Re, layout), [Re, layout]);
  const markerY = useMemo(
    () => (isFinite(fResult) && fResult > 0 ? fToY(fResult, layout) : null),
    [fResult, layout]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleReSliderChange = useCallback((val: number | number[]) => {
    setReSlider(Array.isArray(val) ? val[0] : val);
  }, []);

  const handleeDSliderChange = useCallback((val: number | number[]) => {
    seteDSlider(Array.isArray(val) ? val[0] : val);
  }, []);

  const handleSlidingStart = useCallback(() => {
    setIsSliding(true);
  }, []);

  const handleSlidingComplete = useCallback(() => {
    setIsSliding(false);
  }, []);

  // ── Formatted display values ─────────────────────────────────────────────────
  const reDisplay = useMemo(() => {
    if (Re >= 1e6) return `${(Re / 1e6).toFixed(2)} × 10⁶`;
    if (Re >= 1e3) return `${Math.round(Re).toLocaleString()}`;
    return Re.toFixed(0);
  }, [Re]);

  const eDDisplay = useMemo(() => {
    if (eD < 0.001) return eD.toExponential(2);
    return eD.toFixed(5).replace(/\.?0+$/, '');
  }, [eD]);

  const fDisplay = useMemo(() => {
    if (!isFinite(fResult)) return '—';
    return fResult.toFixed(6);
  }, [fResult]);

  // ── Stable label strings for StaticDiagramLayer ─────────────────────────────
  const xAxisLabel = t('moodyDiagramScreen.xAxisLabel');
  const yAxisLabel = t('moodyDiagramScreen.yAxisLabel');
  const transitionLabel = t('moodyDiagramScreen.transitionLabel');

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.safeArea, { backgroundColor: themeColors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      {/* ── EXISTING HEADER – DO NOT MODIFY ───────────────────────────────── */}
      <View style={styles.headerContainer}>
        <View style={styles.leftIconsContainer}>
          <View
            style={[
              styles.iconWrapper,
              { experimental_backgroundImage: themeColors.gradient },
            ]}
          >
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

      {/* ── EXISTING TITLES – DO NOT MODIFY ───────────────────────────────── */}
      <View style={styles.titlesContainer}>
        <Text
          style={[
            styles.subtitle,
            { color: themeColors.text, fontSize: 18 * fontSizeFactor },
          ]}
        >
          {t('moodyDiagramScreen.subtitle')}
        </Text>
        <Text
          style={[
            styles.title,
            { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor },
          ]}
        >
          {t('moodyDiagramScreen.title')}
        </Text>
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          NEW CONTENT STARTS HERE
          ════════════════════════════════════════════════════════════════════ */}

      {/* ── Interactive Moody Diagram ─────────────────────────────────────── */}
      <View
        style={[
          styles.diagramContainer,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View
          style={[
            styles.diagramInner,
            { backgroundColor: themeColors.diagramBg },
          ]}
        >
          <Svg
            width={layout.svgWidth}
            height={layout.svgHeight}
            style={{ overflow: 'hidden' }}
          >
            <Defs>
              {/* Clip region to plot area */}
              <ClipPath id="plotClip">
                <Rect
                  x={layout.marginLeft}
                  y={layout.marginTop}
                  width={layout.plotWidth}
                  height={layout.plotHeight}
                />
              </ClipPath>
            </Defs>

            {/* Static layer: grid, fixed curves, axes – never re-renders on slider drag */}
            <StaticDiagramLayer
              layout={layout}
              fixedPaths={fixedPaths}
              curveColors={themeColors.curveColors}
              diagramGrid={themeColors.diagramGrid}
              diagramAxis={themeColors.diagramAxis}
              diagramAxisLabel={themeColors.diagramAxisLabel}
              transitionLine={themeColors.transitionLine}
              fontSizeFactor={fontSizeFactor}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              transitionLabel={transitionLabel}
            />

            {/* Dynamic layer: selected curve + marker – re-renders on slider drag */}
            <DynamicDiagramLayer
              layout={layout}
              selectedPath={selectedPath}
              markerX={markerX}
              markerY={markerY}
              selectedCurveColor={isDark ? '#FFFFFF' : '#000000'}
              markerFill={themeColors.markerFill}
              markerStroke={themeColors.markerStroke}
            />
          </Svg>
        </View>
      </View>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <View style={styles.legendRow}>
        {FIXED_ED_VALUES.map((edVal, i) => (
          <View key={`leg-${i}`} style={styles.legendItem}>
            <View
              style={[
                styles.legendLine,
                { backgroundColor: themeColors.curveColors[i] },
              ]}
            />
            <Text
              style={[
                styles.legendText,
                {
                  color: themeColors.text,
                  fontSize: 10 * fontSizeFactor,
                  opacity: 0.75,
                },
              ]}
            >
              {edVal === 0 ? '0' : edVal < 0.001 ? edVal.toExponential(0) : String(edVal)}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendLine,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#000000',
                height: 3,
              },
            ]}
          />
          <Text
            style={[
              styles.legendText,
              { color: themeColors.text, fontSize: 10 * fontSizeFactor },
            ]}
          >
            {t('moodyDiagramScreen.selectedLegend')}
          </Text>
        </View>
      </View>

      <View style={styles.variablesTitleContainer}>
        <Text
          style={[
            styles.sectionSubtitle,
            { 
              color: themeColors.textStrong, 
              fontSize: 18 * fontSizeFactor,
            },
          ]}
        >
          {t('moodyDiagramScreen.variablesTitle') || 'Variables'}
        </Text>
      </View>

      {/* ── Slider controls ───────────────────────────────────────────────── */}
      <View
        style={[
          styles.slidersContainerMain,
          { experimental_backgroundImage: themeColors.gradient },
        ]}
      >
        <View
          style={[
            styles.slidersContainer,
            { backgroundColor: themeColors.card },
          ]}
        >
          {/* ── Relative Roughness slider ── */}
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeaderRow}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: themeColors.sliderLabel, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('moodyDiagramScreen.roughnessSliderLabel')}
              </Text>
              <View
                style={[
                  styles.sliderValueBadge,
                  { experimental_backgroundImage: themeColors.gradient },
                ]}
              >
                <View
                  style={[
                    styles.sliderValueBadgeInner,
                    { backgroundColor: themeColors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.sliderValueText,
                      {
                        color: themeColors.sliderValue,
                        fontSize: 13 * fontSizeFactor,
                      },
                    ]}
                  >
                    {eDDisplay}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.sliderContainerWrapper}>
              <Slider
                value={eDSlider}
                minimumValue={0}
                maximumValue={1}
                step={0.002}
                onValueChange={handleeDSliderChange}
                onSlidingStart={handleSlidingStart}
                onSlidingComplete={handleSlidingComplete}
                minimumTrackTintColor="rgb(194, 254, 12)"
                maximumTrackTintColor={themeColors.sliderTrack}
                thumbImage={isDark ? thumbDark : thumbLight}
                thumbStyle={styles.thumbStyle}
                containerStyle={styles.sliderContainerInner}
              />
            </View>
            <View style={styles.sliderRangeRow}>
              <Text style={[styles.sliderRangeText, { color: themeColors.sliderLabel, fontSize: 10 * fontSizeFactor }]}>
                10⁻⁵
              </Text>
              <Text style={[styles.sliderRangeText, { color: themeColors.sliderLabel, fontSize: 10 * fontSizeFactor }]}>
                0.1
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.sliderSeparator,
              { backgroundColor: themeColors.separator },
            ]}
          />

          {/* ── Reynolds Number slider ── */}
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeaderRow}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: themeColors.sliderLabel, fontSize: 16 * fontSizeFactor },
                ]}
              >
                {t('moodyDiagramScreen.reynoldsSliderLabel')}
              </Text>
              <View
                style={[
                  styles.sliderValueBadge,
                  { experimental_backgroundImage: themeColors.gradient },
                ]}
              >
                <View
                  style={[
                    styles.sliderValueBadgeInner,
                    { backgroundColor: themeColors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.sliderValueText,
                      {
                        color: themeColors.sliderValue,
                        fontSize: 13 * fontSizeFactor,
                      },
                    ]}
                  >
                    {reDisplay}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.sliderContainerWrapper}>
              <Slider
                value={reSlider}
                minimumValue={0}
                maximumValue={1}
                step={0.002}
                onValueChange={handleReSliderChange}
                onSlidingStart={handleSlidingStart}
                onSlidingComplete={handleSlidingComplete}
                minimumTrackTintColor="rgb(194, 254, 12)"
                maximumTrackTintColor={themeColors.sliderTrack}
                thumbImage={isDark ? thumbDark : thumbLight}
                thumbStyle={styles.thumbStyle}
                containerStyle={styles.sliderContainerInner}
              />
            </View>
            <View style={styles.sliderRangeRow}>
              <Text style={[styles.sliderRangeText, { color: themeColors.sliderLabel, fontSize: 10 * fontSizeFactor }]}>
                10³
              </Text>
              <Text style={[styles.sliderRangeText, { color: themeColors.sliderLabel, fontSize: 10 * fontSizeFactor }]}>
                10⁸
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.variablesTitleContainer}>
        <Text
          style={[
            styles.sectionSubtitle,
            { 
              color: themeColors.textStrong, 
              fontSize: 18 * fontSizeFactor,
            },
          ]}
        >
          {t('moodyDiagramScreen.ffactorresult') || 'Variables'}
        </Text>
      </View>


      {/* ── Result panel ─────────────────────────────────────────────────── */}
      <View style={styles.resultMain}>
        <View
          style={[
            styles.resultContainerOuter,
            { experimental_backgroundImage: themeColors.gradient },
          ]}
        >
          <View
            style={[
              styles.resultContainerInner,
              { backgroundColor: isDark ? themeColors.card : 'rgb(255,255,255)' },
            ]}
          >
            {/* Flow regime badge */}
            <View style={styles.regimeBadgeRow}>
              <View
                style={[
                  styles.regimeBadge,
                  {
                    backgroundColor:
                      Re < 2000
                        ? 'rgba(76,175,80,0.18)'
                        : Re > 4000
                        ? 'rgba(33,150,243,0.18)'
                        : 'rgba(255,152,0,0.18)',
                    borderColor:
                      Re < 2000
                        ? 'rgba(76,175,80,0.5)'
                        : Re > 4000
                        ? 'rgba(33,150,243,0.5)'
                        : 'rgba(255,152,0,0.5)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.regimeBadgeText,
                    {
                      color:
                        Re < 2000
                          ? '#4CAF50'
                          : Re > 4000
                          ? '#2196F3'
                          : '#FF9800',
                      fontSize: 11 * fontSizeFactor,
                    },
                  ]}
                >
                  {Re < 2000
                    ? t('moodyDiagramScreen.laminarBadge')
                    : Re > 4000
                    ? t('moodyDiagramScreen.turbulentBadge')
                    : t('moodyDiagramScreen.transitionBadge')}
                </Text>
              </View>
            </View>

            {/* Main result */}
            <View style={styles.resultValueRow}>
              <Text
                style={[
                  styles.resultValueText,
                  { color: themeColors.resultValue, fontSize: 38 * fontSizeFactor },
                ]}
              >
                {fDisplay}
              </Text>
            </View>

            {/* Secondary values */}
            <View
              style={[
                styles.resultSecondaryRow,
                { borderTopColor: themeColors.separator },
              ]}
            >
              <View style={styles.resultSecondaryItem}>
                <Text
                  style={[
                    styles.resultSecondaryLabel,
                    { color: themeColors.resultLabel, fontSize: 11 * fontSizeFactor },
                  ]}
                >
                  Re
                </Text>
                <Text
                  style={[
                    styles.resultSecondaryValue,
                    { color: themeColors.resultValue, fontSize: 15 * fontSizeFactor },
                  ]}
                >
                  {reDisplay}
                </Text>
              </View>
              <View
                style={[
                  styles.resultSecondaryDivider,
                  { backgroundColor: themeColors.separator },
                ]}
              />
              <View style={styles.resultSecondaryItem}>
                <Text
                  style={[
                    styles.resultSecondaryLabel,
                    { color: themeColors.resultLabel, fontSize: 11 * fontSizeFactor },
                  ]}
                >
                  ε/D
                </Text>
                <Text
                  style={[
                    styles.resultSecondaryValue,
                    { color: themeColors.resultValue, fontSize: 15 * fontSizeFactor },
                  ]}
                >
                  {eDDisplay}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default memo(MoodyDiagramScreen);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Existing styles (DO NOT MODIFY) ─────────────────────────────────────────
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

  // ── New styles ───────────────────────────────────────────────────────────────

  // Diagram
  diagramContainer: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 20,
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
  },
  diagramInner: {
    borderRadius: 19,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 0,
    alignItems: 'center',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginTop: 10,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 10,
  },

  // Sliders
  slidersContainerMain: {
    marginHorizontal: 20,
    marginTop: 5,
    borderRadius: 25,
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
  },
  slidersContainer: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sliderBlock: {
    paddingVertical: 8,
  },
  sliderSeparator: {
    height: 1,
    marginVertical: 4,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sliderLabel: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 14,
    flex: 1,
  },
  sliderValueBadge: {
    borderRadius: 16,
    padding: 1,
    minWidth: 80,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
  },
  sliderValueBadgeInner: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
  },
  sliderValueText: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 13,
  },
  sliderContainerWrapper: {
    backgroundColor: 'transparent',
  },
  sliderContainerInner: {
    backgroundColor: 'transparent',
    height: 30,
  },
  thumbStyle: {
    height: 24,
    width: 40,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  sliderRangeText: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 10,
    opacity: 0.6,
  },

  // Result panel
  resultMain: {
    paddingHorizontal: 20,
    marginTop: 5,
  },
  resultContainerOuter: {
    borderRadius: 25,
    padding: 1,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
  },
  resultContainerInner: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  regimeBadgeRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 2,
    alignItems: 'flex-start',
  },
  regimeBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  regimeBadgeText: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 11,
  },
  resultValueRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  resultLabel: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 15,
    opacity: 0.7,
  },
  resultValueText: {
    fontFamily: 'SFUIDisplay-Heavy',
    fontSize: 38,
    lineHeight: 46,
  },
  resultSubLabel: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 12,
    opacity: 0.5,
    marginTop: -2,
  },
  resultSecondaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  resultSecondaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultSecondaryDivider: {
    width: 1,
    marginVertical: 2,
  },
  resultSecondaryLabel: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 11,
    opacity: 0.6,
  },
  resultSecondaryValue: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 15,
    marginTop: 2,
  },
  variablesTitleContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  resultTitleContainer: {
    paddingHorizontal: 0,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  inputLabel: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 20,
    fontFamily: 'SFUIDisplay-Bold',
    color: 'rgb(0, 0, 0)',
    marginTop: 5,
    marginBottom: 5,
  },
});