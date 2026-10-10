# Decisões de implementação

Confirmadas na conversa em 7 de outubro de 2026. Estas decisões prevalecem sobre trechos contraditórios de `garanto_regras.md`.

- Apostas e primeira vaza começam com o próximo jogador vivo depois do dealer, no sentido anti-horário. O dealer é o último em ambas. Vazas seguintes começam com o vencedor da anterior.
- Ordem dos assentos e primeiro dealer são sorteados no início da partida.
- Partida entre amigos, sem proteção rigorosa contra inspeção dos dados internos do navegador. A interface esconde as mãos alheias dos jogadores vivos.
- Multiplayer P2P, com transferência automática de host. Cloudflare Workers e Durable Objects fazem descoberta de salas e sinalização; Cloudflare TURN atende redes que exigem retransmissão.
- Desconexão pausa a partida por até três minutos para reconexão. Expirado o prazo, o jogador é eliminado e a rodada é cancelada e redistribuída, sem penalidade de vidas para os demais. O prazo também vale para o antigo host após a transferência.
- Não há limite de tempo para apostar ou jogar.
- Bots opcionais, para jogar sozinho ou preencher salas.
- Cada pessoa senta automaticamente ao entrar na sala. Antes da partida, escolhe uma cor disponível e marca que está pronta; a cor fica bloqueada enquanto estiver pronta. O host inicia quando todos os jogadores da partida estiverem prontos.
- Participantes que chegam durante a partida ficam sentados como espectadores, sem caminhar, até haver vaga na próxima partida. A revanche respeita a capacidade da mesa.
- Personagens próprios, robóticos, com visual cômico, simples e estiloso; luvas brancas e braços no estilo Rubber Hose.
- Mesa redonda com pano verde, sala aconchegante e cartunesca, cartas tradicionais legíveis e efeitos sonoros discretos.
- Computador e celular, com prioridade para desempenho leve. Interface em português, sem necessidade de conta.
- Computador: arrastar a área livre para olhar, Espaço para trocar perspectiva e WASD para andar após ser eliminado.
- Celular: arrastar a área livre para olhar, botão para trocar perspectiva, pinça para zoom de cima, toque prolongado para inspeção e joystick virtual para andar após ser eliminado.
- Visão de cima permite zoom e inspeção, mas não jogar ou reordenar a mão. No computador, inspeção começa após dois segundos sobre a carta; ESC ou clique fora encerra.
- Jogadores vivos ficam sentados e veem apenas a própria mão. Eliminados podem andar e ver todas as mãos.
- Cartas das vazas anteriores ficam disponíveis para inspeção até o fim da rodada, identificando quem jogou cada carta.
- Votação Reset/Decrescente tem prazo máximo de 30 segundos e termina antecipadamente quando todos os jogadores aptos tiverem votado.
- Apenas chat de texto nesta versão.

## Detalhes de redistribuição

- Ao redistribuir uma rodada cancelada por desconexão: manter a quantidade de cartas, o modo de progressão e o dealer (ou seu próximo vivo), e sortear novamente o kicker e as mãos. Se a quantidade ultrapassar o limite do baralho, aplicar as regras de votação.
