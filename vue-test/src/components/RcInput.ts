import Input from 'rc-input'
import React from '@react-vue/react'
import {factory} from '@react-vue/adapter'
function MyInput() {
    return React.createElement(Input, {
        ref(ele){
            console.log(ele);
        }
    })
}
export default factory(Input)