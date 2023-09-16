import serial
import sys
from ember_serial import *

# open serial port
device_name = 'COM3'
ser = serial.Serial(device_name, timeout=1)

key_id = 0
if len(sys.argv) > 1:
    key_id = int(sys.argv[1])

key_config = ember_read(ser, 0x0000 + key_id * 5, 5)
key_code = key_config[0]
key_type = key_config[1]
actuation_point = key_config[2]

print("Key ID  : " + str(key_id))
print("Key Code: " + str(key_code))
print("Key Type: " + "Threadhold" if key_type == 0 else "Rapid Trigger")

print(" " * 5 + " " * actuation_point + "\033[31m|\033[0m")

try:
    while True:
        data = ember_read(ser, 0x2000 + key_id, 1)
        bar = "0mm |" + ("=" * data[0]) + (" " * (40 - data[0])) + "| 40mm"
        print("\r" + bar, end="")
except KeyboardInterrupt:
    ser.close()
