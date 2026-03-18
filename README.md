# Lumi

**Lumi** is a desktop AI reading assistant that illuminates what you're reading. Open a PDF or EPUB, select any passage, and ask Lumi to explain it, translate it, or answer a question about it — all without leaving the page.

![Lumi screenshot placeholder](resources/icon.png)

---

## Features

- **PDF & EPUB support** — open books and documents via file dialog or drag-and-drop
- **AI sidebar** — streaming responses powered by OpenRouter (Google Gemini 2.0 Flash by default)
- **Selection toolbar** — highlight any text and choose Explain, Translate, or Ask
- **Free-form chat** — ask questions about the current chapter without selecting anything
- **Table of contents** — collapsible outline sidebar with one-click navigation
- **Light & dark themes** — warm paper light mode and dark mode, toggled from the title bar
- **Adjustable font size** — A− / A+ controls with a one-click reset
- **macOS native feel** — hiddenInset title bar with traffic light buttons

---

## Requirements

- [Node.js](https://nodejs.org/) 18+
- An [OpenRouter](https://openrouter.ai/) API key

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your API key

Copy the example env file and add your OpenRouter key:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_OPENROUTER_API_KEY=your_key_here
```

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

### 3. Run in development

```bash
npm run dev
```

---

## Usage

### Opening a book

- Click **Open File** in the title bar and select a `.pdf` or `.epub` file, or
- Drag and drop a file onto the Lumi window

### Reading

- **PDF** — all pages are rendered as scrollable text. The current page is tracked in the title bar.
- **EPUB** — rendered as a continuous scrollable document. Chapter title updates as you scroll.

### Navigating chapters

- Use the **‹ ›** arrows in the title bar to jump to the previous/next chapter (EPUB) or page (PDF)
- Click the **list icon** (☰) next to the Lumi wordmark to open the **outline sidebar** — click any entry to jump directly to that section

### Using the AI assistant

1. **Select text** in the reader — a floating toolbar appears near your selection
2. Choose an action:
   - **Explain** — get a plain-language explanation of the passage
   - **Translate** — translate the selection to English
   - **Ask** — type a custom question about the selected text
3. The response streams into the **sidebar** on the right

To ask a free-form question without selecting text, type in the input at the bottom of the sidebar and press Enter.

### Appearance

| Control | Location | What it does |
|---------|----------|--------------|
| ☀ / ☽ | Title bar right | Toggle light / dark theme |
| A− / A+ | Title bar right | Decrease / increase font size |
| `17px` (when visible) | Between A− and A+ | Current size — click to reset to default |

---

## Building for distribution

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

Output is placed in `dist/`.

---

## Project structure

```
src/
  main/          # Electron main process (BrowserWindow, file IPC)
  preload/       # Context bridge (exposes electronAPI to renderer)
  renderer/src/
    components/  # React UI components
    lib/         # OpenRouter streaming, PDF parsing, context builder
    store/       # Zustand global state
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 39 |
| Build | electron-vite + Vite 7 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v3 |
| State | Zustand |
| PDF | pdfjs-dist |
| EPUB | epubjs |
| AI | OpenRouter API (SSE streaming) |

---

## License

MIT
