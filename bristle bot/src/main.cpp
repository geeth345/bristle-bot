#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>
#include <Locomotion.h>
#include <Localisation.h>
#include "Communication.h"


const int BLINK_MILLIS = 1000;

void setup()
{
  Serial.begin(9600);

  // Wait for serial monitor with timeout (5 seconds)
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 5000))
  {
    delay(10);
  }

  // LED setup
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // do a blink
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }

  // Initialise localisation
  initialiseLocalisation();

}

void loop()
{
  // ############ Blink the LED #############
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > BLINK_MILLIS)
  {
    Serial.println("Blink!");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }

  // ############ Communication ############
#if Do_Communication

  static unsigned long lastSwap = 0;
  static bool advertising = false;
  if (millis() - lastSwap > BLE_SWAP_MILLIS)
  {
    if (advertising)
    {
      stopAdvertiseBLE();
      advertising = false;
    }
    else
    {
      advertiseBLE();
      advertising = true;
    }
    lastSwap = millis();
  }

#endif // Do_Communication

  // ############ Localisation #############
  updateLocalisation();


  // ############ Locomotion #############
  updateLocomotion();
}