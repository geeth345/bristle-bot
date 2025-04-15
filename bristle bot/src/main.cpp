#include <Arduino.h>
#include <ArduinoBLE.h>
#include <utility>
#include <cmath>

// ####### Constants and Variables #######
const int NUM_BEACONS = 3;
const char* BEACON_NAMES[] = {"RasPi1", "RasPi2", "RasPi3"};
const float BEACON_POSITIONS[][2] = {
  {0.0, 0.0},	// RasPi1 position
  {3.0, 0.0},	// RasPi2 position
  {1.5, 2.5} 	// RasPi3 position
};

// RSSI calibration parameters
const float RSSI_AT_1M = -65.0;  // Calibrated RSSI at 1 meter
const float PATH_LOSS_EXPONENT = 2.8;  // Path loss exponent

// Output
const int BLINK_MILLIS = 1000; 
const int CALC_MILLIS = 5000; 

// Store latest values
float latest_rssi[NUM_BEACONS] = {-100.0, -100.0, -100.0};


// ####### Function Definitions #######

// Convert RSSI to distance using log-normal shadowing model
float rssiToDistance(float rssi) {
    return pow(10, (RSSI_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT));
}


// Function to find position using least-squares trilateration
void calculatePosition(float &x, float &y) {
    // temp variables for beacon positions
    float x1 = BEACON_POSITIONS[0][0], y1 = BEACON_POSITIONS[0][1];
    float x2 = BEACON_POSITIONS[1][0], y2 = BEACON_POSITIONS[1][1];
    float x3 = BEACON_POSITIONS[2][0], y3 = BEACON_POSITIONS[2][1];
  
    // Initialize variables
    float A[2][2] = {{2 * (x2 - x1), 2 * (y2 - y1)},
                     {2 * (x3 - x2), 2 * (y3 - y2)}};
    float B[2] = {pow(latest_rssi[0], 2) - pow(latest_rssi[1], 2) - pow(x1, 2) + pow(x2, 2) - pow(y1, 2) + pow(y2, 2),
                  pow(latest_rssi[1], 2) - pow(latest_rssi[2], 2) - pow(x2, 2) + pow(x3, 2) - pow(y2, 2) + pow(y3, 2)};
  
    // Solve the system of equations: A * X = B
    float det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (det == 0) {
      Serial.println("No unique solution (beacons are collinear)"); // TODO: better error handling?
      return;
    }
  
    x = (B[0] * A[1][1] - B[1] * A[0][1]) / det;
    y = (A[0][0] * B[1] - A[1][0] * B[0]) / det;
  }



// Callback for when adv. packet is detected
void deviceDiscoveredCallback(BLEDevice peripheral) {
    for (int i = 0; i < NUM_BEACONS; i++) {
        const char* name = BEACON_NAMES[i];
	if (peripheral.hasLocalName() &&
         strcmp(peripheral.localName().c_str(), name) == 0) {
  	    latest_rssi[i] = peripheral.rssi();
  	    break;
        }
    }
}

void setup() {
    Serial.begin(9600);
    delay(1000);
 
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);
 
    Serial.println("BLE RSSI tracker starting...");
 
    if (!BLE.begin()) {
            Serial.println("Starting BLE failed!");
            while (1) {
  	    digitalWrite(LED_BUILTIN, HIGH);
  	    delay(100);
  	    digitalWrite(LED_BUILTIN, LOW);
  	    delay(100);
        }
    }
 
    BLE.setEventHandler(BLEDiscovered, deviceDiscoveredCallback);
 
    // continuous scanning
    Serial.println("Starting continuous scan mode...");
    BLE.scan(true);

}

void loop() {
    // poll instead of scan in the loop
    BLE.poll();
 
    // blink the LED
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > BLINK_MILLIS) {
        digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
        lastBlink = millis();
    }
    // calculate position every 5 seconds
    static unsigned long lastCalc = 0;
    if (millis() - lastCalc > CALC_MILLIS) {
        float x, y;
        calculatePosition(x, y);
        Serial.print("Estimated Position: (");
        Serial.print(x);
        Serial.print(", ");
        Serial.print(y);
        Serial.println(")");
        lastCalc = millis();
    }

}



