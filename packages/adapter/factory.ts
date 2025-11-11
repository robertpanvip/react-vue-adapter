import {
    defineComponent,
    ref,
    type VNode,
    onMounted,
    onUpdated,
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
    flushInsertionEffects,
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
            const expose = Object.create(null)
            // 组件卸载时清理副作用
            onUnmounted(() => {
                cleanupEffects(runtime);
            });
            context.expose(expose);

            // ✅ 在组件挂载和更新后执行 React 的同步副作用
            const runReactCommitPhase = () => {
                flushInsertionEffects(runtime); // 先样式
                flushLayoutEffects(runtime);    // 再 layout
                Promise.resolve().then(() => flushEffects(runtime)); // 最后异步 effect
            };

            onMounted(runReactCommitPhase);
            onUpdated(runReactCommitPhase);
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
                    _props.ref = (node: object) => {
                        Object.assign(expose, node)
                    }
                    const ele = createElement(ReactComponent, _props);
                    result = createVNodeFromReactElement(ele);
                } finally {
                    CurrentReactContext.pop();
                }
                return h(Fragment, {key: version.value}, [result]);
            };
        },
    });
}
