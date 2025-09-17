/**
 * Settings tab for Tag-Driven Notifications plugin
 */

import { App, PluginSettingTab, Setting, Modal, TextComponent, ButtonComponent, Notice } from 'obsidian';
import TagDrivenNotificationsPlugin from '../../main';
import { Rule, NotificationChannel, RepeatPattern, RuleValidator } from '../models/types';

export class NotificationSettingsTab extends PluginSettingTab {
    plugin: TagDrivenNotificationsPlugin;

    constructor(app: App, plugin: TagDrivenNotificationsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h1', { text: 'Tag-Driven Notifications Settings' });

        // Global Settings Section
        this.createGlobalSettings(containerEl);

        // Rules Section
        this.createRulesSection(containerEl);

        // Advanced Settings Section
        this.createAdvancedSettings(containerEl);
    }

    private createGlobalSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '⚙️ Global Settings' });

        new Setting(containerEl)
            .setName('Default notification time')
            .setDesc('Default time to send notifications (HH:MM format)')
            .addText(text => text
                .setPlaceholder('09:00')
                .setValue(this.plugin.settings.defaultNotificationTime)
                .onChange(async (value) => {
                    if (RuleValidator.isValidTime(value)) {
                        this.plugin.settings.defaultNotificationTime = value;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Timezone override')
            .setDesc('Override system timezone (optional, e.g., "America/New_York")')
            .addText(text => text
                .setPlaceholder('System default')
                .setValue(this.plugin.settings.timezoneOverride || '')
                .onChange(async (value) => {
                    this.plugin.settings.timezoneOverride = value || undefined;
                    await this.plugin.saveSettings();
                }));

        // Date formats section with table
        const dateFormatsSetting = new Setting(containerEl)
            .setName('Date formats')
            .setDesc('Date parsing formats used to extract dates from your notes');
        
        // Create container for date formats list
        const dateFormatsContainer = dateFormatsSetting.settingEl.createDiv({ cls: 'date-formats-container' });
        this.renderDateFormatsList(dateFormatsContainer);
        
        // Add new format button
        dateFormatsSetting.addButton(button => button
            .setButtonText('+ Add Format')
            .onClick(() => {
                this.openDateFormatModal(null);
            }));
    }

    private createRulesSection(containerEl: HTMLElement): void {
        const rulesSection = containerEl.createDiv();
        rulesSection.createEl('h2', { text: '📋 Notification Rules' });

        // Buttons row
        const buttonsRow = new Setting(rulesSection)
            .setName('Manage rules')
            .setDesc('Add custom rules or use pre-configured examples');
        
        // Add Rule Button
        buttonsRow.addButton(button => button
            .setButtonText('+ Add Rule')
            .setCta()
            .onClick(() => {
                this.openRuleEditor(null);
            }));
        
        // Add Example Rules Button
        buttonsRow.addButton(button => button
            .setButtonText('📚 Add Example Rules')
            .onClick(async () => {
                const confirmed = confirm(
                    'This will add 4 example rules to help you get started:\n\n' +
                    '• Birthday reminders (yearly)\n' +
                    '• Task due dates (one-time)\n' +
                    '• Meeting reminders (none)\n' +
                    '• Anniversary notifications (yearly)\n\n' +
                    'Continue?'
                );
                
                if (confirmed) {
                    this.addExampleRules();
                    await this.plugin.saveSettings();
                    this.display(); // Refresh the settings display
                    new Notice('Example rules added! Customize them as needed.');
                }
            }));

        // Rules Table
        const tableContainer = rulesSection.createDiv({ cls: 'notification-settings-table' });
        this.renderRulesTable(tableContainer);
    }

    private renderRulesTable(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.rules.length === 0) {
            container.createEl('p', { 
                text: 'No rules configured yet. Click "Add Rule" to create your first notification rule.',
                cls: 'notification-empty-state'
            });
            return;
        }

        const table = container.createEl('table');
        
        // Header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        ['Field/Tag', 'Time', 'Offsets', 'Repeat', 'Message', 'Channels', 'Actions'].forEach(header => {
            headerRow.createEl('th', { text: header });
        });

        // Body
        const tbody = table.createEl('tbody');
        this.plugin.settings.rules.forEach((rule, index) => {
            const row = tbody.createEl('tr');
            
            // Field/Tag
            row.createEl('td', { text: rule.field });
            
            // Time
            row.createEl('td', { text: rule.defaultTime || this.plugin.settings.defaultNotificationTime });
            
            // Offsets
            const offsetsCell = row.createEl('td');
            offsetsCell.createEl('span', { 
                text: rule.offsets.join(', ') || 'No offset',
                cls: 'notification-offset-chips'
            });
            
            // Repeat
            row.createEl('td', { text: rule.repeat });
            
            // Message
            const messageCell = row.createEl('td');
            messageCell.createEl('span', { 
                text: this.truncateText(rule.messageTemplate, 30),
                attr: { title: rule.messageTemplate }
            });
            
            // Channels
            const channelsCell = row.createEl('td');
            channelsCell.createEl('span', { 
                text: rule.channels.join('+'),
                cls: 'notification-channels'
            });
            
            // Actions
            const actionsCell = row.createEl('td', { cls: 'notification-actions' });
            
            // Enable/Disable toggle
            const toggleBtn = actionsCell.createEl('button', {
                text: rule.enabled ? '✓' : '✗',
                cls: `notification-toggle ${rule.enabled ? 'enabled' : 'disabled'}`
            });
            toggleBtn.onclick = async () => {
                rule.enabled = !rule.enabled;
                await this.plugin.saveSettings();
                await this.plugin.rebuildSchedule();
                this.renderRulesTable(container);
            };
            
            // Edit button
            const editBtn = actionsCell.createEl('button', { text: '✏️' });
            editBtn.onclick = () => {
                this.openRuleEditor(rule);
            };
            
            // Delete button
            const deleteBtn = actionsCell.createEl('button', { text: '🗑️' });
            deleteBtn.onclick = async () => {
                if (confirm(`Delete rule for "${rule.field}"?`)) {
                    this.plugin.settings.rules.splice(index, 1);
                    await this.plugin.saveSettings();
                    await this.plugin.rebuildSchedule();
                    this.renderRulesTable(container);
                }
            };
        });
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '🔧 Advanced Settings' });

        new Setting(containerEl)
            .setName('Indexing scope')
            .setDesc('Choose which folders to index for date fields')
            .addDropdown(dropdown => dropdown
                .addOption('entire-vault', 'Entire vault')
                .addOption('selected-folders', 'Selected folders only')
                .setValue(this.plugin.settings.indexingScope)
                .onChange(async (value: 'entire-vault' | 'selected-folders') => {
                    this.plugin.settings.indexingScope = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide folder settings
                }));

        if (this.plugin.settings.indexingScope === 'selected-folders') {
            // Included folders section with table
            const includedFoldersSetting = new Setting(containerEl)
                .setName('Included folders')
                .setDesc('Only these folders will be indexed');
            
            // Create container for included folders list
            const includedFoldersContainer = includedFoldersSetting.settingEl.createDiv({ cls: 'included-folders-container' });
            this.renderIncludedFoldersList(includedFoldersContainer);
            
            // Add new folder button
            includedFoldersSetting.addButton(button => button
                .setButtonText('+ Add Folder')
                .onClick(() => {
                    this.openIncludedFolderModal(null);
                }));
        }

        // Excluded folders section with table
        const excludedFoldersSetting = new Setting(containerEl)
            .setName('Excluded folders')
            .setDesc('Folders to always exclude from indexing');
        
        // Create container for excluded folders list
        const excludedFoldersContainer = excludedFoldersSetting.settingEl.createDiv({ cls: 'excluded-folders-container' });
        this.renderExcludedFoldersList(excludedFoldersContainer);
        
        // Add new folder button
        excludedFoldersSetting.addButton(button => button
            .setButtonText('+ Add Folder')
            .onClick(() => {
                this.openExcludedFolderModal(null);
            }));

        new Setting(containerEl)
            .setName('Privacy mode')
            .setDesc('Do not save notification schedule to disk (keeps in memory only)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.privacyMode)
                .onChange(async (value) => {
                    this.plugin.settings.privacyMode = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable detailed console logging')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }

    private openRuleEditor(rule: Rule | null): void {
        new RuleEditorModal(this.app, rule, async (savedRule) => {
            if (rule) {
                // Update existing rule
                const index = this.plugin.settings.rules.findIndex(r => r.id === rule.id);
                if (index >= 0) {
                    this.plugin.settings.rules[index] = savedRule;
                }
            } else {
                // Add new rule
                this.plugin.settings.rules.push(savedRule);
            }
            
            await this.plugin.saveSettings();
            await this.plugin.rebuildSchedule();
            this.display(); // Refresh settings display
        }).open();
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    private renderDateFormatsList(container: HTMLElement): void {
        container.empty();
        
        if (this.plugin.settings.dateFormats.length === 0) {
            container.createEl('div', {
                text: 'No date formats configured. Add at least one format.',
                cls: 'date-formats-empty'
            });
            return;
        }
        
        // Create table for date formats
        const table = container.createEl('table', { cls: 'date-formats-table' });
        
        // Header
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', { text: 'Format' });
        headerRow.createEl('th', { text: 'Example' });
        headerRow.createEl('th', { text: 'Actions' });
        
        // Body
        const tbody = table.createEl('tbody');
        
        // Common date format examples
        const exampleDate = new Date('2025-09-17T14:30:00');
        
        this.plugin.settings.dateFormats.forEach((format, index) => {
            const row = tbody.createEl('tr');
            
            // Format
            const formatCell = row.createEl('td');
            formatCell.createEl('code', { text: format });
            
            // Example
            const exampleCell = row.createEl('td');
            try {
                // Show example of how this format looks
                const example = this.getDateFormatExample(format, exampleDate);
                exampleCell.createEl('span', { 
                    text: example,
                    cls: 'date-format-example'
                });
            } catch (e) {
                exampleCell.createEl('span', { 
                    text: 'Invalid format',
                    cls: 'date-format-error'
                });
            }
            
            // Actions
            const actionsCell = row.createEl('td', { cls: 'date-format-actions' });
            
            // Move up button
            if (index > 0) {
                const upBtn = actionsCell.createEl('button', { text: '↑' });
                upBtn.onclick = async () => {
                    [this.plugin.settings.dateFormats[index], this.plugin.settings.dateFormats[index - 1]] = 
                    [this.plugin.settings.dateFormats[index - 1], this.plugin.settings.dateFormats[index]];
                    await this.plugin.saveSettings();
                    this.renderDateFormatsList(container);
                };
            }
            
            // Move down button
            if (index < this.plugin.settings.dateFormats.length - 1) {
                const downBtn = actionsCell.createEl('button', { text: '↓' });
                downBtn.onclick = async () => {
                    [this.plugin.settings.dateFormats[index], this.plugin.settings.dateFormats[index + 1]] = 
                    [this.plugin.settings.dateFormats[index + 1], this.plugin.settings.dateFormats[index]];
                    await this.plugin.saveSettings();
                    this.renderDateFormatsList(container);
                };
            }
            
            // Edit button
            const editBtn = actionsCell.createEl('button', { text: '✏️' });
            editBtn.onclick = () => {
                this.openDateFormatModal(index);
            };
            
            // Delete button
            const deleteBtn = actionsCell.createEl('button', { text: '🗑️' });
            deleteBtn.onclick = async () => {
                if (this.plugin.settings.dateFormats.length > 1) {
                    if (confirm(`Delete date format "${format}"?`)) {
                        this.plugin.settings.dateFormats.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.renderDateFormatsList(container);
                    }
                } else {
                    new Notice('Cannot delete the last date format. At least one format is required.');
                }
            };
        });
        
        // Add common format examples below the table
        const helpDiv = container.createEl('div', { cls: 'date-formats-help' });
        helpDiv.style.marginTop = '10px';
        helpDiv.style.padding = '8px';
        helpDiv.style.backgroundColor = 'var(--background-secondary)';
        helpDiv.style.borderRadius = '4px';
        helpDiv.style.fontSize = '0.85em';
    }
    
    private getDateFormatExample(format: string, date: Date): string {
        // Simple format replacement for common patterns
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return format
            .replace(/yyyy/g, year)
            .replace(/MM/g, month)
            .replace(/dd/g, day)
            .replace(/HH/g, hours)
            .replace(/mm/g, minutes);
    }
    
    private renderExcludedFoldersList(container: HTMLElement): void {
        container.empty();
        
        if (this.plugin.settings.excludedFolders.length === 0) {
            container.createEl('div', {
                text: 'No folders excluded. All folders will be indexed.',
                cls: 'folders-list-empty'
            });
            return;
        }
        
        // Create list of excluded folders
        const foldersList = container.createEl('div', { cls: 'folders-list' });
        
        this.plugin.settings.excludedFolders.forEach((folder, index) => {
            const folderItem = foldersList.createDiv({ cls: 'folder-item' });
            
            // Folder icon and path
            const folderPath = folderItem.createDiv({ cls: 'folder-path' });
            folderPath.createEl('span', { text: '📁 ' });
            folderPath.createEl('code', { text: folder });
            
            // Check if folder exists
            const folderExists = this.checkFolderExists(folder);
            if (!folderExists) {
                folderPath.createEl('span', { 
                    text: ' (not found)',
                    cls: 'folder-not-found'
                });
            }
            
            // Actions
            const actions = folderItem.createDiv({ cls: 'folder-actions' });
            
            // Edit button
            const editBtn = actions.createEl('button', { text: '✏️' });
            editBtn.onclick = () => {
                this.openExcludedFolderModal(index);
            };
            
            // Delete button
            const deleteBtn = actions.createEl('button', { text: '🗑️' });
            deleteBtn.onclick = async () => {
                if (confirm(`Remove "${folder}" from excluded folders?`)) {
                    this.plugin.settings.excludedFolders.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.renderExcludedFoldersList(container);
                }
            };
        });
    }
    
    private renderIncludedFoldersList(container: HTMLElement): void {
        container.empty();
        
        if (this.plugin.settings.includedFolders.length === 0) {
            container.createEl('div', {
                text: 'No folders selected. Add folders to limit indexing scope.',
                cls: 'folders-list-empty'
            });
            return;
        }
        
        // Create list of included folders
        const foldersList = container.createEl('div', { cls: 'folders-list' });
        
        this.plugin.settings.includedFolders.forEach((folder, index) => {
            const folderItem = foldersList.createDiv({ cls: 'folder-item' });
            
            // Folder icon and path
            const folderPath = folderItem.createDiv({ cls: 'folder-path' });
            folderPath.createEl('span', { text: '📁 ' });
            folderPath.createEl('code', { text: folder });
            
            // Check if folder exists
            const folderExists = this.checkFolderExists(folder);
            if (!folderExists) {
                folderPath.createEl('span', { 
                    text: ' (not found)',
                    cls: 'folder-not-found'
                });
            }
            
            // Actions
            const actions = folderItem.createDiv({ cls: 'folder-actions' });
            
            // Edit button
            const editBtn = actions.createEl('button', { text: '✏️' });
            editBtn.onclick = () => {
                this.openIncludedFolderModal(index);
            };
            
            // Delete button
            const deleteBtn = actions.createEl('button', { text: '🗑️' });
            deleteBtn.onclick = async () => {
                if (confirm(`Remove "${folder}" from included folders?`)) {
                    this.plugin.settings.includedFolders.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.renderIncludedFoldersList(container);
                }
            };
        });
    }
    
    private checkFolderExists(folderPath: string): boolean {
        // Check if the folder exists in the vault
        const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
        return abstractFile !== null && 'children' in abstractFile;
    }
    
    private openExcludedFolderModal(index: number | null): void {
        new FolderSelectionModal(
            this.app,
            index !== null ? this.plugin.settings.excludedFolders[index] : null,
            'Select Folder to Exclude',
            async (folderPath) => {
                if (index !== null) {
                    // Edit existing
                    this.plugin.settings.excludedFolders[index] = folderPath;
                } else {
                    // Add new (avoid duplicates)
                    if (!this.plugin.settings.excludedFolders.includes(folderPath)) {
                        this.plugin.settings.excludedFolders.push(folderPath);
                    } else {
                        new Notice('This folder is already excluded');
                        return;
                    }
                }
                await this.plugin.saveSettings();
                this.display(); // Refresh the display
            }
        ).open();
    }
    
    private openIncludedFolderModal(index: number | null): void {
        new FolderSelectionModal(
            this.app,
            index !== null ? this.plugin.settings.includedFolders[index] : null,
            'Select Folder to Include',
            async (folderPath) => {
                if (index !== null) {
                    // Edit existing
                    this.plugin.settings.includedFolders[index] = folderPath;
                } else {
                    // Add new (avoid duplicates)
                    if (!this.plugin.settings.includedFolders.includes(folderPath)) {
                        this.plugin.settings.includedFolders.push(folderPath);
                    } else {
                        new Notice('This folder is already included');
                        return;
                    }
                }
                await this.plugin.saveSettings();
                this.display(); // Refresh the display
            }
        ).open();
    }

    private openDateFormatModal(index: number | null): void {
        new DateFormatModal(this.app, 
            index !== null ? this.plugin.settings.dateFormats[index] : null,
            async (format) => {
                if (index !== null) {
                    // Edit existing
                    this.plugin.settings.dateFormats[index] = format;
                } else {
                    // Add new
                    this.plugin.settings.dateFormats.push(format);
                }
                await this.plugin.saveSettings();
                this.display(); // Refresh the whole settings display
            }
        ).open();
    }

    private addExampleRules(): void {
        const exampleRules: Rule[] = [
            {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-1`,
                field: 'birthday',
                defaultTime: '09:00',
                offsets: ['-P1D', '-P7D'],  // 1 day and 1 week before
                repeat: 'yearly',
                messageTemplate: '🎂 {title}\'s birthday is tomorrow!',
                channels: ['obsidian', 'system'],
                enabled: true
            },
            {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-2`,
                field: 'due',
                defaultTime: '09:00',
                offsets: ['-PT30M', '-P1D'],  // 30 minutes and 1 day before
                repeat: 'none',
                messageTemplate: '⏰ Task due: {title} on {date}',
                channels: ['obsidian'],
                enabled: true
            },
            {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-3`,
                field: 'meeting',
                defaultTime: undefined,  // Use time from the date itself
                offsets: ['-PT15M'],  // 15 minutes before
                repeat: 'none',
                messageTemplate: '📅 Meeting reminder: {title} in 15 minutes',
                channels: ['obsidian', 'system'],
                enabled: true
            },
            {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-4`,
                field: 'anniversary',
                defaultTime: '10:00',
                offsets: ['-P1W', '-P1D'],  // 1 week and 1 day before
                repeat: 'yearly',
                messageTemplate: '💍 Anniversary reminder: {title} - {date}',
                channels: ['obsidian'],
                enabled: true
            }
        ];

        // Add example rules to settings (avoid duplicates)
        exampleRules.forEach(exampleRule => {
            const exists = this.plugin.settings.rules.some(r => r.field === exampleRule.field);
            if (!exists) {
                this.plugin.settings.rules.push(exampleRule);
            }
        });
    }
}

/**
 * Modal for editing notification rules
 */
class RuleEditorModal extends Modal {
    private rule: Rule;
    private onSave: (rule: Rule) => void;
    private offsetInputs: TextComponent[] = [];

    constructor(app: App, rule: Rule | null, onSave: (rule: Rule) => void) {
        super(app);
        this.onSave = onSave;
        this.rule = rule || this.createNewRule();
    }

    private createNewRule(): Rule {
        return {
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
            field: '',
            defaultTime: '09:00',
            offsets: [],
            repeat: 'none',
            messageTemplate: '',
            channels: ['obsidian'],
            enabled: true
        };
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.rule.field ? `Edit Rule: ${this.rule.field}` : 'New Notification Rule' });

        // Field/Tag
        new Setting(contentEl)
            .setName('Field/Tag')
            .setDesc('The frontmatter field or tag to watch (e.g., "birthday", "due")')
            .addText(text => text
                .setPlaceholder('birthday')
                .setValue(this.rule.field)
                .onChange(value => {
                    this.rule.field = value;
                }));

        // Default Time
        new Setting(contentEl)
            .setName('Default time')
            .setDesc('Time to send notifications (HH:MM format)')
            .addText(text => text
                .setPlaceholder('09:00')
                .setValue(this.rule.defaultTime || '')
                .onChange(value => {
                    this.rule.defaultTime = value;
                }));

        // Offsets
        const offsetsSetting = new Setting(contentEl)
            .setName('Offsets')
            .setDesc('ISO 8601 durations for notification timing (e.g., "-P1D" for 1 day before)');
        
        const offsetsContainer = offsetsSetting.settingEl.createDiv({ cls: 'offsets-container' });
        this.renderOffsets(offsetsContainer);

        // Repeat Pattern
        new Setting(contentEl)
            .setName('Repeat')
            .setDesc('How often to repeat the notification')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'None')
                .addOption('daily', 'Daily')
                .addOption('weekly', 'Weekly')
                .addOption('monthly', 'Monthly')
                .addOption('yearly', 'Yearly')
                .setValue(this.rule.repeat)
                .onChange((value: RepeatPattern) => {
                    this.rule.repeat = value;
                }));

        // Message Template
        const messageTemplateSetting = new Setting(contentEl)
            .setName('Message template')
            .setDesc('Notification message. Use placeholders: {title}, {field}, {date}, {path}');
        
        // Add examples section
        const examplesContainer = messageTemplateSetting.settingEl.createDiv({ cls: 'message-template-examples' });
        examplesContainer.style.marginBottom = '10px';
        
        const examplesTitle = examplesContainer.createEl('div', { 
            text: '📝 Template Examples (click to use):',
            cls: 'setting-item-description'
        });
        examplesTitle.style.marginBottom = '8px';
        examplesTitle.style.fontWeight = '500';
        
        const examples = [
            { template: '🎂 {title}\'s birthday is coming!', desc: 'Birthday reminder' },
            { template: '⏰ Task due: {title} on {date}', desc: 'Task deadline' },
            { template: '📅 Meeting reminder: {title}', desc: 'Meeting notification' },
            { template: '💍 Anniversary: {title} - {date}', desc: 'Anniversary' },
            { template: '🔔 Reminder: {field} for {title}', desc: 'Generic reminder' },
            { template: '📌 Don\'t forget: {title} ({field})', desc: 'Simple alert' },
            { template: '⚠️ Deadline approaching: {title}', desc: 'Urgent deadline' },
            { template: '🎯 Goal check: {title} - Review progress', desc: 'Goal review' }
        ];
        
        const examplesList = examplesContainer.createEl('div', { cls: 'template-examples-list' });
        examplesList.style.display = 'grid';
        examplesList.style.gridTemplateColumns = 'repeat(2, 1fr)';
        examplesList.style.gap = '4px';
        
        examples.forEach(example => {
            const exampleItem = examplesList.createEl('div', { 
                cls: 'template-example-item'
            });
            exampleItem.style.padding = '4px 8px';
            exampleItem.style.backgroundColor = 'var(--background-secondary)';
            exampleItem.style.borderRadius = '4px';
            exampleItem.style.cursor = 'pointer';
            exampleItem.style.fontSize = '0.85em';
            
            const exampleText = exampleItem.createEl('code', { text: example.template });
            exampleText.style.display = 'block';
            exampleText.style.marginBottom = '2px';
            
            const exampleDesc = exampleItem.createEl('span', { 
                text: example.desc,
                cls: 'template-example-desc'
            });
            exampleDesc.style.color = 'var(--text-muted)';
            exampleDesc.style.fontSize = '0.9em';
            
            exampleItem.addEventListener('mouseenter', () => {
                exampleItem.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            
            exampleItem.addEventListener('mouseleave', () => {
                exampleItem.style.backgroundColor = 'var(--background-secondary)';
            });
            
            exampleItem.addEventListener('click', () => {
                // Set the template in the text area
                const textArea = messageTemplateSetting.settingEl.querySelector('textarea');
                if (textArea) {
                    (textArea as HTMLTextAreaElement).value = example.template;
                    this.rule.messageTemplate = example.template;
                    
                    // Flash to indicate selection
                    exampleItem.style.backgroundColor = 'var(--interactive-accent)';
                    setTimeout(() => {
                        exampleItem.style.backgroundColor = 'var(--background-secondary)';
                    }, 200);
                }
            });
        });
        
        // Add placeholder guide
        const placeholderGuide = examplesContainer.createEl('div', { cls: 'placeholder-guide' });
        placeholderGuide.style.marginTop = '10px';
        placeholderGuide.style.padding = '8px';
        placeholderGuide.style.backgroundColor = 'var(--background-primary-alt)';
        placeholderGuide.style.borderRadius = '4px';
        placeholderGuide.style.fontSize = '0.85em';
        
        placeholderGuide.innerHTML = `
            <strong>Available Placeholders:</strong><br>
            <span style="font-family: var(--font-monospace);">
            • <code>{title}</code> - Note title or filename<br>
            • <code>{field}</code> - Field/tag name (e.g., "birthday", "due")<br>
            • <code>{date}</code> - The original date from the note<br>
            • <code>{path}</code> - Full path to the note<br>
            </span>
            <br>
            <em style="color: var(--text-muted);">💡 Tip: Use emojis to make notifications more visual!</em>
        `;
        
        messageTemplateSetting.addTextArea(text => text
            .setPlaceholder('Type your message or click an example above...')
            .setValue(this.rule.messageTemplate)
            .onChange(value => {
                this.rule.messageTemplate = value;
            }));

        // Channels
        new Setting(contentEl)
            .setName('Notification channels')
            .setDesc('Where to send notifications');
        
        const channelContainer = contentEl.createDiv({ cls: 'channels-container' });
        
        const obsidianToggle = channelContainer.createEl('label');
        const obsidianCheckbox = obsidianToggle.createEl('input', { type: 'checkbox' });
        obsidianCheckbox.checked = this.rule.channels.includes('obsidian');
        obsidianCheckbox.onchange = () => this.updateChannels();
        obsidianToggle.createSpan({ text: ' Obsidian (in-app)' });
        
        const systemToggle = channelContainer.createEl('label');
        systemToggle.style.marginLeft = '20px';
        const systemCheckbox = systemToggle.createEl('input', { type: 'checkbox' });
        systemCheckbox.checked = this.rule.channels.includes('system');
        systemCheckbox.onchange = () => this.updateChannels();
        systemToggle.createSpan({ text: ' System notifications' });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.onclick = () => this.close();
        
        const saveButton = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveButton.onclick = () => this.save();
    }

    private renderOffsets(container: HTMLElement): void {
        container.empty();
        
        this.rule.offsets.forEach((offset, index) => {
            const offsetDiv = container.createDiv({ cls: 'offset-item' });
            
            const input = new TextComponent(offsetDiv)
                .setPlaceholder('-P1D')
                .setValue(offset);
            
            input.onChange(value => {
                this.rule.offsets[index] = value;
            });
            
            const removeBtn = offsetDiv.createEl('button', { text: '×' });
            removeBtn.onclick = () => {
                this.rule.offsets.splice(index, 1);
                this.renderOffsets(container);
            };
        });
        
        const addBtn = container.createEl('button', { text: '+ Add offset' });
        addBtn.onclick = () => {
            this.rule.offsets.push('');
            this.renderOffsets(container);
        };
    }

    private updateChannels(): void {
        const checkboxes = this.contentEl.querySelectorAll('.channels-container input[type="checkbox"]');
        const channels: NotificationChannel[] = [];
        
        checkboxes.forEach((checkbox: HTMLInputElement, index) => {
            if (checkbox.checked) {
                channels.push(index === 0 ? 'obsidian' : 'system');
            }
        });
        
        this.rule.channels = channels;
    }

    private save(): void {
        // Validate
        const errors = RuleValidator.validateRule(this.rule);
        if (errors.length > 0) {
            alert('Validation errors:\n' + errors.join('\n'));
            return;
        }
        
        this.onSave(this.rule);
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for selecting folders
 */
class FolderSelectionModal extends Modal {
    private folderPath: string;
    private onSave: (folderPath: string) => void;
    private title: string;

    constructor(app: App, folderPath: string | null, title: string, onSave: (folderPath: string) => void) {
        super(app);
        this.folderPath = folderPath || '';
        this.title = title;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.title });

        // Manual path input
        const pathSetting = new Setting(contentEl)
            .setName('Folder path')
            .setDesc('Enter the folder path (e.g., "templates" or "folder/subfolder")');
            
        let pathInput: TextComponent;
        pathSetting.addText(text => {
            pathInput = text;
            text.setPlaceholder('folder/path')
                .setValue(this.folderPath)
                .onChange(value => {
                    this.folderPath = value;
                    this.updatePreview();
                });
        });

        // Folder picker from vault
        const folderListDiv = contentEl.createDiv({ cls: 'folder-picker' });
        folderListDiv.createEl('div', { 
            text: 'Or select from your vault:',
            cls: 'setting-item-description'
        });
        
        // Get all folders in the vault
        const folders = this.getAllFolders();
        
        // Create scrollable list
        const folderList = folderListDiv.createDiv({ cls: 'folder-picker-list' });
        folderList.style.maxHeight = '300px';
        folderList.style.overflowY = 'auto';
        folderList.style.border = '1px solid var(--background-modifier-border)';
        folderList.style.borderRadius = '4px';
        folderList.style.padding = '8px';
        folderList.style.marginTop = '8px';
        
        if (folders.length === 0) {
            folderList.createEl('div', {
                text: 'No folders found in vault',
                cls: 'folder-picker-empty'
            });
        } else {
            folders.forEach(folder => {
                const folderItem = folderList.createDiv({ cls: 'folder-picker-item' });
                folderItem.style.padding = '4px 8px';
                folderItem.style.cursor = 'pointer';
                folderItem.style.borderRadius = '3px';
                
                // Indent based on depth
                const depth = folder.split('/').length - 1;
                folderItem.style.paddingLeft = `${8 + depth * 16}px`;
                
                // Folder icon and name
                folderItem.createEl('span', { text: '📁 ' });
                folderItem.createEl('code', { text: folder });
                
                // Highlight if selected
                if (folder === this.folderPath) {
                    folderItem.style.backgroundColor = 'var(--interactive-accent)';
                    folderItem.style.color = 'var(--text-on-accent)';
                }
                
                // Hover effect
                folderItem.addEventListener('mouseenter', () => {
                    if (folder !== this.folderPath) {
                        folderItem.style.backgroundColor = 'var(--background-modifier-hover)';
                    }
                });
                
                folderItem.addEventListener('mouseleave', () => {
                    if (folder !== this.folderPath) {
                        folderItem.style.backgroundColor = '';
                    }
                });
                
                // Click to select
                folderItem.addEventListener('click', () => {
                    this.folderPath = folder;
                    pathInput.setValue(folder);
                    this.updateFolderSelection(folderList, folder);
                });
            });
        }

        // Preview
        const previewDiv = contentEl.createDiv({ cls: 'folder-preview' });
        previewDiv.style.marginTop = '15px';
        previewDiv.style.padding = '10px';
        previewDiv.style.backgroundColor = 'var(--background-secondary)';
        previewDiv.style.borderRadius = '4px';
        this.previewDiv = previewDiv;
        this.updatePreview();

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.marginTop = '20px';
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.onclick = () => this.close();
        
        const saveButton = buttonContainer.createEl('button', { 
            text: 'Save', 
            cls: 'mod-cta' 
        });
        saveButton.onclick = () => {
            if (!this.folderPath.trim()) {
                new Notice('Please enter a folder path');
                return;
            }
            this.onSave(this.folderPath.trim());
            this.close();
        };
    }

    private previewDiv: HTMLElement;

    private updatePreview(): void {
        if (!this.previewDiv) return;
        
        if (this.folderPath) {
            const exists = this.checkFolderExists(this.folderPath);
            this.previewDiv.innerHTML = `
                <strong>Selected:</strong> <code>${this.folderPath}</code><br>
                <span style="color: ${exists ? 'var(--text-success)' : 'var(--text-error)'};">
                ${exists ? '✓ Folder exists' : '⚠️ Folder not found (will be created if needed)'}
                </span>
            `;
        } else {
            this.previewDiv.innerHTML = '<em>No folder selected</em>';
        }
    }

    private updateFolderSelection(container: HTMLElement, selectedFolder: string): void {
        // Update visual selection
        container.querySelectorAll('.folder-picker-item').forEach(item => {
            const codeEl = item.querySelector('code');
            if (codeEl && codeEl.textContent === selectedFolder) {
                (item as HTMLElement).style.backgroundColor = 'var(--interactive-accent)';
                (item as HTMLElement).style.color = 'var(--text-on-accent)';
            } else {
                (item as HTMLElement).style.backgroundColor = '';
                (item as HTMLElement).style.color = '';
            }
        });
        this.updatePreview();
    }

    private getAllFolders(): string[] {
        const folders: string[] = [];
        const rootFolder = this.app.vault.getRoot();
        
        const collectFolders = (folder: any, path: string = '') => {
            if (folder.children) {
                folder.children.forEach((child: any) => {
                    if (child.children !== undefined) { // It's a folder
                        const folderPath = path ? `${path}/${child.name}` : child.name;
                        folders.push(folderPath);
                        collectFolders(child, folderPath);
                    }
                });
            }
        };
        
        collectFolders(rootFolder);
        return folders.sort();
    }

    private checkFolderExists(folderPath: string): boolean {
        const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
        return abstractFile !== null && 'children' in abstractFile;
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal for adding/editing date formats
 */
class DateFormatModal extends Modal {
    private format: string;
    private onSave: (format: string) => void;

    constructor(app: App, format: string | null, onSave: (format: string) => void) {
        super(app);
        this.format = format || '';
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.format ? 'Edit Date Format' : 'Add Date Format' });

        // Format input
        const formatSetting = new Setting(contentEl)
            .setName('Date format')
            .setDesc('Enter a date format pattern (e.g., yyyy-MM-dd)');
            
        let formatInput: TextComponent;
        formatSetting.addText(text => {
            formatInput = text;
            text.setPlaceholder('yyyy-MM-dd')
                .setValue(this.format)
                .onChange(value => {
                    this.format = value;
                    this.updatePreview();
                });
        });

        // Live preview
        const previewDiv = contentEl.createDiv({ cls: 'date-format-preview' });
        previewDiv.style.marginTop = '10px';
        previewDiv.style.padding = '10px';
        previewDiv.style.backgroundColor = 'var(--background-secondary)';
        previewDiv.style.borderRadius = '4px';
        
        const updatePreview = () => {
            const now = new Date();
            const year = now.getFullYear().toString();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            
            const preview = this.format
                .replace(/yyyy/g, year)
                .replace(/MM/g, month)
                .replace(/dd/g, day)
                .replace(/HH/g, hours)
                .replace(/mm/g, minutes);
            
            previewDiv.innerHTML = `
                <strong>Preview:</strong> ${preview || '(enter a format)'}<br>
                <span style="color: var(--text-muted); font-size: 0.9em;">
                Current date/time: ${now.toLocaleString()}
                </span>
            `;
        };
        
        this.updatePreview = updatePreview;
        updatePreview();

        // Quick format buttons
        const quickFormatsDiv = contentEl.createDiv({ cls: 'date-format-quick' });
        quickFormatsDiv.style.marginTop = '15px';
        
        quickFormatsDiv.createEl('div', { 
            text: 'Quick formats (click to use):',
            cls: 'setting-item-description'
        });
        
        const quickFormats = [
            { format: 'yyyy-MM-dd', desc: 'ISO date' },
            { format: 'dd.MM.yyyy', desc: 'European' },
            { format: 'MM/dd/yyyy', desc: 'US format' },
            { format: 'yyyy-MM-dd HH:mm', desc: 'Date + time' },
            { format: 'dd/MM/yyyy', desc: 'UK format' },
            { format: 'yyyy/MM/dd', desc: 'Japanese' }
        ];
        
        const buttonsContainer = quickFormatsDiv.createDiv();
        buttonsContainer.style.display = 'grid';
        buttonsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        buttonsContainer.style.gap = '5px';
        buttonsContainer.style.marginTop = '5px';
        
        quickFormats.forEach(qf => {
            const btn = buttonsContainer.createEl('button', { 
                cls: 'date-format-quick-btn'
            });
            btn.style.padding = '4px 8px';
            btn.style.fontSize = '0.85em';
            
            const codeSpan = btn.createEl('code', { text: qf.format });
            codeSpan.style.display = 'block';
            
            const descSpan = btn.createEl('span', { text: qf.desc });
            descSpan.style.display = 'block';
            descSpan.style.fontSize = '0.9em';
            descSpan.style.color = 'var(--text-muted)';
            
            btn.onclick = () => {
                this.format = qf.format;
                formatInput.setValue(qf.format);
                updatePreview();
            };
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.marginTop = '20px';
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.onclick = () => this.close();
        
        const saveButton = buttonContainer.createEl('button', { 
            text: 'Save', 
            cls: 'mod-cta' 
        });
        saveButton.onclick = () => {
            if (!this.format.trim()) {
                new Notice('Please enter a date format');
                return;
            }
            this.onSave(this.format.trim());
            this.close();
        };
    }

    private updatePreview: () => void = () => {};

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
