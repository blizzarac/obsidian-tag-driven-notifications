/**
 * Tag-Driven Notifications Plugin for Obsidian
 */

import { Plugin, Notice, TFile, Menu } from 'obsidian';
import { NotificationPluginSettings, DEFAULT_SETTINGS, ScheduledOccurrence } from './src/models/types';
import { VaultIndexer } from './src/services/indexer';
import { ScheduleGenerator } from './src/services/scheduler';
import { NotificationDispatcher } from './src/services/dispatcher';
import { NotificationSettingsTab } from './src/ui/settings-tab';
import { UpcomingNotificationsModal } from './src/ui/upcoming-modal';

export default class TagDrivenNotificationsPlugin extends Plugin {
    settings: NotificationPluginSettings;
    private indexer: VaultIndexer;
    private scheduler: ScheduleGenerator;
    private dispatcher: NotificationDispatcher;
    private ribbonIconEl: HTMLElement | null = null;
    private statusBarItem: HTMLElement | null = null;
    private isInitializing: boolean = true;
    private rebuildDebounceTimer: NodeJS.Timeout | null = null;

    async onload() {
        try {
            console.log('Loading Tag-Driven Notifications plugin');

            // Load settings
            await this.loadSettings();

            // Initialize services
            this.indexer = new VaultIndexer(this.app, this.settings);
            this.scheduler = new ScheduleGenerator();
            this.dispatcher = new NotificationDispatcher(this.app, this.scheduler, this.settings);

            // Load saved schedule if not in privacy mode
            if (!this.settings.privacyMode) {
                await this.loadSchedule();
            }

            // Register event handlers
            this.registerEventHandlers();

            // Register commands
            this.registerCommands();

            // Add ribbon icon
            this.setupRibbonIcon();

            // Add status bar item
            this.setupStatusBar();

            // Add settings tab
            this.addSettingTab(new NotificationSettingsTab(this.app, this));

            // Initial indexing and schedule build
            this.app.workspace.onLayoutReady(async () => {
                try {
                    console.log('Tag-Driven Notifications: Workspace ready, performing initial index...');
                    
                    // Always perform initial indexing on plugin load
                    await this.indexer.indexVault();
                    
                    // Build schedule from indexed data
                    await this.rebuildSchedule();
                    
                    // Start dispatcher
                    this.dispatcher.start();
                    
                    // Set paused state from settings
                    if (this.settings.notificationsPaused) {
                        this.dispatcher.pause();
                    }
                    
                    // Mark initialization as complete AFTER everything is done
                    setTimeout(() => {
                        this.isInitializing = false;
                        console.log('Tag-Driven Notifications: Initialization complete, file watching enabled');
                    }, 2000); // Wait 2 seconds before enabling file watching
                    
                    console.log('Tag-Driven Notifications: Initial setup complete');
                } catch (error) {
                    console.error('Tag-Driven Notifications: Error during initial setup:', error);
                    new Notice('Tag-Driven Notifications: Error during startup. Check console.');
                    this.isInitializing = false; // Ensure we exit initialization mode even on error
                }
            });

            console.log('Tag-Driven Notifications plugin loaded');
        } catch (error) {
            console.error('Tag-Driven Notifications: Fatal error during plugin load:', error);
            new Notice('Tag-Driven Notifications failed to load. Please check the console.');
        }
    }

    onunload() {
        console.log('Unloading Tag-Driven Notifications plugin');
        
        // Stop dispatcher
        this.dispatcher.stop();
        
        // Save schedule if not in privacy mode
        if (!this.settings.privacyMode) {
            this.saveSchedule();
        }
    }

    private registerEventHandlers(): void {
        // Watch for file changes
        this.registerEvent(
            this.app.vault.on('modify', async (file: TFile) => {
                if (this.isInitializing) return; // Skip during initialization
                if (file.extension === 'md') {
                    await this.indexer.updateFileIndex(file);
                    this.debouncedRebuildSchedule();
                }
            })
        );

        // Watch for file creation
        this.registerEvent(
            this.app.vault.on('create', async (file: TFile) => {
                if (this.isInitializing) return; // Skip during initialization
                if (file.extension === 'md') {
                    await this.indexer.updateFileIndex(file);
                    this.debouncedRebuildSchedule();
                }
            })
        );

        // Watch for file deletion
        this.registerEvent(
            this.app.vault.on('delete', async (file: TFile) => {
                if (this.isInitializing) return; // Skip during initialization
                this.indexer.removeFileFromIndex(file.path);
                this.debouncedRebuildSchedule();
            })
        );

        // Watch for file rename
        this.registerEvent(
            this.app.vault.on('rename', async (file: TFile, oldPath: string) => {
                if (this.isInitializing) return; // Skip during initialization
                this.indexer.removeFileFromIndex(oldPath);
                if (file.extension === 'md') {
                    await this.indexer.updateFileIndex(file);
                    this.debouncedRebuildSchedule();
                }
            })
        );

        // Watch for metadata cache changes - MOST LIKELY CULPRIT FOR LOOPS
        this.registerEvent(
            this.app.metadataCache.on('changed', async (file: TFile) => {
                if (this.isInitializing) return; // Skip during initialization
                if (file.extension === 'md') {
                    await this.indexer.updateFileIndex(file);
                    this.debouncedRebuildSchedule();
                }
            })
        );
    }

