#pragma once

namespace BLEManager
{

    // initialises BLE system
    void setupBLE();

    // swaps the BLE between scanning and advertising based on internal delay
    void swapClientServer();

    // provides that status of the BLE system
    bool isScanning();

}
