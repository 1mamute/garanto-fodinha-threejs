# Sala de testes

Para iniciar o servidor e abrir o laboratório, consulte [Laboratório de cena no README](../README.md#laboratório-de-cena). A sala funciona sem Worker ou conexões multiplayer. O link **Voltar ao jogo** abre `/`; recarregar restaura a composição e a câmera inicial.

## Composição

- Quatro robôs sentados, cada um com duas cartas abertas na mão.
- Duas cartas jogadas no centro da mesa, um kicker, o marcador do dealer e o destaque do jogador da vez.
- Um robô imóvel em pé, identificado como **Robô para inspeção**, próximo à posição inicial.
- Um robô azul controlável, oculto em primeira pessoa e visível nas outras perspectivas.

A rodada permanece congelada, sem avanço de turnos ou animações de partida. `LabScene.populate()` parte de `demoState()` e preenche as mãos com cartas que não estejam na mesa ou no kicker. A postura em pé usa o modelo `Robot` com ajustes nos braços e pernas.

## Particularidades dos controles

A primeira pessoa usa os [controles dos eliminados descritos no README](../README.md#jogar). O joystick e o giro por toque podem ser usados simultaneamente. No computador, perder o foco ou trocar de perspectiva libera a captura do mouse; o aviso permite tentar novamente se o navegador a recusar.

A câmera começa em **primeira pessoa**. Os botões do painel ou **espaço** alternam na ordem: primeira pessoa → terceira pessoa → vista superior → primeira pessoa.

| Perspectiva | Comportamento no laboratório |
| --- | --- |
| Terceira pessoa | Arraste na cena para orbitar o robô controlado; a roda do mouse ajusta a distância. WASD ou joystick continuam movendo o personagem. |
| Vista superior | A caminhada fica suspensa. Clique numa carta da mesa para inspecioná-la; o painel mostra seu valor e naipe. Zoom e gestos de inspeção seguem os controles do jogo. |

Para examinar o robô imóvel em terceira pessoa, caminhe até perto dele e ajuste o ângulo e a distância. Orbitar parado não desloca o personagem. Essa perspectiva está disponível apenas no laboratório.

Trocar a câmera encerra a inspeção, libera as teclas e zera o joystick, preservando a posição, a orientação e os ajustes de zoom.

## Movimentação e limites

Primeira e terceira pessoa reutilizam a caminhada de `CameraRig`, por meio de `spectatorPosition`; o corpo do robô acompanha essa posição no chão.

O corpo gira suavemente na direção do deslocamento efetivo, incluindo diagonais e joystick. Braços, pernas e uma leve oscilação acompanham os passos e voltam suavemente ao repouso quando o personagem para ou encontra um limite. A cabeça acompanha a orientação horizontal e vertical do mouse/toque, preservando o olhar enquanto o corpo gira. Orbitar parado move a cabeça sem girar o corpo.

- Posição inicial do personagem: `(0, 0, 5.5)`; altura da câmera do observador: 2 unidades.
- Velocidade: 2,7 unidades por segundo, com diagonais normalizadas e direção relativa à orientação horizontal da câmera.
- Área permitida: anel entre os raios de 3 e 10,5 unidades ao redor da mesa. Passos que saiam desse anel são rejeitados, como no jogo.
- Sem colisões adicionais com objetos, salto ou voo. A câmera de terceira pessoa também não resolve colisões com a geometria.

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
| `src/scene/robotWalking.ts` | Rotação suave do corpo, ciclo dos passos e orientação independente da cabeça do robô controlado. |
| `src/scene/input.ts`, `mouseLook.ts` e `src/ui/joystick.ts` | Controles compartilhados com o jogo. |
| `src/scene/types.ts` | `InspectionCameraMode` acrescenta `third` aos modos do jogo. |
| `src/style.css` | Aparência do painel e do aviso de captura. |
| `tests/cameraRig.test.ts` | Equivalência entre perspectivas e entre teclado/joystick, diagonais, limites e órbita. |
| `tests/robotWalking.test.ts` | Suavidade do giro, olhar independente, passos, parada e equivalência entre taxas de quadros. |

## Validação específica

Use os comandos de [Verificar no README](../README.md#verificar). No laboratório:

1. Confirme a câmera inicial e a composição congelada.
2. Confira a caminhada e a captura/liberação do mouse no computador. No celular, use joystick e giro simultaneamente; soltar o joystick deve parar apenas a caminhada.
3. Alterne para terceira pessoa e confira órbita, zoom, giro suave do corpo e passos em WASD/joystick, incluindo diagonais e marcha à ré. Mude a direção sem mover o mouse e confira que a cabeça preserva o olhar; orbite parado e confira que apenas a cabeça gira. Solte os controles e confira o retorno suave ao repouso, também nos limites da sala.
4. Na vista superior, confira a suspensão da caminhada e a inspeção por clique, incluindo saída com Esc ou clique fora.
5. Troque as câmeras pelos botões e por espaço, conferindo posição preservada, encerramento da inspeção e joystick zerado.
6. Confira os controles compartilhados no jogo como observador/eliminado e a manipulação de cartas com cursor livre para jogadores sentados.

O build de produção elimina o módulo do laboratório. Com `npm run preview`, `/?scene=lab` deve abrir a tela inicial normal; `dist/assets` não deve conter um módulo `labScene` nem o texto **Laboratório de cena**.
