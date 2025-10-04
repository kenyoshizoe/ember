#include "ember/commnication/configrator.h"

#include "ember/module/flash.h"
#include "ember/utils/cobs.h"
#include "tusb.h"

namespace ember {
void Configurator::Init() {}

void Configurator::Task() {
  // 1文字ずつ読み取り、リングバッファに追加
  while (tud_cdc_available()) {
    uint8_t c;
    if (tud_cdc_read(&c, 1) == 1) {
      if (c == 0x00) {
        ProcessCompleteMessage();
      } else {
        if (rx_queue_.full()) rx_queue_.pop();
        rx_queue_.push(c);
      }
    }
  }
}

void Configurator::ProcessCompleteMessage() {
  // リングバッファからメッセージを取得
  uint8_t buf[kBufSize];
  uint8_t decoded_buf[kBufSize];

  size_t write_index = 0;
  while (!rx_queue_.empty() && write_index < kBufSize) {
    buf[write_index] = rx_queue_.front();
    rx_queue_.pop();
    write_index++;
  }

  // COBS Decode
  size_t decoded_length =
      COBS::decode(buf, write_index, decoded_buf);  // デリミタを除く
  if (decoded_length < 4) {
    uint8_t response[] = {0x01, 0x00, 0x00, 0x00};
    tud_cdc_write(response, 4);
    tud_cdc_write_flush();
    return;
  }

  // Parse
  uint8_t func_code = decoded_buf[0];
  unsigned int address = decoded_buf[1] << 8 | decoded_buf[2];
  unsigned int length = decoded_buf[3];

  if (func_code == 0) {  // Read
    uint32_t response_length = 4 + length;

    // 最大レスポンスサイズを制限
    static constexpr uint32_t MAX_RESPONSE_SIZE = 512;
    if (response_length > MAX_RESPONSE_SIZE) {
      uint8_t response[] = {0x01, 0x00, 0x00, 0x00};
      tud_cdc_write(response, 4);
      tud_cdc_write_flush();
      return;
    }

    uint8_t response[kBufSize];
    response[0] = 0x01;
    response[1] = address >> 8;
    response[2] = address & 0xFF;
    response[3] = length;

    if (0x0000 <= address &&
        address + length - 1 < 0x0000 + sizeof(config_->key_switch_configs)) {
      // Key Settings
      response[0] = 0x00;
      memcpy(response + 4,
             reinterpret_cast<uint8_t*>(&config_->key_switch_configs) + address,
             length);
    }

    if (0x0100 <= address &&
        address + length - 1 < 0x1000 + sizeof(config_->midi_configs)) {
      // MIDI Note Number
      response[0] = 0x00;
      memcpy(response + 4,
             reinterpret_cast<uint8_t*>(&config_->midi_configs) +
                 (address - 0x0100),
             length);
    }

    if (0x1000 <= address &&
        address + length - 1 <
            0x1000 + sizeof(config_->key_switch_calibration_data)) {
      // Calibration Data
      response[0] = 0x00;
      memcpy(response + 4,
             reinterpret_cast<uint8_t*>(&config_->key_switch_calibration_data) +
                 (address - 0x1000),
             length);
    }

    if (0x2000 <= address && address + length - 1 < 0x2000 + 32) {
      // Push Distance
      response[0] = 0x00;
      for (unsigned int i = 0; i < length; i++) {
        response[4 + i] = static_cast<uint8_t>(
            keyboard_->key_switches_[(address - 0x2000) + i]->GetPosition());
      }
    }

    if (0x4000 == address) {
      // Mode
      response[0] = 0x00;
      response[4] = static_cast<uint8_t>(config_->mode);
    }

    // Send Response
    uint32_t encoded_length = COBS::getEncodedBufferSize(response_length);
    uint8_t encoded_buf[kBufSize + 256];  // COBSエンコード用の追加バッファ
    COBS::encode(response, response_length, encoded_buf);
    encoded_buf[encoded_length] = 0x00;

    tud_cdc_write(encoded_buf, encoded_length + 1);
    tud_cdc_write_flush();
  } else if (func_code == 1) {
    if (decoded_length != length + 4) {
      // Invalid Length
      uint8_t response[2] = {0x01, 0x00};
      tud_cdc_write(response, 2);
      tud_cdc_write_flush();
      return;
    }

    // Write
    uint8_t response[4];
    response[0] = 0x01;
    response[1] = address >> 8;
    response[2] = address & 0xFF;
    response[3] = 0x00;
    uint8_t* data = decoded_buf + 4;

    // Key Settings
    if (0x0000 <= address &&
        address + length - 1 <= 0x0000 + sizeof(config_->key_switch_configs)) {
      memcpy(reinterpret_cast<uint8_t*>(&config_->key_switch_configs) + address,
             data, length);
      response[0] = 0x00;
    }

    // MIDI Note Number
    if (0x0100 <= address &&
        address + length - 1 <= 0x1000 + sizeof(config_->midi_configs)) {
      memcpy(reinterpret_cast<uint8_t*>(&config_->midi_configs) +
                 (address - 0x0100),
             data, length);
      response[0] = 0x00;
    }

    // Device Control
    if (0x3000 <= address && length == 1) {
      response[0] = 0x00;
      switch (address) {
        case 0x3000:
          // Save Config
          response[0] = Flash::SaveConfig(*config_);
          break;
        case 0x3001:
          // Calibration
          if (data[0] == 0x00) {
            // Stop Calibration
            config_->mode = Config::Mode::KEYBOARD;
          } else {
            // Start Calibration
            config_->mode = Config::Mode::CALIBRATE;
          }
          break;
        case 0x3002:
          // Reset config to default
          *config_ = Flash::GetDefaultConfig();
          config_->mode = Config::Mode::DISABLED;
          break;
        case 0x3003:
          // Reset MCU
          HAL_NVIC_SystemReset();
          break;
        case 0x3004:
          // Enter DFU Mode
          switchToBootloader = 0x11;
          NVIC_SystemReset();
          break;
        case 0x4000:
          if (data[0] <= static_cast<uint8_t>(Config::Mode::MIDI)) {
            config_->mode = static_cast<Config::Mode>(data[0]);
          }
          break;
        default:
          // Unknown command
          response[0] = 0x01;
          break;
      }
    }

    // Send Response
    uint32_t encoded_length = COBS::getEncodedBufferSize(4);
    uint8_t encoded_buf[256];  // COBSエンコード用バッファ（4バイト +
                               // エンコード用余裕）
    COBS::encode(response, 4, encoded_buf);
    encoded_buf[encoded_length] = 0x00;
    tud_cdc_write(encoded_buf, encoded_length + 1);
    tud_cdc_write_flush();
  }
}
}  // namespace ember

// TinyUSB Callbacks
void tud_cdc_rx_cb(uint8_t itf) { ember::Configurator::GetInstance()->Task(); }
