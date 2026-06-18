// Catálogo padrão de procedimentos odontológicos por especialidade.
// Valores de referência (Brasil) — devem ser ajustados pela clínica.
// custoDireto = materiais/insumos/laboratório por procedimento
// tempo = minutos de cadeira
// comissao = % padrão sugerido para o profissional
const CATALOGO_PADRAO = [
  {
    id: "ortodontia",
    nome: "Ortodontia",
    icone: "🦷",
    servicos: [
      { nome: "Documentação ortodôntica inicial", tempo: 30, custoDireto: 80, comissao: 20 },
      { nome: "Instalação de aparelho fixo metálico", tempo: 90, custoDireto: 250, comissao: 30 },
      { nome: "Instalação de aparelho fixo estético", tempo: 100, custoDireto: 480, comissao: 30 },
      { nome: "Manutenção mensal de aparelho fixo", tempo: 30, custoDireto: 35, comissao: 35 },
      { nome: "Aparelho autoligado", tempo: 100, custoDireto: 650, comissao: 30 },
      { nome: "Alinhador invisível (kit)", tempo: 60, custoDireto: 3800, comissao: 25 },
      { nome: "Contenção fixa", tempo: 45, custoDireto: 90, comissao: 30 },
      { nome: "Contenção removível (placa)", tempo: 30, custoDireto: 180, comissao: 30 },
      { nome: "Colagem de braquete (avulso)", tempo: 20, custoDireto: 25, comissao: 30 },
      { nome: "Remoção de aparelho fixo", tempo: 45, custoDireto: 40, comissao: 30 }
    ]
  },
  {
    id: "exodontia",
    nome: "Exodontia / Cirurgia",
    icone: "🪥",
    servicos: [
      { nome: "Extração simples (dente erupcionado)", tempo: 30, custoDireto: 35, comissao: 40 },
      { nome: "Extração de raiz residual", tempo: 40, custoDireto: 45, comissao: 40 },
      { nome: "Extração de siso erupcionado", tempo: 45, custoDireto: 60, comissao: 40 },
      { nome: "Extração de siso semi-incluso", tempo: 60, custoDireto: 110, comissao: 45 },
      { nome: "Extração de siso incluso", tempo: 90, custoDireto: 180, comissao: 45 },
      { nome: "Odontosecção", tempo: 60, custoDireto: 80, comissao: 45 },
      { nome: "Frenectomia labial", tempo: 45, custoDireto: 90, comissao: 40 },
      { nome: "Frenectomia lingual", tempo: 45, custoDireto: 90, comissao: 40 },
      { nome: "Biópsia de tecido mole", tempo: 40, custoDireto: 70, comissao: 40 },
      { nome: "Apicectomia", tempo: 75, custoDireto: 140, comissao: 40 },
      { nome: "Sutura / hemostasia", tempo: 20, custoDireto: 25, comissao: 35 }
    ]
  },
  {
    id: "dentistica",
    nome: "Dentística (Restauradora)",
    icone: "✨",
    servicos: [
      { nome: "Restauração em resina — 1 face", tempo: 45, custoDireto: 35, comissao: 40 },
      { nome: "Restauração em resina — 2 faces", tempo: 60, custoDireto: 55, comissao: 40 },
      { nome: "Restauração em resina — 3 faces", tempo: 75, custoDireto: 75, comissao: 40 },
      { nome: "Restauração em amálgama", tempo: 45, custoDireto: 30, comissao: 35 },
      { nome: "Faceta direta de resina", tempo: 75, custoDireto: 90, comissao: 40 },
      { nome: "Faceta indireta de porcelana", tempo: 90, custoDireto: 380, comissao: 30 },
      { nome: "Lente de contato dental", tempo: 90, custoDireto: 520, comissao: 30 },
      { nome: "Reanatomização dental", tempo: 60, custoDireto: 60, comissao: 40 },
      { nome: "Polimento de restauração", tempo: 20, custoDireto: 10, comissao: 35 }
    ]
  },
  {
    id: "endodontia",
    nome: "Endodontia",
    icone: "🦴",
    servicos: [
      { nome: "Tratamento de canal — unirradicular", tempo: 60, custoDireto: 70, comissao: 40 },
      { nome: "Tratamento de canal — birradicular", tempo: 90, custoDireto: 90, comissao: 40 },
      { nome: "Tratamento de canal — multirradicular", tempo: 120, custoDireto: 130, comissao: 40 },
      { nome: "Retratamento endodôntico", tempo: 120, custoDireto: 160, comissao: 40 },
      { nome: "Pulpotomia (permanente)", tempo: 45, custoDireto: 50, comissao: 40 },
      { nome: "Curativo de demora", tempo: 30, custoDireto: 25, comissao: 35 },
      { nome: "Remoção de pino intra-radicular", tempo: 60, custoDireto: 80, comissao: 40 },
      { nome: "Núcleo de preenchimento", tempo: 45, custoDireto: 60, comissao: 40 }
    ]
  },
  {
    id: "periodontia",
    nome: "Periodontia",
    icone: "🌿",
    servicos: [
      { nome: "Raspagem supragengival (por sextante)", tempo: 30, custoDireto: 15, comissao: 40 },
      { nome: "Raspagem subgengival (por sextante)", tempo: 45, custoDireto: 25, comissao: 40 },
      { nome: "Profilaxia + polimento", tempo: 30, custoDireto: 18, comissao: 40 },
      { nome: "Aplicação tópica de flúor", tempo: 15, custoDireto: 8, comissao: 35 },
      { nome: "Cirurgia periodontal (por sextante)", tempo: 75, custoDireto: 120, comissao: 40 },
      { nome: "Enxerto gengival livre", tempo: 90, custoDireto: 220, comissao: 40 },
      { nome: "Aumento de coroa clínica", tempo: 75, custoDireto: 130, comissao: 40 },
      { nome: "Gengivoplastia / gengivectomia", tempo: 60, custoDireto: 90, comissao: 40 }
    ]
  },
  {
    id: "protese",
    nome: "Prótese",
    icone: "👑",
    servicos: [
      { nome: "Prótese total (dentadura)", tempo: 90, custoDireto: 480, comissao: 30 },
      { nome: "Prótese parcial removível (PPR)", tempo: 90, custoDireto: 620, comissao: 30 },
      { nome: "Coroa metalocerâmica", tempo: 90, custoDireto: 580, comissao: 30 },
      { nome: "Coroa de zircônia", tempo: 90, custoDireto: 980, comissao: 30 },
      { nome: "Coroa provisória", tempo: 45, custoDireto: 60, comissao: 35 },
      { nome: "Prótese sobre implante (unitária)", tempo: 90, custoDireto: 850, comissao: 30 },
      { nome: "Protocolo (arcada completa) — etapa clínica", tempo: 120, custoDireto: 2200, comissao: 25 },
      { nome: "Conserto / reembasamento de prótese", tempo: 45, custoDireto: 90, comissao: 35 },
      { nome: "Placa miorrelaxante", tempo: 60, custoDireto: 180, comissao: 30 }
    ]
  },
  {
    id: "implantodontia",
    nome: "Implantodontia",
    icone: "🔩",
    servicos: [
      { nome: "Implante unitário (osseointegrado)", tempo: 90, custoDireto: 850, comissao: 30 },
      { nome: "Implante + carga imediata", tempo: 120, custoDireto: 1500, comissao: 30 },
      { nome: "Enxerto ósseo autógeno", tempo: 90, custoDireto: 600, comissao: 30 },
      { nome: "Enxerto ósseo xenógeno", tempo: 75, custoDireto: 750, comissao: 30 },
      { nome: "Levantamento de seio maxilar", tempo: 120, custoDireto: 950, comissao: 30 },
      { nome: "Cicatrizador / reabertura", tempo: 30, custoDireto: 90, comissao: 30 },
      { nome: "Mini implante ortodôntico", tempo: 45, custoDireto: 180, comissao: 30 },
      { nome: "Remoção de implante", tempo: 60, custoDireto: 200, comissao: 35 }
    ]
  },
  {
    id: "odontopediatria",
    nome: "Odontopediatria",
    icone: "🧒",
    servicos: [
      { nome: "Consulta inicial / adaptação", tempo: 30, custoDireto: 15, comissao: 40 },
      { nome: "Profilaxia infantil", tempo: 30, custoDireto: 15, comissao: 40 },
      { nome: "Aplicação tópica de flúor (infantil)", tempo: 20, custoDireto: 10, comissao: 35 },
      { nome: "Selante de fóssulas e fissuras", tempo: 20, custoDireto: 18, comissao: 35 },
      { nome: "Restauração em dente decíduo", tempo: 40, custoDireto: 35, comissao: 40 },
      { nome: "Pulpotomia em dente decíduo", tempo: 45, custoDireto: 60, comissao: 40 },
      { nome: "Extração de dente decíduo", tempo: 25, custoDireto: 20, comissao: 40 },
      { nome: "Mantenedor de espaço", tempo: 45, custoDireto: 180, comissao: 30 }
    ]
  },
  {
    id: "estetica",
    nome: "Estética / Harmonização",
    icone: "💎",
    servicos: [
      { nome: "Clareamento de consultório (sessão)", tempo: 60, custoDireto: 120, comissao: 35 },
      { nome: "Clareamento caseiro (kit + moldeira)", tempo: 60, custoDireto: 180, comissao: 30 },
      { nome: "Clareamento combinado (caseiro + consultório)", tempo: 90, custoDireto: 280, comissao: 30 },
      { nome: "Clareamento de dente desvitalizado", tempo: 45, custoDireto: 60, comissao: 35 },
      { nome: "Toxina botulínica (área motora)", tempo: 30, custoDireto: 280, comissao: 30 },
      { nome: "Preenchimento labial", tempo: 45, custoDireto: 380, comissao: 30 },
      { nome: "Bichectomia", tempo: 60, custoDireto: 250, comissao: 35 }
    ]
  },
  {
    id: "diagnostico",
    nome: "Diagnóstico / Consultas",
    icone: "🩺",
    servicos: [
      { nome: "Consulta de avaliação", tempo: 30, custoDireto: 5, comissao: 50 },
      { nome: "Consulta de urgência", tempo: 45, custoDireto: 20, comissao: 50 },
      { nome: "Plano de tratamento", tempo: 30, custoDireto: 5, comissao: 30 },
      { nome: "Radiografia periapical", tempo: 10, custoDireto: 8, comissao: 20 },
      { nome: "Documentação completa (foto + radiografia)", tempo: 40, custoDireto: 60, comissao: 20 }
    ]
  }
];

