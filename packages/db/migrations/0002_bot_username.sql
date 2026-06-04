-- Migration 0002: aggiunge bot_username a bot_configurazioni
-- Necessario per costruire i deep link Telegram (t.me/USERNAME?start=...)
-- Viene popolato automaticamente da /api/admin/activate-bot al salvataggio del bot

alter table bot_configurazioni
  add column if not exists bot_username text;
