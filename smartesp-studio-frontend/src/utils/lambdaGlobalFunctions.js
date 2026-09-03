// Id-unabhaengige Helfer, die in ESPHome-Lambdas staendig vorkommen. Kuratiert,
// kein vollstaendiger C++-Katalog -- nur verifizierbar korrekte ESPHome/Arduino-
// Kernfunktionen, keine erfundenen Helfer (map()/lerp()/... bewusst nicht drin).
export const LAMBDA_GLOBAL_FUNCTIONS = [
  { id: "log_d", insert: 'ESP_LOGD("tag", "x")', category: "logging" },
  { id: "log_i", insert: 'ESP_LOGI("tag", "x")', category: "logging" },
  { id: "log_w", insert: 'ESP_LOGW("tag", "x")', category: "logging" },
  { id: "log_e", insert: 'ESP_LOGE("tag", "x")', category: "logging" },
  { id: "to_string", insert: "to_string(x)", category: "strings" },
  { id: "sprintf", insert: 'str_sprintf("%.1f", x)', category: "strings" },
  { id: "round", insert: "round(x)", category: "math" },
  { id: "std_min", insert: "std::min(x, y)", category: "math" },
  { id: "std_max", insert: "std::max(x, y)", category: "math" },
  { id: "millis", insert: "millis()", category: "time" },
  { id: "micros", insert: "micros()", category: "time" },
  { id: "delay", insert: "delay(x)", category: "time" },
  { id: "return", insert: "return x;", category: "core" },
  { id: "lvgl_label", insert: 'lv_label_set_text(id(x), "text")', category: "core" }
];
