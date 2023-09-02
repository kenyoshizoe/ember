#include "ember/module/flash.h"

#include "SEGGER_RTT.h"
#include "ember/keyboard/keycodes.h"

namespace ember {
void Flash::SaveConfig(const Config& config) {
  HAL_FLASH_Unlock();
  FLASH_EraseInitTypeDef erase;
  erase.TypeErase = FLASH_TYPEERASE_PAGES;
  erase.PageAddress = 0x801F800;
  erase.NbPages = 2;
  uint32_t page_error = 0;
  auto result = HAL_FLASHEx_Erase(&erase, &page_error);
  if (result != HAL_OK || page_error != 0xFFFFFFFF) {
    SEGGER_RTT_printf(0, "Erase failed: %08X\n", page_error);
  } else {
    SEGGER_RTT_printf(0, "Erase done.\n");
  }
  // const uint16_t* data = reinterpret_cast<const uint16_t*>(&config);
  uint16_t data[sizeof(Config) / 2];
  for (int i = 0; i < sizeof(Config) / 2; i++) {
    data[i] = reinterpret_cast<const uint16_t*>(&config)[i];
  }

  for (int i = 0; i < sizeof(Config) / 2; i++) {
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD,
                      kFlashStartAddress + i * sizeof(uint16_t), data[i]);
  }

  HAL_FLASH_Lock();
  SEGGER_RTT_printf(0, "Save config done.\n");
}

bool Flash::LoadConfig(Config& config) {
  memcpy(&config, reinterpret_cast<const void*>(kFlashStartAddress),
         sizeof(Config));
  if (reinterpret_cast<uint32_t*>(&config)[0] == 0xFFFFFFFF) {
    SEGGER_RTT_printf(0, "No config found, load default config.\n");
    Config default_config = GetDefaultConfig();
    memcpy(&config, &default_config, sizeof(Config));
    return false;
  }
  return true;
}

Config Flash::GetDefaultConfig() {
  Config default_config = {.key_switch_configs = {{
                               .key_type = 0,
                               .max_value = 2048,
                               .min_value = 1000,
                               .actuation_point = 20,
                           }}};
  uint8_t default_key_map_[32] = {
      KC_ESCAPE, KC_1, KC_2, KC_3, KC_4, KC_5, KC_6,         KC_7,
      KC_TAB,    KC_Q, KC_W, KC_E, KC_R, KC_T, KC_8,         KC_LEFT_SHIFT,
      KC_A,      KC_S, KC_D, KC_F, KC_G, KC_M, KC_LEFT_CTRL, KC_Z,
      KC_X,      KC_C, KC_V, KC_B, KC_N, KC_B, KC_LEFT_ALT,  KC_SPACE};
  for (int i = 0; i < 32; i++) {
    default_config.key_switch_configs[i].key_code = default_key_map_[i];
  }
  return default_config;
}
}  // namespace ember
