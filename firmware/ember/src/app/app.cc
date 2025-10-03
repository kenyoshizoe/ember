#include "ember/app/app.h"

#include "SEGGER_RTT.h"
#include "ember/commnication/configrator.h"
#include "ember/keyboard/config.h"
#include "ember/keyboard/keyboard.h"
#include "ember/module/cd4051b.h"
#include "ember/module/flash.h"

// Keyboard
ember::Keyboard* keyboard;
// Config
ember::Config config;
// Modules
ember::CD4051B amux1(MUX1_A_GPIO_Port, MUX1_A_Pin, MUX1_B_GPIO_Port, MUX1_B_Pin,
                     MUX1_C_GPIO_Port, MUX1_C_Pin);
ember::CD4051B amux2(MUX2_A_GPIO_Port, MUX2_A_Pin, MUX2_B_GPIO_Port, MUX2_B_Pin,
                     MUX2_C_GPIO_Port, MUX2_C_Pin);

// Variables for DMA ADC
uint16_t adc_val[4];
bool adc12_running = false;
bool adc34_running = false;

uint8_t switchToBootloader __attribute__((section(".noinit")));

void usb_bootloader_init() {
  // Check if we need to jump to the bootloader
  if (switchToBootloader == 0x11) {
    void (*SysMemBootJump)(void);
    switchToBootloader =
        0x00;  // Reset the variable to prevent being stuck in the bootloader
               // (since a device reset wont change it)
    volatile uint32_t addr =
        0x1FFFD800;  // The STM32G431KB system memory start address
    SysMemBootJump = (void (*)(void))(
        *((uint32_t*)(addr +
                      4)));  // Point the PC to the System Memory reset vector

    HAL_RCC_DeInit();   // Reset the system clock
    SysTick->CTRL = 0;  // Reset the  SysTick Timer
    SysTick->LOAD = 0;
    SysTick->VAL = 0;

    __set_MSP(*(uint32_t*)addr);  // Set the Main Stack Pointer

    SysMemBootJump();  // Run our virtual function defined above that sets the
                       // PC

    while (1)
      ;
  }
}

void setup() {
  SEGGER_RTT_Init();
  // Load Config
  bool load_success = ember::Flash::LoadConfig(config);
  keyboard = new ember::Keyboard(config);
  // Start Calibrate at first time
  if (!load_success) {
    keyboard->StartCalibrate();
  }
  // Init modules
  amux1.Init();
  amux2.Init();
  // Start ADC
  HAL_ADC_Start(&hadc1);
  HAL_ADC_Start(&hadc2);
  HAL_ADC_Start(&hadc3);
  HAL_ADC_Start(&hadc4);
  adc12_running = true;
  HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val), 1);
  adc34_running = true;
  HAL_ADCEx_MultiModeStart_DMA(&hadc3, reinterpret_cast<uint32_t*>(adc_val + 2),
                               1);
  // TinyUSB init

  tusb_rhport_init_t dev_init = {
    .role = TUSB_ROLE_DEVICE,
    .speed = TUSB_SPEED_AUTO
  };
  tusb_init(0, &dev_init); // initialize device stack on roothub port 0

  // Start Timer
  HAL_TIM_Base_Start_IT(&htim17);
  // Start Configurator
  ember::Configurator::GetInstance()->SetKeyboard(keyboard);
  ember::Configurator::GetInstance()->SetConfig(&config);
  ember::Configurator::GetInstance()->Init();

  SEGGER_RTT_printf(0, "Ember startup.\n");
}

void loop() { tud_task(); }

void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef* htim) {
  if (htim == &htim17) {
    if (adc12_running || adc34_running) {
      SEGGER_RTT_printf(0, "ADC is running\n");
      return;
    }

    keyboard->Update();

    adc12_running = true;
    HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                 1);
    adc34_running = true;
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
    keyboard->SetADCValue(0, amux1.GetCh(), adc_val[0]);
    keyboard->SetADCValue(1, amux1.GetCh(), adc_val[1]);
    amux1.NextCh();
    if (amux1.GetCh() == 0) {
      adc12_running = false;
      return;
    }
    HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                 1);
  }
  if (hadc == &hadc3) {
    keyboard->SetADCValue(2, amux2.GetCh(), adc_val[2]);
    keyboard->SetADCValue(3, amux2.GetCh(), adc_val[3]);
    amux2.NextCh();
    if (amux2.GetCh() == 0) {
      adc34_running = false;
      return;
    }
    HAL_ADCEx_MultiModeStart_DMA(&hadc3,
                                 reinterpret_cast<uint32_t*>(adc_val + 2), 1);
  }
}
