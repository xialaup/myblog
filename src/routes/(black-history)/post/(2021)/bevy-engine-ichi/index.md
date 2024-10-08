---
title: Bevy 引擎游戏开发简介（上）
---

# Bevy 引擎游戏开发简介（上）

<vue-metadata author="swwind" time="2021-10-13" tags="rust,bevy"></vue-metadata>

Bevy Engine 是一个基于 ECS 构架的 Rust 游戏引擎，内置了大部分实用的特性，个人认为比定位相同的 Amethyist 引擎要更加易用一些。

本文简要介绍一下该引擎的一些理念和代码。

_注意：bevy 引擎还处于早期开发阶段，也就是说许多接口可能随时会产生变化。截止本文发表，Bevy 引擎的最后 Release 版本为 0.5.0，本文采用的是 github 上的最新开发版，因此某些地方可能同时兼有 0.6.0 和 0.5.0 的特性，具体可以自行查询文档_

**_注意：本文中给出的代码均为示意代码，也许大部分并不能直接运行_**

## ECS

ECS 构架，即 Entity-Component-System（实体-组件-系统）构架，相比较于传统 OOP 来讲耦合度更加小，也在一些设定复杂的游戏机制下能够有更好的性能和可读性。

简单来说，ECS 构架中，实体(Entity)是若干个组件(Component)构成的集合，而世界(World)便是由所有的实体构成的集合。系统(System)则是可以对世界中所有或某些同时含有若干个特定组件的对象统一进行调整的函数。

换句话说，可以将世界想象成一个数据表，每条记录是一个实体，每个字段则是一个组件。

| Entity | Velocity | Position |
| ------ | -------- | -------- |
| 1      | (1, 0)   | (0, 0)   |
| 2      | (0, 1)   | (2, 0)   |
| 3      |          | (1, 1)   |

如上表，一个实体含有 Position 组件，则代表该实体拥有位置的属性。含有 Velocity 组件，则代表实体拥有移动速度的属性。

移动物理系统则可以抽象为对于所有同时含有 Velocity 字段和 Position 字段的对象执行移动的操作。

用直觉感受一下下面的代码。

```rust
struct Position(Vec2);
struct Velocity(Vec2);

fn movement(
  mut query: Query<(&Velocity, &mut Position)>
) {
  // 枚举每一个符合条件的 Entity
  for (velocity, mut position) in query.iter_mut() {
    // 将对象的 Position 加上 Velocity
    position.0 += velocity.0;
  }
}
```

如上，`movement` 函数便是一个正常的系统。

将系统添加到游戏中，则需要使用 `App::add_system(&mut self, system: System)` 方法。

```rust
use bevy::prelude::*;

fn main() {
  App::new()
    .add_system(movement)
    .run()
}
```

想要从中加入实体，我们可以让系统带一个 `mut commands: Commands` 参数。

```rust
fn add_entity(
  mut commands: Commands
) {
  commands.spawn() // 创建一个实体
    .insert(Velocity(Vec2::new(1, 0)))  // 给实体添加组件
    .insert(Position(Vec2::new(0, 0)));

  commands.spawn()
    // 或者一口气加多个
    .insert_bundle((Velocity(Vec2::new(1, 0)), Position(Vec2::new(0, 0))));

  // 或者直接这样
  commands.spawn_bundle((Velocity(Vec2::new(1, 0)), Position(Vec2::new(0, 0))));
}
```

