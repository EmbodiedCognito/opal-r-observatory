import { parseProject, type ProjectBundle } from './bundle';

export const RECOVERY_KEY = 'opal-project-recovery-v1';
export const MAX_RECOVERY_BYTES = 2 * 1024 * 1024;
export interface RecoveryStore { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }
export interface RecoveryRead { project: ProjectBundle | null; blocked: boolean; message: string }

export function readRecovery(store?: RecoveryStore): RecoveryRead {
  try {
    const storage = store ?? window.sessionStorage;
    const text = storage.getItem(RECOVERY_KEY);
    if (!text) return { project: null, blocked: false, message: '' };
    if (new TextEncoder().encode(text).length > MAX_RECOVERY_BYTES) throw new Error('oversized');
    const project = parseProject(text);
    return { project, blocked: false, message: 'Recovered this tab’s project. Save a project file to keep a durable copy.' };
  } catch {
    return { project: null, blocked: true, message: 'This tab’s recovery copy could not be read. It has been left untouched. Save your current work as a project file.' };
  }
}

export function writeRecovery(project: ProjectBundle, store?: RecoveryStore): string {
  try {
    const storage = store ?? window.sessionStorage;
    const text = JSON.stringify(project);
    if (new TextEncoder().encode(text).length > MAX_RECOVERY_BYTES) {
      return 'This project exceeds the 2 MB tab-recovery limit. The previous recovery copy may be older. Save a project file before reloading or closing.';
    }
    parseProject(text);
    // setItem is atomic: quota failure retains the previous copy, never a partial new one.
    storage.setItem(RECOVERY_KEY, text);
    return 'Current project recovery copy kept in this tab. Save a file before closing the tab.';
  } catch {
    return 'Could not update this tab’s recovery copy. The previous copy may be older. Save a project file before reloading or closing.';
  }
}
