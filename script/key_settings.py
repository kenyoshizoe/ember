import serial
import sys
from ember_serial import *

# open serial port
device_name = 'COM3'
ser = serial.Serial(device_name, timeout=1)

key_id = 27

key_code = 0x0b
key_type = 0x00
actuation_point = 0x03
rappid_trigger_up_sensivity = 0x02
rappid_trigger_down_sensivity = 0x02

config = bytes([key_code, key_type, actuation_point,
                rappid_trigger_up_sensivity, rappid_trigger_down_sensivity])
result = ember_write(ser, 0x0000 + key_id * 5, config)
if (result != 0):
    print("Failure")
    exit(1)
result = ember_write(ser, 0x3000, [0x00])
if (result != 0):
    print("Failure")
    exit(1)
print("Success")
ser.close()

