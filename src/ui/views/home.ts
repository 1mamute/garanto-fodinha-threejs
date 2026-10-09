import type { PublicRoom } from '../../shared/protocol';
import { html, type SafeHtml } from '../html';
import { icon } from '../icons';
import type { UiState } from '../state';
import { dialog, helpDialog, logo } from './common';

export function homeView(ui: UiState): SafeHtml {
  const body = ui.screen === 'rooms' ? roomsPanel(ui) : hero(ui);
  return html`<div class="landing">
      <header class="site-header">
        ${logo()}
        <nav>
          ${import.meta.env.DEV && html`<a class="text-button" href="/?scene=lab">Sala de testes</a>`}
          <button class="text-button" data-action="help">Como jogar</button>
          <span class="nav-pill">${icon('users', 16)} 2–10 jogadores</span>
        </nav>
      </header>
      <main>${body}</main>
      <footer class="site-footer">
        <span>Uma mesa. Alguns palpites. Até a última vida.</span>
        <span class="footer-suits">♦ ♠ ♥ ♣</span>
      </footer>
    </div>
    ${homeModal(ui)}`;
}

function hero(ui: UiState): SafeHtml {
  return html`<section class="hero">
      <div class="eyebrow"><span class="tiny-dot"></span> A MESA ESTÁ ABERTA</div>
      <h1>Eu <em>garanto.</em></h1>
      <p class="intro">Quantas vazas você ganha?<br />Puxe uma cadeira e arrisque seu palpite.</p>
      <div class="hero-actions">
        <button class="button primary" data-action="rooms">Entrar na mesa ${icon('arrow')}</button>
        <button class="button outlined" data-action="create">${icon('plus')} Criar sala</button>
      </div>
      <button class="practice-link" data-action="practice">
        ${icon('robot')} Treinar com bots ${icon('arrow', 14)}
      </button>
      <button class="text-button" data-action="join-code">Tenho um código de sala</button>
      ${ui.savedSession && html`<button class="button resume" data-action="resume">Retomar minha sala</button>`}
    </section>
    <div class="scene-note">
      <span class="note-label">GARANTO · CLUBE DE CARTAS</span><span>O próximo lugar é seu.</span>
    </div>`;
}

function roomsPanel(ui: UiState): SafeHtml {
  return html`<section class="rooms-panel">
    <div class="eyebrow"><span class="tiny-dot"></span> MESAS ABERTAS</div>
    <div class="section-heading">
      <h1>Escolha sua <em>mesa.</em></h1>
      <button class="icon-button" data-action="refresh-rooms" aria-label="Atualizar salas">${icon('refresh')}</button>
    </div>
    <p class="intro">Entre, crie uma sala ou use um convite.</p>
    <div class="rooms-list">${roomList(ui)}</div>
    <div class="room-actions">
      <button class="button primary" data-action="create">${icon('plus')} Criar uma sala</button>
      <button class="button subtle" data-action="join-code">Entrar com código</button>
    </div>
    <button class="text-button" data-action="home">← Voltar ao início</button>
  </section>`;
}

function roomList(ui: UiState): SafeHtml {
  if (ui.roomsLoading) return html`<div class="empty-room">Procurando mesas…</div>`;
  if (ui.roomsError) {
    return html`<div class="empty-room">
      ${icon('users', 30)}<strong>Não conseguimos buscar as salas.</strong><span>${ui.roomsError}</span>
      <button class="text-button" data-action="refresh-rooms">Tentar novamente</button>
    </div>`;
  }
  if (!ui.rooms.length) {
    return html`<div class="empty-room">
      ${icon('cards', 32)}<strong>A primeira mesa pode ser a sua.</strong><span>Nenhuma sala aberta por enquanto.</span>
    </div>`;
  }
  return html`${ui.rooms.map(roomRow)}`;
}

