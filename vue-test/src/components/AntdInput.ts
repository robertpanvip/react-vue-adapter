import {Input, ConfigProvider} from 'antd'
import React from '@react-vue/react'
import {factory} from '@react-vue/adapter'
function useStyle(css: string, uniqueId: string) {
    React.useInsertionEffect(() => {
        console.log('useInsertionEffect');
        if (document.getElementById(uniqueId)) return;

        const style = document.createElement('style');
        style.id = uniqueId;
        style.textContent = css;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, [css, uniqueId]);
}
function MyInput() {
    //useStyle('antd-xxx','xx2')
    return React.createElement(Input)
}

export default factory(Input)