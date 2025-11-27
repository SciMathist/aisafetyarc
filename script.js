// Flocking (Boids) fish animation
const container = document.getElementById('fish-container');

if (!container) {
  console.warn('fish-container not found in DOM. Fish animation will not run.');
}

const fishSVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 12c4-5 10-5 14 0-4 5-10 5-14 0z"/>
  <path d="M17 12h2"/>
</svg>
`;

// Boid class
class Boid {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
  // initial velocity (slightly increased for a bit more motion)
  this.vx = (Math.random() * 2 - 1) * 1.0;
  this.vy = (Math.random() * 2 - 1) * 1.0;
    this.el = document.createElement('div');
    this.el.className = 'fish';
    this.el.innerHTML = fishSVG;
    this.el.style.color = color;
    this.el.style.position = 'absolute';
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    this.el.style.pointerEvents = 'none';
    container.appendChild(this.el);
  // no flip state: fish will not be flipped horizontally
    // state flags
    this.isRed = (color === '#d44');
    this.leftFlock = false; // for red fish that have left a flock
  }
  applyTransform() {
    const angle = Math.atan2(this.vy, this.vx) * 180 / Math.PI;
  // do not flip horizontally; only translate & rotate
  this.el.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${angle}deg)`;
  }
}

// Globals and helpers
const boids = [];
let width = window.innerWidth;
let height = window.innerHeight;
// mouse/touch interaction state
let mouse = { x: -9999, y: -9999, active: false };

function updateMouse(e) {
  mouse.x = e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX) || mouse.x;
  mouse.y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY) || mouse.y;
  mouse.active = true;
}

window.addEventListener('pointermove', updateMouse, { passive: true });
window.addEventListener('pointerdown', updateMouse, { passive: true });
window.addEventListener('pointerleave', () => { mouse.active = false; }, { passive: true });
window.addEventListener('touchmove', updateMouse, { passive: true });
window.addEventListener('touchstart', updateMouse, { passive: true });

function vwToPx(vw) { return vw / 100 * width; }
function vhToPx(vh) { return vh / 100 * height; }

// Create initial boids as several small flocks around the viewport center
function createBoids(n = 55, groups = 3) {
  const groupsCount = Math.max(1, Math.min(groups, n));
  const perGroup = Math.floor(n / groupsCount);
  const remainder = n - perGroup * groupsCount;

  // center-based spawn area (fraction of width/height)
  const centerSpreadX = width * 0.4; // +/- 40% of half-width
  const centerSpreadY = height * 0.35;

  for (let g = 0; g < groupsCount; g++) {
    // pick a small group center near the viewport center
    const groupCenterX = width / 2 + (Math.random() - 0.5) * centerSpreadX;
    const groupCenterY = height / 2 + (Math.random() - 0.5) * centerSpreadY;
    const count = perGroup + (g < remainder ? 1 : 0);

    for (let i = 0; i < count; i++) {
      // place members near the group center within a small radius
      const rx = (Math.random() - 0.5) * (width * 0.08);
      const ry = (Math.random() - 0.5) * (height * 0.06);
      const x = groupCenterX + rx;
      const y = groupCenterY + ry;
  // Do not create initial red fish here; red promotions are handled later to ensure
  // only one on-screen red exists at a time.
  const isRed = false;
  const color = '#aaa';
      boids.push(new Boid(x, y, color));
    }
  }
}

const params = {
  // allow slightly faster top speed
  maxSpeed: 5.0,
  // reduced maxForce so steering is smoother and less jittery
  maxForce: 0.04,
  // slightly larger neighbor radius for smoother group behavior
  neighborDist: 100,
  desiredSeparation: 26,
  alignmentWeight: 1.0,
  cohesionWeight: 0.6,
  // slightly reduced separation weight to avoid abrupt pushes
  separationWeight: 1.4,
  mouseAvoidWeight: 3.0
};

// curiosity parameters for red fish
params.curiosityRadius = 220;        // px — search radius for nearby non-red fish
params.curiosityWeight = 0.9;        // steering strength toward curiosity target
params.curiosityDurationMin = 800;   // ms
params.curiosityDurationMax = 2200;  // ms
params.curiosityChance = 0.0025;     // per-frame chance to start investigating when a target exists

function limit(vx, vy, max) {
  const m = Math.hypot(vx, vy);
  if (m > max && m > 0) {
    const f = max / m;
    return [vx * f, vy * f];
  }
  return [vx, vy];
}

