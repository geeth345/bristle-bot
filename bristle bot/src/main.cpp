#include <Arduino.h>
#include <ArduinoBLE.h>


const char* BEACON_NAMES[] = {"RasPi1", "RasPi2", "RasPi3"};

void deviceDiscoveredCallback(BLEDevice peripheral) {
  bool isKnownBeacon = false;
  for (const char* name : BEACON_NAMES) {
    if (peripheral.hasLocalName() && strcmp(peripheral.localName().c_str(), name) == 0) {
      isKnownBeacon = true;
      Serial.print(peripheral.localName());
      Serial.print(",");
      // Serial.print(peripheral.address());
      // Serial.print(",RSSI: ");
      Serial.print(peripheral.rssi());
      Serial.print(",");
      // Serial.println(" dBm");
      // Serial.print("Timestamp: ");
      Serial.println(millis());
      break;
    }
  }
}
  
  // if (!isKnownBeacon) {
  //   Serial.print("Unknown");
  // }
  


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
      delay(500);
      digitalWrite(LED_BUILTIN, LOW);
      delay(500);
    }
  }
  
  BLE.setEventHandler(BLEDiscovered, deviceDiscoveredCallback);
  
  //  continuous scanning
  Serial.println("Starting continuous scan mode...");
  BLE.scan(true);
  
  Serial.println("Monitoring for BLE devices...");
}

void loop() {
  // poll instead of scan in the loop
  BLE.poll();
  
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > 1000) {
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    lastBlink = millis();
  }
  
  // other code 
  delay(10);
}


// // put function declarations here:
// int myFunction(int, int);

// void setup() {
  
//   Serial.begin(9600);
//   while (!Serial);

//   if (!BLE.begin()) {
//     Serial.println("starting BLE failed!");
//     while (1);
//   }

//   Serial.println("BLE started\n");


// }

// void loop() {
//   // put your main code here, to run repeatedly:
//   Serial.println("Scanning...");
//   BLE.scan();
//   digitalWrite(LED_BUILTIN, LOW);

//   delay(5000);


//   // print the results of the scan
//   //Serial.print("Number of Devices Found: ");
//   //Serial.println(BLE.available());

//   // details of each device
//   Serial.println("Device List: ");
//   while (BLEDevice peripheral = BLE.available()) {
//     Serial.print("Name: ");
//     if (peripheral.hasLocalName()) {
//       Serial.print(peripheral.localName());
//     } else {
//       Serial.print("Unknown");
//     }
    
//     Serial.print(", Address: ");
//     Serial.print(peripheral.address());
    
//     Serial.print(", RSSI: ");
//     Serial.print(peripheral.rssi());
//     Serial.println(" dBm");
//   }

//   BLE.stopScan();
//   digitalWrite(LED_BUILTIN, HIGH);


//   delay(1000);



// }
