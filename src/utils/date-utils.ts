/**
 * Date utilities for parsing and manipulating dates
 */

import { moment } from 'obsidian';
import { Logger } from './logger';

/**
 * Parse a date string using multiple formats
 */
export function parseDate(dateStr: string, formats: string[]): Date | null {
    // Try ISO format first
    const isoDate = moment(dateStr, moment.ISO_8601, true);
    if (isoDate.isValid()) {
        return isoDate.toDate();
    }

    // Try custom formats
    for (const format of formats) {
        const parsed = moment(dateStr, format, true);
        if (parsed.isValid()) {
            return parsed.toDate();
        }
    }

    // Try default parse
    const defaultParse = moment(dateStr);
    if (defaultParse.isValid()) {
        return defaultParse.toDate();
    }

    return null;
}

/**
 * Apply an ISO 8601 duration offset to a date
 * @param date Base date
 * @param duration ISO 8601 duration string (e.g., "-P1D", "PT30M")
 * @returns New date with offset applied
 */
export function applyISO8601Duration(date: Date, duration: string): Date {
    const m = moment(date);
    
    // Parse ISO 8601 duration
    const match = duration.match(/^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    
    if (!match) {
        throw new Error(`Invalid ISO 8601 duration: ${duration}`);
    }

    const sign = match[1] === '-' ? -1 : 1;
    const years = parseInt(match[2] || '0') * sign;
    const months = parseInt(match[3] || '0') * sign;
    const weeks = parseInt(match[4] || '0') * sign;
    const days = parseInt(match[5] || '0') * sign;
    const hours = parseInt(match[6] || '0') * sign;
    const minutes = parseInt(match[7] || '0') * sign;
    const seconds = parseInt(match[8] || '0') * sign;

    m.add(years, 'years');
    m.add(months, 'months');
    m.add(weeks, 'weeks');
    m.add(days, 'days');
    m.add(hours, 'hours');
    m.add(minutes, 'minutes');
    m.add(seconds, 'seconds');

    return m.toDate();
}

/**
 * Combine a date with a time string
 * @param date Date (year, month, day)
 * @param time Time string (HH:MM)
 * @returns Combined datetime
 */
export function combineDateAndTime(date: Date, time: string): Date {
    const m = moment(date);
    const [hours, minutes] = time.split(':').map(s => parseInt(s));
    m.hours(hours);
    m.minutes(minutes);
    m.seconds(0);
    m.milliseconds(0);
    return m.toDate();
}

/**
 * Get next occurrence based on repeat pattern
 */
export function getNextOccurrence(date: Date, repeat: string, fromDate: Date = new Date()): Date | null {
    const m = moment(date);
    const from = moment(fromDate);

    switch (repeat) {
        case 'daily':
            while (m.isSameOrBefore(from)) {
                m.add(1, 'day');
            }
            return m.toDate();

        case 'weekly':
            while (m.isSameOrBefore(from)) {
                m.add(1, 'week');
            }
            return m.toDate();

        case 'monthly':
            while (m.isSameOrBefore(from)) {
                m.add(1, 'month');
            }
            return m.toDate();

        case 'yearly':
            while (m.isSameOrBefore(from)) {
                m.add(1, 'year');
            }
            return m.toDate();

        case 'none':
            return m.isAfter(from) ? m.toDate() : null;

        default:
            return null;
    }
}

/**
 * Format a date for display
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD HH:mm'): string {
    return moment(date).format(format);
}

/**
 * Check if a date string looks like it has time information
 */
export function hasTimeComponent(dateStr: string): boolean {
    return /T\d{2}:\d{2}/.test(dateStr) || /\d{2}:\d{2}/.test(dateStr);
}

/**
 * Extract time from a datetime string
 */
export function extractTime(dateStr: string): string | null {
    const match = dateStr.match(/(\d{2}):(\d{2})/);
    return match ? match[0] : null;
}

/**
 * Parse inline tag date format (e.g., "#due:2025-10-01T14:00")
 */
export function parseInlineTagDate(tagContent: string): { field: string; date: string } | null {
    const match = tagContent.match(/^([^:]+):(.+)$/);
    if (match) {
        return {
            field: match[1],
            date: match[2]
        };
    }
    return null;
}

/**
 * Check if a date is in the past
 */
export function isInPast(date: Date): boolean {
    return moment(date).isBefore(moment());
}

/**
 * Get a human-readable relative time
 */
export function getRelativeTime(date: Date): string {
    return moment(date).fromNow();
}

/**
 * Normalize a date by updating its year to the current or next year
 * This is useful for recurring events like birthdays where we want to 
 * ignore the original year and always use the current/upcoming occurrence
 */
export function normalizeYearForRecurring(date: Date): Date {
    const m = moment(date);
    const now = moment();
    const currentYear = now.year();
    
    // Set to current year
    m.year(currentYear);
    
    // If the date has already passed this year, move to next year
    if (m.isBefore(now)) {
        m.add(1, 'year');
    }
    
    return m.toDate();
}

/**
 * Calculate all fire times for a rule and date
 */
export function calculateFireTimes(
    originalDate: Date, 
    offsets: string[], 
    defaultTime: string | undefined,
    repeat: string
): Date[] {
    const fireTimes: Date[] = [];
    
    // If the date doesn't have a time component, add the default time
    let baseDate = originalDate;
    if (defaultTime && !hasTimeComponent(originalDate.toISOString())) {
        baseDate = combineDateAndTime(originalDate, defaultTime);
    }

    // Calculate fire times for each offset
    for (const offset of offsets) {
        try {
            const fireTime = applyISO8601Duration(baseDate, offset);
            fireTimes.push(fireTime);
        } catch (e) {
            Logger.error(`Failed to apply offset ${offset}`, e);
        }
    }

    // If no offsets, use the base date
    if (offsets.length === 0) {
        fireTimes.push(baseDate);
    }

    return fireTimes;
}