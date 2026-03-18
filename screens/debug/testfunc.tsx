import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Modal, FlatList,
} from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { KeyboardProvider } from '../../contexts/KeyboardContext';

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
type Tab      = 'nodos' | 'reservorio' | 'tanque' | 'tuberias';
type TipoNodo = 'nodo'  | 'reservorio' | 'tanque';

interface Punto {
  uid: string; tipo: TipoNodo; colorHex: number;
  id: string; x: string; y: string; z: string;
  demanda?:  string;
  nivelIni?: string; diametro?: string; volumen?: string;
}

interface Tuberia {
  uid: string; tubId: string;
  fromId: string; toId: string;
  longitud: string; diametro: string; rugosidad: string;
}

/* ══════════════════════════════════════════════
   COLORES — idéntico al original
══════════════════════════════════════════════ */
const COLORES: Record<TipoNodo, number[]> = {
  nodo:       [0xe67e22, 0xe74c3c, 0xf39c12, 0xd35400, 0xc0392b, 0x9b59b6],
  reservorio: [0x2980b9, 0x1a5276, 0x3498db, 0x154360, 0x1f618d, 0x2e86c1],
  tanque:     [0x27ae60, 0x1e8449, 0x2ecc71, 0x117a65, 0x0e6655, 0x229954],
};
const colorIdx = { nodo: 0, reservorio: 0, tanque: 0 };
const hexStr   = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

let _uidCtr = 0;
const nextUid = () => `u${++_uidCtr}`;

/* ══════════════════════════════════════════════
   HTML — Espacio Cartesiano 3D (WebView)
   FIX ZOOM:
     • enablePan = false  → target no se desplaza con pan
     • minDistance = 0.5  → no atraviesa el origen
     • target siempre actualizado al centroide
   PROTOCOLO:
     RN → WebView : injectJavaScript("window.rnCmd({...})")
     WebView → RN : ReactNativeWebView.postMessage(JSON)
══════════════════════════════════════════════ */
const HTML3D = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#fff}
    #c{width:100%;height:100%}
  </style>
