#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <iostream>
#include "../node_modules/pugixml/src/pugixml.hpp"
#include "../node_modules/json/single_include/nlohmann/json.hpp"

using namespace emscripten;
using json = nlohmann::json;
using string = std::string;
using xquery = pugi::xpath_query;
using nodeset = pugi::xpath_node_set;

enum ReturnType { T_NUMBER, T_STRING, T_BOOLEAN };

template <typename T>
void walk(T &doc, json &n, json &output, string key);

inline bool string_contains(string to_check, string prefix) {
  return to_check.size() >= prefix.size() &&
         to_check.compare(0, prefix.size(), prefix) == 0;
}

inline char charAt(string &str, size_t pos) {
  if (str.size() > pos) {
    return str.at(pos);
  } else {
    return '\0';
  }
}

ReturnType get_return_type(string &path) {
  const char ch = charAt(path, 0);
  ReturnType t = T_STRING;
  switch (ch) {
  case 'b':
    if (string_contains(path, "boolean(")) {
      t = T_BOOLEAN;
    }
    break;
  case 'c':
    if (string_contains(path, "count(") || string_contains(path, "ceiling(")) {
      t = T_NUMBER;
    }
    break;
  case 'f':
    if (string_contains(path, "floor(")) {
      t = T_NUMBER;
    }
    break;
  case 'n':
    if (string_contains(path, "number(")) {
      t = T_NUMBER;
    }
    break;
  case 'r':
    if (string_contains(path, "round(")) {
      t = T_NUMBER;
    }
    break;
  case 's':
    if (string_contains(path, "sum(")) {
      t = T_NUMBER;
    }
    break;
  default:
    t = T_STRING;
    break;
  }

  return t;
}

template <typename T>
bool query_boolean(T &xnode, json &j) {
  string path = j;
  xquery query(j.get<string>().c_str());
  return query.evaluate_boolean(xnode);
}

template <typename T>
string query_string(T &xnode, json &j) {
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

template <typename T>
double query_number(T &xnode, json &j) {
  xquery query(j.get<string>().c_str());
  return query.evaluate_number(xnode);
}

template <typename T>
json query_array(T &doc, json &node) {
  json arr = json::array();

  // a special case for backward compatible with xpath-object-transform
  if (node.empty()) {
    return arr;
  }

  string base_path = node[0].get<string>();
  xquery q(base_path.c_str());
  pugi::xpath_node_set nodes = q.evaluate_node_set(doc);

  for (size_t i = 0; i < nodes.size(); ++i) {
    pugi::xpath_node n = nodes[i];
    auto inner = node[1];

    if (inner.is_object()) {
      json obj;
      for (json::iterator it = inner.begin(); it != inner.end(); ++it) {
        walk(n, it.value(), obj, it.key());
      }
      arr.insert(arr.begin() + i, obj);
    } else if (inner.is_string()) {
      string path = inner;
      ReturnType type = get_return_type((path));
      if (type == T_STRING) {
        arr.insert(arr.begin() + i, query_string(n, inner));
      }
      if (type == T_NUMBER) {
        arr.insert(arr.begin() + i, query_number(n, inner));
      }
      if (type == T_BOOLEAN) {
        arr.insert(arr.begin() + i, query_boolean(n, inner));
      }
    }
  }

  return arr;
}

template <typename T>
json query_object(T &doc, json &node) {
  json output;

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    string key = it.key();
    walk(doc, *it, output, key);
  }

  return output;
}

template <typename T>
void walk(T &doc, json &n, json &output, string key) {
  if (n.is_array()) {
    output[key] = query_array(doc, n);
  } else if (n.is_object()) {
    output[key] = query_object(doc, n);
  } else if (n.is_string()) {
    string path = n;
    ReturnType type = get_return_type(path);
    if (type == T_NUMBER) {
      output[key] = query_number(doc, n);
    }
    if (type == T_STRING) {
      output[key] = query_string(doc, n);
    }
    if (type == T_BOOLEAN) {
      output[key] = query_boolean(doc, n);
    }
  }
}

string transform(string xml, string json_template) {
  pugi::xml_document doc;
  json output;

  if (doc.load_string(xml.c_str())) {
    json j = json::parse(json_template);

    for (json::iterator it = j.begin(); it != j.end(); ++it) {
      string key = it.key();
      json &node = j[key];
      walk(doc, node, output, key);
    }
    // free(&j);
    // free(&doc);
    // free(&xml);
  }

  return output.dump();
}

const char* node_types[] = {
  "null", "document", "element", "pcdata", "cdata", "comment", "pi", "declaration"
};

struct simple_walker:pugi::xml_tree_walker {
  json output;
  json current_node;

  // virtual bool begin(pugi::xml_node& node) {}
  // virtual bool end(pugi::xml_node& node) {}

  virtual bool for_each(pugi::xml_node& node) {
    for (int i = 0; i < depth(); ++i) {
      std::cout << "  "; // indentation
    }

    std::cout << node_types[node.type()] << ": name='" << node.name() << "', value='" << node.value() << "'\n";

    return true; // continue traversal
  }
};

val toJson(string xml) {
  pugi::xml_document doc;
  simple_walker walker;
  // json output;

  if (doc.load_string(xml.c_str())) {
    doc.traverse(walker);
    // free(&j);
    // free(&doc);
    // free(&xml);
  }

  return val(2);
}

EMSCRIPTEN_BINDINGS(my_module) {
  function("transform", &transform);
  function("toJson", &toJson);
}
