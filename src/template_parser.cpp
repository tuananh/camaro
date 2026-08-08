#include "template_value.hpp"

#include <cctype>
#include <stdexcept>

namespace {

bool is_simple_nav_path(const std::string &path) {
  if (path.empty() || path.find("//") != std::string::npos)
    return false;
  for (char c : path) {
    if (std::isalnum(static_cast<unsigned char>(c)) || c == '/' || c == '@' ||
        c == '_' || c == '-')
      continue;
    return false;
  }
  return true;
}

void trim(std::string &s) {
  const size_t start = s.find_first_not_of(" \t");
  if (start == std::string::npos) {
    s.clear();
    return;
  }
  const size_t end = s.find_last_not_of(" \t");
  s = s.substr(start, end - start + 1);
}

void prepare_value(TemplateValue &v) {
  for (auto &member : v.members)
    prepare_value(member.second);
  for (auto &item : v.items)
    prepare_value(item);

  if (!v.is_string())
    return;

  const std::string &path = v.str;
  v.simple_nav_path = is_simple_nav_path(path);
  v.final_slash = path.rfind('/');
  if (v.simple_nav_path) {
    v.path_absolute = path.front() == '/';
    size_t start = v.path_absolute ? 1 : 0;
    while (start < path.size()) {
      const size_t slash = path.find('/', start);
      const size_t end =
          slash == std::string::npos ? path.size() : slash;
      TemplateValue::PathSegment segment{start, end - start};
      if (path[start] == '@') {
        if (end != path.size()) {
          v.simple_nav_path = false;
          v.path_segments.clear();
          break;
        }
        v.path_has_attribute = true;
        v.attribute_segment = segment;
      } else {
        v.path_segments.push_back(segment);
      }
      start = end + 1;
    }
  }
  if (path.rfind("count(", 0) == 0 || path.rfind("ceiling(", 0) == 0 ||
      path.rfind("floor(", 0) == 0 || path.rfind("round(", 0) == 0 ||
      path.rfind("sum(", 0) == 0) {
    v.return_type = TemplateValue::ReturnType::Number;
  }

  if (path.size() >= 3 && path[0] == '/' && path[1] == '/' &&
      path.find('/', 2) == std::string::npos) {
    const std::string name = path.substr(2);
    if (is_simple_nav_path(name)) {
      v.simple_descendant_name = true;
      v.descendant_name = name;
    }
  }

  if (path.rfind("number(", 0) == 0 && path.size() >= 9 &&
      path.back() == ')') {
    v.return_type = TemplateValue::ReturnType::Number;
    v.number_path = path.substr(7, path.size() - 8);
    v.fast_number = is_simple_nav_path(v.number_path);
    v.number_path_absolute =
        !v.number_path.empty() && v.number_path.front() == '/';
    return;
  }

  if (path.rfind("boolean(", 0) != 0 || path.size() < 10 ||
      path.back() != ')')
    return;

  v.return_type = TemplateValue::ReturnType::Boolean;
  const std::string inner = path.substr(8, path.size() - 9);
  const size_t eq = inner.find('=');
  if (eq == std::string::npos)
    return;
  v.boolean_left = inner.substr(0, eq);
  v.boolean_right = inner.substr(eq + 1);
  trim(v.boolean_left);
  trim(v.boolean_right);
  if (v.boolean_right.size() >= 2 &&
      ((v.boolean_right.front() == '"' && v.boolean_right.back() == '"') ||
       (v.boolean_right.front() == '\'' && v.boolean_right.back() == '\''))) {
    v.boolean_right =
        v.boolean_right.substr(1, v.boolean_right.size() - 2);
  }
  v.fast_boolean = v.boolean_left.find('(') == std::string::npos &&
                   v.boolean_left.find('/') == std::string::npos &&
                   v.boolean_left.find('@') == std::string::npos;
}

class TemplateParser {
  const char *p_;
  const char *end_;

  void skip_ws() {
    while (p_ < end_ && std::isspace(static_cast<unsigned char>(*p_)))
      ++p_;
  }

  char peek() const { return p_ < end_ ? *p_ : '\0'; }

