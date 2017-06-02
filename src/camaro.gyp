{
  'targets': [{
    'target_name': 'camaro',
    'type': 'static_library',
    'sources': [
      'pugixml/src/pugixml.hpp',
      'pugixml/src/pugixml.cpp',
      'json/src/json.hpp',
      'camaro.cc'
    ],
    'cflags': [
      '-std=c++11',
      '-fexceptions',
      '-Wall',
      '-march=native',
      '-Ofast'
    ],
    'xcode_settings': {
      'OTHER_CFLAGS': [
        '-std=c++11',
        '-fexceptions',
        '-Wall',
        '-march=native',
        '-Ofast'
      ]
    }
  }]
}