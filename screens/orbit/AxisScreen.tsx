import React, { useState, useRef, useContext, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Animated, LayoutChangeEvent, Dimensions, Modal, Easing, InteractionManager
} from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';
import Entypo from 'react-native-vector-icons/Entypo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Octicons from 'react-native-vector-icons/Octicons';
import MaskedView from '@react-native-masked-view/masked-view';
import FastImage from '@d11/react-native-fast-image';
import type { TemporalAnalysisConfig, TemporalPatternEntry } from './TemporalAnalysisAxisScreen';
import type { PumpCurveEntry } from './axisPumpCurves';
import { derivePumpCurveState, getPumpCurveIds, normalizePumpCurves } from './axisPumpCurves';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageContext } from '../../contexts/LanguageContext';
import { FontSizeContext } from '../../contexts/FontSizeContext';
import { useKeyboard } from '../../contexts/KeyboardContext';
import { CustomKeyboardPanel } from '../../src/components/CustomKeyboardInput';
import {
  appendKeyboardKey,
  clearKeyboardValue,
  deleteKeyboardKey,
  formatKeyboardDisplayValue,
  insertKeyboardMinus,
  insertScientificNotation,
} from '../../src/components/customKeyboardHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import {
  formatTimeMinutes,
  getPatternHourLabel,
  PLAYBACK_INTERVAL_MS,
  runAxisHydraulicAnalysis,
} from './axisHydraulics';
import type {
  AxisCalculationResult,
  AxisConnectionInputEntry,
  AxisHydraulicAnalysisResult,
  AxisHydraulicStepResult,
  AxisNodeInputEntry,
} from './axisHydraulics';
import { pick } from '@react-native-documents/picker';

const STORAGE_KEY = 'axis_screen_state';
const logoLight = require('../../assets/icon/iconblack.webp');
const logoDark = require('../../assets/icon/iconwhite.webp');
const CARTESIAN_DEFAULT_ASPECT_RATIO = 3 / 2.5;
const CARTESIAN_COMPACT_ASPECT_RATIO = 1.6 / 2.5;
const CARTESIAN_WIDE_ASPECT_RATIO = 15 / 2.5;
const thumbLight = require('../../assets/LiquidGlassSimulation/thumbSliderWhite.png');
const thumbDark = require('../../assets/LiquidGlassSimulation/thumbSliderBlack.png');

/* ─────────────────────────────────────────────────────────────────────────────
   HTML del espacio cartesiano 3D — espacio 3D completo con red hidráulica.
   Se añaden las funciones de creación/gestión de meshes y el bridge rn_rebuild
   para sincronizar el estado React Native ↔ WebView via injectJavaScript.
────────────────────────────────────────────────────────────────────────────── */
function getCartesian3DHTML(isDark: boolean): string {
  const BG_COLOR    = isDark ? '#0c0c0c' : '#ffffff';
  const BORDER_CLR  = isDark ? '#cccccc' : '#111111';
  const BORDER_DIM  = isDark ? '#555555' : '#bbbbbb';
  const TEXT_CLR    = isDark ? '#eeeeee' : '#111111';
  const MUTED_CLR   = isDark ? '#999999' : '#666666';
  const SCENE_BG    = isDark ? '0x0c0c0c' : '0xffffff';
  const GRID_C1     = isDark ? '0x555555' : '0x888888';
  const GRID_C2     = isDark ? '0x333333' : '0xcccccc';
  const CONN_CLR    = isDark ? '0xdddddd' : '0x000000';
  const SPRITE_BG   = isDark ? "'#eeeeee'" : "'#000000'";
  const SPRITE_TXT  = isDark ? "'#111111'" : "'#ffffff'";
  const CUBE_TXT    = isDark ? "'rgba(220,220,220,0.88)'" : "'rgba(15,15,15,0.88)'";
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:         ${BG_COLOR};
            --border:     ${BORDER_CLR};
            --border-dim: ${BORDER_DIM};
            --text:       ${TEXT_CLR};
            --muted:      ${MUTED_CLR};
        }

        html, body {
            width: 100%; height: 100%;
            margin: 0; overflow: hidden;
            background: var(--bg);
            font-family: 'Space Mono', monospace;
            font-size: 11px;
            color: var(--text);
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-dim); }
        ::-webkit-scrollbar-thumb:hover { background: var(--border); }

        #canvas-container {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            overflow: visible;
            z-index: 0;
        }
        #canvas-container > canvas {
            display: block; width: 100% !important; height: 100% !important;
            overflow: hidden;
            touch-action: none;
        }
        #ui-container {
            display: flex; flex-direction: column; align-items: center;
            gap: 0px; user-select: none; flex-shrink: 0; overflow: visible;
            border: 0px solid rgb(180,180,180); border-radius: 0px; padding: 0px;
            background: rgba(255,255,255,0);
        }
        #viewcube-canvas { display: block; cursor: pointer; border-radius: 3px; }
        #right-column {
            position: absolute; top: 0px; right: 0px; display: flex;
            flex-direction: column; align-items: stretch; gap: 10px;
            z-index: 100; width: 120px; overflow: visible;
        }

        .ui-btn {
            background: var(--panel);
            border: 1.5px solid var(--border);
            border-radius: 0;
            cursor: pointer;
            font-family: 'Space Mono', monospace;
            color: var(--text);
            font-size: 0.6rem; font-weight: 700;
            letter-spacing: 0.06em; text-transform: uppercase;
        }
        .ui-btn:hover { background: var(--border); color: #ffffff; }
        .ui-btn:active { opacity: 0.75; }

        #rotate-buttons {
            display: none; gap: 4px;
            position: fixed; top: 16px; right: 16px;
            z-index: 100; width: 80px;
        }
        #btn-rot-left, #btn-rot-right { flex: 1; padding: 4px 0; font-size: 16px; }
        #btn-reset3d {
            display: none; font-size: 0.55rem; padding: 5px 4px; text-align: center;
            position: fixed; top: 54px; right: 16px;
            z-index: 100; width: 80px;
        }
    </style>
</head>
<body>

<div id="canvas-container">
    <div id="right-column">
        <div id="ui-container">
            <canvas id="viewcube-canvas"></canvas>
        </div>
    </div>
</div>

<script type="importmap">
{
    "imports": {
        "three": "https://unpkg.com/three@0.128.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.128.0/examples/jsm/"
    }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const LINE_GROSOR_EJES = 0.5;
const FLECHA_TAMANO    = 0.3;
const FLECHA_RADIO     = 0.04;
const BASE_LONGITUD    = 10000;
const CUBE_SIZE        = 60;
const CUBE_VISUAL_SIZE = 1.9 / Math.SQRT2;
const PUNTO_RADIO      = 0.1;
const LABEL_FONT_SIZE  = 32;
const TEXTO_ESCALA     = 0.4;
const CONN_CONE_R      = 0.035;
const CONN_CONE_H      = 0.14;
const CONN_COLOR = ${CONN_CLR};

// ── Revestimiento cromático de tuberías ───────────────────────────────────────
const PIPE_COATING_RADIUS  = 0.02;   // radio del cilindro de color
const PIPE_COATING_OPACITY = 0.6;    // transparencia (0=invisible, 1=sólido)
const COLOR_RANGES_CAUDAL = [
    { max: 5,        color: 0x1a3a8a },
    { max: 15,       color: 0x29aaff },
    { max: 25,       color: 0x22cc55 },
    { max: 35,       color: 0xffcc00 },
    { max: Infinity, color: 0xee2200 }
];
const COLOR_RANGES_VELOCIDAD = [
    { max: 0.5,      color: 0x1a3a8a },
    { max: 1.0,      color: 0x29aaff },
    { max: 1.5,      color: 0x22cc55 },
    { max: 2.0,      color: 0xffcc00 },
    { max: Infinity, color: 0xee2200 }
];

document.getElementById('right-column').style.width = CUBE_SIZE + 'px';
document.getElementById('ui-container').style.alignSelf = 'stretch';

const scene = new THREE.Scene();
scene.background = new THREE.Color(${SCENE_BG});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

const perspCam = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
perspCam.position.set(-6, 4, 8);
perspCam.lookAt(0, 0, 0);
const initial_dist = perspCam.position.distanceTo(new THREE.Vector3());
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2));

let activeCamera    = perspCam;
let is2DMode        = false;
let currentHideAxis = null;
let transitioning   = false;
let savedPerspPos   = perspCam.position.clone();
let savedPerspUp    = perspCam.up.clone();
let controls        = null;

function makeControls(cam, is2D, target) {
    if (controls) controls.dispose();
    const c = new OrbitControls(cam, renderer.domElement);
    c.enableDamping = true; c.dampingFactor = 0.05;
    c.enableZoom = true; c.enableRotate = !is2D; c.enablePan = is2D;
    if (is2D) {
        c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    }
    if (target) c.target.copy(target); else c.target.set(0, 0, 0);
    c.update();
    return c;
}

controls = makeControls(perspCam, false);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(1, 2, 1); scene.add(dirLight);

let gridXZ = null, currentStep = 0;

function updateGrid() {
    const dist = getEffectiveDist();
    let newStep = Math.pow(10, Math.floor(Math.log10(Math.max(dist, 0.1) / 5)));
    if (newStep < 1) newStep = 1;
    if (newStep !== currentStep) {
        if (gridXZ) scene.remove(gridXZ);
        const divisions = 100, size = divisions * newStep;
        gridXZ = new THREE.GridHelper(size, divisions, ${GRID_C1}, ${GRID_C2});
        if (Array.isArray(gridXZ.material)) {
            gridXZ.material.forEach(mat => {
                mat.opacity = 0.3; mat.transparent = true;
                mat.depthWrite = false; mat.depthTest = false;
            });
        } else {
            gridXZ.material.opacity = 0.3; gridXZ.material.transparent = true;
            gridXZ.material.depthWrite = false; gridXZ.material.depthTest = false;
        }
        gridXZ.renderOrder = -10;
        if (is2DMode) {
            if      (currentHideAxis === 'Y') gridXZ.rotation.z = Math.PI / 2;
            else if (currentHideAxis === 'X') gridXZ.rotation.x = Math.PI / 2;
        }
        scene.add(gridXZ);
        activeCamera.far = size * 10; activeCamera.updateProjectionMatrix();
        currentStep = newStep;
    }
}
updateGrid();

function crearEje(color, direccion) {
    const grupo = new THREE.Group(), longitud = BASE_LONGITUD;
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 40, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
    const r = LINE_GROSOR_EJES * 0.03;
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(r, r, longitud, 8), mat);
    cil.name = 'cilindro'; cil.renderOrder = 5;
    if (direccion === 'x') { cil.rotation.z = -Math.PI/2; cil.position.set(longitud/2,0,0); }
    else if (direccion === 'y') { cil.position.set(0,longitud/2,0); }
    else if (direccion === 'z') { cil.rotation.x = Math.PI/2; cil.position.set(0,0,longitud/2); }
    grupo.add(cil);
    const rc = FLECHA_RADIO*2, ac = FLECHA_TAMANO*2;
    const cono = new THREE.Mesh(new THREE.ConeGeometry(rc, ac, 12), mat);
    cono.name = 'cono'; cono.renderOrder = 5;
    if (direccion === 'x') { cono.rotation.z = -Math.PI/2; cono.position.set(longitud-ac/2,0,0); }
    else if (direccion === 'y') { cono.position.set(0,longitud-ac/2,0); }
    else if (direccion === 'z') { cono.rotation.x = Math.PI/2; cono.position.set(0,0,longitud-ac/2); }
    grupo.add(cono); return grupo;
}
function crearLineaEje(color, pA, pB) {
    const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pA.x,pA.y,pA.z), new THREE.Vector3(pB.x,pB.y,pB.z)]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false, depthWrite: false })
    );
    line.renderOrder = 6;
    return line;
}

const ejeX = crearEje(0xfe0c0c,'z'); scene.add(ejeX);
const ejeY = crearEje(0x3e88ff,'x'); scene.add(ejeY);
const ejeZ = crearEje(0x33ff33,'y'); scene.add(ejeZ);
const negXGroup = new THREE.Group(); const negXLine = crearLineaEje(0xffaaaa,{x:0,y:0,z:-BASE_LONGITUD},{x:0,y:0,z:0}); negXGroup.add(negXLine); scene.add(negXGroup);
const negYGroup = new THREE.Group(); const negYLine = crearLineaEje(0xaac4ff,{x:-BASE_LONGITUD,y:0,z:0},{x:0,y:0,z:0}); negYGroup.add(negYLine); scene.add(negYGroup);
const negZGroup = new THREE.Group(); const negZLine = crearLineaEje(0xaaffaa,{x:0,y:-BASE_LONGITUD,z:0},{x:0,y:0,z:0}); negZGroup.add(negZLine); scene.add(negZGroup);
const puntoOrigen = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16),
    new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 80, transparent: true, opacity: 1, depthTest: false, depthWrite: false })
);
puntoOrigen.renderOrder = 7;
scene.add(puntoOrigen);

function showAllAxes() { [ejeX,negXGroup,ejeY,negYGroup,ejeZ,negZGroup].forEach(g=>g.visible=true); }
function setAxisVisibility(h) {
    showAllAxes();
    if      (h==='X') { ejeX.visible=false; negXGroup.visible=false; }
    else if (h==='Y') { ejeY.visible=false; negYGroup.visible=false; }
    else if (h==='Z') { ejeZ.visible=false; negZGroup.visible=false; }
}
function updateAxis(grupo, dir, l, r) {
    const cil = grupo.getObjectByName('cilindro'), cono = grupo.getObjectByName('cono');
    cil.scale.set(r,l,r); cono.scale.set(r,l,r);
    const long = BASE_LONGITUD*l, alt = FLECHA_TAMANO*2*l;
    if (dir==='x') { cil.position.set(long/2,0,0); cono.position.set(long-alt/2,0,0); }
    else if (dir==='y') { cil.position.set(0,long/2,0); cono.position.set(0,long-alt/2,0); }
    else if (dir==='z') { cil.position.set(0,0,long/2); cono.position.set(0,0,long-alt/2); }
}
function updateNeg(line, dir, l) {
    const long=BASE_LONGITUD*l; let ax=0,ay=0,az=0;
    if(dir==='x') ax=-long; else if(dir==='y') ay=-long; else if(dir==='z') az=-long;
    const p=line.geometry.attributes.position.array;
    p[0]=ax;p[1]=ay;p[2]=az;p[3]=0;p[4]=0;p[5]=0;
    line.geometry.attributes.position.needsUpdate=true;
}

const cubeCanvas = document.getElementById('viewcube-canvas');
const cubeRenderer = new THREE.WebGLRenderer({ canvas: cubeCanvas, alpha: true, antialias: true });
cubeRenderer.setPixelRatio(window.devicePixelRatio); cubeRenderer.setSize(CUBE_SIZE, CUBE_SIZE);
const cubeScene = new THREE.Scene();
const cubeCam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
cubeCam.position.set(0,0,4); cubeCam.lookAt(0,0,0);
const FACE_LABELS = ['+Y','-Y','+Z','-Z','+X','-X'];
function makeFaceTex(text) {
    const c=document.createElement('canvas'); c.width=c.height=128; const ctx=c.getContext('2d');
    ctx.fillStyle='rgba(210,210,210,0)'; ctx.fillRect(3,3,122,122);
    ctx.strokeStyle='rgba(80,80,80,0)'; ctx.lineWidth=2.5; ctx.strokeRect(3,3,122,122);
    ctx.fillStyle=${CUBE_TXT}; ctx.font='bold 24px system-ui,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,64,64);
    return new THREE.CanvasTexture(c);
}
const cubeMats = FACE_LABELS.map(l=>new THREE.MeshBasicMaterial({map:makeFaceTex(l),transparent:true,opacity:0.88}));
const cubeGeo  = new THREE.BoxGeometry(CUBE_VISUAL_SIZE, CUBE_VISUAL_SIZE, CUBE_VISUAL_SIZE);
const cubeMesh = new THREE.Mesh(cubeGeo, cubeMats); cubeScene.add(cubeMesh);
const edgesMesh = new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), new THREE.LineBasicMaterial({color:0x444444,transparent:true,opacity:0.6}));
cubeScene.add(edgesMesh);

let hoveredFace = -1;
function ndcFromEvent(e, canvas) {
    const r=canvas.getBoundingClientRect();
    return { x:((e.clientX-r.left)/r.width)*2-1, y:-((e.clientY-r.top)/r.height)*2+1 };
}
cubeCanvas.addEventListener('mousemove', e => {
    const rc=new THREE.Raycaster(); rc.setFromCamera(ndcFromEvent(e,cubeCanvas),cubeCam);
    const hits=rc.intersectObject(cubeMesh), newFace=hits.length>0?Math.floor(hits[0].faceIndex/2):-1;
    if (newFace!==hoveredFace) {
        if (hoveredFace>=0) cubeMats[hoveredFace].color.set(0xffffff);
        if (newFace>=0)     cubeMats[newFace].color.set(0xdde8ff);
        hoveredFace=newFace;
    }
});
cubeCanvas.addEventListener('mouseleave', ()=>{ if(hoveredFace>=0) cubeMats[hoveredFace].color.set(0xffffff); hoveredFace=-1; });

const VIEW_DEFS = [
    {camDir:[1,0,0],up:[0,1,0],hide:'Y'},{camDir:[-1,0,0],up:[0,1,0],hide:'Y'},
    {camDir:[0,1,0],up:[1,0,0],hide:'Z'},{camDir:[0,-1,0],up:[1,0,0],hide:'Z'},
    {camDir:[0,0,1],up:[0,1,0],hide:'X'},{camDir:[0,0,-1],up:[0,1,0],hide:'X'},
];
const clickRC = new THREE.Raycaster();
cubeCanvas.addEventListener('click', e => {
    if (transitioning) return;
    clickRC.setFromCamera(ndcFromEvent(e,cubeCanvas),cubeCam);
    const hits=clickRC.intersectObject(cubeMesh);
    if (hits.length>0) activateView(Math.floor(hits[0].faceIndex/2));
});

