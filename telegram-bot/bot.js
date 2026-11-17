// Korrupsiya murojaatlari Telegram boti (long polling, tashqi kutubxonasiz).
//
// - ADMIN_CHAT_IDS dagi foydalanuvchilar: faqat murojaatlarni qabul qiladi (forma ko'rinmaydi).
// - Boshqa foydalanuvchilar: F.I.O (ixtiyoriy) -> telefon (majburiy) -> xabar (majburiy)
//   -> tasdiqlash -> murojaat faqat adminlarga yuboriladi.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------- .env yuklash (bot papkasidagi .env, bo'lmasa loyiha ildizidagi .env) ----------
const here = dirname(fileURLToPath(import.meta.url));
for (const p of [join(here, ".env"), join(here, "..", ".env")]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const TOKEN =
  process.env.KORRUPSIYA_TG_TOKEN || process.env.VITE_KORRUPSIYA_TG_TOKEN;
const ADMIN_CHAT_IDS = (
  process.env.ADMIN_CHAT_IDS ||
  [process.env.VITE_CHAT_ID_KORRUPSIYA, process.env.VITE_CHAT_ID_KORRUPSIYA_2]
    .filter(Boolean)
    .join(",")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Sayt formasidagi kabi murojaatni backendga ham saqlash (bo'sh qoldirilsa o'chiriladi)
const BACKEND_URL =
  process.env.KORRUPSIYA_BACKEND_URL ??
  "https://korrupsiya.kuprikqurilish.uz/api/korrupsiya/";

if (!TOKEN) throw new Error("KORRUPSIYA_TG_TOKEN (yoki VITE_KORRUPSIYA_TG_TOKEN) topilmadi");
if (ADMIN_CHAT_IDS.length === 0) throw new Error("Admin chat ID lar topilmadi");

const API = `https://api.telegram.org/bot${TOKEN}`;
const isAdmin = (chatId) => ADMIN_CHAT_IDS.includes(String(chatId));

// ---------- Matnlar va tugmalar ----------
const BTN_NEW = "📝 Murojaat yuborish";
const BTN_SKIP = "⏭ O'tkazib yuborish";
const BTN_CANCEL = "❌ Bekor qilish";
const BTN_CONFIRM = "✅ Yuborish";
const BTN_SHARE_PHONE = "📱 Raqamni ulashish";

const WELCOME_TEXT = `Assalomu alaykum!

Ushbu Telegram bot "Ko‘prikqurilish" AJ tizimida korrupsiyaga oid holatlar bo‘yicha murojaatlarni qabul qilish, avtomatik tahlil qilish va mas'ul xodimlarga yo‘naltirish uchun tashkil etilgan.

Siz murojaatingizni oddiy yoki anonim shaklda yuborishingiz mumkin.

"Ko‘prikqurilish" AJ
Korrupsiyaga qarshi kurashish komplaens nazorat boshqarmasi

📞 Telefon: +998 77 208 26 26

📞 Telefon: +998 71 203 26 26 (1033)`;

const kb = (rows) => ({
  keyboard: rows.map((r) => r.map((b) => (typeof b === "string" ? { text: b } : b))),
  resize_keyboard: true,
});
const MAIN_KB = kb([[BTN_NEW]]);
const NAME_KB = kb([[BTN_SKIP], [BTN_CANCEL]]);
const PHONE_KB = kb([[{ text: BTN_SHARE_PHONE, request_contact: true }], [BTN_CANCEL]]);
const MSG_KB = kb([[BTN_CANCEL]]);
const CONFIRM_KB = kb([[BTN_CONFIRM], [BTN_CANCEL]]);
const REMOVE_KB = { remove_keyboard: true };

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Telegram API ----------
async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const err = new Error(`${method}: ${data.description || res.status}`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}
const send = (chat_id, text, reply_markup) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup });

// ---------- Suhbat holati (xotirada) ----------
// step: "name" | "phone" | "message" | "confirm"
const sessions = new Map();

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  if (digits.length >= 9 && digits.length <= 15) return `+${digits}`;
  return null;
}

function formatAppeal(s, from) {
  const lines = [
    "📝 <b>Yangi korrupsiya murojaati (Telegram bot)</b>",
    `👤 F.I.O: ${escapeHtml(s.name || "Ko‘rsatilmagan (anonim)")}`,
    `📞 Telefon: ${escapeHtml(s.phone)}`,
    `✉️ Xabar: ${escapeHtml(s.message)}`,
  ];
  // F.I.O kiritilmagan bo'lsa (anonim murojaat) Telegram ma'lumotlari qo'shilmaydi
  if (s.name) {
    const user = from?.username ? `@${from.username}` : `id: ${from?.id}`;
    lines.push("", `🔗 Telegram: ${escapeHtml(user)}`);
  }
  return lines.join("\n");
}

