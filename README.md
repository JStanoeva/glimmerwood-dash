# ✨ Glimmerwood Dash ✨

Embark on a mystical run through an enchanted, glowing forest in **Glimmerwood Dash**! Guide a valiant purple-haired heroine as you leap over treacherous mushrooms and collect heart-shaped lives. How far can your reflexes carry you into the heart of the Glimmerwood?

---

## 🎮 How to Play

**Start / Restart**

- Press **SPACE** or **Left Click / Tap** on the title or game-over screens.

**Jump & Double Jump**

- **Jump:** SPACE / Click / Tap
- **Double Jump:** quickly press SPACE twice / double-click / double-tap

**Pause / Resume**

- Press **P** or **ENTER** during gameplay.

**Audio Toggles**

- On **Title**, **Pause**, and **Game Over** screens, use the **Music** and **SFX** toggle buttons (top-right).
  - Music is **off by default on the Title screen** (browser autoplay rules).
  - Music is **on by default during gameplay** unless you turned it off.

---

## 🍄 Gameplay & Rules

- **Endless Runner:** Auto-scrolling forest backdrop with twinkling fireflies.
- **Obstacles:** Two mushroom sizes:
  - **Small** — clear with a single jump.
  - **Large** — requires a **double jump**.
- **Lives (Hearts):** Start with **3 hearts**, can collect up to **6 max**. Hearts won’t spawn if you’re already at 6. Hearts never spawn overlapping a mushroom lane zone.
- **Scoring:** +1 point **only** when you **cleanly pass** a mushroom you didn’t hit. Bumping a mushroom costs 1 heart and **does not** award points.
- **Game Over:** Hearts reach 0.

---

## 🖼️ Art, Audio & Fonts

**Assets (placed in `/public`)**

- **Images** (`/public/images`):
  - `backdrop.png` — magical forest background (tiles across the width)
  - `player.png` — heroine sprite
  - `small-mushroom.png` / `large-mushroom.png` — obstacles
  - `heart.png` — UI hearts + pickups
  - `music-on.png` / `music-off.png`, `sfx-on.png` / `sfx-off.png` — audio toggles
  - `glimmerwood-dash-logo.png` — title logo image
- **Audio** (`/public/music`):
  - `titleSong.wav` — loops on Title/Game Over (when music enabled)
  - `gameplaySong.wav` — loops during gameplay
  - `jump.wav`, `hit.wav`, `pickupHeart.wav` — SFX

**Typography**

- **Mystery Quest** — title & “Game Over”
- **Glass Antiqua** — HUD, prompts, and other text

> Pixel-art fidelity: the canvas uses `imageSmoothingEnabled=false` and CSS `image-rendering: pixelated`.

---

## 🧱 Tech Stack

- **React + TypeScript** (Vite)
- **Tailwind CSS** for UI overlays (HUD, toggles, screens)
- **HTML5 Canvas API** for all game rendering
- **LocalStorage** for high score & audio settings

**Engine highlights**

- DPR-aware canvas sizing; crisp pixel rendering
- Fixed-timestep update loop (~60 FPS)
- Robust **preload** (images load via `Promise.all` before the loop starts)
- Mobile friendly: attempts fullscreen + **landscape lock** on first tap, with a rotate hint overlay in portrait

---

## 🚀 Run Locally

**Prereqs:** Node 18+ recommended.

```bash
# install deps
pnpm i         # or: npm install / yarn

# dev server
pnpm dev       # or: npm run dev / yarn dev

# build for production
pnpm build

# preview production build locally
pnpm preview
```

> The game expects assets under /public/images and /public/music with exactly the filenames listed above.

## 🌐 Deploy

**Vercel (recommended)**

1. Push to GitHub.
2. Import the repo in **Vercel**, accept the Vite defaults.
3. Deploy. (No special environment variables needed.)

---

## 🧭 Controls & UI Summary

- **Title Screen:** Logo, high score, “Press SPACE or Click to Start”, **music/SFX toggles**.
- **Gameplay HUD:** Top-left **Score**, top-right **Hearts** (3–6).
- **Pause Screen:** “Paused” + **music/SFX toggles**, resume with **P/ENTER**.
- **Game Over Screen:** Final score + high score + **music/SFX toggles**; restart with **SPACE/Click**.

---

## 🛠️ Tweaking the Feel (for devs)

All core numbers live in `src/App.tsx`:

- **Gravity / Jump:** `g.G`, `g.JUMP_V`
- **Ground line:** `g.groundY`
- **Scroll speed / ramp:** `g.speed` and `g.difficultySeconds` ramp
- **Obstacle sizes:** small ≈ `52 * u` high; large ≈ `150 * u` high; width set per type  
  (large mushrooms currently wider, e.g. `92 * u`)
- **Spawn cadence & spacing:** `g.obsInterval`, `g.minGapPx`
- **Heart cap:** `6`
- **Hit buffer:** avoids multi-hit drain (`g.HIT_BUFFER`)

---

## ⚠️ Notes & Caveats

- **Autoplay policies:** Title music won’t start automatically; toggle **Music ON** or start gameplay.
- **Orientation lock:** Some browsers/devices may not permit programmatic landscape lock; a rotate hint appears when in portrait.

---

## 🌟 Future Ideas

- Additional obstacle types and move patterns
- Power-ups (shield, magnet, slow-mo, score multipliers)
- Global leaderboard
- Sprite animations & multi-layer parallax

---

Developed with magic, pixels, and cheese by **Queen Tora of the Cheese Republic**. 👑🧀

## License

This project is licensed under the [MIT License](LICENSE).
