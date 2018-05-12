#define PUGIXML_NO_EXCEPTIONS
#define PUGIXML_HEADER_ONLY

#include "napi.h"
#include "pugixml/src/pugixml.hpp"
#include "json/json.hpp"
#include <string>

using json = nlohmann::json;
using string = std::string;
using xquery = pugi::xpath_query;
using nodeset = pugi::xpath_node_set;

enum ReturnType { T_NUMBER, T_STRING, T_BOOLEAN };

template <typename T>
void walk(T &doc, json &n, Napi::Object &output, string key,
          const Napi::CallbackInfo &info);

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
Napi::Boolean query_boolean(T &xnode, json &j, const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  string path = j;
  xquery query(path.c_str());
  auto val = query.evaluate_boolean(xnode);
  return Napi::Boolean::New(env, val);
}

template <typename T>
Napi::String query_string(T &xnode, json &j, const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  string path = j;
  string val = "";

  if (path.find("#") != std::string::npos) {
    val = path.substr(1, path.size());
  } else {
    xquery query(path.c_str());
    val = query.evaluate_string(xnode);
  }

  return Napi::String::New(env, val.c_str());
}

template <typename T>
Napi::Number query_number(T &xnode, json &j, const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  string path = j;
  xquery query(path.c_str());
  double val = query.evaluate_number(xnode);
  return Napi::Number::New(env, val);
}

template <typename T>
Napi::Array query_array(T &doc, json &node, const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::Array tmp = Napi::Array::New(env);

  // a special case for backward compatible with xpath-object-transform
  if (node.empty()) {
    return tmp;
  }

  string base_path = node[0];
  xquery q(base_path.c_str());
  pugi::xpath_node_set nodes = q.evaluate_node_set(doc);

  for (size_t i = 0; i < nodes.size(); ++i) {
    pugi::xpath_node n = nodes[i];
    auto inner = node[1];

    if (inner.is_object()) {
      Napi::Object obj = Napi::Object::New(env);
      for (json::iterator it = inner.begin(); it != inner.end(); ++it) {
        walk(n, it.value(), obj, it.key(), info);
      }
      tmp.Set(i, obj);
    } else if (inner.is_string()) {
      string path = inner;
      ReturnType type = get_return_type((path));
      if (type == T_STRING) {
        tmp.Set(i, query_string(n, inner, info));
      }
      if (type == T_NUMBER) {
        tmp.Set(i, query_number(n, inner, info));
      }
      if (type == T_BOOLEAN) {
        tmp.Set(i, query_boolean(n, inner, info));
      }
    }
  }

  return tmp;
}

template <typename T>
Napi::Object query_object(T &doc, json &node, const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::Object output = Napi::Object::New(env);

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    string key = it.key();
    walk(doc, *it, output, key, info);
  }

  return output;
}

template <typename T>
void walk(T &doc, json &n, Napi::Object &output, string key,
          const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  const char *ckey = key.c_str();
  if (n.is_array()) {
    output.Set(Napi::String::New(env, ckey), query_array(doc, n, info));
  } else if (n.is_object()) {
    output.Set(Napi::String::New(env, ckey), query_object(doc, n, info));
  } else if (n.is_string()) {
    string path = n;
    ReturnType type = get_return_type(path);
    if (type == T_NUMBER) {
      output.Set(Napi::String::New(env, ckey), query_number(doc, n, info));
    }
    if (type == T_STRING) {
      output.Set(Napi::String::New(env, ckey), query_string(doc, n, info));
    }
    if (type == T_BOOLEAN) {
      output.Set(Napi::String::New(env, ckey), query_boolean(doc, n, info));
    }
  }
}

void transform_xml(string xml, string fmt, const Napi::CallbackInfo &info,
                   Napi::Object &output) {
  pugi::xml_document doc;

  if (doc.load_string(xml.c_str())) {
    auto j = json::parse(fmt);

    for (json::iterator it = j.begin(); it != j.end(); ++it) {
      string key = it.key();
      auto &node = j[key];
      walk(doc, node, output, key, info);
    }
  }
}