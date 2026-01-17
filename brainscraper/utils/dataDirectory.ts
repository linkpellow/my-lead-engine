/**
 * Data Directory Utilities
 * Handles data file paths and safe file operations for the lead engine
 * 
 * CRITICAL: All data operations must preserve existing data
 * See .cursor/rules/data-protection.mdc for guidelines
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the data directory path
 * Uses DATA_DIR env var or defaults to ./data relative to project root
 */
export function getDataDirectory(): string {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  return dataDir;
}

/**
 * Get full path for a data file
 * @param filename - The filename (e.g., 'enriched-all-leads.json')
 * @returns Full path to the file
 */
export function getDataFilePath(filename: string): string {
  return path.join(getDataDirectory(), filename);
}

/**
 * Ensure the data directory exists
 * Creates it if it doesn't exist
 */
export function ensureDataDirectory(): void {
  const dataDir = getDataDirectory();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Created data directory: ${dataDir}`);
  }
}

/**
 * Safely read a file, returning null if it doesn't exist or can't be read
 * @param filePath - Path to the file
 * @returns File contents as string, or null if error
 */
export function safeReadFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Safely write a file using atomic write pattern (temp file + rename)
 * This prevents data corruption if the process is interrupted mid-write
 * 
 * CRITICAL: This function should ONLY be used after proper data merging
 * Never call this directly to overwrite enriched leads without loading first
 * 
 * @param filePath - Path to the file
 * @param content - Content to write
 */
export function safeWriteFile(filePath: string, content: string): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Atomic write: write to temp file first, then rename
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`❌ Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Safely append to a JSON array file
 * Loads existing array, appends new items, and saves
 * 
 * @param filePath - Path to the JSON array file
 * @param newItems - Items to append
 * @returns Updated array
 */
export function safeAppendToJsonArray<T>(filePath: string, newItems: T[]): T[] {
  let existingItems: T[] = [];
  
  const content = safeReadFile(filePath);
  if (content) {
    try {
      const parsed = JSON.parse(content);
      existingItems = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn(`⚠️ Could not parse ${filePath} as JSON array, starting fresh`);
    }
  }
  
  const allItems = [...existingItems, ...newItems];
  safeWriteFile(filePath, JSON.stringify(allItems, null, 2));
  
  return allItems;
}

/**
 * Check if a data file exists
 * @param filename - The filename (e.g., 'enriched-all-leads.json')
 * @returns True if file exists
 */
export function dataFileExists(filename: string): boolean {
  const filePath = getDataFilePath(filename);
  return fs.existsSync(filePath);
}

/**
 * Get file stats for a data file
 * @param filename - The filename
 * @returns File stats or null if error
 */
export function getDataFileStats(filename: string): fs.Stats | null {
  try {
    const filePath = getDataFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/**
 * List all files in the data directory matching a pattern
 * @param pattern - Optional glob pattern (simple matching only)
 * @returns Array of filenames
 */
export function listDataFiles(pattern?: string): string[] {
  try {
    ensureDataDirectory();
    const dataDir = getDataDirectory();
    const files = fs.readdirSync(dataDir);
    
    if (!pattern) {
      return files;
    }
    
    // Simple pattern matching (e.g., '*.json')
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return files.filter(f => f.endsWith(suffix));
    }
    
    return files.filter(f => f.includes(pattern));
  } catch {
    return [];
  }
}
