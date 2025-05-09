#include "Calibration.h"
//#include <FlashStorage.h>
#include <QMC5883LCompass.h>
#include <Wire.h>

#define NUM_SAMPLES 100

typedef struct {
    float offsetX, offsetY, offsetZ;
    float scaleX, scaleY, scaleZ;
} CalibrationData;

// Flash storage setup
//FlashStorage(calibrationDataStorage, CalibrationData);

CalibrationData calibData = {0.0, 0.0, 0.0, 1.0, 1.0, 1.0};

// Calibration function
void calibrateMagnetometer(QMC5883LCompass &compass) {
    float minVals[3] = {9999, 9999, 9999};
    float maxVals[3] = {-9999, -9999, -9999};

    Serial.println("Starting Calibration...");
    for (int i = 0; i < 100; i++) {
        compass.read();  // updates internal values

        float mx = compass.getX();
        float my = compass.getY();
        float mz = compass.getZ();

        minVals[0] = min(minVals[0], mx);
        maxVals[0] = max(maxVals[0], mx);
        minVals[1] = min(minVals[1], my);
        maxVals[1] = max(maxVals[1], my);
        minVals[2] = min(minVals[2], mz);
        maxVals[2] = max(maxVals[2], mz);

        delay(50);
        // BLINK LED to notify user of calibration phase
        digitalWrite(LED_BLUE, !digitalRead(LED_BLUE)); //invert

        

    }

    calibData.offsetX = (maxVals[0] + minVals[0]) / 2.0;
    calibData.scaleX = 2.0 / (maxVals[0] - minVals[0]);
    calibData.offsetY = (maxVals[1] + minVals[1]) / 2.0;
    calibData.scaleY = 2.0 / (maxVals[1] - minVals[1]);
    calibData.offsetZ = (maxVals[2] + minVals[2]) / 2.0;
    calibData.scaleZ = 2.0 / (maxVals[2] - minVals[2]);

    Serial.println("Calibration Complete.");
    printCalibrationData();
}


// Apply calibration to magnetometer data
void applyMagnetometerCalibration(float &mx, float &my, float &mz) {
    mx = (mx - calibData.offsetX) * calibData.scaleX;
    my = (my - calibData.offsetY) * calibData.scaleY;
    mz = (mz - calibData.offsetZ) * calibData.scaleZ;
}

// Placeholder for saving calibration
void saveCalibration() {
    Serial.println("Saving calibration data...");
    // Uncomment the next line to enable FlashStorage saving
    // calibrationDataStorage.write(calibData);
    printCalibrationData();
}

// Placeholder for loading calibration
void loadCalibration() {
    Serial.println("Loading calibration data...");
    // Uncomment the next line to enable FlashStorage loading
    // calibData = calibrationDataStorage.read();
    printCalibrationData();
}

// Function to print calibration data for debugging
void printCalibrationData() {
    Serial.print("Offsets - X: "); Serial.print(calibData.offsetX);
    Serial.print(", Y: "); Serial.print(calibData.offsetY);
    Serial.print(", Z: "); Serial.println(calibData.offsetZ);

    Serial.print("Scales - X: "); Serial.print(calibData.scaleX);
    Serial.print(", Y: "); Serial.print(calibData.scaleY);
    Serial.print(", Z: "); Serial.println(calibData.scaleZ);
}
