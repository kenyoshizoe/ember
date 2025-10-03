#ifndef EMBER_COMMUNICATION_CONFIGRATOR_H_
#define EMBER_COMMUNICATION_CONFIGRATOR_H_

#include "ember/keyboard/config.h"
#include "ember/keyboard/keyboard.h"
#include "etl/queue.h"

extern uint8_t switchToBootloader __attribute__((section(".noinit")));

namespace ember {
class Configurator {
 public:
  // Singleton
  Configurator(const Configurator&) = delete;
  Configurator& operator=(const Configurator&) = delete;
  static Configurator* GetInstance() {
    static Configurator instance;
    return &instance;
  }

 public:
  void SetKeyboard(Keyboard* keyboard) { keyboard_ = keyboard; }
  void SetConfig(Config* config) { config_ = config; }
  void Start();
  void Init();
  void Task();

 private:
  Configurator() = default;

  static constexpr size_t kBufSize = 1024;
  etl::queue<uint8_t, 2048> rx_queue_;
  void ProcessCompleteMessage();

  Keyboard* keyboard_;
  Config* config_;
};
}  // namespace ember
#endif  // EMBER_COMMUNICATION_CONFIGRATOR_H_
