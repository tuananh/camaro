/**
 * camaro - native XML transformation API
 *
 * Copyright (c) Camaro contributors
 * SPDX-License-Identifier: MIT
 */

#ifndef CAMARO_H
#define CAMARO_H

#include <stddef.h>

#ifdef __cplusplus
extern "C"
{
#endif

typedef struct camaro_context camaro_context;

typedef enum camaro_status
{
	CAMARO_STATUS_OK = 0,
	CAMARO_STATUS_INVALID_ARGUMENT = 1,
	CAMARO_STATUS_OUT_OF_MEMORY = 2,
	CAMARO_STATUS_INVALID_XML = 3,
	CAMARO_STATUS_INVALID_TEMPLATE = 4,
	CAMARO_STATUS_INVALID_XPATH = 5,
	CAMARO_STATUS_UNKNOWN_TEMPLATE = 6,
	CAMARO_STATUS_INTERNAL_ERROR = 7
} camaro_status;

typedef struct camaro_bytes
{
	const unsigned char* data;
	size_t size;
} camaro_bytes;

typedef void* (*camaro_allocate_fn)(void* user_data, size_t size);
typedef void* (*camaro_reallocate_fn)(void* user_data, void* pointer, size_t size);
typedef void (*camaro_free_fn)(void* user_data, void* pointer);

typedef struct camaro_allocator
{
	camaro_allocate_fn allocate;
	camaro_reallocate_fn reallocate;
	camaro_free_fn free;
	void* user_data;
} camaro_allocator;

typedef struct camaro_owned_bytes
{
	unsigned char* data;
	size_t size;
	size_t capacity;
	camaro_allocator allocator;
} camaro_owned_bytes;

typedef struct camaro_transform_result
{
	camaro_owned_bytes json;
	int has_nan;
} camaro_transform_result;

typedef struct camaro_profile_result
{
	camaro_transform_result result;
	double parse_ms;
	double extract_ms;
} camaro_profile_result;

camaro_status camaro_context_create(const camaro_allocator* allocator, camaro_context** context);
void camaro_context_destroy(camaro_context* context);

camaro_status camaro_register_template(camaro_context* context, camaro_bytes json_template, unsigned int* template_id);
camaro_status camaro_transform(camaro_context* context, camaro_bytes xml, camaro_bytes json_template, camaro_transform_result* result);
camaro_status camaro_transform_with_template_id(camaro_context* context, camaro_bytes xml, unsigned int template_id, camaro_transform_result* result);
camaro_status camaro_transform_in_place(camaro_context* context, unsigned char* xml, size_t xml_size, camaro_bytes json_template, camaro_transform_result* result);
camaro_status camaro_transform_in_place_with_template_id(camaro_context* context, unsigned char* xml, size_t xml_size, unsigned int template_id, camaro_transform_result* result);
camaro_status camaro_profile_transform_in_place_with_template_id(camaro_context* context, unsigned char* xml, size_t xml_size, unsigned int template_id, camaro_profile_result* result);
camaro_status camaro_profile_parse_in_place(camaro_context* context, unsigned char* xml, size_t xml_size, double* parse_ms);

camaro_status camaro_to_json(camaro_context* context, camaro_bytes xml, camaro_owned_bytes* json);
camaro_status camaro_pretty_print(camaro_context* context, camaro_bytes xml, int indent_size, camaro_owned_bytes* output);

void camaro_owned_bytes_release(camaro_owned_bytes* bytes);
void camaro_owned_bytes_recycle(camaro_context* context, camaro_owned_bytes* bytes);
const char* camaro_status_string(camaro_status status);

#ifdef __cplusplus
}
#endif

#endif
