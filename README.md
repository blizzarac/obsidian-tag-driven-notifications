# Tag-Driven Notifications Plugin for Obsidian

Generate smart notifications from dates in your notes using customizable rules and offsets. Never miss an important date again!

## ✨ Features

- 📅 **Date Detection**: Automatically extract dates from frontmatter fields and inline tags
- 🔔 **Smart Notifications**: Configure rules with offsets (e.g., notify 1 day before birthdays)
- 🔄 **Repeat Patterns**: Support for daily, weekly, monthly, and yearly recurring notifications
- 📱 **Dual Channels**: Send notifications via Obsidian (in-app) and/or system notifications
- ⚙️ **Global Settings**: Configure rules once, apply everywhere
- 🎯 **Flexible Targeting**: Choose specific folders or scan your entire vault
- 🔐 **Privacy Mode**: Option to keep schedule in memory only
- 📋 **Rich UI**: Intuitive settings interface with rules table and upcoming notifications view

## 📦 Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community Plugins
2. Search for "Tag-Driven Notifications"
3. Install and enable the plugin

### Manual Installation
1. Download the latest release from GitHub
2. Extract `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/tag-driven-notifications/`
3. Enable the plugin in Settings → Community Plugins

## 🚀 Quick Start

### Step 1: Add Dates to Your Notes

**Frontmatter Example:**
```yaml
---
title: "John Doe"
birthday: 1985-02-20
anniversary: 2010-06-15
---
```

**Inline Tags Example:**
```markdown
Meeting with Sarah #due:2025-10-01T14:00
Project deadline #deadline:2025-12-31
```

### Step 2: Configure Notification Rules

1. Open Settings → Tag-Driven Notifications
2. Click "+ Add Rule"
3. Configure your rule:
   - **Field/Tag**: `birthday`
   - **Default Time**: `09:00`
   - **Offsets**: `-P1D` (1 day before)
   - **Repeat**: `yearly`
   - **Message**: `🎂 {title}'s birthday`
   - **Channels**: Obsidian + System

### Step 3: Enjoy Smart Reminders!

The plugin will automatically:
- Index your vault for matching dates
- Generate a notification schedule
- Fire notifications at the configured times

## 📋 Configuration

### Global Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Default notification time | Time to send notifications when not specified in rule | `09:00` |
| Timezone override | Override system timezone | System default |
| Date formats | Parsing formats for dates | `yyyy-MM-dd, dd.MM.yyyy, MM/dd/yyyy` |

### Notification Rules

Each rule consists of:

- **Field/Tag**: The frontmatter field or tag to watch
- **Default Time**: When to send the notification (HH:MM format)
- **Offsets**: ISO 8601 durations for timing (e.g., `-P1D`, `-PT30M`)
- **Repeat**: How often to repeat (none, daily, weekly, monthly, yearly)
- **Message Template**: Notification text with placeholders
- **Channels**: Where to send (Obsidian, system, or both)

### Message Template Placeholders

Use these placeholders in your message templates:

- `{title}` - Note title
- `{field}` - Field/tag name
- `{date}` - Formatted date
- `{path}` - Note path

### ISO 8601 Duration Examples

| Duration | Meaning |
|----------|---------|
| `-P1D` | 1 day before |
| `-PT2H` | 2 hours before |
| `-P1W` | 1 week before |
| `-P1M` | 1 month before |
| `+P1D` | 1 day after |
| `-PT30M` | 30 minutes before |

## 🎮 Commands

Access via Command Palette (Ctrl/Cmd + P):

- **Re-index vault**: Manually refresh the date index
- **Show upcoming notifications**: View scheduled notifications
- **Pause notifications**: Temporarily disable all notifications
- **Resume notifications**: Re-enable notifications
- **Test notification**: Send a test notification
- **Request system notification permission**: Enable browser notifications

## 🖱️ Ribbon Menu

Click the bell icon (🔔) in the left ribbon for quick access to:

- Pause/Resume notifications
- Show upcoming notifications
- Re-index vault
- Open settings

## 📊 Status Bar

The status bar shows:
- Number of upcoming notifications
- Paused state indicator

## 🔧 Advanced Settings

### Indexing Scope
- **Entire vault**: Scan all notes
- **Selected folders**: Only scan specific folders

### Excluded Folders
Folders to always exclude from indexing (e.g., `templates`, `archive`)

### Privacy Mode
When enabled, the notification schedule is kept in memory only and not saved to disk.

### Debug Mode
Enable detailed console logging for troubleshooting.

## 💡 Use Case Examples

### Birthday Reminders
```yaml
field: birthday
offsets: -P1D, -P7D
repeat: yearly
message: 🎂 {title}'s birthday is coming up!
```

### Task Deadlines
```yaml
field: due
offsets: -PT30M, -P1D
repeat: none
message: ⏰ Task due: {title}
```

### Recurring Meetings
```yaml
field: meeting
offsets: -PT15M
repeat: weekly
message: 📅 Meeting reminder: {title}
```

### Anniversary Notifications
```yaml
field: anniversary
offsets: -P1W, -P1D
repeat: yearly
message: 💍 Anniversary reminder: {title}
```

## 🐛 Troubleshooting

### Notifications Not Firing

1. Check that notifications are not paused (ribbon icon)
2. Verify your rules are enabled in settings
3. Ensure dates are in supported formats
4. For system notifications, check browser permissions

### Dates Not Being Detected

1. Verify the field/tag name matches your rule exactly
2. Check that the date format is supported
3. Run "Re-index vault" command
4. Enable debug mode to see detailed logs

### System Notifications Not Working

1. Run "Request system notification permission" command
2. Check browser notification settings
3. Ensure Obsidian has notification permissions in your OS

## 🔒 Privacy & Security

- All data is stored locally in your vault
- No external services or APIs are used
- Privacy mode available for sensitive vaults
- Schedule can be encrypted with vault encryption

## 🚧 Limitations

- System notifications require browser support
- Date parsing limited to configured formats
- Large vaults may take time to index initially
- Maximum check interval is 30 seconds

## 📝 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-tag-driven-notifications.git

# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode with watch
npm run dev
```

### Project Structure

```
├── src/
│   ├── models/          # Data models and types
│   ├── services/        # Core services (indexer, scheduler, dispatcher)
│   ├── ui/              # UI components (settings, modals)
│   └── utils/           # Utility functions
├── main.ts              # Plugin entry point
├── manifest.json        # Plugin metadata
└── styles.css           # Plugin styles
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built for the amazing Obsidian community
- Inspired by various reminder and notification plugins
- Uses Obsidian's powerful plugin API

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/obsidian-tag-driven-notifications/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/obsidian-tag-driven-notifications/discussions)

## 🗺️ Roadmap

- [ ] Natural language date parsing
- [ ] Email notification channel
- [ ] Notification templates library
- [ ] Bulk rule import/export
- [ ] Integration with calendar plugins
- [ ] Mobile app support
- [ ] Custom notification sounds
- [ ] Snooze functionality

---

Made with ❤️ for Obsidian users who never want to forget important dates!