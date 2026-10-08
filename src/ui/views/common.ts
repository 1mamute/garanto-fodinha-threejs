import { isRedSuit, type Card } from '../../game';
import { html, type HtmlValue, type SafeHtml } from '../html';
import { icon } from '../icons';

export function logo(): SafeHtml {
  return html`<a class="brand" href="#" data-action="home" aria-label="Garanto, início"
    ><span class="brand-mark">g<span>♣</span></span>garanto<span class="brand-dot">.</span></a
  >`;
}

export function suitClass(card: Card): string {
  return isRedSuit(card.suit) ? 'red' : '';
}

export function cardFace(card: Card, extraClass = ''): SafeHtml {
  const corner = html`${card.rank}<small>${card.suit}</small>`;
  return html`<span class="card-face ${suitClass(card)} ${extraClass}"
    ><span class="card-corner">${corner}</span><span class="card-suit">${card.suit}</span
    ><span class="card-corner bottom">${corner}</span></span
  >`;
}

export function dialog(content: HtmlValue, title: string): SafeHtml {
  return html`<div class="dialog-shade">
    <section class="dialog" role="dialog" aria-modal="true" aria-label="${title}">
      <button class="icon-button dialog-close" data-action="close-modal" aria-label="Fechar">${icon('close')}</button
      >${content}
    </section>
  </div>`;
}

export function helpDialog(): SafeHtml {
  const content = html`<span class="eyebrow">MANUAL DE SOBREVIVÊNCIA</span>
    <h2>Garanta só o que aguenta.</h2>
    <div class="help-steps">
      <p>
        <b>01 · Olhe suas cartas.</b> Você começa com uma carta e recebe mais nas rodadas seguintes. O kicker
        promove o próximo valor a manilha.
      </p>
      <p>
        <b>02 · Faça seu palpite.</b> Aposte quantas vazas vai ganhar. O dealer aposta por último e não pode
        fechar a soma no total de vazas.
      </p>
      <p>
        <b>03 · Jogue uma carta.</b> A carta mais forte ganha. Pode jogar qualquer carta, sem obrigação de seguir
        naipe.
      </p>
      <p>
        <b>04 · Acerte ou pague.</b> Perde uma vida por cada vaza de diferença entre o palpite e o resultado. O
        último com vidas vence.
      </p>
    </div>
    <div class="ranking">
      <small>DO MENOR PARA O MAIOR</small>
      <p>4 · 5 · 6 · 7 · Q · J · K · A · 2 · 3</p>
      <p>♦ &lt; ♠ &lt; ♥ &lt; ♣</p>
    </div>
    <p class="form-note">
      Espaço alterna a câmera. Arraste a área livre para olhar. Arraste cartas para reordenar ou jogar na mesa. De
      cima, passe o mouse por dois segundos ou toque prolongadamente para inspecionar. Eliminados usam WASD ou
      joystick para passear.
    </p>
    <button class="button primary full" data-action="close-modal">Entendi. Bora jogar.</button>`;
  return dialog(content, 'Como jogar');
}
