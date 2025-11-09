import React, {
    createContext,
    forwardRef,
    useContext,
    useEffect,
    useImperativeHandle,
    useRef,
    useState
} from '@react-vue/react'
import {factory} from '@react-vue/adapter'

const Button = forwardRef(function (props, xxRef) {
    const [state, setState] = useState<number>(0);
    const ref = useRef<HTMLDivElement>()
    const handleClick = () => {
        setState(state + 1)
    }
    //console.log('button',ref)
    useEffect(() => {
        console.log('zzz', state, ref.current)
        return () => {
            //console.log('clean', ref.current)
        }
    }, [state])
    useImperativeHandle(xxRef, () => ({
        text() {

        }
    }))
    return React.createElement('button', {
        style: {padding: 10, border: "1px solid red"},
        ref(node) {
            //console.log(node)
            ref.current = node;
        },
        onClick: handleClick
    }, state)
})

const MyApp = () => {
    return React.createElement('div', {
        style: {padding: 20, border: "1px solid blue"},

    }, React.createElement(Button, {
        ref(v) {
            console.log(v)
        }
    }))
}
const MyContext = createContext(0);
const Middle = ({children}: any) => React.createElement('div', {}, children);
// 消费组件：使用 Consumer
const ConsumerComp = () => {
    const v = useContext(MyContext);
    //return React.createElement("div", {}, ["值" + v])
    return React.createElement(MyContext.Consumer, {} as any, (v) => {
        return React.createElement("div", {}, ["值zzzz" + v])
    })
}

const Parent = () => {
    const [value, setValue] = useState(1);

    return React.createElement(MyContext.Provider, {value: 111},
        React.createElement(MyContext.Provider,
            {value},
            React.createElement('button', {
                onClick() {
                    setValue(pre => pre + 1)
                }
            }, ['按钮' + value]),
            React.createElement(Middle, {},
                React.createElement(ConsumerComp)
            )
        )
    )
};
export default factory(Button)