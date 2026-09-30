# Hamyon

Shaxsiy moliya ilovasi: hamyonlar, tranzaksiyalar, qarzlar, byudjet, takrorlanuvchi to'lovlar.
Next.js 14 · Supabase · Prisma · next-intl (uz / ru / en).

## Yangi qurilmada ishga tushirish

`.env` fayli repoda **shifrlangan** holda saqlanadi ([dotenvx](https://dotenvx.com)). Uni ochish uchun faqat
bitta maxfiy kalit kerak — `DOTENV_PRIVATE_KEY`. U gitda yo'q; parol menejeringizda saqlang.

Kerak: Node.js 20+ va Git.

```bash
git clone https://github.com/Jim-Floyd/Wallet.git
cd Wallet
```

Kalitni **bittasi** bilan bering (`npm install` dan oldin):

```bash
# 1-usul: loyiha papkasida .env.keys fayli (gitignore'da)
echo DOTENV_PRIVATE_KEY=<kalit> > .env.keys

# 2-usul: tizim muhit o'zgaruvchisi (Windows PowerShell, bir marta, keyin terminalni qayta oching)
setx DOTENV_PRIVATE_KEY "<kalit>"
```

```bash
npm install   # Prisma client ham avtomatik yaratiladi (postinstall)
npm run dev   # http://localhost:3000
```

Kalit topilmasa, `npm run dev` `DECRYPTION_FAILED` xatosi bilan to'xtaydi.

## .env ni o'zgartirish

Qiymatni qo'lda tahrirlamang — shifrlab yozing, keyin commit qiling:

```bash
npx dotenvx set GOOGLE_AI_API_KEY "yangi-qiymat"    # qo'shish / o'zgartirish
npx dotenvx get NEXT_PUBLIC_APP_URL                 # bitta qiymatni ko'rish
```

Kerakli o'zgaruvchilar ro'yxati — `.env.example`.

## Buyruqlar

```bash
npm run dev          # dev server (.env avtomatik ochiladi)
npm run build        # production build
npm run lint
npx prisma db push   # sxemani bazaga yuborish (prisma.config.ts ham .env ni o'zi ochadi)
```