async function deliverAppeal(s, from) {
  const text = formatAppeal(s, from);
  const results = await Promise.allSettled(ADMIN_CHAT_IDS.map((id) => send(id, text)));
  results.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(`Admin ${ADMIN_CHAT_IDS[i]} ga yuborilmadi:`, r.reason.message);
  });

  if (BACKEND_URL) {
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s.name || "", phone: s.phone, description: s.message }),
      });
      if (!res.ok) console.error("Backendga saqlanmadi:", res.status);
    } catch (e) {
      console.error("Backendga saqlanmadi:", e.message);
    }
  }
  return results.some((r) => r.status === "fulfilled");
}

// ---------- Xabarlarni qayta ishlash ----------
async function handleAdmin(msg) {
  // Adminlarga forma ko'rsatilmaydi — ular faqat murojaatlarni qabul qiladi.
  if (msg.text === "/start") {
    await send(
      msg.chat.id,
      "👮 Siz administrator sifatida ro'yxatdan o'tgansiz.\nYangi murojaatlar shu chatga avtomatik keladi.",
      REMOVE_KB
    );
  }
}

async function startAppeal(chatId) {
  sessions.set(chatId, { step: "name" });
  await send(
    chatId,
    "👤 F.I.O ni kiriting (ixtiyoriy).\nAgar ko'rsatishni istamasangiz, «O'tkazib yuborish» tugmasini bosing.",
    NAME_KB
  );
}

async function handleUser(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  const s = sessions.get(chatId);

  if (text === "/start" || text === BTN_CANCEL) {
    sessions.delete(chatId);
    await send(
      chatId,
      text === BTN_CANCEL
        ? "❌ Murojaat bekor qilindi."
        : WELCOME_TEXT,
      MAIN_KB
    );
    return;
  }

  if (text === BTN_NEW || text === "/murojaat") return startAppeal(chatId);

  if (!s) {
    await send(chatId, "Murojaat yuborish uchun quyidagi tugmani bosing.", MAIN_KB);
    return;
  }

  switch (s.step) {
    case "name": {
      if (!text) return send(chatId, "Iltimos, F.I.O ni matn ko'rinishida yozing yoki o'tkazib yuboring.", NAME_KB);
      s.name = text === BTN_SKIP ? "" : text.slice(0, 200);
      s.step = "phone";
      return send(
        chatId,
        "📞 Telefon raqamingizni kiriting (majburiy).\nMasalan: +998901234567 yoki «Raqamni ulashish» tugmasini bosing.",
        PHONE_KB
      );
    }
    case "phone": {
      const phone = normalizePhone(msg.contact?.phone_number || text);
      if (!phone)
        return send(chatId, "⚠️ Telefon raqam noto'g'ri. Qaytadan kiriting, masalan: +998901234567", PHONE_KB);
      s.phone = phone;
      s.step = "message";
      return send(chatId, "✉️ Murojaat matnini yozing (majburiy).", MSG_KB);
    }
    case "message": {
      if (!text) return send(chatId, "⚠️ Murojaat matni bo'sh bo'lmasligi kerak. Matn yozing.", MSG_KB);
      s.message = text.slice(0, 3500);
      s.step = "confirm";
      return send(
        chatId,
        [
          "Murojaatingizni tekshiring:",
          "",
          `👤 F.I.O: ${escapeHtml(s.name || "Ko‘rsatilmagan")}`,
          `📞 Telefon: ${escapeHtml(s.phone)}`,
          `✉️ Xabar: ${escapeHtml(s.message)}`,
        ].join("\n"),
        CONFIRM_KB
      );
    }
    case "confirm": {
      if (text !== BTN_CONFIRM)
        return send(chatId, "«Yuborish» yoki «Bekor qilish» tugmasini bosing.", CONFIRM_KB);
      const ok = await deliverAppeal(s, msg.from);
      sessions.delete(chatId);
      return send(
        chatId,
        ok
          ? "✅ Murojaatingiz qabul qilindi. Rahmat!"
          : "⚠️ Murojaatni yuborishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
        MAIN_KB
      );
    }
  }
}

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;
  if (isAdmin(msg.chat.id)) return handleAdmin(msg);
  return handleUser(msg);
}

// ---------- Long polling ----------
async function main() {
  const me = await tg("getMe", {});
  console.log(`@${me.username} ishga tushdi. Adminlar: ${ADMIN_CHAT_IDS.join(", ")}`);
  await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash" },
      { command: "murojaat", description: "Murojaat yuborish" },
    ],
  }).catch(() => {});

  let offset = 0;
  for (;;) {
    try {
      const updates = await tg("getUpdates", {
        offset,
        timeout: 50,
        allowed_updates: ["message"],
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        handleUpdate(u).catch((e) => console.error("Xatolik:", e.message));
      }
    } catch (e) {
      if (e.code === 409)
        console.error("409: botda webhook o'rnatilgan yoki boshqa nusxa ishlayapti.", e.message);
      else console.error("Polling xatoligi:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
