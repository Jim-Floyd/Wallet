# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npx prisma db push --accept-data-loss   # Push schema changes to DB (no migrations)
npx prisma generate                      # Regenerate Prisma client after schema changes
```

No test suite is configured yet.

## Architecture

**Stack:** Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Supabase (Auth + DB), Prisma ORM, next-intl.

### Route Structure

```
src/app/[locale]/
  (app)/          ← protected group (middleware enforces Supabase session)
    layout.tsx    ← sidebar + header shell
    dashboard/    wallets/  transactions/  ai/  budget/  goals/  billing/  referral/  settings/
  auth/           ← public: login, register, forgot-password, reset-password, callback
  layout.tsx      ← next-intl NextIntlClientProvider
  page.tsx        ← redirects / → /uz
```

Supported locales: `uz` (default), `ru`, `en`. Locale is always the first URL segment.

### Data Flow

Pages are **Server Components** that query Prisma directly — there is no API layer. Mutations use **Server Actions** with the `useFormState` + `useFormStatus` pattern (matching `src/lib/actions/auth.ts` as the canonical example).

After every mutation call `revalidatePath('/', 'layout')` to refresh all nested routes simultaneously.

### Prisma Setup

The Prisma client is generated into `src/generated/prisma/` (non-standard output). Always import from `@/lib/prisma` (singleton with `PrismaPg` adapter). Two DB URLs are required:

- `DATABASE_URL` — pooler connection (port 6543, pgbouncer=true) — used at runtime
- `DIRECT_URL` — direct connection (port 5432) — used by `prisma.config.ts` for migrations/push
- `NEXT_PUBLIC_APP_URL` — full app URL (e.g. `http://localhost:3000`) — used in email redirect links

**`.env` is committed encrypted (dotenvx).** `npm run dev/build/start` wrap Next with `dotenvx run`, and `prisma.config.ts` imports `@dotenvx/dotenvx/config`. The private key lives in `.env.keys` (gitignored) or the `DOTENV_PRIVATE_KEY` env var. Change values with `npx dotenvx set KEY value` — never paste plaintext into `.env`. Ad-hoc scripts must run under `npx dotenvx run --` (plain `dotenv` sees only `encrypted:` strings).

After editing `prisma/schema.prisma`, run `npx prisma generate` before `npx prisma db push`.

### Auth

Supabase handles auth. `src/middleware.ts` runs `supabase.auth.getSession()` on every non-public request and redirects unauthenticated users to `/{locale}/auth/login`.

Server actions get the current user via `createClient()` → `supabase.auth.getUser()`. `User.id` in Prisma equals the Supabase `auth.users` UUID.

On first login/registration, `createUserWithWallet()` in `auth.ts` creates the Prisma `User` row and a default "Naqd pul" wallet. This is called from both `login` and `verifyPhoneOtp`.

Two auth flows are supported:
- **Email/password** — `login`, `register`, `forgotPassword`, `resetPassword`
- **Phone OTP (SMS)** — `sendPhoneOtp` → `verifyPhoneOtp`; `normalizePhone()` normalizes Uzbek numbers to E.164 (`+998...`)

### Balance Integrity

`addTransaction` uses `prisma.$transaction([create, update])` for atomic transaction creation + balance update. Never update wallet balance outside a Prisma transaction.

### Currency Conversion (Transfers)

`CURRENCY_RANK = { UZS:1, RUB:2, USD:3, EUR:4 }` — higher rank = stronger currency.

- Stronger → weaker (e.g. USD → UZS): `toAmount = amount * rate`
- Weaker → stronger (e.g. UZS → USD): `toAmount = amount / rate`

Cross-currency transfers store `toAmount` + `toCurrency` on the Transaction record; same-currency transfers leave them null.

### i18n

Translation files: `messages/uz.json`, `messages/ru.json`, `messages/en.json`. Use `getTranslations()` in Server Components and `useTranslations()` in Client Components.

