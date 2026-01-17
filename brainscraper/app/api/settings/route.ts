/**
 * Settings API Route
 * Handles application settings management
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

const DEFAULT_SETTINGS = {
  apiKeys: {},
  maxConcurrency: 3,
  rateLimitDelay: 1000,
  scrapeSettings: {
    maxLeads: 25,
    defaultLocation: '',
  },
  enrichmentSettings: {
    enabled: true,
    autoEnrich: false,
  },
  outputSettings: {
    format: 'csv',
    includeHeaders: true,
  },
};

function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadSettings() {
  ensureDataDirectory();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: any) {
  ensureDataDirectory();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  try {
    const settings = loadSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = { ...DEFAULT_SETTINGS, ...body };
    saveSettings(settings);
    
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}