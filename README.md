# SNAKE 3D — RETRO REIMAGINED

A complete, playable **3D Snake** arcade game inspired by the classic Nokia keypad-phone Snake, rebuilt from the ground up with **Three.js**, **HTML5**, **CSS3**, and the **Web Audio API**.

Designed to combine classic grid-based tactile gameplay with a modern retro-futuristic 3D aesthetic, smooth visual interpolation, synthesized arcade audio, and beginner-friendly modular source code.

---

## Features

- **Authentic Grid Gameplay in 3D**: Classic 2D grid logic (17×17 arena) rendered in a three-dimensional neon-lit miniature arcade arena with raised walls, subtle shadows, and alternating floor tiles.
- **Frame-Rate Independent Movement & Smooth Interpolation**: Logical movement runs on a deterministic fixed timestep while `requestAnimationFrame` smoothly interpolates every segment's 3D position between grid cells.
- **Segmented 3D Snake**: Distinct glowing head with directional eyes, tapered body segments, tail segment, and growth ripple animations.
- **Input Buffering & Anti-Reversal Guard**: Queues up to 2 directional inputs per tick so rapid turns are never dropped and prevents accidental 180-degree self-reversal.
- **Exact Collision Detection**: Evaluates wall boundaries and body segments using integer grid coordinates, including proper handling of the **tail-cell edge case** (moving into the cell the tail is vacating on the same step is permitted unless the snake is growing).
- **Glowing 3D Food Orb & Particle Bursts**: Floating, rotating icosahedral energy orb with a halo ring, point light, and object-pooled 3D particle bursts on collection.
- **Configurable Difficulty & Speed Progression**: Choose **Easy**, **Normal**, or **Hard** mode. Movement speed scales up as your score rises while respecting a playable speed cap.
- **Complete Game States**: Main Menu (with gentle 3D camera orbit), Ready countdown, Playing HUD, Pause screen, and Game Over summary with `localStorage` Best Score persistence.
- **Synthesized Web Audio API Sound Effects**: Zero external audio files required — generates start chimes, pitch-scaling food pickup tones, pause blips, and game-over synth chords on the fly with a Mute/Unmute toggle.
- **Responsive Desktop & Mobile Support**: Full keyboard support (`Arrow Keys`, `WASD`, `Space`, `Enter`, `Escape`) plus an automatic on-screen touch D-Pad on mobile and tablet screens.

---

## Controls

| Action | Desktop Keyboard | Mobile / Touch |
| :--- | :--- | :--- |
| **Move Up** | `ArrowUp` or `W` | On-screen `▲` button |
| **Move Down** | `ArrowDown` or `S` | On-screen `▼` button |
| **Move Left** | `ArrowLeft` or `A` | On-screen `◀` button |
| **Move Right** | `ArrowRight` or `D` | On-screen `▶` button |
| **Pause / Resume** | `Space` or `Escape` | HUD `Pause` / `Resume` button |
| **Start / Restart** | `Enter` | `Play Game` / `Restart` button |
| **Mute / Unmute Audio** | Click `Sound: ON/OFF` | Tap `Sound: ON/OFF` |

---

## Screenshots

> After running the project locally or deploying to GitHub Pages, you can place screenshots of your gameplay in a `docs/` folder and link them here:
>
> - **Main Menu Orbit View**: `docs/screenshot-menu.png`
> - **Active 3D Gameplay & Particle Burst**: `docs/screenshot-gameplay.png`
> - **Mobile Responsive View with D-Pad**: `docs/screenshot-mobile.png`

---

## Technologies Used

