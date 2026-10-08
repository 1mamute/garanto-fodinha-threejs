import * as THREE from 'three';
import { COLORS, byId } from './game.js';

const TAU = Math.PI * 2;
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, ...options });
const wood = material('#80553c');
const dark = material('#233c37');
const white = material('#fff8e8');
const black = material('#162c29');
function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); parent.add(m); return m;
}
function sphere(parent, mat, radius, x, y, z, scale = [1, 1, 1]) {
  const m = mesh(new THREE.SphereGeometry(radius, 16, 12), mat, parent, x, y, z); m.scale.set(...scale); return m;
}
function tube(parent, points, mat, radius = .065) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 12, radius, 7, false), mat, parent);
}
const textures = new Map();
export function cardTexture(card, back = false) {
  const key = back ? 'back' : card.id;
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 360;
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff9e9'; c.fillRect(0, 0, 256, 360);
  c.strokeStyle = '#dccfb7'; c.lineWidth = 10; c.strokeRect(6, 6, 244, 348);
  if (back) {
    c.fillStyle = '#386c5c'; c.fillRect(15, 15, 226, 330);
    c.strokeStyle = '#a2c0a0'; c.lineWidth = 2;
    for (let i = -350; i < 500; i += 24) {
      c.beginPath(); c.moveTo(i, 15); c.lineTo(i + 330, 345); c.stroke();
      c.beginPath(); c.moveTo(i, 345); c.lineTo(i + 330, 15); c.stroke();
    }
    c.fillStyle = '#edc574'; c.beginPath(); c.arc(128, 180, 48, 0, TAU); c.fill();
    c.fillStyle = '#254e41'; c.font = 'bold 70px Georgia'; c.textAlign = 'center'; c.fillText('G', 128, 204);
  } else {
    c.fillStyle = ['♥', '♦'].includes(card.suit) ? '#bf5b4e' : '#253d36';
    c.font = 'bold 48px Georgia'; c.fillText(card.rank, 22, 58);
    c.font = '42px Georgia'; c.fillText(card.suit, 23, 103);
    c.save(); c.translate(256, 360); c.rotate(Math.PI); c.font = 'bold 48px Georgia'; c.fillText(card.rank, 22, 58);
    c.font = '42px Georgia'; c.fillText(card.suit, 23, 103); c.restore();
    c.textAlign = 'center'; c.font = '100px Georgia'; c.fillText(card.suit, 128, 216);
    c.font = 'bold 14px sans-serif'; c.fillStyle = '#a49b85'; c.fillText('G A R A N T O', 128, 283);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture); return texture;
}
const cardGeometry = new THREE.BoxGeometry(.42, .012, .59);
const edgeMaterial = material('#ded3ba');
function makeCard(card, parent, back = false) {
  const face = material('#ffffff', { map: cardTexture(card, back) });
  const reverse = material('#ffffff', { map: cardTexture(null, true) });
  const m = mesh(cardGeometry, [edgeMaterial, edgeMaterial, face, reverse, edgeMaterial, edgeMaterial], parent);
  m.userData.card = card; return m;
}
function labelTexture(text, color = '#f9edcc') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#1b342de6'; c.beginPath(); c.roundRect(0, 10, 512, 108, 30); c.fill();
  c.fillStyle = color; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 64, 470);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function robot(color) {
  const g = new THREE.Group(), bodyMat = material(color);
  const body = sphere(g, bodyMat, .49, 0, 1.25, 0, [.9, 1.12, .77]);
  mesh(new THREE.CylinderGeometry(.4, .44, .18, 18), bodyMat, g, 0, .93, 0);
  const head = new THREE.Group(); head.position.y = 1.96; g.add(head);
  sphere(head, bodyMat, .51, 0, 0, 0, [1.12, .8, .84]);
  const eyes = new THREE.Group(); head.add(eyes);
  for (const x of [-.2, .2]) {
    sphere(eyes, white, .165, x, .015, .36, [.9, 1.1, .5]);
    sphere(eyes, black, .075, x, .018, .435, [.85, 1.1, .38]);
  }
  // Off-center antenna and bolts give the little robots their own silhouette.
  mesh(new THREE.CylinderGeometry(.035, .035, .26, 8), dark, head, .25, .43, 0).rotation.z = -.35;
  sphere(head, material('#edc66e'), .08, .29, .58, 0);
  for (const x of [-.54, .54]) sphere(head, dark, .095, x, 0, 0, [.4, 1, 1]);
  const mouth = mesh(new THREE.BoxGeometry(.18, .035, .03), black, head, 0, -.22, .39); mouth.rotation.z = -.12;
  for (const x of [-.25, .25]) {
    mesh(new THREE.CylinderGeometry(.095, .11, .37, 8), dark, g, x, .58, .1).rotation.x = -.7;
    sphere(g, dark, .17, x, .35, .25, [1, .65, 1.5]);
  }
  const leftArm = new THREE.Group(), rightArm = new THREE.Group(); g.add(leftArm, rightArm);
  tube(leftArm, [[-.4, 1.5, 0], [-.75, 1.28, .12], [-.57, 1.28, .48]], dark);
  tube(rightArm, [[.4, 1.5, 0], [.74, 1.17, .13], [.53, 1.21, .55]], dark);
  for (const [arm, x] of [[leftArm, -.57], [rightArm, .53]]) {
    const glove = sphere(arm, white, .15, x, 1.28, .49, [1.1, .7, 1.1]);
    sphere(arm, white, .07, x + (x < 0 ? .12 : -.12), 1.29, .57);
    for (let i = 0; i < 3; i++) sphere(arm, white, .045, x - .07 + i * .06, 1.25, .62, [1, 1, 1.5]);
    glove.rotation.z = x < 0 ? -.4 : .4;
  }
  const hand = new THREE.Group(); hand.position.set(-.5, 1.35, .53); hand.rotation.x = .55; g.add(hand);
  g.userData = { body, head, eyes, rightArm, leftArm, hand, playedAt: -10, diedAt: null, seatAt: performance.now() / 1000 };
  return g;
}

