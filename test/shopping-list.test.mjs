import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingItems} from '../public/js/shopping-list.mjs';
const meal = {mealNumber:1, options:[{optionNumber:1,foods:[{name:'Rice',amount:'100 g'}]},{optionNumber:2,foods:[{name:'Oats',amount:'50 g'}]}]};
test('shopping list reflects selected meal options rather than every alternative',()=>{assert.deepEqual(shoppingItems({meals:[meal],selectedOptionNumbers:{1:2}}),[{name:'Oats',amount:'50 g'}]);assert.deepEqual(shoppingItems({meals:[meal]}),[{name:'Rice',amount:'100 g'}]);});
test('legacy and manual plans display only foods actually saved',()=>{assert.deepEqual(shoppingItems({meals:[{foods:[{name:'Egg',grams:80}]}]}),[{name:'Egg',amount:'80 g'}]);assert.deepEqual(shoppingItems({meals:[{}]}),[])});
