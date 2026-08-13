#include "json_writer.hpp"

#include <charconv>
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
  append_escaped(s.data(), s.size());
}

void JsonWriter::append_escaped(const char *s, size_t length) {
  buf.push_back('"');
  size_t start = 0;
  while (start < length) {
    size_t i = start;
    while (i < length) {
      const char c = s[i];
      if (c == '"' || c == '\\' || c == '\b' || c == '\f' || c == '\n' ||
          c == '\r' || c == '\t' || static_cast<unsigned char>(c) < 0x20)
        break;
      ++i;
    }
    buf.append(s + start, i - start);
    if (i == length)
      break;

    const char c = s[i];
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
      char hex[7];
      std::snprintf(hex, sizeof(hex), "\\u%04x", c & 0xff);
      buf.append(hex);
      break;
    }
    start = i + 1;
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
  write_string(s.data(), s.size());
}

void JsonWriter::write_string(const char *s, size_t length) {
  sep();
  append_escaped(s, length);
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
    const auto [end, error] = std::to_chars(tmp, tmp + sizeof(tmp), n);
    if (error == std::errc()) {
      buf.append(tmp, static_cast<size_t>(end - tmp));
    } else {
      const int len = std::snprintf(tmp, sizeof(tmp), "%.17g", n);
      buf.append(tmp, static_cast<size_t>(len));
    }
  }
  container_first = false;
}

void JsonWriter::write_empty_string() {
  sep();
  buf.append("\"\"");
  container_first = false;
}
