# Kamera dauerhaft erlauben

Ohne diese Einstellung fragt iOS nach jedem App-Start neu, ob Kcalm die Kamera nutzen darf (beim ersten Tipp auf den Scanner). Kcalm kann das im Code nicht ändern. Die App auf dem Home-Bildschirm übernimmt aber die Kamera-Einstellung, die Safari für die Website hat, und zwar in dem Moment, in dem du sie zum Home-Bildschirm hinzufügst. Die Reihenfolge ist deshalb wichtig: erst in Safari erlauben, dann hinzufügen.

In der App steht eine gekürzte Fassung unter Einstellungen › Hilfe › **Kamera dauerhaft erlauben** (`src/screens/einstellungen/CameraGuideSheet.tsx`). Bei Änderungen beide anpassen.

Begriffe nach iOS 27.2 (von Jan am iPhone geprüft, 28.10.2026).

## Neu einrichten

1. In Safari `josepuerco.github.io/kcalm/` öffnen.
2. Links neben der Adressleiste auf das **Seitenmenü** tippen (drei Striche). Oben im Menü steht die Adresse der Website. Nach unten scrollen zu **Website-Einstellungen**.
3. **Kamera** auf **Erlauben** stellen (Optionen: Fragen, Verweigern, Erlauben).
4. Erst jetzt: **Seitenmenü** → **Teilen** → **Zum Home-Bildschirm**. Den Schalter **Als Web-App öffnen** eingeschaltet lassen → **Hinzufügen**.

Ab dann startet der Scanner ohne Rückfrage.

## Kcalm ist schon auf dem Home-Bildschirm

Die Einstellung nachträglich in Safari zu ändern, wirkt nicht auf die schon installierte App. Du musst sie neu hinzufügen. **Achtung:** Beim Löschen vom Home-Bildschirm löscht iOS auch alle Daten der App. Deshalb vorher sichern:

1. In Kcalm: Einstellungen › Daten › Backup → **Jetzt sichern**, z. B. in Dateien.
2. Kcalm vom Home-Bildschirm löschen.
3. Schritte 1–4 von oben.
4. Neue App öffnen → Willkommensbildschirm → **Aus Backup laden**.

## Wenn es nicht klappt

- Fragt die App weiter: In Safari unter **Seitenmenü → Website-Einstellungen** prüfen, ob Kamera wirklich auf „Erlauben“ steht, dann die App wie oben neu hinzufügen.
- „Zum Home-Bildschirm“ fehlt beim Teilen: ganz unten in der Liste **Aktionen bearbeiten** und den Punkt hinzufügen.
- Alternativ für alle Websites: iPhone-Einstellungen → **Apps** → **Safari** → **Kamera** (Abschnitt „Einstellungen für Websites“) → **Erlauben**. Das gilt dann aber für jede Website, nicht nur für Kcalm.
