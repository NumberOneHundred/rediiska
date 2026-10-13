const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB={
 prepare(sql){
  return {bind(...args){
   const st=db.prepare(sql);
   return {
    first:async()=>st.get(...args),
    all:async()=>({results:st.all(...args)}),
    run:async()=>{const r=st.run(...args);return {meta:{changes:Number(r.changes)}};}
   };
  }};
 },
 async batch(list){const out=[];for(const s of list)out.push(await s.run());return out;}
};
let user={userId:'owner-id',email:'vimare1999@gmail.com',displayName:'Owner'};const cache={};function moduleAt(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;const code=ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});vm.runInNewContext(code,{exports:m.exports,module:m,require(name){if(name==='cloudflare:workers')return{env:{DB,OWNER_EMAIL:'vimare1999@gmail.com'}};if(name.endsWith('/identity'))return{getUser:async()=>user};if(name.startsWith('.'))return moduleAt(path.resolve(path.dirname(file),name)+'.ts');throw Error(name)},Response,Request,URL,console,crypto:require('crypto').webcrypto});return m.exports}
const routes={};for(const n of ['workspace','tasks','knowledge','team','projects'])routes[n]=moduleAt('app/api/'+n+'/route.ts');
async function req(n,b,query=''){const r=await routes[n][b?'POST':'GET'](new Request('https://editor.test/api/'+n+query,{method:b?'POST':'GET',headers:b?{Origin:'https://editor.test','Content-Type':'application/json'}:{},body:b?JSON.stringify(b):undefined}));return {status:r.status,data:await r.json()}}
(async()=>{
 let r=await req('workspace');assert.equal(r.status,200);assert.equal(r.data.projects.length,5);assert.equal(r.data.tasks.length,0);
 await req('team',{email:'external@test.io',name:'External',role:'external',projects:[0],active:true});await req('team',{email:'editor@test.io',name:'Editor',role:'editor',projects:[0],active:true});
 let k=await req('knowledge',{action:'save',record:{project:0,kind:'rule',title:'Internal',content:'Private rule',source:'Wiki',scope:'Project',visibility:'internal'}});assert.equal(k.status,200);k=(await req('knowledge',{action:'approve',id:k.data.record.id,revision:1})).data.record;
 let pub=(await req('knowledge',{action:'save',record:{project:0,kind:'rule',title:'Public to assigned',content:'Allowed rule',source:'Wiki',scope:'Project',visibility:'external'}})).data.record;pub=(await req('knowledge',{action:'approve',id:pub.id,revision:1})).data.record;
 let t=(await req('tasks',{action:'save',record:{project:0,title:'Task',type:'Коммуникации',assignee:'external@test.io',brief:'Brief',text:'Text',fields:[{name:'Title',text:'Long text',limit:3}],questions:[{question:'When?',answer:'',blocking:true}]}})).data.record;
 assert.equal((await req('tasks',{action:'status',id:t.id,revision:t.revision,status:'На ревью'})).status,400);
 t=(await req('tasks',{action:'save',id:t.id,revision:t.revision,record:{...t,questions:[{question:'When?',answer:'Tomorrow',blocking:true}],fields:[{name:'Title',text:'ok',limit:3}]}})).data.record;
 assert.equal((await req('tasks',{action:'save',id:t.id,revision:1,record:t})).status,409);
 t=(await req('tasks',{action:'approveBrief',id:t.id,revision:t.revision})).data.record;assert(t.briefApproval);
 t=(await req('tasks',{action:'status',id:t.id,revision:t.revision,status:'На ревью'})).data.record;assert.equal(t.status,'На ревью');
 const owner=user;user={userId:'ext-id',email:'external@test.io',displayName:'External'};
 r=await req('workspace');assert.equal(r.data.tasks.length,1);assert.equal(r.data.projects.length,1);assert.equal(r.data.members.length,0);
 r=await req('knowledge');assert.equal(r.data.records.length,1);assert.equal(r.data.records[0].id,pub.id);
 assert.equal((await req('knowledge',null,'?id='+k.id)).status,404);assert.equal((await req('tasks',{action:'status',id:t.id,revision:t.revision,status:'Готово'})).status,403);
 assert.equal((await req('team',{email:'hack@test.io',name:'hack',role:'chief',projects:[]})).status,403);
 assert.equal((await req('knowledge',{action:'approve',id:pub.id,revision:pub.revision})).status,403);
 t=(await req('tasks',{action:'comment',id:t.id,revision:t.revision,text:'Question to chief'})).data.record;assert.equal(t.comments.length,1);
 user={userId:'other-id',email:'stranger@test.io',displayName:'Stranger'};assert.equal((await req('workspace')).status,403);
 user=owner;t=(await req('tasks',{action:'status',id:t.id,revision:t.revision,status:'Готово'})).data.record;assert.equal(t.status,'Готово');
 t=(await req('tasks',{action:'save',id:t.id,revision:t.revision,record:{...t,text:'Changed',brief:'New brief'}})).data.record;assert.equal(t.status,'В работе');assert.equal(t.briefApproval,null);
 const history=(await req('tasks',null,'?id='+t.id)).data.records;assert(history.length>=6);
 // Reassign: external cannot view the task or its historic snapshots anymore.
 t=(await req('tasks',{action:'save',id:t.id,revision:t.revision,record:{...t,assignee:owner.email}})).data.record;
 user={userId:'ext-id',email:'external@test.io',displayName:'External'};assert.equal((await req('tasks',null,'?id='+t.id)).status,404);assert.equal((await req('workspace')).data.tasks.length,0);
 user=owner;pub=(await req('knowledge',{action:'save',id:pub.id,revision:pub.revision,record:{...pub,visibility:'internal',content:'Now private'}})).data.record;
 user={userId:'ext-id',email:'external@test.io',displayName:'External'};assert.equal((await req('knowledge',null,'?id='+pub.id)).status,404);
 user=owner;let p=await req('projects',{name:'New project',desc:'Description',audience:'Adults'});assert.equal(p.status,200);assert.equal(p.data.project.id,5);
 assert.equal((await req('knowledge',{action:'save',record:{project:5,kind:'rule',title:'New project rule',content:'Content'}})).status,200);
 user=null;assert.equal((await req('workspace')).status,401);console.log('PASS: schema migration, owner bootstrap, shared data, tasks, brief approval, blockers, limits, revisions, new projects, external restrictions, assignment revocation, knowledge history restrictions, unauthenticated access');
})().catch(e=>{console.error(e);process.exit(1)});
