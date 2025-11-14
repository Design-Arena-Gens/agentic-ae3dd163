import { useEffect, useRef } from "react";

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1600;
const AIR_RESISTANCE = 0.98;
const ANGLE_DAMPING = 0.88;
const MAX_ANGLE = Math.PI / 2.2;

const LEVEL = {
  spawn: { x: 140, y: 260 },
  platforms: [
    { x: 0, y: 420, w: 420, h: 140 },
    { x: 420, y: 380, w: 180, h: 180 },
    { x: 600, y: 340, w: 140, h: 220 },
    { x: 740, y: 380, w: 140, h: 180 },
    { x: 880, y: 420, w: 220, h: 140 },
    { x: 1040, y: 400, w: 260, h: 160 },
    { x: 1310, y: 360, w: 220, h: 200 },
    { x: 1570, y: 320, w: 220, h: 240 },
    { x: 1820, y: 360, w: 300, h: 200 },
    { x: 2120, y: 420, w: 320, h: 140 },
    { x: 2440, y: 360, w: 360, h: 200 }
  ],
  hazards: [
    { x: 520, y: 376, w: 40, h: 44 },
    { x: 740, y: 374, w: 140, h: 6 },
    { x: 1560, y: 316, w: 40, h: 44 },
    { x: 1640, y: 316, w: 40, h: 44 },
    { x: 1720, y: 316, w: 40, h: 44 }
  ],
  finish: { x: 2670, y: 270, w: 120, h: 210 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function HomePage() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const inputsRef = useRef({
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyR: false
  });
  const statusRef = useRef("alive");
  const finishTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const pogo = {
      length: 82,
      mass: 56,
      springStrength: 2800,
      springCompression: 0,
      maxCompression: 48
    };

    const hero = {
      x: LEVEL.spawn.x,
      y: LEVEL.spawn.y,
      vx: 0,
      vy: 0,
      angle: -0.15,
      angularVelocity: 0,
      energy: 1,
      health: 100,
      ragdollParts: [],
      state: "alive",
      distance: 0,
      time: 0
    };

    let cameraX = 0;
    let lastTimestamp = performance.now();

    const keysDown = inputsRef.current;

    function resetHero() {
      hero.x = LEVEL.spawn.x;
      hero.y = LEVEL.spawn.y;
      hero.vx = 0;
      hero.vy = 0;
      hero.angle = -0.15;
      hero.angularVelocity = 0;
      hero.energy = 1;
      hero.health = 100;
      hero.state = "alive";
      hero.ragdollParts = [];
      hero.distance = 0;
      hero.time = 0;
      cameraX = 0;
      finishTimeRef.current = null;
      statusRef.current = "alive";
    }

    function goRagdoll(impact) {
      hero.state = "ragdoll";
      statusRef.current = "ragdoll";
      const baseVelocity = Math.max(200, impact * 0.7);
      hero.ragdollParts = [
        {
          x: hero.x,
          y: hero.y - 40,
          vx: hero.vx + Math.cos(hero.angle) * baseVelocity,
          vy: hero.vy - Math.abs(Math.sin(hero.angle) * baseVelocity),
          radius: 14,
          color: "#f3f3f3"
        },
        {
          x: hero.x,
          y: hero.y,
          vx: hero.vx,
          vy: hero.vy,
          radius: 18,
          color: "#454ade"
        },
        {
          x: hero.x,
          y: hero.y + 36,
          vx: hero.vx - Math.cos(hero.angle) * baseVelocity * 0.4,
          vy: hero.vy + Math.abs(Math.sin(hero.angle) * baseVelocity),
          radius: 10,
          color: "#f0b429"
        }
      ];
    }

    function handleKeysDown(event) {
      if (keysDown.hasOwnProperty(event.code)) {
        keysDown[event.code] = true;
        if (event.code !== "KeyR") {
          event.preventDefault();
        }
      }
    }

    function handleKeysUp(event) {
      if (keysDown.hasOwnProperty(event.code)) {
        keysDown[event.code] = false;
        if (event.code !== "KeyR") {
          event.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", handleKeysDown, { passive: false });
    window.addEventListener("keyup", handleKeysUp, { passive: false });

    function projectToPlatform(x, y, platform) {
      const px = clamp(x, platform.x, platform.x + platform.w);
      const py = clamp(y, platform.y, platform.y + platform.h);
      return { x: px, y: py };
    }

    function collisionWithPlatforms(x, y, radius) {
      for (const platform of LEVEL.platforms) {
        const closest = projectToPlatform(x, y, platform);
        const dx = x - closest.x;
        const dy = y - closest.y;
        if (dx * dx + dy * dy < radius * radius) {
          return {
            platform,
            closest,
            dx,
            dy
          };
        }
      }
      return null;
    }

    function isInsideHazard(x, y) {
      return LEVEL.hazards.some((hazard) => x > hazard.x && x < hazard.x + hazard.w && y > hazard.y && y < hazard.y + hazard.h);
    }

    function updateRagdoll(dt) {
      for (const part of hero.ragdollParts) {
        part.vy += GRAVITY * dt;
        part.vx *= 0.998;
        part.vy *= 0.998;
        part.x += part.vx * dt;
        part.y += part.vy * dt;

        const collision = collisionWithPlatforms(part.x, part.y, part.radius);
        if (collision) {
          const normalX = collision.dx;
          const normalY = collision.dy;
          const normalLength = Math.hypot(normalX, normalY) || 1;
          const nx = normalX / normalLength;
          const ny = normalY / normalLength;
          part.x = collision.closest.x + nx * (part.radius + 1);
          part.y = collision.closest.y + ny * (part.radius + 1);
          const restitution = 0.35;
          const velocityAlongNormal = part.vx * nx + part.vy * ny;
          if (velocityAlongNormal < 0) {
            part.vx -= (1 + restitution) * velocityAlongNormal * nx;
            part.vy -= (1 + restitution) * velocityAlongNormal * ny;
          }
        }
      }
    }

    function update(dt) {
      if (keysDown.KeyR) {
        keysDown.KeyR = false;
        resetHero();
        return;
      }

      hero.time += dt;

      if (hero.state === "ragdoll") {
        updateRagdoll(dt);
        return;
      }

      hero.vy += GRAVITY * dt;
      hero.vx *= AIR_RESISTANCE;
      hero.angularVelocity *= ANGLE_DAMPING;

      const thrust = 560;
      if (keysDown.ArrowLeft) {
        hero.angularVelocity -= 5 * dt;
        hero.vx -= thrust * dt * Math.cos(hero.angle + Math.PI / 2);
      }
      if (keysDown.ArrowRight) {
        hero.angularVelocity += 5 * dt;
        hero.vx += thrust * dt * Math.cos(hero.angle + Math.PI / 2);
      }

      hero.angle += hero.angularVelocity * dt;
      hero.angle = clamp(hero.angle, -MAX_ANGLE, MAX_ANGLE);

      const tipX = hero.x + Math.sin(hero.angle) * pogo.length;
      const tipY = hero.y + Math.cos(hero.angle) * pogo.length;

      const compression = clamp(LEVEL.platforms.reduce((acc, platform) => {
        if (tipX >= platform.x && tipX <= platform.x + platform.w && tipY >= platform.y && tipY <= platform.y + platform.h + 2) {
          return Math.max(acc, platform.y - tipY);
        }
        return acc;
      }, 0), -pogo.maxCompression, 0);

      const onGround = compression < 0.5;
      if (onGround && hero.vy > 0) {
        hero.vx += Math.sin(hero.angle) * Math.abs(hero.vy) * 0.15;
        hero.vy = 0;
      }

      if (keysDown.Space) {
        pogo.springCompression = clamp(pogo.springCompression + dt * 60, 0, pogo.maxCompression);
        hero.energy = clamp(hero.energy + dt * 0.9, 0, 1.2);
      } else if (pogo.springCompression > 0 || compression < 0) {
        const releaseForce = (pogo.springCompression + Math.abs(compression)) * pogo.springStrength * dt * 0.6 * hero.energy;
        hero.vy -= Math.cos(hero.angle) * (releaseForce / pogo.mass);
        hero.vx -= Math.sin(hero.angle) * (releaseForce / pogo.mass);
        hero.angularVelocity += Math.sin(hero.angle) * 3 * dt * hero.energy;
        pogo.springCompression = 0;
        hero.energy = clamp(hero.energy - 0.3, 0.4, 1.2);
      } else {
        pogo.springCompression = clamp(pogo.springCompression - dt * 20, 0, pogo.maxCompression);
      }

      if (!onGround) {
        hero.energy = clamp(hero.energy - dt * 0.6, 0, 1.2);
      }

      hero.x += hero.vx * dt;
      hero.y += hero.vy * dt;
      hero.distance = Math.max(hero.distance, hero.x - LEVEL.spawn.x);

      const torsoCollision = collisionWithPlatforms(hero.x, hero.y, 18);
      if (torsoCollision) {
        const normalLength = Math.hypot(torsoCollision.dx, torsoCollision.dy) || 1;
        const nx = torsoCollision.dx / normalLength;
        const ny = torsoCollision.dy / normalLength;
        hero.x = torsoCollision.closest.x + nx * 20;
        hero.y = torsoCollision.closest.y + ny * 20;
        const impact = hero.vx * nx + hero.vy * ny;
        hero.vx -= impact * nx;
        hero.vy -= impact * ny;
        hero.health -= Math.min(Math.abs(impact) * 0.18, 40);
        if (hero.health <= 0 || Math.abs(impact) > 560) {
          goRagdoll(Math.abs(impact));
        }
      }

      if (isInsideHazard(hero.x, hero.y) || isInsideHazard(tipX, tipY)) {
        goRagdoll(900);
      }

      if (hero.y > HEIGHT + 240) {
        goRagdoll(800);
      }

      const finish = LEVEL.finish;
      if (hero.x > finish.x && hero.x < finish.x + finish.w && hero.y > finish.y && hero.y < finish.y + finish.h) {
        hero.state = "finished";
        statusRef.current = "finished";
        finishTimeRef.current = hero.time;
      }

      cameraX = clamp(hero.x - WIDTH / 2, 0, 99999);
    }

    function drawBackground(ctx, camX) {
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, "#0e1222");
      gradient.addColorStop(1, "#02040a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let i = 0; i < 600; i++) {
        const x = ((i * 379) % 3000) - ((camX * 0.2) % 3000) - 60;
        const y = ((i * 211) % HEIGHT) * 0.7 + 30;
        ctx.fillRect(x, y, 2, 2);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 90;
      ctx.beginPath();
      ctx.moveTo(-camX * 0.15, HEIGHT + 220);
      ctx.lineTo(2800 - camX * 0.15, HEIGHT + 20);
      ctx.stroke();
    }

    function drawPlatforms(ctx, camX) {
      for (const platform of LEVEL.platforms) {
        ctx.fillStyle = "#1d233a";
        ctx.fillRect(platform.x - camX, platform.y, platform.w, platform.h);
        ctx.fillStyle = "#141828";
        ctx.fillRect(platform.x - camX, platform.y + platform.h - 12, platform.w, 12);
        ctx.fillStyle = "#353d5d";
        ctx.fillRect(platform.x - camX, platform.y - 8, platform.w, 8);
      }
    }

    function drawHazards(ctx, camX) {
      for (const hazard of LEVEL.hazards) {
        ctx.fillStyle = "#9b1b30";
        ctx.fillRect(hazard.x - camX, hazard.y, hazard.w, hazard.h);
        ctx.fillStyle = "#d7263d";
        ctx.beginPath();
        const spikes = Math.max(2, Math.floor(hazard.w / 12));
        for (let i = 0; i < spikes; i++) {
          const x = hazard.x - camX + (i / spikes) * hazard.w;
          ctx.moveTo(x, hazard.y);
          ctx.lineTo(x + hazard.w / spikes / 2, hazard.y - 12);
          ctx.lineTo(x + hazard.w / spikes, hazard.y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawFinish(ctx, camX) {
      const finish = LEVEL.finish;
      ctx.fillStyle = "#15ed8d";
      ctx.fillRect(finish.x - camX, finish.y, finish.w, finish.h);
      ctx.fillStyle = "#072f1e";
      ctx.fillRect(finish.x - camX + 8, finish.y + 8, finish.w - 16, finish.h - 16);
      ctx.fillStyle = "#15ed8d";
      ctx.font = "32px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", finish.x - camX + finish.w / 2, finish.y + finish.h / 2 + 12);
    }

    function drawHero(ctx, camX) {
      if (hero.state === "ragdoll") {
        for (const part of hero.ragdollParts) {
          ctx.fillStyle = part.color;
          ctx.beginPath();
          ctx.arc(part.x - camX, part.y, part.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      const tipX = hero.x + Math.sin(hero.angle) * pogo.length;
      const tipY = hero.y + Math.cos(hero.angle) * pogo.length;

      ctx.lineWidth = 6;
      ctx.strokeStyle = "#ffce6b";
      ctx.beginPath();
      ctx.moveTo(hero.x - camX, hero.y);
      ctx.lineTo(tipX - camX, tipY);
      ctx.stroke();

      ctx.strokeStyle = "#74e2ff";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(hero.x - camX, hero.y - 40);
      ctx.lineTo(hero.x - camX, hero.y + 26);
      ctx.stroke();

      ctx.fillStyle = "#f3f3f3";
      ctx.beginPath();
      ctx.arc(hero.x - camX, hero.y - 58, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#9dd6f5";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hero.x - camX, hero.y - 36);
      ctx.lineTo(hero.x - camX + 26 * Math.sin(hero.angle + Math.PI / 3), hero.y - 36 + 26 * Math.cos(hero.angle + Math.PI / 3));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hero.x - camX, hero.y - 36);
      ctx.lineTo(hero.x - camX - 22 * Math.sin(hero.angle + Math.PI / 3), hero.y - 36 + 22 * Math.cos(hero.angle + Math.PI / 3));
      ctx.stroke();
    }

    function drawHUD(ctx) {
      ctx.save();
      ctx.fillStyle = "rgba(3, 6, 14, 0.72)";
      ctx.fillRect(18, 18, 260, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "18px 'Press Start 2P', monospace";
      ctx.textAlign = "left";
      ctx.fillText("POGO STICK HERO", 36, 48);

      ctx.fillStyle = "#ccccff";
      ctx.font = "13px 'Press Start 2P', monospace";
      ctx.fillText("Arrow keys tilt", 36, 74);
      ctx.fillText("Space compress spring", 36, 94);
      ctx.fillText("R restart", 36, 114);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Health: ${Math.max(0, hero.health | 0)}`, 36, 140);
      ctx.fillText(`Energy: ${(hero.energy * 100) | 0}`, 36, 162);
      ctx.fillText(`Distance: ${Math.floor(hero.distance)}m`, 36, 184);

      const status = statusRef.current;
      const finishTime = finishTimeRef.current;
      if (status === "finished" && finishTime != null) {
        ctx.fillStyle = "#15ed8d";
        ctx.font = "16px 'Press Start 2P', monospace";
        ctx.fillText(`Victory! ${finishTime.toFixed(2)}s`, 36, 212);
      } else if (status === "ragdoll") {
        ctx.fillStyle = "#ff5f7a";
        ctx.font = "16px 'Press Start 2P', monospace";
        ctx.fillText("You crashed!", 36, 212);
      }

      ctx.restore();
    }

    function render() {
      drawBackground(ctx, cameraX);
      drawPlatforms(ctx, cameraX);
      drawHazards(ctx, cameraX);
      drawFinish(ctx, cameraX);
      drawHero(ctx, cameraX);
      drawHUD(ctx);
    }

    function step(timestamp) {
      const delta = (timestamp - lastTimestamp) / 1000;
      const dt = clamp(delta, 0, 0.04);
      update(dt);
      render();
      lastTimestamp = timestamp;
      animationRef.current = requestAnimationFrame(step);
    }

    animationRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("keydown", handleKeysDown);
      window.removeEventListener("keyup", handleKeysUp);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          width: "min(960px, 95vw)",
          height: "auto",
          borderRadius: "18px",
          border: "2px solid rgba(116, 230, 255, 0.2)",
          boxShadow: "0 30px 90px rgba(12, 25, 47, 0.6)",
          background: "#02040a"
        }}
      />
      <span className="sr-only">Happy Wheels inspired level. Use arrow keys and space to control pogo stick hero. Press R to restart.</span>
    </main>
  );
}
