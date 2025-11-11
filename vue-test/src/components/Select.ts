import Select from 'rc-select'
import 'rc-select/assets/index.css'
import React from '@react-vue/react'
import {factory} from '@react-vue/adapter'

const Button = (props) => {
    console.log('props',props,typeof props.children);
    return React.createElement(
        'button',
        {
            ...props,
        },
        props.children
    )
}
export default factory(Select)