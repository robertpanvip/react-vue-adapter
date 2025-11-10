import {
    defineComponent,
    ref,
    type VNode,
    onUnmounted,
    Fragment,
    h,
} from 'vue';
import {
    flushEffects,
    cleanupEffects,
    type Runtime,
    flushLayoutEffects,
    createVNodeFromReactElement,
    type ComponentType,
    createElement,
    CurrentReactContext,
} from '@react-vue/react';
import {vuePropsToReactProps} from "./util";


// 工厂函数：将 React 组件转换为 Vue 组件
export function factory<P = {}>(
    ReactComponent: ComponentType
) {
    return defineComponent<Partial<P>>({
        inheritAttrs: false,
        name: ReactComponent.displayName || ReactComponent.name || 'ReactWrapper',
        setup(props, context) {
            // 每个 wrapper 有独立 runtime
            const runtime: Runtime = CurrentReactContext.createReactRuntime();
            const version = ref(0);

            // 组件卸载时清理副作用
            onUnmounted(() => {
                cleanupEffects(runtime);
            });

            // Vue 的渲染函数 —— 在这里创建 VNode（保证 ref owner 正确）
            return () => {
                // 在 Vue 的 render 上下文内执行 ReactComponent，
                // 并在执行期间提供 上下文与 hookIndex 重置
                CurrentReactContext.push(runtime);
                let result: VNode | null = null;
                try {
                    runtime.hookIndex = 0;

                    const _props = vuePropsToReactProps(props as any, context);
                    console.log(_props);
                    const ele = createElement(ReactComponent, _props);
                    result = createVNodeFromReactElement(ele);
                    // 同步执行 layout effects（React 的 useLayoutEffect）
                    flushLayoutEffects(runtime);
                } finally {
                    CurrentReactContext.pop();
                }

                // 异步（微任务）执行普通 effects（React 的 useEffect）
                // 放在微任务里以保证在 DOM 更新后执行
                Promise.resolve().then(() => {
                    // flushEffects 内部会 scheduleEffect 执行 effect.fn
                    flushEffects(runtime);
                });

                return h(Fragment, {key: version.value}, [result]);
            };
        },
    });
}
