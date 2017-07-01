{
  'targets': [{
    'target_name': 'camaro',
    'sources': [
      'src/camaro.cpp'
    ],
    'include_dirs': [
      '<!(node -e "require(\'nan\')")'
    ],
    'cflags_cc': [
      '-std=c++11',
      '-fexceptions',
      '-Wall',
      '-march=native',
      '-Ofast',
      '-flto'
    ],
    'conditions': [
      [
        "OS==\"win\"",
        {
          "cflags": [
            "-Wall"
          ],
          "defines": [
            "WIN"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
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
      'CLANG_CXX_LANGUAGE_STANDARD': 'c++11',
      'OTHER_CPLUSPLUSFLAGS': [
        '-std=c++11',
        '-fexceptions',
        '-Wall',
        '-march=native',
        '-Ofast'
      ],

    }
  }, {
    "target_name": "action_after_build",
    "type": "none",
    "dependencies": [ "<(module_name)" ],
    "copies": [
      {
        "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
        "destination": "<(module_path)"
      }
    ]
  }]
}