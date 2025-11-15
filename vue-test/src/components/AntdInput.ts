import {Input, ConfigProvider} from 'antd'
import React from '@react-vue/react'
import {factory} from '@react-vue/adapter'
function useStyle(css: string, uniqueId: string) {
    const ref = React.useRef<HTMLInputElement>()
    React.useInsertionEffect(() => {

        console.log('useInsertionEffect');
        ref.current={a:123}

        return () => {

            console.log('useInsertionEffect-unmount', ref.current);
        };
    }, [css, uniqueId]);
}
function MyInput() {
    useStyle('antd-xxx','xx2')
    return React.createElement(Input)
}

export default factory(MyInput)