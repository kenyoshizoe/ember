#include "ember/keyboard/keyboard.h"

namespace ember {
Keyboard::Keyboard(Config config) : config_(config) {
  for (int i = 0; i < 32; i++) {
    switch (config_.key_switch_configs[i].key_type) {
      case 0:
        key_switches_[i] = new ThresholdKey(config_.key_switch_configs[i]);
        break;
      case 1:
        key_switches_[i] = new RapidTriggerKey(config_.key_switch_configs[i]);
        break;
      default:
        key_switches_[i] = new ThresholdKey(config_.key_switch_configs[i]);
        break;
    }
  }
}

void Keyboard::Update() {
  uint8_t key_codes[6] = {0};
  uint8_t modifier = 0;
  uint8_t key_codes_count = 0;

  for (int i = 0; i < 32; i++) {
    if (key_switches_[i]->IsPressed()) {
      uint8_t key_code = key_switches_[i]->GetKeyCode();
      if (key_code < 0xE0) {
        key_codes[key_codes_count++] = key_code;
      } else {
        modifier |= (1 << (key_code - 0xE0));
      }

      if (key_codes_count == 6) {
        break;
      }
    }
  }
  tud_hid_keyboard_report(0, modifier, key_codes);
}

void Keyboard::SetADCValue(uint8_t adc_ch, uint8_t amux_channel,
                           uint16_t value) {
  int index = ChToIndex(adc_ch, amux_channel);
  if (index < 0 || 32 <= index) {
    return;
  }
  key_switches_[index]->Update(value);
}

void Keyboard::StartCalibrate() {
  for (int i = 0; i < 32; i++) {
    key_switches_[i]->StartCalibrate();
  }
}

void Keyboard::StopCalibrate() {
  for (int i = 0; i < 32; i++) {
    key_switches_[i]->StopCalibrate();
  }
}

int8_t Keyboard::ChToIndex(uint8_t adc_ch, uint8_t amux_channel) {
  if (3 < adc_ch || 7 < amux_channel) {
    return -1;
  }

  switch (adc_ch) {
    case 0:
      switch (amux_channel) {
        case 0:
          return 30;
        case 1:
          return 29;
        case 2:
          return 28;
        case 3:
          return 31;
        case 4:
          return 27;
        case 5:
          return 26;
        case 6:
          return 24;
        case 7:
          return 25;
        default:
          return -1;
      }
      break;
    case 1:
      switch (amux_channel) {
        case 0:
          return 22;
        case 1:
          return 21;
        case 2:
          return 16;
        case 3:
          return 23;
        case 4:
          return 17;
        case 5:
          return 19;
        case 6:
          return 20;
        case 7:
          return 18;
        default:
          return -1;
      }
      break;
    case 2:
      switch (amux_channel) {
        case 0:
          return 0;
        case 1:
          return 1;
        case 2:
          return 2;
        case 3:
          return 7;
        case 4:
          return 3;
        case 5:
          return 6;
        case 6:
          return 4;
        case 7:
          return 5;
        default:
          return -1;
      }
      break;
    case 3:
      switch (amux_channel) {
        case 0:
          return 14;
        case 1:
          return 8;
        case 2:
          return 9;
        case 3:
          return 15;
        case 4:
          return 10;
        case 5:
          return 11;
        case 6:
          return 13;
        case 7:
          return 12;
        default:
          return -1;
      }
      break;
    default:
      return -1;
  }
  return -1;
}
}  // namespace ember

// TinyUSB callbacks
// Invoked when received GET_REPORT control request
// Application must fill buffer report's content and return its length.
// Return zero will cause the stack to STALL request
uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id,
                               hid_report_type_t report_type, uint8_t* buffer,
                               uint16_t reqlen) {
  (void)instance;
  (void)report_id;
  (void)report_type;
  (void)buffer;
  (void)reqlen;
  return 0;
}

// Invoked when received SET_REPORT control request or
// received data on OUT endpoint ( Report ID = 0, Type = 0 )
void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id,
                           hid_report_type_t report_type, uint8_t const* buffer,
                           uint16_t bufsize) {
  (void)instance;
}