// Composição padrão de custos fixos mensais do consultório
const CUSTOS_FIXOS_PADRAO = [
  { categoria: "Infraestrutura", descricao: "Aluguel do imóvel", valor: 6500 },
  { categoria: "Infraestrutura", descricao: "Condomínio + IPTU", valor: 850 },
  { categoria: "Utilidades", descricao: "Energia elétrica", valor: 950 },
  { categoria: "Utilidades", descricao: "Água e esgoto", valor: 280 },
  { categoria: "Utilidades", descricao: "Internet + telefonia", valor: 350 },
  { categoria: "Pessoal", descricao: "Salário recepcionista", valor: 2800 },
  { categoria: "Pessoal", descricao: "Salário ASB (auxiliar)", valor: 2400 },
  { categoria: "Pessoal", descricao: "Encargos sociais (FGTS+INSS)", valor: 2100 },
  { categoria: "Pessoal", descricao: "Vale-transporte / refeição", valor: 750 },
  { categoria: "Serviços", descricao: "Contador", valor: 650 },
  { categoria: "Serviços", descricao: "Software de gestão", valor: 380 },
  { categoria: "Serviços", descricao: "Manutenção de equipamentos", valor: 450 },
  { categoria: "Marketing", descricao: "Anúncios e mídias sociais", valor: 1200 },
  { categoria: "Operacional", descricao: "Materiais de limpeza", valor: 280 },
  { categoria: "Operacional", descricao: "Insumos de esterilização", valor: 520 },
  { categoria: "Operacional", descricao: "EPIs (luvas, máscaras, etc.)", valor: 680 },
  { categoria: "Regulatório", descricao: "CRO / Alvará / Anvisa", valor: 180 },
  { categoria: "Financeiro", descricao: "Tarifas bancárias / maquininha fixa", valor: 220 }
];

