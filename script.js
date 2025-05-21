(() => {
  "use strict";

      // --- Global Game Variables ---
      let player;
      let obstacles = [];
      let lifeCollectibles = [];
      let score = 0;
      let lives = 3;
      const MAX_LIVES = 5;
      let gameSpeed = 5;
      const speedIncrease = 0.003;
      const gravity = 0.6;
      const jumpForce = -13;
      let gameState = "startScreen";
      let groundLevel;
      const groundAdjustment = 5; // Pixels to lower the logical ground level

      // --- Image Variables ---
      let bgImg;
      let bgImgX = 0;
      let lifeIconImg;
      let playerImg;
      let obstacleImg;

      // Fallback colors
      const bgColor = [135, 206, 250];
      let highScore = Number(localStorage.getItem("highScore")) || 0;
      const groundColor = [139, 69, 19];

      // --- p5.js Preload Function ---
      function preload() {
        bgImg = loadImage(
          "backdrop.png",
          () => console.log("Background image loaded successfully!"),
          () =>
            console.error(
              "Failed to load background image. Using fallback colors."
            )
        );
        lifeIconImg = loadImage(
          "heart.png",
          () => console.log("Life icon image loaded successfully!"),
          () =>
            console.error(
              "Failed to load life icon image. Using fallback red squares."
            )
        );
        playerImg = loadImage(
          "player.png",
          () => console.log("Player image loaded successfully!"),
          () =>
            console.error(
              "Failed to load player image. Using fallback green square."
            )
        );
        obstacleImg = loadImage(
          "mushroom.png",
          () => console.log("Obstacle image loaded successfully!"),
          () =>
            console.error(
              "Failed to load obstacle image. Using fallback brown rectangle."
            )
        );
      }

      // --- p5.js Setup Function ---
      function setup() {
        let canvas = createCanvas(windowWidth * 0.8, windowHeight * 0.7);
        canvas.parent(document.getElementById("game-root"));
        groundLevel = height * 0.85 + groundAdjustment;
        textAlign(CENTER, CENTER);
        textSize(24); // Default text size
        textFont("monospace");
      }

      // --- p5.js Draw Function ---
      function draw() {
        if (gameState === "startScreen") {
          displayStartScreen();
        } else if (gameState === "playing") {
          runGame();
        } else if (gameState === "paused") {
          displayPauseScreen();
        } else if (gameState === "gameOver") {
          displayGameOver();
        }
      }

      // --- Display Start Screen ---
      function displayStartScreen() {
        if (bgImg && bgImg.width > 0) {
          image(bgImg, 0, 0, width, height);
        } else {
          background(bgColor[0], bgColor[1], bgColor[2]);
        }
        noStroke();
        fill(groundColor[0], groundColor[1], groundColor[2], 0);
        rect(0, groundLevel, width, height - groundLevel);

        textFont("Mystery Quest");
        fill(255, 223, 186);
        stroke(80, 40, 20, 200);
        strokeWeight(4);
        textSize(56);
        text("Glimmerwood Dash", width / 2, height / 2 - 80);

        textFont("Glass Antiqua");
        noStroke();

        textSize(28);
        if (frameCount % 60 < 30) {
          fill(255, 255, 150);
        } else {
          fill(230, 230, 100);
        }
        text("Press SPACE or Click to Start", width / 2, height / 2 + 50);

        fill(230, 230, 230);
        textSize(18);
        text(
          "Jump over obstacles and collect lives!",
          width / 2,
          height / 2 + 100
        );
        text("Press P or ENTER to Pause/Resume", width / 2, height / 2 + 130);
        text(`High Score: ${highScore}`, width / 2, height / 2 + 170);
      }

      // --- Display Pause Screen ---
      function displayPauseScreen() {
        fill(0, 0, 0, 150);
        rect(0, 0, width, height);

        textFont("Glass Antiqua");
        fill(255, 255, 0);
        stroke(0);
        strokeWeight(2);
        textSize(48);
        text("PAUSED", width / 2, height / 2 - 30);

        textSize(24);
        noStroke();
        if (frameCount % 60 < 30) {
          fill(255);
        } else {
          fill(200);
        }
        text("Press P or ENTER to Resume", width / 2, height / 2 + 30);
      }

      // --- Core Gameplay Loop ---
      function runGame() {
        drawBackground();
        manageObstacles();
        manageLifeCollectibles();
        if (player) {
          player.update();
          player.show();
        }
        checkCollisions();
        displayInfo();
        if (gameState === "playing") {
          gameSpeed += speedIncrease;
        }
      }

      // --- Draw Background Layers ---
      function drawBackground() {
        if (bgImg && bgImg.width > 0) {
          image(bgImg, bgImgX, 0, width, height);
          image(bgImg, bgImgX + width, 0, width, height);

          if (gameState === "playing") {
            bgImgX -= gameSpeed * 0.2;
            if (bgImgX <= -width) {
              bgImgX = 0;
            }
          }
        } else {
          background(bgColor[0], bgColor[1], bgColor[2]);
        }
        noStroke();
        fill(groundColor[0], groundColor[1], groundColor[2], 0);
        rect(0, groundLevel, width, height - groundLevel);
      }

      // --- Manage Obstacles ---
      function manageObstacles() {
        if (gameState !== "playing") return;
        let spawnInterval = map(gameSpeed, 5, 20, 100, 40, true);
        if (frameCount % floor(spawnInterval) === 0 && random(1) < 0.7) {
          if (obstacles.length < 5) {
            obstacles.push(new Obstacle());
          }
        }
        for (let i = obstacles.length - 1; i >= 0; i--) {
          obstacles[i].move();
          obstacles[i].show();
          if (obstacles[i].isOffscreen()) {
            obstacles.splice(i, 1);
            score++;
          }
        }
      }

      // --- Manage Life Collectibles ---
      function manageLifeCollectibles() {
        if (gameState !== "playing") return;
        let lifeSpawnInterval = floor(map(gameSpeed, 5, 20, 400, 180, true));
        if (frameCount % lifeSpawnInterval === 0 && random(1) < 0.3) {
          if (lifeCollectibles.length < 2 && lives < MAX_LIVES) {
            let canSpawnLife = true;
            const lifeW = 25;
            const potentialLifeX = width;
            for (let obs of obstacles) {
              if (
                potentialLifeX < obs.x + obs.w &&
                potentialLifeX + lifeW > obs.x
              ) {
                canSpawnLife = false;
                break;
              }
            }
            if (canSpawnLife) {
              lifeCollectibles.push(new LifeCollectible());
            }
          }
        }
        for (let i = lifeCollectibles.length - 1; i >= 0; i--) {
          lifeCollectibles[i].move();
          lifeCollectibles[i].show();
          if (lifeCollectibles[i].isOffscreen()) {
            lifeCollectibles.splice(i, 1);
          }
        }
      }

      // --- Check for Collisions (Obstacles and Lives) ---
      function checkCollisions() {
        if (gameState !== "playing" || !player) return;
        for (let i = obstacles.length - 1; i >= 0; i--) {
          if (player.hits(obstacles[i])) {
            lives--;
            obstacles.splice(i, 1);
            if (lives <= 0) {
              gameOver();
              return;
            }
          }
        }
        for (let i = lifeCollectibles.length - 1; i >= 0; i--) {
          if (player.hits(lifeCollectibles[i])) {
            if (lives < MAX_LIVES) {
              lives++;
            }
            lifeCollectibles.splice(i, 1);
          }
        }
      }

      // --- Display Score, Lives, and Instructions ---
      function displayInfo() {
        textFont("Glass Antiqua");
        fill(255);
        stroke(0);
        strokeWeight(2);
        textSize(28);
        textAlign(LEFT, TOP);
        text(`Score: ${score}`, 20, 20);

        textAlign(RIGHT, TOP);
        const livesTextString = "Lives: ";
        text(livesTextString, width - 90, 20);

        const iconSize = 22;
        const iconPadding = 5;
        const livesPerRow = 3;
        const startY = 18;
        const iconRowStartX =
          width - 20 - livesPerRow * (iconSize + iconPadding) + iconPadding / 2;

        for (let i = 0; i < lives; i++) {
          let row = floor(i / livesPerRow);
          let col = i % livesPerRow;
          let iconX = iconRowStartX + col * (iconSize + iconPadding);
          let iconY = startY + row * (iconSize + iconPadding);

          if (lifeIconImg && lifeIconImg.width > 0) {
            image(lifeIconImg, iconX, iconY, iconSize, iconSize);
          } else {
            fill(255, 0, 0, 200);
            noStroke();
            rect(iconX, iconY, iconSize - 2, iconSize - 2, 4);
          }
        }
        textAlign(LEFT, TOP);

        if (gameState === "playing") {
          fill(0, 0, 0, 150);
          noStroke();
          rectMode(CENTER);
          rect(width / 2, height - 40, 350, 40, 10);
          fill(255);
          textSize(20);
          textAlign(CENTER, CENTER);
          text("Press SPACE or Click to JUMP", width / 2, height - 40);
          rectMode(CORNER);
        }
      }

      // --- Game Over State ---
      function gameOver() {
        gameState = "gameOver";
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("highScore", highScore);
        }
      }

      // --- Display Game Over Screen ---
      function displayGameOver() {
        drawBackground();
        if (player) player.show();
        for (let obs of obstacles) obs.show();
        for (let life of lifeCollectibles) life.show();

        fill(0, 0, 0, 180);
        rect(0, 0, width, height);

        // --- MODIFIED: "GAME OVER" text font and styling ---
        textFont("Mystery Quest"); // Apply Mystery Quest font
        fill(255, 0, 0); // Keep the traditional red for Game Over
        stroke(255); // White stroke for contrast
        strokeWeight(3); // Slightly thicker stroke
        textSize(72); // Make it nice and big!
        textAlign(CENTER, CENTER);
        text("GAME OVER", width / 2, height / 2 - 60);

        // Reset font for subsequent text
        textFont("Glass Antiqua");
        noStroke(); // Remove stroke for subsequent text

        fill(255);
        textSize(36);
        text(`Final Score: ${score}`, width / 2, height / 2 + 10);

        textSize(24);
        text(`High Score: ${highScore}`, width / 2, height / 2 + 50);
        if (frameCount % 60 < 30) {
          fill(255, 255, 0);
          text("Press SPACE or Click to Restart", width / 2, height / 2 + 70);
        }
      }

      function resetGame() {
        score = 0;
        lives = 3;
        obstacles = [];
        lifeCollectibles = [];
        player = new Player();
        gameSpeed = 5;
        bgImgX = 0;
      }

      // --- p5.js Input Functions ---
      function keyPressed() {
        if (keyCode === ENTER || key.toUpperCase() === "P") {
          if (gameState === "playing") {
            gameState = "paused";
          } else if (gameState === "paused") {
            gameState = "playing";
          }
        } else if (key === " ") {
          handleInput();
        }
        return false;
      }

      function mousePressed() {
        handleInput();
      }

      // --- Central Input Handler (for Space/Click) ---
      function handleInput() {
        if (gameState === "startScreen") {
          resetGame();
          gameState = "playing";
        } else if (gameState === "playing") {
          if (player) player.jump();
        } else if (gameState === "gameOver") {
          resetGame();
          gameState = "playing";
        }
      }

      // --- p5.js Window Resize Function ---
      function windowResized() {
        resizeCanvas(windowWidth * 0.8, windowHeight * 0.7);
        groundLevel = height * 0.85 + groundAdjustment;
        if (player) {
          player.baseY = groundLevel - player.h;
          player.y = constrain(player.y, 0, player.baseY);
        }
        if (gameState === "startScreen") displayStartScreen();
        if (gameState === "paused") {
          drawBackground();
          if (player) player.show();
          for (let obs of obstacles) obs.show();
          for (let lc of lifeCollectibles) lc.show();
          displayInfo();
          displayPauseScreen();
        }
        if (gameState === "gameOver") displayGameOver();
      }

      // ==================================================
      // --- Player Class ---
      // ==================================================
      class Player {
        constructor() {
          this.w = 60;
          this.h = 80;
          this.x = width * 0.15;
          this.baseY = groundLevel - this.h;
          this.y = this.baseY;
          this.vy = 0;
          this.fallbackColor = color(34, 139, 34);
        }

        jump() {
          if (this.y >= this.baseY - 1 && gameState === "playing") {
            this.vy = jumpForce;
          }
        }

        hits(otherThing) {
          let playerLeft = this.x + 5;
          let playerRight = this.x + this.w - 5;
          let playerTop = this.y + 5;
          let playerBottom = this.y + this.h - 5;

          let otherLeft = otherThing.x;
          let otherRight = otherThing.x + otherThing.w;
          let otherTop = otherThing.y;
          let otherBottom = otherThing.y + otherThing.h;

          return (
            playerRight > otherLeft &&
            playerLeft < otherRight &&
            playerBottom > otherTop &&
            playerTop < otherBottom
          );
        }

        update() {
          if (gameState !== "playing") return;

          this.vy += gravity;
          this.y += this.vy;
          this.y = constrain(this.y, 0, this.baseY);
          if (this.y >= this.baseY) {
            this.vy = 0;
          }
        }

        show() {
          push();
          if (playerImg && playerImg.width > 0) {
            image(playerImg, this.x, this.y, this.w, this.h);
          } else {
            fill(this.fallbackColor);
            noStroke();
            rect(this.x, this.y, this.w, this.h, 5);
          }
          pop();
        }
      }

      // ==================================================
      // --- Obstacle Class ---
      // ==================================================
      class Obstacle {
        constructor() {
          this.w = random(60, 90);
          this.h = random(60, 100);
          this.x = width;
          this.y = groundLevel - this.h;
          this.fallbackColor = color(160, 82, 45);
        }

        move() {
          if (gameState === "playing") {
            this.x -= gameSpeed;
          }
        }

        show() {
          push();
          if (obstacleImg && obstacleImg.width > 0) {
            image(obstacleImg, this.x, this.y, this.w, this.h);
          } else {
            fill(this.fallbackColor);
            noStroke();
            rect(this.x, this.y, this.w, this.h, 3);
          }
          pop();
        }

        isOffscreen() {
          return this.x < -this.w;
        }
      }

      // ==================================================
      // --- Life Collectible Class ---
      // ==================================================
      class LifeCollectible {
        constructor() {
          this.w = 30;
          this.h = 30;
          this.x = width;
          this.y = groundLevel - this.h;
          this.fallbackColor = color(255, 0, 0, 220);
        }

        move() {
          if (gameState === "playing") {
            this.x -= gameSpeed * 0.9;
          }
        }

        show() {
          push();
          if (lifeIconImg && lifeIconImg.width > 0) {
            image(lifeIconImg, this.x, this.y, this.w, this.h);
          } else {
            fill(this.fallbackColor);
            stroke(255, 100, 100);
            strokeWeight(1);
            rect(this.x, this.y, this.w, this.h, 5);
          }
          pop();
        }
        isOffscreen() {
          return this.x < -this.w;
        }
      }

      // Expose p5 lifecycle functions globally for p5.js
      window.preload = preload;
      window.setup = setup;
      window.draw = draw;
      window.keyPressed = keyPressed;
      window.mousePressed = mousePressed;
      window.windowResized = windowResized;
})();
