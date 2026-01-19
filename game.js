(() => {
  // =========================
  // DOM
  // =========================
  const menu = document.getElementById("menu");
  const gameWrap = document.getElementById("gameWrap");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const charGrid = document.getElementById("charGrid");
  const playerNameInput = document.getElementById("playerName");
  const startBtn = document.getElementById("startBtn");
  const backBtn = document.getElementById("backBtn");
  const muteBtn = document.getElementById("muteBtn");

  const howBtn = document.getElementById("howBtn");
  const helpDialog = document.getElementById("helpDialog");
  const closeHelp = document.getElementById("closeHelp");
  const menuNote = document.getElementById("menuNote");

  const playerNameHud = document.getElementById("playerNameHud");
  const charHud = document.getElementById("charHud");
  const countHud = document.getElementById("countHud");
  const timeHud = document.getElementById("timeHud");

  const storyText = document.getElementById("storyText");
  const promptLine = document.getElementById("promptLine");
  const templateLine = document.getElementById("templateLine");

  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyBtn = document.getElementById("copyBtn");
  const pdfBtn = document.getElementById("pdfBtn");

  const endOverlay = document.getElementById("endOverlay");
  const endStory = document.getElementById("endStory");
  const endCopyBtn = document.getElementById("endCopyBtn");
  const endPdfBtn = document.getElementById("endPdfBtn");
  const againBtn = document.getElementById("againBtn");

  // =========================
  // Helpers
  // =========================
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // =========================
  // Canvas sizing (HiDPI)
  // =========================
  const W = 900;
  const H = 520;

  function resizeCanvasToDisplaySize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  resizeCanvasToDisplaySize();
  window.addEventListener("resize", resizeCanvasToDisplaySize);

  // =========================
  // AUDIO
  // =========================
  const music = new Audio("fondo.mp3");
  music.loop = true;
  music.volume = 0.35;

  const sfxWordSrc = "word.mp3";
  let muted = false;

  function playMusic() {
    if (muted) return;
    if (music.paused) music.play().catch(() => {});
  }
  function stopMusic() {
    music.pause();
    music.currentTime = 0;
  }
  function pauseMusic() { music.pause(); }

  function playWordSfx() {
    if (muted) return;
    const s = new Audio(sfxWordSrc);
    s.volume = 0.85;
    s.play().catch(() => {});
  }

  function syncMuteUi() {
    if (!muteBtn) return;
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.textContent = `Sonido: ${muted ? "OFF" : "ON"}`;
    if (muted) pauseMusic();
    else if (running) playMusic();
  }

  // =========================
  // Images / Characters
  // =========================
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  const characters = [
    { id: "ciela",     label: "Ciela",     desc: "La sabia",      imageSrc: "ciela.png" },
    { id: "nuve",      label: "Nuve",      desc: "La tranquila",  imageSrc: "nuve.png" },
    { id: "nuveciela", label: "Nuveciela", desc: "La fuerte",     imageSrc: "nuveciela.png" },
    { id: "lunaria",   label: "Lunaria",   desc: "La inventora",  imageSrc: "lunaria.png" },
  ];

  const imageCache = new Map();
  for (const c of characters) imageCache.set(c.id, loadImage(c.imageSrc));

  let selectedCharId = null;
  let selectedCharMeta = null;
  let playerName = "";

  function renderCharacterGrid() {
    if (!charGrid) return;
    charGrid.innerHTML = "";

    for (const c of characters) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "char";
      btn.setAttribute("aria-selected", "false");

      const av = document.createElement("div");
      av.className = "avatar";

      const img = document.createElement("img");
      img.alt = c.label;
      img.src = c.imageSrc;
      img.onerror = () => { img.remove(); av.textContent = c.label.slice(0, 1); };
      av.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<div class="name">${c.label}</div><div class="desc">${c.desc}</div>`;

      btn.appendChild(av);
      btn.appendChild(meta);

      btn.addEventListener("click", () => {
        selectedCharId = c.id;
        selectedCharMeta = c;
        [...charGrid.querySelectorAll(".char")].forEach(x => x.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        validateStart();
      });

      charGrid.appendChild(btn);
    }
  }

  function validateStart() {
    const nameOk = (playerNameInput?.value || "").trim().length >= 1;
    const charOk = !!selectedCharId;
    startBtn.disabled = !(nameOk && charOk);
    if (menuNote) {
      menuNote.textContent = startBtn.disabled
        ? "Elegí un personaje y escribí tu nombre."
        : "Listo. Tocá “Empezar”.";
    }
  }
  playerNameInput?.addEventListener("input", validateStart);

  // =========================
  // WORD BANKS (amplios)
  // =========================
  const WORDBANK = {
    ciela: {
      prompt: "Ciela (la sabia): armá una historia con pistas y sentido.",
      sujetos: [
        "Ciela","una maestra","un libro","una brújula","una pregunta","un farol","un mapa","un consejo",
        "una carta","un cuaderno","un reloj","una llave","un secreto","una biblioteca","una señal",
        "una nota","un mensaje","una pista","un camino","un misterio"
      ],
      verbos: [
        "descifra","ordena","explica","comprende","elige","recuerda","observa","encuentra",
        "interpreta","conecta","aclara","resuelve","anota","pregunta","aprende","guía"
      ],
      cosas: [
        "una idea","una pista escondida","una verdad","una palabra justa","un plan","una respuesta",
        "un acertijo","un dibujo","un cuento","una promesa","un método","una lección","una señal"
      ],
      lugares: [
        "en la biblioteca","en el bosque","bajo la luna","junto al río","en un aula secreta","en un pasillo largo",
        "entre árboles","cerca del mar","en una plaza tranquila","en un rincón","en la tarde"
      ],
      adjetivos: [
        "clara","sabia","precisa","profunda","paciente","atenta","serena","lúcida","justa","tranquila","firme"
      ],
    },

    nuve: {
      prompt: "Nuve (la tranquila): armá una historia suave y luminosa.",
      sujetos: [
        "Nuve","una nube","una brisa","un susurro","una estrella lenta","un abrazo","una pluma",
        "una canción","una manta","un atardecer","una hoja","una luz","un sueño"
      ],
      verbos: [
        "flota","respira","acompaña","calma","espera","sonríe","escucha","sueña",
        "cuida","pasea","descansa","brilla","susurra","abraza","se queda"
      ],
      cosas: [
        "una paz","una melodía","una luz tibia","una promesa","un té","un refugio",
        "un silencio","una risa","un latido","una caricia","una nube suave"
      ],
      lugares: [
        "en la tarde","en el cielo","en un jardín","cerca del mar","bajo una manta","en una siesta",
        "junto a la ventana","entre flores","en la lluvia suave","en un patio"
      ],
      adjetivos: [
        "suave","tranquila","lenta","cálida","amable","delicada","serena","ligera","tierna","tibia","dulce"
      ],
    },

    nuveciela: {
      prompt: "Nuveciela (la fuerte): armá una historia valiente y con decisión.",
      sujetos: [
        "Nuveciela","una guardiana","una tormenta","un escudo","una montaña","una amiga","un juramento",
        "una linterna","un fuego","una puerta","una bandera","un camino","un desafío","un corazón"
      ],
      verbos: [
        "protege","enfrenta","resiste","levanta","decide","defiende","avanza","salva",
        "rompe","sostiene","aguanta","encuentra","empuja","abre","cruza"
      ],
      cosas: [
        "una fuerza","una chispa","una llave","un mensaje","un objetivo","una prueba",
        "una victoria","una promesa","un amuleto","una salida","una señal"
      ],
      lugares: [
        "en la noche","en la cima","en el bosque","en un puente","bajo la lluvia","entre sombras",
        "en el viento","en un pasaje","en una plaza vacía","en el borde del camino"
      ],
      adjetivos: [
        "valiente","firme","decidida","leal","poderosa","audaz","imparable","noble","segura","intensa"
      ],
    },

    lunaria: {
      prompt: "Lunaria (la inventora): armá una historia rara y creativa.",
      sujetos: [
        "Lunaria","un robot","un engranaje","una antena","un telescopio","una máquina","un rayo",
        "un circuito","un botón","un plano","un imán","un dron","una chispa","un motor"
      ],
      verbos: [
        "inventa","construye","mezcla","prueba","enciende","calibra","transforma","programa",
        "ajusta","conecta","repara","reinicia","descubre","ensambla","experimenta"
      ],
      cosas: [
        "un prototipo","una fórmula","un truco","un mapa estelar","una pieza nueva","un código",
        "una idea brillante","un mecanismo","un plan extraño","una señal eléctrica","un botón secreto"
      ],
      lugares: [
        "en el taller","en un laboratorio","en la luna","entre cables","bajo una lámpara","en un garaje secreto",
        "en una mesa llena","en una sala","en un hangar","en el cielo"
      ],
      adjetivos: [
        "curiosa","eléctrica","nueva","extraña","brillante","imposible","genial","rara","futurista","magnética"
      ],
    }
  };

  // =========================
  // Template + sentence builder (coherencia)
  // =========================
  const TEMPLATE = ["sujeto", "verbo", "cosa", "lugar", "adj"];
  const TEMPLATE_LABEL = {
    sujeto: "Sujeto",
    verbo: "Verbo",
    cosa: "Cosa",
    lugar: "Lugar",
    adj: "Adjetivo"
  };

  function templateText() {
    const idx = slotIndex;
    return TEMPLATE.map((k, i) => (i === idx ? `→ ${TEMPLATE_LABEL[k]}` : TEMPLATE_LABEL[k])).join("  •  ");
  }

  function expectedKind() {
    return TEMPLATE[slotIndex] || "sujeto";
  }

  function cap(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function buildSentence(charId, slots) {
    const S = slots.sujeto || "Alguien";
    const V = slots.verbo || "hace";
    const C = slots.cosa || "algo";
    const L = slots.lugar || "en algún lugar";
    const A = slots.adj || "mágico";

    // Formatos simples, consistentes y legibles
    if (charId === "ciela") {
      return `${cap(S)} ${V} ${C} ${L}, y todo se vuelve ${A}.`;
    }
    if (charId === "nuve") {
      return `${cap(S)} ${V} ${C} ${L}, muy ${A}.`;
    }
    if (charId === "nuveciela") {
      return `${cap(S)} ${V} ${C} ${L}, y sigue ${A}.`;
    }
    // lunaria
    return `${cap(S)} ${V} ${C} ${L}, algo ${A}.`;
  }

  // =========================
  // Bag system (sin cuelgues)
  // =========================
  let poolByKind = null;
  let bagByKind = null;
  let recentGlobal = [];

  const RECENT_BLOCK = 7; // evita repetir muy seguido

  function buildPoolsForChar(charId) {
    const b = WORDBANK[charId];
    poolByKind = {
      sujeto: b.sujetos.map(t => ({ t, kind: "sujeto" })),
      verbo:  b.verbos.map(t => ({ t, kind: "verbo" })),
      cosa:   b.cosas.map(t => ({ t, kind: "cosa" })),
      lugar:  b.lugares.map(t => ({ t, kind: "lugar" })),
      adj:    b.adjetivos.map(t => ({ t, kind: "adj" })),
    };
    bagByKind = { sujeto: [], verbo: [], cosa: [], lugar: [], adj: [] };
    refillBag("sujeto"); refillBag("verbo"); refillBag("cosa"); refillBag("lugar"); refillBag("adj");
    recentGlobal = [];
  }

  function refillBag(kind) {
    const src = poolByKind?.[kind] ? poolByKind[kind].slice() : [];
    bagByKind[kind] = shuffle(src);
  }

  function takeFromBag(kind) {
    if (!bagByKind || !poolByKind) return null;
    if (!bagByKind[kind] || bagByKind[kind].length === 0) refillBag(kind);

    // intentos finitos para evitar repetición global
    for (let tries = 0; tries < 10; tries++) {
      if (bagByKind[kind].length === 0) refillBag(kind);
      const item = bagByKind[kind].pop();
      if (!item) return null;

      if (!recentGlobal.includes(item.t)) return item;

      // si estaba repetida, la devolvemos al inicio y seguimos probando
      bagByKind[kind].unshift(item);
    }

    // si no pudo evitarse, devolvemos cualquiera
    if (bagByKind[kind].length === 0) refillBag(kind);
    return bagByKind[kind].pop() || null;
  }

  function rememberGlobal(text) {
    recentGlobal.push(text);
    if (recentGlobal.length > RECENT_BLOCK) recentGlobal.shift();
  }

  // =========================
  // Story state (slots)
  // =========================
  let sentences = []; // array de strings
  let slots = { sujeto: null, verbo: null, cosa: null, lugar: null, adj: null };
  let slotIndex = 0;
  let caughtCount = 0;

  function resetSlots() {
    slots = { sujeto: null, verbo: null, cosa: null, lugar: null, adj: null };
    slotIndex = 0;
  }

  function setSlot(kind, text) {
    slots[kind] = text;
  }

  function pushSentenceIfComplete() {
    const done = TEMPLATE.every(k => !!slots[k]);
    if (!done) return;

    const s = buildSentence(selectedCharId, slots);
    sentences.push(s);
    resetSlots();
  }

  function storyString() {
    // muestra lo terminado + lo que va en construcción
    const done = sentences.slice();

    const partialParts = [];
    for (let i = 0; i < TEMPLATE.length; i++) {
      const k = TEMPLATE[i];
      if (slots[k]) partialParts.push(slots[k]);
    }

    if (partialParts.length) {
      // preview coherente (sin punto final)
      const preview = partialParts.join(" ");
      done.push(cap(preview) + "…");
    }

    return done.join(" ");
  }

  function refreshStoryText() {
    const t = storyString().trim();
    storyText.textContent = t.length ? t : "Mové tu personaje para atrapar palabras…";
    endStory.textContent = sentences.length ? sentences.join(" ") : "Todavía no atrapaste palabras.";
    countHud.textContent = String(caughtCount);
    templateLine.textContent = templateText();
  }

  function undoWord() {
    // retrocede un slot dentro de la frase actual; si no hay, quita una oración completa
    for (let i = TEMPLATE.length - 1; i >= 0; i--) {
      const k = TEMPLATE[i];
      if (slots[k]) {
        slots[k] = null;
        slotIndex = Math.max(0, i);
        caughtCount = Math.max(0, caughtCount - 1);
        refreshStoryText();
        return;
      }
    }

    // si no había slots, borrar una oración ya cerrada
    if (sentences.length > 0) {
      sentences.pop();
      refreshStoryText();
    }
  }

  function clearStory() {
    sentences = [];
    resetSlots();
    caughtCount = 0;
    refreshStoryText();
  }

  async function copyStory() {
    const finalText = (sentences.join(" ") || "").trim();
    if (!finalText) return;
    try {
      await navigator.clipboard.writeText(finalText);
      copyBtn.textContent = "Copiado";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 900);
    } catch {
      copyBtn.textContent = "Listo";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 900);
    }
  }

  async function exportPdf() {
    const story = (sentences.join(" ") || "").trim();
    if (!story) return;

    const jspdf = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if (!jspdf) {
      alert("No se cargó jsPDF. Verificá que estés online y que el script CDN esté en el HTML.");
      return;
    }

    const doc = new jspdf({ unit: "pt", format: "a4" });
    const margin = 48;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Nuvecielas — Bosque de las Palabras", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Jugador: ${playerName || "—"}   |   Personaje: ${selectedCharMeta?.label || "—"}`, margin, y);
    y += 18;

    const img = imageCache.get(selectedCharId);
    const ready = img && img.complete && img.naturalWidth > 0;
    if (ready) {
      const oc = document.createElement("canvas");
      const s = 260;
      oc.width = s; oc.height = s;
      const octx = oc.getContext("2d");
      octx.save();
      octx.beginPath();
      octx.arc(s/2, s/2, s/2, 0, Math.PI*2);
      octx.clip();
      const scale = Math.max(s / img.naturalWidth, s / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      octx.drawImage(img, s/2 - dw/2, s/2 - dh/2, dw, dh);
      octx.restore();

      doc.addImage(oc.toDataURL("image/png"), "PNG", 360, margin, 180, 180);
    }

    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Historia", margin, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(story, 500);
    doc.text(lines, margin, y);

    doc.save("nuvecielas-historia.pdf");
  }

  // =========================
  // Player movement + jump
  // =========================
  const keys = { left: false, right: false };

  const player = {
    x: W * 0.5,
    baseY: H - 78,
    y: H - 78,
    r: 46,
    speed: 560,
    dragging: false,
    dragOffsetX: 0,
    jumpV: 0
  };

  function jump() { player.jumpV = -320; }

  function updatePlayer(dt) {
    if (!player.dragging) {
      const dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      player.x += dir * player.speed * dt;
    }
    player.x = clamp(player.x, player.r + 10, W - player.r - 10);

    player.jumpV += 1200 * dt;
    player.y += player.jumpV * dt;
    if (player.y > player.baseY) {
      player.y = player.baseY;
      player.jumpV = 0;
    }
  }

  function drawPlayer(ts) {
    const img = imageCache.get(selectedCharId);
    const ready = img && img.complete && img.naturalWidth > 0;

    // sombra
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(player.x, player.baseY + player.r + 16, player.r * 1.05, player.r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // halo
    const pulse = 1 + Math.sin(ts / 520) * 0.03;
    ctx.fillStyle = "rgba(124,58,237,.14)";
    ctx.beginPath();
    ctx.arc(player.x, player.y, (player.r + 9) * pulse, 0, Math.PI * 2);
    ctx.fill();

    // recorte circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.clip();

    if (ready) {
      const size = player.r * 2;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(size / iw, size / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, player.x - dw / 2, player.y - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillRect(player.x - player.r, player.y - player.r, player.r * 2, player.r * 2);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // pointer drag
  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (W / rect.width);
    const y = (evt.clientY - rect.top) * (H / rect.height);
    return { x, y };
  }

  function hitPlayer(px, py) {
    const dx = px - player.x;
    const dy = py - player.y;
    return (dx * dx + dy * dy) <= (player.r * player.r);
  }

  canvas.addEventListener("pointerdown", (evt) => {
    if (gameWrap.hidden || !running) return;
    const p = canvasPoint(evt);
    canvas.setPointerCapture(evt.pointerId);
    if (hitPlayer(p.x, p.y)) {
      player.dragging = true;
      player.dragOffsetX = p.x - player.x;
    }
  });

  canvas.addEventListener("pointermove", (evt) => {
    if (!player.dragging || !running) return;
    const p = canvasPoint(evt);
    player.x = p.x - player.dragOffsetX;
    player.x = clamp(player.x, player.r + 10, W - player.r - 10);
  });

  canvas.addEventListener("pointerup", () => { player.dragging = false; });
  canvas.addEventListener("pointercancel", () => { player.dragging = false; });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  // =========================
  // Words falling (spawn coherente)
  // =========================
  function roundRect(c, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
    if (fill) c.fill();
    if (stroke) c.stroke();
  }

  function isImportant(kind) {
    return (kind === "cosa" || kind === "adj");
  }

  let words = [];
  let spawnAcc = 0;

  function chooseWordForSpawn() {
    if (!poolByKind || !bagByKind) return null;

    const need = expectedKind();

    // 80% lo que toca; 20% “varía” entre cosa/adj/lugar para que no sea monótono.
    const r = Math.random();
    let kind = need;

    if (r >= 0.80) {
      const alt = ["cosa", "adj", "lugar", "verbo", "sujeto"];
      kind = alt[Math.floor(Math.random() * alt.length)];
    }

    // siempre preferimos que exista
    if (!poolByKind[kind] || poolByKind[kind].length === 0) kind = need;

    const item = takeFromBag(kind) || takeFromBag(need);
    return item;
  }

  function spawnWord() {
    const item = chooseWordForSpawn();
    if (!item) return;

    const text = item.t;
    const kind = item.kind;

    ctx.font = "900 18px system-ui";
    const padX = 14;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 36;

    const x = rand(20, W - w - 20);
    const y = -h - rand(10, 80);

    words.push({
      text,
      kind,
      important: isImportant(kind),
      x, y, w, h,
      vy: rand(120, 210),
      wob: rand(0, Math.PI * 2),
    });
  }

  function drawWordBubble(b, ts) {
    const wobX = Math.sin(ts / 420 + b.wob) * 3;

    if (b.important) {
      ctx.save();
      ctx.shadowColor = "rgba(251,191,36,.95)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255,.96)";
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14, true, false);
      ctx.restore();

      ctx.strokeStyle = "rgba(251,191,36,.60)";
      ctx.lineWidth = 2;
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14, false, true);
    } else {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14, true, false);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(0,0,0,.08)";
      ctx.lineWidth = 1;
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14, false, true);
    }

    // etiqueta
    ctx.globalAlpha = 0.70;
    ctx.fillStyle = "rgba(124,58,237,.70)";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText((TEMPLATE_LABEL[b.kind] || "").toUpperCase(), b.x + wobX + 12, b.y - 4);
    ctx.globalAlpha = 1;

    // texto
    ctx.fillStyle = "rgba(31,36,48,.92)";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.x + wobX + 14, b.y + b.h / 2);
  }

  function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (cr * cr);
  }

  // =========================
  // Background
  // =========================
  function drawBackground(ts) {
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(234,246,255,1)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(6,182,212,.10)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 120);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 120 + Math.sin((x / 115) + ts / 900) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(124,58,237,.10)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 80);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 80 + Math.sin((x / 95) + ts / 820 + 1.4) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 14; i++) {
      const x = (i * 71 + 30) % W;
      const y = ((i * 97) % 210) + 25;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(x + Math.sin(ts / 700 + i) * 5, y + Math.cos(ts / 800 + i) * 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(17,24,39,.70)";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Buscá ahora: ${TEMPLATE_LABEL[expectedKind()]}`, 16, 14);
  }

  // =========================
  // Game state
  // =========================
  let running = false;
  let rafId = null;
  let lastTs = 0;

  const GAME_SECONDS = 30;
  let timeLeft = GAME_SECONDS;

  function setHUD() {
    if (playerNameHud) playerNameHud.textContent = playerName || "—";
    if (charHud) charHud.textContent = selectedCharMeta ? `${selectedCharMeta.label} — ${selectedCharMeta.desc}` : "—";
    if (countHud) countHud.textContent = String(caughtCount);
    if (timeHud) timeHud.textContent = String(Math.ceil(timeLeft));
  }

  function resetGameState() {
    clearStory();

    words = [];
    spawnAcc = 0;
    lastTs = 0;

    player.x = W * 0.5;
    player.y = player.baseY;
    player.jumpV = 0;
    player.dragging = false;

    timeLeft = GAME_SECONDS;
    setHUD();

    endOverlay.hidden = true;
  }

  function endGame() {
    running = false;
    stopMusic();
    endStory.textContent = (sentences.join(" ") || "").trim() || "Todavía no atrapaste palabras.";
    endOverlay.hidden = false;
    setHUD();
  }

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      setHUD();
      endGame();
      return;
    }

    setHUD();
    updatePlayer(dt);

    // Spawn: más vivo (y evita pantallas vacías)
    spawnAcc += dt;
    const target = 14;
    const spawnEvery = (words.length < 6) ? 0.34 : (words.length < 10 ? 0.44 : 0.58);

    if (spawnAcc >= spawnEvery) {
      spawnAcc = 0;
      if (words.length < target) spawnWord();
    }

    for (const w of words) w.y += w.vy * dt;

    words = words.filter(w => {
      if (w.y > H + 50) return false;

      const hit = collideCircleRect(player.x, player.y, player.r, w.x, w.y, w.w, w.h);
      if (hit) {
        // sólo acepta la palabra si coincide con el slot actual
        const need = expectedKind();
        if (w.kind === need) {
          setSlot(need, w.text);
          slotIndex = Math.min(TEMPLATE.length - 1, slotIndex + 1);
          caughtCount += 1;

          pushSentenceIfComplete();
          rememberGlobal(w.text);

          playWordSfx();
          jump();
          refreshStoryText();
          return false;
        } else {
          // si no coincide, no la “consume”: rebote suave (para que no sea frustrante)
          w.y += 18;
          return true;
        }
      }
      return true;
    });
  }

  function render(ts) {
    drawBackground(ts);
    for (const w of words) drawWordBubble(w, ts);
    drawPlayer(ts);
  }

  function loop(ts) {
    // protección: un solo loop activo
    rafId = requestAnimationFrame(loop);

    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;

    if (!gameWrap.hidden) {
      if (running) update(dt);
      render(ts);
    }
  }

  function ensureLoopRunning() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // =========================
  // Flow
  // =========================
  function startGame() {
    playerName = (playerNameInput?.value || "").trim().slice(0, 18);
    selectedCharMeta = characters.find(c => c.id === selectedCharId);

    buildPoolsForChar(selectedCharId);

    promptLine.textContent = WORDBANK[selectedCharId].prompt;
    resetSlots();
    sentences = [];
    caughtCount = 0;

    templateLine.textContent = templateText();
    refreshStoryText();

    resetGameState();

    // spawn inicial: variado y suficiente
    for (let i = 0; i < 10; i++) spawnWord();

    menu.hidden = true;
    gameWrap.hidden = false;

    running = true;
    playMusic();
    ensureLoopRunning();
  }

  function backToMenu() {
    running = false;
    stopMusic();
    endOverlay.hidden = true;

    gameWrap.hidden = true;
    menu.hidden = false;

    playerNameHud.textContent = "—";
    charHud.textContent = "—";
    countHud.textContent = "0";
    timeHud.textContent = String(GAME_SECONDS);

    // opcional: detener loop si querés (pero no hace falta). Yo lo detengo para evitar dobles renders.
    stopLoop();
    lastTs = 0;
  }

  function playAgain() {
    resetGameState();
    running = true;
    playMusic();
    ensureLoopRunning();
  }

  // =========================
  // UI bindings
  // =========================
  startBtn?.addEventListener("click", startGame);
  backBtn?.addEventListener("click", backToMenu);

  howBtn?.addEventListener("click", () => helpDialog.showModal());
  closeHelp?.addEventListener("click", () => helpDialog.close());

  undoBtn?.addEventListener("click", undoWord);
  clearBtn?.addEventListener("click", clearStory);
  copyBtn?.addEventListener("click", copyStory);
  pdfBtn?.addEventListener("click", exportPdf);

  endCopyBtn?.addEventListener("click", copyStory);
  endPdfBtn?.addEventListener("click", exportPdf);
  againBtn?.addEventListener("click", playAgain);

  muteBtn?.addEventListener("click", () => {
    muted = !muted;
    syncMuteUi();
  });

  // desbloqueo audio en móviles
  window.addEventListener("pointerdown", () => {
    if (!muted && running) playMusic();
  }, { once: true });

  // =========================
  // Init
  // =========================
  renderCharacterGrid();
  validateStart();
  syncMuteUi();

  resetSlots();
  sentences = [];
  caughtCount = 0;
  if (timeHud) timeHud.textContent = String(GAME_SECONDS);
  if (templateLine) templateLine.textContent = templateText();
  refreshStoryText();

  menu.hidden = false;
  gameWrap.hidden = true;
})();
