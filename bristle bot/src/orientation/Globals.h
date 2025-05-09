#pragma once

#include <Wire.h>
#include <QMC5883LCompass.h>
#include <SparkFunLSM6DS3.h>
#include <MadgwickAHRS.h>

// Sensor objects (defined in SensorFusion.cpp)
extern QMC5883LCompass mag;
extern LSM6DS3 imu;
extern Madgwick filter;

// Global calibration variables for the magnetometer
extern float offsetX, offsetY, offsetZ;
extern float scaleX, scaleY, scaleZ;
