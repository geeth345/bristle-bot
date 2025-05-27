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
const int modeSelectPin = 0;

u_int8_t behaviourMode = 0;

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

  digitalWrite(LED_BUILTIN, HIGH);
    // do a blink
  for (int i = 0; i < 10; i++)
  {
    digitalWrite(LED_BLUE, HIGH);
    delay(50);
    digitalWrite(LED_BLUE, LOW);
    delay(50);
  }

  // initialise orientation
  // this will trigger a 60 second orientation phase where the user will need
  // to rotate the robot in all directions
  setupOrientation();

  digitalWrite(LED_BLUE, HIGH);
  Locomotion::moveForward();
  delay(200);
  Locomotion::stopMotors();
  // do a blink
  for (int i = 0; i < 20; i++)
  {
    digitalWrite(LED_GREEN, LOW);
    delay(50);
    digitalWrite(LED_GREEN, HIGH);
    delay(50);
  }
  //updateOrientation();
  displayHeading();

  // Initialise locomotion
  Locomotion::initialiseLocomotion();

  // initialise sound level
  setupSoundLevel();


  // select the mode 
  pinMode(modeSelectPin, INPUT_PULLUP);
  if (digitalRead(modeSelectPin)) 
  {
    behaviourMode = 1;
  }
  else
  {
    behaviourMode = 0;
  }


}
  // ############ Blink the LED #############
  static unsigned long lastBlink = 0;

void loop()
{

  if (millis() - lastBlink > BLINK_MILLIS)
  {
    Serial.println("Blink!");
    if (behaviourMode == 1)
    {
      digitalWrite(LED_RED, !digitalRead(LED_RED));
    } 
    else if (behaviourMode == 0)
    {
      digitalWrite(LED_BLUE, !digitalRead(LED_BLUE));
    }
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
  if (behaviourMode == 0) {
      updateSoundLevel();
  }

  // ############ Locomotion #############
  if (behaviourMode == 0)
  {
    Locomotion::updateLocomotion();
  } 
  else if (behaviourMode == 1)
  {
    Locomotion::updateLocomotionWalkStraight();
  }
}

