# ESPHome-Schema-Audit: SmartESP-Studio vs. ESPHome 2026.8.2

Automatisierter Feld-Abgleich zwischen dem Upstream-Schema-Dump (`docs/esphome-schema-reference/2026.8.2/`, 989 Komponenten/Plattformen mit auswertbarem `CONFIG_SCHEMA`) und unserem eigenen Katalog (`smartesp-studio-frontend/public/schemas/components/`, 529 Einträge).

**Methodik:** Bare Top-Level-Feld-Keys je Komponente/Plattform (`platform.domain`), automatisch flach verglichen. Einen Verschachtelungslevel tief aufgelöst (z. B. `pressure.oversampling`). Rein UI-interne Routing-Felder (Bus-Auswahl, Hub-Embed-Container) sind ausgeklammert. Automations-Trigger (`on_*`) und Action-Kataloge sind NICHT Teil dieses Abgleichs — die laufen über eine separate, bereits verifizierte Katalog-Maschinerie.

## Zusammenfassung

| Kennzahl | Wert |
|---|---|
| ESPHome-Komponenten/Plattformen (mit CONFIG_SCHEMA) | 989 |
| Davon bei uns implementiert | 516 |
| ...davon exakte Feld-Übereinstimmung | 13 |
| ...davon mit Feld-Abweichung | 304 |
| **Nicht implementiert (Backlog)** | **473** |
| Bei uns vorhanden, kein Upstream-Treffer (Sonderfälle, siehe unten) | 13 |

## Bereits behoben (diese Session)

- `sensor/sgp4x.json`, `sensor/sen5x.json`: `voc`/`nox` → `voc_index`/`nox_index` (deprecated seit 2026.8.0, Entfernung 2027.2.0).
- `base_component/hub_modbus_controller.json`: `server_registers`/`server_courtesy_response` entfernt (verursachen Compile-Fehler), `allow_duplicate_commands`/`command_throttle` entfernt (No-Ops, Ersatz `turnaround_time` existiert bereits in `general/busses/modbus.json`).

## Offener Klärungsbedarf: `id`/`i2c_id` bei einfachen I2C-Sensoren

Auffällig häufiges Muster (~64 Treffer, siehe `esphome-schema-audit-2026.8.2.diff.json` → `critical`): viele einkanalige/mehrkanalige I2C-Sensor-Plattformen (`bme280`, `bme680`, `bmp280`, `ina219/226/260/3221`, `scd30`, `scd4x`, `sgp30`, `sht3xd`, `sht4x`, `sps30`, `tcs34725`, `veml7700`, `as7341`, `hm3301`, `mlx90614`, u. v. a.) haben in unserem Schema **kein eigenes `id`- oder `i2c_id`-Feld** auf oberster Ebene. ESPHome selbst listet beide als `GeneratedID` (optional, wird sonst automatisch vergeben) — funktional bricht dadurch nichts, aber Nutzer können diesen Sensor-Instanzen aktuell in unserer UI weder eine eigene `id:` geben (z. B. um sie andernorts per `id_ref` zu referenzieren) noch bei mehreren I2C-Bussen den Bus explizit wählen.

Das ist eine bewusste Vereinfachung oder eine Lücke, die sich durch praktisch den ganzen `sensor/`-Katalog zieht — lohnt eine Produkt-Entscheidung (pauschal `id`+`i2c_id` ergänzen vs. bewusst weglassen), bevor das in großem Stil gefixt wird. Nicht in dieser Session bulk-gefixt.

## Feld-Abweichungen bei implementierten Komponenten (Auszug, größte zuerst)

Vollständige Liste inkl. `extraInOurs` (Felder, die wir haben und ESPHome laut Dump nicht kennt — oft ältere/interne Routing-Felder) in `esphome-schema-audit-2026.8.2.diff.json`.

