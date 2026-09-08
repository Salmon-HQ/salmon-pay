import { deliverDueWebhooks } from '@/lib/webhook-service';
export async function POST(request:Request){const secret=process.env.CRON_SECRET;if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'unauthorized'},{status:401});return Response.json({data:await deliverDueWebhooks()})}
