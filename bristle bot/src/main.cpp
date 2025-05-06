#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>
#include <Locomotion.h>
#include "Communication.h"

#define Do_Communication 1
#define Do_Localisation 0

// ####### Constants and Variables #######
const int NUM_BEACONS = 6;
const char *BEACON_NAMES[] = {"Beacon1", "Beacon2", "Beacon3"};
const float BEACON_POSITIONS[3][2] = {
    {0.0, 1.0},   // Beacon1
    {-0.75, 0.0}, // Beacon2
    {0.75, 0.0}   // Beacon3
};

// RSSI calibration parameters
const float RSSI_AT_1M = -65.37;       // Calibrated RSSI at 1 meter
const float PATH_LOSS_EXPONENT = 2.68; // Path loss exponent

// Output
const int BLINK_MILLIS = 1000;
const int CALC_MILLIS = 5000;
const int BLE_SWAP_MILLIS = 500;

// Store latest values
float latest_rssi[NUM_BEACONS] = {-100.0, -100.0, -100.0};
float distances[NUM_BEACONS] = {0.0, 0.0, 0.0};

// RSSI smoothing variables
const int windowSize = 7;
int rssiBuffers[NUM_BEACONS][windowSize] = {0};
int rssiIndexes[NUM_BEACONS] = {0};
bool buffersFilled[NUM_BEACONS] = {false};

// Position smoothing
float ALPHA = 0.4;
float smoothedX = NAN, smoothedY = NAN;

// Last update times
unsigned long lastUpdatedTimes[NUM_BEACONS] = {0};

// ####### Function Definitions #######

// // Convert RSSI to distance using log-normal shadowing model
// float rssiToDistance(float rssi) {
//   return pow(10, (RSSI_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT));
// }

void insertRSSI(int i, int rssi)
{
  rssiBuffers[i][rssiIndexes[i]] = rssi;
  rssiIndexes[i] = (rssiIndexes[i] + 1) % windowSize;
  if (rssiIndexes[i] == 0)
    buffersFilled[i] = true;
}

float avgRSSI(int i)
{
  int sum = 0;
  int count = buffersFilled[i] ? windowSize : rssiIndexes[i];
  if (count == 0)
    return -100.0;
  for (int j = 0; j < count; j++)
    sum += rssiBuffers[i][j];
  return float(sum) / count;
}

void trilateration(float d[3], float &x, float &y, float &residual)
{
  float weights[3];
  for (int i = 0; i < 3; i++)
    weights[i] = 1.0 / (d[i] * d[i] + 1e-6);

  float x0 = 0.0, y0 = 0.3; // Initial guess near center
  for (int iter = 0; iter < 10; iter++)
  {
    float gradX = 0.0, gradY = 0.0;
    for (int i = 0; i < 3; i++)
    {
      float dx = x0 - BEACON_POSITIONS[i][0];
      float dy = y0 - BEACON_POSITIONS[i][1];
      float ri = sqrt(dx * dx + dy * dy);
      if (ri < 1e-6)
        ri = 1e-6;
      float err = ri - d[i];
      gradX += weights[i] * err * (dx / ri);
      gradY += weights[i] * err * (dy / ri);
    }
    x0 -= 0.1 * gradX;
    y0 -= 0.1 * gradY;
  }
  x = x0;
  y = y0;

  // Compute residual
  residual = 0.0;
  for (int i = 0; i < 3; i++)
  {
    float dx = x - BEACON_POSITIONS[i][0];
    float dy = y - BEACON_POSITIONS[i][1];
    float est = sqrt(dx * dx + dy * dy);
    float err = est - d[i];
    residual += err * err;
  }
  residual = sqrt(residual);
}

// Callback for when adv. packet is detected
void deviceDiscoveredCallback(BLEDevice peripheral)
{
  for (int i = 0; i < NUM_BEACONS; i++)
  {
    const char *name = BEACON_NAMES[i];
    if (peripheral.hasLocalName() &&
        strcmp(peripheral.localName().c_str(), name) == 0)
    {
      latest_rssi[i] = peripheral.rssi();
      //   Serial.print("Discovered ");
      //   Serial.print(name);
      //   Serial.print(" with RSSI: ");
      //   Serial.println(latest_rssi[i]);
      break;
    }
  }
}