| Komponente | Unsere Datei(en) | Fehlende Felder (Auszug) |
|---|---|---|
| `dsmr.sensor` | sensor/dsmr.json | abs_power, active_demand_abs, active_demand_net, active_demand_power, active_energy_export_current_average_demand, active_energy_export_last_completed_demand, active_energy_import_current_average_demand, active_energy_import_last_completed_demand … (+82) |
| `remote_receiver` | wireless_communication/remote_receiver.json | on_abbwelcome, on_aeha, on_beo4, on_brennenstuhl, on_byronsx, on_canalsat, on_canalsatld, on_coolix … (+24) |
| `cc1101` | wireless_communication/cc1101.json | bs_limit, bs_post_ki, bs_post_kp, bs_pre_ki, bs_pre_kp, data_rate, foc_bs_cs_gate, foc_limit … (+5) |
| `cs5460a.sensor` | sensor/cs5460a.json | cs_pin, data_rate, id, release_device, spi_id, spi_mode |
| `epaper_spi.display` | display/epaper_spi.json | data_rate, enable_pin, init_sequence, init_sequence_id, release_device, spi_mode |
| `sx126x` | wireless_communication/sx126x.json | data_rate, release_device, spi_id, spi_mode, whitening_enable, whitening_initial |
| `honeywellabp.sensor` | sensor/honeywellabp.json | data_rate, id, release_device, spi_id, spi_mode |
| `spi_led_strip.light` | light/spi_led_strip.json | cs_pin, output_id, release_device, spi_id, spi_mode |
| `ssd1322_spi.display` | display/ssd1322.json | brightness, data_rate, external_vcc, release_device, spi_mode |
| `ssd1325_spi.display` | display/ssd1325.json | brightness, data_rate, external_vcc, release_device, spi_mode |
| `as7341.sensor` | sensor/as7341.json | address, i2c_id, id, update_interval |
| `atm90e26.sensor` | sensor/atm90e26.json | data_rate, id, release_device, spi_mode |
| `hm3301.sensor` | sensor/hm3301.json | address, i2c_id, id, update_interval |
| `mipi_rgb.display` | display/mipi_rgb.json | byte_order, draw_rounding, enable_pin, use_axis_flips |
| `mlx90614.sensor` | sensor/mlx90614.json | address, i2c_id, id, update_interval |
| `nextion.display` | display/nextion.json | on_custom_binary_sensor, on_custom_sensor, on_custom_switch, on_custom_text_sensor |
| `sen5x.sensor` | sensor/sen5x.json | i2c_id, id, model, update_interval |
| `ssd1331_spi.display` | display/ssd1331.json | brightness, data_rate, release_device, spi_mode |
| `ssd1351_spi.display` | display/ssd1351.json | brightness, data_rate, release_device, spi_mode |
| `st7920.display` | display/st7920.json | data_rate, release_device, spi_id, spi_mode |
| `sx127x` | wireless_communication/sx127x.json | data_rate, release_device, spi_id, spi_mode |
| `aht10.sensor` | sensor/aht10.json | address, i2c_id, id |
| `atm90e32.sensor` | sensor/atm90e32.json | data_rate, release_device, spi_mode |
| `daly_bms.sensor` | sensor/daly_bms.json | bms_daly_id, cell_17_voltage, cell_18_voltage |
| `dht12.sensor` | sensor/dht12.json | address, i2c_id, id |
| `ens210.sensor` | sensor/ens210.json | address, i2c_id, id |
| `honeywellabp2_i2c.sensor` | sensor/honeywellabp2_i2c.json | address, i2c_id, id |
| `honeywell_hih_i2c.sensor` | sensor/honeywell_hih_i2c.json | address, i2c_id, id |
| `inkplate.display` | display/inkplate.json | address, i2c_id, wakeup_pin |
| `ltr501.sensor` | sensor/ltr501.json | i2c_id, id, repeat |
| `ltr_als_ps.sensor` | sensor/ltr_als_ps.json | i2c_id, id, repeat |
| `max31855.sensor` | sensor/max31855.json | data_rate, release_device, spi_mode |
| `max31856.sensor` | sensor/max31856.json | data_rate, release_device, spi_mode |
| `max31865.sensor` | sensor/max31865.json | data_rate, release_device, spi_mode |
| `max6675.sensor` | sensor/max6675.json | data_rate, release_device, spi_mode |
| `max7219.display` | display/max7219.json | data_rate, release_device, spi_mode |
| `max7219digit.display` | display/max7219digit.json | data_rate, release_device, spi_mode |
| `max9611.sensor` | sensor/max9611.json | gain, i2c_id, id |
| `mcp4461.output` | output/mcp4461.json | id, nonvolatile, nonvolatile_write_delay |
| `mics_4514.sensor` | sensor/mics_4514.json | address, i2c_id, id |

