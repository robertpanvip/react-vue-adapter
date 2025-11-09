const PIXEL_PROPERTIES = [
    'width', 'height',
    'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'fontSize', 'lineHeight', 'letterSpacing',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'top', 'right', 'bottom', 'left',
    'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    'outlineWidth',
    'flexBasis',
    'gap', 'columnGap', 'rowGap',
    // 动画/过渡
    'transitionDuration', 'animationDuration',
    // 文本
    'textIndent',
    // 阴影
    'boxShadow', 'textShadow', // 注意：这俩通常是字符串，不处理
] as const;

const PIXEL_SET = new Set<string>(PIXEL_PROPERTIES);

/**
 * 将 React 风格的 style 转换为 Vue 可用的 style
 * 数字 → 加 'px'，字符串 → 原样保留
 */
export function normalizeStyle(style: Record<string, any> | null | undefined): Record<string, any> {
    if (!style) return {};

    const result: Record<string, any> = {};

    for (const key in style) {
        const value = style[key];

        // 跳过 null / undefined
        if (value == null) continue;

        // 字符串直接保留（如 '50%', 'red', '1px solid black'）
        if (typeof value === 'string') {
            result[key] = value;
            continue;
        }

        // 数字：判断是否需要加 px
        if (typeof value === 'number') {
            if (PIXEL_SET.has(key)) {
                result[key] = `${value}px`;
            } else {
                // 非 px 属性（如 opacity, zIndex, flexGrow）直接转字符串
                result[key] = value;
            }
            continue;
        }

        // 其他类型（如对象、数组）转字符串
        result[key] = String(value);
    }

    return result;
}