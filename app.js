// ============================================================
// Dunas Health — Sistema de Precificação Odontológica
// ============================================================

const STORAGE_KEYS = {
  catalogo: "dunas.catalogo",
  parametros: "dunas.parametros",
  custosFixos: "dunas.custosFixos",
  historico: "dunas.historico",
  tema: "dunas.tema"
};

// ============================================================
// Tema (claro/escuro)
// ============================================================
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem(STORAGE_KEYS.tema, tema);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.title = tema === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro";
}

(function initTema() {
  const salvo = localStorage.getItem(STORAGE_KEYS.tema);
  const prefereClaro = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  aplicarTema(salvo || (prefereClaro ? "light" : "dark"));
})();

document.getElementById("theme-toggle").addEventListener("click", () => {
  const atual = document.documentElement.getAttribute("data-theme");
  aplicarTema(atual === "dark" ? "light" : "dark");
});

// --- Estado em memória ---
let catalogo = carregar(STORAGE_KEYS.catalogo, CATALOGO_PADRAO);
let parametros = carregar(STORAGE_KEYS.parametros, PARAMETROS_PADRAO);
let custosFixos = carregar(STORAGE_KEYS.custosFixos, CUSTOS_FIXOS_PADRAO);
let historico = carregar(STORAGE_KEYS.historico, []);
let especialidadeAtiva = catalogo[0]?.id;
let servicoEditando = null;
let orcamentoAtivo = null;

const STATUS_LABELS = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  executado: "Executado"
};

const CATEGORIAS_CUSTO = [
  "Infraestrutura", "Utilidades", "Pessoal", "Serviços",
  "Marketing", "Operacional", "Regulatório", "Financeiro", "Outros"
];

// ============================================================
// Persistência
// ============================================================
function carregar(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : structuredClone(padrao);
  } catch { return structuredClone(padrao); }
}
function salvar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

// ============================================================
// Formatação
// ============================================================
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => fmtBRL.format(isFinite(v) ? v : 0);
const fmtPct = (v) => (isFinite(v) ? v.toFixed(1) : "0") + "%";
const fmtData = (iso) => new Date(iso).toLocaleDateString("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});

// ============================================================
// Cálculo de precificação
// ============================================================
function totalCustosFixos() {
  return custosFixos.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
}

function custoHoraCadeira() {
  const total = parametros.cadeiras * parametros.horasMes;
  return total > 0 ? totalCustosFixos() / total : 0;
}

function calcularPreco({ tempo, custoDireto, comissao, margem, descontoMax, impostos }) {
  const horaCadeira = custoHoraCadeira();
  const custoFixoAlocado = (tempo / 60) * horaCadeira;
  const custoTotal = custoFixoAlocado + custoDireto;

  const cargaEquilibrio = (impostos + comissao) / 100;
  const cargaSugerido = (impostos + comissao + margem) / 100;

  const equilibrio = cargaEquilibrio < 1 ? custoTotal / (1 - cargaEquilibrio) : 0;
  const sugerido = cargaSugerido < 1 ? custoTotal / (1 - cargaSugerido) : 0;
  const minimo = sugerido * (1 - descontoMax / 100);

  const margemEfetiva = sugerido > 0
    ? ((sugerido - custoTotal - sugerido * (impostos + comissao) / 100) / sugerido) * 100
    : 0;

  return { horaCadeira, custoFixoAlocado, custoTotal, equilibrio, sugerido, minimo, margemEfetiva };
}

// ============================================================
// Tabs
// ============================================================
function abrirAba(nome) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === nome);
  });
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === nome);
  });
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => abrirAba(btn.dataset.tab));
});

document.getElementById("ir-precificacao").addEventListener("click", () => abrirAba("precificacao"));

