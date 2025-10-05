#ifndef EMBER_KEYBOARD_CONFIG_H_
#define EMBER_KEYBOARD_CONFIG_H_

#include <cstdint>

namespace ember {
/**
 * @brief KeySwitchConfig
 * @note 5 bytes
 */
struct KeySwitchConfig {
  uint8_t key_code = 0;
  enum class KeyType : uint8_t {
    DISABLED = 0,
    CALIBRATE = 1,
    THRESHOLD = 2,
    RAPID_TRIGGER = 3
  } key_type = KeyType::THRESHOLD;
  // actuation point in 0.1mm unit
  uint8_t actuation_point = 10;
  // RappidTrigger Settings
  // 最も深く押したときの位置からどれだけ離れたらトリガーを解除するか。0.1mm単位。
  // How far away from the deepest position to release the trigger. 0.1mm unit.
  uint8_t rappid_trigger_up_sensivity = 2;
  // 最も浅く押したときの位置からどれだけ離れたらトリガーを発動するか。0.1mm単位。
  // How far away from the shallowest position to trigger. 0.1mm unit.
  uint8_t rappid_trigger_down_sensivity = 2;
} __attribute__((packed));

/**
 * @brief KeySwitchCalibrationData
 * @note 4 bytes
 */
struct KeySwitchCalibrationData {
  uint16_t max_value = 2048;
  uint16_t min_value = 1000;
} __attribute__((packed));

struct MIDIConfig {
  uint8_t note_number = 60;
} __attribute__((packed));

/**
 * @brief Config
 * @note 324 bytes
 */
struct Config {
  KeySwitchConfig key_switch_configs[32];                    // 160 bytes
  KeySwitchCalibrationData key_switch_calibration_data[32];  // 128 bytes
  MIDIConfig midi_configs[32];                               // 32 bytes
  enum class Mode : uint8_t {
    DISABLED = 0,
    CALIBRATE = 1,
    KEYBOARD = 2,
    MIDI = 3
  } mode = Mode::KEYBOARD;    // 1 byte
  uint8_t reserved[3] = {0};  // 3 bytes for alignment
} __attribute__((packed));
}  // namespace ember

#endif  // EMBER_KEYBOARD_CONFIG_H_
