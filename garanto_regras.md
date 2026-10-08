# Garanto — Regras do jogo

**Versão:** 1.0  
**Tipo:** jogo individual de vazas e apostas, inspirado no truco brasileiro  
**Jogadores:** de 2 a 10  
**Objetivo:** ser o último jogador com vidas restantes.

## 1. Material e preparação

- Utilize um baralho tradicional de **40 cartas**, composto pelos quatro naipes (Ouros, Espadas, Copas e Paus), com as cartas **8, 9 e 10 removidas**. Não são usados curingas.
- Cada participante começa com **5 vidas** por padrão. A quantidade inicial de vidas pode ser configurada antes da partida.
- Todos jogam individualmente, sem equipes.
- Um **dealer** (distribuidor) é escolhido aleatoriamente no início da partida.
- O jogo começa com **1 carta por jogador**, em **modo crescente** de distribuição.
- A disposição dos jogadores na mesa estabelece uma ordem **anti-horária**, usada nas apostas, nas jogadas e na transferência do dealer.

## 2. Força das cartas

### 2.1. Ordem normal dos valores

Da carta mais fraca para a mais forte:

**4 < 5 < 6 < 7 < Dama (Q) < Valete (J) < Rei (K) < Ás (A) < 2 < 3**

### 2.2. Ordem dos naipes

Do mais fraco para o mais forte:

**Ouros (♦) < Espadas (♠) < Copas (♥) < Paus (♣)**

Se duas ou mais cartas jogadas tiverem o mesmo valor, vence a de naipe mais forte. Como há somente uma carta para cada combinação de valor e naipe no baralho, sempre existe uma vencedora única em cada vaza.

## 3. Kicker e manilhas

Em **toda rodada**, antes de distribuir as cartas, uma carta é revelada: o **kicker**. O valor dessa carta define quais serão as **manilhas** da rodada.

- As manilhas são as cartas de **valor imediatamente seguinte ao valor do kicker** na ordem normal apresentada na seção 2.1.
- A ordem de valores é circular: **depois do 3 vem o 4**.
- **Todas as cartas do valor promovido a manilha superam quaisquer outras cartas**, independentemente da força normal destas.
- Entre manilhas, a força do naipe decide a vencedora: **Paus > Copas > Espadas > Ouros**.
- As outras cartas mantêm a ordem normal de força relativa entre si. O valor do kicker **não se torna automaticamente a manilha**.

**Exemplos:**

| Kicker revelado | Valor das manilhas | Mais forte entre as manilhas |
|---|---|---|
| 4 | 5 | 5 de Paus |
| 5 | 6 | 6 de Paus |
| 7 | Dama | Dama de Paus |
| 3 | 4 | 4 de Paus |

**Exemplo de ranking na rodada:** se o kicker é **5**, a força dos valores, do maior para o menor, é:

**6 (manilha) > 3 > 2 > A > K > J > Q > 7 > 5 > 4**.

### 3.1. Como revelar e utilizar o kicker

Antes da distribuição de cada rodada, calcule:

`totalDeCartas = cartasPorJogador × jogadoresVivos`

- **Se `totalDeCartas < 40`:** revele uma carta aleatória do baralho como kicker e deixe-a exposta no centro da mesa, fora das mãos e das vazas, até o fim da rodada. Distribua as cartas usando o restante do baralho.
- **Se `totalDeCartas = 40`:** revele uma carta como kicker para que todos a vejam, **embaralhe essa mesma carta novamente no baralho** e distribua todas as 40 cartas. Nesse caso, o kicker é uma referência ao valor revelado; a própria carta revelada pode estar na mão de um jogador e ser jogada normalmente.
- **Se `totalDeCartas > 40`:** não distribua cartas; primeiro execute a votação de mudança de distribuição descrita na seção 5.

O efeito do kicker dura apenas a rodada atual. Um novo kicker é revelado a cada rodada.

