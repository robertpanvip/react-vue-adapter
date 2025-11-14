import {
    cloneVNode,
    Fragment as VueFragment,
    h,
    isRef,
    ref,
    type Ref as VueRef,
    shallowRef,
    type ShallowRef,
    Text,
    type VNode,
    type VNodeArrayChildren,
} from 'vue';
import {normalizeStyle} from "./style";
import type * as Type from './type'

export * from './type'

// 标记 forwardRef 组件的符号（避免与普通组件混淆）
const FORWARD_REF_SYMBOL = Symbol.for('react.forward_ref');
const PROVIDER_SYMBOL = Symbol.for('react.provider');
const CONSUMER_SYMBOL = Symbol.for('react.consumer');
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_FRAGMENT = Symbol.for('react.fragment');
const VUE_SLOT_TYPE = Symbol.for('vue.slot');

// === 模拟 React Fiber 架构的上下文管理 ===
interface RuntimeNode {
    runtime: Runtime;
    parent: RuntimeNode | null;
}

type Dispatcher = {
    current: RuntimeNode | null,
    push(runtime: Runtime): void,
    pop(): void
    createReactRuntime(): Runtime
}
// 用栈管理当前组件的节点（替代全局变量）
const runtimeStack: RuntimeNode[] = [];
export const CurrentReactContext: Dispatcher = {
    current: null,
    // 入栈：进入组件渲染
    push(runtime) {
        const newFiber: RuntimeNode = {runtime, parent: CurrentReactContext.current};
        runtimeStack.push(newFiber);
        CurrentReactContext.current = newFiber;
    },
    // 出栈：离开组件渲染
    pop() {
        runtimeStack.pop();
        CurrentReactContext.current = runtimeStack[runtimeStack.length - 1] || null;
    },
    // 创建新的 Runtime（每个组件实例独立）
    createReactRuntime(): Runtime {
        return {
            hooks: [],
            hookIndex: 0,
            pendingEffects: [],
            pendingLayoutEffects: [],
            pendingInsertionEffects: [],
            contextMap: new Map(),
        };
    }
}

// 确保当前有活跃的组件上下文
function ensureCurrentRuntime(): Runtime {
    if (!CurrentReactContext.current?.runtime) {
        throw new Error('Hooks can only be called inside a React component (check for conditional calls)');
    }
    return CurrentReactContext.current.runtime;
}

// === Runtime 定义（组件实例的状态容器） ===
export interface Runtime {
    hooks: Array<Hook>; // 存储所有 hooks 状态
    hookIndex: number; // 当前 hooks 调用索引（确保顺序性）
    pendingEffects: Effect[]; // 待执行的副作用（useEffect）
    pendingLayoutEffects: Effect[]; // 待执行的副作用（useLayoutEffects）
    pendingInsertionEffects: Effect[]; // 待执行的副作用（useInsertionEffects）
    contextMap: Map<Type.Context<any>, any>; // 存储 Context 订阅
}

// 单个 Hook 的类型（支持不同类型的 hook）
type Hook =
    | { type: 'state'; ref: VueRef<any>, updateQueue?: (() => void)[], isFlushing?: boolean }
    | { type: 'ref'; ref: ShallowRef<{ current: any }> }
    | { type: 'memo'; deps: unknown[] | undefined; value: VueRef<any> }
    | { type: 'callback'; deps: unknown[] | undefined; value: VueRef<Function> }
    | { type: 'imperative', ref: ShallowRef }
    | { type: 'id', value: string }
    | { type: 'effect'; deps: unknown[] | undefined; cleanup: VueRef<(() => void) | null> }
    | { type: 'layoutEffect'; deps: unknown[]; cleanup: VueRef<(() => void) | null> }
    | { type: 'insertionEffect'; deps: unknown[] | undefined; cleanup: (() => void) | null };

// 副作用类型（模拟 React 的 effect 调度）
interface Effect {
    fn: () => (() => void) | void;
    cleanup: (() => void) | null;
    deps: any[] | undefined;
}

// === 调度机制（模拟 React 的微任务异步执行） ===
const effectQueue: (() => void)[] = [];
let isFlushing = false;

// 异步执行副作用（在浏览器绘制后）
function scheduleEffect(fn: () => void) {
    effectQueue.push(fn);
    if (!isFlushing) {
        isFlushing = true;
        // 用微任务模拟 React 的 scheduler
        Promise.resolve().then(() => {
            effectQueue.forEach(effect => effect());
            effectQueue.length = 0;
            isFlushing = false;
        });
    }
}

