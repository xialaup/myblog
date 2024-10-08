---
title: QuickJS 尝鲜
---

# QuickJS 尝鲜

<vue-metadata author="swwind" time="2019-7-17" tags="javascript,quickjs"></vue-metadata>

QuickJS 是 Fabrice Bellard 大神于 2019 年 7 月 9 日突然发布的一个 js 引擎，据说堪比 V8。

于是我想看看这玩意究竟怎么样。

# 安装

## Arch Linux

```bash
pikaur -S quickjs
```

## 其他

[自己找](https://bellard.org/quickjs/)

# 基本功能

## 运行和编译

先创建 `./hello.js`。

```js
const a = 0.1;
const b = 0.2;
console.log(a + b);
```

直接运行：

```bash
$ qjs hello.js
0.30000000000000004
```

编译后运行：

```bash
$ qjsc -o hello hello.js
$ ./hello
0.30000000000000004
```

编译出来有 3.6MiB。

## async/await

```js
const wait = async () => {
  console.log("wait");
};

const main = async () => {
  console.log("main");

  await wait();

  console.log("main finished");
};

main();

console.log("invoked main");
```

```bash
$ qjs hello.js
main
wait
invoked main
main finished
```

## ES6 模块支持

使用 `qjs -m hello.js` 或者将文件后缀名改为 `.mjs`，即可以使用 `import` 和 `export` 了。

据说还能支持 dynamical import。(?)

```js
// ./module.js
export default "2333";
```

```js
// ./hello.js
import module from "./module.js";
console.log(module);
```

```bash
$ qjs -m hello.js
2333
```

关于模块的解析，介绍中说道：

- 以 `.` 或者 `..` 开头的是当前目录下的文件；
- 不以 `.` 或者 `..` 开头的是系统模块；
- 以 `.so` 结尾的是用 QuickJS C API 的本地模块。

目前有两个系统模块：`std` 和 `os`。

看了看 `std` 的 [API](https://bellard.org/quickjs/quickjs.html#std-module)，卧槽怎么和 C/C++ 的 API 这么像的呢。。。

```js
import * as std from "std";

std.printf("%s is my waifu\n", "Emilia");
```

```bash
$ qjs -m hello.js
Emilia is my waifu
```

但是 `printf` 似乎无法处理 `%.2f` 的小数位数。(?)

对于 `.so` 后缀的模块，可能是 C 语言模块？可以用 C 语言来写 JS 的模块了？

# 运行效率

让我们跑一个 1e8 的累加。

```js
let sum = 0;
for (let i = 0; i < 1e8; ++i) {
  sum += i;
}

console.log(sum);
```

```bash
$ time qjs hello.js
4999999950000000
qjs hello.js  2.95s user 0.00s system 99% cpu 2.955 total
qjs hello.js  2.89s user 0.00s system 99% cpu 2.892 total
qjs hello.js  2.89s user 0.01s system 99% cpu 2.901 total
qjs hello.js  2.89s user 0.00s system 99% cpu 2.901 total
qjs hello.js  2.88s user 0.00s system 99% cpu 2.883 total

$ qjsc -o hello hello.js
$ time ./hello
4999999950000000
./hello  3.01s user 0.00s system 99% cpu 3.019 total
./hello  2.93s user 0.00s system 99% cpu 2.936 total
./hello  2.91s user 0.01s system 99% cpu 2.923 total
./hello  2.92s user 0.00s system 99% cpu 2.927 total
./hello  2.88s user 0.04s system 98% cpu 2.950 total

$ time node hello.js
node hello.js  0.24s user 0.03s system 98% cpu 0.274 total
node hello.js  0.19s user 0.03s system 98% cpu 0.217 total
node hello.js  0.20s user 0.02s system 99% cpu 0.214 total
node hello.js  0.19s user 0.03s system 99% cpu 0.218 total
node hello.js  0.20s user 0.01s system 99% cpu 0.216 total
```

如此一看发现 QuickJS 其实也没怎么优秀。

而且刚刚我在实验的时候又发现了一堆 bug：

- `console.log` 第一个参数无法作为 format string
- `console.time` 不见踪影
- 编译之后 `Date` 对象也不见踪影（直接运行是有的
- ......

# 总结

新东西嘛，我们不能马上就对它要求太高。

目前来讲能够直接编译就已经是 V8 无可比拟的优点了。

我们要用发展的眼光看问题，物质是运动的，运动是永恒的、绝对的。

原作者同时也是 ffmpeg 的作者，说明其能力也是世界一流的。

所以我相信，也许过不了几年，QuickJS 真的能成为抗衡 V8 的另一大 JS 引擎。

<p>
  <span class="truth" title="你知道的太多了">
    {"可能 Lua 真的要凉了"}
  </span>
</p>
