/**
 * Minimalistische To-do-Listen-Karte mit Suchfeld.
 *
 * Sieht wie die native "To-do-Liste"-Karte aus (ha-card, ha-checkbox,
 * gleiche Farb-/Abstands-Variablen), hat aber zusätzlich ein Suchfeld,
 * das die angezeigten Einträge per Freitext (Titel + Beschreibung)
 * filtert. Nutzt dieselben Home-Assistant-WebSocket-Kommandos wie die
 * eingebaute Karte (todo/item/subscribe) – Änderungen von anderen
 * Geräten/Nutzern erscheinen also live, ohne Neuladen.
 *
 * Installation:
 *  1. Diese Datei nach config/www/todo-list-search-card.js legen.
 *  2. Einstellungen -> Dashboards -> Rechts oben "..." -> Ressourcen
 *     -> Ressource hinzufügen -> URL: /local/todo-list-search-card.js
 *     -> Typ: JavaScript-Modul.
 *  3. Karte einbinden, z.B.:
 *       type: custom:todo-list-search-card
 *       entity: todo.putzplan
 *       display_order: duedate_asc
 *       search_placeholder: "Raum suchen…"
 *
 * Konfigurationsoptionen:
 *  - entity            (Pflicht) z.B. todo.putzplan
 *  - title              Kartentitel, Standard: Name der Entität
 *  - display_order       none | alpha_asc | alpha_desc | duedate_asc | duedate_desc
 *  - hide_completed       true/false, Standard false
 *  - search_placeholder    Platzhaltertext im Suchfeld
 *  - prefix_color        Farbe für das 2-Buchstaben-Raumkürzel am Anfang
 *                         jedes Titels (z.B. "WZ Staubsaugen"), Standard
 *                         Amber (#ffab00)
 *
 * Einschränkungen (bewusst minimal gehalten):
 *  - Kein Eingabefeld zum Hinzufügen neuer Aufgaben – dafür weiterhin
 *    die normale "To-do-Liste"-Karte verwenden.
 *  - Tippen auf einen Eintrag öffnet keinen Bearbeiten-Dialog wie in
 *    der Original-Karte. Fälligkeit und Beschreibung eines Eintrags
 *    weiterhin über die normale To-do-Karte oder Entwicklerwerkzeuge
 *    -> Aktionen bearbeiten.
 *  - Fälligkeitsdatum wird relativ angezeigt (Heute/Morgen/In 3 Tagen/
 *    Vor 2 Tagen …) via Intl.RelativeTimeFormat.
 *
 * Technischer Hinweis zum Suchfeld: Die Karte baut beim Tippen NICHT
 * die ganze Karte neu auf, sondern nur die Liste darunter (das
 * Such-Eingabefeld selbst bleibt als DOM-Element unangetastet). Ein
 * kompletter innerHTML-Neuaufbau bei jedem Tastendruck würde auf dem
 * Handy die Bildschirmtastatur kurz zu- und wieder aufklappen lassen,
 * weil das Eingabefeld dabei technisch neu erzeugt und der Fokus kurz
 * verloren wird.
 */

class TodoListSearchCard extends HTMLElement {
  static _rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

