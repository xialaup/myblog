---
title: SWC 食用指南
---

# SWC 食用指南

<vue-metadata author="swwind" time="2024-7-8"></vue-metadata>

[SWC][swc] 是一个由 Rust 语言编写的 JavaScript / TypeScript 源代码的解析、打包工具。功能上比较类似 Babel 项目，但是在性能上会比 Babel 快很多。

很多时候我会希望用它来从抽象语法树的层面来对生成的一些 JavaScript 代码做点修改，但该项目的文档让我感觉到非常混乱，而且也鲜有样例代码，使用起来非常痛苦。

因此我会将我折腾的有关代码解析、转译的有关内容写在这里，你们可以借鉴我的经验，自己看着办。

注意：本文不会接触到与 SWC 打包功能相关的内容，因为我觉得这个功能没什么卵用。

## 基础使用之 Rust 部分

SWC 项目主要使用 Rust 语言编写，我们可以直接在 Rust 里面使用该工具。

```sh
cargo add swc_core --features common,ecma_ast,ecma_parser,ecma_visit,ecma_transforms,ecma_codegen
```

之后可以开始编写代码来实现我们需要的功能。

### 解析代码生成 AST

首先是将源代码转换成 AST 的部分。

```rust
let cm = Rc::new(SourceMap::default());
let fm = cm.new_source_file(FileName::Custom("input.js".to_string()), source.to_string());

let comments = SingleThreadedComments::default();
let lexer = Lexer::new(
  Syntax::Es(EsSyntax::default()),
  EsVersion::EsNext,
  SourceFileInput::from(&*fm),
  Some(&comments),
);

let mut parser = Parser::new_from(lexer);

let mut module = parser.parse_module().unwrap(); // 如果是 ES Module
// let mut script = parser.parse_script().unwrap(); // 如果不是
// let mut program = parser.parse_program().unwrap(); // 如果你不知道

// do something with AST...
```

我也不知道上面的代码发生了什么，但是复制粘贴过来就可以用了。

此外，SWC 也有一个重要的概念，即为 SyntaxContext，用来区分不同上下文中的标识符是否为同一个引用。具体来说，每一个标识符（Identifier）都会自带一个 SyntaxContext 序号，如果标识符名称和 SyntaxContext 序号都一致，那么才可以断定为同一个引用。

```rust
let ident = Ident::new(Atom::from("x"), Span::dummy());
ident.to_string(); // "x#0"
ident.sym.to_string(); // "x"
ident.span.ctxt; // SyntaxContext(0)
```

```js
let x = 1; // x#0
{
  let x = 2; // x#1
}
console.log(x); // x#0
```

**但注意的是，上面给出的解析代码并不会自动计算 SyntaxContext 的值，你需要使用下面的代码来手动计算 SyntaxContext。**

```rust
let globals = Globals::new();
GLOBALS.set(&globals, || {
  let mut resolver = resolver(Mark::new(), Mark::new(), false);
  module.visit_mut_with(&mut resolver);
});
```

### 遍历 AST

遍历 AST 是最基本的操作，在 SWC 中相关的就是 Visitor 的概念了。

Visitor 本质实际上就是对 AST 的递归搜索，通过这种方式在代码中寻找匹配的内容，或者做出修改。

Visitor 可以通过实现 `Visit`、`VisitMut` 或者 `Fold` 特征来定义。

三者之间的主要区别是

- `Visit` 以不可变借用遍历节点，不需要返回值；
- `VisitMut` 以可变借用遍历节点，不需要返回值；
- `Fold` 以转移所有权方式遍历节点，并将节点替换为返回值。

可以使用 `as_folder` 函数将实现了 `Visit` / `VisitMut` 的 Visitor 转换成 `Fold`。

<!-- `impl Fold` 也被称为 pass，你可能会在其他地方看到这个名词。 -->

在实现 Visitor 时候，可以用下面几个宏定义来跳过 TypeScript 有关节点的遍历，来优化程序性能。

