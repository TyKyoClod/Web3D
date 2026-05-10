export class UIController {
  constructor(app) {
    this.app = app;
  }

  bind(root = document) {
    root.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.onclick = async () => {
        const name = btn.dataset.scene;
        if (this.app.currentSceneName === name) return;
        root.querySelectorAll('[data-scene]').forEach((b) => b.classList.toggle('active', b === btn));
        await this.app.loadScene(name);
        this.refreshAfterSceneSwap();
      };
    });

    this.wireCheckbox(root, 'toggleWireframe', (on) => this.app.setWireframe(on));

    this.wireRange(root, 'ambientSlider', 'ambientVal', (v) => this.app.setAmbient(v));
    this.wireRange(root, 'keySlider',     'keyVal',     (v) => this.app.setKeyLight(v));
    this.wireRange(root, 'warmthSlider',  'warmthVal',  (v) => this.app.setWarmth(v));

    root.querySelectorAll('[data-camera]').forEach((btn) => {
      btn.onclick = () => this.app.applyCameraPreset(btn.dataset.camera);
    });
  }

  wireCheckbox(root, id, fn) {
    const el = root.querySelector('#' + id);
    if (!el) return;
    el.onchange = () => fn(el.checked);
    if (el.checked) fn(true);
  }

  wireRange(root, sliderId, labelId, fn) {
    const slider = document.getElementById(sliderId);
    const label  = document.getElementById(labelId);
    if (!slider) return;
    const apply = () => {
      const v = parseFloat(slider.value);
      if (label) label.textContent = v.toFixed(2);
      fn(v);
    };
    slider.oninput = apply;
    apply();
  }

  refreshAfterSceneSwap() {
    const info = this.app.getCurrentSceneInfo();
    const desc = document.getElementById('sceneDescription');
    if (desc) desc.innerHTML = info.description || '';

    const host = document.getElementById('animControls');
    if (host) {
      host.innerHTML = '';
      for (const a of info.animations || []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.dataset.animId = a.id;
        btn.innerHTML = a.icon ? `<span class="anim-icon">${a.icon}</span>${a.label}` : a.label;
        btn.onclick = async () => {
          if (this.app.currentScene?.busy) return;
          if (a.gate && !a.gate()) return;
          host.querySelectorAll('button').forEach((b) => b.disabled = true);
          try { await a.run(); }
          finally { this.reapplyGates(); }
        };
        host.appendChild(btn);
      }
      this.reapplyGates();
    }
  }

  reapplyGates() {
    const host = document.getElementById('animControls');
    if (!host) return;
    const animations = this.app.currentScene?.animations || [];
    const buttons = Array.from(host.querySelectorAll('button'));
    buttons.forEach((btn, i) => {
      const a = animations[i];
      if (!a) return;
      const allowed = a.gate ? !!a.gate() : true;
      btn.disabled = !allowed;
    });
  }
}
