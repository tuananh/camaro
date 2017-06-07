#include <string>
#include <iostream>
#include "pugixml/src/pugixml.hpp"
#include "pugixml/src/pugixml.cpp"
#include "json/src/json.hpp"

using json = nlohmann::json;
using string = std::string;
using xquery = pugi::xpath_query;
using nodeset = pugi::xpath_node_set;

template<typename T>
void walk(T& doc, json& n, json& output, string key);

bool string_contains(string to_check, string prefix) {
    return std::mismatch(prefix.begin(), prefix.end(), to_check.begin()).first == prefix.end();
}

string get_return_type(string& path) {
    if (string_contains(path, "count(") ||
        string_contains(path, "sum(") ||
        string_contains(path, "number(") ||
        string_contains(path, "ceiling(") ||
        string_contains(path, "floor(") ||
        string_contains(path, "round(")
    ) return "number";
    return "string";
}

template<typename T>
string seek_single_string(T& xnode, json& j) {
    string path = j;
    try {
        if (path.empty()) {
            return "";
        } else if (path.find("#") != std::string::npos) {
            return path.substr(1, path.size());
        } else {
            xquery query(path.c_str());
            return query.evaluate_string(xnode);
        }
    } catch (...) {
        return "";
    }
}

template<typename T>
double seek_single_number(T& xnode, json& j) {
    string path = j;
    xquery query(path.c_str());
    return query.evaluate_number(xnode);
}

template<typename T>
json seek_array(T& doc, json& node) {
    try {
        string base_path = node[0];
        xquery q(base_path.c_str());
        pugi::xpath_node_set nodes = q.evaluate_node_set(doc);
        json tmp = json::array();

        for (size_t i = 0; i < nodes.size(); ++i) {
            pugi::xpath_node n = nodes[i];
            auto inner = node[1];

            if (inner.is_object()) {
                json obj = json({});
                for (json::iterator it = inner.begin(); it != inner.end(); ++it) {
                    walk(n, it.value(), obj, it.key());
                }

                tmp.push_back(obj);
            } else if (inner.is_string()) {
                string path = inner;
                string type = get_return_type(path);
                if (type == "number") {
                    try {
                        tmp.push_back(seek_single_number(n, inner));
                    } catch(...) {
                        tmp.push_back(NULL);
                    }
                }
                if (type == "string") {
                    tmp.push_back(seek_single_string(n, inner));
                }
            }
        }

        return tmp;
    } catch (...) {
        return json::array();
    }
}

template<typename T>
json seek_object(T& doc, json& node) {
    auto output = json({});
    for (json::iterator it = node.begin(); it != node.end(); ++it) {
        string key = it.key();
        walk(doc, *it, output, key);
    }
    return output;
}

template<typename T>
void walk(T& doc, json& n, json& output, string key) {
    if (n.is_array() ) {
        output[key] = seek_array(doc, n);
    } else if (n.is_object()) {
        output[key] = seek_object(doc, n);
    } else if (n.is_string()) {
        string path = n;
        string type = get_return_type(path);
        if (type == "number") {
            try {
                output[key] = seek_single_number(doc, n);
            } catch(...) {
                output[key] = NULL;
            }
        }
        if (type == "string") {
            output[key] = seek_single_string(doc, n);
        }
    }
}

string transform(string xml, string fmt) {
    pugi::xml_document doc;
    if (!doc.load_string(xml.c_str())) {
        return "";
    }

    auto j = json::parse(fmt);
    json result;

    for (json::iterator it = j.begin(); it != j.end(); ++it) {
        string key = it.key();
        auto& node = j[key];
        walk(doc, node, result, key);
    }

    return result.dump();
}