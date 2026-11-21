(() => {
  const canvas = document.getElementById("physics-canvas");
  const ctx = canvas.getContext("2d");
  const feedback = document.getElementById("feedback");
  const controls = document.getElementById("object-controls");
  const wasteImage = new Image();
  wasteImage.src = "assets/waste-v2.webp";
  const moreWasteImage = new Image();
  moreWasteImage.src = "assets/waste-v3.webp";
  const extraWasteImage = new Image();
  extraWasteImage.src = "assets/waste-v4.webp";
  const binsImage = new Image();
  binsImage.src = "assets/bins-v3.webp";
  const binButtons = [...document.querySelectorAll("[data-bin]")];
  const floorInsetProbe = document.getElementById("floor-inset") || controls;

  const specs = [
    { type: "bottle", kind: "plastic", label: "ПЭТ-бутылка", x: .19, y: .55, angle: -.36 },
    { type: "pump", kind: "plastic", label: "Флакон", x: .34, y: .38, angle: .22 },
    { type: "box", kind: "paper", label: "Коробка", x: .13, y: .70, angle: -.25 },
    { type: "newspaper", kind: "paper", label: "Газета", x: .54, y: .32, angle: .18 },
    { type: "jar", kind: "glass", label: "Банка", x: .88, y: .66, angle: .22 },
    { type: "glassBottle", kind: "glass", label: "Бутылка", x: .10, y: .35, angle: -.2 },
    { type: "cup", kind: "plastic", label: "Пластиковый стаканчик", angle: .15 },
    { type: "tray", kind: "plastic", label: "Пластиковый контейнер", angle: -.15 },
    { type: "carton", kind: "paper", label: "Картонная коробка", angle: .12 },
    { type: "paperBall", kind: "paper", label: "Мятая бумага", angle: -.2 },
    { type: "clearBottle", kind: "glass", label: "Стеклянная бутылка", angle: .2 },
    { type: "greenJar", kind: "glass", label: "Стеклянная банка", angle: -.1 },
    { type: "plasticBag", kind: "plastic", label: "Пластиковый пакет", angle: -.18 },
    { type: "plasticFlask", kind: "plastic", label: "Пластиковый флакон", angle: .12 },
    { type: "cardboardRoll", kind: "paper", label: "Картонный рулон", angle: .35 },
    { type: "paperBag", kind: "paper", label: "Бумажный пакет", angle: -.12 },
    { type: "brownBottle", kind: "glass", label: "Стеклянная бутылка", angle: .28 },
    { type: "clearJar", kind: "glass", label: "Стеклянная банка", angle: -.15 },
  ];

  const palette = {
    plastic: { main: "#68c8fa", shade: "#177dbe", highlight: "#eefbff" },
    paper: { main: "#f8c54e", shade: "#b97d25", highlight: "#fff6cb" },
    glass: { main: "#7ed5a5", shade: "#1c9165", highlight: "#eafff2" }
  };

  const binTheme = {
    plastic: { label: "ПЛАСТИК", detail: "бутылки, флаконы", main: "#168edf", dark: "#0a64a9", light: "#48b9f4" },
    paper: { label: "БУМАГА", detail: "картон, листы", main: "#f6b91f", dark: "#ba770b", light: "#ffdb62" },
    glass: { label: "СТЕКЛО", detail: "банки, бутылки", main: "#24ad61", dark: "#147a42", light: "#6bd88f" }
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let floorY = 0;
  let bins = [];
  let bodies = [];
  let particles = [];
  let active = null;
  let selected = null;
  let hoverBody = null;
  let lastFrame = 0;
  let lastTime = performance.now();
  let initialized = false;
  let frameId = null;
  let physicsAwake = true;
  let sampleTime = 0;
  let quietSamples = 0;
  let binsNeedLayout = false;

  function requestDraw() {
    if (frameId === null && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function wakePhysics() {
    physicsAwake = true;
    sampleTime = 0;
    quietSamples = 0;
    requestDraw();
  }

  function roundedRect(context, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setFeedback(text) {
    feedback.textContent = text;
  }

  function layoutBins() {
    binsNeedLayout = false;
    bins = binButtons.map(el => {
      const r = el.getBoundingClientRect();
      const previous = bins.find(bin => bin.kind === el.dataset.bin);
      return { kind: el.dataset.bin, x: r.left, y: r.top,
        w: r.width, h: r.height, shake: previous?.shake || 0, glow: previous?.glow || 0 };
    });
    bins.forEach((bin) => {
      bin.openingLeft = bin.x + bin.w * .20;
      bin.openingRight = bin.x + bin.w * .80;
    });
  }

  function makeBody(spec, index) {
    const radiusByType = {
      bottle: 25,
      pump: 25,
      cup: 23,
      box: 28,
      newspaper: 28,
      sheet: 25,
      jar: 25,
      glassBottle: 24,
      honeyJar: 25,
      plasticBag: 25,
      plasticFlask: 24,
      cardboardRoll: 24,
      paperBag: 26,
      brownBottle: 24,
      clearJar: 24
    };
    const r = (radiusByType[spec.type] || 25) * clamp(width / 980, .76, 1.16);
    return {
      ...spec,
      r,
      x: width * (.12 + ((index * .145 + Math.random() * .08) % .76)),
      y: -r * 2 - (index % 4) * 48,
      vx: (index % 3 - 1) * 18,
      vy: 0,
      angle: spec.angle,
      spin: (index % 2 ? 1 : -1) * .48,
      dragging: false,
      cooldown: 0,
      sortUntil: 0,
      entering: true
    };
  }

  function resetGame(add = false) {
    layoutBins();
    if (!add) {
      selected = null;
      hoverBody = null;
      particles = [];
      bodies = [];
      controls.replaceChildren();
    }
    const compact = width <= 600;
    const perKind = (compact ? 2 : 3) - (add ? 1 : 0);
    const selectedSpecs = ["plastic", "paper", "glass"].flatMap(kind => {
      const candidates = specs.filter(spec => spec.kind === kind);
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      return candidates.slice(0, perKind);
    });
    const added = selectedSpecs.map(makeBody);
    bodies.push(...added);
    added.forEach(body => {
      const handle = document.createElement("button");
      handle.className = "object-handle";
      handle.style.width = handle.style.height = body.r * 2.9 + "px";
      handle.type = "button";
      handle.setAttribute("aria-label", body.label + ", выбрать предмет");
      handle.setAttribute("aria-pressed", "false");
      body.handle = handle;
      handle.addEventListener("pointerdown", startDrag);
      handle.addEventListener("pointermove", moveDrag);
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", cancelDrag);
      handle.addEventListener("lostpointercapture", cancelDrag);
      handle.addEventListener("pointerleave", () => {
        if (!active && hoverBody === body) { hoverBody = null; requestDraw(); }
      });
      handle.addEventListener("click", event => {
        if (event.detail === 0 && !event.pointerType) {
          toggleSelected(body);
          if (selected) binButtons[0]?.focus();
        }
      });
      controls.append(handle);
    });
    setFeedback(add ? "Лови! Сверху падает новая упаковка." : "");
    wakePhysics();
  }

  function toggleSelected(body) {
    const previous = selected;
    selected = selected === body ? null : body;
    previous?.handle.setAttribute("aria-pressed", "false");
    selected?.handle.setAttribute("aria-pressed", "true");
    setFeedback(selected ? body.label + ". В какой бак?" : "");
    requestDraw();
  }

  function clearSelection() {
    selected?.handle.setAttribute("aria-pressed", "false");
    selected = null;
  }

  function resizeCanvas() {
    const oldWidth = width;
    const oldHeight = height;
    const oldFloorY = floorY;
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    canvas.style.height = height + "px";
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const insetStyle = getComputedStyle(floorInsetProbe);
    const inset = parseFloat(insetStyle.paddingBottom) || parseFloat(insetStyle.marginBottom) ||
      parseFloat(insetStyle.getPropertyValue("--floor-inset")) || 16;
    floorY = height - inset;
    layoutBins();

    if (!initialized) {
      initialized = true;
      resetGame();
      return;
    }

    const sx = oldWidth ? width / oldWidth : 1;
    const sy = oldHeight ? height / oldHeight : 1;
    bodies.forEach((body) => {
      body.x *= sx;
      const support = supportRadius(body);
      body.y = Math.abs(body.y + support - oldFloorY) < 3 ? floorY - support : body.y * sy;
      body.x = clamp(body.x, body.r + 8, width - body.r - 8);
      if (!body.entering) body.y = clamp(body.y, body.r + 8, floorY - support);
    });
    wakePhysics();
  }

  function createParticle(x, y, color, power = 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (80 + Math.random() * 180) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      size: 3 + Math.random() * 5,
      color,
      life: .62 + Math.random() * .28,
      maxLife: .8
    });
  }

  function burst(x, y, colors, power = 1) {
    for (let i = 0; i < 20; i += 1) createParticle(x, y, colors[i % colors.length], power);
  }

  function collideFloor(body) {
    const support = supportRadius(body);
    if (body.y + support > floorY) {
      body.y = floorY - support;
      body.vy = Math.abs(body.vy) < 65 ? 0 : -Math.abs(body.vy) * .22;
      body.vx *= .78;
      body.spin *= .8;
      if (Math.abs(body.vx) < 3) body.vx = 0;
      if (Math.abs(body.spin) < .08) body.spin = 0;
    }

    if (body.x - body.r < 8) {
      body.x = body.r + 8;
      body.vx = Math.abs(body.vx) * .42;
    } else if (body.x + body.r > width - 8) {
      body.x = width - body.r - 8;
      body.vx = -Math.abs(body.vx) * .42;
    }

    if (body.y - body.r >= 8) body.entering = false;
    if (!body.entering && body.y - body.r < 8) {
      body.y = body.r + 8;
      body.vy = Math.abs(body.vy) * .35;
    }
  }

  function circleRect(body, x, y, w, h) {
    const cx = clamp(body.x, x, x + w);
    const cy = clamp(body.y, y, y + h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    return { hit: dx * dx + dy * dy < body.r * body.r, dx, dy, cx, cy };
  }

  function ejected(body, bin, time) {
    body.cooldown = time + 600;
    body.sortUntil = 0;
    body.x = clamp(body.x, bin.openingLeft + body.r, bin.openingRight - body.r);
    body.y = bin.y - body.r - 1;
    body.vy = -Math.max(540, Math.abs(body.vy) + 440);
    body.vx += (body.x < bin.x + bin.w / 2 ? -1 : 1) * (190 + Math.random() * 120);
    body.spin += (Math.random() - .5) * 5;
    bin.shake = 1;
    burst(bin.x + bin.w / 2, bin.y + 12, ["#fff1ea", "#ff765e", "#f6bd2c"], .55);
    setFeedback("Ой, обратно! Поищи бак с надписью «" + binTheme[body.kind].label.toLowerCase() + "».");
  }

  function absorb(body, bin) {
    const itemName = body.label;
    body.handle.remove();
    if (selected === body) clearSelection();
    if (hoverBody === body) hoverBody = null;
    bin.glow = 1;
    burst(bin.x + bin.w / 2, bin.y + 18, [binTheme[bin.kind].light, "#ffffff", "#9edc75"], 1);
    bodies = bodies.filter((current) => current !== body);
    setFeedback(bodies.length ? "В точку! " + itemName + " отправляется на переработку." :
      "Всё по местам! Хочешь ещё? Нажми «Накинуть мусора».");
  }

  function resolveBinInteraction(body, bin, time, force = false) {
    if (!force && body.cooldown > time) return false;
    if (!force && body.sortUntil < time) return false;
    const opening = body.x > bin.openingLeft && body.x < bin.openingRight;
    const withinMouth = body.y + body.r > bin.y - 6 && body.y - body.r < bin.y + 34;
    if (!force && (!opening || !withinMouth)) return false;

    if (body.kind === bin.kind) {
      absorb(body, bin);
    } else {
      ejected(body, bin, time);
    }
    return true;
  }

  function collideBins(body, time) {
    for (const bin of bins) {
      if (resolveBinInteraction(body, bin, time)) return true;
      const collision = circleRect(body, bin.x, bin.y + 18, bin.w, bin.h - 18);
      if (!collision.hit) continue;

      const fromTop = body.y < bin.y + 27 && Math.abs(collision.dy) >= Math.abs(collision.dx);
      if (fromTop) {
        body.y = bin.y - body.r;
        body.vy = -Math.abs(body.vy) * .34;
        body.vx *= .86;
      } else if (Math.abs(collision.dx) > Math.abs(collision.dy)) {
        body.x = collision.cx + Math.sign(collision.dx || 1) * body.r;
        body.vx *= -.42;
      } else {
        body.y = collision.cy + Math.sign(collision.dy || -1) * body.r;
        body.vy *= -.32;
      }
    }
    return false;
  }

  function collideBodies(a, b) {
    if (a.dragging && b.dragging) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || .001;
    const minDistance = a.r + b.r;
    if (distance >= minDistance) return;

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;
    const aStatic = a.dragging ? 1 : 0;
    const bStatic = b.dragging ? 1 : 0;
    const movable = Math.max(1, 2 - aStatic - bStatic);
    if (!aStatic) {
      a.x -= nx * overlap / movable;
      a.y -= ny * overlap / movable;
    }
    if (!bStatic) {
      b.x += nx * overlap / movable;
      b.y += ny * overlap / movable;
    }

    const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeVelocity > 0) return;
    const impact = relativeVelocity < -65;
    const impulse = -(impact ? 1.18 : 1) * relativeVelocity / movable;
    if (!aStatic) {
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      if (impact) a.spin -= impulse * .004;
      else a.spin *= .89;
    }
    if (!bStatic) {
      b.vx += impulse * nx;
      b.vy += impulse * ny;
      if (impact) b.spin += impulse * .004;
      else b.spin *= .89;
    }
  }

  function updatePhysics(dt, time) {
    for (const body of bodies) {
      if (!body.dragging) {
        body.vy += 1130 * dt;
        body.vx *= .998;
        body.vy *= .998;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.spin * dt;
        body.spin *= .993;
        if (body.sortUntil > time && collideBins(body, time)) continue;
        collideFloor(body);
      }
    }

    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) collideBodies(bodies[i], bodies[j]);
    }

  }

  function updateEffects(dt) {
    particles = particles.filter((particle) => {
      particle.life -= dt;
      particle.vy += 390 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      return particle.life > 0;
    });

    bins.forEach((bin) => {
      bin.shake = Math.max(0, bin.shake - dt * 2.8);
      bin.glow = Math.max(0, bin.glow - dt * 1.5);
    });
  }

  function supportRadius(body) {
    const tall = ["bottle", "glassBottle", "pump", "cup", "newspaper", "sheet",
      "plasticFlask", "cardboardRoll", "paperBag", "brownBottle", "clearJar"].includes(body.type);
    const halfW = body.r * (tall ? .67 : 1.02);
    const halfH = body.r * (tall ? 1.20 : 1.1);
    return Math.abs(Math.sin(body.angle)) * halfW + Math.abs(Math.cos(body.angle)) * halfH;
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#b9e9ff");
    sky.addColorStop(.58, "#e8faff");
    sky.addColorStop(.585, "#d6f0cf");
    sky.addColorStop(1, "#a8da8d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sun = ctx.createRadialGradient(width * .78, height * .17, 0, width * .78, height * .17, 105);
    sun.addColorStop(0, "#fffdd7");
    sun.addColorStop(.32, "#fff8b885");
    sun.addColorStop(1, "#fff6aa00");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    drawCloud(width * .32, height * .19, 1);
    drawCloud(width * .82, height * .29, .72);
    drawSkyline(0, height * .56, width * .20, height * .16, "#8bcde3a0");
    drawSkyline(width * .83, height * .52, width * .22, height * .20, "#8bcde3a0");

    ctx.fillStyle = "#82cd6d88";
    ctx.beginPath();
    ctx.arc(width * .31, height * 1.12, height * .50, Math.PI, Math.PI * 2);
    ctx.arc(width * .71, height * 1.18, height * .52, Math.PI, Math.PI * 2);
    ctx.fill();

    const road = ctx.createLinearGradient(0, height * .72, 0, height);
    road.addColorStop(0, "#ffffffbd");
    road.addColorStop(1, "#e9f6e9c8");
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.ellipse(width * .57, height * .91, width * .34, height * .36, -.16, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffffa8";
    ctx.beginPath();
    ctx.arc(-19, 8, 20, 0, Math.PI * 2);
    ctx.arc(5, -2, 28, 0, Math.PI * 2);
    ctx.arc(35, 9, 19, 0, Math.PI * 2);
    ctx.roundRect(-43, 8, 98, 24, 12);
    ctx.fill();
    ctx.restore();
  }

  function drawSkyline(x, y, w, h, color) {
    ctx.save();
    ctx.fillStyle = color;
    const pieces = [ .3, .62, .41, .83, .5, .72, .28 ];
    const unit = w / pieces.length;
    pieces.forEach((size, index) => {
      const bh = h * size;
      ctx.fillRect(x + index * unit, y + h - bh, unit - 3, bh);
      ctx.fillStyle = "#e4f8ff8a";
      for (let win = 0; win < 3; win += 1) ctx.fillRect(x + index * unit + 6, y + h - bh + 10 + win * 13, 3, 5);
      ctx.fillStyle = color;
    });
    ctx.restore();
  }

  function drawBin(bin) {
    const theme = binTheme[bin.kind];
    const jitter = Math.sin(lastTime * .05 + bin.x) * 4 * bin.shake;
    const x = bin.x + jitter;
    const y = bin.y;
    if (binsImage.complete && binsImage.naturalWidth) {
      const index = {plastic: 0, paper: 1, glass: 2}[bin.kind];
      ctx.save();
      // Trim the transparent gutters so the visual bin and its touch target coincide.
      const sourceX = index * 724 + [75, 81, 88][index];
      ctx.drawImage(binsImage, sourceX, 8, 560, 707, x, y, bin.w, bin.h);
      ctx.restore();
      if (bin.shake > .12) {
        ctx.save(); ctx.globalAlpha = bin.shake; ctx.textAlign = "center";
        ctx.font = "bold 15px Arial"; ctx.fillStyle = "#073f5f";
        ctx.fillText("НЕ МОЁ!", x + bin.w / 2, y - 8); ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.translate(x, y);

    if (bin.glow > 0) {
      ctx.shadowColor = "#92e550";
      ctx.shadowBlur = 26 * bin.glow;
    } else {
      ctx.shadowColor = "#16516d36";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 10;
    }

    const bodyGradient = ctx.createLinearGradient(0, 0, bin.w, 0);
    bodyGradient.addColorStop(0, theme.dark);
    bodyGradient.addColorStop(.18, theme.main);
    bodyGradient.addColorStop(.72, theme.main);
    bodyGradient.addColorStop(1, theme.dark);
    roundedRect(ctx, bin.w * .04, 22, bin.w * .92, bin.h - 22, 13);
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = "#0a3f5a4a";
    roundedRect(ctx, bin.w * .04, bin.h - 17, bin.w * .92, 17, 10);
    ctx.fill();

    const lidGradient = ctx.createLinearGradient(0, 0, 0, 35);
    lidGradient.addColorStop(0, "#ffffff95");
    lidGradient.addColorStop(.26, theme.light);
    lidGradient.addColorStop(.55, theme.main);
    lidGradient.addColorStop(1, theme.dark);
    roundedRect(ctx, -bin.w * .035, 0, bin.w * 1.07, 33, 12);
    ctx.fillStyle = lidGradient;
    ctx.fill();

    roundedRect(ctx, bin.w * .19, 9, bin.w * .62, 9, 8);
    ctx.fillStyle = "#073f5fe0";
    ctx.fill();
    ctx.fillStyle = "#00000032";
    roundedRect(ctx, bin.w * .22, 11, bin.w * .56, 4, 4);
    ctx.fill();

    ctx.strokeStyle = "#ffffff8c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bin.w * .50, bin.h - 47, bin.w * .35, 11, -.17, Math.PI, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bin.w / 2, 78, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "500 42px Arial";
    ctx.fillText("↻", bin.w / 2, 77);

    ctx.font = "900 " + clamp(bin.w * .12, 12, 18) + "px Arial";
    ctx.fillText(theme.label, bin.w / 2, 119);
    ctx.font = "700 " + clamp(bin.w * .077, 9, 12) + "px Arial";
    const detail = theme.detail.split(", ");
    ctx.fillText(detail[0], bin.w / 2, 139);
    ctx.fillText(detail[1], bin.w / 2, 154);

    ctx.fillStyle = "#ffffffd9";
    ctx.font = "800 10px Arial";
    ctx.restore();

    if (bin.shake > .12) {
      ctx.save();
      ctx.globalAlpha = bin.shake;
      ctx.fillStyle = "#fff";
      ctx.font = "900 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("НЕ МОЁ!", x + bin.w / 2, y - 13);
      ctx.restore();
    }
  }

  function drawBody(body) {
    const colors = palette[body.kind];
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.shadowColor = "#124e6c42";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 7;
    drawObjectShape(body.type, body.r, colors);
    ctx.restore();

    if (!body.dragging && selected !== body && hoverBody !== body) return;

    ctx.save();
    ctx.globalAlpha = body.dragging || selected === body ? 1 : .88;
    let labelY = body.y + body.r + 10;
    if (labelY + 19 > floorY - 2) labelY = body.y - body.r - 29;
    ctx.font = "800 10px Arial";
    const labelW = ctx.measureText(body.label).width + 17;
    const labelX = clamp(body.x, labelW / 2 + 4, width - labelW / 2 - 4);
    roundedRect(ctx, labelX - labelW / 2, labelY, labelW, 19, 9);
    ctx.fillStyle = "#ffffffde";
    ctx.fill();
    ctx.strokeStyle = selected === body ? "#71bd32" : "#d0e7ed";
    ctx.lineWidth = selected === body ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = "#22536d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(body.label, labelX, labelY + 10);
    ctx.restore();
  }

  function drawObjectShape(type, r, colors) {
    const extraIndex = {plasticBag: 0, plasticFlask: 1, cardboardRoll: 2, paperBag: 3, brownBottle: 4, clearJar: 5}[type];
    if (extraIndex !== undefined && extraWasteImage.complete && extraWasteImage.naturalWidth) {
      const cellWidth = extraWasteImage.naturalWidth / 3;
      const cellHeight = extraWasteImage.naturalHeight / 2;
      const col = extraIndex % 3, row = Math.floor(extraIndex / 3);
      ctx.drawImage(extraWasteImage, col * cellWidth, row * cellHeight, cellWidth, cellHeight, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
      return;
    }
    const moreIndex = {cup: 0, tray: 1, carton: 2, paperBall: 3, clearBottle: 4, greenJar: 5}[type];
    if (moreIndex !== undefined && moreWasteImage.complete && moreWasteImage.naturalWidth) {
      const col = moreIndex % 3, row = Math.floor(moreIndex / 3);
      ctx.drawImage(moreWasteImage, col * 512, row * 512, 512, 512, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
      return;
    }
    const spriteIndex = {bottle: 0, pump: 1, box: 2, newspaper: 3, glassBottle: 4, jar: 5}[type];
    if (spriteIndex !== undefined && wasteImage.complete && wasteImage.naturalWidth) {
      const col = spriteIndex % 3, row = Math.floor(spriteIndex / 3);
      ctx.drawImage(wasteImage, col * 512, row * 512, 512, 512, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
      return;
    }
    const scale = r / 26;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#144b68";

    const fill = () => {
      const gradient = ctx.createLinearGradient(-30, -30, 28, 35);
      gradient.addColorStop(0, colors.highlight);
      gradient.addColorStop(.25, colors.main);
      gradient.addColorStop(1, colors.shade);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.stroke();
    };

    if (type === "bottle" || type === "glassBottle") {
      ctx.beginPath();
      ctx.moveTo(-9, -28);
      ctx.lineTo(9, -28);
      ctx.lineTo(9, -13);
      ctx.lineTo(16, -4);
      ctx.lineTo(16, 25);
      ctx.quadraticCurveTo(16, 31, 10, 31);
      ctx.lineTo(-10, 31);
      ctx.quadraticCurveTo(-16, 31, -16, 25);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-9, -13);
      ctx.closePath();
      fill();
      ctx.fillStyle = "#fff8";
      ctx.fillRect(-11, -1, 7, 22);
      ctx.beginPath();
      ctx.moveTo(-15, 8);
      ctx.lineTo(15, 8);
      ctx.moveTo(-15, 18);
      ctx.lineTo(15, 18);
      ctx.stroke();
    } else if (type === "pump") {
      ctx.beginPath();
      ctx.roundRect(-15, -18, 30, 49, 7);
      fill();
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(0, -18);
      ctx.lineTo(22, -30);
      ctx.lineTo(22, -24);
      ctx.lineTo(5, -17);
      ctx.stroke();
      ctx.fillStyle = "#fff8";
      ctx.fillRect(-10, -7, 7, 25);
    } else if (type === "cup") {
      ctx.beginPath();
      ctx.moveTo(-21, -25);
      ctx.lineTo(21, -25);
      ctx.lineTo(15, 29);
      ctx.quadraticCurveTo(0, 36, -15, 29);
      ctx.closePath();
      fill();
      ctx.fillStyle = "#fff8";
      ctx.fillRect(-14, -16, 7, 30);
      ctx.beginPath();
      ctx.moveTo(-18, -3);
      ctx.lineTo(18, -3);
      ctx.stroke();
    } else if (type === "box") {
      ctx.beginPath();
      ctx.moveTo(-28, -15);
      ctx.lineTo(0, -29);
      ctx.lineTo(28, -14);
      ctx.lineTo(0, 1);
      ctx.closePath();
      fill();
      ctx.beginPath();
      ctx.moveTo(-28, -15);
      ctx.lineTo(0, 1);
      ctx.lineTo(0, 30);
      ctx.lineTo(-28, 14);
      ctx.closePath();
      fill();
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(28, -14);
      ctx.lineTo(28, 15);
      ctx.lineTo(0, 30);
      ctx.closePath();
      fill();
    } else if (type === "newspaper") {
      ctx.beginPath();
      ctx.roundRect(-25, -29, 50, 58, 4);
      fill();
      ctx.fillStyle = "#fff8";
      ctx.fillRect(-18, -19, 18, 18);
      ctx.strokeStyle = colors.shade;
      ctx.beginPath();
      [7, 15, 23].forEach((line) => {
        ctx.moveTo(5, -22 + line);
        ctx.lineTo(18, -22 + line);
      });
      [-7, 3, 13].forEach((line) => {
        ctx.moveTo(-18, line);
        ctx.lineTo(18, line);
      });
      ctx.stroke();
    } else if (type === "sheet") {
      ctx.beginPath();
      ctx.moveTo(-20, -30);
      ctx.lineTo(10, -30);
      ctx.lineTo(24, -16);
      ctx.lineTo(24, 30);
      ctx.lineTo(-20, 30);
      ctx.closePath();
      fill();
      ctx.beginPath();
      ctx.moveTo(10, -30);
      ctx.lineTo(10, -16);
      ctx.lineTo(24, -16);
      ctx.stroke();
      ctx.strokeStyle = colors.shade;
      ctx.beginPath();
      [-2, 8, 18].forEach((line) => {
        ctx.moveTo(-12, line);
        ctx.lineTo(14, line);
      });
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(-23, -20, 46, 48, 10);
      fill();
      ctx.fillStyle = "#ffffff82";
      ctx.fillRect(-16, -12, 7, 28);
      ctx.beginPath();
      ctx.moveTo(-21, -20);
      ctx.lineTo(21, -20);
      ctx.stroke();
      if (type === "jar" || type === "honeyJar") {
        ctx.fillStyle = colors.shade;
        ctx.fillRect(-18, -30, 36, 9);
        ctx.fillStyle = "#fff6";
        ctx.fillRect(-13, -28, 26, 2);
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      const opacity = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = particle.color;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.life * 9);
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    bins.forEach(drawBin);
    bodies.filter((body) => body !== active?.body).forEach(drawBody);
    if (active?.body) drawBody(active.body);
    drawParticles();
    bodies.forEach(body => {
      if (body.drawnX === body.x && body.drawnY === body.y) return;
      const half = body.r * 1.45;
      body.handle.style.transform = "translate(" + (body.x - half) + "px," + (body.y - half) + "px)";
      body.drawnX = body.x;
      body.drawnY = body.y;
    });
  }

  function frame(time) {
    frameId = null;
    const dt = Math.min(.04, Math.max(0, lastFrame ? (time - lastFrame) / 1000 : .016));
    lastFrame = time;
    lastTime = time;
    if (binsNeedLayout) layoutBins();
    if (physicsAwake) {
      const steps = Math.ceil(dt / .008);
      for (let step = 0; step < steps; step++) updatePhysics(dt / steps, time);
      sampleTime += dt;
      if (sampleTime >= .28) {
        // Ignore brief subpixel corrections as stacked objects settle against one another.
        let settled = true;
        for (const body of bodies) {
          const movement = Math.hypot(body.x - body.sampleX, body.y - body.sampleY) +
            body.r * Math.abs(body.angle - body.sampleAngle);
          if (!body.dragging && !(movement < 1)) settled = false;
          body.sampleX = body.x;
          body.sampleY = body.y;
          body.sampleAngle = body.angle;
        }
        quietSamples = settled ? quietSamples + 1 : 0;
        sampleTime = 0;
      }
      if (!bodies.length || quietSamples >= 2) {
        physicsAwake = false;
        for (const body of bodies) {
          if (!body.dragging) body.vx = body.vy = body.spin = 0;
        }
      }
    }
    updateEffects(dt);
    draw();
    if (physicsAwake || particles.length || bins.some(bin => bin.shake || bin.glow)) requestDraw();
    else lastFrame = 0;
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * width / rect.width,
      y: (event.clientY - rect.top) * height / rect.height
    };
  }

  function findBody(point) {
    return [...bodies].reverse().find((body) => Math.hypot(body.x - point.x, body.y - point.y) < body.r + 14);
  }

  function findBin(point) {
    return bins.find((bin) => point.x >= bin.x && point.x <= bin.x + bin.w && point.y >= bin.y - 14 && point.y <= bin.y + bin.h);
  }

  function startDrag(event) {
    if (active || event.button !== 0) return;
    const point = pointerPosition(event);
    const body = bodies.find(item => item.handle === event.currentTarget) || findBody(point);
    if (!body) return;

    active = {
      body,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      lastTime: performance.now(),
      moved: false
    };
    hoverBody = body;
    body.dragging = true;
    body.entering = false;
    body.sortUntil = 0;
    body.vx = 0;
    body.vy = 0;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("dragging");
    canvas.classList.add("is-dragging");
    wakePhysics();
  }

  function moveDrag(event) {
    if (!active || active.pointerId !== event.pointerId) {
      const point = pointerPosition(event);
      if (active) return;
      const next = findBody(point) || null;
      if (next !== hoverBody) requestDraw();
      hoverBody = next;
      canvas.style.cursor = hoverBody ? "grab" : "default";
      return;
    }

    const point = pointerPosition(event);
    const now = performance.now();
    const dx = point.x - active.startX;
    const dy = point.y - active.startY;
    active.moved = active.moved || Math.hypot(dx, dy) > 7;
    const body = active.body;
    const elapsed = Math.max(.016, (now - active.lastTime) / 1000);
    body.vx = clamp((point.x - active.lastX) / elapsed, -950, 950);
    body.vy = clamp((point.y - active.lastY) / elapsed, -950, 950);
    if (!active.moved) return;
    body.x = clamp(point.x, body.r + 8, width - body.r - 8);
    body.y = clamp(point.y, body.r + 8, floorY - body.r);
    body.angle += (point.x - active.lastX) * .012;
    active.lastX = point.x;
    active.lastY = point.y;
    active.lastTime = now;
    wakePhysics();
  }

  function endDrag(event) {
    if (!active || active.pointerId !== event.pointerId) return;
    const current = active;
    const point = pointerPosition(event);
    const body = current.body;
    active = null;
    body.dragging = false;
    document.body.classList.remove("dragging");
    if (current.target.hasPointerCapture(event.pointerId)) current.target.releasePointerCapture(event.pointerId);
    canvas.classList.remove("is-dragging");

    if (binsNeedLayout) layoutBins();
    const bin = findBin(point);
    if (current.moved) {
      if (performance.now() - current.lastTime > 100) body.vx = body.vy = 0;
      body.sortUntil = performance.now() + 1200;
      if (bin) resolveBinInteraction(body, bin, performance.now(), true);
      clearSelection();
    } else {
      toggleSelected(body);
    }
    hoverBody = null;
    wakePhysics();
  }

  function cancelDrag(event) {
    if (!active || (event?.pointerId != null && active.pointerId !== event.pointerId)) return;
    const { body, target, pointerId } = active;
    active = null;
    body.dragging = false;
    body.sortUntil = 0;
    body.vx = body.vy = 0;
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    hoverBody = null;
    document.body.classList.remove("dragging");
    canvas.classList.remove("is-dragging");
    wakePhysics();
  }

  binButtons.forEach(button => {
    button.addEventListener("click", event => {
      if (!selected) {
        setFeedback("Выбери предмет внизу, а затем нажми на бак.");
        if (event.detail === 0) bodies[0]?.handle.focus({preventScroll: true});
        return;
      }
      if (binsNeedLayout) layoutBins();
      resolveBinInteraction(selected, bins.find(bin => bin.kind === button.dataset.bin), performance.now(), true);
      clearSelection();
      if (event.detail === 0) (bodies[0]?.handle || document.getElementById("new-game")).focus({preventScroll: true});
      wakePhysics();
    });
  });
  document.getElementById("new-game").addEventListener("click", () => resetGame(true));
  document.getElementById("reset-game").addEventListener("click", () => {
    window.scrollTo({top: 0, behavior: "instant"});
    resetGame(true);
    document.getElementById("new-game").focus({preventScroll: true});
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("scroll", () => { binsNeedLayout = true; requestDraw(); }, {passive: true});
  window.addEventListener("blur", () => cancelDrag());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelDrag();
      cancelAnimationFrame(frameId);
      frameId = null;
      lastFrame = 0;
    } else {
      binsNeedLayout = true;
      requestDraw();
    }
  });
  [wasteImage, moreWasteImage, extraWasteImage, binsImage].forEach(image => image.addEventListener("load", requestDraw));
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => { binsNeedLayout = true; requestDraw(); });
    binButtons.forEach(button => observer.observe(button));
  }
  document.fonts?.ready.then(() => { binsNeedLayout = true; requestDraw(); });

  resizeCanvas();
})();
