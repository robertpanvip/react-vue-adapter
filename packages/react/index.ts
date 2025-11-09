import {
    Fragment as VueFragment,
    h,
    isRef,
    isVNode,
    ref,
    type Ref,
    shallowRef,
    type ShallowRef,
    withCtx,
    Text,
    type Slots,
    type VNode,
    type VNodeArrayChildren,
} from 'vue';
import {normalizeStyle} from "./style";
import {
    type ComponentType,
    type Consumer,
    type ConsumerProps,
    type Context,
    type Dispatch,
    type FC,
    type ForwardRefExoticComponent,
    type ForwardRefRenderFunction,
    type Fragment,
    type FunctionComponent,
    type PropsWithoutRef,
    type Provider,
    type ProviderProps,
    type ReactElement,
    type ReactNode,
    type Reducer,
    type Ref as ReactRef,
    type RefAttributes,
    type VueSlot
} from './type';

export * from './type'

// === 模拟 React Fiber 架构的上下文管理 ===
interface Fiber {
    runtime: Runtime;
    parent: Fiber | null;
}

// 用栈管理当前组件的 Fiber 节点（替代全局变量）
const fiberStack: Fiber[] = [];
export const CurrentDispatcher: { current: Fiber | null } = {
    current: null
}

// 入栈：进入组件渲染
export function pushFiber(runtime: Runtime) {
    const newFiber: Fiber = {runtime, parent: CurrentDispatcher.current};
    fiberStack.push(newFiber);
    CurrentDispatcher.current = newFiber;
}

// 出栈：离开组件渲染
export function popFiber() {
    fiberStack.pop();
    CurrentDispatcher.current = fiberStack[fiberStack.length - 1] || null;
}

// 确保当前有活跃的组件上下文
function ensureCurrentRuntime(): Runtime {
    if (!CurrentDispatcher.current?.runtime) {
        throw new Error('Hooks can only be called inside a React component (check for conditional calls)');
    }
    return CurrentDispatcher.current.runtime;
}

// === Runtime 定义（组件实例的状态容器） ===
export interface Runtime {
    hooks: Array<Hook>; // 存储所有 hooks 状态
    hookIndex: number; // 当前 hooks 调用索引（确保顺序性）
    triggerRender: (() => void) | null; // 触发重渲染的函数
    pendingEffects: Effect[]; // 待执行的副作用（useEffect）
    pendingLayoutEffects: Effect[]; // 待执行的副作用（useLayoutEffects）
    contextMap: Map<Context<any>, any>; // 存储 Context 订阅
}

// 单个 Hook 的类型（支持不同类型的 hook）
type Hook =
    | { type: 'state'; ref: Ref<any> }
    | { type: 'ref'; ref: ShallowRef<{ current: any }> }
    | { type: 'memo'; deps: Ref<any[]>; value: Ref<any> }
    | { type: 'callback'; deps: Ref<any[]>; value: Ref<Function> }
    | { type: 'imperative', ref: ShallowRef<any> }
    | { type: 'id', value: string }
    | { type: 'effect'; deps: Ref<any[] | undefined>; cleanup: Ref<(() => void) | null> }
    | { type: 'layoutEffect'; deps: Ref<any[] | undefined>; cleanup: Ref<(() => void) | null> }
    | { type: 'insertionEffect'; deps: any[] | undefined; cleanup: (() => void) | null };

// 副作用类型（模拟 React 的 effect 调度）
interface Effect {
    fn: () => (() => void) | void;
    cleanup: (() => void) | null;
    deps: any[] | undefined;
}

