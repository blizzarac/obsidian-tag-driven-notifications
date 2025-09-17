/**
 * Modal for displaying upcoming notifications
 */

import { App, Modal } from 'obsidian';
import { ScheduledOccurrence } from '../models/types';
import { formatDate, getRelativeTime } from '../utils/date-utils';
import { NotificationDispatcher } from '../services/dispatcher';

export class UpcomingNotificationsModal extends Modal {
    private occurrences: ScheduledOccurrence[];
    private dispatcher: NotificationDispatcher;

    constructor(app: App, occurrences: ScheduledOccurrence[], dispatcher: NotificationDispatcher) {
        super(app);
        this.occurrences = occurrences;
        this.dispatcher = dispatcher;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '🔔 Upcoming Notifications' });

        if (this.occurrences.length === 0) {
            contentEl.createEl('p', { 
                text: 'No upcoming notifications scheduled.',
                cls: 'upcoming-empty'
            });
            return;
        }

        // Create list of notifications
        const listContainer = contentEl.createDiv({ cls: 'upcoming-list' });
        
        this.occurrences.forEach(occurrence => {
            const itemEl = listContainer.createDiv({ cls: 'upcoming-item' });
            
            // Time info
            const timeEl = itemEl.createDiv({ cls: 'upcoming-time' });
            const fireTime = new Date(occurrence.fireTime);
            timeEl.createEl('strong', { text: formatDate(fireTime, 'MMM DD, YYYY HH:mm') });
            timeEl.createEl('span', { 
                text: ` (${getRelativeTime(fireTime)})`,
                cls: 'upcoming-relative'
            });

            // Message
            itemEl.createEl('div', { 
                text: occurrence.message,
                cls: 'upcoming-message'
            });

            // Metadata
            const metaEl = itemEl.createDiv({ cls: 'upcoming-meta' });
            
            // Note link
            const noteLink = metaEl.createEl('a', {
                text: `📄 ${occurrence.noteTitle}`,
                cls: 'upcoming-note-link'
            });
            noteLink.onclick = async () => {
                const file = this.app.vault.getAbstractFileByPath(occurrence.notePath);
                if (file) {
                    await this.app.workspace.openLinkText(occurrence.notePath, '', false);
                    this.close();
                }
            };

            // Field/Rule
            metaEl.createEl('span', { 
                text: ` • Field: ${occurrence.ruleField}`,
                cls: 'upcoming-field'
            });

            // Channels
            metaEl.createEl('span', { 
                text: ` • ${occurrence.channels.join('+')}`,
                cls: 'upcoming-channels'
            });

            // Actions
            const actionsEl = itemEl.createDiv({ cls: 'upcoming-actions' });
            
            // Test/Fire Now button
            const fireNowBtn = actionsEl.createEl('button', { 
                text: '▶️ Fire Now',
                cls: 'upcoming-fire-now'
            });
            fireNowBtn.onclick = () => {
                this.dispatcher.fireNotification(occurrence);
                fireNowBtn.textContent = '✓ Fired';
                fireNowBtn.disabled = true;
            };
        });

        // Footer with summary
        const footer = contentEl.createDiv({ cls: 'upcoming-footer' });
        footer.createEl('p', { 
            text: `Showing ${this.occurrences.length} upcoming notification${this.occurrences.length !== 1 ? 's' : ''}`,
            cls: 'upcoming-summary'
        });

        // Close button
        const closeBtn = contentEl.createEl('button', { 
            text: 'Close',
            cls: 'mod-cta'
        });
        closeBtn.onclick = () => this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}