## 4. Rodadas e vazas

Uma **rodada** começa com a preparação do baralho, a revelação do kicker e a distribuição; termina após todas as vazas e o cálculo das vidas perdidas.

Uma **vaza** (também chamada de turno) consiste em cada jogador vivo jogar **exatamente uma carta** de sua mão. Quem jogar a carta mais forte vence a vaza.

- Se cada jogador recebe **M cartas**, a rodada possui **M vazas**.
- O **dealer** é o último a jogar na **primeira vaza** da rodada.
- Os demais jogadores jogam uma carta cada um, sucessivamente, no **sentido anti-horário**.
- Os jogadores podem escolher **qualquer carta da própria mão**; não existe obrigação de seguir valor ou naipe.
- Quando todos os jogadores vivos tiverem jogado uma carta, compare as forças seguindo as regras do kicker, das manilhas e dos naipes.
- O vencedor recebe **1 vaza ganha** em seu registro da rodada.
- O **vencedor da vaza anterior** é o primeiro a jogar na vaza seguinte, mantendo-se a ordem anti-horária para os outros participantes.
- As cartas usadas em uma vaza não voltam à mão naquela rodada.
- Após as **M vazas**, todas as mãos estarão vazias e a rodada é pontuada.

## 5. Progressão da quantidade de cartas

Todos os jogadores vivos recebem a **mesma quantidade de cartas** por rodada. A progressão é controlada por duas variáveis: a quantidade **M** de cartas por jogador e o **modo de distribuição**.

### 5.1. Modo crescente

- A primeira rodada tem **M = 1**.
- A cada rodada seguinte, tenta-se aumentar **M em 1**.
- Se a nova quantidade exigir **mais de 40 cartas ao todo**, uma votação é aberta **antes da distribuição**.

### 5.2. Votação ao atingir o limite do baralho

Os jogadores escolhem entre duas opções:

- **Reset** — retornar para **M = 1**, mantendo/reiniciando o **modo crescente**.
- **Decrescente** — trocar para o **modo decrescente**, reduzindo a quantidade de cartas por jogador em **1** em relação à última rodada disputada.

Regras da votação:

1. A janela de votação dura **30 segundos**.
2. A opção com mais votos é escolhida.
3. Se houver empate na votação, a opção vencedora é escolhida **aleatoriamente**.
4. A distribuição só ocorre depois de definida a opção vencedora.

### 5.3. Modo decrescente

- No modo decrescente, a quantidade de cartas por jogador diminui em **1 a cada nova rodada**.
- Quando a progressão decrescente chegaria a **0 cartas**, ela retorna automaticamente ao **modo crescente**, começando novamente com **M = 1**.
- Esse ciclo de aumento, possível votação e redução se repete até a partida terminar.
- Jogadores eliminados deixam de contar no cálculo de `totalDeCartas` nas rodadas seguintes.

**Exemplo (10 jogadores vivos):** a quantidade de cartas por pessoa progride como **1, 2, 3, 4**, totalizando respectivamente **10, 20, 30 e 40 cartas**. Antes de tentar distribuir **5** cartas (50 ao todo), ocorre a votação. Se vencer `/desc`, a próxima rodada terá **3 cartas por jogador**. Se vencer `/reset`, a próxima terá **1 carta por jogador**.

## 6. Apostas

Depois que o kicker foi definido e as cartas foram distribuídas, mas **antes da primeira vaza**, ocorre a etapa de apostas.

1. O **próximo jogador vivo depois do dealer, no sentido anti-horário, aposta primeiro**. O dealer aposta por último.
2. Os outros apostam, um a um, em **sentido anti-horário**.
3. Cada jogador aposta um número inteiro de **0 a M**, inclusive. Sua aposta representa a quantidade de vazas que acredita que vencerá na rodada.
4. O **último jogador a apostar** tem uma restrição: sua aposta **não pode fazer com que a soma das apostas de todos os jogadores seja exatamente M**, o número de vazas da rodada.
5. Após todos terem feito apostas válidas, começa a primeira vaza.

