(() => {
  const canvas = document.getElementById("physics-canvas");
  const ctx = canvas.getContext("2d");
  const scene = document.querySelector(".hero");
  const touchScene = matchMedia("(pointer: coarse) and (max-width: 1050px)");
  const feedback = document.getElementById("feedback");
  const controls = document.getElementById("object-controls");
  const binButtons = [...document.querySelectorAll("[data-bin]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const floorInsetProbe = document.getElementById("floor-inset") || controls;

  // Entries follow the artwork in reading order: three columns by two rows.
  function loadWasteSheet(name, entries) {
    const image = new Image();
    image.src = "assets/" + name + ".webp";
    return entries.map((entry, cell) => ({ ...entry, image, cell }));
  }

  const specs = [
    ...loadWasteSheet("waste-v2", [
      { type: "bottle", kind: "plastic", label: "ПЭТ-бутылка", angle: -.36 },
      { type: "pump", kind: "plastic", label: "Флакон с дозатором", angle: .22 },
      { type: "box", kind: "paper", label: "Коробка", radius: 28, angle: -.25 },
      { type: "newspaper", kind: "paper", label: "Газета", radius: 28, angle: .18 },
      { type: "glassBottle", kind: "glass", label: "Зелёная стеклянная бутылка", radius: 24, angle: -.2 },
      { type: "jar", kind: "glass", label: "Банка", angle: .22 }
    ]),
    ...loadWasteSheet("waste-v3", [
      { type: "cup", kind: "plastic", label: "Пластиковый стаканчик", radius: 23, angle: .15 },
      { type: "tray", kind: "plastic", label: "Пластиковый контейнер", angle: -.15 },
      { type: "carton", kind: "paper", label: "Картонная коробка", angle: .12 },
      { type: "paperBall", kind: "paper", label: "Мятая бумага", angle: -.2 },
      { type: "clearBottle", kind: "glass", label: "Прозрачная бутылка", angle: .2 },
      { type: "greenJar", kind: "glass", label: "Зелёная банка", angle: -.1 }
    ]),
    ...loadWasteSheet("waste-v4", [
      { type: "plasticBag", kind: "plastic", label: "Пластиковый пакет", angle: -.18 },
      { type: "plasticFlask", kind: "plastic", label: "Пластиковый флакон", radius: 24, angle: .12 },
      { type: "cardboardRoll", kind: "paper", label: "Картонный рулон", radius: 24, angle: .35 },
      { type: "paperBag", kind: "paper", label: "Бумажный пакет", radius: 26, angle: -.12 },
      { type: "brownBottle", kind: "glass", label: "Коричневая бутылка", radius: 24, angle: .28 },
      { type: "clearJar", kind: "glass", label: "Прозрачная банка", radius: 24, angle: -.15 }
    ]),
    ...loadWasteSheet("waste-plastic", [
      { type: "bottleCap", kind: "plastic", label: "Крышка от бутылки", radius: 20, angle: .12 },
      { type: "jerrycan", kind: "plastic", label: "Пластиковая канистра", radius: 29, angle: -.19 },
      { type: "plantPot", kind: "plastic", label: "Пластиковый горшок", angle: .22 },
      { type: "berryBasket", kind: "plastic", label: "Корзинка для ягод", angle: -.16 },
      { type: "creamTub", kind: "plastic", label: "Пластиковая баночка от крема", radius: 22, angle: .11 },
      { type: "produceCrate", kind: "plastic", label: "Овощной ящик", radius: 29, angle: -.15 }
    ]),
    ...loadWasteSheet("waste-paper", [
      { type: "eggCarton", kind: "paper", label: "Картонный лоток для яиц", radius: 28, angle: -.18 },
      { type: "envelope", kind: "paper", label: "Бумажный конверт", angle: .16 },
      { type: "notebook", kind: "paper", label: "Тетрадь", radius: 26, angle: -.21 },
      { type: "cupSleeve", kind: "paper", label: "Картонная манжета от стакана", radius: 23, angle: .12 },
      { type: "cerealBox", kind: "paper", label: "Коробка от хлопьев", radius: 28, angle: -.14 },
      { type: "calendarPage", kind: "paper", label: "Лист календаря", radius: 22, angle: .18 }
    ]),
    ...loadWasteSheet("waste-glass", [
      { type: "oilBottle", kind: "glass", label: "Бутылка от оливкового масла", angle: -.24 },
      { type: "milkBottle", kind: "glass", label: "Молочная бутылка", radius: 26, angle: .19 },
      { type: "cosmeticBottle", kind: "glass", label: "Стеклянный флакон", radius: 22, angle: -.14 },
      { type: "demijohn", kind: "glass", label: "Винная бутыль", radius: 28, angle: .21 },
      { type: "honeyPot", kind: "glass", label: "Банка из-под мёда", radius: 24, angle: -.18 },
      { type: "spiceJar", kind: "glass", label: "Баночка для специй", radius: 22, angle: .13 }
    ])
  ];
  const spriteSizeInRadii = 3.2;
  // Convex outlines measured from the sprite alpha, in pixels around each 256px cell center.
  const contactOutlines = {
    bottle: [[78, -108], [85, -100], [79, -29], [45, 58], [-8, 117], [-39, 116], [-74, 103], [-87, 88], [-84, 45], [-32, -53], [42, -121]],
    pump: [[29, -120], [43, -55], [36, 101], [25, 110], [-30, 112], [-44, 98], [-54, 34], [-54, -34], [-44, -84], [-30, -119]],
    box: [[-61, -84], [69, -79], [117, -59], [121, -25], [111, 31], [69, 89], [-128, 59], [-122, 6]],
    newspaper: [[121, -32], [22, 85], [7, 86], [-103, 47], [-120, 25], [-112, 3], [31, -79], [101, -62]],
    glassBottle: [[4, -125], [15, -121], [36, -25], [37, 105], [26, 118], [-30, 117], [-37, 105], [-37, -23], [-16, -122]],
    jar: [[39, -101], [59, -46], [55, 78], [41, 93], [18, 100], [-54, 95], [-74, 68], [-75, -49], [-61, -97], [-27, -106]],
    cup: [[38, -93], [81, -63], [95, -41], [46, 83], [11, 98], [-31, 95], [-53, 76], [-90, -61], [3, -91]],
    tray: [[116, -25], [120, 21], [86, 78], [-7, 98], [-36, 94], [-95, 61], [-124, -3], [-119, -23], [-89, -57], [34, -93], [63, -87]],
    carton: [[-21, -120], [62, -104], [87, -45], [85, 82], [5, 118], [-64, 87], [-62, -37]],
    paperBall: [[-7, -103], [54, -82], [96, -24], [96, 30], [62, 92], [-34, 99], [-96, 32], [-98, -14], [-58, -70]],
    clearBottle: [[13, -128], [39, -31], [38, 100], [18, 115], [-32, 116], [-51, 109], [-57, 98], [-56, -35], [-35, -125]],
    greenJar: [[65, -101], [84, -43], [83, 61], [76, 85], [57, 101], [25, 108], [-26, 107], [-60, 96], [-76, 65], [-77, -28], [-61, -98], [-10, -108]],
    plasticBag: [[-48, -109], [-34, -114], [74, -100], [86, -86], [103, -37], [102, 56], [94, 94], [63, 108], [-69, 103], [-90, 95], [-100, 58], [-92, -7]],
    plasticFlask: [[20, -111], [62, -16], [62, 96], [17, 109], [-54, 104], [-66, 54], [-57, -22], [-22, -108]],
    cardboardRoll: [[93, -44], [103, -10], [85, 37], [-47, 81], [-91, 70], [-104, 18], [-90, -13], [62, -58], [79, -56]],
    paperBag: [[85, -108], [95, -83], [102, 95], [-31, 114], [-90, 100], [-87, 28], [-60, -97]],
    brownBottle: [[10, -124], [38, -25], [39, 106], [-10, 115], [-39, 107], [-39, -23], [-17, -121]],
    clearJar: [[41, -102], [63, -47], [64, 73], [53, 101], [20, 111], [-36, 110], [-62, 102], [-70, 79], [-71, -44], [-57, -97], [-13, -107]],
    bottleCap: [[76, -68], [101, 3], [95, 28], [78, 47], [41, 69], [-9, 82], [-50, 81], [-85, 63], [-102, -13], [-76, -51], [-33, -74], [7, -84], [46, -83]],
    jerrycan: [[49, -99], [65, -79], [77, -36], [69, 75], [-2, 96], [-58, 96], [-76, 75], [-79, -18], [-60, -95]],
    plantPot: [[87, -86], [96, -70], [54, 85], [7, 101], [-23, 100], [-56, 88], [-97, -65], [-91, -81], [-63, -94], [1, -102], [51, -98]],
    berryBasket: [[25, -87], [90, -40], [101, -23], [68, 55], [-21, 86], [-79, 31], [-102, -47], [-85, -60]],
    creamTub: [[89, -64], [101, -26], [99, 37], [77, 69], [29, 85], [-24, 86], [-69, 74], [-95, 52], [-101, -27], [-91, -60], [-77, -73], [-42, -85], [14, -89], [61, -81]],
    produceCrate: [[101, -48], [98, 19], [-20, 79], [-38, 77], [-100, 32], [-97, -45], [16, -81]],
    eggCarton: [[28, -101], [43, -90], [102, 37], [79, 66], [-30, 99], [-41, 94], [-78, 37], [-104, -52], [-81, -78]],
    envelope: [[65, -77], [102, 23], [-69, 77], [-104, -28]],
    notebook: [[36, -97], [102, 39], [101, 58], [-50, 95], [-104, -64], [-84, -74]],
    cupSleeve: [[101, -67], [75, 57], [46, 71], [-5, 81], [-53, 79], [-77, 67], [-103, -37], [-95, -54], [-47, -73], [12, -82], [69, -80]],
    cerealBox: [[63, -97], [87, -81], [60, 85], [-50, 103], [-71, 86], [-89, -74], [-60, -96], [28, -103]],
    calendarPage: [[52, -104], [93, 47], [37, 85], [-62, 102], [-95, -79]],
    oilBottle: [[8, -104], [28, -45], [26, 93], [-11, 103], [-30, 90], [-30, -45], [-14, -102]],
    milkBottle: [[12, -104], [30, -94], [51, -16], [52, 68], [36, 95], [-14, 102], [-41, 93], [-52, 77], [-53, -13], [-31, -95], [-13, -104]],
    cosmeticBottle: [[25, -100], [61, -47], [71, -17], [69, 90], [52, 98], [-55, 101], [-72, 65], [-71, -43], [-34, -98], [-12, -104]],
    demijohn: [[12, -101], [71, -10], [79, 31], [70, 62], [51, 85], [25, 99], [-13, 102], [-42, 93], [-64, 74], [-77, 49], [-80, 20], [-71, -11], [-14, -100]],
    honeyPot: [[44, -98], [57, -89], [85, -31], [82, 75], [42, 102], [-43, 102], [-85, 74], [-85, -34], [-46, -98], [-16, -104]],
    spiceJar: [[9, -104], [35, -92], [51, 65], [35, 94], [-12, 102], [-42, 89], [-52, 67], [-34, -93], [-23, -101]]
  };
  const remainingByKind = new Map();
  const previousByKind = new Map();
  const materialTickets = [];

  const palette = {
    plastic: { main: "#68c8fa", shade: "#177dbe", highlight: "#eefbff" },
    paper: { main: "#f8c54e", shade: "#b97d25", highlight: "#fff6cb" },
    glass: { main: "#7ed5a5", shade: "#1c9165", highlight: "#eafff2" }
  };

  const binTheme = {
    plastic: { label: "пластик", light: "#48b9f4" },
    paper: { label: "бумага", light: "#ffdb62" },
    glass: { label: "стекло", light: "#6bd88f" }
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
  let sceneViewport = null;
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
    const layer = canvas.getBoundingClientRect();
    bins = binButtons.map(el => {
      const r = el.getBoundingClientRect();
      return { kind: el.dataset.bin, button: el, x: r.left - layer.left,
        y: r.top - layer.top, w: r.width, h: r.height };
    });
    bins.forEach((bin) => {
      bin.openingLeft = bin.x + bin.w * .20;
      bin.openingRight = bin.x + bin.w * .80;
    });
  }

  function makeBody(spec, lane, dropHeight) {
    const r = (spec.radius || 25) * clamp(width / 980, .76, 1.16);
    const margin = r * 1.6 + 8;
    return {
      ...spec,
      r,
      x: margin + lane * (width - 2 * margin),
      y: -r * 2 - dropHeight,
      vx: (Math.random() - .5) * 72,
      vy: 0,
      angle: spec.angle + (Math.random() - .5) * .55,
      spin: (Math.random() - .5) * 1.6,
      dragging: false,
      cooldown: 0,
      sortUntil: 0,
      entering: true
    };
  }

  function randomIndex(list) {
    return Math.floor(Math.random() * list.length);
  }

  function nextItem(batch) {
    // Draw from six tickets across batches so portions vary and all materials recur.
    if (!materialTickets.length) materialTickets.push("plastic", "plastic", "paper", "paper", "glass", "glass");
    const [kind] = materialTickets.splice(randomIndex(materialTickets), 1);
    let remaining = remainingByKind.get(kind);
    if (!remaining?.length) {
      remaining = specs.filter(spec => spec.kind === kind);
      remainingByKind.set(kind, remaining);
    }
    const candidates = remaining.filter(spec => previousByKind.get(kind) !== spec &&
      !bodies.some(body => body.type === spec.type) && !batch.some(body => body.type === spec.type));
    const pool = candidates.length ? candidates : remaining;
    const item = pool[randomIndex(pool)];
    remaining.splice(remaining.indexOf(item), 1);
    previousByKind.set(kind, item);
    return item;
  }

  function resetGame(add = false) {
    layoutBins();
    if (!add) {
      selected = null;
      hoverBody = null;
      particles = [];
      bodies = [];
      remainingByKind.clear();
      previousByKind.clear();
      materialTickets.length = 0;
      controls.replaceChildren();
    }
    const compact = width <= 600 || (height <= 600 && matchMedia("(pointer: coarse)").matches);
    const space = (compact ? 7 : 14) - bodies.length;
    if (space <= 0) {
      setFeedback("На земле тесно. Отправь пару предметов в бак, чтобы освободить место.");
      return;
    }

    const min = add ? (compact ? 1 : 2) : (compact ? 3 : 5);
    const max = add ? (compact ? 3 : 5) : (compact ? 4 : 7);
    const count = Math.min(space, min + Math.floor(Math.random() * (max - min + 1)));
    const lanes = Array.from({length: count}, (_, i) => (i + .15 + Math.random() * .7) / count);
    let dropHeight = Math.random() * 24;
    const added = [];
    for (let i = 0; i < count; i++) {
      const [lane] = lanes.splice(randomIndex(lanes), 1);
      added.push(makeBody(nextItem(added), lane, dropHeight));
      dropHeight += 25 + Math.random() * 78;
    }
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

  function sizeScene() {
    if (!touchScene.matches) {
      scene.style.removeProperty("--scene-height");
      sceneViewport = null;
      return;
    }
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    // Browser bars change height during a swipe. Reframe only for a new layout.
    if (sceneViewport && sceneViewport.w === w && (h >= w) === (sceneViewport.h >= w) &&
        Math.abs(h - sceneViewport.h) < Math.max(160, sceneViewport.h * .25)) return;
    scene.style.removeProperty("--scene-height");
    scene.style.setProperty("--scene-height", scene.getBoundingClientRect().height + "px");
    sceneViewport = { w, h };
  }

  function resizeCanvas() {
    sizeScene();
    binsNeedLayout = true;
    const oldWidth = width;
    const oldHeight = height;
    const oldFloorY = floorY;
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (initialized && width === nextWidth && height === nextHeight && dpr === nextDpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const insetStyle = getComputedStyle(floorInsetProbe);
    const inset = parseFloat(insetStyle.paddingBottom) || parseFloat(insetStyle.marginBottom) ||
      parseFloat(insetStyle.getPropertyValue("--floor-inset")) || 16;
    floorY = height - inset;
    if (!initialized) {
      initialized = true;
      resetGame();
      return;
    }

    // A bottom-anchored pile keeps its shape when only the available height changes.
    if (width === oldWidth) {
      const dy = floorY - oldFloorY;
      bodies.forEach(body => {
        body.y += dy;
        if (Number.isFinite(body.sampleY)) body.sampleY += dy;
      });
      particles.forEach(particle => { particle.y += dy; });
      requestDraw();
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
    reactBin(bin, false);
    if (!reducedMotion.matches) burst(bin.x + bin.w / 2, bin.y + 12, ["#fff1ea", "#ff765e", "#f6bd2c"], .55);
    setFeedback("Ой, обратно! Поищи бак с надписью «" + binTheme[body.kind].label + "».");
  }

  function absorb(body, bin) {
    const itemName = body.label;
    body.handle.remove();
    if (selected === body) clearSelection();
    if (hoverBody === body) hoverBody = null;
    reactBin(bin, true);
    if (!reducedMotion.matches) burst(bin.x + bin.w / 2, bin.y + 18, [binTheme[bin.kind].light, "#ffffff", "#9edc75"], 1);
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

  }

  function supportRadius(body) {
    const sin = Math.sin(body.angle);
    const cos = Math.cos(body.angle);
    let bottom = -Infinity;
    for (const [x, y] of contactOutlines[body.type]) {
      bottom = Math.max(bottom, x * sin + y * cos);
    }
    return bottom * (body.r * spriteSizeInRadii / 256);
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

  function reactBin(bin, accepted) {
    const art = bin.button.querySelector(".bin-art");
    art.getAnimations().forEach(animation => animation.cancel());
    bin.button.dataset.reaction = accepted ? "Верно!" : "Не моё!";

    const glow = "brightness(1.13) drop-shadow(0 0 5px " + binTheme[bin.kind].light + ")";
    let frames = [];
    if (!reducedMotion.matches) {
      frames = accepted
        ? [{ filter: "none" }, { filter: glow, offset: .3 }, { filter: "none" }]
        : [0, -3, 3, -2, 0].map(x => ({ transform: "translateX(" + x + "px)" }));
    }
    const animation = art.animate(frames, { duration: accepted ? 500 : 410, easing: "ease-out" });
    animation.onfinish = () => { delete bin.button.dataset.reaction; };
  }

  function drawBody(body) {
    const colors = palette[body.kind];
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.shadowColor = "#124e6c42";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 7;
    drawObjectShape(body, colors);
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

  function drawObjectShape({ type, r, image, cell }, colors) {
    if (image.complete && image.naturalWidth) {
      const cellW = image.naturalWidth / 3;
      const cellH = image.naturalHeight / 2;
      const size = r * spriteSizeInRadii;
      ctx.drawImage(image, (cell % 3) * cellW, Math.floor(cell / 3) * cellH, cellW, cellH,
        -size / 2, -size / 2, size, size);
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
    if (binsNeedLayout && bodies.some(body => body.sortUntil > time)) layoutBins();
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
    if (physicsAwake || particles.length) requestDraw();
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
  const invalidateBinPositions = () => { binsNeedLayout = true; };
  window.addEventListener("scroll", invalidateBinPositions, {passive: true});
  window.visualViewport?.addEventListener("resize", invalidateBinPositions, {passive: true});
  window.visualViewport?.addEventListener("scroll", invalidateBinPositions, {passive: true});
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
  const images = new Set(specs.map(spec => spec.image));
  images.forEach(image => image.addEventListener("load", requestDraw));
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(invalidateBinPositions);
    binButtons.forEach(button => observer.observe(button));
  }
  document.fonts?.ready.then(invalidateBinPositions);

  resizeCanvas();
})();
