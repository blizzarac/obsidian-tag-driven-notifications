/**
 * Vault indexing service for extracting dates from notes
 */

import { App, TFile, CachedMetadata, FrontMatterCache, Notice } from 'obsidian';
import { ExtractedDate, NoteIndex, VaultIndex, NotificationPluginSettings } from '../models/types';
import { parseDate, parseInlineTagDate } from '../utils/date-utils';

export class VaultIndexer {
    private app: App;
    private settings: NotificationPluginSettings;
    private index: VaultIndex;
    private indexingInProgress: boolean = false;

    constructor(app: App, settings: NotificationPluginSettings) {
        this.app = app;
        this.settings = settings;
        this.index = {
            notes: new Map(),
            lastIndexed: 0
        };
    }

    /**
     * Get the current index
     */
    getIndex(): VaultIndex {
        return this.index;
    }

    /**
     * Index the entire vault
     */
    async indexVault(): Promise<VaultIndex> {
        if (this.indexingInProgress) {
            console.log('Indexing already in progress');
            return this.index;
        }

        this.indexingInProgress = true;
        console.log('Starting vault indexing...');

        try {
            const files = this.app.vault.getMarkdownFiles();
            const filteredFiles = this.filterFiles(files);
            
            console.log(`Found ${filteredFiles.length} markdown files to index`);

            // Process files in batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < filteredFiles.length; i += batchSize) {
                const batch = filteredFiles.slice(i, i + batchSize);
                await Promise.all(batch.map(file => this.indexFile(file)));
                
                // Small delay between batches to avoid blocking
                if (i + batchSize < filteredFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            this.index.lastIndexed = Date.now();
            console.log(`Indexed ${this.index.notes.size} notes with date fields`);
            
        } catch (error) {
            console.error('Error indexing vault:', error);
        } finally {
            this.indexingInProgress = false;
        }

        return this.index;
    }

    /**
     * Index a single file
     */
    async indexFile(file: TFile): Promise<NoteIndex | null> {
        try {
            const metadata = this.app.metadataCache.getFileCache(file);
            if (!metadata) {
                return null;
            }

            const dates = await this.extractDatesFromFile(file, metadata);
            const title = this.extractTitle(file, metadata);

            const noteIndex: NoteIndex = {
                path: file.path,
                title,
                dates,
                lastModified: file.stat.mtime
            };

            this.index.notes.set(file.path, noteIndex);
            return noteIndex;
        } catch (error) {
            console.error(`Error indexing file ${file.path}:`, error);
            return null;
        }
    }

    /**
     * Update index for a single file
     */
    async updateFileIndex(file: TFile): Promise<void> {
        if (this.shouldIndexFile(file)) {
            await this.indexFile(file);
        } else {
            // Remove from index if it shouldn't be indexed
            this.index.notes.delete(file.path);
        }
    }

    /**
     * Remove a file from the index
     */
    removeFileFromIndex(path: string): void {
        this.index.notes.delete(path);
    }

    /**
     * Extract dates from a file
     */
    private async extractDatesFromFile(file: TFile, metadata: CachedMetadata): Promise<ExtractedDate[]> {
        const dates: ExtractedDate[] = [];

        // Extract from frontmatter
        if (metadata.frontmatter) {
            dates.push(...this.extractDatesFromFrontmatter(metadata.frontmatter));
        }

        // Extract from inline tags
        if (metadata.tags) {
            for (const tag of metadata.tags) {
                const extracted = this.extractDateFromTag(tag.tag);
                if (extracted) {
                    dates.push(extracted);
                }
            }
        }

        // Also check content for inline tags with dates
        const content = await this.app.vault.read(file);
        const inlineTagMatches = content.matchAll(/#([a-zA-Z0-9_-]+:[^\s]+)/g);
        for (const match of inlineTagMatches) {
            const extracted = this.extractDateFromTag('#' + match[1]);
            if (extracted) {
                dates.push(extracted);
            }
        }

        return dates;
    }

    /**
     * Extract dates from frontmatter
     */
    private extractDatesFromFrontmatter(frontmatter: FrontMatterCache): ExtractedDate[] {
        const dates: ExtractedDate[] = [];
        const watchedFields = this.settings.rules.map(r => r.field);

        for (const field of watchedFields) {
            if (frontmatter[field]) {
                const value = frontmatter[field];
                const dateStr = typeof value === 'string' ? value : value.toString();
                const parsed = parseDate(dateStr, this.settings.dateFormats);
                
                if (parsed) {
                    dates.push({
                        field,
                        value: parsed.toISOString(),
                        source: 'frontmatter',
                        rawValue: dateStr
                    });
                }
            }
        }

        return dates;
    }

    /**
     * Extract date from a tag
     */
    private extractDateFromTag(tag: string): ExtractedDate | null {
        // Remove # prefix if present
        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
        
        // Check if it's a tag with date format (e.g., "due:2025-10-01T14:00")
        const parsed = parseInlineTagDate(cleanTag);
        if (parsed) {
            // Check if this field is being watched
            const isWatched = this.settings.rules.some(r => r.field === parsed.field);
            if (isWatched) {
                const date = parseDate(parsed.date, this.settings.dateFormats);
                if (date) {
                    return {
                        field: parsed.field,
                        value: date.toISOString(),
                        source: 'inline-tag',
                        rawValue: parsed.date
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract title from file and metadata
     */
    private extractTitle(file: TFile, metadata: CachedMetadata): string {
        // Try frontmatter title first
        if (metadata.frontmatter?.title) {
            return metadata.frontmatter.title;
        }

        // Try first heading
        if (metadata.headings && metadata.headings.length > 0) {
            return metadata.headings[0].heading;
        }

        // Fallback to filename without extension
        return file.basename;
    }

    /**
     * Filter files based on settings
     */
    private filterFiles(files: TFile[]): TFile[] {
        return files.filter(file => this.shouldIndexFile(file));
    }

    /**
     * Check if a file should be indexed
     */
    private shouldIndexFile(file: TFile): boolean {
        // Check excluded folders
        for (const excludedFolder of this.settings.excludedFolders) {
            if (file.path.startsWith(excludedFolder + '/') || file.path === excludedFolder) {
                return false;
            }
        }

        // Check included folders if scope is selected-folders
        if (this.settings.indexingScope === 'selected-folders') {
            let isIncluded = false;
            for (const includedFolder of this.settings.includedFolders) {
                if (file.path.startsWith(includedFolder + '/') || file.path === includedFolder) {
                    isIncluded = true;
                    break;
                }
            }
            if (!isIncluded && this.settings.includedFolders.length > 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * Clear the index
     */
    clearIndex(): void {
        this.index = {
            notes: new Map(),
            lastIndexed: 0
        };
    }

    /**
     * Get notes with dates for a specific field
     */
    getNotesWithField(field: string): NoteIndex[] {
        const notes: NoteIndex[] = [];
        
        for (const note of this.index.notes.values()) {
            if (note.dates.some(d => d.field === field)) {
                notes.push(note);
            }
        }

        return notes;
    }

    /**
     * Get all unique fields found in the vault
     */
    getAllFields(): Set<string> {
        const fields = new Set<string>();
        
        for (const note of this.index.notes.values()) {
            for (const date of note.dates) {
                fields.add(date.field);
            }
        }

        return fields;
    }
}