// src/controls.js
// Handles keyboard controls (Arrow keys, WASD, Space, Enter, Escape) and mobile on-screen directional pad.

import { DIRECTIONS } from './snake.js';

export class InputControls {
  /**
   * @param {object} callbacks
   * @param {(dir: {x:number, z:number, name:string}) => void} callbacks.onDirection
   * @param {() => void} callbacks.onPauseToggle
   * @param {() => void} callbacks.onStartOrRestart
   * @param {() => void} callbacks.onEscape
   */
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.boundButtons = [];
  }

  attach() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    this.bindMobileDpad();
  }

  detach() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    for (const { el, type, fn } of this.boundButtons) {
      el.removeEventListener(type, fn);
    }
    this.boundButtons = [];
  }

  handleKeyDown(event) {
    const key = event.key;
    const lower = key.toLowerCase();

    // Prevent page scrolling on Arrow keys or Spacebar
    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === ' '
    ) {
      event.preventDefault();
    }

    switch (key) {
      case 'ArrowUp':
        this.callbacks.onDirection?.(DIRECTIONS.UP);
        break;
      case 'ArrowDown':
        this.callbacks.onDirection?.(DIRECTIONS.DOWN);
        break;
      case 'ArrowLeft':
        this.callbacks.onDirection?.(DIRECTIONS.LEFT);
        break;
      case 'ArrowRight':
        this.callbacks.onDirection?.(DIRECTIONS.RIGHT);
        break;
      case ' ':
        this.callbacks.onPauseToggle?.();
        break;
      case 'Enter':
        this.callbacks.onStartOrRestart?.();
        break;
      case 'Escape':
        this.callbacks.onEscape?.();
        break;
      default:
        if (lower === 'w') this.callbacks.onDirection?.(DIRECTIONS.UP);
        else if (lower === 's') this.callbacks.onDirection?.(DIRECTIONS.DOWN);
        else if (lower === 'a') this.callbacks.onDirection?.(DIRECTIONS.LEFT);
        else if (lower === 'd') this.callbacks.onDirection?.(DIRECTIONS.RIGHT);
        break;
    }
  }

  bindMobileDpad() {
    if (typeof document === 'undefined') return;
    const mapping = [
      { id: 'dpad-up', dir: DIRECTIONS.UP },
      { id: 'dpad-down', dir: DIRECTIONS.DOWN },
      { id: 'dpad-left', dir: DIRECTIONS.LEFT },
      { id: 'dpad-right', dir: DIRECTIONS.RIGHT }
    ];

    mapping.forEach(({ id, dir }) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const trigger = (e) => {
        e.preventDefault();
        btn.classList.add('active-press');
        this.callbacks.onDirection?.(dir);
        setTimeout(() => btn.classList.remove('active-press'), 130);
      };

      btn.addEventListener('pointerdown', trigger, { passive: false });
      this.boundButtons.push({ el: btn, type: 'pointerdown', fn: trigger });
    });
  }
}