// ============================================================
// HISTÓRICO
// ============================================================
function renderHistorico() {
  const tbody = document.getElementById("tabela-historico-body");
  const vazio = document.getElementById("historico-vazio");
  tbody.innerHTML = "";

  const filtroStatus = document.getElementById("filtro-status").value;
  const filtroBusca = document.getElementById("busca-historico").value.toLowerCase().trim();

  const filtrados = historico
    .filter(o => !filtroStatus || o.status === filtroStatus)
    .filter(o => {
      if (!filtroBusca) return true;
      return (o.paciente || "").toLowerCase().includes(filtroBusca)
          || o.servicoNome.toLowerCase().includes(filtroBusca)
          || o.especialidadeNome.toLowerCase().includes(filtroBusca);
    })
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  vazio.style.display = filtrados.length === 0 ? "block" : "none";

  filtrados.forEach((o) => {
    const tr = document.createElement("tr");
    tr.className = "row-clickable";
    tr.innerHTML = `
      <td>${fmtData(o.criadoEm)}</td>
      <td>${escapeHtml(o.paciente || "—")}</td>
      <td>${escapeHtml(o.servicoNome)}</td>
      <td>${escapeHtml(o.especialidadeNome)}</td>
      <td class="preco-cell">${fmt(o.sugerido)}</td>
      <td><span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span></td>
      <td></td>
    `;
    tr.onclick = () => abrirOrcamento(o.id);
    tbody.appendChild(tr);
  });

  renderStats();
}

function renderStats() {
  const total = historico.length;
  const cont = { pendente: 0, aprovado: 0, rejeitado: 0, executado: 0 };
  let receita = 0;
  historico.forEach(o => {
    cont[o.status] = (cont[o.status] || 0) + 1;
    if (o.status === "executado") receita += o.sugerido;
  });
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-pendente").textContent = cont.pendente;
  document.getElementById("stat-aprovado").textContent = cont.aprovado;
  document.getElementById("stat-rejeitado").textContent = cont.rejeitado;
  document.getElementById("stat-executado").textContent = cont.executado;
  document.getElementById("stat-receita").textContent = fmt(receita);
}

document.getElementById("filtro-status").addEventListener("change", renderHistorico);
document.getElementById("busca-historico").addEventListener("input", renderHistorico);

