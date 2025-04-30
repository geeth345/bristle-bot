import bleak
import asyncio
import time
from enum import Enum
import typing

from loguru import logger

bot_disconnect_timeout = 5
bot_remove_timeout = 300 #NYI

class Bot:
    def __init__(self, bot_id, bluetooth_mac):
        logger.info(f"Creating new Bot entry: id:{{{bot_id}}}")
        self.id = bot_id
        self.bluetooth_mac = bluetooth_mac
        self.last_seen = time.time()
        self.status = {"connected" : True}

bot_registry: dict[str, Bot] = {}

async def scan_loop():
    logger.debug("Setting up BLE scanner")
    
    async def detection_callback(device: bleak.BLEDevice, adv_data: bleak.AdvertisementData):
        ble_id = device.address
        bot_id = device.address
        logger.info(f"Found Device: {{{ble_id}}}")
        logger.info("{}", adv_data.manufacturer_data)
        # Decode data into the Bot
        if (bot_registry[bot_id] == None):
            bot_registry[bot_id] = Bot(bot_id, ble_id)
    
    scanner = bleak.BleakScanner(detection_callback)
    await scanner.start()
    logger.info("BLE Scanner Started")
    
    try:
        while True:
            await asyncio.sleep()
    finally:
        await scanner.stop()

async def timeout_loop():
    logger.debug("Starting timeout Loop")
    while True:
        now = time.now()
        for bot in bot_registry.values():
            # timeout
            if (bot.last_seen + bot_disconnect_timeout > now):
                logger.warning(f"Bot {{{bot.id}}} not seen for more than 5 seconds.")
                bot.status["connected" : False]
        await asyncio.sleep(1)

async def main():
    await asyncio.gather(scan_loop(), timeout_loop())

if __name__ == "__main__":
    asyncio.run(main())