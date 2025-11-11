import {factory} from '@react-vue/adapter'
import React from '@react-vue/react'

type ProviderProps = {
}
const Context=React.createContext<{}>({});
const Provider = (props: ProviderProps) => {
    return React.createElement(Context.Provider, props)
}
export default factory(Provider) as unknown as typeof Provider