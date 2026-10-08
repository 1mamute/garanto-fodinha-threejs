/** The card in the middle of the screen: lobby, round score, deck vote or match result. */
import { COLORS, findPlayer, type VoteChoice } from '../../game';
import { html, type SafeHtml } from '../html';
import { icon } from '../icons';
import type { GameView } from './game';

export function centerCard(view: GameView): SafeHtml | null {
  switch (view.game.phase) {
    case 'lobby':
      return lobbyCard(view);
    case 'finished':
      return resultCard(view);
    case 'vote':
      return voteCard(view);
    case 'score':
      return scoreCard(view);
    case 'bet':
    case 'play':
    case 'trick':
      return null;
  }
}

function lobbyCard(view: GameView): SafeHtml {
  const { me, session } = view;
  const seated = me?.seated === true;
  const readyLabel = me?.ready ? 'Pronto! Voltar a esperar' : 'Estou pronto';
  return html`<section class="lobby-card">
    <span class="eyebrow">ANTES DA PRIMEIRA CARTA</span>
    <h2>${seated ? 'Seu lugar está reservado.' : 'Escolha seu lugar.'}</h2>
    <p>
      ${seated ? 'Marque pronto para começar.' : 'Escolha a cor do seu robô e sente à mesa.'}
    </p>
    ${!seated && colorPicker(view)}
    <button class="button primary full" data-action="${seated ? 'ready' : 'seat'}">
      ${seated ? readyLabel : 'Sentar à mesa'} ${icon('check')}
    </button>
    ${
      session.isHost
        ? hostOptions(view)
        : html`<p class="form-note">O host começa a partida quando todos estiverem prontos.</p>`
    }
  </section>`;
}

function colorPicker({ game, me }: GameView): SafeHtml {
  const swatches = COLORS.map(color => {
    const taken = game.players.some(player => player.id !== me?.id && player.color === color);
    const mine = me?.color === color;
    const label = `Cor ${color}${taken ? ', ocupada' : ''}`;
    let mark: SafeHtml | string = taken ? '×' : '';
    if (mine) mark = icon('check');
    return html`<button
      class="color-swatch ${mine ? 'selected' : ''}"
      style="--swatch:${color}"
      data-action="color"
      data-color="${color}"
      aria-label="${label}"
      ${(taken || me?.seated === true) && 'disabled'}
    >
      ${mark}
    </button>`;
  });
  return html`<div class="color-picker" aria-label="Cores do personagem">${swatches}</div>`;
}

function hostOptions({ game, living }: GameView): SafeHtml {
  const botCount = game.players.filter(player => player.bot).length;
  const options = Array.from({ length: game.settings.capacity }, (_, count) => {
    const label = count === 0 ? 'Sem bots' : `${count} bot${count > 1 ? 's' : ''}`;
    return html`<option value="${count}" ${botCount === count && 'selected'}>${label}</option>`;
  });
  const canStart =
    living.length >= 2 && living.every(player => player.ready && player.disconnectedAt === null);
  return html`<div class="host-options">
    <label
      >Adicionar bots <span class="optional">opcional</span
      ><select id="bot-count" aria-label="Quantidade de bots">
        ${options}
      </select></label
    >
    <button class="button dark full" data-action="start" ${!canStart && 'disabled'}>
      Começar a partida ${icon('arrow')}
    </button>
    <small>Todos os jogadores sentados precisam estar prontos.</small>
  </div>`;
}

function resultCard({ game, session }: GameView): SafeHtml {
  const winner = findPlayer(game, game.winner);
  const title = winner
    ? html`${winner.name}<br /><em>garantiu!</em>`
    : html`Todo mundo<br /><em>caiu junto.</em>`;
  return html`<section class="result-card">
    <span class="result-trophy">${icon('trophy', 48)}</span>
    <span class="eyebrow">PALPITE BOM, ROBÔ DE PÉ</span>
    <h2>${title}</h2>
    <p>
      ${winner ? 'O último sobrevivente da mesa. Até a próxima revanche.' : 'Um empate digno de uma mesa de robôs.'}
    </p>
    ${
      session.isHost
        ? html`<button class="button primary full" data-action="rematch">Mais uma? Nova partida</button>`
        : html`<p>Aguardando o host abrir a revanche.</p>`
    }
    <button class="text-button" data-action="leave">Voltar ao início</button>
  </section>`;
}

function voteCard({ game, me, observer, living }: GameView): SafeHtml {
  const myVote = me ? game.votes[me.id] : undefined;
  const voteButton = (choice: VoteChoice, label: string): SafeHtml =>
    html`<button
      class="button ${myVote === choice ? 'primary' : 'outlined'}"
      data-action="vote"
      data-value="${choice}"
      ${(observer || game.paused) && 'disabled'}
    >
      ${label}
    </button>`;
  return html`<section class="vote-card">
    <span class="eyebrow">QUARENTA CARTAS. MUITOS PALPITES.</span>
    <h2>O baralho pediu arrego.</h2>
    <p>Voltar para uma carta ou começar a diminuir?</p>
    <div class="vote-actions">${voteButton('reset', 'Reset · 1 carta')}${voteButton('down', 'Decrescente')}</div>
    <span class="vote-time" data-vote-time></span>
    <p class="form-note">
      ${Object.keys(game.votes).length}/${living.length} votos · empate é decidido por sorteio.
    </p>
  </section>`;
}

function scoreCard({ game }: GameView): SafeHtml {
  const results = game.history.at(-1)?.results ?? [];
  return html`<section class="score-card">
    <span class="eyebrow">ACERTO DE CONTAS</span>
    <h2>Quem garantiu, garantiu.</h2>
    <div class="score-grid">
      <span>Robô</span><span>Palpite</span><span>Vazas</span><span>Perda</span>
      ${results.map(
        result => html`<strong>${result.name}</strong><span>${result.bid}</span><span>${result.won}</span
          ><span class="${result.lost ? 'loss' : 'win'}">${result.lost ? `−${result.lost} ♥` : '✓'}</span>`,
      )}
    </div>
    <p class="form-note">A próxima rodada começa em instantes.</p>
  </section>`;
}
