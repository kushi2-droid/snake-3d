// src/snake.js
// Deterministic grid-based Snake model with previous-position tracking for smooth 3D interpolation.

export const DIRECTIONS = {
  UP: { x: 0, z: -1, name: 'UP' },
  DOWN: { x: 0, z: 1, name: 'DOWN' },
  LEFT: { x: -1, z: 0, name: 'LEFT' },
  RIGHT: { x: 1, z: 0, name: 'RIGHT' }
};

export class Snake {
  /**
   * @param {number} gridSize - Width and height of the square arena grid (e.g., 17)
   */
  constructor(gridSize = 17) {
    this.gridSize = gridSize;
    this.reset();
  }

  /**
   * Reset snake to the center of the arena with 3 segments moving RIGHT.
   */
  reset() {
    const center = Math.floor(this.gridSize / 2);
    // Segments ordered from Head (index 0) to Tail (index length - 1)
    this.segments = [
      { x: center, z: center },
      { x: center - 1, z: center },
      { x: center - 2, z: center }
    ];
    // Copy current segments into prevSegments for smooth render interpolation
    this.prevSegments = this.segments.map(seg => ({ x: seg.x, z: seg.z }));

    this.direction = { ...DIRECTIONS.RIGHT };
    this.inputQueue = [];
    this.growPending = 0;
    this.justGrew = false;
  }

  /**
   * Queue a directional change.
   * Prevents 180-degree instant self-reversal and buffers up to 2 rapid keystrokes per tick.
   * @param {{x: number, z: number, name: string}} newDir
   */
  queueDirection(newDir) {
    if (!newDir) return false;

    // Compare against the last queued direction (or current movement direction if queue is empty)
    const referenceDir =
      this.inputQueue.length > 0
        ? this.inputQueue[this.inputQueue.length - 1]
        : this.direction;

    // Ignore duplicate direction
    if (referenceDir.x === newDir.x && referenceDir.z === newDir.z) {
      return false;
    }

    // Prevent 180-degree reversal when snake has more than 1 segment
    if (
      this.segments.length > 1 &&
      referenceDir.x + newDir.x === 0 &&
      referenceDir.z + newDir.z === 0
    ) {
      return false;
    }

    // Cap buffer at 2 inputs so frantic key mashing doesn't lag future turns
    if (this.inputQueue.length < 2) {
      this.inputQueue.push({ ...newDir });
      return true;
    }
    return false;
  }

  /**
   * Peek the next direction that will be applied on the upcoming step without mutating state.
   */
  peekNextDirection() {
    return this.inputQueue.length > 0 ? this.inputQueue[0] : this.direction;
  }

  /**
   * Compute the next head coordinate given the next direction.
   */
  getNextHeadPosition() {
    const dir = this.peekNextDirection();
    const head = this.segments[0];
    return {
      x: head.x + dir.x,
      z: head.z + dir.z
    };
  }

  /**
   * Check whether a target coordinate collides with the arena walls or the snake's own body.
   * Correctly handles the tail-cell edge case: if the snake is NOT growing on this step,
   * the current tail cell will vacate simultaneously as the head enters it, which is legal!
   *
   * @param {{x: number, z: number}} nextHead
   * @param {boolean} willEat - True if nextHead lands on food (causing immediate growth)
   * @returns {{collided: boolean, reason: string | null}}
   */
  checkCollision(nextHead, willEat = false) {
    // 1. Wall collision check
    if (
      nextHead.x < 0 ||
      nextHead.x >= this.gridSize ||
      nextHead.z < 0 ||
      nextHead.z >= this.gridSize
    ) {
      return { collided: true, reason: 'WALL' };
    }

    // 2. Self-collision check
    // If the snake will grow on this step (either from eating food right now or pending growth),
    // the tail does NOT move away, so we must check all segments including the tail.
    // Otherwise, the tail vacates its cell on this tick, so we exclude the last segment!
    const tailWillStay = willEat || this.growPending > 0;
    const checkLimit = tailWillStay ? this.segments.length : this.segments.length - 1;

    for (let i = 0; i < checkLimit; i++) {
      const seg = this.segments[i];
      if (seg.x === nextHead.x && seg.z === nextHead.z) {
        return { collided: true, reason: 'SELF' };
      }
    }

    return { collided: false, reason: null };
  }

  /**
   * Advance the snake by one logical grid cell.
   * @param {boolean} ateFood - Whether the snake eats food at the new head cell
   */
  step(ateFood = false) {
    if (this.inputQueue.length > 0) {
      this.direction = this.inputQueue.shift();
    }

    if (ateFood) {
      this.growPending += 1;
    }

    // Record current coordinates as previous coordinates for smooth interpolation
    this.prevSegments = this.segments.map(seg => ({ x: seg.x, z: seg.z }));

    const nextHead = {
      x: this.segments[0].x + this.direction.x,
      z: this.segments[0].z + this.direction.z
    };

    // Insert new head at the front
    this.segments.unshift(nextHead);

    if (this.growPending > 0) {
      // Snake grows: keep the tail segment and duplicate the old tail in prevSegments
      // so the newly added segment smoothly interpolates out of the tail position
      this.growPending -= 1;
      this.justGrew = true;
      const lastPrev = this.prevSegments[this.prevSegments.length - 1];
      this.prevSegments.push({ x: lastPrev.x, z: lastPrev.z });
    } else {
      // Normal movement: remove the old tail segment
      this.segments.pop();
      this.justGrew = false;
    }

    return nextHead;
  }

  /**
   * Check if any segment of the snake currently occupies cell (x, z).
   */
  occupies(x, z) {
    return this.segments.some(seg => seg.x === x && seg.z === z);
  }

  /**
   * Compute smoothly interpolated coordinates for rendering at progress alpha in [0, 1].
   * @param {number} alpha - Interpolation factor between logical ticks (0.0 to 1.0)
   */
  getInterpolatedSegments(alpha) {
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    return this.segments.map((seg, idx) => {
      const prev = this.prevSegments[idx] || seg;
      return {
        x: prev.x + (seg.x - prev.x) * clampedAlpha,
        z: prev.z + (seg.z - prev.z) * clampedAlpha,
        gridX: seg.x,
        gridZ: seg.z
      };
    });
  }
}
