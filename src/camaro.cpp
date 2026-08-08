#include "../node_modules/pugixml/src/pugixml.hpp"
#include "json_writer.hpp"
#include "template_value.hpp"
#include <cmath>
#include <cstdint>
#include <cstring>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <memory>
#include <unordered_map>
#include <utility>
#include <vector>

using namespace emscripten;
using string = std::string;

/// Compiling XPath is expensive; expressions repeat across many matched nodes.
class XpathCache {
  std::unordered_map<std::string, std::unique_ptr<pugi::xpath_query>> map_;

public:
  pugi::xpath_query &query_for(const std::string &expr) {
    auto it = map_.find(expr);
    if (it != map_.end())
      return *it->second;
    auto p = std::make_unique<pugi::xpath_query>(expr.c_str());
    pugi::xpath_query &ref = *p;
    map_.emplace(expr, std::move(p));
    return ref;
  }
};

/// Parsed transform templates repeat across calls; cache by string key.
struct TemplateEntry {
  TemplateValue parsed;
  XpathCache xpath;
};

class JsonTemplateCache {
  std::unordered_map<std::string, TemplateEntry> map_;

public:
  TemplateEntry &entry(const std::string &tmpl) {
    auto it = map_.find(tmpl);
    if (it != map_.end())
      return it->second;
    auto ins =
        map_.emplace(tmpl, TemplateEntry{TemplateValue::parse(tmpl), {}});
    return ins.first->second;
  }
};

using ReturnType = TemplateValue::ReturnType;

/// parse_escapes for entities; skip parse_eol / parse_wconv_attribute (see
/// pugixml #284).
static constexpr unsigned int kParseOpts =
    pugi::parse_cdata | pugi::parse_escapes;

inline pugi::xml_node context_node(pugi::xml_node &n) { return n; }
inline pugi::xml_node context_node(const pugi::xml_node &n) { return n; }
inline pugi::xml_node context_node(pugi::xml_document &d) { return d; }
inline pugi::xml_node context_node(const pugi::xml_document &d) { return d; }
inline pugi::xml_node context_node(pugi::xpath_node &n) { return n.node(); }
inline pugi::xml_node context_node(const pugi::xpath_node &n) {
  return n.node();
}

inline bool start_with(const string &to_check, const string &prefix) {
  return to_check.rfind(prefix, 0) == 0;
}

inline bool needs_full_xpath(const string &path) {
  if (path.empty())
    return false;
  if (path[0] == '#')
    return false;
  if (path.find('(') != string::npos)
    return true;
  if (path.find('[') != string::npos)
    return true;
  if (path.find("//") != string::npos)
    return true;
  return false;
}

inline bool is_simple_nav_path(const string &path) {
  if (path.empty() || path.find("//") != string::npos)
    return false;
  for (char c : path) {
    if (std::isalnum(static_cast<unsigned char>(c)) || c == '/' || c == '@' ||
        c == '_' || c == '-')
      continue;
    return false;
  }
  return true;
}

inline bool xpath_path_absolute(const string &path) {
  return !path.empty() && path[0] == '/';
}

/// Walk Name/Name/@attr paths without compiling XPath.
static pugi::xml_node follow_path(pugi::xml_node ctx, const char *begin,
                                  const char *end, bool absolute) {
  if (!ctx)
    return pugi::xml_node();
  const char *p = begin;
  if (absolute && p < end && *p == '/')
    ++p;
  while (p < end) {
    const char *start = p;
    while (p < end && *p != '/')
      ++p;
    if (p > start) {
      ctx =
          ctx.child(pugi::string_view_t(start, static_cast<size_t>(p - start)));
      if (!ctx)
        return pugi::xml_node();
    }
    if (p < end && *p == '/')
      ++p;
  }
  return ctx;
}

