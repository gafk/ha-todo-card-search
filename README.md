# HA Todo Card with Search

Eine minimalistische [Home Assistant](https://www.home-assistant.io/) Lovelace-Karte für To-do-Listen mit integriertem Suchfeld. Sieht aus wie die native „To-do-Liste"-Karte, filtert aber Einträge per Freitext und unterstützt farbige Raum-Präfixe (z.B. `WZ Staubsaugen`).

## Features

- Zeigt und verwaltet Home Assistant To-do-Listen-Entitäten
- Live-Suche/Filter nach Titel und Beschreibung
- Live-Updates über WebSocket-Abonnement (kein Neuladen nötig)
- Sortierung nach Name oder Fälligkeitsdatum
- Relative Fälligkeitsanzeige (Heute / Morgen / In 3 Tagen / Vor 2 Tagen …)
- Farbige 2-Buchstaben-Raum-Präfixe (z.B. `WZ`, `KU`, `BA`)
- Abschnitt „Erledigt" ein-/ausklappbar
- Vanilla JavaScript – kein Build-Schritt erforderlich

## Installation

### Manuell

1. `ha-todo-card-search.js` aus dem [letzten Release](../../releases/latest) herunterladen.
2. Datei nach `config/www/ha-todo-card-search.js` kopieren.
3. In den Lovelace-Einstellungen eine Ressource hinzufügen:
   ```yaml
   url: /local/ha-todo-card-search.js
   type: module
   ```
4. Karte im Dashboard einbinden:
   ```yaml
   type: custom:todo-list-search-card
   entity: todo.putzplan
   ```

### HACS

> HACS-Unterstützung folgt in Kürze.

## Konfiguration

| Option               | Typ     | Pflicht | Standard      | Beschreibung                                                      |
|----------------------|---------|---------|---------------|-------------------------------------------------------------------|
| `entity`             | string  | ✅       | –             | To-do-Listen-Entität, z.B. `todo.putzplan`                       |
| `title`              | string  | ❌       | Entitätsname  | Eigener Kartentitel                                               |
| `display_order`      | string  | ❌       | `none`        | `none` \| `alpha_asc` \| `alpha_desc` \| `duedate_asc` \| `duedate_desc` |
| `hide_completed`     | boolean | ❌       | `false`       | Erledigte Aufgaben dauerhaft ausblenden                          |
| `search_placeholder` | string  | ❌       | `Suchen…`     | Platzhaltertext im Suchfeld                                      |
| `prefix_color`       | string  | ❌       | `#ffab00`     | Farbe für Raum-Präfixe (CSS-Farbe oder HA-Variable)              |

### Beispiel

```yaml
type: custom:todo-list-search-card
entity: todo.putzplan
display_order: duedate_asc
search_placeholder: "Raum suchen…"
prefix_color: "#ffab00"
```

## Raum-Präfixe

Aufgaben, die mit einem 2-Buchstaben-Kürzel beginnen (z.B. `WZ Staubsaugen`, `KU Abwischen`), werden automatisch erkannt: Das Kürzel wird farbig hervorgehoben, der Rest normal angezeigt.

## Einschränkungen

- Kein Eingabefeld zum Hinzufügen neuer Aufgaben – dafür weiterhin die normale „To-do-Liste"-Karte verwenden.
- Kein Bearbeiten-Dialog beim Antippen eines Eintrags.

## Entwicklung

Kein Build-Schritt nötig – `ha-todo-card-search.js` direkt bearbeiten und im Browser neu laden.

## Lizenz

MIT
