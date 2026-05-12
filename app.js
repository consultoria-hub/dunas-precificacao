// ============================================================
// Dunas Health — Sistema de Precificação Odontológica
// ============================================================

const STORAGE_KEYS = {
  catalogo: "dunas.catalogo",
  parametros: "dunas.parametros",
  precos: "dunas.precos" // mapa: "espId::servicoIdx" -> { tempo, custoDireto, ... resultado }
};

// --- Estado em memória ---
let catalogo = carregar(STORAGE_KEYS.catalogo, CATALOGO_PADRAO);
let parametros = carregar(STORAGE_KEYS.parametros, PARAMETROS_PADRAO);
let precosSalvos = carregar(STORAGE_KEYS.precos, {});
let especialidadeAtiva = catalogo[0]?.id;
let servicoEditando = null; // { espId, idx, servico }

// ============================================================
// Persistência
// ============================================================
function carregar(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : structuredClone(padrao);
  } catch {
    return structuredClone(padrao);
  }
}
function salvar(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

// ============================================================
// Formatação
// ============================================================
const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});
const fmt = (v) => fmtBRL.format(isFinite(v) ? v : 0);
const fmtPct = (v) => (isFinite(v) ? v.toFixed(1) : "0") + "%";

// ============================================================
// Cálculo de precificação
// ============================================================
function custoHoraCadeira() {
  const { custosFixos, cadeiras, horasMes } = parametros;
  const total = cadeiras * horasMes;
  return total > 0 ? custosFixos / total : 0;
}

/**
 * Calcula a estrutura de preços de um procedimento.
 *
 * Custo total      = custo fixo alocado (tempo x hora-cadeira) + custo direto
 * Ponto equilíbrio = custo total / (1 - (impostos + comissão)/100)
 *                    → preço onde lucro = 0 após pagar comissão e impostos
 * Preço sugerido   = custo total / (1 - (impostos + comissão + margem)/100)
 *                    → preço que atinge a margem de lucro desejada
 * Preço mínimo     = preço sugerido x (1 - desconto máximo)
 */
function calcularPreco({ tempo, custoDireto, comissao, margem, descontoMax, impostos }) {
  const horaCadeira = custoHoraCadeira();
  const custoFixoAlocado = (tempo / 60) * horaCadeira;
  const custoTotal = custoFixoAlocado + custoDireto;

  const cargaEquilibrio = (impostos + comissao) / 100;
  const cargaSugerido = (impostos + comissao + margem) / 100;

  const equilibrio = cargaEquilibrio < 1 ? custoTotal / (1 - cargaEquilibrio) : 0;
  const sugerido = cargaSugerido < 1 ? custoTotal / (1 - cargaSugerido) : 0;
  const minimo = sugerido * (1 - descontoMax / 100);

  // margem efetiva = (preço - custoTotal - impostos - comissão) / preço
  const margemEfetiva =
    sugerido > 0
      ? ((sugerido - custoTotal - sugerido * (impostos + comissao) / 100) / sugerido) * 100
      : 0;

  return {
    horaCadeira,
    custoFixoAlocado,
    custoTotal,
    equilibrio,
    sugerido,
    minimo,
    margemEfetiva
  };
}

