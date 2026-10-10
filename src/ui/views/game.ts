import {
  canWalk,
  findPlayer,
  livingPlayers,
  manilhaRank,
  type GameState,
  type Phase,
  type Player,
} from '../../game';
import type { Session } from '../../net/session';
import { html, type SafeHtml } from '../html';
import { icon } from '../icons';
import { graphicsMenu } from '../graphicsMenu';
import type { UiState } from '../state';
import { dialog, helpDialog, logo, suitClass } from './common';
import { centerCard } from './center';
import { bidPanel, handPanel } from './hand';
import { chatPanel, inspectionPanel, watchedHand } from './panels';

/** Everything a game panel needs, computed once per render. */
export interface GameView {
  ui: UiState;
  game: GameState;
  session: Session;
  me: Player | undefined;
  living: Player[];
  myTurn: boolean;
  /** Not playing this match: never seated, eliminated or arrived mid-match. */
  observer: boolean;
}

export function createGameView(ui: UiState, game: GameState, session: Session): GameView {
  const me = findPlayer(game, session.memberId);
  return {
    ui,
    game,
    session,
    me,
    living: livingPlayers(game),
    myTurn: game.turn !== null && game.turn === me?.id,
    observer: !me?.seated || me.eliminated || me.spectator,
  };
}

const PHASE_LABELS: Record<Phase, string> = {
  lobby: 'Preparando a mesa',
  bet: 'Hora do palpite',
  play: 'Cartas na mesa',
  trick: 'Vaza encerrada',
  score: 'Acerto de contas',
  vote: 'O baralho acabou',
  finished: 'Fim de jogo',
};

export function gameScreen(view: GameView): SafeHtml {
  const { ui, game, me } = view;
  return html`${gameHeader(view)}${playersPanel(view)}
    <div class="event-banner" role="status">${game.lastEvent}</div>
    ${kickerInfo(game)}${centerCard(view)}${bidPanel(view)}${handPanel(view)}${viewControls(view)}
    ${ui.chatOpen && chatPanel(view)}${inspectionPanel(ui)}${watchedHand(view)}
    ${canWalk(me) && ui.cameraMode === 'first' && html`<div class="joystick" id="joystick" aria-label="Joystick para andar"><span></span></div>`}
    ${pauseOverlay(view)}${gameModal(ui)}`;
}

function gameHeader({ ui, game, session }: GameView): SafeHtml {
  const soundLabel = `${ui.soundEnabled ? 'Desativar' : 'Ativar'} som`;
  const tag = session.isLocal ? 'TREINO' : `SALA ${session.roomId ?? ''}`;
  const title = game.phase === 'lobby' ? (session.room?.name ?? 'Mesa de treino') : `Rodada ${game.round}`;
  return html`<header class="game-header">
    ${logo()}
    <div class="match-info">
      <span class="tag">${tag}</span><strong>${title}</strong><span>${PHASE_LABELS[game.phase]}</span>
    </div>
    <div class="game-toolbar">
      ${graphicsMenu()}
      <button class="icon-button" data-action="sound" aria-label="${soundLabel}" title="${soundLabel}">
        ${icon('volume')}${!ui.soundEnabled && html`<span class="off-line"></span>`}
      </button>
      <button class="icon-button ${ui.chatOpen ? 'active' : ''}" data-action="chat-toggle" aria-label="${ui.chatOpen ? 'Fechar' : 'Abrir'} chat" aria-expanded="${ui.chatOpen}">
        ${icon('chat')}
      </button>
      <button class="icon-button" data-action="help" aria-label="Como jogar">?</button>
      <button class="button small outlined" data-action="leave">Sair</button>
    </div>
  </header>`;
}

function playersPanel(view: GameView): SafeHtml {
  const { ui, game, session, living } = view;
  const players = game.players.filter(player => !player.spectator);
  return html`<aside class="players-panel">
    <div class="panel-title">NA MESA <span>${living.length}/${game.settings.capacity}</span></div>
    ${players.map(player => playerRow(view, player))}
    <div class="connection-status"><span class="tiny-dot"></span>${ui.connectionStatus}</div>
    ${!session.isLocal && html`<button class="text-button invite-link" data-action="invite">Copiar convite ${icon('arrow', 14)}</button>`}
  </aside>`;
}

