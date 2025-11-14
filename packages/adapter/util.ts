import type {ComponentObjectPropsOptions, Slots, VNode, Slot,} from "vue";
import React, {createSlot} from '@react-vue/react';
import {createTextVNode, Fragment, h} from "vue";

function resolveVNode(vNode: VNode) {
    if (typeof vNode.type === 'string') {
        const children = vNode.children;
        let fragment: VNode;
        if (Array.isArray(children)) {
            fragment = h(Fragment, children)
        } else {
            fragment = typeof children === "string" ? createTextVNode(children) : createTextVNode('');
        }
        const props = parseVueProp(vNode.props as any);
        if (typeof props.ref === 'string') {
            const str = props.ref;
            props.ref = (ele: Element) => {
                (vNode as any).ctx.devtoolsRawSetupState[str].value = ele;
            }
        }
        return React.createElement(vNode.type, props, createSlot(fragment))
    } else {
        return createSlot(vNode)
    }
}

const resolveSlot = (slot: Slot) => {
    if (slot.length == 0) {
        const vNodes = slot();

        return vNodes.map(v => {
            return resolveVNode(v)
        });
    } else {
        return (...args: unknown[]) => {
            const vNodes = slot(...args)
            return vNodes.map(v => resolveVNode(v));
        }
    }
}

function parseVueProp(vueProps: Record<string, unknown> = {},) {
    const reactProps: Record<string, unknown> = {...vueProps};
    if (reactProps.class) {
        reactProps.className = reactProps.class;
        delete reactProps.class
    }
    return reactProps;
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
    let reactProps: Record<string, unknown> = {...vueProps, ...attrs};
    reactProps = parseVueProp(reactProps)
    Object.entries(slots).forEach(([k, v]) => {
        reactProps[k === 'default' ? "children" : k] = v ? resolveSlot(v) : undefined
    })
    return reactProps;
}

export function vNodeToJSON(vNode: VNode): Record<string, any> | null {
    if (!vNode) return null;

    // 提取核心属性（根据需要增删）
    const plainObj: Record<string, any> = {
        type: typeof vNode.type === 'function'
            ? vNode.type.name || 'AnonymousComponent'  // 函数组件取名称
            : vNode.type,  // 字符串标签（如 'div'）或对象
        props: vNode.props ? {...vNode.props} : null,
        key: vNode.key,
        children: Array.isArray(vNode.children)
            ? vNode.children.map(child =>
                // 递归处理子 VNode
                typeof child === 'object' && child ? vNodeToJSON(child as VNode) : child
            )
            : typeof vNode.children === 'object' && vNode.children
                ? vNodeToJSON(vNode.children as unknown as VNode)
                : vNode.children,  // 文本节点等
        shapeFlag: vNode.shapeFlag,  // 节点类型标识（如元素/组件/文本）
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