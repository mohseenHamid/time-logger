# PRD: Ultra-fast Time Logging App

## Overview
A lightweight, local-first time logging app for professionals who need to quickly capture work activities with minimal friction. The app logs start times, maps activity labels intelligently, and calculates time spent per activity until the next entry. It provides simple reports at the day/week/month level, distinguishing between work and non-work activities.

---

## Goals
- **Zero-friction logging:** Minimal clicks/taps to add entries.
- **Accurate durations:** Each entry’s duration = time until the next entry. Last entry of the day = 0 minutes.
- **Intelligent categorisation:** Auto-map input text to existing categories; dropdown suggestions triggered only after typing.
- **Work vs non-work separation:** Categories can be flagged as non-work; excluded from “Work-only” totals.
- **Offline-first:** Local storage with optional later sync.
- **Simple reporting:** Timeline and totals per activity, switchable by day/week/month.

---

## Users & Needs
- **Target user:** Knowledge workers, analysts, product managers.
- **Primary need:** Quick capture of what they’re doing, when they switch context, without breaking flow.
- **Secondary need:** End-of-day or weekly rollup of time spent by activity.

---

## Features

### Logging
- Default entry time = current system time.
- Input field for activity; auto-suggest after typing ≥1 character.
- Dropdown suggests categories (ticket + description) ranked by fuzzy match.
- Hitting enter or “Log” button saves the entry.
- Clear button resets input and time.

### Categories
- Category = {ticket, description, label, nonWork}.
- User can edit categories in a dedicated tab.
- Toggle “Non-work” to exclude from Work-only totals.

### Duration Calculation
- Each entry’s minutes = (next entry time – current entry time).
- If no next entry that day, duration = 0.
- Non-work categories excluded from Work-only totals.

### Views
- **Tabs:**
  - Log & Timeline
  - Categories
- **Timeline ranges:** Day / Week / Month.
- **Totals:** Toggle between Work-only and All activities.

### Storage
- Local storage (localStorage / IndexedDB).
- Optional export to CSV for backup/sharing.

---

## Success Metrics
- User can log a new activity in ≤2 clicks/keystrokes.
- Logged data persists across refresh/restart.
- Totals and timeline update instantly.
- Correct separation of Work vs Non-work.

---

## Non-Goals
- Full project management features.
- Complex integrations (e.g. Jira, Slack).
- Multi-user support (initially single-user local only).

---

# Prompt for Windsurf Build

**Prompt:**

"Build a local-first, ultra-fast time logging app in React with Tailwind. Requirements:
- Entry form: defaults time to now; input field for activity. Pressing Enter logs entry.
- Each entry lasts until the next entry (within same day). If no next entry, duration = 0.
- Categories: ticket + description + nonWork toggle. Store in localStorage.
- Auto-map input text to closest category using fuzzy match. Show dropdown only after typing 1+ characters.
- Tabs: (1) Log & Timeline (with range filter: Day/Week/Month, plus Totals tabbed: Work-only vs All), (2) Categories (editable list).
- Timeline: list entries with start time, label, minutes.
- Totals: grouped by category, show minutes and hours.
- Use localStorage for entries and categories.
- Minimal, clean UI with Tailwind (rounded corners, dark theme)."

---

Would you like me to also prepare **acceptance criteria (ACs)** in Jira-style markup so you can use the same spec for tracking? 
