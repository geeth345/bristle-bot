#include "CompassModule.h"
#include <Arduino.h>

// Initialize the compass module
void CompassModule::begin() {
    // Initialize the QMC5883L compass
    compass.init();
    compass.setSmoothing(10, true); // Average 10 readings for smoother output
    
    // Apply declination correction based on your location
    // You can find your declination at: https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml
    // For example, if your declination is +13° 30' East:
    this->setDeclinationAngle(13.5);  // Positive for East, negative for West
}

// Read the magnetometer and return the heading
float CompassModule::readHeading() {
    compass.read();
    
    // Get raw values
    float mx = compass.getX();
    float my = compass.getY();
    float mz = compass.getZ();
    
    // Apply calibration
    applyCalibration(mx, my, mz);
    
    // Calculate heading
    float heading = atan2(my, mx) * 180.0 / PI;
    
    // Apply declination correction
    heading += declinationAngle;
    
    // Normalize to 0-360
    if (heading < 0) {
        heading += 360;
    }
    if (heading >= 360) {
        heading -= 360;
    }
    
    return heading;
}

// Get compass direction as a string
String CompassModule::getDirection(float heading) {
    if ((heading >= 337.5) || (heading < 22.5)) {
        return "N";
    } else if ((heading >= 22.5) && (heading < 67.5)) {
        return "NE";
    } else if ((heading >= 67.5) && (heading < 112.5)) {
        return "E";
    } else if ((heading >= 112.5) && (heading < 157.5)) {
        return "SE";
    } else if ((heading >= 157.5) && (heading < 202.5)) {
        return "S";
    } else if ((heading >= 202.5) && (heading < 247.5)) {
        return "SW";
    } else if ((heading >= 247.5) && (heading < 292.5)) {
        return "W";
    } else {
        return "NW";
    }
}

// Calibrate the magnetometer
void CompassModule::calibrate() {
    Serial.println("=== QMC5883L Compass Calibration ===");
    Serial.println("Please rotate the sensor in all directions in a figure-8 pattern.");
    Serial.println("Calibration will run for 60 seconds.");
    Serial.println("Starting in 3 seconds...");
    // delay(3000);
    
    Serial.println("Calibration started!");
    
    long startTime = millis();
    long samples = 0;
    long duration = 60000;  // 60 seconds calibration
    
    float minX = 32767, maxX = -32767;
    float minY = 32767, maxY = -32767;
    float minZ = 32767, maxZ = -32767;
    
    while (millis() - startTime < duration) {
        compass.read();
        float mx = compass.getX();
        float my = compass.getY();
        float mz = compass.getZ();
        
        // Ignore readings outside reasonable range
        if (mx == 0 && my == 0 && mz == 0) continue;
        
        // Update min/max values
        minX = min(minX, mx);
        maxX = max(maxX, mx);
        minY = min(minY, my);
        maxY = max(maxY, my);
        minZ = min(minZ, mz);
        maxZ = max(maxZ, mz);
        
        samples++;
        
        // Progress update every 5 seconds
        if (samples % 100 == 0) {
            int progress = (millis() - startTime) * 100 / duration;
            Serial.print("Progress: ");
            Serial.print(progress);
            Serial.println("%");
        }
        
        delay(10);
    }
    
    // Calculate offsets
    magOffsetX = (maxX + minX) / 2.0;
    magOffsetY = (maxY + minY) / 2.0;
    magOffsetZ = (maxZ + minZ) / 2.0;
    
    // Calculate scales
    float deltaX = (maxX - minX) / 2.0;
    float deltaY = (maxY - minY) / 2.0;
    float deltaZ = (maxZ - minZ) / 2.0;
    
    float maxDelta = max(max(deltaX, deltaY), deltaZ);
    
    // Using the maximum delta for normalization
    magScaleX = (deltaX == 0) ? 1.0 : maxDelta / deltaX;
    magScaleY = (deltaY == 0) ? 1.0 : maxDelta / deltaY;
    magScaleZ = (deltaZ == 0) ? 1.0 : maxDelta / deltaZ;
    
    Serial.println("=== Calibration Complete! ===");
    printCalibrationData();
}

// Apply calibration to raw magnetometer readings
void CompassModule::applyCalibration(float &mx, float &my, float &mz) {
    // Apply offsets and scaling
    mx = (mx - magOffsetX) * magScaleX;
    my = (my - magOffsetY) * magScaleY;
    mz = (mz - magOffsetZ) * magScaleZ;
}

// Print calibration data
void CompassModule::printCalibrationData() {
    Serial.println("=== Calibration Data ===");
    Serial.print("Offset X: "); Serial.println(magOffsetX);
    Serial.print("Offset Y: "); Serial.println(magOffsetY);
    Serial.print("Offset Z: "); Serial.println(magOffsetZ);
    
    Serial.print("Scale X: "); Serial.println(magScaleX);
    Serial.print("Scale Y: "); Serial.println(magScaleY);
    Serial.print("Scale Z: "); Serial.println(magScaleZ);
}

// Set the declination angle (in degrees)
void CompassModule::setDeclinationAngle(float angle) {
    declinationAngle = angle;
    Serial.print("Declination angle set to: ");
    Serial.print(angle);
    Serial.println(" degrees");
}

// Tilt compensation using accelerometer data
float CompassModule::readTiltCompensatedHeading(float ax, float ay, float az) {
    compass.read();
    
    // Get raw magnetometer values
    float mx = compass.getX();
    float my = compass.getY();
    float mz = compass.getZ();
    
    // Apply calibration
    applyCalibration(mx, my, mz);
    
    // Normalize acceleration readings
    float norm = sqrt(ax*ax + ay*ay + az*az);
    if (norm == 0.0f) return 0.0f; // Prevent division by zero
    
    ax /= norm;
    ay /= norm;
    az /= norm;
    
    // Calculate pitch and roll (in radians)
    float pitch = asin(-ax);
    float roll = asin(ay / cos(pitch));
    
    // Tilt compensation
    float cosRoll = cos(roll);
    float sinRoll = sin(roll);
    float cosPitch = cos(pitch);
    float sinPitch = sin(pitch);
    
    // Apply tilt compensation to magnetometer readings
    float Xh = mx * cosPitch + mz * sinPitch;
    float Yh = mx * sinRoll * sinPitch + my * cosRoll - mz * sinRoll * cosPitch;
    
    // Calculate heading
    float heading = atan2(Yh, Xh) * 180.0 / PI;
    
    // Apply declination correction
    heading += declinationAngle;
    
    // Normalize to 0-360
    if (heading < 0) {
        heading += 360;
    }
    if (heading >= 360) {
        heading -= 360;
    }
    
    return heading;
}