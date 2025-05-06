#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>
#include <Locomotion.h>
#include <Localisation.h>


const int BLINK_MILLIS = 1000;

// ####### Function Definitions #######

// // Convert RSSI to distance using log-normal shadowing model
// float rssiToDistance(float rssi) {
//   return pow(10, (RSSI_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT));
// }


void setup() {
  Serial.begin(9600);
  
  // Wait for serial monitor with timeout (10 seconds)
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 10000)) {
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

  // Initialise locomotion
  // initialiseLocomotion();

}

void loop() {  
  Serial.print("#");
  static unsigned long lastBlink = 0;

  // ############ Blink the LED #############
  if (millis() - lastBlink > BLINK_MILLIS) {
    Serial.println("Blink!");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }

  // ############ Localisation #############
  updateLocalisation();


  // ############ Locomotion #############
  // updateLocomotion();

  delay(400);

}