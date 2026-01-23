# ESP-IDF OpenThread Border Router on Sonoff Dongle-M

> ⚠️ **IMPORTANT – PROOF OF CONCEPT ONLY** ⚠️  
> This project is **NOT production-ready**.
>
> - This is a **proof of concept port** of Espressif’s ESP-IDF OpenThread Border Router to the Sonoff Dongle-M.
> - It is **relatively untested**, may be **unstable**, and **may break at any time**.
> - It is **not actively maintained**.
> - There are **no guarantees** of correctness, reliability, security, or long-term support.
>
> This repository exists to **prove feasibility** and to provide a starting point for others who *do* have the time and interest to take this further.

---

## Upstream project

This work is a **port / adaptation** of Espressif’s official ESP-IDF OpenThread Border Router example:

- https://github.com/espressif/esp-idf

Specifically based on the **Basic OpenThread Border Router example** provided by Espressif.

All credit for the underlying OpenThread / ESP-IDF implementation belongs to Espressif.

⚠️ This repository is a fork,
heavily modified for **Sonoff Dongle-M hardware**.
It is not intended to be merged back upstream.

---

## Overview

This firmware allows the **ESP32 inside the Sonoff Dongle-M** to run an **OpenThread Border Router (OTBR)**, communicating with the onboard **EFR32MG24** running Thread RCP firmware.

The EFR32MG24 continues to act purely as a **Thread Radio Co-Processor (RCP)**. The ESP32 handles:

- OpenThread Border Router services inc. NAT64
- Web UI for Thread dataset management
- Ethernet / Wi-Fi networking
- Integration with Home Assistant

---

## Prerequisites (Sonoff stock setup)

Before flashing this firmware, the **standard Sonoff Dongle-M setup must be completed**.

### Step 1 – Initial Dongle-M setup

1. Power up the Dongle-M  
2. Join the temporary AP it creates  
3. Set a password  
4. Re-join the secure AP using the new password  
5. Configure Wi-Fi credentials  
6. Find the Dongle-M IP address on your network  
7. Open the IP address in a web browser  

### Step 2 – Enable Thread RCP mode

1. Log in to the Sonoff web UI using the password you set  
2. Go to **EFR32MG24 → Operation Mode**  
3. Enable **Thread RCP Mode**

This step flashes the **EFR32MG24** with the required Thread RCP firmware.

---

## Flashing this firmware

There are **two supported methods**.

---

## Method 1 – Flashing the pre-compiled firmware (recommended)

### Steps

3. Download the **dongle_m_otbr_merged.bin** from this repository’s Releases:  
   https://github.com/Scoobler/esp-thread-br-sonoff-donglem/releases/tag/dongle-m-v1.0 
5. Plug the Dongle-M into your computer via USB  
6. Open the Sonoff Dongle Flasher:  
   https://dongle.sonoff.tech/sonoff-dongle-flasher/  
7. Click **Connect** and select the correct serial port for the Dongle-M  
   (port selection may be requested twice – this is normal)  
8. Once the flasher detects the device, click **Select**  
9. Choose **Customize**  
10. Upload the downloaded combined firmware file  

When flashing completes, the Dongle-M will reboot automatically.

> ℹ️ **Note:** The Sonoff **Web UI firmware update page will NOT accept this firmware**.  
> You must use a raw flasher such as the Sonoff Dongle Flasher or `esptool`.

---

## Method 2 – Flashing from source using ESP-IDF

### Requirements

- ESP-IDF **v5.5.2**

### Steps

3. Clone this repository:

   ```bash
   git clone https://github.com/Scoobler/esp-thread-br-sonoff-donglem
   ```

4. Open an **ESP-IDF command prompt**
5. Change into the example directory:

   ```bash
   cd examples/basic_thread_border_router
   ```

6. Flash the firmware:

   ```bash
   idf.py reconfigure erase-flash build flash
   ```

---

## Boot & network behaviour

On boot, the firmware attempts network connectivity in the following order:

1. **Ethernet**  
   - If a valid IP address is obtained, Ethernet is used

