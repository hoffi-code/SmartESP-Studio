// Kommentare liegen im Projekt immer mit `#`-Praefix (so schreibt sie der Importer).
// Fuer die Bearbeitung wird das Praefix abgezogen und beim Speichern wieder gesetzt.

export const stripHashes = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => line.replace(/^\s*#\s?/, ""))
    .join("\n");

export const addHashes = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => (line.trim() ? `# ${line.trim()}` : "#"))
    .join("\n");
