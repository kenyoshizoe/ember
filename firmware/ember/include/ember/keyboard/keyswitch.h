#ifndef EMBER_KEYBOARD_KEYSWITCH_H_
#define EMBER_KEYBOARD_KEYSWITCH_H_

#include "ember/keyboard/config.h"
#include "main.h"
#include "math.h"

namespace ember {
class KeySwitchBase {
 public:
  using Config = KeySwitchConfig;
  using CalibrationData = KeySwitchCalibrationData;

  KeySwitchBase(Config& config, CalibrationData& calibration_data)
      : config_(config), calibration_data_(calibration_data) {}

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
  Config& GetConfig() { return config_; }
  /**
   * @brief Get the calibration data.
   */
  CalibrationData& GetCalibrationData() { return calibration_data_; }
  /**
   * @brief Get the last position in 0.1mm.
   */
  uint8_t GetLastPosition() const { return last_position_; }

 protected:
  void Calibrate(uint16_t value);
  uint8_t ADCValToDistance(uint16_t value);

  bool is_pressed_ = false;
  bool is_calibrating_ = false;
  Config& config_;
  CalibrationData& calibration_data_;
  // Last key potision in 0.1mm
  uint8_t last_position_ = 0;
};

class ThresholdKey : public KeySwitchBase {
 public:
  using KeySwitchBase::KeySwitchBase;
  bool Update(uint16_t value) override;
};

class RapidTriggerKey : public KeySwitchBase {
 public:
  using KeySwitchBase::KeySwitchBase;
  bool Update(uint16_t value) override;

 private:
  enum class State {
    kRest,
    kRapidTriggerDown,
    kRapidTriggerUp
  } state_ = State::kRest;
  uint8_t peek_value_ = 0;
};

}  // namespace ember

#endif  // EMBER_KEYBOARD_KEYSWITCH_H_
