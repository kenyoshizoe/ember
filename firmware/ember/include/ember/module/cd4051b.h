#ifndef EMBER_MODULE_CD4051B_H
#define EMBER_MODULE_CD4051B_H

#include "main.h"

namespace ember {
/**
 * @brief Class for controlling a 8 channel analog multiplexer CD4051B.
 */
class CD4051B {
 public:
  CD4051B(GPIO_TypeDef* gpio_a_port, uint16_t gpio_a_pin,
          GPIO_TypeDef* gpio_b_port, uint16_t gpio_b_pin,
          GPIO_TypeDef* gpio_c_port, uint16_t gpio_c_pin);
  void SetCh(uint8_t ch);
  uint8_t GetCh() const { return ch_; }
  void NextCh();

 private:
  GPIO_TypeDef* gpio_a_port_;
  uint16_t gpio_a_pin_;
  GPIO_TypeDef* gpio_b_port_;
  uint16_t gpio_b_pin_;
  GPIO_TypeDef* gpio_c_port_;
  uint16_t gpio_c_pin_;
  uint8_t ch_;
};
}  // namespace ember
#endif  // EMBER_MODULE_CD4051B_H
