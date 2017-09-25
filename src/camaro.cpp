#define NOMINMAX
#include <nan.h>
#include "transform.cpp"

using v8::Local;
using v8::String;
using v8::Value;
using v8::Object;
using v8::Isolate;
using v8::FunctionTemplate;

void transform(const Nan::FunctionCallbackInfo<Value>& args) {
  if (args.Length() < 2) {
    Nan::ThrowTypeError("Wrong number of arguments");
    return;
  }

  if (!args[0]->IsString() || !args[1]->IsString()) {
    Nan::ThrowTypeError("Wrong arguments");
    return;
  }

  String::Utf8Value param1(args[0]->ToString());
  String::Utf8Value param2(args[1]->ToString());

  std::string xml = std::string(*param1);
  std::string json_template = std::string(*param2);

  Isolate* isolate = args.GetIsolate();
  Local<Object> obj = Object::New(isolate);
  transform_xml(xml, json_template, args, obj);

  args.GetReturnValue().Set(obj);
}

void Init(Local<Object> exports) {
  exports->Set(Nan::New("transform").ToLocalChecked(),
               Nan::New<FunctionTemplate>(transform)->GetFunction());
}

NODE_MODULE(camaro, Init)
