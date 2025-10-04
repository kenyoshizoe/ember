#ifndef EMBER_KEYBOARD_KEYBOARD_H_
#define EMBER_KEYBOARD_KEYBOARD_H_

#include "SEGGER_RTT.h"
#include "ember/keyboard/config.h"
#include "ember/keyboard/keycodes.h"
#include "ember/keyboard/keyswitch.h"
#include "main.h"
#include "tusb.h"

namespace ember {
class Keyboard {
 public:
  Keyboard(Config& config);

  /**
   * @brief Send a HID report to the host.
   */
  void Update();
  /**
   * @brief Set the ADC Value
   */
  void SetADCValue(uint8_t adc_ch, uint8_t amux_channel, uint16_t value);

  Config GetConfig() { return config_; }

  KeySwitchBase* key_switches_[32];

 private:
  void UpdateKeyboard();
  void UpdateMIDI();
  bool was_pressed_[32] = {false};

  template <typename T>
  void SetKeyType(std::size_t idx) {
    if (dynamic_cast<T*>(key_switches_[idx]) == nullptr) {
      delete key_switches_[idx];
      key_switches_[idx] = new T(config_.key_switch_configs[idx],
                                 config_.key_switch_calibration_data[idx]);
    }
  }

  static int8_t ChToIndex(uint8_t adc_ch, uint8_t amux_channel);
  Config& config_;
};
}  // namespace ember

#endif  // EMBER_KEYBOARD_KEYBOARD_H_
