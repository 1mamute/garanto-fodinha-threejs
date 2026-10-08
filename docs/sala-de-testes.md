# Sala de testes

A sala de testes é um laboratório local para inspecionar modelos 3D, materiais, iluminação, cartas e perspectivas de câmera do Garanto. Ela usa os mesmos recursos gráficos da cena principal e a mesma lógica de caminhada dos observadores e jogadores eliminados.

## Executar e acessar

Com Node.js 22.12+ instalado e disponível no `PATH`, execute na raiz do projeto:

```sh
npm install
npm run dev
```

Se as dependências já estiverem instaladas, basta `npm run dev`. No PowerShell, use `npm.cmd` se a política de execução impedir o uso de `npm.ps1`.

Abra **http://localhost:5173/?scene=lab**. Se Vite escolher outra porta, use o endereço informado no terminal e mantenha `/?scene=lab`.

O acesso é somente pela URL; não há botão na tela inicial. A sala funciona sem o Worker, sem criar uma sala multiplayer e sem estabelecer conexões de jogo. O link **Voltar ao jogo** abre `/`. Recarregar a página restaura a composição e a câmera inicial.

### Restrição ao desenvolvimento

Em `src/main.ts`, a combinação de `import.meta.env.DEV` e do parâmetro `scene=lab` carrega `LabScene` por importação dinâmica, em lugar de inicializar `App`.

`npm run build` elimina esse caminho e o módulo do laboratório do bundle de produção. Ao executar `npm run preview` ou acessar a aplicação publicada, `/?scene=lab` abre a tela inicial normal. O laboratório exige o servidor de desenvolvimento do Vite.

## Composição

- A mesma sala da cena principal: piso, paredes, mesa, cadeiras e planta, com os materiais e a iluminação compartilhados.
- Quatro robôs sentados em torno da mesa, cada um com duas cartas abertas na mão.
- Duas cartas jogadas no centro da mesa, um kicker, o marcador do dealer e o destaque do jogador da vez.
- Um robô imóvel em pé, identificado como **Robô para inspeção**, próximo à posição inicial.
- Um robô azul em pé controlado pelo desenvolvedor. Seu corpo fica oculto em primeira pessoa e visível nas outras perspectivas.

A disposição representa uma rodada congelada para inspeção visual, sem avanço de turnos, apostas, jogadas ou animações de partida. O cenário parte de `demoState()`; as mãos são preenchidas com cartas do baralho que não estejam na mesa ou no kicker. A postura em pé usa o mesmo modelo `Robot`, com ajustes nos braços e pernas.

## Controles e câmeras

A câmera começa em **primeira pessoa**. Use os botões do painel ou **espaço** para alternar na ordem: primeira pessoa → terceira pessoa → vista superior → primeira pessoa.

| Controle | Primeira pessoa | Terceira pessoa | Vista superior |
| --- | --- | --- | --- |
| **W / S** | Andar para frente / trás | Andar para frente / trás | Sem caminhada |
| **A / D** | Andar para os lados | Andar para os lados | Sem caminhada |
| **Arrastar o mouse na cena** | Olhar ao redor | Orbitar o robô controlado | Sem órbita |
| **Roda do mouse** | Sem zoom | Aproximar / afastar do robô | Ajustar o zoom sobre a mesa |
| **Clique numa carta da mesa** | Sem inspeção | Sem inspeção | Inspecionar a carta |
| **Esc** | Encerrar uma inspeção | Encerrar uma inspeção | Encerrar uma inspeção |

Na vista superior, manter o mouse sobre uma carta ou pressioná-la por cerca de dois segundos também inicia a inspeção. A câmera aproxima a carta e o painel mostra seu valor e naipe. Clique em uma área sem carta ou pressione **Esc** para sair. Trocar a perspectiva encerra a inspeção.

Em terceira pessoa, a órbita gira em torno do robô controlado; para examinar o robô imóvel, caminhe até perto dele e ajuste o ângulo e a distância. Orbitar parado não desloca o personagem. A terceira pessoa está exposta apenas no laboratório; o jogo normal continua alternando entre primeira pessoa e vista superior.

Ao trocar a câmera, a posição do personagem e os ajustes de orientação e zoom são preservados, enquanto as teclas de movimento são liberadas. A câmera faz transições suaves. Recarregar restaura todos os valores iniciais.

## Caminhada compartilhada com eliminados

Primeira e terceira pessoa chamam a mesma lógica de caminhada de `CameraRig`, usando `spectatorPosition`. O corpo do robô controlado acompanha essa posição no chão.

