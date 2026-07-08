# FoundIt — Lost & Found Logger

A polished web app for logging lost and found items with image upload, integrated with Power Automate to write directly to an Excel sheet.

## Setup

### 1. Power Automate Flow

Create a flow with the **"When an HTTP request is received"** trigger. The flow receives JSON:

```json
{
  "type": "lost | found",
  "name": "Item name",
  "category": "electronics | clothing | ...",
  "location": "Where it was lost/found",
  "date": "YYYY-MM-DD",
  "description": "Description text",
  "email": "user@example.com",
  "phone": "(555) 123-4567",
  "submittedAt": "ISO timestamp",
  "imageBase64": "data:image/png;base64,...",
  "imageName": "photo.jpg"
}
```

Use **"Add a row into a table"** (Excel Online connector) to append to your spreadsheet.

### 2. Paste the trigger URL

Copy the HTTP trigger URL from Power Automate and paste it into the **"Power Automate Endpoint"** field in the app. It saves locally in your browser.

### 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/lost-and-found.git
git push -u origin main
```

Then enable GitHub Pages in repo Settings → Pages (source: `main` branch, root folder).

## Local development

Open `index.html` directly in a browser, or use any static server:

```bash
npx serve .
```

## Stack

- Vanilla HTML/CSS/JS — no build step, no dependencies
- Wensity-inspired glass-morphism design
- Works fully offline (items saved to localStorage)
