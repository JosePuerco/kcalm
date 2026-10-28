# Kamera dauerhaft erlauben

Ohne diese Einstellung fragt iOS bei jedem App-Start neu, ob Kcalm die Kamera nutzen darf (beim ersten Tipp auf den Scanner). Kcalm kann das im Code nicht ändern. Die App auf dem Home-Bildschirm übernimmt aber die Kamera-Einstellung, die Safari für die Website hat, und zwar in dem Moment, in dem du sie zum Home-Bildschirm hinzufügst. Die Reihenfolge ist deshalb wichtig: erst in Safari erlauben, dann hinzufügen.

## Neu einrichten

1. In Safari `josepuerco.github.io/kcalm/` öffnen.
2. Links in der Adressleiste auf **aA** tippen (bzw. auf das Seitenmenü) → **Website-Einstellungen**.
3. **Kamera** auf **Erlauben** stellen (statt „Fragen“).
4. Erst jetzt: Teilen → **Zum Home-Bildschirm**.

Ab dann startet der Scanner ohne Rückfrage.

## Kcalm ist schon auf dem Home-Bildschirm

Die Einstellung nachträglich in Safari zu ändern, wirkt nicht auf die schon installierte App. Du musst sie neu hinzufügen. **Achtung:** Beim Löschen vom Home-Bildschirm löscht iOS auch alle Daten der App. Deshalb vorher sichern:

1. In Kcalm: Einstellungen › Daten › **Backup** erstellen und in Dateien sichern.
2. Kcalm vom Home-Bildschirm löschen.
3. Schritte 1–4 von oben.
4. Neue App öffnen → Willkommensbildschirm → **Aus Backup laden**.

## Wenn es nicht klappt

- Fragt die App weiter: In Safari unter **aA → Website-Einstellungen** prüfen, ob Kamera wirklich auf „Erlauben“ steht, dann App wie oben neu hinzufügen.
- Alternativ für alle Websites: iPhone-Einstellungen → Apps → Safari → **Kamera** → **Erlauben**. Das gilt dann aber für jede Website, nicht nur für Kcalm.
