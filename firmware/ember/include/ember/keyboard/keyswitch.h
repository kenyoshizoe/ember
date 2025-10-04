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
  virtual ~KeySwitchBase() = default;

  /**
   * @brief Update the key state.
   * @param value 12bit ADC value.
   * @return the key is pressed or not.
   */
  virtual bool Update(uint16_t value) = 0;
  /**
   * @brief Return the key is pressed or not.
   */
  bool IsPressed() const { return is_pressed_; }
  /**
   * @brief Get the Key Code
   */
  uint8_t GetKeyCode() const { return config_.key_code; }
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
  float GetPosition() const { return position_; }
  /**
   * @brief Get the last velocity in mm/sec.
   */
  float GetVelocity() const { return velocity_; }

 protected:
  void UpdatePosVel(uint16_t value);
  float ADCValToDistance(uint16_t value);

  bool is_pressed_ = false;
  Config& config_;
  CalibrationData& calibration_data_;

  float position_ = 0;                                // Unit: 0.1mm
  float velocity_ = 0;                                // Unit: mm/sec
  constexpr static double kTimeConstant = 0.01;       // [s]
  constexpr static double kSamplingInterval = 0.004;  // [s] = 250Hz (htim17)
};

class DisabledKey : public KeySwitchBase {
 public:
  using KeySwitchBase::KeySwitchBase;
  bool Update(uint16_t value) override { return false; }
  bool IsPressed() const { return false; }
};

class CalibratingKey : public KeySwitchBase {
 public:
  CalibratingKey(Config& config, CalibrationData& calibration_data);
  bool Update(uint16_t value) override;
  bool IsPressed() const { return false; }
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
  float peek_value_ = 0;
};
}  // namespace ember

#endif  // EMBER_KEYBOARD_KEYSWITCH_H_
