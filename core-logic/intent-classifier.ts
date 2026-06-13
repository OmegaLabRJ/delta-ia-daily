/**
 * Intent Classifier local com Confidence Score.
 * 
 * Intercepta mensagens antes de baterem na API do Gemini para resolver
 * intenções comuns (ex: agendar, preço) com custo zero e baixa latência.
 */

export interface IntentMatch {
  intent: string;
  confidence: number;
}

interface IntentDefinition {
  intent: string;
  patterns: RegExp[];
  negations: RegExp[];
}

// Definições das intenções básicas para a Consultora (Profissional)
// TODO: Podemos criar uma lista separada para a Delta (Consumidor) depois, se necessário.
const INTENTS: IntentDefinition[] = [
  { 
    intent: "schedule_faq",
    patterns: [/quero\s+(ver|abrir|gerenciar)\s+(minha\s+)?agenda/i, /onde\s+(fica|vejo)\s+(minha\s+)?agenda/i, /como\s+(vejo|acesso|abro)\s+(minha\s+)?agenda/i, /tem\s+hor[aá]rio/i],
    negations: [/agendar/i, /marcar/i, /cliente/i, /pra\s+\w+/i, /nome/i]
  },
  {
    intent: "schedule_action",
    patterns: [/quero agendar/i, /marcar\s+hor[aá]rio/i, /agendamento/i, /agenda\s+(um|uma|o|a|pra|para)/i, /bora\s+marcar(?!\s+hor)/i, /cancelar?\s+agend/i, /desmarcar/i, /minha\s+agenda\s+de\s+hoje/i, /agenda\s+do\s+dia/i, /listar?\s+agend/i],
    negations: [/não quero/i, /posts/i, /como agendar/i, /onde\s+(fica|vejo)/i]
  },
  {
    intent: "pricing_question",
    patterns: [/quanto\s+(cobr|cust)/i, /qual\s+[eo]\s+pre[cç]o/i, /valor\s+d[oa]/i, /tabela\s+de\s+pre[cç]/i, /sugerir?\s+pre[cç]o/i, /precificar/i, /como\s+cobrar/i],
    negations: [/faturamento/i, /receita/i, /ganhei/i]
  },
  {
    intent: "content_request",
    patterns: [/cria\s+(um\s+)?post/i, /legenda/i, /calend[aá]rio\s+de\s+(conte[uú]do|post)/i, /dica\s+de\s+post/i, /o\s+que\s+postar/i, /conte[uú]do\s+pra/i, /ideia\s+de\s+post/i, /criar?\s+conte[uú]do/i, /publica[cç][aã]o/i],
    negations: [/cancelar/i, /agenda/i]
  },
  {
    intent: "analytics_request",
    patterns: [/m[eé]tricas/i, /visualiza[cç][oõ]es/i, /cliques/i, /desempenho/i, /como\s+t[aá]\s+(indo|meu)/i, /performance/i, /estat[ií]sticas/i, /quantas\s+pessoas/i, /an[aá]lise/i],
    negations: [/faturamento/i, /receita/i, /ganhei/i]
  },
  {
    intent: "client_management",
    patterns: [/clientes?\s+(inativos?|sum)/i, /faz\s+tempo\s+que/i, /não\s+v(em|olta)/i, /follow.?up/i, /lembrete\s+de\s+retorno/i, /reten[cç][aã]o/i, /mandar\s+(um\s+)?lembrete/i],
    negations: []
  },
  {
    intent: "finance_question",
    patterns: [/fatur(amento|ei|ar)/i, /receita/i, /ticket\s+m[eé]dio/i, /quanto\s+(ganhei|faturei|vou\s+ganhar)/i, /meta\s+de\s+faturamento/i, /quanto\s+t[oô]\s+ganhan/i],
    negations: [/pre[cç]o/i, /cobrar/i]
  },
  {
    intent: "greeting",
    patterns: [/^(oi|ol[aá]|e\s*a[ií]|bom\s+dia|boa\s+(tarde|noite)|hey|hello|eai)/i],
    negations: [/agendar/i, /post/i, /pre[cç]o/i, /m[eé]trica/i]
  },
  {
    intent: "faq_location",
    patterns: [/onde fica/i, /qual [eo] endereço/i, /localização/i, /me passa o endereço/i],
    negations: [/mudar/i, /alterar/i]
  },
  {
    intent: "faq_hours",
    patterns: [/que horas/i, /horário de funcionamento/i, /aberto/i, /fecha que horas/i],
    negations: [/mudar/i, /alterar/i, /post/i]
  }
];

/**
 * Analisa a mensagem localmente e retorna a intenção e a confiança.
 * 
 * @param text A mensagem do usuário
 * @returns {IntentMatch} Intent e Confidence Score (0.0 a 1.0)
 */
export function classifyLocal(text: string): IntentMatch {
  let bestScore = 0;
  let bestMatch = "open_question";
  
  // Limpa um pouco o texto pra facilitar o regex
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { intent: "empty", confidence: 1.0 };
  }
  
  for (const intentDef of INTENTS) {
    const patternMatches = intentDef.patterns.filter(p => p.test(normalizedText)).length;
    const negationHits   = intentDef.negations.filter(n => n.test(normalizedText)).length;
    
    // Matemática do Score: Cada hit positivo dá +1. Cada hit negativo retira -1.5 (peso maior)
    const intentScore = (patternMatches * 1.0) - (negationHits * 1.5);
    
    if (intentScore > bestScore) {
      bestScore = intentScore;
      bestMatch = intentDef.intent;
    }
  }
  
  return {
    // Só assumimos a intent se o score foi no mínimo 1 (ou seja, 1 hit limpo sem negações)
    intent: bestScore >= 1 ? bestMatch : "open_question",
    // Normaliza para o máximo de 1.0. Se bateu 2 patterns limpos, confidence = 1.0.
    confidence: Math.max(0, Math.min(bestScore / 2, 1.0)) 
  };
}