之后使用 `add_startup_system` 来使系统只在最初运行一次。

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins) // bevy engine
    .add_startup_system(add_entity) // startup system
    .add_system(movement) // normal system
    .run(); // launch the game
}
```

在解释 `Commands` 参数的工作原理前，我们先了解一些 bevy 引擎的特性。

## Stage / SystemLabel

Stage 和 SystemLabel 是用来严格定义系统运行顺序的特性。

一般情况下 bevy 会使用多线程来优化程序运行的效率，其中就包括同时运行好几个不同的系统。

所有被注册过的系统都会在保证任意组件不会被同时进行多次可变借用的前提下尽可能地同时运行。

然而有些情况下系统有一个更加基本的先后顺序，如果没有事先定义这些系统的先后顺序，就有可能导致产生一些不稳定的输出。

这时候我们就需要使用 Stage / SystemLabel 的特性。

SystemLabel 是可以用来给系统打上的标签类型，可以使用 `.before` 和 `.after` 来快速定义系统的运行顺序。

```rust
fn update_velocity() { ... } // update velocity according to user's input (etc.)
fn update_position() { ... } // update position according to its velocity

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_system(update_velocity.label("velocity"))
    .add_system(update_position.after("velocity"))
    .run();
}
```

如果需要管理的系统和顺序比较多，则可以使用 SystemSet 来统一定义，并且使用实现了 SystemLabel 的 enum 类型。

```rust
#[derive(SystemLabel)]
enum PhysicalLabel {
  UpdateVelocity,
  UpdatePosition,
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_system_set(
   	  SystemSet::new()
        .label(PhysicalLabel::UpdateVelocity)
        .with_system(update_velocity_according_to_user_input)
        .with_system(update_velocity_according_to_game_logic)
    )
    .add_system_set(
   	  SystemSet::new()
        .label(PhysicalLabel::UpdatePosition)
        .after(PhysicalLabel::UpdateVelocity)
        .with_system(update_position)
    )
    .run();
}
```

注意，在使用 `before` 和 `after` 函数时，必须保证最终形成的顺序图是个 DAG（有向无环图），否则引擎将会报错。

与 SystemLabel 定义顺序的方式不同，Stage 则是一个更加底层的概念。

一般来说，在系统运行时对组件的内容进行修改并不会造成什么其他问题，但是如果需要对实体本身或者组件进行删改操作，则会对其他同时运行的系统产生难以预测的影响。

因此 bevy 引擎使用了 `Commands` 在系统运行的时候记录下这些更改，而将真正的操作留到当前 Stage 结束的时候。

系统自带有一个引擎内核的 `enum CoreStage`，其中包括 `First`, `PreUpdate`, `Update`, `PostUpdate`, `Last` 五个 Stage，这些 Stage 会在每 Tick 运行时按前后顺序依次运行。

使用 `App::add_system` 会默认将系统添加到 `CoreStage::Update` Stage 中，可以使用 `App::add_system_to_stage` 来指定目标的 Stage。

```rust
fn main() {
  App::new()
    .add_plugins(DefaultPlugins)
    .add_system_to_stage(CoreStage::PostUpdate, debug_system)
    .add_system_to_stage(CoreStage::PostUpdate, print_system)
    .run();
}
```

添加到 `CoreStage::PostUpdate` 中的系统都只会在添加到 `CoreStage::Update` 中的系统执行完成，并且所有 `Commands` 都已经更新完毕之后才会执行。

## Resource

Resource 是独立于实体和组件之外的一个特性，Bevy 引擎将其用于一些独立于任何实体和组件之外的全局变量，可以用来保存游戏设置或者游戏分数等全局内容。

这些内容不属于任何一个具体的实体，而是只与游戏本身相关。

想要插入一个 Resource，可以直接使用 `App::insert_resource()`。

```rust
struct Score(u32);

fn main() {
  App::new()
    // ...
    .insert_resource(Score(0u32))
    // ...
}
```

如果在初始化 Resouce 的时候需要获取 World / 其他 Resource 作为参数，那么可以实现 `trait FromWorld`，并使用 `App::init_resource::<T>()` 来初始化。

```rust
struct MaxScore(u32);
struct Score(u32);

impl FromWorld for Score {
  fn from_world(world: &mut World) -> Self {
    let max_score = world.get_resource::<MaxScore>().unwrap();
    Score(max_score.0 / 2u32)
  }
}

