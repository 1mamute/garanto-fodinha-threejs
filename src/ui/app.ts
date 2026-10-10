/**
 * Interface controller: owns the UI state, reacts to DOM events and session updates, and
 * re-renders by morphing `#app` (see `dom.ts`), so focus and open menus survive updates.
 */
import { findPlayer, type Action, type GameState, type VoteChoice } from '../game';
import { api } from '../net/api';
import { Session } from '../net/session';
import type { CardRelease } from '../net/sceneMessages';
import { loadSavedSession } from '../net/storage';
import { TableScene } from '../scene/tableScene';
import type { CameraMode, CardInspection } from '../scene/types';
import { errorMessage } from '../shared/errors';
import type { PublicRoom, RoomIdentity } from '../shared/protocol';
import { updateCountdowns } from './countdowns';
import { morph } from './dom';
import { playSound, toast, type SoundKind } from './feedback';
import { HandDrag } from './handDrag';
import { copyInvite, inviteModal, roomRequest } from './invite';
import { bindJoystick } from './joystick';
import type { Modal, UiState } from './state';
import { createGameView, gameScreen } from './views/game';
import { homeView } from './views/home';

const ROOM_POLL_MS = 15_000;
const COUNTDOWN_MS = 500;
const NAME_KEY = 'garanto-name';
const SOUND_KEY = 'garanto-sound';

type ClickHandler = (button: HTMLElement) => void | Promise<void>;

export class App {
  readonly ui: UiState;
  readonly scene: TableScene;
  private readonly handDrag: HandDrag;
  private renderedChatCount = -1;

