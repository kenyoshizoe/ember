#include "ember/module/cd4051b.h"

namespace ember {
CD4051B::CD4051B(GPIO_TypeDef* gpio_a_port, uint16_t gpio_a_pin,
                 GPIO_TypeDef* gpio_b_port, uint16_t gpio_b_pin,
                 GPIO_TypeDef* gpio_c_port, uint16_t gpio_c_pin)
    : gpio_a_port_(gpio_a_port),
      gpio_a_pin_(gpio_a_pin),
      gpio_b_port_(gpio_b_port),
      gpio_b_pin_(gpio_b_pin),
      gpio_c_port_(gpio_c_port),
      gpio_c_pin_(gpio_c_pin) {
  HAL_GPIO_WritePin(gpio_a_port, gpio_a_pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(gpio_b_port, gpio_b_pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(gpio_c_port, gpio_c_pin, GPIO_PIN_RESET);
}

void CD4051B::SetCh(uint8_t ch) {
  if (ch > 8) return;
  ch_ = ch;
  HAL_GPIO_WritePin(gpio_a_port_, gpio_a_pin_,
                    (ch & 0b00000001) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  HAL_GPIO_WritePin(gpio_b_port_, gpio_b_pin_,
                    (ch & 0b00000010) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  HAL_GPIO_WritePin(gpio_c_port_, gpio_c_pin_,
                    (ch & 0b00000100) ? GPIO_PIN_SET : GPIO_PIN_RESET);
}
}  // namespace ember
