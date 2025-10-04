'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useKeyboard } from '../hooks/useKeyboard';
import { getKeyByCode, KEY_MAPPINGS, type KeyMapping } from '../utils/keyMapping';
import PushDistanceVisualizer from '../components/PushDistanceVisualizer';

// Ember keyboard key definitions (32 keys)
interface KeyDefinition {
  id: number;
  label: string;
  x: number; // X position in grid units
  y: number; // Y Position in grid units
  width?: number; // Key width in grid units (default: 1)
  height?: number; // Key height in grid units (default: 1)
  angle?: number; // Key rotation angle in degrees (default: 0)
}

// Default key mappings for Ember 32-key layout (based on firmware)
const EMBER_KEYS: KeyDefinition[] = [
  { id: 0, label: '', x: 0, y: 0.2 },
  { id: 1, label: '', x: 1, y: 0.1 },
  { id: 2, label: '', x: 2, y: 0 },
  { id: 3, label: '', x: 3, y: 0 },
  { id: 4, label: '', x: 4, y: 0 },
  { id: 5, label: '', x: 5, y: 0.1 },
  { id: 6, label: '', x: 6, y: 0.2 },
  { id: 7, label: '', x: 0, y: 1.2 },
  { id: 8, label: '', x: 1, y: 1.1 },
  { id: 9, label: '', x: 2, y: 1 },
  { id: 10, label: '', x: 3, y: 1 },
  { id: 11, label: '', x: 4, y: 1 },
  { id: 12, label: '', x: 5, y: 1.1 },
  { id: 13, label: '', x: 6, y: 1.2 },
  { id: 14, label: '', x: 0, y: 2.2 },
  { id: 15, label: '', x: 1, y: 2.1 },  
  { id: 16, label: '', x: 2, y: 2 },
  { id: 17, label: '', x: 3, y: 2 },
  { id: 18, label: '', x: 4, y: 2 },
  { id: 19, label: '', x: 5, y: 2.1 },
  { id: 20, label: '', x: 6, y: 2.2 },
  { id: 21, label: '', x: 0, y: 3.2 },
  { id: 22, label: '', x: 1, y: 3.1 },
  { id: 23, label: '', x: 2, y: 3 },
  { id: 24, label: '', x: 3, y: 3 },
  { id: 25, label: '', x: 4, y: 3 },
  { id: 26, label: '', x: 5, y: 3.1 },
  { id: 27, label: '', x: 1.5, y: 4.1 },
  { id: 28, label: '', x: 2.5, y: 4.0 },
  { id: 29, label: '', x: 3.5, y: 4.0 },
  { id: 30, label: '', x: 4.5, y: 4.1 },
  { id: 31, label: '', x: 5.8, y: 3.7, height: 1.5, angle: 30 },
];

interface KeySettings {
  keyId: number;
  label: string;
  keyCode: number | null;
  midiNote: number | null;
  actuationPoint: number; // mm
  rapidTrigger: boolean;
  rapidTriggerUpSensitivity: number; // mm
  rapidTriggerDownSensitivity: number; // mm
}

const DEFAULT_KEY_SETTINGS: Omit<KeySettings, 'keyId' | 'label'> = {
  keyCode: null,
  midiNote: null,
  actuationPoint: 2.0,
  rapidTrigger: false,
  rapidTriggerUpSensitivity: 0.1,
  rapidTriggerDownSensitivity: 0.1,
};

const DEFAULT_RAPID_TRIGGER_KEY_IDS = new Set([10, 16, 17, 18]);

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const MIDI_NOTE_OPTIONS = Array.from({ length: 128 }, (_, note) => {
  const octave = Math.floor(note / 12) - 1;
  const name = MIDI_NOTE_NAMES[note % 12];
  return {
    value: note,
    label: `${note} - ${name}${octave}`,
  };
});

