Beacon setup procedure

1) Setup each Raspberry Pi with Raspbian OS, boot and open a terminal. (Easiest way is to specify WiFi details, and enabling SSH when creating the disk image, and accessing through SSH)

2) Create a Python file using nano or vi, with the code in setup.py.

3) Now similararly create a systemd service file to setup the script to run at startup. 
```
sudo nano /etc/systemd/system/beacon.service
```

```
[Unit]
Description=Beacon Service
After=network.target

[Service]
ExecStart=/usr/bin/python /full/path/to/beacon.py --name RasPiX
Restart=on-failure
User=pi
WorkingDirectory=/full/path/to/script/directory

[Install]
WantedBy=multi-user.target
```

4) Now enable the sercive by running
```
sudo systemctl enable beacon.service
```