function roomRow(room: PublicRoom): SafeHtml {
  const phase = room.phase === 'lobby' ? 'Na sala de espera' : 'Partida em andamento · entrar para assistir';
  return html`<button class="room-row" data-action="join" data-room="${room.id}" data-key="${room.id}">
    <span class="room-symbol">${icon(room.locked ? 'lock' : 'cards', 24)}</span>
    <span class="room-name"><strong>${room.name}</strong><small>${phase} · ${room.id}</small></span>
    <span class="room-count">${room.count}/${room.capacity}${icon('arrow', 18)}</span>
  </button>`;
}

function homeModal(ui: UiState): SafeHtml | null {
  switch (ui.modal?.type) {
    case 'create':
      return createDialog(ui);
    case 'join':
      return joinDialog(ui, ui.modal.room ?? '');
    case 'practice':
      return practiceDialog(ui);
    case 'help':
      return helpDialog();
    // Leaving is only offered during a match.
    case 'leave':
    case undefined:
      return null;
  }
}

function nameField(ui: UiState): SafeHtml {
  return html`<label
    >Seu nome<input
      name="playerName"
      value="${ui.playerName}"
      placeholder="Como chamamos seu robô?"
      maxlength="24"
      required
      autocomplete="nickname"
  /></label>`;
}

function submitButton(ui: UiState, idleLabel: string, busyLabel: string): SafeHtml {
  return html`<button class="button primary full" ${ui.busy && 'disabled'}>
    ${ui.busy ? busyLabel : idleLabel} ${icon('arrow')}
  </button>`;
}

function createDialog(ui: UiState): SafeHtml {
  const capacities = Array.from({ length: 9 }, (_, index) => index + 2);
  const content = html`<span class="eyebrow">VAI TER JOGO</span>
    <h2>Sua mesa, suas regras.</h2>
    <p>Convide os amigos e deixe o palpite por conta deles.</p>
    <form id="create-form">
      ${nameField(ui)}
      <label>Nome da sala<input name="name" value="Mesa dos amigos" maxlength="40" required /></label>
      <div class="form-row">
        <label
          >Lugares<select name="capacity">
            ${capacities.map(seats => html`<option ${seats === 6 && 'selected'}>${seats}</option>`)}
          </select></label
        >
        <label>Vidas iniciais<input type="number" name="lives" min="1" max="20" value="5" required /></label>
      </div>
      <label
        >Senha <span class="optional">opcional</span
        ><input
          type="password"
          name="password"
          maxlength="64"
          placeholder="Só entra quem sabe"
          autocomplete="new-password"
      /></label>
      <p class="form-note">Bots são opcionais e podem ser adicionados na sala de espera.</p>
      ${submitButton(ui, 'Criar sala', 'Abrindo a mesa…')}
    </form>`;
  return dialog(content, 'Criar sala');
}

function joinDialog(ui: UiState, roomCode: string): SafeHtml {
  const content = html`<span class="eyebrow">TEM LUGAR PRA VOCÊ</span>
    <h2>Puxe uma cadeira.</h2>
    <form id="join-form">
      ${nameField(ui)}
      <label
        >Código da sala<input
          name="room"
          value="${roomCode}"
          maxlength="6"
          pattern="[A-Za-z0-9]{6}"
          required
          placeholder="Ex.: A1B2C3"
          autocapitalize="characters"
      /></label>
      <label
        >Senha <span class="optional">se a sala pedir</span
        ><input name="password" type="password" maxlength="64" autocomplete="current-password"
      /></label>
      ${submitButton(ui, 'Entrar na sala', 'Conectando…')}
    </form>`;
  return dialog(content, 'Entrar na sala');
}

function practiceDialog(ui: UiState): SafeHtml {
  const botCounts = [1, 2, 3, 4, 5];
  const content = html`<span class="eyebrow">SEM PLATEIA, SEM PRESSÃO</span>
    <h2>Um treino de palpites.</h2>
    <form id="practice-form">
      ${nameField(ui)}
      <label
        >Companhia robótica<select name="bots">
          ${botCounts.map(
            count =>
              html`<option value="${count}" ${count === 3 && 'selected'}>${count} bot${count > 1 ? 's' : ''}</option>`,
          )}
        </select></label
      >
      <button class="button primary full">Vamos à mesa ${icon('arrow')}</button>
    </form>`;
  return dialog(content, 'Treinar com bots');
}
