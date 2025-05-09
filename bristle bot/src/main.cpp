#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>
#include <Locomotion.h>
#include <Localisation.h>
#include <Communication.h>
#include <BluetoothManager.h>
#include <SoundMeasurer.h>
#include <orientation/Orientation.h>



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
  for (int i = 0; i < 10; i++)
  {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }

  // Initialise localisation
  BLEManager::setupBLE();
  initialiseLocalisation();

  // Initialise locomotion
  Locomotion::initialiseLocomotion();

  // initialise sound level
  setupSoundLevel();

  // initialise orientation
  // this will trigger a 5 second orientation phase where the user will need
  // to rotate the robot in all directions
  setupOrientation();

}

void loop()
{
  // Serial.write('#'); <PDM.h>
  // ############ Blink the LED #############
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > BLINK_MILLIS)
  {
    Serial.println("Blink!");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }

  BLEManager::swapClientServer();

  if (BLEManager::isScanning())
  {
    updateLocalisation();
  }

  // ############ Orientation #############
  updateOrientation();

  // ############ Sound Level #############
  updateSoundLevel();

  // ############ Locomotion #############
  Locomotion::updateLocomotion();
}

