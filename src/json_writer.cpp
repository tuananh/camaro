/**
 * camaro - allocation-aware JSON writer
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#include "json_writer.hpp"

#include <math.h>
#include <stdio.h>
#include <string.h>

JsonWriter::JsonWriter(const camaro_allocator& allocator)
    : container_first_(true)
    , status_(CAMARO_STATUS_OK)
{
	output_.data = 0;
	output_.size = 0;
	output_.capacity = 0;
	output_.allocator = allocator;
}

JsonWriter::JsonWriter(const camaro_allocator& allocator, camaro_owned_bytes& existing)
    : container_first_(true)
    , status_(CAMARO_STATUS_OK)
{
	output_ = existing;
	output_.size = 0;
	if (!output_.allocator.allocate)
		output_.allocator = allocator;
	existing.data = 0;
	existing.size = 0;
	existing.capacity = 0;
}

JsonWriter::~JsonWriter()
{
	if (output_.data)
		output_.allocator.free(output_.allocator.user_data, output_.data);
}

bool JsonWriter::grow(size_t extra)
{
	if (status_ != CAMARO_STATUS_OK)
		return false;
	if (extra <= output_.capacity - output_.size)
		return true;
	if (extra > static_cast<size_t>(-1) - output_.size)
	{
		status_ = CAMARO_STATUS_OUT_OF_MEMORY;
		return false;
	}

	size_t required = output_.size + extra;
	size_t capacity = output_.capacity ? output_.capacity : 2048;
	while (capacity < required)
	{
		size_t next = capacity + (capacity >> 1);
		if (next <= capacity)
		{
			capacity = required;
			break;
		}
		capacity = next;
	}

	void* data = output_.allocator.reallocate(output_.allocator.user_data, output_.data, capacity);
	if (!data)
	{
		status_ = CAMARO_STATUS_OUT_OF_MEMORY;
		return false;
	}

	output_.data = static_cast<unsigned char*>(data);
	output_.capacity = capacity;
	return true;
}

void JsonWriter::reserve(size_t size)
{
	if (size > output_.size)
		grow(size - output_.size);
}

void JsonWriter::append(const char* value, size_t size)
{
	if (!size || !grow(size))
		return;
	memcpy(output_.data + output_.size, value, size);
	output_.size += size;
}

void JsonWriter::appendCharacter(char value)
{
	if (output_.size < output_.capacity)
	{
		output_.data[output_.size++] = static_cast<unsigned char>(value);
		return;
	}
	if (!grow(1))
		return;
	output_.data[output_.size++] = static_cast<unsigned char>(value);
}

void JsonWriter::separator()
{
	if (container_first_)
		container_first_ = false;
	else
		appendCharacter(',');
}

void JsonWriter::appendEscaped(const char* value, size_t size)
{
	static const char kHex[] = "0123456789abcdef";
	if (!grow(size + 2))
		return;

	unsigned char* out = output_.data + output_.size;
	*out++ = '"';

	size_t i = 0;
	while (i < size)
	{
		size_t start = i;
		while (i < size)
		{
			unsigned char c = static_cast<unsigned char>(value[i]);
			if (c == '"' || c == '\\' || c < 0x20)
				break;
			++i;
		}

		size_t run = i - start;
		if (run)
		{
			if (static_cast<size_t>(out - output_.data) + run > output_.capacity)
			{
				output_.size = static_cast<size_t>(out - output_.data);
				if (!grow(run + (size - i) + 2))
					return;
				out = output_.data + output_.size;
			}
			memcpy(out, value + start, run);
			out += run;
		}
		if (i == size)
			break;

		unsigned char c = static_cast<unsigned char>(value[i++]);
		const char* escape = 0;
		switch (c)
		{
		case '"':
			escape = "\\\"";
			break;
		case '\\':
			escape = "\\\\";
			break;
		case '\b':
			escape = "\\b";
			break;
		case '\f':
			escape = "\\f";
			break;
		case '\n':
			escape = "\\n";
			break;
		case '\r':
			escape = "\\r";
			break;
		case '\t':
			escape = "\\t";
			break;
		default:
			break;
		}

		size_t escape_size = escape ? 2 : 6;
		if (static_cast<size_t>(out - output_.data) + escape_size + 1 > output_.capacity)
		{
			output_.size = static_cast<size_t>(out - output_.data);
			if (!grow(escape_size + (size - i) + 2))
				return;
			out = output_.data + output_.size;
		}
		if (escape)
		{
			out[0] = static_cast<unsigned char>(escape[0]);
			out[1] = static_cast<unsigned char>(escape[1]);
			out += 2;
		}
		else
		{
			out[0] = '\\';
			out[1] = 'u';
			out[2] = '0';
			out[3] = '0';
			out[4] = static_cast<unsigned char>(kHex[c >> 4]);
			out[5] = static_cast<unsigned char>(kHex[c & 15]);
			out += 6;
		}
	}

	if (static_cast<size_t>(out - output_.data) + 1 > output_.capacity)
	{
		output_.size = static_cast<size_t>(out - output_.data);
		if (!grow(1))
			return;
		out = output_.data + output_.size;
	}
	*out++ = '"';
	output_.size = static_cast<size_t>(out - output_.data);
}

void JsonWriter::beginObject()
{
	separator();
	appendCharacter('{');
	container_first_ = true;
}

void JsonWriter::endObject()
{
	appendCharacter('}');
	container_first_ = false;
}

void JsonWriter::beginArray()
{
	separator();
	appendCharacter('[');
	container_first_ = true;
}

void JsonWriter::endArray()
{
	appendCharacter(']');
	container_first_ = false;
}

void JsonWriter::writeKey(StringView key)
{
	separator();
	appendEscaped(key.data, key.size);
	appendCharacter(':');
	container_first_ = true;
}

void JsonWriter::writeKey(const char* key)
{
	StringView value = {key, strlen(key)};
	writeKey(value);
}

void JsonWriter::writeString(StringView value)
{
	writeString(value.data, value.size);
}

void JsonWriter::writeString(const char* value)
{
	writeString(value, strlen(value));
}

void JsonWriter::writeString(const char* value, size_t size)
{
	separator();
	appendEscaped(value, size);
	container_first_ = false;
}

void JsonWriter::writeBool(bool value)
{
	separator();
	append(value ? "true" : "false", value ? 4 : 5);
	container_first_ = false;
}

static char* writeUnsigned(char* out, unsigned long value)
{
	char digits[20];
	size_t count = 0;
	do
	{
		digits[count++] = static_cast<char>('0' + (value % 10));
		value /= 10;
	} while (value);

	while (count)
		*out++ = digits[--count];
	return out;
}

void JsonWriter::writeNumber(double value, bool& has_nan)
{
	separator();
	if (value != value)
	{
		has_nan = true;
		appendEscaped(kNanSentinel, sizeof(kNanSentinel) - 1);
	}
	else if (value > 1.7976931348623157e+308)
		append("Infinity", 8);
	else if (value < -1.7976931348623157e+308)
		append("-Infinity", 9);
	else if (value >= -2147483647.0 && value <= 2147483647.0)
	{
		long integer = static_cast<long>(value);
		if (static_cast<double>(integer) == value)
		{
			char buffer[16];
			char* out = buffer;
			if (integer < 0)
			{
				*out++ = '-';
				integer = -integer;
			}
			out = writeUnsigned(out, static_cast<unsigned long>(integer));
			append(buffer, static_cast<size_t>(out - buffer));
		}
		else
		{
			char buffer[64];
			int size = snprintf(buffer, sizeof(buffer), "%.17g", value);
			if (size < 0 || static_cast<size_t>(size) >= sizeof(buffer))
				status_ = CAMARO_STATUS_INTERNAL_ERROR;
			else
				append(buffer, static_cast<size_t>(size));
		}
	}
	else
	{
		char buffer[64];
		int size = snprintf(buffer, sizeof(buffer), "%.17g", value);
		if (size < 0 || static_cast<size_t>(size) >= sizeof(buffer))
			status_ = CAMARO_STATUS_INTERNAL_ERROR;
		else
			append(buffer, static_cast<size_t>(size));
	}
	container_first_ = false;
}

void JsonWriter::writeEmptyString()
{
	separator();
	append("\"\"", 2);
	container_first_ = false;
}

camaro_status JsonWriter::status() const
{
	return status_;
}

void JsonWriter::release(camaro_owned_bytes& output)
{
	output = output_;
	output_.data = 0;
	output_.size = 0;
	output_.capacity = 0;
}
