#define NOMINMAX
#include <nan.h>
#include "transform.cpp"

void transform(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  if (info.Length() < 2) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!info[0]->IsString() || !info[1]->IsString()) {
    Nan::ThrowTypeError("Wrong arguments");
    return;
  }

  v8::String::Utf8Value param1(info[0]->ToString());
  v8::String::Utf8Value param2(info[1]->ToString());

  std::string xml = std::string(*param1);
  std::string json_template = std::string(*param2);

  std::string output = transform(xml, json_template);
  v8::Local<v8::String> v8output =
      v8::String::NewFromUtf8(v8::Isolate::GetCurrent(), output.c_str());

  info.GetReturnValue().Set(v8output);
}

void Init(v8::Local<v8::Object> exports) {
  exports->Set(Nan::New("transform").ToLocalChecked(),
               Nan::New<v8::FunctionTemplate>(transform)->GetFunction());
}

NODE_MODULE(camaro, Init)