static string follow_path_string(pugi::xml_node ctx, const string &path,
                                 bool absolute) {
  // Bare @attr selects an attribute on the context node.
  if (!path.empty() && path[0] == '@') {
    if (!ctx)
      return "";
    pugi::xml_attribute a =
        ctx.attribute(pugi::string_view_t(path.data() + 1, path.size() - 1));
    return a ? string(a.value()) : "";
  }
  const size_t at_pos = path.rfind("/@");
  if (at_pos != string::npos) {
    pugi::xml_node n =
        follow_path(ctx, path.data(), path.data() + at_pos, absolute);
    if (!n)
      return "";
    pugi::xml_attribute a = n.attribute(
        pugi::string_view_t(path.data() + at_pos + 2, path.size() - at_pos - 2));
    return a ? string(a.value()) : "";
  }
  pugi::xml_node n =
      follow_path(ctx, path.data(), path.data() + path.size(), absolute);
  return n ? string(n.child_value()) : "";
}

static pugi::xml_node follow_simple_path(pugi::xml_node ctx,
                                         const TemplateValue &v) {
  if (!ctx)
    return pugi::xml_node();
  for (const auto &segment : v.path_segments) {
    ctx = ctx.child(pugi::string_view_t(v.str.data() + segment.start,
                                        segment.length));
    if (!ctx)
      return pugi::xml_node();
  }
  return ctx;
}

static string follow_simple_path_string(pugi::xml_node ctx,
                                        const TemplateValue &v) {
  pugi::xml_node n = follow_simple_path(ctx, v);
  if (!n)
    return "";
  if (v.path_has_attribute) {
    const auto &attr = v.attribute_segment;
    pugi::xml_attribute a = n.attribute(pugi::string_view_t(
        v.str.data() + attr.start + 1, attr.length - 1));
    return a ? string(a.value()) : "";
  }
  return string(n.child_value());
}

static double follow_path_number(pugi::xml_node ctx, const string &path,
                                 bool absolute) {
  // Bare @attr selects an attribute on the context node.
  if (!path.empty() && path[0] == '@') {
    if (!ctx)
      return std::nan("");
    pugi::xml_attribute a =
        ctx.attribute(pugi::string_view_t(path.data() + 1, path.size() - 1));
    return a ? a.as_double() : std::nan("");
  }
  const size_t at_pos = path.rfind("/@");
  if (at_pos != string::npos) {
    pugi::xml_node n =
        follow_path(ctx, path.data(), path.data() + at_pos, absolute);
    if (!n)
      return std::nan("");
    pugi::xml_attribute a = n.attribute(
        pugi::string_view_t(path.data() + at_pos + 2, path.size() - at_pos - 2));
    return a ? a.as_double() : std::nan("");
  }
  pugi::xml_node n =
      follow_path(ctx, path.data(), path.data() + path.size(), absolute);
  return n ? n.text().as_double() : std::nan("");
}

static bool fast_boolean_eq(pugi::xml_node ctx, const string &path,
                            const string &expected) {
  pugi::xml_node n =
      follow_path(ctx, path.data(), path.data() + path.size(), false);
  if (!n)
    return false;
  return std::strcmp(n.child_value(), expected.c_str()) == 0;
}

static bool try_fast_boolean(pugi::xml_node ctx, const string &path,
                             bool &out) {
  if (!start_with(path, "boolean(") || path.size() < 10 || path.back() != ')')
    return false;
  const string inner = path.substr(8, path.size() - 9);
  const size_t eq = inner.find('=');
  if (eq == string::npos)
    return false;
  string left = inner.substr(0, eq);
  string right = inner.substr(eq + 1);
  const auto trim = [](string &s) {
    const size_t start = s.find_first_not_of(" \t");
    if (start == string::npos) {
      s.clear();
      return;
    }
    const size_t end = s.find_last_not_of(" \t");
    s = s.substr(start, end - start + 1);
  };
  trim(left);
  trim(right);
  if (right.size() >= 2 && ((right.front() == '"' && right.back() == '"') ||
                            (right.front() == '\'' && right.back() == '\''))) {
    right = right.substr(1, right.size() - 2);
  }
  if (left.find('(') != string::npos || left.find('/') != string::npos ||
      left.find('@') != string::npos)
    return false;
  out = fast_boolean_eq(ctx, left, right);
  return true;
}

