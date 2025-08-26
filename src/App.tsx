import React, { useEffect, useRef, useState } from "react";

/**
 * Glimmerwood Dash — React (TS) + Tailwind + Canvas API
 * - Desktop canvas centered; mobile/tablet fullscreen
 * - Backdrop repeats on Title/Game Over (static) and scrolls during Play
 * - Fireflies twinkle on all screens; only move during Play
 * - Title music restarts on Game Over
 * - Custom title logo image
 * - Robust image preloading (Promise.all) before starting the loop
 */

type GameState = "TITLE" | "PLAYING" | "PAUSED" | "GAMEOVER";
type ObstacleType = "SMALL" | "LARGE";

interface ImageAsset {
  img: HTMLImageElement;
  w: number;
  h: number;
}
interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  onGround: boolean;
  jumpsRemaining: number;
  hitCooldown: number;
}
interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  w: number;
  h: number;
  hit: boolean;
  scored: boolean;
  remove?: boolean;
}
interface HeartPickup {
  x: number;
  y: number;
  w: number;
  h: number;
  taken: boolean;
}
interface AudioBundle {
  titleSong: HTMLAudioElement;
  gameplaySong: HTMLAudioElement;
  sfxJump: HTMLAudioElement;
  sfxHit: HTMLAudioElement;
  sfxPickup: HTMLAudioElement;
}

const COLORS = {
  primary: "#0000a3",
  mid: "#0067b3",
  light: "#40b0df",
  gold: "#ffd53d",
  pale: "#fff593",
};

const LS_KEYS = {
  highScore: "glimmerwood_highscore",
  settings: "glimmerwood_settings",
};

const DESIGN_HEIGHT = 540;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const now = () => performance.now() / 1000;

function injectFonts() {
  const id = "gw-fonts";
  if (document.getElementById(id)) return;
  const link1 = document.createElement("link");
  link1.rel = "preconnect";
  link1.href = "https://fonts.googleapis.com";
  const link2 = document.createElement("link");
  link2.rel = "preconnect";
  link2.href = "https://fonts.gstatic.com";
  link2.crossOrigin = "anonymous";
  const link3 = document.createElement("link");
  link3.rel = "stylesheet";
  link3.href =
    "https://fonts.googleapis.com/css2?family=Glass+Antiqua&family=Mystery+Quest&display=swap";
  const sent = document.createElement("meta");
  sent.id = id;
  document.head.appendChild(sent);
  document.head.appendChild(link1);
  document.head.appendChild(link2);
  document.head.appendChild(link3);
}

function loadImage(src: string): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ img, w: img.width, h: img.height });
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    // IMPORTANT: use root-relative path to /public
    img.src = src;
  });
}
function loadAudio(src: string, loop = false, volume = 1): HTMLAudioElement {
  const a = new Audio(src);
  a.loop = loop;
  a.volume = volume;
  return a;
}

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

