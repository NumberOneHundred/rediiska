import {env} from 'cloudflare:workers';
import {getUser} from '../identity';
export const SITE='rediiska';
// Set the owner email in deployment configuration.
export const OWNER_EMAIL=String(env.OWNER_EMAIL||'').trim().toLowerCase();
export const initialProjects=[
 {id:0,name:'Учебник · Информатика',desc:'Уроки, карточки и задания',audience:'Школьники 7–9 классов',icon:'▤'},
 {id:1,name:'Кадровый резерв',desc:'CRM, SMM и коммуникации конкурса',audience:'Учителя информатики',icon:'↗'},
 {id:2,name:'ШАД · Промо',desc:'Интенсивы, события и промокампании',audience:'Студенты и участники программ',icon:'✳'},
 {id:3,name:'Репетитор AI',desc:'Лендинг и продуктовые коммуникации',audience:'Школьники и родители',icon:'◈'},
 {id:4,name:'Лицей',desc:'Витрина курсов и гайды',audience:'Школьники, выбирающие программу',icon:'⌘'}
];
export class AppError extends Error {constructor(public status:number,message:string){super(message)}}
export const requireThat=(ok:unknown,status:number,message:string)=>{if(!ok)throw new AppError(status,message)};
export async function access(req:Request){
 const u=await getUser(req);requireThat(u,401,'Войдите в аккаунт с доступом к платформе.');
 let workspace:any=await env.DB.prepare('SELECT * FROM workspaces WHERE id=?').bind(SITE).first();
 const isOwner=u!.email.toLowerCase()===OWNER_EMAIL;
 if(!workspace&&isOwner){await env.DB.prepare('INSERT OR IGNORE INTO workspaces (id,owner_id) VALUES (?,?)').bind(SITE,u!.userId).run();workspace=await env.DB.prepare('SELECT * FROM workspaces WHERE id=?').bind(SITE).first()}
 requireThat(workspace,403,'Рабочее пространство ещё не настроено владельцем.');
 const member:any=isOwner?{role:'chief',name:u!.displayName,projects:[],active:1}:await env.DB.prepare('SELECT * FROM members WHERE workspace=? AND email=? AND active=1').bind(SITE,u!.email.toLowerCase()).first();
 requireThat(member,403,'Нет доступа к редакции. Попросите владельца добавить ваш email.');
 const rows=await env.DB.prepare('SELECT * FROM projects WHERE workspace=? ORDER BY id').bind(SITE).all();
 if(!rows.results.length&&isOwner){await env.DB.batch(initialProjects.map(p=>env.DB.prepare('INSERT OR IGNORE INTO projects (workspace,id,revision,payload) VALUES (?,?,1,?)').bind(SITE,p.id,JSON.stringify(p))))}
 return {user:u!,owner:workspace.owner_id as string,role:member.role as string,projectIds:isOwner?[]:JSON.parse(member.projects||'[]') as number[],chief:member.role==='chief'};
}
export type Access=Awaited<ReturnType<typeof access>>;
export function inProject(a:Access,id:number){return a.chief||a.projectIds.includes(id)}
export function canTask(a:Access,t:any){return inProject(a,t.project)&&(a.role!=='external'||t.assignee===a.user.email.toLowerCase())}
export async function projectExists(a:Access,id:number){requireThat(Number.isInteger(id)&&inProject(a,id),403,'Проект недоступен.');const p=await env.DB.prepare('SELECT id FROM projects WHERE workspace=? AND id=?').bind(SITE,id).first();requireThat(p,400,'Проект не найден.')}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}})}
export async function handle(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof AppError)return json({error:e.message},e.status);console.error('editorial request failed',e instanceof Error?e.name:'unknown');return json({error:'Не удалось выполнить запрос. Повторите позже.'},500)}}
export async function body(req:Request){requireThat(req.headers.get('origin')===new URL(req.url).origin,403,'Недопустимый источник запроса.');const raw=await req.text();requireThat(raw.length<600000,413,'Материал слишком большой. Разделите его на части.');try{return JSON.parse(raw)}catch{throw new AppError(400,'Некорректный формат запроса.')}}
export function str(v:unknown,max=150000){requireThat(v===undefined||v===null||typeof v==='string',400,'Некорректное текстовое поле.');const s=String(v??'').trim();requireThat(s.length<=max,400,'Поле превышает допустимую длину.');return s}
export async function latestTasks(){const r=await env.DB.prepare('SELECT t.* FROM task_versions t JOIN (SELECT id,MAX(revision) r FROM task_versions WHERE workspace=? GROUP BY id) l ON t.id=l.id AND t.revision=l.r WHERE t.workspace=? ORDER BY t.updated_at DESC').bind(SITE,SITE).all();return r.results.map((r:any)=>({...JSON.parse(r.payload),id:r.id,revision:r.revision,updatedAt:r.updated_at,actor:r.actor}))}
