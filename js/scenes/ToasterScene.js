import * as THREE from 'three';
import { SceneBase, ease } from './SceneBase.js';

export class ToasterScene extends SceneBase {
  setup() {
    this.rawBread = this.find('rawBreadFly01');
    this.breadCrumbGood = this.find('breadCrumbGood', true);
    this.breadCrustGood = this.find('breadCrustGood', true);
    this.donut = this.find('donut01', true);

    this.toastedBread = this.find('toastedBread01');
    this.toastedBreadCrumb = this.find('toastedBreadCrumb', true);
    this.toastedBreadCrust = this.find('toastedBreadCrust', true);

    this.toastedCrumbRest = this.toastedBreadCrumb?.quaternion.clone();
    this.toastedCrustRest = this.toastedBreadCrust?.quaternion.clone();

    this.knobLeft = this.find('buttonLeftAxis');
    this.knobRight = this.find('buttonRightAxis');
    this.leverLeft = this.find('leverLeftAxis');
    this.leverRight = this.find('leverRightAxis');

    this.topTarget = this.find('RawBreadSlotTopTargetAxis');
    this.insideTarget = this.find('RawBreadSlotInsideTargetAxis');
    this.landingTarget = this.find('toastBreadTargetAxis');

    this.initial = new Map();
    const remember = (obj) => obj && this.initial.set(obj, {
      position: obj.position.clone(),
      quaternion: obj.quaternion.clone(),
    });
    [this.rawBread, this.breadCrumbGood, this.breadCrustGood, this.donut,
     this.toastedBread, this.toastedBreadCrumb, this.toastedBreadCrust,
     this.knobLeft, this.knobRight, this.leverLeft, this.leverRight]
     .forEach(remember);

    if (this.toastedBread) this.toastedBread.visible = false;

    this.state = { knobsSet: false, breadLoaded: false, cycleComplete: false };

    this.sounds = {
      leverPress: this.loadSound('assets/audio/leverPress.mp3', 0.85),
      toastDone: this.loadSound('assets/audio/toastDone.mp3', 0.80),
    };

    this.heaterLights = [];
    if (this.insideTarget) {
      const heater = this.makeHeaterLight(0, 0, 0);
      this.insideTarget.add(heater);
      this.heaterLights.push(heater);
    } else {
      const heater = this.makeHeaterLight(0, 0.45, 0);
      this.root.add(heater);
      this.heaterLights.push(heater);
    }

    this.enableShadowsOnAllMeshes();

    this.prefersSpotlight = false;

    this.cameraPresets = {
      default: { pos: new THREE.Vector3(13.6, 8.0, 16.4), target: new THREE.Vector3(0, 0.55, 0) },
      front: { pos: new THREE.Vector3(0, 4.8, 18.4), target: new THREE.Vector3(0, 0.7, 0) },
      top: { pos: new THREE.Vector3(0, 17.0, 1.0), target: new THREE.Vector3(0, 0.4, 0) },
    };

    this.animations = [
      { id: 'setHeat',
        label: 'Set the timer',
        run: () => this.setHeat(),
        gate: () => !this.state.cycleComplete },
      { id: 'loadBread',
        label: 'Load bread',
        run: () => this.loadBread(),
        gate: () => !this.state.breadLoaded && !this.state.cycleComplete },
      { id: 'press',
        label: 'Press the lever',
        run: () => this.pressAndToast(),
        gate: () => this.canPress() && !this.state.cycleComplete },
      { id: 'reset',
        label: 'Reset the toaster',
        run: () => this.reset() },
    ];

    this.description = `
      <h4>Toast a slice</h4>
      <p>Follow the three steps in order.</p>
      <ol>
        <li><strong>Set the timer</strong></li>
        <li><strong>Load bread</strong></li>
        <li><strong>Press the lever</strong></li>
        <li><strong>Reset the toaster</strong> want another slice? Reset and go again.</li>
      </ol>
    `;
  }

  canPress() { return this.state.knobsSet && this.state.breadLoaded; }

  loadSound(url, volume = 1.0) {
    try {
      const a = new Audio(url);
      a.preload = 'auto';
      a.volume = volume;
      a.addEventListener('error', () => console.warn('[audio] failed:', url));
      return a;
    } catch (e) {
      console.warn('[audio] cannot create:', url, e);
      return null;
    }
  }

