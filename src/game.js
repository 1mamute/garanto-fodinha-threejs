export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS = ['♦', '♠', '♥', '♣'];
export const COLORS = ['#e7ad47', '#75b7b0', '#d97868', '#a496cb', '#84b466', '#e4a4bf', '#67a5cf', '#e1d4a8', '#ba805c', '#8f98a7'];
export const RECONNECT_MS = 180_000;
export const clone = (value) => structuredClone(value);
export const deck = () => RANKS.flatMap(rank => SUITS.map(suit => ({ id: `${rank}${suit}`, rank, suit })));
export const manilha = (kicker) => kicker ? RANKS[(RANKS.indexOf(kicker.rank) + 1) % 10] : null;
export function strength(card, kicker) {
  return (card.rank === manilha(kicker) ? 10 : RANKS.indexOf(card.rank)) * 4 + SUITS.indexOf(card.suit);
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function player(id, name, color = COLORS[0], bot = false) {
  return { id, name: String(name).trim().slice(0, 24) || 'Robô', color, bot, seated: bot,
    ready: bot, lives: 5, hand: [], bid: null, won: 0, tricks: [], eliminated: false, spectator: false, disconnectedAt: null };
}
export function createState(owner, settings = {}) {
  return { version: 0, phase: 'lobby', players: [owner], settings: { lives: 5, capacity: 6, ...settings },
    round: 0, cardsPerPlayer: 1, mode: 'up', dealer: owner.id, turn: null, kicker: null,
    table: [], votes: {}, voteEndsAt: null, history: [], chat: [], winner: null,
    paused: false, pausedAt: null, dueAt: null, lastEvent: 'A mesa está esperando companhia.' };
}
export const alive = s => s.players.filter(p => p.seated && !p.eliminated && !p.spectator);
export const byId = (s, id) => s.players.find(p => p.id === id);
export function nextAlive(s, id) {
  const index = s.players.findIndex(p => p.id === id);
  for (let step = 1; step <= s.players.length; step++) {
    const p = s.players[(index + step + s.players.length) % s.players.length];
    if (p.seated && !p.eliminated && !p.spectator) return p.id;
  }
  return null;
}
export function legalBids(s, id) {
  const remaining = alive(s).filter(p => p.bid === null);
  const sum = alive(s).reduce((n, p) => n + (p.bid ?? 0), 0);
  return Array.from({ length: s.cardsPerPlayer + 1 }, (_, i) => i)
    .filter(n => remaining.length !== 1 || remaining[0].id !== id || sum + n !== s.cardsPerPlayer);
}
function finishIfNeeded(s) {
  const living = alive(s);
  if (living.length > 1) return false;
  s.phase = 'finished'; s.turn = null; s.winner = living[0]?.id ?? null;
  s.paused = false; s.pausedAt = null; s.dueAt = null;
  s.lastEvent = living.length ? `${living[0].name} é o último robô de pé!` : 'Empate! Todo mundo caiu junto.';
  return true;
}
function deal(s, random) {
  let cards = shuffle(deck(), random);
  s.kicker = cards.pop();
  if (s.cardsPerPlayer * alive(s).length === 40) cards = shuffle([...cards, s.kicker], random);
  s.players.forEach(p => { p.hand = []; p.bid = null; p.won = 0; p.tricks = []; });
  for (let i = 0; i < s.cardsPerPlayer; i++) {
    for (const p of alive(s)) p.hand.push(cards.pop());
  }
  s.table = []; s.votes = {}; s.phase = 'bet'; s.dueAt = null; s.voteEndsAt = null;
  s.turn = nextAlive(s, s.dealer);
  s.lastEvent = `Rodada ${s.round}: ${s.cardsPerPlayer} carta${s.cardsPerPlayer > 1 ? 's' : ''} por robô.`;
}
function prepareRound(s, now, random, advance = true) {
  if (finishIfNeeded(s)) return;
  if (advance) {
    s.round++;
    if (s.round > 1) {
      s.dealer = nextAlive(s, s.dealer);
      s.cardsPerPlayer += s.mode === 'up' ? 1 : -1;
      if (s.cardsPerPlayer === 0) { s.cardsPerPlayer = 1; s.mode = 'up'; }
    }
  }
  if (s.cardsPerPlayer * alive(s).length > 40) {
    // cardsPerPlayer currently holds the attempted next quantity.
    s.phase = 'vote'; s.turn = null; s.votes = {}; s.voteEndsAt = now + 30_000;
    s.lastEvent = 'O baralho pediu arrego. Reset ou decrescente?';
  } else deal(s, random);
}
function finishVote(s, random) {
  const voters = alive(s);
  const reset = voters.filter(p => s.votes[p.id] === 'reset').length;
  const desc = voters.filter(p => s.votes[p.id] === 'down').length;
  const choice = reset === desc ? (random() < .5 ? 'reset' : 'down') : reset > desc ? 'reset' : 'down';
  if (choice === 'reset') { s.cardsPerPlayer = 1; s.mode = 'up'; }
  else { s.cardsPerPlayer -= 2; s.mode = 'down'; }
  if (s.cardsPerPlayer < 1) { s.cardsPerPlayer = 1; s.mode = 'up'; }
  deal(s, random);
}
function score(s, now) {
  const results = alive(s).map(p => {
    const lost = Math.abs(p.bid - p.won);
    p.lives = Math.max(0, p.lives - lost);
    p.eliminated = p.lives === 0;
    return { id: p.id, name: p.name, bid: p.bid, won: p.won, lost, lives: p.lives };
  });
  s.history.push({ round: s.round, results });
  s.history = s.history.slice(-30);
  s.lastEvent = 'Palpites na balança. Quem errou paga em vidas!';
  s.phase = 'score'; s.turn = null; s.dueAt = now + 6_000;
  finishIfNeeded(s);
}
function resolveTrick(s, now) {
  const winning = s.table.reduce((best, entry) => strength(entry.card, s.kicker) > strength(best.card, s.kicker) ? entry : best);
  const winner = byId(s, winning.playerId);
  winner.won++;
  // Winning card must be last, so rendering it at the top is unambiguous.
  const entries = [...s.table.filter(e => e !== winning), winning];
  winner.tricks.push({ entries: clone(entries), winningCardId: winning.card.id });
  s.trickWinner = winner.id; s.phase = 'trick'; s.turn = null; s.dueAt = now + 2_800;
  s.lastEvent = `${winner.name} levou a vaza com ${winning.card.id}!`;
}
export function applyAction(state, actorId, action, now = Date.now(), random = Math.random) {
  const s = clone(state), p = byId(s, actorId);
  if (!p) throw new Error('Jogador não está nesta mesa.');
  if (!action || typeof action.type !== 'string') throw new Error('Ação inválida.');
  if (action.type === 'chat') {
    const text = String(action.text ?? '').trim().slice(0, 240);
    if (!text) return state;
    s.chat.push({ id: `${actorId}-${now}-${s.version}`, playerId: actorId, name: p.name, text, at: now });
    s.chat = s.chat.slice(-60);
  } else if (s.phase === 'lobby' || (s.phase === 'finished' && action.type === 'rematch')) {
    switch (action.type) {
      case 'color':
        if (p.seated) throw new Error('A cor fica fixa depois de sentar.');
        if (!COLORS.includes(action.color) || s.players.some(other => other.id !== p.id && other.color === action.color))
          throw new Error('Esta cor já está ocupada.');
        p.color = action.color; break;
      case 'seat':
        if (s.players.filter(other => other.seated).length >= s.settings.capacity) throw new Error('Mesa cheia.');
        p.seated = true; p.spectator = false; break;
      case 'ready':
        if (!p.seated) throw new Error('Sente antes de marcar pronto.');
        p.ready = !p.ready; break;
      case 'bots': {
        if (!Number.isInteger(action.count) || action.count < 0 || action.count > 9) throw new Error('Quantidade de bots inválida.');
        s.players = s.players.filter(other => !other.bot);
        const count = Math.max(0, Math.min(action.count, s.settings.capacity - s.players.length, 10 - s.players.length));
        const names = ['Pistache', 'Parafuso', 'Paçoca', 'Pipoca', 'Latinha', 'Pudim', 'Prego', 'Tico', 'Bolota'];
        for (let i = 0; i < count; i++) {
          const color = COLORS.find(c => !s.players.some(other => other.color === c));
          s.players.push(player(`bot-${i}`, names[i], color, true));
        }
        break;
      }
      case 'start': {
        const seated = s.players.filter(other => other.seated);
        if (seated.length < 2 || seated.some(other => !other.ready || other.disconnectedAt !== null))
          throw new Error('Precisamos de pelo menos dois jogadores sentados, conectados e prontos.');
        s.players = [...shuffle(seated, random), ...s.players.filter(other => !other.seated)];
        s.players.forEach(other => { other.spectator = !other.seated; other.lives = s.settings.lives; other.eliminated = false; });
        s.dealer = seated[Math.floor(random() * seated.length)].id;
        prepareRound(s, now, random); break;
      }
      case 'rematch':
        s.phase = 'lobby'; s.round = 0; s.cardsPerPlayer = 1; s.mode = 'up'; s.winner = null;
        s.history = []; s.table = []; s.kicker = null; s.paused = false; s.dueAt = null;
        s.players.forEach(other => { other.eliminated = false; other.hand = []; other.tricks = []; other.bid = null; other.won = 0; other.ready = other.bot; other.lives = s.settings.lives; });
        break;
      default: throw new Error('Ação indisponível na sala de espera.');
    }
  } else {
    if (s.paused) throw new Error('Aguardando reconexão.');
    if (p.eliminated || p.spectator) throw new Error('Espectadores não jogam.');
    if (action.type === 'bid') {
      if (s.phase !== 'bet' || s.turn !== p.id) throw new Error('Espere a sua vez de apostar.');
      if (!Number.isInteger(action.value) || !legalBids(s, p.id).includes(action.value)) throw new Error('Aposta não permitida.');
      p.bid = action.value;
      if (alive(s).every(other => other.bid !== null)) { s.phase = 'play'; s.turn = nextAlive(s, s.dealer); }
      else s.turn = nextAlive(s, p.id);
    } else if (action.type === 'play') {
      if (s.phase !== 'play' || s.turn !== p.id) throw new Error('Espere a sua vez de jogar.');
      const index = p.hand.findIndex(card => card.id === action.cardId);
      if (index < 0) throw new Error('Essa carta não está na sua mão.');
      const [card] = p.hand.splice(index, 1);
      s.table.push({ playerId: p.id, playerName: p.name, card });
      if (s.table.length === alive(s).length) resolveTrick(s, now);
      else s.turn = nextAlive(s, p.id);
    } else if (action.type === 'reorder') {
      if (!['bet', 'play'].includes(s.phase) || !Array.isArray(action.ids) || action.ids.length !== p.hand.length
        || new Set(action.ids).size !== p.hand.length || action.ids.some(id => !p.hand.some(c => c.id === id)))
        throw new Error('Ordem de cartas inválida.');
      p.hand = action.ids.map(id => p.hand.find(c => c.id === id));
    } else if (action.type === 'vote') {
      if (s.phase !== 'vote' || !['reset', 'down'].includes(action.value)) throw new Error('Voto inválido.');
      s.votes[p.id] = action.value;
      if (alive(s).every(other => s.votes[other.id])) finishVote(s, random);
    } else throw new Error('Ação desconhecida.');
  }
  s.version++; return s;
}
export function reconcilePresence(state, members, now = Date.now()) {
  const s = clone(state);
  for (const member of members) {
    let p = byId(s, member.id);
    if (!p) {
      if (member.retired) continue;
      const color = COLORS.find(c => !s.players.some(other => other.color === c)) ?? COLORS[9];
      p = player(member.id, member.name, color); p.spectator = s.phase !== 'lobby'; s.players.push(p);
    }
    if (p.bot) continue;
    p.disconnectedAt = member.connected ? null : (p.disconnectedAt ?? member.disconnectedAt ?? now);
    if (member.connected) p.expired = false;
  }
  for (const p of s.players.filter(p => !p.bot)) {
    if (!members.some(m => m.id === p.id)) p.disconnectedAt ??= now;
  }
  const missing = alive(s).some(p => p.disconnectedAt !== null);
  const shouldPause = !['lobby', 'finished'].includes(s.phase) && missing;
  if (shouldPause && !s.paused) { s.paused = true; s.pausedAt = now; }
  if (!shouldPause && s.paused) {
    const elapsed = now - s.pausedAt;
    if (s.dueAt !== null) s.dueAt += elapsed;
    if (s.voteEndsAt !== null) s.voteEndsAt += elapsed;
    s.paused = false; s.pausedAt = null;
  }
  if (JSON.stringify(s) === JSON.stringify(state)) return state;
  s.version++; return s;
}
export function tick(state, now = Date.now(), random = Math.random) {
  let s = clone(state), changed = false;
  const expired = s.players.filter(p => !p.bot && p.disconnectedAt !== null && now - p.disconnectedAt >= RECONNECT_MS && !p.eliminated && !p.expired);
  if (expired.length) {
    if (s.phase === 'lobby') {
      s.players = s.players.filter(p => !expired.includes(p));
    } else if (s.phase !== 'finished') {
      const hadLiving = expired.some(p => p.seated && !p.spectator);
      expired.forEach(p => { p.eliminated = true; p.lives = 0; p.hand = []; });
      if (hadLiving && !finishIfNeeded(s)) {
        if (byId(s, s.dealer)?.eliminated) s.dealer = nextAlive(s, s.dealer);
        prepareRound(s, now, random, false);
        s.lastEvent = 'Reconexão expirou. Rodada redistribuída, sem perda de vidas para os demais.';
      }
      s.paused = alive(s).some(p => p.disconnectedAt !== null);
      s.pausedAt = s.paused ? now : null;
    }
    expired.forEach(p => { p.expired = true; });
    changed = true;
  }
  if (!s.paused) {
    if (s.phase === 'vote' && now >= s.voteEndsAt) { finishVote(s, random); changed = true; }
    else if (s.dueAt !== null && now >= s.dueAt) {
      if (s.phase === 'trick') {
        s.table = [];
        if (alive(s).every(p => p.hand.length === 0)) score(s, now);
        else { s.phase = 'play'; s.turn = s.trickWinner; s.dueAt = null; }
      } else if (s.phase === 'score') prepareRound(s, now, random);
      changed = true;
    }
  }
  if (!changed) return state;
  s.version++; return s;
}
export function botAction(s, id, random = Math.random) {
  const p = byId(s, id);
  if (!p || s.paused) return null;
  if (s.phase === 'vote' && !s.votes[id]) return { type: 'vote', value: random() < .5 ? 'reset' : 'down' };
  if (s.turn !== id) return null;
  if (s.phase === 'bet') {
    const estimate = Math.round(p.hand.reduce((n, c) => n + (strength(c, s.kicker) >= 36 ? .9 : strength(c, s.kicker) >= 28 ? .45 : .08), 0));
    const bids = legalBids(s, id);
    return { type: 'bid', value: bids.reduce((best, n) => Math.abs(n - estimate) < Math.abs(best - estimate) ? n : best) };
  }
  if (s.phase === 'play') {
    const cards = [...p.hand].sort((a, b) => strength(a, s.kicker) - strength(b, s.kicker));
    const top = s.table.reduce((n, e) => Math.max(n, strength(e.card, s.kicker)), -1);
    const wantsWin = p.won < p.bid;
    const card = wantsWin ? cards.find(c => strength(c, s.kicker) > top) ?? cards[0]
      : [...cards].reverse().find(c => strength(c, s.kicker) < top) ?? cards[0];
    return card ? { type: 'play', cardId: card.id } : null;
  }
  return null;
}
