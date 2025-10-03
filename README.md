# Time Logger Desktop App

A ultra-fast, local-first time logging desktop application built with Electron, React, and Tailwind CSS. Features global keyboard shortcuts for instant time entry and comprehensive time tracking capabilities.

## Features

- **🚀 Ultra-fast logging**: Minimal clicks to add entries with global keyboard shortcut
- **⌨️ Global shortcut**: Press `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac) anywhere to open quick entry
- **🏠 Local-first**: All data stored locally with electron-store
- **📊 Smart categorization**: Auto-mapping with fuzzy search and dropdown suggestions
- **📈 Comprehensive reporting**: Timeline view and totals with work/non-work separation
- **🎯 System tray**: Easy access from system tray
- **🌙 Dark theme**: Beautiful, modern UI with dark theme

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run electron:dev
   ```

4. Build for production:
   ```bash
   npm run electron:build
   ```

## Usage

### Main Features

1. **Quick Entry Window**: Press `Ctrl+Shift+T` anywhere to open the quick entry overlay
2. **Main Application**: Full interface for viewing timeline, managing categories, and generating reports
3. **System Tray**: Right-click the tray icon for quick access to features

### Time Logging

- Default entry time is current system time
- Type activity name and press Enter to log
- Auto-suggestions appear after typing 1+ characters
- Each entry duration = time until next entry (same day)
- Last entry of the day has 0 duration

### Categories

- Manage preset categories in the Categories tab
- Toggle "Non-work" to exclude from work-only totals
- Categories auto-created from free text if no match found

### Reporting

- **Timeline**: View entries by Day/Week/Month
- **Totals**: Grouped by activity with Work-only vs All activities toggle
- **Duration calculation**: Automatic calculation between entries

## Keyboard Shortcuts

- `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac): Open quick entry window
- `Escape`: Close quick entry window
- `Enter`: Submit entry in quick entry window

## Project Structure

```
time-logger-work/
├── electron/           # Electron main process files
│   ├── main.js        # Main Electron process
│   └── preload.js     # Preload script for IPC
├── src/               # React application
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions
│   └── data/          # Default data
├── package.json       # Dependencies and scripts
└── vite.config.js     # Vite configuration
```

## Development

### Available Scripts

- `npm run dev`: Start Vite dev server (web preview)
- `npm run electron:dev`: Start Electron app in development mode
- `npm run build`: Build for production
- `npm run electron:build`: Build Electron app for distribution

### Architecture

- **Electron Main Process**: Handles window management, global shortcuts, system tray
- **React Renderer**: UI components with Tailwind CSS styling  
- **electron-store**: Persistent data storage that syncs across windows
- **Vite**: Fast build tool and dev server

## Data Storage

All data is stored locally using electron-store:
- **Categories**: `timelog.categories.v1`
- **Entries**: `timelog.entries.v2`

Data persists across app restarts and syncs between main window and quick entry.

## Building for Distribution

The app can be built for Windows, macOS, and Linux:

```bash
npm run electron:build
```

Built applications will be in the `release/` directory.

## Extending the App

The architecture is designed for easy extension:

1. **Add new storage keys**: Use the `useElectronStore` hook
2. **Create new windows**: Add window management in `electron/main.js`
3. **Add features**: Create new React components in `src/components/`
4. **Modify shortcuts**: Update global shortcut registration in main process

## License

MIT License - feel free to use and modify as needed.
