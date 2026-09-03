// Implizite Kontext-Variablen, die ESPHome in bestimmten Lambda-Typen automatisch
// bereitstellt -- kein id()/Domain-Bezug, sondern "welche Variable gibt es in
// diesem Lambda-Typ". Aus den lokalen ESPHome-Schema-Docs abgeleitet
// (docs/esphome-schema-reference), nicht aus eigenem Wissen geraten.
//
// Noch ohne Kontext-Bindung ans jeweilige Feld (kein field.lambdaContext-Tag im
// Schema) -- erscheint deshalb bewusst immer in der Palette, nicht nur wenn der
// Lambda-Typ tatsaechlich passt. Remote-Receiver-Protokoll-Felder (~40 typisierte
// structs je Protokoll) sind bewusst ausgelassen: die exakten Feldnamen je
// Protokoll sind aus der Doku nicht sicher genug ablesbar, um sie ungeprueft zu
// kuratieren -- eigener Folge-Schritt.
export const LAMBDA_SCOPE_VARIABLES = [
  { id: "x", insert: "x" },
  { id: "address", insert: "address" },
  { id: "iteration", insert: "iteration" }
];
