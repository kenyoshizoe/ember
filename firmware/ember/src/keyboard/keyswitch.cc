#include "ember/keyboard/keyswitch.h"

namespace ember {
void KeySwitchBase::UpdatePosVel(uint16_t value) {
  float current_position = ADCValToDistance(value);  // Unit: 0.1mm
  float current_velocity =
      (static_cast<float>(current_position) - static_cast<float>(position_)) /
      kSamplingInterval / 10.0;  // Unit: mm / sec

  // Simple low-pass filter
  float alpha = kTimeConstant / (kTimeConstant + kSamplingInterval);
  float velocity = alpha * static_cast<float>(velocity_) +
                   (1 - alpha) * static_cast<float>(current_velocity);

  position_ = current_position;
  velocity_ = velocity;
}

float KeySwitchBase::ADCValToDistance(uint16_t value) {
  if (value < calibration_data_.min_value) {
    return 40;
  }
  if (value > calibration_data_.max_value) {
    return 0;
  }

  // a was precalculated by fitting the curve
  // distance vs ADC value data is needed to calculate
  float a = 200;
  // clang-format off
  float b = log((calibration_data_.max_value - calibration_data_.min_value) / a + 1) / 4;
  // clang-format on
  return log((calibration_data_.max_value - value) / a + 1) * 10 / b;
}

CalibratingKey::CalibratingKey(Config& config,
                               CalibrationData& calibration_data)
    : KeySwitchBase(config, calibration_data) {
  calibration_data_.max_value = 0;
  calibration_data_.min_value = 4095;
}

bool CalibratingKey::Update(uint16_t value) {
  if (value > calibration_data_.max_value) {
    calibration_data_.max_value = value;
  }
  if (value < calibration_data_.min_value) {
    calibration_data_.min_value = value;
  }
  return false;
}

bool ThresholdKey::Update(uint16_t value) {
  UpdatePosVel(value);

  if (position_ > config_.actuation_point) {
    is_pressed_ = true;
  } else {
    is_pressed_ = false;
  }
  return is_pressed_;
}

bool RapidTriggerKey::Update(uint16_t value) {
  UpdatePosVel(value);

  switch (state_) {
    case State::kRest:
      // Trigger
      if (position_ > config_.actuation_point) {
        peek_value_ = position_;
        state_ = State::kRapidTriggerDown;
        is_pressed_ = true;
        return is_pressed_;
      }
      break;
    case State::kRapidTriggerDown:
      // Back to rest state
      if (position_ <= config_.actuation_point) {
        state_ = State::kRest;
        is_pressed_ = false;
        return is_pressed_;
      }
      // Release trigger
      if (peek_value_ - position_ > config_.rappid_trigger_up_sensivity) {
        peek_value_ = position_;
        state_ = State::kRapidTriggerUp;
        is_pressed_ = false;
        return is_pressed_;
      }
      // Update peek_value
      if (peek_value_ < position_) {
        peek_value_ = position_;
      }
      break;
    case State::kRapidTriggerUp:
      // Back to rest state
      if (position_ <= config_.actuation_point) {
        state_ = State::kRest;
        is_pressed_ = false;
        return is_pressed_;
      }
      // Trigger
      if (position_ - peek_value_ > config_.rappid_trigger_down_sensivity) {
        peek_value_ = position_;
        state_ = State::kRapidTriggerDown;
        is_pressed_ = true;
        return is_pressed_;
      }
      // Update peek_value
      if (peek_value_ > position_) {
        peek_value_ = position_;
      }
      break;
    default:
      break;
  }
  return is_pressed_;
}

}  // namespace ember
