#include "../node_modules/fifo_map/src/fifo_map.hpp"
#include "../node_modules/json/single_include/nlohmann/json.hpp"
#include "../node_modules/pugixml/src/pugixml.hpp"
#include <cstdint>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <memory>
#include <unordered_map>
#include <utility>
#include <vector>

using namespace emscripten;
using string = std::string;

// See https://github.com/nlohmann/json#notes
// See https://github.com/nlohmann/json/issues/485#issuecomment-333652309
// A workaround to use fifo_map as map, we are just ignoring the 'less' compare
template <class K, class V, class dummy_compare, class A>
using my_workaround_fifo_map =
    nlohmann::fifo_map<K, V, nlohmann::fifo_map_compare<K>, A>;
using json = nlohmann::basic_json<my_workaround_fifo_map>;

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

enum ReturnType { T_NUMBER, T_STRING, T_BOOLEAN };

template <typename T>
void walk(T &doc, json &n, json &output, const string &key, XpathCache &xc);

inline bool start_with(const string &to_check, const string &prefix) {
  return to_check.rfind(prefix, 0) == 0;
}

/// One JS boundary crossing for an arbitrary JSON tree (avoids per-field embind).
static val json_to_val(const json &j) {
  const string s = j.dump();
  static const val JSON = val::global("JSON");
  return JSON.call<val>("parse", val(s));
}

ReturnType get_return_type(const string &path) {
  if (path.empty())
    return T_STRING;
  const char ch = path[0];
  ReturnType t = T_STRING;
  switch (ch) {
  case 'b':
    if (start_with(path, "boolean(")) {
      t = T_BOOLEAN;
    }
    break;
  case 'c':
    if (start_with(path, "count(") || start_with(path, "ceiling(")) {
      t = T_NUMBER;
    }
    break;
  case 'f':
    if (start_with(path, "floor(")) {
      t = T_NUMBER;
    }
    break;
  case 'n':
    if (start_with(path, "number(")) {
      t = T_NUMBER;
    }
    break;
  case 'r':
    if (start_with(path, "round(")) {
      t = T_NUMBER;
    }
    break;
  case 's':
    if (start_with(path, "sum(")) {
      t = T_NUMBER;
    }
    break;
  default:
    t = T_STRING;
    break;
  }

  return t;
}

template <typename T> bool query_boolean(T &xnode, json &j, XpathCache &xc) {
  const string &path = j.get_ref<const string &>();
  return xc.query_for(path).evaluate_boolean(xnode);
}

template <typename T> string query_string(T &xnode, json &j, XpathCache &xc) {
  const string &path = j.get_ref<const string &>();
  if (!path.empty() && path[0] == '#') {
    return path.substr(1);
  }
  return xc.query_for(path).evaluate_string(xnode);
}

template <typename T> double query_number(T &xnode, json &j, XpathCache &xc) {
  const string &path = j.get_ref<const string &>();
  return xc.query_for(path).evaluate_number(xnode);
}

template <typename T> json query_array(T &doc, json &node, XpathCache &xc) {
  json arr = json::array();

  // a special case for backward compatible with xpath-object-transform
  if (node.empty()) {
    return arr;
  }

  const string &base_path = node[0].get_ref<const string &>();
  pugi::xpath_node_set nodes =
      xc.query_for(base_path).evaluate_node_set(doc);

  json &inner_template = node[1];
  for (size_t i = 0; i < nodes.size(); ++i) {
    pugi::xpath_node n = nodes[i];

    if (inner_template.is_object()) {
      json obj = json::object();
      for (json::iterator it = inner_template.begin(); it != inner_template.end();
           ++it) {
        walk(n, it.value(), obj, it.key(), xc);
      }
      arr.push_back(std::move(obj));
    } else if (inner_template.is_string()) {
      const string &path = inner_template.get_ref<const string &>();
      ReturnType type = get_return_type(path);
      if (type == T_STRING) {
        arr.push_back(query_string(n, inner_template, xc));
      } else if (type == T_NUMBER) {
        arr.push_back(query_number(n, inner_template, xc));
      } else if (type == T_BOOLEAN) {
        arr.push_back(query_boolean(n, inner_template, xc));
      }
    }
  }

  return arr;
}

template <typename T> json query_object(T &doc, json &node, XpathCache &xc) {
  json out = json::object();

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    walk(doc, it.value(), out, it.key(), xc);
  }

  return out;
}

template <typename T>
void walk(T &doc, json &n, json &output, const string &key, XpathCache &xc) {
  if (n.is_array()) {
    output[key] = query_array(doc, n, xc);
  } else if (n.is_object()) {
    output[key] = query_object(doc, n, xc);
  } else if (n.is_string()) {
    const string &path = n.get_ref<const string &>();
    if (path.empty()) {
      output[key] = "";
    } else {
      ReturnType type = get_return_type(path);
      if (type == T_NUMBER) {
        output[key] = query_number(doc, n, xc);
      } else if (type == T_STRING) {
        output[key] = query_string(doc, n, xc);
      } else if (type == T_BOOLEAN) {
        output[key] = query_boolean(doc, n, xc);
      }
    }
  }
}

