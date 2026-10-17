// Einstellungen als Schlüssel/Wert, ein Datensatz je Schlüssel.

import { db } from './db.ts'
import { upsertByKey } from './records.ts'
import type { Setting } from './types.ts'

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.where('key').equals(key).first()
  return setting?.deletedAt === null ? (setting.value as T) : undefined
}

export async function setSetting(key: string, value: unknown, now = new Date()): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.where('key').equals(key).first()
    await db.settings.put(upsertByKey<Setting>(existing, { key, value }, now))
  })
}
