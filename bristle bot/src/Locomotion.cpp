#include "Locomotion.h"
#include <Arduino.h>

//motor pins fo Seeed
static const int motorRight = 2;
static const int motorLeft = 3;

//lévy walk maximum and minimum times
static const int minWalkTime = 500;   // Minimum walk interval (ms)
static const int maxWalkTime = 2000;  // Maximum walk interval (ms)

//timing markers for the walk 
static unsigned long previousMillis = 0;
static long interval = 0;

void initialiseLocomotion() {
  pinMode(motorRight, OUTPUT);
  pinMode(motorLeft, OUTPUT);

  // Serial.begin(115200);  //initialise serial port for debugging
  //initialize walk timing to some random interval between min/max, set timer
  interval = random(minWalkTime, maxWalkTime);
  previousMillis = millis();
  // spin motors for a short time to test
  digitalWrite(motorRight, HIGH);
  delay(1000);
  digitalWrite(motorRight, LOW);
  digitalWrite(motorLeft, HIGH);
  delay(1000);
  digitalWrite(motorLeft, LOW);

}

void updateLocomotion() {
  unsigned long currentMillis = millis(); //update timer

  if (currentMillis - previousMillis >= interval) { //loop around timer until random interval met.
    previousMillis = currentMillis;
    levyWalk(); //perform levy walk
  }
}

//OLD
//actual locomotion control 
//void levyWalk() {  
//  int action = random(3); //every time interval is exceeded, choose one of the three cases
//  switch (action) {
//    case 0: moveForward(); break;
//    case 1: turnLeft(); break;
//    case 2: turnRight(); break;
//  }
//}

void levyWalk() {
  int r = random(100);  //probabilities for each to happen, i.e 60% to go forwards, 20%ea to turn left/right

  if (r < 60) { //biased to forwards walk
    moveForward();
    interval = random(minWalkTime, maxWalkTime);
  }
  else if (r < 80) { //short turns left+right
    turnLeft();
    interval = random(minWalkTime, 1000);
  }
  else {
    turnRight();
    interval = random(minWalkTime, 1000);
  }
}

void moveForward() {
  Serial.write("Moving Forward");
  digitalWrite(motorRight, HIGH);
  digitalWrite(motorLeft, HIGH);
}

void turnLeft() {
  Serial.write("Turning Left");
  digitalWrite(motorRight, HIGH);
  digitalWrite(motorLeft, LOW);
}

void turnRight() {
  Serial.write("Turning Right");
  digitalWrite(motorRight, LOW);
  digitalWrite(motorLeft, HIGH);
}

void stopMotors() { //never actually used but can be in future for stopping to listen to sound etc. 
  digitalWrite(motorRight, LOW);
  digitalWrite(motorLeft, LOW);
}