fn main() {
  App::new()
    // ...
    .insert_resource(MaxScore(100u32))
    .init_resource::<Score>()
    // ...
}
```

注意上面的样例如果把 `insert_resource` 和 `init_resource` 反着写会 panic 喔。

想要在系统中获取 Resource 的话，只需要添加 `Res<T>` 或者 `ResMut<T>` 参数即可，但是如果是不确定存在与否的 Resource，可以使用 `Option<Res<T>>`, `Option<ResMut<T>>`。

```rust
fn example_system(
  res1: Res<Resource1>,
  mut res2: ResMut<Resource2>,
  res3: Option<Res<Resource3>>,
  res4: Option<ResMut<Resource4>>,
) {
  if let Some(mut res4) = res4 {
    // ...
  }
}
```

说到这里就有必要讲一讲上面提到的 `movement` 系统，这个系统本身有一个巨大的问题：程序每秒能循环运行的次数是随系统而变化的。也就是说在性能高的电脑上面也许每秒能运行几百次，而在一些性能比较落后的电脑上也许只能勉勉强强运行 60 次。这就会造成一个问题，不同电脑上面玩家实际的移动速度会不一样。

想要解决这个问题有基本两种方法，第一种是直接使用引擎自带的 `Res<Time>`，可以直接获取到每 Tick 所用的时间。

```rust
struct Position(Vec2);
struct Velocity(Vec2);

fn movement(
  time: Res<Time>,
  mut query: Query<(&Velocity, &mut Position)>,
) {
  // 枚举每一个符合条件的 Entity
  for (velocity, mut position) in query.iter_mut() {
    // Δx = v * Δt
    position.0 += velocity.0 * time.delta_seconds();
  }
}
```

以此便可以在任何帧率下面均能够实现玩家的匀速运动。

如果对游戏每秒内运行的 Tick 数量有硬性要求的（比如经典的 Minecraft 是 20 tick/s，也就是每秒运行 20 次计算），这种情况下面 `Time` 就不能发挥实际用处，我们需要通过一个叫做 Run Criteria 的东西来实现 Fixed Timestamp 运行。

```rust
fn main() {
  App::new()
    // ...
    .add_system_set(
      SystemSet::new()
        // 以 60 tps 速度稳定运行 movement 系统
        .with_run_criteria(FixedTimestep::step(1000.0 / 60.0))
        .with_system(movement)
    )
    // ...
}
```

当然这个方案如果在主机本身就无法以 60 tps 的速度稳定运行的情况下，那么 `movement` 系统也达不到 60 tps 的运行速度。

~~这时你就可以输出这么一句：`Can't keep up! Is the server overloaded? Running 114514ms or 1919810 ticks behind`~~

## State

State 是 bevy 用来定义游戏目前状态的特性，具体可以用于实现游戏页面的切换等功能。

本质是存放在 Resource 的栈，可以往栈中添加或者删除一个 State，每次都只有栈顶的 State 是当前的活动 State。

使用 SystemSet 可以绑定一些系统到特定的 State 变更事件中，包括

- `SystemSet::on_update`: 当前 State 位于栈顶（满足条件就一直执行）
- `SystemSet::on_enter`: 当前 State 被插入栈顶（每次改动只执行一次，下同）
- `SystemSet::on_exit`: 当前 State 被弹出栈顶
- `SystemSet::on_pause`: 当前 State 被新插入的栈顶元素覆盖
- `SystemSet::on_resume`: 当前 State 的上层元素被弹出，State 成为了新的栈顶
- ......

```rust
#[derive(Debug, Clone, Eq, PartialEq, Hash)]
enum AppState {
  Menu,
  Game,
}

fn main() {
  App::new()
    // ...
    .add_state(AppState::Menu)
    .add_system_set(
      SystemSet::on_enter(AppState::Menu)
        .with_system(initialize_menu_page)
    )
    .add_system_set(
      SystemSet::on_exit(AppState::Menu)
        .with_system(destory_menu_page)
    )
    // ...
}
```

如果想在系统中获取/修改 State，可以使用 `Res<State<AppState>>` 和 `ResMut<State<AppState>>`，具体可以查询文档。

