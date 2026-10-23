// src/food.js
// Manages deterministic, safe food spawning on unoccupied arena cells.

export class Food {
  /**
   * @param {number} gridSize - Size of the square arena grid
   * @param {() => number} rng - Random number generator returning [0, 1) (injectable for testing)
   */
  constructor(gridSize = 17, rng = Math.random) {
    this.gridSize = gridSize;
    this.rng = rng;
    this.position = { x: 0, z: 0 };
    this.spawnCount = 0;
  }

  /**
   * Spawn food in a random unoccupied grid cell.
   * Scans all unoccupied cells first so it NEVER enters an infinite loop even when the board is nearly or completely full.
   *
   * @param {Array<{x: number, z: number}>} occupiedSegments - Current snake segments
   * @returns {{x: number, z: number} | null} New food coordinates, or null if the entire arena is full (victory!)
   */
  spawn(occupiedSegments = []) {
    const occupiedSet = new Set(
      occupiedSegments.map(seg => `${seg.x},${seg.z}`)
    );

    const availableCells = [];
    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (!occupiedSet.has(`${x},${z}`)) {
          availableCells.push({ x, z });
        }
      }
    }

    // Edge case: Arena is 100% occupied by the snake!
    if (availableCells.length === 0) {
      this.position = null;
      return null;
    }

    const randomIndex = Math.floor(this.rng() * availableCells.length);
    this.position = { ...availableCells[randomIndex] };
    this.spawnCount += 1;
    return this.position;
  }

  /**
   * Check whether a coordinate matches the active food orb position.
   */
  isAt(x, z) {
    if (!this.position) return false;
    return this.position.x === x && this.position.z === z;
  }
}