  char get() {
    if (p_ >= end_)
      throw std::runtime_error("unexpected end of template json");
    return *p_++;
  }

  void expect(char c) {
    skip_ws();
    if (get() != c)
      throw std::runtime_error("invalid template json");
  }

  static int hex_val(char c) {
    if (c >= '0' && c <= '9')
      return c - '0';
    if (c >= 'a' && c <= 'f')
      return c - 'a' + 10;
    if (c >= 'A' && c <= 'F')
      return c - 'A' + 10;
    return -1;
  }

  std::string parse_string() {
    skip_ws();
    if (get() != '"')
      throw std::runtime_error("expected string");
    std::string out;
    while (p_ < end_) {
      char c = get();
      if (c == '"')
        break;
      if (c == '\\') {
        if (p_ >= end_)
          throw std::runtime_error("bad string escape");
        c = get();
        switch (c) {
        case '"':
        case '\\':
        case '/':
          out.push_back(c);
          break;
        case 'b':
          out.push_back('\b');
          break;
        case 'f':
          out.push_back('\f');
          break;
        case 'n':
          out.push_back('\n');
          break;
        case 'r':
          out.push_back('\r');
          break;
        case 't':
          out.push_back('\t');
          break;
        case 'u': {
          if (p_ + 4 > end_)
            throw std::runtime_error("bad unicode escape");
          int u = 0;
          for (int i = 0; i < 4; ++i) {
            const int v = hex_val(get());
            if (v < 0)
              throw std::runtime_error("bad unicode escape");
            u = (u << 4) | v;
          }
          if (u <= 0x7f) {
            out.push_back(static_cast<char>(u));
          } else if (u <= 0x7ff) {
            out.push_back(static_cast<char>(0xc0 | (u >> 6)));
            out.push_back(static_cast<char>(0x80 | (u & 0x3f)));
          } else {
            out.push_back(static_cast<char>(0xe0 | (u >> 12)));
            out.push_back(static_cast<char>(0x80 | ((u >> 6) & 0x3f)));
            out.push_back(static_cast<char>(0x80 | (u & 0x3f)));
          }
          break;
        }
        default:
          throw std::runtime_error("bad string escape");
        }
        continue;
      }
      out.push_back(c);
    }
    return out;
  }

  TemplateValue parse_value() {
    skip_ws();
    const char c = peek();
    if (c == '{')
      return parse_object();
    if (c == '[')
      return parse_array();
    if (c == '"') {
      TemplateValue v;
      v.kind = TemplateValue::Kind::String;
      v.str = parse_string();
      return v;
    }
    throw std::runtime_error("template json must use objects, arrays, or strings");
  }

  TemplateValue parse_object() {
    expect('{');
    TemplateValue v;
    v.kind = TemplateValue::Kind::Object;
    skip_ws();
    if (peek() == '}') {
      get();
      return v;
    }
    for (;;) {
      skip_ws();
      if (peek() != '"')
        throw std::runtime_error("expected object key");
      const std::string key = parse_string();
      expect(':');
      v.members.emplace_back(key, parse_value());
      skip_ws();
      const char ch = get();
      if (ch == '}')
        break;
      if (ch != ',')
        throw std::runtime_error("expected , or }");
    }
    return v;
  }

  TemplateValue parse_array() {
    expect('[');
    TemplateValue v;
    v.kind = TemplateValue::Kind::Array;
    skip_ws();
    if (peek() == ']') {
      get();
      return v;
    }
    for (;;) {
      v.items.push_back(parse_value());
      skip_ws();
      const char ch = get();
      if (ch == ']')
        break;
      if (ch != ',')
        throw std::runtime_error("expected , or ]");
    }
    return v;
  }

public:
  TemplateParser(const char *begin, const char *end) : p_(begin), end_(end) {}

  TemplateValue parse() {
    TemplateValue v = parse_value();
    skip_ws();
    if (p_ != end_)
      throw std::runtime_error("trailing template json");
    return v;
  }
};

} // namespace

TemplateValue TemplateValue::parse(const std::string &input) {
  TemplateParser parser(input.data(), input.data() + input.size());
  TemplateValue value = parser.parse();
  prepare_value(value);
  return value;
}