- **HTML5 & CSS3**: Semantic overlay panels, responsive glassmorphic HUD, and mobile D-Pad layout.
- **JavaScript (ES6 Modules)**: Clean, dependency-light object-oriented architecture.
- **[Three.js](https://threejs.org/)**: WebGL 3D scene graph, PBR materials (`MeshStandardMaterial`), directional shadow mapping, and particle systems.
- **Web Audio API**: Real-time oscillator and gain-envelope sound synthesis.
- **[Vite](https://vitejs.dev/)**: Lightning-fast local development server and production bundler.

---

## Project Structure

```text
snake-3d/
├── index.html          # Main HTML entry point, HUD, state overlays, and mobile D-pad
├── package.json        # Scripts and dependencies (Three.js + Vite)
├── vite.config.js      # Vite bundler configuration (relative base './' for GitHub Pages)
├── README.md           # Documentation, algorithms, and deployment guide
├── .gitignore          # Excludes node_modules and dist build artifacts
├── test-logic.js       # Automated Node.js test suite for movement, food, and collision logic
├── public/
│   └── favicon.svg     # Custom retro-arcade vector icon
└── src/
    ├── main.js         # Bootstraps renderer, audio, controls, and game loop
    ├── game.js         # State machine, fixed-timestep loop, scoring, difficulty, and UI sync
    ├── snake.js        # Grid-based Snake data structure, input queue, collision, and interpolation
    ├── food.js         # Safe unoccupied cell spawning and full-board detection
    ├── controls.js     # Keyboard listener and touch D-pad bindings
    ├── renderer.js     # Three.js 3D arena, lighting, snake meshes, food orb, and particle pool
    ├── audio.js        # Web Audio API synthesized sound effects
    └── styles.css      # Retro-futuristic dark navy & cyan UI styling
```

---

## Installation & Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended) and `npm`.

### 1. Install Dependencies
```bash
cd snake-3d
npm install
```

### 2. Run the Local Development Server
```bash
npm run dev
```
Vite will start a local development server (typically at `http://localhost:5173`) and open the game in your browser.

### 3. Run the Automated Logic Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```
This compiles and minifies the application into the `dist/` directory. You can preview the production build locally by running:
```bash
npm run preview
```

---

## Deploying to GitHub Pages

Because `vite.config.js` is pre-configured with `base: './'`, the production build works out of the box on GitHub Pages under any repository name.

### Option A: Deploy via GitHub Actions (Recommended)
1. Create a new repository on GitHub (e.g., `snake-3d`) and push this project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SNAKE 3D Retro Reimagined"
   git branch -M main
   git remote add origin https://github.com/<your-username>/snake-3d.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions** (or use `npx gh-pages -d dist` after running `npm run build`).

### Option B: Quick CLI Deploy with `gh-pages`
```bash
npm run build
npx gh-pages -d dist
```
Then set your repository's GitHub Pages source branch to `gh-pages`.

---

## How the Core Algorithms Work

### 1. Grid-Based Movement & Smooth 3D Interpolation
Even though the game is rendered in 3D space, the snake's true position is strictly stored as integer 2D grid coordinates `(x, z)` where `0 <= x < 17` and `0 <= z < 17`:
- **Logical Tick (`snake.step()`)**: Every `currentIntervalMs` milliseconds (e.g., `135ms` on Normal), the game saves a snapshot of `this.segments` into `this.prevSegments`, pops the next buffered direction from `this.inputQueue`, inserts the new head at `segments[0] + direction`, and removes the tail segment (unless growing).
- **Visual Frame (`renderer.render()`)**: On every monitor refresh (`requestAnimationFrame`), we calculate `alpha = moveAccumulatorMs / currentIntervalMs` (a value from `0.0` to `1.0`). Each segment's 3D world position is linearly interpolated (`lerp`) between `prevSegments[i]` and `segments[i]`:
  ```text
  renderX = prev.x + (current.x - prev.x) * alpha
  renderZ = prev.z + (current.z - prev.z) * alpha
  ```
  This guarantees silky-smooth 60–144 FPS motion while keeping game rules 100% deterministic.

### 2. Collision Detection & The Tail-Cell Edge Case
Before moving the snake onto `nextHead`, `snake.checkCollision(nextHead, willEat)` checks:
1. **Wall Collision**: `nextHead.x < 0 || nextHead.x >= gridSize || nextHead.z < 0 || nextHead.z >= gridSize`.
2. **Self Collision**: Checks whether `nextHead` matches any body segment.
   - **Tail-Cell Edge Case**: If the snake is **not** growing on this step (`!willEat && growPending === 0`), the current tail (`segments[segments.length - 1]`) will vacate its cell on the exact same tick that the head enters it. Therefore, we only check segments `0` through `segments.length - 2`. If the snake **is** growing (`willEat === true`), the tail stays in place, so we check all segments `0` through `segments.length - 1`.

---

## Known Limitations

- **WebGL Support Required**: Requires a browser with hardware or software WebGL enabled.
- **Browser Audio Autoplay Policy**: Per standard browser rules, Web Audio API synthesis activates upon your first key press, click, or tap.
