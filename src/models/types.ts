/**
 * Core data models for Tag-Driven Notifications plugin
 */

/**
 * Repeat patterns for notifications
 */
export type RepeatPattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Notification channels
 */
export type NotificationChannel = 'obsidian' | 'system';

/**
 * A notification rule configuration
 */
export interface Rule {
    id: string;
    field: string;               // e.g., "birthday", "due", "anniversary"
    defaultTime?: string;        // e.g., "09:00"
    offsets: string[];          // ISO 8601 durations, e.g., ["-P1D", "-PT30M"]
    repeat: RepeatPattern;
    messageTemplate: string;     // e.g., "🎂 {title}'s birthday"
    channels: NotificationChannel[];
    enabled: boolean;
}

/**
 * A scheduled notification occurrence
 */
export interface ScheduledOccurrence {
    id: string;
    ruleId: string;
    ruleField: string;
    notePath: string;
    noteTitle: string;
    originalDate: string;        // Original date from the note
    fireTime: string;           // ISO datetime when to fire
    message: string;            // Resolved message
    channels: NotificationChannel[];
    fired: boolean;
    createdAt: string;
}

/**
 * Date extraction result from a note
 */
export interface ExtractedDate {
    field: string;              // Field/tag name
    value: string;              // ISO date string
    source: 'frontmatter' | 'inline-tag';
    rawValue: string;           // Original value from note
}

/**
 * Note index entry
 */
export interface NoteIndex {
    path: string;
    title: string;
    dates: ExtractedDate[];
    lastModified: number;
}

/**
 * Vault index
 */
export interface VaultIndex {
    notes: Map<string, NoteIndex>;
    lastIndexed: number;
}

/**
 * Plugin settings
 */
export interface NotificationPluginSettings {
    rules: Rule[];
    defaultNotificationTime: string;  // Default time if not specified in rule
    timezoneOverride?: string;       // Optional timezone override
    dateFormats: string[];           // Date parsing formats
    indexingScope: 'entire-vault' | 'selected-folders';
    includedFolders: string[];       // For selected-folders scope
    excludedFolders: string[];       // Folders to exclude
    excludedTags: string[];          // Tags to ignore
    privacyMode: boolean;            // Don't save schedule to disk
    notificationsPaused: boolean;
    persistentNotifications: boolean; // Keep notifications visible until dismissed
    notificationTimeout?: number;     // Timeout in seconds (0 = infinite)
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: NotificationPluginSettings = {
    rules: [],
    defaultNotificationTime: '09:00',
    timezoneOverride: undefined,
    dateFormats: ['yyyy-MM-dd', 'dd.MM.yyyy', 'MM/dd/yyyy'],
    indexingScope: 'entire-vault',
    includedFolders: [],
    excludedFolders: ['templates', 'archive'],
    excludedTags: [],
    privacyMode: false,
    notificationsPaused: false,
    persistentNotifications: false,
    notificationTimeout: 10  // Default 10 seconds, 0 for infinite
};

/**
 * Template variable context
 */
export interface TemplateContext {
    title: string;      // Note title
    field: string;      // Field/tag name
    date: string;       // Formatted date
    path: string;       // Note path
}

/**
 * Validation helpers
 */
export class RuleValidator {
    static isValidTime(time: string): boolean {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
    }

    static isValidISO8601Duration(duration: string): boolean {
        // Basic ISO 8601 duration validation
        return /^[+-]?P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(duration);
    }

    static isValidField(field: string): boolean {
        // Field must be alphanumeric with dashes/underscores
        return /^[a-zA-Z0-9_-]+$/.test(field) && field.length > 0;
    }

    static validateRule(rule: Rule): string[] {
        const errors: string[] = [];

        if (!rule.field || !this.isValidField(rule.field)) {
            errors.push('Invalid field name');
        }

        if (rule.defaultTime && !this.isValidTime(rule.defaultTime)) {
            errors.push('Invalid default time format (use HH:MM)');
        }

        for (const offset of rule.offsets) {
            if (!this.isValidISO8601Duration(offset)) {
                errors.push(`Invalid ISO 8601 duration: ${offset}`);
            }
        }

        if (!rule.messageTemplate || rule.messageTemplate.trim().length === 0) {
            errors.push('Message template cannot be empty');
        }

        if (rule.channels.length === 0) {
            errors.push('At least one notification channel must be selected');
        }

        return errors;
    }
}