// 创建新的 Runtime（每个组件实例独立）
export function createReactRuntime(): Runtime {
    return {
        hooks: [],
        hookIndex: 0,
        triggerRender: null,
        pendingEffects: [],
        pendingLayoutEffects: [],
        contextMap: new Map(),
    };
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

const FRAGMENT_SYMBOL = Symbol.for('react.fragment') as unknown as Fragment;
// 标记 forwardRef 组件的符号（避免与普通组件混淆）
const FORWARD_REF_SYMBOL = Symbol.for('react.forward_ref');
const PROVIDER_SYMBOL = Symbol.for('react.provider');
const CONSUMER_SYMBOL = Symbol.for('react.consumer');
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const VUE_SLOT_TYPE = Symbol.for('vue.slot');

// === Hooks 实现 ===
export function useState<T>(initialState: T | (() => T)): [T, (updater: T | ((prev: T) => T)) => void] {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    // 初始化状态（只在首次调用时执行）
    if (!runtime.hooks[index]) {
        const initialValue = typeof initialState === 'function'
            ? (initialState as () => T)()
            : initialState;
        runtime.hooks[index] = {type: 'state', ref: ref<T>(initialValue)};
    }

    const hook = runtime.hooks[index] as { type: 'state'; ref: Ref<T> };
    const stateRef = hook.ref;

    // 状态更新函数（严格模拟 React 的 updater 逻辑）
    const setState = (updater: T | ((prev: T) => T)) => {
        const newValue = typeof updater === 'function'
            ? (updater as (prev: T) => T)(stateRef.value)
            : updater;

        if (newValue !== stateRef.value) {
            stateRef.value = newValue;
            runtime.triggerRender?.(); // 触发重渲染
        }
    };

    return [stateRef.value, setState];
}

export function useEffect(effect: () => (() => void) | void, deps?: any[]) {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    // 初始化 effect 数据
    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {
            type: 'effect',
            deps: ref<any[] | undefined>(deps),
            cleanup: ref<(() => void) | null>(null),
        };
    }

    const hook = runtime.hooks[index] as {
        type: 'effect';
        deps: Ref<any[] | undefined>;
        cleanup: Ref<(() => void) | null>;
    };

    // 检查依赖是否变化（严格模拟 React 的浅比较）
    const depsChanged = !hook.deps.value
        ? true
        : !deps
            ? true
            : hook.deps.value.length !== deps.length
                ? true
                : hook.deps.value.some((dep: any, i: number) => dep !== deps[i]);

    if (depsChanged) {
        // 存储新的副作用（将在渲染后异步执行）
        runtime.pendingEffects.push({
            fn: effect,
            cleanup: hook.cleanup.value,
            deps,
        });
        hook.deps.value = deps; // 更新依赖缓存
    }
}

export function useMemo<T>(factory: () => T, deps: any[]): T {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {
            type: 'memo',
            deps: ref(deps),
            value: ref<T>(factory()),
        };
    }

    const hook = runtime.hooks[index] as {
        type: 'memo';
        deps: Ref<any[]>;
        value: Ref<T>;
    };

    // 依赖变化时重新计算（同 React 逻辑）
    const depsChanged = hook.deps.value.some((dep: any, i: number) => dep !== deps[i]);
    if (depsChanged) {
        hook.deps.value = deps;
        hook.value.value = factory();
    }

    return hook.value.value;
}

export function useRef<T>(initialValue?: T): { current: T | undefined } {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {
            type: 'ref',
            ref: shallowRef<{ current: T | undefined }>({current: initialValue}),
        };
    }

    const hook = runtime.hooks[index] as { type: 'ref'; ref: ShallowRef<{ current: T | undefined }> };
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
    const r = CurrentDispatcher.current?.runtime
    if (!r) {
        return context._defaultValue as T
    }
    const contentValue = r.contextMap.get(context);
    if (contentValue === undefined) {
        return context._defaultValue as T
    }
    return contentValue.value;
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
            // 更新 hook 中的清理函数（供下次使用）
            const index = runtime.hookIndex - runtime.pendingEffects.length; // 计算对应 hook 索引
            if (runtime.hooks[index]?.type === 'effect') {
                (runtime.hooks[index] as any).cleanup.value = typeof cleanup === 'function' ? cleanup : null;
            }
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