// === 执行副作用并清理（供组件渲染后调用） ===
export function flushEffects(runtime: Runtime) {
    // 1. 执行上一次的清理函数
    runtime.pendingEffects.forEach(effect => {
        if (effect.cleanup) effect.cleanup();
    });

    // 2. 异步执行新的副作用，并存储清理函数
    runtime.pendingEffects.forEach(effect => {
        scheduleEffect(() => {
            const cleanup = effect.fn();
            if (typeof cleanup === 'function') effect.cleanup = cleanup;
        });
    });

    // 3. 清空待执行副作用
    runtime.pendingEffects = [];
}

// === 组件卸载时清理所有副作用 ===
export function cleanupEffects(runtime: Runtime) {
    runtime.hooks.forEach(hook => {
        if (hook.type === 'effect' && hook.cleanup.value) {
            hook.cleanup.value(); // 执行清理函数
        }
    });
}

export function flushInsertionEffects(runtime: Runtime) {
    const effects = runtime.pendingInsertionEffects || [];
    runtime.pendingInsertionEffects = [];
    effects.forEach(e => e.cleanup?.());
    effects.forEach(e => {
        const cleanup = e.fn();
        if (typeof cleanup === 'function') e.cleanup = cleanup;
    });
}

export function flushLayoutEffects(runtime: Runtime) {
    const effects = runtime.pendingLayoutEffects || [];
    runtime.pendingLayoutEffects = [];

    // 1. 同步执行 cleanup
    effects.forEach(e => e.cleanup?.());

    // 2. 同步执行新 effect
    effects.forEach(e => {
        const cleanup = e.fn();
        if (typeof cleanup === 'function') e.cleanup = cleanup;
    });
}

function isClassComponent(type: Function): type is typeof Component {
    return typeof type.prototype === 'object' && type.prototype instanceof Component && typeof type.prototype.render === 'function'
}

// 模拟 React.createElement，将 React 元素转换为 Vue VNode
export function createVNodeFromReactElement(ele: Type.ReactNode): VNode {
    // 处理原始值（字符串/数字/布尔值）
    if (typeof ele === 'string' || typeof ele === 'number') {
        return h(Text, ele);
    }
    if (ele === null || ele === undefined || typeof ele === 'boolean') {
        return h(Text, ''); // 过滤无效值，返回空文本节点
    }

    if (Array.isArray(ele)) {
        const vNodes = ele.map(item => createVNodeFromReactElement(item));
        return h(VueFragment, null, vNodes);
    }

    const {type, props} = ele;
    const children = props?.children;

    if (type === Fragment) {
        return h(VueFragment, createVNodeFromReactElement(children) as unknown as VNodeArrayChildren); // 直接返回子节点数组
    }

    // 5. 处理原生标签（div、span 等）
    if (typeof type === 'string') {
        const {children, ...rest} = props;
        //console.log('children', children);
        const v = createVNodeFromReactElement(children);
        const ref = rest.ref;
        if (ref) {
            if (typeof ref === 'object') {
                rest.ref = (node: VNode) => {
                    ref.current = node;
                }
            }
        }
        return h(type, rest, v);
    }

// 4. 处理函数组件
    if (typeof type === 'function') {
        // 3. 处理 Context.Provider
        if ("$$typeof" in type) {
            if (type.$$typeof === VUE_SLOT_TYPE) {
                const Slot = type as Type.VueSlot<any>;
                //console.log('VUE_SLOT_TYPE');
                //console.log(Slot(props));
                return h(VueFragment, [Slot(props) as VNode])
            }
            let result: Type.ReactNode = null;
            if (type.$$typeof === CONSUMER_SYMBOL) {
                const Consumer = type as Type.Consumer<any>
                const _props = {children: children};
                result = Consumer(_props);
                // 转发 ref 的组件
            } else {
                result = (type as Type.FunctionComponent)(props);
            }
            return createVNodeFromReactElement(result) as VNode;
        }
        const Comp = isClassComponent(type) ? (wrapClassComponent(type) as any).render : type;
        // 函数组件的 children 仍需作为 props 传递（符合 React 习惯）
        const componentProps = {...props, children: children} as unknown as any;
        const result = (Comp as Type.FunctionComponent)(componentProps, props.ref)
        return createVNodeFromReactElement(result);
    }
    if (isForwardRef(type)) {
        let _type = type as Type.ForwardRefExoticComponent<any>
        const Comp = (_type as any).render as Type.ForwardRefRenderFunction<any>;
        const result = Comp(props, props.ref);
        return createVNodeFromReactElement(result);
    }
    if (typeof ele === "function") {
    }

    throw new Error(`Unsupported element type: ${type}`);
}

