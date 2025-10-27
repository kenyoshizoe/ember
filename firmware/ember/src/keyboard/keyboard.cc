#include "ember/keyboard/keyboard.h"

#include <cmath>

namespace ember {
Keyboard::Keyboard(Config& config) : config_(config) {
  for (int i = 0; i < 32; i++)
    key_switches_[i] = new DisabledKey(config_.key_switch_configs[i],
                                       config_.key_switch_calibration_data[i]);
}

void Keyboard::Update() {
  // Check Key Type and Recreate if needed
  for (int i = 0; i < 32; i++) {
    switch (config_.mode) {
      case Config::Mode::DISABLED:
        SetKeyType<DisabledKey>(i);
        continue;
      case Config::Mode::CALIBRATE:
        SetKeyType<CalibratingKey>(i);
        continue;
      case Config::Mode::KEYBOARD:
        if (config_.key_switch_configs[i].key_type ==
            KeySwitchConfig::KeyType::DISABLED) {
          SetKeyType<DisabledKey>(i);
        } else if (config_.key_switch_configs[i].key_type ==
                   KeySwitchConfig::KeyType::CALIBRATE) {
          SetKeyType<CalibratingKey>(i);
        } else if (config_.key_switch_configs[i].key_type ==
                   KeySwitchConfig::KeyType::THRESHOLD) {
          SetKeyType<ThresholdKey>(i);
        } else if (config_.key_switch_configs[i].key_type ==
                   KeySwitchConfig::KeyType::RAPID_TRIGGER) {
          SetKeyType<RapidTriggerKey>(i);
        } else {
          SetKeyType<DisabledKey>(i);
        }
        continue;
      case Config::Mode::MIDI:
        if (config_.key_switch_configs[i].key_type ==
            KeySwitchConfig::KeyType::DISABLED) {
          SetKeyType<DisabledKey>(i);
        } else {
          SetKeyType<ThresholdKey>(i);
        }
        continue;
      default:
        break;
    }
  }

  switch (config_.mode) {
    case Config::Mode::DISABLED:
      break;
    case Config::Mode::KEYBOARD:
      UpdateKeyboard();
      break;
    case Config::Mode::MIDI:
      UpdateMIDI();
      break;
  }
}

void Keyboard::SetADCValue(uint8_t adc_ch, uint8_t amux_channel,
                           uint16_t value) {
  int index = ChToIndex(adc_ch, amux_channel);
  if (index < 0 || 32 <= index) {
    return;
  }
  key_switches_[index]->Update(value);
}

void Keyboard::UpdateKeyboard() {
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

void Keyboard::UpdateMIDI() {
  for (int i = 0; i < 32; i++) {
    uint8_t cable_number = 0;

    if (key_switches_[i]->IsPressed() && !was_pressed_[i]) {
      uint8_t midi_note = config_.midi_configs[i].note_number;
      uint8_t velocity = 0;  // 0-127

      float vel = key_switches_[i]->GetVelocity();
      if (vel < 0) vel = 0;
      if (127 < vel) vel = 127;
      velocity = static_cast<uint8_t>(std::round(vel));

      uint8_t midi_message[4] = {
          static_cast<uint8_t>((cable_number << 4) | 0x9), 0x90, midi_note,
          velocity};
      tud_midi_packet_write(midi_message);

    } else if (!key_switches_[i]->IsPressed() && was_pressed_[i]) {
      uint8_t midi_note = config_.midi_configs[i].note_number;
      uint8_t midi_message[4] = {
          static_cast<uint8_t>((cable_number << 4) | 0x8), 0x80, midi_note, 0};
      tud_midi_packet_write(midi_message);
    }
    was_pressed_[i] = key_switches_[i]->IsPressed();
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
          return 31;
        case 1:
          return 30;
        case 2:
          return 29;
        case 3:
          return 28;
        case 4:
          return 26;
        case 5:
          return 25;
        case 6:
          return 24;
        case 7:
          return 27;
        default:
          return -1;
      }
      break;
    case 1:
      switch (amux_channel) {
        case 0:
          return 23;
        case 1:
          return 22;
        case 2:
          return 21;
        case 3:
          return 16;
        case 4:
          return 19;
        case 5:
          return 18;
        case 6:
          return 20;
        case 7:
          return 17;
        default:
          return -1;
      }
      break;
    case 2:
      switch (amux_channel) {
        case 0:
          return 15;
        case 1:
          return 14;
        case 2:
          return 8;
        case 3:
          return 9;
        case 4:
          return 11;
        case 5:
          return 12;
        case 6:
          return 13;
        case 7:
          return 10;
        default:
          return -1;
      }
      break;
    case 3:
      switch (amux_channel) {
        case 0:
          return 7;
        case 1:
          return 0;
        case 2:
          return 1;
        case 3:
          return 2;
        case 4:
          return 6;
        case 5:
          return 5;
        case 6:
          return 4;
        case 7:
          return 3;
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