    private registerCommands(): void {
        // Re-index vault
        this.addCommand({
            id: 'reindex-vault',
            name: 'Re-index vault',
            callback: async () => {
                const notice = new Notice('Re-indexing vault...', 0);
                await this.indexer.indexVault();
                await this.rebuildSchedule();
                notice.hide();
                new Notice('Vault re-indexed successfully');
            }
        });

        // Show upcoming notifications
        this.addCommand({
            id: 'show-upcoming',
            name: 'Show upcoming notifications',
            callback: () => {
                const upcoming = this.scheduler.getUpcomingOccurrences(20);
                new UpcomingNotificationsModal(this.app, upcoming, this.dispatcher).open();
            }
        });

        // Pause notifications
        this.addCommand({
            id: 'pause-notifications',
            name: 'Pause notifications',
            callback: () => {
                this.dispatcher.pause();
                this.settings.notificationsPaused = true;
                this.saveSettings();
                this.updateStatusBar();
                new Notice('Notifications paused');
            }
        });

        // Resume notifications
        this.addCommand({
            id: 'resume-notifications',
            name: 'Resume notifications',
            callback: () => {
                this.dispatcher.resume();
                this.settings.notificationsPaused = false;
                this.saveSettings();
                this.updateStatusBar();
                new Notice('Notifications resumed');
            }
        });

        // Test notification
        this.addCommand({
            id: 'test-notification',
            name: 'Test notification',
            callback: () => {
                this.dispatcher.testFireNotification(
                    '🧪 This is a test notification from Tag-Driven Notifications',
                    ['obsidian', 'system']
                );
            }
        });

        // Request system notification permission
        this.addCommand({
            id: 'request-notification-permission',
            name: 'Request system notification permission',
            callback: async () => {
                const granted = await this.dispatcher.requestNotificationPermission();
                if (granted) {
                    new Notice('System notification permission granted');
                } else {
                    new Notice('System notification permission denied or unavailable');
                }
            }
        });
    }

    private setupRibbonIcon(): void {
        this.ribbonIconEl = this.addRibbonIcon(
            'bell',
            'Tag-Driven Notifications',
            (evt: MouseEvent) => {
                // Create context menu
                const menu = new Menu();

                // Pause/Resume toggle
                if (this.dispatcher.isPausedStatus()) {
                    menu.addItem(item => {
                        item.setTitle('Resume notifications')
                            .setIcon('play')
                            .onClick(() => {
                                this.dispatcher.resume();
                                this.settings.notificationsPaused = false;
                                this.saveSettings();
                                this.updateStatusBar();
                                new Notice('Notifications resumed');
                            });
                    });
                } else {
                    menu.addItem(item => {
                        item.setTitle('Pause notifications')
                            .setIcon('pause')
                            .onClick(() => {
                                this.dispatcher.pause();
                                this.settings.notificationsPaused = true;
                                this.saveSettings();
                                this.updateStatusBar();
                                new Notice('Notifications paused');
                            });
                    });
                }

                // Show upcoming
                menu.addItem(item => {
                    item.setTitle('Show upcoming notifications')
                        .setIcon('clock')
                        .onClick(() => {
                            const upcoming = this.scheduler.getUpcomingOccurrences(20);
                            new UpcomingNotificationsModal(this.app, upcoming, this.dispatcher).open();
                        });
                });

                // Re-index
                menu.addItem(item => {
                    item.setTitle('Re-index vault')
                        .setIcon('refresh-cw')
                        .onClick(async () => {
                            const notice = new Notice('Re-indexing vault...', 0);
                            await this.indexer.indexVault();
                            await this.rebuildSchedule();
                            notice.hide();
                            new Notice('Vault re-indexed successfully');
                        });
                });

                // Settings
                menu.addItem(item => {
                    item.setTitle('Settings')
                        .setIcon('settings')
                        .onClick(() => {
                            // @ts-ignore
                            this.app.setting.open();
                            // @ts-ignore
                            this.app.setting.openTabById(this.manifest.id);
                        });
                });

                menu.showAtMouseEvent(evt);
            }
        );

        // Update icon based on paused state
        this.updateRibbonIcon();
    }