`lvgl` ist aus dieser Tabelle ausgeklammert: der Upstream-Dump listet dort alle ~250 LVGL-Style-/Root-Properties in einem einzigen Schema-Block (rekursiv, nicht pro Widget-Typ) — bereits im vorherigen Planungsschritt separat gegen die Docs geprüft (button/label/image-Felder stimmen). Fehlende Style-Properties und weitere Widget-Typen sind bekannter, bereits dokumentierter Backlog aus `plans/`.

## Backlog: nicht implementierte Komponenten/Plattformen (473)

Gruppiert nach Domain. Jede Zeile ist eine ESPHome-Plattform, die aktuell in keinem SmartESP-Studio-Schema vorkommt.

<details><summary><b>(core/hub)</b> (251)</summary>

- `adc128s102`
- `ade7953_base`
- `ads1115`
- `ads1118`
- `airthings_ble`
- `airthings_wave_base`
- `alarm_control_panel`
- `animation`
- `apds9960`
- `api`
- `as3935`
- `as3935_i2c`
- `as3935_spi`
- `as5600`
- `at581x`
- `audio`
- `audio_adc`
- `audio_dac`
- `audio_file`
- `bedjet`
- `binary_sensor`
- `bk72xx`
- `bk72xx_ble`
- `bk72xx_ble_tracker`
- `ble_client`
- `ble_device_base`
- `ble_nus`
- `bme280_base`
- `bme680_bsec`
- `bme68x_bsec2`
- `bme68x_bsec2_i2c`
- `bmp280_base`
- `bmp3xx_base`
- `bmp581_base`
- `bp1658cj`
- `bp5758d`
- `button`
- `canbus`
- `cap1188`
- `captive_portal`
- `cd74hc4067`
- `ch422g`
- `ch423`
- `climate`
- `color`
- `core`
- `cover`
- `dac7678`
- `daly_bms`
- `dashboard_import`
- `datetime`
- `debug`
- `deep_sleep`
- `demo`
- `dfrobot_sen0395`
- `display`
- `display_menu_base`
- `dlms_meter`
- `dsmr`
- `e131`
- `emc2101`
- `emontx`
- `ens160_base`
- `esp32`
- `esp32_ble`
- `esp32_ble_beacon`
- `esp32_ble_server`
- `esp32_ble_tracker`
- `esp32_camera_web_server`
- `esp32_hosted`
- `esp32_improv`
- `esp32_touch`
- `esp8266`
- `esp_ldo`
- `esphome`
- `espnow`
- `ethernet`
- `event`
- `ezo_pmp`
- `factory_reset`
- `fan`
- `fastled_base`
- `font`
- `gdk101`
- `globals`
- `gp8403`
- `graph`
- `graphical_display_menu`
- `hoermann_hcp`
- `homeassistant`
- `host`
- `http_request`
- `i2c`
- `i2c_device`
- `i2s_audio`
- `improv_serial`
- `ina2xx_base`
- `interval`
- `key_collector`
- `lcd_base`
- `lcd_menu`
- `ld2410`
- `ld2412`
- `ld2420`
- `ld2450`
- `ld6002b`
- `libretiny`
- `light`
- `ln882h_ble`
- `ln882h_ble_tracker`
- `lock`
- `logger`
- `m5stack_8angle`
- `mapping`
- `matrix_keypad`
- `max6956`
- `mcp23008`
- `mcp23016`
- `mcp23017`
- `mcp23s08`
- `mcp23s17`
- `mcp3008`
- `mcp3204`
- `mcp4461`
- `mcp4728`
- `mdns`
- `media_player`
- `micronova`
- `microphone`
- `mitsubishi_cn105`
- `modbus_client`
- `modbus_server`
- `mopeka_ble`
- `motion`
- `mpr121`
- `mqtt`
- `msa3xx`
- `my9231`
- `network`
- `nrf52`
- `number`
- `online_image`
- `opentherm`
- `openthread`
- `ota`
- `output`
- `packages`
- `packet_transport`
- `pca6416a`
- `pca9554`
- `pca9685`
- `pcf8574`
- `pi4ioe5v6408`
- `pipsolar`
- `pn532`
- `pn532_i2c`
- `pn532_spi`
- `pn7160_i2c`
- `pn7160_spi`
- `preferences`
- `prometheus`
- `provisioning`
- `psram`
- `pylontech`
- `qr_code`
- `radon_eye_ble`
- `rc522`
- `rc522_i2c`
- `rc522_spi`
- `rd03d`
- `rdm6300`
- `remote_base`
- `rp2`
- `rp2040`
- `rp2040_ble`
- `rp2_ble_tracker`
- `runtime_stats`
- `ruuvi_ble`
- `safe_mode`
- `script`
- `seeed_mr24hpc1`
- `seeed_mr60bha2`
- `seeed_mr60fda2`
- `select`
- `sendspin`
- `sensor`
- `serial_proxy`
- `sm10bit_base`
- `sm16716`
- `sm2135`
- `sm2235`
- `sm2335`
- `sn74hc165`
- `sn74hc595`
- `socket`
- `spa06_base`
- `speaker`
- `spi_device`
- `ssd1306_base`
- `ssd1327_base`
- `st7567_base`
- `statsd`
- `status_led`
- `substitutions`
- `switch`
- `sx1509`
- `sy6970`
- `syslog`
- `tca9548a`
- `tca9555`
- `teleinfo`
- `text`
- `text_sensor`
- `time`
- `tinyusb`
- `tlc59208f`
- `tlc5947`
- `tlc5971`
- `touchscreen`
- `ttp229_bsf`
- `ttp229_lsf`
- `tuya`
- `uart`
- `udp`
- `ufm01`
- `update`
- `uponor_smatrix`
- `usb_cdc_acm`
- `usb_host`
- `valve`
- `vbus`
- `water_heater`
- `waveshare_io_ch32v003`
- `web_server`
- `web_server_base`
- `weikai`
- `wifi`
- `wireguard`
- `wk2132_i2c`
- `wk2132_spi`
- `wk2168_i2c`
- `wk2168_spi`
- `wk2204_i2c`
- `wk2204_spi`
- `wk2212_i2c`
- `wk2212_spi`
- `xiaomi_ble`
- `xiaomi_rtcgq02lm`
- `xl9535`
- `zephyr_ble_server`
- `zigbee`

