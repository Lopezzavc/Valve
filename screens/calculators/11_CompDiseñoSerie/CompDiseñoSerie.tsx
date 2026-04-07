import React, { useState, useRef, useContext, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Clipboard,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IconFavorite from 'react-native-vector-icons/FontAwesome';
import IconExpand from 'react-native-vector-icons/Ionicons';
import MaskedView from '@react-native-masked-view/masked-view';
import { PrecisionDecimalContext } from '../../../contexts/PrecisionDecimalContext';
import { DecimalSeparatorContext } from '../../../contexts/DecimalSeparatorContext';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CalculatorOptionsScreenParams, buildCalculatorOptionsParams } from '../../01_options/optionsConfig';
import { UNIT_FACTORS } from '../../01_options/unitCatalog';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import FastImage from '@d11/react-native-fast-image';
import Decimal from 'decimal.js';
import {
  getDBConnection,
  createTable,
  saveCalculation,
  createFavoritesTable,
  isFavorite,
  addFavorite,
  removeFavorite,
} from '../../../src/services/database';
import { useTheme } from '../../../contexts/ThemeContext';
import { LanguageContext } from '../../../contexts/LanguageContext';
import { FontSizeContext } from '../../../contexts/FontSizeContext';
import { useKeyboard } from '../../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../../src/components/CustomKeyboardInput';

const logoLight = require('../../../assets/icon/iconblack.webp');
const logoDark = require('../../../assets/icon/iconwhite.webp');
const backgroundImage = require('../../../assets/CardsCalcs/card2F1.webp');

Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_EVEN });

// ─── Navigation types ────────────────────────────────────────────────────────
type RootStackParamList = {
  [key: string]: object | undefined;
  CalculatorOptionsScreen: CalculatorOptionsScreenParams;
};

// ─── Toast config ─────────────────────────────────────────────────────────────
const toastConfig = {
  success: (props: BaseToastProps) => (
	<BaseToast
	  {...props}
	  style={{ borderLeftColor: 'rgb(194, 254, 12)' }}
	  contentContainerStyle={{ paddingHorizontal: 15 }}
	  text1Style={{ fontSize: 16, fontFamily: 'SFUIDisplay-Bold' }}
	  text2Style={{ fontSize: 14, fontFamily: 'SFUIDisplay-Medium' }}
	/>
  ),
  error: (props: BaseToastProps) => (
	<ErrorToast
	  {...props}
	  style={{ borderLeftColor: 'rgb(254, 12, 12)' }}
	  contentContainerStyle={{ paddingHorizontal: 15 }}
	  text1Style={{ fontSize: 16, fontFamily: 'SFUIDisplay-Medium' }}
	  text2Style={{ fontSize: 14, fontFamily: 'SFUIDisplay-Medium' }}
	/>
  ),
};

// ─── Dot color helper ─────────────────────────────────────────────────────────
const getDotColor = (hasValue: boolean, isInvalid: boolean): string => {
  if (isInvalid) return 'rgb(254, 12, 12)';
  if (hasValue) return 'rgb(194, 254, 12)';
  return 'rgb(200,200,200)';
};

// ─── Conversion factors ───────────────────────────────────────────────────────
const conversionFactors = UNIT_FACTORS;


// ─── Domain types ─────────────────────────────────────────────────────────────
interface Tramo {
  id: number;
  D: string;
  DUnit: string;
  L: string;
  LUnit: string;
  Km: string;
  ks: string;
  ksUnit: string;
  q_lat: string;
  q_latUnit: string;
}

interface IterRowTramo {
  Q: number;
  V: number;
  Re: number;
  f: number;
  hf: number;
  hm: number;
}

interface IterationRow {
  iter: number;
  H_calc: number;
  error: number;
  tramosData: IterRowTramo[];
}

interface FinalTramoData {
  D: number;
  L: number;
  Q: number;
  V: number;
  Re: number;
  f: number;
  hf: number;
  hm: number;
  h_total: number;
  q_lat: number;
}

interface CalcResult {
  converged: boolean;
  iterations: number;
  finalError: number;
  Q_entrada: number;
  Q_extraido: number;
  Q_salida: number;
  H_total: number;
  H: number;
  tramosData: FinalTramoData[];
  iterationTable: IterationRow[];
}

interface CalculatorState {
  nu: string;
  nuUnit: string;
  H1: string;
  H1Unit: string;
  H2: string;
  H2Unit: string;
  tramos: Tramo[];
  invalidFields: string[];
  calcResult: CalcResult | null;
}

// ─── Hydraulic calculation functions (Darcy–Weisbach + Colebrook–White) ──────
function _colebrook(Re: number, ks_D: number): number {
  const argSJ = ks_D / 3.7 + 5.74 / Math.pow(Re, 0.9);
  let f = 0.25 / Math.pow(Math.log10(Math.max(argSJ, 1e-10)), 2);
  let f_new = f;
  for (let i = 0; i < 100; i++) {
	const inner = ks_D / 3.7 + 2.51 / (Re * Math.sqrt(f));
	f_new = 1.0 / Math.pow(-2.0 * Math.log10(Math.max(inner, 1e-15)), 2);
	if (Math.abs(f_new - f) < 1e-10) break;
	f = f_new;
  }
  return f_new;
}

function factorFriccion(Re: number, ks_D: number): number {
  if (Re <= 0) return 0;
  if (Re < 2000) return 64.0 / Re;
  if (Re < 4000) {
	const f_lam = 64.0 / 2000.0;
	const f_turb = _colebrook(4000.0, ks_D);
	const t = (Re - 2000.0) / 2000.0;
	return f_lam + t * (f_turb - f_lam);
  }
  return _colebrook(Re, ks_D);
}

function velocidadDesdeHf(
  hf: number,
  L: number,
  D: number,
  ks_D: number,
  nu: number,
  g: number
): number {
  if (hf <= 0) return 0;
  let V = Math.sqrt(Math.max((hf * 2.0 * g * D) / (0.02 * L), 0));
  for (let i = 0; i < 200; i++) {
	const Re = V > 0 ? (V * D) / nu : 0;
	const f = factorFriccion(Re, ks_D);
	if (f === 0) break;
	const V_new = Math.sqrt(Math.max((hf * 2.0 * g * D) / (f * L), 0));
	if (Math.abs(V_new - V) < 1e-10) {
	  V = V_new;
	  break;
	}
	V = V_new;
  }
  return V;
}

function calcularSerie(
  nuVal: number,
  H1Val: number,
  H2Val: number,
  TOLVal: number,
  MAX_ITERVal: number,
  tramos: { D: number; L: number; Km: number; ks: number; q_lat: number }[]
): CalcResult {
  const g = 9.81;
  const N = tramos.length;

  const D = tramos.map(t => t.D);
  const L_arr = tramos.map(t => t.L);
  const Km_arr = tramos.map(t => t.Km);
  const ks = tramos.map(t => t.ks);
  const q_lat_arr = tramos.map(t => t.q_lat);

  const A = D.map(d => (Math.PI * d * d) / 4);
  const ks_D = ks.map((k, i) => (D[i] > 0 ? k / D[i] : 0));

  const H = H1Val - H2Val;

  // Initial hf estimate proportional to L/D^5
  const resistencia = L_arr.map((l, i) => (D[i] > 0 ? l / Math.pow(D[i], 5) : 0));
  const sumR = resistencia.reduce((a, b) => a + b, 0);
  let hf_est = resistencia.map(r => (sumR > 0 ? (H * r) / sumR : H / N));

  const iterationTable: IterationRow[] = [];
  let error = 1e10;
  let iteration = 0;

  let Q_iter = new Array(N).fill(0);
  let V_iter = new Array(N).fill(0);
  let Re_iter = new Array(N).fill(0);
  let f_iter = new Array(N).fill(0);
  let hf_iter = new Array(N).fill(0);
  let hm_iter = new Array(N).fill(0);

  while (Math.abs(error) > TOLVal && iteration < MAX_ITERVal) {
	iteration++;

	// Tramo 1: velocity from estimated hf
	V_iter[0] = velocidadDesdeHf(hf_est[0], L_arr[0], D[0], ks_D[0], nuVal, g);
	Q_iter[0] = V_iter[0] * A[0];
	Re_iter[0] = V_iter[0] > 0 ? (V_iter[0] * D[0]) / nuVal : 0;
	f_iter[0] = factorFriccion(Re_iter[0], ks_D[0]);
	hf_iter[0] = f_iter[0] * (L_arr[0] / D[0]) * ((V_iter[0] * V_iter[0]) / (2 * g));
	hm_iter[0] = Km_arr[0] * ((V_iter[0] * V_iter[0]) / (2 * g));

	// Tramos 2..N: cascade flow
	for (let i = 1; i < N; i++) {
	  Q_iter[i] = Q_iter[i - 1] - q_lat_arr[i - 1];
	  V_iter[i] = A[i] > 0 ? Q_iter[i] / A[i] : 0;
	  Re_iter[i] = V_iter[i] > 0 ? (V_iter[i] * D[i]) / nuVal : 0;
	  f_iter[i] = factorFriccion(Re_iter[i], ks_D[i]);
	  hf_iter[i] = f_iter[i] * (L_arr[i] / D[i]) * ((V_iter[i] * V_iter[i]) / (2 * g));
	  hm_iter[i] = Km_arr[i] * ((V_iter[i] * V_iter[i]) / (2 * g));
	}

	// Energy closure
	let H_calc = 0;
	for (let i = 0; i < N; i++) H_calc += hf_iter[i] + hm_iter[i];
	error = H - H_calc;

	iterationTable.push({
	  iter: iteration,
	  H_calc,
	  error: Math.abs(error),
	  tramosData: Array.from({ length: N }, (_, i) => ({
		Q: Q_iter[i],
		V: V_iter[i],
		Re: Re_iter[i],
		f: f_iter[i],
		hf: hf_iter[i],
		hm: hm_iter[i],
	  })),
	});

	// Proportional adjustment of hf estimates
	if (H_calc > 0) {
	  hf_est = hf_iter.map(h => h * (H / H_calc));
	}
  }

  const converged = !(iteration >= MAX_ITERVal && Math.abs(error) > TOLVal);
  const Q_entrada = Q_iter[0];
  const Q_extraido = q_lat_arr.reduce((a, b) => a + b, 0);
  const Q_salida = Q_iter[N - 1] - q_lat_arr[N - 1];
  const H_total = hf_iter.reduce((a, b, i) => a + b + hm_iter[i], 0);

  const tramosData: FinalTramoData[] = Array.from({ length: N }, (_, i) => ({
	D: D[i],
	L: L_arr[i],
	Q: Q_iter[i],
	V: V_iter[i],
	Re: Re_iter[i],
	f: f_iter[i],
	hf: hf_iter[i],
	hm: hm_iter[i],
	h_total: hf_iter[i] + hm_iter[i],
	q_lat: q_lat_arr[i],
  }));

  return {
	converged,
	iterations: iteration,
	finalError: Math.abs(error),
	Q_entrada,
	Q_extraido,
	Q_salida,
	H_total,
	H,
	tramosData,
	iterationTable,
  };
}

