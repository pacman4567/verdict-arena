import test from 'node:test';
import assert from 'node:assert/strict';
import {compare} from '../lib/checker.ts';
import {problemSchema,visibleProblem,seeds} from '../lib/problems.ts';
test('token checker ignores spacing but not values',()=>{
 assert.equal(compare('1\n 2\t3\n','1 2 3','tokens',0),true);
 assert.equal(compare('1 2 4','1 2 3','tokens',0),false);
 assert.equal(compare('1 2','1 2 3','tokens',0),false);
});
test('exact checker preserves trailing whitespace and normalizes CRLF',()=>{
 assert.equal(compare('ok\r\n','ok\n','exact',0),true);
 assert.equal(compare('ok','ok\n','exact',0),false);
});
test('floating checker uses bounded absolute and relative tolerance',()=>{
 assert.equal(compare('1.0000001','1','float',1e-6),true);
 assert.equal(compare('1.01','1','float',1e-6),false);
 assert.equal(compare('1000000001','1000000000','float',1e-6),true);
 assert.equal(compare('NaN','3','float',1e-6),false);
 assert.equal(compare('Infinity','3','float',1e-6),false);
});
test('public problems never contain hidden inputs or checker source',()=>{
 const p={...seeds[0],checkerSource:'SECRET'};
 const visible=visibleProblem(p);
 assert.equal(visible.checkerSource,'');
 assert.ok(visible.tests.every(t=>t.sample));
 assert.equal(visible.tests.length,2);
 assert.equal(p.tests.length,4);
});
test('all sample problems validate, resource abuse and missing tests fail',()=>{
 for(const p of seeds)assert.ok(problemSchema.safeParse(p).success);
 assert.equal(problemSchema.safeParse({...seeds[0],timeLimit:999}).success,false);
 assert.equal(problemSchema.safeParse({...seeds[0],tests:[]}).success,false);
});
