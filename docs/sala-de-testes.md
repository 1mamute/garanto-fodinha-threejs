# Sala de testes

Para iniciar o servidor e abrir o laboratório, consulte [Laboratório de cena no README](../README.md#laboratório-de-cena). No modo de desenvolvimento, o botão **Sala de testes** na página inicial abre o laboratório. A sala funciona sem Worker ou conexões multiplayer. O link **Voltar ao jogo** abre `/`; recarregar restaura a composição e a câmera inicial.

## Composição

- Quatro robôs sentados, cada um com duas cartas com a frente voltada para seu dono e o verso voltado para a mesa.
- O robô sentado em frente à posição inicial demonstra o zoom automaticamente: 1 segundo para espremer os olhos, 2 segurando a expressão, 1 relaxando e 2 de pausa. O botão **Robô sentado: demonstrar zoom** liga ou desliga o ciclo. A câmera do visitante continua livre.
- Duas cartas jogadas no centro da mesa, um kicker, o marcador do dealer e o destaque do jogador da vez.
- Um robô laranja imóvel em pé para inspeção, sem identificação flutuante, na posição `(2, 0, 8)`, afastado da mesa e com espaço para caminhar ao redor.
- Um robô azul controlável, com corpo visível ao olhar para baixo em primeira pessoa. A cabeça fica oculta nessa perspectiva e reaparece nas demais.
- Uma cadeira vazia na posição `(-2, 0, 6.5)`, com corpo dinâmico no JoltPhysics. Caminhe contra ela para empurrá-la. O botão **Soltar carta na cadeira** solta uma carta de 3,5 unidades de altura acima da posição atual da cadeira; repetir o botão substitui a carta anterior.

A rodada permanece congelada, sem avanço de turnos ou animações de partida. `LabScene.populate()` parte de `demoState()` e preenche as mãos com cartas que não estejam na mesa ou no kicker. A postura em pé usa o modelo `Robot` com ajustes nos braços e pernas.

## Particularidades dos controles

A primeira pessoa usa os [controles dos eliminados descritos no README](../README.md#jogar). O joystick e o giro por toque podem ser usados simultaneamente. No computador, perder o foco ou trocar de perspectiva libera a captura do mouse; o aviso permite tentar novamente se o navegador a recusar.

A câmera começa em **primeira pessoa**. Os botões do painel ou **espaço** alternam na ordem: primeira pessoa → vista superior → terceira pessoa → primeira pessoa.

| Perspectiva | Comportamento no laboratório |
| --- | --- |
| Primeira pessoa | A roda aproxima e afasta a visão sem deslocar o personagem, inclusive com o mouse capturado. WASD e joystick continuam funcionando durante o zoom. O limite é compartilhado com o jogo em `FIRST_PERSON_CAMERA.maxZoom`. |
| Terceira pessoa | Arraste na cena para orbitar o robô controlado; a roda do mouse ajusta a distância. WASD ou joystick continuam movendo o personagem. |
| Vista superior | A caminhada fica suspensa. A câmera enquadra as cartas e o kicker de perto, recuando para incluir as pilhas. A seta do dealer fica oculta, pois o visitante é um observador. Clique numa carta da mesa para inspecioná-la; o painel mostra seu valor e naipe. Zoom e gestos de inspeção seguem os controles do jogo. |

Para examinar o robô imóvel em terceira pessoa, caminhe até perto dele e ajuste o ângulo e a distância. Orbitar parado não desloca o personagem. Essa perspectiva está disponível apenas no laboratório.

O botão **Robô de inspeção: seguir com a cabeça** liga e desliga o acompanhamento do personagem controlado. O robô de inspeção mantém o corpo imóvel e gira suavemente a cabeça em 360° na horizontal, com os olhos alinhados ao olhar e a inclinação vertical limitada. Caminhe ao redor dele para observar a volta completa: passar atrás mantém o giro contínuo, sem inverter a rotação. Ao desligar, a cabeça volta suavemente à posição neutra pelo arco mais curto. O acompanhamento começa desligado e sua escolha é preservada ao alternar as câmeras.

Trocar a câmera encerra a inspeção, libera as teclas e zera o joystick, preservando a posição, a orientação e os ajustes de zoom.
O retorno à primeira pessoa é instantâneo, sem interpolação da posição ou da orientação.
A vista superior fica abaixo da luminária central, com altura máxima de 4,3 unidades. O campo de visão se amplia quando necessário para enquadrar as cartas, inclusive em telas verticais.

## Movimentação e limites

Primeira e terceira pessoa reutilizam a caminhada de `CameraRig`, por meio de `spectatorPosition`; o corpo do robô acompanha essa posição no chão.

O corpo gira suavemente na direção do deslocamento efetivo, incluindo diagonais e joystick. Braços, pernas e uma leve oscilação acompanham os passos e voltam suavemente ao repouso quando o personagem para ou encontra um limite. A cabeça acompanha a orientação horizontal e vertical do mouse/toque, preservando o olhar enquanto o corpo gira. Orbitar parado move a cabeça sem girar o corpo.

- Posição inicial do personagem: `(0, 0, 5.5)`; a câmera do observador fica na altura dos olhos do modelo em pé (3,16 unidades). Tronco e cabeça compartilham as proporções dos robôs sentados. Em pé, a coxa estendida eleva o corpo em 0,52 unidade, mantendo os pés no chão.
- Velocidade: 2,7 unidades por segundo, com diagonais normalizadas e direção relativa à orientação horizontal da câmera.
- Sala com diâmetro de 27 unidades; piso, paredes e painéis usam o mesmo raio de 13,5 unidades.
- A caminhada usa uma cápsula física com gravidade e contato com o chão. Mesa, cadeiras, robôs e paredes impedem a passagem; movimentos diagonais deslizam ao longo dos obstáculos. O limite radial antigo foi substituído pelas colisões da sala, também no jogo.
- As cadeiras ocupadas ficam fixas; os robôs sentados mantêm suas animações com colisores que acompanham tronco, cabeça e membros. A cadeira vazia reage ao contato, pode tombar e colide com o piso e a mesa.
- Sem salto ou voo. A câmera de terceira pessoa continua sem resolver colisões próprias com a geometria; as colisões controlam o personagem.
- Em primeira pessoa, a câmera fica 0,56 unidade à frente do centro do corpo, na região dos olhos. Olhar para baixo mantém esse deslocamento, evitando enxergar o interior do tronco.

O laboratório serve para avaliar o deslocamento dos eliminados sem iniciar uma partida. Eliminação, sincronização de posições, migração de host e reconexão devem ser verificadas nos testes do jogo e da rede. A iluminação é ajustada no código; não há painel de edição de luzes.

## Manutenção

A organização geral e as convenções de renderização estão em [Organização e limites no README](../README.md#organização-e-limites). Para trabalhar no laboratório:

| Arquivo | Alteração |
| --- | --- |
| `src/main.ts` | Seleção por `scene=lab`, condicionada a `import.meta.env.DEV`, com importação dinâmica de `LabScene`. |
| `src/scene/labScene.ts` | Composição congelada, painel, robô controlado e ciclo das três câmeras. |
| `src/scene/environment.ts` | Renderer, neblina e iluminação compartilhados com a cena principal. |
| `src/scene/room.ts`, `robot.ts`, `cards.ts` e `hands.ts` | Recursos gráficos compartilhados; altere aqui para atualizar as duas cenas. |
| `src/scene/cameraRig.ts` | Caminhada compartilhada, órbita e posicionamento das câmeras. |
| `src/scene/dealerIndicator.ts` | Seta compartilhada que indica o dealer na vista superior, ocultada durante a inspeção de cartas. |
| `src/scene/roomDimensions.ts` | Raio da sala e limite externo da caminhada, com margem para as paredes. |
| `src/scene/robotWalking.ts` | Rotação suave do corpo, ciclo dos passos e orientação independente da cabeça do robô controlado. |
| `src/scene/physicsWorld.ts`, `physicsShapes.ts` e `physicsLayers.ts` | Corpos Jolt, colisores derivados da geometria, filtros de colisão, passo fixo e descarte da memória nativa. |
| `src/scene/physicsCharacter.ts` e `physicsCards.ts` | Caminhada com colisões e queda/organização de cartas, compartilhadas com o jogo. |
| `src/scene/input.ts`, `mouseLook.ts` e `src/ui/joystick.ts` | Controles compartilhados com o jogo. |
| `src/scene/types.ts` | `InspectionCameraMode` acrescenta `third` aos modos do jogo. |
| `src/style.css` | Aparência do painel e do aviso de captura. |
| `tests/cameraRig.test.ts` | Equivalência entre perspectivas e entre teclado/joystick, diagonais, limites e órbita. |
| `tests/robotWalking.test.ts` | Suavidade do giro, olhar independente, passos, parada e equivalência entre taxas de quadros. |
| `tests/robotLook.test.ts` | Acompanhamento de alvos pela cabeça, retorno ao repouso e limites do pescoço sem mover o corpo. |

## Validação específica

Use os comandos de [Verificar no README](../README.md#verificar). No laboratório:

1. Confirme a câmera inicial e a composição congelada.
2. Confira a caminhada e a captura/liberação do mouse no computador. No celular, use joystick e giro simultaneamente; soltar o joystick deve parar apenas a caminhada.
3. Alterne para terceira pessoa e confira órbita, zoom, giro suave do corpo e passos em WASD/joystick, incluindo diagonais e marcha à ré. Mude a direção sem mover o mouse e confira que a cabeça preserva o olhar; orbite parado e confira que apenas a cabeça gira. Solte os controles e confira o retorno suave ao repouso, também nos limites da sala.
4. Na vista superior, confira a suspensão da caminhada e a inspeção por clique, incluindo saída com Esc ou clique fora.
5. Troque as câmeras pelos botões e por espaço, conferindo posição preservada, encerramento da inspeção e joystick zerado.
6. Confira os controles compartilhados no jogo como observador/eliminado e a manipulação de cartas com cursor livre para jogadores sentados.
7. Ligue o acompanhamento da cabeça do robô de inspeção, caminhe ao redor dele nos dois sentidos e confira o giro de 360° com o corpo imóvel, incluindo a passagem por trás. Alterne as câmeras, confira que o botão continua ligado e desligue para observar o retorno suave da cabeça à posição neutra pelo arco mais curto.
8. Caminhe contra um robô sentado, a mesa, as cadeiras e a parede: o personagem deve parar ou deslizar, sem atravessar a geometria. Empurre a cadeira vazia, solte uma carta sobre ela e confira o pouso. Empurre novamente: a carta deve reagir à cadeira e pode cair no chão.

O build de produção elimina o módulo do laboratório. Com `npm run preview`, `/?scene=lab` deve abrir a tela inicial normal; `dist/assets` não deve conter um módulo `labScene` nem o texto **Laboratório de cena**.
