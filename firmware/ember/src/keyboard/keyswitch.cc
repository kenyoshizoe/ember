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

bool ThresholdKey::Update(uint16_t value) {
  if (is_calibrating_) {
    Calibrate(value);
    return false;
  }

  if (value < config_.max_value * config_.threshold_percent / 100) {
    is_pressed_ = true;
  } else {
    is_pressed_ = false;
  }
  return is_pressed_;
}
}  // namespace ember
