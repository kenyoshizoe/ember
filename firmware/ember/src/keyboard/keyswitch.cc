#include "ember/keyboard/keyswitch.h"

namespace ember {
void KeySwitchBase::StartCalibrate() {
  config_.max_value = 0;
  config_.min_value = 4095;
  is_calibrating_ = true;
}
void KeySwitchBase::StopCalibrate() { is_calibrating_ = false; }
void KeySwitchBase::Calibrate(uint16_t value) {
  if (value > config_.max_value) {
    config_.max_value = value;
  }
  if (value < config_.min_value) {
    config_.min_value = value;
  }
}

uint8_t KeySwitchBase::ADCValToDistance(uint16_t value) {
  if (value < config_.min_value) {
    return 40;
  }
  if (value > config_.max_value) {
    return 0;
  }

  // a was precalculated by fitting the curve
  // distance vs ADC value data is needed to calculate
  float a = 200;
  float b = log((config_.max_value - config_.min_value) / a + 1) / 4;
  return log((config_.max_value - value) / a + 1) / b * 10;
}

bool ThresholdKey::Update(uint16_t value) {
  if (is_calibrating_) {
    Calibrate(value);
    return false;
  }
  last_position_ = ADCValToDistance(value);
  if (last_position_ < config_.actuation_point) {
    is_pressed_ = true;
  } else {
    is_pressed_ = false;
  }
  return is_pressed_;
}
}  // namespace ember
