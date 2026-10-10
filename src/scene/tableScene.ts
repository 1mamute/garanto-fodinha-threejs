/**
 * The 3D table: owns the renderer and the render loop, and mirrors the game state with robots,
 * cards and camera. The UI talks to it through `setState`, `setMode` and the `SceneCallbacks`.
 */
import * as THREE from 'three';
import { findPlayer, type GameState, type Player } from '../game';
import { CameraRig } from './cameraRig';
import type { CardFrame, CardRelease } from '../net/sceneMessages';
import type { CardMesh } from './cards';
import { demoState } from './demo';
import { DealerIndicator } from './dealerIndicator';
import { createRenderer, createScene } from './environment';
import { GraphicsRenderer } from './graphicsRenderer';
import { animateFan, FirstPersonHands, ROBOT_FAN, syncFan } from './hands';
import { SceneInput, type InputTarget } from './input';
import { disposeMaterials, smoothing, TAU } from './primitives';
import { PhysicsCards } from './physicsCards';
import { PhysicsCharacter } from './physicsCharacter';
import { physicsRuntime } from './physicsRuntime';
import { PhysicsWorld } from './physicsWorld';
import { PlayerMotion, isObserver } from './playerMotion';
import { captureTransform } from './networkTransforms';
import { nowSeconds, Robot } from './robot';
import { isMobileRenderer, RenderBudget } from './renderBudget';
import { buildChair, buildRoom, nameLabel, TABLE_TOP, type RoomProps } from './room';
import { TableCards, type Seat } from './tableCards';
import type { CameraMode, CardInspection, Pose, SceneCallbacks } from './types';

const SEAT_RADIUS = 3.35;
const POSE_INTERVAL_S = 1 / 20;
/** Robots show at most this many cards in their fan. */
const MAX_FAN_CARDS = 20;

/** Everything drawn for one seated player. */
interface SeatProps {
  robot: Robot;
  chair: THREE.Group;
  label: THREE.Sprite;
  caption: string;
}

export class TableScene implements InputTarget {
  readonly rig = new CameraRig();
  mode: CameraMode = 'landing';
  inspected: CardMesh | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly graphics: GraphicsRenderer;
  private readonly scene = createScene();
  private readonly world = new THREE.Group();
  private readonly physics = new PhysicsWorld(physicsRuntime());
  private readonly cardPhysics = new PhysicsCards(this.physics);
  private readonly walker = new PhysicsCharacter(this.physics, this.rig.spectatorPosition);
  private readonly room: RoomProps;
  private readonly seats = new Map<string, SeatProps>();
  private readonly tableCards: TableCards;
  private readonly dealerIndicator = new DealerIndicator();
  private readonly firstPerson: FirstPersonHands;
  private readonly input: SceneInput;
  private readonly motion = new PlayerMotion(this.world, this.physics);
  private readonly raycaster = new THREE.Raycaster();
  private readonly timer = new THREE.Timer();
  private state: GameState | null = null;
  private myId: string | null = null;
  private lastPoseAt = 0;
  private readonly budget = new RenderBudget(isMobileRenderer());

