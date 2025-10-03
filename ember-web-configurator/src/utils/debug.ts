// Development utilities for debugging WebSerial connection issues
export async function debugSerialPort(port: any): Promise<void> {
  if (!port) {
    console.log('No serial port provided for debugging');
    return;
  }

  console.group('🔍 Serial Port Debug Information');
  
  try {
    const info = port?.getInfo();
    console.log('📱 Serial Port Info:', {
      usbVendorId: info?.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : 'Unknown',
      usbProductId: info?.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : 'Unknown',
      readable: !!port.readable,
      writable: !!port.writable,
    });

  } catch (error) {
    console.error('❌ Error while debugging serial port:', error);
  }
  
  console.groupEnd();
}

export async function listAvailableSerialPorts(): Promise<void> {
  if (!('serial' in navigator)) {
    console.warn('⚠️ Web Serial API not supported in this browser');
    return;
  }

  try {
    const ports = await (navigator as any).serial.getPorts();
    console.group('📋 Available Serial Ports');
    
    if (ports.length === 0) {
      console.log('No serial ports have been granted access');
    } else {
      ports.forEach((port: any, index: number) => {
        const info = port?.getInfo();
        console.log(`Port ${index + 1}:`, {
          usbVendorId: info?.usbVendorId ? `0x${info.usbVendorId.toString(16).toUpperCase()}` : 'Unknown',
          usbProductId: info?.usbProductId ? `0x${info.usbProductId.toString(16).toUpperCase()}` : 'Unknown',
          readable: !!port.readable,
          writable: !!port.writable,
        });
      });
    }
    
    console.groupEnd();
  } catch (error) {
    console.error('❌ Error listing serial ports:', error);
  }
}

// Legacy USB debug functions (keeping for compatibility)
export async function debugUSBDevice(device: any): Promise<void> {
  console.warn('⚠️ debugUSBDevice is deprecated, use debugSerialPort instead');
  if (!device) {
    console.log('No device provided for debugging');
    return;
  }

  console.group('🔍 USB Device Debug Information (Legacy)');
  
  try {
    console.log('📱 Basic Device Info:', {
      vendorId: `0x${device.vendorId?.toString(16).toUpperCase()}`,
      productId: `0x${device.productId?.toString(16).toUpperCase()}`,
      productName: device.productName,
      manufacturerName: device.manufacturerName,
      serialNumber: device.serialNumber,
      deviceVersion: `${device.deviceVersionMajor}.${device.deviceVersionMinor}.${device.deviceVersionSubminor}`,
    });

    if (device.opened && device.configuration) {
      console.log('⚙️ Configuration Info:', {
        configurationValue: device.configuration.configurationValue,
        configurationName: device.configuration.configurationName,
        totalInterfaces: device.configuration.interfaces?.length || 0,
      });

      if (device.configuration.interfaces) {
        console.log('🔌 Interface Details:');
        device.configuration.interfaces.forEach((intf: any, index: number) => {
          console.log(`  Interface ${index}:`, {
            interfaceNumber: intf.interfaceNumber,
            claimed: intf.claimed,
            interfaceClass: intf.alternate?.interfaceClass,
            interfaceSubclass: intf.alternate?.interfaceSubclass,
            interfaceProtocol: intf.alternate?.interfaceProtocol,
            interfaceName: intf.alternate?.interfaceName,
            endpoints: intf.alternate?.endpoints?.map((ep: any) => ({
              endpointNumber: ep.endpointNumber,
              direction: ep.direction,
              type: ep.type,
              packetSize: ep.packetSize,
            })) || [],
          });
        });
      }
    } else {
      console.warn('⚠️ Device not opened or no configuration available');
    }

  } catch (error) {
    console.error('❌ Error while debugging device:', error);
  }
  
  console.groupEnd();
}
