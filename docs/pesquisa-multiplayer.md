# Multiplayer P2P: conexão, salas e hospedagem

Pesquisa em fontes oficiais, consultada em 7 de outubro de 2026. Valores em dólares americanos, sujeitos a mudança; nenhuma alternativa garante custo zero para qualquer volume.

## Recomendação

Para começar sem mensalidade obrigatória, usar **Cloudflare Workers Free + Durable Objects SQLite para descoberta de salas e sinalização**, hospedagem estática no mesmo provedor e **Cloudflare Realtime TURN como alternativa quando a conexão direta falhar**. A partida continua no navegador do host, transmitida por WebRTC DataChannel. Essa é uma recomendação de arquitetura, baseada nos limites abaixo; exige uma conta e configurar serviços, embora dispense administrar uma máquina virtual.

Se houver preferência por AWS, **API Gateway WebSocket + Lambda + DynamoDB** é adequado e pode custar pouco com baixa utilização. Lambda não substitui sozinho um servidor WebSocket persistente: API Gateway administra as conexões e chama funções quando chegam eventos. A AWS fornece uma implementação oficial dessa composição. [Tutorial da AWS](https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-chat-app.html).

## O que significa “sem servidor”

WebRTC não inclui sinalização: os participantes precisam trocar descrições SDP (oferta e resposta) e candidatos ICE por algum outro canal. Pode-se esperar a coleta de ICE terminar e copiar os dados manualmente. [Conexão e sinalização WebRTC](https://webrtc.org/getting-started/peer-connections).

Fluxo manual proposto: o host gera uma oferta para um convidado; o convidado importa a oferta e devolve uma resposta; o host importa a resposta. Repetir para cada convidado. Depois de conectar, as mensagens seguem pelo DataChannel. **Um código curto de sala não contém essa negociação toda**: normalmente ele referencia dados guardados em algum serviço. Essa descrição do fluxo é uma aplicação das APIs documentadas, não uma funcionalidade pronta do navegador.

Sem diretório compartilhado, não há lista global automática de salas. Reconexão e transferência de host também tornam a troca manual repetitiva. STUN ajuda a descobrir endereços; TURN retransmite tráfego quando o caminho direto não funciona. Logo, dispensar servidor próprio não significa dispensar infraestrutura externa, nem garante conectar quaisquer redes. [TURN e conectividade](https://webrtc.org/getting-started/turn-server).

O modo totalmente manual pode ser opcional para testes ou grupos pequenos, mas não é recomendado como caminho principal para computador e celular.

## AWS Lambda: implementação e custo

Arquitetura proposta:

- Site estático com Three.js servido por HTTPS.
- API Gateway WebSocket recebe conexões, entrada/saída de sala, presença e mensagens SDP/ICE.
- Lambda valida senha e ingresso, encaminha sinalização e registra metadados.
- DynamoDB mantém salas, conexões, identidade de reconexão e geração do host.
- WebRTC envia jogadas, chat e orientação dos personagens entre navegadores; TURN é um serviço separado.

Essa divisão é uma proposta para o jogo, baseada na arquitetura oficial AWS citada acima. Não enviar frames 3D ou animações pelo backend; cada cliente renderiza localmente.

O exemplo oficial de **US East (N. Virginia)** usa **US$ 1 por milhão de mensagens WebSocket e US$ 0,25 por milhão de minutos conectados**. Mensagens recebidas e enviadas são cobradas; tamanhos maiores podem consumir unidades adicionais. Como ilustração aritmética, 100 mil mensagens faturáveis + 100 mil minutos custariam **US$ 0,125 apenas no API Gateway**, antes de franquias, Lambda, banco, logs, transferência e TURN. Não é orçamento para uma região brasileira nem estimativa de tráfego real. [Preços e exemplo do API Gateway](https://aws.amazon.com/api-gateway/pricing/).

Lambda Functions inclui na tabela uma franquia de **1 milhão de requisições e 400 mil GB-s mensais**; provisioned concurrency tem cobrança própria e não recebe essa franquia. [Preços Lambda](https://aws.amazon.com/lambda/pricing/).

DynamoDB anuncia **25 GB de armazenamento** e **25 unidades de leitura/escrita provisionadas** no free tier. Essas unidades provisionadas não significam leituras/escritas on-demand ilimitadas gratuitas; o modo de capacidade deve ser escolhido conscientemente. [Preços DynamoDB](https://aws.amazon.com/dynamodb/pricing/).

A página API Gateway ainda descreve a oferta de até 12 meses para novos clientes, junto do programa para contas novas desde 15/07/2025: **até US$ 200 em créditos**, plano gratuito por **6 meses** e créditos com validade de até **12 meses**. Portanto, a elegibilidade depende da conta, e créditos introdutórios não devem ser tratados como gratuidade permanente. Confirmar os benefícios no console da conta antes de implantar. [Free tier do API Gateway](https://aws.amazon.com/api-gateway/pricing/).

API Gateway limita WebSockets a **2 horas por conexão**, com **10 minutos de inatividade** e integração de até **29 segundos**. Implementar heartbeat, reconexão automática e renovação do socket de sinalização; fechar esse socket não deve, sozinho, eliminar jogador cujo canal P2P ainda funciona. [Limites oficiais](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-execution-service-websocket-limits-table.html).

## Alternativas gratuitas

| Alternativa | Franquia ou característica verificada | Aplicação ao jogo |
| --- | --- | --- |
| Cloudflare Workers Free | 100 mil requisições/dia, 10 ms de CPU por invocação | Endpoints de lista, ingresso e emissão de credenciais; respeitar CPU ao escolher derivação de senha. |
| Cloudflare Durable Objects Free | SQLite disponível; 100 mil requests/dia e 13 mil GB-s/dia; ultrapassar limites causa falhas | Diretório de salas e coordenação WebSocket. Usar API de hibernação para não manter objetos ativos enquanto esperam. |
| Supabase Free | 200 conexões simultâneas, 2 milhões de mensagens Realtime/mês, limite de 100 mensagens/s | Presence/Broadcast para sinalização e banco para salas; TURN continua separado. |
| PeerServer Cloud | Serviço PeerJS gratuito e compartilhado; documentação recomenda servidor próprio para alto tráfego | Atalho para protótipo por código de convite; não entrega o diretório e regras de senha do jogo. |

Fontes: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase limits](https://supabase.com/docs/guides/realtime/limits), [PeerJS server getting started](https://peerjs.com/server/getting-started), [PeerServer Cloud](https://peerjs.com/server/cloud).

Na Cloudflare, usar hibernação é relevante: sockets aceitos pela API convencional mantêm duração faturável; a API de hibernação permite suspender o objeto entre eventos. Mensagens WebSocket de saída não são cobradas como requests; as de entrada recebem razão 20:1 para cálculo de requests. As cotas do Worker e do Durable Object são distintas. [Cobrança de Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Supabase pode pausar projetos Free com pouca atividade ao longo de sete dias; isso exige considerar a retomada para um jogo usado esporadicamente. PeerServer Cloud é compartilhado e não oferece na documentação consultada um SLA ou franquia de TURN que possa ser prometida para este projeto. [Pausa no Supabase](https://supabase.com/docs/guides/platform/free-project-pausing), [PeerServer Cloud](https://peerjs.com/server/cloud).

Os arquivos estáticos no Cloudflare Workers têm requisições gratuitas e ilimitadas, sem custo adicional de armazenamento de assets; chamadas ao Worker continuam sujeitas às suas cotas. Separar `/api` dos arquivos do jogo. [Static Assets: cobrança e limitações](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## TURN

Cloudflare Realtime anuncia **1.000 GB por mês de franquia compartilhada entre SFU e TURN**, **US$ 0,05/GB excedente** e STUN gratuito ilimitado. A tabela de preços aplica a franquia aos dois serviços; não exige usar o SFU junto para receber essa franquia. A página do produto também descreve uso standalone e com arquitetura P2P. A medição TURN considera dados enviados da borda ao cliente, incluindo overhead. Não confundir STUN grátis com retransmissão ilimitada grátis. [Preços Realtime](https://developers.cloudflare.com/realtime/sfu/platform/pricing/), [produto TURN/SFU](https://www.cloudflare.com/products/turn-sfu/), [FAQ oficial TURN](https://developers.cloudflare.com/realtime/turn/faq/).

A página comercial anuncia início gratuito sem cartão. Já a FAQ distingue planos enterprise e self-service pagos por cartão. As páginas consultadas não detalham todos os requisitos de ativação específicos da conta: confirmar no dashboard antes de prometer ativação TURN sem forma de pagamento. A franquia é recorrente na tabela, não crédito introdutório de uso único. [Produto TURN/SFU](https://www.cloudflare.com/products/turn-sfu/), [FAQ TURN](https://developers.cloudflare.com/realtime/turn/faq/).

Um endpoint backend deve gerar credenciais temporárias. A chave permanente e o token da API ficam no servidor, nunca no bundle do navegador. A documentação também permite atualizar a configuração ICE durante a sessão. [Geração de credenciais](https://developers.cloudflare.com/realtime/turn/generate-credentials/).

Como o jogo só transmite comandos, chat e poses, sem vídeo ou voz, espera-se tráfego muito menor que videoconferência. Isso é uma inferência de projeto: medir bytes reais e evitar sincronizar a cada frame antes de estimar consumo.

## Migração de host e cartas escondidas

As decisões abaixo são recomendações de implementação, não recursos automáticos dos provedores:

1. Manter estado público versionado e log de ações confirmadas. Sinalização guarda o host atual e uma geração crescente para evitar dois hosts após reconexão.
2. Eleger um sucessor conectado, renovar conexões P2P e pausar o jogo. O jogador desconectado conserva seu lugar por três minutos, mesmo quando era host.
3. Persistir identidade de reconexão por token; nome e cor não bastam para recuperar uma cadeira.
4. Retomar apenas de um estado confirmado. Definir antes da implementação o tratamento de carta enviada mas ainda não confirmada no instante da queda.

Existe um compromisso importante: o host que distribui e valida cartas conhece todas as mãos. Replicar o estado privado inteiro para qualquer possível sucessor também revela as mãos ao código desses navegadores, mesmo que a interface não as mostre. Sem esse backup, a saída abrupta do host pode perder informações necessárias para continuar a rodada, sobretudo cartas de jogadores também desconectados.

Para uma partida casual entre amigos, é possível aceitar host e sucessor como participantes confiáveis, ou manter um backup privado criptografado num serviço com liberação ao host eleito. Esse segundo caminho preserva a informação dos demais clientes comuns, mas requer protocolo adicional e ainda confia no host. Proteção forte contra host malicioso exigiria autoridade no backend ou protocolo criptográfico de distribuição; não prometer antitrapaça forte em P2P simples.

A migração transparente, senha opcional, reconexão e lista de salas favorecem claramente um pequeno serviço de coordenação. Minha escolha inicial é Cloudflare com cotas gratuitas, mantendo um adaptador de sinalização para AWS se essa for a preferência.
