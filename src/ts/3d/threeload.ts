// @ts-nocheck -- Legacy dynamic import bridge for Three.js examples; not type-safe and not actively maintained.
// Legacy file - not currently in use

const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight } = await import('three');
const { MMDLoader } = await import('three/examples/jsm/loaders/MMDLoader')
const { MMDAnimationHelper } = await import('three/examples/jsm/animation/MMDAnimationHelper');

export {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MMDLoader,
  MMDAnimationHelper,
};
