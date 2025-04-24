import bleak
import asyncio

from loguru import logger

async def scan_devices():
    return await bleak.BleakScanner.discover(timeout=5.0)

def main():
    logger.info("Hello World")
    devices = asyncio.run(scan_devices())
    for device in devices:
        logger.info(f"{device.name} [{device.address}] RSSI={device.rssi}")

if __name__ == "__main__":
    main()