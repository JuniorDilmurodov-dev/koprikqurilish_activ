# Korrupsiya murojaatlari Telegram boti (@karrupsiya_xabar_bot)

Serverda doimiy ishlaydigan Node.js jarayoni (long polling). Tashqi kutubxona yo'q, `npm install` shart emas.

## Talablar
- Node.js 18 yoki undan yangi
- Serverdan `api.telegram.org` ga chiqish (443-port)

## O'rnatish
1. Shu papkani serverga ko'chiring, masalan `/opt/korrupsiya-bot`.
2. Papka ichida `.env` yarating (`.env.example` dan nusxa oling):
   ```
   KORRUPSIYA_TG_TOKEN=<bot tokeni, alohida beriladi>
   ADMIN_CHAT_IDS=7795342218,5221981574,1306027214
   KORRUPSIYA_BACKEND_URL=https://korrupsiya.kuprikqurilish.uz/api/korrupsiya/
   ```
3. pm2 bilan ishga tushiring:
   ```bash
   npm i -g pm2
   pm2 start bot.js --name korrupsiya-bot
   pm2 save
   pm2 startup   # server qayta yonganda avtomatik ishga tushishi uchun
   ```
4. Tekshirish: `pm2 logs korrupsiya-bot` da quyidagi qator chiqishi kerak:
   `@karrupsiya_xabar_bot ishga tushdi. Adminlar: ...`

## Muhim
- **Faqat bitta nusxa ishlashi kerak.** Bir xil token bilan ikkinchi nusxa ishlasa, logda `409 Conflict` chiqadi va xabarlar yo'qoladi.
- Botda webhook o'rnatilmagan bo'lishi kerak (long polling ishlatiladi).
- `.env` o'zgartirilgandan keyin: `pm2 restart korrupsiya-bot`.

## Ishlash mantig'i
- `ADMIN_CHAT_IDS` dagi foydalanuvchilar forma ko'rmaydi, faqat murojaatlarni qabul qiladi.
- Boshqa foydalanuvchilar: F.I.O (ixtiyoriy) → telefon (majburiy) → xabar (majburiy) → tasdiqlash.
- Murojaat adminlarga yuboriladi va `KORRUPSIYA_BACKEND_URL` ga POST qilinadi (`{name, phone, description}`).
- F.I.O kiritilmasa (anonim), adminlarga foydalanuvchining Telegram ma'lumoti yuborilmaydi.
