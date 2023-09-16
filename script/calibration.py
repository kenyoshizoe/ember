import serial
import sys
from ember_serial import *

# open serial port
device_name = 'COM3'
ser = serial.Serial(device_name, timeout=1)

if len(sys.argv) == 1:
    print("Usage: python serial_test_calibration.py [option=start|stop|save]")
    exit(1)

result = 1
if sys.argv[1] == "save":
    result = ember_write(ser, 0x3000, [0x00])
elif sys.argv[1] == "stop":
    result = ember_write(ser, 0x3000, [0x00])
elif sys.argv[1] == "start":
    result = ember_write(ser, 0x3001, [0x01])

print("Success" if result == 0 else "Failure")
ser.close()