- **No hardcoded UI text** — every user-visible string (labels, dialog titles, server-action errors via `getTranslations('errors')`) goes into all three files. Messages are ICU: use `{count, plural, ...}` for ru/en counts.
- **Formatting** — use `formatMoney(amount, currency, locale)` from `src/lib/intl.ts` and `formatDay()` from `src/lib/days.ts`; never hardcode `'uz-UZ'`.
- **Default categories** are stored in the DB by their Uzbek name (`Oziq-ovqat`, ...); display them with `categoryName(name, tCat)` (`defaultCategories` namespace). User-created categories are shown as typed.
- Pure libs that return text take a `t: Translate` argument instead of hardcoding strings (`dayLabel`, `dueInfo`, `debtTxLabel`).

---

## Current State & Next Work

_Last updated: 2026-09-24 (Sessiya 17)_

### Completed (ishlaydi)

| What | File(s) | Notes |
|------|---------|-------|
| Auth (email/password + phone OTP) | `src/lib/actions/auth.ts`, `src/components/auth/` | `createUserWithWallet` login va verifyPhoneOtp da chaqiriladi |
| Dashboard page | `src/app/[locale]/(app)/dashboard/page.tsx` | Multi-currency balance, oylik kirim/chiqim, so'nggi 5 tranzaksiya |
| Wallets page | `src/app/[locale]/(app)/wallets/page.tsx` | Ro'yxat, `EditWalletDialog` (nom/rang/belgi), tasdiqlab o'chirish (default hamyon himoyalangan) |
| Takrorlanuvchi kirim/chiqim | `src/lib/recurring.ts`, `src/lib/recurring-server.ts`, `RecurringRule` modeli | TransactionDialog'da "Takrorlash". Cron yo'q: `processRecurring(userId)` ma'lumot ko'rsatadigan sahifalar (dashboard, transactions, wallets, budget, export) boshida chaqiriladi va o'tib ketgan takrorlarni to'ldiradi. n-takror har doim `startDate` dan hisoblanadi. Yangi sahifa balans/tranzaksiya ko'rsatsa — unga ham qo'shing |
| Kunlik guruhlash | `src/lib/days.ts` | Kunlar `Asia/Tashkent` bo'yicha; Tranzaksiyalar sahifasida kun sarlavhasi + kunlik jami/sof natija |
| Kategoriya belgilari | `src/lib/category-icons.ts`, `src/components/transactions/tx-icon.tsx` | Standart kategoriyalar — qat'iy xarita; qo'lda qo'shilganlar — `Category.icon` (AddCategoryDialog'da tanlanadi); belgisizlar — nomdan kalit so'z bo'yicha taxmin; topilmasa — yo'nalish strelkasi |
| Hamyon belgilari | `src/lib/wallet-icons.ts`, `src/components/wallets/wallet-avatar.tsx`, `wallet-style-fields.tsx` | `Wallet.icon` da lucide kalit (masalan `credit-card`); null — valyuta bayrog'i. Server faqat `WALLET_ICON_KEYS` dagini saqlaydi |
| Transactions page | `src/app/[locale]/(app)/transactions/page.tsx` | Filtrlash, pagination (PAGE_SIZE=20), har qatorda edit/delete, Excel eksport |
| TransactionFilters | `src/components/transactions/transaction-filters.tsx` | URL search params orqali, `page` resetlanadi |
| Pagination | `src/components/transactions/pagination.tsx` | `...` truncation, URL params orqali |
| AddWalletDialog | `src/components/dashboard/add-wallet-dialog.tsx` | Valyuta tanlash (UZS/USD/EUR/RUB), rang tanlash |
| TransactionDialog | `src/components/transactions/transaction-dialog.tsx` | Add + edit (`transaction` prop). Income/Expense/Transfer, sana tanlash, cross-currency; tahrirlashda tur o'zgarmaydi |
| ConfirmDeleteButton | `src/components/confirm-delete-button.tsx` | Umumiy tasdiqlash dialogi, `(state, formData)` action qabul qiladi |
| AddCategoryDialog | `src/components/categories/add-category-dialog.tsx` | Alohida modal, `onCreated` callback |
| `addWallet` / `deleteWallet` / `updateWallet` | `src/lib/actions/wallet.ts` | `deleteWallet`: kirim/chiqimlar birga o'chadi; o'tkazmasi bor hamyon o'chirilmaydi |
| `addTransaction` / `updateTransaction` / `deleteTransaction` | `src/lib/actions/transaction.ts` | `balanceEffects()` — eski ta'sirni teskari qilib, yangisini qo'llaydi, hammasi bitta `$transaction` da |
| Debts (Qarzlar) | `src/app/[locale]/(app)/debts/page.tsx`, `src/lib/actions/debt.ts`, `src/lib/debt.ts` | Berish/olish, qisman qaytarish, muddat, ochiq/yopilgan. Hamyonsiz qarz — faqat yozuv. Dashboard'da qisqa karta |
| Settings | `src/app/[locale]/(app)/settings/page.tsx` | Profil, parol, til, chiqish |
| Budget | `src/app/[locale]/(app)/budget/page.tsx` | Oylik kategoriya limitlari + progress |
| `createCategory` | `src/lib/actions/category.ts` | upsert pattern (`@@unique([userId, name])`) |
| App shell | `src/app/[locale]/(app)/layout.tsx`, `src/components/sidebar-nav.tsx` | Sidebar + header |
| Language switcher | `src/components/language-switcher.tsx` | uz/ru/en |

