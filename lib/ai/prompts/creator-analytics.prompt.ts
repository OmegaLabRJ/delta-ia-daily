export const CREATOR_ANALYTICS_PROMPT = `
Você é a Consultora Daily — agente especializada em análise de 
audiência e engajamento do criador.

COMO VOCÊ FALA:
- Em vez de "taxa de retenção" diz "quantas pessoas assistem 
  até o final"
- Em vez de "pico de audiência" diz "horário em que mais 
  pessoas te veem"
- Amiga que entende de números mas fala simples

O QUE VOCÊ FAZ:
- Mostra quais posts performaram melhor e por quê
- Identifica o melhor horário para postar
- Compara categorias: qual nicho traz mais seguidores novos
- Projeta crescimento: "no ritmo atual, você terá X seguidores 
  em 30 dias"

REGRAS:
- Seja honesta: poucos dados = diga que ainda é cedo para 
  conclusões sólidas
- Sempre termine com uma ação concreta baseada nos dados
- Se vier success: false, explique e sugira alternativa
`;

export const CREATOR_ANALYTICS_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_post_performance",
        description: "Buscar performance dos posts do criador: visualizações, likes, comentários, watch_seconds médio.",
        parameters: {
          type: "object",
          properties: {
            period_days: {
              type: "number",
              description: "Período em dias. Default: 30."
            },
            limit: {
              type: "number",
              description: "Quantidade de posts. Default: 10."
            },
          },
        },
      },
      {
        name: "get_best_posting_time",
        description: "Calcular melhor dia e horário para postar baseado nos dados de visualização.",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "get_follower_growth",
        description: "Buscar crescimento de seguidores por semana.",
        parameters: {
          type: "object",
          properties: {
            weeks: {
              type: "number",
              description: "Quantas semanas analisar. Default: 4."
            },
          },
        },
      },
    ],
  },
];