static bool try_fast_number(pugi::xml_node ctx, const string &path,
                            double &out) {
  if (!start_with(path, "number(") || path.size() < 9 || path.back() != ')')
    return false;
  const string inner = path.substr(7, path.size() - 8);
  if (!is_simple_nav_path(inner))
    return false;
  out = follow_path_number(ctx, inner, xpath_path_absolute(inner));
  return true;
}

static void collect_path_nodes(pugi::xml_node ctx, const string &path,
                               std::vector<pugi::xpath_node> &out) {
  const size_t slash = path.rfind('/');
  if (slash == string::npos) {
    for (pugi::xml_node c = ctx.child(path.c_str()); c;
         c = c.next_sibling(path.c_str()))
      out.emplace_back(c);
    return;
  }
  const string parent_path = path.substr(0, slash);
  const char *child_name = path.c_str() + slash + 1;
  pugi::xml_node parent =
      follow_path(ctx, parent_path.data(), parent_path.data() + parent_path.size(),
                  false);
  if (!parent)
    return;
  for (pugi::xml_node c = parent.child(child_name); c;
       c = c.next_sibling(child_name))
    out.emplace_back(c);
}

static bool is_simple_descendant_name(const string &path, string &name_out) {
  if (path.size() < 3 || path[0] != '/' || path[1] != '/')
    return false;
  if (path.find('/', 2) != string::npos)
    return false;
  const string name = path.substr(2);
  if (!is_simple_nav_path(name))
    return false;
  name_out = name;
  return true;
}

static void collect_descendants_by_name(pugi::xml_node root, const char *name,
                                        std::vector<pugi::xpath_node> &out) {
  if (!root)
    return;
  if (root.type() == pugi::node_element && std::strcmp(root.name(), name) == 0)
    out.emplace_back(root);
  for (pugi::xml_node c = root.first_child(); c; c = c.next_sibling())
    collect_descendants_by_name(c, name, out);
}

template <typename T>
static void collect_array_nodes(pugi::xml_node ctx, const string &base_path,
                                std::vector<pugi::xpath_node> &out,
                                XpathCache &xc, T &xpath_ctx) {
  string desc_name;
  if (is_simple_descendant_name(base_path, desc_name)) {
    collect_descendants_by_name(ctx, desc_name.c_str(), out);
    return;
  }
  if (is_simple_nav_path(base_path)) {
    collect_path_nodes(ctx, base_path, out);
    return;
  }
  pugi::xpath_node_set nodes =
      xc.query_for(base_path).evaluate_node_set(xpath_ctx);
  out.reserve(nodes.size());
  for (size_t i = 0; i < nodes.size(); ++i)
    out.push_back(nodes[i]);
}

ReturnType get_return_type(const string &path) {
  if (path.empty())
    return ReturnType::String;
  const char ch = path[0];
  ReturnType t = ReturnType::String;
  switch (ch) {
  case 'b':
    if (start_with(path, "boolean(")) {
      t = ReturnType::Boolean;
    }
    break;
  case 'c':
    if (start_with(path, "count(") || start_with(path, "ceiling(")) {
      t = ReturnType::Number;
    }
    break;
  case 'f':
    if (start_with(path, "floor(")) {
      t = ReturnType::Number;
    }
    break;
  case 'n':
    if (start_with(path, "number(")) {
      t = ReturnType::Number;
    }
    break;
  case 'r':
    if (start_with(path, "round(")) {
      t = ReturnType::Number;
    }
    break;
  case 's':
    if (start_with(path, "sum(")) {
      t = ReturnType::Number;
    }
    break;
  default:
    t = ReturnType::String;
    break;
  }

  return t;
}

template <typename T>
bool query_boolean(T &xnode, const TemplateValue &v, XpathCache &xc) {
  const string &path = v.as_string();
  if (v.fast_boolean)
    return fast_boolean_eq(context_node(xnode), v.boolean_left,
                           v.boolean_right);
  return xc.query_for(path).evaluate_boolean(xnode);
}

template <typename T>
string query_string(T &xnode, const TemplateValue &v, XpathCache &xc) {
  const string &path = v.as_string();
  if (!path.empty() && path[0] == '#') {
    return path.substr(1);
  }
  if (v.simple_nav_path) {
    return follow_simple_path_string(context_node(xnode), v);
  }
  return xc.query_for(path).evaluate_string(xnode);
}