function isForwardRef(type: any): type is Type.ForwardRefExoticComponent<any> {
    return typeof type === 'object' && type !== null
        && "$$typeof" in type
        && type?.$$typeof === FORWARD_REF_SYMBOL
        && 'render' in type
}

// 实现类组件的渲染转换（将类组件转换为可被 Vue 识别的函数组件）
function wrapClassComponent<P, S = {}>(ComponentClass: typeof Component<P, S>): Type.ForwardRefExoticComponent<Type.PropsWithoutRef<P> & Type.RefAttributes<React.Component<P, S>>> {
    return forwardRef((props: P, ref) => {
        // 1. 创建组件实例（仅在首次渲染时）
        const [instance] = useState(() => new ComponentClass(props));
        const [state, setState] = useState<S>({} as S);

        // 2. 同步 props 到实例（每次渲染时更新）
        Object.assign(instance.props, props);
        instance.state = state;
        instance.setState = (updater, callback?: () => void) => {
            setState((prevState) => {
                return typeof updater == 'function' ? (updater as (prev: S, props: P) => any)(prevState, props) : updater
            });
            Promise.resolve().then(callback)
        }
        // 3. 模拟生命周期：componentDidMount（仅执行一次）
        useEffect(() => {
            if (instance.componentDidMount) {
                instance.componentDidMount();
            }
            // 模拟 componentWillUnmount
            return () => {
                if (instance.componentWillUnmount) {
                    instance.componentWillUnmount();
                }
            };
        }, []);

        // 4. 模拟 componentDidUpdate（依赖 props 和 state 变化）
        useEffect(() => {
            if (instance.componentDidUpdate) {
                instance.componentDidUpdate(instance.props, instance.state);
            }
        }, [props, state]);
        useImperativeHandle(ref, () => instance)

        // 5. 执行 render 并转换为 Vue VNode
        return instance.render();
    });
}

export function createSlot(vNode: VNode) {
    const Slot = (props: object) => {
        const extraProps = {
            ...vNode.props,
            ...props
        }
        return cloneVNode(vNode, extraProps)
    }
    Slot.$$typeof = VUE_SLOT_TYPE;
    return createElement(Slot as any, vNode.props);
}

namespace React {
    export type ReactNode = Type.ReactNode;
    export type ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> = Type.ReactElement<P, T>;
    export type ComponentType<P = {}> = Type.ComponentType<P>;
    export type JSXElementConstructor<P> = Type.JSXElementConstructor<P>;
    export type FunctionComponent<P = {}> = Type.FunctionComponent<P>;
    export type MemoExoticComponent<P = {}> = Type.MemoExoticComponent<P>;
    export type ExoticComponent<P = {}> = Type.ExoticComponent<P>;
    export type NamedExoticComponent<P = {}> = Type.NamedExoticComponent<P>;
    export type PropsWithoutRef<P> = Type.PropsWithoutRef<P>;
    export type ForwardRefExoticComponent<P> = Type.ForwardRefExoticComponent<P>;
    export type ForwardRefRenderFunction<T, P = {}> = Type.ForwardRefRenderFunction<T, P>;
    export type CSSProperties = Type.CSSProperties;
    export type Context<T> = Type.Context<T>;
    export type ProviderExoticComponent<P> = Type.ProviderExoticComponent<P>;
    export type Provider<T> = Type.Provider<T>;
    export type VueSlot<T> = Type.VueSlot<T>;
    export type ProviderProps<T> = Type.ProviderProps<T>;
    export type ConsumerProps<T> = Type.ConsumerProps<T>;
    export type Consumer<T> = Type.Consumer<T>;
    export type RefObject<T> = Type.RefObject<T>;
    export type MutableRefObject<T> = Type.MutableRefObject<T>;
    export type RefCallback<T> = Type.RefCallback<T>;
    export type Ref<T> = Type.Ref<T>;
    export type LegacyRef<T> = Type.LegacyRef<T>;
    export type ForwardedRef<T> = Type.ForwardedRef<T>;
    export type Key = Type.Key;
    export type Attributes = Type.Attributes;
    export type RefAttributes<T> = Type.RefAttributes<T>;
    export type ReactPortal = Type.ReactPortal;
    export type SetStateAction<T> = Type.SetStateAction<T>;
    export type Dispatch<T> = Type.Dispatch<T>;
    export type Reducer<T, A> = Type.Reducer<T, A>;
    export type FC<P = {}> = Type.FC<P>;


