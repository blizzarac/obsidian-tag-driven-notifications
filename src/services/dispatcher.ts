/**
 * Notification dispatcher for firing scheduled notifications
 */

import { Notice, App } from 'obsidian';
import { ScheduledOccurrence, NotificationChannel } from '../models/types';
import { ScheduleGenerator } from './scheduler';

export class NotificationDispatcher {
    private app: App;
    private scheduler: ScheduleGenerator;
    private checkInterval: number | null = null;
    private isPaused: boolean = false;
    private checkIntervalMs: number = 30000; // Check every 30 seconds

    constructor(app: App, scheduler: ScheduleGenerator) {
        this.app = app;
        this.scheduler = scheduler;
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
        // Create clickable notice that opens the note
        const notice = new Notice(occurrence.message, 10000); // Show for 10 seconds
        
        // Add click handler to open the note
        (notice as any).noticeEl?.addEventListener('click', async () => {
            const file = this.app.vault.getAbstractFileByPath(occurrence.notePath);
            if (file) {
                await this.app.workspace.openLinkText(occurrence.notePath, '', false);
            }
        });

        // Add styling to make it look clickable
        if ((notice as any).noticeEl) {
            (notice as any).noticeEl.style.cursor = 'pointer';
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
}