</details>

<details><summary><b>audio_adc</b> (2)</summary>

- `es7210.audio_adc`
- `es7243e.audio_adc`

</details>

<details><summary><b>audio_dac</b> (5)</summary>

- `aic3204.audio_dac`
- `es8156.audio_dac`
- `es8311.audio_dac`
- `es8388.audio_dac`
- `pcm5122.audio_dac`

</details>

<details><summary><b>binary_sensor</b> (31)</summary>

- `apds9960.binary_sensor`
- `as3935.binary_sensor`
- `copy.binary_sensor`
- `cst226.binary_sensor`
- `cst328.binary_sensor`
- `daly_bms.binary_sensor`
- `dlms_meter.binary_sensor`
- `fingerprint_grow.binary_sensor`
- `gdk101.binary_sensor`
- `haier.binary_sensor`
- `hlk_fm22x.binary_sensor`
- `hoermann_hcp.binary_sensor`
- `ld6002b.binary_sensor`
- `m5stack_8angle.binary_sensor`
- `opentherm.binary_sensor`
- `packet_transport.binary_sensor`
- `rc522_spi.binary_sensor`
- `rd03d.binary_sensor`
- `remote_receiver.binary_sensor`
- `sim800l.binary_sensor`
- `sx1509.binary_sensor`
- `sy6970.binary_sensor`
- `tm1637.binary_sensor`
- `tm1638.binary_sensor`
- `touchscreen.binary_sensor`
- `ufm01.binary_sensor`
- `xiaomi_cgpr1.binary_sensor`
- `xiaomi_mjyd02yla.binary_sensor`
- `xiaomi_mue4094rt.binary_sensor`
- `xiaomi_rtcgq02lm.binary_sensor`
- `xiaomi_wx08zm.binary_sensor`

</details>

<details><summary><b>button</b> (5)</summary>

- `atm90e32.button`
- `bl0940.button`
- `copy.button`
- `haier.button`
- `ld6002b.button`

</details>

<details><summary><b>canbus</b> (2)</summary>

- `esp32_can.canbus`
- `mcp2515.canbus`

</details>

<details><summary><b>climate</b> (21)</summary>