- `noop_fold_type!();` - 适用于 `Fold`
- `noop_visit_type!();` - 适用于 `Visit`
- `noop_visit_mut_type!();` - 适用于 `VisitMut`

使用方式如下

```rust
// 定义一个访问者
#[derive(Default)]
struct TransformVisitor {
  id: Vec<String>,
}

// 实现 Visit 特征
impl Visit for TransformVisitor {
  noop_visit_type!();

  fn visit_ident(&mut self, n: &Ident) {
    self.id.push(n.sym.to_string());
    // n.visit_children_with(self); // 如果要遍历子节点
  }
}

// 然后用
let mut visitor = TransformVisitor::default();
module.visit_with(&mut visitor); // 遍历语法树
// visitor.id => 即为程序中的所有 ident
```

### 生成代码

最后便是生成代码的部分了，也没有什么好说的，直接复制粘贴就好了

```rust
let mut buf = vec![];
{
  let mut emitter = Emitter {
    cfg: Default::default(),
    cm: cm.clone(),
    comments: Some(&comments),
    wr: JsWriter::new(cm, "\n", &mut buf, None),
  };
  emitter.emit_module(&module).unwrap()
}
String::from_utf8_lossy(&buf).to_string()
```

至此你已经学会了如何用 Rust 编写 SWC 程序了！可喜可贺。

### 测试

官方有几个宏定义专门用来帮你写测试用的，可以省去很多麻烦。

```rust
#[cfg(test)]
mod test {
  use swc_core::ecma::{transforms::testing::test_inline, visit::as_folder};
  use crate::TransformVisitor;

  test_inline!(
    Default::default(),
    |_| as_folder(TransformVisitor::default()),
    visitor_should_not_change_console_log,
    r#"console.log("hello world");"#,
    r#"console.log("hello world");"#
  );
}
```

## 基础使用之 NodeJS 部分

虽然上面的东西有点复杂，但实际上官方已经帮我们解决了大部分麻烦事了。

我们可以直接用 npm 仓库中的 `@swc/core` 模块来实现大部分我们希望的操作。

```sh
npm i @swc/core
```

这个模块提供了许多函数，主要包括

1. `parse` 函数用来从源代码解析成 AST；
2. `print` 函数用来从 AST 转换回源代码；
3. `transform` 函数用来直接从源代码应用若干变换，直接生成目标代码；
4. `minify` 函数用来压缩代码（我没用过）；
5. `bundle` 函数用来打包代码（我没用过）。

我们主要关心 `parse`、`print` 和 `transform` 三个函数。

### parse 函数和 print 函数

顾名思义，`parse` 函数用来实现从源代码到 AST 的转换过程，并且会返回一个类型丰富的 Js 对象。

例如，如果想要解析一份 Js 代码，并根据 AST 树查找一些固定的匹配，比起使用正则表达式，你可以这么写

```js
import { parse } from "@swc/core";

const source = `
const a = func(114514);
export const b = (0, func)(114514);
export const c = 1, d = func(114514);
console.log("export const e = func(114514);");
`;

const ast = await parse(source, {
  syntax: "ecmascript", // ecmascript / typescript
  jsx: false, // 是否启用 jsx / tsx 标准
  // isModule: false, // 如果不是 ES Module 就要写 false
});

for (const item of ast.body) {
  // 找到所有的 export const/let/var ...
  if (
    item.type === "ExportDeclaration" &&
    item.declaration.type === "VariableDeclaration"
  ) {
    for (const decl of item.declaration.declarations) {
      // 找到所有的 export const name = ...
      if (decl.id.type === "Identifier") {
        const name = decl.id.value;
        // 找到所有的 export const name = func(...)
        if (
          decl.init &&
          decl.init.type === "CallExpression" &&
          decl.init.callee.type === "Identifier" &&
          decl.init.callee.value === "func"
        ) {
          // 将找到的结果输出
          console.log(`found: ${name}`);
        }
      }
    }
  }
}
```

执行上面的代码，可以得到下面的输出。

```
found: d
```

