# Estudo de UI/UX do Garanto

Estudo de 8 de outubro de 2026. Proposta para aprovação visual, antes de implementação.

## Direção

Apresentar Garanto como um jogo de mesa social: menu principal, lobby, partida e menu de opções. Preservar a sala industrial escura, o feltro verde, a luz âmbar e os robôs expressivos descritos em [direcao-visual.md](direcao-visual.md). A cena sustenta a presença dos jogadores; a interface oferece informação confiável independentemente da câmera.

O pedido do usuário é aprovar wireframes em imagens antes de implementar. Este estudo não autoriza mudanças no jogo.

## Evidências e limites

- Código estudado: telas em `src/ui/views/`, controlador em `src/ui/app.ts`, estilos em `src/style.css`, interação e apresentação em `src/scene/`, regras e tempos em `src/game/`.
- Inspeção no preview: início, formulário de treino, lobby, apostas, jogada e alternância de câmera. Usado treino local com três bots; algumas ações foram acionadas pela API de desenvolvimento para inspecionar estados.
- Não houve teste com usuários, partida multiplayer ou medição em celular físico. O redimensionamento do preview retornou timeout; screenshots e estado da página também apresentaram diferenças durante a inspeção. Enquadramentos suspeitos não são tratados como bugs confirmados. Observações sobre celular se apoiam no CSS e precisam de validação visual posterior.
- O jogo já possui destaque do jogador ativo na lista e marcador na cena, cores distintas de personagens, ajuda, sons de carta/vaza, inspeção, controles por teclado e regras de movimento reduzido no CSS. Melhorias devem desenvolver esses recursos.

## Problemas e propostas

| Prioridade | Evidência atual | Proposta para o wireframe |
| --- | --- | --- |
| Alta | O início usa cabeçalho de site, chamada promocional, links e rodapé em `home.ts`. | Menu principal vertical: Jogar com amigos, Treinar com bots, Como jogar e Opções. A sala permanece visível ao fundo; convite/código entra no fluxo de jogar. |
| Alta | Turno, fase, último evento, manilha e registro individual ficam em regiões distintas em `game.ts` e `hand.ts`. | Área estável de decisão: Sua vez ou Aguardando nome. Resumo pessoal junto à mão: palpite, vazas e vidas. Histórico permanece secundário. |
| Alta | Os controles HTML de cartas ficam recortados e só aparecem com foco de teclado em `.keyboard-hand`. | Acesso visível a Controles de cartas: selecionar e confirmar a jogada. Preservar arraste 3D e o bloqueio de jogar na câmera superior. |
| Alta | Registro é `vazas / aposta`; o ranking e a promoção por kicker estão na ajuda geral. | Palpite e Vazas com rótulos explícitos; manilha consultável com exemplo do kicker e ordem dos naipes. Não recomendar a melhor carta ou expor mãos alheias. |
| Média | Escolher cor, sentar e marcar pronto são ações sucessivas; o botão de começar explica o bloqueio apenas de forma genérica. | Lobby com percurso Cor → Sentar → Pronto, prévia do próprio robô, contagem de prontos e motivo específico para aguardar. Preservar o bloqueio da cor após sentar e a autoridade do host. |
| Média | `scoreCard` apresenta tabela por seis segundos; `scoreRound` pode encerrar a partida e substituir essa tela imediatamente. | Destaque pessoal: Apostou 2, ganhou 1, perdeu 1 vida, restam 4. Resumo da mesa e consulta posterior ao histórico, inclusive no fim da partida. Não alterar os tempos compartilhados nesta proposta. |
| Média | Ajuda reúne regras e gestos em um modal; sons atuais são apenas jogar e ganhar vaza. | Dicas contextuais dispensáveis no primeiro treino; som discreto e indicação textual para a própria vez. Reações cosméticas dos robôs, sem comunicar informação secreta. |
| Média | Toolbar mantém som, chat, ajuda e sair durante a partida. | Menu de opções com som e ajuda; chat com indicador de mensagens. Abrir menu fecha apenas a interação local: a partida multiplayer continua, salvo a pausa real por desconexão. |

