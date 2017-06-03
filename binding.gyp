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
                '/m',
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
        '-fexceptions',
        '-Wall',
        '-march=native',
        '-Ofast'
      ],

    }
  }]
}