- O personagem começa em `(0, 0, 5.5)`; a posição da câmera do observador tem altura de 2 unidades.
- O deslocamento ocorre no plano horizontal, a 2,7 unidades por segundo, em relação à orientação horizontal da câmera.
- A velocidade diagonal é normalizada para não superar a velocidade em linha reta.
- O centro do personagem permanece no anel entre os raios de 3 e 10,5 unidades em torno da mesa. Um passo que saia desse anel é rejeitado, como no jogo.
- Não há colisões adicionais com cadeiras, robôs, planta ou outros objetos, nem salto ou voo. A câmera de terceira pessoa também não tem resolução de colisões com a geometria.
- A caminhada fica suspensa na vista superior e durante a inspeção de cartas.

O laboratório permite avaliar o deslocamento dos eliminados sem iniciar uma partida. Ele não reproduz eliminação, sincronização de posições, migração de host ou reconexão; esses comportamentos pertencem aos testes do jogo e da rede. Também não há joystick na interface do laboratório: o percurso é feito com teclado e mouse.

## Onde manter cada recurso

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.ts` | Seleção da cena pela URL e restrição ao desenvolvimento. |
| `src/scene/labScene.ts` | Composição congelada, robôs de inspeção, painel, seleção de câmera, inspeção de cartas e loop de renderização do laboratório. |
| `src/scene/environment.ts` | Renderer, resolução, cor de fundo, neblina e iluminação compartilhados com a cena principal. |
| `src/scene/room.ts` | Geometria da sala, mesa, decoração, cadeiras e marcadores. |
| `src/scene/robot.ts` | Modelo do robô e posturas sentado / em pé. |
| `src/scene/cameraRig.ts` | Posicionamento das câmeras, suavização, órbita, zoom e caminhada compartilhada. |
| `src/scene/input.ts` | Eventos de mouse e teclado, zoom e gestos de inspeção. |
| `src/scene/types.ts` | `CameraMode` do jogo e `InspectionCameraMode`, que acrescenta `third`. |
| `src/scene/demo.ts` | Estado visual usado como base da composição. |
| `src/scene/tableCards.ts`, `cards.ts` e `hands.ts` | Modelos, posicionamento e inspeção das cartas e disposição das mãos. |
| `src/style.css` | Aparência do painel do laboratório. |
| `tests/cameraRig.test.ts` | Regressões de caminhada compartilhada, diagonais, limites e órbita. |

Para mudar a aparência do jogo e do laboratório juntos, altere os módulos compartilhados. Para mudar a disposição dos elementos de inspeção, altere `LabScene.populate()`. A iluminação é ajustada no código de `environment.ts`; não existe painel de edição de luzes nesta etapa.

O painel usa `html` e `morph`, como a interface principal. As cartas da mesa continuam gerenciadas por identificador em `TableCards`. A orientação da câmera é calculada a partir da posição e do vetor vertical desejados e suavizada com interpolação de quaternions, preservando a convenção da cena principal.

## Validação

Execute na raiz do projeto:

```sh
npm run check
npm run build
```

Os testes de câmera verificam que primeira e terceira pessoa têm a mesma caminhada, que diagonais mantêm a velocidade, que os limites do observador são preservados e que orbitar ou aproximar não desloca o personagem.

No navegador, com `npm run dev`:

1. Abra `/?scene=lab` e confirme a câmera inicial em primeira pessoa e a presença dos elementos descritos na composição.
2. Caminhe com WASD, olhe arrastando o mouse e confira os limites ao redor da mesa.
3. Alterne para terceira pessoa, confira o corpo do robô controlado e caminhe. Parado, arraste para orbitar e use a roda para ajustar a distância.
4. Alterne para vista superior, ajuste o zoom e inspecione uma carta. Encerre com Esc ou clique fora e confira que a caminhada permanece suspensa nessa perspectiva.
5. Alterne por espaço e pelos botões, verificando transições, preservação da posição e encerramento da inspeção.
6. Use **Voltar ao jogo** para confirmar que a tela inicial normal abre.

Para conferir a restrição ao desenvolvimento, depois do build execute `npm run preview` e abra `/?scene=lab` no endereço informado pelo Vite. A tela inicial normal deve aparecer. O diretório `dist/assets` não deve conter um módulo `labScene` ou o texto **Laboratório de cena**.

Alterações apenas na cena não exigem Worker. Se a mudança também atingir `src/net/` ou `worker/`, execute as integrações descritas no `AGENTS.md`.
