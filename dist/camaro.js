
var camaro = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(moduleArg = {}) {

var h=moduleArg,aa,v;h.ready=new Promise((a,b)=>{aa=a;v=b});var ba=Object.assign({},h),ca="./this.program",da="object"==typeof window,w="function"==typeof importScripts,ea="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node,x="",fa,y,z;
if(ea){var fs=require("fs"),ha=require("path");x=w?ha.dirname(x)+"/":__dirname+"/";fa=(a,b)=>{a=a.startsWith("file://")?new URL(a):ha.normalize(a);return fs.readFileSync(a,b?void 0:"utf8")};z=a=>{a=fa(a,!0);a.buffer||(a=new Uint8Array(a));return a};y=(a,b,c,d=!0)=>{a=a.startsWith("file://")?new URL(a):ha.normalize(a);fs.readFile(a,d?void 0:"utf8",(f,g)=>{f?c(f):b(d?g.buffer:g)})};!h.thisProgram&&1<process.argv.length&&(ca=process.argv[1].replace(/\\/g,"/"));process.argv.slice(2);h.inspect=()=>"[Emscripten Module object]"}else if(da||
w)w?x=self.location.href:"undefined"!=typeof document&&document.currentScript&&(x=document.currentScript.src),_scriptDir&&(x=_scriptDir),0!==x.indexOf("blob:")?x=x.substr(0,x.replace(/[?#].*/,"").lastIndexOf("/")+1):x="",fa=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.send(null);return b.responseText},w&&(z=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)}),y=(a,b,c)=>{var d=new XMLHttpRequest;d.open("GET",a,!0);d.responseType=
"arraybuffer";d.onload=()=>{200==d.status||0==d.status&&d.response?b(d.response):c()};d.onerror=c;d.send(null)};h.print||console.log.bind(console);var B=h.printErr||console.error.bind(console);Object.assign(h,ba);ba=null;h.thisProgram&&(ca=h.thisProgram);var C;h.wasmBinary&&(C=h.wasmBinary);var noExitRuntime=h.noExitRuntime||!0;"object"!=typeof WebAssembly&&ia("no native wasm support detected");var E,ja=!1,F,G,I,J,K,L,ka,la;
function ma(){var a=E.buffer;h.HEAP8=F=new Int8Array(a);h.HEAP16=I=new Int16Array(a);h.HEAPU8=G=new Uint8Array(a);h.HEAPU16=J=new Uint16Array(a);h.HEAP32=K=new Int32Array(a);h.HEAPU32=L=new Uint32Array(a);h.HEAPF32=ka=new Float32Array(a);h.HEAPF64=la=new Float64Array(a)}var na,oa=[],pa=[],qa=[];function ra(){var a=h.preRun.shift();oa.unshift(a)}var M=0,sa=null,N=null;
function ia(a){if(h.onAbort)h.onAbort(a);a="Aborted("+a+")";B(a);ja=!0;a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");v(a);throw a;}function ta(a){return a.startsWith("data:application/octet-stream;base64,")}var O;O="camaro.wasm";if(!ta(O)){var ua=O;O=h.locateFile?h.locateFile(ua,x):x+ua}function va(a){if(a==O&&C)return new Uint8Array(C);if(z)return z(a);throw"both async and sync fetching of the wasm failed";}
function wa(a){if(!C&&(da||w)){if("function"==typeof fetch&&!a.startsWith("file://"))return fetch(a,{credentials:"same-origin"}).then(b=>{if(!b.ok)throw"failed to load wasm binary file at '"+a+"'";return b.arrayBuffer()}).catch(()=>va(a));if(y)return new Promise((b,c)=>{y(a,d=>b(new Uint8Array(d)),c)})}return Promise.resolve().then(()=>va(a))}function xa(a,b,c){return wa(a).then(d=>WebAssembly.instantiate(d,b)).then(d=>d).then(c,d=>{B(`failed to asynchronously prepare wasm: ${d}`);ia(d)})}
function ya(a,b){var c=O;return C||"function"!=typeof WebAssembly.instantiateStreaming||ta(c)||c.startsWith("file://")||ea||"function"!=typeof fetch?xa(c,a,b):fetch(c,{credentials:"same-origin"}).then(d=>WebAssembly.instantiateStreaming(d,a).then(b,function(f){B(`wasm streaming compile failed: ${f}`);B("falling back to ArrayBuffer instantiation");return xa(c,a,b)}))}var za=a=>{for(;0<a.length;)a.shift()(h)};
function Aa(a){this.V=a-24;this.fa=function(b){L[this.V+4>>2]=b};this.ea=function(b){L[this.V+8>>2]=b};this.Y=function(b,c){this.Z();this.fa(b);this.ea(c)};this.Z=function(){L[this.V+16>>2]=0}}var Ba=0,Ca=0,Da={},Ea=a=>{for(;a.length;){var b=a.pop();a.pop()(b)}};function Fa(a){return this.fromWireType(K[a>>2])}
var P={},Q={},Ga={},Ha=void 0,Ia=(a,b,c)=>{function d(k){k=c(k);if(k.length!==a.length)throw new Ha("Mismatched type converter count");for(var m=0;m<a.length;++m)R(a[m],k[m])}a.forEach(function(k){Ga[k]=b});var f=Array(b.length),g=[],l=0;b.forEach((k,m)=>{Q.hasOwnProperty(k)?f[m]=Q[k]:(g.push(k),P.hasOwnProperty(k)||(P[k]=[]),P[k].push(()=>{f[m]=Q[k];++l;l===g.length&&d(f)}))});0===g.length&&d(f)},Ja=void 0,S=a=>{for(var b="";G[a];)b+=Ja[G[a++]];return b},T=void 0,Ka=a=>{throw new T(a);};
function La(a,b,c={}){var d=b.name;if(!a)throw new T(`type "${d}" must have a positive integer typeid pointer`);if(Q.hasOwnProperty(a)){if(c.la)return;throw new T(`Cannot register type '${d}' twice`);}Q[a]=b;delete Ga[a];P.hasOwnProperty(a)&&(b=P[a],delete P[a],b.forEach(f=>f()))}function R(a,b,c={}){if(!("argPackAdvance"in b))throw new TypeError("registerType registeredInstance requires argPackAdvance");La(a,b,c)}function Ma(){this.R=[void 0];this.ba=[]}
var U=new Ma,Na=a=>{a>=U.V&&0===--U.get(a).da&&U.Z(a)},V=a=>{if(!a)throw new T("Cannot use deleted val. handle = "+a);return U.get(a).value},W=a=>{switch(a){case void 0:return 1;case null:return 2;case !0:return 3;case !1:return 4;default:return U.Y({da:1,value:a})}},Oa=(a,b)=>{switch(b){case 4:return function(c){return this.fromWireType(ka[c>>2])};case 8:return function(c){return this.fromWireType(la[c>>3])};default:throw new TypeError(`invalid float width (${b}): ${a}`);}},Pa=a=>{if(void 0===a)return"_unknown";
a=a.replace(/[^a-zA-Z0-9_]/g,"$");var b=a.charCodeAt(0);return 48<=b&&57>=b?`_${a}`:a};function Qa(a,b){a=Pa(a);return{[a]:function(){return b.apply(this,arguments)}}[a]}function Ra(a){var b=Function;if(!(b instanceof Function))throw new TypeError(`new_ called with constructor type ${typeof b} which is not a function`);var c=Qa(b.name||"unknownFunctionName",function(){});c.prototype=b.prototype;c=new c;a=b.apply(c,a);return a instanceof Object?a:c}
var Sa=(a,b)=>{if(void 0===h[a].K){var c=h[a];h[a]=function(){if(!h[a].K.hasOwnProperty(arguments.length))throw new T(`Function '${b}' called with an invalid number of arguments (${arguments.length}) - expects one of (${h[a].K})!`);return h[a].K[arguments.length].apply(this,arguments)};h[a].K=[];h[a].K[c.ga]=c}},Ta=(a,b,c)=>{if(h.hasOwnProperty(a)){if(void 0===c||void 0!==h[a].K&&void 0!==h[a].K[c])throw new T(`Cannot register public name '${a}' twice`);Sa(a,a);if(h.hasOwnProperty(c))throw new T(`Cannot register multiple overloads of a function with the same number of arguments (${c})!`);
h[a].K[c]=b}else h[a]=b,void 0!==c&&(h[a].wa=c)},Ua=(a,b)=>{for(var c=[],d=0;d<a;d++)c.push(L[b+4*d>>2]);return c},Va=[],Wa=a=>{var b=Va[a];b||(a>=Va.length&&(Va.length=a+1),Va[a]=b=na.get(a));return b},Xa=(a,b)=>{var c=[];return function(){c.length=0;Object.assign(c,arguments);if(a.includes("j")){var d=h["dynCall_"+a];d=c&&c.length?d.apply(null,[b].concat(c)):d.call(null,b)}else d=Wa(b).apply(null,c);return d}},X=(a,b)=>{a=S(a);var c=a.includes("j")?Xa(a,b):Wa(b);if("function"!=typeof c)throw new T(`unknown function pointer with signature ${a}: ${b}`);
return c},Ya=void 0,$a=a=>{a=Za(a);var b=S(a);Y(a);return b},ab=(a,b)=>{function c(g){f[g]||Q[g]||(Ga[g]?Ga[g].forEach(c):(d.push(g),f[g]=!0))}var d=[],f={};b.forEach(c);throw new Ya(`${a}: `+d.map($a).join([", "]));},bb=(a,b,c)=>{switch(b){case 1:return c?d=>F[d>>0]:d=>G[d>>0];case 2:return c?d=>I[d>>1]:d=>J[d>>1];case 4:return c?d=>K[d>>2]:d=>L[d>>2];default:throw new TypeError(`invalid integer width (${b}): ${a}`);}};function cb(a){return this.fromWireType(L[a>>2])}
var db=(a,b,c,d)=>{if(!(0<d))return 0;var f=c;d=c+d-1;for(var g=0;g<a.length;++g){var l=a.charCodeAt(g);if(55296<=l&&57343>=l){var k=a.charCodeAt(++g);l=65536+((l&1023)<<10)|k&1023}if(127>=l){if(c>=d)break;b[c++]=l}else{if(2047>=l){if(c+1>=d)break;b[c++]=192|l>>6}else{if(65535>=l){if(c+2>=d)break;b[c++]=224|l>>12}else{if(c+3>=d)break;b[c++]=240|l>>18;b[c++]=128|l>>12&63}b[c++]=128|l>>6&63}b[c++]=128|l&63}}b[c]=0;return c-f},eb=a=>{for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);127>=d?b++:2047>=
d?b+=2:55296<=d&&57343>=d?(b+=4,++c):b+=3}return b},fb="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0,gb=(a,b)=>{var c=G,d=a+b;for(b=a;c[b]&&!(b>=d);)++b;if(16<b-a&&c.buffer&&fb)return fb.decode(c.subarray(a,b));for(d="";a<b;){var f=c[a++];if(f&128){var g=c[a++]&63;if(192==(f&224))d+=String.fromCharCode((f&31)<<6|g);else{var l=c[a++]&63;f=224==(f&240)?(f&15)<<12|g<<6|l:(f&7)<<18|g<<12|l<<6|c[a++]&63;65536>f?d+=String.fromCharCode(f):(f-=65536,d+=String.fromCharCode(55296|f>>10,56320|
f&1023))}}else d+=String.fromCharCode(f)}return d},ib="undefined"!=typeof TextDecoder?new TextDecoder("utf-16le"):void 0,jb=(a,b)=>{var c=a>>1;for(var d=c+b/2;!(c>=d)&&J[c];)++c;c<<=1;if(32<c-a&&ib)return ib.decode(G.subarray(a,c));c="";for(d=0;!(d>=b/2);++d){var f=I[a+2*d>>1];if(0==f)break;c+=String.fromCharCode(f)}return c},kb=(a,b,c)=>{void 0===c&&(c=2147483647);if(2>c)return 0;c-=2;var d=b;c=c<2*a.length?c/2:a.length;for(var f=0;f<c;++f)I[b>>1]=a.charCodeAt(f),b+=2;I[b>>1]=0;return b-d},lb=a=>
2*a.length,mb=(a,b)=>{for(var c=0,d="";!(c>=b/4);){var f=K[a+4*c>>2];if(0==f)break;++c;65536<=f?(f-=65536,d+=String.fromCharCode(55296|f>>10,56320|f&1023)):d+=String.fromCharCode(f)}return d},nb=(a,b,c)=>{void 0===c&&(c=2147483647);if(4>c)return 0;var d=b;c=d+c-4;for(var f=0;f<a.length;++f){var g=a.charCodeAt(f);if(55296<=g&&57343>=g){var l=a.charCodeAt(++f);g=65536+((g&1023)<<10)|l&1023}K[b>>2]=g;b+=4;if(b+4>c)break}K[b>>2]=0;return b-d},ob=a=>{for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);
55296<=d&&57343>=d&&++c;b+=4}return b},pb={},qb=a=>{var b=pb[a];return void 0===b?S(a):b},rb=[],sb=a=>{var b=rb.length;rb.push(a);return b},tb=(a,b)=>{var c=Q[a];if(void 0===c)throw a=b+" has unknown type "+$a(a),new T(a);return c},ub=(a,b)=>{for(var c=Array(a),d=0;d<a;++d)c[d]=tb(L[b+4*d>>2],"parameter "+d);return c},vb=[],wb={},yb=()=>{if(!xb){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"==typeof navigator&&navigator.languages&&navigator.languages[0]||
"C").replace("-","_")+".UTF-8",_:ca||"./this.program"},b;for(b in wb)void 0===wb[b]?delete a[b]:a[b]=wb[b];var c=[];for(b in a)c.push(`${b}=${a[b]}`);xb=c}return xb},xb,zb=a=>0===a%4&&(0!==a%100||0===a%400),Ab=[31,29,31,30,31,30,31,31,30,31,30,31],Bb=[31,28,31,30,31,30,31,31,30,31,30,31];function Cb(a){var b=Array(eb(a)+1);db(a,b,0,b.length);return b}
var Db=(a,b,c,d)=>{function f(e,r,p){for(e="number"==typeof e?e.toString():e||"";e.length<r;)e=p[0]+e;return e}function g(e,r){return f(e,r,"0")}function l(e,r){function p(D){return 0>D?-1:0<D?1:0}var A;0===(A=p(e.getFullYear()-r.getFullYear()))&&0===(A=p(e.getMonth()-r.getMonth()))&&(A=p(e.getDate()-r.getDate()));return A}function k(e){switch(e.getDay()){case 0:return new Date(e.getFullYear()-1,11,29);case 1:return e;case 2:return new Date(e.getFullYear(),0,3);case 3:return new Date(e.getFullYear(),
0,2);case 4:return new Date(e.getFullYear(),0,1);case 5:return new Date(e.getFullYear()-1,11,31);case 6:return new Date(e.getFullYear()-1,11,30)}}function m(e){var r=e.T;for(e=new Date((new Date(e.U+1900,0,1)).getTime());0<r;){var p=e.getMonth(),A=(zb(e.getFullYear())?Ab:Bb)[p];if(r>A-e.getDate())r-=A-e.getDate()+1,e.setDate(1),11>p?e.setMonth(p+1):(e.setMonth(0),e.setFullYear(e.getFullYear()+1));else{e.setDate(e.getDate()+r);break}}p=new Date(e.getFullYear()+1,0,4);r=k(new Date(e.getFullYear(),0,
4));p=k(p);return 0>=l(r,e)?0>=l(p,e)?e.getFullYear()+1:e.getFullYear():e.getFullYear()-1}var n=L[d+40>>2];d={ua:K[d>>2],ta:K[d+4>>2],W:K[d+8>>2],$:K[d+12>>2],X:K[d+16>>2],U:K[d+20>>2],P:K[d+24>>2],T:K[d+28>>2],xa:K[d+32>>2],sa:K[d+36>>2],va:n?n?gb(n):"":""};c=c?gb(c):"";n={"%c":"%a %b %d %H:%M:%S %Y","%D":"%m/%d/%y","%F":"%Y-%m-%d","%h":"%b","%r":"%I:%M:%S %p","%R":"%H:%M","%T":"%H:%M:%S","%x":"%m/%d/%y","%X":"%H:%M:%S","%Ec":"%c","%EC":"%C","%Ex":"%m/%d/%y","%EX":"%H:%M:%S","%Ey":"%y","%EY":"%Y",
"%Od":"%d","%Oe":"%e","%OH":"%H","%OI":"%I","%Om":"%m","%OM":"%M","%OS":"%S","%Ou":"%u","%OU":"%U","%OV":"%V","%Ow":"%w","%OW":"%W","%Oy":"%y"};for(var q in n)c=c.replace(new RegExp(q,"g"),n[q]);var t="Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "),u="January February March April May June July August September October November December".split(" ");n={"%a":e=>t[e.P].substring(0,3),"%A":e=>t[e.P],"%b":e=>u[e.X].substring(0,3),"%B":e=>u[e.X],"%C":e=>g((e.U+1900)/100|0,2),"%d":e=>
g(e.$,2),"%e":e=>f(e.$,2," "),"%g":e=>m(e).toString().substring(2),"%G":e=>m(e),"%H":e=>g(e.W,2),"%I":e=>{e=e.W;0==e?e=12:12<e&&(e-=12);return g(e,2)},"%j":e=>{for(var r=0,p=0;p<=e.X-1;r+=(zb(e.U+1900)?Ab:Bb)[p++]);return g(e.$+r,3)},"%m":e=>g(e.X+1,2),"%M":e=>g(e.ta,2),"%n":()=>"\n","%p":e=>0<=e.W&&12>e.W?"AM":"PM","%S":e=>g(e.ua,2),"%t":()=>"\t","%u":e=>e.P||7,"%U":e=>g(Math.floor((e.T+7-e.P)/7),2),"%V":e=>{var r=Math.floor((e.T+7-(e.P+6)%7)/7);2>=(e.P+371-e.T-2)%7&&r++;if(r)53==r&&(p=(e.P+371-
e.T)%7,4==p||3==p&&zb(e.U)||(r=1));else{r=52;var p=(e.P+7-e.T-1)%7;(4==p||5==p&&zb(e.U%400-1))&&r++}return g(r,2)},"%w":e=>e.P,"%W":e=>g(Math.floor((e.T+7-(e.P+6)%7)/7),2),"%y":e=>(e.U+1900).toString().substring(2),"%Y":e=>e.U+1900,"%z":e=>{e=e.sa;var r=0<=e;e=Math.abs(e)/60;return(r?"+":"-")+String("0000"+(e/60*100+e%60)).slice(-4)},"%Z":e=>e.va,"%%":()=>"%"};c=c.replace(/%%/g,"\x00\x00");for(q in n)c.includes(q)&&(c=c.replace(new RegExp(q,"g"),n[q](d)));c=c.replace(/\0\0/g,"%");q=Cb(c);if(q.length>
b)return 0;F.set(q,a);return q.length-1};Ha=h.InternalError=class extends Error{constructor(a){super(a);this.name="InternalError"}};for(var Eb=Array(256),Fb=0;256>Fb;++Fb)Eb[Fb]=String.fromCharCode(Fb);Ja=Eb;T=h.BindingError=class extends Error{constructor(a){super(a);this.name="BindingError"}};Object.assign(Ma.prototype,{get(a){return this.R[a]},has(a){return void 0!==this.R[a]},Y(a){var b=this.ba.pop()||this.R.length;this.R[b]=a;return b},Z(a){this.R[a]=void 0;this.ba.push(a)}});
U.R.push({value:void 0},{value:null},{value:!0},{value:!1});U.V=U.R.length;h.count_emval_handles=()=>{for(var a=0,b=U.V;b<U.R.length;++b)void 0!==U.R[b]&&++a;return a};
Ya=h.UnboundTypeError=((a,b)=>{var c=Qa(b,function(d){this.name=b;this.message=d;d=Error(d).stack;void 0!==d&&(this.stack=this.toString()+"\n"+d.replace(/^Error(:[^\n]*)?\n/,""))});c.prototype=Object.create(a.prototype);c.prototype.constructor=c;c.prototype.toString=function(){return void 0===this.message?this.name:`${this.name}: ${this.message}`};return c})(Error,"UnboundTypeError");
var Hb={b:(a,b,c)=>{(new Aa(a)).Y(b,c);Ba=a;Ca++;throw Ba;},A:a=>{var b=Da[a];delete Da[a];var c=b.na,d=b.oa,f=b.aa,g=f.map(l=>l.ka).concat(f.map(l=>l.qa));Ia([a],g,l=>{var k={};f.forEach((m,n)=>{var q=l[n],t=m.ia,u=m.ja,e=l[n+f.length],r=m.pa,p=m.ra;k[m.ha]={read:A=>q.fromWireType(t(u,A)),write:(A,D)=>{var H=[];r(p,A,e.toWireType(H,D));Ea(H)}}});return[{name:b.name,fromWireType:m=>{var n={},q;for(q in k)n[q]=k[q].read(m);d(m);return n},toWireType:(m,n)=>{for(var q in k)if(!(q in n))throw new TypeError(`Missing field: "${q}"`);
var t=c();for(q in k)k[q].write(t,n[q]);null!==m&&m.push(d,t);return t},argPackAdvance:8,readValueFromPointer:Fa,S:d}]})},r:()=>{},y:(a,b,c,d)=>{b=S(b);R(a,{name:b,fromWireType:function(f){return!!f},toWireType:function(f,g){return g?c:d},argPackAdvance:8,readValueFromPointer:function(f){return this.fromWireType(G[f])},S:null})},x:(a,b)=>{b=S(b);R(a,{name:b,fromWireType:c=>{var d=V(c);Na(c);return d},toWireType:(c,d)=>W(d),argPackAdvance:8,readValueFromPointer:Fa,S:null})},q:(a,b,c)=>{b=S(b);R(a,
{name:b,fromWireType:d=>d,toWireType:(d,f)=>f,argPackAdvance:8,readValueFromPointer:Oa(b,c),S:null})},n:(a,b,c,d,f,g,l)=>{var k=Ua(b,c);a=S(a);f=X(d,f);Ta(a,function(){ab(`Cannot call ${a} due to unbound types`,k)},b-1);Ia([],k,function(m){var n=[m[0],null].concat(m.slice(1)),q=m=a,t=f,u=n.length;if(2>u)throw new T("argTypes array size mismatch! Must at least get return value and 'this' types!");for(var e=null!==n[1]&&!1,r=!1,p=1;p<n.length;++p)if(null!==n[p]&&void 0===n[p].S){r=!0;break}var A="void"!==
n[0].name,D="",H="";for(p=0;p<u-2;++p)D+=(0!==p?", ":"")+"arg"+p,H+=(0!==p?", ":"")+"arg"+p+"Wired";q=`\n        return function ${Pa(q)}(${D}) {\n        if (arguments.length !== ${u-2}) {\n          throwBindingError('function ${q} called with ' + arguments.length + ' arguments, expected ${u-2}');\n        }`;r&&(q+="var destructors = [];\n");var hb=r?"destructors":"null";D="throwBindingError invoker fn runDestructors retType classParam".split(" ");t=[Ka,t,g,Ea,n[0],n[1]];e&&(q+="var thisWired = classParam.toWireType("+
hb+", this);\n");for(p=0;p<u-2;++p)q+="var arg"+p+"Wired = argType"+p+".toWireType("+hb+", arg"+p+"); // "+n[p+2].name+"\n",D.push("argType"+p),t.push(n[p+2]);e&&(H="thisWired"+(0<H.length?", ":"")+H);q+=(A||l?"var rv = ":"")+"invoker(fn"+(0<H.length?", ":"")+H+");\n";if(r)q+="runDestructors(destructors);\n";else for(p=e?1:2;p<n.length;++p)u=1===p?"thisWired":"arg"+(p-2)+"Wired",null!==n[p].S&&(q+=u+"_dtor("+u+"); // "+n[p].name+"\n",D.push(u+"_dtor"),t.push(n[p].S));A&&(q+="var ret = retType.fromWireType(rv);\nreturn ret;\n");
D.push(q+"}\n");n=Ra(D).apply(null,t);p=b-1;if(!h.hasOwnProperty(m))throw new Ha("Replacing nonexistant public symbol");void 0!==h[m].K&&void 0!==p?h[m].K[p]=n:(h[m]=n,h[m].ga=p);return[]})},g:(a,b,c,d,f)=>{b=S(b);-1===f&&(f=4294967295);f=k=>k;if(0===d){var g=32-8*c;f=k=>k<<g>>>g}var l=b.includes("unsigned")?function(k,m){return m>>>0}:function(k,m){return m};R(a,{name:b,fromWireType:f,toWireType:l,argPackAdvance:8,readValueFromPointer:bb(b,c,0!==d),S:null})},d:(a,b,c)=>{function d(g){return new f(F.buffer,
L[g+4>>2],L[g>>2])}var f=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][b];c=S(c);R(a,{name:c,fromWireType:d,argPackAdvance:8,readValueFromPointer:d},{la:!0})},p:(a,b)=>{b=S(b);var c="std::string"===b;R(a,{name:b,fromWireType:d=>{var f=L[d>>2],g=d+4;if(c)for(var l=g,k=0;k<=f;++k){var m=g+k;if(k==f||0==G[m]){l=l?gb(l,m-l):"";if(void 0===n)var n=l;else n+=String.fromCharCode(0),n+=l;l=m+1}}else{n=Array(f);for(k=0;k<f;++k)n[k]=String.fromCharCode(G[g+k]);
n=n.join("")}Y(d);return n},toWireType:(d,f)=>{f instanceof ArrayBuffer&&(f=new Uint8Array(f));var g="string"==typeof f;if(!(g||f instanceof Uint8Array||f instanceof Uint8ClampedArray||f instanceof Int8Array))throw new T("Cannot pass non-string to std::string");var l=c&&g?eb(f):f.length;var k=Gb(4+l+1),m=k+4;L[k>>2]=l;if(c&&g)db(f,G,m,l+1);else if(g)for(g=0;g<l;++g){var n=f.charCodeAt(g);if(255<n)throw Y(m),new T("String has UTF-16 code units that do not fit in 8 bits");G[m+g]=n}else for(g=0;g<l;++g)G[m+
g]=f[g];null!==d&&d.push(Y,k);return k},argPackAdvance:8,readValueFromPointer:cb,S:d=>Y(d)})},m:(a,b,c)=>{c=S(c);if(2===b){var d=jb;var f=kb;var g=lb;var l=()=>J;var k=1}else 4===b&&(d=mb,f=nb,g=ob,l=()=>L,k=2);R(a,{name:c,fromWireType:m=>{for(var n=L[m>>2],q=l(),t,u=m+4,e=0;e<=n;++e){var r=m+4+e*b;if(e==n||0==q[r>>k])u=d(u,r-u),void 0===t?t=u:(t+=String.fromCharCode(0),t+=u),u=r+b}Y(m);return t},toWireType:(m,n)=>{if("string"!=typeof n)throw new T(`Cannot pass non-string to C++ string type ${c}`);
var q=g(n),t=Gb(4+q+b);L[t>>2]=q>>k;f(n,t+4,q+b);null!==m&&m.push(Y,t);return t},argPackAdvance:8,readValueFromPointer:Fa,S:m=>Y(m)})},C:(a,b,c,d,f,g)=>{Da[a]={name:S(b),na:X(c,d),oa:X(f,g),aa:[]}},B:(a,b,c,d,f,g,l,k,m,n)=>{Da[a].aa.push({ha:S(b),ka:c,ia:X(d,f),ja:g,qa:l,pa:X(k,m),ra:n})},z:(a,b)=>{b=S(b);R(a,{ma:!0,name:b,argPackAdvance:0,fromWireType:()=>{},toWireType:()=>{}})},k:(a,b,c,d)=>{a=rb[a];b=V(b);c=qb(c);a(b,c,null,d)},a:Na,l:(a,b)=>{var c=ub(a,b),d=c[0];b=d.name+"_$"+c.slice(1).map(function(q){return q.name}).join("_")+
"$";var f=vb[b];if(void 0!==f)return f;f=["retType"];for(var g=[d],l="",k=0;k<a-1;++k)l+=(0!==k?", ":"")+"arg"+k,f.push("argType"+k),g.push(c[1+k]);var m="return function "+Pa("methodCaller_"+b)+"(handle, name, destructors, args) {\n",n=0;for(k=0;k<a-1;++k)m+="    var arg"+k+" = argType"+k+".readValueFromPointer(args"+(n?"+"+n:"")+");\n",n+=c[k+1].argPackAdvance;m+="    var rv = handle[name]("+l+");\n";for(k=0;k<a-1;++k)c[k+1].deleteObject&&(m+="    argType"+k+".deleteObject(arg"+k+");\n");d.ma||
(m+="    return retType.toWireType(destructors, rv);\n");f.push(m+"};\n");a=Ra(f).apply(null,g);f=sb(a);return vb[b]=f},f:a=>{4<a&&(U.get(a).da+=1)},i:()=>W([]),j:a=>W(qb(a)),h:()=>W({}),e:(a,b,c)=>{a=V(a);b=V(b);c=V(c);a[b]=c},c:(a,b)=>{a=tb(a,"_emval_take_value");a=a.readValueFromPointer(b);return W(a)},o:()=>{ia("")},w:(a,b,c)=>G.copyWithin(a,b,b+c),v:a=>{var b=G.length;a>>>=0;if(2147483648<a)return!1;for(var c=1;4>=c;c*=2){var d=b*(1+.2/c);d=Math.min(d,a+100663296);var f=Math;d=Math.max(a,d);
a:{f=(f.min.call(f,2147483648,d+(65536-d%65536)%65536)-E.buffer.byteLength+65535)/65536;try{E.grow(f);ma();var g=1;break a}catch(l){}g=void 0}if(g)return!0}return!1},t:(a,b)=>{var c=0;yb().forEach((d,f)=>{var g=b+c;f=L[a+4*f>>2]=g;for(g=0;g<d.length;++g)F[f++>>0]=d.charCodeAt(g);F[f>>0]=0;c+=d.length+1});return 0},u:(a,b)=>{var c=yb();L[a>>2]=c.length;var d=0;c.forEach(f=>d+=f.length+1);L[b>>2]=d;return 0},s:(a,b,c,d)=>Db(a,b,c,d)},Z=function(){function a(c){Z=c=c.exports;E=Z.D;ma();na=Z.H;pa.unshift(Z.E);
M--;h.monitorRunDependencies&&h.monitorRunDependencies(M);if(0==M&&(null!==sa&&(clearInterval(sa),sa=null),N)){var d=N;N=null;d()}return c}var b={a:Hb};M++;h.monitorRunDependencies&&h.monitorRunDependencies(M);if(h.instantiateWasm)try{return h.instantiateWasm(b,a)}catch(c){B(`Module.instantiateWasm callback failed with error: ${c}`),v(c)}ya(b,function(c){a(c.instance)}).catch(v);return{}}(),Gb=a=>(Gb=Z.F)(a),Y=a=>(Y=Z.G)(a),Za=a=>(Za=Z.I)(a);
h.__embind_initialize_bindings=()=>(h.__embind_initialize_bindings=Z.J)();h.dynCall_viijii=(a,b,c,d,f,g,l)=>(h.dynCall_viijii=Z.L)(a,b,c,d,f,g,l);h.dynCall_iiiiij=(a,b,c,d,f,g,l)=>(h.dynCall_iiiiij=Z.M)(a,b,c,d,f,g,l);h.dynCall_iiiiijj=(a,b,c,d,f,g,l,k,m)=>(h.dynCall_iiiiijj=Z.N)(a,b,c,d,f,g,l,k,m);h.dynCall_iiiiiijj=(a,b,c,d,f,g,l,k,m,n)=>(h.dynCall_iiiiiijj=Z.O)(a,b,c,d,f,g,l,k,m,n);var Ib;N=function Jb(){Ib||Kb();Ib||(N=Jb)};
function Kb(){function a(){if(!Ib&&(Ib=!0,h.calledRun=!0,!ja)){za(pa);aa(h);if(h.onRuntimeInitialized)h.onRuntimeInitialized();if(h.postRun)for("function"==typeof h.postRun&&(h.postRun=[h.postRun]);h.postRun.length;){var b=h.postRun.shift();qa.unshift(b)}za(qa)}}if(!(0<M)){if(h.preRun)for("function"==typeof h.preRun&&(h.preRun=[h.preRun]);h.preRun.length;)ra();za(oa);0<M||(h.setStatus?(h.setStatus("Running..."),setTimeout(function(){setTimeout(function(){h.setStatus("")},1);a()},1)):a())}}
if(h.preInit)for("function"==typeof h.preInit&&(h.preInit=[h.preInit]);0<h.preInit.length;)h.preInit.pop()();Kb();


  return moduleArg.ready
}

);
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = camaro;
else if (typeof define === 'function' && define['amd'])
  define([], () => camaro);
