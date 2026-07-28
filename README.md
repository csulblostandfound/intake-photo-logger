# Intake Photo Logger

Fast photo intake tool for lost & found items. Enter an item code, snap a photo, submit — the image lands in your Excel sheet and OneDrive folder via Power Automate.

## How it works

1. Type an **item code** (e.g. `LF-2024-001`)
2. Tap to **take a photo** (or upload/drag-drop)
3. Hit **Submit** → Power Automate writes the row to Excel + saves the image to OneDrive

## Prefilling from another tool

Both fields can be set from the URL, so a tool that already knows the item code
can hand it straight over and the operator only takes the picture:

```
https://csulblostandfound.github.io/intake-photo-logger/?code=AP-2026-0001&type=found
```

| Param  | Values          | Effect                                        |
| ------ | --------------- | --------------------------------------------- |
| `code` | any string      | Fills the item code, skips the year prefix    |
| `type` | `lost`, `found` | Selects the toggle                            |

Both are optional and anything missing falls back to the normal defaults. The
AirPods Intake Station uses this to pass its lot number.

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

The shared CSULB Lost & Found flow's trigger URL is baked into `js/app.js` (`DEFAULT_PA_URL`), so devices work out of the box with no per-device setup. The **Settings** panel is gated behind the admin password and only needs to be touched to point a device at a *different* flow — whatever's entered there is saved locally in that browser and overrides the default.

Note: this repo and its GitHub Pages site are public, so the trigger URL is visible to anyone who reads the source. If it's ever misused, regenerate the trigger's signature in Power Automate and update `DEFAULT_PA_URL`.

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