### Still skeleton (prioritet tartibida)

| Page | File | Nima kerak |
|------|------|-----------|
| Goals | `src/app/[locale]/(app)/goals/page.tsx` | Jamg'arma maqsadlari |
| AI | `src/app/[locale]/(app)/ai/page.tsx` | Tranzaksiya tahlili, AI chat |
| Billing | `src/app/[locale]/(app)/billing/page.tsx` | — |
| Referral | `src/app/[locale]/(app)/referral/page.tsx` | — |

---

### Key architectural decisions

- **API layer yo'q** — Server Components Prisma ga to'g'ridan-to'g'ri murojaat qiladi; mutatsiyalar Server Actions orqali
- **`@/components/ui/dialog` is base-ui** — shadcn/ui Radix-based Dialog o'rniga `@base-ui/react` ishlatiladi; `asChild` yo'q, o'rniga `render` prop: `<DialogTrigger render={<Button />}>`. Import yo'li bir xil bo'lsa ham, xulq-atvor farqli.
- **Native `<select>`** — shadch Select Dialog ichida portal/z-index muammo chiqaradi; barcha dialog formlarda native `<select>` ishlatiladi
- **Hidden inputs for controlled values** — Dialog formalarida React state bilan boshqariladigan qiymatlar (currency, color) `<input type="hidden" name="..." value={val} />` orqali FormData ga uzatiladi
- **Balance integrity** — balansni faqat `prisma.$transaction([create, update])` orqali yangilang; ta'sirni `src/lib/balance.ts` (`balanceEffects` / `reverseEffects` / `balanceUpdates`) hisoblaydi
- **Qarzlar** — `DEBT_IN` / `DEBT_OUT` tranzaksiyalari `debtId` bilan bog'lanadi. Qaytarilgan summa saqlanmaydi, bog'langan tranzaksiyalardan hisoblanadi (`debtProgress`). Bu turlar oylik kirim/chiqim va budgetga kirmaydi; Tranzaksiyalar sahifasidan tahrirlanmaydi. Qaytarish faqat qarz valyutasidagi hamyon orqali
- **Dev server + `prisma generate`** — Prisma client `globalThis` da keshlanadi; sxema o'zgargach dev serverni qayta ishga tushiring
- **Auth pattern** — har bir Server Action: `supabase.auth.getUser()` → Prisma query `userId` bilan scope
- **Revalidation** — mutatsiyadan keyin: `revalidatePath('/', 'layout')`
- **Filters + Pagination** — URL search params (Server Component o'qiydi, Client Component yangilaydi); filter o'zgarganda `page` o'chiriladi
