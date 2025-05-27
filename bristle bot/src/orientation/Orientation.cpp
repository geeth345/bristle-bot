#include <orientation/Orientation.h>
#include "CompassModule.h"
#include <Wire.h>
#include <SparkFunLSM6DS3.h>
#include <Communication.h>


// Create the compass module instance
CompassModule compass;

// Variables for storing sensor data
float accelX, accelY, accelZ;
float gyroX, gyroY, gyroZ;
float heading, tiltCompHeading;

// Flag for continuous heading display
bool continuousHeading = false;

float lastHeading = 0.0;

float getHeading() {
  return lastHeading;
}

void setupOrientation() {
   
  // Initialize I2C
  Wire.begin();
  
  // Initialize the compass module
  compass.begin();
    
  Serial.println("\nCommands:");
  Serial.println("c - Calibrate magnetometer");
  Serial.println("d - Print current calibration data");
  Serial.println("h - Show heading");
  Serial.println("t - Toggle continuous heading display");

  // Add a 2 second delay to allow sensors to stabilize
  delay(2000);

  // calibration phase
  compass.calibrate();

}

void displayHeading() {
 
  // Get raw heading
  heading = compass.readHeading();
  heading += 90;

  Comms::update_heading(map(heading, 0, 360, 0, 255));
  lastHeading = heading;
  
  // Get tilt-compensated heading
  //tiltCompHeading = compass.readTiltCompensatedHeading(accelX, accelY, accelZ);
  
  // Get direction string
  String direction = compass.getDirection(heading);
  
  // Display both raw and tilt-compensated headings
  Serial.print("Raw Heading: ");
  Serial.print(heading, 1);
  Serial.print("° | Direction: ");
  Serial.println(direction);

}

void updateOrientation() {
  displayHeading();
}

  // Check for commands from Serial
  // if (Serial.available()) {
  //   char cmd = Serial.read();


    
    // switch (cmd) {
    //   case 'c':
    //     compass.calibrate();
    //     break;
        
    //   case 'd':
    //     compass.printCalibrationData();
    //     break;
        
    //   case 'h':
    //     displayHeading();
    //     break;
        
    //   case 't':
    //     continuousHeading = !continuousHeading;
    //     if (continuousHeading) {
    //       Serial.println("Continuous heading display ON");
    //     } else {
    //       Serial.println("Continuous heading display OFF");
    //     }
    //     break;
    // }

  
  // // Display heading continuously if enabled
  // if (continuousHeading) {
  //   displayHeading();
  //   delay(200); // Update 5 times per second
  // }



