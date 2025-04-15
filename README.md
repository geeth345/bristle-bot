Building an RSSI-based localisation based bristle bot swarm, for ELEC6216 Biologically Inspired Robotics. Bristle bots are based on a Seeed Studio Xiao nRF82540.

Tested with three RaspberryPi-based beacons, which advertise as Bluetooth peripherals. The bots don't need to connect, as they just need to measure the signal strength of the advertising packets. The beacon setup is straightforward, using the standard Raspberry Pi OS they can be setup using the `bluetoothctl` command, either in the terminal or over SSH.
