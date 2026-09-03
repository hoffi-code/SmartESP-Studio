<template>
  <slot></slot>
</template>

<script setup>
import { computed, provide } from "vue";

// Macht Namen aus einer variable_map (z.B. api.actions[].variables) fuer jeden
// LambdaField in diesem Zweig als implizite Scope-Variablen verfuegbar -- ohne
// die vielen generischen Zwischenkomponenten (SchemaField/ListField/ObjectField/
// PrimitiveField) mit einer neuen Prop durchreichen zu muessen. Ein eigener
// Komponenten-Wrapper ist noetig, weil provide() pro Komponenteninstanz gilt:
// ListField rendert mehrere Actions in einer v-for-Schleife, jede mit eigenen
// Variablennamen, das braucht also eine Instanz pro Listen-Eintrag.
const props = defineProps({
  names: { type: Array, default: () => [] }
});

provide("lambdaScopeVariableNames", computed(() => props.names));
</script>