    private setupStatusBar(): void {
        this.statusBarItem = this.addStatusBarItem();
        
        // Make status bar item clickable
        this.statusBarItem.addClass('mod-clickable');
        this.statusBarItem.style.cursor = 'pointer';
        this.statusBarItem.addEventListener('click', () => {
            const upcoming = this.scheduler.getUpcomingOccurrences(20);
            new UpcomingNotificationsModal(this.app, upcoming, this.dispatcher).open();
        });
        
        // Add hover tooltip
        this.statusBarItem.setAttribute('title', 'Click to view upcoming notifications');
        
        this.updateStatusBar();
    }

    private updateStatusBar(): void {
        if (!this.statusBarItem) return;

        const isPaused = this.dispatcher.isPausedStatus();
        const scheduleSize = this.scheduler.getScheduleSize();
        const upcomingCount = this.scheduler.getUpcomingOccurrences(10).length;

        if (isPaused) {
            this.statusBarItem.setText(`🔕 Notifications paused (${scheduleSize} scheduled)`);
            this.statusBarItem.setAttribute('title', 'Click to view upcoming notifications (currently paused)');
        } else {
            this.statusBarItem.setText(`🔔 ${upcomingCount} upcoming`);
            this.statusBarItem.setAttribute('title', `Click to view ${upcomingCount} upcoming notifications`);
        }
    }

    private updateRibbonIcon(): void {
        if (!this.ribbonIconEl) return;

        const isPaused = this.dispatcher.isPausedStatus();
        if (isPaused) {
            this.ribbonIconEl.addClass('notification-paused');
            this.ribbonIconEl.setAttribute('aria-label', 'Tag-Driven Notifications (Paused)');
        } else {
            this.ribbonIconEl.removeClass('notification-paused');
            this.ribbonIconEl.setAttribute('aria-label', 'Tag-Driven Notifications');
        }
    }

    private debouncedRebuildSchedule(): void {
        // Clear any existing timer
        if (this.rebuildDebounceTimer) {
            clearTimeout(this.rebuildDebounceTimer);
        }
        
        // Set a new timer to rebuild after 1 second of no changes
        this.rebuildDebounceTimer = setTimeout(async () => {
            console.log('Tag-Driven Notifications: Debounced rebuild triggered');
            await this.rebuildSchedule();
        }, 1000);
    }

    async rebuildSchedule(): Promise<void> {
        // Don't rebuild during initialization
        if (this.isInitializing) {
            console.log('Tag-Driven Notifications: Skipping rebuild during initialization');
            return;
        }
        
        console.log('Tag-Driven Notifications: Rebuilding schedule...');
        console.log('Current rules:', this.settings.rules);

        // Index vault if not already indexed
        const index = this.indexer.getIndex();
        console.log(`Current index size: ${index.notes.size} notes`);
        
        if (index.notes.size === 0) {
            console.log('Index is empty, performing full vault index...');
            await this.indexer.indexVault();
            const newIndex = this.indexer.getIndex();
            console.log(`After indexing: ${newIndex.notes.size} notes found`);
        }

        // Generate schedule
        this.scheduler.generateSchedule(this.settings.rules, this.indexer.getIndex());
        const scheduleSize = this.scheduler.getScheduleSize();
        console.log(`Schedule rebuilt: ${scheduleSize} occurrences generated`);

        // Update status bar
        this.updateStatusBar();

        // Save schedule if not in privacy mode
        if (!this.settings.privacyMode) {
            await this.saveSchedule();
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.updateRibbonIcon();
        
        // Update dispatcher settings
        if (this.dispatcher) {
            this.dispatcher.updateSettings(this.settings);
        }
        
        // Re-index and rebuild schedule when settings change
        // This ensures new rules immediately take effect
        if (!this.isInitializing) {
            console.log('Tag-Driven Notifications: Settings changed, rebuilding schedule...');
            await this.rebuildSchedule();
        }
    }

    private async loadSchedule(): Promise<void> {
        try {
            const data = await this.loadData();
            if (data && data.schedule) {
                this.scheduler.importSchedule(data.schedule);
                if (this.settings.debugMode) {
                    console.log(`Loaded ${data.schedule.length} scheduled occurrences`);
                }
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
        }
    }

    private async saveSchedule(): Promise<void> {
        try {
            const schedule = this.scheduler.exportSchedule();
            const data = await this.loadData() || {};
            data.schedule = schedule;
            await this.saveData(data);
            if (this.settings.debugMode) {
                console.log(`Saved ${schedule.length} scheduled occurrences`);
            }
        } catch (error) {
            console.error('Failed to save schedule:', error);
        }
    }
}