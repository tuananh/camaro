/**
 * camaro - transform template parser
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#include "template_value.hpp"

#include <ctype.h>
#include <string.h>

static const size_t kArenaBlockSize = 4096;

void CamaroArena::init(const camaro_allocator& value)
{
	allocator = value;
	blocks = 0;
}

void CamaroArena::destroy()
{
	CamaroArenaBlock* block = blocks;

	while (block)
	{
		CamaroArenaBlock* next = block->next;
		allocator.free(allocator.user_data, block);
		block = next;
	}

	blocks = 0;
}

void* CamaroArena::allocate(size_t size)
{
	size_t aligned = (size + sizeof(void*) - 1) & ~(sizeof(void*) - 1);
	CamaroArenaBlock* block = blocks;

	if (!block || block->capacity - block->used < aligned)
	{
		size_t capacity = aligned > kArenaBlockSize ? aligned : kArenaBlockSize;
		block = static_cast<CamaroArenaBlock*>(allocator.allocate(allocator.user_data, sizeof(CamaroArenaBlock) + capacity));
		if (!block)
			return 0;

		block->next = blocks;
		block->used = 0;
		block->capacity = capacity;
		blocks = block;
	}

	void* result = reinterpret_cast<unsigned char*>(block + 1) + block->used;
	block->used += aligned;
	return result;
}

char* CamaroArena::copy(const char* data, size_t size)
{
	char* result = static_cast<char*>(allocate(size + 1));
	if (!result)
		return 0;

	if (size)
		memcpy(result, data, size);
	result[size] = '\0';
	return result;
}

bool StringView::empty() const
{
	return size == 0;
}

bool StringView::equals(const char* value) const
{
	size_t length = strlen(value);
	return size == length && memcmp(data, value, size) == 0;
}

bool StringView::startsWith(const char* value) const
{
	size_t length = strlen(value);
	return size >= length && memcmp(data, value, length) == 0;
}

namespace
{

static bool isSimpleNavPath(StringView path)
{
	if (path.empty())
		return false;

	for (size_t i = 0; i < path.size; ++i)
	{
		unsigned char c = static_cast<unsigned char>(path.data[i]);
		if (isalnum(c) || c == '/' || c == '@' || c == '_' || c == '-')
			continue;
		return false;
	}

	for (size_t i = 1; i < path.size; ++i)
		if (path.data[i - 1] == '/' && path.data[i] == '/')
			return false;

	return true;
}

static size_t findCharacter(StringView value, char character, size_t start)
{
	for (size_t i = start; i < value.size; ++i)
		if (value.data[i] == character)
			return i;

	return value.size;
}

static StringView trim(StringView value)
{
	while (value.size && (value.data[0] == ' ' || value.data[0] == '\t'))
	{
		++value.data;
		--value.size;
	}

	while (value.size && (value.data[value.size - 1] == ' ' || value.data[value.size - 1] == '\t'))
		--value.size;

	return value;
}

static void initializeValue(TemplateValue& value)
{
	memset(&value, 0, sizeof(value));
	value.kind = TemplateValue::kString;
	value.return_type = TemplateValue::kReturnString;
}

class TemplateParser
{
public:
	TemplateParser(CamaroArena& arena, const char* begin, const char* end)
	    : arena_(arena)
	    , current_(begin)
	    , end_(end)
	    , status_(CAMARO_STATUS_OK)
	{
	}

	camaro_status parse(TemplateValue*& value)
	{
		value = parseValue();
		skipWhitespace();

		if (status_ == CAMARO_STATUS_OK && current_ != end_)
			status_ = CAMARO_STATUS_INVALID_TEMPLATE;

		return status_;
	}

private:
	void skipWhitespace()
	{
		while (current_ < end_ && isspace(static_cast<unsigned char>(*current_)))
			++current_;
	}

	char get()
	{
		if (current_ == end_)
		{
			status_ = CAMARO_STATUS_INVALID_TEMPLATE;
			return '\0';
		}

		return *current_++;
	}

	bool expect(char expected)
	{
		skipWhitespace();
		if (get() != expected)
		{
			status_ = CAMARO_STATUS_INVALID_TEMPLATE;
			return false;
		}
		return true;
	}

	void* allocate(size_t size)
	{
		void* result = arena_.allocate(size);
		if (!result)
			status_ = CAMARO_STATUS_OUT_OF_MEMORY;
		return result;
	}

	static int hexValue(char value)
	{
		if (value >= '0' && value <= '9')
			return value - '0';
		if (value >= 'a' && value <= 'f')
			return value - 'a' + 10;
		if (value >= 'A' && value <= 'F')
			return value - 'A' + 10;
		return -1;
	}

	StringView parseString()
	{
		StringView result = {0, 0};
		skipWhitespace();
		if (get() != '"')
			return result;

		const char* scan = current_;
		size_t capacity = static_cast<size_t>(end_ - current_);
		char* output = static_cast<char*>(allocate(capacity + 1));
		if (!output)
			return result;

		size_t size = 0;
		bool closed = false;
		while (scan < end_)
		{
			char c = *scan++;
			if (c == '"')
			{
				closed = true;
				break;
			}
			if (static_cast<unsigned char>(c) < 0x20)
			{
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				break;
			}
			if (c != '\\')
			{
				output[size++] = c;
				continue;
			}
			if (scan == end_)
			{
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				break;
			}

			c = *scan++;
			switch (c)
			{
			case '"':
			case '\\':
			case '/':
				output[size++] = c;
				break;
			case 'b':
				output[size++] = '\b';
				break;
			case 'f':
				output[size++] = '\f';
				break;
			case 'n':
				output[size++] = '\n';
				break;
			case 'r':
				output[size++] = '\r';
				break;
			case 't':
				output[size++] = '\t';
				break;
			case 'u':
			{
				if (end_ - scan < 4)
				{
					status_ = CAMARO_STATUS_INVALID_TEMPLATE;
					break;
				}
				int codepoint = 0;
				for (int i = 0; i < 4; ++i)
				{
					int digit = hexValue(*scan++);
					if (digit < 0)
					{
						status_ = CAMARO_STATUS_INVALID_TEMPLATE;
						break;
					}
					codepoint = (codepoint << 4) | digit;
				}
				if (status_ != CAMARO_STATUS_OK)
					break;
				if (codepoint <= 0x7f)
					output[size++] = static_cast<char>(codepoint);
				else if (codepoint <= 0x7ff)
				{
					output[size++] = static_cast<char>(0xc0 | (codepoint >> 6));
					output[size++] = static_cast<char>(0x80 | (codepoint & 0x3f));
				}
				else
				{
					output[size++] = static_cast<char>(0xe0 | (codepoint >> 12));
					output[size++] = static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f));
					output[size++] = static_cast<char>(0x80 | (codepoint & 0x3f));
				}
				break;
			}
			default:
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				break;
			}
			if (status_ != CAMARO_STATUS_OK)
				break;
		}

		if (!closed && status_ == CAMARO_STATUS_OK)
			status_ = CAMARO_STATUS_INVALID_TEMPLATE;

		current_ = scan;
		output[size] = '\0';
		result.data = output;
		result.size = size;
		return result;
	}

	TemplateValue* createValue(TemplateValue::Kind kind)
	{
		TemplateValue* result = static_cast<TemplateValue*>(allocate(sizeof(TemplateValue)));
		if (!result)
			return 0;

		initializeValue(*result);
		result->kind = kind;
		return result;
	}

	TemplateValue* parseValue()
	{
		skipWhitespace();
		if (current_ == end_)
		{
			status_ = CAMARO_STATUS_INVALID_TEMPLATE;
			return 0;
		}
		if (*current_ == '{')
			return parseObject();
		if (*current_ == '[')
			return parseArray();
		if (*current_ == '"')
		{
			TemplateValue* value = createValue(TemplateValue::kString);
			if (value)
				value->string = parseString();
			return value;
		}

		status_ = CAMARO_STATUS_INVALID_TEMPLATE;
		return 0;
	}

	TemplateValue* parseObject()
	{
		if (!expect('{'))
			return 0;
		TemplateValue* value = createValue(TemplateValue::kObject);
		if (!value)
			return 0;

		skipWhitespace();
		if (current_ < end_ && *current_ == '}')
		{
			++current_;
			return value;
		}

		for (;;)
		{
			skipWhitespace();
			if (current_ == end_ || *current_ != '"')
			{
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				return value;
			}

			TemplateMember* member = static_cast<TemplateMember*>(allocate(sizeof(TemplateMember)));
			if (!member)
				return value;
			member->key = parseString();
			member->next = 0;
			if (!expect(':'))
				return value;
			member->value = parseValue();
			if (!member->value)
				return value;

			if (value->members_tail)
				value->members_tail->next = member;
			else
				value->members = member;
			value->members_tail = member;

			skipWhitespace();
			char separator = get();
			if (separator == '}')
				break;
			if (separator != ',')
			{
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				break;
			}
		}

		return value;
	}

	TemplateValue* parseArray()
	{
		if (!expect('['))
			return 0;
		TemplateValue* value = createValue(TemplateValue::kArray);
		if (!value)
			return 0;

		skipWhitespace();
		if (current_ < end_ && *current_ == ']')
		{
			++current_;
			return value;
		}

		for (;;)
		{
			TemplateItem* item = static_cast<TemplateItem*>(allocate(sizeof(TemplateItem)));
			if (!item)
				return value;
			item->value = parseValue();
			item->next = 0;
			if (!item->value)
				return value;

			if (value->items_tail)
				value->items_tail->next = item;
			else
				value->items = item;
			value->items_tail = item;
			++value->item_count;

			skipWhitespace();
			char separator = get();
			if (separator == ']')
				break;
			if (separator != ',')
			{
				status_ = CAMARO_STATUS_INVALID_TEMPLATE;
				break;
			}
		}

		return value;
	}

	CamaroArena& arena_;
	const char* current_;
	const char* end_;
	camaro_status status_;
};

static camaro_status appendPathSegment(CamaroArena& arena, TemplateValue& value, StringView source, size_t start, size_t length)
{
	PathSegment* segment = static_cast<PathSegment*>(arena.allocate(sizeof(PathSegment)));
	if (!segment)
		return CAMARO_STATUS_OUT_OF_MEMORY;
	char* name = arena.copy(source.data + start, length);
	if (!name)
		return CAMARO_STATUS_OUT_OF_MEMORY;

	segment->start = start;
	segment->length = length;
	segment->name = name;
	segment->next = 0;
	if (value.path_segments_tail)
		value.path_segments_tail->next = segment;
	else
		value.path_segments = segment;
	value.path_segments_tail = segment;
	return CAMARO_STATUS_OK;
}

static camaro_status parseNavPath(CamaroArena& arena, TemplateValue& value, StringView path, bool& valid)
{
	valid = true;
	value.path_segments = 0;
	value.path_segments_tail = 0;
	value.path_has_attribute = false;
	value.path_absolute = !path.empty() && path.data[0] == '/';
	size_t start = value.path_absolute ? 1 : 0;
	while (start < path.size)
	{
		size_t end = findCharacter(path, '/', start);
		if (path.data[start] == '@')
		{
			if (end != path.size)
			{
				value.path_segments = 0;
				value.path_segments_tail = 0;
				value.path_has_attribute = false;
				valid = false;
				return CAMARO_STATUS_OK;
			}
			char* name = arena.copy(path.data + start + 1, end - start - 1);
			if (!name)
				return CAMARO_STATUS_OUT_OF_MEMORY;
			value.path_has_attribute = true;
			value.attribute_segment.start = start;
			value.attribute_segment.length = end - start;
			value.attribute_segment.name = name;
			value.attribute_segment.next = 0;
		}
		else
		{
			camaro_status status = appendPathSegment(arena, value, path, start, end - start);
			if (status != CAMARO_STATUS_OK)
				return status;
		}
		start = end + 1;
	}
	return CAMARO_STATUS_OK;
}

static camaro_status prepareValue(CamaroArena& arena, TemplateValue& value)
{
	for (TemplateMember* member = value.members; member; member = member->next)
	{
		camaro_status status = prepareValue(arena, *member->value);
		if (status != CAMARO_STATUS_OK)
			return status;
	}
	for (TemplateItem* item = value.items; item; item = item->next)
	{
		camaro_status status = prepareValue(arena, *item->value);
		if (status != CAMARO_STATUS_OK)
			return status;
	}
	if (value.kind != TemplateValue::kString)
		return CAMARO_STATUS_OK;

	StringView path = value.string;
	value.simple_nav_path = isSimpleNavPath(path);
	if (value.simple_nav_path)
	{
		bool valid = false;
		camaro_status status = parseNavPath(arena, value, path, valid);
		if (status != CAMARO_STATUS_OK)
			return status;
		value.simple_nav_path = valid;
	}

	if (path.startsWith("count(") || path.startsWith("ceiling(") || path.startsWith("floor(") || path.startsWith("round(") || path.startsWith("sum("))
		value.return_type = TemplateValue::kReturnNumber;

	if (path.size >= 3 && path.data[0] == '/' && path.data[1] == '/' && findCharacter(path, '/', 2) == path.size)
	{
		StringView name = {path.data + 2, path.size - 2};
		if (isSimpleNavPath(name))
		{
			char* copied = arena.copy(name.data, name.size);
			if (!copied)
				return CAMARO_STATUS_OUT_OF_MEMORY;
			value.simple_descendant_name = true;
			value.descendant_name.data = copied;
			value.descendant_name.size = name.size;
		}
	}

	if (path.startsWith("number(") && path.size >= 9 && path.data[path.size - 1] == ')')
	{
		value.return_type = TemplateValue::kReturnNumber;
		value.number_path.data = path.data + 7;
		value.number_path.size = path.size - 8;
		value.fast_number = isSimpleNavPath(value.number_path);
		value.number_path_absolute = !value.number_path.empty() && value.number_path.data[0] == '/';
		if (value.fast_number)
		{
			bool valid = false;
			camaro_status status = parseNavPath(arena, value, value.number_path, valid);
			if (status != CAMARO_STATUS_OK)
				return status;
			value.fast_number = valid;
		}
		return CAMARO_STATUS_OK;
	}

	if (!path.startsWith("boolean(") || path.size < 10 || path.data[path.size - 1] != ')')
		return CAMARO_STATUS_OK;

	value.return_type = TemplateValue::kReturnBoolean;
	StringView inner = {path.data + 8, path.size - 9};
	size_t equal = findCharacter(inner, '=', 0);
	if (equal == inner.size)
		return CAMARO_STATUS_OK;

	value.boolean_left.data = inner.data;
	value.boolean_left.size = equal;
	value.boolean_right.data = inner.data + equal + 1;
	value.boolean_right.size = inner.size - equal - 1;
	value.boolean_left = trim(value.boolean_left);
	value.boolean_right = trim(value.boolean_right);
	if (value.boolean_right.size >= 2)
	{
		char first = value.boolean_right.data[0];
		char last = value.boolean_right.data[value.boolean_right.size - 1];
		if ((first == '"' && last == '"') || (first == '\'' && last == '\''))
		{
			++value.boolean_right.data;
			value.boolean_right.size -= 2;
		}
	}

	value.fast_boolean = findCharacter(value.boolean_left, '(', 0) == value.boolean_left.size &&
	                     findCharacter(value.boolean_left, '/', 0) == value.boolean_left.size &&
	                     findCharacter(value.boolean_left, '@', 0) == value.boolean_left.size;
	if (value.fast_boolean)
	{
		char* left = arena.copy(value.boolean_left.data, value.boolean_left.size);
		char* right = arena.copy(value.boolean_right.data, value.boolean_right.size);
		if (!left || !right)
			return CAMARO_STATUS_OUT_OF_MEMORY;
		value.boolean_left.data = left;
		value.boolean_right.data = right;
	}
	return CAMARO_STATUS_OK;
}

} // namespace

camaro_status parseTemplate(CamaroArena& arena, camaro_bytes input, TemplateValue*& value)
{
	if (!input.data && input.size)
		return CAMARO_STATUS_INVALID_ARGUMENT;

	TemplateParser parser(arena, reinterpret_cast<const char*>(input.data), reinterpret_cast<const char*>(input.data) + input.size);
	camaro_status status = parser.parse(value);
	if (status != CAMARO_STATUS_OK)
		return status;

	return prepareValue(arena, *value);
}
