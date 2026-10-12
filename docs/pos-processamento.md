# Pós-processamento

Os quatro efeitos são compartilhados pelo jogo e pela sala de testes. Edite
`POST_PROCESSING` em [`src/scene/postProcessingSettings.ts`](../src/scene/postProcessingSettings.ts)
e recarregue a página para reconstruir os passes e os materiais com seus ajustes.
Os padrões são discretos: sombras levemente frias, luzes quentes, brilho restrito
a fontes luminosas e escurecimento suave nas bordas.

No menu **Gráficos**, a opção **Pós-processamento** liga ou desliga os quatro efeitos
imediatamente, no jogo e na sala de testes. A escolha fica salva neste navegador.
O `enabled` do objeto principal define o padrão quando não há preferência salva.
Cada efeito também tem seu próprio `enabled`, preservado ao alternar a opção do menu.
A suavização de bordas continua independente; selecionar **Desligado** na lista
de suavização desliga apenas a suavização.
Esses parâmetros são locais à renderização e não fazem parte do estado multiplayer.

| Efeito | Parâmetro | Como ajustar |
| --- | --- | --- |
| Cor | `strength` | Mistura de 0 a 1. Zero preserva a imagem original. |
| Cor | `exposure` | Compensação em stops após o tone mapping. Zero é neutro; +1 dobra os valores da imagem antes do limite de brilho. Para exposição da iluminação HDR, use `renderer.toneMappingExposure` em `environment.ts`. |
| Cor | `contrast`, `saturation` | 1 é neutro. Comece entre 0,9 e 1,1; saturação zero deixa a imagem em tons de cinza. |
| Cor | `contrastPivot` | Brilho de referência do contraste, entre 0 e 1. |
| Cor | `shadows`, `highlights` | Multiplicadores `red`, `green`, `blue`. Todos em 1 são neutros. |
| Cor | `shadowRange`, `highlightRange` | Transições de luminância da imagem, de 0 a 1. `end` deve superar `start`. A cor das sombras perde força na primeira faixa; a dos realces ganha força na segunda. |
| Oclusão | `strength` | Escurecimento entre 0 e 1. Zero é neutro. |
| Oclusão | `kernelRadius` | Raio de amostragem em unidades da cena. Comece entre 0,15 e 0,6 para contatos pequenos. |
| Oclusão | `minDistance`, `maxDistance` | Limites de diferença de profundidade, normalizados pelo intervalo de recorte da câmera. Mantenha `minDistance` menor que `maxDistance`; ampliar demais produz halos. |
| Oclusão | `kernelSize` | Quantidade inteira positiva de amostras. 16 é o padrão; 32 custa mais GPU. |
| Oclusão | `resolutionScale` | Fração da resolução de desenho, maior que 0 e até 1. 0,5 reduz o custo. |
| Oclusão | `excludedLayer` | Camada das mãos/cartas em primeira pessoa, atualmente 1. Mantenha alinhada com `hands.ts`. |
| Bloom | `strength` | Intensidade; zero é neutro. Comece entre 0,1 e 0,3. |
| Bloom | `radius` | Espalhamento do halo entre 0 e 1. |
| Bloom | `threshold` | Corte de luminância linear HDR, antes do tone mapping. Acima de 1 reduz o brilho indesejado do papel das cartas. |
| Bloom | `resolutionScale` | Fração da resolução de desenho do maior buffer de brilho, maior que 0 e até 1. |
| Bloom | `lampRadiance`, `eyeEmission` | Radiância das superfícies das lâmpadas e emissão dos olhos dos robôs. Alteram materiais, mesmo quando o passe de bloom está desligado. |
| Vinheta | `strength` | Escurecimento máximo das bordas entre 0 e 1. Zero é neutro. |
| Vinheta | `radius` | Centro preservado: 0 no centro, 1 nos cantos. O meio das bordas corresponde a aproximadamente 0,707. |
| Vinheta | `softness` | Largura da transição nas mesmas unidades radiais. Valores maiores deixam a borda mais suave. |

## Ordem e validação

O pipeline renderiza a cena com a suavização escolhida, aplica oclusão e bloom em
HDR linear, aplica SMAA quando selecionado, converte a saída uma vez com
`OutputPass`, aplica cor e vinheta e termina com FXAA quando selecionado.
A oclusão usa profundidade da sala e uma máscara separada das mãos, preservando
as cartas seguradas e a suavização da sobreposição em primeira pessoa.

Abra `/?scene=lab` no servidor de desenvolvimento para comparar a vista superior,
primeira pessoa e terceira pessoa. Confira cartas vermelhas e pretas, contatos dos
móveis com o chão, olhos luminosos e bordas em tela vertical e horizontal.
O HUD é HTML e fica fora dos efeitos.

Para verificar todos os modos de suavização e a sobreposição real das mãos,
execute no console do navegador:

```js
await import('/tests/browser.rendering.ts').then(module => module.run());
await import('/tests/browser.postprocessing.ts').then(module => module.run());
```

A segunda suíte verifica a neutralidade dos efeitos, a vinheta em retrato, o limiar
HDR do bloom e os contatos da oclusão com exclusão das mãos após zoom e resize.
