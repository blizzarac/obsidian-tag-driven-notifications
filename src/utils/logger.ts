/**
 * Logger utility for Tag-Driven Notifications Plugin
 * Controls console output based on debug mode setting
 */

import { NotificationPluginSettings } from '../models/types';

export class Logger {
    private static settings: NotificationPluginSettings | null = null;

    static setSettings(settings: NotificationPluginSettings): void {
        Logger.settings = settings;
    }

    /**
     * Log debug messages (only shown when debug mode is enabled)
     */
    static debug(message: string, ...args: any[]): void {
        if (Logger.settings?.debugMode) {
            console.log(`[Tag-Driven Notifications] ${message}`, ...args);
        }
    }

    /**
     * Log error messages (always shown)
     */
    static error(message: string, error?: any): void {
        if (error) {
            console.error(`[Tag-Driven Notifications] ERROR: ${message}`, error);
        } else {
            console.error(`[Tag-Driven Notifications] ERROR: ${message}`);
        }
    }

    /**
     * Log warning messages (always shown)
     */
    static warn(message: string, ...args: any[]): void {
        console.warn(`[Tag-Driven Notifications] WARNING: ${message}`, ...args);
    }

    /**
     * Log important info messages (always shown, but minimal)
     */
    static info(message: string): void {
        console.log(`[Tag-Driven Notifications] ${message}`);
    }
}