import * as THREE from 'three';
import { SceneBase, ease } from './SceneBase.js';

const CONTROLLER_NAMES = ['Bread01', 'Bread02', 'Bread03', 'Donut01', 'Donut02'];

const FALL_OFFSETS = {
  Bread01: 5.5,
  Bread02: 6.2,
  Bread03: 6.9,
  Donut01: 7.6,
  Donut02: 8.3,
};

const FALL_DELAYS = {
  Bread01: 0.0,
  Bread02: 0.30,
  Bread03: 0.60,
  Donut01: 1.05,
  Donut02: 1.35,
};

export class PlateScene extends SceneBase {
  setup() {
    this.controllers = {};
    this.finalPositions = {};
    this.served = false;

    for (const name of CONTROLLER_NAMES) {
      const obj = this.find(name, true);
      if (!obj) continue;
      this.controllers[name] = obj;
      this.finalPositions[name] = obj.position.clone();
      obj.visible = false;
    }

    this.enableShadowsOnAllMeshes();

    this.prefersSpotlight = true;

    this.cameraPresets = {
      default: { pos: new THREE.Vector3(-4.5, 9.0, 10.5), target: new THREE.Vector3(0.83, 0.43, 0.49) },
      front: { pos: new THREE.Vector3(0, 4.0, 13.0), target: new THREE.Vector3(0, 0.4, 0) },
      top: { pos: new THREE.Vector3(0, 14.0, 0.01), target: new THREE.Vector3(0, 0.30, 0) },
    };

    this.animations = [
      { id: 'serve', label: 'Serve breakfast', run: () => this.serve() },
      { id: 'clear', label: 'Clear the plate', run: () => this.clearPlate() },
    ];

    this.description = `
      <h4>Time to enjoy</h4>
      <p>Enjoy your freshly toasted bread and donuts with secret sprinkles.</p>
      <ul>
        <li><strong>Serve breakfast</strong> Serve it up!</li>
        <li><strong>Clear the plate</strong> I'm full.</li>
      </ul>
    `;
  }

  placeAtLifted() {
    for (const name of Object.keys(this.controllers)) {
      const ctrl = this.controllers[name];
      const offset = FALL_OFFSETS[name] || 1.5;
      ctrl.position.copy(this.finalPositions[name]);
      ctrl.position.y += offset;
      ctrl.visible = true;
    }
  }

  async serve() {
    return this.runLocked(async () => {
      this.placeAtLifted();

      const drops = [];
      for (const name of CONTROLLER_NAMES) {
        const ctrl = this.controllers[name];
        if (!ctrl) continue;
        const finalPos = this.finalPositions[name];
        const delay = FALL_DELAYS[name] || 0;
        const startPos = ctrl.position.clone();
        const isDonut = name.startsWith('Donut');
        const drop = (async () => {
          await this.wait(delay);
          await this.tweenVec3(
            ctrl.position,
            startPos,
            finalPos.clone(),
            isDonut ? 1.30 : 1.10,
            ease.outCubic
          );
        })();
        drops.push(drop);
      }
      await Promise.all(drops);
      this.served = true;
    });
  }

  async clearPlate() {
    return this.runLocked(async () => {
      const lifts = [];
      for (const name of Object.keys(this.controllers)) {
        const ctrl = this.controllers[name];
        if (!ctrl.visible) continue;
        const offset = (FALL_OFFSETS[name] || 1.5);
        const target = this.finalPositions[name].clone();
        target.y += offset;
        lifts.push(
          this.tweenVec3(ctrl.position, ctrl.position.clone(), target, 0.5, ease.inQuad)
            .then(() => { ctrl.visible = false; })
        );
      }
      await Promise.all(lifts);
      this.served = false;
    });
  }
}