function activateView(faceIdx) {
    const def=VIEW_DEFS[faceIdx], centroid=getCurrentCentroid();
    if (is2DMode) {
        perspCam.position.copy(activeCamera.position); perspCam.up.copy(activeCamera.up);
        perspCam.lookAt(centroid); activeCamera=perspCam; is2DMode=false; currentStep=0;
    } else { savedPerspPos.copy(perspCam.position); savedPerspUp.copy(perspCam.up); }
    const dist=Math.max(perspCam.position.distanceTo(centroid),20);
    const camDir3=new THREE.Vector3(...def.camDir);
    const targetPos=centroid.clone().addScaledVector(camDir3,dist);
    const targetUp=new THREE.Vector3(...def.up);
    transitioning=true;
    const startPos=perspCam.position.clone(), startUp=perspCam.up.clone();
    const startTime=performance.now(), DURATION=550;
    function doTransition(now) {
        const t=Math.min((now-startTime)/DURATION,1), ease=t<0.5?2*t*t:-1+(4-2*t)*t;
        perspCam.position.lerpVectors(startPos,targetPos,ease);
        perspCam.up.lerpVectors(startUp,targetUp,ease).normalize();
        perspCam.lookAt(centroid);
        if (t<1) { requestAnimationFrame(doTransition); return; }
        const aspect = window.innerWidth / window.innerHeight;
        const halfH=dist*TAN_HALF_FOV, halfW=halfH*aspect;
        const ortho=new THREE.OrthographicCamera(-halfW,halfW,halfH,-halfH,0.1,dist*20+BASE_LONGITUD);
        ortho.position.copy(targetPos); ortho.up.copy(targetUp); ortho.lookAt(centroid);
        ortho.updateProjectionMatrix();
        activeCamera=ortho; is2DMode=true; currentHideAxis=def.hide; currentStep=0;
        setAxisVisibility(def.hide);
        controls=makeControls(ortho,true); controls.target.copy(centroid); controls.update();
        setUI2D(true);
        transitioning=false;
    }
    requestAnimationFrame(doTransition);
}
function resetTo3D() {
    const centroid=getCurrentCentroid();
    perspCam.position.copy(centroid).addScaledVector(savedPerspPos.clone().normalize(), savedPerspPos.length());
    perspCam.up.copy(savedPerspUp); perspCam.lookAt(centroid);
    activeCamera=perspCam; is2DMode=false; currentHideAxis=null; currentStep=0;
    showAllAxes(); controls=makeControls(perspCam,false);
    controls.target.copy(centroid); controls.update();
    setUI2D(false);
}
function rotate90(sign) {
    if (!is2DMode) return;
    const axis = new THREE.Vector3();
    activeCamera.getWorldDirection(axis);
    const q = new THREE.Quaternion().setFromAxisAngle(axis, sign * Math.PI / 2);

    activeCamera.up.applyQuaternion(q).normalize();
    activeCamera.position.applyQuaternion(q);
    controls.target.applyQuaternion(q);

    activeCamera.lookAt(controls.target);
    activeCamera.updateMatrixWorld();
    controls.update();
}
function setUI2D(show) {
    if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIEW_MODE_CHANGE', is2DMode: show }));
    }
}
window.rn_rotate2D = function(sign) { rotate90(sign); };
window.rn_resetTo3D = function() { resetTo3D(); };

let elementScale = 1.0;
window.rn_scaleUp   = function() { elementScale = Math.min(parseFloat((elementScale + 0.1).toFixed(2)), 5.0); };
window.rn_scaleDown = function() { elementScale = Math.max(parseFloat((elementScale - 0.1).toFixed(2)), 0.2); };

function getEffectiveDist() {
    if (is2DMode && activeCamera.isOrthographicCamera)
        return (activeCamera.top/activeCamera.zoom)/TAN_HALF_FOV;
    return activeCamera.position.distanceTo(controls.target);
}

// ── Datos de red hidráulica ───────────────────────────────────────────────────
const puntosData  = [];
const tuberias    = [];
const _nodeMap    = new Map(); // ← NUEVO: lookup O(1) por nodeId
const _up        = new THREE.Vector3(0,1,0);
const _quat      = new THREE.Quaternion();

function logicToThree(xl, yl, zl) {
    return new THREE.Vector3(isNaN(yl)?0:yl, isNaN(zl)?0:zl, isNaN(xl)?0:xl);
}

function getCurrentCentroid() {
    if (!puntosData.length) return new THREE.Vector3();
    let cx=0,cy=0,cz=0;
    puntosData.forEach(e=>{
        const p=logicToThree(parseFloat(e.xInput.value),parseFloat(e.yInput.value),parseFloat(e.zInput.value));
        cx+=p.x; cy+=p.y; cz+=p.z;
    });
    const n=puntosData.length;
    return new THREE.Vector3(cx/n,cy/n,cz/n);
}

function actualizarCentroide() {
    if (!controls || is2DMode) return;
    if (!puntosData.length) { controls.target.set(0,0,0); controls.update(); return; }
    let cx=0,cy=0,cz=0;
    puntosData.forEach(e=>{
        const p=logicToThree(parseFloat(e.xInput.value),parseFloat(e.yInput.value),parseFloat(e.zInput.value));
        cx+=p.x; cy+=p.y; cz+=p.z;
    });
    const n=puntosData.length;
    controls.target.set(cx/n,cy/n,cz/n); controls.update();
}

// ── Creación de meshes y sprites ──────────────────────────────────────────────
function crearMeshPunto(colorHex) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(PUNTO_RADIO, 16, 16),
        new THREE.MeshPhongMaterial({ color: colorHex, shininess: 60, transparent: true, opacity: 1, depthTest: false, depthWrite: false })
    );
    mesh.renderOrder = 7;
    return mesh;
}

function crearLabelSprite(texto, colorHex) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = 'bold ' + LABEL_FONT_SIZE + 'px system-ui,sans-serif';
    const tw = ctx.measureText(texto).width;
    const pad = LABEL_FONT_SIZE * 0.4;
    c.width = tw + pad * 2; c.height = LABEL_FONT_SIZE + pad;
    ctx.font = 'bold ' + LABEL_FONT_SIZE + 'px system-ui,sans-serif';
    ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = ${SPRITE_TXT};
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, pad, c.height * 0.52);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        depthTest: false, transparent: true, sizeAttenuation: true
    }));
    sprite.renderOrder = 8;
    sprite.scale.set((c.width / c.height) * TEXTO_ESCALA, TEXTO_ESCALA, 1);
    return sprite;
}

function actualizarLabelSprite(entry) {
    if (entry.label) {
        scene.remove(entry.label);
        if (entry.label.material.map) entry.label.material.map.dispose();
        entry.label.material.dispose();
    }
    const texto = entry.idInput.value || '';
    if (!texto) { entry.label = null; return; }
    const sprite = crearLabelSprite(texto, entry.colorHex);
    scene.add(sprite);
    entry.label = sprite;
    actualizarPosLabel(entry, 1);
}

function actualizarPosLabel(entry, rs) {
    const scale = rs || 1;
    if (!entry.label || !entry.mesh) return;
    entry.label.position.copy(entry.mesh.position);
    entry.label.position.y += PUNTO_RADIO * 3.5 * scale;
}

function actualizarMeshPunto(entry) {
    const pos = logicToThree(
        parseFloat(entry.xInput.value),
        parseFloat(entry.yInput.value),
        parseFloat(entry.zInput.value)
    );
    if (!entry.mesh) return;
    entry.mesh.position.copy(pos);
    actualizarPosLabel(entry, 1);
    actualizarCentroide();
}

// ── Grupos de conexión (tuberías) ─────────────────────────────────────────────
function crearConexionGroup() {
    const group = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: CONN_COLOR, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.name = 'conn-line'; line.renderOrder = 6;
    group.add(line);
    const coneMat = new THREE.MeshPhongMaterial({ color: CONN_COLOR, shininess: 50, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(CONN_CONE_R, CONN_CONE_H, 12), coneMat);
    cone.name = 'conn-cone'; cone.renderOrder = 6;
    group.add(cone);
    // Cilindro de revestimiento cromático — color según caudal/velocidad
    const cylMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 20, transparent: true, opacity: PIPE_COATING_OPACITY, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), cylMat);
    cylinder.name = 'conn-cylinder'; cylinder.renderOrder = 4; cylinder.visible = false;
    group.add(cylinder);
    group.visible = false;
    scene.add(group);
    return group;
}

function updateConexionGroup(entry, rs) {
    // Búsqueda O(1) con Map en lugar de O(n) con .find()
    const fromE = _nodeMap.get(entry.fromSel.value);
    const toE   = _nodeMap.get(entry.toSel.value);
    if (!fromE || !toE || !entry.fromSel.value || !entry.toSel.value || entry.fromSel.value === entry.toSel.value) {
        entry.group.visible = false; return;
    }
    const posA = fromE.mesh.position, posB = toE.mesh.position;
    const dist3 = posA.distanceTo(posB);
    if (dist3 < 1e-6) { entry.group.visible = false; return; }
    entry.group.visible = true;

    const line = entry.group.getObjectByName('conn-line');
    const pa = line.geometry.attributes.position.array;
    pa[0]=posA.x; pa[1]=posA.y; pa[2]=posA.z;
    pa[3]=posB.x; pa[4]=posB.y; pa[5]=posB.z;
    line.geometry.attributes.position.needsUpdate = true;

    const cone = entry.group.getObjectByName('conn-cone');
    const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(posB, posA).normalize();
    cone.position.copy(mid); cone.scale.set(rs, rs, rs);
    if (Math.abs(dir.dot(_up)) > 0.9999) {
        cone.quaternion.set(dir.y < 0 ? 1 : 0, 0, 0, dir.y < 0 ? 0 : 1);
    } else {
        _quat.setFromUnitVectors(_up, dir); cone.quaternion.copy(_quat);
    }
    // Actualizar posición/orientación del cilindro de revestimiento
    const cylinder = entry.group.getObjectByName('conn-cylinder');
    if (cylinder) {
        const cylR = rs * PIPE_COATING_RADIUS;
        cylinder.position.copy(mid);
        cylinder.scale.set(cylR, dist3, cylR);
        if (Math.abs(dir.dot(_up)) > 0.9999) {
            cylinder.quaternion.set(dir.y < 0 ? 1 : 0, 0, 0, dir.y < 0 ? 0 : 1);
        } else {
            _quat.setFromUnitVectors(_up, dir); cylinder.quaternion.copy(_quat);
        }
    }
}

// ── Bridge React Native ↔ WebView ─────────────────────────────────────────────
window.rn_rebuild = function(jsonStr) {
    var data;
    try { data = JSON.parse(jsonStr); } catch(e) { return; }

    // Limpiar nodos existentes
    puntosData.slice().forEach(function(e) {
        if (e.mesh)  { scene.remove(e.mesh);  e.mesh.geometry.dispose();  e.mesh.material.dispose(); }
        if (e.label) { scene.remove(e.label); if (e.label.material.map) e.label.material.map.dispose(); e.label.material.dispose(); }
    });
    puntosData.length = 0;

    // Limpiar conexiones existentes
    tuberias.slice().forEach(function(e) {
        scene.remove(e.group);
        e.group.children.forEach(function(c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    });
    tuberias.length = 0;

    // Reconstruir nodos
    _nodeMap.clear();
    (data.nodes || []).forEach(function(n) {
        var colorHex = (typeof n.colorHex === 'number') ? n.colorHex : 0x4488ff;
        var mesh = crearMeshPunto(colorHex);
        scene.add(mesh);
        var entry = {
            tipo:          n.type || 'nodo',
            mesh:          mesh,
            label:         null,
            colorHex:      colorHex,
            idInput:       { value: n.nodeId   || '' },
            xInput:        { value: n.x        || '0' },
            yInput:        { value: n.y        || '0' },
            zInput:        { value: n.z        || '0' },
            demandaInput:  (n.type === 'nodo')   ? { value: n.demanda  || '' } : null,
            nivelIniInput: (n.type === 'tanque') ? { value: n.nivelIni || '' } : null,
            diametroInput: (n.type === 'tanque') ? { value: n.diametro || '' } : null,
            volumenInput:  (n.type === 'tanque') ? { value: n.volumen  || '' } : null,
        };
        puntosData.push(entry);
        _nodeMap.set(n.nodeId || '', entry); // ← dentro del loop: entry existe y es válido
        actualizarMeshPunto(entry);
        actualizarLabelSprite(entry);
    });

    // Reconstruir conexiones y calcular longitudes
    var lengthsUpdate = {};
    (data.connections || []).forEach(function(c) {
        var group = crearConexionGroup();
        var entry = {
            group:                 group,
            tipoEnlace:            c.type || 'tuberia',
            tubId:                 c.tubId    || '',
            fromSel:               { value: c.from      || '' },
            toSel:                 { value: c.to        || '' },
            longInput:             null,
            diametroInput:         { value: c.diametro  || '' },
            rugosidadInput:        { value: c.rugosidad || '' },
            caudalResultadoLs:     null,
            velocidadResultadoMs:  null
        };
        tuberias.push(entry);
        updateConexionGroup(entry, 1);

        var fromE = puntosData.find(function(e) { return e.idInput.value === entry.fromSel.value; });
        var toE   = puntosData.find(function(e) { return e.idInput.value === entry.toSel.value; });
        if (fromE && toE && fromE.mesh && toE.mesh) {
            lengthsUpdate[entry.tubId] = fromE.mesh.position.distanceTo(toE.mesh.position).toFixed(2);
        }
    });

    actualizarCentroide();
    actualizarColoresCilindros(null); // ocultar cilindros tras reconstrucción

    if (window.ReactNativeWebView && Object.keys(lengthsUpdate).length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LENGTHS_UPDATE', lengths: lengthsUpdate }));
    }
};

const _resultSprites = [];

function _limpiarResultSprites() {
    _resultSprites.forEach(s => {
        scene.remove(s);
        if (s.material && s.material.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
    });
    _resultSprites.length = 0;
}

function _crearResSprite(texto) {
    const FS = 26;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = 'bold ' + FS + 'px system-ui,sans-serif';
    const tw = ctx.measureText(texto).width;
    const padX = FS * 0.38, padY = FS * 0.20;
    c.width = Math.ceil(tw + padX * 2); c.height = Math.ceil(FS + padY * 2);
    ctx.font = 'bold ' + FS + 'px system-ui,sans-serif';
    ctx.fillStyle = ${SPRITE_BG}; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = ${SPRITE_TXT}; ctx.textBaseline = 'middle';
    ctx.fillText(texto, padX, c.height * 0.5);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: true });
    const sprite = new THREE.Sprite(mat); sprite.renderOrder = 9;
    const escala = TEXTO_ESCALA * 1;
    sprite._baseEscala = escala; sprite._aspect = c.width / c.height;
    sprite.scale.set(sprite._aspect * escala, escala, 1);
    return sprite;
}

window.rn_showResults = function(jsonStr) {
    _limpiarResultSprites();
    var data; try { data = JSON.parse(jsonStr); } catch(e) { return; }
    var dist = controls ? controls.target.distanceTo(activeCamera.position) : initial_dist;
    var rs = dist / initial_dist;
    var modoNodo = data.modoNodo || 'P';
    var modoTub  = data.modoTuberia || 'Q';

    // Limpiar resultados previos en todas las tuberías
    tuberias.forEach(function(t) {
        t.caudalResultadoLs    = null;
        t.velocidadResultadoMs = null;
    });

    (data.nodos || []).forEach(function(r) {
        if (modoNodo === 'none') return;
        var texto = modoNodo === 'H' ? ('H=' + r.H.toFixed(2) + ' m') : ('P=' + r.P.toFixed(2) + ' m');
        var entry = puntosData.find(function(e){ return e.idInput.value === r.id; });
        if (!entry || !entry.mesh) return;
        var sprite = _crearResSprite(texto);
        var pos = entry.mesh.position.clone(); pos.y += PUNTO_RADIO * 7.5 * rs;
        sprite.position.copy(pos); sprite._nodEntry = entry; sprite._type = 'nodo';
        sprite._fromId = r.from;
        sprite._toId = r.to;
        scene.add(sprite); _resultSprites.push(sprite);
    });

    (data.tuberias || []).forEach(function(r) {
        // Almacenar resultados hidráulicos en la entrada de tubería correspondiente
        var tEntry = tuberias.find(function(t) {
            return t.fromSel.value === r.from && t.toSel.value === r.to;
        });
        if (tEntry) {
            tEntry.caudalResultadoLs    = (typeof r.Q_ls  === 'number') ? r.Q_ls  : null;
            tEntry.velocidadResultadoMs = (typeof r.V_ms  === 'number') ? r.V_ms  : null;
        }

        if (modoTub === 'none') return;
        if (r.tipoEnlace === 'bomba' && modoTub !== 'Q') return;
        var texto = modoTub === 'V' && typeof r.V_ms === 'number' ? ('V=' + Math.abs(r.V_ms).toFixed(2) + ' m/s')
                  : modoTub === 'f' && typeof r.f === 'number' ? ('f=' + r.f.toFixed(4))
                  : ('Q=' + Math.abs(r.Q_ls).toFixed(2) + ' l/s');
        var fromE = puntosData.find(function(e){ return e.idInput.value === r.from; });
        var toE   = puntosData.find(function(e){ return e.idInput.value === r.to;   });
        if (!fromE || !toE || !fromE.mesh || !toE.mesh) return;
        var sprite = _crearResSprite(texto);
        var mid = new THREE.Vector3().addVectors(fromE.mesh.position, toE.mesh.position).multiplyScalar(0.5);
        mid.y += PUNTO_RADIO * 6 * rs;
        sprite.position.copy(mid); sprite._pipeEntry = { fromSel: {value: r.from}, toSel: {value: r.to} }; sprite._type = 'tuberia';
        sprite._fromId = r.from;
        sprite._toId = r.to;
        scene.add(sprite); _resultSprites.push(sprite);
    });

    // Aplicar cilindros de color a todas las tuberías según resultados
    actualizarColoresCilindros(modoTub);
};

// ── Helpers de color para cilindros ───────────────────────────────────────────
function colorFromRanges(value, ranges) {
    for (var i = 0; i < ranges.length; i++) {
        if (value <= ranges[i].max) return ranges[i].color;
    }
    return ranges[ranges.length - 1].color;
}

function obtenerColorCilindroTuberia(entry, modoTub) {
    if (modoTub === 'V') {
        var v = entry.velocidadResultadoMs;
        if (v === null || v === undefined || !isFinite(v)) return 0x888888;
        return colorFromRanges(Math.abs(v), COLOR_RANGES_VELOCIDAD);
    }
    var q = entry.caudalResultadoLs;
    if (q === null || q === undefined || !isFinite(q)) return 0x888888;
    return colorFromRanges(Math.abs(q), COLOR_RANGES_CAUDAL);
}

function actualizarColoresCilindros(modoTub) {
    var tieneResultados = tuberias.some(function(e) {
        return e.caudalResultadoLs !== null && e.caudalResultadoLs !== undefined;
    });
    tuberias.forEach(function(entry) {
        var cyl  = entry.group && entry.group.getObjectByName('conn-cylinder');
        var line = entry.group && entry.group.getObjectByName('conn-line');
        if (!cyl) return;
        if (!tieneResultados || !entry.group.visible) {
            cyl.visible = false;
            if (line) { line.material.color.setHex(CONN_COLOR); line.material.opacity = 0.7; }
            return;
        }
        var colorNum = obtenerColorCilindroTuberia(entry, modoTub);
        cyl.material.color.setHex(colorNum);
        cyl.visible = true;
        if (line) line.material.opacity = 0; // línea invisible cuando hay cilindro
    });
}

// ── Loop de animación ─────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();

    const dist = getEffectiveDist();
    const rs   = dist / initial_dist;
    const es = rs * elementScale * 0.8;
    const ls   = Math.max(1, dist / initial_dist);

    updateAxis(ejeX,'z',ls,rs); updateAxis(ejeY,'x',ls,rs); updateAxis(ejeZ,'y',ls,rs);
    updateNeg(negXLine,'z',ls); updateNeg(negYLine,'x',ls); updateNeg(negZLine,'y',ls);
    puntoOrigen.scale.set(es,es,es);

    puntosData.forEach(function(e) {
        if (e.mesh) e.mesh.scale.set(es, es, es);
        if (e.label) {
            const img = e.label.material.map.image;
            e.label.scale.set((img.width / img.height) * TEXTO_ESCALA * es, TEXTO_ESCALA * es, 1);
            actualizarPosLabel(e, es);
        }
    });
    tuberias.forEach(function(conn) { updateConexionGroup(conn, es); });

    _resultSprites.forEach(function(sprite) {
        if (sprite._type === 'nodo' && sprite._nodEntry && sprite._nodEntry.mesh) {
            var pos = sprite._nodEntry.mesh.position.clone();
            pos.y += PUNTO_RADIO * 7.5 * es;
            sprite.position.copy(pos);
            sprite.scale.set(sprite._aspect * sprite._baseEscala * es, sprite._baseEscala * es, 1);
        } else if (sprite._type === 'tuberia') {
            var fE = _nodeMap.get(sprite._fromId);
            var tE = _nodeMap.get(sprite._toId);
            if (fE && tE && fE.mesh && tE.mesh) {
                var mid = new THREE.Vector3()
                    .addVectors(fE.mesh.position, tE.mesh.position)
                    .multiplyScalar(0.5);
                mid.y += PUNTO_RADIO * 6 * es;
                sprite.position.copy(mid);
                sprite.scale.set(sprite._aspect * sprite._baseEscala * es, sprite._baseEscala * es, 1);
            }
        }
    });

    updateGrid();
    renderer.render(scene, activeCamera);
    cubeMesh.quaternion.copy(activeCamera.quaternion).conjugate();
    edgesMesh.quaternion.copy(cubeMesh.quaternion);
    cubeRenderer.render(cubeScene, cubeCam);
}
animate();

