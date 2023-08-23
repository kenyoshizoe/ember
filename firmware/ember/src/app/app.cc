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

  // TinyUSB init
  tud_init(BOARD_TUD_RHPORT);
}

void loop() { 
  tud_task();
}

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

void tud_hid_report_complete_cb(uint8_t instance, uint8_t const* report,
                                uint16_t len) {}

// Invoked when received GET_REPORT control request
// Application must fill buffer report's content and return its length.
// Return zero will cause the stack to STALL request
uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id,
                               hid_report_type_t report_type, uint8_t* buffer,
                               uint16_t reqlen) {
  return 0;
}

// Invoked when received SET_REPORT control request or
// received data on OUT endpoint ( Report ID = 0, Type = 0 )
void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id,
                           hid_report_type_t report_type, uint8_t const* buffer,
                           uint16_t bufsize) {}
