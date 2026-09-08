import { database,ensureSchema } from './repository';

type CountRow={count:number};
function clientId(request:Request){return request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local'}
export async function rateLimit(request:Request,scope:string,limit:number,windowSeconds=60){await ensureSchema();const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/windowSeconds),key=`${scope}:${clientId(request)}:${bucket}`,expiresAt=(bucket+1)*windowSeconds;const row=await database().prepare('INSERT INTO salmon_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,expiresAt).first<CountRow>();const remaining=Math.max(0,limit-(row?.count??1));if((row?.count??1)>limit)return Response.json({error:{code:'rate_limited',message:'Too many requests. Try again shortly.'}},{status:429,headers:{'retry-after':String(Math.max(1,expiresAt-now)),'x-ratelimit-limit':String(limit),'x-ratelimit-remaining':'0'}});return {remaining}
}