function stepBoids() {
  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    let alignX = 0, alignY = 0, countAlign = 0;
    let cohX = 0, cohY = 0, countCoh = 0;
    let sepX = 0, sepY = 0, countSep = 0;

    for (let j = 0; j < boids.length; j++) {
      if (i === j) continue;
      const o = boids[j];
      const dx = o.x - b.x;
      const dy = o.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < params.neighborDist && dist > 0) {
        alignX += o.vx; alignY += o.vy; countAlign++;
        cohX += o.x; cohY += o.y; countCoh++;
      }
      if (dist < params.desiredSeparation && dist > 0) {
        sepX += (b.x - o.x) / dist; sepY += (b.y - o.y) / dist; countSep++;
      }
    }

    // alignment
    let steerAlignX = 0, steerAlignY = 0;
    if (countAlign > 0) {
      steerAlignX = alignX / countAlign; steerAlignY = alignY / countAlign;
      [steerAlignX, steerAlignY] = limit(steerAlignX, steerAlignY, params.maxSpeed);
      steerAlignX -= b.vx; steerAlignY -= b.vy;
      [steerAlignX, steerAlignY] = limit(steerAlignX, steerAlignY, params.maxForce);
    }

    // cohesion
    let steerCohX = 0, steerCohY = 0;
    if (countCoh > 0) {
      steerCohX = cohX / countCoh; steerCohY = cohY / countCoh;
      steerCohX = steerCohX - b.x; steerCohY = steerCohY - b.y;
      [steerCohX, steerCohY] = limit(steerCohX, steerCohY, params.maxSpeed);
      steerCohX -= b.vx; steerCohY -= b.vy;
      [steerCohX, steerCohY] = limit(steerCohX, steerCohY, params.maxForce);
    }

    // separation
    let steerSepX = 0, steerSepY = 0;
    if (countSep > 0) {
      steerSepX = sepX / countSep; steerSepY = sepY / countSep;
      [steerSepX, steerSepY] = limit(steerSepX, steerSepY, params.maxSpeed);
      steerSepX -= b.vx; steerSepY -= b.vy;
      [steerSepX, steerSepY] = limit(steerSepX, steerSepY, params.maxForce * 1.5);
    }

    // special behavior for red fish: they wait, investigate sometimes, then leave flocks
    if (b.isRed && !b.leftFlock) {
      const now = Date.now();
      // occasionally start an investigation of a nearby non-red boid
      if (!b.investigating && Math.random() < params.curiosityChance) {
        const tgt = findNearestNonRed(b, params.curiosityRadius);
        if (tgt) {
          b.investigating = true;
          b.investigateTarget = tgt;
          b.investigateUntil = now + (params.curiosityDurationMin + Math.random() * (params.curiosityDurationMax - params.curiosityDurationMin));
        }
      }
      // if waitingToLeave is set and leaveTime not reached, move randomly inside the flock
      if (b.waitingToLeave && b.leaveTime && now < b.leaveTime) {
        // mild random motion while waiting; reduced magnitude to avoid vibration
        b.vx += (Math.random() - 0.5) * 0.16;
        b.vy += (Math.random() - 0.5) * 0.16;
        // slightly reduce cohesion/alignment so it doesn't perfectly follow
        b.vx += steerAlignX * (params.alignmentWeight * 0.3);
        b.vy += steerAlignY * (params.alignmentWeight * 0.3);
        b.vx += steerCohX * (params.cohesionWeight * 0.3);
        b.vy += steerCohY * (params.cohesionWeight * 0.3);
        // if investigating, steer slightly toward the investigation target
        if (b.investigating && b.investigateTarget) {
          const tx = b.investigateTarget.x, ty = b.investigateTarget.y;
          const dx = tx - b.x, dy = ty - b.y; const d = Math.hypot(dx, dy) || 0.0001;
          const fx = (dx / d) * params.curiosityWeight * 0.6;
          const fy = (dy / d) * params.curiosityWeight * 0.6;
          b.vx += fx; b.vy += fy;
          if (Date.now() > b.investigateUntil) {
            b.investigating = false; delete b.investigateTarget; delete b.investigateUntil;
          }
        }
      } else {
        // time to leave: apply outward push from group center
        // if red fish is inside a flock (many neighbors), push it outward from group center
        if (countCoh > 0) {
          const groupCenterX = cohX / countCoh;
          const groupCenterY = cohY / countCoh;
          const awayX = b.x - groupCenterX;
          const awayY = b.y - groupCenterY;
          const awayDist = Math.hypot(awayX, awayY) || 0.0001;
          // apply a fairly strong outward acceleration
          const pushStrength = Math.min(1.2, (1 - Math.min(awayDist / (params.neighborDist * 0.6), 1)) * 1.8);
          b.vx += (awayX / awayDist) * pushStrength;
          b.vy += (awayY / awayDist) * pushStrength;
          // also increase separation so it doesn't cluster
          b.vx += steerSepX * (params.separationWeight * 1.6);
          b.vy += steerSepY * (params.separationWeight * 1.6);
          // reduce alignment/cohesion influence
          b.vx += steerAlignX * (params.alignmentWeight * 0.2);
          b.vy += steerAlignY * (params.alignmentWeight * 0.2);
          // if it's far enough from the group center, mark it as left
          if (awayDist > params.neighborDist * 0.9) {
            b.leftFlock = true;
            // clear waiting flag
            b.waitingToLeave = false;
            delete b.leaveTime;
          }
        } else {
          // no neighbors: just keep moving outward
          b.vx += steerSepX * params.separationWeight;
          b.vy += steerSepY * params.separationWeight;
        }
      }
    } else if (b.isRed && b.leftFlock) {
      // red fish that have left should NOT rejoin any flock:
      // only apply separation and a small outward drift + jitter so they keep moving away
      b.vx += steerSepX * (params.separationWeight * 1.4);
      b.vy += steerSepY * (params.separationWeight * 1.4);
      // drift away from center slightly so they don't hover near other flocks
      const cx = width / 2, cy = height / 2;
      const dxAway = b.x - cx, dyAway = b.y - cy;
      const distAway = Math.hypot(dxAway, dyAway) || 0.0001;
      const awayStrength = 0.18;
      b.vx += (dxAway / distAway) * awayStrength;
      b.vy += (dyAway / distAway) * awayStrength;
  // small random jitter so motion looks natural (reduced)
  b.vx += (Math.random() - 0.5) * 0.06;
  b.vy += (Math.random() - 0.5) * 0.06;
    } else {
      // normal combine for non-red
      b.vx += steerAlignX * params.alignmentWeight + steerCohX * params.cohesionWeight + steerSepX * params.separationWeight;
      b.vy += steerAlignY * params.alignmentWeight + steerCohY * params.cohesionWeight + steerSepY * params.separationWeight;
    }

    // mouse avoidance: steer away from cursor/touch when within a radius
    if (mouse.active) {
      const mdx = b.x - mouse.x;
      const mdy = b.y - mouse.y;
      const mdist = Math.hypot(mdx, mdy) || 0.0001;
      const mouseAvoidRadius = Math.max(80, Math.min(width, height) * 0.18);
      if (mdist < mouseAvoidRadius) {
        // strength scales with proximity (closer -> stronger)
        const strength = (1 - mdist / mouseAvoidRadius) * params.mouseAvoidWeight;
        const ax = (mdx / mdist) * strength;
        const ay = (mdy / mdist) * strength;
        b.vx += ax;
        b.vy += ay;
      }
    }

  [b.vx, b.vy] = limit(b.vx, b.vy, params.maxSpeed);

  // apply light damping to velocities to reduce high-frequency vibration/jitter
  const damping = 0.985;
  b.vx *= damping;
  b.vy *= damping;

  b.x += b.vx;
  b.y += b.vy;

  // smooth flip scale toward facing direction based on x velocity
  const flipThreshold = 0.25; // ignore tiny vx to avoid jitter
  const flipSmoothing = 0.15; // lerp factor
  let targetFlip = b.flipScale;
  if (b.vx < -flipThreshold) targetFlip = -1;
  else if (b.vx > flipThreshold) targetFlip = 1;
  // lerp
  b.flipScale += (targetFlip - b.flipScale) * flipSmoothing;

    // wrap
    if (b.x < -60) b.x = width + 60;
    if (b.x > width + 60) b.x = -60;
    if (b.y < -60) b.y = height + 60;
    if (b.y > height + 60) b.y = -60;
    // if a red fish that has left goes well off-screen, revert it to normal so new reds can spawn
    if (b.isRed && b.leftFlock) {
      if (b.x < -120 || b.x > width + 120 || b.y < -120 || b.y > height + 120) {
        b.isRed = false;
        b.leftFlock = false;
        b.el.classList.remove('red');
        b.el.style.color = '#aaa';
        delete b.leaveTime;
        delete b.waitingToLeave;
      }
    }
  }

  for (const b of boids) b.applyTransform();
}

