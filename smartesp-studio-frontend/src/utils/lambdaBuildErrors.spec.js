import { describe, expect, it } from "vitest";

import { parseConfigErrors, parseCppCompileErrors } from "./lambdaBuildErrors";

describe("parseCppCompileErrors", () => {
  // Verbatim (ANSI-stripped) shape of a real `esphome compile` failure against a
  // lambda with a typo'd method call -- captured via a live docker exec run.
  it("extracts file/line/column/message from a plain gcc error line", () => {
    const log = [
      "lambda-spike-test.yaml: In lambda function:",
      "lambda-spike-test.yaml:24:29: error: 'class esphome::template_::TemplateSensor' has no member named 'turn__on_typo'",
      "*** [.pioenvs/lambda-spike-test/src/main.cpp.o] Error 1"
    ].join("\n");
    expect(parseCppCompileErrors(log)).toEqual([
      {
        file: "lambda-spike-test.yaml",
        line: 24,
        column: 29,
        message: "'class esphome::template_::TemplateSensor' has no member named 'turn__on_typo'"
      }
    ]);
  });

  // Same content, but with the real ANSI escape sequences PlatformIO/gcc emit
  // (color codes plus a stray \x1b[K erase-to-end-of-line mid-token) -- these
  // must be stripped before matching or the filename/message get corrupted.
  it("strips ANSI escape codes (including a mid-token erase-line) before matching", () => {
    const line =
      "\x1b[0m\x1b[33m\x1b[01m\x1b[Klambda-spike-test.yaml:24:29:\x1b[m\x1b[K " +
      "\x1b[01;31m\x1b[Kerror: \x1b[m\x1b[K'\x1b[01m\x1b[Kclass esphome::template_::TemplateSensor\x1b[m\x1b[K'" +
      " has no member named '\x1b[01m\x1b[Kturn__on_typo\x1b[m\x1b[K'";
    expect(parseCppCompileErrors(line)).toEqual([
      {
        file: "lambda-spike-test.yaml",
        line: 24,
        column: 29,
        message: "'class esphome::template_::TemplateSensor' has no member named 'turn__on_typo'"
      }
    ]);
  });

  it("ignores ordinary log lines and returns an empty list for a clean build", () => {
    const log = ["INFO Compiling app...", "Compiling .pioenvs/x/src/main.cpp.o", "SUCCESS"].join("\n");
    expect(parseCppCompileErrors(log)).toEqual([]);
  });

  it("collects every error when a build fails on more than one line", () => {
    const log = [
      "device.yaml:12:5: error: expected ';' before 'return'",
      "device.yaml:30:10: error: 'x' was not declared in this scope"
    ].join("\n");
    expect(parseCppCompileErrors(log)).toEqual([
      { file: "device.yaml", line: 12, column: 5, message: "expected ';' before 'return'" },
      { file: "device.yaml", line: 30, column: 10, message: "'x' was not declared in this scope" }
    ]);
  });
});

describe("parseConfigErrors", () => {
  // Verbatim shape of a real `esphome config` failure (an invalid field value,
  // unrelated to a lambda) -- also captured via a live docker exec run.
  it("extracts the source file/line from a Failed config block", () => {
    const log = [
      "Failed config",
      "",
      "sensor.template: [source config-spike-test.yaml:20]",
      "  platform: template",
      "  name: Broken Field",
      "  id: broken_field_sensor",
      "  ",
      "  Unknown value 'not_a_valid_duration', valid options are 'ns', 'seconds', 'min'.",
      "  update_interval: not_a_valid_duration"
    ].join("\n");
    expect(parseConfigErrors(log)).toEqual([{ file: "config-spike-test.yaml", line: 20 }]);
  });

  it("returns an empty list without a source marker", () => {
    expect(parseConfigErrors("INFO Configuration is valid!")).toEqual([]);
  });
});
