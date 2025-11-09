import {factory} from '@react-vue/adapter'
import React from '@react-vue/react'

type ProviderProps = {
    a: number;
    children: React.ReactNode,
    onClick: (e:MouseEvent) => void
}
const Provider = ({children, onClick}: ProviderProps) => {
    //console.dir(children);
    return children({title: '123'})
}
export default factory(Provider) as unknown as typeof Provider