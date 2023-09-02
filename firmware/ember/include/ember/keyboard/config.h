#ifndef EMBER_KEYBOARD_CONFIG_H_
#define EMBER_KEYBOARD_CONFIG_H_

#include <cstdint>

namespace ember {
/**
 * @brief KeySwitchConfig
 * @note 32 bytes
 */
struct KeySwitchConfig {
  uint8_t key_code = 0;
  /**
   * @brief 0: ThresholdKey
   */
  uint8_t key_type = 0;
  uint16_t max_value = 4095;
  uint16_t min_value = 0;
  // actuation point in 0.1mm
  uint16_t actuation_point = 20;
} __attribute__((packed));

/**
 * @brief Config
 * @note 1024 bytes
 */
struct Config {
  KeySwitchConfig key_switch_configs[32];
} __attribute__((packed));
}  // namespace ember

#endif  // EMBER_KEYBOARD_CONFIG_H_
