#include <Wire.h>
#include "Calibration.h"
#include "Globals.h"
#include <QMC5883LCompass.h>

QMC5883LCompass compass;

void setupOrientation() {
    // Serial.begin(115200);
    Wire.begin();
    compass.init();
    compass.setSmoothing(5, false);  // 5 samples, advanced filtering OFF

    // Load calibration data (placeholder)
    loadCalibration();

    // Start calibration routine (for testing)
    // This will require the user to rotate the robot in all directions
    // 5 seconds
    calibrateMagnetometer(compass);

    // Save calibration data (optional for testing)
    saveCalibration();
}

void updateOrientation() {

    // Read raw magnetometer data
    compass.read();


    float mx = compass.getX();
    float my = compass.getY();
    float mz = compass.getZ();
    float azimuth = compass.getAzimuth();

    byte a = compass.getAzimuth();

    char myArray[3];
    compass.getDirection(myArray, a);
    
    Serial.print(myArray[0]);
    Serial.print(myArray[1]);
    Serial.print(myArray[2]);
    Serial.println();

    // Apply calibration
    applyMagnetometerCalibration(mx, my, mz);

    // Output calibrated magnetometer data
    //Serial.print("Mag X: "); Serial.print(mx);
    //Serial.print(" | Mag Y: "); Serial.print(my);
    //Serial.print(" | Mag Z: "); Serial.println(mz);

    // Calculate heading in degrees
    // float heading = atan2(abs(my), abs(mx)) * (180/PI);

    // // South West
    // if ( mx>=0 && my>=0)
    //   heading = 270 - heading;
    // // North West
    // if ( mx>=0 && my<0)
    //   heading = 270 - heading;
    // // South East
    // if ( mx<0 && my>=0)
    //   heading += 90;
    // // North East
    // if ( mx<0 && my<0)
    //   heading = 90 - heading;

    // // Normalise to 0-360 degrees
    // if(heading<0)
    //   heading += 360;
    
    // if (heading >= 360)
    //   heading -= 360;

    // Serial.print("Heading: ");
    // Serial.print(heading);
    // Serial.println("°");

    // delay(500);
}
