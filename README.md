# Garanto

Jogo de cartas 3D para reunir de 2 a 10 jogadores, com personagens robóticos próprios, palpites, manilhas e cinco vidas. Three.js renderiza a mesa; WebRTC transmite a partida; Cloudflare Workers e Durable Objects cuidam das salas e da sinalização.

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
- Escolha uma cor disponível, sente e marque pronto. A cor fica bloqueada ao sentar. O host pode adicionar bots e inicia quando todos os jogadores sentados estiverem prontos.
- Aposte quantas vazas vai ganhar. O jogador seguinte ao dealer, no sentido anti-horário, começa as apostas e a primeira vaza. O dealer é o último em ambas.
- Na primeira pessoa, arraste cartas para ordenar; arraste para cima para jogar. Também pode selecionar a carta e usar o botão de jogar. Arraste a área livre para olhar.
- **Espaço** alterna entre primeira pessoa e visão de cima. Nesta última, a mão fica bloqueada. Use a roda do mouse ou pinça para zoom; passe o mouse por dois segundos ou toque prolongadamente para inspecionar cartas e vazas coletadas. **ESC** ou clique fora encerra a inspeção.
- Eliminados podem ver todas as mãos e passear em primeira pessoa: no computador, use **WASD** e clique na cena para capturar o mouse e olhar como em um FPS (**Esc** libera o cursor); no celular, use o joystick para andar e arraste na cena para olhar. Toque no nome de um jogador para consultar sua mão como espectador.
- Participantes que chegam durante uma partida entram como espectadores. Use o chat para conversar.
- Desconexão pausa a mesa por três minutos. Expirado o prazo, o jogador é eliminado, a rodada atual é cancelada e redistribuída, sem penalidade de vidas aos demais. A quantidade de cartas e o modo são mantidos; kicker e mãos são sorteados novamente.
- O host é transferido automaticamente para um participante conectado. O antigo host pode voltar como jogador. Recarregue a página e use **Retomar minha sala** na mesma aba; a sessão e o último estado recebido são guardados no armazenamento da aba.

As regras completas estão em [garanto_regras.md](garanto_regras.md); decisões adicionais, em [docs/decisoes-do-jogo.md](docs/decisoes-do-jogo.md).

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

O arquivo `tests/browser.integration.ts` executa clientes reais de WebRTC dentro de um navegador, testando migração e reconexão. Com Vite e o Worker abertos, execute na console do navegador:

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

Cartas, personagens e animações são gerados no código, sem downloads de modelos. A renderização limita a resolução no celular, não usa sombras em tempo real e transmite poses com frequência reduzida. A interface funciona em orientação retrato e paisagem; desempenho em aparelhos físicos ainda deve ser medido.

É um jogo casual entre amigos: o host valida jogadas, mas as cópias de recuperação contêm todas as mãos. A interface as esconde dos jogadores vivos; inspecionar os dados internos do navegador pode revelá-las. Se todos fecharem suas abas, não há servidor de partidas para continuar o jogo; retomar depende de uma aba que conserve o backup. Navegadores móveis podem suspender o host ao bloquear a tela, por isso mantenha a aba aberta durante a partida.
