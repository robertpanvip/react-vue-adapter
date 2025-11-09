import type {Component} from './index'

export type FC<P = {}> = FunctionComponent<P>;
/**
 * React 支持的子节点类型（ReactNode）
 * 包括：string, number, boolean, null, undefined, VNode, Array<ReactNode>
 */
export type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactPortal
    | ReactElement
    | Array<ReactNode>

export interface ReactElement<
    P = any,
    T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>,
> {
    type: T;
    props: P;
    key?: string | null;
};

export type ComponentType<P = {}> = Component<P> | FunctionComponent<P>;

export type Fragment = ExoticComponent<{ children?: ReactNode | undefined }>;
/**
 * JSX 元素构造器（函数组件或类组件）
 */
export type JSXElementConstructor<P> =
    | ((props: P) => ReactNode)
    | (new(props: P) => Component<any, any>);

/**
 * 函数组件（FC = FunctionComponent）
 */
export interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactNode;

    displayName?: string;
    defaultProps?: Partial<P>;
}

/**
 * memo 组件包装类型
 */
export interface MemoExoticComponent<P = {}> extends FunctionComponent<P> {
    readonly type: FunctionComponent<P>;
}

interface ExoticComponent<P = {}> {
    (props: P): ReactNode;

    readonly $$typeof: symbol;
}

interface NamedExoticComponent<P = {}> extends ExoticComponent<P> {
    displayName?: string | undefined;
}

export type PropsWithoutRef<P> =
    P extends any ? ("ref" extends keyof P ? Omit<P, "ref"> : P) : P;

export interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> {
    defaultProps?: Partial<P> | undefined;
    propTypes?: never;
}

export interface ForwardRefRenderFunction<T, P = {}> {
    (props: P, ref: ForwardedRef<T>): ReactNode;

    displayName?: string | undefined;
    defaultProps?: never | undefined;
    propTypes?: never | undefined;
}

/* ==================== JSX Intrinsic Elements ==================== */
/**
 * 所有原生 HTML 标签
 */
//export interface IntrinsicElements extends HTMLAttributes {}


/* ==================== 样式类型 ==================== */
type CSSPropertyKeys = {
    [K in keyof CSSStyleDeclaration]: K extends string ? K : never;
}[keyof CSSStyleDeclaration];
/**
 * camelCase → kebab-case
 * fontSize → font-size
 */
type CamelToKebab<T extends string> = T extends `${infer A}${infer B}`
    ? B extends Uncapitalize<B>
        ? `${Uncapitalize<A>}${CamelToKebab<B>}`
        : `${Uncapitalize<A>}-${CamelToKebab<B>}`
    : T;

export type CSSProperties = {
    [K in CSSPropertyKeys as | CamelToKebab<K>
        | `--${string}`
        | `webkit-${string}`
        | `moz-${string}`
        | `ms-${string}`]?: string | number | null;
};


/* ==================== 上下文类型 ==================== */

export interface Context<T> {
    displayName?: string | undefined;
    _defaultValue: T;
    Provider: Provider<T>;
    Consumer: Consumer<T>;
}

export interface ProviderExoticComponent<P> extends ExoticComponent<P> {
    propTypes?: unknown | undefined;
}

export type Provider<T> = ProviderExoticComponent<ProviderProps<T>>;

export type VueSlot<T> = ExoticComponent<T>;

export interface ProviderProps<T> {
    value: T;
    children?: ReactNode | undefined;
}

export interface ConsumerProps<T> {
    children: (value: T) => ReactNode;
}

export type Consumer<T> = ExoticComponent<ConsumerProps<T>>;

/* ==================== Ref 类型 ==================== */

export interface RefObject<T> {
    readonly current: T | null;
}

export interface MutableRefObject<T> {
    current: T;
}

export type RefCallback<T> = ((instance: T | null) => void)
export type Ref<T> = RefCallback<T> | RefObject<T> | null;
export type LegacyRef<T> = string | Ref<T>;
export type ForwardedRef<T> = ((instance: T | null) => void) | MutableRefObject<T | null> | null;
export type Key = string | number | bigint;

export interface Attributes {
    key?: Key | null | undefined;
}

export interface RefAttributes<T> extends Attributes {
    ref?: LegacyRef<T> | undefined;
}

export interface ReactPortal extends ReactElement {
    children: ReactNode;
}

export type Dispatch<A> = (value: A) => void;
export type Reducer<S, A> = (prevState: S, action: A) => S;