#include "json_writer.hpp"

#include <cmath>
#include <cstdio>

void JsonWriter::reserve(size_t n) { buf.reserve(n); }

void JsonWriter::sep() {
  if (container_first)
    container_first = false;
  else
    buf.push_back(',');
}

void JsonWriter::append_escaped(const std::string &s) {
  buf.push_back('"');
  for (char c : s) {
    switch (c) {
    case '"':
      buf.append("\\\"");
      break;
    case '\\':
      buf.append("\\\\");
      break;
    case '\b':
      buf.append("\\b");
      break;
    case '\f':
      buf.append("\\f");
      break;
    case '\n':
      buf.append("\\n");
      break;
    case '\r':
      buf.append("\\r");
      break;
    case '\t':
      buf.append("\\t");
      break;
    default:
      if (static_cast<unsigned char>(c) < 0x20) {
        char hex[7];
        std::snprintf(hex, sizeof(hex), "\\u%04x", c & 0xff);
        buf.append(hex);
      } else {
        buf.push_back(c);
      }
      break;
    }
  }
  buf.push_back('"');
}

void JsonWriter::begin_object() {
  sep();
  buf.push_back('{');
  container_first = true;
}

void JsonWriter::end_object() {
  buf.push_back('}');
  container_first = false;
}

void JsonWriter::begin_array() {
  sep();
  buf.push_back('[');
  container_first = true;
}

void JsonWriter::end_array() {
  buf.push_back(']');
  container_first = false;
}

void JsonWriter::write_key(const std::string &key) {
  sep();
  append_escaped(key);
  buf.push_back(':');
  container_first = true;
}

void JsonWriter::write_string(const std::string &s) {
  sep();
  append_escaped(s);
  container_first = false;
}

void JsonWriter::write_bool(bool b) {
  sep();
  buf.append(b ? "true" : "false");
  container_first = false;
}

void JsonWriter::write_number(double n, bool &has_nan) {
  sep();
  if (std::isnan(n)) {
    has_nan = true;
    append_escaped(kNanSentinel);
  } else if (std::isinf(n)) {
    buf.append(std::signbit(n) ? "-Infinity" : "Infinity");
  } else {
    char tmp[64];
    const int len = std::snprintf(tmp, sizeof(tmp), "%.17g", n);
    buf.append(tmp, static_cast<size_t>(len));
  }
  container_first = false;
}

void JsonWriter::write_empty_string() {
  sep();
  buf.append("\"\"");
  container_first = false;
}
