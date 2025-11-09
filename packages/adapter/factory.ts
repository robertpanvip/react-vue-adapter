import {
    defineComponent,
    ref,
    watchEffect,
    type VNode,
    onUnmounted,
    Fragment,
    h,
    type Slots,
    type ComponentObjectPropsOptions
} from 'vue';
import {
    createReactRuntime,
    pushFiber,
    popFiber,
    flushEffects,
    cleanupEffects,
    type Runtime,
    flushLayoutEffects,
    createVNodeFromReactElement,
    type ComponentType,
    createElement,
    slot, createSlot,
} from '@react-vue/react';

// 提取 React 组件的 Props 类型
export type ExtractProps<T> = T extends (props: infer P) => any ? P : never;

function vnodeToJSON(vnode: VNode): Record<string, any> {
    if (!vnode) return null;

    // 提取核心属性（根据需要增删）
    const plainObj: Record<string, any> = {
        type: typeof vnode.type === 'function'
            ? vnode.type.name || 'AnonymousComponent'  // 函数组件取名称
            : vnode.type,  // 字符串标签（如 'div'）或对象
        props: vnode.props ? {...vnode.props} : null,
        key: vnode.key,
        children: Array.isArray(vnode.children)
            ? vnode.children.map(child =>
                // 递归处理子 VNode
                typeof child === 'object' && child ? vnodeToJSON(child as VNode) : child
            )
            : typeof vnode.children === 'object' && vnode.children
                ? vnodeToJSON(vnode.children as VNode)
                : vnode.children,  // 文本节点等
        shapeFlag: vnode.shapeFlag,  // 节点类型标识（如元素/组件/文本）
        // 注意：避免添加 parent/el 等循环引用属性
    };

    // 移除 props 中的函数（否则 JSON 序列化会忽略）
    if (plainObj.props) {
        Object.keys(plainObj.props).forEach(key => {
            if (typeof plainObj.props[key] === 'function') {
                delete plainObj.props[key];
            }
        });
    }

    return plainObj;
}

/**
 * 将 Vue props 转换为 React props
 * @param vueProps Vue 组件接收的 props
 * @param context
 * @returns 转换后的 React props
 */
export function vuePropsToReactProps(
    vueProps: ComponentObjectPropsOptions = {},
    context: {
        slots: Slots,
        attrs: Record<string, unknown>,
        emit: (event: string, ...args: any[]) => void;
    }
): Record<string, unknown> {
    const {slots, attrs} = context
    const reactProps: Record<string, unknown> = {...vueProps, ...attrs};
    if (reactProps.class) {
        reactProps.className = reactProps.class;
        delete reactProps.class
    }
    Object.entries(slots).forEach(([k, v]) => {
        reactProps[k === 'default' ? "children" : k] = v ? createSlot(k, context) : undefined
    })
    return reactProps;
}

// 工厂函数：将 React 组件转换为 Vue 组件
export function factory<P = {}>(
    ReactComponent: ComponentType
) {
    return defineComponent<Partial<P>>({
        inheritAttrs: false,
        name: ReactComponent.displayName || ReactComponent.name || 'ReactWrapper',
        setup(props, context) {
            //const children = resolveSlotsToReactProps(slots);
            //console.log(children);
            // 每个 wrapper 有独立 runtime
            const runtime: Runtime = createReactRuntime();

            // 版本号用于触发 Vue 重新 render（render 内会调用 ReactComponent）
            const version = ref(0);

            // 将 triggerRender 设置为只改 version（不执行 ReactComponent）
            runtime.triggerRender = () => {
                //version.value++;
            };

            // 当 props 变化时也触发一次 render（和你之前意图一致）
            watchEffect(
                () => {
                    // 触发 props 访问
                    //const _ = {...props};
                    // 让 Vue 在下一次渲染时重新执行 render（因为 render 依赖 version）
                    // 直接 ++version 会触发 render，现在使用 ++ 保持语义一致
                    //version.value++;
                },
                {flush: 'post'}
            );

            // 组件卸载时清理副作用
            onUnmounted(() => {
                cleanupEffects(runtime);
            });

            // Vue 的渲染函数 —— 在这里创建 VNode（保证 ref owner 正确）
            return () => {
                //const fn= context.slots.default;

                // 在 Vue 的 render 上下文内执行 ReactComponent，
                // 并在执行期间提供 fiber 上下文与 hookIndex 重置
                pushFiber(runtime);
                let result: VNode | null = null;
                try {
                    runtime.hookIndex = 0;

                    const _props = vuePropsToReactProps(props as any, context);
                    console.log(_props);
                    /* const xs = {
                         type: ({children}) => {
                             return children?.({title: 123})
                         },
                         props: _props
                     }*/
                    //return createVNodeFromReactElement(xs);
                    const ele = createElement(ReactComponent, _props);
                    console.log(ele);
                    result = createVNodeFromReactElement(ele);
                    //console.log(vnodeToJSON(result))
                    // 同步执行 layout effects（React 的 useLayoutEffect）
                    flushLayoutEffects(runtime);
                } finally {
                    popFiber();
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
