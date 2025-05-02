#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>
#include <Locomotion.h>

// ####### Constants and Variables #######
const int NUM_BEACONS = 6;
const char* BEACON_NAMES[] = {"Beacon1", "Beacon2", "Beacon3", "RasPi1", "RasPi2", "RasPi3"};
const float BEACON_POSITIONS[][2] = {
  {0.0, 1.5},    // Beacon1 position
  {0.0, 0.0},    // Beacon2 position
  {0.0, 3.0},    // Beacon3 position
  {2.0, 3.0},    // Beacon4 position
  {2.0, 1.5},    // Beacon5 position
  {2.0, 0.0}     // Beacon6 position
};

// RSSI calibration parameters
const float RSSI_AT_1M = -53.99;      // Calibrated RSSI at 1 meter
const float PATH_LOSS_EXPONENT = 3.25; // Path loss exponent

// Output
const int BLINK_MILLIS = 1000;
const int CALC_MILLIS = 5000;

// Store latest values
float latest_rssi[NUM_BEACONS] = {-100.0, -100.0, -100.0, -100.0, -100.0, -100.0};
float distances[NUM_BEACONS] = {0.0, 0.0, 0.0, 0.0, 0.0, 0.0};

// ####### Function Definitions #######

// Convert RSSI to distance using log-normal shadowing model
float rssiToDistance(float rssi) {
  return pow(10, (RSSI_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT));
}

// Function to find position using multilateration with least-squares method
void calculatePosition(float &x, float &y) {
  // Calculate distances from RSSI values
  for (int i = 0; i < NUM_BEACONS; i++) {
    distances[i] = rssiToDistance(latest_rssi[i]);
  }
  
  // Multilateration using least squares method
  // For multiple beacons, we'll use the first beacon as reference and create a system of equations
  
  // Initialize matrices for least squares solution
  // We'll have (NUM_BEACONS-1) equations with 2 unknowns (x,y)
  float A[NUM_BEACONS-1][2];
  float B[NUM_BEACONS-1];
  
  for (int i = 0; i < NUM_BEACONS-1; i++) {
    // Set up equations based on differences of squared distances
    // For each pair of beacons, we get an equation in the form:
    // 2*(x_i+1 - x_i)*x + 2*(y_i+1 - y_i)*y = d_i^2 - d_i+1^2 - (x_i^2 - x_i+1^2) - (y_i^2 - y_i+1^2)
    
    float x_i = BEACON_POSITIONS[i][0];
    float y_i = BEACON_POSITIONS[i][1];
    float x_ip1 = BEACON_POSITIONS[i+1][0];
    float y_ip1 = BEACON_POSITIONS[i+1][1];
    
    A[i][0] = 2 * (x_ip1 - x_i);
    A[i][1] = 2 * (y_ip1 - y_i);
    
    B[i] = pow(distances[i], 2) - pow(distances[i+1], 2) - 
           pow(x_i, 2) + pow(x_ip1, 2) - 
           pow(y_i, 2) + pow(y_ip1, 2);
  }
  
  // Use linear least squares to solve the overdetermined system
  // Computing A^T * A and A^T * B
  float ATA[2][2] = {{0, 0}, {0, 0}};
  float ATB[2] = {0, 0};
  
  for (int i = 0; i < NUM_BEACONS-1; i++) {
    for (int j = 0; j < 2; j++) {
      for (int k = 0; k < 2; k++) {
        ATA[j][k] += A[i][j] * A[i][k];
      }
      ATB[j] += A[i][j] * B[i];
    }
  }
  
  // Solve the normal equations (ATA) * X = ATB
  float det = ATA[0][0] * ATA[1][1] - ATA[0][1] * ATA[1][0];
  if (abs(det) < 0.0001) {  // Check for zero determinant with small epsilon
    Serial.println("No unique solution (matrix is singular)");
    return;
  }
  
  x = (ATB[0] * ATA[1][1] - ATB[1] * ATA[0][1]) / det;
  y = (ATA[0][0] * ATB[1] - ATA[1][0] * ATB[0]) / det;
}

// Callback for when adv. packet is detected
void deviceDiscoveredCallback(BLEDevice peripheral) {
  for (int i = 0; i < NUM_BEACONS; i++) {
    const char* name = BEACON_NAMES[i];
    if (peripheral.hasLocalName() && 
        strcmp(peripheral.localName().c_str(), name) == 0) {
      latest_rssi[i] = peripheral.rssi();
    //   Serial.print("Discovered ");
    //   Serial.print(name);
    //   Serial.print(" with RSSI: ");
    //   Serial.println(latest_rssi[i]);
      break;
    }
  }
}

void setup() {
  Serial.begin(9600);
  
  // Wait for serial monitor with timeout (5 seconds)
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 5000)) {
    delay(10);
  }
  
  // LED setup
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  // locomotion setup
  // initialiseLocomotion();
  
  Serial.println("BLE RSSI tracker starting with 6 beacons...");
  
  if (!BLE.begin()) {
    Serial.println("Starting BLE failed!");
    while (1) {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(100);
      digitalWrite(LED_BUILTIN, LOW);
      delay(100);
    }
  }
  
  // Set the event handler for discovered devices
  BLE.setEventHandler(BLEDiscovered, deviceDiscoveredCallback);
  
  // Start continuous scanning
  Serial.println("Starting continuous scan mode...");
  BLE.scan(true);
}

void loop() {
  // Poll BLE events
  BLE.poll();
  
  // Blink the LED
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > BLINK_MILLIS) {
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }
  
  // Calculate position every 5 seconds
  static unsigned long lastCalc = 0;
  if (millis() - lastCalc > CALC_MILLIS) {
    float x = 0, y = 0;
    calculatePosition(x, y);
    
    Serial.print("Latest RSSI: ");
    for (int i = 0; i < NUM_BEACONS; i++) {
      Serial.print(BEACON_NAMES[i]);
      Serial.print(": ");
      Serial.print(latest_rssi[i]);
      Serial.print(" dBm (");
      Serial.print(rssiToDistance(latest_rssi[i]), 2);
      Serial.print("m) ");
    }
    
    Serial.print("| Estimated Position: (");
    Serial.print(x, 2);
    Serial.print(", ");
    Serial.print(y, 2);
    Serial.println(")");
    
    lastCalc = millis();
  }
  
  //Locomotion control
  //updateLocomotion();
}