<script setup lang="ts">
import {onMounted, ref} from 'vue'
import Button from './components/Button.ts'
import Provider from './components/Provider.ts'
import RcInput from './components/RcInput.ts';
//import AntdConfigProvider from './components/AntdConfigProvider.ts';
import AntdInput from './components/AntdInput.ts';
import Select from './components/Select.ts';
//import Alert from './components/Alert.ts';
import Result from './components/Result.ts';
import Spin from './components/Spin.ts';
import Pagination from './components/Pagination.ts';
import Switch from './components/Switch.ts';
import Modal from './components/Modal.ts';
//import Provider from './components/Select2.ts'
const anchor = ref()
onMounted(() => {
  //console.log(anchor.value);
})
</script>
<template>
<!--  <Provider :value="{}">
    <div>123</div>
  </Provider>-->
  <!--  <RcInput />-->
    <Select :options="[{label:`1232`,value:`12`}]" />
  <!--  <Alert message="Success Text" type="success" />-->
  <!--  <Button type="primary" key="console">
      Go Console
    </Button>-->
  <!--  <Result
        title="Your operation has been executed"
    >
      <template #extra>
        <Button type="primary" key="console">
          Go Console
        </Button>
      </template>
    </Result>-->
  <!--  <Spin/>-->
  <!--  <Pagination defaultCurrent="1" total="50" />-->
  <!--  <Switch/>-->

<!--    <Modal
        title="Basic Modal"
        :open="true"
    >
      <p>Some contents...</p>
      <p>Some contents...</p>
      <p>Some contents...</p>
    </Modal>-->

  <!--  <AntdConfigProvider>

    </AntdConfigProvider>-->
  <!--  <AntdInput ref="anchor" placeholder="Basic usage" />-->
  <!--   <Button class="123" :style="{padding: 20, border: `1px solid blue`}">123</Button>
 <Provider a="123" @click="(e)=>console.log(e)" class="12">
     <template #default="{title}">
       {{ title }}
       <Button>{{ title }}</Button>
     </template>
   </Provider>-->
</template>

<style scoped>
</style>
