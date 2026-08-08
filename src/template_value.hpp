#ifndef CAMARO_TEMPLATE_VALUE_HPP
#define CAMARO_TEMPLATE_VALUE_HPP

#include <string>
#include <cstddef>
#include <utility>
#include <vector>

struct TemplateValue {
  enum class Kind { Object, Array, String };
  enum class ReturnType { String, Number, Boolean };
  struct PathSegment {
    size_t start;
    size_t length;
  };

  Kind kind = Kind::String;
  std::string str;
  std::vector<std::pair<std::string, TemplateValue>> members;
  std::vector<TemplateValue> items;
  // Computed once while parsing a cached template. These avoid repeatedly
  // classifying the same expressions for every matched XML element.
  ReturnType return_type = ReturnType::String;
  bool simple_nav_path = false;
  bool path_absolute = false;
  std::vector<PathSegment> path_segments;
  bool path_has_attribute = false;
  PathSegment attribute_segment{0, 0};
  bool simple_descendant_name = false;
  size_t final_slash = std::string::npos;
  std::string descendant_name;
  bool fast_number = false;
  std::string number_path;
  bool number_path_absolute = false;
  bool fast_boolean = false;
  std::string boolean_left;
  std::string boolean_right;

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
