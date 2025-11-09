<script setup lang="ts">
//import Button from './components/Button.ts'
//import Provider from './components/Provider.ts'
import Button from './components/Select.ts';
import Provider from './components/Select2.ts'
</script>
<template>
  <Button class="123" :style="{padding: 20, border: `1px solid blue`}">123</Button>
<!--  <Provider a="123" @click="(e)=>console.log(e)" class="12">
    <template #default="{title}">
      {{ title }}
      <Button>{{ title }}</Button>
    </template>
  </Provider>-->
</template>

<style scoped>
</style>
