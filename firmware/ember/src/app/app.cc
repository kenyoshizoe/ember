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

  SEGGER_RTT_printf(0, "Setup ADC\n");
  HAL_ADC_Start(&hadc1);
  HAL_ADC_Start(&hadc2);
  HAL_ADC_Start(&hadc3);
  HAL_ADC_Start(&hadc4);

  SEGGER_RTT_printf(0, "Setup ADC DMA\n");
  adc_running = true;
  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);

  // TinyUSB init
  SEGGER_RTT_printf(0, "Setup USB\n");
  tusb_init();

  SEGGER_RTT_printf(0, "Setup timer\n");
  HAL_TIM_Base_Start_IT(&htim17);

  keyboard->StartCalibrate();

  SEGGER_RTT_printf(0, "Setup process done.\n");
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
          ember::KeySwitchBase* key_switch = keyboard->key_switches_[i];
          ember::KeySwitchBase::Config config;
          key_switch->GetConfig(&config);
          SEGGER_RTT_printf(0, "Key %d: %d %d\n", i, config.max_value,
                            config.min_value);
        }
        keyboard->StopCalibrate();
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
  }
  if (hadc == &hadc3) {
    adc3_complete = true;
  }
  if (!adc1_complete || !adc3_complete) {
    return;
  }
  adc1_complete = false;
  adc3_complete = false;

  for (int i = 0; i < 4; i++) {
    keyboard->SetADCValue(i, amux->GetCh(), adc_val[i]);
  }

  amux->NextCh();
  if (amux->GetCh() == 0) {
    adc_running = false;
    return;
  }

  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);
}

// USB
// Invoked when device is mounted
void tud_mount_cb(void) { SEGGER_RTT_printf(0, "USB Connected\n"); }
// Invoked when device is unmounted
void tud_umount_cb(void) { SEGGER_RTT_printf(0, "USB Disconnected\n"); }
// Invoked when usb bus is suspended
// remote_wakeup_en : if host allow us  to perform remote wakeup
// Within 7ms, device must draw an average of current less than 2.5 mA from bus
void tud_suspend_cb(bool remote_wakeup_en) { (void)remote_wakeup_en; }
// Invoked when usb bus is resumed
void tud_resume_cb(void) {}

// CDC
// Invoked when cdc when line state changed e.g connected/disconnected
void tud_cdc_line_state_cb(uint8_t itf, bool dtr, bool rts) {
  (void)itf;
  (void)rts;

  // TODO set some indicator
  if (dtr) {
    // Terminal connected
  } else {
    // Terminal disconnected
  }
}

// Invoked when CDC interface received data from host
void tud_cdc_rx_cb(uint8_t itf) { (void)itf; }
