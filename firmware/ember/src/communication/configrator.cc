#include "ember/commnication/configrator.h"

#include "ember/module/flash.h"
#include "ember/utils/cobs.h"

namespace ember {
void Configurator::Init() {
  // Set Delimiter
  tud_cdc_set_wanted_char(0x00);
}

void Configurator::Task() {
  // Read
  uint32_t buf_length = tud_cdc_available();
  uint8_t* buf = new uint8_t[buf_length];
  tud_cdc_read(buf, buf_length);

  // COBS Decode
  uint8_t* decoded_buf = new uint8_t[buf_length];
  size_t decoded_length = COBS::decode(buf, buf_length, decoded_buf);
  decoded_length -= 1;  // Remove Delimiter
  delete buf;

  if (decoded_length < 4) {
    delete decoded_buf;
    uint8_t response[] = {0x01, 0x00};
    tud_cdc_write(&response, 2);
    tud_cdc_write_flush();
    return;
  }

  // Parse
  uint8_t func_code = decoded_buf[0];
  uint16_t address = decoded_buf[1] << 8 | decoded_buf[2];
  uint8_t length = decoded_buf[3];

  // Check Address
  if (func_code == 0) {
    // Read
    uint32_t response_length = 4 + length;
    uint8_t* response = new uint8_t[response_length];
    response[0] = 0x01;
    response[1] = address >> 8;
    response[2] = address & 0xFF;
    response[3] = length;

    if (0x0000 <= address && address <= 0x0120 &&
        address + length - 1 <= 0x0120) {
      // Key Settings
      response[0] = 0x00;
      memcpy(response + 4,
             reinterpret_cast<uint8_t*>(&config_->key_switch_configs) + address,
             length);
    }

    if (0x1000 <= address && address <= 0x107F &&
        address + length - 1 <= 0x107F) {
      // Calibration Data
      response[0] = 0x00;
      memcpy(response + 4,
             reinterpret_cast<uint8_t*>(&config_->key_switch_calibration_data) +
                 address - 0x1000,
             length);
    }

    if (0x2000 <= address && address <= 0x2030 &&
        address + length - 1 <= 0x2030) {
      // Push Distance
      response[0] = 0x00;
      for (int i = 0; i < length; i++) {
        response[4 + i] =
            keyboard_->key_switches_[address - 0x2000 + i]->GetLastPosition();
      }
    }

    // Send Response
    uint32_t encoded_length = COBS::getEncodedBufferSize(response_length);
    uint8_t* encoded_buf = new uint8_t[encoded_length + 1];
    COBS::encode(response, response_length, encoded_buf);
    encoded_buf[encoded_length] = 0x00;
    tud_cdc_write(encoded_buf, encoded_length + 1);
    tud_cdc_write_flush();

    delete encoded_buf;
    delete response;
  } else if (func_code == 1) {
    if (decoded_length != length + 4) {
      // Invalid Length
      uint8_t response[2] = {0x01, 0x00};
      tud_cdc_write(response, 2);
      tud_cdc_write_flush();
      return;
    }

    // Write
    uint8_t* response = new uint8_t[4];
    response[0] = 0x01;
    response[1] = address >> 8;
    response[2] = address & 0xFF;
    response[3] = length;
    uint8_t* data = decoded_buf + 4;

    // Key Settings
    if (0x0000 <= address && address <= 0x0120 &&
        address + length - 1 <= 0x0120) {
      memcpy(reinterpret_cast<uint8_t*>(&config_->key_switch_configs) + address,
             data, length);
      response[0] = 0x00;
    }

    // Device Control
    if (0x3000 <= address && address <= 0x3003 &&
        address + length - 1 <= 0x3003) {
      for (int i = 0; i < length; i++) {
        switch (address + i) {
          case 0x3000:
            // Calibration
            if (data[i] == 0x00) {
              // Stop Calibration
              keyboard_->StopCalibrate();
              response[0] = 0x00;
            } else {
              // Start Calibration
              keyboard_->StartCalibrate();
              response[0] = 0x00;
            }
            break;
          case 0x3001:
            // Reset config to default
            *config_ = Flash::GetDefaultConfig();
            response[0] = 0x00;
            break;
          case 0x3002:
            // Reset MCU
            HAL_NVIC_SystemReset();
            break;
          case 0x3003:
            // Enter DFU Mode
            // TODO: Implement
            break;
        }
      }
    }

    // Send Response
    uint32_t encoded_length = COBS::getEncodedBufferSize(4);
    uint8_t* encoded_buf = new uint8_t[encoded_length + 1];
    COBS::encode(response, 4, encoded_buf);
    encoded_buf[encoded_length] = 0x00;
    tud_cdc_write(encoded_buf, encoded_length + 1);
    tud_cdc_write_flush();

    delete encoded_buf;
    delete response;
  }

  delete decoded_buf;
}
}  // namespace ember

// TinyUSB Callbacks
void tud_cdc_rx_wanted_cb(uint8_t itf, char wanted_char) {
  ember::Configurator::GetInstance()->Task();
}
