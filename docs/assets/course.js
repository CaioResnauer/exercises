(() => {
  "use strict";

  /* ---------- ícones ---------- */
  const ICON = {
    video: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M10 9.2l5 2.8-5 2.8z" fill="currentColor" stroke="none"/></svg>',
    note:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9.2"/><path d="M9.6 9.3a2.5 2.5 0 114.4 1.7c-.9.9-2 1.3-2 2.6"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/></svg>',
    lab:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 6l4 3.6-4 3.6"/><path d="M11.5 15h7"/></svg>',
    recap: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6.5h13M4 12h13M4 17.5h8"/><path d="M18.5 15.5l2 2 3-3.6"/></svg>'
  };
  const CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6"/></svg>';

  /* ---------- estado ---------- */
  const KEY = "curso-de:" + (document.body.dataset.lesson || "01") + ":v1";
  const acts = Array.from(document.querySelectorAll(".act"));
  const TOTAL = acts.length;
  let state = { done: {}, predict: {}, current: acts[0].id };
  let remote = null;

  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; }
  };
  const merge = (a, b) => ({
    done: Object.assign({}, a.done, b.done),
    predict: Object.assign({}, a.predict, b.predict),
    current: b.current || a.current || acts[0].id
  });
  state = merge(state, readLocal());

  let saveTimer = null;
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    if (!remote) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      remote.doc("progress/lesson01").set(JSON.parse(JSON.stringify(state))).catch(() => {});
    }, 600);
  }

  /* progresso guardado no servidor quando a capacidade existir; senão, só neste navegador */
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("db").then(db => {
      if (!db) return;
      remote = db;
      return db.doc("progress/lesson01").get().then(snap => {
        if (!snap || !snap.exists) return;
        const data = snap.data();
        if (data && typeof data === "object" && data.done) {
          state = merge(state, data);
          render();
          persist();
        }
      });
    }).catch(() => {});
  }

  /* ---------- árvore da trilha ----------
     O rail mostra as seis aulas, não só a atual: a aula aberta expandida nas
     suas atividades, as outras clicáveis, as não publicadas visíveis e
     desabilitadas com o motivo. Tudo gerado a partir de window.COURSE, para
     que qualquer página — inclusive a aula 01 — receba a mesma navegação. */
  const COURSE = window.COURSE;
  const LESSON_ID = document.body.dataset.lesson || "";
  const IS_REVIEW = LESSON_ID.includes("-");
  const OWNER_ID = IS_REVIEW ? LESSON_ID.split("-")[0] : LESSON_ID;

  /* Aulas publicadas vizinhas: é o que permite o "Avançar" da última
     atividade sair da aula em vez de parar em "Concluir aula". */
  const PUBLISHED = COURSE.lessons.filter((l) => l.published);
  const HERE = PUBLISHED.findIndex((l) => l.id === OWNER_ID);
  const OWNER = COURSE.lessons.find((l) => l.id === OWNER_ID) || null;
  /* Numa revisão as duas pontas apontam para a aula corrigida: a revisão é um
     desvio, não um passo da trilha. */
  const PREV_LESSON = IS_REVIEW ? OWNER : (HERE > 0 ? PUBLISHED[HERE - 1] : null);
  const NEXT_LESSON = IS_REVIEW ? OWNER
    : (HERE >= 0 && HERE < PUBLISHED.length - 1 ? PUBLISHED[HERE + 1] : null);

  const escapeHtml = (s) => String(s).replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function deliveryBadge(lesson, extraClass) {
    const meta = COURSE.delivery[lesson.delivery] || COURSE.delivery.pending;
    const review = COURSE.href(lesson.review);
    const cls = `badge ${meta.cls}${extraClass ? " " + extraClass : ""}`;
    return review
      ? `<a class="${cls}" href="${review}">${meta.label}</a>`
      : `<span class="${cls}">${meta.label}</span>`;
  }

  function activityRows() {
    return acts.map((a, i) => {
      const kind = a.dataset.kind || "video";
      const min = a.dataset.min;
      const dur = (kind === "video" || kind === "lab") && min
        ? `<span class="du">${String(min).padStart(2, "0")} min</span>` : "";
      return `<li data-for="${a.id}">
        <button type="button">
          <span class="ic">${ICON[kind] || ICON.video}</span>
          <span class="txt"><span class="nm">${i + 1}. ${escapeHtml(a.dataset.title)}</span>${dur}</span>
          <span class="ck">${CHECK}</span>
        </button>
      </li>`;
    }).join("");
  }

  const treeEl = document.getElementById("tree");
  function buildTree() {
    if (!treeEl) return;
    treeEl.innerHTML = COURSE.lessons.map((lesson) => {
      const current = lesson.id === OWNER_ID;
      const progress = lesson.published ? COURSE.progressOf(lesson.id) : null;
      const count = progress ? `<span class="ln-c">${progress.done}/${progress.total}</span>` : "";
      const head = `<span class="ln-n">${lesson.id}</span>
        <span class="ln-t">${escapeHtml(lesson.title)}</span>${count}`;

      let row;
      if (!lesson.published) {
        row = `<div class="lesson-row is-unpublished" aria-disabled="true">${head}</div>
               <p class="ln-note">${escapeHtml(lesson.note || "ainda não publicada")}</p>`;
      } else if (current && !IS_REVIEW) {
        row = `<div class="lesson-row is-current" aria-current="true">${head}</div>`;
      } else {
        row = `<a class="lesson-row" href="${COURSE.href(lesson.slug)}">${head}</a>`;
      }

      const parts = [row, `<div class="ln-badge">${deliveryBadge(lesson)}</div>`];
      const actsList = `<ul class="acts" id="actList">${activityRows()}</ul>`;
      if (current && !IS_REVIEW) parts.push(actsList);
      if (lesson.review) {
        const onIt = current && IS_REVIEW;
        const label = '<span class="ln-n">&#8627;</span><span class="ln-t">Revisão da entrega</span>';
        parts.push(onIt
          ? `<div class="lesson-row is-sub is-current" aria-current="true">${label}</div>`
          : `<a class="lesson-row is-sub" href="${COURSE.href(lesson.review)}">${label}</a>`);
      }
      if (current && IS_REVIEW) parts.push(actsList);
      return `<li class="tree-lesson${current ? " is-open" : ""}">${parts.join("")}</li>`;
    }).join("");
  }
  buildTree();
  const listEl = document.getElementById("actList");

  /* ---------- render ---------- */
  const ringFill = document.getElementById("ringFill");
  const ringTxt = document.getElementById("ringTxt");
  const doneChk = document.getElementById("doneChk");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const CIRC = 2 * Math.PI * 22;

  function render() {
    const idx = Math.max(0, acts.findIndex(a => a.id === state.current));
    state.current = acts[idx].id;

    acts.forEach((a, i) => { a.hidden = i !== idx; });

    Array.from(listEl.children).forEach(li => {
      const id = li.dataset.for;
      li.classList.toggle("current", id === state.current);
      li.classList.toggle("done", !!state.done[id]);
    });

    const n = acts.filter(a => state.done[a.id]).length;
    if (ringTxt) ringTxt.textContent = n + "/" + TOTAL;
    if (ringFill) {
      ringFill.setAttribute("stroke-dasharray",
        `${(CIRC * n / TOTAL).toFixed(1)} ${CIRC.toFixed(1)}`);
    }
    /* Numa revisão a aula aberta na árvore é a 04, mas as atividades contadas
       são as da revisão — não sobrescreva o número dela. */
    const treeCount = !IS_REVIEW && treeEl
      && treeEl.querySelector(".tree-lesson.is-open > .ln-c, .tree-lesson.is-open .lesson-row .ln-c");
    if (treeCount) treeCount.textContent = n + "/" + TOTAL;

    doneChk.checked = !!state.done[state.current];
    prevBtn.disabled = idx === 0 && !PREV_LESSON;
    nextBtn.textContent = idx < TOTAL - 1 ? "Avançar →"
      : IS_REVIEW ? `Voltar à aula ${OWNER_ID} →`
      : NEXT_LESSON ? `Aula ${NEXT_LESSON.id}: ${NEXT_LESSON.title} →`
      : "Concluir aula";

    // restaura previsões escritas
    document.querySelectorAll(".predict").forEach(p => {
      const k = p.dataset.predict;
      const ta = p.querySelector("textarea");
      if (ta && state.predict[k] != null && ta.value === "") ta.value = state.predict[k];
    });
  }

  function goTo(id, scroll) {
    state.current = id;
    render(); persist();
    if (scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.classList.remove("rail-open");
    document.getElementById("railToggle").setAttribute("aria-expanded", "false");
  }

  listEl.addEventListener("click", e => {
    const li = e.target.closest("li[data-for]");
    if (li) goTo(li.dataset.for);
  });

  prevBtn.addEventListener("click", () => {
    const i = acts.findIndex(a => a.id === state.current);
    if (i > 0) { goTo(acts[i - 1].id); return; }
    /* primeira atividade: volta para a última da aula anterior */
    if (PREV_LESSON) location.href = COURSE.href(PREV_LESSON.slug) + "#last";
  });
  nextBtn.addEventListener("click", () => {
    const i = acts.findIndex(a => a.id === state.current);
    state.done[state.current] = true;
    if (i < TOTAL - 1) { goTo(acts[i + 1].id); return; }
    persist();
    /* última atividade: entra na primeira da próxima aula publicada */
    if (NEXT_LESSON) location.href = COURSE.href(NEXT_LESSON.slug); else render();
  });
  doneChk.addEventListener("change", () => {
    if (doneChk.checked) state.done[state.current] = true;
    else delete state.done[state.current];
    render(); persist();
  });

  /* ---------- abas do rail ---------- */
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        document.getElementById(t.dataset.panel).hidden = !on;
      });
    });
  });

  const railToggle = document.getElementById("railToggle");
  railToggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("rail-open");
    railToggle.setAttribute("aria-expanded", String(open));
  });

  /* ---------- copiar código ---------- */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".copy");
    if (!btn) return;
    const block = btn.closest(".code");
    const code = block && block.querySelector("code");
    if (!code) return;
    const write = navigator.clipboard
      ? navigator.clipboard.writeText(code.textContent)
      : Promise.reject();
    write.then(() => {
      btn.textContent = "Copiado";
      btn.classList.add("done");
      setTimeout(() => { btn.textContent = "Copiar"; btn.classList.remove("done"); }, 1600);
    }).catch(() => { btn.textContent = "Ctrl+C"; setTimeout(() => { btn.textContent = "Copiar"; }, 1600); });
  });

  /* ---------- prever antes de rodar ---------- */
  document.querySelectorAll(".predict").forEach(p => {
    const key = p.dataset.predict;
    const ta = p.querySelector("textarea");
    const reveal = p.querySelector(".reveal");
    ta.addEventListener("input", () => { state.predict[key] = ta.value; persist(); });
    p.querySelector("[data-reveal]").addEventListener("click", ev => {
      reveal.hidden = false;
      ev.currentTarget.disabled = true;
      ev.currentTarget.textContent = "Saída revelada";
    });
  });

  /* ---------- trace stepper ---------- */
  /* Fallback: o trace da aula 01. Uma página pode trazer o seu próprio em
     <script type="application/json"> dentro do .trace — veja a aula 04. */
  const FALLBACK_LINES = [
    "iterator = iter([10, 20, 30])",
    "while True:",
    "    try:",
    "        item = next(iterator)",
    "    except StopIteration:",
    "        break",
    "    print(item)"
  ];
  const FALLBACK_STEPS = [
    { l: 0, it: "list_iterator, posição 0", item: "—", out: "(vazio)", stop: false,
      note: "iter() pede um iterator à lista. A lista não muda — nasce um objeto novo, com posição própria." },
    { l: 3, it: "list_iterator, posição 1", item: "10", out: "(vazio)", stop: false,
      note: "next() devolve o valor da posição atual e avança o cursor do iterator." },
    { l: 6, it: "list_iterator, posição 1", item: "10", out: "10", stop: false,
      note: "O corpo do laço roda. Este é o único trecho que você escreveu no for original." },
    { l: 3, it: "list_iterator, posição 2", item: "20", out: "10", stop: false,
      note: "Segunda chamada a next(). A lista não é percorrida por índice — quem sabe onde parou é o iterator." },
    { l: 6, it: "list_iterator, posição 2", item: "20", out: "10\n20", stop: false, note: "Corpo do laço de novo." },
    { l: 3, it: "list_iterator, posição 3", item: "30", out: "10\n20", stop: false,
      note: "Último valor entregue. O iterator já está no fim, mas ainda não sabe disso." },
    { l: 6, it: "list_iterator, posição 3", item: "30", out: "10\n20\n30", stop: false, note: "Corpo do laço pela terceira vez." },
    { l: 3, it: "list_iterator, esgotado", item: "StopIteration", out: "10\n20\n30", stop: true,
      note: "Não há mais nada: next() levanta StopIteration. Repare que a exceção é o canal — nenhum valor de dado poderia sinalizar isso sem ambiguidade." },
    { l: 5, it: "list_iterator, esgotado", item: "StopIteration", out: "10\n20\n30", stop: true,
      note: "O except captura e o break encerra. Fim do for — e o iterator continua esgotado para sempre." }
  ];
  /* O stepper é opcional: páginas sem um .trace simplesmente pulam este bloco. */
  const traceEl = document.getElementById("trace");
  if (traceEl) {
    const cfgEl = traceEl.querySelector('script[type="application/json"]');
    let cfg = null;
    if (cfgEl) {
      try { cfg = JSON.parse(cfgEl.textContent); } catch (_) { cfg = null; }
    }
    const TRACE_LINES = (cfg && cfg.lines) || FALLBACK_LINES;
    const STEPS = (cfg && cfg.steps) || FALLBACK_STEPS;

    const tCode = document.getElementById("tCode");
    const tIter = document.getElementById("tIter");
    const tItem = document.getElementById("tItem");
    const tOut  = document.getElementById("tOut");
    const tNote = document.getElementById("tNote");
    const tPrev = document.getElementById("tPrev");
    const tNext = document.getElementById("tNext");
    const tReset = document.getElementById("tReset");
    let tStep = 0;

    tCode.innerHTML = TRACE_LINES.map((l, i) =>
      `<span class="ln" data-l="${i}">${l.replace(/</g, "&lt;") || " "}</span>`).join("");

    const drawTrace = () => {
      const s = STEPS[tStep];
      tCode.querySelectorAll(".ln").forEach(el => el.classList.toggle("on", +el.dataset.l === s.l));
      tIter.textContent = s.it;
      tItem.textContent = s.item;
      tItem.className = "tstate-v" + (s.stop ? " stop" : "");
      tOut.textContent = s.out;
      tNote.textContent = `Passo ${tStep + 1} de ${STEPS.length} · ${s.note}`;
      tPrev.disabled = tStep === 0;
      tNext.disabled = tStep === STEPS.length - 1;
    };
    tNext.addEventListener("click", () => { if (tStep < STEPS.length - 1) { tStep++; drawTrace(); } });
    tPrev.addEventListener("click", () => { if (tStep > 0) { tStep--; drawTrace(); } });
    tReset.addEventListener("click", () => { tStep = 0; drawTrace(); });
    drawTrace();
  }

  /* ---------- selo de entrega no topo da aula ----------
     Injetado por JS para que nenhuma página precise repetir a marcação, e para
     que o estado venha do manifesto — a única fonte de verdade. */
  const reader = document.getElementById("reader");
  if (reader && OWNER) {
    const strip = document.createElement("div");
    strip.className = "lesson-state";
    const meta = COURSE.delivery[OWNER.delivery] || COURSE.delivery.pending;
    const reviewHref = COURSE.href(OWNER.review);
    strip.innerHTML =
      `<span class="ls-k">Aula ${OWNER.id}</span>` +
      `<span class="ls-t">${escapeHtml(OWNER.title)}</span>` +
      `<span class="badge ${meta.cls}">${IS_REVIEW ? "revisão desta entrega" : meta.label}</span>` +
      (IS_REVIEW
        ? `<a class="ls-back" href="${COURSE.href(OWNER.slug)}">&larr; voltar à aula ${OWNER.id}</a>`
        : reviewHref ? `<a class="ls-back" href="${reviewHref}">ver a revisão &rarr;</a>` : "");
    reader.parentNode.insertBefore(strip, reader);
  }

  /* ---------- rodapé de navegação da trilha ----------
     Anterior / índice / próxima, montado a partir do manifesto e acrescentado
     depois dos botões de atividade. */
  const footnav = document.querySelector(".footnav");
  if (footnav && COURSE.lessons.length) {
    const nav = document.createElement("nav");
    nav.className = "lessonnav";
    nav.setAttribute("aria-label", "Navegação entre aulas");
    const link = (lesson, dir, arrow) => {
      if (!lesson || !lesson.slug) return `<span class="lnav ${dir} is-off"></span>`;
      const suffix = dir === "prev" && !IS_REVIEW ? "#last" : "";
      return `<a class="lnav ${dir}" href="${COURSE.href(lesson.slug)}${suffix}">
        <span class="lnav-k">${arrow}</span>
        <span class="lnav-t">Aula ${lesson.id} &middot; ${escapeHtml(lesson.title)}</span></a>`;
    };
    nav.innerHTML =
      link(PREV_LESSON, "prev", "&larr; anterior") +
      `<a class="lnav home" href="${COURSE.base() || "./"}index.html">
         <span class="lnav-k">índice</span>
         <span class="lnav-t">${escapeHtml(COURSE.name)} &middot; ${escapeHtml(COURSE.phase)}</span></a>` +
      link(NEXT_LESSON, "next", "próxima &rarr;");
    footnav.parentNode.insertBefore(nav, footnav.nextSibling);
  }

  /* ---------- dica de atalhos ---------- */
  if (footnav) {
    const hint = document.createElement("p");
    hint.className = "kbdhint";
    hint.innerHTML =
      '<kbd>&larr;</kbd><kbd>&rarr;</kbd> ou <kbd>j</kbd><kbd>k</kbd> trocam de atividade' +
      ' &middot; <kbd>c</kbd> marca como concluída';
    footnav.parentNode.appendChild(hint);
  }

  /* ---------- deep link ----------
     Permite que a navegação entre aulas chegue numa atividade específica:
     #a3 abre aquela atividade, #last abre a última (usado pelo "Anterior"). */
  function applyHash() {
    const hash = (location.hash || "").slice(1);
    if (!hash) return;
    if (hash === "last") { state.current = acts[TOTAL - 1].id; return; }
    if (acts.some((a) => a.id === hash)) state.current = hash;
  }
  applyHash();
  window.addEventListener("hashchange", () => { applyHash(); render(); persist(); });

  /* ---------- teclado ----------
     Setas ou j/k trocam de atividade, "c" marca como concluída. Nada dispara
     enquanto o foco está num campo de texto: as caixas de "prever antes de
     rodar" são textarea e o usuário está digitando nelas. */
  const isTyping = (el) => !!el && (
    el.tagName === "TEXTAREA" || el.tagName === "INPUT" ||
    el.tagName === "SELECT" || el.isContentEditable);

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) return;

    const i = acts.findIndex((a) => a.id === state.current);
    switch (event.key) {
      case "ArrowRight": case "j": case "J":
        if (i < TOTAL - 1) { event.preventDefault(); goTo(acts[i + 1].id); }
        else if (NEXT_LESSON) { event.preventDefault(); location.href = COURSE.href(NEXT_LESSON.slug); }
        break;
      case "ArrowLeft": case "k": case "K":
        if (i > 0) { event.preventDefault(); goTo(acts[i - 1].id); }
        else if (PREV_LESSON) { event.preventDefault(); location.href = COURSE.href(PREV_LESSON.slug) + "#last"; }
        break;
      case "c": case "C":
        event.preventDefault();
        if (state.done[state.current]) delete state.done[state.current];
        else state.done[state.current] = true;
        render(); persist();
        break;
      default: break;
    }
  });

  /* ---------- start ---------- */
  render();
  if (window.Prism) window.Prism.highlightAll();
})();