**Exemplo:** em uma rodada com **M = 3** vazas, os dois primeiros jogadores apostam **1** cada. O terceiro, se for o último a apostar, **não pode apostar 1**, pois a soma seria `1 + 1 + 1 = 3`. Ele pode apostar **0, 2 ou 3**.

As apostas são contabilizadas individualmente e comparadas às vazas efetivamente ganhas ao final da rodada.

## 7. Perda de vidas e eliminação

Ao final de todas as vazas da rodada, cada jogador perde vidas de acordo com a diferença absoluta entre sua aposta e as vazas que venceu:

`vidasPerdidas = |aposta − vazasGanhas|`

`vidasRestantes = vidasAnteriores − vidasPerdidas`

| Aposta | Vazas ganhas | Vidas perdidas |
|---:|---:|---:|
| 1 | 1 | 0 |
| 0 | 1 | 1 |
| 1 | 2 | 1 |
| 2 | 1 | 1 |
| 3 | 0 | 3 |

- Um acerto exato na aposta não custa nenhuma vida.
- Errar para cima ou para baixo custa a mesma quantidade de vidas para o mesmo tamanho do erro.
- Quem terminar a rodada com **0 ou menos vidas** é **eliminado**, deixa de participar das rodadas seguintes e passa a ser espectador.
- A eliminação ocorre **após a pontuação da rodada**, não no meio das vazas.

## 8. Dealer e ordem da mesa

- O primeiro dealer é escolhido aleatoriamente.
- A pessoa seguinte ao dealer **inicia as apostas e a primeira vaza** de cada rodada.
- Depois de cada rodada, a função de dealer passa ao **próximo jogador vivo no sentido anti-horário**.
- Jogadores eliminados são ignorados na passagem do dealer e nas ordens de aposta e jogada mas podem ficar de espectador e podem visualizar a mão de todos os outros jogadores.
- O dealer não tem qualquer vantagem adicional na força das cartas ou na pontuação.

## 9. Fim da partida

Após aplicar a perda de vidas e eliminar os jogadores que chegaram a zero ou menos:

- **Exatamente 1 jogador vivo:** esse jogador vence a partida.
- **Nenhum jogador vivo:** a partida termina **empatada**, pois todos os jogadores restantes foram eliminados na mesma rodada.
- **2 ou mais jogadores vivos:** uma nova rodada começa com o dealer atualizado e a quantidade de cartas ajustada.

## 10. Sequência completa de uma rodada

1. Verificar quantos jogadores permanecem vivos.
2. Determinar a quantidade de cartas **M** da rodada, segundo o modo de distribuição.
3. Se `M × jogadoresVivos > 40`, realizar a votação `/reset` ou `/desc` por 30 segundos e ajustar **M** e o modo.
4. Reunir as 40 cartas e embaralhar o baralho.
5. Revelar o kicker; deixá-lo fora do baralho se a distribuição usar menos de 40 cartas, ou devolvê-lo ao baralho e embaralhar se usar exatamente 40.
6. Distribuir **M cartas** a cada jogador vivo.
7. Coletar as apostas, a partir do próximo jogador vivo depois do dealer e em sentido anti-horário, impondo a restrição ao último apostador (o dealer).
8. Realizar as **M vazas**. O próximo jogador vivo depois do dealer lidera a primeira; cada vencedor lidera a próxima.
9. Contar quantas vazas cada jogador venceu.
10. Deduzir vidas usando `|aposta − vazasGanhas|`.
11. Eliminar os participantes com 0 ou menos vidas.
12. Verificar vitória, empate ou continuação da partida.
13. Se a partida continuar, passar o dealer ao próximo jogador vivo em sentido anti-horário e preparar a progressão de cartas para a rodada seguinte.
