import {createApp, h, Teleport} from 'vue';
import React, {createSlot, createVNodeFromReactElement} from '@react-vue/react'
import {factory} from '@react-vue/adapter'

export interface RootOptions {
    identifierPrefix?: string;
    onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
}

export interface ErrorInfo {
    digest?: string;
    componentStack?: string;
}

export function render(children: React.ReactNode, container: any) {
    const app = createApp(factory(() => children))
    app.mount(container);
    container.__unmount = app.unmount;
    return app.unmount
}

export function unmountComponentAtNode(container: any) {
    return container.__unmount?.();
}

export type Container =
    | Element
    | DocumentFragment

export interface Root {
    render(children: React.ReactNode): void;

    unmount(): void;
}

export function createRoot(container: Container, options?: RootOptions): Root {
    let unmount: () => void;
    const innerRender = (children: React.ReactNode) => {
        unmount = render(children, container);
    }
    return {
        render: innerRender,
        unmount: () => unmount?.()
    }
}

export const createPortal = (children: React.ReactNode, container: HTMLElement) => {
    const _children = createVNodeFromReactElement(children);
    return createSlot(h(Teleport, {to: container}, _children))
}


export function flushSync() {
    console.warn('flushSync')
}

export function unstable_batchedUpdates() {
    console.warn('unstable_batchedUpdates')
}

export default {render, unmountComponentAtNode, createPortal, createRoot};