void setup()
{
  Serial.begin(9600);

  // Wait for serial monitor with timeout (5 seconds)
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 5000))
  {
    delay(10);
  }

  // LED setup
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  // locomotion setup
  // initialiseLocomotion();

  Serial.println("BLE RSSI tracker starting with 6 beacons...");

  if (!BLE.begin())
  {
    Serial.println("Starting BLE failed!");
    while (1)
    {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(50);
      digitalWrite(LED_BUILTIN, LOW);
      delay(50);
    }
  }

  // Set the event handler for discovered devices
  BLE.setEventHandler(BLEDiscovered, deviceDiscoveredCallback);

#if Do_Communication
  setupCommunication();
#endif

#if Do_Localisation
  // Start continuous scanning
  Serial.println("Starting continuous scan mode...");
  BLE.scan(true);
#endif // Do_Localisation

  // Locomotion setup
  Serial.println("Initialising locomotion...");
  initialiseLocomotion();
}

void loop()
{
  // ############ Blink the LED #############
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > BLINK_MILLIS)
  {
    Serial.println("Blink!");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }

  // ############ Communication ############
#if Do_Communication

  static unsigned long lastSwap = 0;
  static bool advertising = false;
  if (millis() - lastSwap > BLE_SWAP_MILLIS)
  {
    if (advertising)
    {
      stopAdvertiseBLE();
      advertising = false;
    }
    else
    {
      advertiseBLE();
      advertising = true;
    }
    lastSwap = millis();
  }

#endif // Do_Communication

  // ############ Localisation #############

#if Do_Localisation

  // restart the scan every 500ms
  static unsigned long lastScanRestart = 0;
  unsigned long now = millis();
  if (now - lastScanRestart > 500)
  {
    BLE.stopScan();
    BLE.scan();
    lastScanRestart = now;
  }

  BLEDevice dev = BLE.available();
  if (dev)
  {
    String name = dev.localName();
    for (int i = 0; i < NUM_BEACONS; i++)
    {
      if (name == BEACON_NAMES[i])
      {
        insertRSSI(i, dev.rssi());
        lastUpdatedTimes[i] = now;
        break;
      }
    }
  }

  // Check if we have enough valid RSSI for all beacons
  bool ready = true;
  for (int i = 0; i < NUM_BEACONS; i++)
  {
    if ((buffersFilled[i] ? windowSize : rssiIndexes[i]) == 0)
    {
      ready = false;
      break;
    }
  }
  if (ready)
  {
    // onvert RSSI to distance
    float rssi[3], d[3];
    for (int i = 0; i < 3; i++)
    {
      rssi[i] = avgRSSI(i);
      d[i] = pow(10.0, (RSSI_AT_1M - rssi[i]) / (10 * PATH_LOSS_EXPONENT));
    }

    // Trilateration + residual
    float x, y, residual;
    trilateration(d, x, y, residual);

    // Confidence estimation
    float maxResidual = 1.5;
    float confidence = max(0.0, min(1.0, 1.0 - residual / maxResidual));

    // Smoothing
    if (isnan(smoothedX) || isnan(smoothedY))
    {
      smoothedX = x;
      smoothedY = y;
    }
    else
    {
      smoothedX = ALPHA * x + (1 - ALPHA) * smoothedX;
      smoothedY = ALPHA * y + (1 - ALPHA) * smoothedY;
    }

    // Output only if confidence is sufficient
    if (confidence >= 0.5)
    {
      Serial.print("Position: (");
      Serial.print(smoothedX, 2);
      Serial.print(", ");
      Serial.print(smoothedY, 2);
      Serial.print(") | Confidence: ");
      Serial.println(int(confidence * 100));
    }
  }

#endif // Do_Localisation

  // ############ Locomotion #############
  updateLocomotion();
}