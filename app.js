// ============================================================
// Dunas Health — Sistema de Precificação Odontológica
// ============================================================

const STORAGE_KEYS = {
  catalogo: "dunas.catalogo",
  parametros: "dunas.parametros",
  custosFixos: "dunas.custosFixos",
  historico: "dunas.historico",
  tema: "dunas.tema",
  conta: "dunas.conta",
  pacientes: "dunas.pacientes",
  agendamentos: "dunas.agendamentos",
  campanhas: "dunas.campanhas",
  notifsLidas: "dunas.notifsLidas"
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
let pacientes = carregar(STORAGE_KEYS.pacientes, PACIENTES_PADRAO);
let agendamentos = carregar(STORAGE_KEYS.agendamentos, AGENDAMENTOS_PADRAO);
let campanhas = carregar(STORAGE_KEYS.campanhas, CAMPANHAS_PADRAO);
let notifsLidas = carregar(STORAGE_KEYS.notifsLidas, []);
let especialidadeAtiva = catalogo[0]?.id;
let servicoEditando = null;
let orcamentoAtivo = null;
let pacienteEditando = null;
let agendamentoEditando = null;
let campanhaEditando = null;

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

function calcularPreco({ tempo, custoDireto, comissao, margem, descontoMax, impostos, taxaCartao = 0 }) {
  const horaCadeira = custoHoraCadeira();
  const custoFixoAlocado = (tempo / 60) * horaCadeira;
  const custoTotal = custoFixoAlocado + custoDireto;

  // Carga (% sobre o preço): impostos + comissão (+ taxa do cartão para o sugerido)
  const cargaEquilibrio = (impostos + comissao) / 100;
  const cargaSugerido = (impostos + comissao + margem + taxaCartao) / 100;

  const equilibrio = cargaEquilibrio < 1 ? custoTotal / (1 - cargaEquilibrio) : 0;
  const sugerido = cargaSugerido < 1 ? custoTotal / (1 - cargaSugerido) : 0;
  const minimo = sugerido * (1 - descontoMax / 100);

  // Margem efetiva: receita - custos - impostos - comissão - taxa cartão
  const margemEfetiva = sugerido > 0
    ? ((sugerido - custoTotal - sugerido * (impostos + comissao + taxaCartao) / 100) / sugerido) * 100
    : 0;

  return { horaCadeira, custoFixoAlocado, custoTotal, equilibrio, sugerido, minimo, margemEfetiva, taxaCartao };
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
  document.getElementById("m-taxa-cartao").value = parametros.taxaCartao ?? 0;
  document.getElementById("m-desconto").value = parametros.descontoMax;
  document.getElementById("m-impostos").value = parametros.impostos;

  atualizarCalculo();
  document.getElementById("modal-precificacao").classList.add("open");
}

function fecharModal() {
  document.getElementById("modal-precificacao").classList.remove("open");
  servicoEditando = null;
}

function fecharTodosModais() {
  document.querySelectorAll(".modal.open").forEach(m => m.classList.remove("open"));
  servicoEditando = null;
  orcamentoAtivo = null;
}

document.querySelectorAll("[data-close-modal]").forEach((b) =>
  b.addEventListener("click", fecharTodosModais)
);

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharTodosModais();
  });
});