// ─── Tramo factory ────────────────────────────────────────────────────────────
const createNewTramo = (): Tramo => ({
  id: Date.now() + Math.random(),
  D: '',
  DUnit: 'mm',
  L: '',
  LUnit: 'm',
  Km: '',
  ks: '',
  ksUnit: 'mm',
  q_lat: '',
  q_latUnit: 'm³/s',
});

const initialState = (): CalculatorState => ({
  nu: '',
  nuUnit: 'm²/s',
  H1: '',
  H1Unit: 'm',
  H2: '',
  H2Unit: 'm',
  tramos: [createNewTramo(), createNewTramo()],
  invalidFields: [],
  calcResult: null,
});

// ─── Main component ───────────────────────────────────────────────────────────
const withSymbol = (label: string, symbol: string): string => `${label} (${symbol})`;

const CompDiseñoSerie: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { formatNumber } = useContext(PrecisionDecimalContext);
  const { selectedDecimalSeparator } = useContext(DecimalSeparatorContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme } = useTheme();
  const { t } = useContext(LanguageContext);

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  const stateRef = useRef<CalculatorState>(initialState());
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});

  // ── Theme palette ─────────────────────────────────────────────────────────────
  const themeColors = React.useMemo(() => {
	if (currentTheme === 'dark') {
	  return {
		card: 'rgb(24,24,24)',
		text: 'rgb(235,235,235)',
		textStrong: 'rgb(250,250,250)',
		separator: 'rgba(255,255,255,0.12)',
		icon: 'rgb(245,245,245)',
		gradient:
		  'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
		gradient2:
		  'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
		cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
		cardGradient2: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
		tableHeader: 'rgba(45,45,45,1)',
		tableBorder: 'rgba(255,255,255,0.1)',
	  };
	}
	return {
	  card: 'rgba(255, 255, 255, 1)',
	  text: 'rgb(0, 0, 0)',
	  textStrong: 'rgb(0, 0, 0)',
	  separator: 'rgb(235, 235, 235)',
	  icon: 'rgb(0, 0, 0)',
	  gradient:
		'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	  gradient2:
		'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	  cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
	  cardGradient2:
		'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(250, 250, 250, 1))',
	  tableHeader: 'rgb(245,245,245)',
	  tableBorder: 'rgb(220,220,220)',
	};
  }, [currentTheme]);

  // ── State ────────────────────────────────────────────────────────────────────
  const [state, setState] = useState<CalculatorState>(initialState());
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);

  useEffect(() => {
	stateRef.current = state;
  }, [state]);

  useFocusEffect(
	React.useCallback(() => {
	  return () => {
		setActiveInputId(null);
	  };
	}, [setActiveInputId])
  );

  // ── ScrollView + auto-scroll ──────────────────────────────────────────────
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, View | null>>({});
  const activeInputIdRef = useRef<string | null>(null);

  useEffect(() => {
	activeInputIdRef.current = activeInputId;
  }, [activeInputId]);

  useEffect(() => {
	if (!activeInputId) return;
	const viewRef = inputRefs.current[activeInputId];
	if (!viewRef || !scrollViewRef.current) return;
	setTimeout(() => {
	  viewRef.measureLayout(
		scrollViewRef.current as any,
		(_x, y, _w, height) => {
		  const KEYBOARD_HEIGHT = 280;
		  const SCREEN_HEIGHT = Dimensions.get('window').height;
		  const targetScrollY = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
		  scrollViewRef.current?.scrollTo({ y: Math.max(0, targetScrollY), animated: true });
		},
		() => {}
	  );
	}, 150);
  }, [activeInputId]);

  // ── Animations ────────────────────────────────────────────────────────────
  const heartScale = useRef(new Animated.Value(1)).current;

  // ── DB / favourites ───────────────────────────────────────────────────────
  const dbRef = useRef<any>(null);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
	let mounted = true;
	(async () => {
	  try {
		const db = await getDBConnection();
		if (!mounted) return;
		await createTable(db);
		await createFavoritesTable(db);
		dbRef.current = db;
		const fav = await isFavorite(db, 'CompDiseñoSerie');
		if (mounted) setIsFav(fav);
	  } catch {}
	})();
	return () => {
	  mounted = false;
	};
  }, []);

  const toggleFavorite = useCallback(async () => {
	try {
	  const db = dbRef.current ?? (await getDBConnection());
	  if (!dbRef.current) {
		await createTable(db);
		await createFavoritesTable(db);
		dbRef.current = db;
	  }
	  const route = 'CompDiseñoSerie';
	  const label = t('compDiseñoSerie.title') || 'Tuberías en Serie';
	  const currentlyFav = await isFavorite(db, route);
	  if (currentlyFav) {
		await removeFavorite(db, route);
		setIsFav(false);
		Toast.show({
		  type: 'error',
		  text1: t('favorites.deleted'),
		  text2: t('favorites.deletedDesc'),
		});
	  } else {
		await addFavorite(db, { route, label });
		setIsFav(true);
		Toast.show({
		  type: 'success',
		  text1: t('favorites.success'),
		  text2: t('favorites.successDesc'),
		});
	  }
	} catch {
	  Toast.show({
		type: 'error',
		text1: t('common.error'),
		text2: t('common.genericError'),
	  });
	}
  }, [t]);

  const bounceHeart = useCallback(() => {
	Animated.sequence([
	  Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
	  Animated.timing(heartScale, { toValue: 1.0, duration: 120, useNativeDriver: true }),
	]).start();
  }, [heartScale]);

  // ── Navigate to options ───────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (
      category: string,
      onSelectOption: (opt: string) => void,
      selectedOption?: string
    ) => {
      navigation.navigate({
        name: 'CalculatorOptionsScreen',
        params: buildCalculatorOptionsParams('compDisenoSerie', {
          category,
          onSelectOption,
          selectedOption,
        }),
      });
    },
    [navigation]
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const adjustDecimalSeparator = useCallback(
	(s: string): string =>
	  selectedDecimalSeparator === 'Coma' ? s.replace('.', ',') : s,
	[selectedDecimalSeparator]
  );

  const formatResult = useCallback((num: number): string => {
	if (!isFinite(num) || isNaN(num)) return '-';
	if (num === 0) return '0';
	const d = new Decimal(num);
	return d.toSignificantDigits(8).toString();
  }, []);

  const convertValue = useCallback(
	(value: string, fromUnit: string, toUnit: string, category: string): string => {
	  if (!value || value.trim() === '') return '';
	  const num = parseFloat(value.replace(',', '.'));
	  if (isNaN(num)) return value;
	  const fromF = conversionFactors[category]?.[fromUnit] ?? 1;
	  const toF = conversionFactors[category]?.[toUnit] ?? 1;
	  return formatResult((num * fromF) / toF);
	},
	[formatResult]
  );

  // ── Tramo CRUD ────────────────────────────────────────────────────────────
  const addTramo = useCallback(() => {
	setState(prev => ({ ...prev, tramos: [...prev.tramos, createNewTramo()] }));
  }, []);

  const removeTramo = useCallback((id: number) => {
	setState(prev => ({
	  ...prev,
	  tramos: prev.tramos.filter(t => t.id !== id),
	}));
  }, []);

  const updateTramo = useCallback((id: number, updates: Partial<Tramo>) => {
	setState(prev => ({
	  ...prev,
	  tramos: prev.tramos.map(t => (t.id === id ? { ...t, ...updates } : t)),
	}));
  }, []);

  // ── Custom keyboard handlers ──────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
	const id = activeInputIdRef.current;
	if (!id) return '';
	const s = stateRef.current;

	// Global fields
	const globalMap: Record<string, string> = {
	  nu: s.nu,
	  H1: s.H1,
	  H2: s.H2,
	};
	if (id in globalMap) return globalMap[id];

	// Tramo fields: "tramo-{id}-{field}"
	const parts = id.split('-');
	if (parts.length >= 3 && parts[0] === 'tramo') {
	  const tramoId = parseFloat(parts[1]);
	  const field = parts[2] as keyof Tramo;
	  const tramo = s.tramos.find(t => t.id === tramoId);
	  if (tramo && typeof tramo[field] === 'string') return tramo[field] as string;
	}

	return '';
  }, []);

  const handleKeyboardKey = useCallback((key: string) => {
	const id = activeInputIdRef.current;
	if (!id) return;
	inputHandlersRef.current[id]?.(getActiveValue() + key);
  }, [getActiveValue]);

  const handleKeyboardDelete = useCallback(() => {
	const id = activeInputIdRef.current;
	if (!id) return;
	inputHandlersRef.current[id]?.(getActiveValue().slice(0, -1));
  }, [getActiveValue]);

  const handleKeyboardClear = useCallback(() => {
	const id = activeInputIdRef.current;
	if (!id) return;
	inputHandlersRef.current[id]?.('');
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
	const id = activeInputIdRef.current;
	if (!id) return;
	const val = getActiveValue();
	if (val === '' || val === '.') return;
	inputHandlersRef.current[id]?.((parseFloat(val) * 10).toString());
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
	const id = activeInputIdRef.current;
	if (!id) return;
	const val = getActiveValue();
	if (val === '' || val === '.') return;
	inputHandlersRef.current[id]?.((parseFloat(val) / 10).toString());
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => {
	setActiveInputId(null);
  }, [setActiveInputId]);

  const isKeyboardOpen = !!activeInputId;

  // ── Input renderers ───────────────────────────────────────────────────────
  const renderSimpleInput = useCallback(
	(
	  fieldId: string,
	  label: string,
	  value: string,
	  onChange: (t: string) => void
	) => {
	  const isInvalid = state.invalidFields.includes(fieldId);
	  const hasValue = (value?.trim()?.length ?? 0) > 0;

	  inputHandlersRef.current[fieldId] = (text: string) => {
		onChange(text);
		setState(prev => ({
		  ...prev,
		  invalidFields: prev.invalidFields.filter(f => f !== fieldId),
		}));
	  };

	  return (
		<View
		  ref={r => {
			inputRefs.current[fieldId] = r;
		  }}
		  style={styles.inputWrapper}
		>
		  <View style={styles.labelRow}>
			<Text
			  style={[
				styles.inputLabel,
				{ color: themeColors.text, fontSize: 16 * fontSizeFactor },
			  ]}
			>
			  {label}
			</Text>
			<View
			  style={[
				styles.valueDot,
				{ backgroundColor: getDotColor(hasValue, isInvalid) },
			  ]}
			/>
		  </View>
		  <View
			style={[
			  styles.Container,
			  {
				experimental_backgroundImage: themeColors.gradient,
				width: '100%',
				flex: undefined,
			  },
			]}
		  >
			<View
			  style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}
			>
			  <Pressable
				onPress={() => setActiveInputId(fieldId)}
				style={StyleSheet.absoluteFill}
			  />
			  <TextInput
				style={[
				  styles.input,
				  { color: themeColors.text, fontSize: 16 * fontSizeFactor },
				]}
				value={value}
				editable={false}
				showSoftInputOnFocus={false}
				pointerEvents="none"
				placeholderTextColor={
				  currentTheme === 'dark'
					? 'rgba(255,255,255,0.35)'
					: 'rgba(0,0,0,0.35)'
				}
			  />
			</View>
		  </View>
		</View>
	  );
	},
	[state.invalidFields, themeColors, currentTheme, fontSizeFactor, setActiveInputId]
  );

  const renderInputWithUnit = useCallback(
	(
	  fieldId: string,
	  label: string,
	  value: string,
	  unit: string,
	  category: string,
	  onChange: (t: string) => void,
	  onUnitChange: (newUnit: string, oldUnit: string) => void
	) => {
	  const isInvalid = state.invalidFields.includes(fieldId);
	  const hasValue = (value?.trim()?.length ?? 0) > 0;

	  inputHandlersRef.current[fieldId] = (text: string) => {
		onChange(text);
		setState(prev => ({
		  ...prev,
		  invalidFields: prev.invalidFields.filter(f => f !== fieldId),
		}));
	  };

	  return (
		<View
		  ref={r => {
			inputRefs.current[fieldId] = r;
		  }}
		  style={styles.inputWrapper}
		>
		  <View style={styles.labelRow}>
			<Text
			  style={[
				styles.inputLabel,
				{ color: themeColors.text, fontSize: 16 * fontSizeFactor },
			  ]}
			>
			  {label}
			</Text>
			<View
			  style={[
				styles.valueDot,
				{ backgroundColor: getDotColor(hasValue, isInvalid) },
			  ]}
			/>
		  </View>
		  <View style={styles.redContainer}>
			<View
			  style={[
				styles.Container,
				{ experimental_backgroundImage: themeColors.gradient },
			  ]}
			>
			  <View
				style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}
			  >
				<Pressable
				  onPress={() => setActiveInputId(fieldId)}
				  style={StyleSheet.absoluteFill}
				/>
				<TextInput
				  style={[
					styles.input,
					{ color: themeColors.text, fontSize: 16 * fontSizeFactor },
				  ]}
				  value={value}
				  editable={false}
				  showSoftInputOnFocus={false}
				  pointerEvents="none"
				  placeholderTextColor={
					currentTheme === 'dark'
					  ? 'rgba(255,255,255,0.35)'
					  : 'rgba(0,0,0,0.35)'
				  }
				/>
			  </View>
			</View>
			<Pressable
			  style={[
				styles.Container2,
				{ experimental_backgroundImage: themeColors.gradient },
			  ]}
			  onPress={() =>
				navigateToOptions(category, (opt: string) => onUnitChange(opt, unit), unit)
			  }
			>
			  <View
				style={[
				  styles.innerWhiteContainer2,
				  { backgroundColor: themeColors.card },
				]}
			  >
				<Text
				  style={[
					styles.text,
					{ color: themeColors.text, fontSize: 16 * fontSizeFactor },
				  ]}
				>
				  {unit}
				</Text>
				<Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
			  </View>
			</Pressable>
		  </View>
		</View>
	  );
	},
	[
	  state.invalidFields,
	  themeColors,
	  currentTheme,
	  fontSizeFactor,
	  setActiveInputId,
	  navigateToOptions,
	]
  );

  // ── Tramo block renderer ──────────────────────────────────────────────────
  const renderTramoBlock = useCallback(
	(tramo: Tramo, index: number) => (
	  <View
		key={tramo.id}
		style={[
		  styles.accessoryBlockMain,
		  { experimental_backgroundImage: themeColors.gradient },
		]}
	  >
		<View
		  style={[
			styles.accessoryBlock,
			{
			  backgroundColor:
				currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(255,255,255)',
			},
		  ]}
		>
		  {/* Header */}
		  <View style={styles.accessoryHeader}>
			<Text
			  style={[
				styles.accessoryTitle,
				{ color: themeColors.textStrong, fontSize: 16 * fontSizeFactor },
			  ]}
			>
			  {t('compDiseñoSerie.tramoTitle') + ` ${index + 1}`}
			</Text>
			{state.tramos.length > 1 && (
			  <Pressable
				onPress={() => removeTramo(tramo.id)}
				style={styles.deleteButton}
				hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
			  >
				<Icon name="trash" size={18} color="rgb(255, 255, 255)" />
			  </Pressable>
			)}
		  </View>

		  {/* D — Diameter */}
		  {renderInputWithUnit(
			`tramo-${tramo.id}-D`,
			withSymbol(t('compDiseñoSerie.labels.D') || 'Diámetro', 'D'),
			tramo.D,
			tramo.DUnit,
			'length',
			text => updateTramo(tramo.id, { D: text }),
			(newUnit, oldUnit) => {
			  const converted = convertValue(tramo.D, oldUnit, newUnit, 'length');
			  updateTramo(tramo.id, { D: converted, DUnit: newUnit });
			}
		  )}

		  {/* L — Length */}
		  {renderInputWithUnit(
			`tramo-${tramo.id}-L`,
			withSymbol(t('compDiseñoSerie.labels.L') || 'Longitud', 'L'),
			tramo.L,
			tramo.LUnit,
			'length',
			text => updateTramo(tramo.id, { L: text }),
			(newUnit, oldUnit) => {
			  const converted = convertValue(tramo.L, oldUnit, newUnit, 'length');
			  updateTramo(tramo.id, { L: converted, LUnit: newUnit });
			}
		  )}

		  {/* Km — Minor loss coefficient */}
		  {renderSimpleInput(
			`tramo-${tramo.id}-Km`,
			withSymbol(t('compDiseñoSerie.labels.Km') || 'Coef. pérdidas menores', 'Kᵐ'),
			tramo.Km,
			text => updateTramo(tramo.id, { Km: text })
		  )}

		  {/* ks — Absolute roughness */}
		  {renderInputWithUnit(
			`tramo-${tramo.id}-ks`,
			withSymbol(t('compDiseñoSerie.labels.ks') || 'Rugosidad absoluta', 'kˢ'),
			tramo.ks,
			tramo.ksUnit,
			'length',
			text => updateTramo(tramo.id, { ks: text }),
			(newUnit, oldUnit) => {
			  const converted = convertValue(tramo.ks, oldUnit, newUnit, 'length');
			  updateTramo(tramo.id, { ks: converted, ksUnit: newUnit });
			}
		  )}

		  {/* q_lat — Lateral extraction */}
		  {renderInputWithUnit(
			`tramo-${tramo.id}-q_lat`,
			withSymbol(t('compDiseñoSerie.labels.q_lat') || 'Extracción lateral', 'qˡᵃᵗ'),
			tramo.q_lat,
			tramo.q_latUnit,
			'flow',
			text => updateTramo(tramo.id, { q_lat: text }),
			(newUnit, oldUnit) => {
			  const converted = convertValue(tramo.q_lat, oldUnit, newUnit, 'flow');
			  updateTramo(tramo.id, { q_lat: converted, q_latUnit: newUnit });
			}
		  )}
		</View>
	  </View>
	),
	[
	  state.tramos.length,
	  themeColors,
	  currentTheme,
	  fontSizeFactor,
	  t,
	  renderInputWithUnit,
	  renderSimpleInput,
	  convertValue,
	  updateTramo,
	  removeTramo,
	]
  );

  // ── Table renderers ───────────────────────────────────────────────────────
  const fmtNum = useCallback(
	(n: number): string => {
	  if (!isFinite(n) || isNaN(n)) return '-';
	  if (n === 0) return '0';
	  const s = formatResult(n);
	  return s.length > 10 ? s.substring(0, 10) : s;
	},
	[formatResult]
  );

  /** Summary table: final converged per-tramo values */
  const renderSummaryTable = useCallback(() => {
    if (!state.calcResult) return null;
    const { tramosData, H, H_total, Q_entrada, Q_extraido, Q_salida } =
      state.calcResult;
    const bc = themeColors.tableBorder;
    const hBg = themeColors.tableHeader;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const cols: [string, number][] = [
      [t('compDiseñoSerie.table.tramo') || 'Tramo', 52],
      [t('compDiseñoSerie.table.D') || 'D [m]', 76],
      [t('compDiseñoSerie.table.L') || 'L [m]', 76],
      [t('compDiseñoSerie.table.Q') || 'Q [m³/s]', 92],
      [t('compDiseñoSerie.table.V') || 'V [m/s]', 80],
      [t('compDiseñoSerie.table.Re') || 'Re', 80],
      [t('compDiseñoSerie.table.f') || 'f', 72],
      [t('compDiseñoSerie.table.hf') || 'hf [m]', 80],
      [t('compDiseñoSerie.table.hm') || 'hm [m]', 80],
      [t('compDiseñoSerie.table.htotal') || 'h_tot [m]', 88],
      [t('compDiseñoSerie.table.qlat') || 'q_lat [m³/s]', 100],
    ];

    const totalTableWidth = cols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;

    const renderTableContent = (scale: number, textColor: string, textStrong: string) => (
      <View style={[styles.tableContainer, { borderColor: bc }]}>
        {/* Header */}
        <View style={styles.tableRow}>
          {cols.map(([hdr, w], ci) => (
            <View
              key={`sh-${ci}`}
              style={[
                styles.tableCell,
                {
                  width: w * scale,
                  borderColor: bc,
                  backgroundColor: hBg,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <Text
                style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]}
                numberOfLines={1}
              >
                {hdr}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {tramosData.map((row, i) => {
          const rowBg =
            i % 2 !== 0
              ? currentTheme === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)'
              : 'transparent';
          const rowData = [
            String(i + 1),
            fmtNum(row.D),
            fmtNum(row.L),
            fmtNum(row.Q),
            fmtNum(row.V),
            fmtNum(row.Re),
            fmtNum(row.f),
            fmtNum(row.hf),
            fmtNum(row.hm),
            fmtNum(row.h_total),
            fmtNum(row.q_lat),
          ];
          return (
            <View key={`sr-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
              {cols.map(([, w], ci) => (
                <View
                  key={`sc-${i}-${ci}`}
                  style={[styles.tableCell, { width: w * scale, borderColor: bc }]}
                >
                  <Text
                    style={[styles.tableCellText, { color: textColor, fontSize: 11 * scale }]}
                    numberOfLines={1}
                  >
                    {rowData[ci] ?? '-'}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Totals row */}
        <View
          style={[
            styles.tableRow,
            {
              backgroundColor:
                currentTheme === 'dark'
                  ? 'rgba(194,254,12,0.08)'
                  : 'rgba(194,254,12,0.15)',
            },
          ]}
        >
          {cols.map(([, w], ci) => {
            let content = '-';
            if (ci === 0) content = t('compDiseñoSerie.table.total') || 'Σ';
            else if (ci === 9) content = fmtNum(H_total);
            return (
              <View
                key={`st-${ci}`}
                style={[styles.tableCell, { width: w * scale, borderColor: bc }]}
              >
                <Text
                  style={[styles.tableCellHeaderText, { color: textStrong, fontSize: 11 * scale }]}
                  numberOfLines={1}
                >
                  {content}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );

    const modalLandscapeWidth = screenHeight;
    const modalLandscapeHeight = screenWidth;

    return (
      <View style={{ marginTop: 8 }}>
        {/* Title row with expand button */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 15,
          }}
        >
          <Text
            style={[
              styles.sectionSubtitle,
              { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
            ]}
          >
            {t('compDiseñoSerie.table.summaryTitle') || 'Resumen final'}
          </Text>
          <Pressable
            onPress={() => setSummaryModalVisible(true)}
            style={styles.expandButton}
          >
            <View
              style={[
                styles.buttonBackground2,
                {
                  backgroundColor: 'transparent',
                  experimental_backgroundImage: themeColors.cardGradient2,
                },
              ]}
            />
            <MaskedView
              style={styles.expandButtonMasked}
              maskElement={<View style={styles.expandButtonMask} />}
            >
              <View
                style={[
                  styles.buttonGradient2,
                  { experimental_backgroundImage: themeColors.gradient2 },
                ]}
              />
            </MaskedView>
            <View style={styles.expandButtonContent}>
              <Text
                style={[
                  styles.expandButtonText,
                  { color: themeColors.text, fontSize: 14 * fontSizeFactor },
                ]}
              >
                {t('compDiseñoSerie.table.viewFull') || 'Ver completo'}
              </Text>
              <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
            </View>
          </Pressable>
        </View>

        {/* Inline horizontally-scrollable table */}
        <View style={{ alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
          </ScrollView>
        </View>

        {/* Balance */}
        <View style={[styles.balanceContainer, { borderColor: themeColors.tableBorder }]}>
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {t('compDiseñoSerie.balance.entrada') || 'Q entrada (tramo 1)'}
            {': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(Q_entrada)} m³/s
            </Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {t('compDiseñoSerie.balance.extraido') || 'Q extraído (Σ q_lat)'}
            {': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(Q_extraido)} m³/s
            </Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {t('compDiseñoSerie.balance.salida') || 'Q salida (nodo B)'}
            {': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(Q_salida)} m³/s
            </Text>
          </Text>
          <Text style={[styles.balanceText, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>
            {'ΔH disp.'}{': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(H)} m
            </Text>
            {'   '}
            {'Σ h_total'}{': '}
            <Text style={[styles.balanceValue, { color: themeColors.textStrong }]}>
              {fmtNum(H_total)} m
            </Text>
          </Text>
        </View>

        {/* ── Landscape modal ── */}
        <Modal
          visible={summaryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSummaryModalVisible(false)}
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalLandscapeContainer,
                {
                  width: modalLandscapeWidth,
                  height: modalLandscapeHeight,
                  transform: [{ rotate: '90deg' }],
                  backgroundColor:
                    currentTheme === 'dark' ? 'rgb(24,24,24)' : 'rgb(255,255,255)',
                },
              ]}
            >
              <ScrollView
                style={{
                  flex: 1,
                  backgroundColor:
                    currentTheme === 'dark' ? 'rgb(14,14,14)' : 'rgb(255,255,255)',
                }}
                contentContainerStyle={{ paddingVertical: 0, alignItems: 'center' }}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.modalHeader,
                    {
                      backgroundColor: 'transparent',
                      width: totalTableWidth + 40,
                      paddingHorizontal: 0,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Text style={[styles.modalTitle, { color: themeColors.textStrong }]}>
                    {t('compDiseñoSerie.table.summaryTitle') || 'Resumen final'}
                  </Text>
                  <Pressable
                    onPress={() => setSummaryModalVisible(false)}
                    style={styles.modalCloseButton}
                  >
                    <View
                      style={[
                        styles.buttonBackground22,
                        {
                          backgroundColor: 'transparent',
                          experimental_backgroundImage: themeColors.cardGradient2,
                        },
                      ]}
                    />
                    <MaskedView
                      style={styles.modalCloseButtonMasked}
                      maskElement={<View style={styles.modalCloseButtonMask} />}
                    >
                      <View
                        style={[
                          styles.buttonGradient22,
                          { experimental_backgroundImage: themeColors.gradient2 },
                        ]}
                      />
                    </MaskedView>
                    <Icon
                      name="x"
                      size={18}
                      color={themeColors.icon}
                      style={styles.modalCloseButtonIcon}
                    />
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderTableContent(
                    fontSizeFactor,
                    themeColors.text,
                    themeColors.textStrong
                  )}
                </ScrollView>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }, [state.calcResult, summaryModalVisible, themeColors, currentTheme, fontSizeFactor, t, fmtNum]);

  /** Iteration history table (DiseñoCalc2 style with expand button + modal) */
  const renderIterationTable = useCallback(() => {
	if (!state.calcResult || state.calcResult.iterationTable.length === 0) return null;

	const { iterationTable, converged } = state.calcResult;
	const N = state.tramos.length;
	const bc = themeColors.tableBorder;
	const hBg = themeColors.tableHeader;
	const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

	// Build column definitions dynamically
	const fixedCols: [string, number][] = [
	  [t('compDiseñoSerie.table.iter') || 'Iter', 46],
	  [t('compDiseñoSerie.table.Hcalc') || 'H_calc [m]', 94],
	  [t('compDiseñoSerie.table.error') || 'Error [m]', 94],
	];

	const tramoCols: [string, number][] = [];
	for (let i = 0; i < N; i++) {
	  const n = i + 1;
	  tramoCols.push(
		[`Q${n} [m³/s]`, 94],
		[`V${n} [m/s]`, 82],
		[`Re${n}`, 82],
		[`f${n}`, 72],
		[`hf${n} [m]`, 82],
		[`hm${n} [m]`, 82]
	  );
	}

	const cols: [string, number][] = [...fixedCols, ...tramoCols];
	const totalTableWidth = cols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;

	const renderTableContent = (scale: number, textColor: string, textStrong: string) => (
	  <View style={[styles.tableContainer, { borderColor: bc }]}>
		{/* Header row */}
		<View style={styles.tableRow}>
		  {cols.map(([hdr, w], ci) => (
			<View
			  key={`ih-${ci}`}
			  style={[
				styles.tableCell,
				{ width: w * scale, borderColor: bc, backgroundColor: hBg, borderBottomWidth: 1 },
			  ]}
			>
			  <Text
				style={[
				  styles.tableCellHeaderText,
				  { color: textStrong, fontSize: 11 * scale },
				]}
				numberOfLines={1}
			  >
				{hdr}
			  </Text>
			</View>
		  ))}
		</View>

		{/* Data rows */}
		{iterationTable.map((row, ri) => {
		  const isLast = ri === iterationTable.length - 1;
		  const isConvergedRow = isLast && converged;
		  const rowBg = isConvergedRow
			? currentTheme === 'dark'
			  ? 'rgba(194,254,12,0.08)'
			  : 'rgba(194,254,12,0.15)'
			: ri % 2 !== 0
			? currentTheme === 'dark'
			  ? 'rgba(255,255,255,0.03)'
			  : 'rgba(0,0,0,0.02)'
			: 'transparent';

		  const rowData: string[] = [
			isConvergedRow ? '→ ' + String(row.iter) : String(row.iter),
			fmtNum(row.H_calc),
			fmtNum(row.error),
		  ];
		  row.tramosData.forEach(td => {
			rowData.push(
			  fmtNum(td.Q),
			  fmtNum(td.V),
			  fmtNum(td.Re),
			  fmtNum(td.f),
			  fmtNum(td.hf),
			  fmtNum(td.hm)
			);
		  });

		  return (
			<View key={`ir-${ri}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
			  {cols.map(([, w], ci) => (
				<View
				  key={`ic-${ri}-${ci}`}
				  style={[styles.tableCell, { width: w * scale, borderColor: bc }]}
				>
				  <Text
					style={[
					  isConvergedRow ? styles.tableCellHeaderText : styles.tableCellText,
					  {
						color: isConvergedRow ? textStrong : textColor,
						fontSize: 11 * scale,
					  },
					]}
					numberOfLines={1}
				  >
					{rowData[ci] ?? '-'}
				  </Text>
				</View>
			  ))}
			</View>
		  );
		})}
	  </View>
	);

	const modalLandscapeWidth = screenHeight;
	const modalLandscapeHeight = screenWidth;

	return (
	  <View style={{ marginTop: 8 }}>
		{/* Title row with expand button */}
		<View
		  style={{
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: 15,
		  }}
		>
		  <Text
			style={[
			  styles.sectionSubtitle,
			  { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
			]}
		  >
			{t('compDiseñoSerie.table.iterTitle') || 'Tabla de iteraciones'}
		  </Text>
		  <Pressable
			onPress={() => setTableModalVisible(true)}
			style={styles.expandButton}
		  >
			<View
			  style={[
				styles.buttonBackground2,
				{
				  backgroundColor: 'transparent',
				  experimental_backgroundImage: themeColors.cardGradient2,
				},
			  ]}
			/>
			<MaskedView
			  style={styles.expandButtonMasked}
			  maskElement={<View style={styles.expandButtonMask} />}
			>
			  <View
				style={[
				  styles.buttonGradient2,
				  { experimental_backgroundImage: themeColors.gradient2 },
				]}
			  />
			</MaskedView>
			<View style={styles.expandButtonContent}>
			  <Text
				style={[
				  styles.expandButtonText,
				  { color: themeColors.text, fontSize: 14 * fontSizeFactor },
				]}
			  >
				{t('compDiseñoSerie.table.viewFull') || 'Ver completo'}
			  </Text>
			  <IconExpand name="expand-sharp" size={20} color={themeColors.icon} />
			</View>
		  </Pressable>
		</View>

		{/* Inline horizontally-scrollable table */}
		<View style={{ alignItems: 'center' }}>
		  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
			{renderTableContent(fontSizeFactor, themeColors.text, themeColors.textStrong)}
		  </ScrollView>
		</View>

		{/* ── Landscape modal ── */}
		<Modal
		  visible={tableModalVisible}
		  transparent
		  animationType="fade"
		  onRequestClose={() => setTableModalVisible(false)}
		  statusBarTranslucent
		>
		  <View style={styles.modalOverlay}>
			<View
			  style={[
				styles.modalLandscapeContainer,
				{
				  width: modalLandscapeWidth,
				  height: modalLandscapeHeight,
				  transform: [{ rotate: '90deg' }],
				  backgroundColor:
					currentTheme === 'dark' ? 'rgb(24,24,24)' : 'rgb(255,255,255)',
				},
			  ]}
			>
			  <ScrollView
				style={{
				  flex: 1,
				  backgroundColor:
					currentTheme === 'dark' ? 'rgb(14,14,14)' : 'rgb(255,255,255)',
				}}
				contentContainerStyle={{ paddingVertical: 0, alignItems: 'center' }}
				showsVerticalScrollIndicator
			  >
				<View
				  style={[
					styles.modalHeader,
					{
					  backgroundColor: 'transparent',
					  width: totalTableWidth + 40,
					  paddingHorizontal: 0,
					  marginBottom: 8,
					},
				  ]}
				>
				  <Text
					style={[
					  styles.modalTitle,
					  { color: themeColors.textStrong },
					]}
				  >
					{t('compDiseñoSerie.table.iterTitle') || 'Tabla de iteraciones'}
				  </Text>
				  <Pressable
					onPress={() => setTableModalVisible(false)}
					style={styles.modalCloseButton}
				  >
					<View
					  style={[
						styles.buttonBackground22,
						{
						  backgroundColor: 'transparent',
						  experimental_backgroundImage: themeColors.cardGradient2,
						},
					  ]}
					/>
					<MaskedView
					  style={styles.modalCloseButtonMasked}
					  maskElement={<View style={styles.modalCloseButtonMask} />}
					>
					  <View
						style={[
						  styles.buttonGradient22,
						  { experimental_backgroundImage: themeColors.gradient2 },
						]}
					  />
					</MaskedView>
					<Icon
					  name="x"
					  size={18}
					  color={themeColors.icon}
					  style={styles.modalCloseButtonIcon}
					/>
				  </Pressable>
				</View>

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				  {renderTableContent(
					fontSizeFactor,
					themeColors.text,
					themeColors.textStrong
				  )}
				</ScrollView>
			  </ScrollView>
			</View>
		  </View>
		</Modal>
	  </View>
	);
  }, [
	state.calcResult,
	state.tramos.length,
	tableModalVisible,
	themeColors,
	currentTheme,
	fontSizeFactor,
	t,
	fmtNum,
  ]);

  // ── Calculate handler ─────────────────────────────────────────────────────
  const handleCalculate = useCallback(() => {
	const invalid: string[] = [];

	const nuRaw = parseFloat((state.nu || '').replace(',', '.'));
	const nuSI = isNaN(nuRaw) ? NaN : nuRaw * (conversionFactors.viscosity[state.nuUnit] ?? 1);
	if (!isFinite(nuSI) || nuSI <= 0) invalid.push('nu');

	const H1Raw = parseFloat((state.H1 || '').replace(',', '.'));
	const H1SI = isNaN(H1Raw) ? NaN : H1Raw * (conversionFactors.length[state.H1Unit] ?? 1);
	if (!isFinite(H1SI)) invalid.push('H1');

	const H2Raw = parseFloat((state.H2 || '').replace(',', '.'));
	const H2SI = isNaN(H2Raw) ? NaN : H2Raw * (conversionFactors.length[state.H2Unit] ?? 1);
	if (!isFinite(H2SI)) invalid.push('H2');

	if (isFinite(H1SI) && isFinite(H2SI) && H1SI <= H2SI) {
	  if (!invalid.includes('H1')) invalid.push('H1');
	  if (!invalid.includes('H2')) invalid.push('H2');
	}

	const TOLRaw = 1e-6;
	const MAX_ITERRaw = 200;

	const tramosForCalc: { D: number; L: number; Km: number; ks: number; q_lat: number }[] = [];

	state.tramos.forEach(tramo => {
	  const D_raw = parseFloat((tramo.D || '').replace(',', '.'));
	  const D_si = isNaN(D_raw) ? NaN : D_raw * (conversionFactors.length[tramo.DUnit] ?? 1);
	  if (!isFinite(D_si) || D_si <= 0) invalid.push(`tramo-${tramo.id}-D`);

	  const L_raw = parseFloat((tramo.L || '').replace(',', '.'));
	  const L_si = isNaN(L_raw) ? NaN : L_raw * (conversionFactors.length[tramo.LUnit] ?? 1);
	  if (!isFinite(L_si) || L_si <= 0) invalid.push(`tramo-${tramo.id}-L`);

	  const Km_raw = parseFloat((tramo.Km || '').replace(',', '.'));
	  if (isNaN(Km_raw) || Km_raw < 0) invalid.push(`tramo-${tramo.id}-Km`);

	  const ks_raw = parseFloat((tramo.ks || '').replace(',', '.'));
	  const ks_si = isNaN(ks_raw) ? NaN : ks_raw * (conversionFactors.length[tramo.ksUnit] ?? 1);
	  if (!isFinite(ks_si) || ks_si < 0) invalid.push(`tramo-${tramo.id}-ks`);

	  const q_lat_raw = parseFloat((tramo.q_lat || '').replace(',', '.'));
	  const q_lat_si = isNaN(q_lat_raw)
		? 0
		: q_lat_raw * (conversionFactors.flow[tramo.q_latUnit] ?? 1);

	  tramosForCalc.push({
		D: isFinite(D_si) ? D_si : 0,
		L: isFinite(L_si) ? L_si : 0,
		Km: isNaN(Km_raw) ? 0 : Km_raw,
		ks: isFinite(ks_si) ? ks_si : 0,
		q_lat: isFinite(q_lat_si) ? q_lat_si : 0,
	  });
	});

	if (invalid.length > 0) {
	  setState(prev => ({ ...prev, invalidFields: invalid }));
	  Toast.show({
		type: 'error',
		text1: t('common.error'),
		text2: t('compDiseñoSerie.toasts.missingFields') || 'Faltan campos obligatorios',
	  });
	  return;
	}

	try {
	  const result = calcularSerie(nuSI, H1SI, H2SI, TOLRaw, MAX_ITERRaw, tramosForCalc);
	  setState(prev => ({ ...prev, invalidFields: [], calcResult: result }));
	  if (!result.converged) {
		Toast.show({
		  type: 'error',
		  text1: t('common.error'),
		  text2: t('compDiseñoSerie.toasts.notConverged') || 'No se alcanzó la convergencia',
		});
	  }
	} catch {
	  Toast.show({
		type: 'error',
		text1: t('common.error'),
		text2: t('compDiseñoSerie.toasts.calcError') || 'Error en el cálculo',
	  });
	}
  }, [state, t]);

  // ── Copy handler ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
	const cr = state.calcResult;
	let text = '';
	text += `${t('compDiseñoSerie.labels.Q_entrada') || 'Q entrada (tramo 1)'}: ${cr ? fmtNum(cr.Q_entrada) : '-'} m³/s\n`;
	text += `ν: ${state.nu} ${state.nuUnit}\n`;
	text += `H1: ${state.H1} ${state.H1Unit}  H2: ${state.H2} ${state.H2Unit}\n`;
	state.tramos.forEach((tr, i) => {
	  text += `\n${t('compDiseñoSerie.tramoTitle') || 'Tramo'} ${i + 1}:\n`;
	  text += `  D: ${tr.D} ${tr.DUnit}\n`;
	  text += `  L: ${tr.L} ${tr.LUnit}\n`;
	  text += `  Km: ${tr.Km}\n`;
	  text += `  ks: ${tr.ks} ${tr.ksUnit}\n`;
	  text += `  q_lat: ${tr.q_lat} ${tr.q_latUnit}\n`;
	});
	Clipboard.setString(text);
	Toast.show({
	  type: 'success',
	  text1: t('common.success'),
	  text2: t('compDiseñoSerie.toasts.copied') || 'Copiado al portapapeles',
	});
  }, [state, fmtNum, t]);

  // ── Clear handler ─────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
	setState(initialState());
  }, []);

  // ── Save to history handler ───────────────────────────────────────────────
  const handleSaveHistory = useCallback(async () => {
	if (!state.calcResult) {
	  Toast.show({
		type: 'error',
		text1: t('common.error'),
		text2: t('compDiseñoSerie.toasts.nothingToSave') || 'Nada para guardar',
	  });
	  return;
	}
	try {
	  const db = dbRef.current ?? (await getDBConnection());
	  if (!dbRef.current) {
		await createTable(db);
		dbRef.current = db;
	  }
	  const inputs = {
		nu: state.nu,
		nuUnit: state.nuUnit,
		H1: state.H1,
		H1Unit: state.H1Unit,
		H2: state.H2,
		H2Unit: state.H2Unit,
		tramos: state.tramos.map(tr => ({
		  D: tr.D,
		  DUnit: tr.DUnit,
		  L: tr.L,
		  LUnit: tr.LUnit,
		  Km: tr.Km,
		  ks: tr.ks,
		  ksUnit: tr.ksUnit,
		  q_lat: tr.q_lat,
		  q_latUnit: tr.q_latUnit,
		})),
	  };
	  const resultStr = `${fmtNum(state.calcResult.Q_entrada)} m³/s`;
	  await saveCalculation(
		db,
		'CompDiseñoSerie',
		JSON.stringify(inputs),
		resultStr
	  );
	  Toast.show({
		type: 'success',
		text1: t('common.success'),
		text2: t('compDiseñoSerie.toasts.saved') || 'Guardado en historial',
	  });
	} catch {
	  Toast.show({
		type: 'error',
		text1: t('common.error'),
		text2: t('compDiseñoSerie.toasts.saveError') || 'Error al guardar',
	  });
	}
  }, [state, fmtNum, t]);

  // ── Main result ───────────────────────────────────────────────────────────
  const mainResultValue = useMemo(() => {
	if (!state.calcResult) return '';
	const Q = state.calcResult.Q_entrada;
	if (!isFinite(Q) || isNaN(Q)) return '-';
	const s = formatResult(Q);
	const num = parseFloat(s);
	if (isNaN(num)) return s;
	return adjustDecimalSeparator(formatNumber(num));
  }, [state.calcResult, formatResult, formatNumber, adjustDecimalSeparator]);

  const hasResult = !!state.calcResult;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
	<View style={styles.safeArea}>
	  <ScrollView
		ref={scrollViewRef}
		style={styles.mainContainer}
		contentContainerStyle={{ flexGrow: 1 }}
		keyboardShouldPersistTaps="handled"
		contentInset={{ bottom: isKeyboardOpen ? 280 : 0 }}
	  >
		{/* ── Header ── */}
		<View style={styles.headerContainer}>
		  <View style={styles.iconWrapper}>
			<Pressable
			  style={[
				styles.iconContainer,
				{
				  backgroundColor: 'transparent',
				  experimental_backgroundImage: themeColors.cardGradient,
				},
			  ]}
			  onPress={() => navigation.goBack()}
			>
			  <Icon name="chevron-left" size={22} color="rgb(255, 255, 255)" />
			</Pressable>
		  </View>
		  <View style={styles.rightIconsContainer}>
			<View style={styles.iconWrapper2}>
			  <Pressable
				style={[
				  styles.iconContainer,
				  {
					backgroundColor: 'transparent',
					experimental_backgroundImage: themeColors.cardGradient,
				  },
				]}
				onPress={() => {
				  bounceHeart();
				  toggleFavorite();
				}}
			  >
				<Animated.View style={{ transform: [{ scale: heartScale }] }}>
				  <IconFavorite
					name={isFav ? 'heart' : 'heart-o'}
					size={20}
					color={isFav ? 'rgba(255, 63, 63, 1)' : 'rgb(255, 255, 255)'}
				  />
				</Animated.View>
			  </Pressable>
			</View>
			<View style={styles.iconWrapper2}>
			  <Pressable
				style={[
				  styles.iconContainer,
				  {
					backgroundColor: 'transparent',
					experimental_backgroundImage: themeColors.cardGradient,
				  },
				]}
				onPress={() => navigation.navigate('CompDiseñoSerieTheory')}
			  >
				<Icon name="book" size={20} color="rgb(255, 255, 255)" />
			  </Pressable>
			</View>
		  </View>
		</View>

		{/* ── Titles ── */}
		<View style={styles.titlesContainer}>
		  <Text style={[styles.subtitle, { fontSize: 18 * fontSizeFactor }]}>
			{t('compDiseñoSerie.calculator') || 'Calculadora'}
		  </Text>
		  <Text style={[styles.title, { fontSize: 30 * fontSizeFactor }]}>
			{t('compDiseñoSerie.title') || 'Tuberías en Serie'}
		  </Text>
		</View>

		{/* ── Main result panel ── */}
		<View style={styles.resultsMain}>
		  <View style={styles.resultsContainerMain}>
			<Pressable style={styles.resultsContainer} onPress={handleSaveHistory}>
			  <View style={styles.saveButton}>
				<Text
				  style={[styles.saveButtonText, { fontSize: 14 * fontSizeFactor }]}
				>
				  {t('energiaBernoulliCalc.saveToHistory') || 'Guardar en historial'}
				</Text>
				<Icon
				  name="plus"
				  size={16 * fontSizeFactor}
				  color="rgba(255, 255, 255, 0.4)"
				  style={styles.plusIcon}
				/>
			  </View>
			  <View style={styles.imageContainer}>
				<View style={styles.flowContainer}>
				  <FastImage
					source={backgroundImage}
					style={StyleSheet.absoluteFillObject}
				  />
				  {currentTheme === 'dark' && (
					<View
					  pointerEvents="none"
					  style={{
						...(StyleSheet.absoluteFillObject as object),
						backgroundColor: 'rgba(0,0,0,0.7)',
					  }}
					/>
				  )}
				  <View style={styles.caudalLabel}>
					<Text
					  style={[
						styles.flowLabel,
						{
						  color:
							currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
						  fontSize: 16 * fontSizeFactor,
						},
					  ]}
					>
					  {!hasResult
						? 'な'
						: `${t('compDiseñoSerie.resultLabel') || 'Caudal de entrada'} (m³/s)`}
					</Text>
				  </View>
				  <View style={styles.flowValueContainer}>
					<Text
					  style={[
						styles.flowValue,
						{
						  color:
							currentTheme === 'dark' ? '#FFFFFF' : 'rgba(0,0,0,1)',
						  fontSize: 30 * fontSizeFactor,
						},
					  ]}
					>
					  {!hasResult ? '一' : mainResultValue}
					</Text>
				  </View>
				</View>
			  </View>
			</Pressable>
		  </View>
		</View>

		{/* ── Action buttons ── */}
		<View style={styles.buttonsContainer}>
		  {(
			[
			  {
				icon: 'terminal',
				label: t('common.calculate') || 'Calcular',
				action: handleCalculate,
			  },
			  {
				icon: 'copy',
				label: t('common.copy') || 'Copiar',
				action: handleCopy,
			  },
			  {
				icon: 'trash',
				label: t('common.clear') || 'Limpiar',
				action: handleClear,
			  },
			  {
				icon: 'clock',
				label: t('common.history') || 'Historial',
				action: () => navigation.navigate('HistoryScreenCompDiseñoSerie'),
			  },
			] as { icon: string; label: string; action: () => void }[]
		  ).map(({ icon, label, action }) => (
			<View style={styles.actionWrapper} key={label}>
			  <View style={styles.actionButtonMain}>
				<Pressable
				  style={[
					styles.actionButton,
					{
					  backgroundColor: 'transparent',
					  experimental_backgroundImage: themeColors.cardGradient,
					},
				  ]}
				  onPress={action}
				>
				  <Icon name={icon} size={22 * fontSizeFactor} color="rgb(255, 255, 255)" />
				  <Icon
					name={icon}
					size={22 * fontSizeFactor}
					color="rgba(255, 255, 255, 0.5)"
					style={{ position: 'absolute', filter: 'blur(4px)' }}
				  />
				</Pressable>
			  </View>
			  <Text style={[styles.actionButtonText, { fontSize: 14 * fontSizeFactor }]}>
				{label}
			  </Text>
			</View>
		  ))}
		</View>

		{/* ── Input section ── */}
		<View
		  style={[
			styles.inputsSection,
			{
			  backgroundColor: themeColors.card,
			  paddingBottom: isKeyboardOpen ? 330 : 70,
			},
		  ]}
		>
		  {/* ── Global parameters ── */}
		  <Text
			style={[
			  styles.sectionSubtitle,
			  { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
			]}
		  >
			{t('compDiseñoSerie.globalParams') || 'Parámetros globales'}
		  </Text>

		  {renderInputWithUnit(
			'nu',
			withSymbol(t('compDiseñoSerie.labels.nu') || 'Viscosidad cinemática', 'ν'),
			state.nu,
			state.nuUnit,
			'viscosity',
			text => setState(prev => ({ ...prev, nu: text })),
			(newUnit, oldUnit) => {
			  const converted = convertValue(state.nu, oldUnit, newUnit, 'viscosity');
			  setState(prev => ({ ...prev, nu: converted, nuUnit: newUnit }));
			}
		  )}

		  {renderInputWithUnit(
			'H1',
			withSymbol(t('compDiseñoSerie.labels.H1') || 'Carga piezométrica aguas arriba', 'H₁'),
			state.H1,
			state.H1Unit,
			'length',
			text => setState(prev => ({ ...prev, H1: text })),
			(newUnit, oldUnit) => {
			  const converted = convertValue(state.H1, oldUnit, newUnit, 'length');
			  setState(prev => ({ ...prev, H1: converted, H1Unit: newUnit }));
			}
		  )}

		  {renderInputWithUnit(
			'H2',
			withSymbol(t('compDiseñoSerie.labels.H2') || 'Carga piezométrica aguas abajo', 'H₂'),
			state.H2,
			state.H2Unit,
			'length',
			text => setState(prev => ({ ...prev, H2: text })),
			(newUnit, oldUnit) => {
			  const converted = convertValue(state.H2, oldUnit, newUnit, 'length');
			  setState(prev => ({ ...prev, H2: converted, H2Unit: newUnit }));
			}
		  )}

		  <View
			style={[styles.separator, { backgroundColor: themeColors.separator }]}
		  />

		  {/* ── Tramos section ── */}
		  <Text
			style={[
			  styles.sectionSubtitle,
			  { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor },
			]}
		  >
			{t('compDiseñoSerie.tramosSection') || 'Tramos'}
		  </Text>

		  {state.tramos.map((tramo, index) => renderTramoBlock(tramo, index))}

		  {/* Add tramo button */}
		  <View style={styles.addButtonRow}>
			<Pressable style={styles.addButton} onPress={addTramo}>
			  <Icon name="plus" size={24} color="white" />
			</Pressable>
		  </View>

		  {/* ── Results section ── */}
		  {hasResult && (
            <>
              <View
                style={[styles.separator, { backgroundColor: themeColors.separator }]}
              />

              {renderSummaryTable()}

              <View
                style={[styles.separator, { backgroundColor: themeColors.separator }]}
              />

              {renderIterationTable()}
            </>
          )}

          {/* Info text — solo visible cuando no hay resultado */}
          {!hasResult && (
            <View>
              <View style={[styles.separator, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
              <View style={styles.descriptionContainer}>
                <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                  {t('compDiseñoSerie.infoText')}
                </Text>
              </View>
            </View>
          )}
		</View>

		<View style={styles.logoContainer}>
		  <FastImage
			source={currentTheme === 'dark' ? logoDark : logoLight}
			style={styles.logoImage}
			resizeMode={FastImage.resizeMode.contain}
		  />
		</View>
	  </ScrollView>

	  {/* ── Custom keyboard ── */}
	  {isKeyboardOpen && (
		<View style={styles.customKeyboardWrapper}>
		  <CustomKeyboardPanel
			onKeyPress={handleKeyboardKey}
			onDelete={handleKeyboardDelete}
			onSubmit={handleKeyboardSubmit}
			onMultiplyBy10={handleKeyboardMultiply10}
			onDivideBy10={handleKeyboardDivide10}
			onClear={handleKeyboardClear}
		  />
		</View>
	  )}

	  <Toast config={toastConfig} position="bottom" />
	</View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
	flex: 1,
	backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  mainContainer: {
	flex: 1,
	paddingVertical: 0,
	backgroundColor: 'rgb(0, 0, 0)',
  },
  headerContainer: {
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center',
	minHeight: 45,
	backgroundColor: 'transparent',
	marginTop: 30,
	paddingHorizontal: 20,
  },
  iconWrapper: {
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
	width: 60,
	height: 40,
	borderRadius: 30,
	padding: 1,
  },
  iconWrapper2: {
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
	width: 40,
	height: 40,
	borderRadius: 30,
	padding: 1,
  },
  iconContainer: {
	backgroundColor: 'rgb(20, 20, 20)',
	borderRadius: 30,
	justifyContent: 'center',
	alignItems: 'center',
	flex: 1,
  },
  rightIconsContainer: {
	flexDirection: 'row',
	gap: 5,
	justifyContent: 'space-between',
  },
  titlesContainer: {
	backgroundColor: 'transparent',
	marginVertical: 10,
	paddingHorizontal: 20,
  },
  subtitle: {
	color: 'rgb(255, 255, 255)',
	fontSize: 18,
	fontFamily: 'SFUIDisplay-Bold',
  },
  title: {
	color: 'rgb(255, 255, 255)',
	fontSize: 30,
	fontFamily: 'SFUIDisplay-Bold',
	lineHeight: 30,
	marginBottom: 10,
  },
  resultsMain: {
	paddingHorizontal: 20,
  },
  resultsContainerMain: {
	padding: 1,
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
	borderRadius: 25,
  },
  resultsContainer: {
	backgroundColor: 'rgb(20, 20, 20)',
	borderRadius: 24,
	overflow: 'hidden',
  },
  saveButton: {
	backgroundColor: 'transparent',
	width: '100%',
	paddingVertical: 5,
	paddingHorizontal: 20,
	borderRadius: 6,
	alignSelf: 'flex-start',
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center',
  },
  saveButtonText: {
	color: 'rgba(255, 255, 255, 0.4)',
	fontFamily: 'SFUIDisplay-Medium',
	fontSize: 14,
  },
  plusIcon: {
	marginLeft: 'auto',
  },
  imageContainer: {
	backgroundColor: 'transparent',
	padding: 0,
	borderTopLeftRadius: 25,
	borderTopRightRadius: 25,
	borderBottomLeftRadius: 23,
	borderBottomRightRadius: 23,
	overflow: 'hidden',
  },
  flowContainer: {
	alignItems: 'baseline',
	padding: 0,
	justifyContent: 'center',
	position: 'relative',
  },
  caudalLabel: {
	backgroundColor: 'rgba(142, 142, 142, 0.02)',
	borderWidth: 1,
	borderColor: 'rgba(104, 104, 104, 0.12)',
	borderRadius: 14,
	marginLeft: 11,
	marginTop: 11,
	height: 28,
	minWidth: 90,
	justifyContent: 'center',
	alignItems: 'center',
	paddingHorizontal: 12,
  },
  flowLabel: {
	fontSize: 14,
	fontFamily: 'SFUIDisplay-Semibold',
  },
  flowValueContainer: {
	backgroundColor: 'transparent',
	marginHorizontal: 20,
	marginVertical: 0,
  },
  flowValue: {
	fontSize: 40,
	fontFamily: 'SFUIDisplay-Heavy',
  },
  buttonsContainer: {
	flexDirection: 'row',
	marginTop: 20,
	marginBottom: 15,
	backgroundColor: 'transparent',
	gap: 20,
	alignItems: 'center',
	justifyContent: 'center',
  },
  actionWrapper: {
	alignItems: 'center',
	backgroundColor: 'transparent',
  },
  actionButtonMain: {
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
	padding: 1,
	height: 60,
	width: 60,
	borderRadius: 30,
  },
  actionButton: {
	backgroundColor: 'rgb(20, 20, 20)',
	borderRadius: 30,
	justifyContent: 'center',
	alignItems: 'center',
	flex: 1,
  },
  actionButtonText: {
	marginTop: 2,
	fontSize: 14,
	color: 'rgba(255, 255, 255, 1)',
	fontFamily: 'SFUIDisplay-Medium',
  },
  // ── Input section ───────────────────────────────────────────────────────────
  inputsSection: {
	flex: 1,
	backgroundColor: 'rgba(255, 255, 255, 1)',
	paddingHorizontal: 20,
	paddingTop: 20,
	borderTopLeftRadius: 25,
	borderTopRightRadius: 25,
  },
  inputWrapper: {
	marginBottom: 10,
	backgroundColor: 'transparent',
  },
  labelRow: {
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'flex-start',
	gap: 5,
  },
  valueDot: {
	width: 6,
	height: 6,
	borderRadius: 5,
	backgroundColor: 'rgb(194, 254, 12)',
	marginLeft: 0,
	marginBottom: 1,
  },
  inputLabel: {
	color: 'rgb(0, 0, 0)',
	marginBottom: 2,
	fontFamily: 'SFUIDisplay-Medium',
	fontSize: 16,
  },
  redContainer: {
	backgroundColor: 'rgba(0, 0, 0, 0)',
	paddingHorizontal: 0,
	width: '100%',
	gap: 10,
	flexDirection: 'row',
  },
  Container: {
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	justifyContent: 'center',
	height: 50,
	overflow: 'hidden',
	borderRadius: 25,
	padding: 1,
	width: '68%',
  },
  Container2: {
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	justifyContent: 'center',
	height: 50,
	overflow: 'hidden',
	borderRadius: 25,
	padding: 1,
	flex: 1,
  },
  innerWhiteContainer: {
	backgroundColor: 'white',
	width: '100%',
	height: '100%',
	justifyContent: 'center',
	borderRadius: 25,
  },
  innerWhiteContainer2: {
	backgroundColor: 'white',
	width: '100%',
	height: '100%',
	justifyContent: 'center',
	borderRadius: 25,
	flexDirection: 'row',
	alignItems: 'center',
	paddingRight: 13,
	paddingLeft: 20,
  },
  input: {
	height: 50,
	backgroundColor: 'rgba(255, 143, 143, 0)',
	paddingHorizontal: 20,
	fontFamily: 'SFUIDisplay-Medium',
	marginTop: 2.75,
	fontSize: 16,
	color: 'rgba(0, 0, 0, 1)',
  },
  sectionSubtitle: {
	fontSize: 20,
	fontFamily: 'SFUIDisplay-Bold',
	color: 'rgb(0, 0, 0)',
	marginTop: 5,
	marginBottom: 5,
  },
  separator: {
	height: 1,
	backgroundColor: 'rgb(235, 235, 235)',
	marginVertical: 10,
  },
  text: {
	fontFamily: 'SFUIDisplay-Medium',
	fontSize: 16,
	color: 'rgba(0, 0, 0, 1)',
	marginTop: 2.75,
  },
  icon: {
	marginLeft: 'auto',
  },
  // ── Tramo block ─────────────────────────────────────────────────────────────
  accessoryBlockMain: {
	padding: 1,
	marginBottom: 12,
	backgroundColor: 'transparent',
	borderRadius: 25,
  },
  accessoryBlock: {
	borderRadius: 24,
	paddingHorizontal: 20,
	paddingBottom: 15,
	paddingTop: 15,
	backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  accessoryHeader: {
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center',
	marginBottom: 8,
  },
  accessoryTitle: {
	fontFamily: 'SFUIDisplay-Bold',
	fontSize: 16,
  },
  deleteButton: {
	backgroundColor: 'rgb(254, 12, 12)',
	padding: 5,
	borderRadius: 0,
  },
  // ── Add tramo button ─────────────────────────────────────────────────────────
  addButtonRow: {
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'center',
	marginTop: 4,
	marginBottom: 6,
  },
  addButton: {
	width: 44,
	height: 44,
	borderRadius: 22,
	backgroundColor: 'rgb(0, 0, 0)',
	justifyContent: 'center',
	alignItems: 'center',
  },
  // ── Tables ──────────────────────────────────────────────────────────────────
  tableContainer: {
	borderWidth: 0,
	marginTop: 0,
	marginBottom: 16,
  },
  tableRow: {
	flexDirection: 'row',
  },
  tableCell: {
	borderRightWidth: 0,
	paddingVertical: 7,
	paddingHorizontal: 6,
	justifyContent: 'center',
  },
  tableCellHeaderText: {
	fontFamily: 'SFUIDisplay-Bold',
	fontSize: 11,
  },
  tableCellText: {
	fontFamily: 'SFUIDisplay-Regular',
	fontSize: 11,
  },
  balanceContainer: {
	borderWidth: 1,
	borderRadius: 12,
	padding: 12,
	marginBottom: 12,
	gap: 4,
  },
  balanceText: {
	fontFamily: 'SFUIDisplay-Regular',
	fontSize: 13,
  },
  balanceValue: {
	fontFamily: 'SFUIDisplay-Bold',
  },
  // ── Expand button & landscape modal ─────────────────────────────────────────
  modalOverlay: {
	flex: 1,
	backgroundColor: 'rgba(0,0,0,0.85)',
	justifyContent: 'center',
	alignItems: 'center',
  },
  modalLandscapeContainer: {
	borderRadius: 16,
	overflow: 'hidden',
  },
  modalHeader: {
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'space-between',
	paddingHorizontal: 0,
	paddingTop: 10,
	borderBottomWidth: 1,
	borderBottomColor: 'rgba(150,150,150,0)',
  },
  modalTitle: {
	fontFamily: 'SFUIDisplay-Bold',
	fontSize: 15,
  },
  expandButton: {
	width: 90,
	height: 40,
	borderRadius: 25,
	justifyContent: 'center',
	alignItems: 'center',
  },
  expandButtonMasked: {
	width: 90,
	height: 40,
  },
  expandButtonMask: {
	width: 90,
	height: 40,
	backgroundColor: 'transparent',
	borderRadius: 25,
	borderWidth: 1,
	borderColor: 'rgba(255, 255, 255, 1)',
  },
  buttonGradient2: {
	width: 90,
	height: 40,
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	borderRadius: 25,
  },
  buttonGradient22: {
	width: 40,
	height: 40,
	experimental_backgroundImage:
	  'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
	borderRadius: 25,
  },
  buttonBackground2: {
	width: 90,
	height: 40,
	backgroundColor: 'rgba(255, 255, 255, 0.12)',
	position: 'absolute',
	borderRadius: 25,
  },
  buttonBackground22: {
	width: 40,
	height: 40,
	backgroundColor: 'rgba(255, 255, 255, 0.12)',
	position: 'absolute',
	borderRadius: 25,
  },
  modalCloseButton: {
	width: 40,
	height: 40,
	borderRadius: 25,
	justifyContent: 'center',
	alignItems: 'center',
  },
  modalCloseButtonMasked: {
	width: 40,
	height: 40,
  },
  modalCloseButtonMask: {
	width: 40,
	height: 40,
	backgroundColor: 'transparent',
	borderRadius: 25,
	borderWidth: 1,
	borderColor: 'rgba(255, 255, 255, 1)',
  },
  modalCloseButtonIcon: {
	position: 'absolute',
  },
  expandButtonContent: {
	position: 'absolute',
	flexDirection: 'row',
	alignItems: 'center',
	justifyContent: 'space-between',
	width: '100%',
	paddingHorizontal: 15,
	height: '100%',
  },
  expandButtonText: {
	fontFamily: 'SFUIDisplay-Regular',
	fontSize: 14,
	marginRight: 5,
  },
  descriptionContainer: {
    marginVertical: 5,
    marginHorizontal: 5,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgb(170, 170, 170)',
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 18,
    marginBottom: 8,
  },
  // ── Custom keyboard ──────────────────────────────────────────────────────────
  customKeyboardWrapper: {
	position: 'absolute',
	bottom: 0,
	left: 0,
	right: 0,
	backgroundColor: '#f5f5f5',
  },
  logoContainer: {
	position: 'absolute',
	bottom: 20,
	left: 20,
	width: 40,
	height: 40,
	opacity: 1,
	zIndex: 10,
  },
  logoImage: {
	width: '100%',
	height: '100%',
	resizeMode: 'contain',
  },
});

export default CompDiseñoSerie;
