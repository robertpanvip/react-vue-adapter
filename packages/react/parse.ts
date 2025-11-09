import type {VNode, Slots, VNodeProps} from 'vue'; // 复用之前的 VNode 转换函数
import React, {type ComponentType} from './';
import type {ReactNode} from './';

type RawSlots = {
    [name: string]: unknown;
    $stable?: boolean;
};

// 转换 Vue 事件名到 React（如 @click → onClick）
function transformEventName(vueEventName: string): string {
    if (!vueEventName.startsWith('on')) return vueEventName;
    // Vue 的事件名是 camelCase（如 onClick），与 React 一致，无需额外处理
    // 若遇到原生 Vue 指令（如 v-on:click），需转换为 onClick
    return vueEventName;
}

// 转换 Vue props 到 React props
function transformProps(vueProps: (VNodeProps & {
    [key: string]: any;
}) | null): Record<string, any> {
    const reactProps: Record<string, any> = {};
    if(!vueProps){
        return  reactProps
    }

    for (const [key, value] of Object.entries(vueProps)) {
        // 1. 处理特殊属性
        if (key === 'key') {
            reactProps.key = value; // React key 直接映射
            continue;
        }
        if (key === 'ref') {
            // Vue 的 ref 是响应式对象，React 需传递回调或 ref 对象
            reactProps.ref = value && typeof value === 'object' ? value.current : value;
            continue;
        }
        if (key === 'class') {
            reactProps.className = value; // class → className
            continue;
        }
        if (key === 'style') {
            reactProps.style = value; // 样式直接复用（Vue 和 React 样式对象兼容）
            continue;
        }

        // 2. 处理事件（Vue 的 onXxx 与 React 的 onClick 兼容）
        const eventKey = transformEventName(key);
        reactProps[eventKey] = value;
    }

    return reactProps;
}

function isRawSlots(val: unknown): val is RawSlots {
    return typeof val === 'object' && "$stable" in val
}

// 递归转换 VNode 为 ReactNode
export function vnodeToReactNode(vnode: VNode | null | undefined | string): ReactNode {
    if (!vnode) return null;
    if (typeof vnode === "string") {
        return vnode
    }
    // 1. 处理文本节点（Vue 的 shapeFlag 8 对应文本节点）
    if (vnode.shapeFlag === 8) {
        return vnode.children as string;
    }

    // 2. 处理 Fragment（Vue 的 Fragment 对应 React 的 Fragment）
    if (vnode.type === Symbol.for('vue.fragment')) {
        let children: ReactNode = []
        if (isRawSlots(vnode.children)) {
            children = []
        } else {
            children = Array.isArray(vnode.children)
                ? vnode.children.map(child => vnodeToReactNode(child as VNode))
                : [vnodeToReactNode(vnode.children)];
        }
        return React.createElement(React.Fragment, {key: vnode.key}, ...children);
    }

    // 3. 处理普通元素/组件
    const type = vnode.type as string | ComponentType;
    const props = transformProps(vnode.props);
    let children: ReactNode = [];
    if (isRawSlots(vnode.children)) {
        children = []
    } else {
        children = Array.isArray(vnode.children)
            ? vnode.children.map(child => vnodeToReactNode(child as VNode))
            : vnodeToReactNode(vnode.children);
    }
    // 4. 创建 React 元素
    return React.createElement(
        type,
        props,
        // 若 children 是数组且长度为 1，直接传递（避免 React 多子节点警告）
        Array.isArray(children) && children.length === 1 ? children[0] : children
    );
}

// 解析 Vue slots 为 React 可识别的 props（含 children 和具名插槽）
export function resolveSlotsToReactProps(slots: Slots): Record<string, any> {
    const reactProps: Record<string, any> = {};

    // 1. 处理默认插槽（default slot）→ React children
    const defaultSlot = slots.default?.();
    if (defaultSlot) {
        reactProps.children = Array.isArray(defaultSlot)
            ? defaultSlot.map(vnode => vnodeToReactNode(vnode)) // 多个节点转换为数组
            : vnodeToReactNode(defaultSlot); // 单个节点直接转换
    }

    // 2. 处理具名插槽（named slots）→ 作为 props 字段传递
    for (const [name, slotFn] of Object.entries(slots)) {
        if (name === 'default') continue; // 已处理默认插槽

        const slotContent = slotFn();
        reactProps[name] = Array.isArray(slotContent)
            ? slotContent.map(vnode => vnodeToReactNode(vnode))
            : vnodeToReactNode(slotContent);
    }

    // 3. 处理作用域插槽（scoped slots）→ 转换为 render props 函数
    // （Vue 作用域插槽本质是带参数的函数，返回 VNode）
    for (const [name, slotFn] of Object.entries(slots)) {
        if (typeof slotFn !== 'function') continue;

        // 包装为 React 风格的 render props：(props) => ReactNode
        reactProps[name] = (scope: any) => {
            const slotContent = slotFn(scope); // 传递作用域参数
            return Array.isArray(slotContent)
                ? slotContent.map(vnode => vnodeToReactNode(vnode))
                : vnodeToReactNode(slotContent);
        };
    }

    return reactProps;
}