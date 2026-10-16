// Qarz bo'yicha odamlar ("Odamlar" ro'yxati). Server va client ikkalasi ishlatadi — 'use server'/'use client' emas
export type CounterpartyOption = { id: string; name: string; phone: string | null };

// Ism solishtirish uchun: ortiqcha bo'sh joysiz va katta-kichik harfsiz ("Ali  aka" = "ali aka")
export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Saqlanadigan ko'rinishi: chetdagi va ichma-ich ortiqcha bo'sh joylarsiz
export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}
