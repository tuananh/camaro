{
  'targets': [{
    'target_name': 'camaro',
    'sources': [
      'src/camaro.cpp'
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
    'cflags_cc': [
      '-std=c++11',
      '-fexceptions',
      '-Wall',
      '-mtune=native',
      '-Ofast',
      '-flto'
    ],
    'conditions': [
      [
        'OS==\"win\"',
        {
          'cflags': [
            '-Wall'
          ],
          'defines': [
            'WIN'
          ],
          'msvs_settings': {
            'VCCLCompilerTool': {
              'AdditionalOptions': [
                '/std:c++latest',
                '/utf-8'
              ]
            },
          }
        }
      ]
    ],
    'xcode_settings': {
      'OTHER_CPLUSPLUSFLAGS': [
        '-std=c++11',
        '-stdlib=libc++',
        '-fexceptions',
        '-Wall',
        '-mtune=native',
        '-Ofast'
      ],
      'OTHER_LDFLAGS':[
        '-stdlib=libc++'
      ]
    }
  }, {
    'target_name': 'action_after_build',
    'type': 'none',
    'dependencies': [ '<(module_name)' ],
    'copies': [
      {
        'files': [ '<(PRODUCT_DIR)/<(module_name).node' ],
        'destination': '<(module_path)'
      }
    ]
  }]
}