function lerInputsModal() {
  return {
    paciente: document.getElementById("m-paciente").value.trim(),
    tempo: parseFloat(document.getElementById("m-tempo").value) || 0,
    custoDireto: parseFloat(document.getElementById("m-custo-direto").value) || 0,
    comissao: parseFloat(document.getElementById("m-comissao").value) || 0,
    margem: parseFloat(document.getElementById("m-margem").value) || 0,
    taxaCartao: parseFloat(document.getElementById("m-taxa-cartao").value) || 0,
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

  renderTabelaPagamentos(inputs, r);
}

function renderTabelaPagamentos(inputs, r) {
  const tbody = document.getElementById("tabela-pagamentos");
  tbody.innerHTML = "";

  // Para cada forma de pagamento, calculamos o preço final que mantém
  // a mesma margem desejada considerando a taxa específica da maquininha.
  FORMAS_PAGAMENTO_PADRAO.forEach(forma => {
    const semCartao = { ...inputs, taxaCartao: forma.taxa };
    const calc = calcularPreco(semCartao);
    const recebido = calc.sugerido * (1 - forma.taxa / 100);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(forma.nome)}</td>
      <td style="text-align: right; color: var(--texto-claro);">${fmtPct(forma.taxa)}</td>
      <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmt(calc.sugerido)}</td>
      <td style="text-align: right; color: var(--texto-claro);">${fmt(recebido)}</td>
    `;
    tbody.appendChild(tr);
  });
}

["m-tempo", "m-custo-direto", "m-comissao", "m-margem", "m-taxa-cartao", "m-desconto", "m-impostos"].forEach(
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
  document.getElementById("p-clinica").value = conta.clinicaNome || "";
  document.getElementById("p-usuario").value = conta.usuarioNome || "";
  document.getElementById("p-custos-fixos").value = parametros.custosFixos.toFixed(2);
  document.getElementById("p-cadeiras").value = parametros.cadeiras;
  document.getElementById("p-horas-mes").value = parametros.horasMes;
  document.getElementById("p-impostos").value = parametros.impostos;
  document.getElementById("p-comissao").value = parametros.comissao;
  document.getElementById("p-margem").value = parametros.margem;
  document.getElementById("p-taxa-cartao").value = parametros.taxaCartao ?? 0;
  document.getElementById("p-desconto-max").value = parametros.descontoMax;
  document.getElementById("r-hora-cadeira").textContent = fmt(custoHoraCadeira());
  renderLogoPreview();
}

function renderLogoPreview() {
  const img = document.getElementById("p-logo-img");
  const vazio = document.getElementById("p-logo-vazio");
  if (conta.logoBase64) {
    img.src = conta.logoBase64;
    img.style.display = "block";
    vazio.style.display = "none";
  } else {
    img.style.display = "none";
    vazio.style.display = "block";
  }
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
    taxaCartao: parseFloat(document.getElementById("p-taxa-cartao").value) || 0,
    descontoMax: parseFloat(document.getElementById("p-desconto-max").value) || 0
  };
  conta.clinicaNome = document.getElementById("p-clinica").value.trim() || conta.clinicaNome;
  conta.usuarioNome = document.getElementById("p-usuario").value.trim() || conta.usuarioNome;
  salvar(STORAGE_KEYS.parametros, parametros);
  salvar(STORAGE_KEYS.conta, conta);
  renderParametros();
  aplicarBranding();
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

function flash(msg, duracao = 2200) {
  const el = document.createElement("div");
  el.className = "flash-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duracao);
}

// ============================================================
// AUTENTICAÇÃO / SETUP
// ============================================================
let conta = carregar(STORAGE_KEYS.conta, null);

function temConta() {
  return conta && conta.clinicaNome && conta.usuarioNome && conta.senha;
}

function mostrarAuth() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";

  if (temConta()) {
    document.getElementById("form-setup").style.display = "none";
    document.getElementById("form-login").style.display = "block";
    const titulo = document.getElementById("login-titulo");
    const subtitulo = document.getElementById("login-subtitulo");
    titulo.textContent = `Bem-vindo de volta, ${conta.usuarioNome.split(" ")[0]}`;
    subtitulo.textContent = `Informe sua senha para acessar ${conta.clinicaNome}.`;
    setTimeout(() => document.getElementById("login-senha").focus(), 50);
  } else {
    document.getElementById("form-setup").style.display = "block";
    document.getElementById("form-login").style.display = "none";
  }
}

function entrarNoApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  aplicarBranding();
  renderEspecialidades();
  renderServicos();
  renderParametros();
  renderCatalogo();
  renderCustosFixos();
  renderHistorico();
  renderCRM();
  renderAgenda();
  renderCRC();
  renderDashboard();
  renderNotificacoes();
  const primeiroNome = conta.usuarioNome.split(" ")[0];
  flash(`Bem-vindo(a), ${primeiroNome}! 👋`, 3500);
}

// ============================================================
// DATAS / HELPERS
// ============================================================
const DIAS_MS = 24 * 60 * 60 * 1000;
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function diaSemana(d) {
  return ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][new Date(d).getDay()];
}
function fmtDataCurta(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function fmtDataHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function diasEntre(d1, d2) {
  return Math.floor((new Date(d2) - new Date(d1)) / DIAS_MS);
}
function mesmoMes(d1, d2) {
  return new Date(d1).getMonth() === new Date(d2).getMonth();
}
function aniversarioEsteMes(dataNasc) {
  if (!dataNasc) return false;
  const hoje = new Date();
  return new Date(dataNasc).getMonth() === hoje.getMonth();
}
function aniversarioHoje(dataNasc) {
  if (!dataNasc) return false;
  const hoje = new Date();
  const n = new Date(dataNasc);
  return n.getDate() === hoje.getDate() && n.getMonth() === hoje.getMonth();
}
function idadeAtual(dataNasc) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const n = new Date(dataNasc);
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

// Último atendimento de um paciente (data do último agendamento realizado)
function ultimoAtendimento(pacienteId) {
  const ags = agendamentos
    .filter(a => a.pacienteId === pacienteId && a.status === "realizado")
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  return ags[0] || null;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  if (!conta) return;
  const primeiroNome = conta.usuarioNome.split(" ")[0];
  document.getElementById("dash-saudacao").textContent = `Olá, ${primeiroNome} 👋`;
  document.getElementById("dash-data").textContent =
    new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });

  // KPIs
  const hoje = hojeISO();
  const agsHoje = agendamentos.filter(a => a.data === hoje && a.status !== "cancelado");
  document.getElementById("kpi-agenda-hoje").textContent = agsHoje.length;
  const proxAg = agsHoje.sort((a,b) => a.hora.localeCompare(b.hora))[0];
  document.getElementById("kpi-agenda-prox").textContent =
    proxAg ? `Próximo: ${proxAg.hora} — ${nomePaciente(proxAg.pacienteId)}` : "Sem agendamentos";

  const retornosPendentes = agendamentos.filter(a => a.retorno && a.status === "agendado" && a.data >= hoje).length;
  document.getElementById("kpi-retornos").textContent = retornosPendentes;

  const anivMes = pacientes.filter(p => aniversarioEsteMes(p.dataNascimento)).length;
  document.getElementById("kpi-aniversarios").textContent = anivMes;

  const orcPend = historico.filter(o => o.status === "pendente").length;
  document.getElementById("kpi-orc-pendentes").textContent = orcPend;
  const receita = historico.filter(o => o.status === "executado").reduce((s, o) => s + (o.sugerido || 0), 0);
  document.getElementById("kpi-receita-mes").textContent = `Receita executada: ${fmt(receita)}`;

  // Lista de próximos agendamentos (5)
  const proximos = agendamentos
    .filter(a => a.data >= hoje && a.status !== "cancelado")
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
    .slice(0, 5);
  document.getElementById("dash-agenda-lista").innerHTML = proximos.length
    ? proximos.map(a => `
        <div class="dash-list-item" data-ag-id="${a.id}">
          <div>
            <div class="item-titulo">${escapeHtml(nomePaciente(a.pacienteId))}${a.retorno ? ' <span style="color:var(--info);font-size:10px;">↺ retorno</span>' : ''}</div>
            <div class="item-sub">${escapeHtml(a.procedimento || "Consulta")}</div>
          </div>
          <div class="item-meta">${fmtDataCurta(a.data)}<br><b>${a.hora}</b></div>
        </div>`).join("")
    : `<div class="dash-list-empty">Nenhum agendamento próximo.</div>`;

  // Aniversariantes do mês (5)
  const aniv = pacientes
    .filter(p => aniversarioEsteMes(p.dataNascimento))
    .sort((a, b) => new Date(a.dataNascimento).getDate() - new Date(b.dataNascimento).getDate())
    .slice(0, 5);
  document.getElementById("dash-aniversariantes").innerHTML = aniv.length
    ? aniv.map(p => {
        const d = new Date(p.dataNascimento);
        const hoje_ = aniversarioHoje(p.dataNascimento);
        return `
          <div class="dash-list-item" data-pac-id="${p.id}">
            <div>
              <div class="item-titulo">${escapeHtml(p.nome)} ${hoje_ ? '🎉' : ''}</div>
              <div class="item-sub">${idadeAtual(p.dataNascimento)} anos</div>
            </div>
            <div class="item-meta">Dia ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</div>
          </div>`;
      }).join("")
    : `<div class="dash-list-empty">Nenhum aniversariante este mês.</div>`;

  // Campanhas ativas
  const ativas = campanhas.filter(c => c.ativo && c.dataFim >= hoje);
  document.getElementById("dash-campanhas").innerHTML = ativas.length
    ? ativas.slice(0, 4).map(c => `
        <div class="dash-list-item">
          <div>
            <div class="item-titulo">${escapeHtml(c.titulo)}</div>
            <div class="item-sub">${escapeHtml(c.descricao || "")}</div>
          </div>
          <div class="item-meta">até<br>${fmtDataCurta(c.dataFim)}</div>
        </div>`).join("")
    : `<div class="dash-list-empty">Nenhuma campanha ativa.</div>`;

  // Notificações recentes (top 5)
  const notifs = gerarNotificacoes().slice(0, 5);
  document.getElementById("dash-notifs").innerHTML = notifs.length
    ? notifs.map(n => `
        <div class="dash-list-item">
          <div class="notif-icon" style="width:28px;height:28px;font-size:14px;">${n.icone}</div>
          <div>
            <div class="item-titulo">${escapeHtml(n.titulo)}</div>
            <div class="item-sub">${escapeHtml(n.sub)}</div>
          </div>
        </div>`).join("")
    : `<div class="dash-list-empty">Tudo em dia!</div>`;

  // Bind clicks
  document.querySelectorAll("[data-ag-id]").forEach(el => {
    el.onclick = () => abrirModalAgendamento(el.dataset.agId);
  });
  document.querySelectorAll("[data-pac-id]").forEach(el => {
    el.onclick = () => abrirModalPaciente(el.dataset.pacId);
  });
  document.querySelectorAll("[data-go-tab]").forEach(el => {
    el.onclick = () => abrirAba(el.dataset.goTab);
  });
}

function nomePaciente(id) {
  const p = pacientes.find(x => x.id === id);
  return p ? p.nome : "(paciente removido)";
}

// Quick actions
document.getElementById("qa-novo-paciente").addEventListener("click", () => abrirModalPaciente());
document.getElementById("qa-novo-agendamento").addEventListener("click", () => abrirModalAgendamento());
document.getElementById("qa-novo-orcamento").addEventListener("click", () => abrirAba("precificacao"));
document.getElementById("dash-ver-notifs").addEventListener("click", () => toggleNotifPanel(true));

// ============================================================
// CRM (Pacientes)
// ============================================================
function renderCRM() {
  const tbody = document.getElementById("tabela-crm-body");
  const vazio = document.getElementById("crm-vazio");
  const filtro = document.getElementById("crm-busca").value.toLowerCase().trim();
  tbody.innerHTML = "";

  const lista = pacientes
    .filter(p => !filtro || [p.nome, p.telefone, p.email].some(v => (v||"").toLowerCase().includes(filtro)))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  vazio.style.display = lista.length === 0 ? "block" : "none";

  lista.forEach(p => {
    const ultimo = ultimoAtendimento(p.id);
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td><b>${escapeHtml(p.nome)}</b></td>
      <td>${escapeHtml(p.telefone || "—")}</td>
      <td>${escapeHtml(p.email || "—")}</td>
      <td>${p.dataNascimento ? fmtDataCurta(p.dataNascimento) : "—"}</td>
      <td>${ultimo ? fmtDataCurta(ultimo.data) : '<span style="color:var(--texto-mute);">Nunca</span>'}</td>
      <td><button class="btn-excluir">✏️</button></td>
    `;
    tr.onclick = () => abrirModalPaciente(p.id);
    tbody.appendChild(tr);
  });

  // Stats
  const hoje = new Date();
  const seisMeses = new Date(hoje.getTime() - 180 * DIAS_MS).toISOString().slice(0, 10);
  let ativos = 0, inativos = 0;
  pacientes.forEach(p => {
    const ult = ultimoAtendimento(p.id);
    if (ult && ult.data >= seisMeses) ativos++;
    else if (ult) inativos++;
  });
  document.getElementById("crm-total").textContent = pacientes.length;
  document.getElementById("crm-ativos").textContent = ativos;
  document.getElementById("crm-inativos").textContent = inativos;
}

