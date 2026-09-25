// Formadagi "YYYY-MM-DD" sanani Date ga aylantiradi.
// Bugun bo'lsa hozirgi vaqt, aks holda kun o'rtasi (vaqt zonasi siljishidan himoya).
// "today" va "originalDate" brauzerdan keladi (foydalanuvchi vaqt zonasida).
// Tahrirlashda sana o'zgarmagan bo'lsa — undefined, ya'ni eski sana qoladi.
export function parseFormDate(formData: FormData, field = 'date'): Date | undefined | { error: string } {
  const date = formData.get(field) as string | null;
  const today = formData.get('today') as string | null;
  const originalDate = formData.get('originalDate') as string | null;
  if (!date || date === originalDate) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Sana noto'g'ri" };
  if (date === today) return new Date();
  return new Date(`${date}T12:00:00`);
}

// Brauzerda: Date → "YYYY-MM-DD" mahalliy vaqtda
export function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
