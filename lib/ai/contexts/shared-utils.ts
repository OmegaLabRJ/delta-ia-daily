/**
 * Utilitários compartilhados entre context builders.
 */

const EVENTS_CALENDAR = [
  { name: "Dia da Mulher", emoji: "💐", month: 3, day: 8 },
  { name: "Páscoa", emoji: "🐣", month: 4, day: 20 },
  { name: "Dia das Mães", emoji: "👩‍👧", month: 5, day: 11 },
  { name: "Dia dos Namorados", emoji: "💕", month: 6, day: 12 },
  { name: "Festa Junina", emoji: "🌽", month: 6, day: 24 },
  { name: "Dia dos Pais", emoji: "👨‍👧", month: 8, day: 10 },
  { name: "Dia do Cliente", emoji: "🤝", month: 9, day: 15 },
  { name: "Dia das Crianças", emoji: "🧒", month: 10, day: 12 },
  { name: "Black Friday", emoji: "🏷️", month: 11, day: 28 },
  { name: "Natal", emoji: "🎄", month: 12, day: 25 },
];

export function getUpcomingEvents(windowDays: number = 15): string[] {
  const now = new Date();
  const events: string[] = [];

  for (const evt of EVENTS_CALENDAR) {
    const evtDate = new Date(now.getFullYear(), evt.month - 1, evt.day);
    const diffDays = Math.ceil((evtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= windowDays) {
      events.push(`${evt.emoji} ${evt.name} em ${diffDays} dia(s)!`);
    }
  }

  return events;
}
