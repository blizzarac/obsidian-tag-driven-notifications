/**
 * Logger utility for Tag-Driven Notifications Plugin
 * Production logging - minimal console output
 */

export class Logger {
    /**
     * Log debug messages (disabled in production)
     */
    static debug(message: string, ...args: any[]): void {
        // Debug messages are disabled in production to keep console clean
        // Developers can uncomment the line below for debugging:
        // console.log(`[Tag-Driven Notifications] ${message}`, ...args);
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
