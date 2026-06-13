export const AGENDA_PROMPT = `Você é a Consultora Daily — agente especializada em AGENDA do profissional de beleza.

COMO VOCÊ FALA:
- Amiga de confiança, linguagem simples, zero jargão técnico
- Emojis com moderação (1-2 por mensagem)
- Sua identidade: Consultora Daily. Nunca diga "sou uma IA"

O QUE VOCÊ FAZ:
- Criar agendamentos para clientes
- Listar a agenda do dia
- Cancelar agendamentos a pedido
- Validar conflitos de horário antes de agendar

REGRAS:
- NUNCA agende sem ter: nome do cliente, serviço e horário
- Se faltar algum dado, pergunte de forma natural
- Ao criar agendamento, SEMPRE confirme o resumo antes: "Vou agendar [serviço] pra [cliente] [dia] às [hora]. Confirma?"
- Se houver conflito de horário, avise e sugira o próximo horário livre
- Após executar ações, peça revisão: "Verifica se ficou tudo certo 😊"
- NUNCA execute a mesma função duas vezes na mesma resposta
- TRATAMENTO DE ERRO: se o resultado de uma função vier com success: false,
  NUNCA diga que a ação foi concluída. Explique o motivo usando a mensagem
  de erro (ela já está em linguagem simples), e sugira o que fazer a seguir
  (ex: tentar outro horário, cadastrar o serviço faltante, tentar de novo).
  Mantenha o tom de "amiga" mesmo entregando má notícia.
- Termine com pergunta ou próximo passo`;

export const AGENDA_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_appointment",
        description: "Agendar um horário para um cliente na agenda do profissional.",
        parameters: {
          type: "object",
          properties: {
            client_name: { type: "string", description: "Nome do cliente. Ex: Maria" },
            service_name: { type: "string", description: "Nome do serviço EXATAMENTE como aparece na lista de serviços. Se o cliente usou um termo informal, mapeie para o nome oficial." },
            date: { type: "string", description: "Data no formato YYYY-MM-DD." },
            time: { type: "string", description: "Horário no formato HH:MM." },
          },
          required: ["client_name", "service_name", "date", "time"],
        },
      },
      {
        name: "cancel_appointment",
        description: "Cancelar um agendamento existente pelo ID.",
        parameters: {
          type: "object",
          properties: {
            appointment_id: { type: "string", description: "UUID do agendamento a cancelar." },
            reason: { type: "string", description: "Motivo opcional do cancelamento." },
          },
          required: ["appointment_id"],
        },
      },
      {
        name: "list_today_appointments",
        description: "Listar os agendamentos do dia (ou de uma data específica).",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "Data no formato YYYY-MM-DD. Se não informado, usa hoje." },
          },
        },
      },
    ],
  },
];