// 保持 flattenChildren 函数不变
function flattenChildren(children: any[]): any[] {
    const result: any[] = [];
    children.forEach(child => {
        if (Array.isArray(child)) {
            result.push(...flattenChildren(child));
        } else if (child === null || child === undefined || child === false || child === true) {
            return;
        } else if (typeof child === 'string' || typeof child === 'number') {
            result.push(String(child));
        } else if (isVNode(child)) {
            result.push(child);
        } else {
            result.push(String(child));
        }
    });
    return result;
}

export function useImperativeHandle<T>(
    ref: ReactRef<T> | undefined,
    create: () => T
) {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;
    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {type: 'imperative', ref: shallowRef(null)};
    }
    const hook = runtime.hooks[index] as any;
    if (typeof create !== 'function') {
        throw new Error(`Unsupported create type: ${typeof create}`);
    }
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

// 定义 ref 类型（支持函数和 Ref 对象，与 React 一致）
//type ReactRef<T> = ((instance: T | null) => void) | Ref<T | null> | null;


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

export function useLayoutEffect(
    effect: () => (() => void) | void,
    deps?: any[]
) {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {
            type: 'layoutEffect',
            deps: ref(deps),
            cleanup: ref<(() => void) | null>(null),
        };
    }

    const hook = runtime.hooks[index] as {
        deps: Ref<any[] | undefined>;
        cleanup: Ref<(() => void) | null>;
    };

    const depsChanged = !hook.deps.value
        ? true
        : !deps
            ? true
            : hook.deps.value.some((d, i) => d !== deps[i]);

    if (depsChanged) {
        runtime.pendingLayoutEffects = runtime.pendingLayoutEffects || [];
        runtime.pendingLayoutEffects.push({
            fn: effect,
            cleanup: hook.cleanup.value,
            deps,
        });
        hook.deps.value = deps;
    }
}

