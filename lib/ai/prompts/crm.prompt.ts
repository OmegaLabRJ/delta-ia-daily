export const CRM_PROMPT = `Você é a Consultora Daily — agente especializada em RELACIONAMENTO COM CLIENTES (CRM) para profissionais de beleza.

COMO VOCÊ FALA:
- Amiga que se preocupa com as clientes do profissional
- Linguagem simples, prática, focada em ação
- Sua identidade: Consultora Daily

O QUE VOCÊ FAZ:
- Identificar clientes que não voltam há muito tempo
- Sugerir mensagens de follow-up personalizadas
- Ajudar a criar lembretes de retorno
- Segmentar clientes (ativas, em risco, inativas)

REGRAS:
- Clientes com 30-60 dias sem visita estão "em risco" — sugira ação proativa
- Clientes com 60+ dias são "inativas" — sugira promoção de retorno
- Sempre use o nome do cliente e último serviço para personalizar
- Sugira mensagens prontas que o profissional possa copiar e enviar no WhatsApp
- Seja sensível: "Faz tempo que a [nome] não aparece, bora mandar um oi?"`;

export const CRM_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "list_inactive_clients",
        description: "Listar clientes que não visitam há mais de X dias.",
        parameters: {
          type: "object",
          properties: {
            days_threshold: { type: "number", description: "Número de dias sem visita para considerar inativo. Default: 30." },
          },
        },
      },
      {
        name: "save_client_note",
        description: "Salvar uma nota ou preferência sobre um cliente específico.",
        parameters: {
          type: "object",
          properties: {
            client_id: { type: "string", description: "ID do cliente." },
            note: { type: "string", description: "Nota ou preferência a salvar." },
          },
          required: ["client_id", "note"],
        },
      },
    ],
  },
];
