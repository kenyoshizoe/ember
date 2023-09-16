import serial
from cobs import cobs


def ember_write(ser: serial.Serial, address, data):
    write_query = []
    write_query.append(0x01)
    write_query.append(address >> 8)
    write_query.append(address & 0xFF)
    write_query.append(len(data))
    write_query += data
    write_query = cobs.encode(bytes(write_query)) + b'\x00'
    ser.write(write_query)
    ser.flush()
    response = cobs.decode(ser.read_until(b'\x00')[:-1])
    return response[0]


def ember_read(ser: serial.Serial, address, len):
    read_query = []
    read_query.append(0x00)
    read_query.append(address >> 8)
    read_query.append(address & 0xFF)
    read_query.append(len)
    read_query = cobs.encode(bytes(read_query)) + b'\x00'
    ser.write(read_query)
    ser.flush()
    response = cobs.decode(ser.read_until(b'\x00')[:-1])
    return response[4:]
