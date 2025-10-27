// React Hook for managing Ember keyboard connection via Web Serial API
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EmberProtocol,
  type EmberSerialDevice,
  isWebSerialSupported,
  requestEmberSerialDevice,
  disconnectSerialDevice,
  setupSerialEventListeners,
} from '../utils/emberProtocol';

export interface KeySwitchConfigData {
  keyCode: number;
  keyType: number;
  actuationPointMm: number;
  rapidTriggerUpSensitivityMm: number;
  rapidTriggerDownSensitivityMm: number;
}

export interface KeySwitchConfigUpdate {
  keyCode?: number;
  keyType?: number;
  actuationPointMm?: number;
  rapidTriggerUpSensitivityMm?: number;
  rapidTriggerDownSensitivityMm?: number;
}

const KEY_CONFIG_SIZE = 5;
const KEY_CONFIG_BASE_ADDRESS = 0x0000;
const KEY_CONFIG_OFFSETS = {
  keyCode: 0,
  keyType: 1,
  actuationPoint: 2,
  rapidTriggerUpSensitivity: 3,
  rapidTriggerDownSensitivity: 4,
} as const;
const KEY_CONFIG_SCALE = 0.1;
const TOTAL_KEY_COUNT = 32;

const MIDI_NOTE_BASE_ADDRESS = 0x0100;
const MIDI_NOTE_MIN = 0;
const MIDI_NOTE_MAX = 127;

const MODE_ADDRESS = 0x4000;
const MODE_MIN = 0;
const MODE_MAX = 3;

const PUSH_DISTANCE_BASE_ADDRESS = 0x2000;
const PUSH_DISTANCE_INTERVAL_MS = 10;
const PUSH_DISTANCE_MAX_CONSECUTIVE_ERRORS = 5;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const keyConfigAddress = (keyId: number, offset: number = 0): number =>
  KEY_CONFIG_BASE_ADDRESS + keyId * KEY_CONFIG_SIZE + offset;

const midiNoteAddress = (keyId: number): number => MIDI_NOTE_BASE_ADDRESS + keyId;

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.message.toLowerCase().includes('timeout');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const readKeyMappingFromDevice = async (protocol: EmberProtocol, keyId: number): Promise<number | null> => {
  try {
    const response = await protocol.readQuery(keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode), 1);

    if (!response.success) {
      console.warn(`Key ${keyId}: response not successful`);
      return null;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`Key ${keyId}: no data in response`);
      return null;
    }

    return response.data[0];
  } catch (error) {
    console.error(`Failed to read key mapping for key ${keyId}:`, error);
    return null;
  }
};

const writeKeyMappingToDevice = async (protocol: EmberProtocol, keyId: number, keyCode: number): Promise<boolean> => {
  try {
    const address = keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode);
    const response = await protocol.writeQuery(address, new Uint8Array([keyCode]));
    return response.success;
  } catch (error) {
    console.error(`Failed to write key mapping for key ${keyId}:`, error);
    return false;
  }
};

const readMidiNoteFromDevice = async (protocol: EmberProtocol, keyId: number): Promise<number | null> => {
  try {
    const response = await protocol.readQuery(midiNoteAddress(keyId), 1);

    if (!response.success) {
      console.warn(`MIDI note ${keyId}: response not successful`);
      return null;
    }

    if (!response.data || response.data.length === 0) {
      console.warn(`MIDI note ${keyId}: no data in response`);
      return null;
    }

    return clamp(response.data[0], MIDI_NOTE_MIN, MIDI_NOTE_MAX);
  } catch (error) {
    console.error(`Failed to read MIDI note for key ${keyId}:`, error);
    return null;
  }
};

const writeMidiNoteToDevice = async (protocol: EmberProtocol, keyId: number, midiNote: number): Promise<boolean> => {
  try {
    const value = clamp(Math.round(midiNote), MIDI_NOTE_MIN, MIDI_NOTE_MAX);
    const response = await protocol.writeQuery(midiNoteAddress(keyId), new Uint8Array([value]));
    return response.success;
  } catch (error) {
    console.error(`Failed to write MIDI note for key ${keyId}:`, error);
    return false;
  }
};

