#include "ember/app/app.h"

#include "SEGGER_RTT.h"
#include "ember/keyboard/config.h"
#include "ember/keyboard/keyboard.h"
#include "ember/module/cd4051b.h"
#include "ember/module/flash.h"

// Keyboard
ember::Keyboard* keyboard;
// Modules
ember::CD4051B* amux;

// Variables for DMA ADC
uint16_t adc_val[4];
bool adc1_complete = false;
bool adc3_complete = false;
bool adc_running = false;

void setup() {
  SEGGER_RTT_Init();

  // Load Config
  ember::Config config;
  bool load_success = ember::Flash::LoadConfig(config);
  keyboard = new ember::Keyboard(config);
  // Start Calibrate at first time
  if (!load_success) {
    keyboard->StartCalibrate();
  }

  amux = new ember::CD4051B(MUX_A_GPIO_Port, MUX_A_Pin, MUX_B_GPIO_Port,
                            MUX_B_Pin, MUX_C_GPIO_Port, MUX_C_Pin);

  HAL_ADC_Start(&hadc1);
  HAL_ADC_Start(&hadc2);
  HAL_ADC_Start(&hadc3);
  HAL_ADC_Start(&hadc4);

  adc_running = true;
  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);

  // TinyUSB init
  tusb_init();

  HAL_TIM_Base_Start_IT(&htim17);

  SEGGER_RTT_printf(0, "Ember startup.\n");
}

void loop() {
  tud_task();

  // USB CDC Echoback Test
  int available_bytes = tud_cdc_available();
  if (available_bytes != 0) {
    char* buf = new char[available_bytes];
    uint32_t count =
        tud_cdc_read(reinterpret_cast<uint8_t*>(buf), available_bytes);
    tud_cdc_write(reinterpret_cast<uint8_t*>(buf), count);
    tud_cdc_write_flush();

    switch (buf[0]) {
      case 'c':
        SEGGER_RTT_printf(0, "Start calibrate\n");
        keyboard->StartCalibrate();
        break;
      case 's':
        SEGGER_RTT_printf(0, "Stop calibrate\n");
        // Print calibration result
        for (int i = 0; i < 32; i++) {
          ember::KeySwitchConfig config =
              keyboard->key_switches_[i]->GetConfig();
          SEGGER_RTT_printf(0, "Key %d: %d~%d\n", i, config.max_value,
                            config.min_value);
        }
        keyboard->StopCalibrate();
        ember::Flash::SaveConfig(keyboard->GetConfig());
        break;
      default:
        break;
    }

    delete[] buf;
  }
}

void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef* htim) {
  if (htim == &htim17) {
    if (adc_running) {
      SEGGER_RTT_printf(0, "ADC is running\n");
      return;
    }

    keyboard->Update();

    adc_running = true;
    HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                 1);
    HAL_ADCEx_MultiModeStart_DMA(&hadc3,
                                 reinterpret_cast<uint32_t*>(adc_val + 2), 1);
    return;
  }
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
  if (hadc != &hadc1 && hadc != &hadc3) {
    return;
  }

  // Check both ADCs are completed
  if (hadc == &hadc1) {
    adc1_complete = true;
    keyboard->SetADCValue(0, amux->GetCh(), adc_val[0]);
    keyboard->SetADCValue(1, amux->GetCh(), adc_val[1]);
  }
  if (hadc == &hadc3) {
    adc3_complete = true;
    keyboard->SetADCValue(2, amux->GetCh(), adc_val[2]);
    keyboard->SetADCValue(3, amux->GetCh(), adc_val[3]);
  }
  if (!adc1_complete || !adc3_complete) {
    return;
  }

  adc1_complete = false;
  adc3_complete = false;

  amux->NextCh();
  if (amux->GetCh() == 0) {
    adc_running = false;
    return;
  }

  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);
}