export class TableScene {
  constructor(canvas, { onInspect, onPlay, onPose, onMode, onReorder }) {
    this.onInspect = onInspect; this.onPlay = onPlay; this.onPose = onPose; this.onMode = onMode; this.onReorder = onReorder;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 || matchMedia('(pointer:coarse)').matches ? 1.25 : 1.75));
    this.renderer.setClearColor('#dfd7bf'); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog('#d9d1bb', 17, 31);
    this.camera = new THREE.PerspectiveCamera(48, 1, .04, 60); this.scene.add(this.camera);
    this.cameraAim = new THREE.PerspectiveCamera();
    this.scene.add(new THREE.HemisphereLight('#fff3d1', '#647569', 2.5));
    const light = new THREE.DirectionalLight('#fff1cc', 3); light.position.set(3, 9, 5); this.scene.add(light);
    const rim = new THREE.DirectionalLight('#87bfb3', 1.3); rim.position.set(-5, 4, -5); this.scene.add(rim);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.robots = new Map(); this.cards = new Map(); this.chairs = new Map(); this.labels = new Map();
    this.poses = new Map(); this.keys = new Set(); this.mode = 'landing'; this.zoom = 13;
    this.yaw = 0; this.pitch = -.12; this.spectator = new THREE.Vector3(0, 2, 5.5); this.joystick = { x: 0, y: 0 };
    this.ray = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.pickables = [];
    this.lookTarget = new THREE.Vector3(); this.positionTarget = new THREE.Vector3(); this.upTarget = new THREE.Vector3(0, 1, 0);
    this.inspected = null; this.hover = null; this.clock = new THREE.Clock();
    this.buildRoom(); this.bind(canvas); this.resize();
    window.addEventListener('resize', () => this.resize());
    this.demo(); this.renderer.setAnimationLoop(() => this.frame());
  }
  buildRoom() {
    const floor = mesh(new THREE.CylinderGeometry(12, 12, .15, 64), material('#d3c7ad'), this.world, 0, -.1, 0);
    floor.rotation.y = Math.PI / 12;
    const rug = mesh(new THREE.CylinderGeometry(5.9, 5.9, .02, 64), material('#b5bba1'), this.world, 0, .005, 0);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(new THREE.TorusGeometry(5.3 + i * .2, .018, 5, 64), material('#d6d5b8'), this.world, 0, .025, 0);
      ring.rotation.x = Math.PI / 2;
    }
    const wall = mesh(new THREE.CylinderGeometry(12, 12, 6, 40, 1, true), material('#ded7c4', { side: THREE.BackSide }), this.world, 0, 2.8, 0);
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16;
      mesh(new THREE.BoxGeometry(.12, 2.9, .18), material('#c2b69a'), this.world, Math.sin(a) * 11.75, 1.4, Math.cos(a) * 11.75).rotation.y = a;
    }
    mesh(new THREE.CylinderGeometry(2.83, 2.83, .2, 64), wood, this.world, 0, 1.5, 0);
    mesh(new THREE.CylinderGeometry(2.65, 2.65, .035, 64), material('#386d55'), this.world, 0, 1.62, 0);
    const border = mesh(new THREE.TorusGeometry(2.68, .025, 8, 64), material('#d5b77a'), this.world, 0, 1.642, 0); border.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.35, .65, 1.45, 16), wood, this.world, 0, .73, 0);
    for (let i = 0; i < 4; i++) {
      const leg = mesh(new THREE.BoxGeometry(.23, .18, 2), wood, this.world, 0, .18, 0); leg.rotation.y = i * Math.PI / 2;
    }
    const tableLogo = labelTexture('G A R A N T O', '#9cbd91');
    const logo = mesh(new THREE.PlaneGeometry(1.3, .32), new THREE.MeshBasicMaterial({ map: tableLogo, transparent: true }), this.world, 0, 1.643, -.8);
    logo.rotation.x = -Math.PI / 2;
    const pot = new THREE.Group(); pot.position.set(-6, 0, -5); this.world.add(pot);
    mesh(new THREE.CylinderGeometry(.48, .32, .65, 12), material('#c38e67'), pot, 0, .33, 0);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const leaf = sphere(pot, material(i % 2 ? '#628269' : '#426f53'), .35, Math.sin(a) * .35, .9 + i * .17, Math.cos(a) * .35, [.55, 1.8, .4]);
      leaf.rotation.z = Math.sin(a) * .7;
    }
    this.spot = new THREE.Group(); this.world.add(this.spot);
    const beam = mesh(new THREE.ConeGeometry(.85, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff0ad', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }), this.spot, 0, 3.8, 0);
    const halo = mesh(new THREE.TorusGeometry(.62, .045, 8, 32), material('#f0ca74', { emissive: '#ce9f35', emissiveIntensity: .5 }), this.spot, 0, .04, 0); halo.rotation.x = Math.PI / 2;
    this.dealer = mesh(new THREE.CylinderGeometry(.19, .19, .045, 24), material('#fff2ce'), this.world);
    const dealerCanvas = document.createElement('canvas'); dealerCanvas.width = 128; dealerCanvas.height = 128;
    const dealerContext = dealerCanvas.getContext('2d'); dealerContext.fillStyle = '#fff2ce'; dealerContext.fillRect(0, 0, 128, 128);
    dealerContext.strokeStyle = '#b3964b'; dealerContext.lineWidth = 5; dealerContext.beginPath(); dealerContext.arc(64, 64, 57, 0, TAU); dealerContext.stroke();
    dealerContext.fillStyle = '#5f5f37'; dealerContext.font = 'bold 76px Georgia'; dealerContext.textAlign = 'center'; dealerContext.textBaseline = 'middle'; dealerContext.fillText('D', 64, 68);
    const dealerTexture = new THREE.CanvasTexture(dealerCanvas); dealerTexture.colorSpace = THREE.SRGBColorSpace;
    const dealerFace = mesh(new THREE.CircleGeometry(.185, 24), new THREE.MeshBasicMaterial({ map: dealerTexture }), this.dealer, 0, .023, 0);
    dealerFace.rotation.x = -Math.PI / 2;
    this.firstHands = new THREE.Group(); this.camera.add(this.firstHands);
    this.firstHands.position.set(-.23, -.54, -.95); this.firstHands.rotation.x = 1.25;
    tube(this.firstHands, [[-.3, -.05, .15], [-.22, 0, 0], [-.08, .04, -.1]], dark, .035);
    sphere(this.firstHands, white, .09, -.09, .025, -.08);
    this.firstHandCards = new THREE.Group(); this.firstHands.add(this.firstHandCards);
    this.rightGlove = new THREE.Group(); this.camera.add(this.rightGlove);
    this.rightGlove.position.set(.55, -.65, -1.05);
    sphere(this.rightGlove, white, .1, 0, 0, 0, [1.2, .65, 1.2]);
    tube(this.rightGlove, [[0, -.04, .1], [.12, -.15, .2], [.25, -.25, .3]], dark, .035);
    this.kickerCard = null;
  }
  chair(id, position, angle) {
    let g = this.chairs.get(id);
    if (!g) {
      g = new THREE.Group(); this.world.add(g); this.chairs.set(id, g);
      mesh(new THREE.BoxGeometry(.95, .15, .8), wood, g, 0, .78, 0);
      mesh(new THREE.BoxGeometry(.95, .75, .13), wood, g, 0, 1.28, -.39);
      for (const x of [-.36, .36]) for (const z of [-.29, .29]) mesh(new THREE.CylinderGeometry(.05, .06, .78, 7), wood, g, x, .39, z);
    }
    g.position.copy(position); g.rotation.y = angle; return g;
  }
  demo() {
    const names = ['Você', 'Pistache', 'Paçoca', 'Parafuso'];
    this.setState({ players: names.map((name, i) => ({ id: `demo-${i}`, name, color: COLORS[i], seated: true, lives: 5,
      hand: [{ id: 'A♠', rank: 'A', suit: '♠' }, { id: '7♥', rank: '7', suit: '♥' }], tricks: [] })),
      phase: 'lobby', dealer: 'demo-1', turn: 'demo-2', table: [
        { playerId: 'demo-1', playerName: 'Pistache', card: { id: '3♣', rank: '3', suit: '♣' } },
        { playerId: 'demo-2', playerName: 'Paçoca', card: { id: 'K♥', rank: 'K', suit: '♥' } }],
      kicker: { id: '6♦', rank: '6', suit: '♦' } }, null);
  }
  setState(state, myId) {
    if (this.drag?.object?.userData.hand) { this.pendingState = { state, myId }; return; }
    const previous = this.state; this.state = state; this.myId = myId;
    const seated = state.players.filter(p => p.seated);
    const visibleIds = new Set(seated.map(p => p.id));
    for (const [id, g] of this.robots) if (!visibleIds.has(id)) {
      this.world.remove(g); this.robots.delete(id);
      this.world.remove(this.chairs.get(id)); this.chairs.delete(id);
      const label = this.labels.get(id); if (label) { label.material.map.dispose(); label.material.dispose(); this.world.remove(label); this.labels.delete(id); }
    }
    seated.forEach((p, i) => {
      const angle = i * TAU / seated.length;
      const position = new THREE.Vector3(Math.sin(angle) * 3.35, 0, Math.cos(angle) * 3.35);
      let g = this.robots.get(p.id);
      if (!g || g.userData.color !== p.color) {
        if (g) this.world.remove(g);
        g = robot(p.color); g.userData.color = p.color; this.robots.set(p.id, g); this.world.add(g);
      }
      g.position.copy(position); g.rotation.y = angle + Math.PI; g.userData.player = p;
      this.chair(p.id, position, angle + Math.PI);
      if (p.eliminated && g.userData.diedAt === null) g.userData.diedAt = performance.now() / 1000;
      if (!p.eliminated) g.userData.diedAt = null;
      if (previous?.phase === 'lobby' && state.phase !== 'lobby') g.userData.seatAt = performance.now() / 1000;
      if (state.table.some(e => e.playerId === p.id) && !previous?.table.some(e => e.playerId === p.id && state.table.some(n => n.card.id === e.card.id)))
        g.userData.playedAt = performance.now() / 1000;
      // Small remote fans, visible faces only to spectators.
      const spectator = !byId(state, myId)?.seated || byId(state, myId)?.eliminated;
      this.syncHand(g.userData.hand, p.hand.slice(0, 20), !(spectator || p.id === myId), .6, .065, 0, 0, -.08);
      let label = this.labels.get(p.id);
      const caption = `${p.name}${p.bot ? ' · bot' : ''}`;
      if (!label) {
        label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(caption), transparent: true, depthTest: false }));
        label.scale.set(1.55, .39, 1); this.world.add(label); this.labels.set(p.id, label);
      }
      label.position.copy(position).add(new THREE.Vector3(0, 2.8, 0));
    });
    const dealer = this.robots.get(state.dealer);
    if (dealer) {
      this.dealer.visible = true;
      this.dealer.position.copy(dealer.position.clone().multiplyScalar(.7)); this.dealer.position.y = 1.68;
    } else this.dealer.visible = false;
    const active = this.robots.get(state.turn);
    this.spot.visible = !!active;
    if (active) this.spot.position.copy(active.position);
    this.updateCards(state, previous);
    const mine = byId(state, myId);
    this.syncHand(this.firstHandCards, mine?.hand ?? [], false, .65, Math.min(.085, .75 / Math.max(1, mine?.hand.length ?? 1)), .03, -.06, -.055);
  }
  syncHand(group, cards, back, scale, spread, y, z, angle) {
    for (const m of [...group.children]) if (!cards.some(c => c.id === m.userData.card.id) || m.userData.back !== back) {
      group.remove(m); for (const mat of m.material) if (mat !== edgeMaterial) mat.dispose();
    }
    cards.forEach((card, index) => {
      let m = group.children.find(child => child.userData.card.id === card.id);
      const target = new THREE.Vector3((index - (cards.length - 1) / 2) * spread, index * .002 + y, z);
      if (!m) { m = makeCard(card, group, back); m.position.copy(target).add(new THREE.Vector3(0, .15, 0)); }
      m.scale.setScalar(scale);
      m.userData = { card, back, hand: group === this.firstHandCards, index, target, angle: (index - (cards.length - 1) / 2) * angle };
    });
  }
  clearCards(group) {
    for (const m of [...group.children]) {
      group.remove(m);
      if (Array.isArray(m.material)) for (const mat of m.material) if (mat !== edgeMaterial) mat.dispose();
    }
  }
  updateCards(state, previous) {
    const desired = new Map();
    state.table.forEach((entry, i) => {
      const a = i * 2.399;
      desired.set(`table-${entry.card.id}`, { ...entry, pos: new THREE.Vector3(Math.sin(a) * (.28 + .055 * i), 1.68 + i * .006, Math.cos(a) * (.28 + .055 * i)), rotation: a * .25 });
    });
    for (const p of state.players) {
      const g = this.robots.get(p.id); if (!g) continue;
      const base = g.position.clone().multiplyScalar(.63); base.y = 1.69;
      (p.tricks ?? []).forEach((trick, index) => trick.entries.forEach((entry, i) => {
        // During the collection animation, don't duplicate the current table.
        if (state.phase === 'trick' && state.table.some(e => e.card.id === entry.card.id)) return;
        const pos = base.clone(); pos.y += index * .045 + i * .009; pos.x += (index % 3 - 1) * .18;
        desired.set(`pile-${entry.card.id}`, { ...entry, pos, rotation: g.rotation.y, pileOwner: p.name, trickIndex: index + 1,
          pile: trick.entries, winner: entry.card.id === trick.winningCardId });
      }));
    }
    for (const [key, m] of this.cards) if (!desired.has(key)) {
      this.world.remove(m); for (const mat of m.material) if (mat !== edgeMaterial) mat.dispose(); this.cards.delete(key);
    }
    for (const [key, data] of desired) {
      let m = this.cards.get(key);
      if (!m) {
        m = makeCard(data.card, this.world); this.cards.set(key, m);
        const origin = this.robots.get(data.playerId)?.position.clone().multiplyScalar(.7) ?? data.pos.clone(); origin.y = 2;
        m.position.copy(origin); m.rotation.y = data.rotation + .5;
      }
      m.userData = { ...m.userData, ...data, target: data.pos };
    }
    if (state.kicker?.id !== previous?.kicker?.id) {
      if (this.kickerCard) { this.world.remove(this.kickerCard); for (const mat of this.kickerCard.material) if (mat !== edgeMaterial) mat.dispose(); }
      this.kickerCard = state.kicker ? makeCard(state.kicker, this.world) : null;
      if (this.kickerCard) {
        this.kickerCard.position.set(-1.25, 1.68, -.3); this.kickerCard.rotation.y = -.15;
        this.kickerCard.userData = { card: state.kicker, playerName: 'Kicker da rodada', kicker: true, rotation: -.15 };
      }
    }
    this.pickables = [...this.cards.values(), ...(this.kickerCard ? [this.kickerCard] : [])];
    if (this.inspected && !this.inspected.parent) this.clearInspection();
  }
  setMode(mode) {
    this.mode = mode; this.clearInspection(); this.yaw = 0; this.pitch = -.12; this.onMode(mode);
  }
  toggleMode() { if (this.mode !== 'landing') this.setMode(this.mode === 'top' ? 'first' : 'top'); }
  clearInspection() { this.inspected = null; this.hover = null; this.onInspect(null); }
  inspect(object) {
    if (this.mode !== 'top' || !object) return;
    this.inspected = object; this.onInspect(object.userData);
  }
  pick(x, y, hand = false) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.scene.updateMatrixWorld(); this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObjects(hand ? this.firstHandCards.children : this.pickables, false)[0]?.object;
  }
  bind(canvas) {
    this.pointers = new Map();
    canvas.addEventListener('pointerdown', e => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      const object = this.pick(e.clientX, e.clientY, this.mode === 'first');
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, object, at: performance.now() };
      if (this.inspected && !this.pick(e.clientX, e.clientY)) this.clearInspection();
    });
    canvas.addEventListener('pointermove', e => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]; const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDistance) this.zoom = THREE.MathUtils.clamp(this.zoom - (distance - this.pinchDistance) * .025, 5, 17);
        this.pinchDistance = distance; this.hover = null; return;
      }
      if (!this.drag || this.drag.id !== e.pointerId) {
        this.pointers.delete(e.pointerId);
        if (this.mode === 'top' && !this.inspected) {
          const object = this.pick(e.clientX, e.clientY);
          if (object !== this.hover?.object) this.hover = object ? { object, at: performance.now() } : null;
          canvas.style.cursor = object ? 'zoom-in' : 'grab';
        }
        return;
      }
      const d = this.drag;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) d.moved = true;
      if (this.mode === 'first' && !d.object) {
        this.yaw -= (e.clientX - d.lastX) * .004;
        this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - d.lastY) * .004, -1.2, 1.15);
      } else if (this.mode === 'first' && d.object) {
        d.object.position.y = .03 + Math.min(.25, (d.y - e.clientY) * .001);
        d.object.position.x += (e.clientX - d.lastX) * .001;
        this.rightGlove.position.y = -.5;
      }
      d.lastX = e.clientX; d.lastY = e.clientY;
    });
    const release = e => {
      this.pointers.delete(e.pointerId); this.pinchDistance = null;
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (e.type !== 'pointercancel') {
        if (this.mode === 'top' && d.object && !d.moved) this.inspect(d.object);
        if (this.mode === 'first' && d.object && d.moved) {
          if (d.y - e.clientY > 65) this.onPlay(d.object.userData.card.id);
          else {
            const index = THREE.MathUtils.clamp(d.object.userData.index + Math.round((e.clientX - d.x) / 35), 0, this.firstHandCards.children.length - 1);
            this.onReorder(d.object.userData.card.id, index);
          }
        }
      }
      this.drag = null; this.rightGlove.position.y = -.65;
      if (this.pendingState) { const pending = this.pendingState; this.pendingState = null; this.setState(pending.state, pending.myId); }
      else if (this.state) this.setState(this.state, this.myId);
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', e => { if (this.mode === 'top') { e.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * .008, 5, 17); } }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') this.clearInspection();
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.toggleMode(); }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.drag = null; this.pointers.clear(); });
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    const handScale = Math.min(1, this.camera.aspect);
    this.firstHands.scale.setScalar(handScale);
    this.firstHands.position.x = -.23 * handScale;
    this.rightGlove.scale.setScalar(handScale);
    this.rightGlove.position.x = .55 * handScale;
  }
  receivePose(id, pose) {
    if (!pose || !Number.isFinite(pose.yaw) || !Number.isFinite(pose.pitch)) return;
    this.poses.set(id, { yaw: THREE.MathUtils.clamp(pose.yaw, -Math.PI * 8, Math.PI * 8), pitch: THREE.MathUtils.clamp(pose.pitch, -1.2, 1.2), position: pose.position });
  }
  frame() {
    const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime;
    const blend = 1 - Math.exp(-dt * 7);
    const mine = byId(this.state, this.myId), observer = !mine?.seated || mine?.eliminated || mine?.spectator;
    const myRobot = this.robots.get(this.myId);
    const a = myRobot ? Math.atan2(myRobot.position.x, myRobot.position.z) : 0;
    this.upTarget.set(0, 1, 0);
    if (this.mode === 'landing') {
      this.positionTarget.set(7.9, 7.4, 10.5);
      this.lookTarget.set(innerWidth < 700 ? 0 : -2.4, innerWidth < 700 ? 3 : 1.2, 0);
    } else if (this.inspected && this.inspected.parent) {
      const point = this.inspected.getWorldPosition(new THREE.Vector3());
      this.positionTarget.copy(point).add(new THREE.Vector3(.2, 1.45, .45)); this.lookTarget.copy(point);
      this.upTarget.set(0, 0, -1);
    } else if (this.mode === 'top') {
      // Fit the same complete table in narrow portrait screens before applying user zoom.
      this.positionTarget.set(0, 1.4 + (this.zoom - 1.4) / Math.min(1, this.camera.aspect), .001);
      this.lookTarget.set(0, 1.4, 0); this.upTarget.set(-Math.sin(a), 0, Math.cos(a));
    } else {
      if (observer) {
        const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.joystick.y;
        const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.joystick.x;
        const speed = 2.7 * dt / Math.max(1, Math.hypot(forward, side));
        const direction = a + this.yaw + Math.PI;
        const candidate = this.spectator.clone();
        candidate.x += (Math.sin(direction) * forward - Math.cos(direction) * side) * speed;
        candidate.z += (Math.cos(direction) * forward + Math.sin(direction) * side) * speed;
        if (Math.hypot(candidate.x, candidate.z) > 3 && Math.hypot(candidate.x, candidate.z) < 10.5) this.spectator.copy(candidate);
        this.positionTarget.copy(this.spectator);
      } else this.positionTarget.copy(myRobot?.position ?? new THREE.Vector3(0, 0, 3.35)).add(new THREE.Vector3(0, 1.99, 0));
      const direction = a + this.yaw + Math.PI;
      this.lookTarget.copy(this.positionTarget).add(new THREE.Vector3(Math.sin(direction) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(direction) * Math.cos(this.pitch)));
    }
    if (this.mode === 'first' && !this.inspected) { this.camera.position.lerp(this.positionTarget, blend); }
    else this.camera.position.lerp(this.positionTarget, blend);
    this.camera.up.lerp(this.upTarget, blend).normalize();
    const dummy = this.cameraAim; dummy.position.copy(this.camera.position); dummy.up.copy(this.camera.up); dummy.lookAt(this.lookTarget);
    this.camera.quaternion.slerp(dummy.quaternion, blend);
    this.firstHands.visible = this.mode === 'first' && !observer;
    this.rightGlove.visible = this.firstHands.visible;
    if (this.hover && performance.now() - this.hover.at > 2000) this.inspect(this.hover.object);
    if (this.drag && this.mode === 'top' && !this.drag.moved && this.drag.object && performance.now() - this.drag.at > 2000) this.inspect(this.drag.object);
    for (const [id, g] of this.robots) {
      const u = g.userData, pose = id === this.myId ? { yaw: this.yaw, pitch: this.pitch } : this.poses.get(id);
      g.visible = !(id === this.myId && this.mode === 'first' && !observer);
      this.labels.get(id).visible = g.visible;
      u.head.rotation.y = THREE.MathUtils.lerp(u.head.rotation.y, pose?.yaw ?? Math.sin(t * .6 + g.position.x) * .13, blend);
      u.head.rotation.x = THREE.MathUtils.lerp(u.head.rotation.x, -(pose?.pitch ?? 0), blend);
      u.eyes.rotation.x = -(pose?.pitch ?? 0) * .2;
      u.body.scale.y = 1.12 + Math.sin(t * 2 + g.position.x) * .025;
      const play = Math.max(0, 1 - (t - u.playedAt) / 1.1);
      u.rightArm.rotation.x = -Math.sin(play * Math.PI) * .8; u.rightArm.rotation.z = -Math.sin(play * Math.PI) * .25;
      const sit = Math.max(0, 1 - (t - u.seatAt) / 1.2);
      g.position.y = Math.sin(sit * Math.PI) * .35;
      if (u.diedAt !== null) {
        const death = THREE.MathUtils.clamp((t - u.diedAt) / 1.1, 0, 1);
        g.rotation.z = Math.sin(death * Math.PI / 2) * 1.45; g.position.y = -.45 * death;
        u.head.rotation.z = Math.sin(t * 3) * .08;
      } else { g.rotation.z = Math.sin(t + g.position.x) * .02; u.head.rotation.z = 0; }
    }
    for (const m of this.cards.values()) {
      m.position.lerp(m.userData.target, 1 - Math.exp(-dt * 5));
      m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, m === this.inspected ? 0 : m.userData.rotation, blend);
    }
    for (const group of [this.firstHandCards, ...[...this.robots.values()].map(g => g.userData.hand)]) {
      for (const m of group.children) if (m !== this.drag?.object) {
        m.position.lerp(m.userData.target, blend); m.rotation.y = THREE.MathUtils.lerp(m.rotation.y, m.userData.angle, blend);
      }
    }
    if (this.kickerCard) this.kickerCard.rotation.y = THREE.MathUtils.lerp(this.kickerCard.rotation.y, this.kickerCard === this.inspected ? 0 : -.15, blend);
    if (t - (this.lastPose ?? 0) > .15 && this.mode === 'first') {
      this.lastPose = t; this.onPose({ yaw: this.yaw, pitch: this.pitch, ...(observer ? { position: this.spectator.toArray() } : {}) });
    }
    if (!document.hidden && (innerWidth >= 700 || t - (this.lastRender ?? -1) >= .03)) {
      this.renderer.render(this.scene, this.camera); this.lastRender = t;
    }
  }
}
