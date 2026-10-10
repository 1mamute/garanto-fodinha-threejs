# Garanto

Jogo de cartas 3D para reunir de 2 a 10 jogadores, com personagens robóticos próprios, palpites, manilhas e cinco vidas. Three.js renderiza a mesa; JoltPhysics simula colisões e gravidade; WebRTC transmite a partida; Cloudflare Workers e Durable Objects cuidam das salas e da sinalização.

## Executar

Instale Node.js 22.12+ ou 24 LTS. Na pasta do projeto:

```sh
npm install
npm run dev:cloudflare
```

Abra **http://localhost:8787**. O mesmo endereço serve o jogo e o serviço de salas. O treino com bots não depende do backend.

Para editar com atualização automática, deixe `npm run dev:cloudflare` aberto e execute `npm run dev` em outro terminal. Abra **http://localhost:5173**; Vite encaminha `/api` para o Worker local.

## Jogar

- Crie uma sala, opcionalmente com senha, ou entre na lista/código/link de convite. Convites não incluem a senha.
- Ao entrar, você senta automaticamente à mesa e permanece na cadeira até ser eliminado. Escolha uma cor disponível e marque pronto; a cor fica bloqueada enquanto você estiver pronto. O host pode adicionar bots e inicia quando todos os jogadores da partida estiverem prontos.
- Aposte quantas vazas vai ganhar. O jogador seguinte ao dealer, no sentido anti-horário, começa as apostas e a primeira vaza. O dealer é o último em ambas.
- Na primeira pessoa, arraste cartas para ordenar; arraste para cima para jogar. Arraste a área livre para olhar. A roda do mouse aproxima e afasta a visão da mesa, enquanto o robô espreme os olhos. As cartas da mão mantêm seu tamanho na tela.
- **Espaço** alterna entre primeira pessoa e visão de cima. Nesta última, a mão fica bloqueada. Use a roda do mouse ou pinça para zoom; passe o mouse por dois segundos ou toque prolongadamente para inspecionar cartas e vazas coletadas. **ESC** ou clique fora encerra a inspeção.
- Eliminados podem ver todas as mãos e passear em primeira pessoa: no computador, use **WASD** e clique na cena para capturar o mouse e olhar como em um FPS (**Esc** libera o cursor); no celular, use o joystick para andar e arraste na cena para olhar. Toque no nome de um jogador para consultar sua mão como espectador.
- Participantes que chegam durante uma partida ficam sentados como espectadores, sem andar, até haver vaga na próxima partida. Use o chat para conversar.
- Desconexão pausa a mesa por três minutos. Expirado o prazo, o jogador é eliminado, a rodada atual é cancelada e redistribuída, sem penalidade de vidas aos demais. A quantidade de cartas e o modo são mantidos; kicker e mãos são sorteados novamente.
- O host é transferido automaticamente para um participante conectado. O antigo host pode voltar como jogador. Recarregue a página e use **Retomar minha sala** na mesma aba; a sessão e o último estado recebido são guardados no armazenamento da aba.

As regras completas estão em [garanto_regras.md](garanto_regras.md); decisões adicionais, em [docs/decisoes-do-jogo.md](docs/decisoes-do-jogo.md).

O menu **Gráficos**, na tela inicial e durante a partida, permite escolher a suavização de
bordas sem recarregar: desligada, MSAA (padrão, até 4×), FXAA, SMAA, SSAA (4×) ou TAA.
A escolha fica salva neste navegador. Experimente MSAA para manter as cartas nítidas ou
FXAA para um filtro leve; SSAA pode reduzir bastante a fluidez. TAA é experimental:
acumula qualidade somente quando câmera e objetos ficam parados e reinicia com movimento.
As animações dos robôs podem impedir essa acumulação. Os limites de resolução e a redução
automática em aparelhos lentos continuam ativos em todos os modos.

O zoom máximo em primeira pessoa é configurado em `src/scene/cameraSettings.ts`,
na propriedade `FIRST_PERSON_CAMERA.maxZoom` (padrão: `2.5`, ou 2,5×; `1` desativa
o zoom). Cada `CameraRig` também permite ajustar `maxFirstPersonZoom`.