// Parâmetros padrão da clínica
const PARAMETROS_PADRAO = {
  custosFixos: 21540,    // soma do CUSTOS_FIXOS_PADRAO (R$/mês)
  cadeiras: 2,
  horasMes: 176,         // 8h x 22 dias
  impostos: 8.5,         // Simples Nacional ~ 6-15%
  comissao: 35,          // % padrão
  margem: 35,            // margem de lucro desejada
  taxaCartao: 3.99,      // taxa média maquininha (crédito à vista)
  descontoMax: 10        // desconto máximo permitido
};

// Formas de pagamento e respectivas taxas padrão (%) — usadas para
// mostrar o preço final por método de pagamento na tela de precificação.
const FORMAS_PAGAMENTO_PADRAO = [
  { nome: "Dinheiro / PIX", taxa: 0 },
  { nome: "Débito", taxa: 1.99 },
  { nome: "Crédito à vista", taxa: 3.99 },
  { nome: "Crédito 3x", taxa: 5.49 },
  { nome: "Crédito 6x", taxa: 7.99 },
  { nome: "Crédito 12x", taxa: 12.99 }
];

// Pacientes — começa vazio, usuário cadastra
const PACIENTES_PADRAO = [];

// Agendamentos — começa vazio
const AGENDAMENTOS_PADRAO = [];

