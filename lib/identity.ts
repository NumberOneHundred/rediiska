import {env} from 'cloudflare:workers';
import {createRemoteJWKSet, jwtVerify} from 'jose';

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyIdentity(token:string|null, config:{domain:string,audience:string}, resolver?:Parameters<typeof jwtVerify>[1]) {
 if(!token || !config.audience || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.domain)) return null;
 try {
  let keys=resolver;
  if(!keys){
   if(!keySets.has(config.domain))keySets.set(config.domain,createRemoteJWKSet(new URL(config.domain+'/cdn-cgi/access/certs')));
   keys=keySets.get(config.domain)!;
  }
  const {payload}=await jwtVerify(token,keys,{issuer:config.domain,audience:config.audience,algorithms:['RS256'],requiredClaims:['sub','email','exp','iat']});
  if(typeof payload.email!=='string'||!payload.email.includes('@')||typeof payload.sub!=='string')return null;
  const email=payload.email.trim().toLowerCase();
  return {userId:payload.sub,email,displayName:typeof payload.name==='string'?payload.name:email.split('@')[0]};
 } catch {return null}
}
// Never trust a plain email header; only Cloudflare Access's signed assertion.
export function getUser(req:Request){return verifyIdentity(req.headers.get('cf-access-jwt-assertion'),{domain:String(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,''),audience:String(env.ACCESS_AUD||'')})}