template <typename T>
double query_number(T &xnode, const TemplateValue &v, XpathCache &xc) {
  const string &path = v.as_string();
  if (v.fast_number)
    return follow_path_number(context_node(xnode), v.number_path,
                              v.number_path_absolute);
  return xc.query_for(path).evaluate_number(xnode);
}

template <typename T>
void write_value(T &ctx, JsonWriter &w, const TemplateValue &n, XpathCache &xc,
                 bool &has_nan);

template <typename T>
void query_array_w(JsonWriter &w, T &doc, const TemplateValue &node,
                   XpathCache &xc, bool &has_nan) {
  w.begin_array();
  if (node.empty()) {
    w.end_array();
    return;
  }

  const TemplateValue &base = node.items[0];
  const string &base_path = base.as_string();
  const TemplateValue &inner_template = node.items[1];

  const auto append_node = [&](pugi::xpath_node n) {
    if (inner_template.is_object()) {
      w.begin_object();
      for (const auto &member : inner_template.members) {
        w.write_key(member.first);
        write_value(n, w, member.second, xc, has_nan);
      }
      w.end_object();
    } else if (inner_template.is_string()) {
      const string &path = inner_template.as_string();
      ReturnType type = inner_template.return_type;
      if (type == ReturnType::String) {
        w.write_string(query_string(n, inner_template, xc));
      } else if (type == ReturnType::Number) {
        w.write_number(query_number(n, inner_template, xc), has_nan);
      } else if (type == ReturnType::Boolean) {
        w.write_bool(query_boolean(n, inner_template, xc));
      }
    }
  };

  // The common nested-array case has a simple parent/child path. Stream its
  // children directly instead of allocating a node vector for every parent.
  if (base.simple_nav_path) {
    const size_t slash = base.final_slash;
    pugi::xml_node parent = context_node(doc);
    const char *child_name = base_path.data();
    size_t child_len = base_path.size();
    if (slash != string::npos) {
      parent = follow_path(parent, base_path.data(),
                           base_path.data() + slash, false);
      child_name += slash + 1;
      child_len -= slash + 1;
    }
    for (pugi::xml_node child =
             parent.child(pugi::string_view_t(child_name, child_len));
         child;
         child = child.next_sibling(pugi::string_view_t(child_name, child_len))) {
      append_node(pugi::xpath_node(child));
    }
    w.end_array();
    return;
  }

  std::vector<pugi::xpath_node> nodes;
  nodes.reserve(32);
  if (base.simple_descendant_name) {
    collect_descendants_by_name(context_node(doc), base.descendant_name.c_str(),
                                nodes);
  } else {
    collect_array_nodes(context_node(doc), base_path, nodes, xc, doc);
  }

  for (pugi::xpath_node n : nodes)
    append_node(n);
  w.end_array();
}

template <typename T>
void write_value(T &ctx, JsonWriter &w, const TemplateValue &n, XpathCache &xc,
                 bool &has_nan) {
  if (n.is_array()) {
    query_array_w(w, ctx, n, xc, has_nan);
  } else if (n.is_object()) {
    w.begin_object();
    for (const auto &member : n.members) {
      w.write_key(member.first);
      write_value(ctx, w, member.second, xc, has_nan);
    }
    w.end_object();
  } else if (n.is_string()) {
    const string &path = n.as_string();
    if (path.empty()) {
      w.write_empty_string();
    } else {
      ReturnType type = n.return_type;
      if (type == ReturnType::Number) {
        w.write_number(query_number(ctx, n, xc), has_nan);
      } else if (type == ReturnType::String) {
        w.write_string(query_string(ctx, n, xc));
      } else if (type == ReturnType::Boolean) {
        w.write_bool(query_boolean(ctx, n, xc));
      }
    }
  }
}

