// src/game.js
// Coordinates game state transitions, deterministic fixed-timestep updates, difficulty scaling,
// local best-score persistence, UI synchronization, and the Three.js render loop.

import { Snake } from './snake.js';
import { Food } from './food.js';

export const GAME_STATES = {
  MENU: 'MENU',
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

export const DIFFICULTY_SETTINGS = {
  EASY: {
    id: 'EASY',
    label: 'Easy',
    baseIntervalMs: 175,
    stepDecreaseMs: 2.5,
    minIntervalMs: 88,
    scoreThreshold: 1
  },
  NORMAL: {
    id: 'NORMAL',
    label: 'Normal',
    baseIntervalMs: 135,
    stepDecreaseMs: 3.5,
    minIntervalMs: 65,
    scoreThreshold: 1
  },
  HARD: {
    id: 'HARD',
    label: 'Hard',
    baseIntervalMs: 100,
    stepDecreaseMs: 4.0,
    minIntervalMs: 50,
    scoreThreshold: 1
  }
};

const STORAGE_KEY = 'snake_3d_retro_best_score_v1';

export class Game {
  /**
   * @param {object} options
   * @param {number} [options.gridSize=17]
   * @param {import('./renderer.js').ArenaRenderer} [options.renderer=null]
   * @param {import('./audio.js').SoundController} [options.audio=null]
   * @param {boolean} [options.bindDom=true]
   */
  constructor({ gridSize = 17, renderer = null, audio = null, bindDom = true } = {}) {
    this.gridSize = gridSize;
    this.renderer = renderer;
    this.audio = audio;
    this.bindDom = bindDom;

    this.snake = new Snake(gridSize);
    this.food = new Food(gridSize);

    this.state = GAME_STATES.MENU;
    this.difficulty = DIFFICULTY_SETTINGS.NORMAL;

    this.score = 0;
    this.bestScore = this.loadBestScore();
    this.isNewRecord = false;
    this.gameOverReason = '';

    // Deterministic timing variables
    this.moveAccumulatorMs = 0;
    this.currentIntervalMs = this.difficulty.baseIntervalMs;
    this.readyTimerMs = 0;
    this.readyDurationMs = 700;
    this.lastFrameTime = 0;
    this.rafId = null;

    this.food.spawn(this.snake.segments);

    if (this.bindDom && typeof document !== 'undefined') {
      this.cacheDom();
      this.bindUiEvents();
      this.syncUi();
    }
  }

  /**
   * Read best score from localStorage with safe fallback if unavailable/blocked.
   */
  loadBestScore() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const parsed = parseInt(saved, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      }
    } catch (e) {
      // Fallback to session memory
    }
    return 0;
  }

  /**
   * Persist best score to localStorage safely.
   */
  saveBestScore(score) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, String(score));
      }
    } catch (e) {
      // Ignore storage errors in sandboxed iframes
    }
  }

  /**
   * Calculate current step interval (ms per grid cell) based on difficulty and score.
   * Enforces a minimum interval floor so speed never becomes unplayable.
   */
  computeMoveIntervalMs(score = this.score, difficulty = this.difficulty) {
    const steps = Math.floor(score / difficulty.scoreThreshold);
    const reduced = difficulty.baseIntervalMs - steps * difficulty.stepDecreaseMs;
    return Math.max(difficulty.minIntervalMs, reduced);
  }

  /**
   * Calculate current speed level (1, 2, 3...) for HUD display.
   */
  getSpeedLevel() {
    return 1 + Math.floor(this.score / 3);
  }

  /**
   * Change difficulty mode (EASY, NORMAL, HARD).
   */
  setDifficulty(diffKey) {
    if (DIFFICULTY_SETTINGS[diffKey]) {
      this.difficulty = DIFFICULTY_SETTINGS[diffKey];
      this.currentIntervalMs = this.computeMoveIntervalMs(this.score, this.difficulty);
      this.syncUi();
    }
  }

  /**
   * Start a new game session: enters READY state briefly before PLAYING.
   */
  startGame() {
    this.snake.reset();
    this.food.spawn(this.snake.segments);
    this.score = 0;
    this.isNewRecord = false;
    this.gameOverReason = '';
    this.currentIntervalMs = this.computeMoveIntervalMs(0, this.difficulty);
    this.moveAccumulatorMs = 0;
    this.readyTimerMs = this.readyDurationMs;
    this.state = GAME_STATES.READY;

    this.audio?.playStart();
    this.syncUi();
  }

  /**
   * Immediately transition from READY to PLAYING (e.g., when player presses a movement key).
   */
  beginPlayingNow() {
    if (this.state === GAME_STATES.READY) {
      this.state = GAME_STATES.PLAYING;
      this.moveAccumulatorMs = 0;
      this.syncUi();
    }
  }

  /**
   * Toggle between PLAYING and PAUSED without corrupting the movement accumulator.
   */
  togglePause() {
    if (this.state === GAME_STATES.PLAYING) {
      this.state = GAME_STATES.PAUSED;
      this.audio?.playPause(true);
      this.syncUi();
    } else if (this.state === GAME_STATES.PAUSED) {
      this.state = GAME_STATES.PLAYING;
      this.lastFrameTime = performance.now();
      this.audio?.playPause(false);
      this.syncUi();
    }
  }

  /**
   * Return to the Main Menu screen.
   */
  returnToMenu() {
    this.snake.reset();
    this.food.spawn(this.snake.segments);
    this.score = 0;
    this.moveAccumulatorMs = 0;
    this.state = GAME_STATES.MENU;
    this.syncUi();
  }

  /**
   * Handle directional input from keyboard or mobile D-pad.
   */
  handleDirectionInput(dir) {
    if (this.state === GAME_STATES.READY) {
      this.snake.queueDirection(dir);
      this.beginPlayingNow();
      return;
    }
    if (this.state === GAME_STATES.PLAYING) {
      this.snake.queueDirection(dir);
    }
  }

  /**
   * Execute exactly one deterministic logical movement step on the grid.
   */
  stepLogic() {
    if (this.state !== GAME_STATES.PLAYING) return;

    const nextHead = this.snake.getNextHeadPosition();
    const willEat = this.food.isAt(nextHead.x, nextHead.z);

    // Evaluate wall and self collisions (respecting the tail-cell edge case)
    const collision = this.snake.checkCollision(nextHead, willEat);
    if (collision.collided) {
      this.triggerGameOver(collision.reason);
      return;
    }

    // Move snake forward one cell
    this.snake.step(willEat);

    if (willEat) {
      this.score += 1;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.isNewRecord = true;
        this.saveBestScore(this.bestScore);
      }

      // Update difficulty speed progression
      this.currentIntervalMs = this.computeMoveIntervalMs(this.score, this.difficulty);

      // Trigger visual burst and synth pickup sound
      this.renderer?.triggerCollectionBurst(nextHead.x, nextHead.z);
      this.audio?.playEat(this.score);

      // Spawn next food orb in an unoccupied cell
      const nextFood = this.food.spawn(this.snake.segments);
      if (!nextFood) {
        // Entire arena filled by snake! Graceful victory game-over state
        this.triggerGameOver('ARENA_COMPLETE');
        return;
      }

      this.syncUi();
    }
  }

  /**
   * Transition to GAME_OVER state.
   */
  triggerGameOver(reason = 'COLLISION') {
    this.state = GAME_STATES.GAME_OVER;
    this.gameOverReason = reason;
    this.audio?.playGameOver();
    this.syncUi();
  }

  /**
   * Advance game timers by elapsed milliseconds (dtMs).
   */
  update(dtMs) {
    // Clamp frame delta to 100ms max so switching browser tabs never causes huge jumps
    const safeDt = Math.min(dtMs, 100);

    if (this.state === GAME_STATES.READY) {
      this.readyTimerMs -= dtMs;
      if (this.readyTimerMs <= 0) {
        this.state = GAME_STATES.PLAYING;
        this.moveAccumulatorMs = 0;
        this.syncUi();
      }
      return;
    }

    if (this.state === GAME_STATES.PLAYING) {
      this.moveAccumulatorMs += safeDt;
      while (
        this.moveAccumulatorMs >= this.currentIntervalMs &&
        this.state === GAME_STATES.PLAYING
      ) {
        this.moveAccumulatorMs -= this.currentIntervalMs;
        this.stepLogic();
      }
    }
  }

  /**
   * Compute render interpolation factor alpha in [0, 1].
   */
  getInterpolationAlpha() {
    if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.PAUSED) {
      return Math.min(1, Math.max(0, this.moveAccumulatorMs / this.currentIntervalMs));
    }
    return 1;
  }

  /**
   * Start the single requestAnimationFrame loop (cancels any existing loop first).
   */
  startLoop() {
    this.stopLoop();
    this.lastFrameTime = performance.now();

    const frame = (now) => {
      const dtMs = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.update(dtMs);

      if (this.renderer) {
        const alpha = this.getInterpolationAlpha();
        this.renderer.render(this.snake, this.food, alpha, dtMs / 1000, this.state);
      }

      this.rafId = requestAnimationFrame(frame);
    };

    this.rafId = requestAnimationFrame(frame);
  }

  stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ============================================================================
  // DOM & UI SYNCHRONIZATION
  // ============================================================================
  cacheDom() {
    this.dom = {
      menuOverlay: document.getElementById('menu-overlay'),
      readyOverlay: document.getElementById('ready-overlay'),
      pauseOverlay: document.getElementById('pause-overlay'),
      gameoverOverlay: document.getElementById('gameover-overlay'),
      hudBar: document.getElementById('hud-bar'),
      mobileControls: document.getElementById('mobile-controls'),
      flashOverlay: document.getElementById('flash-overlay'),

      hudScore: document.getElementById('hud-score'),
      hudBest: document.getElementById('hud-best'),
      hudDifficulty: document.getElementById('hud-difficulty'),
      hudSpeed: document.getElementById('hud-speed'),

      menuBest: document.getElementById('menu-best-score'),
      finalScore: document.getElementById('final-score'),
      finalBest: document.getElementById('final-best-score'),
      gameoverReasonText: document.getElementById('gameover-reason'),
      newRecordBadge: document.getElementById('new-record-badge'),

      btnPlay: document.getElementById('btn-play'),
      btnHudPause: document.getElementById('btn-hud-pause'),
      btnHudRestart: document.getElementById('btn-hud-restart'),
      btnHudMute: document.getElementById('btn-hud-mute'),
      btnMenuMute: document.getElementById('btn-menu-mute'),

      btnResume: document.getElementById('btn-resume'),
      btnPauseRestart: document.getElementById('btn-pause-restart'),
      btnPauseMenu: document.getElementById('btn-pause-menu'),

      btnGameoverRestart: document.getElementById('btn-gameover-restart'),
      btnGameoverMenu: document.getElementById('btn-gameover-menu'),

      diffButtons: Array.from(document.querySelectorAll('[data-difficulty]'))
    };
  }

  bindUiEvents() {
    const { dom } = this;
    if (!dom) return;

    dom.btnPlay?.addEventListener('click', () => this.startGame());
    dom.btnHudPause?.addEventListener('click', () => {
      if (this.state === GAME_STATES.READY) this.beginPlayingNow();
      this.togglePause();
    });
    dom.btnHudRestart?.addEventListener('click', () => this.startGame());

    const handleMuteToggle = () => {
      if (!this.audio) return;
      this.audio.toggleMute();
      this.syncMuteButtons();
    };

    dom.btnHudMute?.addEventListener('click', handleMuteToggle);
    dom.btnMenuMute?.addEventListener('click', handleMuteToggle);

    dom.btnResume?.addEventListener('click', () => this.togglePause());
    dom.btnPauseRestart?.addEventListener('click', () => this.startGame());
    dom.btnPauseMenu?.addEventListener('click', () => this.returnToMenu());

    dom.btnGameoverRestart?.addEventListener('click', () => this.startGame());
    dom.btnGameoverMenu?.addEventListener('click', () => this.returnToMenu());

    dom.diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-difficulty');
        this.setDifficulty(key);
      });
    });
  }

  syncMuteButtons() {
    if (!this.dom || !this.audio) return;
    const isMuted = this.audio.muted;
    const label = isMuted ? 'Sound: OFF' : 'Sound: ON';
    if (this.dom.btnHudMute) {
      this.dom.btnHudMute.textContent = label;
      this.dom.btnHudMute.setAttribute('aria-pressed', String(!isMuted));
    }
    if (this.dom.btnMenuMute) {
      this.dom.btnMenuMute.textContent = label;
      this.dom.btnMenuMute.setAttribute('aria-pressed', String(!isMuted));
    }
  }

  syncUi() {
    if (!this.bindDom || !this.dom) return;
    const { dom } = this;

    // Update Scores & Difficulty Badges
    if (dom.hudScore) dom.hudScore.textContent = String(this.score);
    if (dom.hudBest) dom.hudBest.textContent = String(this.bestScore);
    if (dom.hudDifficulty) dom.hudDifficulty.textContent = this.difficulty.label;
    if (dom.hudSpeed) dom.hudSpeed.textContent = `Lv.${this.getSpeedLevel()}`;
    if (dom.menuBest) dom.menuBest.textContent = String(this.bestScore);
    if (dom.finalScore) dom.finalScore.textContent = String(this.score);
    if (dom.finalBest) dom.finalBest.textContent = String(this.bestScore);

    // Difficulty Selection Active State
    dom.diffButtons.forEach(btn => {
      const key = btn.getAttribute('data-difficulty');
      btn.classList.toggle('active', key === this.difficulty.id);
    });

    // Game Over details
    if (dom.gameoverReasonText) {
      if (this.gameOverReason === 'WALL') {
        dom.gameoverReasonText.textContent = 'Boundary Wall Impact';
      } else if (this.gameOverReason === 'SELF') {
        dom.gameoverReasonText.textContent = 'Self-Collision Detected';
      } else if (this.gameOverReason === 'ARENA_COMPLETE') {
        dom.gameoverReasonText.textContent = 'Perfect Game! Arena 100% Conquered!';
      } else {
        dom.gameoverReasonText.textContent = 'Run Terminated';
      }
    }

    if (dom.newRecordBadge) {
      dom.newRecordBadge.classList.toggle('hidden', !this.isNewRecord);
    }

    // Screen Overlays Visibility
    dom.menuOverlay?.classList.toggle('hidden', this.state !== GAME_STATES.MENU);
    dom.readyOverlay?.classList.toggle('hidden', this.state !== GAME_STATES.READY);
    dom.pauseOverlay?.classList.toggle('hidden', this.state !== GAME_STATES.PAUSED);
    dom.gameoverOverlay?.classList.toggle('hidden', this.state !== GAME_STATES.GAME_OVER);

    const inActiveSession =
      this.state === GAME_STATES.READY ||
      this.state === GAME_STATES.PLAYING ||
      this.state === GAME_STATES.PAUSED;
    dom.hudBar?.classList.toggle('hidden', !inActiveSession);
    dom.mobileControls?.classList.toggle('hidden', !inActiveSession);

    if (dom.btnHudPause) {
      dom.btnHudPause.textContent = this.state === GAME_STATES.PAUSED ? 'Resume' : 'Pause';
    }

    if (dom.flashOverlay) {
      if (this.state === GAME_STATES.GAME_OVER) {
        dom.flashOverlay.classList.add('active');
        setTimeout(() => dom.flashOverlay?.classList.remove('active'), 350);
      } else {
        dom.flashOverlay.classList.remove('active');
      }
    }

    this.syncMuteButtons();
  }
}
