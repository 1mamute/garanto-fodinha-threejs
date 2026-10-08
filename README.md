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

Neste workspace também há um Node portátil em `.tools` (ignorado pelo Git). Para usá-lo no PowerShell, sem instalar globalmente:

```powershell
$env:PATH = "$((Resolve-Path .tools/node-v22.23.3-win-x64).Path);$env:PATH"
npm.cmd run dev:cloudflare
```

## Jogar

- Crie uma sala, opcionalmente com senha, ou entre na lista/código/link de convite. Convites não incluem a senha.
- Escolha uma cor disponível, sente e marque pronto. A cor fica bloqueada ao sentar. O host pode adicionar bots e inicia quando todos os jogadores sentados estiverem prontos.
- Aposte quantas vazas vai ganhar. O jogador seguinte ao dealer, no sentido anti-horário, começa as apostas e a primeira vaza. O dealer é o último em ambas.
- Na primeira pessoa, arraste cartas para ordenar; arraste para cima para jogar. Também pode selecionar a carta e usar o botão de jogar. Arraste a área livre para olhar.
- **Espaço** alterna entre primeira pessoa e visão de cima. Nesta última, a mão fica bloqueada. Use a roda do mouse ou pinça para zoom; passe o mouse por dois segundos ou toque prolongadamente para inspecionar cartas e vazas coletadas. **ESC** ou clique fora encerra a inspeção.
- Eliminados podem ver todas as mãos e passear usando **WASD** ou o joystick no celular. Toque no nome de um jogador para consultar sua mão como espectador.
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

## Verificar

```sh
npm test
npm run build
```

Os testes cobrem ranking/manilhas, ordem do dealer, apostas inválidas, distribuição de 40 cartas, coleta de vazas, vidas, progressão/votação, desconexão e partidas completas de 2 a 10 jogadores.

O teste de API/WebSocket é opcional e usa o Worker local em execução:

```powershell
$env:GARANTO_INTEGRATION_URL = 'http://localhost:8787'
npm test
```

Em bash: `GARANTO_INTEGRATION_URL=http://localhost:8787 npm test`.

O arquivo `tests/browser.integration.js` executa clientes reais de WebRTC dentro de um navegador, testando migração e reconexão. Com Vite e o Worker abertos, execute na console do navegador:

```js
await import('/tests/browser.integration.js').then(m => m.run())
```

## Organização e limites

- `src/game.js`: regras e transições de estado, sem interface ou rede.
- `src/network.js`: sessão, sinalização, WebRTC, eleição anunciada pelo backend e cópias de recuperação.
- `src/scene.js`: geometria procedural, animações, câmera, cartas, seleção e movimentação.
- `src/main.js` e `src/style.css`: interface responsiva e controles acessíveis alternativos às cartas 3D.
- `worker/index.js`: diretório persistente, admissão com senha, WebSockets com hibernação e credenciais TURN.

Cartas, personagens e animações são gerados no código, sem downloads de modelos. A renderização limita a resolução no celular, não usa sombras em tempo real e transmite poses com frequência reduzida. A interface funciona em orientação retrato e paisagem; desempenho em aparelhos físicos ainda deve ser medido.

É um jogo casual entre amigos: o host valida jogadas, mas as cópias de recuperação contêm todas as mãos. A interface as esconde dos jogadores vivos; inspecionar os dados internos do navegador pode revelá-las. Se todos fecharem suas abas, não há servidor de partidas para continuar o jogo; retomar depende de uma aba que conserve o backup. Navegadores móveis podem suspender o host ao bloquear a tela, por isso mantenha a aba aberta durante a partida.
