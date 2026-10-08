/** Local, development-only scene for inspecting the same assets rendered by the game. */
import * as THREE from 'three';
import { createDeck } from '../game';
import { morph } from '../ui/dom';
import { html } from '../ui/html';
import { bindJoystick } from '../ui/joystick';
import { CameraRig } from './cameraRig';
import type { CardMesh } from './cards';
import { demoState } from './demo';
import { createRenderer, createScene } from './environment';
import { animateFan, ROBOT_FAN, syncFan } from './hands';
import { SceneInput, type InputTarget } from './input';
import { smoothing, TAU } from './primitives';
import { Robot } from './robot';
import { RobotWalking } from './robotWalking';
import { buildChair, buildRoom, nameLabel, TABLE_TOP } from './room';
import { TableCards, type Seat } from './tableCards';
import type { InspectionCameraMode } from './types';

const SEAT_RADIUS = 3.35;
const MODES = ['first', 'third', 'top'] as const;
const MODE_LABELS = {
  first: 'Primeira pessoa',
  third: 'Terceira pessoa',
  top: 'Vista superior',
  landing: 'Início',
};

export class LabScene implements InputTarget {
  readonly rig = new CameraRig();
  mode: InspectionCameraMode = 'first';
  inspected: CardMesh | null = null;
  private readonly scene = createScene();
  private readonly world = new THREE.Group();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly tableCards = new TableCards(this.world);
  private readonly controlled = new Robot('#648bc1', 'standing');
  private readonly stationary = new Robot('#c38e67', 'standing');
  private headTracking = false;
  private readonly walking: RobotWalking;
  private readonly timer = new THREE.Timer();
  private readonly input: SceneInput;
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly root: HTMLElement,
    canvas: HTMLCanvasElement,
  ) {
    this.renderer = createRenderer(canvas);
    this.scene.add(this.world, this.rig.camera);
    this.populate();
    this.walking = new RobotWalking(this.controlled, this.rig.spectatorPosition);
    this.input = new SceneInput(canvas, this);
    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
    });
    root.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const mode = event.target.closest<HTMLElement>('[data-camera]')?.dataset.camera;
      if (mode === 'first' || mode === 'third' || mode === 'top') this.setMode(mode);
      if (event.target.closest('[data-action="toggle-head-tracking"]')) {
        this.headTracking = !this.headTracking;
        this.renderUi();
      }
    });
    this.renderUi();
    this.renderer.setAnimationLoop(() => {
      this.frame();
    });
  }

  private populate(): void {
    const room = buildRoom(this.world);
    const state = demoState();
    const visibleIds = new Set([state.kicker?.id, ...state.table.map(entry => entry.card.id)]);
    const deck = createDeck().filter(card => !visibleIds.has(card.id));
    const seats = new Map<string, Seat>();
    state.players.forEach((player, index) => {
      player.hand = deck.slice(index * 2, index * 2 + 2);
      const angle = (index * TAU) / state.players.length;
      const robot = new Robot(player.color);
      robot.group.position.set(Math.sin(angle) * SEAT_RADIUS, 0, Math.cos(angle) * SEAT_RADIUS);
      robot.group.rotation.y = angle + Math.PI;
      const chair = buildChair();
      chair.position.copy(robot.group.position);
      chair.rotation.y = robot.group.rotation.y;
      syncFan(robot.hand, player.hand, false, ROBOT_FAN);
      animateFan(robot.hand, 1, null);
      this.world.add(robot.group, chair);
      seats.set(player.id, { position: robot.group.position.clone(), rotation: robot.group.rotation.y });
    });
    this.tableCards.sync(state, seats);
    for (const card of this.tableCards.pickable) {
      card.position.copy(card.target);
      card.rotation.y = card.targetRotation;
    }
    const dealer = seats.get(state.dealer);
    if (dealer) room.dealerChip.position.copy(dealer.position).multiplyScalar(0.7).setY(TABLE_TOP);
    const active = state.turn ? seats.get(state.turn) : undefined;
    if (active) room.spotlight.position.copy(active.position);
    const { stationary } = this;
    this.controlled.group.rotation.y = Math.PI;
    stationary.group.position.set(2, 0, 5);
    stationary.group.rotation.y = Math.PI;
    const label = nameLabel('Robô para inspeção');
    label.position.set(2, 2.8, 5);
    this.world.add(stationary.group, this.controlled.group, label);
  }

  toggleMode(): void {
    const next = MODES[(MODES.findIndex(mode => mode === this.mode) + 1) % MODES.length];
    if (next) this.setMode(next);
  }

  private setMode(mode: InspectionCameraMode): void {
    this.mode = mode;
    this.clearInspection();
    this.rig.keys.clear();
    this.rig.joystick.x = 0;
    this.rig.joystick.y = 0;
  }

  get freeLook(): boolean {
    return this.mode === 'first';
  }

  inspect(card: CardMesh): void {
    this.inspected = card;
    this.renderUi();
  }

  clearInspection(): void {
    this.inspected = null;
    this.input.clearHover();
    this.renderUi();
  }

  pick(clientX: number, clientY: number, hand: boolean): CardMesh | undefined {
    if (hand || this.mode !== 'top') return undefined;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(pointer, this.rig.camera);
    const object = this.raycaster.intersectObjects(this.tableCards.pickable, false)[0]?.object;
    return this.tableCards.pickable.find(card => card === object);
  }

  // The frozen fixture has no playable hand or queued game state.
  readonly reach = (): void => undefined;
  readonly dropHandCard = (): void => undefined;
  readonly afterDrag = (): void => undefined;

  private resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
  }

  private frame(): void {
    this.timer.update();
    const deltaSeconds = Math.min(this.timer.getDelta(), 0.05);
    const blend = smoothing(deltaSeconds, 7);
    this.rig.update(deltaSeconds, blend, {
      mode: this.mode,
      observer: true,
      seat: null,
      inspected: this.inspected,
    });
    this.walking.update({
      position: this.rig.spectatorPosition,
      yaw: this.rig.yaw,
      pitch: this.rig.pitch,
      deltaSeconds,
    });
    this.controlled.group.visible = this.mode !== 'first';
    this.stationary.lookAt(this.headTracking ? this.rig.spectatorPosition : null, blend);
    this.input.checkLongPress(performance.now());
    this.tableCards.animate(deltaSeconds, blend, this.inspected);
    if (!document.hidden) this.renderer.render(this.scene, this.rig.camera);
  }

  private renderUi(): void {
    const card = this.inspected?.card;
    morph(
      this.root,
      html`<aside class="lab-panel">
      <strong>Laboratório de cena</strong>
      <p>Câmera: ${MODE_LABELS[this.mode]}</p>
      <div class="lab-cameras">${MODES.map(mode => html`<button class="button subtle" data-camera="${mode}" aria-pressed="${this.mode === mode}">${MODE_LABELS[mode]}</button>`)}</div>
      <button class="button subtle" data-action="toggle-head-tracking" aria-pressed="${String(this.headTracking)}">Robô de inspeção: seguir com a cabeça ${this.headTracking ? 'ligado' : 'desligado'}</button>
      <p>Ative para o robô de inspeção olhar para seu personagem. Caminhe à frente dele e para os lados para observar a cabeça.</p>
      <p>Computador: WASD para andar; clique na cena para olhar com o mouse em primeira pessoa. Esc libera o cursor.<br />Celular: joystick para andar e arraste na cena para olhar.<br />Terceira pessoa: arraste para orbitar. Espaço: alternar câmera · Roda: zoom na terceira pessoa e vista superior</p>
      <p>Vista superior: clique numa carta para inspecionar. Esc: sair da inspeção.</p>
      ${card && html`<p>Inspecionando: ${card.rank}${card.suit}</p>`}
      <a class="text-button" href="/">← Voltar ao jogo</a>
    </aside>${this.mode !== 'top' && html`<div class="joystick" id="joystick" aria-label="Joystick para andar"><span></span></div>`}`,
    );
    bindJoystick(this.root.querySelector<HTMLElement>('#joystick'), (x, y) => {
      this.rig.joystick.x = x;
      this.rig.joystick.y = y;
    });
  }
}
