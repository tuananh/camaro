/**
 * camaro - allocation-aware JSON writer
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#ifndef CAMARO_JSON_WRITER_HPP
#define CAMARO_JSON_WRITER_HPP

#include "camaro.h"
#include "template_value.hpp"

static const char kNanSentinel[] = "__camaro_nan__";

class JsonWriter
{
public:
	explicit JsonWriter(const camaro_allocator& allocator);
	JsonWriter(const camaro_allocator& allocator, camaro_owned_bytes& existing);
	~JsonWriter();

	void reserve(size_t size);
	void beginObject();
	void endObject();
	void beginArray();
	void endArray();
	void writeKey(StringView key);
	void writeKey(const char* key);
	void writeString(StringView value);
	void writeString(const char* value);
	void writeString(const char* value, size_t size);
	void writeBool(bool value);
	void writeNumber(double value, bool& has_nan);
	void writeEmptyString();
	void append(const char* value, size_t size);

	camaro_status status() const;
	void release(camaro_owned_bytes& output);

private:
	JsonWriter(const JsonWriter&);
	JsonWriter& operator=(const JsonWriter&);

	void separator();
	void appendCharacter(char value);
	void appendEscaped(const char* value, size_t size);
	bool grow(size_t extra);

	camaro_owned_bytes output_;
	bool container_first_;
	camaro_status status_;
};

#endif
