// Kuratierte Accessoren je Entity-Domain fuers Member-Completion nach id(x).
// Best-effort aus ESPHome-Kenntnis zusammengestellt, NICHT gegen eine laufende
// ESPHome-Installation verifiziert -- vor Release stichprobenartig gegenpruefen
// (Konfidenzhinweise stehen bei den unsicheren Zeilen). Bei Unsicherheit steht
// hier lieber nur das lesende state-Member als ein erfundener Befehl.
// id = C++-Token (dient auch als Praefix-Matchmuster), insert = Text ab dem Punkt.
export const LAMBDA_MEMBER_CATALOG = {
  sensor: [
    { id: "state", insert: "state" },
    { id: "has_state", insert: "has_state()" },
    { id: "publish_state", insert: "publish_state(x)" }
  ],
  binary_sensor: [
    { id: "state", insert: "state" },
    { id: "has_state", insert: "has_state()" },
    { id: "publish_state", insert: "publish_state(x)" }
  ],
  text_sensor: [
    { id: "state", insert: "state" },
    { id: "has_state", insert: "has_state()" },
    { id: "publish_state", insert: 'publish_state("x")' }
  ],
  switch: [
    { id: "state", insert: "state" },
    { id: "turn_on", insert: "turn_on()" },
    { id: "turn_off", insert: "turn_off()" },
    { id: "toggle", insert: "toggle()" }
  ],
  light: [
    { id: "is_on", insert: "current_values.is_on()" },
    { id: "get_brightness", insert: "current_values.get_brightness()" },
    { id: "turn_on", insert: "turn_on().perform()" },
    { id: "turn_off", insert: "turn_off().perform()" },
    { id: "make_call", insert: "make_call().set_brightness(x).set_state(true).perform()" }
  ],
  cover: [
    { id: "position", insert: "position" },
    { id: "current_operation", insert: "current_operation" },
    { id: "open", insert: "make_call().set_command_open().perform()" },
    { id: "set_position", insert: "make_call().set_position(x).perform()" }
  ],
  // Konfidenz mittel: Feldnamen sicher, exakte ClimateMode-Literale ("HEAT" u.a.)
  // vor Nutzung gegen die Zielversion pruefen.
  climate: [
    { id: "current_temperature", insert: "current_temperature" },
    { id: "target_temperature", insert: "target_temperature" },
    { id: "mode", insert: "mode" },
    { id: "set_mode", insert: 'make_call().set_mode("HEAT").set_target_temperature(x).perform()' }
  ],
  // Konfidenz mittel: manche ESPHome-Versionen nutzen speed_level statt speed.
  fan: [
    { id: "state", insert: "state" },
    { id: "turn_on", insert: "turn_on().perform()" },
    { id: "turn_off", insert: "turn_off().perform()" },
    { id: "set_speed", insert: "make_call().set_speed(x).perform()" }
  ],
  number: [
    { id: "state", insert: "state" },
    { id: "set_value", insert: "make_call().set_value(x).perform()" }
  ],
  select: [
    { id: "state", insert: "state" },
    { id: "set_option", insert: 'make_call().set_option("x").perform()' }
  ],
  text: [
    { id: "state", insert: "state" },
    { id: "set_value", insert: 'make_call().set_value("x").perform()' }
  ],
  // Konfidenz niedrig: Befehlsform (lock()/unlock() vs. make_call()) nicht
  // verifiziert -- bewusst nur das lesende Member.
  lock: [{ id: "state", insert: "state" }],
  // Konfidenz mittel: spiegelt cover, valve ist eine juengere/seltener genutzte
  // Komponente.
  valve: [
    { id: "position", insert: "position" },
    { id: "current_operation", insert: "current_operation" },
    { id: "set_position", insert: "make_call().set_position(x).perform()" }
  ],
  // Konfidenz niedrig: datetime ist real 3 C++-Typen (DateEntity/TimeEntity/
  // DateTimeEntity) mit unterschiedlichen Feldern -- kein Feld erfinden, nur
  // das allen gemeinsame state.
  datetime: [{ id: "state", insert: "state" }],
  button: [{ id: "press", insert: "press()" }],
  // Konfidenz niedrig: Arm-/Disarm-Aufrufform nicht verifiziert.
  alarm_control_panel: [{ id: "state", insert: "state" }],
  event: [{ id: "trigger", insert: 'trigger("x")' }]
};