进一步修改，我们在找到结果的同时修改 AST 代码树。

```js
// 将找到的结果输出
// console.log(`found: ${name}`);

// 将原来的函数套一层 __my_transform(xxx, null);
const old = decl.init;
decl.init = {
  type: "CallExpression",
  callee: {
    type: "Identifier",
    value: "__my_transform",
    span: { start: 0, end: 0, ctxt: 0 },
  },
  arguments: [
    { expression: old },
    {
      expression: {
        type: "NullLiteral",
        span: { start: 0, end: 0, ctxt: 0 },
      },
    },
  ],
  span: { start: 0, end: 0, ctxt: 0 },
};

// =====

// 最后使用 print 函数将 AST 变为 Js 代码
const { code } = await print(ast);
console.log(code);
```

最后你可以看到如下的输出。

```js
const a = func(114514);
export const b = (0, func)(114514);
export const c = 1,
  d = __my_transform(func(114514), null);
console.log("export const e = func(114514);");
```

<!-- 我们可以利用该对象在 Js 中实现简单的代码中查找匹配，进行替换等操作。 -->
<!-- 值得注意的是，该函数返回的 AST 类型是从 `@swc/core` 中导出的一套兼容 TypeScript 和 JSX 等扩展标准的类型声明，与其他某些工具使用的 `estree` 标准的 AST 类型不兼容。 -->

这便是关于 `parse` 函数和 `print` 函数的最简单使用方式。

<!-- 但是实际上如果想要实现上述的功能，从官方意见来说还是更加建议使用下文的 `transform` 函数和编写插件的方式，这在时间效率上比这种方式优秀。 -->

注意，上面展示的方式仅是对 `parse` 和 `print` 函数使用方法的说明。
在实际生产中，建议直接使用 `transform` 函数来将源代码直接转换成目标代码。
`parse` 函数会在把 AST 从 Rust 转换成 Js 对象的时候产生严重的性能损失，
`print` 函数也会在把 AST 从 Js 对象转换成 Rust 的时候耗费大量时间，
因此只适合一些简单测试或者仅需要将代码转换成 AST 分析的场景。

### transform 函数

`transform` 函数的作用是直接读取源代码，和一些需要应用的变换过程（使用插件系统），在 Rust 内部直接完成从源代码到最终代码的转换流程。
这将会省去大部分 Rust 程序与 Js 代码之间相互转换的性能开销，从而获得最高效的性能体验。

这里以我自己开发的一个 `@swwind/treeshake-events` 插件作为样例来展示 `transform` 的使用方法。

```js
import { transform } from "@swc/core";
import treeshakeEvents from "@swwind/treeshake-events";

const source = `
import { jsx as _jsx } from "preact/jsx-runtime";
_jsx("div", {
  id: "app",
  onClick: () => console.log(114514)
});
`;

const { code } = await transform(source, {
  jsc: {
    parser: {
      syntax: "ecmascript",
      jsx: false,
    },
    experimental: {
      plugins: [treeshakeEvents()],
    },
    target: "esnext",
    preserveAllComments: true, // 保留所有的注释
  },
  isModule: true,
  // sourceMaps: "inline", // 如果你要 source map
});

console.log(code);
```

执行程序，可以看到生成的最终代码如下。

```
import { jsx as _jsx } from "preact/jsx-runtime";
_jsx("div", {
    id: "app"
});
```

这便是 `transform` 函数的基本使用方法。

值得注意的是，`transform` 是唯一可以在结果中保留源程序中注释的方式，因为技术原因，注释相关的内容会在 `parse` 函数将 AST 从 Rust 转换成 Js 对象的时候丢失。

此外，使用 `transform` 函数也可以很好地生成 source map 等信息，因此在有条件使用 `transform` 函数的时候应当尽量选择这种解决方案。

### 遍历 AST

经常用 Babel 的朋友都知道，Babel 一般是用 `@babel/traverse` 来对生成的 AST 进行遍历的。

SWC 在这方面则比较微妙，因为惜字如金的官方文档里面只有用 Rust 进行树遍历的说明和样例。

