#include <math.h>

// Beacon positions (x, y) in meters
#define BEACON1_X 0.0
#define BEACON1_Y 0.0
#define BEACON2_X 3.0
#define BEACON2_Y 0.0
#define BEACON3_X 1.5
#define BEACON3_Y 4.0

// Function to estimate distance from RSSI
float estimateDistance(int8_t rssi) {
  float txPower = -59.0; // RSSI at 1 meter (calibrate this for your environment)
  float ratio = (txPower - rssi) / 20.0;
  return pow(10, ratio); // Distance in meters
}

// Function to perform least-squares trilateration
void leastSquaresTrilateration(float d1, float d2, float d3, float &x, float &y) {
  // Beacon positions
  float x1 = BEACON1_X, y1 = BEACON1_Y;
  float x2 = BEACON2_X, y2 = BEACON2_Y;
  float x3 = BEACON3_X, y3 = BEACON3_Y;

  // Initialize variables
  float A[2][2] = {{2 * (x2 - x1), 2 * (y2 - y1)},
                   {2 * (x3 - x2), 2 * (y3 - y2)}};
  float B[2] = {pow(d1, 2) - pow(d2, 2) - pow(x1, 2) + pow(x2, 2) - pow(y1, 2) + pow(y2, 2),
                pow(d2, 2) - pow(d3, 2) - pow(x2, 2) + pow(x3, 2) - pow(y2, 2) + pow(y3, 2)};

  // Solve the system of equations: A * X = B
  float det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (det == 0) {
    Serial.println("No unique solution (beacons are collinear)");
    return;
  }

  x = (B[0] * A[1][1] - B[1] * A[0][1]) / det;
  y = (A[0][0] * B[1] - A[1][0] * B[0]) / det;
}

void setup() {
  Serial.begin(115200);

  // Example RSSI values from three beacons
  int8_t rssi1 = -60; // RSSI from beacon 1
  int8_t rssi2 = -65; // RSSI from beacon 2
  int8_t rssi3 = -70; // RSSI from beacon 3

  // Estimate distances
  float d1 = estimateDistance(rssi1);
  float d2 = estimateDistance(rssi2);
  float d3 = estimateDistance(rssi3);

  // Perform least-squares trilateration
  float x, y;
  leastSquaresTrilateration(d1, d2, d3, x, y);

  // Output the estimated position
  Serial.print("Estimated Position: (");
  Serial.print(x);
  Serial.print(", ");
  Serial.print(y);
  Serial.println(")");
}

void loop() {
  // Main loop
}