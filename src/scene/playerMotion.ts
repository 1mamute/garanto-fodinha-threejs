import * as THREE from 'three';
import { canWalk, type GameState, type Player } from '../game';
import type { Pose } from '../net/messages';
import { CardMesh } from './cards';
import { animateFan } from './hands';
import { followTransform } from './networkTransforms';
import type { PhysicsWorld } from './physicsWorld';
import { disposeMaterials } from './primitives';
import { Robot } from './robot';
import { RobotWalking } from './robotWalking';
import { playerSpawn } from './playerSpawn';
import { ROBOT_DIMENSIONS } from './robotDimensions';
import { nameLabel } from './room';

const POSE_TIMEOUT_MS = 1_000;

export function isObserver(player: Player | undefined): boolean {
  return !player?.seated || player.eliminated || player.spectator;
}

interface WalkingAvatar {
  robot: Robot;
  walking: RobotWalking;
  position: THREE.Vector3;
  label: THREE.Sprite;
}

interface WalkingContext {
  myId: string | null;
  position: THREE.Vector3;
  pose: Pose;
  firstPerson: boolean;
  deltaSeconds: number;
  blend: number;
}

/** Standing observers and seated gestures share the same sanitized motion samples. */
export class PlayerMotion {
  private readonly poses = new Map<string, { pose: Pose; at: number }>();
  private readonly walkers = new Map<string, WalkingAvatar>();
  private roomKey = '';

  constructor(
    private readonly world: THREE.Group,
    private readonly physics: PhysicsWorld,
  ) {}

  receive(id: string, pose: Pose): void {
    this.poses.set(id, { pose, at: performance.now() });
  }

  poseFor(id: string): Pose | undefined {
    const sample = this.poses.get(id);
    if (!sample) return undefined;
    if (performance.now() - sample.at <= POSE_TIMEOUT_MS) return sample.pose;
    // A lost release packet or backgrounded sender must not leave a floating held card.
    return { ...sample.pose, reaching: false, heldCard: null };
  }

  sync(state: GameState, myId: string | null): THREE.Vector3 | null {
    const key = myId ?? 'demo';
    if (key !== this.roomKey) {
      this.poses.clear();
      for (const id of this.walkers.keys()) this.remove(id);
      this.roomKey = key;
    }
    const observers = state.players.filter(player => !player.bot && canWalk(player));
    const existed = this.walkers.has(myId ?? '');
    for (const id of this.walkers.keys()) {
      if (!observers.some(player => player.id === id)) this.remove(id);
    }
    for (const id of this.poses.keys()) {
      if (!state.players.some(player => player.id === id)) this.poses.delete(id);
    }
    for (const player of observers) this.avatarFor(player, { myId, slot: state.players.indexOf(player) });
    return this.initialPosition(myId, existed);
  }

  private initialPosition(myId: string | null, existed: boolean): THREE.Vector3 | null {
    if (existed || myId === null) return null;
    const avatar = this.walkers.get(myId);
    return avatar?.position.clone().setY(ROBOT_DIMENSIONS.eyeHeight) ?? null;
  }

  animateWalkers(context: WalkingContext): void {
    for (const [id, avatar] of this.walkers) {
      this.animateWalker(id, avatar, context);
    }
  }

  private animateWalker(id: string, avatar: WalkingAvatar, context: WalkingContext): void {
    const mine = id === context.myId;
    const pose = (mine ? context.pose : this.poseFor(id)) ?? { yaw: 0, pitch: 0 };
    avatar.robot.setFirstPerson(mine && context.firstPerson);
    avatar.robot.group.visible = mine || Boolean(pose.position);
    avatar.label.visible = avatar.robot.group.visible && !(mine && context.firstPerson);
    if (mine) avatar.position.copy(context.position);
    else if (pose.position) avatar.position.lerp(new THREE.Vector3().fromArray(pose.position), context.blend);
    avatar.walking.update({
      position: avatar.position,
      yaw: pose.yaw,
      pitch: pose.pitch,
      squint: pose.squint ?? 0,
      deltaSeconds: context.deltaSeconds,
    });
    avatar.label.position.copy(avatar.position).setY(3.7);
  }

  animateHand(robot: Robot, pose: Pose | undefined, blend: number): void {
    const held = pose?.heldCard;
    const dragged = held
      ? robot.hand.children.find(child => child instanceof CardMesh && child.card.id === held.id)
      : null;
    animateFan(robot.hand, blend, dragged ?? null);
    if (held && dragged) followTransform(dragged, held, blend);
    // Restoring a card after a drag also restores its full fan orientation and scale.
    for (const card of robot.hand.children) {
      if (!(card instanceof CardMesh) || card === dragged) continue;
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        card.targetRotation,
      );
      card.quaternion.slerp(rotation, blend);
      card.scale.lerp(new THREE.Vector3(0.6, 0.6, 0.6), blend);
    }
  }

  private avatarFor(player: Player, context: { myId: string | null; slot: number }): void {
    const current = this.walkers.get(player.id);
    if (current?.robot.color === player.color) return;
    if (current) this.remove(player.id);
    const robot = new Robot(player.color, 'standing');
    const position = current?.position.clone() ?? playerSpawn(context.slot).setY(0);
    robot.group.position.copy(position);
    const label = nameLabel(player.name);
    this.world.add(robot.group, label);
    this.walkers.set(player.id, { robot, walking: new RobotWalking(robot, position), position, label });
    if (player.id !== context.myId) this.physics.addRobot(robot.group);
  }

  private remove(id: string): void {
    const avatar = this.walkers.get(id);
    if (!avatar) return;
    this.physics.removeObject(avatar.robot.group);
    avatar.robot.group.removeFromParent();
    avatar.label.removeFromParent();
    disposeMaterials(avatar.label);
    this.walkers.delete(id);
  }
}