// ============================================================
// Tabs
// ============================================================
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ============================================================
// Renderização — Sidebar de especialidades
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
// Renderização — Grid de procedimentos
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

    const card = document.createElement("div");
    card.className = "card-servico";

    const chaveSalva = `${esp.id}::${idx}`;
    const salvo = precosSalvos[chaveSalva];

    const precoHtml = salvo
      ? `<div class="preco">${fmt(salvo.sugerido)}</div>`
      : `<div class="preco-vazio">Clique para precificar</div>`;

    card.innerHTML = `
      <h4>${s.nome}</h4>
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
    grid.innerHTML = `<p style="color:var(--texto-claro);font-style:italic;">Nenhum procedimento encontrado.</p>`;
  }
}

document.getElementById("busca").addEventListener("input", renderServicos);

// ============================================================
// Modal de precificação
// ============================================================
function abrirModal(espId, idx) {
  const esp = catalogo.find((e) => e.id === espId);
  const servico = esp.servicos[idx];
  servicoEditando = { espId, idx, servico };

  const chave = `${espId}::${idx}`;
  const salvo = precosSalvos[chave];

  document.getElementById("modal-titulo").textContent = `${esp.nome} — ${servico.nome}`;
  document.getElementById("m-tempo").value = salvo?.tempo ?? servico.tempo;
  document.getElementById("m-custo-direto").value = salvo?.custoDireto ?? servico.custoDireto;
  document.getElementById("m-comissao").value = salvo?.comissao ?? servico.comissao ?? parametros.comissao;
  document.getElementById("m-margem").value = salvo?.margem ?? parametros.margem;
  document.getElementById("m-desconto").value = salvo?.descontoMax ?? parametros.descontoMax;
  document.getElementById("m-impostos").value = salvo?.impostos ?? parametros.impostos;

  atualizarCalculo();
  document.getElementById("modal-precificacao").classList.add("open");
}

function fecharModal() {
  document.getElementById("modal-precificacao").classList.remove("open");
  servicoEditando = null;
}

document.querySelectorAll("[data-close-modal]").forEach((b) =>
  b.addEventListener("click", fecharModal)
);

document.getElementById("modal-precificacao").addEventListener("click", (e) => {
  if (e.target.id === "modal-precificacao") fecharModal();
});

function lerInputsModal() {
  return {
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
  const { espId, idx } = servicoEditando;
  const inputs = lerInputsModal();
  const r = calcularPreco(inputs);

  precosSalvos[`${espId}::${idx}`] = { ...inputs, ...r };
  salvar(STORAGE_KEYS.precos, precosSalvos);

  // Atualiza também o catálogo (tempo / custo / comissão) caso o usuário tenha ajustado
  const esp = catalogo.find((e) => e.id === espId);
  esp.servicos[idx].tempo = inputs.tempo;
  esp.servicos[idx].custoDireto = inputs.custoDireto;
  esp.servicos[idx].comissao = inputs.comissao;
  salvar(STORAGE_KEYS.catalogo, catalogo);

  fecharModal();
  renderServicos();
  renderCatalogo();
});

// ============================================================
// Parâmetros da clínica
// ============================================================
function renderParametros() {
  document.getElementById("p-custos-fixos").value = parametros.custosFixos;
  document.getElementById("p-cadeiras").value = parametros.cadeiras;
  document.getElementById("p-horas-mes").value = parametros.horasMes;
  document.getElementById("p-impostos").value = parametros.impostos;
  document.getElementById("p-comissao").value = parametros.comissao;
  document.getElementById("p-margem").value = parametros.margem;
  document.getElementById("p-desconto-max").value = parametros.descontoMax;
  document.getElementById("r-hora-cadeira").textContent = fmt(custoHoraCadeira());
}

["p-custos-fixos", "p-cadeiras", "p-horas-mes"].forEach((id) =>
  document.getElementById(id).addEventListener("input", () => {
    parametros.custosFixos = parseFloat(document.getElementById("p-custos-fixos").value) || 0;
    parametros.cadeiras = parseFloat(document.getElementById("p-cadeiras").value) || 1;
    parametros.horasMes = parseFloat(document.getElementById("p-horas-mes").value) || 1;
    document.getElementById("r-hora-cadeira").textContent = fmt(custoHoraCadeira());
  })
);

document.getElementById("salvar-parametros").addEventListener("click", () => {
  parametros = {
    custosFixos: parseFloat(document.getElementById("p-custos-fixos").value) || 0,
    cadeiras: parseFloat(document.getElementById("p-cadeiras").value) || 1,
    horasMes: parseFloat(document.getElementById("p-horas-mes").value) || 1,
    impostos: parseFloat(document.getElementById("p-impostos").value) || 0,
    comissao: parseFloat(document.getElementById("p-comissao").value) || 0,
    margem: parseFloat(document.getElementById("p-margem").value) || 0,
    descontoMax: parseFloat(document.getElementById("p-desconto-max").value) || 0
  };
  salvar(STORAGE_KEYS.parametros, parametros);
  renderParametros();
  alert("Parâmetros salvos com sucesso.");
});

// ============================================================
// Catálogo (edição inline)
// ============================================================
function renderCatalogo() {
  const tbody = document.getElementById("tabela-catalogo-body");
  tbody.innerHTML = "";

  catalogo.forEach((esp) => {
    esp.servicos.forEach((s, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esp.nome}</td>
        <td><input data-f="nome" value="${escapeHtml(s.nome)}" /></td>
        <td><input data-f="tempo" type="number" value="${s.tempo}" /></td>
        <td><input data-f="custoDireto" type="number" step="0.01" value="${s.custoDireto}" /></td>
        <td><input data-f="comissao" type="number" step="0.1" value="${s.comissao ?? parametros.comissao}" /></td>
        <td><button class="btn-excluir" title="Excluir">✕</button></td>
      `;
      tr.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("change", () => {
          const f = inp.dataset.f;
          s[f] = f === "nome" ? inp.value : parseFloat(inp.value) || 0;
          salvar(STORAGE_KEYS.catalogo, catalogo);
          renderServicos();
        });
      });
      tr.querySelector(".btn-excluir").addEventListener("click", () => {
        if (confirm(`Excluir "${s.nome}"?`)) {
          esp.servicos.splice(idx, 1);
          delete precosSalvos[`${esp.id}::${idx}`];
          salvar(STORAGE_KEYS.catalogo, catalogo);
          salvar(STORAGE_KEYS.precos, precosSalvos);
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
    "Especialidade (digite o nome exato de uma existente, ou um nome novo para criar):",
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// ============================================================
// Boot
// ============================================================
renderEspecialidades();
renderServicos();
renderParametros();
renderCatalogo();
