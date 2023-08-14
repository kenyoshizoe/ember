#include "ember/app/app.h"

#include "ember/module/cd4051b.h"

// Modules
ember::CD4051B* amux;
// Variables for DMA ADC
uint16_t adc_val[4];
bool adc_half_complete = false;

void setup() {
  amux = new ember::CD4051B(MUX_A_GPIO_Port, MUX_A_Pin, MUX_B_GPIO_Port,
                            MUX_B_Pin, MUX_C_GPIO_Port, MUX_C_Pin);

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
  if (hadc != &hadc1 && hadc != &hadc3) {
    return;
  }

  if (adc_half_complete) {
    adc_half_complete = false;
    amux->NextCh();
    HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                 1);
    HAL_ADCEx_MultiModeStart_DMA(&hadc3,
                                 reinterpret_cast<uint32_t*>(adc_val + 2), 1);
  } else {
    adc_half_complete = true;
  }
}
