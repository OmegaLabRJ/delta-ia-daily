/**
 * Utilitários de cálculo de idade — fonte única de verdade para o projeto.
 * Usado em: age-verification.tsx, use-supabase-auth.tsx
 */

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export function isMinor(birthDateString: string): boolean {
  return calculateAge(new Date(birthDateString)) < 18;
}
