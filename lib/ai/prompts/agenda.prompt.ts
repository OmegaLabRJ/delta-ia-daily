export const AGENDA_PROMPT = `Você é a Consultora Daily — agente especializada em AGENDA do profissional independente.

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
- A agenda do app é uma AGENDA GLOBAL. O profissional pode agendar tanto usuários do app quanto clientes externos.
- Ao pedirem para agendar alguém, SE VOCÊ PRECISAR IDENTIFICAR se a pessoa é cliente do app ou não, PERGUNTE: "O(a) [Nome] é usuário(a) do aplicativo ou é um cliente externo?"
- Se for usuário do app, use a ferramenta search_app_user informando o nome ou telefone para encontrar o ID dele. Se encontrar, passe o ID no client_id.
- Se for cliente externo (ou se não encontrar no app), NÃO tem problema. Faça o agendamento informando apenas o client_name (sem client_id) e o sistema fará o registro na agenda global.
- NUNCA agende sem ter: nome do cliente, serviço e horário.
- Se faltar algum dado, pergunte de forma natural.
- Ao criar agendamento, SEMPRE confirme o resumo antes: "Vou agendar [serviço] pra [cliente] [dia] às [hora]. Confirma?"
- Se houver conflito de horário, avise e sugira o próximo horário livre.
- Após executar ações, peça revisão: "Verifica se ficou tudo certo 😊"
- NUNCA execute a mesma função duas vezes na mesma resposta.
- TRATAMENTO DE ERRO: se o resultado de uma função vier com success: false, não diga que foi concluído.
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
            service_name: { type: "string", description: "Nome do serviço EXATAMENTE como aparece na lista de serviços." },
            date: { type: "string", description: "Data no formato YYYY-MM-DD." },
            time: { type: "string", description: "Horário no formato HH:MM." },
            client_id: { type: "string", description: "OPCIONAL: ID do usuário do app, se encontrado via search_app_user." },
          },
          required: ["client_name", "service_name", "date", "time"],
        },
      },
      {
        name: "search_app_user",
        description: "Busca um usuário no aplicativo Daily pelo nome ou telefone.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome ou telefone do cliente para buscar." },
          },
          required: ["query"],
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
