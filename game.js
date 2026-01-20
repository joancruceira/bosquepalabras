(() => {
  "use strict";

  /* ===========================
     DOM
  =========================== */
  const $ = (id) => document.getElementById(id);

  const menu = $("menu");
  const gameWrap = $("gameWrap");
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const charGrid = $("charGrid");
  const playerNameInput = $("playerName");
  const startBtn = $("startBtn");
  const backBtn = $("backBtn");
  const muteBtn = $("muteBtn");

  const howBtn = $("howBtn");
  const helpDialog = $("helpDialog");
  const closeHelp = $("closeHelp");
  const menuNote = $("menuNote");

  const playerNameHud = $("playerNameHud");
  const charHud = $("charHud");
  const countHud = $("countHud");
  const comboHud = $("comboHud");
  const timeHud = $("timeHud");

  const storyText = $("storyText");
  const promptLine = $("promptLine");
  const templateLine = $("templateLine");

  const undoBtn = $("undoBtn");
  const clearBtn = $("clearBtn");
  const copyBtn = $("copyBtn");
  const pdfBtn = $("pdfBtn");

  const endOverlay = $("endOverlay");
  const endStory = $("endStory");
  const endCopyBtn = $("endCopyBtn");
  const endPdfBtn = $("endPdfBtn");
  const againBtn = $("againBtn");

  /* ===========================
     Helpers
  =========================== */
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const now = () => performance.now();

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  /* ===========================
     Canvas
  =========================== */
  const W = 900, H = 520;

  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  /* ===========================
     Audio
  =========================== */
  const music = new Audio("fondo.mp3");
  music.loop = true;
  music.volume = 0.30;

  const sfxPool = Array.from({ length: 8 }, () => {
    const a = new Audio("word.mp3");
    a.volume = 0.85;
    return a;
  });
  let sfxIdx = 0;
  let muted = false;

  function playMusic() {
    if (muted) return;
    if (music.paused) music.play().catch(() => {});
  }
  function stopMusic() {
    music.pause();
    music.currentTime = 0;
  }
  function playSfx(vol = 0.85) {
    if (muted) return;
    const a = sfxPool[sfxIdx++ % sfxPool.length];
    a.pause();
    a.currentTime = 0;
    a.volume = vol;
    a.play().catch(() => {});
  }

  function syncMuteUi() {
    muteBtn.textContent = `Sonido: ${muted ? "OFF" : "ON"}`;
    muteBtn.setAttribute("aria-pressed", String(muted));
    if (muted) music.pause();
    else if (running) playMusic();
  }

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    syncMuteUi();
  });

  // desbloqueo audio (móviles)
  window.addEventListener("pointerdown", () => {
    if (!muted && running) playMusic();
  }, { once: true });

  /* ===========================
     Characters
  =========================== */
  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  const characters = [
    { id: "ciela",     label: "Ciela",     desc: "La sabia",     img: "ciela.png" },
    { id: "nuve",      label: "Nuve",      desc: "La tranquila", img: "nuve.png" },
    { id: "nuveciela", label: "Nuveciela", desc: "La fuerte",    img: "nuveciela.png" },
    { id: "lunaria",   label: "Lunaria",   desc: "La inventora", img: "lunaria.png" },
  ];

  const imageCache = new Map();
  characters.forEach(c => imageCache.set(c.id, loadImage(c.img)));

  let selectedCharId = null;
  let selectedCharMeta = null;
  let playerName = "";

  function renderCharacterGrid() {
    charGrid.innerHTML = "";
    for (const c of characters) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "char";
      btn.setAttribute("aria-selected", "false");

      const av = document.createElement("div");
      av.className = "avatar";
      const im = document.createElement("img");
      im.src = c.img;
      im.alt = c.label;
      im.onerror = () => { im.remove(); av.textContent = c.label.slice(0, 1); };
      av.appendChild(im);

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
    const ok = (playerNameInput.value || "").trim().length >= 1 && !!selectedCharId;
    startBtn.disabled = !ok;
    menuNote.textContent = ok
      ? "Regla: armá tu historia en 30 segundos."
      : "Elegí un personaje y escribí tu nombre.";
  }
  playerNameInput.addEventListener("input", validateStart);

  /* ===========================
     Word banks (más variedad + coherencia)
  =========================== */
  const BANK = {
    ciela: {
      prompt: "Ciela (la sabia): armá un cuento con pistas, ideas y sentido.",
      sujeto: ["Ciela","una maestra","un libro","una brújula","una pregunta","un mapa","un consejo","una lámpara","una nota"],
      verbo: ["explica","ordena","descifra","enseña","observa","piensa","elige","recuerda","anota","relaciona"],
      objeto: ["una idea","una regla","una verdad","una pista","un secreto","una palabra justa","un plan","una señal","una respuesta"],
      lugar: ["en la biblioteca","en el bosque","bajo la luna","junto al río","en un aula secreta","en el claro","en el sendero","en la colina"],
      adjetivo: ["clara","sabia","precisa","profunda","serena","paciente","atenta","brillante","justa"]
    },
    nuve: {
      prompt: "Nuve (la tranquila): armá un cuento suave, calmado y luminoso.",
      sujeto: ["Nuve","una nube","una brisa","un susurro","una estrella lenta","un abrazo","una pluma","un sueño","una ola"],
      verbo: ["flota","respira","acompaña","calma","espera","sonríe","escucha","sueña","abraza","alumbra"],
      objeto: ["una paz","una melodía","una luz tibia","una promesa","un té","una canción bajita","una manta","un silencio","un minuto"],
      lugar: ["en la tarde","en el cielo","en un jardín","cerca del mar","bajo una manta","en una siesta","en la ventana","en un patio"],
      adjetivo: ["suave","tranquila","lenta","cálida","amable","delicada","lumínica","dulce","serena"]
    },
    nuveciela: {
      prompt: "Nuveciela (la fuerte): armá un cuento valiente, con decisión y corazón.",
      sujeto: ["Nuveciela","una guardiana","una tormenta","un escudo","una montaña","una amiga leal","un juramento","un faro","un tambor"],
      verbo: ["protege","enfrenta","resiste","levanta","decide","defiende","corre","salva","avanza","rompe"],
      objeto: ["una fuerza","una chispa","una bandera","una puerta","una llave","un mensaje","un camino","una promesa","un destino"],
      lugar: ["en la noche","en la cima","en el bosque","en un puente","bajo la lluvia","en la plaza","en la entrada","en la sombra"],
      adjetivo: ["valiente","firme","decidida","leal","poderosa","intensa","enorme","noble","rápida"]
    },
    lunaria: {
      prompt: "Lunaria (la inventora): armá un cuento raro, creativo y lleno de inventos.",
      sujeto: ["Lunaria","un robot","un engranaje","una antena","un telescopio","una máquina","un rayo","un dron","un resorte"],
      verbo: ["inventa","construye","mezcla","prueba","enciende","calibra","transforma","programa","repara","activa"],
      objeto: ["un prototipo","un botón","una chispa","un imán","un plano","una fórmula","un truco","un motor","un cristal"],
      lugar: ["en el taller","en un laboratorio","en la luna","en una cueva eléctrica","en el cielo","en un garaje secreto","en la torre","en el hangar"],
      adjetivo: ["curiosa","eléctrica","nueva","extraña","brillante","imposible","genial","magnética","fantástica"]
    }
  };

  const TEMPLATE = ["sujeto", "verbo", "objeto", "lugar", "adjetivo"];
  const LABEL = {
    sujeto: "Sujeto",
    verbo: "Verbo",
    objeto: "Cosa",
    lugar: "Lugar",
    adjetivo: "Adjetivo",
  };

  function isImportant(kind) {
    // “importantes” brillan: objeto y adjetivo
    return kind === "objeto" || kind === "adjetivo";
  }

  /* ===========================
     Story state (coherente)
  =========================== */
  let step = 0;
  let current = [];     // palabras de la oración actual
  let sentences = [];   // oraciones completas
  let caught = 0;

  function expectedKind() {
    return TEMPLATE[step];
  }

  function composeStory() {
    const all = [...sentences];
    if (current.length) all.push(current.join(" "));
    const joined = all.map(s => (/[.!?]$/.test(s) ? s : (s + "."))).join(" ");
    return joined.trim();
  }

  function refreshStoryUI() {
    const t = composeStory();
    storyText.textContent = t || "Mové tu personaje y atrapá palabras para armar una historia…";
    endStory.textContent = t || "Todavía no atrapaste palabras.";
    countHud.textContent = String(caught);
    templateLine.textContent =
      TEMPLATE.map((k, i) => i === step ? `→ ${LABEL[k]}` : LABEL[k]).join("  •  ");
    comboHud.textContent = combo > 1 ? `x${combo}` : "—";
    timeHud.textContent = String(Math.ceil(timeLeft));
  }

  function addWord(text) {
    if (current.length === 0) current.push(cap(text));
    else current.push(text);

    caught++;
    step++;

    if (step >= TEMPLATE.length) {
      // cerrar oración con coma antes del adjetivo si no la tiene
      // (queda: “..., valiente.”)
      const s = current.join(" ");
      sentences.push(s);
      current = [];
      step = 0;

      // plantar árbol por oración completa
      plantTree();
    }

    refreshStoryUI();
  }

  function undoWord() {
    if (current.length > 0) {
      current.pop();
      step = Math.max(0, step - 1);
      caught = Math.max(0, caught - 1);
    } else if (sentences.length > 0) {
      const last = sentences.pop().replace(/[.!?]$/,"");
      const parts = last.split(" ").filter(Boolean);
      current = parts;
      step = clamp(current.length, 0, TEMPLATE.length - 1);
      // sacar una palabra
      current.pop();
      step = Math.max(0, step - 1);
      caught = Math.max(0, caught - 1);
    }
    refreshStoryUI();
  }

  function clearStory() {
    sentences = [];
    current = [];
    step = 0;
    caught = 0;
    refreshStoryUI();
  }

  async function copyStory() {
    const t = composeStory();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      copyBtn.textContent = "Copiado";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 800);
    } catch {
      copyBtn.textContent = "Listo";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 800);
    }
  }

  /* ===========================
     PDF (solo si ya lo tenés cableado con jsPDF en tu HTML)
  =========================== */
  async function exportPdf() {
    const story = composeStory();
    if (!story) return;

    const jspdf = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if (!jspdf) {
      alert("Falta jsPDF en el HTML (CDN). Si querés, te lo agrego.");
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
    doc.text(`Jugador: ${playerName || "—"} | Personaje: ${selectedCharMeta?.label || "—"}`, margin, y);
    y += 18;

    // imagen circular
    const img = imageCache.get(selectedCharId);
    if (img && img.complete && img.naturalWidth > 0) {
      const oc = document.createElement("canvas");
      const s = 240;
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
      doc.addImage(oc.toDataURL("image/png"), "PNG", 340, margin, 160, 160);
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

  /* ===========================
     Game: movement + input
  =========================== */
  const keys = { left: false, right: false };

  const player = {
    x: W * 0.5,
    baseY: H - 74,
    y: H - 74,
    r: 46,
    speed: 560,
    dragging: false,
    dragOffsetX: 0,
    jumpV: 0,
    stun: 0
  };

  function jump(amount = -320) {
    if (player.y >= player.baseY - 0.5) player.jumpV = amount;
  }

  function updatePlayer(dt) {
    // stun por espinas
    if (player.stun > 0) {
      player.stun = Math.max(0, player.stun - dt);
    }

    if (!player.dragging && player.stun <= 0) {
      const dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      player.x += dir * player.speed * dt;
    }
    player.x = clamp(player.x, player.r + 10, W - player.r - 10);

    // salto simple
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
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(player.x, player.baseY + player.r + 14, player.r * 1.06, player.r * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // halo colorido
    const pulse = 1 + Math.sin(ts / 380) * 0.05;
    ctx.fillStyle = "rgba(255, 105, 180, 0.12)";
    ctx.beginPath();
    ctx.arc(player.x, player.y, (player.r + 10) * pulse, 0, Math.PI * 2);
    ctx.fill();

    // recorte circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.clip();

    if (ready) {
      const size = player.r * 2;
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, player.x - dw / 2, player.y - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fillRect(player.x - player.r, player.y - player.r, player.r * 2, player.r * 2);
    }
    ctx.restore();

    // borde
    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.stroke();

    // “stun” overlay
    if (player.stun > 0) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "rgba(239,68,68,1)";
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Pointer drag
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
    canvas.setPointerCapture(evt.pointerId);
    const p = canvasPoint(evt);
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

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  /* ===========================
     Falling things: words + bonus + thorns
  =========================== */
  let wordPool = null; // por personaje

  function makeWordPool(charId) {
    const b = BANK[charId];
    const pool = [];
    b.sujeto.forEach(t => pool.push({ t, kind: "sujeto" }));
    b.verbo.forEach(t => pool.push({ t, kind: "verbo" }));
    b.objeto.forEach(t => pool.push({ t, kind: "objeto" }));
    b.lugar.forEach(t => pool.push({ t, kind: "lugar" }));
    b.adjetivo.forEach(t => pool.push({ t, kind: "adjetivo" }));
    return pool;
  }

  function pickWord(kind) {
    // sin repetición tonta: filtramos por kind y elegimos
    const list = wordPool.filter(x => x.kind === kind);
    return pick(list).t;
  }

  function randomWordWeighted() {
    // 78% la palabra que toca (para coherencia)
    // 18% distractor útil
    // 4% distractor loco
    const need = expectedKind();
    const r = Math.random();

    if (r < 0.78) return { kind: need, text: pickWord(need), important: isImportant(need) };

    if (r < 0.96) {
      const alt = pick(TEMPLATE.filter(k => k !== need));
      return { kind: alt, text: pickWord(alt), important: isImportant(alt) };
    }

    // “random total”
    const any = pick(TEMPLATE);
    return { kind: any, text: pickWord(any), important: isImportant(any) };
  }

  let items = []; // burbujas
  let spawnAcc = 0;

  function spawnItem() {
    // 10% espinas, 12% bonus, resto palabras
    const roll = Math.random();

    if (roll < 0.10) {
      items.push({
        type: "thorn",
        x: rand(40, W - 40),
        y: -30,
        r: rand(14, 18),
        vy: rand(170, 250),
        wob: rand(0, Math.PI * 2)
      });
      return;
    }

    if (roll < 0.22) {
      items.push({
        type: "bonus",
        x: rand(40, W - 40),
        y: -30,
        r: rand(14, 18),
        vy: rand(160, 235),
        wob: rand(0, Math.PI * 2)
      });
      return;
    }

    const w = randomWordWeighted();
    ctx.font = "900 18px system-ui";
    const padX = 14;
    const bw = ctx.measureText(w.text).width + padX * 2;
    const bh = 38;

    items.push({
      type: "word",
      kind: w.kind,
      text: w.text,
      important: w.important || (Math.random() < 0.18),
      x: rand(20, W - bw - 20),
      y: -bh - rand(10, 60),
      w: bw,
      h: bh,
      vy: rand(125, 215),
      wob: rand(0, Math.PI * 2)
    });
  }

  function drawWordBubble(b, ts) {
    const wobX = Math.sin(ts / 420 + b.wob) * 3;

    if (b.important) {
      ctx.save();
      ctx.shadowColor = "rgba(34,211,238,.95)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255,.98)";
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "rgba(255,105,180,.70)";
      ctx.lineWidth = 2;
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,.92)";
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,.10)";
      ctx.lineWidth = 1;
      roundRect(ctx, b.x + wobX, b.y, b.w, b.h, 14);
      ctx.stroke();
    }

    // label
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "rgba(124,58,237,.85)";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(LABEL[b.kind].toUpperCase(), b.x + wobX + 12, b.y - 4);
    ctx.globalAlpha = 1;

    // text
    ctx.fillStyle = "rgba(31,36,48,.95)";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.x + wobX + 14, b.y + b.h / 2);
  }

  function drawBonus(x, y, r, ts) {
    const wob = Math.sin(ts / 220) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(34,211,238,.95)";
    ctx.beginPath();
    ctx.arc(0, 0, r + wob, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+1s", 0, 0);
    ctx.restore();
  }

  function drawThorn(x, y, r, ts) {
    const wob = Math.sin(ts / 240) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(239,68,68,.92)";
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(0, -r - wob);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r + wob);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (cr * cr);
  }

  function collideCircleCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = (ar + br) * (ar + br);
    return (dx * dx + dy * dy) <= rr;
  }

  /* ===========================
     Forest (árboles)
  =========================== */
  let trees = [];

  function plantTree() {
    // Planta un árbol por oración completa
    const x = rand(60, W - 60);
    const baseY = H - 26;
    trees.push({
      x,
      baseY,
      h: 0,
      targetH: rand(70, 130),
      sway: rand(0, Math.PI * 2),
      hue: rand(140, 320),
    });
  }

  function drawForest(ts) {
    // suelo
    const g = ctx.createLinearGradient(0, H - 70, 0, H);
    g.addColorStop(0, "rgba(16,185,129,.18)");
    g.addColorStop(1, "rgba(34,197,94,.32)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 70, W, 70);

    // árboles
    for (const t of trees) {
      t.h = Math.min(t.targetH, t.h + 120 * (1 / 60)); // crecimiento suave
      const sway = Math.sin(ts / 900 + t.sway) * 6;

      // tronco
      ctx.strokeStyle = "rgba(120, 53, 15, .85)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(t.x, t.baseY);
      ctx.lineTo(t.x + sway * 0.3, t.baseY - t.h);
      ctx.stroke();

      // copa
      ctx.fillStyle = `hsla(${t.hue}, 85%, 55%, .85)`;
      ctx.beginPath();
      ctx.arc(t.x + sway, t.baseY - t.h, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${t.hue + 30}, 90%, 60%, .55)`;
      ctx.beginPath();
      ctx.arc(t.x + sway * 0.6 + 16, t.baseY - t.h + 8, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===========================
     Background (más animado + colorido)
  =========================== */
  let sparkles = [];
  function addSparkle(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(90, 260);
      sparkles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(2, 5),
        life: rand(0.35, 0.75),
        hue: rand(160, 330),
      });
    }
  }

  function updateSparkles(dt) {
    sparkles = sparkles.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - dt * 3);
      p.vy *= (1 - dt * 3);
      p.vy += 350 * dt;
      return p.life > 0;
    });
  }

  function drawSparkles() {
    for (const p of sparkles) {
      ctx.globalAlpha = clamp(p.life / 0.75, 0, 1);
      ctx.fillStyle = `hsla(${p.hue}, 95%, 60%, .95)`;
      ctx.beginPath();
      ctx.arc(p.x, p_toggle(p.y), p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    function p_toggle(y){ return y; }
  }

  function drawBackground(ts) {
    // cielo vibrante
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "rgba(255, 210, 255, 1)");
    sky.addColorStop(0.45, "rgba(196, 250, 255, 1)");
    sky.addColorStop(1, "rgba(255, 255, 255, 1)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ondas de color
    ctx.fillStyle = "rgba(124,58,237,.14)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 150);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 150 + Math.sin((x / 130) + ts / 900) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(34,211,238,.16)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 110);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 110 + Math.sin((x / 110) + ts / 820 + 1.2) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // texto de guía arriba
    ctx.fillStyle = "rgba(17,24,39,.70)";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Buscá ahora: ${LABEL[expectedKind()]}`, 16, 12);
  }

  /* ===========================
     Game rules / challenge
  =========================== */
  const GAME_SECONDS = 90;
  let timeLeft = GAME_SECONDS;
  let running = false;
  let lastTs = 0;

  let combo = 0;

  function scoreForWord(isGlow) {
    const base = isGlow ? 2 : 1;
    const mult = clamp(1 + (combo - 1) * 0.25, 1, 3);
    return base * mult;
  }

  function punishWrong() {
    combo = 0;
    timeLeft = Math.max(0, timeLeft - 2); // castigo
  }

  function collectBonus(x, y) {
    // bonus: +1.2s + sparkles
    timeLeft = Math.min(GAME_SECONDS, timeLeft + 1.2);
    addSparkle(x, y, 14);
    playSfx(0.75);
  }

  function hitThorn(x, y) {
    // castigo: -2.5s + stun
    timeLeft = Math.max(0, timeLeft - 2.5);
    combo = 0;
    player.stun = 0.45;
    addSparkle(x, y, 12);
    playSfx(0.55);
  }

  /* ===========================
     Update & Render loop
  =========================== */
  function resetGameState() {
    // story
    sentences = [];
    current = [];
    step = 0;
    caught = 0;
    combo = 0;

    // items
    items = [];
    spawnAcc = 0;
    sparkles = [];

    // player
    player.x = W * 0.5;
    player.y = player.baseY;
    player.jumpV = 0;
    player.dragging = false;
    player.stun = 0;

    // forest
    trees = [];

    // time
    timeLeft = GAME_SECONDS;

    endOverlay.hidden = true;
    refreshStoryUI();
  }

  function endGame() {
    running = false;
    stopMusic();
    endStory.textContent = composeStory() || "Todavía no atrapaste palabras.";
    endOverlay.hidden = false;
    refreshStoryUI();
  }

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
      return;
    }

    updatePlayer(dt);
    updateSparkles(dt);

    // spawn: más rápido con combo, y tope de items
    spawnAcc += dt;
    const spawnEvery = clamp(0.62 - (combo * 0.03), 0.34, 0.62);
    if (spawnAcc >= spawnEvery) {
      spawnAcc = 0;
      if (items.length < 12) spawnItem();
    }

    // mover items y colisiones
    items = items.filter(it => {
      if (it.type === "word") {
        it.y += it.vy * dt;

        if (collideCircleRect(player.x, player.y, player.r, it.x, it.y, it.w, it.h)) {
          const need = expectedKind();
          if (it.kind === need) {
            combo = Math.min(20, combo + 1);
            addWord(it.text);
            playSfx(it.important ? 0.95 : 0.85);
            jump(-340);
            addSparkle(it.x + it.w / 2, it.y + it.h / 2, it.important ? 18 : 10);

            // si es “brillante” suma tiempo
            if (it.important) timeLeft = Math.min(GAME_SECONDS, timeLeft + 0.6);

          } else {
            punishWrong();
            addSparkle(it.x + it.w / 2, it.y + it.h / 2, 8);
          }
          return false;
        }
        return it.y < H + 60;
      }

      // bonus / thorn
      it.y += it.vy * dt;
      const wob = Math.sin((lastTs * 0.001) * 2 + it.wob) * 5;
      const cx = it.x + wob;
      const cy = it.y;

      if (collideCircleCircle(player.x, player.y, player.r, cx, cy, it.r)) {
        if (it.type === "bonus") collectBonus(cx, cy);
        else hitThorn(cx, cy);
        jump(-290);
        return false;
      }

      return it.y < H + 60;
    });

    refreshStoryUI();
  }

  function render(ts) {
    drawBackground(ts);
    drawForest(ts);

    // items
    for (const it of items) {
      if (it.type === "word") drawWordBubble(it, ts);
      else if (it.type === "bonus") drawBonus(it.x, it.y, it.r, ts);
      else drawThorn(it.x, it.y, it.r, ts);
    }

    drawSparkles();
    drawPlayer(ts);
  }

  function loop(ts) {
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;

    if (running) update(dt);
    render(ts);

    if (!gameWrap.hidden) requestAnimationFrame(loop);
  }

  /* ===========================
     Flow / UI actions
  =========================== */
  function startGame() {
    playerName = (playerNameInput.value || "").trim().slice(0, 18);
    selectedCharMeta = characters.find(c => c.id === selectedCharId);

    wordPool = makeWordPool(selectedCharId);

    playerNameHud.textContent = playerName || "—";
    charHud.textContent = selectedCharMeta ? `${selectedCharMeta.label} — ${selectedCharMeta.desc}` : "—";
    promptLine.textContent = BANK[selectedCharId].prompt;

    resetGameState();

    // spawn inicial
    for (let i = 0; i < 7; i++) spawnItem();

    menu.hidden = true;
    gameWrap.hidden = false;

    running = true;
    playMusic();
    requestAnimationFrame(loop);
  }

  function backToMenu() {
    running = false;
    stopMusic();
    endOverlay.hidden = true;
    gameWrap.hidden = true;
    menu.hidden = false;

    // reset HUD visible
    playerNameHud.textContent = "—";
    charHud.textContent = "—";
    countHud.textContent = "0";
    comboHud.textContent = "—";
    timeHud.textContent = String(GAME_SECONDS);
  }

  function playAgain() {
    endOverlay.hidden = true;
    resetGameState();
    running = true;
    playMusic();
  }

  startBtn.addEventListener("click", startGame);
  backBtn.addEventListener("click", backToMenu);
  againBtn.addEventListener("click", playAgain);

  undoBtn.addEventListener("click", undoWord);
  clearBtn.addEventListener("click", clearStory);
  copyBtn.addEventListener("click", copyStory);
  pdfBtn.addEventListener("click", exportPdf);

  endCopyBtn.addEventListener("click", copyStory);
  endPdfBtn.addEventListener("click", exportPdf);

  howBtn.addEventListener("click", () => helpDialog.showModal());
  closeHelp.addEventListener("click", () => helpDialog.close());

  /* ===========================
     Init
  =========================== */
  renderCharacterGrid();
  validateStart();
  syncMuteUi();
  refreshStoryUI();
  timeHud.textContent = String(GAME_SECONDS);
  menu.hidden = false;
  gameWrap.hidden = true;
})();
