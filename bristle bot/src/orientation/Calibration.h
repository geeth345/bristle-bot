#pragma once

void saveCalibration();
void runCalibration();

#ifndef CALIBRATION_H
#define CALIBRATION_H

#include <QMC5883LCompass.h>

void calibrateMagnetometer(QMC5883LCompass &compass);
void applyMagnetometerCalibration(float &mx, float &my, float &mz);
void saveCalibration();
void loadCalibration();
void printCalibrationData();

#endif


