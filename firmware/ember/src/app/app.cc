#include "ember/app/app.h"

uint16_t adc_val[4];
bool adc_done = false;

void setup() {
  HAL_ADC_Start(&hadc1);
  HAL_ADC_Start(&hadc2);
  HAL_ADC_Start(&hadc3);
  HAL_ADC_Start(&hadc4);

  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);
}

void loop() {}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
  if (hadc == &hadc1 || hadc == &hadc3) {
    if (adc_done) {
      adc_done = false;
      HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                   1);
      HAL_ADCEx_MultiModeStart_DMA(&hadc3,
                                   reinterpret_cast<uint32_t*>(adc_val + 2), 1);
    } else {
      adc_done = true;
    }
  }
}
