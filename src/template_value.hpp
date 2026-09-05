/**
 * camaro - compact transform template representation
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#ifndef CAMARO_TEMPLATE_VALUE_HPP
#define CAMARO_TEMPLATE_VALUE_HPP

#include "camaro.h"

#include <stddef.h>

struct CamaroArenaBlock
{
	CamaroArenaBlock* next;
	size_t used;
	size_t capacity;
};

struct CamaroArena
{
	camaro_allocator allocator;
	CamaroArenaBlock* blocks;

	void init(const camaro_allocator& value);
	void destroy();
	void* allocate(size_t size);
	char* copy(const char* data, size_t size);
};

struct StringView
{
	const char* data;
	size_t size;

	bool empty() const;
	bool equals(const char* value) const;
	bool startsWith(const char* value) const;
};

struct TemplateValue;

struct TemplateMember
{
	StringView key;
	TemplateValue* value;
	TemplateMember* next;
};

struct TemplateItem
{
	TemplateValue* value;
	TemplateItem* next;
};

struct PathSegment
{
	size_t start;
	size_t length;
	const char* name;
	PathSegment* next;
};

struct TemplateValue
{
	enum Kind
	{
		kObject,
		kArray,
		kString
	};

	enum ReturnType
	{
		kReturnString,
		kReturnNumber,
		kReturnBoolean
	};

	Kind kind;
	StringView string;
	TemplateMember* members;
	TemplateMember* members_tail;
	TemplateItem* items;
	TemplateItem* items_tail;
	size_t item_count;
	ReturnType return_type;
	bool simple_nav_path;
	bool path_absolute;
	PathSegment* path_segments;
	PathSegment* path_segments_tail;
	bool path_has_attribute;
	PathSegment attribute_segment;
	bool simple_descendant_name;
	StringView descendant_name;
	bool fast_number;
	StringView number_path;
	bool number_path_absolute;
	bool fast_boolean;
	StringView boolean_left;
	StringView boolean_right;
};

camaro_status parseTemplate(CamaroArena& arena, camaro_bytes input, TemplateValue*& value);

#endif