- `ballu.climate`
- `coolix.climate`
- `daikin.climate`
- `daikin_arc.climate`
- `daikin_brc.climate`
- `delonghi.climate`
- `emmeti.climate`
- `fujitsu_general.climate`
- `gree.climate`
- `heatpumpir.climate`
- `hitachi_ac344.climate`
- `hitachi_ac424.climate`
- `midea_ir.climate`
- `mitsubishi.climate`
- `noblex.climate`
- `tcl112.climate`
- `toshiba.climate`
- `whirlpool.climate`
- `whynter.climate`
- `yashima.climate`
- `zhlt01.climate`

</details>

<details><summary><b>cover</b> (2)</summary>

- `copy.cover`
- `hoermann_hcp.cover`

</details>

<details><summary><b>display</b> (5)</summary>

- `lcd_gpio.display`
- `pixoo.display`
- `ssd1306_spi.display`
- `ssd1327_spi.display`
- `st7567_spi.display`

</details>

<details><summary><b>event</b> (1)</summary>

- `uart.event`

</details>

<details><summary><b>fan</b> (2)</summary>

- `bedjet.fan`
- `copy.fan`

</details>

<details><summary><b>image</b> (1)</summary>

- `sendspin.image`

</details>

<details><summary><b>infrared</b> (1)</summary>

- `ir_rf_proxy.infrared`

</details>

<details><summary><b>light</b> (4)</summary>

- `fastled_spi.light`
- `hoermann_hcp.light`
- `m5stack_8angle.light`
- `pixoo.light`

</details>

<details><summary><b>lock</b> (1)</summary>

- `copy.lock`

</details>

<details><summary><b>media_player</b> (2)</summary>

- `sendspin.media_player`
- `speaker_source.media_player`

</details>

<details><summary><b>media_source</b> (1)</summary>

- `sendspin.media_source`

</details>

<details><summary><b>motion</b> (3)</summary>

- `bmi270.motion`
- `lsm6ds.motion`
- `qmi8658.motion`

</details>

<details><summary><b>number</b> (5)</summary>

- `atm90e32.number`
- `bl0940.number`
- `copy.number`
- `ld6002b.number`
- `opentherm.number`

</details>

<details><summary><b>one_wire</b> (3)</summary>

- `ds2484.one_wire`
- `ds248x.one_wire`
- `gpio.one_wire`

</details>

<details><summary><b>ota</b> (4)</summary>

- `esphome.ota`
- `http_request.ota`
- `web_server.ota`
- `zephyr_mcumgr.ota`

</details>

<details><summary><b>output</b> (7)</summary>

- `max6956.output`
- `opentherm.output`
- `rp2040_pwm.output`
- `sx1509.output`
- `tm1638.output`
- `waveshare_io_ch32v003.output`
- `zephyr_pwm.output`

</details>

<details><summary><b>packet_transport</b> (5)</summary>

- `espnow.packet_transport`
- `sx126x.packet_transport`
- `sx127x.packet_transport`
- `uart.packet_transport`
- `udp.packet_transport`

</details>

<details><summary><b>radio_frequency</b> (1)</summary>

- `ir_rf_proxy.radio_frequency`

</details>

<details><summary><b>select</b> (5)</summary>

- `copy.select`
- `es8388.select`
- `ld6002b.select`
- `logger.select`
- `mitsubishi_cn105.select`

</details>

<details><summary><b>sensor</b> (62)</summary>

