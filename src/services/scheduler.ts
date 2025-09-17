/**
 * Schedule generator for creating notification occurrences from rules and dates
 */

import { Rule, ScheduledOccurrence, VaultIndex, TemplateContext } from '../models/types';
import { calculateFireTimes, formatDate, getNextOccurrence, isInPast } from '../utils/date-utils';

export class ScheduleGenerator {
    private schedule: Map<string, ScheduledOccurrence> = new Map();

    /**
     * Generate schedule from rules and vault index
     */
    generateSchedule(rules: Rule[], vaultIndex: VaultIndex): ScheduledOccurrence[] {
        this.schedule.clear();
        
        for (const rule of rules) {
            if (!rule.enabled) continue;
            
            // Find all notes with this field
            for (const note of vaultIndex.notes.values()) {
                const datesForField = note.dates.filter(d => d.field === rule.field);
                
                for (const extractedDate of datesForField) {
                    const occurrences = this.generateOccurrencesForDate(
                        rule,
                        new Date(extractedDate.value),
                        note.path,
                        note.title
                    );
                    
                    for (const occurrence of occurrences) {
                        this.schedule.set(occurrence.id, occurrence);
                    }
                }
            }
        }

        return Array.from(this.schedule.values());
    }

    /**
     * Generate occurrences for a single date and rule
     */
    private generateOccurrencesForDate(
        rule: Rule,
        originalDate: Date,
        notePath: string,
        noteTitle: string
    ): ScheduledOccurrence[] {
        const occurrences: ScheduledOccurrence[] = [];
        
        // Calculate fire times with offsets
        const fireTimes = calculateFireTimes(
            originalDate,
            rule.offsets,
            rule.defaultTime || '09:00',
            rule.repeat
        );

        for (let fireTime of fireTimes) {
            // Handle repeat patterns
            if (rule.repeat !== 'none') {
                // Calculate next occurrence if the fire time is in the past
                const now = new Date();
                while (fireTime && fireTime < now) {
                    const nextOccurrence = getNextOccurrence(fireTime, rule.repeat, now);
                    if (nextOccurrence) {
                        fireTime = nextOccurrence;
                    } else {
                        break;
                    }
                }
            }

            // Skip past occurrences for non-repeating rules
            if (rule.repeat === 'none' && fireTime < new Date()) {
                continue;
            }

            if (fireTime) {
                const message = this.resolveMessageTemplate(rule.messageTemplate, {
                    title: noteTitle,
                    field: rule.field,
                    date: formatDate(originalDate, 'YYYY-MM-DD'),
                    path: notePath
                });

                occurrences.push({
                    id: this.generateId(),
                    ruleId: rule.id,
                    ruleField: rule.field,
                    notePath,
                    noteTitle,
                    originalDate: originalDate.toISOString(),
                    fireTime: fireTime.toISOString(),
                    message,
                    channels: rule.channels,
                    fired: false,
                    createdAt: new Date().toISOString()
                });
            }
        }

        return occurrences;
    }

    /**
     * Resolve message template with context
     */
    private resolveMessageTemplate(template: string, context: TemplateContext): string {
        return template
            .replace(/{title}/g, context.title)
            .replace(/{field}/g, context.field)
            .replace(/{date}/g, context.date)
            .replace(/{path}/g, context.path);
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return crypto.randomUUID ? crypto.randomUUID() : 
               `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get upcoming occurrences
     */
    getUpcomingOccurrences(limit: number = 10): ScheduledOccurrence[] {
        const now = new Date();
        const upcoming = Array.from(this.schedule.values())
            .filter(o => !o.fired && new Date(o.fireTime) > now)
            .sort((a, b) => new Date(a.fireTime).getTime() - new Date(b.fireTime).getTime())
            .slice(0, limit);
        
        return upcoming;
    }

    /**
     * Get occurrences that should fire now
     */
    getDueOccurrences(): ScheduledOccurrence[] {
        const now = new Date();
        return Array.from(this.schedule.values())
            .filter(o => !o.fired && new Date(o.fireTime) <= now);
    }

    /**
     * Mark occurrence as fired
     */
    markAsFired(id: string): void {
        const occurrence = this.schedule.get(id);
        if (occurrence) {
            occurrence.fired = true;
        }
    }

    /**
     * Get schedule size
     */
    getScheduleSize(): number {
        return this.schedule.size;
    }

    /**
     * Clear schedule
     */
    clearSchedule(): void {
        this.schedule.clear();
    }

    /**
     * Export schedule for persistence
     */
    exportSchedule(): ScheduledOccurrence[] {
        return Array.from(this.schedule.values());
    }

    /**
     * Import schedule from persistence
     */
    importSchedule(occurrences: ScheduledOccurrence[]): void {
        this.schedule.clear();
        for (const occurrence of occurrences) {
            this.schedule.set(occurrence.id, occurrence);
        }
    }
}