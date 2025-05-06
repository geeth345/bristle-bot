import asyncio
import time
import yaml
from pathlib import Path
import bleak

from loguru import logger

bot_disconnect_timeout = 5
bot_remove_timeout = 300 #NYI

company_ids = {}

class Bot:
    def __init__(self, bot_id, bluetooth_mac, name, rssi, manuf):
        logger.info(f"Creating new Bot entry: id:{{{bot_id}}} name: {{{name}}} rssi: {{{rssi}}} manf: {{{manuf}}}")
        self.id = bot_id
        self.bluetooth_mac = bluetooth_mac
        self.last_seen = time.time()
        self.status = {"connected" : True, "rssi" : rssi, "manuf" : manuf}
        self.name = name
    
    def __str__(self):
        return f"{{{self.name}  id:{{{self.id}}} rssi: {{{self.status["rssi"]}}} manuf: {{{self.status["manuf"]}}}}}"

bot_registry: dict[str, Bot] = {}

async def scan_loop():
    logger.debug("Setting up BLE scanner")
    
    async def detection_callback(device: bleak.BLEDevice, adv_data: bleak.AdvertisementData):
        ble_id = device.address
        bot_id = device.address
        #logger.debug(f"Found Device: {{{ble_id}}} {device.metadata} {adv_data}")
        #logger.debug("{}", adv_data.manufacturer_data)
        #if (adv_data.rssi > -50):
        #    return
        
        manuf = adv_data.manufacturer_data
        # ignore Apple
        try: 
            key = list(manuf.keys())[0]
            if (key == 76):
                return
            manuf = company_ids[key]
        except:
            pass#logger.warning(manuf)
        
        # Decode data into the Bot
        if (bot_id not in bot_registry.keys()):
            
            bot_registry[bot_id] = Bot(bot_id, ble_id, adv_data.local_name, adv_data.rssi, manuf)
        else:
            bot_registry[bot_id].last_seen = time.time()
            bot_registry[bot_id].status["connected"] = True
            bot_registry[bot_id].status["rssi"] = adv_data.rssi
            #logger.debug("{}, {}", bot_registry[bot_id], manuf)
    
    scanner = bleak.BleakScanner(detection_callback)
    await scanner.start()
    logger.info("BLE Scanner Started")
    
    try:
        while True:
            await asyncio.sleep(1)
    finally:
        await scanner.stop()

async def timeout_loop():
    logger.debug("Starting timeout Loop")
    while True:
        now = time.time()
        count = 0
        for bot in bot_registry.values():
            # timeout
            if (bot.last_seen + bot_disconnect_timeout < now):
                #logger.warning(f"Bot {{{bot.id}}} not seen for more than 5 seconds.")
                bot.status["connected"] = False
            else:
                count += 1
        logger.info("Known connected devices: {}/{}", count, len(bot_registry))
        for bot in bot_registry.values():
            if bot.status["connected"]:
                logger.info("Device: {}", bot)
            else:
                logger.warning("Device: {}", bot)
        await asyncio.sleep(1)

async def main():
    logger.debug("Reading manufacturer IDs")
    indata = yaml.safe_load(Path("company_identifiers.yaml").read_text())["company_identifiers"]
    for d in indata:
        company_ids[d["value"]] = d["name"]
    #logger.debug(company_ids)
    await asyncio.gather(scan_loop(), timeout_loop())

if __name__ == "__main__":
    asyncio.run(main())