值得注意的是如果使用 `State<T>::push/pop` 等操作，Bevy 引擎会在同一 Tick 内重新运行一遍发生 State 修改变化的 Stage。

## Events

Events 可以用于实现事件的触发和监听。

Events 可以应用在许多事情上，比如想要结束游戏进程，就可以使用 `EventWriter<AppExit>`。

```rust
fn exit_game(
  mut exit_event_writer: EventWriter<AppExit>,
) {
  if should_exit() {
    exit_event_writer.send(AppExit);
  }
}
```

想要读取事件，则可以使用 `EventReader<T>`。

```rust
fn listen_mouse_position(
  mut events: EventReader<MouseMotion>,
) {
  for event in events.iter() {
    println!("{:?}", event);
  }
}
```

想要添加一个自己的事件触发器和监听器，使用 `App::add_event` 即可

```rust
struct MyEvent {
  // ...
}

fn main() {
  App::new()
    // ...
    .add_event::<MyEvent>()
    // ...
}
```

## Query

Query 是系统中对所有实体进行筛选和过滤的类型。

前面已经有讲到一个最基本的例子，但是 Query 可以携带更多的参数。

- 第一个参数用来筛选必须同时拥有的组件，同时获取该组件的引用；
- 第二个参数可以用来进行一些复杂的筛选，但是不获取对组件的引用。

```rust
fn example_system(
  mut commands: Commands,
  mut query: Query<
    // Entity 实体的一个引索
    // &Component1 不可变借用
    // &mut Component2 可变借用
    // Option<&Component3> 可有可无的不可变借用
    (Entity, &Component1, &mut Component2, Option<&Component3>),
    // Or<(T1, T2, ...)> 逻辑或（外层 tuple 是逻辑与）
    // Changed<T> 有被修改过
    // With<T> 有这个组件
    // Without<T> 没有这个组件
    (Or<(Changed<Component4>, Changed<Component5>)>, With<Component5>)
  >
) {
  for (entity, comp1, mut comp2, comp3) in query.iter_mut() {
    if comp3.is_some() {
      *comp2 = Component2;
    }
    // Entity 用来从 Commands 中获取实体本身
    commands.entity(entity)
      .remove::<Component5>();
  }
}
```

如果有多个询问就可以使用多个 Query 参数。

然而如果这几个 Query 中包含对某个组件的多次可变借用(或者可变+不可变)，那么即便我们在内部使用 `if` 分支保证在运行时每次只会调用其中的一个 Query，编译器依旧会认为系统有冲突并且报错。

解决方案是采用 `QuerySet<(Q1, Q2, ...)>` 的形式。

```rust
fn example_system(
  mut query_set: QuerySet<(
    Query<&mut Position>,
    Query<&Position>,
  )>
) {
  if should_first_query() {
    query_set.q0_mut().iter_mut() // ...
  } else {
    query_set.q1().iter() // ...
  }
}
```

## Plugins

如果我们对 App 的操作有点多，那么可以选择将其中的一部分封装成一个插件(Plugin)，以降低整体代码的耦合度。

多个插件可以组成一个插件组(PluginGroup)，再次降低耦合度。

```rust
struct MyPlugin;

impl Plugin for MyPlugin {
  fn build(&self, app: &mut App) {
    app
      .insert_resource(...)
      .add_event::<...>()
      .add_system_set(...)
      // ...
  }
}

struct MyPlugins;

impl PluginGroup for MyPlugins {
  fn build(&mut self, group: &mut PluginGroupBuilder) {
    group
      .add(MyPlugin)
      .add(AnotherPlugin)
      // ...
  }
}

fn main() {
  App::new()
    .add_plugins(DefaultPlugin) // bevy 引擎内核插件
    .add_plugin(MyPlugin)
    .add_plugins(MyPlugins)
    // ...
}
```

## 后记

至此，我们介绍了 bevy 引擎的一些最基本的特性，下一篇将会开始介绍 bevy 引擎中 UI 框架的部分。

TO BE CONTINUED
