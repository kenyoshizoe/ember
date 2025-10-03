// Ember Keyboard Communication Protocol Manager
import { cobsEncode, cobsDecode, EMBER_COMMANDS, type EmberCommand } from './cobs';
import { debugSerialPort } from './debug';

declare global {
  interface Navigator {
    serial?: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
      addEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void): void;
      removeEventListener(type: 'connect' | 'disconnect', listener: (event: SerialConnectionEvent) => void): void;
    };
  }
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialConnectionEvent extends Event {
  readonly port: SerialPort;
}

export interface EmberSerialDevice {
  port: SerialPort;
  isConnected: boolean;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
}

// Serial Port type definition
interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

/**
 * Ember Protocol Query Types
 */
export interface EmberQuery {
  address: number;
  length: number;
  data?: Uint8Array; // Only for write operations
}

export interface EmberResponse {
  success: boolean;
  address: number;
  length: number;
  data?: Uint8Array; // Only for read operations
}

/**
 * Web Serial APIがサポートされているかチェック
 */
export function isWebSerialSupported(): boolean {
  return 'serial' in navigator && navigator.serial !== undefined;
}

/**
 * Ember キーボードのシリアルポートに接続
 */
export async function requestEmberSerialDevice(): Promise<EmberSerialDevice | null> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser');
  }

  try {
    const port = await navigator.serial!.requestPort({
      filters: [
        { usbVendorId: 0xCAFE }, // Ember keyboard VID
      ],
    });

    if (!port) {
      return null;
    }

    await connectSerialDevice(port);

    // Debug information for development
    if (process.env.NODE_ENV === 'development') {
      await debugSerialPort(port);
    }

    return {
      port,
      isConnected: true,
    };
  } catch (error) {
    console.error('Failed to request serial port:', error);
    throw error;
  }
}

/**
 * シリアルポートに接続
 */
export async function connectSerialDevice(port: SerialPort): Promise<void> {
  try {
    await port.open({
      baudRate: 115200, // Ember keyboard の通信速度
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });

    console.log('Successfully connected to Ember keyboard via Serial:', {
      usbVendorId: `0x${port?.getInfo()?.usbVendorId?.toString(16).toUpperCase() || 'Unknown'}`,
      usbProductId: `0x${port?.getInfo()?.usbProductId?.toString(16).toUpperCase() || 'Unknown'}`,
    });
  } catch (error) {
    console.error('Failed to connect to serial port:', error);
    throw error;
  }
}

/**
 * シリアルポートから切断
 * 注意: EmberProtocol インスタンスを使用している場合は、
 * この関数を呼ぶ前に protocol.cleanup() を呼び出してください
 */
export async function disconnectSerialDevice(device: EmberSerialDevice): Promise<void> {
  try {
    // リーダーとライターを閉じる
    if (device.reader) {
      await device.reader.cancel();
      device.reader.releaseLock();
    }
    if (device.writer) {
      await device.writer.close();
    }

    // ポートを閉じる
    await device.port.close();

    console.log('Disconnected from Ember keyboard serial port');
  } catch (error) {
    console.error('Failed to disconnect from serial port:', error);
    throw error;
  }
}

/**
 * 利用可能なEmberキーボードのシリアルポートを取得
 */
export async function getPairedEmberSerialDevices(): Promise<EmberSerialDevice[]> {
  if (!isWebSerialSupported()) {
    return [];
  }

  try {
    const ports = await navigator.serial!.getPorts();
    const emberDevices: EmberSerialDevice[] = [];

    for (const port of ports) {
      const info = port?.getInfo();
      
      // Ember keyboard のVIDと一致するかチェック
      if (info?.usbVendorId === 0xCAFE) {
        emberDevices.push({
          port,
          isConnected: false, // ポートが開いているかは別途チェックが必要
        });
      }
    }

    return emberDevices;
  } catch (error) {
    console.error('Failed to get paired serial devices:', error);
    return [];
  }
}

/**
 * シリアルポート接続/切断イベントリスナーを設定
 */
