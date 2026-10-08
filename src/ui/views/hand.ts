import { findPlayer, legalBids, manilhaRank, type Card, type Player } from '../../game';
import { html, type SafeHtml } from '../html';
import { icon } from '../icons';
import { cardFace } from './common';
import type { GameView } from './game';

export function bidPanel(view: GameView): SafeHtml | null {
  const { game, me, myTurn, observer } = view;
  if (game.phase !== 'bet' || observer || !me) return null;
  const legal = legalBids(game, me.id);
  const choices = Array.from({ length: game.cardsPerPlayer + 1 }, (_, bid) => bid);
  const turnName = findPlayer(game, game.turn)?.name ?? '';
  const someBidForbidden = legal.length < choices.length;
  return html`<div class="bid-panel">
    <div>
      <span class="eyebrow">${myTurn ? 'SEU PALPITE' : 'UM PALPITE DE CADA VEZ'}</span>
      <strong>${myTurn ? 'Quantas vazas você garante?' : `${turnName} está pensando…`}</strong>
    </div>
    <div class="bid-options">
      ${choices.map(bid => {
        const allowed = legal.includes(bid);
        const title = allowed ? `Apostar ${bid}` : 'A soma das apostas não pode fechar o total de vazas';
        return html`<button
          data-action="bid"
          data-value="${bid}"
          class="bid-button"
          ${(!myTurn || !allowed || game.paused) && 'disabled'}
          title="${title}"
        >
          ${bid}
        </button>`;
      })}
    </div>
    ${myTurn && someBidForbidden && html`<small>A última aposta não pode fechar a soma das vazas.</small>`}
  </div>`;
}

export function handPanel(view: GameView): SafeHtml | null {
  const { game, me, observer, ui } = view;
  const handVisible = game.phase === 'bet' || game.phase === 'play' || game.phase === 'trick';
  if (!handVisible || observer || !me) return null;
  const fromAbove = ui.cameraMode === 'top';
  const count = me.hand.length;
  return html`<section class="hand-panel ${fromAbove ? 'hand-disabled' : ''} ${ui.handOpen ? 'hand-expanded' : 'hand-collapsed'}">
    <div class="hand-heading">
      <span>${handHint(view)}</span>
      <button class="button subtle hand-toggle" data-action="hand-toggle" aria-expanded="${ui.handOpen}" aria-controls="hand-fallback" ${fromAbove && 'disabled'}>
        ${ui.handOpen ? 'Fechar cartas' : 'Cartas'} <small>${count}</small>
      </button>
    </div>
    ${handFallback(view, me)}
  </section>`;
}

function handFallback(view: GameView, me: Player): SafeHtml {
  return html`<div id="hand-fallback" ${!view.ui.handOpen && 'hidden'}>
    <div class="hand-cards">
      ${me.hand.map((card, index) => handCard(view, card, index))}
      ${!me.hand.length && html`<span class="empty-hand">Todas as cartas já foram à mesa.</span>`}
    </div>
    ${view.game.phase === 'play' && playButton(view, me)}
  </div>`;
}

function handHint({ game, ui, myTurn }: GameView): string {
  if (ui.cameraMode === 'top') return 'Volte à primeira pessoa para jogar';
  if (game.phase === 'play' && myTurn) return 'Sua vez · arraste uma carta para a mesa';
  return 'Arraste suas cartas para ordenar';
}

function handCard({ game, ui }: GameView, card: Card, index: number): SafeHtml {
  const isManilha = card.rank === manilhaRank(game.kicker);
  return html`<button
    class="hand-card ${ui.selectedCardId === card.id ? 'selected' : ''}"
    data-action="select-card"
    data-card="${card.id}"
    data-index="${index}"
    aria-label="${card.rank} de ${card.suit}"
    ${ui.cameraMode === 'top' && 'disabled'}
  >
    ${cardFace(card)}${isManilha && html`<span class="manilha-badge">M</span>`}
  </button>`;
}

function playButton({ game, ui, myTurn }: GameView, me: Player): SafeHtml {
  const selected = me.hand.find(card => card.id === ui.selectedCardId);
  const turnName = findPlayer(game, game.turn)?.name ?? '…';
  let label = `Vez de ${turnName}`;
  if (myTurn) label = selected ? `Jogar ${selected.id}` : 'Sua vez · escolha uma carta';
  const disabled = !selected || !myTurn || ui.cameraMode !== 'first' || game.paused;
  return html`<button class="button play-button ${myTurn ? 'primary' : 'subtle'}" data-action="play-selected" ${disabled && 'disabled'}>
    ${label} ${icon('arrow', 18)}
  </button>`;
}
