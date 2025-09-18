/**
 * Extended type definitions for Obsidian API
 * These extend the official types to include properties not in the public API
 */

import { Notice, TFolder, TAbstractFile } from 'obsidian';

// Extended Notice type with internal properties
export interface NoticeWithElement {
    noticeEl: HTMLElement;
    hide(): void;
}

// Extended folder type for vault traversal
export interface ExtendedFolder extends TAbstractFile {
    children?: TAbstractFile[];
    name: string;
}

// Type guard functions
export function hasNoticeEl(notice: Notice): notice is Notice & NoticeWithElement {
    return 'noticeEl' in notice && notice['noticeEl'] instanceof HTMLElement;
}

export function hasChildren(folder: TAbstractFile): folder is ExtendedFolder {
    const folderWithChildren = folder as unknown as { children?: unknown };
    return 'children' in folder && Array.isArray(folderWithChildren.children);
}
