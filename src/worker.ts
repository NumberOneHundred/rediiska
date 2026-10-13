import * as workspace from '../app/api/workspace/route';
import * as tasks from '../app/api/tasks/route';
import * as projects from '../app/api/projects/route';
import * as team from '../app/api/team/route';
import * as knowledge from '../app/api/knowledge/route';
import {access,handle,json} from '../lib/editorial/access';
const routes:Record<string,any>={workspace,tasks,projects,team,knowledge};
export default {
 async fetch(req:Request, env:Env):Promise<Response>{
  return handle(async()=>{
   const path=new URL(req.url).pathname;
   if(path.startsWith('/api/')){
    const route=routes[path.slice(5)];
    if(!route)return json({error:'Не найдено'},404);
    const handler=route[req.method];
    if(!handler)return json({error:'Метод не поддерживается'},405);
    return handler(req);
   }
   // Protect HTML and every asset too, including example materials.
   await access(req);
   const url=new URL(req.url);
   if(url.pathname==='/')url.pathname='/index.html';
   const response=await env.ASSETS.fetch(new Request(url,req));
   const headers=new Headers(response.headers);
   headers.set('Cache-Control','private, no-store');
   headers.set('X-Content-Type-Options','nosniff');
   headers.set('Referrer-Policy','same-origin');
   headers.set('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
   return new Response(response.body,{status:response.status,headers});
  });
 }
};