## Princípios dos wireframes

- Mesa e cartas ocupam o centro; painéis ficam nas bordas e aparecem quando necessários.
- Contraste forte no conteúdo funcional; âmbar indica foco/ação, texto e ícone acompanham estados. Cor sozinha não comunica turno, acerto ou perda.
- Uma ação principal por estado. Palpite proibido continua visível com motivo legível também por toque.
- Não acrescentar cronômetro para apostar ou jogar: as decisões registradas em [decisoes-do-jogo.md](decisoes-do-jogo.md) não estabelecem limite.
- Votar mantém prazo de 30 segundos; reconexão conserva pausa compartilhada e prazo de três minutos.
- Na câmera superior, mostrar Voltar para jogar. O acesso aos controles alternativos não contorna a restrição.
- Celular precisa de composição própria: ação ao alcance do polegar, lista da mesa recolhível, alvos de pelo menos 44 px e cartas sem sobreposição de painéis. Wireframes de desktop não validam essa experiência.
- Menus são interfaces HTML acessíveis com aparência integrada ao jogo. Ornamentos, material gasto e animações não prejudicam leitura, foco ou desempenho.

## Referências oficiais e interpretação

As páginas oficiais abaixo sustentam os contextos e mecânicas. As aplicações de UI/UX são interpretações de design, não afirmações de que os jogos usam exatamente os componentes propostos.

| Referência | Contexto oficial | Aplicação proposta |
| --- | --- | --- |
| [Buckshot Roulette](https://store.steampowered.com/app/2835570/Buckshot_Roulette/) | Clube subterrâneo, confronto à mesa e multiplayer. | Concentrar atenção na decisão e tornar o gesto de jogar legível. |
| [Liar’s Bar](https://store.steampowered.com/app/3097560/Liars_Bar/) | Multiplayer em primeira pessoa com personagens distintos e declarações entre participantes. | Identificar claramente quem age e usar presença corporal para reforçar o encontro. Garanto deve acomodar até dez pessoas. |
| [CloverPit](https://store.steampowered.com/app/3314790/CloverPit/) | Caça-níquel, dívida ao fim da rodada e combinações que modificam resultados. | Separar objetivo, ação e consequência; dar peso à apuração das vidas. |
| [Balatro](https://store.steampowered.com/app/2379780/Balatro/) | Mãos de cartas, modificadores, fichas e meta. | Números explícitos, hierarquia consistente e explicação da causa do resultado. |
| [R.E.P.O.](https://store.steampowered.com/app/3241660/REPO/) | Cooperação, objetos físicos e aprimoramentos robóticos. | Identidade e reações expressivas dos robôs, dentro do orçamento atual de animação. |

## Ordem sugerida após aprovação

1. Menu principal e navegação para jogar, treino, ajuda e opções.
2. Lobby com progresso, identificação e prontidão explícitos.
3. Hierarquia da partida, resumo pessoal e acesso aos controles alternativos.
4. Resultado, explicação contextual e consulta ao histórico.
5. Reações, sons adicionais e ajustes de celular após validação da estrutura.

## Validação da futura implementação

- Um iniciante consegue entrar no treino, sentar e começar sem explicação externa?
- Consegue apontar quem joga, seu palpite e a manilha em poucos segundos?
- Entende que ganhar mais vazas que o palpite também custa vidas?
- Consegue jogar por arraste, toque com confirmação e teclado, sem jogadas acidentais?
- Consegue consultar o resultado após a próxima rodada começar?
- Menu, chat, inspeção e câmera continuam previsíveis em retrato/paisagem e com dez participantes?
- Testar estados de espera, aposta proibida, votação, eliminação, fim da partida e reconexão.
- Executar `npm run check` e os testes adequados ao escopo implementado; medir desempenho em aparelho físico.
