# Excalidraw MCP Server: Powerful Drawing API for LLM Integration

A comprehensive Model Context Protocol (MCP) server that enables seamless interaction with Excalidraw diagrams and drawings. This server provides LLMs (Large Language Models) with the ability to create, modify, query, and manipulate Excalidraw drawings through a structured, developer‑friendly API.

## Features

- **Full Excalidraw Element Control**  
  Create, update, delete, and query any Excalidraw element (rectangle, ellipse, diamond, text, arrow, etc.), including support for:
  - position (`x`, `y`)
  - dimensions (`width`, `height`)
  - styling (`backgroundColor`, `strokeColor`, `strokeWidth`, `roughness`, `opacity`)
  - text (`text`, `fontSize`, `fontFamily`)
  - line geometry (`points`)
  - locking (`locked` flag)  
- **Advanced Element Manipulation**  
  Group, ungroup, align, distribute, lock, and unlock elements.  
- **Scene & AppState Management**  
  - Track and modify scene‑level state: `theme`, `viewBackgroundColor`, `viewport` (scroll & zoom), `selectedElements`, `groups`.  
  - Retrieve library of all elements or individual scene properties.  
- **Save Scene**  
  Export the current scene (elements + appState) to a `.excalidraw` file on disk.  
- **Resource Management**  
  Access and modify scene information, element library, theme, and raw element data.  
- **Easy Integration**  
  Compatible with Claude Desktop, Cursor, and any other LLM platforms that support MCP.  
- **Docker Support**  
  Simple containerized deployment for zero‑dependency installs.

---

## API Tools Reference

### Element Creation and Modification

#### `create_element`  
Create a new Excalidraw element.  
- **Input**  
  ```json
  {
    "type": "<element type>",
    "x": <number>,
    "y": <number>,
    "width": <number, optional>,
    "height": <number, optional>,
    "points": [{"x":<number>,"y":<number>}…],
    "backgroundColor": "<hex>",
    "strokeColor": "<hex>",
    "strokeWidth": <number>,
    "roughness": <number>,
    "opacity": <0–1>,
    "text": "<string>",
    "fontSize": <number>,
    "fontFamily": "<string>",
    "locked": <boolean>
  }
  ```
- **Output**  
  ```json
  { "id": "<generated‑id>", "type": "<element type>", "created": true }
  ```

#### `update_element`  
Update properties of an existing element.  
- **Input**  
  ```json
  {
    "id": "<element id>",
  }
  ```
- **Output**  
  ```json
  { "id": "<element id>", "updated": true, "version": <new‑version‑number> }
  ```

#### `delete_element`  
Remove an element from the scene.  
- **Input**  
  ```json
  { "id": "<element id>" }
  ```
- **Output**  
  ```json
  { "id": "<element id>", "deleted": true }
  ```

#### `query_elements`  
List elements matching optional filters.  
- **Input**  
  ```json
  {
    "type": "<element type>",        
    "filter": { "<prop>": <value> }  
  }
  ```
- **Output**  
  ```json
  [ { /* element objects */ } … ]
  ```

### Resource Management

#### `get_resource`  
Retrieve scene or library information.  
- **Input**  
  ```json
  { "resource": "scene"|"library"|"theme"|"elements" }
  ```
- **Output**  
  - **scene** → `{ theme, viewport: {x,y,zoom}, selectedElements: […] }`  
  - **library**/**elements** → `{ elements: [ … ] }`  
  - **theme** → `{ theme: "light"|"dark" }`

### Element Organization

#### `group_elements` / `ungroup_elements`  
Group or ungroup element collections.  
- **Input**  
  ```json
  { "elementIds": ["id1","id2",…] }
  { "groupId": "<group id>" }
  ```
- **Output**  
  ```json
  { "groupId": "<new‑id>", "elementIds": […], "ungrouped": true? }
  ```

#### `align_elements`  
Align multiple elements to specified edge or center.  
- **Input**  
  ```json
  { "elementIds": […], "alignment": "left"|"center"|"right"|"top"|"middle"|"bottom" }
  ```
- **Output**  
  `{ aligned: true, elementIds: […], alignment: "<alignment>" }`

#### `distribute_elements`  
Evenly space elements horizontally or vertically.  
- **Input**  
  ```json
  { "elementIds": […], "direction": "horizontal"|"vertical" }
  ```
- **Output**  
  `{ distributed: true, elementIds: […], direction: "<direction>" }`

#### `lock_elements` / `unlock_elements`  
Prevent or allow editing of elements.  
- **Input**  
  ```json
  { "elementIds": [… ] }
  ```
- **Output**  
  `{ locked: true|false, elementIds: […] }`

### Scene Management

#### `save_scene`  
Export current scene (elements + appState) to a `.excalidraw` file.  
- **Input**  
  ```json
  { "filename": "<optional, must end with .excalidraw>" }
  ```
- **Output**  
  `Scene saved successfully to <filename>` or error message.

---

## Integration Examples

### Claude Desktop

```json
"mcpServers": {
  "excalidraw": {
    "command": "node",
    "args": ["src/index.js"],
    "env": {
      "LOG_LEVEL": "info",
      "DEBUG": "false"
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_excalidraw/src/index.js"],
      "env": { "LOG_LEVEL": "info", "DEBUG": "false" }
    }
  }
}
```

### Docker

```bash
docker run -i --rm mcp/excalidraw
```

Or in MCP config:

```json
"mcpServers": {
  "excalidraw": {
    "command": "docker",
    "args": ["run", "-i", "--rm", "mcp/excalidraw"],
    "env": { "LOG_LEVEL": "info", "DEBUG": "false" }
  }
}
```

---

## Installation Guide

```bash
# Install dependencies
npm install

# Run development server
npm start
```

### Docker

```bash
docker build -t mcp/excalidraw .
docker run -i --rm mcp/excalidraw
```

---

## Configuration Options

Set via environment variables in `.env` or your container:

- `LOG_LEVEL` — logging level (default: `"info"`)  
- `DEBUG`     — debug mode (`"true"`/`"false"`, default: `"false"`)  
- `DEFAULT_THEME` — default UI theme (`"light"`/`"dark"`, default: `"light"`)

---

## Usage Examples

### Create & Lock a Rectangle

```json
{"type":"rectangle","x":50,"y":50,"width":100,"height":80,"backgroundColor":"#f3f3f3","strokeColor":"#333","locked":true}

{ "id":"abc123","type":"rectangle","created":true }

{"elementIds":["abc123"]}
```

### Save Scene to File

```json
{"filename":"my_drawing.excalidraw"}

"Scene saved successfully to my_drawing.excalidraw"
```