  constructor(
    private readonly root: HTMLElement,
    canvas: HTMLCanvasElement,
  ) {
    this.ui = {
      screen: 'home',
      modal: inviteModal(),
      cameraMode: 'landing',
      session: null,
      game: null,
      connectionStatus: '',
      selectedCardId: null,
      handOpen: false,
      rooms: [],
      roomsError: '',
      roomsLoading: false,
      busy: false,
      chatOpen: false,
      chatDraft: '',
      inspection: null,
      watchedPlayerId: null,
      soundEnabled: localStorage.getItem(SOUND_KEY) !== 'off',
      playerName: localStorage.getItem(NAME_KEY) ?? '',
      savedSession: loadSavedSession(),
    };
    this.scene = new TableScene(canvas, {
      onInspect: this.setInspection.bind(this),
      onPlay: this.playCard.bind(this),
      onPose: pose => {
        this.ui.session?.sendPose(pose);
      },
      onMode: this.setCameraMode.bind(this),
      onReorder: this.reorder.bind(this),
      isAuthority: () => this.ui.session?.isHost ?? true,
      onCards: frame => this.ui.session?.sendCards(frame),
    });
    this.handDrag = new HandDrag(root, {
      canDrag: () => this.ui.cameraMode === 'first',
      onPlay: cardId => {
        this.playCard(cardId);
      },
      onReorder: (cardId, index) => {
        this.reorder(cardId, index);
      },
      onDragEnd: () => {
        this.render();
      },
    });
    this.bindEvents();
    this.render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  render(): void {
    const { game, session } = this.ui;
    if (game && session) this.renderGame(game, session);
    else this.renderHome();
  }

  private renderHome(): void {
    document.body.classList.remove('playing');
    this.renderedChatCount = -1;
    morph(this.root, homeView(this.ui));
  }

  private renderGame(game: GameState, session: Session): void {
    if (this.handDrag.isDragging) return;
    document.body.classList.add('playing');
    const me = findPlayer(game, session.memberId);
    if (!me?.hand.some(card => card.id === this.ui.selectedCardId)) this.ui.selectedCardId = null;
    morph(this.root, gameScreen(createGameView(this.ui, game, session)));
    this.scrollChatIfNew(game);
    bindJoystick(this.root.querySelector<HTMLElement>('#joystick'), (x, y) => {
      this.scene.setJoystick(x, y);
    });
    updateCountdowns(this.root, this.ui.game);
  }

  /** Only jump to the newest message when one arrives, so reading older ones is not interrupted. */
  private scrollChatIfNew(game: GameState): void {
    const messages = this.root.querySelector('.chat-messages');
    if (!messages) {
      this.renderedChatCount = -1;
      return;
    }
    if (this.renderedChatCount === game.chat.length) return;
    this.renderedChatCount = game.chat.length;
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Session ────────────────────────────────────────────────────────────────

  private newSession(): Session {
    this.ui.session?.dispose(false);
    const session = new Session({
      onState: next => {
        this.onGameState(next, session);
      },
      onStatus: status => {
        this.ui.connectionStatus = status;
        if (this.ui.game) this.render();
      },
      onError: toast,
      onPose: (playerId, pose) => {
        this.scene.receivePose(playerId, pose);
      },
      onCards: frame => {
        this.scene.receiveCards(frame);
      },
      onCardRelease: release => {
        this.scene.receiveCardRelease(release);
      },
    });
    this.ui.session = session;
    return session;
  }

  private onGameState(next: GameState, session: Session): void {
    const previous = this.ui.game;
    if (previous && next.table.length > previous.table.length) this.sound('play');
    if (previous && next.phase === 'trick' && previous.phase !== 'trick') this.sound('win');
    this.ui.game = next;
    this.scene.setState(next, session.memberId);
    if (this.scene.mode === 'landing') this.scene.setMode('first');
    this.render();
  }

  private async goOnline(identity: RoomIdentity, playerName: string): Promise<void> {
    this.ui.modal = null;
    await this.newSession().online(identity, playerName);
  }

  private act(action: Action): void {
    this.ui.session?.action(action);
  }

  private sound(kind: SoundKind): void {
    if (this.ui.soundEnabled) playSound(kind);
  }

  private playCard(cardId: string, release?: CardRelease): void {
    if (this.ui.cameraMode !== 'first') {
      toast('Volte à primeira pessoa para jogar.');
      return;
    }
    this.ui.session?.action({ type: 'play', cardId }, release);
    this.ui.selectedCardId = null;
  }

  /** Moves a card to `index` inside the player's hand. */
  private reorder(cardId: string, index: number): void {
    const { game, session } = this.ui;
    if (this.ui.cameraMode !== 'first' || !game || !session) return;
    const ids = findPlayer(game, session.memberId)?.hand.map(card => card.id) ?? [];
    const from = ids.indexOf(cardId);
    if (from < 0) return;
    ids.splice(from, 1);
    ids.splice(index, 0, cardId);
    this.act({ type: 'reorder', ids });
  }

  private leaveTable(): void {
    this.ui.session?.dispose();
    Object.assign(this.ui, {
      session: null,
      game: null,
      selectedCardId: null,
      handOpen: false,
      watchedPlayerId: null,
      inspection: null,
      savedSession: null,
      modal: null,
      screen: 'home',
    } satisfies Partial<UiState>);
    this.scene.setMode('landing');
    this.scene.demo();
    this.render();
  }

  private async refreshRooms(): Promise<void> {
    if (this.ui.roomsLoading) return;
    this.ui.roomsLoading = true;
    this.ui.roomsError = '';
    this.render();
    try {
      this.ui.rooms = await api<PublicRoom[]>('/rooms');
    } catch (error) {
      this.ui.roomsError = errorMessage(error);
    }
    this.ui.roomsLoading = false;
    this.render();
  }

  private setInspection(inspection: CardInspection | null): void {
    this.ui.inspection = inspection;
    if (this.ui.game) this.render();
  }

  private setCameraMode(mode: CameraMode): void {
    this.ui.cameraMode = mode;
    if (this.ui.game) this.render();
  }

  private openModal(modal: Modal | null): void {
    this.ui.modal = modal;
    this.render();
  }

  // ── DOM events ─────────────────────────────────────────────────────────────

  private bindEvents(): void {
    this.root.addEventListener('click', event => void this.onClick(event));
    this.root.addEventListener('submit', event => void this.onSubmit(event));
    this.root.addEventListener('input', event => {
      this.onInput(event.target);
    });
    this.root.addEventListener('change', event => {
      const target = event.target as HTMLSelectElement;
      if (target.id === 'bot-count') this.act({ type: 'bots', count: Number(target.value) });
    });
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape' && this.ui.modal) this.openModal(null);
    });
    setInterval(() => {
      updateCountdowns(this.root, this.ui.game);
    }, COUNTDOWN_MS);
    setInterval(() => {
      if (!this.ui.game && this.ui.screen === 'rooms' && !this.ui.modal) void this.refreshRooms();
    }, ROOM_POLL_MS);
  }

