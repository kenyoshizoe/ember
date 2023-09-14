# Ember
## Overview
48Key Hall Effect Keyboard for Gaming.

## Communication
このキーボードはHID&CDC複合デバイスとして認識されます。
各種設定はCDCから行うことができます。

This keyboard is recognized as HID&CDC composite device.
Configuration (Keymapping, Calibration, Rapid Trigger, etc...) can be done from CDC.

### Packet Structure
Query (Read)
| Bytes     | Description |
| --------- | ----------- |
| 0x00      | 0           |
| 0x01~0x02 | Address     |
| 0x03      | Length      |

Response (Read)
| Bytes           | Description        |
| --------------- | ------------------ |
| 0x00            | Success=0 Failed=1 |
| 0x01~0x02       | Address            |
| 0x03            | Length             |
| 0x04~(Length+4) | Data               |

Query (Write)
| Bytes           | Description |
| --------------- | ----------- |
| 0x00            | 1           |
| 0x01~0x02       | Address     |
| 0x03            | Length      |
| 0x04~(Length+4) | Data        |

Response (Write)
| Bytes     | Description        |
| --------- | ------------------ |
| 0x00      | Success=0 Failed=1 |
| 0x01~0x02 | Address            |
| 0x03      | Length             |

これらのクエリ/レスポンスをCOBSを用いてエンコード/デコードしてから送受信します。
Send these query with encoding/decoding with COBS.

### Address Map
| Address       | Description                      | W/R |
| ------------- | -------------------------------- | --- |
| 0x0000-0x0004 | Key0 Config                      | W/R |
| 0x0005-0x0009 | Key1 Config                      | W/R |
| 0x0012-0x001A | Key2 Config                      | W/R |
| ...           | ...                              | ... |
| 0x0117-0x0120 | Key47 Config                     | W/R |
| 0x0121-0x0FFF | Reserved                         | -   |
| 0x1000-0x1003 | Key0 Calibaration Data           | R   |
| 0x1004-0x1007 | Key1 Calibaration Data           | R   |
| ...           | ...                              | ... |
| 0x107C-0x107F | Key47 Calibration Data           | R   |
| 0x1080-0x1FFF | Reserved                         | -   |
| 0x2000        | Key0 Push distance               | R   |
| 0x2001        | Key1 Push distance               | R   |
| ...           | ...                              | ... |
| 0x2030        | Key47 Push distance              | R   |
| 0x2031-0x2FFF | Reserved                         | -   |
| 0x3000        | Calibration (1=Enable 0=Disable) | W   |
| 0x3001        | Reset Config to default          | W   |
| 0x3002        | Reset MCU                        | W   |
| 0x3003        | Enter DFU (1=Enable 0=Disable)   | W   |

それぞれのキーの設定は次のようになっています。
Each key config is as follows:
| Address | Description                               |
| ------- | ----------------------------------------- |
| 0x00    | key_code                                  |
| 0x01    | key_type (0: Threadhold, 1: RapidTrigger) |
| 0x06    | actuation_point (0.1mm unit)              |
| 0x07    | rappid_trigger_up_sensivity               |
| 0x08    | rappid_trigger_down_sensivity             |

それぞれのキーのキャリブレーションデータは以下のようになっています。
Each key calibration data is as follows:
| Address   | Description |
| --------- | ----------- |
| 0x00~0x01 | max_value   |
| 0x02~0x03 | min_value   |
