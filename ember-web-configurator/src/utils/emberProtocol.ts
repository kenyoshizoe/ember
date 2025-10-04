// Ember Keyboard Communication Protocol Manager
import {cobsDecode, cobsEncode, EMBER_COMMANDS, type EmberCommand} from './cobs';

// Web Serial API Type Definitions
// Reference: https://developer.mozilla.org/ja/docs/Web/API/Web_Serial_API
declare global {
  interface Navigator {
    serial?: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
      addEventListener(
          type: 'connect'|'disconnect',
          listener: (event: SerialConnectionEvent) => void): void;
      removeEventListener(
          type: 'connect'|'disconnect',
          listener: (event: SerialConnectionEvent) => void): void;
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
  dataBits?: 7|8;
  stopBits?: 1|2;
  parity?: 'none'|'even'|'odd';
  bufferSize?: number;
  flowControl?: 'none'|'hardware';
}
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
interface SerialConnectionEvent extends Event {
  readonly port: SerialPort;
}
interface SerialPort {
  readonly readable: ReadableStream<Uint8Array>|null;
  readonly writable: WritableStream<Uint8Array>|null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface EmberSerialDevice {
  port: SerialPort;
  isConnected: boolean;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
}

/**
 * Ember Protocol Query Types
 */
export interface EmberQuery {
  address: number;
  length: number;
  data?: Uint8Array;  // Only for write operations
}

export interface EmberResponse {
  success: boolean;
  address: number;
  length: number;
  data?: Uint8Array;  // Only for read operations
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
export async function requestEmberSerialDevice():
    Promise<EmberSerialDevice|null> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API is not supported in this browser');
  }

  try {
    const port = await navigator.serial!.requestPort({
      filters: [
        {usbVendorId: 0xCAFE},  // Ember keyboard VID
      ],
    });

    if (!port) {
      return null;
    }

    await connectSerialDevice(port);

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
      baudRate: 115200,  // Ember keyboard の通信速度
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none',
    });

    console.log('Successfully connected to Ember keyboard via Serial:', {
      usbVendorId: `0x${
          port?.getInfo()?.usbVendorId?.toString(16).toUpperCase() ||
          'Unknown'}`,
      usbProductId: `0x${
          port?.getInfo()?.usbProductId?.toString(16).toUpperCase() ||
          'Unknown'}`,
    });
  } catch (error) {
    console.error('Failed to connect to serial port:', error);
    throw error;
  }
}

/**
 * シリアルポートから切断
 */
export async function disconnectSerialDevice(device: EmberSerialDevice):
    Promise<void> {
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
export async function getPairedEmberSerialDevices():
    Promise<EmberSerialDevice[]> {
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
          isConnected: false,  // ポートが開いているかは別途チェックが必要
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
    onDisconnect: (port: SerialPort) => void): () => void {
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
  private responseTimeout = 3000;  // 1 second timeout
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(port: SerialPort) {
    this.port = port;
  }

  private async acquireTransactionLock(): Promise<() => void> {
    let releaseLock: (() => void)|undefined;

    const previousLock = this.transactionQueue;
    this.transactionQueue =
        previousLock.then(() => new Promise<void>((resolve) => {
                            releaseLock = resolve;
                          }));

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
    return this.withTransaction(async () => {
      const packet = new Uint8Array(4);
      packet[0] = 0x00;
      packet[1] = (address >> 8) & 0xff;
      packet[2] = address & 0xff;
      packet[3] = length;
      return this.sendQuery(packet);
    });
  }

  /**
   * Execute a write query and wait for response
   */
  async writeQuery(address: number, data: Uint8Array): Promise<EmberResponse> {
    return this.withTransaction(async () => {
      const packet = new Uint8Array(4 + data.length);
      packet[0] = 0x01;
      packet[1] = (address >> 8) & 0xff;
      packet[2] = address & 0xff;
      packet[3] = data.length;
      packet.set(data, 4);
      return this.sendQuery(packet);
    });
  }

  /**
   * Send packet with COBS encoding
   */
  private async sendQuery(packet: Uint8Array): Promise<EmberResponse> {
    if (!this.port.writable) {
      throw new Error('Port is not writable');
    }
    if (!this.port.readable) {
      throw new Error('Port is not readable');
    }

    // Encode with COBS directly (no extra command byte)
    const encodedPacket = cobsEncode(packet);
    const packetWithDelimiter = new Uint8Array(encodedPacket.length + 1);
    packetWithDelimiter.set(encodedPacket);
    packetWithDelimiter[encodedPacket.length] = 0x00;  // Delimiter

    const writer = this.port.writable.getWriter();
    const reader = this.port.readable.getReader();

    try {
      await writer.write(packetWithDelimiter);
    } finally {
      writer.releaseLock();
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
            () => reject(new Error('Response timeout')), this.responseTimeout);
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
  private async readResponseData(
      reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
    const buffer: number[] = [];
    let foundDelimiter = false;
    const maxBufferSize = 1024;  // Prevent excessive memory usage

    while (!foundDelimiter) {
      const result = await reader.read();
      if (result.done) {
        throw new Error('Stream ended unexpectedly');
      }

      // Process each byte
      for (let i = 0; i < result.value.length; i++) {
        const byte = result.value[i];
        if (byte === 0x00) {
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
    return new Uint8Array(buffer);
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
    const address = (payload[1] << 8) | payload[2];  // Big Endian
    const length = payload[3];

    let data: Uint8Array|undefined;
    if (length > 0) {
      if (payload.length === 4 + length) {
        data = payload.slice(4, payload.length);
      } else {
        console.error(
            `Response packet size mismatch: expected ${4 + length}, got ${payload.length}`);
        throw new Error('Response packet size mismatch');
      }
    }
    return {success, address, length, data};
  }
}
