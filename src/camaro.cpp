#include "../node_modules/fifo_map/src/fifo_map.hpp"
#include "../node_modules/json/single_include/nlohmann/json.hpp"
#include "../node_modules/pugixml/src/pugixml.hpp"
#include <cstdint>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <memory>
#include <unordered_map>
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

template <typename T> void walk(T &doc, json &n, val &output, string key,
                              XpathCache &xc);

inline bool start_with(const string &to_check, const string &prefix) {
  return to_check.rfind(prefix, 0) == 0;
}

static val js_array_ctor() {
  static const val ctor = val::global("Array");
  return ctor;
}

static val js_object_ctor() {
  static const val ctor = val::global("Object");
  return ctor;
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

template <typename T> val query_array(T &doc, json &node, XpathCache &xc) {
  std::vector<val> arr;

  // a special case for backward compatible with xpath-object-transform
  if (node.empty()) {
    return val::array(arr);
  }

  const string &base_path = node[0].get_ref<const string &>();
  pugi::xpath_node_set nodes =
      xc.query_for(base_path).evaluate_node_set(doc);
  arr.reserve(nodes.size());

  json &inner_template = node[1];
  for (size_t i = 0; i < nodes.size(); ++i) {
    pugi::xpath_node n = nodes[i];

    if (inner_template.is_object()) {
      val obj = val::object();
      for (json::iterator it = inner_template.begin(); it != inner_template.end();
           ++it) {
        walk(n, it.value(), obj, it.key(), xc);
      }
      arr.push_back(obj);
    } else if (inner_template.is_string()) {
      const string &path = inner_template.get_ref<const string &>();
      ReturnType type = get_return_type(path);
      if (type == T_STRING) {
        arr.push_back(val(query_string(n, inner_template, xc)));
      } else if (type == T_NUMBER) {
        arr.push_back(val(query_number(n, inner_template, xc)));
      } else if (type == T_BOOLEAN) {
        arr.push_back(val(query_boolean(n, inner_template, xc)));
      }
    }
  }

  // return arr;
  return val::array(arr);
}

template <typename T> val query_object(T &doc, json &node, XpathCache &xc) {
  val output = val::object();

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    walk(doc, it.value(), output, it.key(), xc);
  }

  return output;
}

template <typename T> void walk(T &doc, json &n, val &output, string key,
                               XpathCache &xc) {
  if (n.is_array()) {
    output.set(key, query_array(doc, n, xc));
  } else if (n.is_object()) {
    output.set(key, query_object(doc, n, xc));
  } else if (n.is_string()) {
    const string &path = n.get_ref<const string &>();
    if (path.empty()) {
      output.set(key, "");
    } else {
      ReturnType type = get_return_type(path);
      if (type == T_NUMBER) {
        output.set(key, query_number(doc, n, xc));
      } else if (type == T_STRING) {
        output.set(key, query_string(doc, n, xc));
      } else if (type == T_BOOLEAN) {
        output.set(key, query_boolean(doc, n, xc));
      }
    }
  }
}

static val transform_loaded_doc(pugi::xml_document &doc,
                                const std::string &json_template) {
  val output = val::object();
  json j = json::parse(json_template);
  XpathCache xc;

  if (j.is_array()) {
    return query_array(doc, j, xc);
  }
  for (json::iterator it = j.begin(); it != j.end(); ++it) {
    walk(doc, it.value(), output, it.key(), xc);
  }
  return output;
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

static void merge_child(val parent, const string &key, val child) {
  val existing = parent[key];
  if (existing.isUndefined()) {
    parent.set(key, child);
    return;
  }
  if (existing.instanceof(js_array_ctor())) {
    existing.call<void>("push", child);
  } else {
    val arr = val::array();
    arr.call<void>("push", existing);
    arr.call<void>("push", child);
    parent.set(key, arr);
  }
}

static void append_text(val parent, const string &chunk) {
  if (chunk.empty())
    return;
  val cur = parent["_text"];
  if (cur.isUndefined())
    parent.set("_text", val(chunk));
  else
    parent.set("_text", val(cur.as<string>() + chunk));
}

static val simplify_value(val v) {
  if (v.instanceof(js_array_ctor())) {
    const int len = v["length"].as<int>();
    val out = val::array();
    for (int i = 0; i < len; ++i)
      out.call<void>("push", simplify_value(v[i]));
    return out;
  }

  val object_ctor = js_object_ctor();
  if (!v.instanceof(object_ctor))
    return v;

  val keys = object_ctor.call<val>("keys", v);
  const int n = keys["length"].as<int>();
  val out = val::object();
  for (int i = 0; i < n; ++i) {
    const string k = keys[i].as<string>();
    out.set(k, simplify_value(v[k]));
  }

  val keys2 = object_ctor.call<val>("keys", out);
  if (keys2["length"].as<int>() == 1 && keys2[0].as<string>() == "_text")
    return out["_text"];
  return out;
}

struct json_tree_walker : pugi::xml_tree_walker {
  val output = val::object();
  std::vector<val> elem_stack;

  bool for_each(pugi::xml_node &node) override {
    switch (node.type()) {
    case pugi::node_element: {
      const int d = depth();
      while (static_cast<int>(elem_stack.size()) > d)
        elem_stack.pop_back();

      val elem = val::object();
      bool has_attr = false;
      val attrs = val::object();
      for (pugi::xml_attribute a : node.attributes()) {
        has_attr = true;
        attrs.set(string(a.name()), string(a.value()));
      }
      if (has_attr)
        elem.set("$", attrs);

      val parent = d == 0 ? output : elem_stack[d - 1];
      merge_child(parent, string(node.name()), elem);
      elem_stack.push_back(elem);
      break;
    }
    case pugi::node_pcdata:
    case pugi::node_cdata: {
      const int d = depth();
      if (d == 0 || elem_stack.empty())
        break;
      const string text = trim_xml_text(node.value());
      if (text.empty())
        break;
      append_text(elem_stack[d - 1], text);
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
  return simplify_value(walker.output);
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
