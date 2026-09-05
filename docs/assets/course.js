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

  /* ---------- lista lateral ---------- */
  const listEl = document.getElementById("actList");
  listEl.innerHTML = acts.map((a, i) => {
    const kind = a.dataset.kind || "video";
    const min = a.dataset.min;
    const dur = (kind === "video" || kind === "lab") && min
      ? `<span class="du">${String(min).padStart(2, "0")} min</span>` : "";
    return `<li data-for="${a.id}">
      <button type="button">
        <span class="ic">${ICON[kind] || ICON.video}</span>
        <span class="txt"><span class="nm">${i + 1}. ${a.dataset.title}</span>${dur}</span>
        <span class="ck">${CHECK}</span>
      </button>
    </li>`;
  }).join("");

  /* ---------- render ---------- */
  const barFill = document.getElementById("barFill");
  const barPct  = document.getElementById("barPct");
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
    const pct = Math.round((n / TOTAL) * 100);
    barFill.style.width = pct + "%";
    barPct.textContent = pct + "%";
    ringTxt.textContent = n + "/" + TOTAL;
    ringFill.setAttribute("stroke-dasharray", `${(CIRC * n / TOTAL).toFixed(1)} ${CIRC.toFixed(1)}`);

    doneChk.checked = !!state.done[state.current];
    prevBtn.disabled = idx === 0;
    nextBtn.textContent = idx === TOTAL - 1 ? "Concluir aula" : "Avançar →";

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
    if (i > 0) goTo(acts[i - 1].id);
  });
  nextBtn.addEventListener("click", () => {
    const i = acts.findIndex(a => a.id === state.current);
    state.done[state.current] = true;
    if (i < TOTAL - 1) goTo(acts[i + 1].id); else { render(); persist(); }
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
  const TRACE_LINES = [
    "iterator = iter([10, 20, 30])",
    "while True:",
    "    try:",
    "        item = next(iterator)",
    "    except StopIteration:",
    "        break",
    "    print(item)"
  ];
  const STEPS = [
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
  const tCode = document.getElementById("tCode");
  const tIter = document.getElementById("tIter");
  const tItem = document.getElementById("tItem");
  const tOut  = document.getElementById("tOut");
  const tNote = document.getElementById("tNote");
  let tStep = 0;

  tCode.innerHTML = TRACE_LINES.map((l, i) =>
    `<span class="ln" data-l="${i}">${l.replace(/</g, "&lt;") || " "}</span>`).join("");

  function drawTrace() {
    const s = STEPS[tStep];
    tCode.querySelectorAll(".ln").forEach(el => el.classList.toggle("on", +el.dataset.l === s.l));
    tIter.textContent = s.it;
    tItem.textContent = s.item;
    tItem.className = "tstate-v" + (s.stop ? " stop" : "");
    tOut.textContent = s.out;
    tNote.textContent = `Passo ${tStep + 1} de ${STEPS.length} · ${s.note}`;
    document.getElementById("tPrev").disabled = tStep === 0;
    document.getElementById("tNext").disabled = tStep === STEPS.length - 1;
  }
  document.getElementById("tNext").addEventListener("click", () => { if (tStep < STEPS.length - 1) { tStep++; drawTrace(); } });
  document.getElementById("tPrev").addEventListener("click", () => { if (tStep > 0) { tStep--; drawTrace(); } });
  document.getElementById("tReset").addEventListener("click", () => { tStep = 0; drawTrace(); });
  drawTrace();

  /* ---------- start ---------- */
  render();
  if (window.Prism) window.Prism.highlightAll();
})();