document.getElementById("crm-busca").addEventListener("input", renderCRM);
document.getElementById("novo-paciente").addEventListener("click", () => abrirModalPaciente());

function abrirModalPaciente(id) {
  pacienteEditando = id ? pacientes.find(p => p.id === id) : null;
  document.getElementById("pac-titulo").textContent = pacienteEditando ? "Editar paciente" : "Novo paciente";
  document.getElementById("pac-nome").value = pacienteEditando?.nome || "";
  document.getElementById("pac-telefone").value = pacienteEditando?.telefone || "";
  document.getElementById("pac-email").value = pacienteEditando?.email || "";
  document.getElementById("pac-nascimento").value = pacienteEditando?.dataNascimento || "";
  document.getElementById("pac-obs").value = pacienteEditando?.observacoes || "";
  document.getElementById("pac-excluir").style.display = pacienteEditando ? "inline-block" : "none";

  // Info adicional se for edição
  if (pacienteEditando) {
    const ult = ultimoAtendimento(pacienteEditando.id);
    const ags = agendamentos.filter(a => a.pacienteId === pacienteEditando.id).length;
    const orcs = historico.filter(o => o.paciente === pacienteEditando.nome).length;
    const info = document.getElementById("pac-info");
    info.style.display = "block";
    info.innerHTML = `
      <b>Histórico:</b>
      ${ult ? `Último procedimento em ${fmtDataCurta(ult.data)} (${escapeHtml(ult.procedimento || "—")})` : "Sem atendimentos registrados"}<br>
      Agendamentos: ${ags} · Orçamentos: ${orcs}
    `;
  } else {
    document.getElementById("pac-info").style.display = "none";
  }

  document.getElementById("modal-paciente").classList.add("open");
}