    export const Fragment = REACT_FRAGMENT as unknown as Type.Fragment;


    // === Hooks 实现 ===
    export function useState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {

        const [_, hook] = ensureHooks(() => {
            const initialValue = typeof initialState === 'function'
                ? (initialState as () => T)()
                : initialState;
            return {
                type: 'state',
                ref: ref<T>(initialValue),
                isFlushing: false as boolean,
                updateQueue: [] as (() => void)[]
            }
        })

        const stateRef = hook.ref;

        const flushUpdates = () => {
            if (hook.isFlushing) return;
            hook.isFlushing = true;
            Promise.resolve().then(() => {
                const queue = hook.updateQueue.splice(0, hook.updateQueue.length);
                queue.forEach(fn => fn());
                hook.isFlushing = false;
            });
        };

        const setState: Dispatch<SetStateAction<T>> = (updater) => {
            const newValue = typeof updater === 'function'
                ? (updater as (prev: T) => T)(stateRef.value)
                : updater;
            if (newValue !== stateRef.value) {
                hook.updateQueue.push(() => {
                    stateRef.value = newValue;
                });
                flushUpdates();
            }
        };

        return [stateRef.value, setState];
    }

    export function useEffect(effect: () => (() => void) | void, deps: any[] = []) {

        const [runtime, hook] = ensureHooks({
            type: 'effect',
            deps: undefined as any,
            cleanup: ref<(() => void) | null>(null),
        })

        // 检查依赖是否变化（严格模拟 React 的浅比较）
        if (depsChanged(hook.deps, deps)) {
            // 存储新的副作用（将在渲染后异步执行）
            runtime.pendingEffects.push({
                fn: effect,
                cleanup: hook.cleanup.value,
                deps,
            });
            hook.deps = deps; // 更新依赖缓存
        }
    }

    export function useMemo<T>(factory: () => T, deps: any[] = []): T {

        const [_, hook] = ensureHooks({
            type: 'memo',
            deps: undefined as any,
            value: ref<T>(factory()),
        })

        // 依赖变化时重新计算（同 React 逻辑）
        if (depsChanged(hook.deps, deps)) {
            hook.deps = deps;
            hook.value.value = factory();
        }
        return hook.value.value;
    }

    export function useRef<T>(initialValue?: T): { current: T | undefined } {

        const [_, hook] = ensureHooks({
            type: 'ref',
            ref: shallowRef<{ current: T | undefined }>({current: initialValue}),
        })

        return hook.ref.value; // 返回 { current }，与 React 一致
    }

    export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T {
        // 复用 useMemo 逻辑，与 React 一致
        return useMemo(() => callback, deps);
    }


// === Context 支持（模拟 React.createContext 和 useContext） ===
    export function createContext<T>(defaultValue: T): Context<T> {
// 每个 context 都维护自己的栈
        const contentValue = shallowRef(defaultValue)

        // 1. 创建唯一注入键（Vue 依赖注入的核心）
        const Provider = ({value, children}: ProviderProps<T>) => {
            contentValue.value = value;
            const r = ensureCurrentRuntime();
            r.contextMap.set(context, contentValue)
            return children;
        };
        Provider.$$typeof = PROVIDER_SYMBOL;

        const Consumer = ({children}: ConsumerProps<T>) => {
            return children(contentValue.value)
        }
        Consumer.$$typeof = CONSUMER_SYMBOL;
        const context = {Provider, Consumer, _defaultValue: defaultValue};
        return context as Context<T>
    }

    export function useContext<T>(context: Context<T>): T {
        const r = CurrentReactContext.current?.runtime
        if (!r) {
            return context._defaultValue as T
        }
        const contentValue = r.contextMap.get(context);
        if (contentValue === undefined) {
            return context._defaultValue as T
        }
        return contentValue.value;
    }

