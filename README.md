# Intake Photo Logger

Fast photo intake tool for lost & found items. Enter an item code, snap a photo, submit — the image lands in your Excel sheet and OneDrive folder via Power Automate.

## How it works

1. Type an **item code** (e.g. `LF-2024-001`)
2. Tap to **take a photo** (or upload/drag-drop)
3. Hit **Submit** → Power Automate writes the row to Excel + saves the image to OneDrive

## Power Automate Flow Setup

Create a flow with the **"When an HTTP request is received"** trigger. The JSON payload:

```json
{
  "itemCode": "LF-2024-001",
  "type": "lost",
  "imageBase64": "data:image/jpeg;base64,...",
  "imageName": "LF-2024-001.jpg",
  "submittedAt": "2024-01-15T10:30:00.000Z"
}
```

### Flow actions to add

1. **"Add a row into a table"** (Excel Online) — map fields to your spreadsheet columns
2. **"Create file"** (OneDrive) — use the `imageName` and base64 content to save the photo
   - Tip: use the `dataUriToBinary()` expression to decode base64 for OneDrive

### Configure the app

Paste your flow's HTTP trigger URL in the **Settings** panel at the bottom of the app. It's saved locally in your browser.

## Deploy

Already deployed via GitHub Pages at: `https://csulblostandfound.github.io/intake-photo-logger/`

## Local dev

Open `index.html` directly, or:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies
- Wensity-inspired glass-morphism design
- Camera capture support (`capture="environment"`)
- localStorage for submission history