const readModeFromDevice = async (protocol: EmberProtocol): Promise<number | null> => {
  try {
    const response = await protocol.readQuery(MODE_ADDRESS, 1);

    if (!response.success) {
      console.warn('Mode read: response not successful');
      return null;
    }

    if (!response.data || response.data.length === 0) {
      console.warn('Mode read: no data in response');
      return null;
    }

    return clamp(response.data[0], MODE_MIN, MODE_MAX);
  } catch (error) {
    console.error('Failed to read keyboard mode:', error);
    return null;
  }
};

const writeModeToDevice = async (protocol: EmberProtocol, mode: number): Promise<boolean> => {
  try {
    const value = clamp(Math.round(mode), MODE_MIN, MODE_MAX);
    const response = await protocol.writeQuery(MODE_ADDRESS, new Uint8Array([value]));
    return response.success;
  } catch (error) {
    console.error('Failed to write keyboard mode:', error);
    return false;
  }
};

const readKeySwitchConfigFromDevice = async (protocol: EmberProtocol, keyId: number): Promise<KeySwitchConfigData | null> => {
  try {
    const response = await protocol.readQuery(keyConfigAddress(keyId), KEY_CONFIG_SIZE);

    if (!response.success) {
      console.warn(`Key ${keyId}: failed to read config (status)`);
      return null;
    }

    if (!response.data || response.data.length < KEY_CONFIG_SIZE) {
      console.warn(`Key ${keyId}: config response too short`);
      return null;
    }

    const data = response.data;
    return {
      keyCode: data[KEY_CONFIG_OFFSETS.keyCode],
      keyType: data[KEY_CONFIG_OFFSETS.keyType],
      actuationPointMm: data[KEY_CONFIG_OFFSETS.actuationPoint] * KEY_CONFIG_SCALE,
      rapidTriggerUpSensitivityMm: data[KEY_CONFIG_OFFSETS.rapidTriggerUpSensitivity] * KEY_CONFIG_SCALE,
      rapidTriggerDownSensitivityMm: data[KEY_CONFIG_OFFSETS.rapidTriggerDownSensitivity] * KEY_CONFIG_SCALE,
    };
  } catch (error) {
    console.error(`Failed to read key config for key ${keyId}:`, error);
    return null;
  }
};