export function setupSerialEventListeners(
  onConnect: (port: SerialPort) => void,
  onDisconnect: (port: SerialPort) => void
): () => void {
  if (!isWebSerialSupported()) {
    return () => {};
  }

  const handleConnect = (event: SerialConnectionEvent) => {
    const port = event.port;
    const info = port?.getInfo();
    
    // Ember keyboard かチェック
    if (info?.usbVendorId === 0xCAFE) {
      console.log('Ember keyboard serial port connected');
      onConnect(port);
    }
  };

  const handleDisconnect = (event: SerialConnectionEvent) => {
    const port = event.port;
    const info = port?.getInfo();
    
    // Ember keyboard かチェック
    if (info?.usbVendorId === 0xCAFE) {
      console.log('Ember keyboard serial port disconnected');
      onDisconnect(port);
    }
  };

  navigator.serial!.addEventListener('connect', handleConnect);
  navigator.serial!.addEventListener('disconnect', handleDisconnect);

  // クリーンアップ関数を返す
  return () => {
    navigator.serial!.removeEventListener('connect', handleConnect);
    navigator.serial!.removeEventListener('disconnect', handleDisconnect);
  };
}

/**
 * Ember Protocol Communication Manager
 * Handles Query→Response communication with proper serialization
 */
export class EmberProtocol {
  private port: SerialPort;
  private isTransactionActive = false;
  private responseTimeout = 3000; // 1 second timeout
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(port: SerialPort) {
    this.port = port;
  }

