#ifndef EMBER_KEYBOARD_KEYSWITCH_H_
#define EMBER_KEYBOARD_KEYSWITCH_H_

#include "main.h"

namespace ember {
class KeySwitchBase {
 public:
  struct Config {
    uint8_t key_code = 0;
    /**
     * @brief 0: ThresholdKey
     */
    uint8_t key_type = 0;
    uint16_t max_value = 4095;
    uint16_t min_value = 0;
    uint8_t threshold_percent = 50;
  };

  KeySwitchBase() = default;
  KeySwitchBase(const Config& config) : config_(config) {}

  /**
   * @brief Update the key state.
   * @param value 12bit ADC value.
   * @return the key is pressed or not.
   */
  virtual bool Update(uint16_t value) = 0;
  /**
   * @brief Return the key is pressed or not.
   */
  bool IsPressed() const { return is_pressed_ && !is_calibrating_; }
  /**
   * @brief Get the Key Code
   */
  uint8_t GetKeyCode() const { return config_.key_code; }
  /**
   * @brief Start calibrate the key.
   */
  void StartCalibrate();
  /**
   * @brief Stop calibrate the key.
   */
  void StopCalibrate();
  /**
   * @brief Load the config.
   */
  void LoadConfig(const Config& config) { config_ = config; }
  /**
   * @brief Get the config.
   */
  void GetConfig(Config* config) { *config = config_; }

 protected:
  void Calibrate(uint16_t value);

  bool is_pressed_ = false;
  bool is_calibrating_ = false;
  Config config_;
};

class ThresholdKey : public KeySwitchBase {
 public:
  bool Update(uint16_t value) override;
};

}  // namespace ember

#endif  // EMBER_KEYBOARD_KEYSWITCH_H_