const writeKeySwitchConfigToDevice = async (
  protocol: EmberProtocol,
  keyId: number,
  updates: KeySwitchConfigUpdate
): Promise<boolean> => {
  try {
    const writeOperations: Array<{ address: number; value: number }> = [];

    if (updates.keyCode !== undefined) {
      const rawValue = clamp(Math.round(updates.keyCode), 0, 0xff);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode), value: rawValue });
    }

    if (updates.keyType !== undefined) {
      const rawValue = clamp(Math.round(updates.keyType), 0, 0xff);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyType), value: rawValue });
    }

    if (updates.actuationPointMm !== undefined) {
      const rawValue = clamp(Math.round(updates.actuationPointMm / KEY_CONFIG_SCALE), 0, 0xff);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.actuationPoint), value: rawValue });
    }

    if (updates.rapidTriggerUpSensitivityMm !== undefined) {
      const rawValue = clamp(Math.round(updates.rapidTriggerUpSensitivityMm / KEY_CONFIG_SCALE), 0, 0xff);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.rapidTriggerUpSensitivity), value: rawValue });
    }

    if (updates.rapidTriggerDownSensitivityMm !== undefined) {
      const rawValue = clamp(Math.round(updates.rapidTriggerDownSensitivityMm / KEY_CONFIG_SCALE), 0, 0xff);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.rapidTriggerDownSensitivity), value: rawValue });
    }

    if (writeOperations.length === 0) {
      return true;
    }

    for (const { address, value } of writeOperations) {
      const response = await protocol.writeQuery(address, new Uint8Array([value]));
      if (!response.success) {
        console.error(`Failed to write key config (address=0x${address.toString(16)})`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Failed to write key config for key ${keyId}:`, error);
    return false;
  }
};

const saveConfigurationOnDevice = async (protocol: EmberProtocol): Promise<boolean> => {
  try {
    const response = await protocol.writeQuery(0x3000, new Uint8Array([0x00]));
    return response.success;
  } catch (error) {
    console.error('Failed to save configuration:', error);
    return false;
  }
};

const resetConfigurationOnDevice = async (protocol: EmberProtocol): Promise<boolean> => {
  try {
    const response = await protocol.writeQuery(0x3002, new Uint8Array([0x00]));
    return response.success;
  } catch (error) {
    console.error('Failed to reset configuration to defaults:', error);
    return false;
  }
};

export interface KeyboardState {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  device: EmberSerialDevice | null;
  error: string | null;
  deviceInfo: {
    usbVendorId?: string;
    usbProductId?: string;
  } | null;
}

export interface UseKeyboardReturn extends KeyboardState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  readMemory: (address: number, length: number) => Promise<Uint8Array | null>;
  writeMemory: (address: number, data: Uint8Array) => Promise<boolean>;
  readAllKeyMappings: () => Promise<Map<number, number>>;
  readAllMidiNotes: () => Promise<Map<number, number>>;
  readAllKeySwitchConfigs: () => Promise<Map<number, KeySwitchConfigData>>;
  saveConfiguration: () => Promise<boolean>;
  resetConfiguration: () => Promise<boolean>;
  writeKeyMapping: (keyId: number, keyCode: number) => Promise<boolean>;
  writeMidiNote: (keyId: number, midiNote: number) => Promise<boolean>;
  readKeyboardMode: () => Promise<number | null>;
  writeKeyboardMode: (mode: number) => Promise<boolean>;
  readKeySwitchConfig: (keyId: number) => Promise<KeySwitchConfigData | null>;
  writeKeySwitchConfig: (keyId: number, updates: KeySwitchConfigUpdate) => Promise<boolean>;
  // Push distance monitoring
  startPushDistanceMonitoring: (keyId: number, callback: (distance: number | null) => void) => () => void;
  // Calibration
  startCalibration: () => Promise<boolean>;
  stopCalibration: () => Promise<boolean>;
  enterDfuMode: () => Promise<boolean>;
}

export function useKeyboard(): UseKeyboardReturn {
  const [state, setState] = useState<KeyboardState>({
    isSupported: false,
    isConnected: false,
    isConnecting: false,
    device: null,
    error: null,
    deviceInfo: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);
  const protocolRef = useRef<EmberProtocol | null>(null);

  // Initialize Web Serial support check
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isSupported: isWebSerialSupported(),
    }));
  }, []);

  // Setup Serial event listeners
  useEffect(() => {
    if (!state.isSupported) return;

    const cleanup = setupSerialEventListeners(
      (port) => {
        // Serial port connected
        const info = port?.getInfo();
        
        // Create EmberProtocol instance
        protocolRef.current = new EmberProtocol(port);
        
        setState(prev => ({
          ...prev,
          isConnected: true,
          device: {
            port,
            isConnected: true,
          },
          deviceInfo: {
            usbVendorId: info?.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : undefined,
            usbProductId: info?.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : undefined,
          },
          error: null,
        }));
      },
      (port) => {
        // Serial port disconnected
        
        // Clear protocol instance
        protocolRef.current = null;
        
        setState(prev => {
          if (prev.device?.port === port) {
            return {
              ...prev,
              isConnected: false,
              device: null,
              deviceInfo: null,
              error: null,
            };
          }
          return prev;
        });
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      cleanup();
    };
  }, [state.isSupported]);

  // Connect to keyboard
  const connect = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    try {
      const emberDevice = await requestEmberSerialDevice();
      
      if (emberDevice) {
        // Create EmberProtocol instance
        protocolRef.current = new EmberProtocol(emberDevice.port);
        
        const info = emberDevice.port?.getInfo();
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          device: emberDevice,
          deviceInfo: {
            usbVendorId: info?.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : undefined,
            usbProductId: info?.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : undefined,
          },
          error: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'No Ember keyboard was selected or found.',
        }));
      }
    } catch (error: any) {
      console.error('Connection error:', error);
      
      let errorMessage = 'Failed to connect to keyboard.';
      
      if (error.name === 'NotFoundError') {
        errorMessage = 'No Ember keyboard found. Please make sure it is connected and in the correct mode.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Access denied. Please allow serial port access when prompted.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Your browser does not support Web Serial API. Please use Chrome, Edge, or Opera.';
      } else if (error.name === 'InvalidStateError') {
        errorMessage = 'Device is in an invalid state. Try disconnecting and reconnecting the keyboard.';
      } else if (error.message?.includes('Serial port')) {
        errorMessage = 'Unable to access the serial port. Please ensure no other applications are using the port and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
    }
  }, [state.isSupported]);

  // Disconnect from keyboard
  const disconnect = useCallback(async () => {
    if (!state.device) return;

    try {
      await disconnectSerialDevice(state.device);
      
      // Clear protocol instance
      protocolRef.current = null;
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        device: null,
        deviceInfo: null,
        error: null,
      }));
    } catch (error: any) {
      console.error('Disconnect error:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to disconnect: ${error.message || 'Unknown error'}`,
      }));
    }
  }, [state.device]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const readAllKeyMappingsCallback = useCallback(async (): Promise<Map<number, number>> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }

    const mappings = new Map<number, number>();
    for (let keyId = 0; keyId < TOTAL_KEY_COUNT; keyId++) {
      const keyCode = await readKeyMappingFromDevice(protocol, keyId);
      if (keyCode !== null) {
        mappings.set(keyId, keyCode);
      }
    }

    return mappings;
  }, []);

  const readAllMidiNotesCallback = useCallback(async (): Promise<Map<number, number>> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }

    const notes = new Map<number, number>();
    for (let keyId = 0; keyId < TOTAL_KEY_COUNT; keyId++) {
      const note = await readMidiNoteFromDevice(protocol, keyId);
      if (note !== null) {
        notes.set(keyId, note);
      }
    }

    return notes;
  }, []);

  const readAllKeySwitchConfigsCallback = useCallback(async (): Promise<Map<number, KeySwitchConfigData>> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }

    const configs = new Map<number, KeySwitchConfigData>();
    for (let keyId = 0; keyId < TOTAL_KEY_COUNT; keyId++) {
      const config = await readKeySwitchConfigFromDevice(protocol, keyId);
      if (config) {
        configs.set(keyId, config);
      }
    }

    return configs;
  }, []);

  const readMemoryCallback = useCallback(async (address: number, length: number): Promise<Uint8Array | null> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    const response = await protocolRef.current.readQuery(address, length);
    if (!response.success) {
      return null;
    }
    return response.data ?? new Uint8Array();
  }, []);

  const writeKeyMappingCallback = useCallback(async (keyId: number, keyCode: number): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await writeKeyMappingToDevice(protocol, keyId, keyCode);
  }, []);

  const writeMidiNoteCallback = useCallback(async (keyId: number, midiNote: number): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await writeMidiNoteToDevice(protocol, keyId, midiNote);
  }, []);

  const readKeyboardModeCallback = useCallback(async (): Promise<number | null> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await readModeFromDevice(protocol);
  }, []);

  const writeKeyboardModeCallback = useCallback(async (mode: number): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await writeModeToDevice(protocol, mode);
  }, []);

  const writeMemoryCallback = useCallback(async (address: number, data: Uint8Array): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    const response = await protocolRef.current.writeQuery(address, data);
    return response.success;
  }, []);

  const saveConfigurationCallback = useCallback(async (): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await saveConfigurationOnDevice(protocol);
  }, []);

  const resetConfigurationCallback = useCallback(async (): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await resetConfigurationOnDevice(protocol);
  }, []);

  const readKeySwitchConfigCallback = useCallback(async (keyId: number): Promise<KeySwitchConfigData | null> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await readKeySwitchConfigFromDevice(protocol, keyId);
  }, []);

  const writeKeySwitchConfigCallback = useCallback(async (keyId: number, updates: KeySwitchConfigUpdate): Promise<boolean> => {
    const protocol = protocolRef.current;
    if (!protocol) {
      throw new Error('No protocol instance available');
    }
    return await writeKeySwitchConfigToDevice(protocol, keyId, updates);
  }, []);

  // Push distance monitoring functions
  const startPushDistanceMonitoringCallback = useCallback((keyId: number, callback: (distance: number | null) => void): () => void => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }

    let monitoringActive = true;
    let consecutiveErrors = 0;

    const monitor = async () => {
      while (monitoringActive) {
        const protocol = protocolRef.current;
        if (!protocol) {
          monitoringActive = false;
          break;
        }

        try {
          const response = await protocol.readQuery(PUSH_DISTANCE_BASE_ADDRESS + keyId, 1);

          if (response.success && response.data && response.data.length > 0) {
            consecutiveErrors = 0;
            callback(response.data[0]);
          } else {
            consecutiveErrors++;
          }
        } catch (error) {
          if (isTimeoutError(error)) {
            console.warn(`Push distance read timeout for key ${keyId}`);
          } else {
            console.error(`Push distance read error for key ${keyId}:`, error);
          }
          consecutiveErrors++;
        }

        if (consecutiveErrors >= PUSH_DISTANCE_MAX_CONSECUTIVE_ERRORS) {
          console.error(`Too many consecutive errors (${consecutiveErrors}) for key ${keyId}, stopping monitoring`);
          monitoringActive = false;
          break;
        }

        await sleep(PUSH_DISTANCE_INTERVAL_MS);
      }
    };

    monitor().catch(error => {
      console.error('Push distance monitoring error:', error);
      monitoringActive = false;
    });

    return () => {
      monitoringActive = false;
    };
  }, []);

  // Calibration functions
  const startCalibrationCallback = useCallback(async (): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    try {
      // Write 1 to address 0x3001 to enable calibration
      const response = await protocolRef.current.writeQuery(0x3001, new Uint8Array([1]));
      return response.success;
    } catch (error) {
      console.error('Failed to start calibration:', error);
      return false;
    }
  }, []);

  const stopCalibrationCallback = useCallback(async (): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    try {
      // Write 0 to address 0x3001 to disable calibration
      const response = await protocolRef.current.writeQuery(0x3001, new Uint8Array([0]));
      return response.success;
    } catch (error) {
      console.error('Failed to stop calibration:', error);
      return false;
    }
  }, []);

  const enterDfuModeCallback = useCallback(async (): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    try {
      const response = await protocolRef.current.writeQuery(0x3004, new Uint8Array([0]));
      return response.success;
    } catch (error) {
      console.error('Failed to enter DFU mode:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    clearError,
    readMemory: readMemoryCallback,
    writeMemory: writeMemoryCallback,
    readAllKeyMappings: readAllKeyMappingsCallback,
  readAllMidiNotes: readAllMidiNotesCallback,
    readAllKeySwitchConfigs: readAllKeySwitchConfigsCallback,
    saveConfiguration: saveConfigurationCallback,
    resetConfiguration: resetConfigurationCallback,
    writeKeyMapping: writeKeyMappingCallback,
  writeMidiNote: writeMidiNoteCallback,
  readKeyboardMode: readKeyboardModeCallback,
  writeKeyboardMode: writeKeyboardModeCallback,
    readKeySwitchConfig: readKeySwitchConfigCallback,
    writeKeySwitchConfig: writeKeySwitchConfigCallback,
    startPushDistanceMonitoring: startPushDistanceMonitoringCallback,
    startCalibration: startCalibrationCallback,
    stopCalibration: stopCalibrationCallback,
    enterDfuMode: enterDfuModeCallback,
  };
}