Ao soltar o mouse ou toque depois de olhar ao redor enquanto sentado, a câmera e
a cabeça voltam suavemente à direção inicial, preservando o zoom. Para manter o
último olhar como antes, defina `SEATED_CAMERA.returnOnLookRelease` como `false`
em `src/scene/cameraSettings.ts`. Esse retorno não afeta a caminhada de observadores.
A duração do retorno é ajustável em `SEATED_CAMERA.returnDurationSeconds` (padrão: 1,2 segundo).
Na visão da mesa, o zoom permite aproximar e voltar ao enquadramento inicial, sem afastar além dele.
Arraste com o mouse ou toque para deslocar o ponto observado até a borda circular da mesa.
Ao soltar, a câmera volta suavemente ao centro, preservando o zoom e a inclinação.
Em `src/scene/cameraSettings.ts`, `TABLE_CAMERA.angleDegrees` configura a inclinação a partir
da vertical (padrão: 15°; 0° olha diretamente de cima; limite: 45°), e
`TABLE_CAMERA.returnDurationSeconds` ajusta o retorno (padrão: 1,2 segundo).
Na **Sala de testes**, o controle **Ângulo da vista superior** permite experimentar valores
em tempo real. Para usar um valor no jogo, altere `TABLE_CAMERA.angleDegrees`.
A seta do dealer aparece apenas para jogadores vivos, em primeira pessoa ou na visão da mesa,
quando a moeda do dealer está fora da tela. Observadores e eliminados não veem essa seta.

## Publicar na Cloudflare

O projeto usa o plano gratuito de Workers e Durable Objects com SQLite, sem máquina virtual. A aplicação e a API são publicadas juntas, no mesmo endereço HTTPS. Uma conta Cloudflare é necessária; não há credenciais incluídas no repositório.

```sh
npx wrangler login
npm run deploy
```

Wrangler cria o binding e aplica a migração definidos em `wrangler.jsonc`. Ele informa o endereço `https://garanto.<seu-subdominio>.workers.dev`. O nome do Worker pode ser alterado no arquivo antes de publicar. Não precisa comprar domínio.

### Conexão entre redes diferentes (TURN)

Sem configurar TURN, STUN e conexões diretas funcionam nas redes compatíveis, mas algumas redes móveis, corporativas ou com NAT restritivo podem impedir a conexão. Para oferecer retransmissão:

1. No dashboard Cloudflare, abra **Realtime → TURN** e crie uma chave. Guarde o **Key ID** e o **API token** fornecidos para gerar credenciais.
2. Cadastre-os como segredos do Worker, digitando os valores nos prompts, sem colocar tokens no código:

   ```sh
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_API_TOKEN
   ```

3. Entre novamente na sala. `/api/ice` gera credenciais temporárias apenas para sessões autenticadas. Tokens permanentes ficam no servidor.

Para testar localmente, copie `.dev.vars.example` para `.dev.vars` e preencha os dois valores. Esse arquivo está ignorado pelo Git.

Cloudflare anuncia uma franquia mensal compartilhada de 1.000 GB para TURN/SFU; há cobrança excedente. Consulte os [preços oficiais](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) e os requisitos da sua conta. Detalhes das alternativas e custos: [pesquisa de infraestrutura](docs/pesquisa-multiplayer.md).

## Laboratório de cena

Com `npm run dev`, abra `http://localhost:5173/?scene=lab` para inspecionar a sala, iluminação, robôs e cartas do jogo em uma cena local exclusiva de desenvolvimento. Ela inclui uma rodada congelada, um robô imóvel em pé e um robô controlável com a caminhada dos eliminados, além de câmeras em primeira pessoa, terceira pessoa e vista superior. Acesso, controles e manutenção estão em [docs/sala-de-testes.md](docs/sala-de-testes.md).

## Playwright MCP no Codex

O servidor está configurado para este repositório em `.codex/config.toml` e o
pacote `@playwright/mcp` é instalado com `npm install`. Reabra a sessão do Codex
com este projeto marcado como confiável para carregar as ferramentas `browser_*`.

A configuração usa o Google Chrome instalado na máquina, em modo headless e com
perfil isolado. Capturas e outros arquivos gerados ficam em `.tools/playwright`,
ignorado pelo Git. Execute `npm run dev` antes de pedir ao agente para abrir
`http://localhost:5173`; para testar salas, inicie também `npm run dev:cloudflare`.

## Verificar

```sh
npm run check   # formatação (Prettier), lint (ESLint), tipos (tsc) e testes
npm run build
```

- `npm run lint` usa ESLint com `typescript-eslint` estrito e limites de legibilidade: complexidade cognitiva ≤ 10 (`eslint-plugin-sonarjs`), complexidade ciclomática ≤ 12, funções com até 70 linhas, no máximo 4 parâmetros e nomes com 2+ letras.
- `npm run format` aplica o Prettier; `npm run lint:fix` corrige o que for automático.
- `npm run typecheck` verifica separadamente navegador, Worker, testes e configuração.

