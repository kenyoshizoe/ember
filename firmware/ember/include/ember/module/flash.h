#ifndef EMBER_MODULE_FLASH_H_
#define EMBER_MODULE_FLASH_H_

#include <cstring>

#include "ember/keyboard/config.h"
#include "main.h"

namespace ember {
class Flash {
 public:
  static bool SaveConfig(const ember::Config& config);
  static bool LoadConfig(ember::Config& config);
  static Config GetDefaultConfig();

 private:
  constexpr static uint32_t kFlashStartAddress = 0x801F800;
};
}  // namespace ember

#endif  // EMBER_MODULE_FLASH_H_
