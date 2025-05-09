#include "Globals.h"

// NOT CURRENTLY PART OF BOT ATM

// Instantiate sensor objects
QMC5883LCompass mag;
LSM6DS3 imu(I2C_MODE, 0x6A);
Madgwick filter;

void initSensors() {
  Wire.begin();
  imu.begin();
  mag.init();
}

void startFusion() {
  filter.begin(100); // Set the filter update rate to 100 Hz
}

void aDifferentUpdateOrientation() {
  // Directly read raw accelerometer values (assumes these functions trigger a new reading)
  float ax = imu.readRawAccelX();
  float ay = imu.readRawAccelY();
  float az = imu.readRawAccelZ();

  // Directly read raw gyroscope values and convert from degrees/s to radians/s
  float gx = imu.readRawGyroX() * DEG_TO_RAD;
  float gy = imu.readRawGyroY() * DEG_TO_RAD;
  float gz = imu.readRawGyroZ() * DEG_TO_RAD;

  // Update magnetometer readings
  mag.read();
  // Apply calibration to magnetometer data
  float mx = (mag.getX() - offsetX) * scaleX;
  float my = (mag.getY() - offsetY) * scaleY;
  float mz = (mag.getZ() - offsetZ) * scaleZ;

  // Update the Madgwick filter with sensor data
  filter.update(gx, gy, gz, ax, ay, az, mx, my, mz);
}

void printOrientation() {
  Serial.print("Roll: "); Serial.print(filter.getRoll());
  Serial.print("  Pitch: "); Serial.print(filter.getPitch());
  Serial.print("  Yaw: "); Serial.println(filter.getYaw());
}
