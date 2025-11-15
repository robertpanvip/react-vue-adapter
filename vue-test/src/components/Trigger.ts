import Trigger from '@rc-component/trigger'
import Popup from '@rc-component/trigger/es/Popup'
//import useAlign from "@rc-component/trigger/es/hooks/useAlign";
import Portal from '@rc-component/portal';
import {factory} from '@react-vue/adapter'
import React from '@react-vue/react'
function Test(props) {
    const arrowPos = {
        x: 0,
        y: 0
    };
    return React.createElement(Popup, {
        open:true,
        popup:React.createElement('div',{},123),
        portal:Portal,
        arrowPos,
        onVisibleChanged(v){
            console.log(v)
        }
    })
}
export default factory(Trigger)