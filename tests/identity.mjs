import {build} from 'esbuild';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import assert from 'node:assert/strict';
const bundle=await build({entryPoints:['lib/identity.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env = {};'}));}}]});
const {verifyIdentity}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='test';
const resolver=createLocalJWKSet({keys:[jwk]});
const config={domain:'https://rediiska-test.cloudflareaccess.com',audience:'app-audience'};
async function token(extra={},aud=config.audience,exp='2h'){
 return new SignJWT({email:'EDITOR@EXAMPLE.COM',...extra}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(config.domain).setAudience(aud).setSubject('test-user').setIssuedAt().setExpirationTime(exp).sign(privateKey);
}
assert.equal((await verifyIdentity(await token(),config,resolver)).email,'editor@example.com');
assert.equal(await verifyIdentity(null,config,resolver),null);
assert.equal(await verifyIdentity('forged',config,resolver),null);
assert.equal(await verifyIdentity(await token({},'another-app'),config,resolver),null);
assert.equal(await verifyIdentity(await token({},config.audience,'-1h'),config,resolver),null);
assert.equal(await verifyIdentity(await token({email:null}),config,resolver),null);
assert.equal(await verifyIdentity(await token(),{...config,domain:'https://evil.test'},resolver),null);
console.log('PASS: signed identity, forged/expired tokens, audience and issuer isolation, email validation');