static val transform_loaded_doc(pugi::xml_document &doc,
                                const std::string &json_template) {
  json j = json::parse(json_template);
  XpathCache xc;
  json out;

  if (j.is_array()) {
    out = query_array(doc, j, xc);
  } else {
    out = json::object();
    for (json::iterator it = j.begin(); it != j.end(); ++it) {
      walk(doc, it.value(), out, it.key(), xc);
    }
  }
  return json_to_val(out);
}

val transform(string xml, string json_template) {
  pugi::xml_document doc;
  if (!doc.load_string(xml.c_str()))
    return val::object();
  return transform_loaded_doc(doc, json_template);
}

val transform_from_utf8(std::uintptr_t xml_ptr, size_t xml_len,
                          string json_template) {
  auto *p = reinterpret_cast<const char *>(xml_ptr);
  pugi::xml_document doc;
  if (!doc.load_buffer(p, xml_len, pugi::parse_default,
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

static void merge_child_json(json &parent, const string &key, json child) {
  if (!parent.contains(key)) {
    parent[key] = std::move(child);
    return;
  }
  json &existing = parent[key];
  if (existing.is_array()) {
    existing.push_back(std::move(child));
  } else {
    json arr = json::array();
    arr.push_back(std::move(existing));
    arr.push_back(std::move(child));
    parent[key] = std::move(arr);
  }
}

static json simplify_json(const json &v) {
  if (v.is_array()) {
    json out = json::array();
    for (const auto &el : v)
      out.push_back(simplify_json(el));
    return out;
  }
  if (!v.is_object())
    return v;

  json out = json::object();
  for (json::const_iterator it = v.begin(); it != v.end(); ++it)
    out[it.key()] = simplify_json(it.value());

  if (out.size() == 1 && out.contains("_text"))
    return out["_text"];
  return out;
}

/// Built in-memory with stable pointers; folded to json once (duplicate sibling
/// names merge into arrays without invalidating parent references).
struct XmlElemBuilder {
  json attrs = json::object();
  bool has_attrs = false;
  string text;
  std::vector<std::pair<string, std::unique_ptr<XmlElemBuilder>>> children;
};

static void append_text_builder(XmlElemBuilder &elem, const string &chunk) {
  if (chunk.empty())
    return;
  if (elem.text.empty())
    elem.text = chunk;
  else
    elem.text += chunk;
}

static void append_text_json(json &elem, const string &chunk) {
  if (chunk.empty())
    return;
  if (!elem.contains("_text"))
    elem["_text"] = chunk;
  else
    elem["_text"] = elem["_text"].get_ref<const string &>() + chunk;
}

static json fold_builder(const XmlElemBuilder &n) {
  json elem = json::object();
  if (n.has_attrs)
    elem["$"] = n.attrs;
  for (const auto &kv : n.children)
    merge_child_json(elem, kv.first, fold_builder(*kv.second));
  if (!n.text.empty())
    append_text_json(elem, n.text);
  return elem;
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
      for (pugi::xml_attribute a : node.attributes()) {
        elem->has_attrs = true;
        elem->attrs[string(a.name())] = string(a.value());
      }

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
  json output = json::object();
  for (const auto &kv : walker.synthetic_root.children)
    merge_child_json(output, kv.first, fold_builder(*kv.second));
  return json_to_val(simplify_json(output));
}

val to_json(string xml) {
  pugi::xml_document doc;
  if (!doc.load_string(xml.c_str()))
    return val::object();

  return to_json_loaded_doc(doc);
}

val to_json_from_utf8(std::uintptr_t xml_ptr, size_t xml_len) {
  auto *p = reinterpret_cast<const char *>(xml_ptr);
  pugi::xml_document doc;
  if (!doc.load_buffer(p, xml_len, pugi::parse_default,
                       pugi::encoding_utf8)) {
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
  doc.print(writer, indent.c_str(), pugi::format_default,
            pugi::encoding_utf8);
}

string pretty_print(string xml, PrettyPrintOpts opts) {
  pugi::xml_document doc;
  xml_string_writer writer;

  if (doc.load_string(xml.c_str()))
    pretty_print_into_writer(doc, writer, opts);

  return writer.result;
}

string pretty_print_from_utf8(std::uintptr_t xml_ptr, size_t xml_len,
                              PrettyPrintOpts opts) {
  auto *p = reinterpret_cast<const char *>(xml_ptr);
  pugi::xml_document doc;
  xml_string_writer writer;

  if (doc.load_buffer(p, xml_len, pugi::parse_default,
                      pugi::encoding_utf8)) {
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
