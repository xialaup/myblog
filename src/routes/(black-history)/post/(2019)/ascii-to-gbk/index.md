---
title: GBK 乱码问题
---

# GBK 乱码问题

<vue-metadata author="swwind" time="2019-2-1"></vue-metadata>

最近在网上下载了一个压缩包，据说密码写在压缩包注释中。

我的解压软件可爱地把压缩包的注释告诉了我：

```
Comment =
½âÑ¹ÃÜÂë£ºJune
```

我沉默了。。。

那么我们就来聊一聊 GBK 乱码的解决方法。

好吧，其实简单的不得了。

```js
const source = "½âÑ¹ÃÜÂë£ºJune";
const array = new Uint8Array(source.split([]).map((c) => c.charCodeAt(0)));
console.log(new TextDecoder("GBK").decode(array));
// => "解压密码：June"
```
