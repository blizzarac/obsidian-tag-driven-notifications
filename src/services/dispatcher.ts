/**
 * Notification dispatcher for firing scheduled notifications
 */

import { Notice, App } from 'obsidian';
import { ScheduledOccurrence, NotificationChannel, NotificationPluginSettings } from '../models/types';
import { ScheduleGenerator } from './scheduler';

export class NotificationDispatcher {
    private app: App;
    private scheduler: ScheduleGenerator;
    private settings: NotificationPluginSettings;
    private checkInterval: number | null = null;
    private isPaused: boolean = false;
    private checkIntervalMs: number = 30000; // Check every 30 seconds

    constructor(app: App, scheduler: ScheduleGenerator, settings: NotificationPluginSettings) {
        this.app = app;
        this.scheduler = scheduler;
        this.settings = settings;
    }

    /**
     * Start the dispatcher
     */
    start(): void {
        if (this.checkInterval) {
            return; // Already running
        }

        console.log('Starting notification dispatcher...');
        this.checkInterval = window.setInterval(() => {
            if (!this.isPaused) {
                this.checkAndFireNotifications();
            }
        }, this.checkIntervalMs);

        // Check immediately on start
        this.checkAndFireNotifications();
    }

    /**
     * Stop the dispatcher
     */
    stop(): void {
        if (this.checkInterval) {
            window.clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('Notification dispatcher stopped');
        }
    }

    /**
     * Pause notifications
     */
    pause(): void {
        this.isPaused = true;
        console.log('Notifications paused');
    }

    /**
     * Resume notifications
     */
    resume(): void {
        this.isPaused = false;
        console.log('Notifications resumed');
        // Check immediately after resuming
        this.checkAndFireNotifications();
    }

    /**
     * Check if paused
     */
    isPausedStatus(): boolean {
        return this.isPaused;
    }

    /**
     * Check and fire due notifications
     */
    private checkAndFireNotifications(): void {
        const dueOccurrences = this.scheduler.getDueOccurrences();
        
        for (const occurrence of dueOccurrences) {
            this.fireNotification(occurrence);
            this.scheduler.markAsFired(occurrence.id);
        }
    }

    /**
     * Fire a single notification
     */
    fireNotification(occurrence: ScheduledOccurrence): void {
        for (const channel of occurrence.channels) {
            switch (channel) {
                case 'obsidian':
                    this.fireObsidianNotification(occurrence);
                    break;
                case 'system':
                    this.fireSystemNotification(occurrence);
                    break;
            }
        }

        console.log(`Fired notification: ${occurrence.message}`);
    }

    /**
     * Fire an Obsidian in-app notification
     */
    private fireObsidianNotification(occurrence: ScheduledOccurrence): void {
        // Determine timeout based on settings
        let timeout: number;
        if (this.settings.persistentNotifications) {
            // If persistent notifications are enabled
            if (this.settings.notificationTimeout === 0) {
                // 0 means infinite (Obsidian uses 0 for persistent)
                timeout = 0;
            } else {
                // Use configured timeout in milliseconds
                timeout = (this.settings.notificationTimeout || 10) * 1000;
            }
        } else {
            // Default 10 seconds if not persistent
            timeout = 10000;
        }
        
        // Create clickable notice with configured timeout
        const notice = new Notice(occurrence.message, timeout);
        
        // Customize the notice element
        if ((notice as any).noticeEl) {
            const noticeEl = (notice as any).noticeEl;
            
            // Add container for content and buttons
            noticeEl.empty();
            noticeEl.addClass('notification-with-actions');
            
            // Create message container
            const messageContainer = noticeEl.createDiv({ cls: 'notification-message' });
            messageContainer.setText(occurrence.message);
            
            // Create actions container
            const actionsContainer = noticeEl.createDiv({ cls: 'notification-actions' });
            
            // Add "Open Note" button if there's a note path
            if (occurrence.notePath) {
                const openButton = actionsContainer.createEl('button', {
                    text: '📄 Open',
                    cls: 'notification-btn notification-btn-open'
                });
                openButton.onclick = async (e: MouseEvent) => {
                    e.stopPropagation();
                    const file = this.app.vault.getAbstractFileByPath(occurrence.notePath);
                    if (file) {
                        await this.app.workspace.openLinkText(occurrence.notePath, '', false);
                    }
                    notice.hide();
                };
            }
            
            // Add dismiss button
            const dismissButton = actionsContainer.createEl('button', {
                text: '✕ Dismiss',
                cls: 'notification-btn notification-btn-dismiss'
            });
            dismissButton.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                notice.hide();
            };
            
            // Make the whole notification clickable (except buttons)
            messageContainer.addClass('notification-clickable');
            messageContainer.onclick = async () => {
                if (occurrence.notePath) {
                    const file = this.app.vault.getAbstractFileByPath(occurrence.notePath);
                    if (file) {
                        await this.app.workspace.openLinkText(occurrence.notePath, '', false);
                    }
                }
            };
            
            // Add a visual indicator if it's a persistent notification
            if (timeout === 0) {
                noticeEl.addClass('persistent-notification');
            }
        }
    }

    /**
     * Fire a system notification
     */
    private fireSystemNotification(occurrence: ScheduledOccurrence): void {
        // Check if browser notifications are supported and permitted
        if (!('Notification' in window)) {
            console.log('Browser does not support notifications');
            return;
        }

        if (Notification.permission === 'granted') {
            this.showSystemNotification(occurrence);
        } else if (Notification.permission !== 'denied') {
            // Request permission
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showSystemNotification(occurrence);
                }
            });
        }
    }

    /**
     * Show system notification
     */
    private showSystemNotification(occurrence: ScheduledOccurrence): void {
        const notification = new Notification('Obsidian Reminder', {
            body: occurrence.message,
            icon: 'app://obsidian.md/icon.png',
            tag: occurrence.id,
            requireInteraction: true
        });

        // Handle click - focus Obsidian and open note
        notification.onclick = async () => {
            window.focus();
            const file = this.app.vault.getAbstractFileByPath(occurrence.notePath);
            if (file) {
                await this.app.workspace.openLinkText(occurrence.notePath, '', false);
            }
            notification.close();
        };

        // Auto-close after 30 seconds
        setTimeout(() => {
            notification.close();
        }, 30000);
    }

    /**
     * Test fire a notification (for preview/testing)
     */
    testFireNotification(message: string, channels: NotificationChannel[]): void {
        const testOccurrence: ScheduledOccurrence = {
            id: 'test',
            ruleId: 'test',
            ruleField: 'test',
            notePath: '',
            noteTitle: 'Test Note',
            originalDate: new Date().toISOString(),
            fireTime: new Date().toISOString(),
            message,
            channels,
            fired: false,
            createdAt: new Date().toISOString()
        };

        this.fireNotification(testOccurrence);
    }

    /**
     * Request system notification permission
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    }

    /**
     * Get notification permission status
     */
    getNotificationPermissionStatus(): string {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    /**
     * Update settings reference
     */
    updateSettings(settings: NotificationPluginSettings): void {
        this.settings = settings;
    }
}
