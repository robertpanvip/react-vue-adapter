import {ComponentObjectPropsOptions, Slots, VNode} from "vue";
import {createSlot} from '@react-vue/react';

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

export function vNodeToJSON(vNode: VNode): Record<string, any> {
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
                ? vNodeToJSON(vNode.children as unknown as  VNode)
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