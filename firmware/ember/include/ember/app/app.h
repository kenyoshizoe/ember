#ifndef EMBER_APP_APP_H
#define EMBER_APP_APP_H

#ifdef __cplusplus
extern "C" {
#endif

#include "adc.h"
#include "main.h"
#include "tim.h"
#include "tusb.h"
#include "tusb_config.h"

void setup(void);
void loop(void);

#ifdef __cplusplus
}
#endif

#endif  // EMBER_APP_APP_H