2. **Wi-Fi (saved credentials)**  
   - If credentials exist and connection succeeds, Wi-Fi is used

3. **Wi-Fi AP mode (no credentials)**  
   - If no credentials are stored, the device starts an AP for configuration

4. **Wi-Fi retry & recovery**
   - If credentials exist but Wi-Fi fails:
     - The device reboots and retries
     - After **5 failed boots**, AP mode starts
     - AP remains active for **5 minutes**
     - If no new credentials are entered:
       - Device reboots and retries Wi-Fi
       - Cycle repeats

---

## LED status indicators

### Boot

- Quick **Red → Green → Blue** flash sequence

### Interface connection

- **Blue** – Connected via Ethernet  
- **Orange** – Connected via Wi-Fi  
- **Purple** – AP mode active  

### Thread state

- **Green flashing** – Thread network running  
- **Red flashing** – Thread network not running  

---

## Web UI – OpenThread management

Once connected via Ethernet or Wi-Fi:

- Open the device IP address in a browser  
  (when using AP mode, an mDNS URL is shown and can be copied instead)

The OpenThread web interface allows:

- Viewing and editing the Thread dataset
- Copying / restoring the Thread TLV (dataset backup)
- Viewing network properties
- Viewing Thread network topology

---

## Home Assistant setup

1. Add the **OpenThread Border Router** integration  
   - URL **must include** `http://`:

     ```text
     http://<dongle-ip-address>
     ```

2. Add the **Thread** integration  
   - The Dongle-M should appear as an available OTBR  
   - Set it as the **preferred Thread network** if desired  

3. (Optional) Mobile credential sync  
   - In the Home Assistant Companion App:
     - Open **Thread** integration
     - Click **Configure**
     - Send Thread credentials to the phone

---

## Reverse-engineered hardware details

### RGB LED (common anode)

- GPIO04 – Red  
- GPIO02 – Blue  
- GPIO14 – Green  

### UART connection to EFR32MG24 (UART1)

- GPIO13 – RX  
- GPIO17 – TX  
- Baud rate: **115200**  
- Data bits: **8**  
- Stop bits: **1**  
- Parity: **None**  
- Flow control: **None**

### EFR32MG24 bootloader access

The EFR32MG24 can be placed into **Silicon Labs Gecko bootloader mode** by:

- Holding **GPIO15** (mutes RCP)
- Pulsing **GPIO12**

### Ethernet

- Ethernet PHY: **IP101GA**
- Connected using **default ESP32 Ethernet GPIOs**

---

## Possible next steps / future work

This proof of concept required several **hard-coded changes** within this repository to support the Sonoff Dongle-M hardware, most notably:

- Web server configuration changes
- Raw Ethernet and Wi-Fi connection handling specific to the Dongle-M
- Hardware-specific assumptions that are not exposed via ESP-IDF configuration options

Ideally, these changes would be refactored into **configurable code paths** and exposed through **ESP-IDF `menuconfig` options**, rather than being hard coded. This would allow:

- Cleaner separation between hardware-specific and generic OTBR logic
- Easier maintenance and experimentation
- Potential contribution back into Espressif’s standard OpenThread Border Router example

Additional future work would include:

- Validation testing across a wider range of network conditions
- Long-term stability and reliability testing
- Real-world usability testing with Home Assistant and mixed Thread device ecosystems
- General code cleanup and documentation improvements

These steps are **outside the scope of this proof of concept**, but are listed here to provide a possible direction for anyone wishing to take this further.

## Final notes

- This project exists to **prove that the Sonoff Dongle-M can function as a full OTBR host**
- It is **not intended for end-users**
- It is **not production-safe**
- Use entirely **at your own risk**

If you want a polished, supported OTBR experience today, use a maintained OTBR solution.

If you want to experiment, learn, and extend — welcome aboard.

---

## ☕ Support

If you found this project useful or learned something from it and would like to say thanks, you can support me here:

👉 https://buymeacoffee.com/scoobler

Completely optional, but always appreciated ❤️
