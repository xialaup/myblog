---
title: 净化 b 站环境一键脚本
---

# 净化 b 站环境一键脚本

<vue-metadata author="swwind" time="2021-4-4" tags="javascript"></vue-metadata>

> b 站以陈睿的一句“b 站未来有可能会倒闭，但绝对不会变质”为嚆矢。滥觞于 ACG 的期望正失去它们的借鉴意义。但面对看似无垠的未来天空，我想循卡尔维诺“树上的男爵”的生活好过过早地振翮。
>
> 我们怀揣热忱的灵魂天然被赋予对正版番剧的追求，不屑于广电总局的约束，钟情于在别处的芬芳。但当这种期望流于对敏感内容不假思索的批判，乃至走向圣光与暗牧主义时，便值得警惕了。与秩序的落差、错位向来不能为越矩的行为张本。而纵然我们已有翔实的蓝图，仍不能自持已在浪潮之巅立下了自己的沉锚。
>
> “我认为教育小孩‘世界上没有黑暗’是一件非常糟糕的事情。”虚渊玄之言可谓切中了肯綮。人的社会性是不可祓除的，而我们欲上青云也无时无刻不在因风借力。社会与家庭暂且被我们把握为一个薄脊的符号客体，一定程度上是因为我们尚缺乏体验与阅历去支撑自己的认知。而这种偏见的傲慢更远在知性的傲慢之上。
>
> 在孜孜矻矻以求生活意义的追番路上，对自己的期望本就是在与家庭与社会对接中塑型的动态过程。而我们的底料便是对不同生活方式、不同角色的觉感与体认。国家队的广自幼结识了 02，与其一同操控鹤望兰，最终拯救了地球。他的生活观念是厚实的，也是实践的。倘若我们在对一些福利镜头借广电之言“和谐”后，又对不断自我审查的 b 站进行“干杯”，那么在丢失外界预期的同时，未尝也不是丢了自我。
>
> 毫无疑问，从家庭与社会角度一觇的日本动漫有偏狭过时的成分。但我们所应摒弃的不是对此的批判，而是其批判的廉价，其对批判投诚中的反智倾向。在尼采的观念中，如果在成为狮子与孩子之前，略去了像骆驼一样背负前人遗产的过程，那其“永远重复”洵不能成立。何况当矿工诗人陈年喜顺从编辑的意愿，选择写迎合读者的都市小说，将他十六年的地底生涯降格为桥段素材时，我们没资格斥之以媚俗。
>
> 蓝图上的落差终归只是理念上的区分，在实践场域的分野也未必明晰。譬如当我们追寻心之所向时，在途中涉足权力的玉墀，这究竟是伴随着期望的泯灭还是期望的达成？在我们看番的同时，番剧也在浇铸我们。既不可否认原生的家庭性与社会性，又承认自己的图景有轻狂的失真，不妨让体验走在言语之前。用不被禁锢的头脑去体味切斯瓦夫·米沃什的大海与风帆，并效维特根斯坦之言，对无法言说之事保持沉默。
>
> 用在树上的生活方式体现个体的超越性，保持婞直却又不拘泥于所谓“遗世独立”的单向度形象。这便是卡尔维诺为我们提供的理想期望范式。生活在树上——始终热爱大地——升上天空。

此脚本功能：屏蔽所有弹幕和评论(动态除外)，并且封锁 b 站番剧区。

特殊情况可以按 `ctrl+z` 重新显示弹幕和评论。

```js
// ==UserScript==
// @name         净化 b 站，世界清净
// @namespace    https://www.bilibili.com/
// @version      0.1
// @description  fuck bilibili
// @author       swwind
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/play/ss*
// @match        https://www.bilibili.com/bangumi/play/ep*
// @grant        none
// ==/UserScript==

// 大幅改善 b 站使用体验

(function () {
  "use strict";

  var style;

  var mount = () => {
    style = document.createElement("style");
    style.innerHTML =
      "#comment,.media-rating,.review-module,.comment-wrapper,.bilibili-player-video-danmaku{opacity:0;}";
    document.body.appendChild(style);
  };

  var unmount = () => {
    if (style) style.remove();
    style = null;
  };

  mount();

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.code === "KeyZ") {
      if (style) unmount();
      else mount();
    }
  });

  if (location.pathname.startsWith("/bangumi/play/")) {
    document.write("<h1><b>DO NOT WATCH BANGUMI ON BILIBILI</b></h1>");
  }
})();
```
