#ifndef COMPASS_MODULE_H
#define COMPASS_MODULE_H

#include <QMC5883LCompass.h>
#include <Arduino.h>

class CompassModule {
private:
    QMC5883LCompass compass;
    
    // Calibration data
    float magOffsetX, magOffsetY, magOffsetZ;
    float magScaleX, magScaleY, magScaleZ;
    
    // Declination angle - adjust based on your location
    float declinationAngle = 0.0;
    
public:
    // Read heading (0-360 degrees, 0/360 = North)
    float readHeading();
    
    // Read heading with tilt compensation (requires accelerometer data)
    float readTiltCompensatedHeading(float ax, float ay, float az);
    
    // Get direction as a string (N, NE, E, etc.)
    String getDirection(float heading);
    
    // Run calibration procedure
    void calibrate();
    
    // Apply calibration to raw readings
    void applyCalibration(float &mx, float &my, float &mz);
    
    // Print current calibration values
    void printCalibrationData();
    
    // Set declination angle for your location
    void setDeclinationAngle(float angle);

    // Initialize the compass
    void begin();
};

#endif