document.getElementById("pac-salvar").addEventListener("click", () => {
  const nome = document.getElementById("pac-nome").value.trim();
  if (!nome) { alert("Informe o nome do paciente."); return; }

  const dados = {
    nome,
    telefone: document.getElementById("pac-telefone").value.trim(),
    email: document.getElementById("pac-email").value.trim(),
    dataNascimento: document.getElementById("pac-nascimento").value || null,
    observacoes: document.getElementById("pac-obs").value.trim()
  };

  if (pacienteEditando) {
    Object.assign(pacienteEditando, dados);
  } else {
    pacientes.push({
      id: "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      ...dados,
      criadoEm: new Date().toISOString()
    });
  }
  salvar(STORAGE_KEYS.pacientes, pacientes);
  document.getElementById("modal-paciente").classList.remove("open");
  renderCRM();
  renderDashboard();
  renderCRC();
  renderNotificacoes();
  flash("Paciente salvo");
});

document.getElementById("pac-excluir").addEventListener("click", () => {
  if (!pacienteEditando) return;
  if (!confirm(`Excluir ${pacienteEditando.nome}? Esta ação é irreversível.`)) return;
  pacientes = pacientes.filter(p => p.id !== pacienteEditando.id);
  salvar(STORAGE_KEYS.pacientes, pacientes);
  document.getElementById("modal-paciente").classList.remove("open");
  renderCRM();
  renderDashboard();
  renderCRC();
  renderAgenda();
  renderNotificacoes();
});