但如果我一定要用 Js 进行遍历呢？其实也不是不行。SWC 有一套官方的玩意可以用来给你干这个。

```js
// 奇怪的入口地址
import { Visitor } from "@swc/core/Visitor.js";
import { parse } from "@swc/core";

const source = `
const a = func(114514);
export const b = (0, func)(114514);
export const c = 1, d = func(114514);
console.log("export const e = func(114514);");
`;

const ast = await parse(source, { syntax: "ecmascript", jsx: false });

// 使用继承的方式来 override 自定义 visit 函数，需要返回修改后的节点（所以实际上可能是 Fold）
class MyVisitor extends Visitor {
  // 重载函数表示覆盖默认行为
  visitIdentifier(id) {
    console.log(`identifier = ${id.value}`);
    return id;
  }
  // 如果没有重载函数，默认就是递归访问 children 的逻辑
  visitProgram(program) {
    // 当然也可以使用 super 来手动调用访问 children 的逻辑
    return super.visitProgram(program);
  }
}

// 最后直接这么用就好了
const visitor = new MyVisitor();
const newAst = visitor.visitProgram(ast);
// console.log(print(newAst)); // 如果你要再转换成 Js
```

这样将会输出下面的内容

```
identifier = a
identifier = func
identifier = b
identifier = func
identifier = c
identifier = d
identifier = func
identifier = console
identifier = log
```

## 插件开发

SWC 的插件还是比较实验性的内容，因此接口之类的可能会发生变化。

目前来讲编写 SWC 插件只推荐使用 Rust 语言，并且编译成 wasm 来使用。

