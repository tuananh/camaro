void lower(std::string&);
void upper(std::string&);
void title_case(std::string&);

inline void title_case(std::string& str) {
  lower(str);
  static char last = ' ';
  std::for_each(str.begin(), str.end(), [](char& c) {
    if (last == ' ' && c != ' ' && ::isalpha(c)) c = ::toupper(c);
    last = c;
  });
  last = ' ';
}

inline void lower(std::string& str) {
  std::for_each(str.begin(), str.end(), [](char& c) { c = ::tolower(c); });
}

inline void upper(std::string& str) {
  std::for_each(str.begin(), str.end(), [](char& c) { c = ::toupper(c); });
}