static val transform_loaded_doc(pugi::xml_document &doc,
                                const std::string &json_template) {
  static JsonTemplateCache template_cache;
  try {
    TemplateEntry &te = template_cache.entry(json_template);
    const TemplateValue &j = te.parsed;
    XpathCache &xc = te.xpath;
    JsonWriter w;
    // Most transform templates select a small subset of the XML. Avoid
    // allocating a 32 KiB result buffer for every call; std::string grows
    // geometrically when a caller genuinely produces a larger result.
    w.reserve(2048);
    bool has_nan = false;

    if (j.is_array()) {
      query_array_w(w, doc, j, xc, has_nan);
    } else {
      w.begin_object();
      for (const auto &member : j.members) {
        w.write_key(member.first);
        write_value(doc, w, member.second, xc, has_nan);
      }
      w.end_object();
    }
    if (!has_nan)
      return val(w.buf);
    val result = val::object();
    result.set("json", w.buf);
    result.set("hasNan", true);
    return result;
  } catch (const std::exception &) {
    return val::object();
  }
}

val transform(string xml, string json_template) {
  pugi::xml_document doc;
  if (!doc.load_string(xml.c_str(), kParseOpts))
    return val::object();
  return transform_loaded_doc(doc, json_template);
}

val transform_from_utf8(std::uintptr_t xml_ptr, size_t xml_len,
                        string json_template) {
  auto *p = reinterpret_cast<char *>(xml_ptr);
  static pugi::xml_document doc;
  // Buffer is nul-terminated in worker; parse in-place to skip pugixml's copy.
  if (!doc.load_buffer_inplace(p, xml_len + 1, kParseOpts,
                               pugi::encoding_utf8)) {
    return val::object();
  }
  return transform_loaded_doc(doc, json_template);
}

static string trim_xml_text(const char *s) {
  if (!s)
    return "";
  string str(s);
  const auto start = str.find_first_not_of(" \t\n\r");
  if (start == string::npos)
    return "";
  const auto end = str.find_last_not_of(" \t\n\r");
  return str.substr(start, end - start + 1);
}

/// Built in-memory with stable pointers; serialized with JsonWriter once.
struct XmlElemBuilder {
  std::vector<std::pair<string, string>> attrs;
  string text;
  std::vector<std::pair<string, std::unique_ptr<XmlElemBuilder>>> children;
};

struct ChildGroup {
  string name;
  std::vector<const XmlElemBuilder *> elems;
};

static std::vector<ChildGroup> group_children(const XmlElemBuilder &parent) {
  std::vector<ChildGroup> groups;
  std::unordered_map<string, size_t> index;
  for (const auto &kv : parent.children) {
    const auto it = index.find(kv.first);
    if (it == index.end()) {
      index.emplace(kv.first, groups.size());
      groups.push_back({kv.first, {kv.second.get()}});
    } else {
      groups[it->second].elems.push_back(kv.second.get());
    }
  }
  return groups;
}

static void write_elem_value(JsonWriter &w, const XmlElemBuilder &n) {
  const bool has_attrs = !n.attrs.empty();
  const bool has_text = !n.text.empty();
  const bool has_children = !n.children.empty();

  if (!has_attrs && !has_children && has_text) {
    w.write_string(n.text);
    return;
  }
  if (!has_attrs && !has_children && !has_text) {
    w.begin_object();
    w.end_object();
    return;
  }

  w.begin_object();
  if (has_attrs) {
    w.write_key("$");
    w.begin_object();
    for (const auto &a : n.attrs) {
      w.write_key(a.first);
      w.write_string(a.second);
    }
    w.end_object();
  }

  for (const auto &g : group_children(n)) {
    w.write_key(g.name);
    if (g.elems.size() == 1) {
      write_elem_value(w, *g.elems[0]);
    } else {
      w.begin_array();
      for (const XmlElemBuilder *e : g.elems)
        write_elem_value(w, *e);
      w.end_array();
    }
  }

  if (has_text) {
    w.write_key("_text");
    w.write_string(n.text);
  }
  w.end_object();
}

static void append_text_builder(XmlElemBuilder &elem, const string &chunk) {
  if (chunk.empty())
    return;
  if (elem.text.empty())
    elem.text = chunk;
  else
    elem.text += chunk;
}

struct json_tree_walker : pugi::xml_tree_walker {
  XmlElemBuilder synthetic_root;
  std::vector<XmlElemBuilder *> stack;