在开发插件之前，你需要熟悉 Rust 相关技术，以及确定使用的 `@swc/core` 包和 crates.io 里面的 `swc_core` 版本一致（版本对照表可以参考[这个链接](https://swc.rs/docs/plugin/selecting-swc-core#swc_core)）。

首先需要安装编译成 `wasm32-wasi` 目标的 Rust 工具链，可以使用下面的指令添加（使用 `rustup`）。

```sh
rustup target add wasm32-wasi
```

之后，你可以使用下面的指令创建一个简单的插件模板。

```sh
npx swc plugin new --target-type wasm32-wasi my-first-plugin
```

### Rust 部分

首先我们观察生成的 `src/lib.rs` 文件，可以看到如下的内容。

```rust
struct TransformVisitor;

impl Visit for TransformVisitor {
    // TODO
}

#[plugin_transform]
pub fn process_transform(
    program: Program,
    _metadata: TransformPluginProgramMetadata,
) -> Program {
    program.visit_with(&mut TransformVisitor);

    program
}
```

可以看到，插件的实际运行函数应该就是 `process_transform`，并且在默认的代码使用了 `TransformVisitor` 进行了遍历操作。

因此，我们只需要实现自己的 Visitor，然后用它来对输入的 Program 进行修改再返回就可以了。

但你可能会好奇如何读取插件的配置信息，因为 SWC 文档里面完全没有提到这个。

目前来说，SWC 在使用插件的时候都强制需要写配置选项，并且选项在传入 Rust 过程中会使用 JSON 格式编码，需要插件自己解码。

在 Rust 中实现 JSON 解码过程，一般需要用 `serde_json` 相关的库。

```sh
cargo add serde --features derive
cargo add serde_json
```

之后在代码中从 `metadata` 中获取配置信息。

```rust
#[derive(Deserialize)]
struct TransformConfig {
  #[serde(default = "default_jsxs")]
  jsxs: Vec<String>, // 默认值使用 default_jsxs 函数生成
  #[serde(default = "default_matches")]
  matches: Vec<String>, // 默认值使用 default_matches 函数生成
}

fn default_jsxs() -> Vec<String> {
  vec![
    String::from("jsx"),
    String::from("jsxs"),
    String::from("jsxDEV"),
  ]
}

fn default_matches() -> Vec<String> {
  vec![String::from("^on[A-Z]")]
}

impl Default for TransformConfig {
  fn default() -> Self {
    Self {
      jsxs: default_jsxs(),
      matches: default_matches(),
    }
  }
}

#[plugin_transform]
pub fn process_transform(
  mut program: Program,
  metadata: TransformPluginProgramMetadata,
) -> Program {
  let config = metadata
    .get_transform_plugin_config()
    .and_then(|x| Some(serde_json::from_str::<TransformConfig>(&x).unwrap()))
    .unwrap_or_default();

  // 通过 config 来初始化我们的 Visitor
  program.visit_mut_with(&mut TransformVisitor::from_config(config));

  program
}
```

最后和上面一样写测试就好了。

### 编译成 wasm

在你初始化插件的时候，SWC 应该会自动帮你添加一个 `.cargo/config` 文件，里面有如下内容。

```toml
# 几个缩写指令
[alias]
build-wasi = "build --target wasm32-wasi"
build-wasm32 = "build --target wasm32-unknown-unknown"
```

此外，需要手动编辑 `Cargo.toml` 文件，添加如下内容，开启编译器的最大优化。

```toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
strip = "symbols"
```

最后直接使用 `cargo build-wasi --release` 进行编译，就可以在 `target/wasm32-wasi/release/` 中找到生成的 wasm 文件。

### 导出设置

为了方便，我们在构建之后将 wasm 文件拷贝到项目根目录下面。编辑 `package.json`，添加下面的几个 script。

```json
{
  "scripts": {
    "build": "cargo build-wasi --release && cp target/wasm32-wasi/release/my_transform_plugin.wasm .",
    "prepublishOnly": "npm run build"
  }
}
```

之后，你要做的就是将 wasm 的文件地址导出给 SWC 就行了。

#### 官方方案

官方的方案是，编辑 `package.json` 文件，在其中的 `main` 字段中填入 wasm 文件的路径。

```json
{
  "main": "./my_transform_plugin.wasm"
}
```

之后在使用的时候直接给出包名和配置即可。

```js
await transform(code, {
  jsc: {
    experimental: {
      plugins: [["my-transform-plugin", {}]],
    },
  },
});
```

但是这套方案有个非常致命的问题，就是只能在 npm 包管理器下面工作。

SWC 目前的依赖查找算法比较原始，只会去 node_modules 里面找文件，于是这套方案在 pnpm 和 yarn pnp 下面就会因为找不到目标文件而报错。

因此，我建议使用下面的解决方案。

#### 我的方案

我的方案是使用脚本返回 wasm 路径，这样就可以更友好地支持所有包管理器，并且能够引入配置选项的 TypeScript 类型。

手动添加三个文件。

```js
// index.cjs
const path = require("node:path");
const wasmPath = path.join(__dirname, "./my_transform_plugin.wasm");
module.exports = {
  wasm: wasmPath,
  default: function (options) {
    return [wasmPath, options || {}];
  },
};
```

```js
// index.mjs
import { fileURLToPath } from "node:url";
export const wasm = fileURLToPath(
  new URL("./my_transform_plugin.wasm", import.meta.url),
);
export default function (options) {
  return [wasm, options || {}];
}
```

```ts
// index.d.ts
export interface PluginOptions {
  jsxs?: string[];
  matches?: string[];
}
export declare const wasm: string;
declare function plugin(
  options?: PluginOptions | undefined,
): [string, PluginOptions];
export default plugin;
```

最后在 `package.json` 中添加下面的字段。

```json
{
  "main": "./index.cjs",
  "types": "./index.d.ts",
  "module": "./index.mjs",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  }
}
```

最后就可以随便用了，类型什么的都有，用起来不要太爽。

```js
import plugin from "my-transform-plugin";

await transform(code, {
  jsc: {
    experimental: {
      plugins: [plugin()],
    },
  },
});
```

## 告诫

不要想着靠 SWC 去改变什么，你什么都做不到的。

## 评论

<vue-reactions path="swc-intro"></vue-reactions>

[swc]: https://swc.rs/
