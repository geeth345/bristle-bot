#include "Locomotion.h"
#include <Arduino.h>

//motor pins fo Seeed
static const int motorRight = 0;
static const int motorLeft = 2;

//lévy walk maximum and minimum times
static const int minWalkTime = 500;   // Minimum walk interval (ms)
static const int maxWalkTime = 4000;  // Maximum walk interval (ms)

//timing markers for the walk 
static unsigned long previousMillis = 0;
static long interval = 0;

void initialiseLocomotion() {
  pinMode(motorRight, OUTPUT);
  pinMode(motorLeft, OUTPUT);

  //initialize walk timing to some random interval between min/max, set timer
  interval = random(minWalkTime, maxWalkTime);
  previousMillis = millis();
}

void updateLocomotion() {
  unsigned long currentMillis = millis(); //update timer

  if (currentMillis - previousMillis >= interval) { //loop around timer until random interval met.
    previousMillis = currentMillis;
    levyWalk(); //perform levy walk
    interval = random(minWalkTime, maxWalkTime); //reset interval
  }
}

//actual locomotion control 
void levyWalk() {  
  int action = random(3); //every time interval is exceeded, choose one of the three cases
  switch (action) {
    case 0: moveForward(); break;
    case 1: turnLeft(); break;
    case 2: turnRight(); break;
  }
}

void moveForward() {
  digitalWrite(motorRight, HIGH);
  digitalWrite(motorLeft, HIGH);
}

void turnLeft() {
  digitalWrite(motorRight, HIGH);
  digitalWrite(motorLeft, LOW);
}

void turnRight() {
  digitalWrite(motorRight, LOW);
  digitalWrite(motorLeft, HIGH);
}

void stopMotors() { //never actually used but can be in future for stopping to listen to sound etc. 
  digitalWrite(motorRight, LOW);
  digitalWrite(motorLeft, LOW);
}