  bool for_each(pugi::xml_node &node) override {
    switch (node.type()) {
    case pugi::node_element: {
      const int d = depth();
      while (static_cast<int>(stack.size()) > d)
        stack.pop_back();

      auto elem = std::make_unique<XmlElemBuilder>();
      for (pugi::xml_attribute a : node.attributes())
        elem->attrs.emplace_back(string(a.name()), string(a.value()));

      XmlElemBuilder *parent = d == 0 ? &synthetic_root : stack[d - 1];
      const string ename(node.name());
      parent->children.emplace_back(ename, std::move(elem));
      stack.push_back(parent->children.back().second.get());
      break;
    }
    case pugi::node_pcdata:
    case pugi::node_cdata: {
      const int d = depth();
      if (d == 0 || stack.empty())
        break;
      const string t = trim_xml_text(node.value());
      if (t.empty())
        break;
      append_text_builder(*stack[d - 1], t);
      break;
    }
    default:
      break;
    }
    return true;
  }
};

static val to_json_loaded_doc(pugi::xml_document &doc) {
  json_tree_walker walker;
  doc.traverse(walker);
  JsonWriter w;
  w.reserve(32768);
  w.begin_object();
  for (const auto &g : group_children(walker.synthetic_root)) {
    w.write_key(g.name);
    if (g.elems.size() == 1) {
      write_elem_value(w, *g.elems[0]);
    } else {
      w.begin_array();
      for (const XmlElemBuilder *e : g.elems)
        write_elem_value(w, *e);
      w.end_array();
    }
  }
  w.end_object();
  return val(w.buf);
}

val to_json(string xml) {
  pugi::xml_document doc;
  if (!doc.load_string(xml.c_str(), kParseOpts))
    return val::object();

  return to_json_loaded_doc(doc);
}

val to_json_from_utf8(std::uintptr_t xml_ptr, size_t xml_len) {
  auto *p = reinterpret_cast<const char *>(xml_ptr);
  pugi::xml_document doc;
  if (!doc.load_buffer(p, xml_len, kParseOpts, pugi::encoding_utf8)) {
    return val::object();
  }
  return to_json_loaded_doc(doc);
}

struct PrettyPrintOpts {
  int indent_size;
};

// custom writer because we dont want to import sstream
// it's faster if we were to use stringstream but we will leave it for now
struct xml_string_writer : pugi::xml_writer {
  std::string result;

  virtual void write(const void *data, size_t size) {
    result.append(static_cast<const char *>(data), size);
  }
};

static void pretty_print_into_writer(const pugi::xml_document &doc,
                                     xml_string_writer &writer,
                                     const PrettyPrintOpts &opts) {
  std::string indent(opts.indent_size, ' ');
  doc.print(writer, indent.c_str(), pugi::format_default, pugi::encoding_utf8);
}

string pretty_print(string xml, PrettyPrintOpts opts) {
  pugi::xml_document doc;
  xml_string_writer writer;

  if (doc.load_string(xml.c_str(), kParseOpts))
    pretty_print_into_writer(doc, writer, opts);

  return writer.result;
}

string pretty_print_from_utf8(std::uintptr_t xml_ptr, size_t xml_len,
                              PrettyPrintOpts opts) {
  auto *p = reinterpret_cast<const char *>(xml_ptr);
  pugi::xml_document doc;
  xml_string_writer writer;

  if (doc.load_buffer(p, xml_len, kParseOpts, pugi::encoding_utf8)) {
    pretty_print_into_writer(doc, writer, opts);
  }

  return writer.result;
}

EMSCRIPTEN_BINDINGS(my_module) {
  value_object<PrettyPrintOpts>("PrettyPrintOpts")
      .field("indentSize", &PrettyPrintOpts::indent_size);

  function("transform", &transform);
  function("transformFromUtf8", &transform_from_utf8);
  function("toJson", &to_json);
  function("toJsonFromUtf8", &to_json_from_utf8);
  function("prettyPrint", &pretty_print);
  function("prettyPrintFromUtf8", &pretty_print_from_utf8);
}