  constructor(
    canvas: HTMLCanvasElement,
    private readonly callbacks: SceneCallbacks,
  ) {
    this.renderer = createRenderer(canvas);
    this.scene.add(this.rig.camera, this.world);
    this.room = buildRoom(this.world);
    this.physics.addSolids(this.room.solids);
    this.rig.resolveWalk = this.walker.move;
    this.tableCards = new TableCards(this.world, this.cardPhysics);
    this.firstPerson = new FirstPersonHands(this.rig.camera);
    this.graphics = new GraphicsRenderer({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.rig.camera,
      overlay: () => {
        this.firstPerson.render(this.renderer, this.scene);
      },
    });
    this.input = new SceneInput(canvas, this);
    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
    });
    this.demo();
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      this.renderer.setAnimationLoop(null);
      this.graphics.dispose();
      this.walker.dispose();
      this.cardPhysics.dispose();
      this.physics.dispose();
    });
    this.renderer.setAnimationLoop(() => {
      this.frame();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  demo(): void {
    this.setState(demoState(), null);
  }

  get freeLook(): boolean {
    return this.mode === 'first' && isObserver(this.state ? findPlayer(this.state, this.myId) : undefined);
  }

  setState(state: GameState, myId: string | null): void {
    const previous = this.state;
    this.state = state;
    this.myId = myId;
    const spawn = this.motion.sync(state, myId);
    if (spawn) this.rig.spectatorPosition.copy(spawn);
    this.tableCards.setAuthority(this.callbacks.isAuthority());
    const observer = isObserver(findPlayer(state, myId));
    this.syncSeats(state, previous, observer);
    this.syncMarkers(state);
    this.tableCards.sync(state, this.seatPositions());
    // Only the local fan waits for release; remote moves and host physics must keep advancing.
    if (!this.input.draggedHandCard) this.firstPerson.show(findPlayer(state, myId)?.hand ?? []);
    if (this.inspected && !this.inspected.parent) this.clearInspection();
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.clearInspection();
    this.rig.resetView();
    this.callbacks.onMode(mode);
  }

  toggleMode(): void {
    if (this.mode !== 'landing') this.setMode(this.mode === 'top' ? 'first' : 'top');
  }

  setJoystick(x: number, y: number): void {
    this.rig.joystick.x = x;
    this.rig.joystick.y = y;
  }

  clearInspection(): void {
    this.inspected = null;
    this.input.clearHover();
    this.callbacks.onInspect(null);
  }

  receivePose(playerId: string, pose: Pose): void {
    this.motion.receive(playerId, pose);
  }

  receiveCards(frame: CardFrame): void {
    if (frame.version === this.state?.version) this.tableCards.receiveFrame(frame);
  }

  receiveCardRelease(release: CardRelease): void {
    this.tableCards.receiveRelease(release);
  }

  // ── InputTarget ────────────────────────────────────────────────────────────

  inspect(card: CardMesh): void {
    if (this.mode !== 'top') return;
    this.inspected = card;
    const details: CardInspection = { ...card.details };
    this.callbacks.onInspect(details);
  }

  pick(clientX: number, clientY: number, hand: boolean): CardMesh | undefined {
    this.raycaster.layers.set(hand ? 1 : 0);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(pointer, this.rig.camera);
    const candidates = hand ? (this.firstPerson.cards.children as CardMesh[]) : this.tableCards.pickable;
    return this.raycaster.intersectObjects(candidates, false)[0]?.object as CardMesh | undefined;
  }

  reach(reaching: boolean): void {
    this.firstPerson.reach(reaching);
  }

  dropHandCard(
    card: CardMesh,
    tablePoint: THREE.Vector3 | null,
    slotShift: number,
    velocity?: THREE.Vector3,
  ): void {
    if (tablePoint) {
      this.tableCards.releaseFromHand(card, tablePoint, velocity);
      this.callbacks.onPlay(card.card.id, {
        transform: captureTransform(card, card.card.id),
        landing: tablePoint.toArray(),
        velocity: velocity?.toArray() ?? [0, 0, 0],
      });
      return;
    }
    const lastSlot = this.firstPerson.cards.children.length - 1;
    this.callbacks.onReorder(card.card.id, THREE.MathUtils.clamp(card.index + slotShift, 0, lastSlot));
  }

  afterDrag(): void {
    // Re-applying the state also snaps a dropped card back into its slot.
    if (this.state) this.setState(this.state, this.myId);
  }

  // ── State mirroring ────────────────────────────────────────────────────────

  /** Seats the robots evenly around the table, adding and removing them as players come and go. */
  private syncSeats(state: GameState, previous: GameState | null, observer: boolean): void {
    const seated = state.players.filter(player => player.seated);
    const seatedIds = new Set(seated.map(player => player.id));
    for (const playerId of this.seats.keys()) {
      if (!seatedIds.has(playerId)) this.removeSeat(playerId);
    }
    const matchStarted = previous?.phase === 'lobby' && state.phase !== 'lobby';
    seated.forEach((player, index) => {
      const props = this.placeSeat(player, (index * TAU) / seated.length);
      updateRobot(props.robot, player, { state, previous, matchStarted });
      // Other players' cards are face down, unless you are only watching.
      const faceDown = !observer && player.id !== this.myId;
      syncFan(props.robot.hand, player.hand.slice(0, MAX_FAN_CARDS), faceDown, ROBOT_FAN);
      this.physics.syncHand(props.robot.hand);
    });
  }

  private placeSeat(player: Player, angle: number): SeatProps {
    const props = this.seatFor(player);
    const position = new THREE.Vector3(Math.sin(angle) * SEAT_RADIUS, 0, Math.cos(angle) * SEAT_RADIUS);
    props.robot.group.position.copy(position);
    // Turned half a circle to face the table centre.
    props.robot.group.rotation.y = angle + Math.PI;
    props.chair.position.copy(position);
    props.chair.rotation.y = angle + Math.PI;
    props.label.position.copy(position).setY(3.15);
    this.physics.removeObject(props.chair);
    this.physics.addChair(props.chair);
    return props;
  }

  /** Finds or builds the robot, chair and label for a player, rebuilding what changed. */
  private seatFor(player: Player): SeatProps {
    const caption = `${player.name}${player.bot ? ' · bot' : ''}`;
    let props = this.seats.get(player.id);
    if (!props) {
      props = { robot: new Robot(player.color), chair: buildChair(), label: nameLabel(caption), caption };
      this.world.add(props.robot.group, props.chair, props.label);
      this.seats.set(player.id, props);
      this.physics.addRobot(props.robot.group);
    }
    if (props.robot.color !== player.color) {
      this.physics.removeObject(props.robot.group);
      props.robot.group.removeFromParent();
      props.robot = new Robot(player.color);
      this.world.add(props.robot.group);
      this.physics.addRobot(props.robot.group);
    }
    if (props.caption !== caption) {
      disposeMaterials(props.label);
      props.label.material = nameLabel(caption).material;
      props.caption = caption;
    }
    return props;
  }

  private removeSeat(playerId: string): void {
    const props = this.seats.get(playerId);
    if (!props) return;
    this.physics.removeObject(props.robot.group);
    this.physics.removeObject(props.chair);
    props.robot.group.removeFromParent();
    props.chair.removeFromParent();
    props.label.removeFromParent();
    disposeMaterials(props.label);
    this.seats.delete(playerId);
  }

  /** Dealer chip in front of the dealer, spotlight over whoever must act. */
  private syncMarkers(state: GameState): void {
    const { dealerChip, spotlight } = this.room;
    const dealer = this.seats.get(state.dealer)?.robot.group;
    dealerChip.visible = Boolean(dealer);
    if (dealer) dealerChip.position.copy(dealer.position).multiplyScalar(0.7).setY(TABLE_TOP);
    const active = state.turn ? this.seats.get(state.turn)?.robot.group : undefined;
    spotlight.visible = Boolean(active);
    if (active) spotlight.position.copy(active.position);
  }

  private seatPositions(): Map<string, Seat> {
    const positions = new Map<string, Seat>();
    for (const [playerId, { robot }] of this.seats) {
      positions.set(playerId, {
        position: robot.group.position.clone().setY(0),
        rotation: robot.group.rotation.y,
      });
    }
    return positions;
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  private resize(): void {
    this.graphics.resize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
    this.firstPerson.fitTo(this.rig.camera.aspect);
  }

  private frame(): void {
    // Clamp the step so a backgrounded tab does not make everything jump.
    this.timer.update();
    const time = this.timer.getElapsed();
    const deltaSeconds = this.budget.takeFrame(time, document.hidden);
    if (!deltaSeconds) return;
    this.physics.step(deltaSeconds);
    const blend = smoothing(deltaSeconds, 7);
    const observer = isObserver(this.state ? findPlayer(this.state, this.myId) : undefined);
    const mySeat = this.myId ? this.seats.get(this.myId) : undefined;
    this.rig.update(deltaSeconds, blend, {
      mode: this.mode,
      inspected: this.inspected,
      observer,
      seat: mySeat?.robot.group.position.clone().setY(0) ?? null,
      tableBounds: this.tableCards.framingBounds,
    });
    this.updateDealerIndicator();
    this.firstPerson.fitTo(this.rig.camera.aspect, this.rig.camera.fov);
    // Keep the seated body visible; camera-mounted hands replace its arms and card fan.
    const embodied = this.mode === 'first' && !observer;
    this.firstPerson.visible = embodied;
    this.input.checkLongPress(performance.now());
    this.animateRobots(nowSeconds(), blend, embodied);
    this.motion.animateWalkers({
      myId: this.myId,
      position: this.rig.spectatorPosition,
      pose: this.walkingPose(),
      firstPerson: this.mode === 'first',
      deltaSeconds,
      blend,
    });
    this.tableCards.setAuthority(this.callbacks.isAuthority());
    this.tableCards.animate(deltaSeconds, blend, this.inspected);
    const dragged = this.input.draggedHandCard;
    animateFan(this.firstPerson.cards, blend, dragged);
    this.firstPerson.followCard(dragged);
    this.sendPose(time, observer);
    this.render();
  }

  private animateRobots(time: number, blend: number, embodied: boolean): void {
    for (const [playerId, { robot, label }] of this.seats) {
      const mine = playerId === this.myId;
      robot.setFirstPerson(mine && embodied);
      label.visible = !(mine && embodied);
      const pose = mine ? this.localPose() : this.motion.poseFor(playerId);
      robot.animate(time, pose, blend);
      this.motion.animateHand(robot, pose, blend);
    }
  }

  private updateDealerIndicator(): void {
    const dealer = this.state ? findPlayer(this.state, this.state.dealer) : undefined;
    const player = this.state ? findPlayer(this.state, this.myId) : undefined;
    this.dealerIndicator.update({
      camera: this.rig.camera,
      seat: dealer ? (this.seats.get(dealer.id)?.robot.group.position ?? null) : null,
      name: dealer?.name ?? '',
      chip: this.room.dealerChip,
      visible: !isObserver(player) && (this.mode === 'first' || this.mode === 'top'),
    });
  }

  private localPose(): Pose {
    const card = this.input.draggedHandCard;
    return {
      ...this.input.pose,
      reaching: Boolean(card),
      heldCard: card ? captureTransform(card, card.card.id) : null,
    };
  }

  private walkingPose(): Pose {
    const pose = this.localPose();
    const seat = this.myId ? this.seats.get(this.myId)?.robot.group : undefined;
    // Observer camera aim includes the old seat angle after elimination.
    if (seat) pose.yaw += Math.atan2(seat.position.x, seat.position.z);
    return pose;
  }

  /** Shares motion and the host's actual card physics at 20 Hz. */
  private sendPose(time: number, observer: boolean): void {
    if (this.mode === 'landing' || time - this.lastPoseAt <= POSE_INTERVAL_S) return;
    this.lastPoseAt = time;
    const pose = observer ? this.walkingPose() : this.localPose();
    if (observer) pose.position = this.rig.spectatorPosition.toArray();
    this.callbacks.onPose(pose);
    if (this.state && this.callbacks.isAuthority()) {
      this.callbacks.onCards({ version: this.state.version, cards: this.tableCards.snapshot() });
    }
  }

  private render(): void {
    this.graphics.render(this.budget.pixelRatio(devicePixelRatio));
  }
}

/** Starts the arm swing, sitting hop and death animations when the matching event happens. */
function updateRobot(
  robot: Robot,
  player: Player,
  change: { state: GameState; previous: GameState | null; matchStarted: boolean },
): void {
  const now = nowSeconds();
  if (!player.eliminated) robot.diedAt = null;
  else robot.diedAt ??= now;
  if (change.matchStarted) robot.seatedAt = now;
  const played = change.state.table.find(entry => entry.playerId === player.id);
  const alreadyShown = change.previous?.table.some(entry => entry.card.id === played?.card.id);
  if (played && !alreadyShown) robot.playedAt = now;
}
