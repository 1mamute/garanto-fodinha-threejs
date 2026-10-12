# Configurações

Os ajustes editáveis ficam nesta pasta, separados por assunto. Os comentários nos
arquivos explicam as unidades, os limites e os valores neutros. Com `npm run dev`
aberto, salvar um arquivo `*Settings.ts` aplica as alterações ao jogo e ao laboratório
sem recarregar a página. A câmera, a posição do personagem e a partida são preservadas.

| Arquivo | O que controla |
| --- | --- |
| `cameraSettings.ts` | Campo de visão, zoom, limites do olhar, inclinação e transições. |
| `interactionSettings.ts` | Mouse, toque, arrasto de cartas, inspeção e joystick. |
| `cardAppearanceSettings.ts` | Dimensões, resolução e cores das cartas. |
| `cardMotionSettings.ts` | Lançamento, deslizamento, retorno e contato das cartas. |
| `handSettings.ts` | Leque de cartas dos robôs. |
| `tableSettings.ts` | Assentos, posições das cartas e frequência de envio das poses. |
| `roomSettings.ts` | Dimensões da sala, mesa, feltro e posições das luminárias. |
| `environmentSettings.ts` | Luzes, neblina, fundo e exposição. |
| `postProcessingSettings.ts` | Cor, oclusão, bloom e vinheta. |
| `graphicsSettings.ts` | Suavização e orçamento de resolução/desempenho. |
| `robotSettings.ts` | Proporções dos robôs e alturas derivadas. |
| `robotAnimationSettings.ts` | Olhar, caminhada, respiração, jogada e eliminação. |
| `playerSettings.ts` | Velocidade, nascimento dos observadores e expiração das poses. |
| `physicsSettings.ts` | Gravidade, passo fixo, cápsula do personagem e precisão dos colisores. |
| `uiSettings.ts` | Intervalos de atualização dos contadores e da lista de salas. |
| `sceneSettings.ts` | Suavização compartilhada das cenas. |
| `turnIndicatorSettings.ts` | Destaque do turno, luz, cone, anel, seta e alvo da prévia. |
| `dealerIndicatorSettings.ts` | Posição da seta do dealer fora do enquadramento. |
| `soundSettings.ts` | Perfis dos sons e duração das mensagens temporárias. |
| `fpsMeterSettings.ts` | Intervalo e visibilidade padrão do medidor de FPS. |

Preferências salvas pelo jogador continuam tendo prioridade sobre os padrões de
gráficos, pós-processamento e FPS. Sons, novos lançamentos e novos nascimentos usam
os ajustes atualizados na próxima ação correspondente. Constantes matemáticas,
identificadores do protocolo e regras do baralho permanecem nos seus módulos.

`hotSettings.ts` mantém as referências aos objetos de configuração, inclusive os
objetos internos, ao receber atualizações do Vite. Os consumidores leem esses valores
durante a execução; recursos criados anteriormente recebem notificações para atualizar
materiais, passes, geometrias e colisores. Ao adicionar configurações, use esse mecanismo
e registre a atualização de qualquer valor copiado por um construtor.
