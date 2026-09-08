import { requireApiKey } from '@/lib/auth';
import type { WebhookEndpoint } from '@/lib/domain';
import { listRecords,putRecord } from '@/lib/repository';
import { assertWebhookDestinationSafe } from '@/lib/webhook-url';
import { encryptSecret } from '@/lib/secret-crypto';

export async function GET(request:Request){const denied=await requireApiKey(request,'webhooks:read');if(denied)return denied;return Response.json({data:(await listRecords<WebhookEndpoint>('webhooks')).map(item=>({id:item.id,url:item.url,events:item.events,active:item.active,createdAt:item.createdAt}))})}
export async function POST(request:Request){const denied=await requireApiKey(request,'webhooks:write');if(denied)return denied;const input=await request.json();let url:string;try{url=await assertWebhookDestinationSafe(input.url)}catch(error){return Response.json({error:{code:'invalid_url',message:error instanceof Error?error.message:'Invalid URL'}},{status:400})}const id=`wh_${crypto.randomUUID().replaceAll('-','').slice(0,12)}`,secret=`whsec_${crypto.randomUUID().replaceAll('-','')}`,endpoint:WebhookEndpoint={id,url,events:input.events??['payment.paid'],active:true,secretCiphertext:await encryptSecret(secret),createdAt:new Date().toISOString()};await putRecord('webhooks',id,endpoint);return Response.json({data:{id,url,events:endpoint.events,active:true,createdAt:endpoint.createdAt,secret},warning:'The signing secret is shown once.'},{status:201})}
