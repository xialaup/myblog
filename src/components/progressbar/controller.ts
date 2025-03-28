import { inject, ref, type Plugin, type Ref } from "vue";
import { START_LOCATION, stringifyQuery } from "vue-router";

const PROGRESSBAR = Symbol("progress-bar");

export type ProgressBar = {
  state: Ref<"init" | "show" | "finish">;
  start(): void;
  end(): void;
};

export function createProgressBar(): Plugin {
  return {
    install(app) {
      const state = ref<"init" | "show" | "finish">("init");

      const ctrl: ProgressBar = {
        state,
        start() {
          state.value = "show";
        },
        end() {
          setTimeout(() => {
            state.value = "finish";
            setTimeout(() => {
              state.value = "init";
            }, 300);
          }, 100);
        },
      };

      const router = app.config.globalProperties.$router;

      if (!router) {
        throw new Error("router not found");
      }

      router.beforeEach((to, from) => {
        // skip initial
        if (from === START_LOCATION) {
          return;
        }

        if (
          to.path != from.path ||
          stringifyQuery(to.query) != stringifyQuery(from.query)
        ) {
          ctrl.start();
        }
      });
      router.afterEach(() => {
        if (ctrl.state.value === "show") ctrl.end();
      });

      app.provide(PROGRESSBAR, ctrl);
    },
  };
}

export function injectProgressBar() {
  return inject<ProgressBar>(PROGRESSBAR)!;
}
