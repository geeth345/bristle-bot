#include "BluetoothManager.h"

#include <Arduino.h>
#include <ArduinoBLE.h>
#include <cstdint>

#include "Communication.h"
#include "Localisation.h"

namespace BLEManager
{

    static const uint32_t SWAP_INTERVAL = 1000;

    void setupBLE()
    {
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
        BLE.setAdvertisingInterval(160); // 100ms * 0.625
    }

    static bool scanning = false;
    static uint32_t lastSwap = 0;

    void swapClientServer()
    {
        uint32_t now = millis();
        if (lastSwap + SWAP_INTERVAL > now)
            return;
        if (!scanning)
        {
            Comms::stopAdvertiseBLE();
            Serial.println("Starting scan mode...");
            digitalWrite(LED_BLUE, LOW);
            delay(50);
            BLE.scan(false); // Start scanning for devices
            scanning = true;
        }
        else
        {
            BLE.stopScan();
            digitalWrite(LED_BLUE, HIGH);
            delay(50);
            updateLocalisation();
            Comms::advertiseBLE();
            scanning = false;
        }
        lastSwap = now;
    }

    bool isScanning()
    {
        return scanning;
    }
}