- `ade7953_spi.sensor`
- `airthings_wave_mini.sensor`
- `aqi.sensor`
- `atc_mithermometer.sensor`
- `bedjet.sensor`
- `bme280_spi.sensor`
- `bmi270.sensor`
- `bmp280_spi.sensor`
- `bmp3xx_spi.sensor`
- `bmp581_i2c.sensor`
- `bmp581_spi.sensor`
- `bthome_mithermometer.sensor`
- `copy.sensor`
- `debug.sensor`
- `dew_point.sensor`
- `dlms_meter.sensor`
- `emontx.sensor`
- `ens160_spi.sensor`
- `fingerprint_grow.sensor`
- `haier.sensor`
- `hdc2080.sensor`
- `hdc302x.sensor`
- `hlk_fm22x.sensor`
- `ina2xx_spi.sensor`
- `ld6002b.sensor`
- `lsm6ds.sensor`
- `lvgl.sensor`
- `nextion.sensor`
- `number.sensor`
- `opentherm.sensor`
- `openthread_info.sensor`
- `packet_transport.sensor`
- `pid.sensor`
- `pvvx_mithermometer.sensor`
- `qmi8658.sensor`
- `rd03d.sensor`
- `sen6x.sensor`
- `sendspin.sensor`
- `sim800l.sensor`
- `spa06_i2c.sensor`
- `spa06_spi.sensor`
- `sun.sensor`
- `sy6970.sensor`
- `ufm01.sensor`
- `uponor_smatrix.sensor`
- `waveshare_io_ch32v003.sensor`
- `xdb401.sensor`
- `xiaomi_cgd1.sensor`
- `xiaomi_cgdk2.sensor`
- `xiaomi_cgg1.sensor`
- `xiaomi_gcls002.sensor`
- `xiaomi_hhccjcy01.sensor`
- `xiaomi_hhccpot002.sensor`
- `xiaomi_jqjcy01ym.sensor`
- `xiaomi_lywsd02.sensor`
- `xiaomi_lywsd02mmc.sensor`
- `xiaomi_lywsd03mmc.sensor`
- `xiaomi_lywsdcgq.sensor`
- `xiaomi_mhoc303.sensor`
- `xiaomi_mhoc401.sensor`
- `xiaomi_rtcgq02lm.sensor`
- `xiaomi_xmwsdj04mmc.sensor`

</details>

<details><summary><b>speaker</b> (1)</summary>

- `router.speaker`

</details>

<details><summary><b>stepper</b> (2)</summary>

- `a4988.stepper`
- `uln2003.stepper`

</details>

<details><summary><b>switch</b> (7)</summary>

- `copy.switch`
- `gree.switch`
- `haier.switch`
- `ld6002b.switch`
- `opentherm.switch`
- `pcm5122.switch`
- `tm1638.switch`

</details>

<details><summary><b>text</b> (1)</summary>

- `copy.text`

</details>

<details><summary><b>text_sensor</b> (20)</summary>

- `atm90e32.text_sensor`
- `ble_client.text_sensor`
- `bme680_bsec.text_sensor`
- `bme68x_bsec2.text_sensor`
- `copy.text_sensor`
- `daly_bms.text_sensor`
- `debug.text_sensor`
- `dlms_meter.text_sensor`
- `dsmr.text_sensor`
- `gdk101.text_sensor`
- `haier.text_sensor`
- `hlk_fm22x.text_sensor`
- `key_collector.text_sensor`
- `ld6002b.text_sensor`
- `sendspin.text_sensor`
- `sun.text_sensor`
- `sy6970.text_sensor`
- `teleinfo.text_sensor`
- `text.text_sensor`
- `uptime.text_sensor`

</details>

<details><summary><b>time</b> (2)</summary>

- `host.time`
- `zigbee.time`

</details>

<details><summary><b>touchscreen</b> (5)</summary>

- `cst328.touchscreen`
- `cst9220.touchscreen`
- `lilygo_t5_47.touchscreen`
- `sdl.touchscreen`
- `st7123.touchscreen`

</details>

<details><summary><b>update</b> (2)</summary>

- `esp32_hosted.update`
- `http_request.update`

</details>

<details><summary><b>water_heater</b> (1)</summary>

- `template.water_heater`

</details>

## Bei uns vorhanden, kein Upstream-Treffer

Eigene/kombinierte Schema-Keys ohne direkte 1:1-Entsprechung im Dump (Sammel-Domains, LVGL-Widgets, Namensabweichungen o. Ä. — einzeln prüfen, kein automatischer Fehlerbefund):

- `ads1118.sensor` — sensor/ads1118.json
- `ble_client.sensor` — sensor/ble_client.json
- `bmp581.sensor` — sensor/bmp581.json
- `camera_encoder` — miscellaneous/camera_encoder.json
- `dfrobot_sen0395.switch` — switch/dfrobot_sen0395.json
- `empty.custom` — custom/empty.json
- `i2s_audio.media_player` — media_player/i2s_audio.json
- `modbus_controller.output` — output/modbus_controller.json
- `template.output` — output/template.json
- `uptime.sensor` — sensor/uptime.json
- `vbus.binary_sensor` — binary_sensor/vbus.json
- `vbus.sensor` — sensor/vbus.json
- `xiaomi_ble.sensor` — sensor/xiaomi_ble.json

