{
  'targets': [{
    'target_name': 'pugixml',
    'sources': [
      'src/pugixml.cc'
    ],
    'include_dirs': [
      '<!(node -e "require(\'nan\')")'
    ],
    'cflags_cc': [
      '-fexceptions',
      '-Wall',
      '-march=native',
      '-Ofast',
      '-flto'
    ],
    'xcode_settings': {
      'OTHER_CPLUSPLUSFLAGS': [
        '-fexceptions',
        '-Wall',
        '-march=native',
        '-Ofast'
      ],

    }
  }]
}