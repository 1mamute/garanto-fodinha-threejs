# Direção visual

Garanto usa uma sala industrial escura, mesa circular de feltro sem inscrições e luz âmbar concentrada na partida. Os robôs têm pintura gasta, olhos expressivos e articulações simples. O clima é estranho e acolhedor, sem violência ou gore.

A entrada ocupa pouco espaço; o lobby acontece com a sala visível. Durante a partida, cartas e mãos físicas são o foco. Os controles de cartas em HTML continuam disponíveis como alternativa para teclado e toque. As regras não mudam.

## Orçamento de renderização

- Texturas de superfície procedurais de 128 × 128, compartilhadas e criadas uma vez; pintura dos robôs de 64 × 64.
- Geometria estática dos personagens agrupada por material; cartas usam três chamadas de desenho, em vez de seis.
- Uma luz pontual sobre a mesa, preenchimento hemisférico e luz direcional fria. Sem mapas de sombra, bloom, SSAO ou passes de pós-processamento. Sombras de contato usam uma textura pequena compartilhada.
- Celulares e dispositivos de ponteiro impreciso usam resolução máxima de um pixel renderizado por pixel CSS e cadência de aproximadamente 30 fps, também para a atualização visual. Desktop limita a densidade a 1,5.
- Se a taxa medida permanecer baixa durante uma janela de três segundos, a resolução cai em etapas, até 70% do limite inicial. Abas ocultas suspendem a atualização da cena. A simulação e a rede mantêm seus relógios independentes.
- Sem motor de física: poses, mãos, olhares e cartas usam animações controladas. Isso mantém as cartas previsíveis ao tocar ou arrastar.

## Validação

Execute `npm run check` e `npm run build`. Confira treino com bots em primeira pessoa, vista superior e inspeção de cartas; teste o lobby e os controles em retrato e paisagem. O laboratório continua usando os mesmos materiais, modelos e orçamento de renderização.

O preview em tamanho de celular valida enquadramento e controles, mas não substitui uma medição em aparelho físico intermediário. Antes de publicar, confira uma partida cheia nesse aparelho, observando aquecimento, leitura das cartas e resposta ao toque.
