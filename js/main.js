import * as THREE from 'three';
import { App } from './app.js';
import { UIController } from './controllers/UIController.js';

window.THREE = THREE;

const PAGES = ['app', 'about', 'references'];

function getRoute() {
  const h = window.location.hash.replace('#', '');
  return PAGES.includes(h) ? h : 'app';
}

function showRoute(name) {
  PAGES.forEach((p) => {
    const el = document.getElementById('page-' + p);
    if (el) el.hidden = p !== name;
  });
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', () => showRoute(getRoute()));
document.querySelectorAll('[data-route]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const name = a.dataset.route;
    window.location.hash = name;
    e.preventDefault();
  });
});

const canvas = document.getElementById('canvas3d');
const overlay = document.getElementById('loadingOverlay');
const progressBar = document.getElementById('loadProgress');

const app = new App(canvas, {
  onProgress: (pct) => {
    if (progressBar) progressBar.value = pct;
  },
  onLoaded: () => {
    if (overlay) overlay.classList.add('hidden');
  },
  onLoadStart: () => {
    if (overlay) overlay.classList.remove('hidden');
    if (progressBar) progressBar.value = 0;
  },
  onSceneReady: () => {},
});

const ui = new UIController(app);
ui.bind(document);

let appBooted = false;
async function maybeBootApp() {
  if (appBooted) return;
  if (getRoute() !== 'app') return;
  appBooted = true;
  await app.init();
  await app.loadScene('toaster');
  ui.refreshAfterSceneSwap();
}

window.addEventListener('hashchange', maybeBootApp);
window.addEventListener('DOMContentLoaded', () => {
  showRoute(getRoute());
  maybeBootApp();
});

window.addEventListener('resize', () => app.resize());

window.__app = app;
window.__ui = ui;
