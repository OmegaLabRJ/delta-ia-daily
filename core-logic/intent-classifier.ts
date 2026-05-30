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
    patterns: [/quero agendar/i, /marcar\s+hor[aá]rio/i, /agendamento/i, /agenda\s+(um|uma|o|a|pra|para)/i, /bora\s+marcar(?!\s+hor)/i],
    negations: [/não quero/i, /cancelar/i, /desmarcar/i, /posts/i, /como agendar/i, /onde\s+(fica|vejo)/i]
  },
  {
    intent: "price",
    patterns: [/quanto\s+custa/i, /qual\s+[eo]\s+pre[cç]o/i, /valor\s+d[oa]/i, /tabela\s+de\s+pre[cç]/i],
    negations: [/sugerir preço/i, /mercado/i, /como cobrar/i, /lucro/i, /aumentar/i] 
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
