# Obsidian Plugin Requirements: Tag-Driven Notifications (Settings-Based)

## 1) Purpose & Goals
- Generate notifications based on **date fields/tags** in notes.  
- Users configure **notification rules globally in plugin settings** rather than per-note YAML.  
- Example: If `birthday: 1985-02-20` exists in frontmatter, the plugin applies the configured birthday reminder rule (e.g., notify 1 day before at 09:00).

---

## 2) Scope
- Parse **YAML frontmatter** and **inline tags** across a vault.  
- Use **plugin settings** to define how each date field should trigger notifications (offsets, repeat, message, channels).  
- Deliver notifications in-app and/or via system notifications.  

---

## 3) Note Syntax

### 3.1 Frontmatter
```yaml
---
title: "John Doe"
birthday: 1985-02-20
---
```

### 3.2 Inline tags
```
Meeting with Sarah #due:2025-10-01T14:00
```

> Notes contain only **raw dates**; the plugin interprets them using configured rules.

---

## 4) Plugin Settings

### 4.1 Date Field / Tag Rules
- User defines a **list of fields/tags** to watch.  
- Each rule contains:
  - **Field/tag name** (e.g., `birthday`, `due`, `anniversary`).  
  - **Default time of day** (e.g., `09:00`).  
  - **Offset(s)** relative to date (e.g., `-P1D`, `-PT2H`, `+P1W`).  
  - **Repeat**: none, daily, weekly, monthly, yearly.  
  - **Message template** (with placeholders like `{field}`, `{title}`, `{date}`).  
    - Example: `"🎂 {title}'s birthday"` → resolves note title + field.  
  - **Channels**: obsidian/system/both.  

### 4.2 Global Options
- Default notification time.  
- Timezone override (optional).  
- Parsing formats (ISO first, then user locale).  
- Indexing scope: all vault / selected folders.  
- Exclusions: ignored tags/folders.  
- Privacy toggle: keep schedule in memory only.  

---

## 5) Notification Semantics
- Notifications fire according to **settings rules**, not per-note config.  
- Example:  
  - Rule: `"birthday"` → notify `-P1D` at `09:00`, repeat yearly.  
  - Note: `birthday: 1985-02-20`.  
  - Result: Every Feb 19 at 09:00, show `"🎂 John Doe's birthday"`.  

---

## 6) Commands & UI
- **Commands**:  
  - Reindex vault  
  - Show upcoming notifications  
  - Pause/resume notifications  
- **Ribbon icon**: pause/resume, show upcoming  
- **Settings UI**: table of field/tag rules, add/remove/edit  
- **Upcoming modal**: preview scheduled notifications  

---

## 7) Data Model

```ts
interface Rule {
  field: string;               // e.g., "birthday"
  defaultTime?: string;        // "09:00"
  offsets: string[];           // ISO durations
  repeat: "none"|"daily"|"weekly"|"monthly"|"yearly";
  messageTemplate: string;     // e.g., "🎂 {title}'s birthday"
  channels: ("obsidian"|"system")[];
}

interface ScheduledOccurrence {
  ruleField: string;
  notePath: string;
  occurrence: string;          // ISO datetime
  fired: boolean;
}
```

---

## 8) Acceptance Criteria
- Given a note with `birthday: 1985-02-20` and a **birthday rule** in settings (`-P1D 09:00 yearly`), the plugin produces a notification every Feb 19 at 09:00.  
- Inline `#due:2025-10-01T14:00` + rule for `due` (offset -PT30M) → notification fires Sept 30 at 13:30.  
- Rules editable only in plugin settings, not in note frontmatter.  

---

## 9) Example Settings UI Mockups

### 9.1 Rules Table
| Field/Tag  | Default Time | Offsets         | Repeat  | Message Template          | Channels   | Actions |
|------------|--------------|-----------------|---------|---------------------------|------------|---------|
| birthday   | 09:00        | -P1D            | yearly  | 🎂 {title}'s birthday     | obsidian+system | Edit / Delete |
| due        | 09:00        | -PT30M, -P1D    | none    | ⏰ Task due: {title} ({date}) | obsidian | Edit / Delete |
| anniversary| 10:00        | -P1D            | yearly  | 💍 Anniversary: {title}   | system     | Edit / Delete |

---

### 9.2 Rule Editor (when adding/editing)
```
+---------------------------------------------+
| Field/Tag: [ birthday      v ]              |
| Default time: [ 09:00   ]                   |
| Offsets:      [ -P1D, -PT2H ] (add/remove)  |
| Repeat:       [ yearly     v ]              |
| Message:      [ 🎂 {title}'s birthday ]     |
| Channels:     [x] Obsidian  [x] System      |
+---------------------------------------------+
| [ Save ] [ Cancel ]                         |
+---------------------------------------------+
```

---

### 9.3 Global Settings
```
Default notification time: [ 09:00 ]
Timezone override:         [ System default v ]
Date formats to parse:     [ yyyy-MM-dd, dd.MM.yyyy ]
Indexing scope:            [ Entire vault v ]
Excluded folders/tags:     [ templates/, archive/ ]
Privacy mode:              [ ] Do not save schedule to disk
```

---