export function useInsertionEffect(
    effect: () => (() => void) | void,
    deps?: any[]
) {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;

    // 初始化 effect 数据（复用类似 useEffect 的存储逻辑）
    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {
            type: 'insertionEffect', // 新增类型标识
            deps: deps ? [...deps] : undefined,
            cleanup: null as (() => void) | null,
        };
    }

    const hook = runtime.hooks[index] as {
        type: 'insertionEffect';
        deps: any[] | undefined;
        cleanup: (() => void) | null;
    };

    // 检查依赖是否变化（浅比较）
    const depsChanged = !hook.deps
        ? true
        : !deps
            ? true
            : hook.deps.length !== deps.length
                ? true
                : hook.deps.some((dep: any, i: number) => dep !== deps[i]);

    if (depsChanged) {
        // 先执行上一次的清理函数
        if (hook.cleanup) {
            hook.cleanup();
        }
        // 同步执行 effect（核心：确保在 DOM 渲染前执行）
        const cleanup = effect();
        hook.cleanup = typeof cleanup === 'function' ? cleanup : null;
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

export function flushLayoutEffects(runtime: Runtime) {
    const effects = runtime.pendingLayoutEffects || [];
    runtime.pendingLayoutEffects = [];

    // 1. 同步执行 cleanup
    effects.forEach(e => e.cleanup?.());

    // 2. 同步执行新 effect
    effects.forEach(e => {
        const cleanup = e.fn();
        if (typeof cleanup === 'function') {
            // 找到对应 hook，更新 cleanup
            const hookIndex = runtime.hooks.findIndex(
                h => h.type === 'layoutEffect' && h.deps.value === e.deps
            );
            if (hookIndex !== -1) {
                (runtime.hooks[hookIndex] as any).cleanup.value = cleanup;
            }
        }
    });
}

let idCounter = 0;

export function useId() {
    const runtime = ensureCurrentRuntime();
    const index = runtime.hookIndex++;
    if (!runtime.hooks[index]) {
        runtime.hooks[index] = {type: 'id', value: `:${idCounter++}:`};
    }
    return (runtime.hooks[index] as any).value;
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
 * areEqual 函数签名
 * prevProps 和 nextProps 必须结构相同
 */
export type AreEqual<P> = (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean;

export function memo<P extends object>(
    Component: FC<P>,
    areEqual?: AreEqual<P>
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
    map(children: any, fn: (child: any, index: number) => any) {
        return flattenChildren(children).map(fn);
    },
    forEach(children: any, fn: (child: any) => any) {
        flattenChildren(children).forEach(fn);
    },
    toArray(children: any) {
        return flattenChildren(children);
    },
    count(children: any): number {
        let total = 0;

        // 递归遍历所有子节点，统计有效节点
        const traverse = (node: any) => {
            // 过滤无效节点（React 语义：null/undefined/true/false 视为无效）
            if (node === null || node === undefined || typeof node === 'boolean') {
                return;
            }
            // 数组：递归遍历每个子元素
            if (Array.isArray(node)) {
                node.forEach(item => traverse(item));
                return;
            }
            // VNode、字符串、数字 视为有效节点，计数+1
            if (isVNode(node) || typeof node === 'string' || typeof node === 'number') {
                total++;
                return;
            }
            // 其他类型（如普通对象）视为无效节点（与 React 行为一致）
        };

        traverse(children);
        return total;
    },
    only<C>(children: C): C extends any[] ? never : C {
        // 先统计有效子节点数量
        const validCount = Children.count(children);

        // 数量不为 1 直接报错（与 React.Children.only 行为一致）
        if (validCount !== 1) {
            throw new Error(
                'React.Children.only expected to receive a single React element child.'
            );
        }

        // 递归找到第一个有效子节点并返回
        const findSingleValidNode = (node: any): any => {
            if (node === null || node === undefined || typeof node === 'boolean') {
                return null;
            }

            if (Array.isArray(node)) {
                for (const item of node) {
                    const result = findSingleValidNode(item);
                    if (result) return result;
                }
                return null;
            }

            if (isVNode(node) || typeof node === 'string' || typeof node === 'number') {
                return node;
            }
            return null;
        };
        const singleNode = findSingleValidNode(children);
        return singleNode as C extends any[] ? never : C;
    }
};

export function createSlot(name: string, context: { slots: Slots }) {
    const Slot = (props: { args: unknown[] }) => {
        const fn = context.slots[name] || (() => void 0)
        const type = fn(...(props.args || []))
        return type as unknown as VNode
    }
    Slot.$$typeof = VUE_SLOT_TYPE;

    const CallAble = (...args: unknown[]) => {
        return {
            type: Slot,
            props: {
                args
            }
        };
    }
    CallAble.$$typeof = VUE_SLOT_TYPE;
    CallAble.type = () => CallAble()
    CallAble.props = {};
    return CallAble;
}

export function isValidElement(object: any): object is ReactElement {
    return typeof object === 'object' &&
    object !== null ? object.$$typeof === REACT_ELEMENT_TYPE : false;
}

// 模拟 React.createElement，将 React 元素转换为 Vue VNode
export function createElement<P extends Record<string, any>>(
    type: string
        | ComponentType<P>
        | Provider<P>
        | Consumer<P>
        | ForwardRefExoticComponent<P>,
    props: P | null = null,
    ...children: any[]
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

    const element = {
        type: type,
        props: {
            ...normalizedProps,
            children: normalizedProps.children || (children.length == 1 ? children[0] : children)
        },
        $$typeof: REACT_ELEMENT_TYPE
    }
    if (Object.freeze) {
        Object.freeze(element.props);
        Object.freeze(element);
    }
    return element as unknown as ReactElement<P>;
}

function isClassComponent(type: Function): type is typeof Component {
    return typeof type.prototype === 'object' && type.prototype instanceof Component && typeof type.prototype.render === 'function'
}

// 模拟 React.createElement，将 React 元素转换为 Vue VNode
export function createVNodeFromReactElement(ele: ReactNode): VNode {
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

    if (type === FRAGMENT_SYMBOL) {
        return h(VueFragment, createVNodeFromReactElement(children) as unknown as VNodeArrayChildren); // 直接返回子节点数组
    }

    // 5. 处理原生标签（div、span 等）
    if (typeof type === 'string') {

        const {children, ...rest} = props;
        const v = createVNodeFromReactElement(children);
        return h(type, rest, v);
    }

// 4. 处理函数组件
    if (typeof type === 'function') {
        // 3. 处理 Context.Provider
        if ("$$typeof" in type) {
            if (type.$$typeof === VUE_SLOT_TYPE) {
                const Slot = type as VueSlot<any>;
                return h(VueFragment,[Slot(props) as VNode])
            }
            let result: ReactNode = null;
            if (type.$$typeof === CONSUMER_SYMBOL) {
                const Consumer = type as Consumer<any>
                const _props = {children: children};
                result = Consumer(_props);
                // 转发 ref 的组件
            }
            return createVNodeFromReactElement(result) as VNode;
        }
        const Comp = isClassComponent(type) ? wrapClassComponent(type) : type;
        // 函数组件的 children 仍需作为 props 传递（符合 React 习惯）
        const componentProps = {...props, children: children} as unknown as any;
        const result = (Comp as FunctionComponent)(componentProps)
        return createVNodeFromReactElement(result);
    }
    if (isForwardRef(type)) {
        let _type = type as ForwardRefExoticComponent<any>
        const Comp = (_type as any).render as ForwardRefRenderFunction<any>;
        const result = Comp(props, props.ref);
        return createVNodeFromReactElement(result);
    }

    throw new Error(`Unsupported element type: ${type}`);
}

function isForwardRef(type: any): type is ForwardRefExoticComponent<any> {
    return typeof type === 'object' && type !== null
        && "$$typeof" in type
        && type?.$$typeof === FORWARD_REF_SYMBOL
        && 'render' in type
}

// 保留属性：key 和 ref 不进入 props
const RESERVED_PROPS = new Set(['key', 'ref']);

export function cloneElement<P extends object>(element: ReactElement, config: P, ...children: ReactNode[]) {
    // 1. 校验输入有效性
    if (!element || typeof element !== 'object' || !element.type) {
        throw new Error('cloneElement: First argument must be a valid element');
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

class ComponentLifecycle<P, S> {
    readonly name?: string;
    defaultProps?: P;
    displayName?: string | undefined;

    componentWillMount?(): void; // 即将移除，仅为兼容
    componentDidMount?(): void;

    shouldComponentUpdate?(nextProps: P, nextState: S): boolean;

    componentWillUpdate?(nextProps: P, nextState: S): void; // 即将移除
    componentDidUpdate?(prevProps: P, prevState: S): void;

    componentWillUnmount?(): void;
}

export class Component<P = {}, S = {}> extends ComponentLifecycle<P, S> {
    props: P;
    state: S;
    context: any;

    constructor(props: P, context?: any) {
        super();
        this.props = props;
        this.state = {} as S;
        this.context = context;
    }

    setState(_updater: any, _callback?: () => void) {
    }

    render(): ReactNode {
        return null;
    }
}

export class PureComponent<P = {}, S = {}> extends Component<P, S> {
    shouldComponentUpdate(_nextProps: any, _nextState: any) {
        return true;
    }
}

// 实现类组件的渲染转换（将类组件转换为可被 Vue 识别的函数组件）
function wrapClassComponent<P, S = {}>(ComponentClass: typeof Component<P, S>): FC<P> {
    return (props: P) => {
        // 1. 创建组件实例（仅在首次渲染时）
        const [instance] = useState(() => new ComponentClass(props));
        const [state, setState] = useState<S>({} as S);

        // 2. 同步 props 到实例（每次渲染时更新）
        instance.props = props;
        instance.state = state;
        instance.setState = (updater: any, callback?: () => void) => {
            setState(updater);
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

        // 5. 执行 render 并转换为 Vue VNode
        return instance.render();
    };
}

export default {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
    createContext,
    useContext,
    useImperativeHandle,
    useLayoutEffect,
    useId,
    createElement,
    cloneElement,
    forwardRef,
    Children,
    Fragment: FRAGMENT_SYMBOL,
    isValidElement,
    version,
    Component,
    PureComponent
};