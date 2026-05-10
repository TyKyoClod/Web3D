import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { PlateScene } from './scenes/PlateScene.js';
import { ToasterScene } from './scenes/ToasterScene.js';

const SCENE_FACTORIES = {
  plate:   { url: 'assets/models/sub.glb',  label: 'Breakfast Plate', Class: PlateScene },
  toaster: { url: 'assets/models/main.glb', label: 'The Toaster',     Class: ToasterScene },
};

const SPOT_LIGHT_INTENSITY = 9;

export class App {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    this.ambientLight = null;
    this.keyLight = null;
    this.fillLight = null;
    this.sideLight = null;
    this.rimLight = null;
    this.spotLight = null;

    this.currentScene = null;
    this.currentSceneName = null;

    this.flags = {
      wireframe: false,
      spotLight: false,
    };
    this.warmth = 0.5;
    this.raf = null;
    this.inited = false;
  }

  async init() {
    if (this.inited) return;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = this.makeGradientBackground();
    this.scene.backgroundIntensity = 0.85;

    const { width, height } = this.size();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 200);
    this.camera.position.set(2.4, 1.8, 3.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enableZoom = false;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0.6, 0);

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const toCamera = this.camera.position.clone().sub(this.controls.target);
      const dist = Math.max(0.5, Math.min(30, toCamera.length() + dir * 1.2));
      this.camera.position.copy(this.controls.target).addScaledVector(toCamera.normalize(), dist);
      this.controls.update();
    }, { passive: false });

    this.setupLights();

    this.resize();
    this.loop();
    this.inited = true;
  }

  makeGradientBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.00, '#f3e2bf');
    grad.addColorStop(0.40, '#d4a979');
    grad.addColorStop(0.75, '#7d573a');
    grad.addColorStop(1.00, '#3a2818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.toneMapped = false;
    return tex;
  }

  setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffe6c8, 0.45);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xfff0d6, 1.0);
    this.keyLight.position.set(3, 5, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 20;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0xffd7a8, 0x35221a, 0.30);
    this.scene.add(this.fillLight);

    this.sideLight = new THREE.DirectionalLight(0xc8d8ff, 0.35);
    this.sideLight.position.set(-4, 3, -1);
    this.scene.add(this.sideLight);

    this.rimLight = new THREE.DirectionalLight(0xffaa66, 0.45);
    this.rimLight.position.set(-1.5, 4, -4);
    this.scene.add(this.rimLight);

    this.underLight = new THREE.DirectionalLight(0xffd9a8, 0.35);
    this.underLight.position.set(0, -3, 0.5);
    this.scene.add(this.underLight);

    this.spotLight = new THREE.SpotLight(0xfff2d0, 0, 8, Math.PI / 3.5, 0.5, 1.0);
    this.spotLight.position.set(0.3, 4, 0.15);
    this.spotLight.target.position.set(0.25, 0, 0);
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);
  }

  async loadScene(name) {
    const def = SCENE_FACTORIES[name];
    if (!def) throw new Error(`Unknown scene: ${name}`);

    if (this.callbacks.onLoadStart) this.callbacks.onLoadStart(def.label);

    if (this.currentScene) {
      if (this.currentScene.root) this.scene.remove(this.currentScene.root);
      this.currentScene = null;
    }

    const loader = new GLTFLoader();
    const url = def.url + '?v=' + Date.now();
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (xhr) => {
          if (xhr.lengthComputable) {
            const pct = Math.min(99, Math.round((xhr.loaded / xhr.total) * 100));
            if (this.callbacks.onProgress) this.callbacks.onProgress(pct);
          }
        },
        reject
      );
    });

    const wrapper = new def.Class(gltf, this);
    wrapper.setup();
    this.scene.add(wrapper.root);

    this.currentScene = wrapper;
    this.currentSceneName = name;

    this.reapplyFlags();

    this.setSpotLight(!!wrapper.prefersSpotlight);

    this.applyCameraPreset('default');

    if (this.callbacks.onProgress) this.callbacks.onProgress(100);
    if (this.callbacks.onLoaded) this.callbacks.onLoaded();
    if (this.callbacks.onSceneReady) this.callbacks.onSceneReady(def.label);
  }

  applyCameraPreset(presetName) {
    if (!this.currentScene) return;
    const presets = this.currentScene.cameraPresets || {};
    const preset = presets[presetName] || presets.default;
    if (!preset) return;
    this.camera.position.set(preset.pos.x, preset.pos.y, preset.pos.z);
    this.controls.target.set(preset.target.x, preset.target.y, preset.target.z);
    this.controls.update();
  }

  setWireframe(on) {
    this.flags.wireframe = !!on;
    if (!this.currentScene) return;
    this.currentScene.root.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const apply = (m) => { m.wireframe = !!on; };
        if (Array.isArray(obj.material)) obj.material.forEach(apply); else apply(obj.material);
      }
    });
  }

  setAmbient(value) {
    if (this.ambientLight) this.ambientLight.intensity = value;
  }

  setKeyLight(value) {
    if (this.keyLight) this.keyLight.intensity = value;
  }

  setWarmth(value) {
    this.warmth = value;
    const cool = new THREE.Color(0xfff5e0);
    const warm = new THREE.Color(0xff9b3d);
    if (this.keyLight) this.keyLight.color.copy(cool).lerp(warm, value);
    if (this.ambientLight) {
      const cAmb = new THREE.Color(0xfff0d8);
      const wAmb = new THREE.Color(0xffb066);
      this.ambientLight.color.copy(cAmb).lerp(wAmb, value);
    }
  }

  setSpotLight(on) {
    this.flags.spotLight = !!on;
    if (this.spotLight) this.spotLight.intensity = on ? SPOT_LIGHT_INTENSITY : 0;
  }

  reapplyFlags() {
    this.setWireframe(this.flags.wireframe);
  }

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.06);
    this.controls.update();
    if (this.currentScene?.update) this.currentScene.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  resize() {
    if (!this.renderer) return;
    const { width, height } = this.size();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  size() {
    const parent = this.canvas.parentElement;
    return {
      width: parent ? parent.clientWidth : window.innerWidth,
      height: parent ? parent.clientHeight : window.innerHeight,
    };
  }

  getCurrentSceneInfo() {
    return {
      name: this.currentSceneName,
      label: SCENE_FACTORIES[this.currentSceneName]?.label,
      animations: this.currentScene?.animations || [],
      description: this.currentScene?.description || '',
      prefersSpotlight: !!this.currentScene?.prefersSpotlight,
    };
  }
}