Os testes cobrem ranking/manilhas, ordem do dealer, apostas inválidas, distribuição de 40 cartas, coleta de vazas, vidas, progressão/votação, desconexão, revanche, bots eliminados, partidas completas de 2 a 10 jogadores e o limitador de mensagens do Worker.

O teste de API/WebSocket é opcional e usa o Worker local em execução:

```powershell
$env:GARANTO_INTEGRATION_URL = 'http://localhost:8787'
npm test
```

Em bash: `GARANTO_INTEGRATION_URL=http://localhost:8787 npm test`.

O arquivo `tests/browser.integration.ts` executa três clientes reais de WebRTC dentro de um navegador, testando cabeça, zoom, caminhada, braços, arraste, lançamento e posições das cartas, além de migração e reconexão. Com Vite e o Worker abertos, execute na console do navegador:

```js
await import('/tests/browser.integration.ts').then(module => module.run())
```

## Organização e limites

Todo o código é TypeScript estrito.

- `src/game/`: regras puras, sem interface ou rede. `applyAction`, `tick` e `reconcilePresence` recebem um estado e devolvem outro; `validate.ts` higieniza estados recebidos de outros navegadores.
- `src/net/`: sessão (`session.ts`), sinalização por WebSocket, conexões WebRTC (`peers.ts`), mensagens entre pares e cópias de recuperação na aba.
- `src/scene/`: mesa 3D. `tableScene.ts` coordena; robôs, sala, cartas da mesa, mãos, câmera (`cameraRig.ts`) e entrada (`input.ts`) ficam em módulos próprios.
- `src/ui/`: controlador (`app.ts`) e telas em `views/`. O HTML é gerado pelo template `html` (escapa tudo por padrão) e aplicado por `morph`, que atualiza só o que mudou e preserva foco, menus abertos e transições.
- `src/shared/`: tipos do protocolo entre navegador e Worker.
- `worker/`: Durable Object `Lobby` (salas, admissão com senha, WebSockets com hibernação, eleição de host, credenciais TURN) e limites de uso.

Cartas, personagens e animações são gerados no código, sem downloads de modelos. A renderização limita a resolução no celular e não usa sombras em tempo real. Cabeça, zoom, posição dos eliminados, braços durante o arraste e transformações das cartas são transmitidos a até 20 Hz e interpolados na cena. Todos entram sentados, inclusive espectadores que chegam durante a partida. Apenas eliminados aparecem também como robôs em pé, com passos e olhar independente do corpo; cada um recebe um ponto separado ao redor da mesa ao começar a caminhar. A interface funciona em orientação retrato e paisagem; desempenho em aparelhos físicos ainda deve ser medido.

Cada conexão WebRTC tem dois canais: jogadas e estados completos usam entrega confiável e ordenada; movimentos usam um canal sem retransmissão, com sequências para descartar pacotes atrasados. O host autentica o autor das poses, valida seus valores e só aceita arrastes e lançamentos de cartas da mão do jogador. Sob congestionamento, as jogadas ficam na fila e estados completos antigos são substituídos pelo mais recente. Quem reconecta recebe as poses atuais; a troca de host reinicia as sequências e retoma a transmissão da cena.

A física usa JoltPhysics em WebAssembly, servido junto com o jogo, com passos fixos de 60 Hz. Mesa, chão, paredes e cadeiras ocupadas têm colisores fixos; os corpos dos robôs e as cartas seguradas acompanham suas animações. Observadores colidem com a sala e deslizam ao longo dos obstáculos. Cartas jogadas caem com gravidade, atrito e colisão contínua; depois são organizadas nos espaços e pilhas da partida, mantendo a face legível e a espessura das cartas. Na partida online, o host simula a física das cartas a partir do ponto e do impulso de lançamento validados e transmite as transformações aos convidados, que as interpolam sem simular outra queda. As amostras visuais aguardam a versão correspondente das regras. A caminhada tem colisões locais e transmite a posição aceita; as regras e os resultados continuam definidos pelo estado validado da partida. No laboratório, a simulação continua local: uma cadeira vazia pode ser empurrada e o botão **Soltar carta na cadeira** demonstra a queda sobre os móveis e o chão.

É um jogo casual entre amigos: o host valida jogadas, mas as cópias de recuperação contêm todas as mãos. A interface as esconde dos jogadores vivos; inspecionar os dados internos do navegador pode revelá-las. Se todos fecharem suas abas, não há servidor de partidas para continuar o jogo; retomar depende de uma aba que conserve o backup. Navegadores móveis podem suspender o host ao bloquear a tela, por isso mantenha a aba aberta durante a partida.
