// src/main.js
// Application entry point: initializes Three.js renderer, Web Audio synthesizer, game logic, and input controls.

import './styles.css';
import { ArenaRenderer } from './renderer.js';
import { SoundController } from './audio.js';
import { Game, GAME_STATES } from './game.js';
import { InputControls } from './controls.js';

function bootstrapGame() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const gridSize = 17;
  const renderer = new ArenaRenderer(container, gridSize);
  const audio = new SoundController();
  const game = new Game({
    gridSize,
    renderer,
    audio,
    bindDom: true
  });

  const controls = new InputControls({
    onDirection: (dir) => {
      game.handleDirectionInput(dir);
    },
    onPauseToggle: () => {
      if (game.state === GAME_STATES.PLAYING || game.state === GAME_STATES.PAUSED) {
        game.togglePause();
      }
    },
    onStartOrRestart: () => {
      if (
        game.state === GAME_STATES.MENU ||
        game.state === GAME_STATES.GAME_OVER
      ) {
        game.startGame();
      } else if (game.state === GAME_STATES.PAUSED) {
        game.togglePause();
      }
    },
    onEscape: () => {
      if (game.state === GAME_STATES.PLAYING || game.state === GAME_STATES.PAUSED) {
        game.togglePause();
      }
    }
  });

  controls.attach();
  game.startLoop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapGame);
} else {
  bootstrapGame();
}