    export function useImperativeHandle<T>(
        ref: Ref<T> | undefined,
        create: () => T
    ) {
        if (typeof create !== 'function') {
            throw new Error(`Unsupported create type: ${typeof create}`);
        }
        const [_, hook] = ensureHooks({type: 'imperative', ref: shallowRef<T | null>(null)})
        hook.ref.value = create();
        // 1. 处理 ref 同步（支持函数和 Ref 对象）
        const syncRef = (instance: T | null) => {
            if (typeof ref === 'function') {
                ref(instance); // 函数式 ref：直接调用
            } else if (isRef(ref)) {
                ref.value = instance; // Ref 对象：同步 value
            }
        };
        // 绑定到 ref
        if (ref) syncRef(hook.ref.value)
    }

// 模拟 React.forwardRef（完全对齐行为）
    export function forwardRef<T, P = {}>(
        render: ForwardRefRenderFunction<T, P>
    ) {
        const elementType = {
            $$typeof: FORWARD_REF_SYMBOL,
            render: render,
            displayName: `ForwardRef(${render.name || 'Component'})`
        }
        return elementType as unknown as ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
    }

    function ensureHooks<T extends Hook>(defaultHook: T | (() => T)) {
        const runtime = ensureCurrentRuntime();
        const index = runtime.hookIndex++;
        if (!runtime.hooks[index]) {
            runtime.hooks[index] = typeof defaultHook === 'function' ? defaultHook() : defaultHook;
        }
        return [runtime, runtime.hooks[index] as T] as const
    }

    export function useLayoutEffect(
        effect: () => (() => void) | void,
        deps: unknown[] = []
    ) {
        const [runtime, hook] = ensureHooks({
            type: 'layoutEffect',
            deps: undefined as any,
            cleanup: ref<(() => void) | null>(null),
        })

        if (depsChanged(hook.deps, deps)) {
            runtime.pendingLayoutEffects = runtime.pendingLayoutEffects || [];
            runtime.pendingLayoutEffects.push({
                fn: effect,
                cleanup: hook.cleanup.value,
                deps,
            });
            hook.deps = deps ? [...deps] : undefined;
        }
    }

    function depsChanged(oldDeps: any[] | undefined, newDeps: any[] | undefined): boolean {
        // 没有旧依赖或新依赖未传，认为变化了
        if (!oldDeps || !newDeps) return true;

        // 长度不一致也算变化
        if (oldDeps.length !== newDeps.length) return true;

        // 每个元素浅比较
        for (let i = 0; i < oldDeps.length; i++) {
            if (oldDeps[i] !== newDeps[i]) return true;
        }

        return false;
    }

    export function useInsertionEffect(effect: () => void | (() => void), deps?: unknown[]) {

        const [runtime, hook] = ensureHooks({
            type: 'insertionEffect',
            deps: undefined as any,
            cleanup: null,
        });
        if (depsChanged(hook.deps, deps)) {
            runtime.pendingInsertionEffects = runtime.pendingInsertionEffects || [];
            runtime.pendingInsertionEffects.push({
                fn: effect,
                cleanup: hook.cleanup,
                deps
            });
            hook.deps = deps ? [...deps] : undefined;
        }
    }


// 支持 initializer 函数的完整版本
    export function useReducer<S, A>(
        reducer: Reducer<S, A>,
        initialState: S | (() => S), // 允许初始状态是函数
        initializer?: (state: S) => S // 可选的初始化器（React 完整特性）
    ): [S, Dispatch<A>] {
        // 处理初始状态（支持函数形式）
        const resolvedInitialState = typeof initialState === 'function'
            ? (initialState as () => S)()
            : initialState;

        // 应用 initializer 处理（如状态重置逻辑）
        const finalInitialState = initializer
            ? initializer(resolvedInitialState)
            : resolvedInitialState;

        // 复用 useState 存储状态
        const [state, setState] = useState(finalInitialState);

        const dispatch: Dispatch<A> = (action) => {
            const nextState = reducer(state, action);
            setState(nextState);
        };

        return [state, dispatch];
    }


    let idCounter = 0;

    export function useId() {
        const [_, hook] = ensureHooks({type: 'id', value: `:${idCounter++}:`})
        return hook.value;
    }

// 模拟useTransition：返回[startTransition, isPending]
    export function useTransition() {
        // 用useState标记过渡状态（是否在等待低优先级更新）
        const [isPending, setIsPending] = useState(false);

        // startTransition：包裹低优先级更新逻辑
        const startTransition = (callback: () => void) => {
            setIsPending(true); // 标记开始过渡
            // 用setTimeout延迟执行（模拟低优先级调度）
            setTimeout(() => {
                callback(); // 执行低优先级更新
                setIsPending(false); // 标记过渡结束
            }, 0); // 延迟0ms，让浏览器先处理高优先级任务（如输入）
        };

        return [startTransition, isPending] as const;
    }

