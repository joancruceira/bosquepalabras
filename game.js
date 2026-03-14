(() => {
  "use strict";

  // ============================================================
  // DOM REFS
  // ============================================================
  const menu           = document.getElementById("menu");
  const gameWrap       = document.getElementById("gameWrap");
  const canvas         = document.getElementById("canvas");
  const ctx            = canvas.getContext("2d", { alpha: true });
  const confettiCanvas = document.getElementById("confettiCanvas");
  const confettiCtx    = confettiCanvas.getContext("2d");

  const charGrid       = document.getElementById("charGrid");
  const playerNameInput= document.getElementById("playerName");
  const startBtn       = document.getElementById("startBtn");
  const backBtn        = document.getElementById("backBtn");
  const muteBtn        = document.getElementById("muteBtn");
  const howBtn         = document.getElementById("howBtn");
  const helpDialog     = document.getElementById("helpDialog");
  const closeHelp      = document.getElementById("closeHelp");
  const menuNote       = document.getElementById("menuNote");

  const playerNameHud  = document.getElementById("playerNameHud");
  const charHud        = document.getElementById("charHud");
  const countHud       = document.getElementById("countHud");
  const timeHud        = document.getElementById("timeHud");
  const scoreHud       = document.getElementById("scoreHud");
  const streakHud      = document.getElementById("streakHud");
  const streakBadge    = document.getElementById("streakBadge");
  const recordHud      = document.getElementById("recordHud");

  const storyText      = document.getElementById("storyText");
  const promptLine     = document.getElementById("promptLine");
  const templateLine   = document.getElementById("templateLine");

  const undoBtn        = document.getElementById("undoBtn");
  const clearBtn       = document.getElementById("clearBtn");
  const copyBtn        = document.getElementById("copyBtn");
  const pdfBtn         = document.getElementById("pdfBtn");

  const endOverlay     = document.getElementById("endOverlay");
  const endStory       = document.getElementById("endStory");
  const endTitle       = document.getElementById("endTitle");
  const endSub         = document.getElementById("endSub");
  const endScore       = document.getElementById("endScore");
  const endWords       = document.getElementById("endWords");
  const endSentences   = document.getElementById("endSentences");
  const endStreak      = document.getElementById("endStreak");
  const endRecordBadge = document.getElementById("endRecordBadge");
  const endCopyBtn     = document.getElementById("endCopyBtn");
  const endPdfBtn      = document.getElementById("endPdfBtn");
  const againBtn       = document.getElementById("againBtn");

  const timeBarWrap    = document.getElementById("timeBarWrap");
  const timeBar        = document.getElementById("timeBar");
  const recordToast    = document.getElementById("recordToast");

  // ============================================================
  // HELPERS
  // ============================================================
  const rand  = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a, b, t) => a + (b - a) * t;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ============================================================
  // CANVAS SIZING (HiDPI)
  // ============================================================
  const W = 900, H = 520;

  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Confetti canvas fullscreen
  function resizeConfetti() {
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  resizeConfetti();
  window.addEventListener("resize", resizeConfetti);

  // ============================================================
  // AUDIO
  // ============================================================
  const music = new Audio("fondo.mp3");
  music.loop   = true;
  music.volume = 0.32;

  let muted = false;

  function playMusic()  { if (!muted && music.paused) music.play().catch(() => {}); }
  function stopMusic()  { music.pause(); music.currentTime = 0; }
  function pauseMusic() { music.pause(); }

  function playSfx(src, vol = 0.8) {
    if (muted) return;
    const s = new Audio(src);
    s.volume = vol;
    s.play().catch(() => {});
  }

  function syncMuteUi() {
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.textContent = `Sonido: ${muted ? "OFF" : "ON"}`;
    if (muted) pauseMusic();
    else if (running) playMusic();
  }

  // ============================================================
  // CHARACTERS
  // ============================================================
  const characters = [
    {
      id: "ciela",     label: "Ciela",     desc: "La sabia",      imageSrc: "ciela.png",
      skill: "Pista extra",
      skillDesc: "El tipo de palabra brilla más tiempo",
      color: "#7c3aed",
      ability: "hint"          // muestra label más tiempo
    },
    {
      id: "nuve",      label: "Nuve",      desc: "La tranquila",  imageSrc: "nuve.png",
      skill: "Tiempo lento",
      skillDesc: "Las palabras caen más despacio",
      color: "#06b6d4",
      ability: "slow"          // palabras 20% más lentas
    },
    {
      id: "nuveciela", label: "Nuveciela", desc: "La fuerte",     imageSrc: "nuveciela.png",
      skill: "Alcance amplio",
      skillDesc: "Radio de captura más grande",
      color: "#ec4899",
      ability: "reach"         // radio de colisión +30%
    },
    {
      id: "lunaria",   label: "Lunaria",   desc: "La inventora",  imageSrc: "lunaria.png",
      skill: "Comodín",
      skillDesc: "Una de cada 5 palabras vale para cualquier slot",
      color: "#f59e0b",
      ability: "wild"          // palabras comodín ocasionales
    },
  ];

  const imageCache = new Map();
  for (const c of characters) {
    const img = new Image();
    img.src = c.imageSrc;
    imageCache.set(c.id, img);
  }

  let selectedCharId   = null;
  let selectedCharMeta = null;
  let playerName       = "";

  function renderCharacterGrid() {
    charGrid.innerHTML = "";
    for (const c of characters) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "char";
      btn.setAttribute("aria-selected", "false");

      btn.innerHTML = `
        <div class="avatar">
          <img src="${c.imageSrc}" alt="${c.label}" onerror="this.remove()">
        </div>
        <div class="meta">
          <div class="name">${c.label}</div>
          <div class="desc">${c.desc}</div>
          <div class="skill-tag">✦ ${c.skill}</div>
        </div>`;

      btn.addEventListener("click", () => {
        selectedCharId   = c.id;
        selectedCharMeta = c;
        charGrid.querySelectorAll(".char").forEach(x => x.setAttribute("aria-selected", "false"));
        btn.setAttribute("aria-selected", "true");
        validateStart();
      });

      charGrid.appendChild(btn);
    }
  }

  function validateStart() {
    const ok = (playerNameInput.value || "").trim().length >= 1 && !!selectedCharId;
    startBtn.disabled = !ok;
    menuNote.textContent = ok ? `¡Listo! Tocá "¡Empezar!"` : "Elegí un personaje y escribí tu nombre.";
  }
  playerNameInput.addEventListener("input", validateStart);

  // ============================================================
  // WORD BANKS
  // ============================================================
  const WORDBANK = {
    ciela: {
      prompt: "Ciela (la sabia): armá una historia con pistas y sentido.",
      templates: [
        ["sujeto","verbo","cosa","lugar","adj"],
        ["sujeto","adj","verbo","cosa","lugar"],
      ],
      sujetos:   ["Ciela","una maestra","un libro","una brújula","una pregunta","un farol","un mapa","un consejo","una carta","un cuaderno","un reloj","una llave","un secreto","una biblioteca","una señal","una nota","un mensaje","una pista","un camino","un misterio"],
      verbos:    ["descifra","ordena","explica","comprende","elige","recuerda","observa","encuentra","interpreta","conecta","aclara","resuelve","anota","pregunta","aprende","guía"],
      cosas:     ["una idea","una pista escondida","una verdad","una palabra justa","un plan","una respuesta","un acertijo","un dibujo","un cuento","una promesa","un método","una lección","una señal"],
      lugares:   ["en la biblioteca","en el bosque","bajo la luna","junto al río","en un aula secreta","en un pasillo largo","entre árboles","cerca del mar","en una plaza tranquila","en un rincón","en la tarde"],
      adjetivos: ["clara","sabia","precisa","profunda","paciente","atenta","serena","lúcida","justa","tranquila","firme"],
    },
    nuve: {
      prompt: "Nuve (la tranquila): armá una historia suave y luminosa.",
      templates: [
        ["sujeto","verbo","cosa","lugar","adj"],
        ["sujeto","verbo","adj","cosa","lugar"],
      ],
      sujetos:   ["Nuve","una nube","una brisa","un susurro","una estrella lenta","un abrazo","una pluma","una canción","una manta","un atardecer","una hoja","una luz","un sueño"],
      verbos:    ["flota","respira","acompaña","calma","espera","sonríe","escucha","sueña","cuida","pasea","descansa","brilla","susurra","abraza","se queda"],
      cosas:     ["una paz","una melodía","una luz tibia","una promesa","un té","un refugio","un silencio","una risa","un latido","una caricia","una nube suave"],
      lugares:   ["en la tarde","en el cielo","en un jardín","cerca del mar","bajo una manta","en una siesta","junto a la ventana","entre flores","en la lluvia suave","en un patio"],
      adjetivos: ["suave","tranquila","lenta","cálida","amable","delicada","serena","ligera","tierna","tibia","dulce"],
    },
    nuveciela: {
      prompt: "Nuveciela (la fuerte): armá una historia valiente y con decisión.",
      templates: [
        ["sujeto","verbo","cosa","lugar","adj"],
        ["sujeto","adj","verbo","lugar","cosa"],
      ],
      sujetos:   ["Nuveciela","una guardiana","una tormenta","un escudo","una montaña","una amiga","un juramento","una linterna","un fuego","una puerta","una bandera","un camino","un desafío","un corazón"],
      verbos:    ["protege","enfrenta","resiste","levanta","decide","defiende","avanza","salva","rompe","sostiene","aguanta","encuentra","empuja","abre","cruza"],
      cosas:     ["una fuerza","una chispa","una llave","un mensaje","un objetivo","una prueba","una victoria","una promesa","un amuleto","una salida","una señal"],
      lugares:   ["en la noche","en la cima","en el bosque","en un puente","bajo la lluvia","entre sombras","en el viento","en un pasaje","en una plaza vacía","en el borde del camino"],
      adjetivos: ["valiente","firme","decidida","leal","poderosa","audaz","imparable","noble","segura","intensa"],
    },
    lunaria: {
      prompt: "Lunaria (la inventora): armá una historia rara y creativa.",
      templates: [
        ["sujeto","verbo","cosa","lugar","adj"],
        ["sujeto","adj","verbo","cosa","lugar"],
      ],
      sujetos:   ["Lunaria","un robot","un engranaje","una antena","un telescopio","una máquina","un rayo","un circuito","un botón","un plano","un imán","un dron","una chispa","un motor"],
      verbos:    ["inventa","construye","mezcla","prueba","enciende","calibra","transforma","programa","ajusta","conecta","repara","reinicia","descubre","ensambla","experimenta"],
      cosas:     ["un prototipo","una fórmula","un truco","un mapa estelar","una pieza nueva","un código","una idea brillante","un mecanismo","un plan extraño","una señal eléctrica","un botón secreto"],
      lugares:   ["en el taller","en un laboratorio","en la luna","entre cables","bajo una lámpara","en un garaje secreto","en una mesa llena","en una sala","en un hangar","en el cielo"],
      adjetivos: ["curiosa","eléctrica","nueva","extraña","brillante","imposible","genial","rara","futurista","magnética"],
    }
  };

  // Colores por tipo de slot
  const SLOT_COLORS = {
    sujeto: { bg: "rgba(124,58,237,.15)", stroke: "rgba(124,58,237,.55)", text: "#5b21b6", label: "#7c3aed" },
    verbo:  { bg: "rgba(8,145,178,.13)",  stroke: "rgba(8,145,178,.50)",  text: "#155e75", label: "#0891b2" },
    cosa:   { bg: "rgba(217,119,6,.14)",  stroke: "rgba(217,119,6,.52)",  text: "#92400e", label: "#d97706" },
    lugar:  { bg: "rgba(22,163,74,.12)",  stroke: "rgba(22,163,74,.48)",  text: "#14532d", label: "#16a34a" },
    adj:    { bg: "rgba(219,39,119,.13)", stroke: "rgba(219,39,119,.50)", text: "#831843", label: "#db2777" },
    wild:   { bg: "rgba(245,158,11,.18)", stroke: "rgba(245,158,11,.70)", text: "#78350f", label: "#f59e0b" },
  };

  const TEMPLATE_LABEL = { sujeto:"Sujeto", verbo:"Verbo", cosa:"Cosa", lugar:"Lugar", adj:"Adjetivo" };

  // ============================================================
  // Template system (per character, multiple templates)
  // ============================================================
  let TEMPLATE   = ["sujeto","verbo","cosa","lugar","adj"];
  let slotIndex  = 0;

  function pickTemplate(charId) {
    const ts = WORDBANK[charId].templates;
    TEMPLATE = ts[Math.floor(Math.random() * ts.length)];
    slotIndex = 0;
  }

  function expectedKind() { return TEMPLATE[slotIndex] || "sujeto"; }

  function templateText() {
    return TEMPLATE.map((k, i) =>
      i === slotIndex
        ? `→ [${TEMPLATE_LABEL[k]}]`
        : TEMPLATE_LABEL[k]
    ).join("  •  ");
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function buildSentence(charId, slots) {
    const S = slots.sujeto || "Alguien";
    const V = slots.verbo  || "hace";
    const C = slots.cosa   || "algo";
    const L = slots.lugar  || "en algún lugar";
    const A = slots.adj    || "mágico";

    if (charId === "ciela")     return `${cap(S)} ${V} ${C} ${L}, y todo se vuelve ${A}.`;
    if (charId === "nuve")      return `${cap(S)} ${V} ${C} ${L}, muy ${A}.`;
    if (charId === "nuveciela") return `${cap(S)} ${V} ${C} ${L}, y sigue ${A}.`;
    return `${cap(S)} ${V} ${C} ${L}, algo ${A}.`;
  }

  // ============================================================
  // BAG SYSTEM
  // ============================================================
  let poolByKind   = null;
  let bagByKind    = null;
  let recentGlobal = [];
  const RECENT_BLOCK = 7;

  function buildPoolsForChar(charId) {
    const b = WORDBANK[charId];
    poolByKind = {
      sujeto: b.sujetos.map(t => ({ t, kind:"sujeto" })),
      verbo:  b.verbos.map(t  => ({ t, kind:"verbo"  })),
      cosa:   b.cosas.map(t   => ({ t, kind:"cosa"   })),
      lugar:  b.lugares.map(t => ({ t, kind:"lugar"  })),
      adj:    b.adjetivos.map(t => ({ t, kind:"adj"  })),
    };
    bagByKind    = { sujeto:[], verbo:[], cosa:[], lugar:[], adj:[] };
    for (const k of Object.keys(bagByKind)) refillBag(k);
    recentGlobal = [];
  }

  function refillBag(kind) {
    bagByKind[kind] = shuffle(poolByKind[kind].slice());
  }

  function takeFromBag(kind) {
    if (!bagByKind || !poolByKind) return null;
    if (!bagByKind[kind] || bagByKind[kind].length === 0) refillBag(kind);
    for (let tries = 0; tries < 10; tries++) {
      if (bagByKind[kind].length === 0) refillBag(kind);
      const item = bagByKind[kind].pop();
      if (!item) return null;
      if (!recentGlobal.includes(item.t)) return item;
      bagByKind[kind].unshift(item);
    }
    if (bagByKind[kind].length === 0) refillBag(kind);
    return bagByKind[kind].pop() || null;
  }

  function rememberGlobal(text) {
    recentGlobal.push(text);
    if (recentGlobal.length > RECENT_BLOCK) recentGlobal.shift();
  }

  // ============================================================
  // STORY STATE
  // ============================================================
  let sentences  = [];
  let slots      = {};
  let caughtCount = 0;

  function resetSlots() {
    slots = {};
    TEMPLATE.forEach(k => { slots[k] = null; });
    slotIndex = 0;
  }

  function pushSentenceIfComplete() {
    if (TEMPLATE.every(k => !!slots[k])) {
      sentences.push(buildSentence(selectedCharId, slots));
      // Nuevo template aleatorio para la siguiente frase
      pickTemplate(selectedCharId);
      resetSlots();
      return true;
    }
    return false;
  }

  function storyString() {
    const done = sentences.slice();
    const partialParts = TEMPLATE.filter(k => slots[k]).map(k => slots[k]);
    if (partialParts.length) done.push(cap(partialParts.join(" ")) + "…");
    return done.join(" ");
  }

  function refreshStoryText() {
    const t = storyString().trim();
    storyText.textContent = t.length ? t : "Mové tu personaje para atrapar palabras…";
    countHud.textContent  = String(caughtCount);
    scoreHud.textContent  = String(score);
    streakHud.textContent = String(streak);
    templateLine.textContent = templateText();

    // Botones habilitados sólo cuando hay historia
    const hasStory = sentences.length > 0;
    copyBtn.disabled = !hasStory;
    pdfBtn.disabled  = !hasStory;
  }

  function undoWord() {
    for (let i = TEMPLATE.length - 1; i >= 0; i--) {
      const k = TEMPLATE[i];
      if (slots[k]) {
        slots[k] = null;
        slotIndex = Math.max(0, i);
        caughtCount = Math.max(0, caughtCount - 1);
        streak = Math.max(0, streak - 1);
        refreshStoryText();
        return;
      }
    }
    if (sentences.length > 0) {
      sentences.pop();
      refreshStoryText();
    }
  }

  function clearStory() {
    sentences = [];
    resetSlots();
    caughtCount = 0;
    score  = 0;
    streak = 0;
    refreshStoryText();
  }

  async function copyStory() {
    const txt = sentences.join(" ").trim();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      const btn = event.target;
      const orig = btn.textContent;
      btn.textContent = "¡Copiado!";
      setTimeout(() => (btn.textContent = orig), 900);
    } catch { /* ignore */ }
  }

  async function exportPdf() {
    const story = sentences.join(" ").trim();
    if (!story) return;
    const jspdf = window.jspdf?.jsPDF;
    if (!jspdf) { alert("No se cargó jsPDF. Verificá estar online."); return; }

    const doc  = new jspdf({ unit:"pt", format:"a4" });
    const marg = 48;
    let y = marg;

    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.text("Nuvecielas — Bosque de las Palabras", marg, y); y += 26;

    doc.setFont("helvetica","normal");
    doc.setFontSize(12);
    doc.text(`Jugador: ${playerName || "—"}   |   Personaje: ${selectedCharMeta?.label || "—"}   |   Puntos: ${score}`, marg, y); y += 18;
    doc.text(`Palabras: ${caughtCount}   |   Frases: ${sentences.length}`, marg, y); y += 20;

    // Imagen del personaje
    const img   = imageCache.get(selectedCharId);
    const ready = img && img.complete && img.naturalWidth > 0;
    if (ready) {
      const oc = document.createElement("canvas");
      const s = 200; oc.width = s; oc.height = s;
      const ox = oc.getContext("2d");
      ox.save(); ox.beginPath(); ox.arc(s/2,s/2,s/2,0,Math.PI*2); ox.clip();
      const sc = Math.max(s/img.naturalWidth, s/img.naturalHeight);
      ox.drawImage(img, s/2-img.naturalWidth*sc/2, s/2-img.naturalHeight*sc/2, img.naturalWidth*sc, img.naturalHeight*sc);
      ox.restore();
      doc.addImage(oc.toDataURL("image/png"), "PNG", 400, marg, 150, 150);
    }

    doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text("Historia", marg, y); y += 16;
    doc.setFont("helvetica","normal"); doc.setFontSize(12);
    doc.text(doc.splitTextToSize(story, 490), marg, y);
    doc.save("nuvecielas-historia.pdf");
  }

  // ============================================================
  // SCORE SYSTEM
  // ============================================================
  let score     = 0;
  let streak    = 0;
  let maxStreak = 0;
  const SCORE_BASE       = 10;
  const SCORE_STREAK_MUL = 0.5;  // +50% per consecutive catch
  const SCORE_SENTENCE   = 50;
  const TIME_BONUS       = 5;    // seconds added per complete sentence

  function addScore(isCorrect) {
    if (!isCorrect) { streak = 0; streakBadge.classList.remove("pop"); return; }
    streak++;
    if (streak > maxStreak) maxStreak = streak;
    const mul = 1 + Math.min(streak - 1, 8) * SCORE_STREAK_MUL;
    score += Math.round(SCORE_BASE * mul);

    // Pop animation on streak badge
    streakBadge.classList.remove("pop");
    void streakBadge.offsetWidth;
    streakBadge.classList.add("pop");
  }

  // localStorage best score
  function getBestScore(charId) {
    return parseInt(localStorage.getItem(`nuve_best_${charId}`) || "0", 10);
  }
  function setBestScore(charId, val) {
    localStorage.setItem(`nuve_best_${charId}`, String(val));
  }
  function updateRecordHud() {
    const best = getBestScore(selectedCharId);
    recordHud.textContent = best > 0 ? String(best) : "—";
  }

  function showRecordToast() {
    recordToast.classList.add("show");
    setTimeout(() => recordToast.classList.remove("show"), 2800);
  }

  // ============================================================
  // PARTICLES (canvas particles for word capture + confetti)
  // ============================================================
  let particles = [];

  function spawnParticles(x, y, kind, count = 10) {
    const col = SLOT_COLORS[kind] || SLOT_COLORS.sujeto;
    const colors = [col.stroke, col.label, "#ffffff", col.bg];
    for (let i = 0; i < count; i++) {
      const angle  = (Math.PI * 2 * i / count) + rand(-0.4, 0.4);
      const speed  = rand(120, 280);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(60, 140),
        r:  rand(3, 7),
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life:  rand(0.4, 0.7),
        maxLife: 0,
      });
      particles[particles.length-1].maxLife = particles[particles.length-1].life;
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 500 * dt;       // gravity
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ============================================================
  // CONFETTI (full-screen for sentence complete)
  // ============================================================
  let confettiPieces = [];
  let confettiActive = false;
  let confettiTimer  = 0;

  function launchConfetti(duration = 1.5) {
    confettiActive = true;
    confettiTimer  = duration;
    for (let i = 0; i < 90; i++) {
      confettiPieces.push({
        x:     rand(0, window.innerWidth),
        y:     rand(-80, -10),
        vx:    rand(-60, 60),
        vy:    rand(200, 420),
        angle: rand(0, Math.PI * 2),
        av:    rand(-4, 4),
        w:     rand(7, 14),
        h:     rand(4, 8),
        color: [
          `hsl(${Math.floor(rand(250,300))},90%,65%)`,
          `hsl(${Math.floor(rand(180,220))},85%,60%)`,
          `hsl(${Math.floor(rand(320,360))},85%,65%)`,
          `hsl(${Math.floor(rand(35,60))},90%,60%)`,
          `hsl(${Math.floor(rand(90,140))},80%,58%)`,
        ][Math.floor(Math.random() * 5)],
        alpha: 1,
      });
    }
  }

  function updateConfetti(dt) {
    if (!confettiActive) return;
    confettiTimer -= dt;
    for (const p of confettiPieces) {
      p.x     += p.vx * dt;
      p.y     += p.vy * dt;
      p.angle += p.av * dt;
      if (confettiTimer < 0.6) p.alpha = Math.max(0, confettiTimer / 0.6);
    }
    confettiPieces = confettiPieces.filter(p => p.y < window.innerHeight + 50);
    if (confettiTimer <= 0 || confettiPieces.length === 0) {
      confettiActive = false;
      confettiPieces = [];
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  function drawConfetti() {
    if (!confettiActive) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (const p of confettiPieces) {
      confettiCtx.save();
      confettiCtx.globalAlpha = p.alpha;
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.angle);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      confettiCtx.restore();
    }
  }

  // ============================================================
  // PLAYER
  // ============================================================
  const keys = { left: false, right: false };
  let tapTargetX = null; // para control táctil por tap

  const player = {
    x:     W * 0.5,
    baseY: H - 78,
    y:     H - 78,
    r:     46,
    speed: 560,
    dragging: false,
    dragOffsetX: 0,
    jumpV: 0,
    shakeFrames: 0,
    shakeAmt: 0,
  };

  function getPlayerRadius() {
    const meta = selectedCharMeta;
    if (meta?.ability === "reach") return player.r * 1.32;
    return player.r;
  }

  function jump() { player.jumpV = -300; }

  function updatePlayer(dt) {
    // Tap-to-move
    if (tapTargetX !== null && !player.dragging) {
      const diff = tapTargetX - player.x;
      if (Math.abs(diff) < 4) { tapTargetX = null; }
      else { player.x += Math.sign(diff) * player.speed * dt; }
    }

    if (!player.dragging && tapTargetX === null) {
      const dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      player.x += dir * player.speed * dt;
    }
    player.x = clamp(player.x, player.r + 10, W - player.r - 10);

    player.jumpV += 1200 * dt;
    player.y     += player.jumpV * dt;
    if (player.y > player.baseY) { player.y = player.baseY; player.jumpV = 0; }

    if (player.shakeFrames > 0) {
      player.shakeFrames--;
      player.shakeAmt = player.shakeFrames > 0
        ? Math.sin(player.shakeFrames * 1.8) * 7
        : 0;
    }
  }

  function triggerShake() {
    player.shakeFrames = 10;
  }

  function drawPlayer(ts) {
    const img   = imageCache.get(selectedCharId);
    const ready = img && img.complete && img.naturalWidth > 0;
    const px    = player.x + player.shakeAmt;
    const py    = player.y;
    const pr    = player.r;
    const cr    = getPlayerRadius(); // visual hint if ability=reach

    // Sombra
    ctx.globalAlpha = 0.14;
    ctx.fillStyle   = "#111827";
    ctx.beginPath();
    ctx.ellipse(px, player.baseY + pr + 14, pr * 1.05, pr * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Halo pulsante (color del personaje)
    const charColor = selectedCharMeta?.color || "rgba(124,58,237,.18)";
    const pulse = 1 + Math.sin(ts / 480) * 0.035;
    ctx.fillStyle   = hexToRgba(charColor, 0.16);
    ctx.beginPath();
    ctx.arc(px, py, (cr + 10) * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Si ability=reach, anillo extra
    if (selectedCharMeta?.ability === "reach") {
      ctx.strokeStyle = hexToRgba(charColor, 0.22);
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(px, py, cr + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Recorte circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.clip();
    if (ready) {
      const size  = pr * 2;
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const dw = img.naturalWidth  * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, px - dw/2, py - dh/2, dw, dh);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillRect(px - pr, py - pr, pr*2, pr*2);
    }
    ctx.restore();

    // Borde
    ctx.strokeStyle = "rgba(0,0,0,.10)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ============================================================
  // POINTER / KEY controls
  // ============================================================
  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - rect.left) * (W / rect.width),
      y: (evt.clientY - rect.top)  * (H / rect.height),
    };
  }

  function hitPlayer(px, py) {
    const dx = px - player.x, dy = py - player.y;
    return (dx*dx + dy*dy) <= (player.r * player.r);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (gameWrap.hidden || !running) return;
    const p = canvasPoint(e);
    canvas.setPointerCapture(e.pointerId);
    if (hitPlayer(p.x, p.y)) {
      player.dragging    = true;
      player.dragOffsetX = p.x - player.x;
      tapTargetX         = null;
    } else {
      // Tap-to-move: move towards tapped x
      tapTargetX = p.x;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!player.dragging || !running) return;
    const p = canvasPoint(e);
    player.x = clamp(p.x - player.dragOffsetX, player.r + 10, W - player.r - 10);
  });

  canvas.addEventListener("pointerup",     () => { player.dragging = false; });
  canvas.addEventListener("pointercancel", () => { player.dragging = false; });

  window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft")  { keys.left  = true; tapTargetX = null; }
    if (e.key === "ArrowRight") { keys.right = true; tapTargetX = null; }
  });
  window.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft")  keys.left  = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  // ============================================================
  // WORDS FALLING
  // ============================================================
  let words    = [];
  let spawnAcc = 0;

  function getWordSpeed() {
    let base = rand(110, 195);
    // Lunaria no cambia; Nuve más lento; velocidad sube con frases completadas
    if (selectedCharMeta?.ability === "slow") base *= 0.78;
    const lvlBoost = Math.min(sentences.length * 0.07, 0.55);
    return base * (1 + lvlBoost);
  }

  function chooseWordForSpawn() {
    if (!poolByKind || !bagByKind) return null;
    const need = expectedKind();
    let kind = need;

    // 75% la que toca, 25% variedad
    if (Math.random() >= 0.75) {
      const alts = Object.keys(poolByKind);
      kind = alts[Math.floor(Math.random() * alts.length)];
    }
    if (!poolByKind[kind] || poolByKind[kind].length === 0) kind = need;

    // Lunaria: ocasional comodín (1 de cada 6 palabras)
    let isWild = false;
    if (selectedCharMeta?.ability === "wild" && Math.random() < 0.17) {
      isWild = true;
    }

    const item = takeFromBag(kind) || takeFromBag(need);
    if (!item) return null;
    if (isWild) return { ...item, kind: "wild", wildFor: item.kind };
    return item;
  }

  function spawnWord() {
    const item = chooseWordForSpawn();
    if (!item) return;

    const text = item.t;
    const kind = item.kind;
    const wildFor = item.wildFor || null;

    ctx.font = "900 17px Nunito, sans-serif";
    const padX = 15;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 38;
    const x = rand(20, W - w - 20);
    const y = -h - rand(10, 90);

    words.push({ text, kind, wildFor, x, y, w, h, vy: getWordSpeed(), wob: rand(0, Math.PI*2), rejectFlash: 0 });
  }

  function roundRect(c, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+rr,y); c.arcTo(x+w,y,x+w,y+h,rr); c.arcTo(x+w,y+h,x,y+h,rr);
    c.arcTo(x,y+h,x,y,rr); c.arcTo(x,y,x+w,y,rr); c.closePath();
    if (fill)   c.fill();
    if (stroke) c.stroke();
  }

  function drawWordBubble(b, ts) {
    const wobX  = Math.sin(ts / 400 + b.wob) * 3;
    const col   = SLOT_COLORS[b.kind] || SLOT_COLORS.sujeto;
    const bx    = b.x + wobX;

    // Flash de rechazo
    if (b.rejectFlash > 0) {
      ctx.save();
      ctx.shadowColor = "rgba(239,68,68,.9)";
      ctx.shadowBlur  = 16;
      ctx.fillStyle   = "rgba(254,202,202,.96)";
      roundRect(ctx, bx, b.y, b.w, b.h, 14, true, false);
      ctx.strokeStyle = "rgba(239,68,68,.80)";
      ctx.lineWidth   = 2;
      roundRect(ctx, bx, b.y, b.w, b.h, 14, false, true);
      ctx.restore();

      // Texto de error
      ctx.fillStyle    = "rgba(185,28,28,.90)";
      ctx.font         = "900 11px Nunito, sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("✗ " + TEMPLATE_LABEL[expectedKind()] + " primero", bx + b.w/2, b.y - 3);
      b.rejectFlash--;
    } else {
      // Fondo de color por tipo
      ctx.save();
      if (b.kind === "wild") {
        ctx.shadowColor = "rgba(245,158,11,.85)";
        ctx.shadowBlur  = 18;
      }
      ctx.fillStyle = col.bg;
      roundRect(ctx, bx, b.y, b.w, b.h, 14, true, false);
      ctx.restore();

      ctx.strokeStyle = col.stroke;
      ctx.lineWidth   = b.kind === "wild" ? 2.5 : 1.5;
      roundRect(ctx, bx, b.y, b.w, b.h, 14, false, true);

      // Estrella comodín
      if (b.kind === "wild") {
        ctx.fillStyle    = "rgba(245,158,11,.80)";
        ctx.font         = "900 11px Nunito, sans-serif";
        ctx.textAlign    = "right";
        ctx.textBaseline = "top";
        ctx.fillText("★", bx + b.w - 6, b.y + 3);
      }
    }

    // Etiqueta tipo
    const showLabel = (b.kind !== "wild") && (selectedCharMeta?.ability !== "hint" || true);
    if (showLabel) {
      ctx.globalAlpha  = 0.68;
      ctx.fillStyle    = col.label;
      ctx.font         = "900 10px Nunito, sans-serif";
      ctx.textAlign    = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText((TEMPLATE_LABEL[b.kind] || "").toUpperCase(), bx + 12, b.y - 3);
      ctx.globalAlpha  = 1;
    }

    // Texto de la palabra
    ctx.fillStyle    = col.text;
    ctx.font         = "900 17px Nunito, sans-serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, bx + 15, b.y + b.h/2);
  }

  function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx+rw);
    const closestY = clamp(cy, ry, ry+rh);
    const dx = cx - closestX, dy = cy - closestY;
    return (dx*dx + dy*dy) <= (cr*cr);
  }

  // ============================================================
  // BACKGROUND (forest theme)
  // ============================================================
  // Pre-generate tree positions
  const TREES = [];
  for (let i = 0; i < 9; i++) {
    TREES.push({
      x:     (i / 8) * (W + 60) - 30,
      layer: i % 3,  // 0=back 1=mid 2=front
      scale: 0.6 + (i % 3) * 0.22,
      wobOffset: rand(0, Math.PI * 2),
    });
  }
  TREES.sort((a,b) => a.layer - b.layer);

  function drawTree(x, baseY, scale, wob, layer) {
    const colors = [
      ["rgba(134,239,172,.22)","rgba(74,222,128,.28)"],  // back
      ["rgba(34,197,94,.30)","rgba(21,128,61,.35)"],     // mid
      ["rgba(22,163,74,.35)","rgba(20,83,45,.40)"],      // front
    ];
    const [c1,c2] = colors[layer] || colors[0];

    // Tronco
    const tw = 12 * scale;
    ctx.fillStyle = layer === 2 ? "rgba(101,67,33,.30)" : "rgba(101,67,33,.18)";
    ctx.beginPath();
    ctx.rect(x - tw/2, baseY - 60*scale, tw, 60*scale);
    ctx.fill();

    // Copa (triángulos apilados)
    for (let t = 0; t < 3; t++) {
      const ty   = baseY - 60*scale - (t * 55*scale) - 10*scale;
      const tw2  = (90 - t*18) * scale;
      const th2  = 70 * scale;
      const wobX = Math.sin(wob + t * 0.7) * 3 * scale;
      ctx.fillStyle = t % 2 === 0 ? c1 : c2;
      ctx.beginPath();
      ctx.moveTo(x + wobX, ty - th2);
      ctx.lineTo(x + wobX - tw2, ty);
      ctx.lineTo(x + wobX + tw2, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Floating leaves
  const LEAVES = [];
  for (let i = 0; i < 18; i++) {
    LEAVES.push({
      x: rand(0, W), y: rand(-H, H),
      vx: rand(-15, 15), vy: rand(20, 55),
      r: rand(3, 6), wobOffset: rand(0, Math.PI*2),
      color: ["rgba(134,239,172,.55)","rgba(74,222,128,.50)","rgba(187,247,208,.60)","rgba(250,204,21,.45)"][Math.floor(Math.random()*4)],
    });
  }

  function drawBackground(ts) {
    ctx.clearRect(0, 0, W, H);

    // Sky gradient (changes color when time is low)
    const danger = timeLeft < 10;
    const warn   = timeLeft < 20 && !danger;
    let skyTop, skyBot;
    if (danger)    { skyTop = "rgba(254,215,170,1)"; skyBot = "rgba(255,237,213,1)"; }
    else if (warn) { skyTop = "rgba(224,242,254,1)"; skyBot = "rgba(240,253,244,1)"; }
    else           { skyTop = "rgba(219,234,254,1)"; skyBot = "rgba(240,253,244,1)"; }

    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, skyTop);
    g.addColorStop(1, skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // Sol / luna
    ctx.save();
    if (danger) {
      ctx.fillStyle = "rgba(251,146,60,.35)";
    } else {
      ctx.fillStyle = "rgba(254,240,138,.55)";
    }
    ctx.shadowColor = danger ? "rgba(249,115,22,.5)" : "rgba(253,224,71,.6)";
    ctx.shadowBlur  = 30;
    ctx.beginPath();
    ctx.arc(W - 70, 55, 30, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Nubes
    drawCloud(ts, 120, 60, 1.0, 0.0);
    drawCloud(ts, 420, 40, 0.8, 1.5);
    drawCloud(ts, 700, 75, 0.7, 3.0);

    // Árboles (back to front)
    const treeBaseY = H - 25;
    for (const t of TREES) {
      const wob = ts / (1400 + t.layer * 300) + t.wobOffset;
      ctx.globalAlpha = 0.55 + t.layer * 0.22;
      drawTree(t.x, treeBaseY, t.scale, wob, t.layer);
    }
    ctx.globalAlpha = 1;

    // Suelo
    ctx.fillStyle = "rgba(22,163,74,.22)";
    ctx.beginPath();
    ctx.moveTo(0,H); ctx.lineTo(0, H-28);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 28 + Math.sin((x/110) + ts/950) * 7;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

    ctx.fillStyle = "rgba(34,197,94,.15)";
    ctx.beginPath();
    ctx.moveTo(0,H); ctx.lineTo(0, H-14);
    for (let x = 0; x <= W; x += 18) {
      const y = H - 14 + Math.sin((x/80) + ts/700 + 1) * 5;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();

    // Hojas flotantes
    for (const lf of LEAVES) {
      lf.x  += (lf.vx + Math.sin(ts/800 + lf.wobOffset)*12) * 0.016;
      lf.y  += lf.vy * 0.016;
      if (lf.y > H + 10) { lf.y = -10; lf.x = rand(0,W); }
      if (lf.x < -10 || lf.x > W+10) lf.x = rand(0,W);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = lf.color;
      ctx.beginPath();
      ctx.ellipse(lf.x, lf.y, lf.r, lf.r*0.55, ts/1000, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // HUD in-canvas: "buscás ahora"
    if (running) {
      const need = expectedKind();
      const col  = SLOT_COLORS[need];
      ctx.fillStyle    = "rgba(255,255,255,.82)";
      ctx.strokeStyle  = col.stroke;
      ctx.lineWidth    = 1.5;
      roundRect(ctx, 14, 12, 200, 32, 10, true, true);

      ctx.fillStyle    = col.label;
      ctx.font         = "900 13px Nunito, sans-serif";
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`Buscás: ${TEMPLATE_LABEL[need]}`, 24, 28);
    }
  }

  function drawCloud(ts, bx, by, scale, phaseOff) {
    const wobX = Math.sin(ts/3000 + phaseOff) * 14;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle   = "rgba(255,255,255,.88)";
    const cx = bx + wobX;
    // grupo de 3 círculos
    ctx.beginPath(); ctx.arc(cx,      by,     22*scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+28*scale, by-8*scale, 18*scale, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-24*scale, by-4*scale, 15*scale, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ============================================================
  // GAME STATE
  // ============================================================
  let running  = false;
  let rafId    = null;
  let lastTs   = 0;

  const GAME_SECONDS = 30;
  let timeLeft = GAME_SECONDS;

  function setHUD() {
    if (playerNameHud) playerNameHud.textContent = playerName || "—";
    if (charHud) charHud.textContent = selectedCharMeta
      ? `${selectedCharMeta.label} — ${selectedCharMeta.desc}`
      : "—";
    if (timeHud)  timeHud.textContent  = String(Math.ceil(timeLeft));
    if (countHud) countHud.textContent = String(caughtCount);
    if (scoreHud) scoreHud.textContent = String(score);
    if (streakHud) streakHud.textContent = String(streak);
    updateRecordHud();

    // Time bar
    if (timeBarWrap) {
      timeBarWrap.classList.toggle("active", running || timeLeft < GAME_SECONDS);
    }
    if (timeBar) {
      const pct = (timeLeft / GAME_SECONDS) * 100;
      timeBar.style.width = `${pct}%`;
      timeBar.className   = "time-bar" +
        (timeLeft <= 10 ? " danger" : timeLeft <= 20 ? " warn" : "");
    }
  }

  function resetGameState() {
    clearStory();
    words    = [];
    spawnAcc = 0;
    lastTs   = 0;
    particles = [];
    score    = 0;
    streak   = 0;
    maxStreak = 0;
    player.x      = W * 0.5;
    player.y      = player.baseY;
    player.jumpV  = 0;
    player.dragging = false;
    player.shakeFrames = 0;
    tapTargetX = null;
    timeLeft = GAME_SECONDS;
    endOverlay.hidden = true;
    setHUD();
  }

  function endGame() {
    running = false;
    stopMusic();

    // Check record
    const best    = getBestScore(selectedCharId);
    const isRecord = score > best && score > 0;
    if (isRecord) {
      setBestScore(selectedCharId, score);
      showRecordToast();
    }

    // Fill end screen
    const story = sentences.join(" ").trim();
    endStory.textContent    = story || "Todavía no atrapaste palabras.";
    endScore.textContent    = String(score);
    endWords.textContent    = String(caughtCount);
    endSentences.textContent = String(sentences.length);
    endStreak.textContent   = String(maxStreak);
    endRecordBadge.style.display = isRecord ? "block" : "none";

    // Dynamic end title
    if (sentences.length >= 4)      endTitle.textContent = "¡Increíble historia!";
    else if (sentences.length >= 2) endTitle.textContent = "¡Buen trabajo!";
    else if (caughtCount >= 3)      endTitle.textContent = "¡Seguí intentando!";
    else                            endTitle.textContent = "¡Tiempo!";

    endSub.textContent = sentences.length
      ? `Armaste ${sentences.length} frase${sentences.length !== 1 ? "s" : ""}. Tu historia:`
      : "No llegaste a completar ninguna frase.";

    endOverlay.hidden = false;
    launchConfetti(isRecord ? 3.5 : 2.0);
    setHUD();
  }

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; setHUD(); endGame(); return; }
    setHUD();

    updatePlayer(dt);
    updateParticles(dt);

    // Spawn
    spawnAcc += dt;
    const target    = 14;
    const spawnEvery = words.length < 6 ? 0.32 : words.length < 10 ? 0.42 : 0.56;
    if (spawnAcc >= spawnEvery) { spawnAcc = 0; if (words.length < target) spawnWord(); }

    for (const w of words) w.y += w.vy * dt;

    words = words.filter(w => {
      if (w.y > H + 50) return false;

      const cr  = getPlayerRadius();
      const hit = collideCircleRect(player.x, player.y, cr, w.x, w.y, w.w, w.h);
      if (!hit) return true;

      const need  = expectedKind();
      const match = w.kind === need || w.kind === "wild";

      if (match) {
        // Correct catch
        const slotKind = w.kind === "wild" ? need : w.kind;
        slots[need] = w.text;
        slotIndex   = Math.min(TEMPLATE.length - 1, slotIndex + 1);
        caughtCount++;
        addScore(true);

        const didComplete = pushSentenceIfComplete();
        if (didComplete) {
          score += SCORE_SENTENCE;
          timeLeft += TIME_BONUS;
          if (timeLeft > GAME_SECONDS * 1.8) timeLeft = GAME_SECONDS * 1.8;
          launchConfetti(1.2);
        }

        rememberGlobal(w.text);
        playSfx("word.mp3", 0.80);
        jump();

        // Spawn particles at collision point
        const cx = w.x + w.w/2, cy = w.y + w.h/2;
        spawnParticles(cx, cy, slotKind, didComplete ? 18 : 10);

        refreshStoryText();
        return false;
      } else {
        // Wrong type — reject with feedback
        addScore(false);
        triggerShake();
        w.rejectFlash = 14;  // frames of red flash
        w.y += 20;           // push down slightly
        return true;
      }
    });
  }

  function render(ts) {
    drawBackground(ts);
    for (const w of words) drawWordBubble(w, ts);
    drawParticles();
    drawPlayer(ts);
  }

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.08) : 0;
    lastTs = ts;

    if (!gameWrap.hidden) {
      if (running) update(dt);
      render(ts);
    }
    if (confettiActive) {
      updateConfetti(dt);
      drawConfetti();
    }
  }

  function ensureLoopRunning() {
    if (rafId != null) return;
    lastTs = 0;
    rafId  = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId  = null;
    lastTs = 0;
  }

  // ============================================================
  // FLOW
  // ============================================================
  function startGame() {
    playerName       = (playerNameInput.value || "").trim().slice(0, 18);
    selectedCharMeta = characters.find(c => c.id === selectedCharId);

    buildPoolsForChar(selectedCharId);
    pickTemplate(selectedCharId);

    promptLine.textContent = WORDBANK[selectedCharId].prompt;
    resetSlots();
    sentences   = [];
    caughtCount = 0;
    score       = 0;
    streak      = 0;
    maxStreak   = 0;

    templateLine.textContent = templateText();
    refreshStoryText();
    resetGameState();

    // Spawn inicial abundante
    for (let i = 0; i < 12; i++) spawnWord();

    menu.hidden     = true;
    gameWrap.hidden = false;
    timeBarWrap.classList.add("active");

    running = true;
    playMusic();
    ensureLoopRunning();
  }

  function backToMenu() {
    running = false;
    stopMusic();
    endOverlay.hidden = true;
    gameWrap.hidden   = true;
    menu.hidden       = false;
    timeBarWrap.classList.remove("active");
    stopLoop();
    playerNameHud.textContent  = "—";
    charHud.textContent        = "—";
    countHud.textContent       = "0";
    timeHud.textContent        = String(GAME_SECONDS);
    scoreHud.textContent       = "0";
    streakHud.textContent      = "0";
    if (timeBar) { timeBar.style.width = "100%"; timeBar.className = "time-bar"; }
  }

  function playAgain() {
    endOverlay.hidden = true;
    buildPoolsForChar(selectedCharId);
    pickTemplate(selectedCharId);
    promptLine.textContent   = WORDBANK[selectedCharId].prompt;
    templateLine.textContent = templateText();
    resetGameState();
    // Spawn inicial
    for (let i = 0; i < 12; i++) spawnWord();
    running = true;
    playMusic();
    ensureLoopRunning();
  }

  // ============================================================
  // UI BINDINGS
  // ============================================================
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

  muteBtn?.addEventListener("click", () => { muted = !muted; syncMuteUi(); });

  window.addEventListener("pointerdown", () => {
    if (!muted && running) playMusic();
  }, { once: true });

  // ============================================================
  // UTILITY
  // ============================================================
  function hexToRgba(hex, alpha) {
    // Accepts #rrggbb or rgb/rgba strings; falls back gracefully
    if (!hex || hex.startsWith("rgba") || hex.startsWith("rgb")) {
      // already an rgba string — just return it
      return hex || `rgba(124,58,237,${alpha})`;
    }
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ============================================================
  // INIT
  // ============================================================
  renderCharacterGrid();
  validateStart();
  syncMuteUi();
  resetSlots();
  sentences   = [];
  caughtCount = 0;
  score       = 0;
  streak      = 0;
  maxStreak   = 0;
  if (timeHud)      timeHud.textContent      = String(GAME_SECONDS);
  if (templateLine) templateLine.textContent = templateText();
  refreshStoryText();

  menu.hidden     = false;
  gameWrap.hidden = true;
})();
