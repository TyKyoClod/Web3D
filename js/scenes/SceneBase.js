import * as THREE from 'three';

// references: https://easings.net/
export const ease = {
  linear: (t) => t,
  inQuad:    (t) => t * t,
  outQuad:   (t) => t * (2 - t),
  inOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  outCubic:  (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic:(t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack:   (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  },
};

export class SceneBase {
  constructor(gltf, app) {
    this.gltf = gltf;
    this.app = app;
    this.root = gltf.scene;
    this.tweens = [];
    this.animations = [];
    this.cameraPresets = {};
    this.description = '';
    this.busy = false;
  }

  setup() {  }

  update(dt) {
    if (!this.tweens.length) return;
    const stillRunning = [];
    for (const tw of this.tweens) {
      tw.elapsed += dt;
      const tNorm = Math.min(1, tw.elapsed / tw.duration);
      const k = tw.easing(tNorm);
      tw.step(k);
      if (tNorm < 1) stillRunning.push(tw);
      else tw.resolve();
    }
    this.tweens = stillRunning;
  }

  tweenVec3(target, from, to, duration = 1.0, easing = ease.outCubic) {
    return new Promise((resolve) => {
      this.tweens.push({
        elapsed: 0,
        duration,
        easing,
        step: (k) => {
          target.x = from.x + (to.x - from.x) * k;
          target.y = from.y + (to.y - from.y) * k;
          target.z = from.z + (to.z - from.z) * k;
        },
        resolve,
      });
    });
  }

  tweenQuat(quatTarget, from, to, duration = 1.0, easing = ease.inOutQuad) {
    const a = from.clone();
    const b = to.clone();
    return new Promise((resolve) => {
      this.tweens.push({
        elapsed: 0,
        duration,
        easing,
        step: (k) => quatTarget.copy(a).slerp(b, k),
        resolve,
      });
    });
  }

  tweenNumber(setter, from, to, duration = 0.5, easing = ease.linear) {
    return new Promise((resolve) => {
      this.tweens.push({
        elapsed: 0,
        duration,
        easing,
        step: (k) => setter(from + (to - from) * k),
        resolve,
      });
    });
  }

  wait(seconds) {
    return new Promise((res) => setTimeout(res, seconds * 1000));
  }

  find(name, optional = false) {
    const obj = this.root.getObjectByName(name);
    if (!obj && !optional) {
      console.warn(`[${this.constructor.name}] missing object: ${name}`);
    }
    return obj || null;
  }

  enableShadowsOnAllMeshes() {
    this.root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  async runLocked(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); }
    catch (err) { console.error(err); }
    this.busy = false;
  }
}
