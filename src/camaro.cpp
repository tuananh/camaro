#include "../node_modules/fifo_map/src/fifo_map.hpp"
#include "../node_modules/json/single_include/nlohmann/json.hpp"
#include "../node_modules/pugixml/src/pugixml.hpp"
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <vector>

using namespace emscripten;
using string = std::string;
using xquery = pugi::xpath_query;
using nodeset = pugi::xpath_node_set;

// See https://github.com/nlohmann/json#notes
// See https://github.com/nlohmann/json/issues/485#issuecomment-333652309
// A workaround to use fifo_map as map, we are just ignoring the 'less' compare
template <class K, class V, class dummy_compare, class A>
using my_workaround_fifo_map =
    nlohmann::fifo_map<K, V, nlohmann::fifo_map_compare<K>, A>;
using json = nlohmann::basic_json<my_workaround_fifo_map>;

enum ReturnType { T_NUMBER, T_STRING, T_BOOLEAN };

template <typename T> void walk(T &doc, json &n, val &output, string key);

inline bool start_with(string to_check, string prefix) {
  return to_check.rfind(prefix, 0) == 0;
}

ReturnType get_return_type(string &path) {
  const char ch = path.at(0);
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

template <typename T> bool query_boolean(T &xnode, json &j) {
  xquery query(j.get<string>().c_str());
  return query.evaluate_boolean(xnode);
}

template <typename T> string query_string(T &xnode, json &j) {
  string path = j.get<string>();
  string val = "";

  if (path.find("#") != string::npos) {
    val = path.substr(1, path.size());
  } else {
    xquery query(path.c_str());
    val = query.evaluate_string(xnode);
  }

  return val;
}

template <typename T> double query_number(T &xnode, json &j) {
  xquery query(j.get<string>().c_str());
  return query.evaluate_number(xnode);
}

template <typename T> val query_array(T &doc, json &node) {
  std::vector<val> arr;

  // a special case for backward compatible with xpath-object-transform
  if (node.empty()) {
    return val::array(arr);
  }

  string base_path = node[0].get<string>();
  xquery q(base_path.c_str());
  pugi::xpath_node_set nodes = q.evaluate_node_set(doc);

  for (size_t i = 0; i < nodes.size(); ++i) {
    pugi::xpath_node n = nodes[i];
    auto inner = node[1];

    if (inner.is_object()) {
      val obj = val::object();
      for (json::iterator it = inner.begin(); it != inner.end(); ++it) {
        walk(n, it.value(), obj, it.key());
      }
      arr.push_back(obj);
    } else if (inner.is_string()) {
      string path = inner;
      ReturnType type = get_return_type((path));
      if (type == T_STRING) {
        arr.push_back(val(query_string(n, inner)));
      }
      if (type == T_NUMBER) {
        arr.push_back(val(query_number(n, inner)));
      }
      if (type == T_BOOLEAN) {
        arr.push_back(val(query_boolean(n, inner)));
      }
    }
  }

  // return arr;
  return val::array(arr);
}

template <typename T> val query_object(T &doc, json &node) {
  val output = val::object();

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    string key = it.key();
    walk(doc, *it, output, key);
  }

  return output;
}

template <typename T> void walk(T &doc, json &n, val &output, string key) {
  if (n.is_array()) {
    output.set(key, query_array(doc, n));
  } else if (n.is_object()) {
    output.set(key, query_object(doc, n));
  } else if (n.is_string()) {
    string path = n.get<string>();
    if (path.empty()) {
      output.set(key, "");
    } else {
      ReturnType type = get_return_type(path);
      if (type == T_NUMBER) {
        output.set(key, query_number(doc, n));
      }
      if (type == T_STRING) {
        output.set(key, query_string(doc, n));
      }
      if (type == T_BOOLEAN) {
        output.set(key, query_boolean(doc, n));
      }
    }
  }
}

val transform(string xml, string json_template) {
  pugi::xml_document doc;
  val output = val::object();

  if (doc.load_string(xml.c_str())) {
    json j = json::parse(json_template);

    if (j.is_array()) {
      return query_array(doc, j);
    } else {
      for (json::iterator it = j.begin(); it != j.end(); ++it) {
        string key = it.key();
        json &node = j[key];
        walk(doc, node, output, key);
      }
    }
    // free(&j);
    // free(&doc);
    // free(&xml);
  }

  return output;
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
  val ArrayCtor = val::global("Array");
  if (existing.instanceof(ArrayCtor)) {
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
  val ArrayCtor = val::global("Array");
  if (v.instanceof(ArrayCtor)) {
    const int len = v["length"].as<int>();
    val out = val::array();
    for (int i = 0; i < len; ++i)
      out.call<void>("push", simplify_value(v[i]));
    return out;
  }

  val ObjectCtor = val::global("Object");
  if (!v.instanceof(ObjectCtor))
    return v;

  val keys = ObjectCtor.call<val>("keys", v);
  const int n = keys["length"].as<int>();
  val out = val::object();
  for (int i = 0; i < n; ++i) {
    const string k = keys[i].as<string>();
    out.set(k, simplify_value(v[k]));
  }

  val keys2 = ObjectCtor.call<val>("keys", out);
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

val to_json(string xml) {
  pugi::xml_document doc;
  if (!doc.load_string(xml.c_str()))
    return val::object();

  json_tree_walker walker;
  doc.traverse(walker);
  return simplify_value(walker.output);
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

string pretty_print(string xml, PrettyPrintOpts opts) {
  pugi::xml_document doc;
  xml_string_writer writer;
  std::string indent(opts.indent_size, ' ');

  if (doc.load_string(xml.c_str())) {
    doc.print(writer, indent.c_str(), pugi::format_default,
              pugi::encoding_utf8);
  }

  return writer.result;
}

EMSCRIPTEN_BINDINGS(my_module) {
  value_object<PrettyPrintOpts>("PrettyPrintOpts")
      .field("indentSize", &PrettyPrintOpts::indent_size);

  function("transform", &transform);
  function("toJson", &to_json);
  function("prettyPrint", &pretty_print);
}
