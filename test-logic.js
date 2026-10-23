// test-logic.js
// Automated verification suite for SNAKE 3D — RETRO REIMAGINED core mechanics.
// Runs directly in Node.js (npm test) to verify all gameplay rules deterministically.

import assert from 'node:assert/strict';
import { Snake, DIRECTIONS } from './src/snake.js';
import { Food } from './src/food.js';
import { Game, GAME_STATES, DIFFICULTY_SETTINGS } from './src/game.js';

console.log('Running SNAKE 3D Automated Verification Suite...\n');

// 1. Initial Snake State
{
  const snake = new Snake(17);
  assert.equal(snake.segments.length, 3, 'Snake should start with 3 segments');
  assert.deepEqual(snake.segments[0], { x: 8, z: 8 }, 'Head should start at center (8,8)');
  assert.deepEqual(snake.direction, DIRECTIONS.RIGHT, 'Initial direction should be RIGHT');
  console.log('✔ Test 1: Initial snake placement and segment structure passed.');
}

// 2. Deterministic Grid Movement & Segment Following
{
  const snake = new Snake(17);
  snake.step(false); // Move RIGHT to (9,8)
  assert.deepEqual(snake.segments, [
    { x: 9, z: 8 },
    { x: 8, z: 8 },
    { x: 7, z: 8 }
  ]);
  snake.queueDirection(DIRECTIONS.DOWN);
  snake.step(false); // Move DOWN to (9,9)
  assert.deepEqual(snake.segments, [
    { x: 9, z: 9 },
    { x: 9, z: 8 },
    { x: 8, z: 8 }
  ]);
  console.log('✔ Test 2: Deterministic grid movement & segment path-following passed.');
}

// 3. 180-Degree Reversal Prevention & Input Buffering
{
  const snake = new Snake(17); // Moving RIGHT
  const reversed = snake.queueDirection(DIRECTIONS.LEFT);
  assert.equal(reversed, false, 'Should reject direct 180-degree reversal');

  // Rapid 2-input turn: UP then LEFT within a single tick
  const turn1 = snake.queueDirection(DIRECTIONS.UP);
  const turn2 = snake.queueDirection(DIRECTIONS.LEFT);
  assert.equal(turn1, true, 'First valid turn queued');
  assert.equal(turn2, true, 'Second rapid turn queued');
  assert.equal(snake.inputQueue.length, 2, 'Input queue buffers 2 rapid turns');

  snake.step(false); // Executes UP
  assert.deepEqual(snake.direction, DIRECTIONS.UP);
  snake.step(false); // Executes LEFT
  assert.deepEqual(snake.direction, DIRECTIONS.LEFT);
  console.log('✔ Test 3: 180-degree reversal prevention and input queue buffering passed.');
}

// 4. Growth on Eating Food & Smooth Interpolation Coordinates
{
  const snake = new Snake(17);
  snake.step(true); // Eat food!
  assert.equal(snake.segments.length, 4, 'Snake length increases to 4 after eating food');
  const midInterp = snake.getInterpolatedSegments(0.5);
  assert.equal(midInterp.length, 4, 'Interpolated segments match new length');
  assert.equal(midInterp[0].x, 8.5, 'Head interpolates halfway between 8 and 9 at alpha=0.5');
  console.log('✔ Test 4: Snake growth and smooth interpolation coordinates passed.');
}

// 5. Wall Collision Detection
{
  const snake = new Snake(5); // 5x5 grid: valid indices 0..4
  snake.segments = [{ x: 4, z: 2 }, { x: 3, z: 2 }, { x: 2, z: 2 }];
  snake.direction = DIRECTIONS.RIGHT;
  const nextHead = snake.getNextHeadPosition(); // (5, 2) -> out of bounds
  const res = snake.checkCollision(nextHead, false);
  assert.equal(res.collided, true, 'Should detect wall collision at x=5');
  assert.equal(res.reason, 'WALL');
  console.log('✔ Test 5: Arena boundary wall collision detection passed.');
}

