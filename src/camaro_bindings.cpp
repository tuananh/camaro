/**
 * camaro - Embind adapter
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#include "camaro.h"

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <cstddef>
#include <cstdint>
#include <string>

using emscripten::val;

struct PrettyPrintOpts
{
	int indent_size;
};

static camaro_context* getContext()
{
	static camaro_context* context = 0;
	if (!context)
		camaro_context_create(0, &context);
	return context;
}

static camaro_bytes makeBytes(const char* data, size_t size)
{
	camaro_bytes result;
	result.data = reinterpret_cast<const unsigned char*>(data);
	result.size = size;
	return result;
}

static std::string& resultString()
{
	static std::string value;
	return value;
}

static std::string& takeString(camaro_context* context, camaro_owned_bytes& bytes)
{
	std::string& result = resultString();
	if (bytes.size)
		result.assign(reinterpret_cast<const char*>(bytes.data), bytes.size);
	else
		result.clear();
	camaro_owned_bytes_recycle(context, &bytes);
	return result;
}

static val makeTransformValue(camaro_status status, camaro_transform_result& result)
{
	if (status != CAMARO_STATUS_OK)
	{
		camaro_owned_bytes_recycle(getContext(), &result.json);
		return val::object();
	}

	std::string& json = takeString(getContext(), result.json);
	if (!result.has_nan)
		return val(json);

	val value = val::object();
	value.set("json", json);
	value.set("hasNan", true);
	return value;
}

static val transform(std::string xml, std::string json_template)
{
	camaro_transform_result result = {};
	camaro_status status = camaro_transform(getContext(), makeBytes(xml.data(), xml.size()), makeBytes(json_template.data(), json_template.size()), &result);
	return makeTransformValue(status, result);
}

static val transformFromUtf8(std::uintptr_t xml_ptr, size_t xml_size, std::string json_template)
{
	camaro_transform_result result = {};
	camaro_status status = camaro_transform_in_place(getContext(), reinterpret_cast<unsigned char*>(xml_ptr), xml_size, makeBytes(json_template.data(), json_template.size()), &result);
	return makeTransformValue(status, result);
}

static unsigned int registerTemplate(std::string json_template)
{
	unsigned int id = 0;
	if (camaro_register_template(getContext(), makeBytes(json_template.data(), json_template.size()), &id) != CAMARO_STATUS_OK)
		return 0;
	return id;
}

static val transformFromUtf8WithTemplateId(std::uintptr_t xml_ptr, size_t xml_size, unsigned int template_id)
{
	camaro_transform_result result = {};
	camaro_status status = camaro_transform_in_place_with_template_id(getContext(), reinterpret_cast<unsigned char*>(xml_ptr), xml_size, template_id, &result);
	return makeTransformValue(status, result);
}

static val profileTransformFromUtf8WithTemplateId(std::uintptr_t xml_ptr, size_t xml_size, unsigned int template_id)
{
	camaro_profile_result result = {};
	camaro_status status = camaro_profile_transform_in_place_with_template_id(getContext(), reinterpret_cast<unsigned char*>(xml_ptr), xml_size, template_id, &result);

	val profile = val::object();
	profile.set("result", makeTransformValue(status, result.result));
	profile.set("parseMs", result.parse_ms);
	profile.set("extractMs", result.extract_ms);
	return profile;
}

static double profileParseFromUtf8(std::uintptr_t xml_ptr, size_t xml_size)
{
	double elapsed = 0;
	camaro_profile_parse_in_place(getContext(), reinterpret_cast<unsigned char*>(xml_ptr), xml_size, &elapsed);
	return elapsed;
}

static val toJson(std::string xml)
{
	camaro_owned_bytes output = {};
	camaro_status status = camaro_to_json(getContext(), makeBytes(xml.data(), xml.size()), &output);
	if (status != CAMARO_STATUS_OK)
	{
		camaro_owned_bytes_recycle(getContext(), &output);
		return val::object();
	}
	return val(takeString(getContext(), output));
}

static val toJsonFromUtf8(std::uintptr_t xml_ptr, size_t xml_size)
{
	camaro_owned_bytes output = {};
	camaro_status status = camaro_to_json(getContext(), makeBytes(reinterpret_cast<const char*>(xml_ptr), xml_size), &output);
	if (status != CAMARO_STATUS_OK)
	{
		camaro_owned_bytes_recycle(getContext(), &output);
		return val::object();
	}
	return val(takeString(getContext(), output));
}

static std::string prettyPrint(std::string xml, PrettyPrintOpts options)
{
	camaro_owned_bytes output = {};
	camaro_pretty_print(getContext(), makeBytes(xml.data(), xml.size()), options.indent_size, &output);
	return takeString(getContext(), output);
}

static std::string prettyPrintFromUtf8(std::uintptr_t xml_ptr, size_t xml_size, PrettyPrintOpts options)
{
	camaro_owned_bytes output = {};
	camaro_pretty_print(getContext(), makeBytes(reinterpret_cast<const char*>(xml_ptr), xml_size), options.indent_size, &output);
	return takeString(getContext(), output);
}

EMSCRIPTEN_BINDINGS(my_module)
{
	emscripten::value_object<PrettyPrintOpts>("PrettyPrintOpts")
	    .field("indentSize", &PrettyPrintOpts::indent_size);

	emscripten::function("transform", &transform);
	emscripten::function("transformFromUtf8", &transformFromUtf8);
	emscripten::function("registerTemplate", &registerTemplate);
	emscripten::function("transformFromUtf8WithTemplateId", &transformFromUtf8WithTemplateId);
	emscripten::function("profileTransformFromUtf8WithTemplateId", &profileTransformFromUtf8WithTemplateId);
	emscripten::function("profileParseFromUtf8", &profileParseFromUtf8);
	emscripten::function("toJson", &toJson);
	emscripten::function("toJsonFromUtf8", &toJsonFromUtf8);
	emscripten::function("prettyPrint", &prettyPrint);
	emscripten::function("prettyPrintFromUtf8", &prettyPrintFromUtf8);
}
