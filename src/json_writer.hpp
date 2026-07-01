#ifndef CAMARO_JSON_WRITER_HPP
#define CAMARO_JSON_WRITER_HPP

#include <string>

/// JSON has no NaN; number() uses a sentinel restored by parse reviver when needed.
constexpr const char kNanSentinel[] = "__camaro_nan__";

struct JsonWriter {
  std::string buf;
  bool container_first = true;

  void reserve(size_t n);
  void begin_object();
  void end_object();
  void begin_array();
  void end_array();
  void write_key(const std::string &key);
  void write_string(const std::string &s);
  void write_bool(bool b);
  void write_number(double n, bool &has_nan);
  void write_empty_string();

private:
  void sep();
  void append_escaped(const std::string &s);
};

#endif