window.addEventListener('resize', () => {
    const W = window.innerWidth, H = window.innerHeight;
    perspCam.aspect = W / H; perspCam.updateProjectionMatrix();
    renderer.setSize(W, H);
    if (is2DMode && activeCamera.isOrthographicCamera) {
        const halfH = activeCamera.top;
        const halfW = halfH * (W / H);
        activeCamera.left=-halfW; activeCamera.right=halfW;
        activeCamera.updateProjectionMatrix();
    }
});
</script>
</body>
</html>`;}

// ─── Navigation types ─────────────────────────────────────────────────────────
type RootStackParamList = {
  OptionsScreenAxis: {
    category: string;
    options?: string[];
    onSelectOption?: (option: string) => void;
    selectedOption?: string;
  };
  TemporalAnalysisAxisScreen: {
    initialConfig?: TemporalAnalysisConfig;
    onSave?: (config: TemporalAnalysisConfig) => void;
  };
  PumpCurvesAxisScreen: {
    initialCurves?: PumpCurveEntry[];
    onSave?: (curves: PumpCurveEntry[]) => void;
  };
};

// ─── Domain types ─────────────────────────────────────────────────────────────
type NetworkMode = 'nodes' | 'connections';
type NodeType    = 'nodo' | 'tanque' | 'reservorio';
type ConnectionType = 'tuberia' | 'bomba';

interface NodeEntry {
  id:            number;
  type:          NodeType;
  nodeId:        string;
  patternId:     string;
  colorHex:      number;
  x:             string; xUnit:        string;
  y:             string; yUnit:        string;
  z:             string; zUnit:        string;
  demanda:       string; demandaUnit:  string;
  nivelIni:      string; nivelIniUnit: string;
  nivelMin:      string; nivelMinUnit: string;
  nivelMax:      string; nivelMaxUnit: string;
  diametro:      string; diametroUnit: string;
  volumen?:      string; volumenUnit?:  string;
}

interface ConnectionEntry {
  id:        number;
  type:      ConnectionType;
  tubId:     string;
  from:      string;
  to:        string;
  curveId:   string;
  longitud:  string;
  longitudAuto: string;
  longitudManual: boolean;
  diametro:  string; diametroUnit:  string;
  rugosidad: string; rugosidadUnit: string;
}

// ─── Conversion factors (SI base) ────────────────────────────────────────────
const conversionFactors: { [key: string]: { [key: string]: number } } = {
  length: {
    m: 1, mm: 0.001, cm: 0.01, km: 1000,
    in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
  },
  flow: {
    'l/s': 0.001, 'm³/s': 1, 'm³/h': 1 / 3600, 'gpm': 6.30902e-5,
  },
  volume: {
    'm³': 1, 'l': 0.001, 'ft³': 0.0283168,
  },
};

// Options lists per category
const unitOptions: { [key: string]: string[] } = {
  length: ['m', 'mm', 'cm', 'km', 'in', 'ft', 'yd', 'mi'],
  flow:   ['l/s', 'm³/s', 'm³/h', 'gpm'],
  volume: ['m³', 'l', 'ft³'],
};

// ─── Utilidad de color ────────────────────────────────────────────────────────
function randomVividColorHex(): number {
  const h = Math.random() * 360;
  const s = 90 + Math.random() * 10;
  const l = 42 + Math.random() * 16;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// ─── Dot color helpers ────────────────────────────────────────────────────────
const getDotColor = (hasValue: boolean): string =>
  hasValue ? 'rgb(194, 254, 12)' : 'rgb(200,200,200)';

const getBlueDotColor = (hasValue: boolean): string =>
  hasValue ? 'rgb(62, 136, 255)' : 'rgb(200,200,200)';

// ─── Conversion helper ────────────────────────────────────────────────────────
const convertVal = (value: string, fromUnit: string, toUnit: string, category: string): string => {
  const clean = value.replace(',', '.');
  if (clean === '' || isNaN(parseFloat(clean))) return value;
  const fromF = conversionFactors[category]?.[fromUnit];
  const toF   = conversionFactors[category]?.[toUnit];
  if (!fromF || !toF) return value;
  return (parseFloat(clean) * fromF / toF).toString();
};

// ─── Default node factory ─────────────────────────────────────────────────────
function makeDefaultNode(type: NodeType, nodeId: string): Omit<NodeEntry, 'id' | 'colorHex'> {
  return {
    type, nodeId, patternId: '',
    x: '', xUnit: 'm',
    y: '', yUnit: 'm',
    z: '', zUnit: 'm',
    demanda: '',  demandaUnit:  'l/s',
    nivelIni: '', nivelIniUnit: 'm',
    nivelMin: '', nivelMinUnit: 'm',
    nivelMax: '', nivelMaxUnit: 'm',
    diametro: '', diametroUnit: type === 'tanque' ? 'm' : 'mm',
    volumen: '',  volumenUnit:  'm³',
  };
}

function makeDefaultConnection(tubId: string, from = '', to = '', type: ConnectionType = 'tuberia'): Omit<ConnectionEntry, 'id'> {
  return {
    type,
    tubId,
    from,
    to,
    curveId: '',
    longitud: '',
    longitudAuto: '',
    longitudManual: false,
    diametro: '',
    diametroUnit: 'mm',
    rugosidad: '',
    rugosidadUnit: 'mm',
  };
}

function createDefaultTemporalConfig(): TemporalAnalysisConfig {
  return {
    enabled: false,
    durationHours: '24',
    durationMinutes: '0',
    stepHours: '1',
    stepMinutes: '0',
    patterns: [],
  };
}

function getTemporalPatternIds(patterns: TemporalPatternEntry[]): string[] {
  const seen = new Set<string>();
  return patterns
    .map(pattern => pattern.patternId.trim())
    .filter(patternId => {
      if (!patternId || seen.has(patternId)) return false;
      seen.add(patternId);
      return true;
    });
}

const AxisScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t }              = useContext(LanguageContext);
  const { fontSizeFactor } = useContext(FontSizeContext);
  const { currentTheme }   = useTheme();

  // ── Custom keyboard ──────────────────────────────────────────────────────────
  const { activeInputId, setActiveInputId } = useKeyboard();

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const webViewRef       = useRef<any>(null);
  const scrollViewRef    = useRef<ScrollView>(null);
  const inputRefs        = useRef<Record<string, View | null>>({});
  const activeInputIdRef = useRef<string | null>(null);
  const inputHandlersRef = useRef<Record<string, (text: string) => void>>({});
  const idCounterRef     = useRef(0);
  const nodesRef              = useRef<NodeEntry[]>([]);
  const connectionsRef        = useRef<ConnectionEntry[]>([]);
  const temporalPlaybackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLengthUpdateRef     = useRef(false); // ← NUEVO: flag para ignorar el ciclo de longitudes

  const newId = () => ++idCounterRef.current;

  // ── Theme palette ─────────────────────────────────────────────────────────────
  const themeColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        card:         'rgb(24,24,24)',
        blockInput:   'rgb(36,36,36)',
        text:         'rgb(235,235,235)',
        textStrong:   'rgb(250,250,250)',
        textMuted:    'rgb(150,150,150)',
        separator:    'rgba(255,255,255,0.12)',
        sliderTrack:  'rgba(255,255,255,0.12)',
        icon:         'rgb(245,245,245)',
        gradient:     'linear-gradient(to bottom right, rgba(170, 170, 170, 0.4) 30%, rgba(58, 58, 58, 0.4) 45%, rgba(58, 58, 58, 0.4) 55%, rgba(170, 170, 170, 0.4)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      card:         'rgba(255, 255, 255, 1)',
      blockInput:   'rgb(245,245,245)',
      text:         'rgb(0, 0, 0)',
      textStrong:   'rgb(0, 0, 0)',
      textMuted:    'rgb(120,120,120)',
      separator:    'rgb(235, 235, 235)',
      sliderTrack:  'rgb(228,228,228)',
      icon:         'rgb(0, 0, 0)',
      gradient:     'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  const toastConfig = useMemo(
    () => ({
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
    }),
    []
  );
  const theoryButtonColors = useMemo(() => {
    if (currentTheme === 'dark') {
      return {
        gradient: 'linear-gradient(to bottom right, rgb(170, 170, 170) 30%, rgb(58, 58, 58) 45%, rgb(58, 58, 58) 55%, rgb(170, 170, 170)) 70%',
        cardGradient: 'linear-gradient(to bottom, rgb(24,24,24), rgb(14,14,14))',
      };
    }
    return {
      gradient: 'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
      cardGradient: 'linear-gradient(to bottom, rgb(255,255,255), rgb(250,250,250))',
    };
  }, [currentTheme]);

  // ── Estado ────────────────────────────────────────────────────────────────────
  const [mode,          setMode]          = useState<NetworkMode>('nodes');
  const [nodes,         setNodes]         = useState<NodeEntry[]>([]);
  const [connections,   setConnections]   = useState<ConnectionEntry[]>([]);
  const [pumpCurves,    setPumpCurves]    = useState<PumpCurveEntry[]>([]);
  const [temporalConfig, setTemporalConfig] = useState<TemporalAnalysisConfig>(createDefaultTemporalConfig);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [is2DViewMode,  setIs2DViewMode]  = useState(false);

  const [cartesianIconLeft, setCartesianIconLeft] = useState<'chevron-up' | 'chevron-down'>('chevron-up');
  const [cartesianIconRight, setCartesianIconRight] = useState<'maximize' | 'minimize'>('maximize');

  const [analysisResult,           setAnalysisResult]           = useState<AxisHydraulicAnalysisResult | null>(null);
  const [calcResult,               setCalcResult]               = useState<AxisHydraulicStepResult | null>(null);
  const [currentFrameIndex,        setCurrentFrameIndex]        = useState(0);
  const [isTemporalPlaying,        setIsTemporalPlaying]        = useState(false);
  const [modoVisualNodo,           setModoVisualNodo]           = useState<'P' | 'H' | 'none'>('P');
  const [modoVisualTuberia,        setModoVisualTuberia]        = useState<'Q' | 'V' | 'f' | 'none'>('Q');
  const [tablaModalNodosVisible,   setTablaModalNodosVisible]   = useState(false);
  const [_tablaModalTanquesVisible, _setTablaModalTanquesVisible] = useState(false);
  const [tablaModalTubeVisible,    setTablaModalTubeVisible]    = useState(false);

  const [isCalculating, setIsCalculating] = useState(false);

  // ── Animación del selector de modo ───────────────────────────────────────────
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const controls2DAnim = useRef(new Animated.Value(0)).current;
  const [cartesianAspectRatio, setCartesianAspectRatio] = useState(CARTESIAN_DEFAULT_ASPECT_RATIO);
  const cartesianAspectRatioAnim = useRef(new Animated.Value(CARTESIAN_DEFAULT_ASPECT_RATIO)).current;

  const [buttonMetrics,   setButtonMetrics]   = useState<{ nodes: number; connections: number }>({ nodes: 0, connections: 0 });
  const [buttonPositions, setButtonPositions] = useState<{ nodes: number; connections: number }>({ nodes: 0, connections: 0 });

  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());
  const collapseAnimsRef = useRef<Record<number, Animated.Value>>({});
  const temporalPatternIds = useMemo(() => getTemporalPatternIds(temporalConfig.patterns), [temporalConfig.patterns]);
  const pumpCurveIds = useMemo(() => getPumpCurveIds(pumpCurves), [pumpCurves]);
  const temporalDefaultPatternId = useMemo(
    () => (temporalConfig.enabled ? (temporalPatternIds[0] ?? '') : ''),
    [temporalConfig.enabled, temporalPatternIds]
  );

  const parseEpanetSections = (text: string): Record<string, string[]> => {
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    const lines = text.split(/\r?\n/);
    for (const lineRaw of lines) {
      const line = lineRaw.trim();
      if (!line || line.startsWith(';')) continue;
      const matchSec = line.match(/^\[([^\]]+)\]/);
      if (matchSec) {
        current = matchSec[1].toUpperCase().trim();
        if (!sections[current]) sections[current] = [];
        continue;
      }
      if (current) {
        const sinComentario = line.split(';')[0].trim();
        if (sinComentario) sections[current].push(sinComentario);
      }
    }
    return sections;
  };

  const getFlowFactor = (units: string): number => {
    const map: Record<string, number> = {
      'LPS': 1, 'LPM': 1/60, 'MLD': 1000/86.4, 'CMH': 1000/3600,
      'CMD': 1000/86400, 'CFS': 28.3168, 'GPM': 0.0630902,
      'MGD': 43.8126, 'IMGD': 52.6168, 'AFD': 14.2764
    };
    return map[units] ?? 1;
  };

  const stopTemporalPlayback = useCallback(() => {
    if (temporalPlaybackTimerRef.current !== null) {
      clearInterval(temporalPlaybackTimerRef.current);
      temporalPlaybackTimerRef.current = null;
    }
    setIsTemporalPlaying(false);
  }, []);

  const importFromEpanet = useCallback((fileContent: string) => {
    const sections = parseEpanetSections(fileContent);
  
    // --- 1. Determinar unidades ---
    let flowUnits = 'LPS';
    let lengthIsMetric = true;
    let headlossFormula = 'H-W';
    if (sections['OPTIONS']) {
      for (const line of sections['OPTIONS']) {
        const parts = line.split(/\s+/);
        if (parts[0]?.toUpperCase() === 'UNITS' && parts[1]) {
          flowUnits = parts[1].toUpperCase();
          const metricFlowUnits = ['LPS', 'LPM', 'MLD', 'CMH', 'CMD'];
          lengthIsMetric = metricFlowUnits.includes(flowUnits);
        }
        if (parts[0]?.toUpperCase() === 'HEADLOSS' && parts[1]) {
          headlossFormula = parts[1].toUpperCase();
        }
      }
    }
    const flowFactor = getFlowFactor(flowUnits);
    const lengthToMeters = lengthIsMetric ? 1 : 0.3048;
    // Diámetro: SI → ya en mm (×1), US → pulgadas a mm (×25.4)
    const diamFactor = lengthIsMetric ? 1 : 25.4;
    // Rugosidad D-W: SI → ya en mm (×1), US → milipies a mm (×0.3048)
    // Rugosidad H-W / C-M: adimensional, sin conversión (×1)
    const roughFactor = headlossFormula === 'D-W' ? (lengthIsMetric ? 1 : 0.3048) : 1;
  
    // --- 2. Leer coordenadas ---
    const coords: Record<string, { x: number; y: number }> = {};
    for (const line of (sections['COORDINATES'] || [])) {
      const [id, x, y] = line.split(/\s+/);
      if (id && x && y) {
        coords[id] = { x: parseFloat(x) * lengthToMeters, y: parseFloat(y) * lengthToMeters };
      }
    }
  
    // --- 3. Leer patrones ---
    const patternsRaw: Record<string, number[]> = {};
    for (const line of (sections['PATTERNS'] || [])) {
      const parts = line.split(/\s+/);
      const id = parts[0];
      if (!id) continue;
      if (!patternsRaw[id]) patternsRaw[id] = [];
      for (let i = 1; i < parts.length; i++) {
        const val = parseFloat(parts[i]);
        if (!isNaN(val)) patternsRaw[id].push(val);
      }
    }
    // Normalizar a 24 horas
    const importedPatterns: TemporalPatternEntry[] = [];
    for (const [id, vals] of Object.entries(patternsRaw)) {
      const multipliers: string[] = Array.from({ length: 24 }, (_, i) => {
        const val = i < vals.length ? vals[i] : (vals.length > 0 ? vals[i % vals.length] : 1);
        return String(val);
      });
      importedPatterns.push({ id: importedPatterns.length + 1, patternId: id, multipliers });
    }
  
    // --- 4. Leer curvas de bomba (solo las referenciadas) ---
    const curvesRaw: Record<string, { flow: number; head: number }[]> = {};
    for (const line of (sections['CURVES'] || [])) {
      const [id, xv, yv] = line.split(/\s+/);
      if (!id || !xv || !yv) continue;
      const flow = parseFloat(xv);
      const head = parseFloat(yv);
      if (!isNaN(flow) && !isNaN(head)) {
        if (!curvesRaw[id]) curvesRaw[id] = [];
        curvesRaw[id].push({ flow: flow * flowFactor, head });
      }
    }
    // Identificar curvas usadas por bombas
    const usedCurves = new Set<string>();
    for (const line of (sections['PUMPS'] || [])) {
      const parts = line.split(/\s+/);
      for (let i = 3; i < parts.length - 1; i++) {
        const kw = parts[i].toUpperCase();
        if (kw === 'HEAD' || kw === 'CURVE') usedCurves.add(parts[i + 1]);
      }
      // Formato antiguo
      if (parts.length >= 4 && !['HEAD','CURVE','POWER','SPEED','PATTERN'].includes(parts[3]?.toUpperCase())) {
        usedCurves.add(parts[3]);
      }
    }
    const importedCurves: PumpCurveEntry[] = [];
    for (const curveId of usedCurves) {
      const points = curvesRaw[curveId];
      if (points && points.length >= 2) {
        importedCurves.push({
          id: importedCurves.length + 1,
          curveId,
          points: points.map((p, i) => ({
            id: i + 1,
            flow: String(p.flow),
            head: String(p.head),
          }))
        });
      }
    }
  
    // --- 5. Leer demandas extra ---
    const extraDemands: Record<string, { demand: number; pattern: string }> = {};
    for (const line of (sections['DEMANDS'] || [])) {
      const [id, dem, pat] = line.split(/\s+/);
      if (id && dem) {
        extraDemands[id] = { demand: parseFloat(dem) * flowFactor, pattern: pat || '' };
      }
    }
  
    // --- 6. Construir nodos (junctions, reservorios, tanques) ---
    const newNodes: NodeEntry[] = [];
    const usedNodeIds = new Set<string>();
  
    // Junctions
    for (const line of (sections['JUNCTIONS'] || [])) {
      const parts = line.split(/\s+/);
      const [id, elev, demStr, patStr] = parts;
      if (!id || elev === undefined) continue;
      const elevM = parseFloat(elev) * lengthToMeters;
      if (isNaN(elevM)) continue;
  
      let demand = 0;
      let patternId = '';
      if (extraDemands[id]) {
        demand = extraDemands[id].demand;
        patternId = extraDemands[id].pattern;
      } else {
        demand = parseFloat(demStr) * flowFactor || 0;
        patternId = patStr || '';
      }
  
      const coord = coords[id] || { x: 0, y: 0 };
      newNodes.push({
        id: newId(),
        type: 'nodo',
        nodeId: id,
        colorHex: randomVividColorHex(),
        x: coord.x.toString(), xUnit: 'm',
        y: coord.y.toString(), yUnit: 'm',
        z: elevM.toString(), zUnit: 'm',
        demanda: demand.toString(), demandaUnit: 'l/s',
        patternId,
        nivelIni: '', nivelIniUnit: 'm',
        nivelMin: '', nivelMinUnit: 'm',
        nivelMax: '', nivelMaxUnit: 'm',
        diametro: '', diametroUnit: 'm',
      });
      usedNodeIds.add(id);
    }
  
    // Reservoirs
    for (const line of (sections['RESERVOIRS'] || [])) {
      const [id, head] = line.split(/\s+/);
      if (!id || head === undefined) continue;
      const headM = parseFloat(head) * lengthToMeters;
      if (isNaN(headM)) continue;
      const coord = coords[id] || { x: 0, y: 0 };
      newNodes.push({
        id: newId(),
        type: 'reservorio',
        nodeId: id,
        colorHex: randomVividColorHex(),
        x: coord.x.toString(), xUnit: 'm',
        y: coord.y.toString(), yUnit: 'm',
        z: headM.toString(), zUnit: 'm',
        demanda: '', demandaUnit: 'l/s',
        patternId: '',
        nivelIni: '', nivelIniUnit: 'm',
        nivelMin: '', nivelMinUnit: 'm',
        nivelMax: '', nivelMaxUnit: 'm',
        diametro: '', diametroUnit: 'm',
      });
      usedNodeIds.add(id);
    }
  
    // Tanks
    for (const line of (sections['TANKS'] || [])) {
      const parts = line.split(/\s+/);
      const [id, elev, initLev, minLev, maxLev, diam] = parts;
      if (!id || elev === undefined) continue;
      const elevM = parseFloat(elev) * lengthToMeters;
      const initM = parseFloat(initLev) * lengthToMeters;
      const minM = parseFloat(minLev) * lengthToMeters;
      let maxM = parseFloat(maxLev) * lengthToMeters;
      const diamM = parseFloat(diam) * lengthToMeters;
      if (isNaN(elevM) || isNaN(initM) || isNaN(minM) || isNaN(maxM) || isNaN(diamM)) continue;
      if (maxM <= 0) maxM = initM + 1;
      const coord = coords[id] || { x: 0, y: 0 };
      newNodes.push({
        id: newId(),
        type: 'tanque',
        nodeId: id,
        colorHex: randomVividColorHex(),
        x: coord.x.toString(), xUnit: 'm',
        y: coord.y.toString(), yUnit: 'm',
        z: elevM.toString(), zUnit: 'm',
        demanda: '', demandaUnit: 'l/s',
        patternId: '',
        nivelIni: initM.toString(), nivelIniUnit: 'm',
        nivelMin: minM.toString(), nivelMinUnit: 'm',
        nivelMax: maxM.toString(), nivelMaxUnit: 'm',
        diametro: diamM.toString(), diametroUnit: 'm',
      });
      usedNodeIds.add(id);
    }
  
    // --- 7. Construir conexiones (tuberías y bombas) ---
    const newConnections: ConnectionEntry[] = [];
  
    // Pipes
    for (const line of (sections['PIPES'] || [])) {
      const parts = line.split(/\s+/);
      const [id, from, to, len, diam, rough] = parts;
      if (!id || !from || !to) continue;
      const lengthM = parseFloat(len) * lengthToMeters;
      const diamMM = parseFloat(diam) * diamFactor;
      const roughMM = parseFloat(rough) * roughFactor;
      if (isNaN(lengthM) || isNaN(diamMM) || isNaN(roughMM)) continue;
  
      newConnections.push({
        id: newId(),
        type: 'tuberia',
        tubId: id,
        from,
        to,
        curveId: '',
        longitud: lengthM.toString(),
        longitudAuto: '',
        longitudManual: true,
        diametro: diamMM.toString(),
        diametroUnit: 'mm',
        rugosidad: roughMM.toString(),
        rugosidadUnit: 'mm',
      });
    }
  
    // Pumps
    for (const line of (sections['PUMPS'] || [])) {
      const parts = line.split(/\s+/);
      const [id, from, to, ...kw] = parts;
      if (!id || !from || !to) continue;
      let curveId = '';
      for (let i = 0; i < kw.length - 1; i++) {
        const k = kw[i].toUpperCase();
        if (k === 'HEAD' || k === 'CURVE') {
          curveId = kw[i + 1];
          break;
        }
      }
      // Formato antiguo
      if (!curveId && kw.length >= 1 && !['HEAD','CURVE','POWER','SPEED','PATTERN'].includes(kw[0]?.toUpperCase())) {
        curveId = kw[0];
      }
      newConnections.push({
        id: newId(),
        type: 'bomba',
        tubId: id,
        from,
        to,
        curveId: curveId || '',
        longitud: '',
        longitudAuto: '',
        longitudManual: false,
        diametro: '',
        diametroUnit: 'mm',
        rugosidad: '',
        rugosidadUnit: 'mm',
      });
    }
  
    // --- 8. Actualizar estados ---
    // Limpiar estados anteriores
    stopTemporalPlayback();
    setNodes(newNodes);
    setConnections(newConnections);
    setPumpCurves(importedCurves);
    setTemporalConfig(prev => ({ ...prev, patterns: importedPatterns, enabled: importedPatterns.length > 0 ? prev.enabled : false }));
    setAnalysisResult(null);
    setCalcResult(null);
    setCurrentFrameIndex(0);

    const allIds = [...newNodes.map(n => n.id), ...newConnections.map(c => c.id)];
    setCollapsedCards(new Set(allIds));
    allIds.forEach(id => {
      collapseAnimsRef.current[id] = new Animated.Value(0);
    });
  
    // Mostrar toast de éxito
    const totalNodes = newNodes.length;
    const totalConns = newConnections.length;
    Toast.show({
      type: 'success',
      text1: t('common.success') || 'Importado',
      text2: `${totalNodes} nodos, ${totalConns} conexiones, ${importedCurves.length} curvas, ${importedPatterns.length} patrones`,
    });
  }, [stopTemporalPlayback, newId, setNodes, setConnections, setPumpCurves, setTemporalConfig, setAnalysisResult, setCalcResult, setCurrentFrameIndex, setCollapsedCards, t]);

  const handleImportEpanet = useCallback(async () => {
    try {
      const [result] = await pick({
        allowMultiSelection: false,
        mode: 'open',
      });
      if (!result || !result.uri) return;
  
      const response = await fetch(result.uri);
      const text = await response.text();
      importFromEpanet(text);
    } catch (err) {
      console.error('Error picking file:', err);
      Toast.show({
        type: 'error',
        text1: t('common.error') || 'Error',
        text2: 'No se pudo seleccionar el archivo.',
      });
    }
  }, [importFromEpanet, t]);

  useEffect(() => {
    if (buttonMetrics.nodes > 0 && buttonMetrics.connections > 0) {
      const targetX = mode === 'nodes' ? buttonPositions.nodes : buttonPositions.connections;
      Animated.parallel([
        Animated.spring(animatedValue, { toValue: targetX, useNativeDriver: true, bounciness: 5, speed: 5 }),
        Animated.sequence([
          Animated.spring(animatedScale, { toValue: 1.15, useNativeDriver: true, bounciness: 5, speed: 50 }),
          Animated.spring(animatedScale, { toValue: 1,    useNativeDriver: true, bounciness: 5, speed: 50 }),
        ]),
      ]).start();
    }
  }, [animatedScale, animatedValue, mode, buttonMetrics, buttonPositions]);

  useEffect(() => {
    Animated.timing(controls2DAnim, {
      toValue: is2DViewMode ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [controls2DAnim, is2DViewMode]);

  useEffect(() => {
    setIs2DViewMode(false);
  }, [currentTheme]);

  useEffect(() => {
    setNodes(prev => {
      let changed = false;
      const next = prev.map(node => {
        if (node.type !== 'nodo') {
          if (!node.patternId) return node;
          changed = true;
          return { ...node, patternId: '' };
        }

        const currentPatternId = node.patternId ?? '';
        if (!temporalPatternIds.length) {
          if (currentPatternId === '') return node;
          changed = true;
          return { ...node, patternId: '' };
        }

        if (temporalPatternIds.includes(currentPatternId)) return node;

        const fallbackPatternId = temporalConfig.enabled ? temporalDefaultPatternId : '';
        if (currentPatternId === fallbackPatternId) return node;
        changed = true;
        return { ...node, patternId: fallbackPatternId };
      });

      return changed ? next : prev;
    });
  }, [temporalConfig.enabled, temporalDefaultPatternId, temporalPatternIds]);

  const animateCartesianAspectRatio = useCallback((toValue: number) => {
    Animated.timing(cartesianAspectRatioAnim, {
      toValue,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setCartesianAspectRatio(toValue);
  }, [cartesianAspectRatioAnim]);

  const handleSetWideCartesianView = useCallback(() => {
    const isCurrentlyWide = cartesianAspectRatio === CARTESIAN_WIDE_ASPECT_RATIO;
    animateCartesianAspectRatio(
      isCurrentlyWide
        ? CARTESIAN_DEFAULT_ASPECT_RATIO
        : CARTESIAN_WIDE_ASPECT_RATIO,
    );
    // Cambiar icono izquierdo entre chevron-up y chevron-down
    setCartesianIconLeft(isCurrentlyWide ? 'chevron-up' : 'chevron-down');
  }, [animateCartesianAspectRatio, cartesianAspectRatio]);

  const handleSetCompactCartesianView = useCallback(() => {
    const isCurrentlyCompact = cartesianAspectRatio === CARTESIAN_COMPACT_ASPECT_RATIO;
    animateCartesianAspectRatio(
      isCurrentlyCompact
        ? CARTESIAN_DEFAULT_ASPECT_RATIO
        : CARTESIAN_COMPACT_ASPECT_RATIO,
    );
    // Cambiar icono derecho entre maximize y minimize
    setCartesianIconRight(isCurrentlyCompact ? 'maximize' : 'minimize');
  }, [animateCartesianAspectRatio, cartesianAspectRatio]);

  const handlePumpCurvesFeaturePress = useCallback(() => {
    navigation.navigate('PumpCurvesAxisScreen', {
      initialCurves: pumpCurves,
      onSave: (curves: PumpCurveEntry[]) => {
        setPumpCurves(normalizePumpCurves(curves));
      },
    });
  }, [navigation, pumpCurves]);

  const handleTemporalFeaturePress = useCallback(() => {
    navigation.navigate('TemporalAnalysisAxisScreen', {
      initialConfig: temporalConfig,
      onSave: (config: TemporalAnalysisConfig) => {
        setTemporalConfig(config);
      },
    });
  }, [navigation, temporalConfig]);

  // ── Sincronizar refs ──────────────────────────────────────────────────────────
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { activeInputIdRef.current = activeInputId; }, [activeInputId]);

  const getOrCreateCollapseAnim = useCallback((id: number): Animated.Value => {
    if (!collapseAnimsRef.current[id]) {
      collapseAnimsRef.current[id] = new Animated.Value(1); // 1 = expandido
    }
    return collapseAnimsRef.current[id];
  }, []);
  
  const toggleCollapse = useCallback((id: number) => {
    const anim = getOrCreateCollapseAnim(id);
    const isCurrentlyCollapsed = collapsedCards.has(id);
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (isCurrentlyCollapsed) next.delete(id);
      else next.add(id);
      return next;
    });
    Animated.timing(anim, {
      toValue: isCurrentlyCollapsed ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [collapsedCards, getOrCreateCollapseAnim]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.nodes && Array.isArray(saved.nodes)) {
          setNodes(
            saved.nodes.map((node: any) => ({
              ...makeDefaultNode(node.type ?? 'nodo', node.nodeId ?? ''),
              ...node,
              patternId: node.patternId ?? '',
              nivelMin: node.nivelMin ?? '',
              nivelMinUnit: node.nivelMinUnit ?? 'm',
              nivelMax: node.nivelMax ?? '',
              nivelMaxUnit: node.nivelMaxUnit ?? 'm',
            }))
          );
          // Restaurar el contador de IDs para que no haya colisiones
          const maxId = saved.nodes.reduce((m: number, n: any) => Math.max(m, n.id ?? 0), 0);
          idCounterRef.current = Math.max(idCounterRef.current, maxId);
        }
        if (saved.connections && Array.isArray(saved.connections)) {
          setConnections(
            saved.connections.map((connection: any) => ({
              ...makeDefaultConnection(
                connection.tubId ?? '',
                connection.from ?? '',
                connection.to ?? '',
                connection.type ?? 'tuberia'
              ),
              ...connection,
              type: connection.type ?? 'tuberia',
              curveId: connection.curveId ?? '',
              longitud: connection.longitud ?? '',
              longitudAuto:
                connection.longitudAuto ?? (!connection.longitudManual ? connection.longitud ?? '' : ''),
              longitudManual: !!connection.longitudManual,
            }))
          );
          const maxId = saved.connections.reduce((m: number, c: any) => Math.max(m, c.id ?? 0), 0);
          idCounterRef.current = Math.max(idCounterRef.current, maxId);
        }
        if (saved.temporalConfig) {
          setTemporalConfig({
            ...createDefaultTemporalConfig(),
            ...saved.temporalConfig,
            patterns: Array.isArray(saved.temporalConfig.patterns) ? saved.temporalConfig.patterns : [],
          });
        }
        if (saved.pumpCurves) {
          setPumpCurves(normalizePumpCurves(saved.pumpCurves));
        }
        if (saved.collapsedCards && Array.isArray(saved.collapsedCards)) {
          const restoredSet = new Set<number>(saved.collapsedCards);
          setCollapsedCards(restoredSet);
          // Inicializar collapseAnimsRef para cada nodo y conexión
          const allIds = [
            ...(saved.nodes || []).map((n: any) => n.id),
            ...(saved.connections || []).map((c: any) => c.id),
          ];
          allIds.forEach((id: number) => {
            if (!collapseAnimsRef.current[id]) {
              collapseAnimsRef.current[id] = new Animated.Value(restoredSet.has(id) ? 0 : 1);
            }
          });
        }
      } catch {}
    });
  }, []); // Solo al montar — sin dependencias

  useEffect(() => {
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nodes,
          connections,
          temporalConfig,
          pumpCurves,
          collapsedCards: Array.from(collapsedCards), // <-- añadir esto
        })
      ).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, connections, temporalConfig, pumpCurves, collapsedCards]); // <-- añadir collapsedCards a dependencias

  useEffect(() => {
    setConnections(prev => {
      let changed = false;
      const next = prev.map(connection => {
        if (connection.type !== 'bomba') {
          if (!connection.curveId) return connection;
          changed = true;
          return { ...connection, curveId: '' };
        }
  
        if (!pumpCurveIds.length) {
          if (!connection.curveId) return connection;
          changed = true;
          return { ...connection, curveId: '' };
        }
  
        if (pumpCurveIds.includes(connection.curveId)) return connection;
        changed = true;
        return { ...connection, curveId: pumpCurveIds[0] ?? '' };
      });
  
      return changed ? next : prev;
    });
  }, [pumpCurveIds]);

  // ── Auto-scroll al input activo ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeInputId) return;
    const viewRef = inputRefs.current[activeInputId];
    if (!viewRef || !scrollViewRef.current) return;
    setTimeout(() => {
      viewRef.measureLayout(
        scrollViewRef.current as any,
        (_x: number, y: number, _w: number, height: number) => {
          const KEYBOARD_HEIGHT = 280;
          const SCREEN_HEIGHT   = Dimensions.get('window').height;
          const targetScrollY   = y - (SCREEN_HEIGHT - KEYBOARD_HEIGHT - height - 30);
          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetScrollY), animated: true });
        },
        () => {}
      );
    }, 150);
  }, [activeInputId]);

  useFocusEffect(
    React.useCallback(() => {
      return () => { setActiveInputId(null); };
    }, [setActiveInputId])
  );

  // ── Inyección al WebView — convierte coordenadas a metros ─────────────────────
  const injectRebuild = useCallback((currentNodes: NodeEntry[], currentConns: ConnectionEntry[]) => {
    const toSI = (val: string, unit: string, cat: string) => {
      const v = parseFloat(val.replace(',', '.'));
      if (isNaN(v)) return '0';
      return (v * (conversionFactors[cat]?.[unit] ?? 1)).toString();
    };

    const nodesForWV = currentNodes.map(n => ({
      ...n,
      x: toSI(n.x, n.xUnit, 'length'),
      y: toSI(n.y, n.yUnit, 'length'),
      z: toSI(n.z, n.zUnit, 'length'),
    }));

    const payload = JSON.stringify({ nodes: nodesForWV, connections: currentConns });
    const escaped = payload.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const js = `try { window.rn_rebuild(\`${escaped}\`); } catch(e) { console.error('rn_rebuild error:', e.message); } true;`;
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const handleWebViewLoad = useCallback(() => {
    setIs2DViewMode(false);
    injectRebuild(nodesRef.current, connectionsRef.current);
  }, [injectRebuild]);

  const handleRotate2DLeft = useCallback(() => {
    webViewRef.current?.injectJavaScript('try { window.rn_rotate2D && window.rn_rotate2D(+1); } catch(e){} true;');
  }, []);

  const handleRotate2DRight = useCallback(() => {
    webViewRef.current?.injectJavaScript('try { window.rn_rotate2D && window.rn_rotate2D(-1); } catch(e){} true;');
  }, []);

  const handleReturnTo3D = useCallback(() => {
    webViewRef.current?.injectJavaScript('try { window.rn_resetTo3D && window.rn_resetTo3D(); } catch(e){} true;');
  }, []);

  const handleScaleUp = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      'try { window.rn_scaleUp && window.rn_scaleUp(); } catch(e){} true;'
    );
  }, []);
  
  const handleScaleDown = useCallback(() => {
    webViewRef.current?.injectJavaScript(
      'try { window.rn_scaleDown && window.rn_scaleDown(); } catch(e){} true;'
    );
  }, []);

  const pushResultToWebView = useCallback(
    (result: AxisHydraulicStepResult | null) => {
      if (!result) return;
      const payload = JSON.stringify({
        nodos: result.nodos,
        tanques: result.tanques,
        tuberias: result.tuberias,
        modoNodo: modoVisualNodo,
        modoTuberia: modoVisualTuberia,
      });
      const escaped = payload.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
      webViewRef.current?.injectJavaScript(
        `try { window.rn_showResults(\`${escaped}\`); } catch(e){} true;`
      );
    },
    [modoVisualNodo, modoVisualTuberia]
  );

  const applyAnalysisFrame = useCallback((analysis: AxisHydraulicAnalysisResult, frameIndex: number) => {
    const safeIndex = Math.max(0, Math.min(frameIndex, analysis.frames.length - 1));
    setCurrentFrameIndex(safeIndex);
    setCalcResult(analysis.frames[safeIndex]?.result ?? null);
  }, []);


  const handleCalcular = useCallback(() => {
    if (isCalculating) return;          // evitar doble tap
    stopTemporalPlayback();
    setIsCalculating(true);             // mostrar spinner en el botón
   
    // Capturar los datos ahora (antes de ceder el hilo),
    // porque los refs pueden cambiar si el usuario sigue tocando la UI.
    const currentNodes = nodesRef.current as AxisNodeInputEntry[];
    const currentConnections = connectionsRef.current.map(connection => {
      if (connection.type !== 'bomba') {
        return connection as AxisConnectionInputEntry;
      }
      const curve = pumpCurves.find(entry => entry.curveId.trim() === connection.curveId.trim());
      const derived = curve ? derivePumpCurveState(curve) : null;
      return {
        ...connection,
        curveCoefficients: derived?.coefficients ?? undefined,
        maxFlowLs: derived?.maxFlowLs ?? undefined,
      } as AxisConnectionInputEntry;
    });
    const currentTemporalConfig = temporalConfig;
   
    // runAfterInteractions → espera a que terminen las animaciones actuales,
    // luego setTimeout(0) → cede el hilo al motor de render para que
    // el spinner aparezca ANTES de empezar el cálculo.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        let result: AxisCalculationResult<AxisHydraulicAnalysisResult>;
        try {
          result = runAxisHydraulicAnalysis(
            currentNodes,
            currentConnections,
            currentTemporalConfig
          );
        } catch (err: any) {
          setIsCalculating(false);
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Error',
            text2: err?.message || 'Error interno del solver.',
          });
          return;
        }
   
        setIsCalculating(false);
   
        if (!result.ok) {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Error',
            text2: result.error,
          });
          return;
        }
   
        setAnalysisResult(result.data);
        applyAnalysisFrame(result.data, 0);
   
        result.warnings.forEach(message => {
          Toast.show({
            type: 'error',
            text1: t('common.error') || 'Aviso',
            text2: message,
          });
        });
      }, 0);
    });
  }, [
    isCalculating,           // <— nuevo
    applyAnalysisFrame,
    pumpCurves,
    stopTemporalPlayback,
    t,
    temporalConfig,
  ]);

  // ── Actualizar labels en WebView cuando cambia el modo visual ─────────────────
  useEffect(() => {
    pushResultToWebView(calcResult);
  }, [calcResult, pushResultToWebView]);

  useEffect(() => {
    return () => stopTemporalPlayback();
  }, [stopTemporalPlayback]);

  useEffect(() => {
    // Si este render fue causado solo por la actualización de longitudes,
    // NO volver a inyectar al WebView (evita el bucle infinito)
    if (isLengthUpdateRef.current) {
      isLengthUpdateRef.current = false;
      return;
    }
    injectRebuild(nodes, connections);
  }, [nodes, connections, injectRebuild]);

  // ── Mensaje desde el WebView (longitudes computadas) ─────────────────────────
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'VIEW_MODE_CHANGE') {
        setIs2DViewMode(Boolean(msg.is2DMode));
        return;
      }
      if (msg.type === 'LENGTHS_UPDATE') {
        setConnections(prev => {
          let changed = false;
          const next = prev.map(c => {
            const newLen = msg.lengths[c.tubId];
            if (c.type === 'bomba' || newLen === undefined) return c;
      
            // Solo actualizar longitudAuto (valor calculado por el WebView)
            const updated = { ...c, longitudAuto: newLen };
      
            // Si NO está en modo manual, sincronizar longitud con el nuevo valor automático
            if (!c.longitudManual) {
              updated.longitud = newLen;
            }
            // Si está en modo manual, NO tocar longitud
      
            if (
              updated.longitudAuto !== c.longitudAuto ||
              updated.longitud !== c.longitud
            ) {
              changed = true;
              return updated;
            }
            return c;
          });
          if (!changed) return prev;
          isLengthUpdateRef.current = true;
          return next;
        });
      }
    } catch {}
  }, []);

  // ── CRUD Nodos ────────────────────────────────────────────────────────────────
  const addNode = useCallback(() => {
    const newNodeId = newId();
    collapseAnimsRef.current[newNodeId] = new Animated.Value(1);
  
    const currentNodes = nodesRef.current;
    if (currentNodes.length > 0) {
      currentNodes.forEach(n => {
        const anim = getOrCreateCollapseAnim(n.id);
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      });
      setCollapsedCards(prev => {
        const next = new Set(prev);
        currentNodes.forEach(n => next.add(n.id));
        return next;
      });
    }
    setNodes(prev => {
      const used = new Set(prev.filter(n => n.type === 'nodo').map(n => n.nodeId));
      let n = 1; while (used.has('N' + n)) n++;
      return [
        ...prev,
        {
          id: newNodeId, // ← usa el ID pre-generado
          colorHex: randomVividColorHex(),
          ...makeDefaultNode('nodo', 'N' + n),
          patternId: temporalDefaultPatternId,
        },
      ];
    });
  }, [getOrCreateCollapseAnim, temporalDefaultPatternId]);

  const removeNode = useCallback((id: number) => {
    const node = nodesRef.current.find(n => n.id === id);
    setNodes(prev => prev.filter(n => n.id !== id));
    setCollapsedCards(prev => { const next = new Set(prev); next.delete(id); return next; });
    delete collapseAnimsRef.current[id];
    if (node) {
      setConnections(prev => prev.filter(c => c.from !== node.nodeId && c.to !== node.nodeId));
    }
  }, []);

  const updateNode = useCallback((id: number, updates: Partial<NodeEntry>) => {
    setNodes(prev => {
      const oldNode = prev.find(n => n.id === id);
      const updated = prev.map(n => n.id === id ? { ...n, ...updates } : n);
      // Cascadear cambio de nodeId a conexiones
      if (updates.nodeId !== undefined && oldNode && oldNode.nodeId !== updates.nodeId) {
        setConnections(prevC => prevC.map(c => ({
          ...c,
          from: c.from === oldNode.nodeId ? updates.nodeId! : c.from,
          to:   c.to   === oldNode.nodeId ? updates.nodeId! : c.to,
        })));
      }
      return updated;
    });
  }, []);

  // ── CRUD Conexiones ───────────────────────────────────────────────────────────
  const addConnection = useCallback(() => {
    const newConnId = newId();
    collapseAnimsRef.current[newConnId] = new Animated.Value(1);
  
    const currentConns = connectionsRef.current;
    if (currentConns.length > 0) {
      currentConns.forEach(c => {
        const anim = getOrCreateCollapseAnim(c.id);
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      });
      setCollapsedCards(prev => {
        const next = new Set(prev);
        currentConns.forEach(c => next.add(c.id));
        return next;
      });
    }
    setConnections(prev => {
      const used = new Set(prev.map(c => c.tubId));
      let n = 1; while (used.has('P' + n)) n++;
      return [
        ...prev,
        {
          id: newConnId, // ← usa el ID pre-generado
          ...makeDefaultConnection(
            'P' + n,
            nodesRef.current[0]?.nodeId ?? '',
            nodesRef.current[1]?.nodeId ?? '',
            'tuberia'
          ),
        },
      ];
    });
  }, [getOrCreateCollapseAnim]);

  const removeConnection = useCallback((id: number) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    setCollapsedCards(prev => { const next = new Set(prev); next.delete(id); return next; });
    delete collapseAnimsRef.current[id];
  }, []);

  const updateConnection = useCallback((id: number, updates: Partial<ConnectionEntry>) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const getNextConnectionId = useCallback((type: ConnectionType, excludeId?: number) => {
    const prefix = type === 'bomba' ? 'B' : 'P';
    const used = new Set(
      connectionsRef.current
        .filter(connection => connection.id !== excludeId)
        .map(connection => connection.tubId.trim())
        .filter(Boolean)
    );
    let counter = 1;
    while (used.has(`${prefix}${counter}`)) counter += 1;
    return `${prefix}${counter}`;
  }, []);

  const handleConnectionLengthChange = useCallback((id: number, value: string) => {
    setConnections(prev =>
      prev.map(connection => {
        if (connection.id !== id) return connection;
        return {
          ...connection,
          longitud: value,
          longitudManual: true,
        };
      })
    );
  }, []);

  const restoreConnectionLength = useCallback((id: number) => {
    setConnections(prev =>
      prev.map(connection =>
        connection.id === id
          ? {
              ...connection,
              longitud: connection.longitudAuto,
              longitudManual: false,
            }
          : connection
      )
    );
  }, []);

  // ── Navegación a OptionsScreen ────────────────────────────────────────────────
  const navigateToOptions = useCallback(
    (category: string, options: string[], onSelectOption: (opt: string) => void, selectedOption?: string) => {
      navigation.navigate('OptionsScreenAxis', { category, options, onSelectOption, selectedOption });
    },
    [navigation]
  );

  // ── Handlers del teclado custom ───────────────────────────────────────────────
  const getActiveValue = useCallback((): string => {
    const id = activeInputIdRef.current;
    if (!id) return '';
    const parts = id.split('-');
    if (parts.length < 3) return '';
    const entryType = parts[0];
    const entryId   = parseInt(parts[1], 10);
    const field     = parts.slice(2).join('-');
    if (entryType === 'node') {
      const node = nodesRef.current.find(n => n.id === entryId);
      return node ? ((node as any)[field] ?? '') : '';
    }
    if (entryType === 'conn') {
      const conn = connectionsRef.current.find(c => c.id === entryId);
      return conn ? ((conn as any)[field] ?? '') : '';
    }
    return '';
  }, []);

  const handleKeyboardKey = useCallback((key: string) => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = appendKeyboardKey(getActiveValue(), key);
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDelete = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(deleteKeyboardKey(getActiveValue()));
  }, [getActiveValue]);

  const handleKeyboardClear = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    inputHandlersRef.current[id]?.(clearKeyboardValue());
  }, []);

  const handleKeyboardMultiply10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = insertScientificNotation(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardDivide10 = useCallback(() => {
    const id = activeInputIdRef.current;
    if (!id) return;
    const nextValue = insertKeyboardMinus(getActiveValue());
    if (nextValue !== null) {
      inputHandlersRef.current[id]?.(nextValue);
    }
  }, [getActiveValue]);

  const handleKeyboardSubmit = useCallback(() => { setActiveInputId(null); }, [setActiveInputId]);

  const isKeyboardOpen = !!activeInputId;
  const canPlayTemporalSeries = !!(
    analysisResult &&
    analysisResult.mode === 'extended' &&
    analysisResult.frames.length > 1
  );
  const currentTemporalFrame = analysisResult?.frames[currentFrameIndex] ?? analysisResult?.frames[0] ?? null;
  const isPlayingTemporal = isTemporalPlaying;
  const showTemporalPlaybackControls = !!(
    analysisResult &&
    analysisResult.mode === 'extended' &&
    currentTemporalFrame
  );
  const isTemporalAtStart = currentFrameIndex <= 0;
  const isTemporalAtEnd = !analysisResult || currentFrameIndex >= analysisResult.frames.length - 1;

  const goToTemporalFrame = useCallback((frameIndex: number) => {
    if (!analysisResult) return;
    stopTemporalPlayback();
    applyAnalysisFrame(analysisResult, frameIndex);
  }, [analysisResult, applyAnalysisFrame, stopTemporalPlayback]);

  const handleTemporalPlayPause = useCallback(() => {
    if (!analysisResult || analysisResult.mode !== 'extended' || analysisResult.frames.length < 2) return;
    if (temporalPlaybackTimerRef.current !== null) {
      stopTemporalPlayback();
      return;
    }

    if (currentFrameIndex >= analysisResult.frames.length - 1) {
      applyAnalysisFrame(analysisResult, 0);
    }

    setIsTemporalPlaying(true);
    temporalPlaybackTimerRef.current = setInterval(() => {
      setCurrentFrameIndex(prev => {
        const lastIndex = analysisResult.frames.length - 1;
        if (prev >= lastIndex) {
          stopTemporalPlayback();
          return lastIndex;
        }

        const nextIndex = prev + 1;
        setCalcResult(analysisResult.frames[nextIndex]?.result ?? null);
        if (nextIndex >= lastIndex) {
          stopTemporalPlayback();
        }
        return nextIndex;
      });
    }, PLAYBACK_INTERVAL_MS);
  }, [analysisResult, applyAnalysisFrame, currentFrameIndex, stopTemporalPlayback]);

  const renderTemporalPlaybackButton = useCallback(
    (icon: React.ReactNode, onPress: () => void, disabled: boolean) => (
      <Pressable
        style={[styles.simpleButtonContainer, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
        <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
          <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
        </MaskedView>
        {icon}
      </Pressable>
    ),
    [theoryButtonColors.cardGradient, theoryButtonColors.gradient]
  );

  // ── Layout handlers del selector de modo ─────────────────────────────────────
  const onLayoutNodes = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions(p => ({ ...p, nodes: x }));
    setButtonMetrics(p => ({ ...p, nodes: width }));
  }, []);

  const onLayoutConnections = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setButtonPositions(p => ({ ...p, connections: x }));
    setButtonMetrics(p => ({ ...p, connections: width }));
  }, []);

  const getModeOverlayWidth = () =>
    mode === 'nodes' ? buttonMetrics.nodes : buttonMetrics.connections;

  // ── Render helpers ────────────────────────────────────────────────────────────

  /** Input simple sin unidad — para ID y campos sin conversión */
  const renderSimpleInput = useCallback(
    (label: string, value: string, fieldId: string, onChange: (t: string) => void) => {
      inputHandlersRef.current[fieldId] = (text: string) => onChange(text);
      
      const isIdField = /(nodeId|tubId|patternId)$/i.test(fieldId);
      
      return (
        <View ref={(r: any) => { inputRefs.current[fieldId] = r; }} style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {label}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: getDotColor((value?.trim()?.length ?? 0) > 0) }]} />
          </View>
          <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient, width: '100%', flex: undefined }]}>
            <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
              {isIdField ? (
                // Los IDs usan teclado nativo alfanumérico.
                <TextInput
                  style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                  value={value}
                  onChangeText={onChange}
                  onFocus={() => setActiveInputId(null)}
                  keyboardType="default"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              ) : (
                // El resto de campos numéricos se edita con el teclado custom.
                <>
                  <Pressable onPress={() => setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                  <TextInput
                    style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                    value={formatKeyboardDisplayValue(value)}
                    editable={false}
                    showSoftInputOnFocus={false}
                    pointerEvents="none"
                    placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      );
    },
    [themeColors, currentTheme, fontSizeFactor, setActiveInputId]
  );

  /** Input con selector de unidad — idéntico a PerdidasLocalizadasCalc */
  const renderInputWithUnit = useCallback(
    (
      label: string,
      value: string,
      unit: string,
      category: string,
      fieldId: string,
      onChange: (t: string) => void,
      onUnitChange: (newUnit: string, oldUnit: string) => void
    ) => {
      inputHandlersRef.current[fieldId] = (text: string) => onChange(text);
      const options = unitOptions[category] ?? [];
      return (
        <View ref={(r: any) => { inputRefs.current[fieldId] = r; }} style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {label}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: getDotColor((value?.trim()?.length ?? 0) > 0) }]} />
          </View>
          <View style={styles.redContainer}>
            <View style={[styles.Container, { experimental_backgroundImage: themeColors.gradient }]}>
              <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
                <Pressable onPress={() => setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                  value={formatKeyboardDisplayValue(value)}
                  editable={false}
                  showSoftInputOnFocus={false}
                  pointerEvents="none"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              </View>
            </View>
            <Pressable
              style={[styles.Container2, { experimental_backgroundImage: themeColors.gradient }]}
              onPress={() =>
                navigateToOptions(
                  category,
                  options,
                  (option: string) => onUnitChange(option, unit),
                  unit
                )
              }
            >
              <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.text, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {unit}
                </Text>
                <Icon name="plus" size={20} color={themeColors.icon} style={styles.icon} />
              </View>
            </Pressable>
          </View>
        </View>
      );
    },
    [themeColors, currentTheme, fontSizeFactor, navigateToOptions, setActiveInputId]
  );

  /** Campo readonly con dot de color personalizable (azul para longitud calculada) */
  /** Campo editable para longitud con restauración al valor calculado */
  const renderConnectionLengthField = useCallback(
    (entry: ConnectionEntry) => {
      const fieldId = `conn-${entry.id}-longitud`;
      inputHandlersRef.current[fieldId] = (text: string) => handleConnectionLengthChange(entry.id, text);
      const hasAutoLength = entry.longitudAuto.trim().length > 0;
      const hasDisplayedLength = entry.longitud.trim().length > 0;
      const dotColor = entry.longitudManual
        ? getDotColor(hasDisplayedLength)
        : getBlueDotColor(hasDisplayedLength);

      return (
        <View ref={(r: any) => { inputRefs.current[fieldId] = r; }} style={styles.inputWrapper}>
          <View style={styles.labelRow}>
            <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
              {t('axis.field.longitud')}
            </Text>
            <View style={[styles.valueDot, { backgroundColor: dotColor }]} />
          </View>
          <View style={styles.lengthFieldRow}>
            <Pressable
              style={[
                styles.lengthResetButtonShell,
                { experimental_backgroundImage: themeColors.gradient },
                !hasAutoLength && styles.buttonDisabled,
              ]}
              onPress={() => restoreConnectionLength(entry.id)}
              disabled={!hasAutoLength}
            >
              <View
                style={[
                  styles.lengthResetButtonInner,
                  {
                    backgroundColor:
                      entry.longitudManual && hasAutoLength ? themeColors.blockInput : themeColors.card,
                  },
                ]}
              >
                <Icon
                  name="rotate-ccw"
                  size={18}
                  color={
                    hasAutoLength
                      ? (entry.longitudManual ? themeColors.textStrong : themeColors.icon)
                      : themeColors.textMuted
                  }
                />
              </View>
            </Pressable>

            <View style={[styles.Container, styles.lengthInputContainer, { experimental_backgroundImage: themeColors.gradient }]}>
              <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card }]}>
                <Pressable onPress={() => setActiveInputId(fieldId)} style={StyleSheet.absoluteFill} />
                <TextInput
                  style={[styles.input, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}
                  value={formatKeyboardDisplayValue(entry.longitud)}
                  editable={false}
                  showSoftInputOnFocus={false}
                  pointerEvents="none"
                  placeholderTextColor={currentTheme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              </View>
            </View>
          </View>
        </View>
      );
    },
    [
      currentTheme,
      fontSizeFactor,
      handleConnectionLengthChange,
      restoreConnectionLength,
      setActiveInputId,
      t,
      themeColors,
    ]
  );

  const renderNodeTypePicker = useCallback(
    (entry: NodeEntry) => {
      const typeLabels: Record<NodeType, string> = { nodo: t('axis.nodeType.nodo'), tanque: t('axis.nodeType.tanque'), reservorio: t('axis.nodeType.reservorio') };
      return (
        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('axis.field.nodeType')}
          </Text>
          <Pressable
            style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
            onPress={() =>
              navigateToOptions(
                'nodeType',
                [t('axis.nodeType.nodo'), t('axis.nodeType.tanque'), t('axis.nodeType.reservorio')],
                (option: string) => {
                  const typeMap: Record<string, NodeType> = { [t('axis.nodeType.nodo')]: 'nodo', [t('axis.nodeType.tanque')]: 'tanque', [t('axis.nodeType.reservorio')]: 'reservorio' };
                  const prefixMap: Record<NodeType, string> = { nodo: 'N', tanque: 'T', reservorio: 'Rs' };
                  const newType = typeMap[option] ?? 'nodo';
                  if (newType === entry.type) return;
                  const prefix = prefixMap[newType];
                  const typeDefaults = makeDefaultNode(newType, prefix);
                  const used = new Set(
                    nodesRef.current
                      .filter(n => n.id !== entry.id && n.type === newType)
                      .map(n => n.nodeId)
                  );
                  let n = 1; while (used.has(prefix + n)) n++;
                  updateNode(entry.id, {
                    type: newType,
                    nodeId: prefix + n,
                    patternId: newType === 'nodo' ? temporalDefaultPatternId : '',
                    demanda: newType === 'nodo' ? entry.demanda : '',
                    demandaUnit: newType === 'nodo' ? entry.demandaUnit : typeDefaults.demandaUnit,
                    nivelIni: newType === 'tanque' ? entry.nivelIni : typeDefaults.nivelIni,
                    nivelIniUnit: typeDefaults.nivelIniUnit,
                    nivelMin: newType === 'tanque' ? entry.nivelMin : typeDefaults.nivelMin,
                    nivelMinUnit: typeDefaults.nivelMinUnit,
                    nivelMax: newType === 'tanque' ? entry.nivelMax : typeDefaults.nivelMax,
                    nivelMaxUnit: typeDefaults.nivelMaxUnit,
                    diametro: newType === 'tanque' ? entry.diametro : typeDefaults.diametro,
                    diametroUnit: typeDefaults.diametroUnit,
                  });
                },
                typeLabels[entry.type]
              )
            }
          >
            <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {typeLabels[entry.type]}
              </Text>
              <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
            </View>
          </Pressable>
        </View>
      );
    },
    [themeColors, fontSizeFactor, navigateToOptions, t, temporalDefaultPatternId, updateNode]
  );

  /** Picker de nodo para Desde/Hasta */
  const renderConnectionNodePicker = useCallback(
    (label: string, value: string, onSelect: (opt: string) => void, compact?: boolean) => {
      const nodeIds = nodesRef.current.map(n => n.nodeId).filter(id => id.trim() !== '');
      const hasNodeOptions = nodeIds.length > 0;
      return (
        <View style={[styles.inputWrapper, compact && { flex: 1 }]}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {label}
          </Text>
          <Pressable
            style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
            onPress={() => navigateToOptions('nodeIds', nodeIds, onSelect, value)}
            disabled={!hasNodeOptions}
          >
            <View
              style={[
                styles.innerWhiteContainer2,
                { backgroundColor: hasNodeOptions ? themeColors.card : themeColors.blockInput },
              ]}
            >
              <Text
                style={[
                  styles.textOptions,
                  {
                    color: hasNodeOptions ? themeColors.text : themeColors.textMuted,
                    fontSize: 16 * fontSizeFactor,
                  },
                ]}
                numberOfLines={1}
              >
                {value || '—'}
              </Text>
              <Icon
                name="chevron-down"
                size={20}
                color={hasNodeOptions ? themeColors.icon : themeColors.textMuted}
                style={styles.icon}
              />
            </View>
          </Pressable>
        </View>
      );
    },
    [themeColors, fontSizeFactor, navigateToOptions]
  );

  const renderPatternPicker = useCallback(
    (entry: NodeEntry) => {
      const hasPatterns = temporalPatternIds.length > 0;
      const selectedPattern = hasPatterns && temporalPatternIds.includes(entry.patternId)
        ? entry.patternId
        : '';

      return (
        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('axis.field.pattern')}
          </Text>
          <Pressable
            style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
            disabled={!hasPatterns}
            onPress={() =>
              navigateToOptions(
                'pattern',
                temporalPatternIds,
                (option: string) => updateNode(entry.id, { patternId: option }),
                selectedPattern
              )
            }
          >
            <View
              style={[
                styles.innerWhiteContainer2,
                { backgroundColor: hasPatterns ? themeColors.card : themeColors.blockInput },
              ]}
            >
              <Text
                style={[
                  styles.textOptions,
                  {
                    color: hasPatterns ? themeColors.text : themeColors.textMuted,
                    fontSize: 16 * fontSizeFactor,
                  },
                ]}
                numberOfLines={1}
              >
                {selectedPattern || t('axisTemporal.noPatternAssigned')}
              </Text>
              <Icon
                name="chevron-down"
                size={20}
                color={hasPatterns ? themeColors.icon : themeColors.textMuted}
                style={styles.icon}
              />
            </View>
          </Pressable>
        </View>
      );
    },
    [fontSizeFactor, navigateToOptions, temporalPatternIds, themeColors, t, updateNode]
  );

  const renderConnectionTypePicker = useCallback(
    (entry: ConnectionEntry) => {
      const typeLabels: Record<ConnectionType, string> = {
        tuberia: t('axis.connectionType.tuberia'),
        bomba: t('axis.connectionType.bomba'),
      };
  
      return (
        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('axis.field.connectionType')}
          </Text>
          <Pressable
            style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
            onPress={() =>
              navigateToOptions(
                'connectionType',
                [t('axis.connectionType.tuberia'), t('axis.connectionType.bomba')],
                (option: string) => {
                  const nextType: ConnectionType =
                    option === t('axis.connectionType.bomba') ? 'bomba' : 'tuberia';
                  if (nextType === entry.type) return;
                  updateConnection(entry.id, {
                    type: nextType,
                    tubId: getNextConnectionId(nextType, entry.id),
                    curveId: nextType === 'bomba' ? (pumpCurveIds[0] ?? '') : '',
                    longitudManual: nextType === 'bomba' ? false : entry.longitudManual,
                  });
                },
                typeLabels[entry.type]
              )
            }
          >
            <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                {typeLabels[entry.type]}
              </Text>
              <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
            </View>
          </Pressable>
        </View>
      );
    },
    [fontSizeFactor, getNextConnectionId, navigateToOptions, pumpCurveIds, t, themeColors, updateConnection]
  );

  const renderPumpCurvePicker = useCallback(
    (entry: ConnectionEntry) => {
      const hasCurves = pumpCurveIds.length > 0;
  
      return (
        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
            {t('axis.field.pumpCurve')}
          </Text>
          <Pressable
            style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
            disabled={!hasCurves}
            onPress={() =>
              navigateToOptions(
                'pumpCurve',
                pumpCurveIds,
                (option: string) => updateConnection(entry.id, { curveId: option }),
                entry.curveId
              )
            }
          >
            <View
              style={[
                styles.innerWhiteContainer2,
                { backgroundColor: hasCurves ? themeColors.card : themeColors.blockInput },
              ]}
            >
              <Text
                style={[
                  styles.textOptions,
                  {
                    color: hasCurves ? themeColors.text : themeColors.textMuted,
                    fontSize: 16 * fontSizeFactor,
                  },
                ]}
                numberOfLines={1}
              >
                {hasCurves ? (entry.curveId || t('axisPump.noCurveAssigned')) : t('axisPump.noCurvesAvailable')}
              </Text>
              <Icon
                name="chevron-down"
                size={20}
                color={hasCurves ? themeColors.icon : themeColors.textMuted}
                style={styles.icon}
              />
            </View>
          </Pressable>
        </View>
      );
    },
    [fontSizeFactor, navigateToOptions, pumpCurveIds, t, themeColors, updateConnection]
  );

  /** Card completa de un nodo */
  const renderNodeCard = useCallback(
    (entry: NodeEntry, _index: number) => {
      const anim = getOrCreateCollapseAnim(entry.id);
      const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1000] });
      const arrowRotation = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  
      return (
        <View
          key={entry.id}
          style={[styles.accessoryBlockMain, { experimental_backgroundImage: themeColors.gradient }]}
        >
          <View style={[styles.accessoryBlock, { backgroundColor: currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(255,255,255)' }]}>
            {/* Encabezado */}
            <View style={[styles.accessoryHeader, { marginBottom: 0 }]}>
              <Text style={[styles.accessoryTitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>
                {entry.type === 'nodo' ? t('axis.nodeType.nodo') : entry.type === 'tanque' ? t('axis.nodeType.tanque') : t('axis.nodeType.reservorio')} ({entry.nodeId || '—'})
              </Text>
              <View
                style={[
                  styles.nodeColorDot,
                  { backgroundColor: '#' + entry.colorHex.toString(16).padStart(6, '0'), marginLeft: 'auto' },
                ]}
              />
              {/* Botón colapsar/expandir — solo el icono, sin estilos de fondo */}
              <Pressable
                onPress={() => toggleCollapse(entry.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 8 }}
              >
                <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
                  <Icon name="chevron-down" size={20} color={themeColors.icon} />
                </Animated.View>
              </Pressable>
            </View>
  
            {/* Contenido animado (inputs + botón eliminar) */}
            <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
              <View style={{ marginTop: 8 }}>
                {renderNodeTypePicker(entry)}
                {renderSimpleInput(t('axis.field.id'), entry.nodeId, `node-${entry.id}-nodeId`, val => updateNode(entry.id, { nodeId: val }))}
                {renderInputWithUnit(t('axis.field.x'), entry.x, entry.xUnit, 'length', `node-${entry.id}-x`,
                  val => updateNode(entry.id, { x: val }),
                  (nu, ou) => updateNode(entry.id, { x: convertVal(entry.x, ou, nu, 'length'), xUnit: nu })
                )}
                {renderInputWithUnit(t('axis.field.y'), entry.y, entry.yUnit, 'length', `node-${entry.id}-y`,
                  val => updateNode(entry.id, { y: val }),
                  (nu, ou) => updateNode(entry.id, { y: convertVal(entry.y, ou, nu, 'length'), yUnit: nu })
                )}
                {renderInputWithUnit(
                  entry.type === 'reservorio' ? t('axis.field.ht') : t('axis.field.elevation'),
                  entry.z, entry.zUnit, 'length', `node-${entry.id}-z`,
                  val => updateNode(entry.id, { z: val }),
                  (nu, ou) => updateNode(entry.id, { z: convertVal(entry.z, ou, nu, 'length'), zUnit: nu })
                )}
                {entry.type === 'nodo' && renderInputWithUnit(
                  t('axis.field.demanda'), entry.demanda, entry.demandaUnit, 'flow', `node-${entry.id}-demanda`,
                  val => updateNode(entry.id, { demanda: val }),
                  (nu, ou) => updateNode(entry.id, { demanda: convertVal(entry.demanda, ou, nu, 'flow'), demandaUnit: nu })
                )}
                {entry.type === 'nodo' && renderPatternPicker(entry)}
                {entry.type === 'tanque' && renderInputWithUnit(
                  t('axis.field.nivelIni'), entry.nivelIni, entry.nivelIniUnit, 'length', `node-${entry.id}-nivelIni`,
                  val => updateNode(entry.id, { nivelIni: val }),
                  (nu, ou) => updateNode(entry.id, { nivelIni: convertVal(entry.nivelIni, ou, nu, 'length'), nivelIniUnit: nu })
                )}
                {entry.type === 'tanque' && renderInputWithUnit(
                  t('axis.field.nivelMin'), entry.nivelMin, entry.nivelMinUnit, 'length', `node-${entry.id}-nivelMin`,
                  val => updateNode(entry.id, { nivelMin: val }),
                  (nu, ou) => updateNode(entry.id, { nivelMin: convertVal(entry.nivelMin, ou, nu, 'length'), nivelMinUnit: nu })
                )}
                {entry.type === 'tanque' && renderInputWithUnit(
                  t('axis.field.nivelMax'), entry.nivelMax, entry.nivelMaxUnit, 'length', `node-${entry.id}-nivelMax`,
                  val => updateNode(entry.id, { nivelMax: val }),
                  (nu, ou) => updateNode(entry.id, { nivelMax: convertVal(entry.nivelMax, ou, nu, 'length'), nivelMaxUnit: nu })
                )}
                {entry.type === 'tanque' && renderInputWithUnit(
                  t('axis.field.diametro'), entry.diametro, entry.diametroUnit, 'length', `node-${entry.id}-diametro`,
                  val => updateNode(entry.id, { diametro: val }),
                  (nu, ou) => updateNode(entry.id, { diametro: convertVal(entry.diametro, ou, nu, 'length'), diametroUnit: nu })
                )}
                {/* Botón eliminar — parte inferior derecha */}
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <Pressable onPress={() => removeNode(entry.id)} style={styles.deleteButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      );
    },
    [themeColors, currentTheme, fontSizeFactor, renderNodeTypePicker, renderPatternPicker,
     t,
     renderSimpleInput, renderInputWithUnit, removeNode, updateNode, toggleCollapse, getOrCreateCollapseAnim]
  );
  

  /** Card completa de una conexión */
  const renderConnectionCard = useCallback(
    (entry: ConnectionEntry, index: number) => {
      const anim = getOrCreateCollapseAnim(entry.id);
      const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1000] });
      const arrowRotation = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  
      return (
        <View
          key={entry.id}
          style={[styles.accessoryBlockMain, { experimental_backgroundImage: themeColors.gradient }]}
        >
          <View style={[styles.accessoryBlock, { backgroundColor: currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(255,255,255)' }]}>
            {/* Encabezado */}
            <View style={[styles.accessoryHeader, { marginBottom: 0 }]}>
              <Text style={[styles.accessoryTitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>
                {entry.type === 'bomba' ? t('axis.pump') : t('axis.pipe')} {entry.tubId || `${entry.type === 'bomba' ? 'B' : 'P'}${index + 1}`}
              </Text>
              {/* Botón colapsar/expandir — solo el icono, sin estilos de fondo */}
              <Pressable
                onPress={() => toggleCollapse(entry.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 'auto' }}
              >
                <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
                  <Icon name="chevron-down" size={20} color={themeColors.icon} />
                </Animated.View>
              </Pressable>
            </View>
  
            {/* Contenido animado (inputs + botón eliminar) */}
            <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
              <View style={{ marginTop: 8 }}>
                {renderConnectionTypePicker(entry)}
                {renderSimpleInput(
                  t('axis.field.id'),
                  entry.tubId,
                  `conn-${entry.id}-tubId`,
                  val => updateConnection(entry.id, { tubId: val })
                )}
                <View style={styles.fromToRow}>
                  {renderConnectionNodePicker(
                    t('axis.field.desde'),
                    entry.from,
                    opt => updateConnection(
                      entry.id,
                      entry.type === 'bomba'
                        ? { from: opt }
                        : { from: opt, longitud: '', longitudAuto: '', longitudManual: false }
                    ),
                    true
                  )}
                  {renderConnectionNodePicker(
                    t('axis.field.hasta'),
                    entry.to,
                    opt => updateConnection(
                      entry.id,
                      entry.type === 'bomba'
                        ? { to: opt }
                        : { to: opt, longitud: '', longitudAuto: '', longitudManual: false }
                    ),
                    true
                  )}
                </View>
                {entry.type === 'bomba' ? (
                  renderPumpCurvePicker(entry)
                ) : (
                  <>
                    {renderConnectionLengthField(entry)}
                    {renderInputWithUnit(
                      t('axis.field.diametro'), entry.diametro, entry.diametroUnit, 'length', `conn-${entry.id}-diametro`,
                      val => updateConnection(entry.id, { diametro: val }),
                      (nu, ou) => updateConnection(entry.id, { diametro: convertVal(entry.diametro, ou, nu, 'length'), diametroUnit: nu })
                    )}
                    {renderInputWithUnit(
                      t('axis.field.rugosidad'), entry.rugosidad, entry.rugosidadUnit, 'length', `conn-${entry.id}-rugosidad`,
                      val => updateConnection(entry.id, { rugosidad: val }),
                      (nu, ou) => updateConnection(entry.id, { rugosidad: convertVal(entry.rugosidad, ou, nu, 'length'), rugosidadUnit: nu })
                    )}
                  </>
                )}
                {/* Botón eliminar — parte inferior derecha */}
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <Pressable onPress={() => removeConnection(entry.id)} style={styles.deleteButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash" size={18} color="rgb(255, 255, 255)" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      );
    },
    [themeColors, currentTheme, fontSizeFactor, renderConnectionLengthField, renderConnectionTypePicker, renderPumpCurvePicker, renderSimpleInput,
     t,
     renderConnectionNodePicker, renderInputWithUnit, removeConnection, updateConnection,
     toggleCollapse, getOrCreateCollapseAnim]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.safeArea, { backgroundColor: currentTheme === 'dark' ? 'rgb(12,12,12)' : 'rgb(255,255,255)' }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.mainContainer}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        contentInset={{ bottom: isKeyboardOpen ? 280 : 0 }}
        scrollEnabled={scrollEnabled}
      >
        {/* ── Header ── */}
        <View style={styles.headerContainer}>
          <View style={styles.leftIconsContainer}>
            <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => navigation.goBack()}
              >
                <Icon name="chevron-left" size={20} color={themeColors.icon} />
              </Pressable>
            </View>
            {/* Botón importar — ahora circular como el de calcular */}
            <View style={[styles.iconWrapperRound, { experimental_backgroundImage: themeColors.gradient }]}>
              <Pressable
                style={[styles.iconContainerRound, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={handleImportEpanet}
              >
                <Icon name="external-link" size={20} color={themeColors.icon} />
              </Pressable>
            </View>
          </View>
          <View style={styles.rightIconsContainer}>
            {/* Botón calcular */}
            <View style={[styles.iconWrapperRound, { experimental_backgroundImage: themeColors.gradient }]}>
              <Pressable
                style={[styles.iconContainerRound, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={handleCalcular}
                disabled={isCalculating}
              >
                <Icon name="zap" size={20} color={themeColors.icon} />
              </Pressable>
            </View>
            {/* Botón borrar */}
            <View style={[styles.iconWrapper, { experimental_backgroundImage: themeColors.gradient }]}>
              <Pressable
                style={[styles.iconContainer, { backgroundColor: 'transparent', experimental_backgroundImage: themeColors.cardGradient }]}
                onPress={() => {
                  stopTemporalPlayback();
                  setNodes([]);
                  setConnections([]);
                  setPumpCurves([]);
                  setTemporalConfig(createDefaultTemporalConfig());
                  setAnalysisResult(null);
                  setCalcResult(null);
                  setCurrentFrameIndex(0);
                  idCounterRef.current = 0;
                  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
                }}
              >
                <Icon name="trash" size={20} color={themeColors.icon} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Títulos ── */}
        <View style={styles.titlesContainer}>
          <Text style={[styles.subtitle, { color: themeColors.text, fontSize: 18 * fontSizeFactor }]}>
            {t('orbit.subtitle')}
          </Text>
          <Text style={[styles.title, { color: themeColors.textStrong, fontSize: 30 * fontSizeFactor }]}>
            {t('orbit.title')}
          </Text>
        </View>

        {/* ── Espacio cartesiano 3D ── */}
        <Animated.View
          style={[styles.cartesianContainer, { aspectRatio: cartesianAspectRatioAnim }]}
          onTouchStart={() => setScrollEnabled(false)}
          onTouchEnd={() => setScrollEnabled(true)}
          onTouchCancel={() => setScrollEnabled(true)}
        >
          <WebView
            key={currentTheme}
            onLoad={handleWebViewLoad}
            ref={webViewRef}
            source={{ html: getCartesian3DHTML(currentTheme === 'dark') }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleWebViewMessage}
          />

          <View pointerEvents="box-none" style={styles.cartesianOverlayControls}>
              <Pressable
              style={[styles.simpleButtonContainer, styles.cartesianOverlayButton, styles.cartesianOverlayButtonLeft]}
              onPress={handleSetWideCartesianView}
              >
                <View style={styles.cartesianOverlayButtonBackground}>
                  <View
                    style={[
                      styles.cartesianOverlayButtonBackgroundFill,
                      { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient },
                    ]}
                  />
                </View>
              <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
              </MaskedView>
              {/* CAMBIA ESTA LÍNEA: reemplaza Octicons por Icon con el estado */}
              <Icon name={cartesianIconLeft} size={18} color={themeColors.icon} style={styles.buttonIcon} />
              </Pressable>

              <View style={styles.cartesianScaleButtonsContainer}>
                <Pressable
                  style={[styles.simpleButtonContainer, styles.cartesianScaleButton]}
                  onPress={handleScaleUp}
                >
                  <View style={[styles.cartesianOverlayButtonBackground]}>
                    <View style={[styles.cartesianOverlayButtonBackgroundFill, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  </View>
                  <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                    <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                  <Icon name="plus" size={18} color={themeColors.icon} style={styles.buttonIcon} />
                </Pressable>

                <Pressable
                  style={[styles.simpleButtonContainer, styles.cartesianScaleButton]}
                  onPress={handleScaleDown}
                >
                  <View style={[styles.cartesianOverlayButtonBackground]}>
                    <View style={[styles.cartesianOverlayButtonBackgroundFill, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  </View>
                  <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                    <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                  <Icon name="minus" size={18} color={themeColors.icon} style={styles.buttonIcon} />
                </Pressable>
              </View>

              <Pressable
              style={[styles.simpleButtonContainer, styles.cartesianOverlayButton, styles.cartesianOverlayButtonRight]}
              onPress={handleSetCompactCartesianView}
              >
              <View style={styles.cartesianOverlayButtonBackground}>
                <View
                  style={[
                    styles.cartesianOverlayButtonBackgroundFill,
                    { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient },
                  ]}
                />
              </View>
              <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
              </MaskedView>
              {/* CAMBIA ESTA LÍNEA: reemplaza Ionicons por Icon con el estado */}
              <Icon name={cartesianIconRight} size={20} color={themeColors.icon} style={styles.buttonIcon} />
              </Pressable>

            <Animated.View
              pointerEvents={is2DViewMode ? 'auto' : 'none'}
              style={[
                styles.view2DControlsAnimatedContainer,
                styles.cartesianOverlayBottomControls,
                {
                  height: controls2DAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }),
                  opacity: controls2DAnim,
                  transform: [
                    { translateY: controls2DAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                  ],
                },
              ]}
            >
              <View style={styles.controlsRow}>
                <Pressable style={styles.simpleButtonContainer} onPress={handleRotate2DLeft}>
                  <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                    <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                  <Icon name="rotate-ccw" size={20} color={themeColors.icon} style={styles.buttonIcon} />
                </Pressable>

                <Pressable style={styles.simpleButtonContainer} onPress={handleRotate2DRight}>
                  <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                    <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                  <Icon name="rotate-cw" size={20} color={themeColors.icon} style={styles.buttonIcon} />
                </Pressable>

                <Pressable style={styles.simpleButtonContainer2} onPress={handleReturnTo3D}>
                  <View style={[styles.buttonBackground2, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  <MaskedView style={styles.maskedButton2} maskElement={<View style={styles.transparentButtonMask2} />}>
                    <View style={[styles.buttonGradient2, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                  <Icon name="box" size={20} color={themeColors.icon} style={styles.buttonIcon} />
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ── Contenedor de inputs ── */}
        {showTemporalPlaybackControls && currentTemporalFrame && analysisResult && (
          <View style={[styles.temporalPlaybackMain, { experimental_backgroundImage: themeColors.gradient }]}>
            <View style={[styles.temporalPlaybackCard, { backgroundColor: themeColors.card }]}>
              <Slider
                containerStyle={styles.temporalSliderContainer}
                minimumValue={0}
                maximumValue={Math.max(analysisResult.frames.length - 1, 0)}
                step={1}
                value={currentFrameIndex}
                minimumTrackTintColor="rgb(194, 254, 12)"
                maximumTrackTintColor={themeColors.sliderTrack}
                thumbImage={currentTheme === 'dark' ? thumbDark : thumbLight}
                thumbStyle={styles.thumbStyle}
                onValueChange={value => {
                  const nextValue = Array.isArray(value) ? value[0] : value;
                  goToTemporalFrame(Math.round(Number(nextValue) || 0));
                }}
              />

              <View style={styles.temporalPlaybackButtonsRow}>
                {renderTemporalPlaybackButton(
                  <Icon name="skip-back" size={20} color={themeColors.icon} style={styles.buttonIcon} />,
                  () => goToTemporalFrame(0),
                  isTemporalAtStart
                )}
                {renderTemporalPlaybackButton(
                  <Icon name="chevron-left" size={20} color={themeColors.icon} style={styles.buttonIcon} />,
                  () => goToTemporalFrame(currentFrameIndex - 1),
                  isTemporalAtStart
                )}
                {renderTemporalPlaybackButton(
                  <Icon name={isPlayingTemporal ? 'pause' : 'play'} size={20} color={themeColors.icon} style={styles.buttonIcon} />,
                  handleTemporalPlayPause,
                  !canPlayTemporalSeries
                )}
                {renderTemporalPlaybackButton(
                  <Icon name="chevron-right" size={20} color={themeColors.icon} style={styles.buttonIcon} />,
                  () => goToTemporalFrame(currentFrameIndex + 1),
                  isTemporalAtEnd
                )}
                {renderTemporalPlaybackButton(
                  <Icon name="skip-forward" size={20} color={themeColors.icon} style={styles.buttonIcon} />,
                  () => goToTemporalFrame(analysisResult.frames.length - 1),
                  isTemporalAtEnd
                )}
                <View style={styles.temporalPlaybackInfoBlock}>
                  <Text style={[styles.temporalPlaybackCurrent, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                    {`t = ${formatTimeMinutes(currentTemporalFrame.timeMinutes)}`}
                  </Text>
                  <Text style={[styles.temporalPlaybackStep, { color: themeColors.text, fontSize: 14 * fontSizeFactor }]}>
                    {`${currentFrameIndex + 1} / ${analysisResult.frames.length}`}
                  </Text>
                </View>
              </View>

              <Text style={[styles.temporalPlaybackHint, { color: themeColors.text, opacity: 0.65, fontSize: 13 * fontSizeFactor }]}>
                {`${t('axisTemporal.playback.horizon')} ${formatTimeMinutes(analysisResult.durationMinutes)} | ${t('axisTemporal.playback.step')} ${formatTimeMinutes(analysisResult.stepMinutes)} | ${t('axisTemporal.playback.block')} ${getPatternHourLabel(currentTemporalFrame.timeMinutes)}`}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.inputsSection, { backgroundColor: themeColors.card, paddingBottom: isKeyboardOpen ? 330 : 70 }]}>

          {/* Selector de modo animado */}
          <View style={styles.modeSelectorRow}>
            <View style={styles.buttonContainer}>
              <Animated.View
                style={[
                  styles.overlay,
                  {
                    experimental_backgroundImage: themeColors.gradient,
                    width: getModeOverlayWidth(),
                    transform: [{ translateX: animatedValue }, { scale: animatedScale }],
                  },
                ]}
              >
                <View style={[styles.overlayInner, { backgroundColor: themeColors.card }]} />
              </Animated.View>

              <Pressable
                onLayout={onLayoutNodes}
                style={[styles.button, mode === 'nodes' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setMode('nodes')}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {t('axis.tab.elementos')}
                </Text>
              </Pressable>

              <Pressable
                onLayout={onLayoutConnections}
                style={[styles.button, mode === 'connections' ? styles.selectedButton : styles.unselectedButton]}
                onPress={() => setMode('connections')}
              >
                <Text style={[styles.buttonText, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                  {t('axis.tab.conexiones')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.modeSelectorActions}>
              <Pressable style={styles.simpleButtonContainer} onPress={handlePumpCurvesFeaturePress}>
                <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                  <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                    <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                  </MaskedView>
                <Entypo name="line-graph" size={18} color={themeColors.icon} style={styles.buttonIcon} />
              </Pressable>

              <Pressable style={styles.simpleButtonContainer} onPress={handleTemporalFeaturePress}>
                <View style={[styles.buttonBackground, { backgroundColor: 'transparent', experimental_backgroundImage: theoryButtonColors.cardGradient }]} />
                <MaskedView style={styles.maskedButton} maskElement={<View style={styles.transparentButtonMask} />}>
                  <View style={[styles.buttonGradient, { experimental_backgroundImage: theoryButtonColors.gradient }]} />
                </MaskedView>
                <Ionicons name="timer-outline" size={24} color={themeColors.icon} style={styles.buttonIcon} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.separator2, { backgroundColor: themeColors.separator }]} />

          {/* Cards de Nodos */}
          {mode === 'nodes' && (
            <View style={styles.inputsContainer}>
              <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
                {t('axis.section.elementos')}
              </Text>
              {nodes.map((node, index) => renderNodeCard(node, index))}
              <View style={styles.addButtonRow}>
                <Pressable style={styles.addButton} onPress={addNode}>
                  <Icon name="plus" size={24} color="white" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Cards de Conexiones */}
          {mode === 'connections' && (
            <View style={styles.inputsContainer}>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
              {t('axis.section.conexiones')}
            </Text>
              {connections.map((conn, index) => renderConnectionCard(conn, index))}
              <View style={styles.addButtonRow}>
                <Pressable style={styles.addButton} onPress={addConnection}>
                  <Icon name="plus" size={24} color="white" />
                </Pressable>
              </View>
            </View>
          )}

{/* ── Resultados hidráulicos ── */}
          {calcResult && (
            <View style={{ marginTop: 10 }}>
              <View style={[styles.separator, { backgroundColor: themeColors.separator }]} />
              <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 18 * fontSizeFactor }]}>
                {t('axis.section.resultados')}
              </Text>

              {/* ── Selectores de modo visual — en la misma fila ── */}
              <View style={styles.fromToRow}>
                {/* Selector Nodos */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                    {t('axis.section.nodos')}
                  </Text>
                  <Pressable
                    style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
                    onPress={() =>
                      navigateToOptions(
                        'modoNodo',
                        [t('axis.modoNodo.presion'), t('axis.modoNodo.cabeza'), t('axis.modoNodo.ninguno')],
                        (opt: string) => {
                          const map: Record<string, 'P' | 'H' | 'none'> = {
                            [t('axis.modoNodo.presion')]: 'P', [t('axis.modoNodo.cabeza')]: 'H', [t('axis.modoNodo.ninguno')]: 'none',
                          };
                          setModoVisualNodo(map[opt] ?? 'P');
                        },
                        modoVisualNodo === 'P' ? t('axis.modoNodo.presion') : modoVisualNodo === 'H' ? t('axis.modoNodo.cabeza') : t('axis.modoNodo.ninguno')
                      )
                    }
                  >
                    <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                      <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} numberOfLines={1}>
                        {modoVisualNodo === 'P' ? t('axis.modoNodo.presion') : modoVisualNodo === 'H' ? t('axis.modoNodo.cabeza') : t('axis.modoNodo.ninguno')}
                      </Text>
                      <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
                    </View>
                  </Pressable>
                </View>

                {/* Selector Tuberías */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]}>
                    {t('axis.section.tuberias')}
                  </Text>
                  <Pressable
                    style={[styles.pickerPressable, { experimental_backgroundImage: themeColors.gradient }]}
                    onPress={() =>
                      navigateToOptions(
                        'modoTuberia',
                        [t('axis.modoTub.caudal'), t('axis.modoTub.velocidad'), t('axis.modoTub.friccion'), t('axis.modoTub.ninguno')],
                        (opt: string) => {
                          const map: Record<string, 'Q' | 'V' | 'f' | 'none'> = {
                            [t('axis.modoTub.caudal')]: 'Q', [t('axis.modoTub.velocidad')]: 'V',
                            [t('axis.modoTub.friccion')]: 'f', [t('axis.modoTub.ninguno')]: 'none',
                          };
                          setModoVisualTuberia(map[opt] ?? 'Q');
                        },
                        modoVisualTuberia === 'Q' ? t('axis.modoTub.caudal')
                          : modoVisualTuberia === 'V' ? t('axis.modoTub.velocidad')
                          : modoVisualTuberia === 'f' ? t('axis.modoTub.friccion')
                          : t('axis.modoTub.ninguno')
                      )
                    }
                  >
                    <View style={[styles.innerWhiteContainer2, { backgroundColor: themeColors.card }]}>
                      <Text style={[styles.textOptions, { color: themeColors.text, fontSize: 16 * fontSizeFactor }]} numberOfLines={1}>
                        {modoVisualTuberia === 'Q' ? t('axis.modoTub.caudal')
                          : modoVisualTuberia === 'V' ? t('axis.modoTub.velocidad')
                          : modoVisualTuberia === 'f' ? t('axis.modoTub.friccion')
                          : t('axis.modoTub.ninguno')}
                      </Text>
                      <Icon name="chevron-down" size={20} color={themeColors.icon} style={styles.icon} />
                    </View>
                  </Pressable>
                </View>
              </View>

              <View style={{ height: 16 }} />

              {/* ── Tabla de Nodos ── */}
              {(() => {
                const nodoCols: [string, number][] = [
                  [t('axis.table.id'), 60], [t('axis.table.hm'), 80], [t('axis.table.zm'), 80], [t('axis.table.pm'), 80],
                ];
                const totalNodoWidth = nodoCols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;
                const { width: SW, height: SH } = Dimensions.get('window');

                const renderNodoTable = (scale: number) => (
                  <View style={styles.tableContainer}>
                    <View style={styles.tableRow}>
                      {nodoCols.map(([h, w], ci) => (
                        <View key={`nh-${ci}`} style={[styles.tableCell, { width: w * scale, borderBottomWidth: 1, borderColor: themeColors.separator, backgroundColor: currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(245,245,245)' }]}>
                          <Text style={[styles.tableCellHeaderText, { color: themeColors.textStrong, fontSize: 11 * scale }]}>{h}</Text>
                        </View>
                      ))}
                    </View>
                    {calcResult.nodos.map((r, i) => {
                      const rowBg = i % 2 !== 0 ? (currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent';
                      const vals = [r.id, r.H.toFixed(3), r.z.toFixed(3), r.P.toFixed(3)];
                      const colors = [themeColors.textStrong, themeColors.text, themeColors.text, themeColors.text];
                      return (
                        <View key={`nr-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                          {nodoCols.map(([, w], ci) => (
                            <View key={`nc-${i}-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: themeColors.separator }]}>
                              <Text style={[ci === 0 ? styles.tableCellHeaderText : styles.tableCellText, { color: colors[ci], fontSize: 11 * scale }]} numberOfLines={1}>{vals[ci]}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                );

                return (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>{t('axis.section.nodos')}</Text>
                      <Pressable
                        onPress={() => setTablaModalNodosVisible(true)}
                        style={[styles.expandButton, { experimental_backgroundImage: themeColors.gradient }]}
                      >
                        <View style={[styles.innerWhiteContainer2Compact, { backgroundColor: themeColors.card }]}>
                          <Text style={[styles.textCompact, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>{t('axis.action.verMas')}</Text>
                          <Icon name="maximize-2" size={14} color={themeColors.icon} style={{ marginLeft: 2 }} />
                        </View>
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {renderNodoTable(fontSizeFactor)}
                    </ScrollView>
                    <Modal visible={tablaModalNodosVisible} transparent animationType="fade" onRequestClose={() => setTablaModalNodosVisible(false)} statusBarTranslucent>
                      <View style={styles.modalOverlay}>
                        <View style={[styles.modalLandscapeContainer, { width: SH, height: SW, transform: [{ rotate: '90deg' }], backgroundColor: currentTheme === 'dark' ? 'rgb(24,24,24)' : 'rgb(255,255,255)' }]}>
                          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 0, alignItems: 'center' }} showsVerticalScrollIndicator>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: totalNodoWidth + 40, paddingVertical: 10 }}>
                              <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 16 }]}>{t('axis.section.nodos')}</Text>
                              <Pressable onPress={() => setTablaModalNodosVisible(false)} style={[styles.expandButton, { experimental_backgroundImage: themeColors.gradient, width: 40, height: 40, borderRadius: 20 }]}>
                                <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }]}>
                                  <Icon name="x" size={18} color={themeColors.icon} />
                                </View>
                              </Pressable>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              {renderNodoTable(fontSizeFactor * 1.1)}
                            </ScrollView>
                          </ScrollView>
                        </View>
                      </View>
                    </Modal>
                  </View>
                );
              })()}

              {/* ── Tabla de Tuberías ── */}
              {(() => {
                const tubCols: [string, number][] = [
                  [t('axis.table.id'), 55], [t('axis.table.desde'), 60], [t('axis.table.hasta'), 60],
                  [t('axis.table.qls'), 80], [t('axis.table.vms'), 80], [t('axis.table.f'), 75],
                ];
                const totalTubWidth = tubCols.reduce((s, [, w]) => s + w, 0) * fontSizeFactor;
                const { width: SW2, height: SH2 } = Dimensions.get('window');

                const renderTubTable = (scale: number) => (
                  <View style={styles.tableContainer}>
                    <View style={styles.tableRow}>
                      {tubCols.map(([h, w], ci) => (
                        <View key={`th-${ci}`} style={[styles.tableCell, { width: w * scale, borderBottomWidth: 1, borderColor: themeColors.separator, backgroundColor: currentTheme === 'dark' ? 'rgb(30,30,30)' : 'rgb(245,245,245)' }]}>
                          <Text style={[styles.tableCellHeaderText, { color: themeColors.textStrong, fontSize: 11 * scale }]}>{h}</Text>
                        </View>
                      ))}
                    </View>
                    {calcResult.tuberias.map((r, i) => {
                      const rowBg = i % 2 !== 0 ? (currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent';
                      const vals = [
                        r.id,
                        r.from,
                        r.to,
                        r.Q_ls.toFixed(3),
                        typeof r.V_ms === 'number' ? r.V_ms.toFixed(3) : '-',
                        typeof r.f === 'number' ? r.f.toFixed(5) : '-',
                      ];
                      const colors = [themeColors.textStrong, themeColors.text, themeColors.text, themeColors.text, themeColors.text, themeColors.text];
                      return (
                        <View key={`tr-${i}`} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                          {tubCols.map(([, w], ci) => (
                            <View key={`tc-${i}-${ci}`} style={[styles.tableCell, { width: w * scale, borderColor: themeColors.separator }]}>
                              <Text style={[ci === 0 ? styles.tableCellHeaderText : styles.tableCellText, { color: colors[ci], fontSize: 11 * scale }]} numberOfLines={1}>{vals[ci]}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                );

                return (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 16 * fontSizeFactor }]}>{t('axis.section.tuberias')}</Text>
                      <Pressable
                        onPress={() => setTablaModalTubeVisible(true)}
                        style={[styles.expandButton, { experimental_backgroundImage: themeColors.gradient }]}
                      >
                        <View style={[styles.innerWhiteContainer2Compact, { backgroundColor: themeColors.card }]}>
                          <Text style={[styles.textCompact, { color: themeColors.text, fontSize: 13 * fontSizeFactor }]}>{t('axis.action.verMas')}</Text>
                          <Icon name="maximize-2" size={14} color={themeColors.icon} style={{ marginLeft: 2 }} />
                        </View>
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {renderTubTable(fontSizeFactor)}
                    </ScrollView>
                    <Modal visible={tablaModalTubeVisible} transparent animationType="fade" onRequestClose={() => setTablaModalTubeVisible(false)} statusBarTranslucent>
                      <View style={styles.modalOverlay}>
                        <View style={[styles.modalLandscapeContainer, { width: SH2, height: SW2, transform: [{ rotate: '90deg' }], backgroundColor: currentTheme === 'dark' ? 'rgb(24,24,24)' : 'rgb(255,255,255)' }]}>
                          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 0, alignItems: 'center' }} showsVerticalScrollIndicator>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: totalTubWidth + 40, paddingVertical: 10 }}>
                              <Text style={[styles.sectionSubtitle, { color: themeColors.textStrong, fontSize: 16 }]}>{t('axis.section.tuberias')}</Text>
                              <Pressable onPress={() => setTablaModalTubeVisible(false)} style={[styles.expandButton, { experimental_backgroundImage: themeColors.gradient, width: 40, height: 40, borderRadius: 20 }]}>
                                <View style={[styles.innerWhiteContainer, { backgroundColor: themeColors.card, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }]}>
                                  <Icon name="x" size={18} color={themeColors.icon} />
                                </View>
                              </Pressable>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              {renderTubTable(fontSizeFactor * 1.1)}
                            </ScrollView>
                          </ScrollView>
                        </View>
                      </View>
                    </Modal>
                  </View>
                );
              })()}
            </View>
          )}

          <View>
            <View style={[styles.separator2, { backgroundColor: themeColors.separator, marginVertical: 10 }]} />
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: themeColors.text, opacity: 0.6, fontSize: 14 * fontSizeFactor }]}>
                {t('axis.infoText')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.logoContainer}>
          <FastImage
            source={currentTheme === 'dark' ? logoDark : logoLight}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>
      </ScrollView>

      {/* ── Teclado custom — fuera del ScrollView ── */}
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
    backgroundColor: 'rgb(255, 255, 255)',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: 'transparent',
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
    gap: 8,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 5,
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
    marginBottom: 0,
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
  cartesianContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginTop: 10,
    overflow: 'hidden',
  },
  thumbStyle: {
    height: 24,
    width: 40,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartesianOverlayControls: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  cartesianOverlayButton: {
    position: 'absolute',
    bottom: 14,
    zIndex: 3,
  },
  cartesianOverlayButtonBackground: {
    width: 46,
    height: 46,
    position: 'absolute',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  cartesianOverlayButtonBackgroundFill: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  cartesianOverlayButtonLeft: {
    left: 14,
  },
  cartesianOverlayButtonRight: {
    right: 14,
  },
  cartesianScaleButtonsContainer: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 3,
    flexDirection: 'column',
    gap: 8,
  },
  cartesianScaleButton: {
    // sin estilos propios — hereda todo de simpleButtonContainer
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  temporalPlaybackMain: {
    padding: 1,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 25,
  },
  temporalPlaybackCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  temporalPlaybackMode: {
    fontFamily: 'SFUIDisplay-Bold',
  },
  temporalPlaybackCurrent: {
    fontFamily: 'SFUIDisplay-Bold',
  },
  temporalPlaybackStep: {
    fontFamily: 'SFUIDisplay-Medium',
    opacity: 0.75,
  },
  temporalSliderContainer: {
    height: 30,
    backgroundColor: 'transparent',
    marginTop: 2,
    marginBottom: 8,
  },
  temporalPlaybackButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 4,
  },
  temporalPlaybackInfoBlock: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    minWidth: 76,
    gap: 2,
  },
  temporalPlaybackHint: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'SFUIDisplay-Regular',
    lineHeight: 18,
  },
  view2DControlsAnimatedContainer: {
    overflow: 'hidden',
  },
  cartesianOverlayBottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    zIndex: 3,
    alignItems: 'center',
  },
  controlsRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 0,
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
  // ── Input section ─────────────────────────────────────────────────────────────
  inputsSection: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 6,
    marginBottom: 16,
  },
  modeSelectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    position: 'relative',
    height: 46,
    minWidth: 0,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    borderRadius: 23,
    marginHorizontal: 3,
    height: 46,
    zIndex: 2,
  },
  selectedButton:   { backgroundColor: 'transparent' },
  unselectedButton: { backgroundColor: 'transparent' },
  buttonText: {
    color: 'rgb(0,0,0)',
    fontSize: 16,
    fontFamily: 'SFUIDisplay-Medium',
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    height: 46,
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    borderRadius: 23,
    zIndex: 0,
    padding: 1,
  },
  overlayInner: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 23,
  },
  inputsContainer: { backgroundColor: 'transparent' },
  inputWrapper:    { marginBottom: 10, backgroundColor: 'transparent' },
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
  lengthFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  lengthInputContainer: {
    flex: 1,
    width: undefined,
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
  lengthResetButtonShell: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    padding: 1,
  },
  lengthResetButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
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
  readonlyText: {
    lineHeight: 50,
    marginTop: 0,
  },
  pickerPressable: {
    experimental_backgroundImage:
      'linear-gradient(to bottom right, rgb(235, 235, 235) 25%, rgb(190, 190, 190), rgb(223, 223, 223) 80%)',
    height: 50,
    overflow: 'hidden',
    borderRadius: 25,
    padding: 1,
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
  separator2: {
    height: 1,
    backgroundColor: 'rgb(235, 235, 235)',
    marginBottom: 10,
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
  text: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
  },
  textOptions: {
    fontFamily: 'SFUIDisplay-Regular',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
    flex: 1,
  },
  icon: { marginLeft: 'auto' },
  // ── Cards ─────────────────────────────────────────────────────────────────────
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
    marginLeft: 10,
    marginBottom: 8,
  },
  // ── Dot de color del elemento — tamaño modificable aquí ───────────────────────
  nodeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 8,
    marginRight: 8,
  },
  // ── Fila Desde / Hasta (conexiones) ───────────────────────────────────────────
  fromToRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  // ── Botón añadir ──────────────────────────────────────────────────────────────
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
  addButtonLabel: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 14,
  },
  // ── Teclado custom ────────────────────────────────────────────────────────────
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
  iconWrapperRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    marginHorizontal: 0,
  },
  iconContainerRound: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  // ── Modal de tabla en landscape ───────────────────────────────────────────────
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
  // ── Botón "Ver más" de tablas ─────────────────────────────────────────────────
  expandButton: {
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 1,
  },
  // ── Celdas de tabla ───────────────────────────────────────────────────────────
  tableContainer: {
    borderWidth: 0,
    marginTop: 0,
    marginBottom: 8,
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
  innerWhiteContainer2Compact: {
    backgroundColor: 'white',
    height: '100%',
    justifyContent: 'center',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Padding horizontal reducido y equilibrado
    minWidth: 100, // Ancho mínimo reducido
  },
  textCompact: {
    fontFamily: 'SFUIDisplay-Medium',
    fontSize: 16,
    color: 'rgba(0, 0, 0, 1)',
    marginTop: 2.75,
    marginRight: 2,
  },
});

export default AxisScreen;