  private async acquireTransactionLock(): Promise<() => void> {
    let releaseLock: (() => void) | undefined;

    const previousLock = this.transactionQueue;
    this.transactionQueue = previousLock.then(
      () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve;
        })
    );

    await previousLock;
    return () => {
      if (releaseLock) {
        releaseLock();
        releaseLock = undefined;
      }
    };
  }

  private async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquireTransactionLock();
    this.isTransactionActive = true;
    try {
      return await operation();
    } finally {
      this.isTransactionActive = false;
      release();
    }
  }

  /**
   * Execute a read query and wait for response
   */
  async readQuery(address: number, length: number): Promise<EmberResponse> {
    const query: EmberQuery = {
      address,
      length
    };

    return this.executeRawQuery(query);
  }

  /**
   * Execute raw query for push distance reads (not using EMBER_COMMANDS)
   */
  private async executeRawQuery(query: EmberQuery): Promise<EmberResponse> {
    return this.withTransaction(async () => {
      // Create raw query packet for push distance reading
      const queryPacket = this.createRawQueryPacket(query);

      // Send query
      await this.sendPacket(queryPacket);

      // Wait for response
      const response = await this.waitForResponse();

      return response;
    });
  }

  /**
   * Create raw query packet for push distance reads
   */
  private createRawQueryPacket(query: EmberQuery): Uint8Array {
    // Create packet for direct memory read (4 bytes: command, address_high, address_low, length)
    const packet = new Uint8Array(4);
    
    // Byte 0: Command (0=Read)
    packet[0] = 0x00;
    
    // Bytes 1-2: Address (Big Endian)
    packet[1] = (query.address >> 8) & 0xFF; 
    packet[2] = query.address & 0xFF;         
    
    // Byte 3: Length
    packet[3] = query.length;
    
    return packet;
  }

  /**
   * Execute a write query and wait for response
   */
  async writeQuery(address: number, data: Uint8Array): Promise<EmberResponse> {
    const query: EmberQuery = {
      address,
      length: data.length,
      data
    };

    return this.executeQuery(EMBER_COMMANDS.WRITE_KEY_MAPPING, query);
  }

  /**
   * Execute query with exclusive access control
   */
  private async executeQuery(command: EmberCommand, query: EmberQuery): Promise<EmberResponse> {
    return this.withTransaction(async () => {
      // Create query packet according to protocol
      const queryPacket = this.createQueryPacket(command, query);

      // Send query
      await this.sendPacket(queryPacket);

      // Wait for response
      const response = await this.waitForResponse();

      return response;
    });
  }

  /**
   * Create query packet according to Ember protocol
   */
  private createQueryPacket(command: EmberCommand, query: EmberQuery): Uint8Array {
    const isWrite = (command === EMBER_COMMANDS.WRITE_KEY_MAPPING);
    
    // Calculate packet size
    const packetSize = 4 + (isWrite ? query.data!.length : 0);
    const packet = new Uint8Array(packetSize);
    
    // Byte 0: Command (0=Read, 1=Write)
    packet[0] = isWrite ? 1 : 0;
    
    // Bytes 1-2: Address (Big Endian)
    packet[1] = (query.address >> 8) & 0xFF; 
    packet[2] = query.address & 0xFF;         
    
    // Byte 3: Length
    packet[3] = query.length;
    
    // Bytes 4+: Data (for write operations)
    if (isWrite && query.data) {
      packet.set(query.data, 4);
    }
    
    return packet;
  }

  /**
   * Send packet with COBS encoding
   */
  private async sendPacket(packet: Uint8Array): Promise<void> {
    if (!this.port.writable) {
      throw new Error('Port is not writable');
    }

    // Encode with COBS directly (no extra command byte)
    const encodedPacket = cobsEncode(packet);
    
    // Add delimiter for packet boundary
    const packetWithDelimiter = new Uint8Array(encodedPacket.length + 1);
    packetWithDelimiter.set(encodedPacket);
    packetWithDelimiter[encodedPacket.length] = 0x00; // Delimiter
    
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(packetWithDelimiter);
      
      // Debug logging
      const encodedHex = Array.from(packetWithDelimiter).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
      console.log(`TX [${packetWithDelimiter.length}]: ${encodedHex}`);
    } finally {
      writer.releaseLock();
    }
  }

  /**
   * Wait for response with timeout
   */
  private async waitForResponse(): Promise<EmberResponse> {
    if (!this.port.readable) {
      throw new Error('Port is not readable');
    }

    // 各リクエストごとに新しいリーダーを作成（グローバルリーダーを使わない）
    const reader = this.port.readable.getReader();
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Response timeout')), this.responseTimeout);
      });

      const readPromise = this.readResponseData(reader);
      
      const responseData = await Promise.race([readPromise, timeoutPromise]);
      
      return this.parseResponse(responseData);
    } catch (error) {
      // タイムアウトや他のエラーが発生した場合、確実にリーダーをキャンセル
      try {
        await reader.cancel();
      } catch (cancelError) {
        console.warn('Failed to cancel reader:', cancelError);
      }
      throw error;
    } finally {
      // 必ずリーダーをリリース
      try {
        reader.releaseLock();
      } catch (releaseError) {
        console.warn('Failed to release reader lock:', releaseError);
      }
    }
  }

  /**
   * Read response data from stream until delimiter
   */
  private async readResponseData(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
    const buffer: number[] = [];
    let foundDelimiter = false;
    const maxBufferSize = 1024; // Prevent excessive memory usage
    let totalBytesRead = 0;

    while (!foundDelimiter) {
      const result = await reader.read();
      
      if (result.done) {
        throw new Error('Stream ended unexpectedly');
      }
      
      totalBytesRead += result.value.length;
      
      // Debug logging for each chunk
      const hex = Array.from(result.value).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
      
      // Process each byte
      for (let i = 0; i < result.value.length; i++) {
        const byte = result.value[i];
        if (byte === 0x00) {
          // Found delimiter - packet complete
          foundDelimiter = true;
          break;
        } else {
          buffer.push(byte);
          
          // Prevent buffer overflow
          if (buffer.length > maxBufferSize) {
            throw new Error('Response packet too large');
          }
        }
      }
    }
    
    const responseData = new Uint8Array(buffer);
    
    // Debug logging for complete packet
    const completeHex = Array.from(responseData).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
    console.log(`RX [${responseData.length}]: ${completeHex}`);
    
    return responseData;
  }

  /**
   * Parse response according to Ember protocol
   */
  private parseResponse(rawData: Uint8Array): EmberResponse {
    // Decode COBS directly (response doesn't have extra command byte)
    const payload = cobsDecode(rawData);
    if (!payload) {
      console.error('Failed to decode COBS packet');
      throw new Error('Failed to decode COBS packet');
    }

    if (payload.length < 4) {
      console.error(`Response packet too short: ${payload.length} bytes`);
      throw new Error('Response packet too short');
    }

    // Parse response structure
    const success = payload[0] === 0;
    const address = (payload[1] << 8) | payload[2]; // Big Endian: high byte first (matching Python script)
    const length = payload[3];
    
    let data: Uint8Array | undefined;
    if (length > 0 && payload.length >= 4 + length) {
      data = payload.slice(4, 4 + length);
    } else if (length > 0) {
      console.error(`Response packet too short for expected data length: payload=${payload.length}, expected=${4 + length}`);
    } else {
      console.log(`No data expected (length=0)`);
    }

    return {
      success,
      address,
      length,
      data
    };
  }

  /**
   * Read push distance for specific key (equivalent to Python ember_read for 0x2000 + key_id)
   */
  async readPushDistance(keyId: number): Promise<number | null> {
    // Address calculation: 0x2000 + keyId (same as Python script)
    const address = 0x2000 + keyId;
    const length = 1;

    try {
      const response = await this.readQuery(address, length);
      
      if (!response.success || !response.data || response.data.length === 0) {
        return null;
      }
      
      // Return push distance data (0-40mm range)
      return response.data[0];
    } catch (error) {
      // タイムアウトエラーは静かに処理（ログスパムを避ける）
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn(`Push distance read timeout for key ${keyId}`);
      } else {
        console.error(`Push distance read error for key ${keyId}:`, error);
      }
      return null;
    }
  }

  /**
   * Start continuous push distance monitoring for a specific key
   */
  startPushDistanceMonitoring(
    keyId: number, 
    callback: (distance: number | null) => void,
    intervalMs: number = 10  // デフォルト10ms間隔
  ): () => void {
    let monitoringActive = true;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // 連続エラー数の上限
    
    const monitor = async () => {
      while (monitoringActive) {
        // 前のリクエストが完全に終了するまで待機
        if (!this.isTransactionActive) {
          try {
            const distance = await this.readPushDistance(keyId);
            if (distance !== null) {
              consecutiveErrors = 0; // 成功したらエラーカウンタをリセット
              callback(distance);
            } else {
              consecutiveErrors++;
              if (consecutiveErrors >= maxConsecutiveErrors) {
                console.error(`Too many consecutive errors (${consecutiveErrors}) for key ${keyId}, stopping monitoring`);
                monitoringActive = false;
                break;
              }
            }
          } catch (error) {
            consecutiveErrors++;
            console.error(`Push distance monitoring error for key ${keyId}:`, error);
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error(`Too many consecutive errors (${consecutiveErrors}) for key ${keyId}, stopping monitoring`);
              monitoringActive = false;
              break;
            }
          }
        } else {
          // トランザクションが進行中の場合はスキップ
          console.log(`Skipping push distance read for key ${keyId} - transaction in progress`);
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    };

    // Start monitoring
    monitor().catch(error => {
      console.error('Push distance monitoring error:', error);
      monitoringActive = false;
    });

    // Return stop function
    return () => {
      monitoringActive = false;
    };
  }

  /**
   * Set response timeout
   */
  setResponseTimeout(timeoutMs: number): void {
    this.responseTimeout = timeoutMs;
  }

  /**
   * Check if transaction is active
   */
  isActive(): boolean {
    return this.isTransactionActive;
  }

  /**
   * Cleanup resources (call when disconnecting)
   */
  cleanup(): void {
    // グローバルリーダーは使用していないため、トランザクション状態のみリセット
    this.isTransactionActive = false;
    this.transactionQueue = Promise.resolve();
  }
}

