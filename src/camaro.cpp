/**
 * camaro - C++98 native transformation core
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#include "camaro.h"

#include "json_writer.hpp"
#include "template_value.hpp"

#include "pugixml.hpp"

#include <math.h>
#include <new>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const unsigned int kParseOptions = pugi::parse_cdata | pugi::parse_escapes;

struct XPathEntry
{
	XPathEntry* next;
	char* expression;
	size_t expression_size;
	pugi::xpath_query query;

	XPathEntry()
	    : next(0)
	    , expression(0)
	    , expression_size(0)
	{
	}
};

struct TemplateEntry
{
	TemplateEntry* next;
	unsigned int id;
	char* source;
	size_t source_size;
	CamaroArena arena;
	TemplateValue* value;
	XPathEntry* xpath;
};

struct camaro_context
{
	camaro_allocator allocator;
	TemplateEntry* templates;
	TemplateEntry* templates_tail;
	TemplateEntry** templates_by_id;
	unsigned int template_count;
	unsigned int templates_capacity;
	camaro_owned_bytes json_scratch;
	char* xpath_scratch;
	size_t xpath_scratch_capacity;
	pugi::xml_document inplace_document;
};

namespace
{

static void* defaultAllocate(void*, size_t size)
{
	return malloc(size);
}

static void* defaultReallocate(void*, void* pointer, size_t size)
{
	return realloc(pointer, size);
}

static void defaultFree(void*, void* pointer)
{
	free(pointer);
}

static camaro_allocator defaultAllocator()
{
	camaro_allocator result;
	result.allocate = defaultAllocate;
	result.reallocate = defaultReallocate;
	result.free = defaultFree;
	result.user_data = 0;
	return result;
}

static bool validBytes(camaro_bytes value)
{
	return value.data || value.size == 0;
}

static camaro_status parseStatus(const pugi::xml_parse_result& result)
{
	if (result)
		return CAMARO_STATUS_OK;
	if (result.status == pugi::status_out_of_memory)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	if (result.status == pugi::status_internal_error)
		return CAMARO_STATUS_INTERNAL_ERROR;
	return CAMARO_STATUS_INVALID_XML;
}

static void initializeOwnedBytes(camaro_owned_bytes& value, const camaro_allocator& allocator)
{
	value.data = 0;
	value.size = 0;
	value.capacity = 0;
	value.allocator = allocator;
}

static bool equalBytes(const char* left, size_t left_size, const unsigned char* right, size_t right_size)
{
	return left_size == right_size && (left_size == 0 || memcmp(left, right, left_size) == 0);
}

static TemplateEntry* findTemplate(camaro_context& context, camaro_bytes source)
{
	for (TemplateEntry* entry = context.templates; entry; entry = entry->next)
		if (equalBytes(entry->source, entry->source_size, source.data, source.size))
			return entry;

	return 0;
}

static TemplateEntry* findTemplate(camaro_context& context, unsigned int id)
{
	if (id == 0 || id > context.template_count)
		return 0;
	return context.templates_by_id[id - 1];
}

static double cachedNan()
{
	static double value = strtod("nan", 0);
	return value;
}

static void destroyXPathEntries(camaro_context& context, XPathEntry* entry)
{
	while (entry)
	{
		XPathEntry* next = entry->next;
		char* expression = entry->expression;
		entry->~XPathEntry();
		if (expression)
			context.allocator.free(context.allocator.user_data, expression);
		context.allocator.free(context.allocator.user_data, entry);
		entry = next;
	}
}

static void destroyTemplateEntry(camaro_context& context, TemplateEntry* entry)
{
	if (!entry)
		return;

	destroyXPathEntries(context, entry->xpath);
	entry->arena.destroy();
	if (entry->source)
		context.allocator.free(context.allocator.user_data, entry->source);
	context.allocator.free(context.allocator.user_data, entry);
}

static camaro_status createTemplate(camaro_context& context, camaro_bytes source, TemplateEntry*& result)
{
	result = 0;
	TemplateEntry* entry = static_cast<TemplateEntry*>(context.allocator.allocate(context.allocator.user_data, sizeof(TemplateEntry)));
	if (!entry)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	memset(entry, 0, sizeof(*entry));
	entry->arena.init(context.allocator);

	entry->source = static_cast<char*>(context.allocator.allocate(context.allocator.user_data, source.size + 1));
	if (!entry->source)
	{
		destroyTemplateEntry(context, entry);
		return CAMARO_STATUS_OUT_OF_MEMORY;
	}
	if (source.size)
		memcpy(entry->source, source.data, source.size);
	entry->source[source.size] = '\0';
	entry->source_size = source.size;

	camaro_status status = parseTemplate(entry->arena, source, entry->value);
	if (status != CAMARO_STATUS_OK)
	{
		destroyTemplateEntry(context, entry);
		return status;
	}

	entry->id = ++context.template_count;
	if (context.template_count > context.templates_capacity)
	{
		unsigned int capacity = context.templates_capacity ? context.templates_capacity * 2 : 8;
		while (capacity < context.template_count)
			capacity *= 2;
		void* memory = context.allocator.reallocate(context.allocator.user_data, context.templates_by_id, sizeof(TemplateEntry*) * capacity);
		if (!memory)
		{
			--context.template_count;
			destroyTemplateEntry(context, entry);
			return CAMARO_STATUS_OUT_OF_MEMORY;
		}
		context.templates_by_id = static_cast<TemplateEntry**>(memory);
		context.templates_capacity = capacity;
	}
	context.templates_by_id[entry->id - 1] = entry;
	if (context.templates_tail)
		context.templates_tail->next = entry;
	else
		context.templates = entry;
	context.templates_tail = entry;
	result = entry;
	return CAMARO_STATUS_OK;
}

static camaro_status getTemplate(camaro_context& context, camaro_bytes source, TemplateEntry*& result)
{
	result = findTemplate(context, source);
	if (result)
		return CAMARO_STATUS_OK;
	return createTemplate(context, source, result);
}

static camaro_status getQuery(camaro_context& context, TemplateEntry& transform_template, StringView expression, pugi::xpath_query*& result)
{
	for (XPathEntry* entry = transform_template.xpath; entry; entry = entry->next)
	{
		if (entry->expression_size == expression.size && memcmp(entry->expression, expression.data, expression.size) == 0)
		{
			result = &entry->query;
			return CAMARO_STATUS_OK;
		}
	}

	void* memory = context.allocator.allocate(context.allocator.user_data, sizeof(XPathEntry));
	if (!memory)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	XPathEntry* entry = new (memory) XPathEntry();
	entry->expression = static_cast<char*>(context.allocator.allocate(context.allocator.user_data, expression.size + 1));
	if (!entry->expression)
	{
		entry->~XPathEntry();
		context.allocator.free(context.allocator.user_data, entry);
		return CAMARO_STATUS_OUT_OF_MEMORY;
	}
	memcpy(entry->expression, expression.data, expression.size);
	entry->expression[expression.size] = '\0';
	entry->expression_size = expression.size;
	entry->query.~xpath_query();
	new (&entry->query) pugi::xpath_query(entry->expression);
	entry->next = transform_template.xpath;
	transform_template.xpath = entry;
	result = &entry->query;
	return CAMARO_STATUS_OK;
}

static pugi::xml_node contextNode(const pugi::xpath_node& node)
{
	return node.node();
}

static pugi::xml_node followSimplePath(pugi::xml_node context, const TemplateValue& value)
{
	for (PathSegment* segment = value.path_segments; context && segment; segment = segment->next)
		context = context.child(segment->name);
	return context;
}

static double followNumberPath(pugi::xml_node context, const TemplateValue& value)
{
	pugi::xml_node target = followSimplePath(context, value);
	if (value.path_has_attribute)
	{
		pugi::xml_attribute attribute = target.attribute(value.attribute_segment.name);
		return attribute ? attribute.as_double() : cachedNan();
	}
	return target ? target.text().as_double() : cachedNan();
}

static bool fastBoolean(pugi::xml_node context, const TemplateValue& value)
{
	pugi::xml_node child = context.child(value.boolean_left.data);
	return child && strcmp(child.child_value(), value.boolean_right.data) == 0;
}

static camaro_status writeXPathString(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, JsonWriter& writer)
{
	if (value.string.size && value.string.data[0] == '#')
	{
		writer.writeString(value.string.data + 1, value.string.size - 1);
		return writer.status();
	}
	if (value.simple_nav_path)
	{
		pugi::xml_node target = followSimplePath(contextNode(node), value);
		if (!target)
		{
			writer.writeEmptyString();
			return writer.status();
		}
		if (value.path_has_attribute)
		{
			pugi::xml_attribute result = target.attribute(value.attribute_segment.name);
			if (!result)
				writer.writeEmptyString();
			else
				writer.writeString(result.value());
		}
		else
			writer.writeString(target.child_value());
		return writer.status();
	}

	pugi::xpath_query* query = 0;
	camaro_status status = getQuery(context, transform_template, value.string, query);
	if (status != CAMARO_STATUS_OK)
		return status;
	size_t required = query->evaluate_string(0, 0, node);
	if (required <= 1)
	{
		writer.writeEmptyString();
		return writer.status();
	}
	if (required > context.xpath_scratch_capacity)
	{
		char* buffer = static_cast<char*>(context.allocator.reallocate(context.allocator.user_data, context.xpath_scratch, required));
		if (!buffer)
			return CAMARO_STATUS_OUT_OF_MEMORY;
		context.xpath_scratch = buffer;
		context.xpath_scratch_capacity = required;
	}
	query->evaluate_string(context.xpath_scratch, required, node);
	writer.writeString(context.xpath_scratch, required - 1);
	return writer.status();
}

static camaro_status queryNumber(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, double& result)
{
	if (value.fast_number)
	{
		result = followNumberPath(contextNode(node), value);
		return CAMARO_STATUS_OK;
	}
	pugi::xpath_query* query = 0;
	camaro_status status = getQuery(context, transform_template, value.string, query);
	if (status == CAMARO_STATUS_OK)
		result = query->evaluate_number(node);
	return status;
}

static camaro_status queryBoolean(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, bool& result)
{
	if (value.fast_boolean)
	{
		result = fastBoolean(contextNode(node), value);
		return CAMARO_STATUS_OK;
	}
	pugi::xpath_query* query = 0;
	camaro_status status = getQuery(context, transform_template, value.string, query);
	if (status == CAMARO_STATUS_OK)
		result = query->evaluate_boolean(node);
	return status;
}

static camaro_status writeValue(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, JsonWriter& writer, bool& has_nan);

static camaro_status writeArrayItem(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& inner, JsonWriter& writer, bool& has_nan)
{
	if (inner.kind == TemplateValue::kObject)
	{
		writer.beginObject();
		for (TemplateMember* member = inner.members; member; member = member->next)
		{
			writer.writeKey(member->key);
			camaro_status status = writeValue(context, transform_template, node, *member->value, writer, has_nan);
			if (status != CAMARO_STATUS_OK)
				return status;
		}
		writer.endObject();
		return writer.status();
	}
	if (inner.kind == TemplateValue::kString)
		return writeValue(context, transform_template, node, inner, writer, has_nan);
	return CAMARO_STATUS_OK;
}

static camaro_status visitSimplePath(camaro_context& context, TemplateEntry& transform_template, pugi::xml_node node, const TemplateValue& path, PathSegment* segment, const TemplateValue& inner, JsonWriter& writer, bool& has_nan)
{
	if (!segment)
		return writeArrayItem(context, transform_template, pugi::xpath_node(node), inner, writer, has_nan);

	for (pugi::xml_node child = node.child(segment->name); child; child = child.next_sibling(segment->name))
	{
		camaro_status status = visitSimplePath(context, transform_template, child, path, segment->next, inner, writer, has_nan);
		if (status != CAMARO_STATUS_OK)
			return status;
	}
	return CAMARO_STATUS_OK;
}

static camaro_status visitDescendants(camaro_context& context, TemplateEntry& transform_template, pugi::xml_node root, const TemplateValue& path, const TemplateValue& inner, JsonWriter& writer, bool& has_nan)
{
	for (pugi::xml_node node = root; node;)
	{
		if (node.type() == pugi::node_element && strcmp(node.name(), path.descendant_name.data) == 0)
		{
			camaro_status status = writeArrayItem(context, transform_template, pugi::xpath_node(node), inner, writer, has_nan);
			if (status != CAMARO_STATUS_OK)
				return status;
		}
		pugi::xml_node child = node.first_child();
		if (child)
		{
			node = child;
			continue;
		}
		while (node && node != root && !node.next_sibling())
			node = node.parent();
		if (node == root)
			break;
		node = node.next_sibling();
	}
	return CAMARO_STATUS_OK;
}

static camaro_status writeArray(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, JsonWriter& writer, bool& has_nan)
{
	writer.beginArray();
	if (!value.items)
	{
		writer.endArray();
		return writer.status();
	}
	if (value.item_count < 2)
		return CAMARO_STATUS_INVALID_TEMPLATE;

	const TemplateValue& path = *value.items->value;
	const TemplateValue& inner = *value.items->next->value;
	if (path.kind != TemplateValue::kString)
		return CAMARO_STATUS_INVALID_TEMPLATE;

	camaro_status status = CAMARO_STATUS_OK;
	if (path.simple_nav_path && !path.path_has_attribute)
		status = visitSimplePath(context, transform_template, contextNode(node), path, path.path_segments, inner, writer, has_nan);
	else if (path.simple_descendant_name)
		status = visitDescendants(context, transform_template, contextNode(node), path, inner, writer, has_nan);
	else
	{
		pugi::xpath_query* query = 0;
		status = getQuery(context, transform_template, path.string, query);
		if (status == CAMARO_STATUS_OK)
		{
			pugi::xpath_node_set nodes = query->evaluate_node_set(node);
			for (size_t i = 0; i < nodes.size() && status == CAMARO_STATUS_OK; ++i)
				status = writeArrayItem(context, transform_template, nodes[i], inner, writer, has_nan);
		}
	}
	if (status != CAMARO_STATUS_OK)
		return status;
	writer.endArray();
	return writer.status();
}

static camaro_status writeValue(camaro_context& context, TemplateEntry& transform_template, const pugi::xpath_node& node, const TemplateValue& value, JsonWriter& writer, bool& has_nan)
{
	if (value.kind == TemplateValue::kArray)
		return writeArray(context, transform_template, node, value, writer, has_nan);
	if (value.kind == TemplateValue::kObject)
	{
		writer.beginObject();
		for (TemplateMember* member = value.members; member; member = member->next)
		{
			writer.writeKey(member->key);
			camaro_status status = writeValue(context, transform_template, node, *member->value, writer, has_nan);
			if (status != CAMARO_STATUS_OK)
				return status;
		}
		writer.endObject();
		return writer.status();
	}

	if (value.string.empty())
	{
		writer.writeEmptyString();
		return writer.status();
	}
	if (value.return_type == TemplateValue::kReturnString)
		return writeXPathString(context, transform_template, node, value, writer);
	if (value.return_type == TemplateValue::kReturnNumber)
	{
		double number = 0;
		camaro_status status = queryNumber(context, transform_template, node, value, number);
		if (status == CAMARO_STATUS_OK)
			writer.writeNumber(number, has_nan);
		return status == CAMARO_STATUS_OK ? writer.status() : status;
	}

	bool boolean = false;
	camaro_status status = queryBoolean(context, transform_template, node, value, boolean);
	if (status == CAMARO_STATUS_OK)
		writer.writeBool(boolean);
	return status == CAMARO_STATUS_OK ? writer.status() : status;
}

static camaro_status transformDocument(camaro_context& context, pugi::xml_document& document, TemplateEntry& transform_template, camaro_transform_result& result)
{
	JsonWriter writer(context.allocator, context.json_scratch);
	writer.reserve(2048);
	bool has_nan = false;
	camaro_status status;
	pugi::xpath_node root(document);

	if (transform_template.value->kind == TemplateValue::kArray)
		status = writeArray(context, transform_template, root, *transform_template.value, writer, has_nan);
	else
	{
		writer.beginObject();
		status = CAMARO_STATUS_OK;
		for (TemplateMember* member = transform_template.value->members; member && status == CAMARO_STATUS_OK; member = member->next)
		{
			writer.writeKey(member->key);
			status = writeValue(context, transform_template, root, *member->value, writer, has_nan);
		}
		writer.endObject();
	}

	if (status == CAMARO_STATUS_OK)
		status = writer.status();
	if (status != CAMARO_STATUS_OK)
		return status;

	writer.release(result.json);
	result.has_nan = has_nan ? 1 : 0;
	return CAMARO_STATUS_OK;
}

static camaro_status transformCopy(camaro_context& context, camaro_bytes xml, TemplateEntry& transform_template, camaro_transform_result& result)
{
	pugi::xml_document document;
	pugi::xml_parse_result parsed = document.load_buffer(xml.data, xml.size, kParseOptions, pugi::encoding_utf8);
	if (!parsed)
		return parseStatus(parsed);
	return transformDocument(context, document, transform_template, result);
}

static camaro_status transformInPlace(camaro_context& context, unsigned char* xml, size_t xml_size, TemplateEntry& transform_template, camaro_transform_result& result)
{
	pugi::xml_parse_result parsed = context.inplace_document.load_buffer_inplace(xml, xml_size + 1, kParseOptions, pugi::encoding_utf8);
	if (!parsed)
		return parseStatus(parsed);
	return transformDocument(context, context.inplace_document, transform_template, result);
}

static bool sameName(pugi::xml_node left, pugi::xml_node right)
{
	return strcmp(left.name(), right.name()) == 0;
}

static bool hasEarlierNamedSibling(pugi::xml_node node)
{
	for (pugi::xml_node previous = node.previous_sibling(); previous; previous = previous.previous_sibling())
		if (previous.type() == pugi::node_element && sameName(previous, node))
			return true;
	return false;
}

static size_t namedSiblingCount(pugi::xml_node node)
{
	size_t count = 0;
	for (pugi::xml_node child = node.parent().first_child(); child; child = child.next_sibling())
		if (child.type() == pugi::node_element && sameName(child, node))
			++count;
	return count;
}

static void trimText(const char*& data, size_t& size)
{
	while (size && (*data == ' ' || *data == '\t' || *data == '\n' || *data == '\r'))
	{
		++data;
		--size;
	}
	while (size && (data[size - 1] == ' ' || data[size - 1] == '\t' || data[size - 1] == '\n' || data[size - 1] == '\r'))
		--size;
}

static camaro_status collectElementText(camaro_context& context, pugi::xml_node node, char*& text, size_t& text_size)
{
	text = 0;
	text_size = 0;
	for (pugi::xml_node child = node.first_child(); child; child = child.next_sibling())
	{
		if (child.type() != pugi::node_pcdata && child.type() != pugi::node_cdata)
			continue;
		const char* value = child.value();
		size_t size = strlen(value);
		trimText(value, size);
		text_size += size;
	}
	if (!text_size)
		return CAMARO_STATUS_OK;

	text = static_cast<char*>(context.allocator.allocate(context.allocator.user_data, text_size));
	if (!text)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	size_t offset = 0;
	for (pugi::xml_node child = node.first_child(); child; child = child.next_sibling())
	{
		if (child.type() != pugi::node_pcdata && child.type() != pugi::node_cdata)
			continue;
		const char* value = child.value();
		size_t size = strlen(value);
		trimText(value, size);
		if (size)
		{
			memcpy(text + offset, value, size);
			offset += size;
		}
	}
	return CAMARO_STATUS_OK;
}

static camaro_status writeXmlElement(camaro_context& context, pugi::xml_node node, JsonWriter& writer);

static camaro_status writeXmlChildren(camaro_context& context, pugi::xml_node parent, JsonWriter& writer)
{
	for (pugi::xml_node child = parent.first_child(); child; child = child.next_sibling())
	{
		if (child.type() != pugi::node_element || hasEarlierNamedSibling(child))
			continue;
		writer.writeKey(child.name());
		size_t count = namedSiblingCount(child);
		if (count == 1)
		{
			camaro_status status = writeXmlElement(context, child, writer);
			if (status != CAMARO_STATUS_OK)
				return status;
		}
		else
		{
			writer.beginArray();
			for (pugi::xml_node item = child; item; item = item.next_sibling(child.name()))
			{
				camaro_status status = writeXmlElement(context, item, writer);
				if (status != CAMARO_STATUS_OK)
					return status;
			}
			writer.endArray();
		}
	}
	return writer.status();
}

static camaro_status writeXmlElement(camaro_context& context, pugi::xml_node node, JsonWriter& writer)
{
	bool has_attributes = node.first_attribute();
	bool has_children = node.first_child() && node.first_child().type() == pugi::node_element;
	if (!has_children)
		for (pugi::xml_node child = node.first_child(); child; child = child.next_sibling())
			if (child.type() == pugi::node_element)
				has_children = true;

	char* text = 0;
	size_t text_size = 0;
	camaro_status status = collectElementText(context, node, text, text_size);
	if (status != CAMARO_STATUS_OK)
		return status;

	if (!has_attributes && !has_children && text_size)
		writer.writeString(text, text_size);
	else
	{
		writer.beginObject();
		if (has_attributes)
		{
			writer.writeKey("$");
			writer.beginObject();
			for (pugi::xml_attribute attribute = node.first_attribute(); attribute; attribute = attribute.next_attribute())
			{
				writer.writeKey(attribute.name());
				writer.writeString(attribute.value());
			}
			writer.endObject();
		}
		status = writeXmlChildren(context, node, writer);
		if (status == CAMARO_STATUS_OK && text_size)
		{
			writer.writeKey("_text");
			writer.writeString(text, text_size);
		}
		writer.endObject();
	}

	if (text)
		context.allocator.free(context.allocator.user_data, text);
	return status == CAMARO_STATUS_OK ? writer.status() : status;
}

class XmlBufferWriter : public pugi::xml_writer
{
public:
	explicit XmlBufferWriter(JsonWriter& writer)
	    : writer_(writer)
	{
	}

	virtual void write(const void* data, size_t size)
	{
		writer_.append(static_cast<const char*>(data), size);
	}

private:
	JsonWriter& writer_;
};

static double nowMilliseconds()
{
	return static_cast<double>(clock()) * 1000.0 / static_cast<double>(CLOCKS_PER_SEC);
}

} // namespace

extern "C"
{

camaro_status camaro_context_create(const camaro_allocator* allocator, camaro_context** context)
{
	if (!context)
		return CAMARO_STATUS_INVALID_ARGUMENT;
	*context = 0;

	camaro_allocator selected = allocator ? *allocator : defaultAllocator();
	if (!selected.allocate || !selected.reallocate || !selected.free)
		return CAMARO_STATUS_INVALID_ARGUMENT;

	void* memory = selected.allocate(selected.user_data, sizeof(camaro_context));
	if (!memory)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	camaro_context* result = new (memory) camaro_context();
	result->allocator = selected;
	result->templates = 0;
	result->templates_tail = 0;
	result->templates_by_id = 0;
	result->template_count = 0;
	result->templates_capacity = 0;
	initializeOwnedBytes(result->json_scratch, selected);
	result->xpath_scratch = 0;
	result->xpath_scratch_capacity = 0;
	*context = result;
	return CAMARO_STATUS_OK;
}

void camaro_context_destroy(camaro_context* context)
{
	if (!context)
		return;
	TemplateEntry* entry = context->templates;
	while (entry)
	{
		TemplateEntry* next = entry->next;
		destroyTemplateEntry(*context, entry);
		entry = next;
	}
	if (context->templates_by_id)
		context->allocator.free(context->allocator.user_data, context->templates_by_id);
	camaro_owned_bytes_release(&context->json_scratch);
	if (context->xpath_scratch)
		context->allocator.free(context->allocator.user_data, context->xpath_scratch);
	camaro_allocator allocator = context->allocator;
	context->~camaro_context();
	allocator.free(allocator.user_data, context);
}

camaro_status camaro_register_template(camaro_context* context, camaro_bytes json_template, unsigned int* template_id)
{
	if (!context || !template_id || !validBytes(json_template))
		return CAMARO_STATUS_INVALID_ARGUMENT;
	TemplateEntry* entry = 0;
	camaro_status status = getTemplate(*context, json_template, entry);
	if (status == CAMARO_STATUS_OK)
		*template_id = entry->id;
	return status;
}

camaro_status camaro_transform(camaro_context* context, camaro_bytes xml, camaro_bytes json_template, camaro_transform_result* result)
{
	if (!context || !result || !validBytes(xml) || !validBytes(json_template))
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(result->json, context->allocator);
	result->has_nan = 0;
	TemplateEntry* entry = 0;
	camaro_status status = getTemplate(*context, json_template, entry);
	return status == CAMARO_STATUS_OK ? transformCopy(*context, xml, *entry, *result) : status;
}

camaro_status camaro_transform_with_template_id(camaro_context* context, camaro_bytes xml, unsigned int template_id, camaro_transform_result* result)
{
	if (!context || !result || !validBytes(xml))
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(result->json, context->allocator);
	result->has_nan = 0;
	TemplateEntry* entry = findTemplate(*context, template_id);
	return entry ? transformCopy(*context, xml, *entry, *result) : CAMARO_STATUS_UNKNOWN_TEMPLATE;
}

camaro_status camaro_transform_in_place(camaro_context* context, unsigned char* xml, size_t xml_size, camaro_bytes json_template, camaro_transform_result* result)
{
	if (!context || !result || !xml || !validBytes(json_template))
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(result->json, context->allocator);
	result->has_nan = 0;
	TemplateEntry* entry = 0;
	camaro_status status = getTemplate(*context, json_template, entry);
	return status == CAMARO_STATUS_OK ? transformInPlace(*context, xml, xml_size, *entry, *result) : status;
}

camaro_status camaro_transform_in_place_with_template_id(camaro_context* context, unsigned char* xml, size_t xml_size, unsigned int template_id, camaro_transform_result* result)
{
	if (!context || !result || !xml)
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(result->json, context->allocator);
	result->has_nan = 0;
	TemplateEntry* entry = findTemplate(*context, template_id);
	return entry ? transformInPlace(*context, xml, xml_size, *entry, *result) : CAMARO_STATUS_UNKNOWN_TEMPLATE;
}

camaro_status camaro_profile_transform_in_place_with_template_id(camaro_context* context, unsigned char* xml, size_t xml_size, unsigned int template_id, camaro_profile_result* result)
{
	if (!context || !result || !xml)
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(result->result.json, context->allocator);
	result->result.has_nan = 0;
	TemplateEntry* entry = findTemplate(*context, template_id);
	if (!entry)
		return CAMARO_STATUS_UNKNOWN_TEMPLATE;

	double started = nowMilliseconds();
	pugi::xml_parse_result parsed = context->inplace_document.load_buffer_inplace(xml, xml_size + 1, kParseOptions, pugi::encoding_utf8);
	double parsed_at = nowMilliseconds();
	camaro_status status = parsed ? transformDocument(*context, context->inplace_document, *entry, result->result) : parseStatus(parsed);
	double finished = nowMilliseconds();
	result->parse_ms = parsed_at - started;
	result->extract_ms = finished - parsed_at;
	return status;
}

camaro_status camaro_profile_parse_in_place(camaro_context* context, unsigned char* xml, size_t xml_size, double* parse_ms)
{
	if (!context || !xml || !parse_ms)
		return CAMARO_STATUS_INVALID_ARGUMENT;
	double started = nowMilliseconds();
	pugi::xml_parse_result parsed = context->inplace_document.load_buffer_inplace(xml, xml_size + 1, kParseOptions, pugi::encoding_utf8);
	*parse_ms = nowMilliseconds() - started;
	return parseStatus(parsed);
}

camaro_status camaro_to_json(camaro_context* context, camaro_bytes xml, camaro_owned_bytes* json)
{
	if (!context || !json || !validBytes(xml))
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(*json, context->allocator);
	pugi::xml_document document;
	pugi::xml_parse_result parsed = document.load_buffer(xml.data, xml.size, kParseOptions, pugi::encoding_utf8);
	if (!parsed)
		return parseStatus(parsed);

	JsonWriter writer(context->allocator, context->json_scratch);
	writer.reserve(32768);
	writer.beginObject();
	camaro_status status = writeXmlChildren(*context, document, writer);
	writer.endObject();
	if (status == CAMARO_STATUS_OK)
		status = writer.status();
	if (status == CAMARO_STATUS_OK)
		writer.release(*json);
	return status;
}

camaro_status camaro_pretty_print(camaro_context* context, camaro_bytes xml, int indent_size, camaro_owned_bytes* output)
{
	if (!context || !output || !validBytes(xml) || indent_size < 0)
		return CAMARO_STATUS_INVALID_ARGUMENT;
	initializeOwnedBytes(*output, context->allocator);
	pugi::xml_document document;
	pugi::xml_parse_result parsed = document.load_buffer(xml.data, xml.size, kParseOptions, pugi::encoding_utf8);
	if (!parsed)
		return parseStatus(parsed);

	JsonWriter writer(context->allocator);
	XmlBufferWriter xml_writer(writer);
	char* indent = static_cast<char*>(context->allocator.allocate(context->allocator.user_data, static_cast<size_t>(indent_size) + 1));
	if (!indent)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	memset(indent, ' ', static_cast<size_t>(indent_size));
	indent[indent_size] = '\0';
	document.print(xml_writer, indent, pugi::format_default, pugi::encoding_utf8);
	context->allocator.free(context->allocator.user_data, indent);
	camaro_status status = writer.status();
	if (status == CAMARO_STATUS_OK)
		writer.release(*output);
	return status;
}

void camaro_owned_bytes_release(camaro_owned_bytes* bytes)
{
	if (!bytes)
		return;
	if (bytes->data && bytes->allocator.free)
		bytes->allocator.free(bytes->allocator.user_data, bytes->data);
	bytes->data = 0;
	bytes->size = 0;
	bytes->capacity = 0;
}

void camaro_owned_bytes_recycle(camaro_context* context, camaro_owned_bytes* bytes)
{
	if (!bytes)
		return;
	if (!context)
	{
		camaro_owned_bytes_release(bytes);
		return;
	}
	if (bytes->capacity > context->json_scratch.capacity)
	{
		camaro_owned_bytes_release(&context->json_scratch);
		context->json_scratch = *bytes;
		context->json_scratch.size = 0;
		bytes->data = 0;
		bytes->size = 0;
		bytes->capacity = 0;
		return;
	}
	camaro_owned_bytes_release(bytes);
}

const char* camaro_status_string(camaro_status status)
{
	switch (status)
	{
	case CAMARO_STATUS_OK:
		return "ok";
	case CAMARO_STATUS_INVALID_ARGUMENT:
		return "invalid argument";
	case CAMARO_STATUS_OUT_OF_MEMORY:
		return "out of memory";
	case CAMARO_STATUS_INVALID_XML:
		return "invalid xml";
	case CAMARO_STATUS_INVALID_TEMPLATE:
		return "invalid template";
	case CAMARO_STATUS_INVALID_XPATH:
		return "invalid xpath";
	case CAMARO_STATUS_UNKNOWN_TEMPLATE:
		return "unknown transform template";
	default:
		return "internal error";
	}
}

} // extern "C"
