import { hotSettings, settingsChanged } from './hotSettings';

/** Pós-processamento compartilhado pelo jogo e laboratório; salvar reconstrói os passes sem recarregar a página. */
export const POST_PROCESSING = hotSettings(import.meta.hot, 'POST_PROCESSING', {
  enabled: true,
  colorGrading: {
    enabled: true,
    /** Mistura com a imagem original (0–1); 0 é neutro. */
    strength: 0.65,
    /** Compensação de exposição em stops; 0 é neutro, +1 dobra o brilho. */
    exposure: 0,
    /** Contraste e saturação: 1 é neutro; faixa sutil 0,9–1,1; saturação 0 remove as cores. */
    contrast: 1.04,
    saturation: 0.95,
    /** Brilho de referência mantido pelo contraste (0–1). */
    contrastPivot: 0.5,
    /** Faixas de luminância (0–1); end deve superar start. */
    shadowRange: { start: 0, end: 0.55 },
    highlightRange: { start: 0.45, end: 1 },
    /** Multiplicadores dos canais RGB; 1 é neutro. */
    shadows: { red: 0.96, green: 1.02, blue: 1.06 },
    highlights: { red: 1.04, green: 1.01, blue: 0.96 },
  },
  ambientOcclusion: {
    enabled: true,
    /** Força da oclusão (0–1); 0 não escurece os contatos. */
    strength: 0.35,
    /** Raio de amostragem em unidades da cena; faixa útil 0,15–0,6. */
    kernelRadius: 0.35,
    /** Diferenças de profundidade normalizadas pelo recorte da câmera; minDistance deve ser menor que maxDistance. */
    minDistance: 0.0005,
    maxDistance: 0.02,
    /** Número inteiro positivo de amostras; 16–32 costuma bastar e valores maiores custam mais GPU. */
    kernelSize: 16,
    /** Fração da resolução de desenho (>0 e até 1); 0,5 reduz o custo. */
    resolutionScale: 0.5,
    /** Camada excluída da oclusão, compartilhada com as mãos/cartas em primeira pessoa. */
    excludedLayer: 1,
  },
  bloom: {
    enabled: true,
    strength: 0.16,
    /** Espalhamento do brilho (0–1). */
    radius: 0.35,
    /** Limiar de luminância HDR linear; acima de 1 protege o papel branco. */
    threshold: 1.1,
    /** Fração da resolução de desenho (>0 e até 1); 0,5 reduz o custo. */
    resolutionScale: 0.5,
    /** Radiância linear das lâmpadas e emissão dos olhos; 0 remove a luminosidade do material. */
    lampRadiance: 2.2,
    eyeEmission: 1,
  },
  vignette: {
    enabled: true,
    /** Escurecimento máximo das bordas (0–1); 0 é neutro. */
    strength: 0.16,
    /** Raio preservado: 0 no centro, 1 nos cantos; acompanha a proporção da tela. */
    radius: 0.35,
    /** Largura da transição radial; valores positivos maiores suavizam a borda. */
    softness: 0.6,
  },
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('postProcessingSettings');
  });
