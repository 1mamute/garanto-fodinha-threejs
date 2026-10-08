import './style.css';
import { alive, byId, COLORS, legalBids, manilha, RECONNECT_MS } from './game.js';
import { api, Session } from './network.js';
import { TableScene } from './scene.js';

const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const suitClass = card => ['♥', '♦'].includes(card.suit) ? 'red' : '';
const icon = (name, size = 20) => {
  const paths = { arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
    chat: '<path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    volume: '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    cards: '<rect x="8" y="3" width="12" height="17" rx="2"/><path d="m8 7-5 1a2 2 0 0 0-2 3l3 10a2 2 0 0 0 3 1l5-2"/>',
    robot: '<rect x="4" y="7" width="16" height="13" rx="5"/><path d="M12 7V3m-8 9H2m18 0h2m-13 4h6"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 5 4m7-7h4v3a4 4 0 0 1-5 4m-3 1v7m-4 0h8"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.cards}</svg>`;
};
let session = null, state = null, screen = 'home', modal = null, mode = 'landing', status = '', selected = null;
let roomList = [], roomError = '', roomsLoading = false, busy = false, showChat = false, inspection = null, watchedPlayer = null;
let soundEnabled = localStorage.getItem('garanto-sound') !== 'off', audio = null;
let draft = '', playerName = localStorage.getItem('garanto-name') || '', savedSession;
try { savedSession = JSON.parse(sessionStorage.getItem('garanto-session')); } catch { /* empty session */ }
const scene = new TableScene(document.querySelector('#scene'), {
  onInspect: data => { inspection = data; if (state) renderGame(); },
  onPlay: cardId => playCard(cardId),
  onPose: pose => session?.pose(pose),
  onMode: next => { mode = next; if (state) renderGame(); },
  onReorder: (cardId, index) => reorder(cardId, index),
});
function toast(message) {
  const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('visible'), 4500);
}
function sound(kind) {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'play' ? 460 : 660, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(kind === 'play' ? 180 : 880, audio.currentTime + .13);
    gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .18);
    osc.start(); osc.stop(audio.currentTime + .19);
  } catch { /* audio is optional */ }
}
function logo() { return `<a class="brand" href="#" data-action="home" aria-label="Garanto, início"><span class="brand-mark">g<span>♣</span></span>garanto<span class="brand-dot">.</span></a>`; }
function cardFace(card, extra = '') {
  return `<span class="card-face ${suitClass(card)} ${extra}"><span class="card-corner">${esc(card.rank)}<small>${esc(card.suit)}</small></span><span class="card-suit">${esc(card.suit)}</span><span class="card-corner bottom">${esc(card.rank)}<small>${esc(card.suit)}</small></span></span>`;
}
function dialog(content, title) {
  return `<div class="dialog-shade"><section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="icon-button dialog-close" data-action="close-modal" aria-label="Fechar">${icon('close')}</button>${content}</section></div>`;
}
function nameField() { return `<label>Seu nome<input name="playerName" value="${esc(playerName)}" placeholder="Como chamamos seu robô?" maxlength="24" required autocomplete="nickname" /></label>`; }
function renderHome() {
  document.body.classList.remove('playing');
  let body;
  if (screen === 'rooms') {
    body = `<section class="rooms-panel"><div class="eyebrow"><span class="tiny-dot"></span> SEM CERIMÔNIA. PUXE UMA CADEIRA.</div>
      <div class="section-heading"><h1>Uma mesa<br>para chamar de <em>sua.</em></h1><button class="icon-button" data-action="refresh-rooms" aria-label="Atualizar salas">${icon('refresh')}</button></div>
      <p class="intro">Entre com seus amigos. Ou faça alguns novos.</p>
      <div class="rooms-list">${roomsLoading ? '<div class="empty-room">Procurando mesas…</div>' : roomError ? `<div class="empty-room">${icon('users', 30)}<strong>Não conseguimos buscar as salas.</strong><span>${esc(roomError)}</span><button class="text-button" data-action="refresh-rooms">Tentar novamente</button></div>` : roomList.length ? roomList.map(r => `<button class="room-row" data-action="join" data-room="${esc(r.id)}"><span class="room-symbol">${icon(r.locked ? 'lock' : 'cards', 24)}</span><span class="room-name"><strong>${esc(r.name)}</strong><small>${r.phase === 'lobby' ? 'Na sala de espera' : 'Partida em andamento · entrar para assistir'} · ${esc(r.id)}</small></span><span class="room-count">${r.count}/${r.capacity}${icon('arrow', 18)}</span></button>`).join('') : `<div class="empty-room">${icon('cards', 32)}<strong>A primeira mesa pode ser a sua.</strong><span>Nenhuma sala aberta por enquanto.</span></div>`}</div>
      <div class="room-actions"><button class="button primary" data-action="create">${icon('plus')} Criar uma sala</button><button class="button subtle" data-action="join-code">Entrar com código</button></div>
      <button class="text-button" data-action="home">← Voltar ao início</button></section>`;
  } else {
    body = `<section class="hero"><div class="eyebrow"><span class="tiny-dot"></span> CARTAS NA MESA. CONFIANÇA NEM TANTO.</div>
      <h1>Eu <em>garanto.</em><br>Você arrisca?</h1>
      <p class="intro">Aposte nas suas cartas. Acerte seu palpite.<br>Seja o último robô de pé.</p>
      <div class="hero-actions"><button class="button primary" data-action="rooms">Encontrar uma mesa ${icon('arrow')}</button><button class="button outlined" data-action="create">${icon('plus')} Criar sala</button></div>
      <button class="practice-link" data-action="practice">${icon('robot')} Só você e os bots <span>um treino sem pressão ↗</span></button>
      ${savedSession ? '<button class="button resume" data-action="resume">Retomar minha sala</button>' : ''}
      <div class="hero-stats"><div><strong>2–10</strong><span>jogadores</span></div><div><strong>5 <span class="hearts">♥</span></strong><span>vidas pra arriscar</span></div><div><strong>100%</strong><span>entre amigos</span></div></div>
    </section>
    <div class="scene-note"><span class="note-label">A MESA ESTÁ POSTA</span><span>O blefe é seu.<br>O charme é dos robôs.</span><span class="note-scribble">↖</span></div>`;
  }
  let overlay = '';
  if (modal?.type === 'create') overlay = dialog(`<span class="eyebrow">VAI TER JOGO</span><h2>Sua mesa, suas regras.</h2><p>Convide os amigos e deixe o palpite por conta deles.</p><form id="create-form">${nameField()}<label>Nome da sala<input name="name" value="Mesa dos amigos" maxlength="40" required /></label><div class="form-row"><label>Lugares<select name="capacity">${Array.from({ length: 9 }, (_, i) => `<option ${i === 4 ? 'selected' : ''}>${i + 2}</option>`).join('')}</select></label><label>Vidas iniciais<input type="number" name="lives" min="1" max="20" value="5" required /></label></div><label>Senha <span class="optional">opcional</span><input type="password" name="password" maxlength="64" placeholder="Só entra quem sabe" autocomplete="new-password" /></label><p class="form-note">Bots são opcionais e podem ser adicionados na sala de espera.</p><button class="button primary full" ${busy ? 'disabled' : ''}>${busy ? 'Abrindo a mesa…' : 'Criar sala'} ${icon('arrow')}</button></form>`, 'Criar sala');
  if (modal?.type === 'join') overlay = dialog(`<span class="eyebrow">TEM LUGAR PRA VOCÊ</span><h2>Puxe uma cadeira.</h2><form id="join-form">${nameField()}<label>Código da sala<input name="room" value="${esc(modal.room ?? '')}" maxlength="6" pattern="[A-Za-z0-9]{6}" required placeholder="Ex.: A1B2C3" autocapitalize="characters" /></label><label>Senha <span class="optional">se a sala pedir</span><input name="password" type="password" maxlength="64" autocomplete="current-password" /></label><button class="button primary full" ${busy ? 'disabled' : ''}>${busy ? 'Conectando…' : 'Entrar na sala'} ${icon('arrow')}</button></form>`, 'Entrar na sala');
  if (modal?.type === 'practice') overlay = dialog(`<span class="eyebrow">SEM PLATEIA, SEM PRESSÃO</span><h2>Um treino de palpites.</h2><form id="practice-form">${nameField()}<label>Companhia robótica<select name="bots">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} bot${n > 1 ? 's' : ''}</option>`).join('')}</select></label><button class="button primary full">Vamos à mesa ${icon('arrow')}</button></form>`, 'Treinar com bots');
  if (modal?.type === 'help') overlay = helpDialog();
  app.innerHTML = `<div class="landing"><header class="site-header">${logo()}<nav><button class="text-button" data-action="help">Como jogar</button><span class="nav-pill">${icon('users', 16)} Feito pra reunir</span></nav></header><main>${body}</main><footer class="site-footer"><span>Um jogo de cartas. Uma boa desculpa pra se reunir.</span><span>feito de palpites <span class="footer-suits">♦ ♠ ♥ ♣</span></span></footer></div>${overlay}`;
}
function helpDialog() {
  return dialog(`<span class="eyebrow">MANUAL DE SOBREVIVÊNCIA</span><h2>Garanta só o que aguenta.</h2><div class="help-steps"><p><b>01 · Olhe suas cartas.</b> Você começa com uma carta e recebe mais nas rodadas seguintes. O kicker promove o próximo valor a manilha.</p><p><b>02 · Faça seu palpite.</b> Aposte quantas vazas vai ganhar. O dealer aposta por último e não pode fechar a soma no total de vazas.</p><p><b>03 · Jogue uma carta.</b> A carta mais forte ganha. Pode jogar qualquer carta, sem obrigação de seguir naipe.</p><p><b>04 · Acerte ou pague.</b> Perde uma vida por cada vaza de diferença entre o palpite e o resultado. O último com vidas vence.</p></div><div class="ranking"><small>DO MENOR PARA O MAIOR</small><p>4 · 5 · 6 · 7 · Q · J · K · A · 2 · 3</p><p>♦ &lt; ♠ &lt; ♥ &lt; ♣</p></div><p class="form-note">Espaço alterna a câmera. Arraste a área livre para olhar. Arraste cartas para reordenar ou jogar na mesa. De cima, passe o mouse por dois segundos ou toque prolongadamente para inspecionar. Eliminados usam WASD ou joystick para passear.</p><button class="button primary full" data-action="close-modal">Entendi. Bora jogar.</button>`, 'Como jogar');
}
function renderGame() {
  if (!state || !session) return;
  if (cardDrag?.moved) return;
  document.body.classList.add('playing');
  const me = byId(state, session.identity.memberId), living = alive(state), myTurn = state.turn === me?.id;
  const observer = !me?.seated || me?.eliminated || me?.spectator;
  const focus = document.activeElement?.id;
  const caret = document.activeElement?.selectionStart;
  const selectedCard = me?.hand.find(c => c.id === selected);
  if (!selectedCard) selected = null;
  const phaseLabel = { lobby: 'Sala de espera', bet: 'Hora do palpite', play: 'Cartas na mesa', trick: 'Vaza encerrada', score: 'Acerto de contas', vote: 'O baralho acabou', finished: 'Fim de jogo' }[state.phase];
  const top = `<header class="game-header">${logo()}<div class="match-info"><span class="tag">${session.isLocal ? 'TREINO' : `SALA ${esc(session.identity.roomId)}`}</span><strong>${state.phase === 'lobby' ? esc(session.room?.name ?? 'Mesa de treino') : `Rodada ${state.round}`}</strong><span>${esc(phaseLabel)}</span></div><div class="game-toolbar"><button class="icon-button" data-action="sound" aria-label="${soundEnabled ? 'Desativar' : 'Ativar'} som" title="${soundEnabled ? 'Desativar' : 'Ativar'} som">${icon('volume')}${!soundEnabled ? '<span class="off-line"></span>' : ''}</button><button class="icon-button ${showChat ? 'active' : ''}" data-action="chat-toggle" aria-label="Abrir chat">${icon('chat')}</button><button class="icon-button" data-action="help" aria-label="Como jogar">?</button><button class="button small outlined" data-action="leave">Sair</button></div></header>`;
  const players = `<aside class="players-panel"><div class="panel-title">NA MESA <span>${living.length}/${state.settings.capacity}</span></div>${state.players.filter(p => !p.spectator).map(p => `<button class="player-row ${p.id === state.turn ? 'current' : ''} ${p.eliminated ? 'eliminated' : ''}" data-action="watch" data-player="${esc(p.id)}"><span class="avatar" style="--robot-color:${p.color}"><span>● ●</span></span><span class="player-meta"><strong>${esc(p.name)} ${p.id === me?.id ? '<small>você</small>' : ''}</strong><span>${p.eliminated ? 'Espectador' : state.phase === 'lobby' ? p.disconnectedAt !== null ? 'Reconectando…' : p.ready ? 'Pronto ✓' : p.seated ? 'Sentado' : 'Escolhendo cor' : `<span class="lives">${'♥'.repeat(Math.min(p.lives, 10))}${p.lives > 10 ? ` +${p.lives - 10}` : ''}</span>`}</span></span><span class="player-record">${p.id === state.dealer ? '<span class="dealer-chip" title="Dealer">D</span>' : ''}${state.phase !== 'lobby' && !p.eliminated ? `<span>${p.won}/${p.bid ?? '–'}<small>vazas / aposta</small></span>` : p.bot ? '<small>bot</small>' : ''}</span></button>`).join('')}<div class="connection-status"><span class="tiny-dot"></span>${esc(status)}</div>${!session.isLocal ? `<button class="text-button invite-link" data-action="invite">Copiar convite ${icon('arrow', 14)}</button>` : ''}</aside>`;
  let center = '';
  if (state.phase === 'lobby') {
    center = `<section class="lobby-card"><span class="eyebrow">PODE CHEGAR, A CASA É SUA</span><h2>${me?.seated ? 'Confortável aí?' : 'Qual é a sua cor?'}</h2><p>${me?.seated ? 'Sua cor está confirmada. Marque pronto quando quiser começar.' : 'Escolha uma cor e sente à mesa para confirmar.'}</p><div class="color-picker" aria-label="Cores do personagem">${COLORS.map(c => {
      const taken = state.players.some(p => p.id !== me?.id && p.color === c);
      return `<button class="color-swatch ${me?.color === c ? 'selected' : ''}" style="--swatch:${c}" data-action="color" data-color="${c}" aria-label="Cor ${c}${taken ? ', ocupada' : ''}" ${taken || me?.seated ? 'disabled' : ''}>${me?.color === c ? icon('check') : taken ? '×' : ''}</button>`;
    }).join('')}</div><button class="button primary full" data-action="${me?.seated ? 'ready' : 'seat'}">${me?.seated ? me.ready ? 'Pronto! Voltar a esperar' : 'Estou pronto' : 'Sentar à mesa'} ${icon('check')}</button>${session.isHost ? `<div class="host-options"><label>Adicionar bots <span class="optional">opcional</span><select id="bot-count" aria-label="Quantidade de bots">${Array.from({ length: state.settings.capacity }, (_, n) => `<option value="${n}" ${state.players.filter(p => p.bot).length === n ? 'selected' : ''}>${n === 0 ? 'Sem bots' : `${n} bot${n > 1 ? 's' : ''}`}</option>`).join('')}</select></label><button class="button dark full" data-action="start" ${living.length < 2 || living.some(p => !p.ready || p.disconnectedAt !== null) ? 'disabled' : ''}>Começar a partida ${icon('arrow')}</button><small>Todos os jogadores sentados precisam estar prontos.</small></div>` : '<p class="form-note">O host começa a partida quando todos estiverem prontos.</p>'}</section>`;
  } else if (state.phase === 'finished') {
    const winner = byId(state, state.winner);
    center = `<section class="result-card"><span class="result-trophy">${icon('trophy', 48)}</span><span class="eyebrow">PALPITE BOM, ROBÔ DE PÉ</span><h2>${winner ? `${esc(winner.name)}<br><em>garantiu!</em>` : 'Todo mundo<br><em>caiu junto.</em>'}</h2><p>${winner ? 'O último sobrevivente da mesa. Até a próxima revanche.' : 'Um empate digno de uma mesa de robôs.'}</p>${session.isHost ? '<button class="button primary full" data-action="rematch">Mais uma? Nova partida</button>' : '<p>Aguardando o host abrir a revanche.</p>'}<button class="text-button" data-action="leave">Voltar ao início</button></section>`;
  } else if (state.phase === 'vote') {
    center = `<section class="vote-card"><span class="eyebrow">QUARENTA CARTAS. MUITOS PALPITES.</span><h2>O baralho pediu arrego.</h2><p>Voltar para uma carta ou começar a diminuir?</p><div class="vote-actions"><button class="button ${state.votes[me?.id] === 'reset' ? 'primary' : 'outlined'}" data-action="vote" data-value="reset" ${observer || state.paused ? 'disabled' : ''}>Reset · 1 carta</button><button class="button ${state.votes[me?.id] === 'down' ? 'primary' : 'outlined'}" data-action="vote" data-value="down" ${observer || state.paused ? 'disabled' : ''}>Decrescente</button></div><span class="vote-time" data-vote-time></span><p class="form-note">${Object.keys(state.votes).length}/${living.length} votos · empate é decidido por sorteio.</p></section>`;
  } else if (state.phase === 'score') {
    center = `<section class="score-card"><span class="eyebrow">ACERTO DE CONTAS</span><h2>Quem garantiu, garantiu.</h2><div class="score-grid"><span>Robô</span><span>Palpite</span><span>Vazas</span><span>Perda</span>${state.history.at(-1)?.results.map(r => `<strong>${esc(r.name)}</strong><span>${r.bid}</span><span>${r.won}</span><span class="${r.lost ? 'loss' : 'win'}">${r.lost ? `−${r.lost} ♥` : '✓'}</span>`).join('') ?? ''}</div><p class="form-note">A próxima rodada começa em instantes.</p></section>`;
  }
  let actionPanel = '';
  if (state.phase === 'bet' && !observer) {
    const legal = legalBids(state, me.id);
    actionPanel = `<div class="bid-panel"><div><span class="eyebrow">${myTurn ? 'SEU PALPITE' : 'UM PALPITE DE CADA VEZ'}</span><strong>${myTurn ? 'Quantas vazas você garante?' : `${esc(byId(state, state.turn)?.name)} está pensando…`}</strong></div><div class="bid-options">${Array.from({ length: state.cardsPerPlayer + 1 }, (_, n) => `<button data-action="bid" data-value="${n}" class="bid-button" ${!myTurn || !legal.includes(n) || state.paused ? 'disabled' : ''} title="${legal.includes(n) ? `Apostar ${n}` : 'A soma das apostas não pode fechar o total de vazas'}">${n}</button>`).join('')}</div>${myTurn && legal.length < state.cardsPerPlayer + 1 ? '<small>A última aposta não pode fechar a soma das vazas.</small>' : ''}</div>`;
  }
  const hand = !observer && ['bet', 'play', 'trick'].includes(state.phase) ? `<section class="hand-panel ${mode === 'top' ? 'hand-disabled' : ''}"><div class="hand-heading"><span>SUA MÃO <small>${me.hand.length} carta${me.hand.length !== 1 ? 's' : ''}</small></span><span>${mode === 'top' ? 'Volte à primeira pessoa para jogar' : 'Arraste para ordenar · para cima para jogar'}</span></div><div class="hand-cards">${me.hand.map((c, index) => `<button class="hand-card ${selected === c.id ? 'selected' : ''}" data-action="select-card" data-card="${esc(c.id)}" data-index="${index}" aria-label="${esc(c.rank)} de ${esc(c.suit)}" ${mode === 'top' ? 'disabled' : ''}>${cardFace(c)}${c.rank === manilha(state.kicker) ? '<span class="manilha-badge">M</span>' : ''}</button>`).join('')}${!me.hand.length ? '<span class="empty-hand">Todas as cartas já foram à mesa.</span>' : ''}</div>${state.phase === 'play' ? `<button class="button play-button ${myTurn ? 'primary' : 'subtle'}" data-action="play-selected" ${!selected || !myTurn || mode !== 'first' || state.paused ? 'disabled' : ''}>${myTurn ? selectedCard ? `Jogar ${esc(selectedCard.id)}` : 'Sua vez · escolha uma carta' : `Vez de ${esc(byId(state, state.turn)?.name ?? '…')}`} ${icon('arrow', 18)}</button>` : ''}</section>` : '';
  const kicker = state.kicker ? `<div class="kicker-info"><span class="eyebrow">KICKER</span><strong class="${suitClass(state.kicker)}">${esc(state.kicker.id)}</strong><span>Manilhas <b>${esc(manilha(state.kicker))}</b></span></div>` : '';
  const viewControls = `<div class="view-controls"><button class="button camera-button" data-action="camera">${icon('eye')} ${mode === 'top' ? 'Primeira pessoa' : 'Ver de cima'} <kbd>espaço</kbd></button>${observer ? '<span class="observer-label">ESPECTADOR · WASD para passear</span>' : ''}</div>`;
  const chat = showChat ? `<aside class="chat-panel"><div class="panel-title">CONVERSA DE MESA<button class="icon-button" data-action="chat-toggle" aria-label="Fechar chat">${icon('close', 16)}</button></div><div class="chat-messages">${state.chat.length ? state.chat.map(m => `<p><strong>${esc(m.name)}</strong><span>${esc(m.text)}</span></p>`).join('') : '<p class="chat-empty">Um “boa sorte” sempre cabe.<br>Um blefe também.</p>'}</div><form id="chat-form"><input id="chat-input" aria-label="Mensagem" name="text" placeholder="Diga alguma coisa…" value="${esc(draft)}" maxlength="240" autocomplete="off" /><button class="icon-button" aria-label="Enviar mensagem">${icon('arrow')}</button></form></aside>` : '';
  const inspect = inspection ? `<section class="inspection-panel"><button class="icon-button" data-action="stop-inspection" aria-label="Sair da inspeção">${icon('close')}</button><span class="eyebrow">${inspection.pileOwner ? `VAZA ${inspection.trickIndex} · ${esc(inspection.pileOwner)}` : inspection.kicker ? 'KICKER DA RODADA' : 'CARTA NA MESA'}</span>${cardFace(inspection.card, 'inspected-face')}<strong>${inspection.kicker ? 'Define as manilhas' : `Jogada por ${esc(inspection.playerName)}`}</strong>${inspection.pile ? `<div class="inspected-pile">${inspection.pile.map(e => `<button data-action="inspect-pile-card" data-card="${esc(e.card.id)}">${esc(e.card.id)} <span>${esc(e.playerName)}</span></button>`).join('')}</div>` : ''}<small>ESC ou clique fora para voltar</small></section>` : '';
  const watched = observer && watchedPlayer ? `<section class="watched-hand"><button class="icon-button" data-action="close-watch" aria-label="Fechar mão">${icon('close')}</button><span class="eyebrow">MÃO DE ${esc(byId(state, watchedPlayer)?.name)}</span><div>${byId(state, watchedPlayer)?.hand.map(c => cardFace(c)).join('') || 'Mão vazia'}</div></section>` : '';
  const paused = state.paused ? `<div class="pause-overlay"><section class="pause-card"><span class="eyebrow">GUARDAMOS A CADEIRA</span><h2>Alguém ficou pelo caminho.</h2><p>A partida está pausada para reconexão.</p>${living.filter(p => p.disconnectedAt !== null).map(p => `<div class="reconnect-row"><strong>${esc(p.name)}</strong><span data-reconnect="${p.disconnectedAt}"></span></div>`).join('')}<small>Após 3 minutos, o jogador é eliminado e a rodada é redistribuída sem perda de vidas para os demais.</small></section></div>` : '';
  app.innerHTML = `${top}${players}<div class="event-banner">${esc(state.lastEvent)}</div>${kicker}${center}${actionPanel}${hand}${viewControls}${chat}${inspect}${watched}${observer && mode === 'first' ? '<div class="joystick" id="joystick" aria-label="Joystick para andar"><span></span></div>' : ''}${paused}${modal?.type === 'help' ? helpDialog() : modal?.type === 'leave' ? dialog('<h2>Vai deixar a mesa?</h2><p>Sair elimina seu jogador e redistribui a rodada. O controle da sala passa para outro jogador se você for o host.</p><button class="button primary full" data-action="confirm-leave">Sair da sala</button><button class="text-button" data-action="close-modal">Continuar jogando</button>', 'Sair da sala') : ''}`;
  if (focus === 'chat-input') { const input = document.querySelector('#chat-input'); input?.focus(); input?.setSelectionRange(caret, caret); }
  const messages = document.querySelector('.chat-messages'); if (messages) messages.scrollTop = messages.scrollHeight;
  bindJoystick(); updateCountdowns();
}
function updateCountdowns() {
  document.querySelectorAll('[data-reconnect]').forEach(el => {
    const seconds = Math.max(0, Math.ceil((RECONNECT_MS - (Date.now() - Number(el.dataset.reconnect))) / 1000));
    el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
  const vote = document.querySelector('[data-vote-time]');
  if (vote && state) vote.textContent = `${Math.max(0, Math.ceil((state.voteEndsAt - (state.paused ? state.pausedAt : Date.now())) / 1000))}s para votar`;
}
setInterval(updateCountdowns, 500);
function newSession() {
  session?.dispose(false);
  session = new Session({ onState: next => {
    if (state && next.table.length > state.table.length) sound('play');
    if (state && next.phase === 'trick' && state.phase !== 'trick') sound('win');
    state = next; scene.setState(next, session.identity.memberId);
    if (scene.mode === 'landing') { mode = 'first'; scene.setMode('first'); }
    renderGame();
  }, onStatus: next => { status = next; if (state) renderGame(); }, onError: toast, onPose: (id, pose) => scene.receivePose(id, pose) });
  return session;
}
async function refreshRooms() {
  if (roomsLoading) return;
  roomsLoading = true; roomError = ''; renderHome();
  try { roomList = await api('/rooms'); } catch (e) { roomError = e.message; }
  roomsLoading = false; if (!state) renderHome();
}
function playCard(cardId) {
  if (mode !== 'first') { toast('Volte à primeira pessoa para jogar.'); return; }
  session?.action({ type: 'play', cardId }); selected = null;
}
function reorder(cardId, target) {
  if (mode !== 'first') return;
  const me = byId(state, session.identity.memberId);
  const ids = me.hand.map(c => c.id), from = ids.indexOf(cardId); if (from < 0) return;
  ids.splice(from, 1); ids.splice(target, 0, cardId); session.action({ type: 'reorder', ids });
}
app.addEventListener('click', async e => {
  const button = e.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action; e.preventDefault();
  if (busy) return;
  switch (action) {
    case 'home': if (state) { modal = { type: 'leave' }; renderGame(); } else { screen = 'home'; modal = null; renderHome(); } break;
    case 'rooms': screen = 'rooms'; refreshRooms(); break;
    case 'refresh-rooms': refreshRooms(); break;
    case 'create': modal = { type: 'create' }; renderHome(); break;
    case 'join': modal = { type: 'join', room: button.dataset.room }; renderHome(); break;
    case 'join-code': modal = { type: 'join' }; renderHome(); break;
    case 'practice': modal = { type: 'practice' }; renderHome(); break;
    case 'help': modal = { type: 'help' }; state ? renderGame() : renderHome(); break;
    case 'close-modal': modal = null; state ? renderGame() : renderHome(); break;
    case 'resume': {
      if (!savedSession) return;
      const identity = savedSession; savedSession = null; modal = null;
      await newSession().online(identity, identity.playerName); break;
    }
    case 'color': session.action({ type: 'color', color: button.dataset.color }); break;
    case 'seat': session.action({ type: 'seat' }); break;
    case 'ready': session.action({ type: 'ready' }); break;
    case 'start': session.action({ type: 'start' }); break;
    case 'rematch': selected = null; session.action({ type: 'rematch' }); break;
    case 'bid': session.action({ type: 'bid', value: Number(button.dataset.value) }); break;
    case 'vote': session.action({ type: 'vote', value: button.dataset.value }); break;
    case 'select-card': if (performance.now() > (suppressClickUntil ?? 0)) { selected = button.dataset.card; renderGame(); } break;
    case 'play-selected': if (selected) playCard(selected); break;
    case 'camera': scene.toggleMode(); break;
    case 'chat-toggle': showChat = !showChat; renderGame(); break;
    case 'sound': soundEnabled = !soundEnabled; localStorage.setItem('garanto-sound', soundEnabled ? 'on' : 'off'); renderGame(); break;
    case 'stop-inspection': scene.clearInspection(); break;
    case 'inspect-pile-card': {
      const entry = inspection?.pile.find(e => e.card.id === button.dataset.card);
      if (entry) { inspection = { ...inspection, ...entry }; renderGame(); } break;
    }
    case 'watch': {
      const me = byId(state, session.identity.memberId);
      if (!me?.seated || me?.eliminated || me?.spectator) { watchedPlayer = button.dataset.player; renderGame(); } break;
    }
    case 'close-watch': watchedPlayer = null; renderGame(); break;
    case 'invite': {
      const url = new URL(location.href); url.searchParams.set('room', session.identity.roomId);
      try { await navigator.clipboard.writeText(url.href); toast('Convite copiado! A senha é enviada separadamente.'); }
      catch { toast(`Código da sala: ${session.identity.roomId}`); } break;
    }
    case 'leave': modal = { type: 'leave' }; renderGame(); break;
    case 'confirm-leave':
      session.dispose(); session = null; state = null; selected = null; watchedPlayer = null; inspection = null;
      savedSession = null; modal = null; screen = 'home'; mode = 'landing'; scene.setMode('landing'); scene.demo(); renderHome(); break;
  }
});
app.addEventListener('input', e => {
  if (e.target.id === 'chat-input') draft = e.target.value;
  if (e.target.name === 'playerName') playerName = e.target.value;
});
app.addEventListener('change', e => { if (e.target.id === 'bot-count') session?.action({ type: 'bots', count: Number(e.target.value) }); });
app.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, data = Object.fromEntries(new FormData(form));
  if (form.id === 'chat-form') { session?.action({ type: 'chat', text: data.text }); draft = ''; document.querySelector('#chat-input').value = ''; return; }
  if (busy) return;
  playerName = String(data.playerName ?? '').trim();
  if (!playerName) return;
  localStorage.setItem('garanto-name', playerName);
  if (form.id === 'practice-form') {
    modal = null; newSession().local(playerName, Number(data.bots)); return;
  }
  busy = true; renderHome();
  try {
    let identity;
    if (form.id === 'create-form') identity = await api('/rooms', { ...data, capacity: Number(data.capacity), lives: Number(data.lives) });
    else if (form.id === 'join-form') identity = await api(`/rooms/${data.room.toUpperCase()}/join`, data);
    else return;
    modal = null; await newSession().online(identity, playerName);
  } catch (error) { toast(error.message); }
  finally { busy = false; state ? renderGame() : renderHome(); }
});
let cardDrag = null, suppressClickUntil = 0;
app.addEventListener('pointerdown', e => {
  const button = e.target.closest('.hand-card');
  if (!button || button.disabled || mode !== 'first') return;
  button.setPointerCapture(e.pointerId);
  cardDrag = { id: e.pointerId, cardId: button.dataset.card, x: e.clientX, y: e.clientY, element: button, moved: false };
});
app.addEventListener('pointermove', e => {
  if (!cardDrag || cardDrag.id !== e.pointerId) return;
  const dx = e.clientX - cardDrag.x, dy = e.clientY - cardDrag.y;
  if (Math.hypot(dx, dy) > 8) cardDrag.moved = true;
  if (cardDrag.moved) { cardDrag.element.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * .03}deg)`; cardDrag.element.style.zIndex = '100'; }
});
const releaseCard = e => {
  if (!cardDrag || cardDrag.id !== e.pointerId) return;
  const d = cardDrag; cardDrag = null; d.element.style.transform = ''; d.element.style.zIndex = '';
  if (!d.moved || e.type === 'pointercancel') return;
  suppressClickUntil = performance.now() + 400;
  if (d.y - e.clientY > 90) playCard(d.cardId);
  else {
    d.element.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.hand-card'); d.element.style.pointerEvents = '';
    if (target) reorder(d.cardId, Number(target.dataset.index));
  }
  renderGame();
};
app.addEventListener('pointerup', releaseCard); app.addEventListener('pointercancel', releaseCard);
function bindJoystick() {
  scene.joystick = { x: 0, y: 0 };
  const joystick = document.querySelector('#joystick'); if (!joystick) return;
  const move = e => {
    const rect = joystick.getBoundingClientRect();
    let x = (e.clientX - rect.left - rect.width / 2) / 35, y = (e.clientY - rect.top - rect.height / 2) / 35;
    const n = Math.max(1, Math.hypot(x, y)); x /= n; y /= n;
    scene.joystick = { x, y }; joystick.firstElementChild.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
  };
  joystick.onpointerdown = e => { joystick.setPointerCapture(e.pointerId); joystick.dataset.active = 'true'; move(e); };
  joystick.onpointermove = e => { if (joystick.dataset.active) move(e); };
  const release = () => { delete joystick.dataset.active; scene.joystick = { x: 0, y: 0 }; joystick.firstElementChild.style.transform = ''; };
  joystick.onpointerup = release; joystick.onpointercancel = release;
}
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && modal) { modal = null; state ? renderGame() : renderHome(); }
});
setInterval(() => { if (!state && screen === 'rooms' && !modal) refreshRooms(); }, 15_000);
const inviteRoom = new URL(location.href).searchParams.get('room');
if (inviteRoom && /^[a-z0-9]{6}$/i.test(inviteRoom)) modal = { type: 'join', room: inviteRoom.toUpperCase() };
renderHome();

// Live module bindings also allow browser integration checks without global hooks.
export { scene, session, state };