async function requestFullscreenAndLandscape(element: HTMLElement) {
  try {
    if (document.fullscreenElement == null) {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        };
        await el.webkitRequestFullscreen?.();
      }
    }
  } catch {}
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch {}
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // UI State
  const [gameState, setGameState] = useState<GameState>("TITLE");
  const [score, setScore] = useState<number>(0);
  const [heartsUI, setHeartsUI] = useState<number>(3);
  const [highScore, setHighScore] = useState<number>(
    Number(localStorage.getItem(LS_KEYS.highScore) || 0)
  );

  // Audio toggles: Title music OFF by default (autoplay-safe), SFX ON by default.
  const savedSettings = (() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.settings) || "{}");
    } catch {
      return {};
    }
  })();
  const [musicOn, setMusicOn] = useState<boolean>(
    savedSettings.musicOn ?? false
  );
  const [sfxOn, setSfxOn] = useState<boolean>(savedSettings.sfxOn ?? true);
  const userSetMusicRef = useRef<boolean>(false); // remember explicit user choice

  const [showRotateHint, setShowRotateHint] = useState<boolean>(
    typeof window !== "undefined" ? isPortrait() : false
  );

  // Refs
  const rafRef = useRef<number | null>(null);
  const timestampRef = useRef<number>(now());
  const accumRef = useRef<number>(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const imagesRef = useRef<{
    backdrop?: ImageAsset;
    player?: ImageAsset;
    mushSmall?: ImageAsset;
    mushLarge?: ImageAsset;
    heart?: ImageAsset;
    titleLogo?: ImageAsset;
  }>({});

  const audioRef = useRef<AudioBundle | null>(null);

  const firefliesRef = useRef<
    { x: number; y: number; r: number; phase: number; speed: number }[]
  >([]);

  const gameRef = useRef<{
    state: GameState;
    t: number;
    bgOffset: number;
    speed: number;
    difficultySeconds: number;
    u: number;
    G: number;
    JUMP_V: number;
    HIT_BUFFER: number;
    groundY: number;

    player: Player;
    obstacles: Obstacle[];
    heartPickups: HeartPickup[];

    obsTimer: number;
    obsInterval: number;
    lastObstacleX: number;
    minGapPx: number;
    heartTimer: number;
    heartInterval: number;

    score: number;
    hearts: number;

    onHeartsChange?: (n: number) => void;
    onScore?: (n: number) => void;
    onGameOver?: (final: number) => void;
  } | null>(null);

  // ---------- Init & Resize ----------
  useEffect(() => {
    injectFonts();

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement!;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      sizeRef.current = { w, h };
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctxRef.current = ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const g = gameRef.current;
      const u = h / DESIGN_HEIGHT;
      if (g) {
        g.u = u;
        g.G = 2600 * u;
        g.JUMP_V = -900 * u;
        g.groundY = h - 64 * u;
        g.minGapPx = 280 * u;
        for (const o of g.obstacles) o.y = g.groundY - o.h; // keep on ground line
      }

      makeFireflies();
    };

    const makeFireflies = () => {
      const { w, h } = sizeRef.current;
      const count = Math.floor(clamp((w * h) / 40000, 30, 90));
      const arr: {
        x: number;
        y: number;
        r: number;
        phase: number;
        speed: number;
      }[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2 + 1,
          phase: Math.random() * Math.PI * 2,
          speed: 0.8 + Math.random() * 1.4, // twinkle speed factor
        });
      }
      firefliesRef.current = arr;
    };

    const onOrientationChange = () =>
      setTimeout(() => setShowRotateHint(isPortrait()), 250);

    const init = async () => {
      const canvas = canvasRef.current!;
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      handleResize();
      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", onOrientationChange);
      setShowRotateHint(isPortrait());

      // Strict image preload (fails fast if any missing)
      const [backdrop, player, mushSmall, mushLarge, heart, titleLogo] =
        await Promise.all([
          loadImage("/images/backdrop.png"),
          loadImage("/images/player.png"),
          loadImage("/images/small-mushroom.png"),
          loadImage("/images/large-mushroom.png"),
          loadImage("/images/heart.png"),
          loadImage("/images/glimmerwood-dash-logo.png"),
        ]);
      imagesRef.current = {
        backdrop,
        player,
        mushSmall,
        mushLarge,
        heart,
        titleLogo,
      };

      // Audio
      const titleSong = loadAudio("/music/titleSong.wav", true, 0.6);
      const gameplaySong = loadAudio("/music/gameplaySong.wav", true, 0.6);
      const sfxJump = loadAudio("/music/jump.wav", false, 0.8);
      const sfxHit = loadAudio("/music/hit.wav", false, 0.8);
      const sfxPickup = loadAudio("/music/pickupHeart.wav", false, 0.8);
      audioRef.current = {
        titleSong,
        gameplaySong,
        sfxJump,
        sfxHit,
        sfxPickup,
      };
      syncAudioMute();

      // Game model
      const { w, h } = sizeRef.current;
      const u = h / DESIGN_HEIGHT;
      const pW = 48 * u;
      const pH = 64 * u;

      gameRef.current = {
        state: "TITLE",
        t: 0,
        bgOffset: 0,
        speed: 350,
        difficultySeconds: 0,
        u,
        G: 2600 * u,
        JUMP_V: -900 * u,
        HIT_BUFFER: 0.6,
        groundY: h - 64 * u,
        player: {
          x: Math.min(140, w * 0.22),
          y: h - 64 * u - pH,
          w: pW,
          h: pH,
          vy: 0,
          onGround: true,
          jumpsRemaining: 2,
          hitCooldown: 0,
        },
        obstacles: [],
        heartPickups: [],
        obsTimer: 0,
        obsInterval: 2.1,
        lastObstacleX: w,
        minGapPx: 280 * u,
        heartTimer: 0,
        heartInterval: 5.5,
        score: 0,
        hearts: 3,
        onHeartsChange: (n) => setHeartsUI(n),
        onScore: (n) => setScore(n),
        onGameOver: (final) => handleGameOver(final),
      };

      // Inputs
      window.addEventListener("keydown", onKeyDown);
      canvas.addEventListener("pointerdown", onPointerDown, { passive: false });

      // Start loop (after assets are ready)
      timestampRef.current = now();
      accumRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };

    init();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("keydown", onKeyDown);
      const canvas = canvasRef.current;
      if (canvas) canvas.replaceWith(canvas.cloneNode(true)); // drop listeners
      const a = audioRef.current;
      if (a) {
        a.titleSong.pause();
        a.gameplaySong.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist audio toggles & react to changes
  useEffect(() => {
    localStorage.setItem(LS_KEYS.settings, JSON.stringify({ musicOn, sfxOn }));
    syncAudioMute();

    const a = audioRef.current;
    const g = gameRef.current;
    if (!a || !g) return;

    if (!musicOn) {
      a.titleSong.pause();
      a.gameplaySong.pause();
    } else {
      switch (g.state) {
        case "PLAYING":
          a.titleSong.pause();
          a.gameplaySong.play().catch(() => {});
          break;
        case "PAUSED":
          a.titleSong.pause();
          a.gameplaySong.pause();
          break;
        case "TITLE":
        case "GAMEOVER":
          a.gameplaySong.pause();
          a.titleSong.play().catch(() => {});
          break;
      }
    }
  }, [musicOn, sfxOn]);

  function syncAudioMute() {
    const a = audioRef.current;
    if (!a) return;
    a.titleSong.muted = !musicOn;
    a.gameplaySong.muted = !musicOn;
    a.sfxJump.muted = !sfxOn;
    a.sfxHit.muted = !sfxOn;
    a.sfxPickup.muted = !sfxOn;
  }

  // ---------- Input ----------
  const onKeyDown = (e: KeyboardEvent) => {
    const g = gameRef.current;
    if (!g) return;
    if (["Space", "ArrowUp", "Enter", "KeyP"].includes(e.code))
      e.preventDefault();

    if (e.code === "Space") {
      if (g.state === "TITLE") startGame();
      else if (g.state === "PLAYING") doJump();
      else if (g.state === "GAMEOVER") restartFromGameOver();
    } else if (e.code === "Enter" || e.code === "KeyP") {
      if (g.state === "PLAYING") pauseGame();
      else if (g.state === "PAUSED") resumeGame();
      else if (g.state === "TITLE" && e.code === "Enter") startGame();
    }
  };

  const onPointerDown = async () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.state === "TITLE") {
      if (containerRef.current)
        await requestFullscreenAndLandscape(containerRef.current);
      setShowRotateHint(isPortrait());
      startGame();
    } else if (g.state === "PLAYING") {
      doJump();
    } else if (g.state === "GAMEOVER") {
      restartFromGameOver();
    }
  };

  // ---------- Transitions ----------
  function startGame() {
    const g = gameRef.current!;
    const a = audioRef.current!;
    if (!userSetMusicRef.current && !musicOn) setMusicOn(true); // default ON for gameplay

    a.titleSong.pause();
    a.gameplaySong.currentTime = 0;
    if (musicOn) a.gameplaySong.play().catch(() => {});

    const { w, h } = sizeRef.current;
    const u = h / DESIGN_HEIGHT;
    const pW = 48 * u,
      pH = 64 * u;

    g.state = "PLAYING";
    g.t = 0;
    g.bgOffset = 0;
    g.speed = 350;
    g.difficultySeconds = 0;
    g.obstacles = [];
    g.heartPickups = [];
    g.obsTimer = 0;
    g.obsInterval = 2.1;
    g.lastObstacleX = w;
    g.minGapPx = 280 * u;
    g.heartTimer = 2.2;
    g.heartInterval = 5.5;
    g.player = {
      x: Math.min(140, w * 0.22),
      y: g.groundY - pH,
      w: pW,
      h: pH,
      vy: 0,
      onGround: true,
      jumpsRemaining: 2,
      hitCooldown: 0,
    };
    g.score = 0;
    g.hearts = 3;

    setScore(0);
    setHeartsUI(3);
    setGameState("PLAYING");
  }

  function pauseGame() {
    const g = gameRef.current!;
    if (g.state !== "PLAYING") return;
    g.state = "PAUSED";
    setGameState("PAUSED");
    audioRef.current?.gameplaySong.pause();
    audioRef.current?.titleSong.pause();
  }
  function resumeGame() {
    const g = gameRef.current!;
    if (g.state !== "PAUSED") return;
    g.state = "PLAYING";
    setGameState("PLAYING");
    audioRef.current?.titleSong.pause();
    if (musicOn) audioRef.current?.gameplaySong.play().catch(() => {});
  }
  function restartFromGameOver() {
    startGame();
  }

  function handleGameOver(finalScore: number) {
    const a = audioRef.current!;
    a.gameplaySong.pause();
    a.titleSong.currentTime = 0;
    if (musicOn) a.titleSong.play().catch(() => {});

    setHighScore((prev) => {
      const next = Math.max(prev, finalScore);
      localStorage.setItem(LS_KEYS.highScore, String(next));
      return next;
    });
    setGameState("GAMEOVER");
  }

  // ---------- Gameplay actions ----------
  function playSfx(kind: "jump" | "hit" | "pickup") {
    const a = audioRef.current;
    if (!a) return;
    const el =
      kind === "jump" ? a.sfxJump : kind === "hit" ? a.sfxHit : a.sfxPickup;
    try {
      el.currentTime = 0;
      el.play();
    } catch {}
  }
  function doJump() {
    const g = gameRef.current!;
    if (g.state !== "PLAYING") return;
    const p = g.player;
    if (p.jumpsRemaining > 0) {
      p.vy = g.JUMP_V;
      p.onGround = false;
      p.jumpsRemaining -= 1;
      playSfx("jump");
    }
  }

  // ---------- Loop ----------
  const tick = () => {
    const g = gameRef.current,
      ctx = ctxRef.current;
    if (!g || !ctx) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const t = now();
    let dt = t - timestampRef.current;
    timestampRef.current = t;
    dt = Math.min(dt, 0.05);
    accumRef.current += dt;

    const step = 1 / 60;
    while (accumRef.current >= step) {
      update(step);
      accumRef.current -= step;
    }

    draw();
    rafRef.current = requestAnimationFrame(tick);
  };

  function update(dt: number) {
    const g = gameRef.current!;

    if (g.state !== "PAUSED") g.t += dt;

    // Fireflies: always twinkle (phase update), only MOVE while playing
    const flies = firefliesRef.current;
    for (const f of flies) {
      f.phase += f.speed * 2.2 * dt; // twinkle speed
    }
    if (g.state === "PLAYING") {
      const bgBaseSpeed = Math.max(120, g.speed * 0.35);
      g.bgOffset =
        (g.bgOffset + bgBaseSpeed * dt) %
        (imagesRef.current.backdrop ? imagesRef.current.backdrop!.w : 10000);
      for (const f of flies) {
        f.x -= bgBaseSpeed * dt;
        if (f.x < -10) f.x = sizeRef.current.w + 10;
      }
    }

    if (g.state !== "PLAYING") return;

    // Difficulty ramp
    g.difficultySeconds += dt;
    g.speed = 350 + g.difficultySeconds * 4;

    // Player physics
    const p = g.player;
    p.vy += g.G * dt;
    p.y += p.vy * dt;
    const groundTop = g.groundY - p.h;
    if (p.y >= groundTop) {
      p.y = groundTop;
      p.vy = 0;
      if (!p.onGround) {
        p.onGround = true;
        p.jumpsRemaining = 2;
      }
    } else {
      p.onGround = false;
    }
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);

    // Spawning with spacing
    g.obsTimer += dt;
    const minInterval = 1.1;
    const ramped = 2.1 - g.difficultySeconds * 0.01;
    const targetObsInterval = clamp(ramped, minInterval, 2.4);

    if (g.obsTimer >= g.obsInterval) {
      const canPlaceBySpacing =
        g.lastObstacleX < sizeRef.current.w - g.minGapPx;
      if (canPlaceBySpacing) {
        g.obsTimer = 0;
        g.obsInterval = targetObsInterval + (Math.random() * 0.6 - 0.3);
        const type: ObstacleType = Math.random() < 0.7 ? "SMALL" : "LARGE";
        const u = g.u;
        const mushH = type === "SMALL" ? 52 * u : 150 * u;
        // wider large mushrooms (was 74)
        const mushW = (type === "SMALL" ? 52 : 92) * u;
        const x = sizeRef.current.w + 40 * u;
        const y = g.groundY - mushH;
        g.obstacles.push({
          type,
          x,
          y,
          w: mushW,
          h: mushH,
          hit: false,
          scored: false,
        });
        g.lastObstacleX = x;
      } else {
        g.obsTimer = g.obsInterval * 0.7;
      }
    } else {
      g.lastObstacleX -= g.speed * dt;
    }

    // Hearts
    g.heartTimer += dt;
    const canSpawnHeart =
      g.hearts < 6 && g.heartTimer >= g.heartInterval && Math.random() < 0.6;
    if (canSpawnHeart) {
      g.heartTimer = 0;
      g.heartInterval = 5 + Math.random() * 3.5;
      const u = g.u;
      const hw = 30 * u;
      const hh = 28 * u;
      let trials = 0;
      let x = sizeRef.current.w + 240 * u + Math.random() * (420 * u);
      const y = g.groundY - (80 + Math.random() * 70) * u;
      while (
        trials++ < 12 &&
        g.obstacles.some(
          (o) => Math.abs(o.x + o.w / 2 - x) < o.w / 2 + hw + 130 * u
        )
      ) {
        x += 220 * u;
      }
      if (x < sizeRef.current.w + 1000 * u)
        g.heartPickups.push({ x, y, w: hw, h: hh, taken: false });
    }

    // Move world
    const vx = g.speed * dt;
    for (const o of g.obstacles) o.x -= vx;
    for (const hr of g.heartPickups) hr.x -= vx;

    // Collisions
    const shrink = (x: number, y: number, w: number, h: number) => {
      const sx = w * 0.1,
        sy = h * 0.1;
      return { x: x + sx * 0.5, y: y + sy * 0.5, w: w - sx, h: h - sy };
    };
    const pr = shrink(p.x, p.y, p.w, p.h);

    for (const o of g.obstacles) {
      const or = shrink(o.x, o.y, o.w, o.h);
      const collide =
        pr.x < or.x + or.w &&
        pr.x + pr.w > or.x &&
        pr.y < or.y + or.h &&
        pr.y + pr.h > or.y;
      if (collide && p.hitCooldown <= 0 && !o.hit) {
        o.hit = true;
        o.remove = true;
        g.hearts = clamp(g.hearts - 1, 0, 6);
        g.onHeartsChange?.(g.hearts);
        p.hitCooldown = g.HIT_BUFFER;
        playSfx("hit");
        if (g.hearts <= 0) {
          g.state = "GAMEOVER";
          g.onGameOver?.(g.score);
          return;
        }
      }
      if (!o.scored && !o.hit && p.x > o.x + o.w) {
        o.scored = true;
        g.score += 1;
        g.onScore?.(g.score);
      }
    }

    for (const hr of g.heartPickups) {
      if (hr.taken) continue;
      const rr = shrink(hr.x, hr.y, hr.w, hr.h);
      const collide =
        pr.x < rr.x + rr.w &&
        pr.x + pr.w > rr.x &&
        pr.y < rr.y + rr.h &&
        pr.y + pr.h > rr.y;
      if (collide) {
        hr.taken = true;
        if (g.hearts < 6) {
          g.hearts += 1;
          g.onHeartsChange?.(g.hearts);
          playSfx("pickup");
        }
      }
    }

    // Cleanup
    gameRef.current!.obstacles = g.obstacles.filter(
      (o) => !o.remove && o.x + o.w > -40
    );
    gameRef.current!.heartPickups = g.heartPickups.filter(
      (hr) => !hr.taken && hr.x + hr.w > -40
    );
  }

  function draw() {
    const ctx = ctxRef.current!;
    const g = gameRef.current!;
    const { w, h } = sizeRef.current;

    ctx.clearRect(0, 0, w, h);

    // Backdrop
    const bg = imagesRef.current.backdrop;
    if (bg) {
      const scale = h / bg.h; // fit height
      const bw = bg.w * scale;

      if (g.state === "PLAYING") {
        let x = -(g.bgOffset % bw || 0);
        while (x < w) {
          ctx.drawImage(bg.img, x, 0, bw, h);
          x += bw;
        }
      } else {
        // Static but REPEATED to cover width
        let x = 0;
        while (x < w) {
          ctx.drawImage(bg.img, x, 0, bw, h);
          x += bw;
        }
      }
    } else {
      ctx.fillStyle = "#04123b";
      ctx.fillRect(0, 0, w, h);
    }

    // Fireflies — twinkle always; positions updated in update()
    const flies = firefliesRef.current;
    ctx.save();
    for (const f of flies) {
      const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(f.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.pale;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), f.r, f.r);
    }
    ctx.restore();

    // Ground shadow line
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, g.groundY + 2 * g.u, w, 3 * g.u);

    // Entities
    // Hearts
    for (const hr of g.heartPickups) {
      const asset = imagesRef.current.heart;
      if (asset)
        ctx.drawImage(
          asset.img,
          Math.round(hr.x),
          Math.round(hr.y),
          hr.w,
          hr.h
        );
      else {
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(hr.x, hr.y, hr.w, hr.h);
      }
    }
    // Mushrooms
    for (const o of g.obstacles) {
      const asset =
        o.type === "SMALL"
          ? imagesRef.current.mushSmall
          : imagesRef.current.mushLarge;
      if (asset)
        ctx.drawImage(asset.img, Math.round(o.x), Math.round(o.y), o.w, o.h);
      else {
        ctx.fillStyle = o.type === "SMALL" ? COLORS.gold : COLORS.light;
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
    }
    // Player
    const p = g.player;
    const playerAsset = imagesRef.current.player;
    if (playerAsset)
      ctx.drawImage(
        playerAsset.img,
        Math.round(p.x),
        Math.round(p.y),
        p.w,
        p.h
      );
    else {
      ctx.fillStyle = COLORS.primary;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // ---------- UI ----------
  function ToggleIcon({
    on,
    onSrc,
    offSrc,
    label,
    onClick,
  }: {
    on: boolean;
    onSrc: string;
    offSrc: string;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        aria-label={label}
        onClick={() => {
          userSetMusicRef.current = true;
          onClick();
        }}
        className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 backdrop-blur px-2 py-2 hover:bg-white/15 active:scale-[0.98] transition"
      >
        <img
          src={on ? onSrc : offSrc}
          alt={label}
          className="block"
          style={{
            width: 24,
            height: 24,
            imageRendering:
              "pixelated" as React.CSSProperties["imageRendering"],
          }}
          draggable={false}
        />
      </button>
    );
  }

  const TitleOverlay = () => (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="pointer-events-auto flex w-full max-w-5xl flex-col items-center px-6">
        {/* Custom logo instead of title text */}
        <img
          src="/images/glimmerwood-dash-logo.png"
          alt="Glimmerwood Dash"
          draggable={false}
          className="mb-3 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          style={{
            width: "70%",
            maxWidth: 720,
            height: "auto",
            imageRendering:
              "pixelated" as React.CSSProperties["imageRendering"],
          }}
        />

        <div
          className="mt-1 text-center text-xl sm:text-2xl font-semibold bg-white/10 border border-white/20 rounded-xl backdrop-blur px-4 py-2"
          style={{ fontFamily: "'Glass Antiqua', cursive", color: COLORS.gold }}
        >
          High Score: <span className="font-bold">{highScore}</span>
        </div>

        <div
          className="mt-6 text-center text-lg sm:text-xl bg-white/10 border border-white/20 rounded-xl backdrop-blur px-4 py-2"
          style={{
            fontFamily: "'Glass Antiqua', cursive",
            color: COLORS.light,
          }}
        >
          Press <span className="font-bold">SPACE</span> or{" "}
          <span className="font-bold">Click</span> to Start
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3">
        <ToggleIcon
          on={musicOn}
          onSrc="/images/music-on.png"
          offSrc="/images/music-off.png"
          label="Toggle music"
          onClick={() => setMusicOn((v) => !v)}
        />
        <ToggleIcon
          on={sfxOn}
          onSrc="/images/sfx-on.png"
          offSrc="/images/sfx-off.png"
          label="Toggle SFX"
          onClick={() => setSfxOn((v) => !v)}
        />
      </div>
    </div>
  );

  const PauseOverlay = () => (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="pointer-events-auto bg-white/10 border border-white/25 rounded-2xl backdrop-blur px-6 py-5 text-center">
        <div
          className="text-4xl sm:text-5xl mb-3"
          style={{
            fontFamily: "'Mystery Quest', cursive",
            color: COLORS.pale,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
          }}
        >
          Paused
        </div>
        <div
          className="text-lg sm:text-xl"
          style={{
            fontFamily: "'Glass Antiqua', cursive",
            color: COLORS.light,
          }}
        >
          Press <b>P</b> or <b>Enter</b> to resume
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3">
        <ToggleIcon
          on={musicOn}
          onSrc="/images/music-on.png"
          offSrc="/images/music-off.png"
          label="Toggle music"
          onClick={() => setMusicOn((v) => !v)}
        />
        <ToggleIcon
          on={sfxOn}
          onSrc="/images/sfx-on.png"
          offSrc="/images/sfx-off.png"
          label="Toggle SFX"
          onClick={() => setSfxOn((v) => !v)}
        />
      </div>
    </div>
  );

  const GameOverOverlay = () => (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="pointer-events-auto bg-white/10 border border-white/25 rounded-2xl backdrop-blur px-6 py-6 text-center">
        <div
          className="text-5xl sm:text-6xl mb-2"
          style={{
            fontFamily: "'Mystery Quest', cursive",
            color: COLORS.pale,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
          }}
        >
          Game Over
        </div>
        <div
          className="text-xl sm:text-2xl mb-1"
          style={{ fontFamily: "'Glass Antiqua', cursive", color: COLORS.gold }}
        >
          Score: <b>{score}</b>
        </div>
        <div
          className="text-lg sm:text-xl"
          style={{
            fontFamily: "'Glass Antiqua', cursive",
            color: COLORS.light,
          }}
        >
          High Score: <b>{highScore}</b>
        </div>
        <div
          className="mt-3 text-lg"
          style={{
            fontFamily: "'Glass Antiqua', cursive",
            color: COLORS.light,
          }}
        >
          Press <b>SPACE</b> or <b>Click</b> to Restart
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3">
        <ToggleIcon
          on={musicOn}
          onSrc="/images/music-on.png"
          offSrc="/images/music-off.png"
          label="Toggle music"
          onClick={() => setMusicOn((v) => !v)}
        />
        <ToggleIcon
          on={sfxOn}
          onSrc="/images/sfx-on.png"
          offSrc="/images/sfx-off.png"
          label="Toggle SFX"
          onClick={() => setSfxOn((v) => !v)}
        />
      </div>
    </div>
  );

  const HUD = () =>
    gameState === "PLAYING" ? (
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-3 top-3">
          <div
            className="bg-white/10 border border-white/20 rounded-xl backdrop-blur px-3 py-1.5 text-lg"
            style={{
              fontFamily: "'Glass Antiqua', cursive",
              color: COLORS.gold,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
            }}
          >
            Score: <b>{score}</b>
          </div>
        </div>

        <div className="absolute right-3 top-3">
          <div className="bg-white/10 border border-white/20 rounded-xl backdrop-blur px-2 py-1.5 flex items-center gap-1.5">
            {Array.from({ length: heartsUI }).map((_, i) => (
              <img
                key={i}
                src="/images/heart.png"
                alt="Heart"
                draggable={false}
                className="block"
                style={{
                  width: 24,
                  height: 22,
                  imageRendering:
                    "pixelated" as React.CSSProperties["imageRendering"],
                  filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.6))",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ) : null;

  const RotateHint = () =>
    showRotateHint ? (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40">
        <div
          className="rounded-xl border border-white/20 bg-white/10 backdrop-blur px-4 py-3 text-center"
          style={{ fontFamily: "'Glass Antiqua', cursive", color: "#fff" }}
        >
          <div className="text-xl mb-1">For the best experience</div>
          <div className="text-2xl font-semibold">rotate your device</div>
        </div>
      </div>
    ) : null;

  // ---------- Render ----------
  return (
    // OUTER FRAME: centers the canvas on desktop (remains fullscreen on mobile/tablet)
    <div className="min-h-[100svh] w-[100svw] bg-black flex items-center justify-center">
      <div
        ref={containerRef}
        className="
          relative overflow-hidden bg-black
          w-[100svw] h-[100svh]
          lg:w-[80vw] lg:h-[80vh] lg:rounded-2xl lg:shadow-2xl
        "
        style={{
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none" as React.CSSProperties["WebkitUserSelect"],
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          style={{
            imageRendering:
              "pixelated" as React.CSSProperties["imageRendering"],
            cursor:
              gameState === "TITLE" || gameState === "GAMEOVER"
                ? "pointer"
                : "default",
          }}
        />

        {gameState === "TITLE" && <TitleOverlay />}
        {gameState === "PAUSED" && <PauseOverlay />}
        {gameState === "GAMEOVER" && <GameOverOverlay />}
        <HUD />
        <RotateHint />
      </div>
    </div>
  );
}