/**
 * Helper functions for specific operations
 */

/**
 * Read key mapping for specific key
 */
const KEY_CONFIG_SIZE = 5;
const KEY_CONFIG_BASE_ADDRESS = 0x0000;

const KEY_CONFIG_OFFSETS = {
  keyCode: 0,
  keyType: 1,
  actuationPoint: 2,
  rapidTriggerUpSensitivity: 3,
  rapidTriggerDownSensitivity: 4,
} as const;

const KEY_CONFIG_SCALE = 0.1; // Values stored in 0.1mm units

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

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const keyConfigAddress = (keyId: number, offset: number = 0): number => {
  return KEY_CONFIG_BASE_ADDRESS + keyId * KEY_CONFIG_SIZE + offset;
};

export async function readKeySwitchConfig(protocol: EmberProtocol, keyId: number): Promise<KeySwitchConfigData | null> {
  try {
    const address = keyConfigAddress(keyId);
    const response = await protocol.readQuery(address, KEY_CONFIG_SIZE);

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
}

export async function readAllKeySwitchConfigs(protocol: EmberProtocol): Promise<Map<number, KeySwitchConfigData>> {
  const configs = new Map<number, KeySwitchConfigData>();
  for (let keyId = 0; keyId < 32; keyId++) {
    const config = await readKeySwitchConfig(protocol, keyId);
    if (config) {
      configs.set(keyId, config);
    }
  }
  return configs;
}

export async function writeKeySwitchConfig(protocol: EmberProtocol, keyId: number, updates: KeySwitchConfigUpdate): Promise<boolean> {
  try {
    const writeOperations: Array<{ address: number; value: number }> = [];

    if (updates.keyCode !== undefined) {
      const rawValue = clamp(Math.round(updates.keyCode), 0, 0xFF);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode), value: rawValue });
    }

    if (updates.keyType !== undefined) {
      const rawValue = clamp(Math.round(updates.keyType), 0, 0xFF);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyType), value: rawValue });
    }

    if (updates.actuationPointMm !== undefined) {
      const rawValue = clamp(Math.round(updates.actuationPointMm / KEY_CONFIG_SCALE), 0, 0xFF);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.actuationPoint), value: rawValue });
    }

    if (updates.rapidTriggerUpSensitivityMm !== undefined) {
      const rawValue = clamp(Math.round(updates.rapidTriggerUpSensitivityMm / KEY_CONFIG_SCALE), 0, 0xFF);
      writeOperations.push({ address: keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.rapidTriggerUpSensitivity), value: rawValue });
    }

    if (updates.rapidTriggerDownSensitivityMm !== undefined) {
      const rawValue = clamp(Math.round(updates.rapidTriggerDownSensitivityMm / KEY_CONFIG_SCALE), 0, 0xFF);
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
}

