// vue-react-shim/dom.ts
import {createApp, h, Teleport} from 'vue';
import React, {createSlot, createVNodeFromReactElement} from '@react-vue/react'

export function render(Component: any, container: HTMLElement) {
    createApp({render: () => h(Component)}).mount(container);
}

export const createPortal = (children: React.ReactNode, container: HTMLElement) => {
    const _children = createVNodeFromReactElement(children);
    return createSlot("default", {
        slots: {
            default: () => [h(Teleport, {to: container}, _children)]
        }
    })
}


export function flushSync() {
    console.warn('flushSync')
}

export function unstable_batchedUpdates() {
    console.warn('unstable_batchedUpdates')
}

export default {render, createPortal};