</head>
<body>
<div id="c"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
(function(){
  var BASE_LEN    = 10000;
  var PUNTO_R     = 0.05;
  var TEXTO_ESC   = 0.2;
  var CONN_CONE_R = 0.035, CONN_CONE_H = 0.14, CONN_COLOR = 0x444444;
  var FLECHA_R    = 0.04,  FLECHA_T = 0.3, LINE_R = 0.5;

  /* Escena */
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  var container = document.getElementById('c');
  var W = container.clientWidth  || window.innerWidth;
  var H = container.clientHeight || window.innerHeight;
  var renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H);
  container.appendChild(renderer.domElement);

  /* Camara */
  var perspCam = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
  perspCam.position.set(6, 4, 8);
  perspCam.lookAt(0, 0, 0);
  var initDist = perspCam.position.distanceTo(new THREE.Vector3());
  var TAN_HALF = Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2));
  var activeCamera = perspCam;

  /* OrbitControls — FIX ZOOM */
  var controls = new THREE.OrbitControls(perspCam, renderer.domElement);
  controls.enableDamping      = true;
  controls.dampingFactor      = 0.05;
  controls.enableZoom         = true;
  controls.enableRotate       = true;
  controls.enablePan          = false;   /* FIX: sin pan → target no deriva */
  controls.minDistance        = 0.5;     /* FIX: no atraviesa el origen     */
  controls.screenSpacePanning = false;
  controls.target.set(0, 0, 0);
  controls.update();

  /* Luces */
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  var dl = new THREE.DirectionalLight(0xffffff, 0.7);
  dl.position.set(1, 2, 1); scene.add(dl);

  /* Helpers */
  function effectiveDist() {
    return activeCamera.position.distanceTo(new THREE.Vector3());
  }
  function logicToThree(xl, yl, zl) {
    return new THREE.Vector3(isNaN(yl)?0:yl, isNaN(zl)?0:zl, isNaN(xl)?0:xl);
  }

  /* Grilla dinamica */
  var gridXZ = null, curStep = 0;
  function updateGrid() {
    var dist = effectiveDist();
    var s = Math.pow(10, Math.floor(Math.log10(Math.max(dist, 0.1) / 5)));
    if (s < 1) s = 1;
    if (s !== curStep) {
      if (gridXZ) scene.remove(gridXZ);
      var div = 100, sz = div * s;
      gridXZ = new THREE.GridHelper(sz, div, 0x888888, 0xcccccc);
      gridXZ.material.opacity = 0.3; gridXZ.material.transparent = true; gridXZ.renderOrder = 0;
      scene.add(gridXZ);
      activeCamera.far = sz * 10; activeCamera.updateProjectionMatrix();
      curStep = s;
    }
  }

  /* Ejes identicos al original */
  function mkEje(color, dir) {
    var g = new THREE.Group(), L = BASE_LEN;
    var mat = new THREE.MeshPhongMaterial({color:color, shininess:40, depthTest:false});
    var r = LINE_R * 0.03;
    var cil = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
    cil.name = 'cil'; cil.renderOrder = 1;
    if (dir==='x') { cil.rotation.z=-Math.PI/2; cil.position.set(L/2,0,0); }
    else if (dir==='y') { cil.position.set(0,L/2,0); }
    else { cil.rotation.x=Math.PI/2; cil.position.set(0,0,L/2); }
    g.add(cil);
    var rc = FLECHA_R*2, ac = FLECHA_T*2;
    var cono = new THREE.Mesh(new THREE.ConeGeometry(rc, ac, 12), mat);
    cono.name = 'cono'; cono.renderOrder = 1;
    if (dir==='x') { cono.rotation.z=-Math.PI/2; cono.position.set(L-ac/2,0,0); }
    else if (dir==='y') { cono.position.set(0,L-ac/2,0); }
    else { cono.rotation.x=Math.PI/2; cono.position.set(0,0,L-ac/2); }
    g.add(cono); return g;
  }
  function mkNegLine(color, pA, pB) {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pA[0],pA[1],pA[2]),
        new THREE.Vector3(pB[0],pB[1],pB[2])
      ]),
      new THREE.LineBasicMaterial({color:color})
    );
  }
  var ejeX = mkEje(0xff3333,'z'); scene.add(ejeX);
  var ejeY = mkEje(0x3366ff,'x'); scene.add(ejeY);
  var ejeZ = mkEje(0x33ff33,'y'); scene.add(ejeZ);
  var negX = mkNegLine(0xffaaaa,[0,0,-BASE_LEN],[0,0,0]); scene.add(negX);
  var negY = mkNegLine(0xaaaaff,[-BASE_LEN,0,0],[0,0,0]); scene.add(negY);
  var negZ = mkNegLine(0xaaffaa,[0,-BASE_LEN,0],[0,0,0]); scene.add(negZ);
  var origen = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16),
    new THREE.MeshPhongMaterial({color:0x111111, shininess:80, depthTest:false})
  );
  origen.renderOrder = 2; scene.add(origen);

  function updAxis(g, dir, l, r) {
    var cil=g.getObjectByName('cil'), cono=g.getObjectByName('cono');
    cil.scale.set(r,l,r); cono.scale.set(r,l,r);
    var L=BASE_LEN*l, a=FLECHA_T*2*l;
    if (dir==='x') { cil.position.set(L/2,0,0); cono.position.set(L-a/2,0,0); }
    else if (dir==='y') { cil.position.set(0,L/2,0); cono.position.set(0,L-a/2,0); }
    else { cil.position.set(0,0,L/2); cono.position.set(0,0,L-a/2); }
  }
  function updNeg(line, dir, l) {
    var L=BASE_LEN*l, ax=0, ay=0, az=0;
    if (dir==='x') ax=-L; else if (dir==='y') ay=-L; else az=-L;
    var p = line.geometry.attributes.position.array;
    p[0]=ax; p[1]=ay; p[2]=az; p[3]=0; p[4]=0; p[5]=0;
    line.geometry.attributes.position.needsUpdate = true;
  }

  /* Datos internos */
  var puntosMap = {};
  var tubeMap   = {};
  var _up    = new THREE.Vector3(0,1,0);
  var _quat  = new THREE.Quaternion();

  /* Centroide → actualiza target de controls (FIX ZOOM) */
  function updateTarget() {
    var entries = Object.values(puntosMap);
    if (!entries.length) { controls.target.set(0,0,0); controls.update(); return; }
    var cx=0, cy=0, cz=0;
    entries.forEach(function(e){ cx+=e.mesh.position.x; cy+=e.mesh.position.y; cz+=e.mesh.position.z; });
    var n = entries.length;
    controls.target.set(cx/n, cy/n, cz/n); controls.update();
  }

  /* Label Sprite */
  function mkLabel(texto, colorHex) {
    var FS=32, c=document.createElement('canvas'), ctx=c.getContext('2d');
    ctx.font='bold '+FS+'px system-ui,sans-serif';
    var tw=ctx.measureText(texto).width, pad=FS*0.4;
    c.width=tw+pad*2; c.height=FS+pad;
    ctx.font='bold '+FS+'px system-ui,sans-serif';
    var r=c.height*0.3;
    ctx.fillStyle='#'+colorHex.toString(16).padStart(6,'0');
    ctx.beginPath(); ctx.moveTo(r,0); ctx.lineTo(c.width-r,0);
    ctx.quadraticCurveTo(c.width,0,c.width,r);
    ctx.lineTo(c.width,c.height-r); ctx.quadraticCurveTo(c.width,c.height,c.width-r,c.height);
    ctx.lineTo(r,c.height); ctx.quadraticCurveTo(0,c.height,0,c.height-r);
    ctx.lineTo(0,r); ctx.quadraticCurveTo(0,0,r,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff'; ctx.textBaseline='middle'; ctx.fillText(texto,pad,c.height*0.52);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(c), depthTest:false, transparent:true, sizeAttenuation:true
    }));
    sp.renderOrder=4; sp.scale.set((c.width/c.height)*TEXTO_ESC, TEXTO_ESC, 1);
    return sp;
  }
  function setLabelPos(e, rs) {
    if (!e.label||!e.mesh) return;
    e.label.position.copy(e.mesh.position);
    e.label.position.y += PUNTO_R * 3.5 * (rs||1);
  }

  /* CRUD Puntos */
  function addPoint(uid, colorHex, id, x, y, z) {
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(PUNTO_R, 16, 16),
      new THREE.MeshPhongMaterial({color:colorHex, shininess:60, depthTest:false, transparent:true, opacity:1})
    );
    mesh.renderOrder = 3;
    mesh.position.copy(logicToThree(x, y, z));
    scene.add(mesh);
    var label = id ? mkLabel(id, colorHex) : null;
    if (label) scene.add(label);
    puntosMap[uid] = {uid, mesh, label, colorHex, id};
    setLabelPos(puntosMap[uid]);
    updateTarget();
  }
  function updatePoint(uid, id, x, y, z) {
    var e = puntosMap[uid]; if (!e) return;
    e.id = id;
    e.mesh.position.copy(logicToThree(x, y, z));
    if (e.label) { scene.remove(e.label); e.label.material.map.dispose(); e.label.material.dispose(); e.label=null; }
    if (id) { var lbl=mkLabel(id, e.colorHex); scene.add(lbl); e.label=lbl; }
    setLabelPos(e);
    updateTarget();
    Object.keys(tubeMap).forEach(function(k){ refreshPipe(k); });
  }
  function removePoint(uid) {
    var e = puntosMap[uid]; if (!e) return;
    scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose();
    if (e.label) { scene.remove(e.label); e.label.material.map.dispose(); e.label.material.dispose(); }
    delete puntosMap[uid];
    updateTarget();
  }

  /* CRUD Tuberias */
  function addPipe(uid) {
    var g = new THREE.Group();
    var lm = new THREE.LineBasicMaterial({color:CONN_COLOR, depthTest:false, transparent:true, opacity:0.7});
    var lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1,0,0)]);
    var line = new THREE.Line(lg, lm); line.name='ln'; line.renderOrder=2; g.add(line);
    var cm = new THREE.MeshPhongMaterial({color:CONN_COLOR, shininess:50, depthTest:false});
    var cone = new THREE.Mesh(new THREE.ConeGeometry(CONN_CONE_R, CONN_CONE_H, 12), cm);
    cone.name='cn'; cone.renderOrder=3; g.add(cone);
    g.visible = false; scene.add(g);
    tubeMap[uid] = {uid, group:g, fromUid:'', toUid:''};
  }
  function refreshPipe(uid) {
    var t = tubeMap[uid]; if (!t) return;
    var fromE = puntosMap[t.fromUid], toE = puntosMap[t.toUid];
    if (!fromE||!toE) { t.group.visible=false; return; }
    var posA=fromE.mesh.position, posB=toE.mesh.position;
    var d = posA.distanceTo(posB);
    if (d < 1e-6) { t.group.visible=false; return; }
    t.group.visible = true;
    var line = t.group.getObjectByName('ln');
    var pa = line.geometry.attributes.position.array;
    pa[0]=posA.x;pa[1]=posA.y;pa[2]=posA.z; pa[3]=posB.x;pa[4]=posB.y;pa[5]=posB.z;
    line.geometry.attributes.position.needsUpdate = true;
    var cone = t.group.getObjectByName('cn');
    var mid = new THREE.Vector3().addVectors(posA,posB).multiplyScalar(0.5);
    var dir = new THREE.Vector3().subVectors(posB,posA).normalize();
    var rs = effectiveDist() / initDist;
    cone.position.copy(mid); cone.scale.set(rs,rs,rs);
    if (Math.abs(dir.dot(_up))>0.9999) { cone.quaternion.set(dir.y<0?1:0,0,0,dir.y<0?0:1); }
    else { _quat.setFromUnitVectors(_up,dir); cone.quaternion.copy(_quat); }
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'PIPE_LEN', uid:uid, len:d.toFixed(2)}));
    }
  }
  function updatePipeEndpoints(uid, fromUid, toUid) {
    var t = tubeMap[uid]; if (!t) return;
    t.fromUid = fromUid; t.toUid = toUid;
    refreshPipe(uid);
  }
  function removePipe(uid) {
    var t = tubeMap[uid]; if (!t) return;
    scene.remove(t.group);
    t.group.children.forEach(function(c){ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); });
    delete tubeMap[uid];
  }

  /* Receptor de comandos desde React Native */
  window.rnCmd = function(cmd) {
    switch (cmd.type) {
      case 'ADD_PT': addPoint(cmd.uid, cmd.color, cmd.id, cmd.x, cmd.y, cmd.z); break;
      case 'UPD_PT': updatePoint(cmd.uid, cmd.id, cmd.x, cmd.y, cmd.z); break;
      case 'REM_PT': removePoint(cmd.uid); break;
      case 'ADD_TB': addPipe(cmd.uid); break;
      case 'UPD_TB': updatePipeEndpoints(cmd.uid, cmd.fromUid, cmd.toUid); break;
      case 'REM_TB': removePipe(cmd.uid); break;
    }
  };

  updateGrid();

  /* Loop animacion */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    var dist = effectiveDist();
    var rs = dist / initDist, ls = Math.max(1, rs);
    updAxis(ejeX,'z',ls,rs); updAxis(ejeY,'x',ls,rs); updAxis(ejeZ,'y',ls,rs);
    updNeg(negX,'z',ls);     updNeg(negY,'x',ls);     updNeg(negZ,'y',ls);
    origen.scale.set(rs,rs,rs);
    Object.values(puntosMap).forEach(function(e){
      if (e.mesh) e.mesh.scale.set(rs,rs,rs);
      if (e.label) {
        var img = e.label.material.map.image;
        e.label.scale.set((img.width/img.height)*TEXTO_ESC*rs, TEXTO_ESC*rs, 1);
        setLabelPos(e, rs);
      }
    });
    Object.keys(tubeMap).forEach(function(k){ refreshPipe(k); });
    updateGrid();
    renderer.render(scene, activeCamera);
  }
  animate();

  /* Resize */
  window.addEventListener('resize', function() {
    var nw=container.clientWidth||window.innerWidth;
    var nh=container.clientHeight||window.innerHeight;
    perspCam.aspect = nw/nh; perspCam.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
})();
</script>
</body>
</html>`;

/* ══════════════════════════════════════════════
   SUB-COMPONENTE: Input numerico compacto
══════════════════════════════════════════════ */
interface NumInputProps {
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  readonly?: boolean;
  width?: number;
}
const NumInput = ({ value, onChangeText, placeholder, readonly = false, width = 44 }: NumInputProps) => (
  <TextInput
    style={[styles.numInput, { width }, readonly && styles.numInputReadonly]}
    value={value}
    onChangeText={readonly ? undefined : onChangeText}
    placeholder={placeholder ?? ''}
    placeholderTextColor="#bbb"
    keyboardType="numeric"
    editable={!readonly}
    selectTextOnFocus={!readonly}
  />
);

/* ══════════════════════════════════════════════
   SUB-COMPONENTE: Selector de ID con modal
══════════════════════════════════════════════ */
interface IdSelectorProps {
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  width?: number;
}
const IdSelector = ({ value, options, onSelect, width = 52 }: IdSelectorProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[styles.idSelector, { width }]} onPress={() => setOpen(true)}>
        <Text style={styles.idSelectorText} numberOfLines={1}>{value || '—'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalBox}>
            <FlatList
              data={['—', ...options]}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => { onSelect(item === '—' ? '' : item); setOpen(false); }}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

/* ══════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════ */
const TestFunc = () => {
  const wvRef = useRef<WebView>(null);
  const [tab,      setTab]      = useState<Tab>('nodos');
  const [puntos,   setPuntos]   = useState<Punto[]>([]);
  const [tuberias, setTuberias] = useState<Tuberia[]>([]);

  /* ── Enviar comando al WebView ── */
  const send = useCallback((cmd: object) => {
    wvRef.current?.injectJavaScript(`window.rnCmd(${JSON.stringify(cmd)}); true;`);
  }, []);

  /* ── Recibir mensajes del WebView ── */
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'PIPE_LEN') {
        setTuberias(prev =>
          prev.map(t => t.uid === msg.uid ? { ...t, longitud: String(msg.len) } : t)
        );
      }
    } catch {}
  }, []);

  /* ── IDs disponibles para dropdowns de tuberías ── */
  const allIds = puntos.map(p => p.id).filter(Boolean);

  /* ═══ OPERACIONES SOBRE PUNTOS ═══ */
  const addPunto = useCallback((tipo: TipoNodo) => {
    const hex    = COLORES[tipo][colorIdx[tipo] % COLORES[tipo].length];
    colorIdx[tipo]++;
    const prefix = tipo === 'nodo' ? 'N' : tipo === 'reservorio' ? 'Rs' : 'T';
    const usado  = new Set(puntos.filter(p => p.tipo === tipo).map(p => p.id));
    let n = 1; while (usado.has(prefix + n)) n++;
    const p: Punto = {
      uid: nextUid(), tipo, colorHex: hex,
      id: prefix + n, x: '', y: '', z: '',
      ...(tipo === 'nodo'   ? { demanda: '' }                                : {}),
      ...(tipo === 'tanque' ? { nivelIni: '', diametro: '', volumen: '' }    : {}),
    };
    setPuntos(prev => [...prev, p]);
    send({ type: 'ADD_PT', uid: p.uid, color: hex, id: p.id, x: 0, y: 0, z: 0 });
  }, [puntos, send]);

  const updPunto = useCallback((pUid: string, changes: Partial<Punto>) => {
    setPuntos(prev => {
      const next = prev.map(p => p.uid === pUid ? { ...p, ...changes } : p);
      const p    = next.find(p => p.uid === pUid);
      if (p) {
        send({
          type: 'UPD_PT', uid: p.uid, id: p.id,
          x: parseFloat(p.x) || 0,
          y: parseFloat(p.y) || 0,
          z: parseFloat(p.z) || 0,
        });
      }
      return next;
    });
  }, [send]);

  const remPunto = useCallback((pUid: string) => {
    const removed = puntos.find(p => p.uid === pUid);
    setPuntos(prev => prev.filter(p => p.uid !== pUid));
    if (removed) {
      setTuberias(prev => prev.map(t => ({
        ...t,
        fromId: t.fromId === removed.id ? '' : t.fromId,
        toId:   t.toId   === removed.id ? '' : t.toId,
      })));
    }
    send({ type: 'REM_PT', uid: pUid });
  }, [puntos, send]);

  /* ═══ OPERACIONES SOBRE TUBERÍAS ═══ */
  const addTuberia = useCallback(() => {
    const usado = new Set(tuberias.map(t => t.tubId));
    let n = 1; while (usado.has('P' + n)) n++;
    const t: Tuberia = {
      uid: nextUid(), tubId: 'P' + n,
      fromId: '', toId: '', longitud: '', diametro: '', rugosidad: '',
    };
    setTuberias(prev => [...prev, t]);
    send({ type: 'ADD_TB', uid: t.uid });
  }, [tuberias, send]);

  const updTuberia = useCallback((tUid: string, changes: Partial<Tuberia>) => {
    setTuberias(prev => {
      const next = prev.map(t => t.uid === tUid ? { ...t, ...changes } : t);
      const t    = next.find(t => t.uid === tUid);
      if (t) {
        const fromPunto = puntos.find(p => p.id === t.fromId);
        const toPunto   = puntos.find(p => p.id === t.toId);
        send({
          type: 'UPD_TB', uid: t.uid,
          fromUid: fromPunto?.uid ?? '',
          toUid:   toPunto?.uid   ?? '',
        });
      }
      return next;
    });
  }, [puntos, send]);

  const remTuberia = useCallback((tUid: string) => {
    setTuberias(prev => prev.filter(t => t.uid !== tUid));
    send({ type: 'REM_TB', uid: tUid });
  }, [send]);

  const swapTuberia = useCallback((tUid: string) => {
    setTuberias(prev => {
      const next = prev.map(t =>
        t.uid === tUid ? { ...t, fromId: t.toId, toId: t.fromId } : t
      );
      const t = next.find(t => t.uid === tUid);
      if (t) {
        const fromPunto = puntos.find(p => p.id === t.fromId);
        const toPunto   = puntos.find(p => p.id === t.toId);
        send({ type: 'UPD_TB', uid: t.uid, fromUid: fromPunto?.uid ?? '', toUid: toPunto?.uid ?? '' });
      }
      return next;
    });
  }, [puntos, send]);

  /* ═══ RENDER DE ENCABEZADOS DE TABLA ═══ */
  const renderHeader = () => {
    if (tab === 'nodos') return (
      <View style={styles.headerRow}>
        <View style={styles.hDot} />
        <Text style={[styles.hCell, { width: 46 }]}>ID</Text>
        <Text style={[styles.hCell, { width: 46 }]}>X(m)</Text>
        <Text style={[styles.hCell, { width: 46 }]}>Y(m)</Text>
        <Text style={[styles.hCell, { width: 54 }]}>Elev.(m)</Text>
        <Text style={[styles.hCell, { width: 54 }]}>Dem.(l/s)</Text>
        <View style={styles.hRm} />
      </View>
    );
    if (tab === 'reservorio') return (
      <View style={styles.headerRow}>
        <View style={styles.hDot} />
        <Text style={[styles.hCell, { width: 46 }]}>ID</Text>
        <Text style={[styles.hCell, { width: 46 }]}>X(m)</Text>
        <Text style={[styles.hCell, { width: 46 }]}>Y(m)</Text>
        <Text style={[styles.hCell, { width: 54 }]}>Ht(m)</Text>
        <View style={styles.hRm} />
      </View>
    );
    if (tab === 'tanque') return (
      <View style={styles.headerRow}>
        <View style={styles.hDot} />
        <Text style={[styles.hCell, { width: 40 }]}>ID</Text>
        <Text style={[styles.hCell, { width: 42 }]}>X</Text>
        <Text style={[styles.hCell, { width: 42 }]}>Y</Text>
        <Text style={[styles.hCell, { width: 48 }]}>Elev.</Text>
        <Text style={[styles.hCell, { width: 48 }]}>Niv.Ini</Text>
        <Text style={[styles.hCell, { width: 54 }]}>Diám(mm)</Text>
        <Text style={[styles.hCell, { width: 48 }]}>Vol(m³)</Text>
        <View style={styles.hRm} />
      </View>
    );
    return (
      <View style={styles.headerRow}>
        <Text style={[styles.hCell, { width: 34 }]}>ID</Text>
        <Text style={[styles.hCell, { width: 54 }]}>Desde</Text>
        <Text style={[styles.hCell, { width: 18 }]}> </Text>
        <Text style={[styles.hCell, { width: 54 }]}>Hasta</Text>
        <Text style={[styles.hCell, { width: 26 }]}> </Text>
        <Text style={[styles.hCell, { width: 52 }]}>Long.(m)</Text>
        <Text style={[styles.hCell, { width: 52 }]}>Diám(mm)</Text>
        <Text style={[styles.hCell, { width: 48 }]}>Rug.(mm)</Text>
        <View style={styles.hRm} />
      </View>
    );
  };

  /* ═══ RENDER DE FILAS ═══ */
  const renderNodoRow = (p: Punto) => (
    <View key={p.uid} style={styles.dataRow}>
      <View style={[styles.dotCell, { backgroundColor: hexStr(p.colorHex) }]} />
      <TextInput
        style={[styles.numInput, { width: 46 }]}
        value={p.id}
        onChangeText={v => updPunto(p.uid, { id: v })}
        placeholder="ID"
        placeholderTextColor="#bbb"
        autoCapitalize="none"
      />
      <NumInput value={p.x}            width={46} placeholder="X"    onChangeText={v => updPunto(p.uid, { x: v })} />
      <NumInput value={p.y}            width={46} placeholder="Y"    onChangeText={v => updPunto(p.uid, { y: v })} />
      <NumInput value={p.z}            width={54} placeholder="Elev" onChangeText={v => updPunto(p.uid, { z: v })} />
      <NumInput value={p.demanda ?? ''} width={54} placeholder="—"   onChangeText={v => updPunto(p.uid, { demanda: v })} />
      <TouchableOpacity style={styles.rmBtn} onPress={() => remPunto(p.uid)}>
        <Text style={styles.rmBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReservRow = (p: Punto) => (
    <View key={p.uid} style={styles.dataRow}>
      <View style={[styles.dotCell, { backgroundColor: hexStr(p.colorHex) }]} />
      <TextInput
        style={[styles.numInput, { width: 46 }]}
        value={p.id}
        onChangeText={v => updPunto(p.uid, { id: v })}
        placeholder="ID"
        placeholderTextColor="#bbb"
        autoCapitalize="none"
      />
      <NumInput value={p.x} width={46} placeholder="X"  onChangeText={v => updPunto(p.uid, { x: v })} />
      <NumInput value={p.y} width={46} placeholder="Y"  onChangeText={v => updPunto(p.uid, { y: v })} />
      <NumInput value={p.z} width={54} placeholder="Ht" onChangeText={v => updPunto(p.uid, { z: v })} />
      <TouchableOpacity style={styles.rmBtn} onPress={() => remPunto(p.uid)}>
        <Text style={styles.rmBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTanqueRow = (p: Punto) => (
    <View key={p.uid} style={styles.dataRow}>
      <View style={[styles.dotCell, { backgroundColor: hexStr(p.colorHex) }]} />
      <TextInput
        style={[styles.numInput, { width: 40 }]}
        value={p.id}
        onChangeText={v => updPunto(p.uid, { id: v })}
        placeholder="ID"
        placeholderTextColor="#bbb"
        autoCapitalize="none"
      />
      <NumInput value={p.x}             width={42} placeholder="X"    onChangeText={v => updPunto(p.uid, { x: v })} />
      <NumInput value={p.y}             width={42} placeholder="Y"    onChangeText={v => updPunto(p.uid, { y: v })} />
      <NumInput value={p.z}             width={48} placeholder="Elev" onChangeText={v => updPunto(p.uid, { z: v })} />
      <NumInput value={p.nivelIni ?? ''} width={48} placeholder="Niv" onChangeText={v => updPunto(p.uid, { nivelIni: v })} />
      <NumInput value={p.diametro ?? ''} width={54} placeholder="Diám" onChangeText={v => updPunto(p.uid, { diametro: v })} />
      <NumInput value={p.volumen  ?? ''} width={48} placeholder="Vol"  onChangeText={v => updPunto(p.uid, { volumen: v })} />
      <TouchableOpacity style={styles.rmBtn} onPress={() => remPunto(p.uid)}>
        <Text style={styles.rmBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTuberiaRow = (t: Tuberia) => (
    <View key={t.uid} style={styles.dataRow}>
      <Text style={styles.tubIdLabel}>{t.tubId}</Text>
      <IdSelector value={t.fromId} options={allIds} width={54} onSelect={v => updTuberia(t.uid, { fromId: v })} />
      <Text style={styles.arrowSep}>⭢</Text>
      <IdSelector value={t.toId}   options={allIds} width={54} onSelect={v => updTuberia(t.uid, { toId: v })} />
      <TouchableOpacity style={styles.swapBtn} onPress={() => swapTuberia(t.uid)} title="Invertir sentido">
        <Text style={styles.swapBtnText}>⇄</Text>
      </TouchableOpacity>
      <NumInput value={t.longitud}  width={52} readonly placeholder="—" />
      <NumInput value={t.diametro}  width={52} placeholder="Diám" onChangeText={v => updTuberia(t.uid, { diametro: v })} />
      <NumInput value={t.rugosidad} width={48} placeholder="Rug"  onChangeText={v => updTuberia(t.uid, { rugosidad: v })} />
      <TouchableOpacity style={styles.rmBtn} onPress={() => remTuberia(t.uid)}>
        <Text style={styles.rmBtnText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  /* Datos de la pestaña activa */
  type AnyRow = Punto | Tuberia;
  const tabData: AnyRow[] =
    tab === 'nodos'      ? puntos.filter(p => p.tipo === 'nodo')       :
    tab === 'reservorio' ? puntos.filter(p => p.tipo === 'reservorio') :
    tab === 'tanque'     ? puntos.filter(p => p.tipo === 'tanque')     :
    tuberias;

  const renderRow = (item: AnyRow) =>
    tab === 'nodos'      ? renderNodoRow(item as Punto)     :
    tab === 'reservorio' ? renderReservRow(item as Punto)   :
    tab === 'tanque'     ? renderTanqueRow(item as Punto)   :
    renderTuberiaRow(item as Tuberia);

  const addLabel =
    tab === 'nodos'      ? '+ Agregar nodo'       :
    tab === 'reservorio' ? '+ Agregar reservorio' :
    tab === 'tanque'     ? '+ Agregar tanque'      :
    '+ Agregar tubería';

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <KeyboardProvider>
      <View style={styles.root}>

        {/* ── Contenedor 1:1 con padding superior ── */}
        <View style={styles.canvasWrapper}>
          <WebView
            ref={wvRef}
            source={{ html: HTML3D }}
            style={styles.webview}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            mixedContentMode="always"
            onMessage={onMessage}
          />
        </View>

        {/* ── Menú nativo con pestañas ── */}
        <View style={styles.menu}>

          {/* Pestañas */}
          <View style={styles.tabs}>
            {(['nodos', 'reservorio', 'tanque', 'tuberias'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'nodos'      ? 'Nodos'      :
                   t === 'reservorio' ? 'Reservorio' :
                   t === 'tanque'     ? 'Tanque'     : 'Tuberías'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Encabezado de columnas (scroll horizontal sincronizado) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.headerScroll}
            scrollEnabled={false}
          >
            {renderHeader()}
          </ScrollView>

          {/* Filas (scroll vertical + horizontal) */}
          <ScrollView style={styles.rowsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {tabData.map(item => renderRow(item))}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Botón agregar */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if      (tab === 'nodos')      addPunto('nodo');
              else if (tab === 'reservorio') addPunto('reservorio');
              else if (tab === 'tanque')     addPunto('tanque');
              else                           addTuberia();
            }}
          >
            <Text style={styles.addBtnText}>{addLabel}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </KeyboardProvider>
  );
};

/* ══════════════════════════════════════════════
   ESTILOS
══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  /* Contenedor 1:1 + padding top */
  canvasWrapper: {
    width: '100%',
    aspectRatio: 1,
    paddingTop: 0,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  /* Menú */
  menu: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    minHeight: 250,
  },

  /* Pestañas */
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#444',
  },
  tabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
  },
  tabTextActive: {
    color: '#111',
  },

  /* Encabezado */
  headerScroll: {
    maxHeight: 26,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hDot: { width: 16, marginRight: 4 },
  hRm:  { width: 26 },
  hCell: {
    fontSize: 9,
    fontWeight: '700',
    color: '#aaa',
    textAlign: 'center',
    marginHorizontal: 2,
  },

  /* Filas */
  rowsScroll: {
    flex: 1,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  /* Dot color */
  dotCell: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  /* Inputs */
  numInput: {
    height: 26,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    fontSize: 10,
    color: '#111',
    backgroundColor: '#fafafa',
    textAlign: 'center',
    marginHorizontal: 2,
  },
  numInputReadonly: {
    backgroundColor: '#f3f3f3',
    color: '#888',
    borderColor: '#e0e0e0',
  },

  /* Selector ID */
  idSelector: {
    height: 26,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  idSelectorText: {
    fontSize: 10,
    color: '#333',
  },

  /* Tubería extras */
  arrowSep: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 2,
  },
  swapBtn: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  swapBtnText: {
    fontSize: 11,
    color: '#666',
  },
  tubIdLabel: {
    width: 34,
    fontSize: 9,
    fontWeight: '700',
    color: '#555',
    textAlign: 'center',
  },

  /* Botón eliminar */
  rmBtn: {
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  rmBtnText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 20,
  },

  /* Botón agregar */
  addBtn: {
    margin: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: 5,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 12,
    color: '#888',
  },

  /* Modal selector */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 160,
    maxHeight: 280,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  modalOption: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
});

export default TestFunc;