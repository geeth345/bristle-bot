#include <Arduino.h>
#include <ArduinoBLE.h>
#include <Communication.h>

// ####### Constants and Variables #######
const bool CALLBACK_SCANNING_MODE = true; // true = scan with the callback, false = scan with BLE.available()

const int NUM_BEACONS = 3;
const char *BEACON_NAMES[] = {"RasPi1", "RasPi2", "RasPi3"};
const float BEACON_POSITIONS[3][2] = {
    {0.0, 1.0},   // Beacon1
    {-0.75, 0.0}, // Beacon2
    {0.75, 0.0}   // Beacon3
};

const float POSITION_RANGE[2][2] = {
    {-2.0, 2.0}, // X range
    {-2.0, 2.0}  // Y range
};

// RSSI calibration parameters
const float RSSI_AT_1M = -65.37;       // Calibrated RSSI at 1 meter
const float PATH_LOSS_EXPONENT = 2.68; // Path loss exponent

// Output
const int CALC_MILLIS = 5000;

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
  // Serial.println("Callback triggered");
  if (peripheral.hasLocalName() && peripheral.localName().length() != 0)
  {
    Serial.print("Device discovered with name: ");
    Serial.println(peripheral.localName());
  }
  for (int i = 0; i < NUM_BEACONS; i++)
  {
    const char *name = BEACON_NAMES[i];
    if (peripheral.hasLocalName() && strcmp(peripheral.localName().c_str(), name) == 0)
    {
      Serial.print("Discovered ");
      Serial.println(name);
      insertRSSI(i, peripheral.rssi());
      lastUpdatedTimes[i] = millis();
      //   Serial.print("Discovered ");
      //   Serial.print(name);
      //   Serial.print(" with RSSI: ");
      //   Serial.println(latest_rssi[i]);
      break;
    }
  }
}

void sendPosition(float x, float y)
{
  // first convert the position to a value between 0 and 255
  uint8_t x_pos = map(x, POSITION_RANGE[0][0], POSITION_RANGE[0][1], 0, 255);
  uint8_t y_pos = map(y, POSITION_RANGE[1][0], POSITION_RANGE[1][1], 0, 255);

  // send the position to the communication module
  Comms::update_position(x_pos, y_pos);

}

void initialiseLocalisation()
{

  // Set the event handler for discovered devices
  if (CALLBACK_SCANNING_MODE) {
    BLE.setEventHandler(BLEDiscovered, deviceDiscoveredCallback);
  }
}

void updateLocalisation()
{
  // Serial.println("Update localisation called...");
  if (CALLBACK_SCANNING_MODE) {
    BLE.poll();
    // Serial.println("Polling done...");

  } else {
      //restart the scan every 500ms
      Serial.println("Update localistaiton called...");
      static unsigned long lastScanRestart = 0;
      unsigned long now = millis();
      if (now - lastScanRestart > 500) {
        Serial.println("Restarting scan...");
        BLE.stopScan();
        BLE.scan();
        lastScanRestart = now;
        Serial.println("Scan restarted.");
      }

      //Serial.println("Parse scanned devices");
      BLEDevice dev = BLE.available();
      if (dev) {
        String name = dev.localName();
        for (int i = 0; i < NUM_BEACONS; i++) {
          if (name == BEACON_NAMES[i]) {
            insertRSSI(i, dev.rssi());
            lastUpdatedTimes[i] = now;
            break;
          }
      }
    }
  }


  // Check if we have enough valid RSSI for all beacons
  bool ready = true;
  for (int i = 0; i < NUM_BEACONS; i++)
  {
    if ((buffersFilled[i] ? windowSize : rssiIndexes[i]) == 0)
    {
      // Serial.print("Not enough RSSI data for ");
      // Serial.print(BEACON_NAMES[i]);
      // Serial.println(", skipping...");
      ready = false;
      break;
    }
  }
  if (!ready)
  {
    return;
  }

  Serial.println("Enough valid RSSI, calculating position...");
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

  sendPosition(smoothedX, smoothedY);

}