function abrirOrcamento(id) {
  const o = historico.find(x => x.id === id);
  if (!o) return;
  orcamentoAtivo = o;

  document.getElementById("orc-titulo").textContent = `${o.especialidadeNome} — ${o.servicoNome}`;

  const body = document.getElementById("orc-body");
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span>
    </div>
    <div class="orc-grid">
      <div class="item"><span>Paciente</span><b>${escapeHtml(o.paciente || "—")}</b></div>
      <div class="item"><span>Criado em</span><b>${fmtData(o.criadoEm)}</b></div>
      <div class="item"><span>Tempo de cadeira</span><b>${o.tempo} min</b></div>
      <div class="item"><span>Custo direto</span><b>${fmt(o.custoDireto)}</b></div>
      <div class="item"><span>Comissão</span><b>${fmtPct(o.comissao)}</b></div>
      <div class="item"><span>Impostos</span><b>${fmtPct(o.impostos)}</b></div>
      <div class="item"><span>Margem desejada</span><b>${fmtPct(o.margem)}</b></div>
      <div class="item"><span>Desconto máximo</span><b>${fmtPct(o.descontoMax)}</b></div>
    </div>
    <div class="resultado">
      <div class="resultado-linha"><span>Custo fixo alocado</span><b>${fmt(o.custoFixoAlocado)}</b></div>
      <div class="resultado-linha"><span>Custo direto</span><b>${fmt(o.custoDireto)}</b></div>
      <div class="resultado-linha total"><span>Custo total</span><b>${fmt(o.custoTotal)}</b></div>
      <div class="resultado-linha destaque"><span>Ponto de equilíbrio</span><b>${fmt(o.equilibrio)}</b></div>
      <div class="resultado-linha destaque sucesso"><span>Preço sugerido</span><b>${fmt(o.sugerido)}</b></div>
      <div class="resultado-linha destaque alerta"><span>Preço mínimo c/ desconto</span><b>${fmt(o.minimo)}</b></div>
      <div class="resultado-linha"><span>Margem efetiva</span><b>${fmtPct(o.margemEfetiva)}</b></div>
    </div>
  `;

  document.getElementById("modal-orcamento").classList.add("open");
}

document.querySelectorAll("#modal-orcamento .btn-status").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!orcamentoAtivo) return;
    orcamentoAtivo.status = btn.dataset.status;
    orcamentoAtivo.atualizadoEm = new Date().toISOString();
    salvar(STORAGE_KEYS.historico, historico);
    renderHistorico();
    fecharModalOrcamento();
  });
});

document.getElementById("orc-excluir").addEventListener("click", () => {
  if (!orcamentoAtivo) return;
  if (!confirm("Excluir este orçamento? Esta ação não pode ser desfeita.")) return;
  historico = historico.filter(o => o.id !== orcamentoAtivo.id);
  salvar(STORAGE_KEYS.historico, historico);
  renderHistorico();
  fecharModalOrcamento();
});

function fecharModalOrcamento() {
  document.getElementById("modal-orcamento").classList.remove("open");
  orcamentoAtivo = null;
}

// ============================================================
// Sidebar de especialidades
// ============================================================
function renderEspecialidades() {
  const ul = document.getElementById("lista-especialidades");
  ul.innerHTML = "";
  catalogo.forEach((esp) => {
    const li = document.createElement("li");
    li.className = esp.id === especialidadeAtiva ? "active" : "";
    li.innerHTML = `
      <span>${esp.icone || "•"}</span>
      <span>${esp.nome}</span>
      <span class="badge">${esp.servicos.length}</span>
    `;
    li.onclick = () => {
      especialidadeAtiva = esp.id;
      renderEspecialidades();
      renderServicos();
    };
    ul.appendChild(li);
  });
}

// ============================================================
// Grid de procedimentos
// ============================================================
function renderServicos() {
  const esp = catalogo.find((e) => e.id === especialidadeAtiva);
  if (!esp) return;
  document.getElementById("titulo-especialidade").textContent = esp.nome;

  const filtro = document.getElementById("busca").value.toLowerCase().trim();
  const grid = document.getElementById("grid-servicos");
  grid.innerHTML = "";

  esp.servicos.forEach((s, idx) => {
    if (filtro && !s.nome.toLowerCase().includes(filtro)) return;

    // Último orçamento deste procedimento (para mostrar preço base)
    const ultimo = historico
      .filter(o => o.especialidadeId === esp.id && o.servicoIdx === idx)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];

    const card = document.createElement("div");
    card.className = "card-servico";

    const precoHtml = ultimo
      ? `<div class="preco">${fmt(ultimo.sugerido)}</div>`
      : `<div class="preco-vazio">Clique para precificar</div>`;

    card.innerHTML = `
      <h4>${escapeHtml(s.nome)}</h4>
      <div class="meta">
        <span>⏱ ${s.tempo} min</span>
        <span>📦 ${fmt(s.custoDireto)}</span>
      </div>
      ${precoHtml}
    `;
    card.onclick = () => abrirModal(esp.id, idx);
    grid.appendChild(card);
  });

  if (grid.children.length === 0) {
    grid.innerHTML = `<p class="vazio">Nenhum procedimento encontrado.</p>`;
  }
}

document.getElementById("busca").addEventListener("input", renderServicos);

// ============================================================
// Modal de precificação
// ============================================================
function abrirModal(espId, idx) {
  const esp = catalogo.find((e) => e.id === espId);
  const servico = esp.servicos[idx];
  servicoEditando = { espId, espNome: esp.nome, idx, servico };

  document.getElementById("modal-titulo").textContent = `${esp.nome} — ${servico.nome}`;
  document.getElementById("m-paciente").value = "";
  document.getElementById("m-tempo").value = servico.tempo;
  document.getElementById("m-custo-direto").value = servico.custoDireto;
  document.getElementById("m-comissao").value = servico.comissao ?? parametros.comissao;
  document.getElementById("m-margem").value = parametros.margem;
  document.getElementById("m-desconto").value = parametros.descontoMax;
  document.getElementById("m-impostos").value = parametros.impostos;

  atualizarCalculo();
  document.getElementById("modal-precificacao").classList.add("open");
}

function fecharModal() {
  document.getElementById("modal-precificacao").classList.remove("open");
  servicoEditando = null;
}

document.querySelectorAll("[data-close-modal]").forEach((b) =>
  b.addEventListener("click", () => {
    fecharModal();
    fecharModalOrcamento();
  })
);

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      fecharModal();
      fecharModalOrcamento();
    }
  });
});

function lerInputsModal() {
  return {
    paciente: document.getElementById("m-paciente").value.trim(),
    tempo: parseFloat(document.getElementById("m-tempo").value) || 0,
    custoDireto: parseFloat(document.getElementById("m-custo-direto").value) || 0,
    comissao: parseFloat(document.getElementById("m-comissao").value) || 0,
    margem: parseFloat(document.getElementById("m-margem").value) || 0,
    descontoMax: parseFloat(document.getElementById("m-desconto").value) || 0,
    impostos: parseFloat(document.getElementById("m-impostos").value) || 0
  };
}

function atualizarCalculo() {
  const inputs = lerInputsModal();
  const r = calcularPreco(inputs);

  document.getElementById("res-fixo").textContent = fmt(r.custoFixoAlocado);
  document.getElementById("res-direto").textContent = fmt(inputs.custoDireto);
  document.getElementById("res-custo-total").textContent = fmt(r.custoTotal);
  document.getElementById("res-equilibrio").textContent = fmt(r.equilibrio);
  document.getElementById("res-sugerido").textContent = fmt(r.sugerido);
  document.getElementById("res-minimo").textContent = fmt(r.minimo);
  document.getElementById("res-margem-efetiva").textContent = fmtPct(r.margemEfetiva);
}

["m-tempo", "m-custo-direto", "m-comissao", "m-margem", "m-desconto", "m-impostos"].forEach(
  (id) => document.getElementById(id).addEventListener("input", atualizarCalculo)
);

document.getElementById("salvar-precificacao").addEventListener("click", () => {
  if (!servicoEditando) return;
  const { espId, espNome, idx, servico } = servicoEditando;
  const inputs = lerInputsModal();
  const r = calcularPreco(inputs);

  const orcamento = {
    id: "orc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    especialidadeId: espId,
    especialidadeNome: espNome,
    servicoIdx: idx,
    servicoNome: servico.nome,
    status: "pendente",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...inputs,
    ...r
  };

  historico.push(orcamento);
  salvar(STORAGE_KEYS.historico, historico);

  // Sincroniza catálogo se o usuário ajustou tempo/custo/comissão
  servico.tempo = inputs.tempo;
  servico.custoDireto = inputs.custoDireto;
  servico.comissao = inputs.comissao;
  salvar(STORAGE_KEYS.catalogo, catalogo);

  fecharModal();
  renderServicos();
  renderCatalogo();
  renderHistorico();
  abrirAba("historico");
});

// ============================================================
// CUSTOS FIXOS
// ============================================================
function renderCustosFixos() {
  const tbody = document.getElementById("tabela-custos-body");
  tbody.innerHTML = "";

  custosFixos.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <select data-f="categoria">
          ${CATEGORIAS_CUSTO.map(c => `<option value="${c}" ${c === item.categoria ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </td>
      <td><input data-f="descricao" value="${escapeHtml(item.descricao)}" /></td>
      <td><input data-f="valor" type="number" step="0.01" value="${item.valor}" /></td>
      <td><button class="btn-excluir" title="Remover">✕</button></td>
    `;
    tr.querySelectorAll("[data-f]").forEach((el) => {
      el.addEventListener("change", () => {
        const f = el.dataset.f;
        item[f] = f === "valor" ? (parseFloat(el.value) || 0) : el.value;
        salvar(STORAGE_KEYS.custosFixos, custosFixos);
        atualizarTotaisCustosFixos();
        renderParametros();
      });
    });
    tr.querySelector(".btn-excluir").addEventListener("click", () => {
      if (confirm(`Remover "${item.descricao}"?`)) {
        custosFixos.splice(idx, 1);
        salvar(STORAGE_KEYS.custosFixos, custosFixos);
        renderCustosFixos();
        renderParametros();
      }
    });
    tbody.appendChild(tr);
  });

  atualizarTotaisCustosFixos();
}

function atualizarTotaisCustosFixos() {
  document.getElementById("cf-total").textContent = fmt(totalCustosFixos());
  document.getElementById("cf-hora").textContent = fmt(custoHoraCadeira());
  document.getElementById("cf-itens").textContent = custosFixos.length;
}

document.getElementById("novo-custo").addEventListener("click", () => {
  custosFixos.push({ categoria: "Outros", descricao: "Novo item", valor: 0 });
  salvar(STORAGE_KEYS.custosFixos, custosFixos);
  renderCustosFixos();
  renderParametros();
});

// ============================================================
// PARÂMETROS
// ============================================================
function renderParametros() {
  parametros.custosFixos = totalCustosFixos();
  document.getElementById("p-custos-fixos").value = parametros.custosFixos.toFixed(2);
  document.getElementById("p-cadeiras").value = parametros.cadeiras;
  document.getElementById("p-horas-mes").value = parametros.horasMes;
  document.getElementById("p-impostos").value = parametros.impostos;
  document.getElementById("p-comissao").value = parametros.comissao;
  document.getElementById("p-margem").value = parametros.margem;
  document.getElementById("p-desconto-max").value = parametros.descontoMax;
  document.getElementById("r-hora-cadeira").textContent = fmt(custoHoraCadeira());
}

["p-cadeiras", "p-horas-mes"].forEach((id) =>
  document.getElementById(id).addEventListener("input", () => {
    parametros.cadeiras = parseFloat(document.getElementById("p-cadeiras").value) || 1;
    parametros.horasMes = parseFloat(document.getElementById("p-horas-mes").value) || 1;
    document.getElementById("r-hora-cadeira").textContent = fmt(custoHoraCadeira());
    atualizarTotaisCustosFixos();
  })
);

document.getElementById("salvar-parametros").addEventListener("click", () => {
  parametros = {
    custosFixos: totalCustosFixos(),
    cadeiras: parseFloat(document.getElementById("p-cadeiras").value) || 1,
    horasMes: parseFloat(document.getElementById("p-horas-mes").value) || 1,
    impostos: parseFloat(document.getElementById("p-impostos").value) || 0,
    comissao: parseFloat(document.getElementById("p-comissao").value) || 0,
    margem: parseFloat(document.getElementById("p-margem").value) || 0,
    descontoMax: parseFloat(document.getElementById("p-desconto-max").value) || 0
  };
  salvar(STORAGE_KEYS.parametros, parametros);
  renderParametros();
  flash("Parâmetros salvos com sucesso");
});

// ============================================================
// CATÁLOGO
// ============================================================
function renderCatalogo() {
  const tbody = document.getElementById("tabela-catalogo-body");
  tbody.innerHTML = "";

  catalogo.forEach((esp) => {
    esp.servicos.forEach((s, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(esp.nome)}</td>
        <td><input data-f="nome" value="${escapeHtml(s.nome)}" /></td>
        <td><input data-f="tempo" type="number" value="${s.tempo}" /></td>
        <td><input data-f="custoDireto" type="number" step="0.01" value="${s.custoDireto}" /></td>
        <td><input data-f="comissao" type="number" step="0.1" value="${s.comissao ?? parametros.comissao}" /></td>
        <td><button class="btn-excluir" title="Excluir">✕</button></td>
      `;
      tr.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          const f = inp.dataset.f;
          s[f] = f === "nome" ? inp.value : (parseFloat(inp.value) || 0);
          salvar(STORAGE_KEYS.catalogo, catalogo);
          renderServicos();
        });
      });
      tr.querySelector(".btn-excluir").addEventListener("click", () => {
        if (confirm(`Excluir "${s.nome}"?`)) {
          esp.servicos.splice(idx, 1);
          salvar(STORAGE_KEYS.catalogo, catalogo);
          renderCatalogo();
          renderEspecialidades();
          renderServicos();
        }
      });
      tbody.appendChild(tr);
    });
  });
}

document.getElementById("novo-servico").addEventListener("click", () => {
  const nomeEsp = prompt(
    "Especialidade (digite o nome de uma existente, ou um nome novo para criar):",
    catalogo[0].nome
  );
  if (!nomeEsp) return;
  const nomeSvc = prompt("Nome do procedimento:");
  if (!nomeSvc) return;

  let esp = catalogo.find((e) => e.nome.toLowerCase() === nomeEsp.toLowerCase());
  if (!esp) {
    esp = {
      id: nomeEsp.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      nome: nomeEsp,
      icone: "•",
      servicos: []
    };
    catalogo.push(esp);
  }
  esp.servicos.push({
    nome: nomeSvc,
    tempo: 30,
    custoDireto: 0,
    comissao: parametros.comissao
  });
  salvar(STORAGE_KEYS.catalogo, catalogo);
  renderCatalogo();
  renderEspecialidades();
  renderServicos();
});

// ============================================================
// Utilidades
// ============================================================
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function flash(msg) {
  const el = document.createElement("div");
  el.className = "flash-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ============================================================
// Boot
// ============================================================
renderEspecialidades();
renderServicos();
renderParametros();
renderCatalogo();
renderCustosFixos();
renderHistorico();
