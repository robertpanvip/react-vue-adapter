import ResizeObserver from 'rc-resize-observer'
import {factory} from '@react-vue/adapter'
/*import React from '@react-vue/react'
import {useComposeRef} from 'rc-util/es/ref'
import useRef = React.useRef;
import useEffect = React.useEffect;
function Test() {
    const ref = useRef(null)
    const mergedRef = useComposeRef(ref, (ele)=>{
        console.log(ele);
    });
    useEffect(()=>{

    },[])
    const jsx=React.createElement('div',{
        ref:ref
    });
    return React.cloneElement(jsx, { ref:mergedRef})
}*/
export default factory(ResizeObserver)