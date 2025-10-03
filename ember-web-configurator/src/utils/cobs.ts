// COBS (Consistent Overhead Byte Stuffing) encoder/decoder
// Used for reliable serial communication with the Ember keyboard

/**
 * COBS encoding algorithm
 * Encodes data by removing zero bytes and adding overhead bytes
 * Matches the firmware implementation exactly
 * @param data Input byte array
 * @returns Encoded byte array
 */
export function cobsEncode(data: Uint8Array): Uint8Array {
  if (data.length === 0) {
    return new Uint8Array([0x01]);
  }

  // Allocate maximum possible size
  const encoded = new Uint8Array(data.length + Math.ceil(data.length / 254) + 1);
  let readIndex = 0;
  let writeIndex = 1;
  let codeIndex = 0;
  let code = 1;

  while (readIndex < data.length) {
    if (data[readIndex] === 0) {
      // Found a zero byte
      encoded[codeIndex] = code;
      code = 1;
      codeIndex = writeIndex++;
      readIndex++;
    } else {
      // Non-zero byte
      encoded[writeIndex++] = data[readIndex++];
      code++;
      
      if (code === 0xFF) {
        // Maximum run length reached
        encoded[codeIndex] = code;
        code = 1;
        codeIndex = writeIndex++;
      }
    }
  }

  // Write final code byte
  encoded[codeIndex] = code;

  // Return trimmed array (no delimiter added)
  return encoded.slice(0, writeIndex);
}

/**
 * COBS decoding algorithm
 * Decodes COBS-encoded data back to original format
 * Matches the firmware implementation exactly
 * @param encoded Encoded byte array
 * @returns Decoded byte array or null if invalid
 */
export function cobsDecode(encoded: Uint8Array): Uint8Array | null {
  if (encoded.length === 0) {
    return new Uint8Array(0);
  }

  const decoded = new Uint8Array(encoded.length);
  let readIndex = 0;
  let writeIndex = 0;

  while (readIndex < encoded.length) {
    const code = encoded[readIndex];

    if (readIndex + code > encoded.length && code !== 1) {
      return null;
    }

    readIndex++;

    // Copy the next (code - 1) bytes
    for (let i = 1; i < code; i++) {
      decoded[writeIndex++] = encoded[readIndex++];
    }

    // Add zero byte if not at end and code < 0xFF
    if (code !== 0xFF && readIndex !== encoded.length) {
      decoded[writeIndex++] = 0;
    }
  }

  // Return trimmed array
  return decoded.slice(0, writeIndex);
}

/**
 * Validate COBS packet integrity
 * @param packet Packet to validate
 * @returns True if packet is valid
 */
export function validateCobsPacket(packet: Uint8Array): boolean {
  try {
    const decoded = cobsDecode(packet);
    return decoded !== null;
  } catch {
    return false;
  }
}

// Command constants for Ember keyboard communication
export const EMBER_COMMANDS = {
  // Read commands
  READ_KEY_CONFIG: 0x01,
  READ_KEY_MAPPING: 0x02,
  READ_RAPID_TRIGGER_CONFIG: 0x03,
  READ_DEVICE_INFO: 0x04,
  
  // Write commands
  WRITE_KEY_CONFIG: 0x11,
  WRITE_KEY_MAPPING: 0x12,
  WRITE_RAPID_TRIGGER_CONFIG: 0x13,
} as const;

export type EmberCommand = typeof EMBER_COMMANDS[keyof typeof EMBER_COMMANDS];
