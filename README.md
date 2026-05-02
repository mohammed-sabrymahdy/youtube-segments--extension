# ✂️ SegmentSaver — YouTube Clip Manager

A professional Chrome Extension (Manifest V3) that lets you **save, organize, and revisit specific segments** from YouTube videos.

---

## 📦 Installation

1. **Download / clone** this repository to your computer.
2. Open **Google Chrome** and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **"Load unpacked"** and select the `youtube-segments/` folder.
5. The SegmentSaver icon (✂️) will appear in your Chrome toolbar.
6. **Pin it** for easy access.

> ✅ No build step required. Pure Vanilla JS + Manifest V3.

---

## 🎯 How to Use

### Saving a Segment
1. Open any YouTube video.
2. A floating control panel appears at the bottom-left of the player.
3. At your desired start point, click **"⬤ Start"** (or press `Alt+S`).
4. At your desired end point, click **"◼ End"** (or press `Alt+E`).
5. Click **"💾 Save"** — segment is saved instantly.

### Managing Segments (Popup)
- Click the ✂️ icon in your Chrome toolbar to open the dashboard.
- **▶ Play** — Opens the YouTube video and auto-starts at the saved timestamp; auto-pauses at the end.
- **📋 Copy** — Copies a shareable YouTube link with the exact start timestamp.
- **✏️ Edit** — Add notes and tags to the segment.
- **🗑 Delete** — Remove the segment permanently.

### Search & Filter
- **Search bar** — Filter by title, channel name, tag, or note content.
- **Date chips** — Filter by Today, This Week, or All time.
- **Tag filter strip** — Click any tag to filter segments by that tag.

### Export / Import
- **⬇️ Export** — Downloads all segments as a `.json` file.
- **⬆️ Import** — Upload a previously exported `.json` to restore/merge segments.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + S` | Start segment at current time |
| `Alt + E` | End segment at current time |
| `Escape` | Close modal |

---

## 📂 File Structure

```
youtube-segments/
├── manifest.json        # Extension config (Manifest V3)
├── content.js           # YouTube page overlay & logic
├── content-styles.css   # Styles for YouTube overlay
├── popup.html           # Dashboard UI markup
├── popup.js             # Dashboard logic
├── styles.css           # Dashboard styles
├── utils.js             # Shared utilities (storage, time, etc.)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🏗️ Architecture

| File | Responsibility |
|------|---------------|
| `utils.js` | Shared library: time formatting, storage CRUD, URL helpers, export/import |
| `content.js` | Injected into YouTube pages. Builds the floating overlay, handles keyboard shortcuts, renders progress bar markers, watches for auto-pause |
| `content-styles.css` | Styles for the YouTube overlay panel and toast notifications |
| `popup.html` | Extension popup HTML shell |
| `popup.js` | Popup dashboard: renders segment cards, handles search/filter/tags/modal |
| `styles.css` | Dashboard styles with dark/light theme support |

---

## ✨ Features

- 🎬 **Floating overlay** on YouTube player with Start / End / Save controls
- ⏱️ **Live timestamp preview** while selecting
- 🏷️ **Tags system** with filterable tag chips
- 📝 **Notes** per segment
- 🔍 **Full-text search** across title, channel, tags, notes
- 📅 **Date filtering** (Today / This Week / All)
- 🔁 **Duplicate detection** — won't save the same segment twice
- 📍 **Progress bar markers** — highlights saved segments on the YouTube timeline
- ▶️ **Smart playback** — auto-starts and auto-pauses at segment boundaries
- 🔗 **Copy link** with timestamp
- 🌙 **Dark / Light mode** toggle
- 📊 **Total saved time** stat in header
- ⬇️ **Export** to JSON / ⬆️ **Import** from JSON
- ⌨️ **Keyboard shortcuts** (Alt+S / Alt+E)

---

## 🔒 Permissions Used

| Permission | Why |
|-----------|-----|
| `storage` | Save segments in `chrome.storage.local` |
| `tabs` | Open YouTube tab and navigate to segment timestamp |
| `scripting` | (Reserved for future use) |
| `host_permissions: youtube.com` | Inject overlay on YouTube |

---

## 🛠 Extending the Extension

- **Add sync across devices**: Change `chrome.storage.local` → `chrome.storage.sync` in `utils.js`
- **Add more filters**: Extend `getFilteredSegments()` in `popup.js`
- **Add export to CSV**: Add a new export method to `utils.js`
- **Add segment replay loop**: Modify the `timeupdate` listener in `content.js`
