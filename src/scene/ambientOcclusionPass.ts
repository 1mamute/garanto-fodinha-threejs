import {
  Color,
  HalfFloatType,
  Line,
  Material,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  Points,
  ShaderMaterial,
  Sprite,
  WebGLRenderTarget,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { POST_PROCESSING } from './postProcessingSettings';

const settings = POST_PROCESSING.ambientOcclusion;

/** Applies room occlusion to the existing AA image while protecting the hand overlay. */
export class AmbientOcclusionPass extends Pass {
  private readonly occlusion: SSAOPass;
  private readonly aoTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  private readonly maskTarget = new WebGLRenderTarget(1, 1);
  private readonly maskMaterial = new MeshBasicMaterial({ color: 'white', toneMapped: false });
  private readonly composite = createComposite();
  private readonly quad = new FullScreenQuad(this.composite);

  constructor(private readonly options: { scene: Scene; camera: PerspectiveCamera }) {
    super();
    this.enabled = settings.enabled;
    this.occlusion = new SSAOPass(options.scene, options.camera, 1, 1, settings.kernelSize);
    this.occlusion.output = SSAOPass.OUTPUT.Blur;
    this.occlusion.kernelRadius = settings.kernelRadius;
    this.occlusion.minDistance = settings.minDistance;
    this.occlusion.maxDistance = settings.maxDistance;
    this.composite.uniforms.aoTexture = { value: this.aoTarget.texture };
    this.composite.uniforms.maskTexture = { value: this.maskTarget.texture };
  }

  override setSize(width: number, height: number): void {
    const aoWidth = Math.max(1, Math.round(width * settings.resolutionScale));
    const aoHeight = Math.max(1, Math.round(height * settings.resolutionScale));
    this.occlusion.setSize(aoWidth, aoHeight);
    this.aoTarget.setSize(aoWidth, aoHeight);
    // Full resolution preserves the silhouette of thin held cards at the AO boundary.
    this.maskTarget.setSize(width, height);
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    const state = captureState(renderer, this.options);
    const hidden = hideNonOccluders(this.options.scene);
    try {
      this.options.scene.onAfterRender = () => {
        // Auxiliary geometry renders must not invoke the first-person beauty overlay.
      };
      this.options.scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      this.renderOcclusion(renderer);
      for (const object of hidden) object.visible = true;
      const hasMask = this.renderMask(renderer);
      this.composite.uniforms.beautyTexture = { value: readBuffer.texture };
      this.composite.uniforms.strength = { value: settings.strength };
      this.composite.uniforms.hasMask = { value: hasMask };
      renderer.autoClear = false;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    } finally {
      for (const object of hidden) object.visible = true;
      restoreState(renderer, this.options, state);
    }
  }

  override dispose(): void {
    // Three's SSAOPass.dispose omits these two resources in the installed version.
    this.occlusion.ssaoMaterial.dispose();
    this.occlusion.noiseTexture.dispose();
    this.occlusion.dispose();
    this.aoTarget.dispose();
    this.maskTarget.dispose();
    this.maskMaterial.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }

  private renderOcclusion(renderer: WebGLRenderer): void {
    this.options.camera.layers.disable(settings.excludedLayer);
    // Zoom changes the projection without resizing the viewport. SSAOPass only
    // refreshes its projection uniforms in setSize (unchanged target sizes are cheap).
    this.occlusion.setSize(this.aoTarget.width, this.aoTarget.height);
    this.occlusion.render(renderer, this.aoTarget, this.aoTarget, 0, false);
  }

  private renderMask(renderer: WebGLRenderer): boolean {
    const { scene, camera } = this.options;
    const maskMeshes: Object3D[] = [];
    camera.layers.set(settings.excludedLayer);
    scene.traverseVisible(object => {
      if (object instanceof Mesh && object.layers.test(camera.layers)) maskMeshes.push(object);
    });
    if (maskMeshes.length === 0) return false;
    scene.overrideMaterial = this.maskMaterial;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.maskTarget);
    renderer.setClearColor(0, 1);
    renderer.clear();
    renderer.render(scene, camera);
    return true;
  }
}

function hideNonOccluders(scene: Scene): Object3D[] {
  const hidden: Object3D[] = [];
  scene.traverse(object => {
    if (!object.visible) return;
    if (isNonOccluder(object)) {
      object.visible = false;
      hidden.push(object);
    }
  });
  return hidden;
}

function isNonOccluder(object: Object3D): boolean {
  return (
    object instanceof Sprite ||
    object instanceof Line ||
    object instanceof Points ||
    isTransparentOverlay(object)
  );
}

function isTransparentOverlay(object: Object3D): boolean {
  if (!(object instanceof Mesh)) return false;
  const material: unknown = object.material;
  const materials: unknown[] = Array.isArray(material) ? material : [material];
  return materials.every(
    material => material instanceof Material && material.transparent && !material.depthWrite,
  );
}

function captureState(renderer: WebGLRenderer, options: { scene: Scene; camera: PerspectiveCamera }) {
  return {
    target: renderer.getRenderTarget(),
    clearColor: renderer.getClearColor(new Color()),
    clearAlpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear,
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    layers: options.camera.layers.mask,
    background: options.scene.background,
    overrideMaterial: options.scene.overrideMaterial,
    afterRenderDescriptor: Object.getOwnPropertyDescriptor(options.scene, 'onAfterRender'),
  };
}

function restoreState(
  renderer: WebGLRenderer,
  options: { scene: Scene; camera: PerspectiveCamera },
  state: ReturnType<typeof captureState>,
): void {
  renderer.setRenderTarget(state.target);
  renderer.setClearColor(state.clearColor, state.clearAlpha);
  renderer.autoClear = state.autoClear;
  renderer.shadowMap.autoUpdate = state.shadowAutoUpdate;
  options.camera.layers.mask = state.layers;
  options.scene.background = state.background;
  options.scene.overrideMaterial = state.overrideMaterial;
  // Restore the property itself so inherited hooks and callback identity survive.
  if (state.afterRenderDescriptor) {
    Object.defineProperty(options.scene, 'onAfterRender', state.afterRenderDescriptor);
  } else Reflect.deleteProperty(options.scene, 'onAfterRender');
}

function createComposite(): ShaderMaterial {
  return new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D beautyTexture;
      uniform sampler2D aoTexture;
      uniform sampler2D maskTexture;
      uniform float strength;
      uniform bool hasMask;
      varying vec2 vUv;
      void main() {
        vec4 beauty = texture2D(beautyTexture, vUv);
        float occlusion = texture2D(aoTexture, vUv).r;
        float mask = hasMask ? texture2D(maskTexture, vUv).r : 0.0;
        float blend = clamp(strength, 0.0, 1.0) * (1.0 - mask);
        gl_FragColor = vec4(beauty.rgb * mix(1.0, occlusion, blend), beauty.a);
      }
    `,
  });
}
