import asyncio
import time
import yaml
from pathlib import Path
import bleak
from websockets.asyncio.server import serve
import websockets
import argparse
import json

from loguru import logger

bot_disconnect_timeout = 10
bot_remove_timeout = 60
webserver_port = 8000

company_ids = {}

class Bot:
    def __init__(self, bot_id, bluetooth_mac, name, rssi, manuf_data):
        logger.info(f"Creating new Bot entry: id:{{{bot_id}}} name: {{{name}}} rssi: {{{rssi}}} manf: {{{manuf_data}}}")
        self.id = bot_id
        self.bluetooth_mac = bluetooth_mac
        self.last_seen = time.time()
        self.status = {"connected" : True, "rssi" : rssi, "manuf_data" : manuf_data[65535]}
        self.name = name
        raw_data = manuf_data[65535]
        self.status["manuf_data"] = raw_data
        dataID = 0
        self.x_position = raw_data[dataID]
        dataID += 1
        self.y_position = raw_data[dataID]
        dataID += 1
        self.rotation = raw_data[dataID]
        dataID += 1
        self.status["Battery_level"] = raw_data[dataID]
        dataID += 1
        self.status["Sound_Level"] = raw_data[dataID]
        dataID += 1
    
    def refresh_data(self, rssi, manuf_data):
        self.status["connected"] = True
        self.last_seen = time.time()
        self.status["rssi"] = rssi
        raw_data = manuf_data[65535]
        self.status["manuf_data"] = raw_data
        dataID = 0
        self.x_position = raw_data[dataID]
        dataID += 1
        self.y_position = raw_data[dataID]
        dataID += 1
        self.rotation = raw_data[dataID]
        dataID += 1
        self.status["Battery_level"] = raw_data[dataID]
        dataID += 1
        self.status["Sound_Level"] = raw_data[dataID]
        dataID += 1
    
    def __str__(self):
        return f"{{{self.name}  id:{{{self.id}}} rssi: {{{self.status["rssi"]}}} manuf_data: {{{bytes.hex(self.status["manuf_data"])}}}}}"

bot_registry: dict[str, Bot] = {}

async def scan_loop():
    logger.debug("Setting up BLE scanner")
    
    async def detection_callback(device: bleak.BLEDevice, adv_data: bleak.AdvertisementData):
        ble_id = device.address
        bot_id = device.address
        #logger.debug(f"Found Device: {{{ble_id}}} {device.metadata} {adv_data}")
        
        #if (adv_data.rssi > -50):
        #    return
        
        manuf_name = adv_data.manufacturer_data
        # ignore Apple
        # try: 
        #     key = list(manuf_name.keys())[0]
        #     if (key == 76):
        #         return
        #     manuf_name = company_ids[key]
        # except:
        #     pass
        
        # if adv_data.local_name != None:
        #     logger.debug(adv_data.local_name)
        if adv_data.local_name != "BristleBot":
            return
        # logger.warning("Found!")
        # logger.error("{}", adv_data)

        # Decode data into the Bot
        if (bot_id not in bot_registry.keys()):
            bot_registry[bot_id] = Bot(bot_id, ble_id, adv_data.local_name, adv_data.rssi, adv_data.manufacturer_data)
        else:
            bot_registry[bot_id].refresh_data(adv_data.rssi, adv_data.manufacturer_data)
            logger.debug("refresh: {} {}", bot_id, bot_registry[bot_id])
    
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
                logger.info("id: {} last seen: {} battery: {} x: {} y: {} rotation: {} sound: {}", bot.id, bot.last_seen, bot.status["Battery_level"], bot.x_position, bot.y_position, bot.rotation, bot.status["Sound_Level"])
            else:
                logger.warning("id: {} last seen: {} battery: {} x: {} y: {} rotation: {} sound: {}", bot.id, bot.last_seen, bot.status["Battery_level"], bot.x_position, bot.y_position, bot.rotation, bot.status["Sound_Level"])
        await asyncio.sleep(1)

async def cleanup():
    logger.debug("Start Cleanup Loop")
    while True:
        now = time.time()
        delete_queue = []
        for bot in bot_registry.values():
            if (bot.last_seen + bot_remove_timeout < now):
                logger.warning(f"Bot {{{bot.id}}} not seen for more than {bot_remove_timeout} seconds.")
                delete_queue.append(bot.id)
        for to_delete in delete_queue:
            bot_registry.pop(to_delete)
        await asyncio.sleep(1)

async def get_data(websocket):
    logger.info("Got connection to server!")
    try:
        while True:
            #do something
            logger.debug("Gathering data")
            # Generate JSOn data
            json_output = f"{{ \"timestamp\": {time.time()}, \"robots\": ["
            for bot in bot_registry.values():
                json_output += f"{{\"id\": \"{bot.id}\","
                json_output += f"\"position\": {{\"x\": {bot.x_position}, \"y\": {bot.y_position}}},"
                json_output += "},"
            json_output += "]}"
            await websocket.send(json_output)
            await asyncio.sleep(1)
    except websockets.exceptions.ConnectionClosed:
        pass

async def manage_webserver():
    logger.info("Starting server on port {}", webserver_port)
    async with serve(get_data, "localhost", webserver_port) as server:
        await server.serve_forever()

async def main():
    # logger.debug("Reading manufacturer IDs")
    indata = yaml.safe_load(Path("company_identifiers.yaml").read_text())["company_identifiers"]
    for d in indata:
        company_ids[d["value"]] = d["name"]
    #logger.debug(company_ids)
    try:
        await asyncio.gather(scan_loop(), timeout_loop(), cleanup(), manage_webserver())
    except asyncio.exceptions.CancelledError:
        logger.error("Cancelled, now exiting...")

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Command Server")
    parser.add_argument("--port", help="Which port to run the webserver on (default: 8000)", default=8000, type=int)
    args = parser.parse_args()
    logger.info(args)
    webserver_port = args.port
    asyncio.run(main())