  playSound(name) {
    const a = this.sounds?.[name];
    if (!a) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {  });
      }
    } catch (e) {  }
  }

  async setHeat() {
    return this.runLocked(async () => {
      await this.spinKnobs(0.6);
      this.state.knobsSet = true;
    });
  }

  async loadBread() {
    if (!this.rawBread || this.state.breadLoaded) return;
    return this.runLocked(async () => {
      await this.flyRawToTop();
      await this.slideRawIntoSlot();
      this.state.breadLoaded = true;
    });
  }

  async pressAndToast() {
    if (!this.canPress()) return;
    return this.runLocked(async () => {
      this.playSound('leverPress');
      await this.wait(0.15);

      const knobsBackTween = this.spinKnobsBack(3.4);
      this.fadeHeaters(6.0, 0.55);
      await this.pressLever(0.35);

      await this.wait(3.0);

      this.fadeHeaters(0, 0.35);
      this.playSound('toastDone');
      await this.wait(0.4);

      this.swapToToasted();

      await Promise.all([
        this.popToastedUp(),
        this.releaseLever(0.4),
      ]);

      await this.riseAboveToaster();

      await this.wait(0.25);
      await this.flyToastedToLanding();

      await knobsBackTween;

      this.state.breadLoaded = false;
      this.state.knobsSet = false;
      this.state.cycleComplete = true;
    });
  }

  async flyRawToTop() {
    if (!this.topTarget) return;
    const startPos = this.rawBread.position.clone();
    const startQuat = this.rawBread.quaternion.clone();
    const tasks = [
      this.tweenVec3(this.rawBread.position, startPos, this.topTarget.position.clone(), 1.2, ease.inOutCubic),
      this.tweenQuat(this.rawBread.quaternion, startQuat, this.topTarget.quaternion.clone(), 1.2, ease.inOutCubic),
    ];
    if (this.breadCrumbGood) {
      const startCrumb = this.breadCrumbGood.quaternion.clone();
      tasks.push(this.tweenQuat(this.breadCrumbGood.quaternion, startCrumb, new THREE.Quaternion(), 1.2, ease.inOutCubic));
    }
    if (this.breadCrustGood) {
      const startCrust = this.breadCrustGood.quaternion.clone();
      tasks.push(this.tweenQuat(this.breadCrustGood.quaternion, startCrust, new THREE.Quaternion(), 1.2, ease.inOutCubic));
    }
    await Promise.all(tasks);
  }

  async slideRawIntoSlot() {
    if (!this.insideTarget || !this.topTarget) return;
    const start = this.rawBread.position.clone();
    await this.tweenVec3(
      this.rawBread.position,
      start,
      this.insideTarget.position.clone(),
      0.55,
      ease.inQuad
    );
  }

  static KNOB_AXIS = 'z';
  static LEVER_AXIS = 'y';
  static LEVER_DOWN = -0.5;

  async spinKnobs(duration = 0.6) {
    const axis = ToasterScene.KNOB_AXIS;
    const tasks = [];
    if (this.knobLeft)
      tasks.push(this.tweenNumber(
        (v) => { this.knobLeft.rotation[axis] = v; },
        this.knobLeft.rotation[axis], this.knobLeft.rotation[axis] - Math.PI * 0.9, duration, ease.outBack
      ));
    if (this.knobRight)
      tasks.push(this.tweenNumber(
        (v) => { this.knobRight.rotation[axis] = v; },
        this.knobRight.rotation[axis], this.knobRight.rotation[axis] + Math.PI * 0.7, duration, ease.outBack
      ));
    await Promise.all(tasks);
  }

  async pressLever(duration = 0.45) {
    const tasks = [];
    if (this.leverLeft) tasks.push(this.leverTo(this.leverLeft, ToasterScene.LEVER_DOWN, duration));
    if (this.leverRight) tasks.push(this.leverTo(this.leverRight, ToasterScene.LEVER_DOWN, duration));
    await Promise.all(tasks);
  }

  makeHeaterLight(x, y, z) {
    const l = new THREE.PointLight(0xff3a10, 0, 0.9, 2.0);
    l.position.set(x, y, z);
    return l;
  }

  fadeHeaters(targetIntensity, duration = 0.4) {
    if (!this.heaterLights) return;
    for (const l of this.heaterLights) {
      const startI = l.intensity;
      this.tweenNumber(
        (v) => { l.intensity = v; },
        startI, targetIntensity, duration, ease.inOutQuad
      );
    }
  }

  async spinKnobsBack(duration = 0.6) {
    const tasks = [];
    for (const knob of [this.knobLeft, this.knobRight]) {
      if (!knob) continue;
      const init = this.initial.get(knob);
      if (!init) continue;
      const startQ = knob.quaternion.clone();
      tasks.push(this.tweenQuat(knob.quaternion, startQ, init.quaternion.clone(), duration, ease.inOutCubic));
    }
    await Promise.all(tasks);
  }

  async releaseLever(duration = 0.5) {
    const tasks = [];
    if (this.leverLeft) tasks.push(this.leverTo(this.leverLeft, 0, duration));
    if (this.leverRight) tasks.push(this.leverTo(this.leverRight, 0, duration));
    await Promise.all(tasks);
  }

  async leverTo(lever, deltaAlongAxis, duration) {
    const init = this.initial.get(lever);
    if (!init) return;
    const axis = ToasterScene.LEVER_AXIS;
    const target = init.position.clone();
    target[axis] += deltaAlongAxis;
    const start = lever.position.clone();
    return this.tweenVec3(lever.position, start, target, duration, ease.inOutQuad);
  }

  swapToToasted() {
    if (!this.toastedBread || !this.insideTarget) return;
    this.rawBread.visible = false;
    this.toastedBread.position.copy(this.insideTarget.position);
    this.toastedBread.quaternion.copy(this.insideTarget.quaternion);
    if (this.toastedBreadCrumb) this.toastedBreadCrumb.quaternion.identity();
    if (this.toastedBreadCrust) this.toastedBreadCrust.quaternion.identity();
    this.toastedBread.visible = true;
  }

  async popToastedUp() {
    if (!this.toastedBread || !this.topTarget) return;
    const start = this.toastedBread.position.clone();
    await this.tweenVec3(
      this.toastedBread.position,
      start,
      this.topTarget.position.clone(),
      0.45,
      ease.outBack
    );
  }

  async riseAboveToaster() {
    if (!this.toastedBread || !this.topTarget) return;
    const start = this.toastedBread.position.clone();
    const above = this.topTarget.position.clone();
    above.y += 0.45;
    await this.tweenVec3(this.toastedBread.position, start, above, 0.35, ease.outQuad);
  }

  async flyToastedToLanding() {
    if (!this.toastedBread || !this.landingTarget) return;
    const startPos = this.toastedBread.position.clone();
    const startQuat = this.toastedBread.quaternion.clone();
    const tasks = [
      this.tweenVec3(this.toastedBread.position, startPos, this.landingTarget.position.clone(), 1.1, ease.outCubic),
      this.tweenQuat(this.toastedBread.quaternion, startQuat, this.landingTarget.quaternion.clone(), 1.1, ease.inOutCubic),
    ];
    if (this.toastedBreadCrumb && this.toastedCrumbRest) {
      tasks.push(this.tweenQuat(
        this.toastedBreadCrumb.quaternion,
        this.toastedBreadCrumb.quaternion.clone(),
        this.toastedCrumbRest,
        1.1, ease.inOutCubic
      ));
    }
    if (this.toastedBreadCrust && this.toastedCrustRest) {
      tasks.push(this.tweenQuat(
        this.toastedBreadCrust.quaternion,
        this.toastedBreadCrust.quaternion.clone(),
        this.toastedCrustRest,
        1.1, ease.inOutCubic
      ));
    }
    await Promise.all(tasks);
  }

  async reset() {
    return this.runLocked(async () => {
      if (this.toastedBread) this.toastedBread.visible = false;
      if (this.rawBread) this.rawBread.visible = false;

      const restoreInstantly = (obj) => {
        const snap = this.initial.get(obj);
        if (!snap || !obj) return;
        obj.position.copy(snap.position);
        obj.quaternion.copy(snap.quaternion);
      };
      restoreInstantly(this.rawBread);
      restoreInstantly(this.breadCrumbGood);
      restoreInstantly(this.breadCrustGood);
      restoreInstantly(this.toastedBread);
      restoreInstantly(this.toastedBreadCrumb);
      restoreInstantly(this.toastedBreadCrust);

      const animate = [this.donut, this.knobLeft, this.knobRight, this.leverLeft, this.leverRight];
      const tasks = [];
      for (const obj of animate) {
        const snap = this.initial.get(obj);
        if (!obj || !snap) continue;
        tasks.push(this.tweenVec3(obj.position, obj.position.clone(), snap.position.clone(), 0.6, ease.inOutCubic));
        tasks.push(this.tweenQuat(obj.quaternion, obj.quaternion.clone(), snap.quaternion.clone(), 0.6, ease.inOutCubic));
      }

      this.fadeRawBreadIn(0.6);

      await Promise.all(tasks);

      if (this.heaterLights) this.heaterLights.forEach((l) => { l.intensity = 0; });

      this.state.knobsSet = false;
      this.state.breadLoaded = false;
      this.state.cycleComplete = false;
    });
  }

  fadeRawBreadIn(duration = 0.5) {
    if (!this.rawBread) return;
    const mats = [];
    this.rawBread.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const list = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of list) {
        if (!m._twTracked) {
          m.transparent = true;
          m._twTracked = true;
        }
        m.opacity = 0;
        mats.push(m);
      }
    });
    this.rawBread.visible = true;
    return this.tweenNumber(
      (v) => mats.forEach((m) => { m.opacity = v; }),
      0, 1, duration, ease.outCubic
    );
  }
}