// 6. Self-Collision & Tail-Cell Edge Case
{
  const snake = new Snake(10);
  // Create a 4-segment loop where head is at (5,5), body at (5,6), (4,6), and tail at (4,5)
  snake.segments = [
    { x: 5, z: 5 }, // Head
    { x: 5, z: 6 }, // Body 1
    { x: 4, z: 6 }, // Body 2
    { x: 4, z: 5 }  // Tail
  ];
  snake.direction = DIRECTIONS.UP;
  snake.queueDirection(DIRECTIONS.LEFT); // Next head will be (4,5) — the current tail cell!

  const nextHead = snake.getNextHeadPosition();
  assert.deepEqual(nextHead, { x: 4, z: 5 });

  // Case A: Not eating food -> tail vacates (4,5) on this step -> NO collision!
  const safeRes = snake.checkCollision(nextHead, false);
  assert.equal(safeRes.collided, false, 'Entering vacating tail cell should NOT collide when not growing');

  // Case B: Eating food at (4,5) -> tail stays at (4,5) -> COLLISION!
  const growRes = snake.checkCollision(nextHead, true);
  assert.equal(growRes.collided, true, 'Entering tail cell when growing MUST collide');
  assert.equal(growRes.reason, 'SELF');
  console.log('✔ Test 6: Self-collision and tail-cell edge case passed.');
}

// 7. Food Spawning Never Overlaps Snake & Handles Full Arena Gracefully
{
  const gridSize = 4;
  const food = new Food(gridSize);
  // Fill all cells except (3, 3)
  const occupied = [];
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      if (!(x === 3 && z === 3)) {
        occupied.push({ x, z });
      }
    }
  }
  const spawned = food.spawn(occupied);
  assert.deepEqual(spawned, { x: 3, z: 3 }, 'Food must spawn in the single remaining unoccupied cell');

  // Now fill the last cell too
  occupied.push({ x: 3, z: 3 });
  const fullResult = food.spawn(occupied);
  assert.equal(fullResult, null, 'Food spawn returns null gracefully when arena is 100% full');
  console.log('✔ Test 7: Collision-free food spawning & full-arena graceful handling passed.');
}

// 8. Game State Machine, Scoring, Difficulty Scaling, Pause & Restart
{
  const game = new Game({ gridSize: 17, bindDom: false });
  assert.equal(game.state, GAME_STATES.MENU);

  game.setDifficulty('HARD');
  assert.equal(game.difficulty.id, 'HARD');

  game.startGame();
  assert.equal(game.state, GAME_STATES.READY);

  // Advance past READY countdown
  game.update(800);
  assert.equal(game.state, GAME_STATES.PLAYING);

  // Place food directly in front of the snake head at (9, 8)
  game.food.position = { x: 9, z: 8 };
  const initialSpeed = game.currentIntervalMs;
  game.stepLogic();

  assert.equal(game.score, 1, 'Score should increment to 1 after eating food');
  assert.equal(game.bestScore, 1, 'Best score should update to 1');
  assert.ok(game.currentIntervalMs < initialSpeed, 'Movement interval should decrease (speed up) as score increases');

  // Pause & Resume
  game.togglePause();
  assert.equal(game.state, GAME_STATES.PAUSED);
  const segmentsBeforePausedUpdate = JSON.stringify(game.snake.segments);
  game.update(5000); // Should not move while paused
  assert.equal(JSON.stringify(game.snake.segments), segmentsBeforePausedUpdate, 'Snake must not move while paused');

  game.togglePause();
  assert.equal(game.state, GAME_STATES.PLAYING);

  // Minimum interval cap check
  const cappedInterval = game.computeMoveIntervalMs(999, DIFFICULTY_SETTINGS.HARD);
  assert.equal(cappedInterval, DIFFICULTY_SETTINGS.HARD.minIntervalMs, 'Speed must respect playable maximum speed cap');
  console.log('✔ Test 8: Game states, scoring, difficulty progression, speed cap, and pause/resume passed.');
}

console.log('\nALL 8 TEST SUITES PASSED SUCCESSFULLY!');
