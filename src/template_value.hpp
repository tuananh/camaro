#ifndef CAMARO_TEMPLATE_VALUE_HPP
#define CAMARO_TEMPLATE_VALUE_HPP

#include <string>
#include <utility>
#include <vector>

struct TemplateValue {
  enum class Kind { Object, Array, String };

  Kind kind = Kind::String;
  std::string str;
  std::vector<std::pair<std::string, TemplateValue>> members;
  std::vector<TemplateValue> items;

  static TemplateValue parse(const std::string &input);

  bool is_object() const { return kind == Kind::Object; }
  bool is_array() const { return kind == Kind::Array; }
  bool is_string() const { return kind == Kind::String; }

  bool empty() const {
    if (kind == Kind::Array)
      return items.empty();
    if (kind == Kind::Object)
      return members.empty();
    return str.empty();
  }

  const std::string &as_string() const { return str; }
};

#endif
