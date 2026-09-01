# HA Todo Card with Search

A custom [Home Assistant](https://www.home-assistant.io/) Lovelace card for managing To-Do lists with built-in search functionality.

## Features

- Display and manage Home Assistant To-Do list entities
- Live search/filter of tasks
- Built with vanilla JavaScript — no build step required

## Installation

### Manual

1. Download `ha-todo-card-search.js` from the [latest release](../../releases/latest).
2. Copy it to your Home Assistant `config/www/` folder.
3. Add a resource in your Lovelace dashboard:
   ```yaml
   url: /local/ha-todo-card-search.js
   type: module
   ```
4. Add the card to your dashboard:
   ```yaml
   type: custom:ha-todo-card-search
   entity: todo.my_list
   ```

### HACS

> HACS support coming soon.

## Configuration

| Option   | Type   | Required | Description                         |
|----------|--------|----------|-------------------------------------|
| `entity` | string | ✅        | The To-Do list entity ID to display |
| `title`  | string | ❌        | Custom card title (default: entity friendly name) |

## Development

No build step needed — edit `ha-todo-card-search.js` directly and reload.

## License

MIT