function playerRow({ game, me }: GameView, player: Player): SafeHtml {
  const classes = [player.id === game.turn && 'current', player.eliminated && 'eliminated']
    .filter(Boolean)
    .join(' ');
  return html`<button
    class="player-row ${classes}"
    data-action="watch"
    data-player="${player.id}"
    data-key="${player.id}"
  >
    <span class="avatar" style="--robot-color:${player.color}"><span>● ●</span></span>
    <span class="player-meta">
      <strong>${player.name} ${player.id === me?.id && html`<small>você</small>`}</strong>
      <span>${playerStatus(game, player)}</span>
    </span>
    ${playerRecord(game, player)}
  </button>`;
}

function playerStatus(game: GameState, player: Player): SafeHtml | string {
  if (player.eliminated) return 'Espectador';
  if (game.phase !== 'lobby') return lives(player.lives);
  if (player.disconnectedAt !== null) return 'Reconectando…';
  if (player.ready) return 'Pronto ✓';
  return 'Sentado';
}

/** Up to ten hearts, then a counter, so huge life totals do not overflow the panel. */
function lives(count: number): SafeHtml {
  const overflow = count > 10 ? ` +${count - 10}` : '';
  return html`<span class="lives">${'♥'.repeat(Math.max(0, Math.min(count, 10)))}${overflow}</span>`;
}

function playerRecord(game: GameState, player: Player): SafeHtml {
  const dealerChip = player.id === game.dealer && html`<span class="dealer-chip" title="Dealer">D</span>`;
  let record: SafeHtml | null = null;
  if (game.phase !== 'lobby' && !player.eliminated) {
    record = html`<span>${player.won}/${player.bid ?? '–'}<small>vazas / aposta</small></span>`;
  } else if (player.bot) {
    record = html`<small>bot</small>`;
  }
  return html`<span class="player-record">${dealerChip}${record}</span>`;
}

function kickerInfo(game: GameState): SafeHtml | null {
  const { kicker } = game;
  if (!kicker) return null;
  return html`<div class="kicker-info">
    <span class="eyebrow">KICKER</span><strong class="${suitClass(kicker)}">${kicker.id}</strong
    ><span>Manilhas <b>${manilhaRank(kicker)}</b></span>
  </div>`;
}

function viewControls({ ui, observer, me }: GameView): SafeHtml {
  const label = ui.cameraMode === 'top' ? 'Primeira pessoa' : 'Ver de cima';
  return html`<div class="view-controls">
    <button class="button camera-button" data-action="camera">${icon('eye')} ${label} <kbd>espaço</kbd></button>
    ${observer && html`<span class="observer-label">${canWalk(me) ? 'ELIMINADO · WASD para passear' : 'ESPECTADOR · Aguardando a próxima partida'}</span>`}
  </div>`;
}

function pauseOverlay({ game, living }: GameView): SafeHtml | null {
  if (!game.paused) return null;
  const reconnecting = living.filter(player => player.disconnectedAt !== null);
  return html`<div class="pause-overlay">
    <section class="pause-card">
      <span class="eyebrow">GUARDAMOS A CADEIRA</span>
      <h2>Alguém ficou pelo caminho.</h2>
      <p>A partida está pausada para reconexão.</p>
      ${reconnecting.map(
        player => html`<div class="reconnect-row">
          <strong>${player.name}</strong><span data-reconnect="${player.disconnectedAt}"></span>
        </div>`,
      )}
      <small>Após 3 minutos, o jogador é eliminado e a rodada é redistribuída sem perda de vidas para os demais.</small>
    </section>
  </div>`;
}

function gameModal(ui: UiState): SafeHtml | null {
  if (ui.modal?.type === 'help') return helpDialog();
  if (ui.modal?.type !== 'leave') return null;
  const content = html`<h2>Vai deixar a mesa?</h2>
    <p>
      Sair elimina seu jogador e redistribui a rodada. O controle da sala passa para outro jogador se você for o
      host.
    </p>
    <button class="button primary full" data-action="confirm-leave">Sair da sala</button>
    <button class="text-button" data-action="close-modal">Continuar jogando</button>`;
  return dialog(content, 'Sair da sala');
}
