#include "ember/app/app.h"

#include "SEGGER_RTT.h"
#include "ember/module/cd4051b.h"

// Modules
ember::CD4051B* amux;
// Variables for DMA ADC
uint16_t adc_val[4];
bool adc_half_complete = false;
bool adc_running = false;

void send_hid_report();

void setup() {
  SEGGER_RTT_Init();
  SEGGER_RTT_printf(0, "Ember startup.\n");

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

  HAL_TIM_Base_Start_IT(&htim17);

  // TinyUSB init
  tusb_init();

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
    SEGGER_RTT_Write(0, buf, available_bytes);
    SEGGER_RTT_printf(0, "\n");
    delete[] buf;
  }
}

void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef* htim) {
  if (htim == &htim17) {
    if (adc_running) {
      SEGGER_RTT_printf(0, "ADC is running\n");
      return;
    }
    adc_running = true;
    HAL_ADCEx_MultiModeStart_DMA(&hadc1, reinterpret_cast<uint32_t*>(adc_val),
                                 1);
    HAL_ADCEx_MultiModeStart_DMA(&hadc3,
                                 reinterpret_cast<uint32_t*>(adc_val + 2), 1);
    return;
  }
}

uint16_t adc1_values[8] = {0};
uint16_t adc2_values[8] = {0};
uint16_t adc3_values[8] = {0};
uint16_t adc4_values[8] = {0};

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
  if (hadc != &hadc1 && hadc != &hadc3) {
    return;
  }

  if (!adc_half_complete) {
    adc_half_complete = true;
    return;
  }

  adc_half_complete = false;

  adc1_values[amux->GetCh()] = adc_val[0];
  adc2_values[amux->GetCh()] = adc_val[1];
  adc3_values[amux->GetCh()] = adc_val[2];
  adc4_values[amux->GetCh()] = adc_val[3];

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

// HID
union HIDReport {
  struct {
    uint8_t modifiers;
    uint8_t reserved;
    uint8_t keys[6];
  } __attribute__((packed)) report;
  uint8_t raw[8];
};

void send_hid_report() {
  // skip if hid is not ready yet
  if (!tud_hid_ready()) {
    SEGGER_RTT_printf(0, "HID not ready\n");
    return;
  }

  HIDReport report = {0};
  tud_hid_report(0, reinterpret_cast<uint8_t*>(report.raw), sizeof(report));
}

void tud_hid_report_complete_cb(uint8_t instance, uint8_t const* report,
                                uint16_t len) {
  (void)instance;
  (void)report;
}

// Invoked when received GET_REPORT control request
// Application must fill buffer report's content and return its length.
// Return zero will cause the stack to STALL request
uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id,
                               hid_report_type_t report_type, uint8_t* buffer,
                               uint16_t reqlen) {
  (void)instance;
  (void)report_id;
  (void)report_type;
  (void)buffer;
  (void)reqlen;
  return 0;
}

// Invoked when received SET_REPORT control request or
// received data on OUT endpoint ( Report ID = 0, Type = 0 )
void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id,
                           hid_report_type_t report_type, uint8_t const* buffer,
                           uint16_t bufsize) {
  (void)instance;
}

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
