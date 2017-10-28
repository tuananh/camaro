#define PUGIXML_NO_EXCEPTIONS
#define PUGIXML_HEADER_ONLY

#include <string>
#include "json/json.hpp"
#include "pugixml/src/pugixml.hpp"

using json = nlohmann::json;
using string = std::string;
using xquery = pugi::xpath_query;
using nodeset = pugi::xpath_node_set;
using v8::Local;
using v8::String;
using v8::Number;
using v8::Boolean;
using v8::Value;
using v8::Object;
using v8::Array;
using v8::Isolate;

enum ReturnType { T_NUMBER, T_STRING, T_BOOLEAN };

template <typename T>
void walk(T& doc, json& n, Local<Object>& output, string key,
          const Nan::FunctionCallbackInfo<Value>& args);

inline bool string_contains(string to_check, string prefix) {
  return to_check.size() >= prefix.size() &&
         to_check.compare(0, prefix.size(), prefix) == 0;
}

inline char charAt(string& str, size_t pos) {
  if (str.size() > pos) {
    return str.at(pos);
  } else {
    return '\0';
  }
}

ReturnType get_return_type(string& path) {
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
Local<Boolean> seek_single_boolean(
    T& xnode, json& j, const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  string path = j;
  xquery query(path.c_str());
  auto val = query.evaluate_boolean(xnode);
  return Boolean::New(isolate, val);
}

template <typename T>
Local<String> seek_single_string(T& xnode, json& j,
                                 const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  string path = j;
  string val = "";

  if (path.find("#") != std::string::npos) {
    val = path.substr(1, path.size());
  } else {
    xquery query(path.c_str());
    val = query.evaluate_string(xnode);
  }

  return String::NewFromUtf8(isolate, val.c_str());
}

template <typename T>
Local<Number> seek_single_number(T& xnode, json& j,
                                 const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  string path = j;
  xquery query(path.c_str());
  double val = query.evaluate_number(xnode);
  return Number::New(isolate, val);
}

template <typename T>
Local<Array> seek_array(T& doc, json& node,
                        const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Array> tmp = Array::New(isolate);

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
      Local<Object> obj = Object::New(isolate);
      for (json::iterator it = inner.begin(); it != inner.end(); ++it) {
        walk(n, it.value(), obj, it.key(), args);
      }
      const char* pkey = std::to_string(i).c_str();
      tmp->Set(String::NewFromUtf8(isolate, pkey), obj);
    } else if (inner.is_string()) {
      string path = inner;
      ReturnType type = get_return_type((path));
      if (type == T_STRING) {
        tmp->Set(i, seek_single_string(n, inner, args));
      }
      if (type == T_NUMBER) {
        tmp->Set(i, seek_single_number(n, inner, args));
      }
      if (type == T_BOOLEAN) {
        tmp->Set(i, seek_single_boolean(n, inner, args));
      }
    }
  }

  return tmp;
}

template <typename T>
Local<Object> seek_object(T& doc, json& node,
                          const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  Local<Object> output = Object::New(isolate);

  for (json::iterator it = node.begin(); it != node.end(); ++it) {
    string key = it.key();
    walk(doc, *it, output, key, args);
  }

  return output;
}

template <typename T>
void walk(T& doc, json& n, Local<Object>& output, string key,
          const Nan::FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  const char* ckey = key.c_str();
  if (n.is_array()) {
    output->Set(String::NewFromUtf8(isolate, ckey), seek_array(doc, n, args));
  } else if (n.is_object()) {
    output->Set(String::NewFromUtf8(isolate, ckey), seek_object(doc, n, args));
  } else if (n.is_string()) {
    string path = n;
    ReturnType type = get_return_type(path);
    if (type == T_NUMBER) {
      output->Set(String::NewFromUtf8(isolate, ckey),
                  seek_single_number(doc, n, args));
    }
    if (type == T_STRING) {
      output->Set(String::NewFromUtf8(isolate, ckey),
                  seek_single_string(doc, n, args));
    }
    if (type == T_BOOLEAN) {
      output->Set(String::NewFromUtf8(isolate, ckey),
                  seek_single_boolean(doc, n, args));
    }
  }
}

void transform_xml(string xml, string fmt,
                   const Nan::FunctionCallbackInfo<Value>& args,
                   Local<Object>& output) {
  pugi::xml_document doc;
  if (doc.load_string(xml.c_str())) {
    auto j = json::parse(fmt);

    for (json::iterator it = j.begin(); it != j.end(); ++it) {
      string key = it.key();
      auto& node = j[key];
      walk(doc, node, output, key, args);
    }
  }
}