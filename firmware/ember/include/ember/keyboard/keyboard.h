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
  Keyboard(Config config);

  /**
   * @brief Send a HID report to the host.
   */
  void Update();
  /**
   * @brief Set the ADC Value
   */
  void SetADCValue(uint8_t adc_ch, uint8_t amux_channel, uint16_t value);

  void StartCalibrate();
  void StopCalibrate();
  Config GetConfig() { return config_; }

  KeySwitchBase* key_switches_[32];

 private:
  static int8_t ChToIndex(uint8_t adc_ch, uint8_t amux_channel);
  Config config_;
};
}  // namespace ember

#endif  // EMBER_KEYBOARD_KEYBOARD_H_