export default function Home() {
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [keySettings, setKeySettings] = useState<Record<number, KeySettings>>({});
  const [keyMappings, setKeyMappings] = useState<Map<number, number>>(new Map());
  const [midiNotes, setMidiNotes] = useState<Map<number, number>>(new Map());
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [distanceUpdateTick, setDistanceUpdateTick] = useState(0);
  const stopMonitoringRef = useRef<(() => void) | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [writingKeyId, setWritingKeyId] = useState<number | null>(null);
  const [writingMidiKeyId, setWritingMidiKeyId] = useState<number | null>(null);
  const [keyMappingError, setKeyMappingError] = useState<{ keyId: number | null; message: string | null }>({ keyId: null, message: null });
  const [midiMappingError, setMidiMappingError] = useState<{ keyId: number | null; message: string | null }>({ keyId: null, message: null });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isResettingSettings, setIsResettingSettings] = useState(false);
  const [isEnteringDfu, setIsEnteringDfu] = useState(false);
  const [isManualControlOpen, setIsManualControlOpen] = useState(false);
  const [manualAddressInput, setManualAddressInput] = useState('0x0000');
  const [manualValueInput, setManualValueInput] = useState('');
  const [manualStatusMessage, setManualStatusMessage] = useState<string | null>(null);
  const [manualErrorMessage, setManualErrorMessage] = useState<string | null>(null);
  const [manualActionInProgress, setManualActionInProgress] = useState<'read' | 'write' | null>(null);
  
  const { 
    isSupported, 
    isConnected, 
    isConnecting, 
    device, 
    error, 
    deviceInfo, 
    connect, 
    disconnect, 
    clearError,
    readMemory,
    writeMemory,
    readAllKeyMappings,
  readAllMidiNotes,
    readAllKeySwitchConfigs,
    saveConfiguration,
    resetConfiguration,
    writeKeyMapping,
  writeMidiNote,
    startPushDistanceMonitoring,
    startCalibration,
    stopCalibration,
    readKeySwitchConfig,
    writeKeySwitchConfig,
    enterDfuMode
  } = useKeyboard();

  const loadKeyMappings = useCallback(async () => {
    if (!isConnected) return;
    
    try {
      const mappings = await readAllKeyMappings();
      setKeyMappings(mappings);
      console.log('Loaded key mappings:', mappings);
    } catch (error) {
      console.error('Failed to load key mappings:', error);
    }
  }, [isConnected, readAllKeyMappings]);

  const loadMidiNotes = useCallback(async () => {
    if (!isConnected) return;

    try {
      const notes = await readAllMidiNotes();
      setMidiNotes(notes);
      console.log('Loaded MIDI notes:', notes);
    } catch (error) {
      console.error('Failed to load MIDI notes:', error);
    }
  }, [isConnected, readAllMidiNotes]);

  // Load key mappings when connected
  useEffect(() => {
    if (isConnected && device) {
      loadKeyMappings();
    }
  }, [isConnected, device, loadKeyMappings]);

  useEffect(() => {
    if (isConnected && device) {
      loadMidiNotes();
    }
  }, [isConnected, device, loadMidiNotes]);

  const getKeyDisplayLabel = (key: KeyDefinition): string => {
    const keyCode = keyMappings.get(key.id);
    if (keyCode !== undefined) {
      const keyMapping = getKeyByCode(keyCode);
      if (keyMapping) {
        return keyMapping.shortName;
      }
    }
    return key.label; // Fallback to default label
  };

  const handleConnect = async () => {
    clearError();
    await connect();
  };

  const handleDisconnect = async () => {
    clearError();
    await disconnect();
  };

  const handleKeyClick = (keyId: number) => {
    setSelectedKey(keyId);
    setMidiMappingError({ keyId: null, message: null });
    
    // Initialize key settings if not exists
    if (!keySettings[keyId]) {
      const keyDef = EMBER_KEYS.find(k => k.id === keyId);
      const existingKeyCode = keyMappings.get(keyId) ?? null;
      const existingMidiNote = midiNotes.get(keyId) ?? null;
      
      const hasDefaultRapidTrigger = DEFAULT_RAPID_TRIGGER_KEY_IDS.has(keyId);
      
      setKeySettings(prev => ({
        ...prev,
        [keyId]: {
          keyId,
          label: keyDef?.label || `Key ${keyId}`,
          ...DEFAULT_KEY_SETTINGS,
          keyCode: existingKeyCode,
          midiNote: existingMidiNote,
          rapidTrigger: hasDefaultRapidTrigger,
        }
      }));
    } else {
      const existingKeyCode = keyMappings.get(keyId);
      if (existingKeyCode !== undefined && keySettings[keyId].keyCode === null) {
        setKeySettings(prev => ({
          ...prev,
          [keyId]: {
            ...prev[keyId],
            keyCode: existingKeyCode,
          }
        }));
      }

      const existingMidiNote = midiNotes.get(keyId);
      if (existingMidiNote !== undefined && keySettings[keyId].midiNote === null) {
        setKeySettings(prev => ({
          ...prev,
          [keyId]: {
            ...prev[keyId],
            midiNote: existingMidiNote,
          }
        }));
      }
    }
  };

  const updateKeySettings = useCallback((keyId: number, updates: Partial<KeySettings>) => {
    setKeySettings(prev => ({
      ...prev,
      [keyId]: {
        ...prev[keyId],
        ...updates,
      }
    }));
  }, []);

  const roundToTenth = useCallback((value: number): number => {
    return Math.round(value * 10) / 10;
  }, []);

  const parseAddressInput = useCallback((input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.toLowerCase();
    const value = normalized.startsWith('0x') ? Number.parseInt(normalized, 16) : Number.parseInt(trimmed, 10);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) {
      return null;
    }
    return value;
  }, []);

  const parseValueInput = useCallback((input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.toLowerCase();
    const value = normalized.startsWith('0x') ? Number.parseInt(normalized, 16) : Number.parseInt(trimmed, 10);
    if (Number.isNaN(value) || value < 0 || value > 0xff) {
      return null;
    }
    return value;
  }, []);

  const formatByte = useCallback((value: number): string => {
    return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
  }, []);

  const handleOpenManualControl = useCallback(() => {
    setManualStatusMessage(null);
    setManualErrorMessage(null);
    setManualActionInProgress(null);
    setIsManualControlOpen(true);
  }, []);

  const handleCloseManualControl = useCallback(() => {
    setIsManualControlOpen(false);
    setManualActionInProgress(null);
  }, []);

  const handleManualRead = useCallback(async () => {
    setManualStatusMessage(null);
    if (!isConnected) {
      setManualErrorMessage('キーボードが接続されていません。');
      return;
    }

    const addressValue = parseAddressInput(manualAddressInput);
    if (addressValue === null) {
      setManualErrorMessage('アドレスが不正です。0x0000〜0xFFFFの範囲で入力してください。');
      return;
    }

    setManualErrorMessage(null);
    setManualActionInProgress('read');

    try {
      const data = await readMemory(addressValue, 1);
      if (!data || data.length === 0) {
        setManualErrorMessage('読み込みに失敗しました。');
        return;
      }
      const byteValue = data[0];
      const formatted = formatByte(byteValue);
  setManualValueInput(formatted);
  setManualStatusMessage(`読み込み成功: ${formatted} (${byteValue})`);
    } catch (error) {
      console.error('Manual read failed:', error);
      setManualErrorMessage('読み込み中にエラーが発生しました。');
    } finally {
      setManualActionInProgress(null);
    }
  }, [formatByte, isConnected, manualAddressInput, parseAddressInput, readMemory]);

  const handleManualWrite = useCallback(async () => {
    setManualStatusMessage(null);
    if (!isConnected) {
      setManualErrorMessage('キーボードが接続されていません。');
      return;
    }

    const addressValue = parseAddressInput(manualAddressInput);
    if (addressValue === null) {
      setManualErrorMessage('アドレスが不正です。0x0000〜0xFFFFの範囲で入力してください。');
      return;
    }

    const value = parseValueInput(manualValueInput);
    if (value === null) {
      setManualErrorMessage('値が不正です。0〜255 もしくは 0x00〜0xFF の範囲で入力してください。');
      return;
    }

    setManualErrorMessage(null);
    setManualActionInProgress('write');

    try {
      const success = await writeMemory(addressValue, new Uint8Array([value]));
      if (!success) {
        setManualErrorMessage('書き込みに失敗しました。');
        return;
      }
      const formatted = formatByte(value);
  setManualValueInput(formatted);
  setManualStatusMessage(`書き込み成功: ${formatted} (${value})`);
    } catch (error) {
      console.error('Manual write failed:', error);
      setManualErrorMessage('書き込み中にエラーが発生しました。');
    } finally {
      setManualActionInProgress(null);
    }
  }, [formatByte, isConnected, manualAddressInput, manualValueInput, parseAddressInput, parseValueInput, writeMemory]);

  const handleKeyAssignmentChange = useCallback(
    async (keyId: number, previousCode: number | null, rawValue: string) => {
      const newCode = rawValue === '' ? null : Number(rawValue);

      if (previousCode === newCode) {
        return;
      }

      updateKeySettings(keyId, { keyCode: newCode });
      setKeyMappingError({ keyId: null, message: null });

      if (newCode === null) {
        setKeyMappings(prev => {
          const next = new Map(prev);
          next.delete(keyId);
          return next;
        });
        return;
      }

      if (!isConnected) {
        updateKeySettings(keyId, { keyCode: previousCode });
        setKeyMappingError({ keyId, message: 'キーボードが接続されていないため書き込めません。' });
        return;
      }

      setWritingKeyId(keyId);
      try {
        const success = await writeKeyMapping(keyId, newCode);
        if (!success) {
          throw new Error('Device rejected key mapping');
        }

        setKeyMappings(prev => {
          const next = new Map(prev);
          next.set(keyId, newCode);
          return next;
        });
      } catch (error) {
        console.error('Failed to write key mapping', error);
        updateKeySettings(keyId, { keyCode: previousCode });
        setKeyMappingError({ keyId, message: 'キー割り当ての書き込みに失敗しました。' });
      } finally {
        setWritingKeyId(null);
      }
    },
    [isConnected, updateKeySettings, writeKeyMapping]
  );

  const handleMidiNoteChange = useCallback(
    async (keyId: number, previousNote: number | null, rawValue: string) => {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isNaN(parsed)) {
        return;
      }

      const newNote = Math.min(Math.max(parsed, 0), 127);

      if (previousNote === newNote) {
        return;
      }

      updateKeySettings(keyId, { midiNote: newNote });
      setMidiMappingError({ keyId: null, message: null });

      if (!isConnected) {
        updateKeySettings(keyId, { midiNote: previousNote ?? null });
        setMidiMappingError({ keyId, message: 'キーボードが接続されていないため書き込めません。' });
        return;
      }

      setWritingMidiKeyId(keyId);
      try {
        const success = await writeMidiNote(keyId, newNote);
        if (!success) {
          throw new Error('Device rejected MIDI note');
        }

        setMidiNotes(prev => {
          const next = new Map(prev);
          next.set(keyId, newNote);
          return next;
        });
      } catch (error) {
        console.error('Failed to write MIDI note', error);
        updateKeySettings(keyId, { midiNote: previousNote ?? null });
        setMidiMappingError({ keyId, message: 'MIDIノートの書き込みに失敗しました。' });
      } finally {
        setWritingMidiKeyId(null);
      }
    },
    [isConnected, updateKeySettings, writeMidiNote]
  );

  const buildDefaultKeySettings = useCallback((): Record<number, KeySettings> => {
    const defaults: Record<number, KeySettings> = {};
    EMBER_KEYS.forEach((key) => {
      const existingKeyCode = keyMappings.get(key.id) ?? null;
      const existingMidiNote = midiNotes.get(key.id) ?? null;
      defaults[key.id] = {
        keyId: key.id,
        label: key.label || `Key ${key.id}`,
        keyCode: existingKeyCode,
        midiNote: existingMidiNote,
        actuationPoint: DEFAULT_KEY_SETTINGS.actuationPoint,
        rapidTrigger: DEFAULT_RAPID_TRIGGER_KEY_IDS.has(key.id),
        rapidTriggerUpSensitivity: DEFAULT_KEY_SETTINGS.rapidTriggerUpSensitivity,
        rapidTriggerDownSensitivity: DEFAULT_KEY_SETTINGS.rapidTriggerDownSensitivity,
      };
    });
    return defaults;
  }, [keyMappings, midiNotes]);

  const refreshKeySettingsFromDevice = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    try {
      const configs = await readAllKeySwitchConfigs();
      setKeySettings(() => {
        const next = buildDefaultKeySettings();
        configs.forEach((config, keyId) => {
          const keyDefinition = EMBER_KEYS.find((k) => k.id === keyId);
          const baseDefaults =
            next[keyId] ?? {
              keyId,
              label: keyDefinition?.label ?? `Key ${keyId}`,
              ...DEFAULT_KEY_SETTINGS,
            } as KeySettings;

          next[keyId] = {
            ...baseDefaults,
            keyCode: config.keyCode ?? baseDefaults.keyCode ?? null,
            rapidTrigger: config.keyType === 1,
            actuationPoint: roundToTenth(config.actuationPointMm),
            rapidTriggerUpSensitivity: roundToTenth(config.rapidTriggerUpSensitivityMm),
            rapidTriggerDownSensitivity: roundToTenth(config.rapidTriggerDownSensitivityMm),
          };
        });
        return next;
      });
    } catch (error) {
      console.error('Failed to load key switch configs:', error);
    }
  }, [buildDefaultKeySettings, isConnected, readAllKeySwitchConfigs, roundToTenth]);

  const handleSaveAllSettings = useCallback(async () => {
    if (!isConnected) {
      console.warn('Cannot save settings while the keyboard is disconnected.');
      return;
    }

    setIsSavingSettings(true);
    try {
      const success = await saveConfiguration();
      if (!success) {
        console.error('Failed to persist configuration to device memory.');
      }
    } catch (error) {
      console.error('Failed to execute save configuration command:', error);
    } finally {
      setIsSavingSettings(false);
    }
  }, [isConnected, saveConfiguration]);

  const handleResetAllSettings = useCallback(async () => {
    setIsResettingSettings(true);

    try {
      if (isConnected) {
        const success = await resetConfiguration();
        if (!success) {
          console.error('Failed to reset configuration on device.');
        }
        await loadKeyMappings();
        await loadMidiNotes();
        await refreshKeySettingsFromDevice();
      } else {
        setKeySettings(buildDefaultKeySettings());
      }
    } catch (error) {
      console.error('Failed to reset settings to default:', error);
    } finally {
      setIsResettingSettings(false);
    }
  }, [buildDefaultKeySettings, isConnected, loadKeyMappings, loadMidiNotes, refreshKeySettingsFromDevice, resetConfiguration]);

  const handleEnterDfuMode = useCallback(async () => {
    if (!isConnected) {
      console.warn('Cannot enter DFU mode while the keyboard is disconnected.');
      return;
    }

    setIsEnteringDfu(true);
    try {
      const success = await enterDfuMode();
      if (!success) {
        console.error('Failed to enter DFU mode.');
      }
    } catch (error) {
      console.error('Error while trying to enter DFU mode:', error);
    } finally {
      setIsEnteringDfu(false);
    }
  }, [enterDfuMode, isConnected]);

  // Auto-start monitoring when key is selected
  useEffect(() => {
    const stopExistingMonitoring = stopMonitoringRef.current;
    if (stopExistingMonitoring) {
      stopExistingMonitoring();
      stopMonitoringRef.current = null;
      setCurrentDistance(null);
      setDistanceUpdateTick((tick) => tick + 1);
    }

    if (selectedKey !== null && isConnected) {
      try {
        const stopFunc = startPushDistanceMonitoring(selectedKey, (distance) => {
          setCurrentDistance(distance);
          setDistanceUpdateTick((tick) => tick + 1);
        });
        stopMonitoringRef.current = stopFunc;
      } catch (error) {
        console.error('Failed to start monitoring:', error);
      }
    }
  }, [selectedKey, isConnected, startPushDistanceMonitoring]);

  const handleStopMonitoring = useCallback(() => {
    const stopFunc = stopMonitoringRef.current;
    if (stopFunc) {
      stopFunc();
      stopMonitoringRef.current = null;
    }
    setCurrentDistance(null);
    setDistanceUpdateTick((tick) => tick + 1);
  }, []);

  // Stop monitoring when disconnected
  useEffect(() => {
    if (!isConnected) {
      handleStopMonitoring();
    }
  }, [isConnected, handleStopMonitoring]);

  useEffect(() => {
    if (!isConnected || selectedKey === null) {
      return;
    }

    let isCancelled = false;

    const loadKeyConfig = async () => {
      try {
        const config = await readKeySwitchConfig(selectedKey);
        if (!config || isCancelled) {
          return;
        }

        updateKeySettings(selectedKey, {
          actuationPoint: roundToTenth(config.actuationPointMm),
          rapidTriggerUpSensitivity: roundToTenth(config.rapidTriggerUpSensitivityMm),
          rapidTriggerDownSensitivity: roundToTenth(config.rapidTriggerDownSensitivityMm),
          rapidTrigger: config.keyType === 1,
        });
      } catch (err) {
        console.error(`Failed to load key config for key ${selectedKey}:`, err);
      }
    };

    void loadKeyConfig();

    return () => {
      isCancelled = true;
    };
  }, [isConnected, selectedKey, readKeySwitchConfig, roundToTenth, updateKeySettings]);

  useEffect(() => {
    if (!isConnected || !device) return;
    void refreshKeySettingsFromDevice();
  }, [device, isConnected, refreshKeySettingsFromDevice]);

  // Calibration functions
  const handleStartCalibration = async () => {
    if (!isConnected) return;
    
    try {
      setIsCalibrating(true);
      const success = await startCalibration();
      if (!success) {
        console.error('Failed to start calibration');
      }
    } catch (error) {
      console.error('Error starting calibration:', error);
    }
  };

  const handleStopCalibration = async () => {
    if (!isConnected) return;
    
    try {
      const success = await stopCalibration();
      if (success) {
        setIsCalibrating(false);
      } else {
        console.error('Failed to stop calibration');
      }
    } catch (error) {
      console.error('Error stopping calibration:', error);
    }
  };

  const selectedKeySettings = selectedKey !== null ? keySettings[selectedKey] : null;
  const selectedKeyDef = selectedKey !== null ? EMBER_KEYS.find(k => k.id === selectedKey) : null;
  const keyMappingGroups = useMemo<[string, KeyMapping[]][]>(() => {
    const groups = new Map<string, KeyMapping[]>();
    KEY_MAPPINGS.forEach((mapping) => {
      if (!groups.has(mapping.category)) {
        groups.set(mapping.category, []);
      }
      groups.get(mapping.category)!.push(mapping);
    });
    return Array.from(groups.entries());
  }, []);

  useEffect(() => {
    setKeySettings((prev) => {
      let updated = prev;
      keyMappings.forEach((code, keyId) => {
        const existing = prev[keyId];
        if (existing && (existing.keyCode === null || existing.keyCode === undefined)) {
          if (updated === prev) {
            updated = { ...prev };
          }
          updated[keyId] = {
            ...existing,
            keyCode: code,
          };
        }
      });
      return updated;
    });
  }, [keyMappings]);

  useEffect(() => {
    setKeySettings((prev) => {
      let updated = prev;
      midiNotes.forEach((note, keyId) => {
        const existing = prev[keyId];
        if (existing && existing.midiNote !== note) {
          if (updated === prev) {
            updated = { ...prev };
          }
          updated[keyId] = {
            ...existing,
            midiNote: note,
          };
        }
      });
      return updated;
    });
  }, [midiNotes]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-gray-900">🔥 Ember</div>
              <div className="text-2xl font-bold text-gray-600">| Web Configurator</div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span>
                  {isConnecting ? 'Connecting...' : (isConnected ? 'Connected' : 'Disconnected')}
                </span>
              </div>

              {/* Device Info */}
              {deviceInfo && (
                <div className="text-xs text-gray-500">
                  VID: {deviceInfo.usbVendorId || 'Unknown'} | PID: {deviceInfo.usbProductId || 'Unknown'}
                </div>
              )}

              {/* Connect/Disconnect Button */}
              <button 
                onClick={isConnected ? handleDisconnect : handleConnect}
                disabled={isConnecting || !isSupported}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isConnecting
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : isConnected
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isConnecting ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-4 mt-4 rounded-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-red-500">⚠️</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={clearError}
              className="text-red-500 hover:text-red-700 ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* WebSerial Not Supported Warning */}
      {!isSupported && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 mx-4 mt-4 rounded-md">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-500">⚠️</span>
            <span>
              Web Serial API is not supported in your browser. Please use Chrome, Edge, or Opera to connect to your Ember keyboard.
            </span>
          </div>
        </div>
      )}

      {/* Main Content - 左右分割レイアウト */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Keyboard Visualizer */}
        <div className="flex-1 bg-white border-r border-gray-200 p-8">
          <div className="h-full flex flex-col">
            {!isConnected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    {isSupported ? '🔌' : '⚠️'}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {isSupported 
                      ? 'Connect Your Ember Keyboard' 
                      : 'Browser Not Supported'
                    }
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {isSupported 
                      ? 'Please connect your Ember keyboard via USB to begin configuration.'
                      : 'Web Serial API is required for this application. Please use Chrome, Edge, or Opera.'
                    }
                  </p>
                  {isSupported && (
                    <button 
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className={`px-6 py-3 rounded-md font-medium transition-colors ${
                        isConnecting
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isConnecting ? 'Connecting...' : 'Connect Keyboard'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                  {/* Keyboard Layout */}
                  <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                    <div 
                      className="relative"
                      style={{
                        width: '480px', // 8 keys * 60px per key
                        height: '300px', // 5 rows * 60px per row
                      }}
                    >
                      {EMBER_KEYS.map((key) => (
                        <button
                          key={key.id}
                          onClick={() => handleKeyClick(key.id)}
                          className={`
                            absolute rounded text-sm font-medium transition-all duration-200 px-3 flex items-center justify-center
                            ${selectedKey === key.id 
                              ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-300' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }
                            ${keySettings[key.id]?.rapidTrigger ? 'ring-1 ring-yellow-400' : ''}
                          `}
                          style={{
                            left: `${key.x * 60}px`,
                            top: `${key.y * 60}px`,
                            width: `${(key.width || 1) * 60 - 8}px`, // -8px for gap
                            height: `${(key.height || 1) * 60 - 8}px`, // -8px for gap
                            transform: key.angle ? `rotate(${key.angle}deg)` : undefined,
                            transformOrigin: 'center',
                          }}
                        >
                          {getKeyDisplayLabel(key)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Control Panel */}
                <div className="bg-white rounded-lg p-4 shadow-sm mt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Control Panel</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Calibration Controls */}
                    <div className="flex space-x-2">
                      <button
                        onClick={handleStartCalibration}
                        disabled={!isConnected || isCalibrating}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          !isConnected || isCalibrating
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <span>▶️</span>
                        <span>Start Calibration</span>
                      </button>
                      
                      <button
                        onClick={handleStopCalibration}
                        disabled={!isConnected || !isCalibrating}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          !isConnected || !isCalibrating
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        <span>⏹️</span>
                        <span>Stop Calibration</span>
                      </button>
                    </div>

                    {/* Calibration Status */}
                    {isCalibrating && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-md text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="animate-pulse">🔵</span>
                          <span>Calibration in progress... Press keys to their maximum and minimum positions.</span>
                        </div>
                      </div>
                    )}

                    {/* Global Key Actions */}
                    <div className="space-y-3">
                      <button
                        onClick={handleSaveAllSettings}
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center space-x-2 ${
                          isSavingSettings || !isConnected || Object.keys(keySettings).length === 0
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        disabled={isSavingSettings || !isConnected || Object.keys(keySettings).length === 0}
                      >
                        <span>{isSavingSettings ? '⏳' : '💾'}</span>
                        <span>{isSavingSettings ? 'Saving All Settings...' : 'Save Settings'}</span>
                      </button>

                      <div className="flex space-x-2">
                        <button
                          onClick={handleResetAllSettings}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center space-x-2 ${
                            isResettingSettings
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                          disabled={isResettingSettings}
                        >
                          <span>{isResettingSettings ? '⏳' : '♻️'}</span>
                          <span>{isResettingSettings ? 'Resetting...' : 'Reset to Default'}</span>
                        </button>

                        <button
                          onClick={handleEnterDfuMode}
                          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center space-x-2 ${
                            isEnteringDfu || !isConnected
                              ? 'bg-gray-400 text-white cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }`}
                          disabled={isEnteringDfu || !isConnected}
                        >
                          <span>{isEnteringDfu ? '⏳' : '🚀'}</span>
                          <span>{isEnteringDfu ? 'Entering DFU...' : 'Enter DFU Mode'}</span>
                        </button>
                      </div>

                      <button
                        onClick={handleOpenManualControl}
                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center space-x-2 ${
                          !isConnected
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                        disabled={!isConnected}
                      >
                        <span>🛠️</span>
                        <span>Manual Address Control</span>
                      </button>

                      {!isConnected && (
                        <p className="text-xs text-gray-500">
                          Connect your keyboard to write settings to the device.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Key Settings */}
        <div className="w-96 bg-gray-50 p-6 overflow-y-auto">
          <div className="h-full">
            {selectedKey === null ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-4">⌨️</div>
                  <h3 className="text-lg font-semibold mb-2">Select a Key</h3>
                  <p className="text-sm">
                    Click on any key in the keyboard to view and edit its settings.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedKeySettings && selectedKey !== null && (
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-gray-900 mb-3">Key Mapping</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Key Code
                        </label>
                        <select
                          value={selectedKeySettings.keyCode !== null ? selectedKeySettings.keyCode.toString() : ''}
                          onChange={(e) => handleKeyAssignmentChange(selectedKeySettings.keyId, selectedKeySettings.keyCode, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={writingKeyId === selectedKeySettings.keyId}
                        >
                          <option value="">Select a key</option>
                          {keyMappingGroups.map(([category, mappings]) => (
                            <optgroup key={category} label={category}>
                              {mappings.map((mapping) => (
                                <option key={mapping.code} value={String(mapping.code)}>
                                  {mapping.fullName}{mapping.shortName !== mapping.fullName ? ` (${mapping.shortName})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {writingKeyId === selectedKeySettings.keyId && (
                          <p className="mt-2 text-xs text-blue-600">キーボードに書き込み中...</p>
                        )}
                        {keyMappingError.keyId === selectedKeySettings.keyId && keyMappingError.message && (
                          <p className="mt-2 text-xs text-red-600">{keyMappingError.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          MIDI Note
                        </label>
                        <select
                          value={selectedKeySettings.midiNote !== null ? selectedKeySettings.midiNote.toString() : ''}
                          onChange={(e) => handleMidiNoteChange(selectedKeySettings.keyId, selectedKeySettings.midiNote, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={writingMidiKeyId === selectedKeySettings.keyId}
                        >
                          <option value="" disabled>
                            Select a MIDI note
                          </option>
                          {MIDI_NOTE_OPTIONS.map((option) => (
                            <option key={option.value} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {writingMidiKeyId === selectedKeySettings.keyId && (
                          <p className="mt-2 text-xs text-blue-600">MIDIノートを書き込み中...</p>
                        )}
                        {midiMappingError.keyId === selectedKeySettings.keyId && midiMappingError.message && (
                          <p className="mt-2 text-xs text-red-600">{midiMappingError.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Push Distance Visualizer */}
                {selectedKey !== null && selectedKeyDef && (
                  <PushDistanceVisualizer
                    keyId={selectedKey}
                    keyLabel={selectedKeyDef.label}
                    actuationPoint={selectedKeySettings?.actuationPoint || 2.0}
                    currentDistance={currentDistance}
                    distanceUpdateTick={distanceUpdateTick}
                  />
                )}

                {selectedKeySettings && selectedKey !== null && (
                  <>
                    {/* Hall Effect Settings */}
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h4 className="font-semibold text-gray-900 mb-3">Hall Effect Settings</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Actuation Point: {selectedKeySettings.actuationPoint}mm
                          </label>
                          <input
                            type="range"
                            min="0.5"
                            max="4.0"
                            step="0.1"
                            value={selectedKeySettings.actuationPoint}
                            onChange={async (e) => {
                              const rawValue = parseFloat(e.target.value);
                              const roundedValue = roundToTenth(rawValue);
                              updateKeySettings(selectedKeySettings.keyId, { actuationPoint: roundedValue });
                              const success = await writeKeySwitchConfig(selectedKeySettings.keyId, { actuationPointMm: roundedValue });
                              if (!success) {
                                console.error(`Failed to write actuation point for key ${selectedKeySettings.keyId}`);
                              }
                            }}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0.5mm</span>
                            <span>4.0mm</span>
                          </div>
                        </div>
                        
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedKeySettings.rapidTrigger}
                            onChange={async (e) => {
                              const enabled = e.target.checked;
                              updateKeySettings(selectedKeySettings.keyId, { rapidTrigger: enabled });
                              const success = await writeKeySwitchConfig(selectedKeySettings.keyId, { keyType: enabled ? 3 : 2 });
                              if (!success) {
                                console.error(`Failed to write rapid trigger mode for key ${selectedKeySettings.keyId}`);
                              }
                            }}
                            className="form-checkbox h-4 w-4 text-blue-600"
                          />
                          <span className="text-sm font-medium text-gray-700">Enable Rapid Trigger</span>
                        </label>
                        
                        {selectedKeySettings.rapidTrigger && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Up Sensitivity: {selectedKeySettings.rapidTriggerUpSensitivity.toFixed(1)}mm
                              </label>
                              <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={Number(selectedKeySettings.rapidTriggerUpSensitivity.toFixed(1))}
                                onChange={async (e) => {
                                  const rawValue = parseFloat(e.target.value);
                                  const roundedValue = roundToTenth(rawValue);
                                  updateKeySettings(selectedKeySettings.keyId, { rapidTriggerUpSensitivity: roundedValue });
                                  const success = await writeKeySwitchConfig(selectedKeySettings.keyId, { rapidTriggerUpSensitivityMm: roundedValue });
                                  if (!success) {
                                    console.error(`Failed to write rapid trigger up sensitivity for key ${selectedKeySettings.keyId}`);
                                  }
                                }}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0.1mm</span>
                                <span>1.0mm</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Down Sensitivity: {selectedKeySettings.rapidTriggerDownSensitivity.toFixed(1)}mm
                              </label>
                              <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={Number(selectedKeySettings.rapidTriggerDownSensitivity.toFixed(1))}
                                onChange={async (e) => {
                                  const rawValue = parseFloat(e.target.value);
                                  const roundedValue = roundToTenth(rawValue);
                                  updateKeySettings(selectedKeySettings.keyId, { rapidTriggerDownSensitivity: roundedValue });
                                  const success = await writeKeySwitchConfig(selectedKeySettings.keyId, { rapidTriggerDownSensitivityMm: roundedValue });
                                  if (!success) {
                                    console.error(`Failed to write rapid trigger down sensitivity for key ${selectedKeySettings.keyId}`);
                                  }
                                }}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0.1mm</span>
                                <span>1.0mm</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isManualControlOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manual Address Control</h3>
                <p className="mt-1 text-sm text-gray-500">
                  メモリアドレスを指定して1バイトの読み書きを行います。
                </p>
              </div>
              <button
                onClick={handleCloseManualControl}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close manual address control"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="manual-address-input">
                  Address
                </label>
                <input
                  id="manual-address-input"
                  type="text"
                  value={manualAddressInput}
                  onChange={(e) => {
                    setManualAddressInput(e.target.value);
                    setManualErrorMessage(null);
                    setManualStatusMessage(null);
                  }}
                  placeholder="例: 0x2000 または 8192"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">範囲: 0x0000〜0xFFFF</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="manual-value-input">
                  Value
                </label>
                <input
                  id="manual-value-input"
                  type="text"
                  value={manualValueInput}
                  onChange={(e) => {
                    setManualValueInput(e.target.value);
                    setManualErrorMessage(null);
                    setManualStatusMessage(null);
                  }}
                  placeholder="例: 0x1A または 26"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="mt-1 text-xs text-gray-500">1バイト (0〜255 / 0x00〜0xFF)</p>
              </div>

              {manualErrorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {manualErrorMessage}
                </div>
              )}

              {manualStatusMessage && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {manualStatusMessage}
                </div>
              )}

              {!isConnected && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                  キーボードとの接続が解除されました。再接続後に再度操作してください。
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleCloseManualControl}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Close
                </button>
                <div className="flex space-x-2">
                  <button
                    onClick={handleManualRead}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      manualActionInProgress === 'read'
                        ? 'bg-blue-400 text-white cursor-wait'
                        : isConnected
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                    disabled={manualActionInProgress !== null || !isConnected}
                  >
                    {manualActionInProgress === 'read' ? 'Reading...' : 'Read'}
                  </button>
                  <button
                    onClick={handleManualWrite}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      manualActionInProgress === 'write'
                        ? 'bg-green-400 text-white cursor-wait'
                        : isConnected
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                    disabled={manualActionInProgress !== null || !isConnected}
                  >
                    {manualActionInProgress === 'write' ? 'Writing...' : 'Write'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