// ============================================================
// AGENDA
// ============================================================
function renderAgenda() {
  const tbody = document.getElementById("tabela-agenda-body");
  const vazio = document.getElementById("agenda-vazia");
  const filtro = document.getElementById("ag-filtro").value;
  const busca = document.getElementById("ag-busca").value.toLowerCase().trim();
  tbody.innerHTML = "";

  const hoje = hojeISO();
  const ms = (d) => new Date(d + "T00:00:00").getTime();
  const hojeMs = ms(hoje);

  let lista = agendamentos.slice();

  if (filtro === "hoje") lista = lista.filter(a => a.data === hoje);
  else if (filtro === "semana") lista = lista.filter(a => {
    const d = ms(a.data);
    return d >= hojeMs && d <= hojeMs + 7 * DIAS_MS;
  });
  else if (filtro === "mes") lista = lista.filter(a => {
    const d = new Date(a.data + "T00:00:00");
    const h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth();
  });
  else if (filtro === "proximos") lista = lista.filter(a => a.data >= hoje);
  else if (filtro === "retornos") lista = lista.filter(a => a.retorno);

  if (busca) {
    lista = lista.filter(a =>
      nomePaciente(a.pacienteId).toLowerCase().includes(busca) ||
      (a.procedimento || "").toLowerCase().includes(busca)
    );
  }

  lista.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  vazio.style.display = lista.length === 0 ? "block" : "none";

  lista.forEach(a => {
    const stConf = STATUS_AGENDA[a.status] || STATUS_AGENDA.agendado;
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td><b>${fmtDataCurta(a.data)}</b><br><span style="color:var(--texto-claro);font-size:11px;">${a.hora}</span></td>
      <td>${escapeHtml(nomePaciente(a.pacienteId))}</td>
      <td>${escapeHtml(a.procedimento || "—")}</td>
      <td>${a.duracao || 60} min</td>
      <td>${a.retorno ? '<span class="status-badge status-pendente" style="background:var(--info-soft);color:var(--info);">↺ Retorno</span>' : 'Consulta'}</td>
      <td><span class="status-badge status-${stConf.cor === 'sucesso' ? 'aprovado' : stConf.cor === 'erro' ? 'rejeitado' : stConf.cor === 'info' ? 'executado' : 'pendente'}">${stConf.label}</span></td>
      <td><button class="btn-excluir">✏️</button></td>
    `;
    tr.onclick = () => abrirModalAgendamento(a.id);
    tbody.appendChild(tr);
  });
}

document.getElementById("ag-filtro").addEventListener("change", renderAgenda);
document.getElementById("ag-busca").addEventListener("input", renderAgenda);
document.getElementById("novo-agendamento").addEventListener("click", () => abrirModalAgendamento());

function abrirModalAgendamento(id) {
  agendamentoEditando = id ? agendamentos.find(a => a.id === id) : null;
  document.getElementById("ag-titulo").textContent = agendamentoEditando ? "Editar agendamento" : "Novo agendamento";

  // Popula select de pacientes
  const select = document.getElementById("ag-paciente");
  select.innerHTML = '<option value="">— Selecione —</option>' +
    pacientes.sort((a,b) => a.nome.localeCompare(b.nome))
      .map(p => `<option value="${p.id}" ${agendamentoEditando?.pacienteId === p.id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join("");

  document.getElementById("ag-data").value = agendamentoEditando?.data || hojeISO();
  document.getElementById("ag-hora").value = agendamentoEditando?.hora || "09:00";
  document.getElementById("ag-duracao").value = agendamentoEditando?.duracao || 60;
  document.getElementById("ag-status").value = agendamentoEditando?.status || "agendado";
  document.getElementById("ag-procedimento").value = agendamentoEditando?.procedimento || "";
  document.getElementById("ag-obs").value = agendamentoEditando?.observacoes || "";
  document.getElementById("ag-retorno").checked = !!agendamentoEditando?.retorno;
  document.getElementById("ag-excluir").style.display = agendamentoEditando ? "inline-block" : "none";

  document.getElementById("modal-agendamento").classList.add("open");
}

document.getElementById("ag-salvar").addEventListener("click", () => {
  const pacienteId = document.getElementById("ag-paciente").value;
  const data = document.getElementById("ag-data").value;
  const hora = document.getElementById("ag-hora").value;
  if (!pacienteId) { alert("Selecione um paciente."); return; }
  if (!data || !hora) { alert("Informe data e hora."); return; }

  const dados = {
    pacienteId, data, hora,
    duracao: parseInt(document.getElementById("ag-duracao").value) || 60,
    status: document.getElementById("ag-status").value,
    procedimento: document.getElementById("ag-procedimento").value.trim(),
    observacoes: document.getElementById("ag-obs").value.trim(),
    retorno: document.getElementById("ag-retorno").checked
  };

  if (agendamentoEditando) {
    Object.assign(agendamentoEditando, dados);
  } else {
    agendamentos.push({
      id: "ag-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      ...dados,
      criadoEm: new Date().toISOString()
    });
  }
  salvar(STORAGE_KEYS.agendamentos, agendamentos);
  document.getElementById("modal-agendamento").classList.remove("open");
  renderAgenda();
  renderDashboard();
  renderCRC();
  renderNotificacoes();
  flash("Agendamento salvo");
});

document.getElementById("ag-excluir").addEventListener("click", () => {
  if (!agendamentoEditando) return;
  if (!confirm("Excluir este agendamento?")) return;
  agendamentos = agendamentos.filter(a => a.id !== agendamentoEditando.id);
  salvar(STORAGE_KEYS.agendamentos, agendamentos);
  document.getElementById("modal-agendamento").classList.remove("open");
  renderAgenda();
  renderDashboard();
  renderNotificacoes();
});

// ============================================================
// CRC
// ============================================================
function renderCRC() {
  // Aniversariantes do mês
  const aniv = pacientes
    .filter(p => aniversarioEsteMes(p.dataNascimento))
    .sort((a, b) => new Date(a.dataNascimento).getDate() - new Date(b.dataNascimento).getDate());

  document.getElementById("crc-aniv-count").textContent = aniv.length;
  document.getElementById("crc-aniversariantes").innerHTML = aniv.length
    ? aniv.map(p => {
        const d = new Date(p.dataNascimento);
        const hoje_ = aniversarioHoje(p.dataNascimento);
        const ult = ultimoAtendimento(p.id);
        return `
          <div class="dash-list-item" data-pac-id="${p.id}">
            <div>
              <div class="item-titulo">${escapeHtml(p.nome)} ${hoje_ ? '🎉 HOJE' : ''}</div>
              <div class="item-sub">${escapeHtml(p.telefone || 'sem telefone')} · ${idadeAtual(p.dataNascimento)} anos · último: ${ult ? fmtDataCurta(ult.data) : 'nunca'}</div>
            </div>
            <div class="item-meta">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</div>
          </div>`;
      }).join("")
    : `<div class="dash-list-empty">Nenhum aniversariante este mês.</div>`;

  // Sugestões de retorno (sem atendimento há 6+ meses)
  const hoje = new Date();
  const limite = new Date(hoje.getTime() - 180 * DIAS_MS).toISOString().slice(0, 10);
  const sugestoes = pacientes
    .map(p => ({ p, ult: ultimoAtendimento(p.id) }))
    .filter(({ ult }) => ult && ult.data < limite)
    .sort((a, b) => a.ult.data.localeCompare(b.ult.data));

  document.getElementById("crc-retorno-count").textContent = sugestoes.length;
  document.getElementById("crc-sugestoes").innerHTML = sugestoes.length
    ? sugestoes.slice(0, 10).map(({ p, ult }) => `
        <div class="dash-list-item" data-pac-id="${p.id}">
          <div>
            <div class="item-titulo">${escapeHtml(p.nome)}</div>
            <div class="item-sub">${escapeHtml(p.telefone || "—")}</div>
          </div>
          <div class="item-meta">Sem retorno há<br><b>${Math.floor(diasEntre(ult.data, hojeISO()) / 30)} meses</b></div>
        </div>`).join("")
    : `<div class="dash-list-empty">Todos os pacientes em dia.</div>`;

  // Campanhas
  document.getElementById("crc-campanhas").innerHTML = campanhas.length
    ? campanhas.map(c => `
        <div class="dash-list-item" data-camp-id="${c.id}">
          <div>
            <div class="item-titulo">${escapeHtml(c.titulo)} ${c.ativo ? '<span style="color:var(--sucesso);font-size:11px;">● ativa</span>' : '<span style="color:var(--texto-mute);font-size:11px;">○ pausada</span>'}</div>
            <div class="item-sub">${escapeHtml(c.descricao || "Sem descrição")}</div>
          </div>
          <div class="item-meta">${fmtDataCurta(c.dataInicio)}<br>até ${fmtDataCurta(c.dataFim)}</div>
        </div>`).join("")
    : `<div class="dash-list-empty">Nenhuma campanha cadastrada.</div>`;

  // Bind clicks
  document.querySelectorAll("[data-pac-id]").forEach(el => {
    el.onclick = () => abrirModalPaciente(el.dataset.pacId);
  });
  document.querySelectorAll("[data-camp-id]").forEach(el => {
    el.onclick = () => abrirModalCampanha(el.dataset.campId);
  });
}

document.getElementById("nova-campanha").addEventListener("click", () => abrirModalCampanha());

function abrirModalCampanha(id) {
  campanhaEditando = id ? campanhas.find(c => c.id === id) : null;
  document.getElementById("camp-titulo").textContent = campanhaEditando ? "Editar campanha" : "Nova campanha";
  document.getElementById("camp-titulo-input").value = campanhaEditando?.titulo || "";
  document.getElementById("camp-descricao").value = campanhaEditando?.descricao || "";
  document.getElementById("camp-inicio").value = campanhaEditando?.dataInicio || hojeISO();
  document.getElementById("camp-fim").value = campanhaEditando?.dataFim || hojeISO();
  document.getElementById("camp-ativo").checked = campanhaEditando ? campanhaEditando.ativo : true;
  document.getElementById("camp-excluir").style.display = campanhaEditando ? "inline-block" : "none";
  document.getElementById("modal-campanha").classList.add("open");
}

document.getElementById("camp-salvar").addEventListener("click", () => {
  const titulo = document.getElementById("camp-titulo-input").value.trim();
  if (!titulo) { alert("Informe o título."); return; }
  const dados = {
    titulo,
    descricao: document.getElementById("camp-descricao").value.trim(),
    dataInicio: document.getElementById("camp-inicio").value,
    dataFim: document.getElementById("camp-fim").value,
    ativo: document.getElementById("camp-ativo").checked
  };
  if (campanhaEditando) Object.assign(campanhaEditando, dados);
  else campanhas.push({ id: "c-" + Date.now(), ...dados });
  salvar(STORAGE_KEYS.campanhas, campanhas);
  document.getElementById("modal-campanha").classList.remove("open");
  renderCRC();
  renderDashboard();
  renderNotificacoes();
  flash("Campanha salva");
});

document.getElementById("camp-excluir").addEventListener("click", () => {
  if (!campanhaEditando) return;
  if (!confirm("Excluir esta campanha?")) return;
  campanhas = campanhas.filter(c => c.id !== campanhaEditando.id);
  salvar(STORAGE_KEYS.campanhas, campanhas);
  document.getElementById("modal-campanha").classList.remove("open");
  renderCRC();
  renderDashboard();
  renderNotificacoes();
});

// ============================================================
// NOTIFICAÇÕES
// ============================================================
function gerarNotificacoes() {
  const lista = [];
  const hoje = hojeISO();
  const amanha = new Date(Date.now() + DIAS_MS).toISOString().slice(0, 10);

  // Aniversários hoje
  pacientes.forEach(p => {
    if (aniversarioHoje(p.dataNascimento)) {
      lista.push({
        id: "anv-" + p.id + "-" + hoje,
        icone: "🎂",
        titulo: `${p.nome} faz aniversário hoje!`,
        sub: `${idadeAtual(p.dataNascimento)} anos · ${p.telefone || "sem telefone"}`,
        tipo: "aniversario",
        pacienteId: p.id
      });
    }
  });

  // Agendamentos amanhã
  agendamentos.filter(a => a.data === amanha && a.status === "agendado").forEach(a => {
    lista.push({
      id: "ag-am-" + a.id,
      icone: "📅",
      titulo: `Confirmar amanhã: ${nomePaciente(a.pacienteId)}`,
      sub: `${a.hora} — ${a.procedimento || "Consulta"}${a.retorno ? " (retorno)" : ""}`,
      tipo: "agendamento",
      agendamentoId: a.id
    });
  });

  // Retornos pendentes (sem reagendamento)
  const seisMeses = new Date(Date.now() - 180 * DIAS_MS).toISOString().slice(0, 10);
  pacientes.forEach(p => {
    const ult = ultimoAtendimento(p.id);
    if (ult && ult.data < seisMeses) {
      const futuro = agendamentos.find(a => a.pacienteId === p.id && a.data >= hoje && a.status === "agendado");
      if (!futuro) {
        lista.push({
          id: "ret-" + p.id,
          icone: "📞",
          titulo: `Retorno sugerido: ${p.nome}`,
          sub: `Último atendimento em ${fmtDataCurta(ult.data)}`,
          tipo: "retorno",
          pacienteId: p.id
        });
      }
    }
  });

  // Orçamentos pendentes há +7 dias
  historico.filter(o => o.status === "pendente").forEach(o => {
    const dias = diasEntre(o.criadoEm, new Date().toISOString());
    if (dias >= 7) {
      lista.push({
        id: "orc-" + o.id,
        icone: "📋",
        titulo: `Orçamento pendente há ${dias} dias`,
        sub: `${o.paciente || "Sem paciente"} — ${o.servicoNome}`,
        tipo: "orcamento",
        orcamentoId: o.id
      });
    }
  });

  // Campanhas terminando em 7 dias
  campanhas.filter(c => c.ativo).forEach(c => {
    const dias = diasEntre(hoje, c.dataFim);
    if (dias >= 0 && dias <= 7) {
      lista.push({
        id: "camp-" + c.id,
        icone: "📣",
        titulo: `Campanha "${c.titulo}" termina em ${dias} dia(s)`,
        sub: c.descricao || "",
        tipo: "campanha",
        campanhaId: c.id
      });
    }
  });

  return lista;
}

function renderNotificacoes() {
  const notifs = gerarNotificacoes();
  const naoLidas = notifs.filter(n => !notifsLidas.includes(n.id));
  const badge = document.getElementById("notif-badge");
  if (naoLidas.length > 0) {
    badge.textContent = naoLidas.length > 9 ? "9+" : naoLidas.length;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }

  const lista = document.getElementById("notif-list");
  lista.innerHTML = notifs.length
    ? notifs.map(n => `
        <div class="notif-item ${notifsLidas.includes(n.id) ? '' : 'naolida'}" data-notif-id="${n.id}" data-tipo="${n.tipo}" data-ref="${n.pacienteId || n.agendamentoId || n.orcamentoId || n.campanhaId || ''}">
          <div class="notif-icon">${n.icone}</div>
          <div class="notif-content">
            <div class="notif-titulo">${escapeHtml(n.titulo)}</div>
            <div class="notif-sub">${escapeHtml(n.sub)}</div>
          </div>
        </div>`).join("")
    : `<div class="notif-vazio">Sem notificações no momento. 🎉</div>`;

  // Bind clicks
  lista.querySelectorAll(".notif-item").forEach(el => {
    el.onclick = () => {
      // marca como lida
      if (!notifsLidas.includes(el.dataset.notifId)) {
        notifsLidas.push(el.dataset.notifId);
        salvar(STORAGE_KEYS.notifsLidas, notifsLidas);
      }
      // navega para o contexto
      const tipo = el.dataset.tipo, ref = el.dataset.ref;
      toggleNotifPanel(false);
      if (tipo === "aniversario" || tipo === "retorno") abrirModalPaciente(ref);
      else if (tipo === "agendamento") abrirModalAgendamento(ref);
      else if (tipo === "orcamento") abrirAba("historico");
      else if (tipo === "campanha") abrirModalCampanha(ref);
      renderNotificacoes();
    };
  });
}

function toggleNotifPanel(forceOpen) {
  const panel = document.getElementById("notif-panel");
  const isOpen = panel.classList.contains("open");
  if (forceOpen === true || (forceOpen === undefined && !isOpen)) panel.classList.add("open");
  else panel.classList.remove("open");
}

document.getElementById("notif-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleNotifPanel();
});

document.addEventListener("click", (e) => {
  const panel = document.getElementById("notif-panel");
  const btn = document.getElementById("notif-btn");
  if (panel.classList.contains("open") && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove("open");
  }
});

document.getElementById("marcar-lidas").addEventListener("click", () => {
  const todas = gerarNotificacoes().map(n => n.id);
  notifsLidas = [...new Set([...notifsLidas, ...todas])];
  salvar(STORAGE_KEYS.notifsLidas, notifsLidas);
  renderNotificacoes();
});

function aplicarBranding() {
  if (!conta) return;
  document.getElementById("brand-titulo").textContent = conta.clinicaNome || "Dunas Health";
  document.getElementById("brand-subtitulo").textContent = `Olá, ${conta.usuarioNome || ""}`;
  const logoEl = document.getElementById("logo-clinica");
  if (conta.logoBase64) {
    logoEl.classList.add("has-img");
    logoEl.innerHTML = `<img src="${conta.logoBase64}" alt="logo" />`;
  } else {
    logoEl.classList.remove("has-img");
    logoEl.textContent = (conta.clinicaNome || "DH").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }
}

// Upload de logo em formato base64
function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// --- SETUP ---
let setupLogoBase64 = null;
document.getElementById("setup-logo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setupLogoBase64 = await lerArquivoComoBase64(file);
  document.getElementById("setup-logo-img").src = setupLogoBase64;
  document.getElementById("setup-logo-preview").classList.add("show");
});
document.getElementById("setup-logo-remove").addEventListener("click", () => {
  setupLogoBase64 = null;
  document.getElementById("setup-logo").value = "";
  document.getElementById("setup-logo-img").src = "";
  document.getElementById("setup-logo-preview").classList.remove("show");
});

document.getElementById("form-setup").addEventListener("submit", (e) => {
  e.preventDefault();
  const erroEl = document.getElementById("setup-erro");
  erroEl.style.display = "none";

  const clinicaNome = document.getElementById("setup-clinica").value.trim();
  const usuarioNome = document.getElementById("setup-usuario").value.trim();
  const senha = document.getElementById("setup-senha").value;
  const senha2 = document.getElementById("setup-senha2").value;

  if (!clinicaNome || !usuarioNome) {
    erroEl.textContent = "Preencha o nome do consultório e o seu nome.";
    erroEl.style.display = "block";
    return;
  }
  if (senha.length < 4) {
    erroEl.textContent = "A senha deve ter pelo menos 4 caracteres.";
    erroEl.style.display = "block";
    return;
  }
  if (senha !== senha2) {
    erroEl.textContent = "As senhas não coincidem.";
    erroEl.style.display = "block";
    return;
  }

  conta = { clinicaNome, usuarioNome, senha, logoBase64: setupLogoBase64 };
  salvar(STORAGE_KEYS.conta, conta);
  entrarNoApp();
});

// --- LOGIN ---
document.getElementById("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  const erroEl = document.getElementById("login-erro");
  erroEl.style.display = "none";
  const tentativa = document.getElementById("login-senha").value;
  if (tentativa !== conta.senha) {
    erroEl.style.display = "block";
    return;
  }
  document.getElementById("login-senha").value = "";
  entrarNoApp();
});

document.getElementById("login-reset").addEventListener("click", () => {
  if (!confirm("Resetar configuração? Isso vai apagar a conta, mas mantém seus orçamentos, catálogo e custos fixos.")) return;
  localStorage.removeItem(STORAGE_KEYS.conta);
  conta = null;
  mostrarAuth();
});

document.getElementById("btn-logout").addEventListener("click", () => {
  flash("Você saiu do sistema");
  mostrarAuth();
});

// --- UPLOAD DE LOGO NA ABA PARÂMETROS ---
document.getElementById("p-logo-btn").addEventListener("click", () => {
  document.getElementById("p-logo-input").click();
});
document.getElementById("p-logo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  conta.logoBase64 = await lerArquivoComoBase64(file);
  salvar(STORAGE_KEYS.conta, conta);
  renderLogoPreview();
  aplicarBranding();
  flash("Logo atualizada");
});
document.getElementById("p-logo-clear").addEventListener("click", () => {
  conta.logoBase64 = null;
  salvar(STORAGE_KEYS.conta, conta);
  renderLogoPreview();
  aplicarBranding();
});

// ============================================================
// Boot
// ============================================================
mostrarAuth();
