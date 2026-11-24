/* Single source of truth for the course structure.
 *
 * Every page loads this before course.js. The sidebar tree, the index cards
 * and the delivery badges all read from here, so a lesson's title, state and
 * activity count are written once. A lesson page also declares its own id and
 * delivery state on <body>; check.py fails if the two ever disagree.
 *
 * Paths are relative to docs/. Each page declares its depth in
 * <body data-base>, so links work from docs/, docs/lessons/ and docs/reviews/.
 */
window.COURSE = {
  name: "Fluxo",
  tagline: "Python avançado para engenharia de dados",
  phase: "Fase 1",

  /* Trilhas. Uma aula sem `track` pertence à fase 1. Cada trilha tem a sua
     própria árvore no rail e a sua própria sequência de anterior/próxima: sair
     da última aula da fase 1 não cai numa aula de redes, e vice-versa. */
  tracks: {
    fase1: { name: "Fase 1", title: "Python avançado para engenharia de dados" },
    redes: { name: "Trilha extra · Redes", title: "Redes para dados de infraestrutura" }
  },

  /* Assuntos que as aulas 04 a 06 assumem conhecidos e que ainda não têm
     página própria. Mostrado no índice e no aviso de pré-requisito. */
  gap: {
    lessons: ["02", "03"],
    from: "04",
    needed: "mecânica de <code>yield</code>, generator expressions, " +
            "composição de estágios e esgotamento de generator"
  },

  lessons: [
    {
      id: "01", title: "O protocolo de iteração",
      slug: "lessons/01-protocolo-de-iteracao.html",
      acts: 15, published: true, delivery: "delivered"
    },
    {
      id: "02", title: "Generators e yield",
      slug: null, acts: 14, published: false, delivery: "delivered",
      note: "aula ainda não escrita"
    },
    {
      id: "03", title: "Pipelines de generators",
      slug: null, acts: 12, published: false, delivery: "delivered",
      note: "aula ainda não escrita"
    },
    {
      id: "04", title: "itertools e batching",
      slug: "lessons/04-itertools-e-batching.html",
      acts: 13, published: true, delivery: "reviewed",
      review: "reviews/04-revisao.html"
    },
    {
      id: "05", title: "Memória na prática",
      slug: "lessons/05-memoria-na-pratica.html",
      acts: 11, published: true, delivery: "pending"
    },
    {
      id: "06", title: "Git e o repositório",
      slug: "lessons/06-git-e-o-repositorio.html",
      acts: 10, published: true, delivery: "pending"
    },
    {
      id: "07", title: "Estruturas de dados na prática",
      slug: "lessons/07-estruturas-de-dados.html",
      acts: 11, published: true, delivery: "pending"
    },
    {
      id: "08", title: "Decorators e context managers",
      slug: "lessons/08-decorators-e-context-managers.html",
      acts: 12, published: true, delivery: "pending"
    },
    {
      id: "09", title: "POO para pipelines",
      slug: "lessons/09-poo-para-pipelines.html",
      acts: 11, published: true, delivery: "pending"
    },
    {
      id: "10", title: "Testes com pytest",
      slug: "lessons/10-testes-com-pytest.html",
      acts: 12, published: true, delivery: "pending"
    },
    {
      id: "11", title: "Ambiente e dependências",
      slug: "lessons/11-ambiente-e-dependencias.html",
      acts: 9, published: true, delivery: "pending"
    },
    {
      id: "12", title: "Logging estruturado",
      slug: "lessons/12-logging-estruturado.html",
      acts: 10, published: true, delivery: "pending"
    },
    {
      id: "13", title: "SQL: window functions a fundo",
      slug: "lessons/13-sql-window-functions.html",
      acts: 12, published: true, delivery: "pending"
    },
    {
      id: "14", title: "SQL: CTEs recursivas",
      slug: "lessons/14-sql-ctes-recursivas.html",
      acts: 10, published: true, delivery: "pending"
    },
    {
      id: "15", title: "SQL: EXPLAIN, índices e particionamento",
      slug: "lessons/15-sql-explain-e-indices.html",
      acts: 11, published: true, delivery: "pending"
    },
    {
      id: "16", title: "Git em equipe: pull requests e conflitos",
      slug: "lessons/16-git-em-equipe.html",
      acts: 10, published: true, delivery: "pending"
    },
    {
      id: "17", title: "Projeto da fase 1: da API ao disco",
      slug: "lessons/17-projeto-da-fase-1.html",
      acts: 11, published: true, delivery: "pending"
    },

    /* ---------- trilha extra: redes ---------- */
    {
      id: "R01", track: "redes", title: "IPv4, CIDR e sub-redes",
      slug: "lessons/r01-ipv4-cidr-e-sub-redes.html",
      acts: 13, published: true, delivery: "pending"
    },
    {
      id: "R02", track: "redes", title: "IPv6 e IP como dado",
      slug: "lessons/r02-ipv6-e-ip-como-dado.html",
      acts: 13, published: true, delivery: "pending"
    },
    {
      id: "R03", track: "redes", title: "DNS e zonas reversas",
      slug: "lessons/r03-dns-e-zonas-reversas.html",
      acts: 13, published: true, delivery: "pending"
    }
  ],

  /* Rótulo e cor de cada estado de entrega. */
  delivery: {
    pending:   { label: "não entregue", cls: "is-pending" },
    delivered: { label: "entregue",     cls: "is-delivered" },
    reviewed:  { label: "revisada",     cls: "is-reviewed" }
  },

  /* Chave de progresso no localStorage. Uma por aula. */
  storageKey: (id) => "curso-de:" + id + ":v1",

  /* Toda leitura de localStorage passa por aqui: pode não existir (janela
     anônima), pode lançar (storage bloqueado) e pode conter lixo. */
  progressOf(id) {
    const lesson = this.lessons.find((l) => l.id === id);
    const total = lesson ? lesson.acts : 0;
    let done = 0;
    try {
      const raw = localStorage.getItem(this.storageKey(id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.done === "object" && parsed.done) {
          done = Object.values(parsed.done).filter(Boolean).length;
        }
      }
    } catch (_) {
      done = 0;
    }
    return { done: Math.min(done, total), total };
  },

  trackOf(lesson) { return (lesson && lesson.track) || "fase1"; },
  inTrack(track) { return this.lessons.filter((l) => this.trackOf(l) === track); },

  /* Sem argumento soma o site inteiro; com uma trilha, só as aulas dela. */
  courseProgress(track) {
    const lessons = track ? this.inTrack(track) : this.lessons;
    return lessons.reduce((acc, lesson) => {
      const p = lesson.published ? this.progressOf(lesson.id) : { done: 0, total: 0 };
      return { done: acc.done + p.done, total: acc.total + p.total };
    }, { done: 0, total: 0 });
  },

  /* Prefixo para montar hrefs a partir da profundidade da página atual. */
  base() {
    const b = document.body.dataset.base;
    return b && b !== "." ? b.replace(/\/$/, "") + "/" : "";
  },
  href(slug) { return slug ? this.base() + slug : null; }
};
