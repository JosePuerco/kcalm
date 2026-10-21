// Korrekturschicht speichern (PLAN.md 2, Produkte; Logik in logic/verify.ts).
// Das Original wird hier nie geschrieben; nur productOverrides und die Umschalter Meine/Original.

import {
  canVerify,
  correctionFromValues,
  isEmptyOverride,
  mergeNutrients,
  type Correction,
} from '../logic/verify.ts'
import { db } from './db.ts'
import { setBlsUseOverride } from './products.ts'
import { softDelete, touch, upsertByKey } from './records.ts'
import type { FoodRef, Nutrients, ProductOverride } from './types.ts'

const findOverride = (ref: FoodRef) => db.productOverrides.where('productRef').equals(ref).first()

export async function getOverride(ref: FoodRef): Promise<ProductOverride | undefined> {
  const o = await findOverride(ref)
  return o?.deletedAt === null ? o : undefined
}

/**
 * Korrektur schreiben; ohne Felder und ohne Prüfung bekommt sie den Löschmarker.
 * Muss in einer Transaktion mit productOverrides laufen.
 */
export async function putOverride(ref: FoodRef, per100: Correction, verifiedAt: string | null, now: Date): Promise<void> {
  const existing = await findOverride(ref)
  if (isEmptyOverride(per100, verifiedAt)) {
    if (existing && existing.deletedAt === null) await db.productOverrides.put(softDelete(existing, now))
    return
  }
  const note = existing?.deletedAt === null ? existing.note : null
  await db.productOverrides.put(upsertByKey<ProductOverride>(existing, { productRef: ref, per100, verifiedAt, note }, now))
}

/** „Werte bearbeiten“: nur Abweichungen vom Original speichern; eine Prüfung bleibt bestehen */
export async function saveCorrection(ref: FoodRef, original: Nutrients, edited: Nutrients, now = new Date()) {
  await db.transaction('rw', db.productOverrides, async () => {
    const existing = await getOverride(ref)
    await putOverride(ref, correctionFromValues(original, edited), existing?.verifiedAt ?? null, now)
  })
}

/** „Als geprüft markieren“ (nur mit allen Pflichtangaben in Meine Werte) bzw. „Prüfung entfernen“ */
export async function setVerified(ref: FoodRef, original: Nutrients, verified: boolean, now = new Date()) {
  await db.transaction('rw', db.productOverrides, async () => {
    const existing = await getOverride(ref)
    if (verified && !canVerify(mergeNutrients(original, existing))) {
      throw new Error('Pflichtangaben fehlen, Prüfen nicht möglich')
    }
    await putOverride(ref, existing?.per100 ?? {}, verified ? now.toISOString() : null, now)
  })
}

/** Umschalter „Meine Werte nutzen“ / „Original nutzen“; gilt für künftige Einträge */
export async function setUseOverride(ref: FoodRef, useOverride: boolean, now = new Date()) {
  if (ref.startsWith('bls:')) return setBlsUseOverride(ref.slice(4), useOverride, now)
  if (!ref.startsWith('product:')) throw new Error(`Kein Produkt: ${ref}`)
  await db.transaction('rw', db.products, async () => {
    const product = await db.products.get(ref.slice(8))
    if (!product || product.deletedAt !== null) throw new Error(`Produkt fehlt: ${ref}`)
    await db.products.put(touch(product, { useOverride }, now))
  })
}
