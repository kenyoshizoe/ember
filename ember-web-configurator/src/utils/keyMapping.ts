// Key code mapping for Ember keyboard
// Maps key codes to display strings (short and full names)

export interface KeyMapping {
  code: number;
  shortName: string;    // For keyboard display (2-4 characters)
  fullName: string;     // For settings panel
  category: string;     // For grouping in UI
}

export const KEY_MAPPINGS: KeyMapping[] = [
  // Letters
  { code: 0x04, shortName: 'A', fullName: 'A', category: 'Letter' },
  { code: 0x05, shortName: 'B', fullName: 'B', category: 'Letter' },
  { code: 0x06, shortName: 'C', fullName: 'C', category: 'Letter' },
  { code: 0x07, shortName: 'D', fullName: 'D', category: 'Letter' },
  { code: 0x08, shortName: 'E', fullName: 'E', category: 'Letter' },
  { code: 0x09, shortName: 'F', fullName: 'F', category: 'Letter' },
  { code: 0x0A, shortName: 'G', fullName: 'G', category: 'Letter' },
  { code: 0x0B, shortName: 'H', fullName: 'H', category: 'Letter' },
  { code: 0x0C, shortName: 'I', fullName: 'I', category: 'Letter' },
  { code: 0x0D, shortName: 'J', fullName: 'J', category: 'Letter' },
  { code: 0x0E, shortName: 'K', fullName: 'K', category: 'Letter' },
  { code: 0x0F, shortName: 'L', fullName: 'L', category: 'Letter' },
  { code: 0x10, shortName: 'M', fullName: 'M', category: 'Letter' },
  { code: 0x11, shortName: 'N', fullName: 'N', category: 'Letter' },
  { code: 0x12, shortName: 'O', fullName: 'O', category: 'Letter' },
  { code: 0x13, shortName: 'P', fullName: 'P', category: 'Letter' },
  { code: 0x14, shortName: 'Q', fullName: 'Q', category: 'Letter' },
  { code: 0x15, shortName: 'R', fullName: 'R', category: 'Letter' },
  { code: 0x16, shortName: 'S', fullName: 'S', category: 'Letter' },
  { code: 0x17, shortName: 'T', fullName: 'T', category: 'Letter' },
  { code: 0x18, shortName: 'U', fullName: 'U', category: 'Letter' },
  { code: 0x19, shortName: 'V', fullName: 'V', category: 'Letter' },
  { code: 0x1A, shortName: 'W', fullName: 'W', category: 'Letter' },
  { code: 0x1B, shortName: 'X', fullName: 'X', category: 'Letter' },
  { code: 0x1C, shortName: 'Y', fullName: 'Y', category: 'Letter' },
  { code: 0x1D, shortName: 'Z', fullName: 'Z', category: 'Letter' },

  // Numbers
  { code: 0x1E, shortName: '1', fullName: '1', category: 'Number' },
  { code: 0x1F, shortName: '2', fullName: '2', category: 'Number' },
  { code: 0x20, shortName: '3', fullName: '3', category: 'Number' },
  { code: 0x21, shortName: '4', fullName: '4', category: 'Number' },
  { code: 0x22, shortName: '5', fullName: '5', category: 'Number' },
  { code: 0x23, shortName: '6', fullName: '6', category: 'Number' },
  { code: 0x24, shortName: '7', fullName: '7', category: 'Number' },
  { code: 0x25, shortName: '8', fullName: '8', category: 'Number' },
  { code: 0x26, shortName: '9', fullName: '9', category: 'Number' },
  { code: 0x27, shortName: '0', fullName: '0', category: 'Number' },

  // Special keys
  { code: 0x28, shortName: 'ENT', fullName: 'Enter', category: 'Special' },
  { code: 0x29, shortName: 'ESC', fullName: 'Escape', category: 'Special' },
  { code: 0x2A, shortName: 'BS', fullName: 'Backspace', category: 'Special' },
  { code: 0x2B, shortName: 'TAB', fullName: 'Tab', category: 'Special' },
  { code: 0x2C, shortName: 'SPC', fullName: 'Space', category: 'Special' },

  // Symbols
  { code: 0x2D, shortName: '-', fullName: 'Minus', category: 'Symbol' },
  { code: 0x2E, shortName: '=', fullName: 'Equal', category: 'Symbol' },
  { code: 0x2F, shortName: '[', fullName: 'Left Bracket', category: 'Symbol' },
  { code: 0x30, shortName: ']', fullName: 'Right Bracket', category: 'Symbol' },
  { code: 0x31, shortName: '\\', fullName: 'Backslash', category: 'Symbol' },
  { code: 0x33, shortName: ';', fullName: 'Semicolon', category: 'Symbol' },
  { code: 0x34, shortName: "'", fullName: 'Quote', category: 'Symbol' },
  { code: 0x35, shortName: '`', fullName: 'Grave', category: 'Symbol' },
  { code: 0x36, shortName: ',', fullName: 'Comma', category: 'Symbol' },
  { code: 0x37, shortName: '.', fullName: 'Period', category: 'Symbol' },
  { code: 0x38, shortName: '/', fullName: 'Slash', category: 'Symbol' },

  // Function keys
  { code: 0x3A, shortName: 'F1', fullName: 'F1', category: 'Function' },
  { code: 0x3B, shortName: 'F2', fullName: 'F2', category: 'Function' },
  { code: 0x3C, shortName: 'F3', fullName: 'F3', category: 'Function' },
  { code: 0x3D, shortName: 'F4', fullName: 'F4', category: 'Function' },
  { code: 0x3E, shortName: 'F5', fullName: 'F5', category: 'Function' },
  { code: 0x3F, shortName: 'F6', fullName: 'F6', category: 'Function' },
  { code: 0x40, shortName: 'F7', fullName: 'F7', category: 'Function' },
  { code: 0x41, shortName: 'F8', fullName: 'F8', category: 'Function' },
  { code: 0x42, shortName: 'F9', fullName: 'F9', category: 'Function' },
  { code: 0x43, shortName: 'F10', fullName: 'F10', category: 'Function' },
  { code: 0x44, shortName: 'F11', fullName: 'F11', category: 'Function' },
  { code: 0x45, shortName: 'F12', fullName: 'F12', category: 'Function' },

  // Arrow keys
  { code: 0x4F, shortName: '→', fullName: 'Right Arrow', category: 'Arrow' },
  { code: 0x50, shortName: '←', fullName: 'Left Arrow', category: 'Arrow' },
  { code: 0x51, shortName: '↓', fullName: 'Down Arrow', category: 'Arrow' },
  { code: 0x52, shortName: '↑', fullName: 'Up Arrow', category: 'Arrow' },

  // Modifiers
  { code: 0xE0, shortName: 'CTRL', fullName: 'Left Control', category: 'Modifier' },
  { code: 0xE1, shortName: 'SHFT', fullName: 'Left Shift', category: 'Modifier' },
  { code: 0xE2, shortName: 'ALT', fullName: 'Left Alt', category: 'Modifier' },
  { code: 0xE3, shortName: 'WIN', fullName: 'Left Windows', category: 'Modifier' },
  { code: 0xE4, shortName: 'CTRL', fullName: 'Right Control', category: 'Modifier' },
  { code: 0xE5, shortName: 'SHFT', fullName: 'Right Shift', category: 'Modifier' },
  { code: 0xE6, shortName: 'ALT', fullName: 'Right Alt', category: 'Modifier' },
  { code: 0xE7, shortName: 'WIN', fullName: 'Right Windows', category: 'Modifier' },

  // Special
  { code: 0x00, shortName: 'NONE', fullName: 'No Key', category: 'Special' },
];

// Create lookup maps for efficient searching
export const keyMappingByCode = new Map<number, KeyMapping>();
export const keyMappingByShortName = new Map<string, KeyMapping>();
export const keyMappingByFullName = new Map<string, KeyMapping>();

KEY_MAPPINGS.forEach(mapping => {
  keyMappingByCode.set(mapping.code, mapping);
  keyMappingByShortName.set(mapping.shortName.toLowerCase(), mapping);
  keyMappingByFullName.set(mapping.fullName.toLowerCase(), mapping);
});

// Helper functions
export function getKeyByCode(code: number): KeyMapping | undefined {
  return keyMappingByCode.get(code);
}

export function getKeyByShortName(shortName: string): KeyMapping | undefined {
  return keyMappingByShortName.get(shortName.toLowerCase());
}

export function getKeyByFullName(fullName: string): KeyMapping | undefined {
  return keyMappingByFullName.get(fullName.toLowerCase());
}

export function getKeyCategories(): string[] {
  const categories = new Set<string>();
  KEY_MAPPINGS.forEach(k => categories.add(k.category));
  return Array.from(categories);
}

export function getKeysByCategory(category: string): KeyMapping[] {
  return KEY_MAPPINGS.filter(k => k.category === category);
}
