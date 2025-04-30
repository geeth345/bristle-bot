# a python script to setup the beacon by running a series of bluetoothctl commands in a terminal 

import time
import subprocess
import argparse

class BLEBeacon:

    def __init__(self, name="RasPiX", duration=9999, interval=100):
        self.process = None
        self.name = name
        self.duration = duration
        self.interval = interval

    def start_beacon(self):

        print("Starting BLE beacon...")

        commands = [
            "power on",
            "agent on",
            "menu advertise",
            "name " + self.name,
            "duration " + str(self.duration),
            "interval " + str(self.interval),
            "discoverable on",
            "back",
            "advertise on",
        ]

        self.process = subprocess.Popen(
            ["bluetoothctl"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            universal_newlines=True,
        )

        for command in commands:
            print(f"Executing command: {command}")
            self.process.stdin.write(command + "\n")
            self.process.stdin.flush()
            # # Read the output and print it
            # while True:
            #     output = self.process.stdout.readline()
            #     if output == "" and self.process.poll() is not None:
            #         break
            #     if output:
            #         print(output.strip())
            print("\n")
        
        print("BLE beacon started.")

    def stop_beacon(self):
        print("Stopping BLE beacon...")
        commands = [
            "advertise off",
            "exit"
        ]
        for command in commands:
            print(f"Executing command: {command}")
            self.process.stdin.write(command + "\n")
            self.process.stdin.flush()
            # # Read the output and print it
            # while True:
            #     output = self.process.stdout.readline()
            #     if output == "" and self.process.poll() is not None:
            #         break
            #     if output:
            #         print(output.strip())
            # print("\n")
        self.process.terminate()
        self.process = None



if __name__ == "__main__":
    # optionally parse args
    parser = argparse.ArgumentParser(description="BLE Beacon Setup")
    parser.add_argument("--name", type=str, default="RasPiX", help="Name of the beacon")
    parser.add_argument("--duration", type=int, default=9999, help="Duration of advertisement in seconds")
    parser.add_argument("--interval", type=int, default=100, help="Interval of advertisement packets in ms")
    args = parser.parse_args()

    # Create a BLEBeacon instance
    beacon = BLEBeacon(args.name, args.duration, args.interval)
    # Start the beacon
    beacon.start_beacon()

    print("Press Ctrl+C to stop the beacon.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        # Stop the beacon
        print("Stopping BLE beacon...")
        beacon.stop_beacon()
        print("BLE beacon stopped.")

