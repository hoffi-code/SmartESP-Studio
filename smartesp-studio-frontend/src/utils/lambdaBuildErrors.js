// Parst C++-Compile-Fehler aus dem rohen Job-Log eines "Pruefen"-Laufs (esphome
// compile -> PlatformIO -> gcc/xtensa-Toolchain). Gegen einen echten kaputten
// Lambda-Aufruf verifiziertes Format (docker exec ... esphome compile):
//
//   lambda-spike-test.yaml:24:29: error: 'class ...' has no member named '...'
//
// ESPHome emittiert #line-Direktiven beim Generieren des Lambda-C++, dadurch
// zeigt gcc direkt auf die YAML-Quellzeile -- keine Rueckrechnung von einer
// generierten .cpp-Datei noetig. Rohes Log enthaelt ANSI-Escapes (Farbe, gcc
// nutzt zusaetzlich \x1b[K mitten im Text), die vor dem Regex-Match entfernt
// werden muessen, sonst reisst das Escape den Dateinamen/die Message auseinander.

// eslint-disable-next-line no-control-regex -- ANSI CSI-Sequenzen enthalten Steuerzeichen.
const ANSI_ESCAPE = /\x1b\[[0-9;]*[A-Za-z]/g;

const CPP_ERROR = /^([^\s:][^:\r\n]*\.ya?ml):(\d+):(\d+):\s*error:\s*(.+)$/gm;

// parseCppCompileErrors(logText) -> [{ file, line, column, message }]
export const parseCppCompileErrors = (logText) => {
  const text = String(logText ?? "").replace(ANSI_ESCAPE, "");
  const results = [];
  CPP_ERROR.lastIndex = 0;
  let match = CPP_ERROR.exec(text);
  while (match) {
    results.push({
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      message: match[4].trim()
    });
    match = CPP_ERROR.exec(text);
  }
  return results;
};

// Gegen einen echten Fehlerfall verifiziertes Format der YAML-/Schema-Validierung
// (esphome config, "Failed config"-Block):
//
//   sensor.template: [source config-spike-test.yaml:20]
//     platform: template
//     ...
//     Unknown value '...', valid options are ...
//     update_interval: not_a_valid_duration
//
// Zeile zeigt auf den Beginn des betroffenen Komponenten-Blocks (nicht das
// einzelne Feld) -- reicht fuer die Feld-Aufloesung, da renderYamlObject
// ohnehin allen Zeilen eines Blocks dieselbe origin zuweist.
const CONFIG_ERROR = /\[source ([^\]:]+):(\d+)\]/g;

// parseConfigErrors(logText) -> [{ file, line }]
// Liefert bewusst keine Message -- das mehrzeilige "Failed config"-Blockformat
// ist zu variabel, um es robust auf eine einzelne Meldung einzudampfen. Reicht
// fuer die Feld-Zuordnung; der volle Text bleibt ohnehin in der Job-Konsole sichtbar.
export const parseConfigErrors = (logText) => {
  const text = String(logText ?? "").replace(ANSI_ESCAPE, "");
  const results = [];
  CONFIG_ERROR.lastIndex = 0;
  let match = CONFIG_ERROR.exec(text);
  while (match) {
    results.push({ file: match[1], line: Number(match[2]) });
    match = CONFIG_ERROR.exec(text);
  }
  return results;
};
