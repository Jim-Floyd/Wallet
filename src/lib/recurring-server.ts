import { prisma } from '@/lib/prisma';
import { occurrenceDate, type Frequency } from '@/lib/recurring';

// Bir martada bitta qoida uchun eng ko'pi shuncha takror (uzoq vaqt kirilmagan kunlik takrorlar uchun chegara)
const MAX_CATCH_UP = 400;

// Muddati kelgan takrorlanuvchi yozuvlarni yaratadi. Ma'lumot ko'rsatadigan sahifalar boshida chaqiriladi.
// Bir vaqtda ikki so'rov kelsa ham takror ikki marta yaratilmaydi: qoida faqat nextDate o'zgarmagan bo'lsa yangilanadi,
// aks holda butun tranzaksiya bekor bo'ladi.
export async function processRecurring(userId: string) {
  const now = new Date();
  const due = await prisma.recurringRule.findMany({ where: { userId, nextDate: { lte: now } } });

  for (const rule of due) {
    const dates: Date[] = [];
    let count = rule.count;
    let next = rule.nextDate;
    while (next <= now && dates.length < MAX_CATCH_UP) {
      dates.push(next);
      count++;
      next = occurrenceDate(rule.startDate, rule.frequency as Frequency, count);
    }

    const amount = Number(rule.amount);
    const delta = (rule.type === 'INCOME' ? amount : -amount) * dates.length;

    try {
      await prisma.$transaction([
        prisma.recurringRule.update({
          where: { id: rule.id, nextDate: rule.nextDate },
          data: { count, nextDate: next },
        }),
        prisma.transaction.createMany({
          data: dates.map(date => ({
            userId,
            walletId: rule.walletId,
            recurringId: rule.id,
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            category: rule.category,
            description: rule.description,
            date,
          })),
        }),
        prisma.wallet.update({ where: { id: rule.walletId }, data: { balance: { increment: delta } } }),
      ]);
    } catch (e) {
      // P2025 — boshqa so'rov bu qoidani allaqachon qayta ishlagan
      if ((e as { code?: string }).code !== 'P2025') throw e;
    }
  }
}
