// vue-react-shim/dom.ts
import { createApp, h } from 'vue';

export function render(Component: any, container: HTMLElement) {
    createApp({ render: () => h(Component) }).mount(container);
}

export const createPortal = (children: any, container: HTMLElement) =>
    h('teleport', { to: container }, children);

export function flushSync() {
    console.warn('flushSync')
}
export function unstable_batchedUpdates() {
    console.warn('unstable_batchedUpdates')
}
export default { render, createPortal };