// Campanhas promocionais — exemplos iniciais
const CAMPANHAS_PADRAO = [
  {
    id: "c-bem-vindo",
    titulo: "Limpeza de boas-vindas",
    descricao: "15% de desconto na primeira profilaxia para novos pacientes.",
    dataInicio: "2026-01-01",
    dataFim: "2026-12-31",
    ativo: true
  }
];

// Status de agendamento
const STATUS_AGENDA = {
  agendado: { label: "Agendado", cor: "info" },
  confirmado: { label: "Confirmado", cor: "sucesso" },
  realizado: { label: "Realizado", cor: "sucesso" },
  cancelado: { label: "Cancelado", cor: "erro" },
  faltou: { label: "Faltou", cor: "alerta" }
};

// Estágios do Kanban do CRM
const KANBAN_COLUNAS = [
  { id: "novo", label: "Novo / Lead", classe: "kanban-col-novo" },
  { id: "ativo", label: "Em atendimento", classe: "kanban-col-ativo" },
  { id: "retorno", label: "Aguardando retorno", classe: "kanban-col-retorno" },
  { id: "inativo", label: "Inativo", classe: "kanban-col-inativo" }
];

// Metas comerciais padrão (exemplos)
const METAS_PADRAO = [];

const TIPOS_META = {
  receita: { label: "Receita executada", unidade: "R$", formato: "moeda" },
  pacientes: { label: "Novos pacientes", unidade: "", formato: "num" },
  procedimentos: { label: "Procedimentos realizados", unidade: "", formato: "num" },
  orcamentos: { label: "Orçamentos aprovados", unidade: "", formato: "num" }
};
