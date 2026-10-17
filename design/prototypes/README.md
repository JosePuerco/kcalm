# Prototypen

Quellcode der klickbaren Design-Prototypen aus der Planung. Format: `.dc.html` (HTML-Markup mit Inline-Styles und einer kleinen Logik-Klasse im `<script>`-Block).

**Referenz, nicht kopieren.** Übernimm Layout, Texte, Abstände, Farben (als Tokens), Zustände und Animationen, baue aber sauber in React neu. Platzhalter wie `{{t.card}}` sind Werte aus `renderVals()` im Skript unten in der Datei.

| Datei | Screen | Wichtig |
| --- | --- | --- |
| `Kern.dc.html` | Tagebuch + Hinzufügen-Sheet | Hauptvorlage: Tagesansicht, Kalender, Woche, Slots, Sheet, Ziffernblock, Wischen zum Löschen, Motion, Hell/Dunkel-Tokens |
| `Leer.dc.html` | Leerer Tag | „Wie gestern“, „Tag kopieren“ |
| `Start.dc.html` | Ersteinrichtung Schritt 2 | Makro-Modi je Zeile |
| `Scanner.dc.html` | Scanner mit Treffer | Rahmen, Laser, Trefferkarte |
| `NichtGefunden.dc.html` | Nicht gefunden / Offline | Zwei Zustände |
| `Schnell.dc.html` | Schnelleintrag | Aktives Feld, Plausibilitätshinweis |
| `Mahlzeit.dc.html` | Mahlzeit eintragen | Haken, −/+, Skalierung |
| `Lebensmittel.dc.html` | Lebensmittel-Liste | Reiter, Filter |
| `Produkt.dc.html` | Produktdetail | Original gegen Meine Werte |
| `Rezept.dc.html` | Rezept anlegen | Endgewicht, Kochverlust |
| `Statistik.dc.html` | Statistik | Diagramme |
| `Einstellungen.dc.html` | Einstellungen | Schalter, Backup-Warnung |
| `Profil.dc.html` | Profile und Ziele | Profilwechsel-Optionen |
| `Schaetzung.dc.html` | Verbrauchsschätzung | Ergebnis / Sammelt Daten |
| `Export.dc.html` | Export | Vorlage, Vorschau |

Hinweise:
- Nur `Kern.dc.html` hat Hell und Dunkel ausgearbeitet (`mode`-Prop). Alle anderen sind hell; Dunkel ergibt sich aus `design/tokens.json`.
- Die Prototypen laden Geist von Google Fonts. In der App wird die Schrift lokal gebündelt.
- Beispieldaten sind erfunden und nur zur Darstellung.
