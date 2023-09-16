from ember_serial import *
import serial

# open serial port
device_name = 'COM3'
ser = serial.Serial(device_name, timeout=1)

address = 0x3004
data = [0x00]

write_query = []
write_query.append(0x01)
write_query.append(address >> 8)
write_query.append(address & 0xFF)
write_query.append(len(data))
write_query += data
write_query = cobs.encode(bytes(write_query)) + b'\x00'
ser.write(write_query)
ser.flush()