  // Erkennt ein führendes 2-Buchstaben-Raumkürzel + Leerzeichen, z.B.
  // "WZ Staubsaugen" -> { prefix: "WZ", rest: "Staubsaugen" }.
  static _PREFIX_RE = /^([A-ZÄÖÜ]{2})\s+(.+)$/su;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._items = [];
    this._filter = "";
    this._showCompleted = false;
    this._unsubPromise = null;
    this._shellBuilt = false;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("ha-todo-card-search: 'entity' ist erforderlich (z.B. todo.putzplan).");
    }
    this._config = {
      display_order: "none",
      hide_completed: false,
      search_placeholder: "Suchen…",
      prefix_color: "#ffab00",
      ...config,
    };
  }

  static getStubConfig() {
    return { entity: "todo.putzplan" };
  }

  getCardSize() {
    return 3 + Math.min(this._items.length, 10) * 0.5;
  }

  set hass(hass) {
    const hadHass = !!this._hass;
    const oldName =
      hadHass && this._config
        ? this._hass.states[this._config.entity]?.attributes?.friendly_name
        : undefined;
    this._hass = hass;

    if (!hadHass) {
      this._subscribe();
      this._renderShell();
      this._updateList();
      return;
    }

    // Nur bei geändertem Kartentitel die Hülle neu bauen. Die Aufgaben
    // selbst kommen über das eigene Abo (siehe unten) und laufen über
    // _updateList(), ohne das Suchfeld anzufassen.
    const newName = this._config
      ? hass.states[this._config.entity]?.attributes?.friendly_name
      : undefined;
    if (oldName !== newName) {
      this._renderShell();
      this._updateList();
    }
  }

  connectedCallback() {
    if (this._hass && this._config && !this._unsubPromise) {
      this._subscribe();
    }
  }

  disconnectedCallback() {
    if (this._unsubPromise) {
      this._unsubPromise.then((unsub) => unsub && unsub());
      this._unsubPromise = null;
    }
  }

  _subscribe() {
    if (!this._hass || !this._config) return;
    this._unsubPromise = this._hass.connection.subscribeMessage(
      (msg) => {
        this._items = (msg && msg.items) || [];
        this._updateList();
      },
      { type: "todo/item/subscribe", entity_id: this._config.entity }
    );
  }

  _sort(items) {
    const order = this._config.display_order;
    const arr = [...items];
    const dueTime = (i) => (i.due ? new Date(i.due).getTime() : Infinity);
    if (order === "alpha_asc") arr.sort((a, b) => a.summary.localeCompare(b.summary, "de"));
    else if (order === "alpha_desc") arr.sort((a, b) => b.summary.localeCompare(a.summary, "de"));
    else if (order === "duedate_asc") arr.sort((a, b) => dueTime(a) - dueTime(b));
    else if (order === "duedate_desc") arr.sort((a, b) => dueTime(b) - dueTime(a));
    return arr;
  }

  _matchesFilter(item) {
    if (!this._filter) return true;
    const q = this._filter.toLowerCase();
    return (
      (item.summary || "").toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q)
    );
  }

  _toggle(item) {
    const newStatus = item.status === "completed" ? "needs_action" : "completed";
    this._hass.callService(
      "todo",
      "update_item",
      { item: item.uid, status: newStatus },
      { entity_id: this._config.entity }
    );
  }

  _formatDue(due) {
    if (!due) return null;
    const d = new Date(due);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(d);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDay - today) / 86400000);
    const label = TodoListSearchCard._rtf.format(diffDays, "day");
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return { label: capitalized, overdue: diffDays < 0 };
  }

  _escape(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  _splitPrefix(summary) {
    const match = TodoListSearchCard._PREFIX_RE.exec(summary || "");
    if (!match) return { prefix: null, rest: summary || "" };
    return { prefix: match[1], rest: match[2] };
  }

  _itemHtml(item) {
    const due = this._formatDue(item.due);
    const checked = item.status === "completed";
    const { prefix, rest } = this._splitPrefix(item.summary);
    const summaryHtml = prefix
      ? `<span class="prefix">${this._escape(prefix)}</span> ${this._escape(rest)}`
      : this._escape(item.summary);
    return `
      <li data-uid="${this._escape(item.uid)}" class="${checked ? "completed" : ""}">
        <ha-checkbox></ha-checkbox>
        <span class="summary">${summaryHtml}</span>
        ${due ? `<span class="due ${due.overdue && !checked ? "overdue" : ""}">${due.label}</span>` : ""}
      </li>`;
  }

  /**
   * Baut die feste Kartenhülle (Style, Titel, Suchfeld) EINMAL auf.
   * Wird absichtlich nicht bei jedem Tastendruck im Suchfeld erneut
   * aufgerufen, damit das Eingabefeld als DOM-Element stabil bleibt
   * und die Bildschirmtastatur auf dem Handy nicht flackert.
   */
  _renderShell() {
    if (!this._hass || !this._config) return;

    const stateObj = this._hass.states[this._config.entity];
    const title =
      this._config.title !== undefined
        ? this._config.title
        : stateObj
        ? stateObj.attributes.friendly_name
        : this._config.entity;

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 0; }
        .header {
          padding: 16px 16px 8px;
          font-size: 1.2em;
          font-weight: 500;
          color: var(--ha-card-header-color, var(--primary-text-color));
        }
        .row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px 12px;
        }
        input[type="text"] {
          flex: 1;
          box-sizing: border-box;
          padding: 8px 10px;
          font-size: 14px;
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 6px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #000);
          font-family: inherit;
        }
        input[type="text"]:focus {
          outline: none;
          border-color: var(--mdc-theme-primary, var(--primary-color, #03a9f4));
        }
        ha-icon {
          color: var(--secondary-text-color);
          --mdc-icon-size: 20px;
          flex-shrink: 0;
        }
        .section-title {
          padding: 4px 16px;
          font-size: 0.85em;
          color: var(--secondary-text-color);
        }
        .section-title.clickable { cursor: pointer; }
        ul { list-style: none; margin: 0; padding: 0 0 8px; }
        li {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px 4px 16px;
        }
        li .summary {
          flex: 1;
          color: var(--primary-text-color);
          word-break: break-word;
          font-size: 14px;
        }
        li.completed .summary {
          text-decoration: line-through;
          color: var(--secondary-text-color);
        }
        .prefix {
          color: var(--todo-search-prefix-color, ${this._config.prefix_color});
          font-weight: 600;
        }
        .due {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          white-space: nowrap;
          padding-right: 8px;
        }
        .due.overdue { color: var(--error-color, #db4437); }
        .empty {
          padding: 4px 16px 16px;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }
      </style>
      <ha-card>
        <div class="header">${this._escape(title)}</div>
        <div class="row">
          <ha-icon icon="mdi:magnify"></ha-icon>
          <input id="search" type="text" placeholder="${this._escape(this._config.search_placeholder)}" />
        </div>
        <div id="active-section"></div>
        <div id="completed-section"></div>
      </ha-card>
    `;

    const searchEl = this.shadowRoot.getElementById("search");
    if (searchEl) {
      searchEl.value = this._filter;
      searchEl.addEventListener("input", (e) => {
        this._filter = e.target.value;
        this._updateList();
      });
    }

    // Ein Listener für Klicks/Änderungen an Listen-Inhalten (Checkbox,
    // "Erledigt"-Umschalter). Diese Elemente werden bei jedem
    // _updateList() neu erzeugt, das Delegieren über die Hülle spart
    // uns aber, nach jedem Update erneut einzelne Listener zu binden.
    this.shadowRoot.addEventListener("change", (e) => {
      const li = e.target.closest && e.target.closest("li[data-uid]");
      if (!li) return;
      const uid = li.dataset.uid;
      const item = this._items.find((i) => i.uid === uid);
      if (item) this._toggle(item);
    });
    this.shadowRoot.addEventListener("click", (e) => {
      const toggle = e.target.closest && e.target.closest("#toggle-completed");
      if (!toggle) return;
      this._showCompleted = !this._showCompleted;
      this._updateList();
    });

    this._shellBuilt = true;
  }

  /**
   * Aktualisiert nur die Aufgabenliste (aktiv + erledigt), unabhängig
   * vom Suchfeld selbst. Wird bei jedem Tastendruck im Suchfeld, bei
   * neuen/geänderten Aufgaben (Live-Abo) und beim Ein-/Ausklappen von
   * "Erledigt" aufgerufen.
   */
  _updateList() {
    if (!this._shellBuilt) return;

    const filtered = this._items.filter((i) => this._matchesFilter(i));
    const active = this._sort(filtered.filter((i) => i.status !== "completed"));
    const completed = this._sort(filtered.filter((i) => i.status === "completed"));

    const activeSection = this.shadowRoot.getElementById("active-section");
    if (activeSection) {
      activeSection.innerHTML = `
        <ul id="active">${active.map((i) => this._itemHtml(i)).join("")}</ul>
        ${
          active.length === 0
            ? `<div class="empty">Keine Aufgaben${this._filter ? " für diese Suche" : ""}.</div>`
            : ""
        }
      `;
    }

    const completedSection = this.shadowRoot.getElementById("completed-section");
    if (completedSection) {
      completedSection.innerHTML =
        !this._config.hide_completed && completed.length
          ? `<div class="section-title clickable" id="toggle-completed">Erledigt (${completed.length}) ${
              this._showCompleted ? "▲" : "▼"
            }</div>${
              this._showCompleted
                ? `<ul id="completed">${completed.map((i) => this._itemHtml(i)).join("")}</ul>`
                : ""
            }`
          : "";
    }

    // Checkbox-Zustand als Property setzen (zuverlässiger als das
    // "checked"-Attribut bei ha-checkbox).
    this.shadowRoot.querySelectorAll("li[data-uid]").forEach((li) => {
      const cb = li.querySelector("ha-checkbox");
      if (cb) cb.checked = li.classList.contains("completed");
    });
  }
}

customElements.define("ha-todo-card-search", TodoListSearchCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-todo-card-search",
  name: "To-do-Liste mit Suche",
  description: "Minimalistische To-do-Listen-Karte mit Suchfeld zum Filtern (z.B. nach Raum-Präfix).",
});
