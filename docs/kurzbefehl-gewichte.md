# Kurzbefehl „Kcalm Gewichte“

Der Kurzbefehl liest deine Gewichte der letzten 60 Tage aus Apple Health und kopiert sie als Text in die Zwischenablage. In Kcalm tippst du danach auf **Gewichte einfügen**. Kcalm selbst hat keinen Zugriff auf Health, die Daten gehen nur über die Zwischenablage.

## Einrichten (einmalig)

Öffne die App **Kurzbefehle** → **+** (neuer Kurzbefehl) → Name **Kcalm Gewichte**. Füge diese Aktionen in dieser Reihenfolge hinzu. Am schnellsten findest du sie über das Suchfeld „Aktion suchen“. Die Namen können je nach iOS-Version leicht abweichen; in Klammern steht der englische Name.

1. **Health-Proben suchen** (*Find Health Samples*)
   - „Typ“: **Gewicht**
   - Filter hinzufügen: **Startdatum** · **liegt in den letzten** · **60 Tage**
   - „Sortieren nach“: **Startdatum**, „Reihenfolge“: **Älteste zuerst**
   - „Limit“: aus

2. **Mit jedem wiederholen** (*Repeat with Each*): Es wiederholt mit den gefundenen Proben aus Schritt 1.

3. Innerhalb der Wiederholung: **Text** (*Text*), Inhalt genau so, ohne Leerzeichen:

   `[Startdatum];[Wert];[Einheit]`

   So setzt du die drei Platzhalter:
   - Variable **Wiederholungsobjekt** einfügen, antippen → **Startdatum** wählen. Darunter **Datumsformat: ISO 8601** und **ISO 8601-Zeit einschließen** einschalten.
   - `;` tippen, wieder **Wiederholungsobjekt** einfügen → **Wert**.
   - `;` tippen, noch einmal **Wiederholungsobjekt** → **Einheit**.

4. Nach **Wiederholung beenden**: **Text kombinieren** (*Combine Text*)
   - Eingabe: **Wiederholungsergebnisse**
   - „Mit“: **Neue Zeilen**

5. **Text** mit zwei Zeilen:

   ```
   kcalm-gewichte 1
   [Kombinierter Text]
   ```

   Die erste Zeile genau so abtippen (klein, Leerzeichen, Ziffer 1). In der zweiten Zeile die Variable **Kombinierter Text** einfügen.

6. **In Zwischenablage kopieren** (*Copy to Clipboard*): Text aus Schritt 5.

7. Optional: **Mitteilung anzeigen** mit „Gewichte kopiert“.

Beim ersten Ausführen fragt iOS, ob der Kurzbefehl Gewichte aus Health lesen darf: **Erlauben**.

## Benutzen

1. Kurzbefehl **Kcalm Gewichte** ausführen (in der App, als Widget auf dem Home-Bildschirm oder per Siri).
2. Kcalm öffnen → Einstellungen → **Verbrauchsschätzung** → **Gewichte einfügen**.
3. iOS fragt nach dem Einfügen aus der Zwischenablage: **Einfügen** tippen.

Kcalm meldet danach, wie viele Werte gelesen wurden. Du kannst den Kurzbefehl beliebig oft ausführen: Bekannte Werte werden erkannt und nicht doppelt gespeichert. Ein Abstand von ein paar Tagen reicht, weil der Kurzbefehl immer 60 Tage zurückschaut.

## So sieht der kopierte Text aus

```
kcalm-gewichte 1
2026-10-20T07:05:12+02:00;75,1;kg
2026-10-21T06:58:31+02:00;74,9;kg
2026-10-22T07:12:00+02:00;74,8;kg
```

- Pro Zeile eine Messung: Zeitpunkt (ISO 8601), Gewicht, Einheit, getrennt durch Semikolon.
- Gewicht mit Komma oder Punkt; Einheit `kg` oder `lb` (wird umgerechnet). Fehlt die Einheit, gilt kg.
- Mehrere Messungen an einem Tag: Kcalm nimmt die früheste.
- Der Tag ist der Kalendertag am Ort der Messung, auch auf Reisen.

## Wenn es nicht klappt

| Meldung in Kcalm | Ursache |
| --- | --- |
| „Kein Text vom Kurzbefehl … in der Zwischenablage“ | Kurzbefehl nicht gelaufen, oder danach etwas anderes kopiert. Oder die erste Zeile in Schritt 5 ist nicht genau `kcalm-gewichte 1`. |
| „Keine Gewichte gefunden …“ | Health hat in den letzten 60 Tagen kein Gewicht, oder der Zugriff wurde verweigert (Einstellungen → Health → Datenzugriff & Geräte → Kurzbefehle). |
| „Zeile 2 ist nicht lesbar …“ | Meist das Datumsformat in Schritt 3: Es muss **ISO 8601** sein, nicht „Kurz“ oder „Mittel“. |
| „… außerhalb 20–300 kg“ | Ein falscher Wert in Health (z. B. 7,48 statt 74,8). In Health löschen und neu ausführen. |

Ersatz ohne Kurzbefehl: In Kcalm **Manuell eintragen**.
