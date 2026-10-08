/** Side panels: chat, card inspection and a spectator's view of someone's hand. */
import { findPlayer } from '../../game';
import { html, type SafeHtml } from '../html';
import { icon } from '../icons';
import type { UiState } from '../state';
import { cardFace } from './common';
import type { GameView } from './game';

export function chatPanel({ game, ui }: GameView): SafeHtml {
  const messages = game.chat.length
    ? game.chat.map(
        message =>
          html`<p data-key="${message.id}"><strong>${message.name}</strong><span>${message.text}</span></p>`,
      )
    : html`<p class="chat-empty">Um “boa sorte” sempre cabe.<br />Um blefe também.</p>`;
  return html`<aside class="chat-panel">
    <div class="panel-title">
      CONVERSA DE MESA<button class="icon-button" data-action="chat-toggle" aria-label="Fechar chat">
        ${icon('close', 16)}
      </button>
    </div>
    <div class="chat-messages">${messages}</div>
    <form id="chat-form">
      <input
        id="chat-input"
        aria-label="Mensagem"
        name="text"
        placeholder="Diga alguma coisa…"
        value="${ui.chatDraft}"
        maxlength="240"
        autocomplete="off"
      />
      <button class="icon-button" aria-label="Enviar mensagem">${icon('arrow')}</button>
    </form>
  </aside>`;
}

function inspectionTitle(ui: UiState): string {
  const inspection = ui.inspection;
  if (inspection?.pileOwner) return `VAZA ${inspection.trickIndex ?? ''} · ${inspection.pileOwner}`;
  return inspection?.kicker ? 'KICKER DA RODADA' : 'CARTA NA MESA';
}

export function inspectionPanel(ui: UiState): SafeHtml | null {
  const { inspection } = ui;
  if (!inspection) return null;
  const pile =
    inspection.pile &&
    html`<div class="inspected-pile">
      ${inspection.pile.map(
        entry => html`<button data-action="inspect-pile-card" data-card="${entry.card.id}">
          ${entry.card.id} <span>${entry.playerName}</span>
        </button>`,
      )}
    </div>`;
  return html`<section class="inspection-panel">
    <button class="icon-button" data-action="stop-inspection" aria-label="Sair da inspeção">${icon('close')}</button>
    <span class="eyebrow">${inspectionTitle(ui)}</span>
    ${cardFace(inspection.card, 'inspected-face')}
    <strong>${inspection.kicker ? 'Define as manilhas' : `Jogada por ${inspection.playerName}`}</strong>
    ${pile}
    <small>ESC ou clique fora para voltar</small>
  </section>`;
}

export function watchedHand({ game, ui, observer }: GameView): SafeHtml | null {
  const watched = observer ? findPlayer(game, ui.watchedPlayerId) : undefined;
  if (!watched) return null;
  const cards = watched.hand.length ? watched.hand.map(card => cardFace(card)) : 'Mão vazia';
  return html`<section class="watched-hand">
    <button class="icon-button" data-action="close-watch" aria-label="Fechar mão">${icon('close')}</button>
    <span class="eyebrow">MÃO DE ${watched.name}</span>
    <div>${cards}</div>
  </section>`;
}