let raf = null;
function loop() { stepBoids(); raf = requestAnimationFrame(loop); }

function start() {
  if (!container) return;
  width = window.innerWidth; height = window.innerHeight;
  // spawn initial flocks (groups) near center
  if (boids.length === 0) createBoids(55, 4);
  // start spawning random non-red wanderers from edges periodically
  if (!window.__spawnInterval) {
    window.__spawnInterval = setInterval(() => {
      // limit total boids to avoid runaway
      if (boids.length > 120) return;
      spawnWanderer();
    }, 900 + Math.random() * 700);
  }
  // periodically promote one red fish per flock
  if (!window.__promoteInterval) {
    window.__promoteInterval = setInterval(() => {
      promoteIfNoRedInFrame();
    }, 7000 + Math.random() * 5000);
  }
  if (raf == null) loop();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

window.addEventListener('resize', () => { width = window.innerWidth; height = window.innerHeight; });

// create a new non-red boid that enters from a random edge and heads roughly inward
function spawnWanderer() {
  const side = Math.floor(Math.random() * 4);
  let x, y, vx, vy;
  const speed = 1.6 + Math.random() * 2.0;
  if (side === 0) { // top
    x = Math.random() * width; y = -20;
    vx = (Math.random() - 0.5) * 1.2; vy = speed;
  } else if (side === 1) { // right
    x = width + 20; y = Math.random() * height;
    vx = -speed; vy = (Math.random() - 0.5) * 1.2;
  } else if (side === 2) { // bottom
    x = Math.random() * width; y = height + 20;
    vx = (Math.random() - 0.5) * 1.2; vy = -speed;
  } else { // left
    x = -20; y = Math.random() * height;
    vx = speed; vy = (Math.random() - 0.5) * 1.2;
  }
  const color = '#aaa';
  const b = new Boid(x, y, color);
  // give it an initial push toward the viewport center with small noise
  const cx = width / 2 + (Math.random() - 0.5) * (width * 0.25);
  const cy = height / 2 + (Math.random() - 0.5) * (height * 0.25);
  const dx = cx - x; const dy = cy - y; const d = Math.hypot(dx, dy) || 1;
  b.vx = (dx / d) * (speed * (0.9 + Math.random() * 0.6)) + (Math.random() - 0.5) * 0.18;
  b.vy = (dy / d) * (speed * (0.9 + Math.random() * 0.6)) + (Math.random() - 0.5) * 0.18;
  boids.push(b);
  // if this wanderer gets close to a flock, it will naturally join via normal boid rules
}

// cluster detection: group boids that are mutual neighbors (within neighborDist)
function getClusters(minSize = 4) {
  const clusters = [];
  const visited = new Array(boids.length).fill(false);
  for (let i = 0; i < boids.length; i++) {
    if (visited[i]) continue;
    // BFS/DFS to collect neighbors
    const stack = [i];
    const cluster = [];
    visited[i] = true;
    while (stack.length) {
      const idx = stack.pop();
      cluster.push(idx);
      const b = boids[idx];
      for (let j = 0; j < boids.length; j++) {
        if (visited[j]) continue;
        const o = boids[j];
        const dx = o.x - b.x; const dy = o.y - b.y;
        if (Math.hypot(dx, dy) < params.neighborDist) {
          visited[j] = true;
          stack.push(j);
        }
      }
    }
    if (cluster.length >= minSize) clusters.push(cluster);
  }
  return clusters;
}

// find nearest non-red boid to 'b' within radius, return its {x,y} or null
function findNearestNonRed(b, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const o of boids) {
    if (!o || o === b) continue;
    if (o.isRed) continue;
    const dx = o.x - b.x; const dy = o.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < radius && d < bestDist) {
      bestDist = d; best = o;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

// periodically ensure one red fish per detected flock (cluster)
function promoteRandomRedPerCluster() {
  // Deprecated: kept for compatibility but not used.
  // Use promoteIfNoRedInFrame() instead to ensure only one on-screen red exists.
}

// Promote a random fish to red in one random cluster, only if there is no red fish currently
// visible inside the viewport. When promoted, the fish will wander randomly for a bit,
// then leave the flock at a random time.
function promoteIfNoRedInFrame() {
  // check if any red boid is currently inside the visible viewport
  const anyOnScreenRed = boids.some(b => b && b.isRed && b.x >= 0 && b.x <= width && b.y >= 0 && b.y <= height);
  if (anyOnScreenRed) return;

  const clusters = getClusters(4);
  if (clusters.length === 0) return;
  // choose a random cluster
  const cluster = clusters[Math.floor(Math.random() * clusters.length)];
  // pick a random member that is not currently red
  const candidates = cluster.map(i => boids[i]).filter(b => b && !b.isRed);
  if (candidates.length === 0) return;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  // promote
  chosen.isRed = true;
  chosen.leftFlock = false;
  chosen.el.classList.add('red');
  chosen.el.style.color = '#d44';
  // schedule a random leave time (2-8s)
  chosen.leaveTime = Date.now() + 2000 + Math.random() * 6000;
  // small jitter while waiting
  chosen.waitingToLeave = true;
}