  private onInput(target: EventTarget | null): void {
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'chat-input') this.ui.chatDraft = target.value;
    if (target.name === 'playerName') this.ui.playerName = target.value;
  }

  private async onClick(event: MouseEvent): Promise<void> {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-action]');
    if (!button || (button instanceof HTMLButtonElement && button.disabled)) return;
    event.preventDefault();
    const handler = this.clickHandlers[button.dataset.action ?? ''];
    if (!handler || this.ui.busy) return;
    try {
      await handler(button);
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  /** `data-action` → handler. Each entry is one button behaviour. */
  private readonly clickHandlers: Record<string, ClickHandler> = {
    home: () => {
      if (this.ui.game) this.openModal({ type: 'leave' });
      else {
        this.ui.screen = 'home';
        this.openModal(null);
      }
    },
    rooms: () => {
      this.ui.screen = 'rooms';
      return this.refreshRooms();
    },
    'refresh-rooms': () => this.refreshRooms(),
    create: this.openModal.bind(this, { type: 'create' }),
    join: button => {
      this.openModal({ type: 'join', room: button.dataset.room ?? '' });
    },
    'join-code': this.openModal.bind(this, { type: 'join' }),
    practice: this.openModal.bind(this, { type: 'practice' }),
    help: this.openModal.bind(this, { type: 'help' }),
    'close-modal': this.openModal.bind(this, null),
    resume: () => {
      const saved = this.ui.savedSession;
      if (!saved) return;
      this.ui.savedSession = null;
      return this.goOnline(saved, saved.playerName);
    },
    color: button => {
      this.act({ type: 'color', color: button.dataset.color ?? '' });
    },
    seat: () => {
      this.act({ type: 'seat' });
    },
    ready: () => {
      this.act({ type: 'ready' });
    },
    start: () => {
      this.act({ type: 'start' });
    },
    rematch: () => {
      this.ui.selectedCardId = null;
      this.act({ type: 'rematch' });
    },
    bid: button => {
      this.act({ type: 'bid', value: Number(button.dataset.value) });
    },
    vote: button => {
      this.act({ type: 'vote', value: button.dataset.value as VoteChoice });
    },
    'select-card': button => {
      if (this.handDrag.clickSuppressed) return;
      this.ui.selectedCardId = button.dataset.card ?? null;
      this.render();
    },
    'play-selected': () => {
      if (this.ui.selectedCardId) this.playCard(this.ui.selectedCardId);
    },
    'hand-toggle': () => {
      this.ui.handOpen = !this.ui.handOpen;
      this.render();
    },
    camera: () => {
      this.scene.toggleMode();
    },
    'chat-toggle': () => {
      this.ui.chatOpen = !this.ui.chatOpen;
      this.render();
    },
    sound: () => {
      this.ui.soundEnabled = !this.ui.soundEnabled;
      localStorage.setItem(SOUND_KEY, this.ui.soundEnabled ? 'on' : 'off');
      this.render();
    },
    'stop-inspection': () => {
      this.scene.clearInspection();
    },
    'inspect-pile-card': button => {
      const entry = this.ui.inspection?.pile?.find(candidate => candidate.card.id === button.dataset.card);
      if (entry && this.ui.inspection) this.setInspection({ ...this.ui.inspection, ...entry });
    },
    watch: button => {
      this.watchPlayer(button.dataset.player ?? null);
    },
    'close-watch': () => {
      this.watchPlayer(null);
    },
    invite: () => copyInvite(this.ui.session?.roomId ?? null),
    leave: this.openModal.bind(this, { type: 'leave' }),
    'confirm-leave': () => {
      this.leaveTable();
    },
  };

  /** Only spectators may look at other players' hands. */
  private watchPlayer(playerId: string | null): void {
    const { game, session } = this.ui;
    const me = game && session ? findPlayer(game, session.memberId) : undefined;
    const observer = !me?.seated || me.eliminated || me.spectator;
    if (playerId !== null && !observer) return;
    this.ui.watchedPlayerId = playerId;
    this.render();
  }

  private async onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = Object.fromEntries(
      [...new FormData(form)].map(([key, value]) => [key, typeof value === 'string' ? value : '']),
    );
    if (form.id === 'chat-form') {
      this.sendChat(form, data.text ?? '');
      return;
    }
    if (this.ui.busy) return;
    const playerName = (data.playerName ?? '').trim();
    if (!playerName) return;
    this.ui.playerName = playerName;
    localStorage.setItem(NAME_KEY, playerName);
    if (form.id === 'practice-form') {
      this.ui.modal = null;
      this.newSession().startLocal(playerName, Number(data.bots));
      return;
    }
    await this.enterRoom(form.id, data, playerName);
  }

  private sendChat(form: HTMLFormElement, text: string): void {
    this.act({ type: 'chat', text });
    this.ui.chatDraft = '';
    const input = form.querySelector<HTMLInputElement>('#chat-input');
    if (input) input.value = '';
  }

  /** Creates or joins a room through the server, then connects to it. */
  private async enterRoom(formId: string, data: Record<string, string>, playerName: string): Promise<void> {
    const request = roomRequest(formId, data);
    if (!request) return;
    this.ui.busy = true;
    this.render();
    try {
      const identity = await api<RoomIdentity>(request.path, request.body);
      await this.goOnline(identity, playerName);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      this.ui.busy = false;
      this.render();
    }
  }
}
