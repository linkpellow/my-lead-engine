/**
 * File Parsing Utilities
 * Handles parsing of uploaded files (CSV, JSON, etc.)
 */

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
  fileName: string;
  // Aliases for backwards compatibility with original brainscraper.io
  rowCount?: number;
  columnCount?: number;
}

export function parseFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          reject(new Error('File is empty'));
          return;
        }
        
        // Parse CSV
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: Record<string, any> = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          return row;
        });
        
        resolve({
          headers,
          rows,
          totalRows: rows.length,
          fileName: file.name,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}