export async function saveConfiguration(protocol: EmberProtocol): Promise<boolean> {
  try {
    const response = await protocol.writeQuery(0x3000, new Uint8Array([0x00]));
    return response.success;
  } catch (error) {
    console.error('Failed to save configuration:', error);
    return false;
  }
}

export async function resetConfiguration(protocol: EmberProtocol): Promise<boolean> {
  try {
    const response = await protocol.writeQuery(0x3002, new Uint8Array([0x00]));
    return response.success;
  } catch (error) {
    console.error('Failed to reset configuration to defaults:', error);
    return false;
  }
}

export async function readKeyMapping(protocol: EmberProtocol, keyId: number): Promise<number | null> {
  try {
    const address = keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode);
    const response = await protocol.readQuery(address, 1); // Read 1 byte (key_code)
    
    if (!response.success) {
      console.warn(`Key ${keyId}: response not successful`);
      return null;
    }
    
    if (!response.data || response.data.length === 0) {
      console.warn(`Key ${keyId}: no data in response`);
      return null;
    }
    
    const keyCode = response.data[0];
    
    return keyCode; // Return key_code
  } catch (error) {
    console.error(`Failed to read key mapping for key ${keyId}:`, error);
    return null;
  }
}

/**
 * Write key mapping for specific key
 */
export async function writeKeyMapping(protocol: EmberProtocol, keyId: number, keyCode: number): Promise<boolean> {
  try {
    const address = keyConfigAddress(keyId, KEY_CONFIG_OFFSETS.keyCode);
    const data = new Uint8Array([keyCode]);
    const response = await protocol.writeQuery(address, data);
    
    return response.success;
  } catch (error) {
    console.error(`Failed to write key mapping for key ${keyId}:`, error);
    return false;
  }
}

/**
 * Read all key mappings
 */
export async function readAllKeyMappings(protocol: EmberProtocol): Promise<Map<number, number>> {
  const mappings = new Map<number, number>();
  for (let keyId = 0; keyId < 32; keyId++) {
    const keyCode = await readKeyMapping(protocol, keyId);
    if (keyCode !== null) {
      mappings.set(keyId, keyCode);
    }
  }
  return mappings;
}
