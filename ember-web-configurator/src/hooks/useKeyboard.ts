// React Hook for managing Ember keyboard connection via Web Serial API
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  EmberSerialDevice, 
  isWebSerialSupported, 
  requestEmberSerialDevice, 
  disconnectSerialDevice, 
  getPairedEmberSerialDevices,
  setupSerialEventListeners
} from '../utils/emberProtocol';
import { EmberProtocol, readAllKeyMappings as protocolReadAllKeyMappings, readAllKeySwitchConfigs as protocolReadAllKeySwitchConfigs, readKeyMapping as protocolReadKeyMapping, readKeySwitchConfig as protocolReadKeySwitchConfig, resetConfiguration as protocolResetConfiguration, saveConfiguration as protocolSaveConfiguration, writeKeyMapping as protocolWriteKeyMapping, writeKeySwitchConfig as protocolWriteKeySwitchConfig, type KeySwitchConfigData, type KeySwitchConfigUpdate } from '../utils/emberProtocol';

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
  refresh: () => Promise<void>;
  readKeyMapping: (keyId: number) => Promise<number | null>;
  readAllKeyMappings: () => Promise<Map<number, number>>;
  readAllKeySwitchConfigs: () => Promise<Map<number, KeySwitchConfigData>>;
  saveConfiguration: () => Promise<boolean>;
  resetConfiguration: () => Promise<boolean>;
  writeKeyMapping: (keyId: number, keyCode: number) => Promise<boolean>;
  readKeySwitchConfig: (keyId: number) => Promise<KeySwitchConfigData | null>;
  writeKeySwitchConfig: (keyId: number, updates: KeySwitchConfigUpdate) => Promise<boolean>;
  // Push distance monitoring
  startPushDistanceMonitoring: (keyId: number, callback: (distance: number | null) => void) => () => void;
  readKeyPushDistance: (keyId: number) => Promise<number | null>;
  // Calibration
  startCalibration: () => Promise<boolean>;
  stopCalibration: () => Promise<boolean>;
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

  // Refresh connection state
  const refresh = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const pairedDevices = await getPairedEmberSerialDevices();
      const connectedDevice = pairedDevices.find(d => d.isConnected);

      if (connectedDevice) {
        const info = connectedDevice.port?.getInfo();
        setState(prev => ({
          ...prev,
          isConnected: true,
          device: connectedDevice,
          deviceInfo: {
            usbVendorId: info?.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : undefined,
            usbProductId: info?.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : undefined,
          },
          error: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isConnected: false,
          device: null,
          deviceInfo: null,
        }));
      }
    } catch (error: any) {
      console.error('Refresh error:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to refresh: ${error.message || 'Unknown error'}`,
      }));
    }
  }, [state.isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // KeyCode reading functions
  const readKeyMappingCallback = useCallback(async (keyId: number): Promise<number | null> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolReadKeyMapping(protocolRef.current, keyId);
  }, []);

  const readAllKeyMappingsCallback = useCallback(async (): Promise<Map<number, number>> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolReadAllKeyMappings(protocolRef.current);
  }, []);

  const readAllKeySwitchConfigsCallback = useCallback(async (): Promise<Map<number, KeySwitchConfigData>> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolReadAllKeySwitchConfigs(protocolRef.current);
  }, []);

  const writeKeyMappingCallback = useCallback(async (keyId: number, keyCode: number): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolWriteKeyMapping(protocolRef.current, keyId, keyCode);
  }, []);

  const saveConfigurationCallback = useCallback(async (): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolSaveConfiguration(protocolRef.current);
  }, []);

  const resetConfigurationCallback = useCallback(async (): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolResetConfiguration(protocolRef.current);
  }, []);

  const readKeySwitchConfigCallback = useCallback(async (keyId: number): Promise<KeySwitchConfigData | null> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolReadKeySwitchConfig(protocolRef.current, keyId);
  }, []);

  const writeKeySwitchConfigCallback = useCallback(async (keyId: number, updates: KeySwitchConfigUpdate): Promise<boolean> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolWriteKeySwitchConfig(protocolRef.current, keyId, updates);
  }, []);

  // Push distance monitoring functions
  const startPushDistanceMonitoringCallback = useCallback((keyId: number, callback: (distance: number | null) => void): () => void => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return protocolRef.current.startPushDistanceMonitoring(keyId, callback);
  }, []);

  const readKeyPushDistanceCallback = useCallback(async (keyId: number): Promise<number | null> => {
    if (!protocolRef.current) {
      throw new Error('No protocol instance available');
    }
    return await protocolRef.current.readPushDistance(keyId);
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

  return {
    ...state,
    connect,
    disconnect,
    clearError,
    refresh,
    readKeyMapping: readKeyMappingCallback,
    readAllKeyMappings: readAllKeyMappingsCallback,
    readAllKeySwitchConfigs: readAllKeySwitchConfigsCallback,
    saveConfiguration: saveConfigurationCallback,
    resetConfiguration: resetConfigurationCallback,
    writeKeyMapping: writeKeyMappingCallback,
    readKeySwitchConfig: readKeySwitchConfigCallback,
    writeKeySwitchConfig: writeKeySwitchConfigCallback,
    startPushDistanceMonitoring: startPushDistanceMonitoringCallback,
    readKeyPushDistance: readKeyPushDistanceCallback,
    startCalibration: startCalibrationCallback,
    stopCalibration: stopCalibrationCallback,
  };
}