    /**
     * 默认浅比较实现
     * 对象类型只比较第一层属性，其他类型直接 ===
     */
    const shallowEqual: AreEqual<any> = (prev, next) => {
        if (prev === next) return true;

        if (
            typeof prev !== 'object' || prev === null ||
            typeof next !== 'object' || next === null
        ) {
            return false;
        }

        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);

        if (prevKeys.length !== nextKeys.length) return false;

        for (let key of prevKeys) {
            if ((prev as any)[key] !== (next as any)[key]) return false;
        }

        return true;
    };
    /**
     * areEqual 函数签名
     * prevProps 和 nextProps 必须结构相同
     */
    export type AreEqual<P> = (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean;

    export function memo<P extends object>(
        Component: FC<P>,
        areEqual: AreEqual<P> = shallowEqual
    ): FC<P> {
        return ((props: P) => {

            const prev = useRef<P | null>(null);
            const cached = useRef<ReactNode | null>(null);

            if (!prev.current || !areEqual?.(prev.current, props)) {
                prev.current = props;
                cached.current = Component(props);
            }
            return cached.current;
        }) as FC<P>;
    }

    export const Children = {
        map<T, C extends ReactNode>(children: C | readonly C[], fn: (child: C, index: number) => T) {
            if (children == null) return children as C extends null | undefined ? C : never;
            const arr = flattenChildren(Array.isArray(children) ? children : [children] as ReactNode[]);
            return arr.map((child, i) => fn(child as C, i)).filter(c => c !== null && c !== undefined && c !== false) as Array<Exclude<T, boolean | null | undefined>>;
        },

        forEach<C extends ReactNode>(children: C | readonly C[], fn: (child: C, index: number) => void) {
            const arr = flattenChildren(Array.isArray(children) ? children : [children] as ReactNode[]);
            arr.forEach((child, i) => fn(child as C, i));
        },

        count(children: ReactNode | ReactNode[]) {
            return flattenChildren(Array.isArray(children) ? children : [children]).length;
        },

        only<C extends ReactNode>(children: C) {
            const arr = flattenChildren(Array.isArray(children) ? children : [children]);
            if (arr.length !== 1) throw new Error("Children.only expected to receive a single React element.");
            return arr[0] as Exclude<C, any[]>;
        },

        toArray(children: ReactNode | ReactNode[]) {
            return flattenChildren(Array.isArray(children) ? children : [children]);
        },
    };

    function flattenChildren(children: ReactNode[]): (ReactElement | string | number)[] {
        const result: (ReactElement | string | number)[] = [];
        children.forEach(child => {
            if (child === null || child === undefined || typeof child === 'boolean') return;
            if (Array.isArray(child)) result.push(...flattenChildren(child));
            else result.push(child as ReactElement | string | number);
        });
        return result;
    }


    export function isValidElement(object: any): object is ReactElement {
        return (typeof object === 'object' && object !== null || typeof object === 'function')
            ? object.$$typeof === REACT_ELEMENT_TYPE : false;
    }

    // 模拟 React.createElement，将 React 元素转换为 Vue VNode
    export function createElement<P extends Record<string, any>>(
        type: string
            | ComponentType<P>
            | Provider<P>
            | Consumer<P>
            | ForwardRefExoticComponent<P>,
        props: P | null = null,
        ...children: ReactNode[]
    ): ReactElement {
        const normalizedProps = {...(props || {})};
        if (normalizedProps.style) {
            normalizedProps.style = normalizeStyle(normalizedProps.style)
        }
        if (type && typeof type !== 'string' && typeof type !== 'symbol' && "defaultProps" in type) {
            const defaultProps = type.defaultProps;
            for (let propName in defaultProps) {
                if (normalizedProps[propName] === undefined) {
                    normalizedProps[propName] = defaultProps[propName];
                }
            }
        }
        if (children.length > 0) {
            normalizedProps.children = children;
        }
        const flatten = normalizedProps.children || [];
        const element = {
            type: type,
            props: {
                ...normalizedProps,
                children: flatten?.length == 0 ? null : flatten.length === 1 ? flatten[0] : flatten
            },
            $$typeof: REACT_ELEMENT_TYPE
        }
        if (Object.freeze) {
            Object.freeze(element.props);
            Object.freeze(element);
        }
        return element as unknown as ReactElement<P>;
    }

// 保留属性：key 和 ref 不进入 props
    const RESERVED_PROPS = new Set(['key', 'ref']);

    export function cloneElement<P extends object>(element: ReactElement, config: P, ...children: ReactNode[]) {
        // 1. 校验输入有效性
        if (!element || !element.type) {
            throw new Error('cloneElement: First argument must be a valid element');
        }
        if (typeof element !== 'object') {
            if (isValidElement(element)) {
            } else {
                throw new Error('cloneElement: First argument must be a valid element');
            }
        }

        // 2. 复制原元素的基础属性
        const {type, props, key: originalKey, ref: originalRef} = element as any;
        const newProps = {...props}; // 继承原 props
        let newKey = originalKey;
        let newRef = originalRef;

        // 3. 合并新配置（config）
        if (config) {
            // 处理 key 和 ref（覆盖原属性）
            if ('key' in config) newKey = String(config.key); // key 必须是字符串
            if ('ref' in config) newRef = config.ref;

            // 处理其他属性（过滤 key/ref，应用 defaultProps）
            const defaultProps = (type as any).defaultProps;
            for (const prop in config) {
                if (Object.prototype.hasOwnProperty.call(config, prop) && !RESERVED_PROPS.has(prop)) {
                    const value = config[prop];
                    // 若属性为 undefined 且有默认值，用 defaultProps
                    newProps[prop] = value === undefined && defaultProps ? defaultProps[prop] : value;
                }
            }
        }

        // 4. 覆盖子节点（支持多参数 children）
        if (children.length) {
            newProps.children = children.length === 1 ? children[0] : children;
        }
        newProps.key = newKey;
        newProps.ref = newRef;
        // 5. 返回新元素（保留 React 元素标识）
        return {
            ...element, // 继承原元素其他属性（如 $$typeof）
            type,
            props: newProps,
            key: newKey,
            ref: newRef,
        } as ReactElement;
    }

    export const version = "18.2.0";

    class ComponentLifecycle<P, S> implements Type.ComponentLifecycle<P, S> {
        componentWillMount?(): void; // 即将移除，仅为兼容

        componentDidMount?(): void;

        shouldComponentUpdate?(nextProps: P, nextState: S): boolean;

        componentWillUpdate?(nextProps: P, nextState: S): void; // 即将移除
        componentDidUpdate?(prevProps: P, prevState: S): void;

        componentWillUnmount?(): void;
    }

    export function createRef() {
        const refObject = {
            current: null
        };

        {
            Object.seal(refObject);
        }
        return refObject;
    }

    export class Component<P = {}, S = {}> extends ComponentLifecycle<P, S> {
        readonly name?: string;
        defaultProps?: P;
        displayName?: string | undefined;
        readonly props: Readonly<P>;
        state: Readonly<S>;
        context: unknown;

        constructor(props: P) {
            super();
            this.props = props;
            this.state = {} as S;
        }

        setState<K extends keyof S>(
            _state: ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
            _callback?: () => void,
        ): void {
        };

        forceUpdate(_callback?: () => void): void {
        };

        render(): ReactNode {
            return null;
        }
    }


    export class PureComponent<P = {}, S = {}> extends Component<P, S> {
        shouldComponentUpdate(nextProps: P, nextState: S) {
            return !shallowEqual(this.props, nextProps as Readonly<P>) || !shallowEqual(this.state, nextState as Readonly<S>);
        }
    }

}

export const useState = React.useState;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useRef = React.useRef;
export const useCallback = React.useCallback;
export const createContext = React.createContext;
export const useContext = React.useContext;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useReducer = React.useReducer;
export const useTransition = React.useTransition;
export const useLayoutEffect = React.useLayoutEffect;
export const useId = React.useId;

export const createElement = React.createElement;
export const memo = React.memo;
export const Children = React.Children;
export const cloneElement = React.cloneElement;
export const createRef = React.createRef;
export const forwardRef = React.forwardRef;
export const Fragment = React.Fragment;
export const isValidElement = React.isValidElement;
export const version = React.version;
export const Component = React.Component;
export const PureComponent = React.PureComponent;

export default React
