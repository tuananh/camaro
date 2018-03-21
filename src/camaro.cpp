#define NOMINMAX
#define NAPI_DISABLE_CPP_EXCEPTIONS
#include <napi.h>
#include "transform.cpp"

Napi::Object transform(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  std::string xml = info[0].As<Napi::String>().Utf8Value();
  std::string json_template = info[1].As<Napi::String>().Utf8Value();

  Napi::Object output = Napi::Object::New(env);
  transform_xml(xml, json_template, info, output);

  return output;
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  exports.Set(Napi::String::New(env, "transform"), Napi::Function::New(env, transform));

  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
